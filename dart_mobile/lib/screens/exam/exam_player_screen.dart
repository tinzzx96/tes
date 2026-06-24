import 'dart:async';
import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:freerasp/freerasp.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:http/http.dart' as http;
import 'package:shared_preferences/shared_preferences.dart';

import '../../core/config/api_config.dart';
import '../../core/models/question.dart';
import '../../core/theme/app_colors.dart';
import '../../core/theme/app_radius.dart';
import '../../core/theme/app_typography.dart';
import '../../core/utils/answer_repository.dart';
import '../../core/utils/dummy_data_repository.dart';
import '../../core/utils/exam_progress_store.dart';
import '../../core/utils/exam_session_tracker.dart';
import '../../core/utils/monitor_repository.dart';
import '../../core/utils/security_guard.dart';
import '../../core/utils/security_repository.dart';
import 'exam_action_bar.dart';
import 'question_navigator_grid.dart';

// ─── Konstanta ────────────────────────────────────────────────────────────────

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
  late final List<Question> _questions;
  int _currentIndex = 0;

  // ── Timer Submit ──────────────────────────────────────────────────────────
  Duration _submitCountdown = const Duration(seconds: 30);
  bool _submitUnlocked = false;
  Timer? _submitTimer;

  // ── Timer Ujian (header) ──────────────────────────────────────────────────
  Duration _examTimeRemaining = const Duration(minutes: 90);
  Timer? _examTimer;

  // ── Anti-Cheat Loop ───────────────────────────────────────────────────────
  Timer? _antiCheatTimer;

  // ── Focus Loss Stream ────────────────────────────────────────────────────
  StreamSubscription<bool>? _focusSubscription;

  // ── Status Keamanan ───────────────────────────────────────────────────────
  bool _isBlokir = false;
  int _counterPelanggaran = 0;
  bool _isDiskualifikasi = false;
  bool _usageAccessGranted = true;

  // ── Input PIN Dialog ──────────────────────────────────────────────────────
  final TextEditingController _pinController = TextEditingController();
  String _pinError = '';
  bool _isVerifyingPin = false;

  // ─────────────────────────────────────────────────────────────────────────
  // Lifecycle
  // ─────────────────────────────────────────────────────────────────────────

  @override
  void initState() {
    super.initState();
    ExamSessionTracker.isExamActive.value = true;
    _questions = DummyDataRepository.getExamQuestions(widget.examId);
    WidgetsBinding.instance.addObserver(this);
    _boot();
    // Mulai heartbeat ke server setiap 30 detik
    MonitorRepository.startHeartbeat();
  }

  @override
  void dispose() {
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
    // Hentikan heartbeat saat ujian selesai/screen ditutup
    MonitorRepository.stopHeartbeat();
    super.dispose();
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Boot sequence
  // ─────────────────────────────────────────────────────────────────────────

  bool _isPinningInProgress = false;
  static const Duration _kPinningTimeout = Duration(seconds: 30);
  Timer? _pinningTimeoutTimer;

  Future<void> _boot() async {
    await SecurityGuard.enableWakelock();
    await SecurityGuard.enterImmersiveMode();
    await SecurityGuard.lockUi();

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
      onError: (_) {},
    );

    final prefs = await SharedPreferences.getInstance();
    final cachedBlokir = prefs.getBool(_kKeyIsBlokir) ?? false;
    final cachedCounter = prefs.getInt(_kKeyCounter) ?? 0;

    if (!mounted) return;
    setState(() {
      _isBlokir = cachedBlokir;
      _counterPelanggaran = cachedCounter;
    });

    final usagePermission =
    await SecurityGuard.hasUsageStatsPermission().catchError((_) => false);
    if (!mounted) return;
    setState(() => _usageAccessGranted = usagePermission);

    if (_isBlokir) {
      WidgetsBinding.instance.addPostFrameCallback((_) => _tampilkanDialogBlokir());
    }

    _initFreeRasp();
    _startAntiCheatLoop();
    _startSubmitTimer();
    _startExamTimer();
  }

  Future<void> _startPinningProcess() async {
    if (!mounted) return;
    setState(() => _isPinningInProgress = true);

    await SecurityGuard.startLockTask();

    _pinningTimeoutTimer?.cancel();
    final stopwatch = Stopwatch()..start();
    _pinningTimeoutTimer =
        Timer.periodic(const Duration(milliseconds: 300), (timer) async {
          if (!mounted) {
            timer.cancel();
            return;
          }
          final pinned =
          await SecurityGuard.isScreenPinned().catchError((_) => false);
          if (pinned) {
            timer.cancel();
            setState(() => _isPinningInProgress = false);
            return;
          }
          if (stopwatch.elapsed >= _kPinningTimeout) {
            timer.cancel();
            stopwatch.stop();
            if (!mounted) return;
            setState(() => _isPinningInProgress = false);
          }
        });
  }

  // ─────────────────────────────────────────────────────────────────────────
  // freeRASP
  // ─────────────────────────────────────────────────────────────────────────

  void _initFreeRasp() {
    final config = TalsecConfig(
      androidConfig: AndroidConfig(
        packageName: 'com.example.apk_ujian',
        signingCertHashes: ['YOUR_SIGNING_CERT_SHA256_HASH_HERE'],
        supportedStores: ['com.android.vending'],
      ),
      watcherMail: 'security@heroexam.id',
      isProd: false,
    );

    final callback = ThreatCallback(
      onSimulator: () => _triggerBlokir(alasan: 'Emulator/VM terdeteksi'),
    );

    Talsec.instance.attachListener(callback);
    Talsec.instance.start(config).catchError((e) {
      debugPrint('[freeRASP] init error: $e');
    });
  }

  // ─────────────────────────────────────────────────────────────────────────
  // WidgetsBindingObserver
  // ─────────────────────────────────────────────────────────────────────────

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    super.didChangeAppLifecycleState(state);
    if (_isPinningInProgress) {
      debugPrint('[HERO EXAM] Lifecycle change diabaikan (proses pinning berlangsung)');
      return;
    }
    if (state == AppLifecycleState.inactive ||
        state == AppLifecycleState.paused) {
      _triggerBlokir(alasan: 'Aplikasi kehilangan fokus (floating app terdeteksi)');
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Anti-Cheat Loop
  // ─────────────────────────────────────────────────────────────────────────

  void _startAntiCheatLoop() {
    _antiCheatTimer = Timer.periodic(const Duration(seconds: 1), (_) async {
      if (!mounted) return;
      if (_isBlokir || _isDiskualifikasi) return;
      if (_isPinningInProgress) return;

      final bool pinned =
      await SecurityGuard.isScreenPinned().catchError((_) => false);
      if (!mounted) return;
      if (!pinned) {
        _triggerBlokir(alasan: 'Screen pinning dilepas oleh murid');
        return;
      }

      final bool focused =
      await SecurityGuard.hasWindowFocus().catchError((_) => true);
      if (!mounted) return;
      if (!focused) {
        _triggerBlokir(alasan: 'Floating app/overlay terdeteksi (window focus hilang)');
        return;
      }

      final bool otherAppActive =
      await SecurityGuard.isOtherAppForeground().catchError((_) => false);
      if (!mounted) return;
      if (otherAppActive) {
        _triggerBlokir(
            alasan: 'App/floating window lain terdeteksi aktif di atas layar ujian');
      }
    });
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Timer
  // ─────────────────────────────────────────────────────────────────────────

  void _startSubmitTimer() {
    _submitTimer?.cancel();
    _submitTimer = Timer.periodic(const Duration(seconds: 1), (_) {
      if (!mounted) return;
      if (_submitCountdown.inSeconds <= 1) {
        _submitTimer?.cancel();
        setState(() {
          _submitCountdown = Duration.zero;
          _submitUnlocked = true;
        });
        return;
      }
      setState(() => _submitCountdown -= const Duration(seconds: 1));
    });
  }

  void _startExamTimer() {
    _examTimer?.cancel();
    _examTimer = Timer.periodic(const Duration(seconds: 1), (_) {
      if (!mounted) return;
      if (_examTimeRemaining.inSeconds <= 1) {
        _examTimer?.cancel();
        setState(() => _examTimeRemaining = Duration.zero);
        // Auto-submit saat waktu habis
        _autoSubmitJawaban();
        return;
      }
      setState(() => _examTimeRemaining -= const Duration(seconds: 1));
    });
  }

  // ─────────────────────────────────────────────────────────────────────────
  // _triggerBlokir
  // ─────────────────────────────────────────────────────────────────────────

  Future<void> _triggerBlokir({String alasan = ''}) async {
    if (_isDiskualifikasi || !mounted) return;
    if (_isBlokir) return;

    debugPrint('[HERO EXAM] Pelanggaran: $alasan');

    final prefs = await SharedPreferences.getInstance();
    final newCounter = _counterPelanggaran + 1;
    await prefs.setInt(_kKeyCounter, newCounter);

    // Ambil examAttemptId dari secure storage
    const storage = FlutterSecureStorage();
    final attemptIdStr = await storage.read(key: 'exam_attempt_id');
    final attemptId = int.tryParse(attemptIdStr ?? '');

    if (newCounter >= _kMaxPelanggaran) {
      setState(() {
        _counterPelanggaran = newCounter;
        _isDiskualifikasi = true;
      });
      await prefs.remove(_kKeyIsBlokir);
      _antiCheatTimer?.cancel();

      // Lapor ke server — akan auto-submit dari backend
      if (attemptId != null) {
        await SecurityRepository.reportViolation(
          examAttemptId: attemptId,
          reasonCode: 'screen_pin_released',
          violationNumber: newCounter,
        );
      }

      await _autoSubmitJawaban();
    } else {
      await prefs.setBool(_kKeyIsBlokir, true);
      await prefs.setInt(_kKeyCounter, newCounter);

      setState(() {
        _isBlokir = true;
        _counterPelanggaran = newCounter;
      });

      // Lapor ke server — PIN dikirim ke pengawas via WebSocket otomatis
      if (attemptId != null) {
        SecurityRepository.reportViolation(
          examAttemptId: attemptId,
          reasonCode: 'screen_pin_released',
          violationNumber: newCounter,
        );
      }

      if (mounted) _tampilkanDialogBlokir();
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Auto-Submit
  // ─────────────────────────────────────────────────────────────────────────

  Future<void> _autoSubmitJawaban() async {
    try {
      await AnswerRepository.submitExam(int.parse(widget.examId));
    } catch (_) {
      // Fallback lokal jika server tidak bisa dicapai
      await ExamProgressStore.markCompleted(widget.examId);
    }
    debugPrint('[HERO EXAM] Auto-submit dieksekusi.');

    if (mounted) {
      _tampilkanLayarDiskualifikasi();
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Dialog Blokir
  // ─────────────────────────────────────────────────────────────────────────

  void _tampilkanDialogBlokir() {
    _pinController.clear();
    if (!mounted) return;
    setState(() => _pinError = '');
  }

  Future<void> _verifikasiPin() async {
    if (_isVerifyingPin) return;
    setState(() {
      _isVerifyingPin = true;
      _pinError = '';
    });

    try {
      const storage = FlutterSecureStorage();
      final attemptIdStr = await storage.read(key: 'exam_attempt_id');
      final attemptId = int.tryParse(attemptIdStr ?? '');

      if (attemptId == null) {
        setState(() => _pinError = 'Sesi tidak ditemukan. Hubungi pengawas.');
        return;
      }

      // Verifikasi PIN ke server — spesifik per examAttemptId (anti-tertukar)
      final unlocked = await SecurityRepository.verifyUnlockPin(
        examAttemptId: attemptId,
        pin: _pinController.text.trim(),
      );

      if (!mounted) return;

      if (unlocked) {
        final prefs = await SharedPreferences.getInstance();
        await prefs.setBool(_kKeyIsBlokir, false);

        setState(() {
          _isBlokir = false;
          _pinError = '';
        });

        await _startPinningProcess();
      } else {
        setState(() => _pinError = 'PIN salah. Coba lagi.');
      }
    } catch (_) {
      if (!mounted) return;
      setState(() => _pinError = 'Gagal verifikasi. Periksa koneksi.');
    } finally {
      if (mounted) setState(() => _isVerifyingPin = false);
    }
  }

  void _tampilkanLayarDiskualifikasi() {
    // _isDiskualifikasi sudah di-set true — build() otomatis render layar ini.
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Navigasi & Jawaban
  // ─────────────────────────────────────────────────────────────────────────

  Question get _currentQuestion => _questions[_currentIndex];

  int get _answeredCount =>
      _questions.where((q) => q.selectedOptionIndex != null).length;

  ExamPagePosition get _position {
    if (_currentIndex == 0) return ExamPagePosition.first;
    if (_currentIndex == _questions.length - 1) return ExamPagePosition.last;
    return ExamPagePosition.middle;
  }

  void _goTo(int index) => setState(() => _currentIndex = index);

  // ── Debounce anti-spam klik (PRD Addendum Bagian 44) ─────────────────────
  static const Duration _kOptionDebounce = Duration(milliseconds: 300);
  bool _isOptionLocked = false;
  Timer? _optionDebounceTimer;

  void _selectOption(int optionIndex) {
    if (_isOptionLocked) return;
    setState(() {
      _currentQuestion.selectedOptionIndex = optionIndex;
      _isOptionLocked = true;
    });
    // Auto-save ke server (URL + body BARU sesuai API_DOCS)
    _autoSaveToServer(optionIndex);
    _optionDebounceTimer?.cancel();
    _optionDebounceTimer = Timer(_kOptionDebounce, () {
      if (mounted) setState(() => _isOptionLocked = false);
    });
  }

  Future<void> _autoSaveToServer(int optionIndex) async {
    // Pakai AnswerRepository — endpoint BARU: POST /exam-attempts/:attemptId/answers
    // Body BARU: { questionId (int), selectedOptionIndex (int), clientTimestamp }
    AnswerRepository.autoSave(
      questionId: _currentQuestion.id,
      selectedOptionIndex: optionIndex,
    );
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
          style:
          AppTypography.cardMeta.copyWith(color: AppColors.textSecondary),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(ctx).pop(),
            child: Text(
              'Batal',
              style: AppTypography.cardMeta
                  .copyWith(color: AppColors.textSecondary),
            ),
          ),
          TextButton(
            onPressed: () async {
              Navigator.of(ctx).pop();
              _antiCheatTimer?.cancel();
              _focusSubscription?.cancel();
              _pinningTimeoutTimer?.cancel();

              // Submit ke server via AnswerRepository
              try {
                await AnswerRepository.submitExam(int.parse(widget.examId));
              } catch (_) {
                // Fallback lokal
                await ExamProgressStore.markCompleted(widget.examId);
              }

              await SecurityGuard.stopLockTask();
              if (!context.mounted) return;
              Navigator.of(context).pop(true);
            },
            child: Text(
              'Submit',
              style: AppTypography.cardMeta
                  .copyWith(color: AppColors.submitGreen),
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
      canPop: false,
      child: Scaffold(
        backgroundColor: AppColors.background,
        body: Stack(
          children: [
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
                              padding:
                              const EdgeInsets.fromLTRB(16, 16, 16, 8),
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
                              margin:
                              const EdgeInsets.fromLTRB(16, 8, 16, 8),
                              decoration: BoxDecoration(
                                color: AppColors.background,
                                borderRadius: BorderRadius.circular(
                                    AppRadius.cardDark),
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
                    onPrevious: _currentIndex > 0
                        ? () => _goTo(_currentIndex - 1)
                        : null,
                    onNext: _currentIndex < _questions.length - 1
                        ? () => _goTo(_currentIndex + 1)
                        : null,
                    onSubmit: _handleSubmit,
                  ),
                ],
              ),
            ),

            // ── Solid Cover blokir / diskualifikasi ──────────────────────
            if (_isBlokir || _isDiskualifikasi)
              Positioned.fill(
                child: Container(
                  color: Colors.black,
                  alignment: Alignment.center,
                  padding: const EdgeInsets.symmetric(horizontal: 24),
                  child: _isDiskualifikasi
                      ? _DiskualifikasiCard(
                      maxPelanggaran: _kMaxPelanggaran)
                      : _BlokirCard(
                    counterPelanggaran: _counterPelanggaran,
                    maxPelanggaran: _kMaxPelanggaran,
                    pinController: _pinController,
                    pinError: _pinError,
                    isLoading: _isVerifyingPin,
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
// _BlokirCard
// ─────────────────────────────────────────────────────────────────────────────

class _BlokirCard extends StatelessWidget {
  final int counterPelanggaran;
  final int maxPelanggaran;
  final TextEditingController pinController;
  final String pinError;
  final bool isLoading;
  final VoidCallback onPinChanged;
  final VoidCallback onVerifikasi;

  const _BlokirCard({
    required this.counterPelanggaran,
    required this.maxPelanggaran,
    required this.pinController,
    required this.pinError,
    required this.isLoading,
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
          border:
          Border.all(color: AppColors.primary.withOpacity(0.6), width: 1.5),
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
                hintText: '\u25cf \u25cf \u25cf \u25cf',
                hintStyle: AppTypography.cardMeta
                    .copyWith(color: AppColors.textSecondary),
                counterText: '',
                filled: true,
                fillColor: AppColors.background,
                border: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(8),
                  borderSide:
                  const BorderSide(color: AppColors.inputBorder),
                ),
                focusedBorder: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(8),
                  borderSide:
                  const BorderSide(color: AppColors.primary, width: 1.5),
                ),
                errorText: pinError.isEmpty ? null : pinError,
                errorStyle: AppTypography.cardMeta
                    .copyWith(color: AppColors.primary),
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
                onPressed: isLoading ? null : onVerifikasi,
                child: isLoading
                    ? const SizedBox(
                  height: 18,
                  width: 18,
                  child: CircularProgressIndicator(
                    strokeWidth: 2,
                    color: Colors.white,
                  ),
                )
                    : Text('BUKA KUNCI', style: AppTypography.buttonPrimary),
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
            const Icon(Icons.gpp_bad_rounded,
                color: AppColors.primary, size: 40),
            const SizedBox(height: 8),
            Text(
              'DISKUALIFIKASI',
              style:
              AppTypography.examTitle.copyWith(color: AppColors.primary),
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
// _ExamProgressBar
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
    final m =
    remainingTime.inMinutes.remainder(60).toString().padLeft(2, '0');
    final s =
    remainingTime.inSeconds.remainder(60).toString().padLeft(2, '0');
    if (h > 0) return '$h:$m:$s';
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
          Container(
            padding:
            const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
            decoration: BoxDecoration(
              color: Colors.white.withOpacity(0.06),
              borderRadius: BorderRadius.circular(20),
              border:
              Border.all(color: Colors.white.withOpacity(0.12)),
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
              padding:
              const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
              decoration: BoxDecoration(
                color: AppColors.primary.withOpacity(0.15),
                borderRadius: BorderRadius.circular(20),
                border: Border.all(color: AppColors.primary, width: 1),
              ),
              child: Text(
                '\u26a0 ${counterPelanggaran}x',
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
              style:
              AppTypography.cardTitle.copyWith(color: AppColors.textDark),
            ),
            if (question.imagePath != null) ...[
              const SizedBox(height: 12),
              ClipRRect(
                borderRadius: BorderRadius.circular(8),
                child: question.imagePath!.startsWith('http')
                    ? Image.network(
                  question.imagePath!,
                  fit: BoxFit.contain,
                  loadingBuilder: (_, child, progress) =>
                  progress == null
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
          padding:
          const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
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
              fontWeight:
              isSelected ? FontWeight.w600 : FontWeight.w400,
            ),
          ),
        ),
      ),
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// _UsageAccessBanner
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
