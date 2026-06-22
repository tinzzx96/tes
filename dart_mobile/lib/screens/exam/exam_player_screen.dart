import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:freerasp/freerasp.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../../core/models/question.dart';
import '../../core/theme/app_colors.dart';
import '../../core/theme/app_radius.dart';
import '../../core/theme/app_typography.dart';
import '../../core/utils/dummy_data_repository.dart';
import '../../core/utils/exam_progress_store.dart';
import '../../core/utils/exam_session_tracker.dart';
import '../../core/utils/security_guard.dart';
import 'exam_action_bar.dart';
import 'question_navigator_grid.dart';

// ─── Konstanta ────────────────────────────────────────────────────────────────

/// PIN supervisor bawaan. Ganti nilai ini (atau ambil dari API) sebelum rilis.
const String _kSupervisorPin = '1234';

/// Batas maksimal pelanggaran sebelum auto-submit paksa.
const int _kMaxPelanggaran = 5;

/// Kunci shared_preferences untuk status blokir & counter pelanggaran.
/// Kunci shared_preferences untuk status blokir & counter pelanggaran.
/// PENTING: nilai string ini HARUS identik dengan ExamProgressStore.keyIsBlokir
/// dan ExamProgressStore.keyCounterPelanggaran (lib/core/utils/exam_progress_store.dart)
/// — tombol Refresh (HeaderStatusActions) mereset kunci ini lewat
/// ExamProgressStore.clearAllCheatStatus(), bukan lewat konstanta privat di
/// file ini. Jika salah satu nilai diubah, ubah juga yang satunya.
///
/// TODO(PRODUCTION — WAJIB sebelum rilis): kunci ini saat ini GLOBAL, tidak
/// terikat ke examId tertentu. Akibatnya counter pelanggaran MENUMPUK lintas
/// mapel ujian yang berbeda — jika siswa kena 3x pelanggaran di Ujian
/// Matematika lalu melanjutkan ke Ujian Produktif RPL, counter TIDAK reset
/// ke 0, sehingga tinggal 2x pelanggaran lagi (bahkan akibat hal sepele
/// yang tidak disengaja) langsung mendiskualifikasi siswa di mapel yang
/// belum pernah ia langgar sama sekali. Fix yang benar: ubah kunci ini agar
/// menyertakan examId, contoh:
///   String _keyCounterFor(String examId) => 'hero_exam_counter_$examId';
///   String _keyBlokirFor(String examId) => 'hero_exam_is_blokir_$examId';
/// lalu seluruh pemanggilan prefs.getInt/setInt/getBool/setBool di file ini
/// (cari semua _kKeyIsBlokir & _kKeyCounter) diganti memakai variant
/// per-exam tersebut (panggil dengan widget.examId). Counter pelanggaran
/// jadi otomatis mulai dari 0 setiap kali siswa membuka ExamPlayerScreen
/// untuk examId yang berbeda, tanpa kehilangan riwayat pelanggaran mapel
/// sebelumnya (tetap tersimpan di kunci terpisah, berguna untuk Log
/// Kecurangan yang menumpuk per siswa — lihat diskusi fitur tsb).
const String _kKeyIsBlokir = 'hero_exam_is_blokir';
const String _kKeyCounter = 'hero_exam_counter_pelanggaran';

// ─── Widget Utama ──────────────────────────────────────────────────────────────

class ExamPlayerScreen extends StatefulWidget {
  final String examId;
  final String subjectName;
  final String teacherName;

  const ExamPlayerScreen({
    super.key,
    required this.examId,
    required this.subjectName,
    required this.teacherName,
  });

  @override
  State<ExamPlayerScreen> createState() => _ExamPlayerScreenState();
}

