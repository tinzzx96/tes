import 'dart:async';
import 'package:connectivity_plus/connectivity_plus.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import '../theme/app_colors.dart';
import '../utils/exam_progress_store.dart';
import '../utils/security_guard.dart';

/// Komponen status untuk header gelap (Home & Schedule Screen).
///
/// Terdiri dari 3 bagian terpisah, sesuai revisi terbaru:
/// 1. Jam digital real-time (update tiap menit), ukuran diperbesar.
/// 2. Indikator WiFi 2-state (hijau = connected, abu = disconnected),
///    update REAL-TIME lewat stream `connectivity_plus` — bukan polling.
///    Tap untuk membuka halaman Settings WiFi sistem Android.
/// 3. Tombol Data — shortcut membuka halaman Settings jaringan/data
///    seluler sistem Android (app tidak bisa toggle data secara
///    programatik, itu kontrol sistem, bukan kewenangan app biasa).
/// 4. Tombol Refresh terpisah (di bawah garis kuning, dipasang oleh
///    pemanggil — lihat `RefreshScheduleButton` di bagian bawah file ini),
///    berisi bypass reset status ujian untuk keperluan development.
///
/// CATATAN SIGNAL WIFI: Android mewajibkan izin lokasi (ACCESS_FINE_
/// LOCATION) untuk membaca kekuatan sinyal WiFi (RSSI) sejak Android 8.1+,
/// sebagai privacy guard. Atas keputusan eksplisit, indikator ini SENGAJA
/// hanya 2 state (connected/disconnected) tanpa signal bar bertingkat,
/// supaya app TIDAK perlu meminta izin lokasi sama sekali.
///
/// CATATAN PERILAKU DI DALAM UJIAN: jika `isInsideExam` true, tap pada
/// indikator WiFi/tombol Data akan menampilkan dialog peringatan dulu
/// ("akan keluar dari mode ujian") sebelum membuka Settings, karena
/// membuka Settings saat `startLockTask()` aktif akan otomatis melepas
/// screen pinning dan terdeteksi sebagai pelanggaran oleh anti-cheat loop
/// di ExamPlayerScreen — ini bukan bug, ini konsekuensi by design dari
/// sistem keamanan yang sudah ada, dan dialog ini hanya memberi peringatan
/// supaya murid sadar konsekuensinya sebelum lanjut.
class HeaderStatusActions extends StatefulWidget {
  /// Set true HANYA jika widget ini dipasang di dalam ExamPlayerScreen.
  /// Default false untuk Home & Schedule Screen (ujian belum berlangsung,
  /// tidak ada risiko trigger anti-cheat).
  final bool isInsideExam;

  const HeaderStatusActions({super.key, this.isInsideExam = false});

  @override
  State<HeaderStatusActions> createState() => _HeaderStatusActionsState();
}

class _HeaderStatusActionsState extends State<HeaderStatusActions> {
  late DateTime _now;
  Timer? _clockTimer;
  bool _isConnected = false;
  StreamSubscription<List<ConnectivityResult>>? _connectivitySubscription;

  @override
  void initState() {
    super.initState();
    _now = DateTime.now();
    _initConnectivity();
    _startClock();
  }

  void _startClock() {
    final secondsToNextMinute = 60 - _now.second;
    Future.delayed(Duration(seconds: secondsToNextMinute), () {
      if (!mounted) return;
      setState(() => _now = DateTime.now());
      _clockTimer = Timer.periodic(const Duration(minutes: 1), (_) {
        if (!mounted) return;
        setState(() => _now = DateTime.now());
      });
    });
  }

  Future<void> _initConnectivity() async {
    // Cek status awal sekali.
    final initial = await Connectivity().checkConnectivity();
    if (mounted) {
      setState(() => _isConnected = _hasActiveConnection(initial));
    }

    // Lalu berlangganan stream — perubahan koneksi (WiFi putus, data
    // dimatikan, dsb) langsung tercermin REAL-TIME tanpa polling manual.
    _connectivitySubscription =
        Connectivity().onConnectivityChanged.listen((results) {
          if (!mounted) return;
          setState(() => _isConnected = _hasActiveConnection(results));
        });
  }

  bool _hasActiveConnection(List<ConnectivityResult> results) {
    return results.any((r) =>
    r == ConnectivityResult.wifi || r == ConnectivityResult.mobile);
  }

  @override
  void dispose() {
    _clockTimer?.cancel();
    _connectivitySubscription?.cancel();
    super.dispose();
  }

  String get _timeLabel {
    final h = _now.hour.toString().padLeft(2, '0');
    final m = _now.minute.toString().padLeft(2, '0');
    return '$h:$m';
  }

  Future<void> _handleWifiTap() async {
    HapticFeedback.lightImpact();
    final proceed = await _confirmIfInsideExam(
      action: 'membuka pengaturan WiFi',
    );
    if (!proceed) return;
    await SecurityGuard.openWifiSettings();
  }

  Future<void> _handleDataTap() async {
    HapticFeedback.lightImpact();
    final proceed = await _confirmIfInsideExam(
      action: 'membuka pengaturan data seluler',
    );
    if (!proceed) return;
    await SecurityGuard.openNetworkSettings();
  }

