import 'dart:async';
import 'package:flutter/material.dart';
import '../../core/utils/auto_logout_guard.dart';
import '../../core/utils/exam_session_tracker.dart';
import '../../core/utils/socket_service.dart';
import '../../core/widgets/app_bottom_nav_bar.dart';
import '../history/history_screen.dart';
import '../home/home_screen.dart';
import '../login/login_screen.dart';
import '../schedule/schedule_screen.dart';

/// Shell utama setelah login — mengatur perpindahan antara Home dan
/// Schedule Screen lewat Bottom Navigation Bar.
///
/// Memakai `IndexedStack` (bukan mengganti widget tree sepenuhnya) supaya
/// state masing-masing screen (misal posisi scroll) tetap terjaga saat
/// pindah tab.
///
/// CATATAN BUG FIX (centang hijau tidak reset lintas tab): karena
/// IndexedStack membuat HomeScreen & ScheduleScreen jadi instance State
/// yang hidup BERSAMAAN dan TERPISAH (bukan dibuang-ulang seperti
/// Navigator biasa), reset data di satu tab tidak otomatis terlihat di
/// tab lain. AppShell menjadi penghubung: pegang GlobalKey ke
/// HomeScreenState, lalu teruskan sebagai callback `onGlobalRefresh` ke
/// ScheduleScreen — begitu refresh selesai di Schedule, AppShell memanggil
/// `_homeKey.currentState?.reloadCompletedIds()` supaya Home ikut sinkron
/// tanpa perlu pindah tab dulu.
///
/// FITUR BARU — AUTO LOGOUT TENGAH MALAM:
/// Murid otomatis logout setiap pergantian hari (00:00), supaya esok
/// harinya wajib login ulang dengan Token Ruangan yang baru (token ujian
/// berbeda tiap sesi, sesuai PRD Bagian 10 & Single Session Policy Bagian
/// 16). Dua mekanisme berjalan bersamaan untuk menutup celah masing-masing:
///
/// 1. Timer presisi ke tengah malam berikutnya — aktif selama AppShell
///    hidup di foreground (app sedang dibuka).
/// 2. Pengecekan tanggal saat app di-resume (WidgetsBindingObserver) —
///    menutup celah jika app sempat di-background/di-kill MELEWATI tengah
///    malam, lalu dibuka lagi esok harinya tanpa Timer sempat berjalan.
///
/// PENTING: auto-logout TIDAK PERNAH memaksa keluar murid yang sedang
/// mengerjakan ujian (lihat ExamSessionTracker) — itu akan bentrok dengan
/// screen pinning yang aktif. Jika tengah malam lewat selagi ujian
/// berlangsung, logout DITUNDA (`_logoutPending = true`) dan baru
/// dieksekusi otomatis begitu ExamSessionTracker.isExamActive kembali
/// false (ujian selesai/disubmit).
class AppShell extends StatefulWidget {
  const AppShell({super.key});

  @override
  State<AppShell> createState() => _AppShellState();
}

class _AppShellState extends State<AppShell> with WidgetsBindingObserver {
  int _currentIndex = 0;

  final GlobalKey<HomeScreenState> _homeKey = GlobalKey<HomeScreenState>();
  final GlobalKey<HistoryScreenState> _historyKey =
      GlobalKey<HistoryScreenState>();

  late final List<Widget> _screens = [
    HomeScreen(key: _homeKey),
    ScheduleScreen(onGlobalRefresh: _handleScheduleRefreshed),
    HistoryScreen(key: _historyKey),
  ];

  Timer? _midnightTimer;
  bool _logoutPending = false;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    ExamSessionTracker.isExamActive.addListener(_handleExamActiveChanged);

    // Hubungkan ke WebSocket & pasang listener reset
    SocketService.instance.connect();
    SocketService.instance.studentResetEvent.addListener(_handleStudentReset);

    AutoLogoutGuard.recordActiveDate();
    _scheduleMidnightTimer();