class _ExamPlayerScreenState extends State<ExamPlayerScreen>
    with WidgetsBindingObserver {

  // ── Data Soal ──────────────────────────────────────────────────────────────
  // Diinisialisasi di initState() memakai widget.examId, supaya tiap mapel
  // menampilkan soal yang BERBEDA. Tidak bisa di-inline di sini karena
  // `widget` belum tersedia saat field initializer dievaluasi.
  late final List<Question> _questions;
  int _currentIndex = 0;

  // ── Timer Submit (server-side di produksi, lokal di dev) ──────────────────
  // TODO(produksi): kembalikan ke durasi ujian sesungguhnya (mis. 90/120
  // menit sesuai ExamSchedule.durationMinutes dari server) sebelum rilis.
  // 30 detik dipakai SEMENTARA agar tombol Submit cepat aktif saat testing.
  Duration _submitCountdown = const Duration(seconds: 30);
  bool _submitUnlocked = false;
  Timer? _submitTimer;

  // ── Timer Ujian (header) — TERPISAH dari _submitCountdown di atas ────────
  // Ini adalah Timer System sesungguhnya (PRD Bagian 14): sisa waktu total
  // pengerjaan ujian, ditampilkan di header sejajar badge pelanggaran.
  // SENGAJA dipisah dari _submitCountdown (yang fungsinya hanya membuka
  // tombol Submit setelah jeda development 30 detik) — keduanya konsep
  // berbeda dan TIDAK BOLEH berbagi satu Timer/variable yang sama, supaya
  // tampilan header tidak ikut berhenti di "00:00" begitu tombol Submit
  // sudah terbuka.
  //
  // TODO(produksi): ganti sumber durasi dari ExamSchedule.durationMinutes,
  // dan idealnya disinkronkan periodik dengan waktu server (PRD Bagian 14:
  // "Timer berjalan di sisi server, bukan di perangkat siswa") — bukan
  // murni countdown lokal seperti saat ini.
  Duration _examTimeRemaining = const Duration(minutes: 90);
  Timer? _examTimer;

  // ── Anti-Cheat Loop ───────────────────────────────────────────────────────
  Timer? _antiCheatTimer;

  // ── Focus Loss Stream (EventChannel — instan, tanpa polling delay) ──────
  StreamSubscription<bool>? _focusSubscription;

  // ── Status Keamanan ───────────────────────────────────────────────────────
  bool _isBlokir = false;
  int _counterPelanggaran = 0;
  bool _isDiskualifikasi = false;
  bool _usageAccessGranted = true; // optimistic default, dicek ulang di _boot

  // ── Input PIN Dialog ──────────────────────────────────────────────────────
  final TextEditingController _pinController = TextEditingController();
  String _pinError = '';

  // ─────────────────────────────────────────────────────────────────────────
  // Lifecycle
  // ─────────────────────────────────────────────────────────────────────────

  @override
  void initState() {
    super.initState();
    // Tandai sesi ujian aktif — mencegah AutoLogoutGuard (lihat AppShell)
    // memaksa logout tengah malam selagi murid sedang mengerjakan ujian,
    // yang akan bentrok dengan screen pinning yang aktif.
    ExamSessionTracker.isExamActive.value = true;
    // Muat soal sesuai mapel/ujian yang dibuka — beda examId = beda soal.
    _questions = DummyDataRepository.getExamQuestions(widget.examId);
    WidgetsBinding.instance.addObserver(this);
    _boot();
  }

  @override
  void dispose() {
    // Sesi ujian berakhir (submit atau widget dibuang) — AutoLogoutGuard
    // boleh kembali menjalankan logout tertunda jika tengah malam sudah
    // lewat selama ujian berlangsung.
    ExamSessionTracker.isExamActive.value = false;
    WidgetsBinding.instance.removeObserver(this);
    _submitTimer?.cancel();
    _examTimer?.cancel();
    _antiCheatTimer?.cancel();
    _focusSubscription?.cancel();
    _pinningTimeoutTimer?.cancel();
    _optionDebounceTimer?.cancel();
    _pinController.dispose();
    SecurityGuard.disableWakelock();
    SecurityGuard.exitImmersiveMode();
    SecurityGuard.unlockUi();
    super.dispose();
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Boot sequence
  // ─────────────────────────────────────────────────────────────────────────

  // ── State Guard untuk Proses Pinning ─────────────────────────────────────
  /// Saat startLockTask() dipanggil tanpa Device Owner, Android WAJIB
  /// menampilkan dialog konfirmasi sistem ("Pasang layar ini?"). Selama
  /// dialog itu terbuka menunggu input murid:
  /// 1. Window Activity kehilangan fokus ke dialog sistem → memicu
  ///    onWindowFocusChanged(false) → windowFocusStream mengirim [false].
  /// 2. App masuk AppLifecycleState.inactive (transisi lifecycle resmi,
  ///    BUKAN sekadar window focus) → didChangeAppLifecycleState terpanggil.
  ///
  /// SEBELUMNYA: kedua jalur ini sama-sama langsung memanggil
  /// _triggerBlokir() tanpa pengecualian, sehingga dialog konfirmasi sistem
  /// SENDIRI dianggap sebagai pelanggaran — terlepas berapa lama murid
  /// FIX (riwayat): sebelumnya proses screen pinning awal dijalankan DI
  /// DALAM ExamPlayerScreen ini (lihat _startPinningProcess), dengan flag
  /// _isPinningInProgress untuk menahan deteksi pelanggaran selama dialog
  /// konfirmasi sistem Android berlangsung.
  ///
  /// REFACTOR: proses pinning AWAL sekarang dipindah seluruhnya ke
  /// ValidationScreen (layar terpisah, berlatar putih + loading) yang
  /// dibuka SEBELUM ExamPlayerScreen ini di-mount sama sekali — lihat
  /// Hero Exam PRD Addendum Bagian 43 untuk alasan teknis lengkapnya
  /// (isolasi observer, tirai penutup soal, tempat steril cek izin Usage
  /// Access). Saat ExamPlayerScreen ini dibuka, layar SUDAH TERKONFIRMASI
  /// ter-pin — _boot() di bawah tidak lagi memanggil startLockTask() sama
  /// sekali untuk proses awal.
  ///
  /// Flag _isPinningInProgress TETAP dipertahankan, tapi sekarang HANYA
  /// dipakai untuk skenario RE-PINNING setelah PIN Supervisor benar saat
  /// murid sempat terblokir di tengah ujian (lihat _verifikasiPin) — bukan
  /// lagi untuk proses boot awal.
  bool _isPinningInProgress = false;

  /// Timeout pengaman re-pinning (lihat catatan _isPinningInProgress di
  /// atas) — hanya relevan untuk skenario re-pin setelah PIN benar.
  static const Duration _kPinningTimeout = Duration(seconds: 30);
  Timer? _pinningTimeoutTimer;

  Future<void> _boot() async {
    // Proteksi layar & immersive sudah diaktifkan sejak ValidationScreen,
    // tapi dipanggil ulang di sini sebagai jaga-jaga (idempotent, aman
    // dipanggil berkali-kali) untuk kasus navigasi tidak biasa.
    await SecurityGuard.enableWakelock();
    await SecurityGuard.enterImmersiveMode();
    await SecurityGuard.lockUi();

    // Langganan EventChannel: deteksi focus loss secara INSTAN. Karena
    // proses pinning AWAL sudah selesai sebelum screen ini dibuka (lihat
    // ValidationScreen), TIDAK ADA LAGI dialog konfirmasi sistem yang
    // berisiko salah terdeteksi di sini — observer langsung aktif penuh
    // sejak frame pertama. Pengecualian _isPinningInProgress tetap
    // dipertahankan murni untuk skenario re-pinning pasca-PIN Supervisor.
    _focusSubscription = SecurityGuard.windowFocusStream.listen(
          (hasFocus) {
        if (_isPinningInProgress) {
          debugPrint('[HERO EXAM] Focus loss diabaikan (proses re-pinning berlangsung)');
          return;
        }
        if (!hasFocus && mounted && !_isBlokir && !_isDiskualifikasi) {
          _triggerBlokir(alasan: 'Floating app/overlay terdeteksi (window focus hilang)');
        }
      },
      onError: (_) {}, // abaikan jika EventChannel belum siap
    );

    // Muat status persisten dari shared_preferences.
    final prefs = await SharedPreferences.getInstance();
    final cachedBlokir = prefs.getBool(_kKeyIsBlokir) ?? false;
    final cachedCounter = prefs.getInt(_kKeyCounter) ?? 0;

    if (!mounted) return;
    setState(() {
      _isBlokir = cachedBlokir;
      _counterPelanggaran = cachedCounter;
    });

    // Cek izin Usage Access — pengecekan UTAMA sudah dilakukan di
    // ValidationScreen sebelum masuk sini; pengecekan di sini murni untuk
    // menampilkan _UsageAccessBanner jika status berubah di tengah jalan
    // (mis. murid menonaktifkan izin manual saat ujian berlangsung).
    final usagePermission =
    await SecurityGuard.hasUsageStatsPermission().catchError((_) => false);
    if (!mounted) return;
    setState(() => _usageAccessGranted = usagePermission);

    // Jika sebelumnya sudah di-blokir (app dibunuh/restart), langsung
    // tampilkan dialog blokir sebelum murid bisa berinteraksi.
    if (_isBlokir) {
      WidgetsBinding.instance.addPostFrameCallback((_) => _tampilkanDialogBlokir());
    }

    // Inisialisasi freeRASP (deteksi emulator / virtual environment).
    _initFreeRasp();

    // Mulai loop anti-cheat & timer submit. Anti-cheat loop akan langsung
    // mengecek isScreenPinned() sejak siklus pertama (1 detik) — ini aman
    // karena layar SUDAH ter-pin saat screen ini dibuka.
    _startAntiCheatLoop();
    _startSubmitTimer();
    _startExamTimer();
  }

  /// Memulai ULANG proses screen pinning — HANYA dipakai untuk skenario
  /// RE-PINNING setelah PIN Supervisor diverifikasi benar saat murid
  /// sempat terblokir di tengah ujian (lihat _verifikasiPin). BUKAN lagi
  /// dipanggil saat boot awal (lihat catatan di _boot()/
  /// _isPinningInProgress di atas) — proses pinning awal kini sepenuhnya
  /// ditangani ValidationScreen sebelum ExamPlayerScreen ini di-mount.
  Future<void> _startPinningProcess() async {
    if (!mounted) return;
    setState(() => _isPinningInProgress = true);

    await SecurityGuard.startLockTask();

    // Poll isScreenPinned() setiap 300ms (lebih cepat dari anti-cheat loop
    // 1 detik biasa) khusus selama proses ini, supaya begitu murid menekan
    // OK di dialog konfirmasi, flag pengaman langsung dibuka secepatnya —
    // bukan menunggu sampai 30 detik timeout.
    _pinningTimeoutTimer?.cancel();
    final stopwatch = Stopwatch()..start();
    _pinningTimeoutTimer = Timer.periodic(const Duration(milliseconds: 300), (timer) async {
      if (!mounted) {
        timer.cancel();
        return;
      }
      final pinned = await SecurityGuard.isScreenPinned().catchError((_) => false);
      if (pinned) {
        timer.cancel();
        setState(() => _isPinningInProgress = false);
        debugPrint('[HERO EXAM] Re-pinning terkonfirmasi aktif.');
        return;
      }
      if (stopwatch.elapsed >= _kPinningTimeout) {
        timer.cancel();
        stopwatch.stop();
        if (!mounted) return;
        setState(() => _isPinningInProgress = false);
        debugPrint('[HERO EXAM] Re-pinning timeout — murid kemungkinan menolak dialog konfirmasi.');
        // Anti-cheat loop (Timer 1 detik) yang sudah berjalan akan
        // mendeteksi isScreenPinned() == false pada siklus berikutnya dan
        // memicu _triggerBlokir() secara normal — tidak perlu duplikasi
        // logic blokir di sini.
      }
    });
  }

  // ─────────────────────────────────────────────────────────────────────────
  // freeRASP — Emulator Detection
  // ─────────────────────────────────────────────────────────────────────────

  void _initFreeRasp() {
    // Konfigurasi minimal: hanya aktifkan deteksi emulator/VM.
    // Ganti signingCertHashes dengan SHA-256 (Base64) fingerprint APK
    // signing certificate yang sesungguhnya sebelum rilis ke production.
    //
    // CATATAN API (freerasp ^6.x): TalsecConfig/AndroidConfig BUKAN const
    // constructor (beda dari versi lama), jadi wajib pakai `final`, bukan
    // `const`. Nama callback resmi untuk deteksi emulator/simulator adalah
    // `onSimulator` (freeRASP MENYATUKAN deteksi Android emulator & iOS
    // simulator ke satu callback ini — bukan onEmulator/onEmulatorDetected
    // sama sekali, meski dokumentasi versi lama & beberapa artikel pihak
    // ketiga menyebutnya berbeda-beda).
    final config = TalsecConfig(
      androidConfig: AndroidConfig(
        packageName: 'com.example.apk_ujian',
        signingCertHashes: ['YOUR_SIGNING_CERT_SHA256_HASH_HERE'],
        supportedStores: ['com.android.vending'],
      ),
      watcherMail: 'security@heroexam.id',
      isProd: false, // set true saat production
    );

    final callback = ThreatCallback(
      onSimulator: () => _triggerBlokir(alasan: 'Emulator/VM terdeteksi'),
    );

    Talsec.instance.attachListener(callback);

    Talsec.instance.start(config).catchError((e) {
      // Jangan crash jika freeRASP gagal init (misal: signing hash belum dikonfigurasi).
      debugPrint('[freeRASP] init error: $e');
    });
  }

  // ─────────────────────────────────────────────────────────────────────────
  // WidgetsBindingObserver — Deteksi Floating App / Side Bar
  // ─────────────────────────────────────────────────────────────────────────

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    super.didChangeAppLifecycleState(state);
    // Saat dialog konfirmasi sistem LockTask ("Pasang layar ini?") muncul,
    // app benar-benar masuk AppLifecycleState.inactive — ini transisi
    // lifecycle resmi, BUKAN sekadar window focus loss. Tanpa pengecualian
    // ini, jalur kedua (selain windowFocusStream) akan ikut memicu blokir
    // false-positive terhadap dialog konfirmasi sistemnya sendiri.
    if (_isPinningInProgress) {
      debugPrint('[HERO EXAM] Lifecycle change diabaikan (proses pinning berlangsung)');
      return;
    }
    // Jika aplikasi kehilangan fokus (Side Bar, Game Space, overlay bawaan
    // OEM mengambil alih), picu blokir.
    if (state == AppLifecycleState.inactive ||
        state == AppLifecycleState.paused) {
      _triggerBlokir(alasan: 'Aplikasi kehilangan fokus (floating app terdeteksi)');
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Anti-Cheat Loop — Cek Screen Pinning Tiap 1 Detik
  // ─────────────────────────────────────────────────────────────────────────

  void _startAntiCheatLoop() {
    _antiCheatTimer = Timer.periodic(const Duration(seconds: 1), (_) async {
      if (!mounted) return;
      if (_isBlokir || _isDiskualifikasi) return;

      // PENTING: selama proses pinning awal/re-pinning sedang berlangsung
      // (dialog konfirmasi sistem Android masih menunggu input murid),
      // isScreenPinned() AKAN mengembalikan false karena layar memang
      // belum benar-benar tersemat — ini KONDISI NORMAL, bukan
      // pelanggaran. Tanpa guard ini, baris pengecekan `!pinned` di bawah
      // akan langsung memicu blokir di detik pertama, bahkan sebelum
      // murid sempat membaca dialog konfirmasi sistemnya sendiri.
      if (_isPinningInProgress) return;

      final bool pinned =
      await SecurityGuard.isScreenPinned().catchError((_) => false);
      if (!mounted) return;
      if (!pinned) {
        _triggerBlokir(alasan: 'Screen pinning dilepas oleh murid');
        return;
      }

      // Sinyal 1: window focus loss — menangkap overlay OEM (Smart Sidebar
      // dsb) yang mencuri fokus.
      final bool focused =
      await SecurityGuard.hasWindowFocus().catchError((_) => true);
      if (!mounted) return;
      if (!focused) {
        _triggerBlokir(alasan: 'Floating app/overlay terdeteksi (window focus hilang)');
        return;
      }

      // Sinyal 2: app lain baru saja foreground — menangkap floating app
      // pihak ketiga (mis. floating browser dari Play Store) yang SENGAJA
      // didesain untuk tidak mencuri window focus, sehingga sinyal 1 di
      // atas tidak cukup untuk mendeteksinya. Membutuhkan izin Usage
      // Access aktif; jika belum aktif, method ini selalu return false
      // (lihat catatan _boot()).
      final bool otherAppActive =
      await SecurityGuard.isOtherAppForeground().catchError((_) => false);
      if (!mounted) return;
      if (otherAppActive) {
        _triggerBlokir(alasan: 'App/floating window lain terdeteksi aktif di atas layar ujian');
      }
    });
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Submit Timer
  // ─────────────────────────────────────────────────────────────────────────

  void _startSubmitTimer() {
    // Guard: cegah dua Timer berjalan bersamaan jika _startSubmitTimer()
    // sempat terpanggil dua kali (mis. akibat hot reload saat development).
    _submitTimer?.cancel();
    debugPrint('[HERO EXAM] Submit timer dimulai: ${_submitCountdown.inSeconds} detik');
    _submitTimer = Timer.periodic(const Duration(seconds: 1), (_) {
      if (!mounted) return;
      if (_submitCountdown.inSeconds <= 1) {
        _submitTimer?.cancel();
        setState(() {
          _submitCountdown = Duration.zero;
          _submitUnlocked = true;
        });
        debugPrint('[HERO EXAM] Submit timer selesai — tombol Submit terbuka.');
        return;
      }
      setState(() => _submitCountdown -= const Duration(seconds: 1));
    });
  }

  /// Timer ujian sesungguhnya (header) — lihat dokumentasi _examTimeRemaining
  /// di atas. Berjalan independen dari _submitTimer.
  void _startExamTimer() {
    _examTimer?.cancel();
    _examTimer = Timer.periodic(const Duration(seconds: 1), (_) {
      if (!mounted) return;
      if (_examTimeRemaining.inSeconds <= 1) {
        _examTimer?.cancel();
        setState(() => _examTimeRemaining = Duration.zero);
        // TODO(produksi): saat mencapai 00:00, picu auto-submit otomatis
        // sesuai PRD Bagian 14 ("sistem otomatis menyelesaikan ujian
        // peserta dan mengirimkan seluruh jawaban yang sudah tersimpan").
        return;
      }
      setState(() => _examTimeRemaining -= const Duration(seconds: 1));
    });
  }

  // ─────────────────────────────────────────────────────────────────────────
  // _triggerBlokir — Inti logika pelanggaran
  // ─────────────────────────────────────────────────────────────────────────

  Future<void> _triggerBlokir({String alasan = ''}) async {
    if (_isDiskualifikasi || !mounted) return;
    // Hindari double-trigger saat sudah dalam mode blokir.
    if (_isBlokir) return;

    debugPrint('[HERO EXAM] Pelanggaran: $alasan');

    final prefs = await SharedPreferences.getInstance();
    final newCounter = _counterPelanggaran + 1;

    // Simpan counter ke cache (tetap ada meski app dibunuh / restart).
    await prefs.setInt(_kKeyCounter, newCounter);

    if (newCounter >= _kMaxPelanggaran) {
      // ── AUTO-SUBMIT: batas 5x pelanggaran tercapai ──────────────────────
      setState(() {
        _counterPelanggaran = newCounter;
        _isDiskualifikasi = true;
      });
      await prefs.remove(_kKeyIsBlokir); // tidak diperlukan lagi
      _antiCheatTimer?.cancel();
      await _autoSubmitJawaban();
    } else {
      // ── BLOKIR NORMAL: butuh PIN pengawas ───────────────────────────────
      await prefs.setBool(_kKeyIsBlokir, true);
      await prefs.setInt(_kKeyCounter, newCounter);

      setState(() {
        _isBlokir = true;
        _counterPelanggaran = newCounter;
      });

      if (mounted) _tampilkanDialogBlokir();
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Auto-Submit
  // ─────────────────────────────────────────────────────────────────────────

  Future<void> _autoSubmitJawaban() async {
    // TODO(produksi): kirim seluruh jawaban ke Exam API endpoint
    // POST /api/exam-attempts/{id}/force-submit beserta payload jawaban.
    // Saat ini hanya mencatat ke ExamProgressStore sebagai pengganti.
    await ExamProgressStore.markCompleted(widget.examId);
    debugPrint('[HERO EXAM] Auto-submit dieksekusi. Jawaban dikirim paksa.');

    if (mounted) {
      _tampilkanLayarDiskualifikasi();
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Dialog Blokir & Diskualifikasi — render via state flag di Stack body
  // (BUKAN showDialog), supaya BackdropFilter & konten dialog berada dalam
  // SATU compositing layer yang sama. showDialog() merender lewat Overlay
  // Flutter terpisah, yang di sejumlah device (terutama ColorOS/FuntouchOS
  // Oppo/Vivo/Realme) menyebabkan BackdropFilter gagal menangkap layer di
  // bawahnya sehingga blur terlihat tidak aktif sama sekali.
  // ─────────────────────────────────────────────────────────────────────────

  void _tampilkanDialogBlokir() {
    _pinController.clear();
    if (!mounted) return;
    setState(() => _pinError = '');
  }

  Future<void> _verifikasiPin() async {
    if (_pinController.text.trim() != _kSupervisorPin) {
      setState(() => _pinError = 'PIN salah. Coba lagi.');
      return;
    }

    final prefs = await SharedPreferences.getInstance();
    await prefs.setBool(_kKeyIsBlokir, false);

    if (!mounted) return;
    setState(() {
      _isBlokir = false;
      _pinError = '';
    });

    // PENTING: pakai _startPinningProcess() (state-based guard), BUKAN
    // panggil SecurityGuard.startLockTask() langsung. Re-pinning di sini
    // JUGA memicu dialog konfirmasi sistem Android yang sama seperti saat
    // boot pertama kali — tanpa _isPinningInProgress aktif selama proses
    // ini, dialog konfirmasi ke-2 ini akan kembali dianggap pelanggaran
    // oleh windowFocusStream/lifecycle observer, memunculkan overlay
    // blokir KEDUA yang meminta PIN lagi padahal murid baru saja
    // memasukkan PIN yang benar.
    await _startPinningProcess();
  }

  void _tampilkanLayarDiskualifikasi() {
    // Tidak perlu apa-apa: _isDiskualifikasi sudah di-set true di
    // _triggerBlokir(), dan build() akan otomatis merender layar
    // diskualifikasi karena flag tersebut.
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Navigasi & Jawaban
  // ─────────────────────────────────────────────────────────────────────────

  Question get _currentQuestion => _questions[_currentIndex];

  /// Jumlah soal yang sudah dijawab (punya selectedOptionIndex), untuk
  /// ditampilkan di progress bar.
  int get _answeredCount =>
      _questions.where((q) => q.selectedOptionIndex != null).length;

  ExamPagePosition get _position {
    if (_currentIndex == 0) return ExamPagePosition.first;
    if (_currentIndex == _questions.length - 1) return ExamPagePosition.last;
    return ExamPagePosition.middle;
  }

  void _goTo(int index) => setState(() => _currentIndex = index);

  // ── Mitigasi Anti-Spam Klik (Debouncing) ────────────────────────────────
  // Sesuai Hero Exam PRD Addendum Bagian 44 (Penanganan Race Condition pada
  // Auto Save): tombol opsi jawaban WAJIB dinonaktifkan sementara selama
  // 300ms setelah ditekan, supaya permintaan auto-save sebelumnya (saat
  // backend Node.js sudah terhubung) punya cukup waktu terkirim & diterima
  // server sebelum permintaan berikutnya dikirim. Ini mencegah race
  // condition saat murid panik menekan beberapa opsi + Next secara sangat
  // cepat pada jaringan WiFi sekolah dengan latensi tinggi.
  static const Duration _kOptionDebounce = Duration(milliseconds: 300);
  bool _isOptionLocked = false;
  Timer? _optionDebounceTimer;

  void _selectOption(int optionIndex) {
    if (_isOptionLocked) return; // abaikan tap beruntun selama debounce aktif

    setState(() {
      _currentQuestion.selectedOptionIndex = optionIndex;
      _isOptionLocked = true;
    });

    // TODO(integrasi-backend): panggil Exam API auto-save jawaban di sini
    // (POST /api/v1/exam-attempts/{id}/answers), dilindungi debounce di
    // atas agar tidak mengirim request beruntun untuk klik cepat berurutan.

    _optionDebounceTimer?.cancel();
    _optionDebounceTimer = Timer(_kOptionDebounce, () {
      if (!mounted) return;
      setState(() => _isOptionLocked = false);
    });
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Submit Manual
  // ─────────────────────────────────────────────────────────────────────────

  void _handleSubmit() {
    showDialog<void>(
      context: context,
      builder: (ctx) => AlertDialog(
        backgroundColor: AppColors.surface,
        title: Text(
          'Submit Ujian',
          style: AppTypography.cardTitle.copyWith(color: AppColors.textPrimary),
        ),
        content: Text(
          'Yakin ingin mengakhiri ujian dan mengirim jawaban?',
          style: AppTypography.cardMeta.copyWith(color: AppColors.textSecondary),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(ctx).pop(),
            child: Text(
              'Batal',
              style: AppTypography.cardMeta.copyWith(color: AppColors.textSecondary),
            ),
          ),
          TextButton(
            onPressed: () async {
              // Tandai ujian ini selesai (Home akan reload → kartu jadi
              // abu-abu + centang hijau di kanan atas).
              await ExamProgressStore.markCompleted(widget.examId);
              // Hentikan seluruh pengawasan & lepas screen pinning SEBELUM
              // keluar, supaya tidak ada blokir false-positive setelah murid
              // kembali ke Home (anti-cheat loop / focus stream tidak lagi
              // relevan begitu ujian disubmit).
              _antiCheatTimer?.cancel();
              _focusSubscription?.cancel();
              _pinningTimeoutTimer?.cancel();
              await SecurityGuard.stopLockTask();
              if (!ctx.mounted) return;
              Navigator.of(ctx).pop();
              Navigator.of(context).pop(true);
            },
            child: Text(
              'Submit',
              style: AppTypography.cardMeta.copyWith(color: AppColors.submitGreen),
            ),
          ),
        ],
      ),
    );
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Build
  // ─────────────────────────────────────────────────────────────────────────

  @override
  Widget build(BuildContext context) {
    return PopScope(
      // canPop SELALU false selama di ExamPlayerScreen — ini mengunci layar
      // di tempat: menekan tombol back / gesture back TIDAK akan membawa
      // murid keluar ke Home. Satu-satunya jalan keluar yang sah adalah
      // lewat tombol Submit (yang memanggil stopLockTask + Navigator.pop
      // secara eksplisit).
      //
      // PENTING (sesuai keputusan): menekan back TIDAK dianggap pelanggaran
      // dan TIDAK menaikkan counter. Itu terlalu keras dan berisiko menghukum
      // murid tak bersalah yang sekadar refleks menekan back. Cukup kunci di
      // tempat — tidak terjadi apa-apa, murid tetap di layar soal. Pelanggaran
      // hanya untuk hal serius (lepas pin, floating app, emulator).
      canPop: false,
      child: Scaffold(
        backgroundColor: AppColors.background,
        body: Stack(
          children: [
            // ── Konten utama ujian ──────────────────────────────────────────
            SafeArea(
              child: Column(
                children: [
                  _ExamHeader(
                    subjectName: widget.subjectName,
                    teacherName: widget.teacherName,
                    counterPelanggaran: _counterPelanggaran,
                    remainingTime: _examTimeRemaining,
                  ),
                  if (!_usageAccessGranted)
                    _UsageAccessBanner(
                      onAktifkan: () async {
                        await SecurityGuard.openUsageAccessSettings();
                      },
                    ),
                  // Progress bar tipis: berapa soal sudah dijawab dari total.
                  // Fungsional (bukan dekorasi) — membantu murid tahu sisa
                  // pekerjaan tanpa mengganggu fokus (PRD §12).
                  _ExamProgressBar(
                    answered: _answeredCount,
                    total: _questions.length,
                  ),
                  Expanded(
                    child: Container(
                      color: const Color(0xFFE8E8E8),
                      child: Column(
                        children: [
                          Expanded(
                            flex: 3,
                            child: Padding(
                              padding: const EdgeInsets.fromLTRB(16, 16, 16, 8),
                              // Transisi fade halus saat berpindah soal —
                              // key per displayNumber agar AnimatedSwitcher
                              // mendeteksi pergantian konten.
                              child: AnimatedSwitcher(
                                duration: const Duration(milliseconds: 220),
                                switchInCurve: Curves.easeOut,
                                switchOutCurve: Curves.easeIn,
                                child: _QuestionBox(
                                  key: ValueKey(_currentIndex),
                                  question: _currentQuestion,
                                  onSelectOption: _selectOption,
                                  isLocked: _isOptionLocked,
                                ),
                              ),
                            ),
                          ),
                          Expanded(
                            flex: 2,
                            child: Container(
                              margin: const EdgeInsets.fromLTRB(16, 8, 16, 8),
                              decoration: BoxDecoration(
                                color: AppColors.background,
                                borderRadius:
                                BorderRadius.circular(AppRadius.cardDark),
                              ),
                              child: QuestionNavigatorGrid(
                                questions: _questions,
                                currentIndex: _currentIndex,
                                onSelect: _goTo,
                              ),
                            ),
                          ),
                        ],
                      ),
                    ),
                  ),
                  ExamActionBar(
                    position: _position,
                    isSubmitUnlocked: _submitUnlocked,
                    submitCountdown: _submitCountdown,
                    onPrevious:
                    _currentIndex > 0 ? () => _goTo(_currentIndex - 1) : null,
                    onNext: _currentIndex < _questions.length - 1
                        ? () => _goTo(_currentIndex + 1)
                        : null,
                    onSubmit: _handleSubmit,
                  ),
                ],
              ),
            ),

            // ── Solid Cover — soal PASTI tidak terbaca saat blokir aktif ──
            // Container warna solid (BUKAN BackdropFilter/blur). Blur
            // dibuang sepenuhnya karena BackdropFilter terbukti gagal
            // render secara silent di sejumlah device Android dengan
            // Impeller rendering engine (bug resmi Flutter, terutama
            // chipset yang umum dipakai Oppo/Vivo/Realme kelas
            // menengah-bawah). Keamanan tidak boleh bergantung pada efek
            // visual yang tidak terjamin tampil di semua device — overlay
            // solid dijamin selalu merender di semua GPU/rendering engine.
            if (_isBlokir || _isDiskualifikasi)
              Positioned.fill(
                child: Container(
                  color: Colors.black,
                  alignment: Alignment.center,
                  padding: const EdgeInsets.symmetric(horizontal: 24),
                  child: _isDiskualifikasi
                      ? _DiskualifikasiCard(maxPelanggaran: _kMaxPelanggaran)
                      : _BlokirCard(
                    counterPelanggaran: _counterPelanggaran,
                    maxPelanggaran: _kMaxPelanggaran,
                    pinController: _pinController,
                    pinError: _pinError,
                    onPinChanged: () {
                      if (_pinError.isNotEmpty) {
                        setState(() => _pinError = '');
                      }
                    },
                    onVerifikasi: _verifikasiPin,
                  ),
                ),
              ),
          ],
        ),
      ),
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// _BlokirCard — kartu dialog blokir, dirender langsung di Stack (bukan dialog)
// ─────────────────────────────────────────────────────────────────────────────

class _BlokirCard extends StatelessWidget {
  final int counterPelanggaran;
  final int maxPelanggaran;
  final TextEditingController pinController;
  final String pinError;
  final VoidCallback onPinChanged;
  final VoidCallback onVerifikasi;

  const _BlokirCard({
    required this.counterPelanggaran,
    required this.maxPelanggaran,
    required this.pinController,
    required this.pinError,
    required this.onPinChanged,
    required this.onVerifikasi,
  });

  @override
  Widget build(BuildContext context) {
    return ConstrainedBox(
      constraints: const BoxConstraints(maxWidth: 400),
      child: Container(
        padding: const EdgeInsets.all(24),
        decoration: BoxDecoration(
          color: AppColors.surface,
          borderRadius: BorderRadius.circular(AppRadius.cardDark),
          border: Border.all(color: AppColors.primary.withOpacity(0.6), width: 1.5),
        ),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Icon(Icons.lock_rounded, color: AppColors.primary, size: 32),
            const SizedBox(height: 8),
            Text(
              'UJIAN DIBLOKIR',
              style: AppTypography.examTitle.copyWith(color: AppColors.primary),
            ),
            const SizedBox(height: 16),
            Text(
              'Pelanggaran ke-$counterPelanggaran dari $maxPelanggaran terdeteksi.\n'
                  'Hubungi pengawas dan masukkan PIN untuk melanjutkan ujian.',
              style: AppTypography.cardMeta.copyWith(
                color: AppColors.textSecondary,
                height: 1.5,
              ),
            ),
            const SizedBox(height: 20),
            TextField(
              controller: pinController,
              keyboardType: TextInputType.number,
              obscureText: true,
              maxLength: 6,
              autofocus: true,
              style: AppTypography.cardTitle.copyWith(
                color: AppColors.textPrimary,
                letterSpacing: 6,
              ),
              decoration: InputDecoration(
                hintText: '● ● ● ●',
                hintStyle:
                AppTypography.cardMeta.copyWith(color: AppColors.textSecondary),
                counterText: '',
                filled: true,
                fillColor: AppColors.background,
                border: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(8),
                  borderSide: const BorderSide(color: AppColors.inputBorder),
                ),
                focusedBorder: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(8),
                  borderSide: const BorderSide(color: AppColors.primary, width: 1.5),
                ),
                errorText: pinError.isEmpty ? null : pinError,
                errorStyle: AppTypography.cardMeta.copyWith(color: AppColors.primary),
              ),
              onChanged: (_) => onPinChanged(),
              onSubmitted: (_) => onVerifikasi(),
            ),
            const SizedBox(height: 16),
            SizedBox(
              width: double.infinity,
              child: ElevatedButton(
                style: ElevatedButton.styleFrom(
                  backgroundColor: AppColors.primary,
                  foregroundColor: AppColors.textPrimary,
                  padding: const EdgeInsets.symmetric(vertical: 14),
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(8),
                  ),
                ),
                onPressed: onVerifikasi,
                child: Text('BUKA KUNCI', style: AppTypography.buttonPrimary),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// _DiskualifikasiCard
// ─────────────────────────────────────────────────────────────────────────────

class _DiskualifikasiCard extends StatelessWidget {
  final int maxPelanggaran;

  const _DiskualifikasiCard({required this.maxPelanggaran});

  @override
  Widget build(BuildContext context) {
    return ConstrainedBox(
      constraints: const BoxConstraints(maxWidth: 400),
      child: Container(
        padding: const EdgeInsets.all(24),
        decoration: BoxDecoration(
          color: AppColors.surface,
          borderRadius: BorderRadius.circular(AppRadius.cardDark),
          border: Border.all(color: AppColors.primary, width: 2),
        ),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Icon(Icons.gpp_bad_rounded, color: AppColors.primary, size: 40),
            const SizedBox(height: 8),
            Text(
              'DISKUALIFIKASI',
              style: AppTypography.examTitle.copyWith(color: AppColors.primary),
            ),
            const SizedBox(height: 16),
            Text(
              'Anda telah melakukan $maxPelanggaran pelanggaran. '
                  'Jawaban ujian telah dikirimkan secara otomatis.\n\n'
                  'Hubungi pengawas untuk informasi lebih lanjut.',
              style: AppTypography.cardMeta.copyWith(
                color: AppColors.textSecondary,
                height: 1.6,
              ),
            ),
          ],
        ),
      ),
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// _ExamProgressBar — indikator soal terjawab
// ─────────────────────────────────────────────────────────────────────────────

class _ExamProgressBar extends StatelessWidget {
  final int answered;
  final int total;

  const _ExamProgressBar({required this.answered, required this.total});

  @override
  Widget build(BuildContext context) {
    final double ratio = total == 0 ? 0 : answered / total;
    return Container(
      color: AppColors.background,
      padding: const EdgeInsets.fromLTRB(16, 0, 16, 12),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text(
                'Terjawab',
                style: AppTypography.cardMeta.copyWith(
                  color: AppColors.textSecondary,
                  fontSize: 11,
                ),
              ),
              Text(
                '$answered / $total',
                style: AppTypography.cardMeta.copyWith(
                  color: AppColors.textPrimary,
                  fontSize: 11,
                  fontWeight: FontWeight.w700,
                ),
              ),
            ],
          ),
          const SizedBox(height: 6),
          ClipRRect(
            borderRadius: BorderRadius.circular(3),
            child: TweenAnimationBuilder<double>(
              // Animasi halus saat bar bertambah panjang.
              tween: Tween(begin: 0, end: ratio),
              duration: const Duration(milliseconds: 300),
              curve: Curves.easeOut,
              builder: (context, value, _) {
                return LinearProgressIndicator(
                  value: value,
                  minHeight: 4,
                  backgroundColor: Colors.white.withOpacity(0.08),
                  valueColor:
                  const AlwaysStoppedAnimation(AppColors.submitGreen),
                );
              },
            ),
          ),
        ],
      ),
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// _ExamHeader
// ─────────────────────────────────────────────────────────────────────────────

class _ExamHeader extends StatelessWidget {
  final String subjectName;
  final String teacherName;
  final int counterPelanggaran;
  final Duration remainingTime;

  const _ExamHeader({
    required this.subjectName,
    required this.teacherName,
    required this.counterPelanggaran,
    required this.remainingTime,
  });

  String get _timeLabel {
    final h = remainingTime.inHours;
    final m = remainingTime.inMinutes.remainder(60).toString().padLeft(2, '0');
    final s = remainingTime.inSeconds.remainder(60).toString().padLeft(2, '0');
    if (h > 0) {
      return '$h:$m:$s';
    }
    return '$m:$s';
  }

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.fromLTRB(16, 12, 16, 12),
      color: AppColors.surface,
      child: Row(
        children: [
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  subjectName.toUpperCase(),
                  style: AppTypography.examTitle,
                ),
                const SizedBox(height: 2),
                Text(teacherName, style: AppTypography.studentMeta),
              ],
            ),
          ),
          // Timer ujian — clean & profesional: ikon jam tipis + waktu
          // monospace, warna netral (abu-abu) agar tidak bersaing secara
          // visual dengan badge pelanggaran (merah) di sebelahnya.
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
            decoration: BoxDecoration(
              color: Colors.white.withOpacity(0.06),
              borderRadius: BorderRadius.circular(20),
              border: Border.all(color: Colors.white.withOpacity(0.12)),
            ),
            child: Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                Icon(
                  Icons.access_time_rounded,
                  size: 14,
                  color: Colors.white.withOpacity(0.65),
                ),
                const SizedBox(width: 6),
                Text(
                  _timeLabel,
                  style: AppTypography.cardMeta.copyWith(
                    color: Colors.white.withOpacity(0.85),
                    fontWeight: FontWeight.w600,
                  ),
                ),
              ],
            ),
          ),
          if (counterPelanggaran > 0) ...[
            const SizedBox(width: 8),
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
              decoration: BoxDecoration(
                color: AppColors.primary.withOpacity(0.15),
                borderRadius: BorderRadius.circular(20),
                border: Border.all(color: AppColors.primary, width: 1),
              ),
              child: Text(
                '⚠ ${counterPelanggaran}x',
                style: AppTypography.cardMeta.copyWith(
                  color: AppColors.primary,
                  fontWeight: FontWeight.w700,
                ),
              ),
            ),
          ],
        ],
      ),
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// _QuestionBox
// ─────────────────────────────────────────────────────────────────────────────

class _QuestionBox extends StatelessWidget {
  final Question question;
  final ValueChanged<int> onSelectOption;
  final bool isLocked;

  const _QuestionBox({
    super.key,
    required this.question,
    required this.onSelectOption,
    this.isLocked = false,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: BoxDecoration(
        color: AppColors.navBackground,
        borderRadius: BorderRadius.circular(AppRadius.cardDark),
      ),
      child: SingleChildScrollView(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              question.questionText,
              style: AppTypography.cardTitle.copyWith(color: AppColors.textDark),
            ),
            if (question.imagePath != null) ...[
              const SizedBox(height: 12),
              ClipRRect(
                borderRadius: BorderRadius.circular(8),
                child: question.imagePath!.startsWith('http')
                    ? Image.network(
                  question.imagePath!,
                  fit: BoxFit.contain,
                  loadingBuilder: (_, child, progress) => progress == null
                      ? child
                      : const SizedBox(
                    height: 140,
                    child: Center(
                      child: CircularProgressIndicator(
                          color: AppColors.primary),
                    ),
                  ),
                  errorBuilder: (_, __, ___) => const _ImageFallback(),
                )
                    : Image.asset(
                  question.imagePath!,
                  fit: BoxFit.contain,
                  errorBuilder: (_, __, ___) => const _ImageFallback(),
                ),
              ),
            ],
            const SizedBox(height: 20),
            ...List.generate(question.options.length, (i) {
              return Padding(
                padding: const EdgeInsets.only(bottom: 12),
                child: _OptionTile(
                  label: question.options[i],
                  isSelected: question.selectedOptionIndex == i,
                  // Debounce 300ms (PRD Addendum Bagian 44): saat isLocked
                  // true, onTap di-set null sehingga InkWell otomatis
                  // tampil non-interaktif (tidak ada ripple/efek tekan),
                  // memberi umpan balik visual yang jelas ke murid bahwa
                  // tap-nya sedang diproses, bukan diam-diam diabaikan.
                  onTap: isLocked ? null : () => onSelectOption(i),
                ),
              );
            }),
          ],
        ),
      ),
    );
  }
}

class _ImageFallback extends StatelessWidget {
  const _ImageFallback();

  @override
  Widget build(BuildContext context) {
    return Container(
      height: 140,
      color: const Color(0xFFDADADA),
      alignment: Alignment.center,
      child: Text('Gambar soal', style: AppTypography.cardMeta),
    );
  }
}

class _OptionTile extends StatelessWidget {
  final String label;
  final bool isSelected;
  final VoidCallback? onTap;

  const _OptionTile({
    required this.label,
    required this.isSelected,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    final bool isLocked = onTap == null;
    return AnimatedOpacity(
      opacity: isLocked ? 0.6 : 1.0,
      duration: const Duration(milliseconds: 150),
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(6),
        child: Container(
          width: double.infinity,
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
          decoration: BoxDecoration(
            color: isSelected
                ? AppColors.primary.withOpacity(0.12)
                : const Color(0xFFD9D9D9),
            borderRadius: BorderRadius.circular(6),
            border: isSelected
                ? Border.all(color: AppColors.primary, width: 1.5)
                : null,
          ),
          child: Text(
            label,
            style: AppTypography.cardMeta.copyWith(
              color: isSelected ? AppColors.primary : AppColors.textDark,
              fontWeight: isSelected ? FontWeight.w600 : FontWeight.w400,
            ),
          ),
        ),
      ),
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// _UsageAccessBanner — peringatan jika izin Usage Access belum aktif
// ─────────────────────────────────────────────────────────────────────────────

class _UsageAccessBanner extends StatelessWidget {
  final VoidCallback onAktifkan;

  const _UsageAccessBanner({required this.onAktifkan});

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      color: AppColors.warningBg,
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
      child: Row(
        children: [
          const Icon(Icons.warning_amber_rounded,
              color: AppColors.warningText, size: 18),
          const SizedBox(width: 8),
          Expanded(
            child: Text(
              'Izin Usage Access belum aktif. Deteksi floating app tidak optimal.',
              style: AppTypography.cardMeta.copyWith(
                color: AppColors.warningText,
                fontSize: 12,
              ),
            ),
          ),
          TextButton(
            onPressed: onAktifkan,
            style: TextButton.styleFrom(
              padding: const EdgeInsets.symmetric(horizontal: 8),
              minimumSize: Size.zero,
              tapTargetSize: MaterialTapTargetSize.shrinkWrap,
            ),
            child: Text(
              'AKTIFKAN',
              style: AppTypography.cardMeta.copyWith(
                color: AppColors.warningText,
                fontWeight: FontWeight.w700,
                fontSize: 12,
              ),
            ),
          ),
        ],
      ),
    );
  }
}