  /// Jika sedang di dalam ujian, tampilkan dialog peringatan dan kembalikan
  /// true hanya jika murid memilih "Tetap Lanjutkan". Di luar ujian (Home/
  /// Schedule), langsung kembalikan true tanpa dialog.
  Future<bool> _confirmIfInsideExam({required String action}) async {
    if (!widget.isInsideExam) return true;
    if (!mounted) return false;

    final result = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        backgroundColor: AppColors.surface,
        title: Text(
          'Keluar dari Mode Ujian?',
          style: TextStyle(color: AppColors.textPrimary, fontWeight: FontWeight.w700),
        ),
        content: Text(
          'Anda akan $action. Tindakan ini akan keluar dari layar terkunci '
              'ujian dan akan tercatat sebagai pelanggaran. Lanjutkan?',
          style: TextStyle(color: AppColors.textSecondary, fontSize: 13, height: 1.4),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(ctx).pop(false),
            child: Text('Batal',
                style: TextStyle(color: AppColors.textSecondary)),
          ),
          TextButton(
            onPressed: () => Navigator.of(ctx).pop(true),
            child: Text('Tetap Lanjutkan',
                style: TextStyle(color: AppColors.primary, fontWeight: FontWeight.w700)),
          ),
        ],
      ),
    );
    return result ?? false;
  }

  @override
  Widget build(BuildContext context) {
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        // ── Jam digital — diperbesar dari revisi sebelumnya ────────────
        Text(
          _timeLabel,
          style: TextStyle(
            color: Colors.white.withOpacity(0.7),
            fontSize: 15,
            fontWeight: FontWeight.w600,
            letterSpacing: 0.5,
            fontFeatures: const [FontFeature.tabularFigures()],
          ),
        ),
        const SizedBox(width: 12),
        Container(width: 1, height: 14, color: Colors.white.withOpacity(0.15)),
        const SizedBox(width: 12),
        // ── Indikator WiFi 2-state, real-time ──────────────────────────
        InkWell(
          borderRadius: BorderRadius.circular(18),
          onTap: _handleWifiTap,
          child: Padding(
            padding: const EdgeInsets.all(5),
            child: Icon(
              _isConnected ? Icons.wifi_rounded : Icons.wifi_off_rounded,
              size: 20,
              color: _isConnected
                  ? AppColors.online
                  : Colors.white.withOpacity(0.35),
            ),
          ),
        ),
        const SizedBox(width: 4),
        // ── Tombol Data (shortcut ke Settings jaringan) ────────────────
        InkWell(
          borderRadius: BorderRadius.circular(18),
          onTap: _handleDataTap,
          child: Padding(
            padding: const EdgeInsets.all(5),
            child: Icon(
              Icons.sim_card_outlined,
              size: 19,
              color: Colors.white.withOpacity(0.55),
            ),
          ),
        ),
      ],
    );
  }
}

/// Tombol Refresh terpisah, dipasang DI BAWAH garis kuning header (bukan
/// di Row sejajar logo seperti HeaderStatusActions), sesuai revisi.
///
/// Berisi fungsi bypass reset status ujian untuk keperluan development —
/// lihat komentar TODO di dalam `_handleRefresh`.
class RefreshScheduleButton extends StatefulWidget {
  /// Dipanggil setelah proses refresh selesai, supaya screen pemanggil
  /// bisa reload data (jadwal dan/atau status completed) miliknya sendiri.
  final VoidCallback? onRefreshComplete;

  const RefreshScheduleButton({super.key, this.onRefreshComplete});

  @override
  State<RefreshScheduleButton> createState() => _RefreshScheduleButtonState();
}

class _RefreshScheduleButtonState extends State<RefreshScheduleButton> {
  bool _isRefreshing = false;

  Future<void> _handleRefresh() async {
    if (_isRefreshing) return;
    setState(() => _isRefreshing = true);
    HapticFeedback.lightImpact();

    // TODO: Hapus fungsi bypass ini saat rilis Production
    //
    // BYPASS DEBUGGING — khusus tahap development. Membalikkan (reset):
    // 1. Status "sudah submit" SEMUA ujian (centang hijau di ExamCard).
    // 2. Status blokir & counter pelanggaran (Log Kecurangan) ke 0x.
    // Supaya tester bisa membuka ulang ujian yang sudah selesai DAN mengulang
    // skenario pelanggaran dari awal tanpa harus uninstall app / hapus data
    // secara manual berulang-ulang saat melakukan QA.
    //
    // Saat production: ganti blok ini dengan pemanggilan Exam API biasa
    // untuk refresh jadwal terbaru dari server. JANGAN panggil
    // ExamProgressStore.clearAll() ataupun clearAllCheatStatus() — status
    // submit dan counter pelanggaran asli harus berasal dari backend, bukan
    // direset oleh tombol ini.
    await ExamProgressStore.clearAll();
    await ExamProgressStore.clearAllCheatStatus();
    await Future.delayed(const Duration(milliseconds: 400));

    if (!mounted) return;
    setState(() => _isRefreshing = false);
    widget.onRefreshComplete?.call();

    ScaffoldMessenger.of(context).showSnackBar(
      const SnackBar(
        behavior: SnackBarBehavior.floating,
        backgroundColor: AppColors.surface,
        duration: Duration(seconds: 2),
        content: Text(
          'Status ujian direset (mode development)',
          style: TextStyle(color: AppColors.textSecondary, fontSize: 12),
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return InkWell(
      borderRadius: BorderRadius.circular(6),
      onTap: _handleRefresh,
      child: Padding(
        padding: const EdgeInsets.symmetric(vertical: 4, horizontal: 2),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            _isRefreshing
                ? SizedBox(
              width: 13,
              height: 13,
              child: CircularProgressIndicator(
                strokeWidth: 1.5,
                color: Colors.white.withOpacity(0.5),
              ),
            )
                : Icon(
              Icons.refresh_rounded,
              size: 15,
              color: Colors.white.withOpacity(0.5),
            ),
            const SizedBox(width: 6),
            Text(
              'Refresh',
              style: TextStyle(
                color: Colors.white.withOpacity(0.5),
                fontSize: 12,
                fontWeight: FontWeight.w500,
              ),
            ),
          ],
        ),
      ),
    );
  }
}