    // Jaga-jaga: jika AppShell baru dibangun setelah app sempat di-kill dan
    // tengah malam sudah lewat sebelum AppShell ini sempat dibuat sama
    // sekali (mis. murid baru buka app pagi-pagi setelah app force-closed
    // semalam), cek juga di sini — bukan hanya saat resume.
    _checkMidnightCrossing();
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    ExamSessionTracker.isExamActive.removeListener(_handleExamActiveChanged);
    SocketService.instance.studentResetEvent.removeListener(_handleStudentReset);
    SocketService.instance.disconnect();
    _midnightTimer?.cancel();
    super.dispose();
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    super.didChangeAppLifecycleState(state);
    if (state == AppLifecycleState.resumed) {
      // App baru kembali ke foreground — bisa jadi sempat di-background
      // melewati tengah malam. Cek ulang, dan pasang lagi Timer presisi
      // untuk tengah malam BERIKUTNYA (timer lama mungkin sudah tidak
      // relevan setelah app lama di-background).
      _checkMidnightCrossing();
      _scheduleMidnightTimer();
    }
  }

  void _scheduleMidnightTimer() {
    _midnightTimer?.cancel();
    final duration = AutoLogoutGuard.durationUntilNextMidnight();
    _midnightTimer = Timer(duration, () {
      _checkMidnightCrossing();
      // Setelah tengah malam lewat, pasang ulang Timer untuk tengah malam
      // SESUDAHNYA — supaya fitur ini terus berjalan tiap hari selama app
      // dibiarkan terbuka di foreground (skenario jarang, tapi defensif).
      _scheduleMidnightTimer();
    });
  }

  Future<void> _checkMidnightCrossing() async {
    final crossed = await AutoLogoutGuard.hasCrossedMidnightSinceLastActive();
    if (!crossed) {
      // Tetap perbarui tanggal aktif supaya pengecekan berikutnya akurat.
      await AutoLogoutGuard.recordActiveDate();
      return;
    }
    _requestLogout();
  }

  void _requestLogout() {
    if (ExamSessionTracker.isExamActive.value) {
      // Murid sedang mengerjakan ujian — JANGAN paksa keluar. Tunda logout
      // sampai ExamSessionTracker melaporkan ujian selesai (lihat
      // _handleExamActiveChanged).
      _logoutPending = true;
      debugPrint('[HERO EXAM] Auto-logout tengah malam ditunda — ujian sedang berlangsung.');
      return;
    }
    _performLogout();
  }

  void _handleExamActiveChanged() {
    // Dipanggil setiap ExamSessionTracker.isExamActive berubah. Jika ujian
    // baru saja SELESAI (value jadi false) dan ada logout yang tertunda,
    // eksekusi sekarang.
    if (!ExamSessionTracker.isExamActive.value && _logoutPending) {
      _logoutPending = false;
      _performLogout();
    }
  }

  void _handleStudentReset() {
    final event = SocketService.instance.studentResetEvent.value;
    if (event != null) {
      debugPrint('[AppShell] Menerima event student-reset, mereload completed IDs...');
      _homeKey.currentState?.reloadCompletedIds();
    }
  }

  Future<void> _performLogout() async {
    if (!mounted) return;
    await AutoLogoutGuard.clearSession();
    if (!mounted) return;
    Navigator.of(context).pushAndRemoveUntil(
      MaterialPageRoute(builder: (_) => const LoginScreen()),
      (route) => false,
    );
  }

  void _handleScheduleRefreshed() {
    // Reset di ScheduleScreen sudah selesai (ExamProgressStore.clearAll
    // sudah dipanggil) — sekarang minta HomeScreen reload _completedIds
    // miliknya sendiri supaya centang hijau ikut hilang tanpa perlu
    // berpindah tab secara manual.
    _homeKey.currentState?.reloadCompletedIds();
  }

  void _handleTabTap(int index) {
    setState(() => _currentIndex = index);
    if (index == 2) {
      // History bersumber dari server (bukan local storage) — reload
      // setiap kali tab ini dibuka, supaya selalu menampilkan data
      // terbaru (mis. setelah murid baru saja submit ujian lain).
      _historyKey.currentState?.reload();
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: IndexedStack(index: _currentIndex, children: _screens),
      bottomNavigationBar: AppBottomNavBar(
        currentIndex: _currentIndex,
        onTap: _handleTabTap,
      ),
    );
  }
}