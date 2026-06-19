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
import '../../core/utils/security_guard.dart';
import 'exam_action_bar.dart';
import 'question_navigator_grid.dart';

// ─── Konstanta ────────────────────────────────────────────────────────────────

/// PIN supervisor bawaan. Ganti nilai ini (atau ambil dari API) sebelum rilis.
const String _kSupervisorPin = '1234';

/// Batas maksimal pelanggaran sebelum auto-submit paksa.
const int _kMaxPelanggaran = 5;

/// Kunci shared_preferences untuk status blokir & counter pelanggaran.
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
  late final List<Question> _questions = DummyDataRepository.getExamQuestions();
  int _currentIndex = 0;

  // ── Timer Submit (server-side di produksi, lokal di dev) ──────────────────
  Duration _submitCountdown = const Duration(minutes: 90);
  bool _submitUnlocked = false;
  Timer? _submitTimer;

  // ── Anti-Cheat Loop ───────────────────────────────────────────────────────
  Timer? _antiCheatTimer;

  // ── Focus Loss Stream (EventChannel — instan, tanpa polling delay) ──────
  StreamSubscription<bool>? _focusSubscription;

  // ── Status Keamanan ───────────────────────────────────────────────────────
  bool _isBlokir = false;
  int _counterPelanggaran = 0;
  bool _isDiskualifikasi = false;

  // ── Input PIN Dialog ──────────────────────────────────────────────────────
  final TextEditingController _pinController = TextEditingController();
  String _pinError = '';

  // ─────────────────────────────────────────────────────────────────────────
  // Lifecycle
  // ─────────────────────────────────────────────────────────────────────────

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    _boot();
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    _submitTimer?.cancel();
    _antiCheatTimer?.cancel();
    _focusSubscription?.cancel();
    _pinController.dispose();
    SecurityGuard.disableWakelock();
    SecurityGuard.exitImmersiveMode();
    SecurityGuard.unlockUi();
    super.dispose();
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Boot sequence
  // ─────────────────────────────────────────────────────────────────────────

  Future<void> _boot() async {
    // Aktifkan proteksi layar & immersive sejak frame pertama.
    await SecurityGuard.enableWakelock();
    await SecurityGuard.enterImmersiveMode();
    await SecurityGuard.lockUi();

    // Langganan EventChannel: deteksi focus loss secara INSTAN.
    // Floating app yang mengambil fokus akan langsung memicu blokir
    // tanpa menunggu polling 1 detik dari _antiCheatTimer.
    _focusSubscription = SecurityGuard.windowFocusStream.listen(
      (hasFocus) {
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

    // Jika sebelumnya sudah di-blokir (app dibunuh/restart), langsung
    // tampilkan overlay blokir sebelum murid bisa berinteraksi.
    if (_isBlokir) {
      WidgetsBinding.instance.addPostFrameCallback((_) => _tampilkanDialogBlokir());
    }

    // Aktifkan screen pinning sejak awal ujian (bukan hanya setelah
    // PIN pertama). Tanpa Device Owner → Android tampilkan dialog
    // konfirmasi; jika ditolak murid → isScreenPinned() = false →
    // anti-cheat loop memicu blokir pada detik pertama.
    WidgetsBinding.instance.addPostFrameCallback((_) async {
      await SecurityGuard.startLockTask();
    });

    // Inisialisasi freeRASP (deteksi emulator / virtual environment).
    _initFreeRasp();

    // Mulai loop anti-cheat & timer submit.
    _startAntiCheatLoop();
    _startSubmitTimer();
  }

  // ─────────────────────────────────────────────────────────────────────────
  // freeRASP — Emulator Detection
  // ─────────────────────────────────────────────────────────────────────────

  void _initFreeRasp() {
    // Konfigurasi minimal: hanya aktifkan deteksi emulator/VM.
    // Ganti expectedHash dengan SHA-256 fingerprint APK signing certificate
    // yang sesungguhnya sebelum rilis ke production.
    const config = TalsecConfig(
      androidConfig: AndroidConfig(
        packageName: 'com.example.apk_ujian',
        signingCertHashes: ['YOUR_SIGNING_CERT_SHA256_HASH_HERE'],
        supportedStores: ['com.android.vending'],
      ),
      watcherMail: 'security@heroexam.id',
      isProd: false, // set true saat production
    );

    final callback = ThreatCallback(
      onEmulator: () => _triggerBlokir(alasan: 'Emulator/VM terdeteksi'),
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

      final bool pinned =
      await SecurityGuard.isScreenPinned().catchError((_) => false);
      if (!mounted) return;
      if (!pinned) {
        _triggerBlokir(alasan: 'Screen pinning dilepas oleh murid');
        return;
      }

      // Deteksi floating app / overlay (Smart Sidebar, Floating Window
      // Oppo/Vivo/Realme, dsb) yang TIDAK memicu AppLifecycleState berubah
      // karena bukan Activity baru — hanya window terpisah di atas kita.
      final bool focused =
      await SecurityGuard.hasWindowFocus().catchError((_) => true);
      if (!mounted) return;
      if (!focused) {
        _triggerBlokir(alasan: 'Floating app/overlay terdeteksi di atas layar ujian');
      }
    });
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Submit Timer
  // ─────────────────────────────────────────────────────────────────────────

  void _startSubmitTimer() {
    _submitTimer = Timer.periodic(const Duration(seconds: 1), (_) {
      if (!mounted) return;
      if (_submitCountdown.inSeconds <= 0) {
        _submitTimer?.cancel();
        setState(() => _submitUnlocked = true);
        return;
      }
      setState(() => _submitCountdown -= const Duration(seconds: 1));
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

    await SecurityGuard.startLockTask();
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

  ExamPagePosition get _position {
    if (_currentIndex == 0) return ExamPagePosition.first;
    if (_currentIndex == _questions.length - 1) return ExamPagePosition.last;
    return ExamPagePosition.middle;
  }

  void _goTo(int index) => setState(() => _currentIndex = index);

  void _selectOption(int optionIndex) {
    setState(() => _currentQuestion.selectedOptionIndex = optionIndex);
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
              await ExamProgressStore.markCompleted(widget.examId);
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
      // Saat blokir/diskualifikasi aktif, blokir tombol back fisik
      // sepenuhnya — murid tidak bisa keluar dari layar blokir dengan cara
      // apapun selain PIN yang benar.
      canPop: !_isBlokir && !_isDiskualifikasi,
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
                              child: _QuestionBox(
                                question: _currentQuestion,
                                onSelectOption: _selectOption,
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

            // ── Blur + Dialog Blokir/Diskualifikasi — SATU layer Stack ──────
            // Penting: BackdropFilter & konten dialog ada di dalam Stack yang
            // SAMA dengan konten ujian di atas, bukan lewat showDialog()
            // terpisah. Ini wajib agar blur benar-benar tertangkap di semua
            // device, termasuk ColorOS/FuntouchOS (Oppo/Vivo/Realme) yang
            // kerap gagal me-render BackdropFilter lintas-Overlay-layer.
            // ── Solid Cover — soal PASTI tidak terbaca saat blokir aktif ──
            // Menggunakan Container hitam solid (bukan BackdropFilter) agar
            // render dijamin di semua device & tidak terpengaruh FLAG_SECURE
            // yang pada Android 12+ dapat menggagalkan GPU compositing layer
            // yang dibutuhkan BackdropFilter.
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
// _ExamHeader
// ─────────────────────────────────────────────────────────────────────────────

class _ExamHeader extends StatelessWidget {
  final String subjectName;
  final String teacherName;
  final int counterPelanggaran;

  const _ExamHeader({
    required this.subjectName,
    required this.teacherName,
    required this.counterPelanggaran,
  });

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
          if (counterPelanggaran > 0)
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

  const _QuestionBox({required this.question, required this.onSelectOption});

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
                  onTap: () => onSelectOption(i),
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
  final VoidCallback onTap;

  const _OptionTile({
    required this.label,
    required this.isSelected,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    return InkWell(
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
    );
  }
}