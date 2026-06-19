import 'dart:async';

import 'package:flutter/material.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:wakelock_plus/wakelock_plus.dart';

import '../../core/models/question.dart';
import '../../core/theme/app_colors.dart';
import '../../core/theme/app_radius.dart';
import '../../core/theme/app_typography.dart';
import '../../core/utils/dummy_data_repository.dart';
import '../../core/utils/exam_progress_store.dart';
import '../../core/utils/security_guard.dart';
import 'exam_action_bar.dart';
import 'question_navigator_grid.dart';

// TODO(backend): ambil PIN pengawas dari server saat sesi ujian dibuat.
const _kSupervisorPin = '1234';
const _kPrefBlokir = 'isBlokir';
const _kPrefBlokirExamId = 'blokirExamId';

class ExamPlayerPage extends StatefulWidget {
  final String examId;
  final String subjectName;
  final String teacherName;

  const ExamPlayerPage({
    super.key,
    required this.examId,
    required this.subjectName,
    required this.teacherName,
  });

  @override
  State<ExamPlayerPage> createState() => _ExamPlayerPageState();
}

class _ExamPlayerPageState extends State<ExamPlayerPage> {
  late final List<Question> _questions;
  int _currentIndex = 0;
  Duration _submitCountdown = const Duration(seconds: 30);
  bool _submitUnlocked = false;
  bool _isBlokir = false;
  bool _blockDialogActive = false;

  Timer? _countdownTimer;
  Timer? _antiCheatTimer;

  // ── Lifecycle ──────────────────────────────────────────────────────────────

  @override
  void initState() {
    super.initState();
    _questions = DummyDataRepository.getExamQuestions();
    _bootstrap();
  }

  Future<void> _bootstrap() async {
    await WakelockPlus.enable();
    await SecurityGuard.enterImmersiveMode();
    await SecurityGuard.enableScreenProtection();

    final prefs = await SharedPreferences.getInstance();
    final wasBlokir = prefs.getBool(_kPrefBlokir) ?? false;
    final blokirId = prefs.getString(_kPrefBlokirExamId);

    if (wasBlokir && blokirId == widget.examId) {
      // Siswa sudah terdeteksi curang sebelumnya — langsung blokir.
      if (!mounted) return;
      setState(() => _isBlokir = true);
      WidgetsBinding.instance.addPostFrameCallback((_) => _showBlockDialog());
      return;
    }

    await SecurityGuard.startLockTask();
    _startCountdown();
    _startAntiCheatLoop();
  }

  @override
  void dispose() {
    _countdownTimer?.cancel();
    _antiCheatTimer?.cancel();
    WakelockPlus.disable();
    SecurityGuard.exitImmersiveMode();
    SecurityGuard.disableScreenProtection();
    SecurityGuard.stopLockTask();
    super.dispose();
  }

  // ── Timer: Countdown Submit ────────────────────────────────────────────────

  void _startCountdown() {
    _countdownTimer = Timer.periodic(const Duration(seconds: 1), (_) {
      if (!mounted) return;
      if (_submitCountdown.inSeconds <= 0) {
        setState(() => _submitUnlocked = true);
        _countdownTimer?.cancel();
        return;
      }
      setState(() => _submitCountdown -= const Duration(seconds: 1));
    });
  }

  // ── Timer: Anti-Cheat Loop (deteksi lepas semat) ───────────────────────────

  void _startAntiCheatLoop() {
    _antiCheatTimer = Timer.periodic(const Duration(seconds: 1), (_) async {
      if (!mounted || _isBlokir) return;
      final pinned = await SecurityGuard.isScreenPinned();
      if (!pinned) await _triggerBlokir();
    });
  }

  Future<void> _triggerBlokir() async {
    if (_isBlokir) return;
    _antiCheatTimer?.cancel();
    _countdownTimer?.cancel();

    final prefs = await SharedPreferences.getInstance();
    await prefs.setBool(_kPrefBlokir, true);
    await prefs.setString(_kPrefBlokirExamId, widget.examId);

    if (!mounted) return;
    setState(() => _isBlokir = true);
    _showBlockDialog();
  }

  // ── Dialogs ────────────────────────────────────────────────────────────────

  void _showBlockDialog() {
    if (_blockDialogActive) return;
    _blockDialogActive = true;
    SecurityGuard.enterImmersiveMode();

    showDialog<bool>(
      context: context,
      barrierDismissible: false,
      builder: (_) => _BlockDialog(onPinVerified: (pin) => pin == _kSupervisorPin),
    ).then((unlocked) async {
      _blockDialogActive = false;
      if (unlocked == true) await _handleUnblockSuccess();
    });
  }

  Future<void> _handleUnblockSuccess() async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setBool(_kPrefBlokir, false);
    await prefs.remove(_kPrefBlokirExamId);

    if (!mounted) return;
    setState(() => _isBlokir = false);

    // Re-aktifkan Screen Pinning — siswa tinggal tekan "Mengerti" di dialog sistem.
    await SecurityGuard.startLockTask();
    _startCountdown();
    _startAntiCheatLoop();
  }

  // ── Exam Logic ─────────────────────────────────────────────────────────────

  Question get _currentQuestion => _questions[_currentIndex];

  ExamPagePosition get _position {
    if (_currentIndex == 0) return ExamPagePosition.first;
    if (_currentIndex == _questions.length - 1) return ExamPagePosition.last;
    return ExamPagePosition.middle;
  }

  void _goTo(int index) => setState(() => _currentIndex = index);

  void _selectOption(int i) =>
      setState(() => _currentQuestion.selectedOptionIndex = i);

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
              await SecurityGuard.stopLockTask();
              if (!ctx.mounted) return;
              Navigator.of(ctx).pop();
              Navigator.of(ctx).pop(true);
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

  // ── Build ──────────────────────────────────────────────────────────────────

  @override
  Widget build(BuildContext context) {
    return PopScope(
      canPop: false,
      child: Scaffold(
        backgroundColor: AppColors.background,
        body: SafeArea(
          child: Column(
            children: [
              _ExamHeader(
                subjectName: widget.subjectName,
                teacherName: widget.teacherName,
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
      ),
    );
  }
}

// ── Block Dialog (Hardened) ────────────────────────────────────────────────────

class _BlockDialog extends StatefulWidget {
  final bool Function(String pin) onPinVerified;

  const _BlockDialog({required this.onPinVerified});

  @override
  State<_BlockDialog> createState() => _BlockDialogState();
}

class _BlockDialogState extends State<_BlockDialog> {
  bool _showPinField = false;
  final _pinController = TextEditingController();
  String? _pinError;

  @override
  void dispose() {
    _pinController.dispose();
    super.dispose();
  }

  void _submit() {
    final correct = widget.onPinVerified(_pinController.text.trim());
    if (correct) {
      Navigator.of(context).pop(true);
    } else {
      setState(() {
        _pinError = 'PIN salah. Hubungi pengawas.';
        _pinController.clear();
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    return PopScope(
      canPop: false,
      child: Dialog(
        backgroundColor: const Color(0xFF1A1A2E),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
        child: Padding(
          padding: const EdgeInsets.all(28),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              const Icon(Icons.lock_outline, color: Color(0xFFE63946), size: 56),
              const SizedBox(height: 16),
              Text(
                'AKSES DIBLOKIR',
                style: AppTypography.cardTitle.copyWith(
                  color: Colors.white,
                  fontSize: 20,
                  letterSpacing: 2,
                ),
              ),
              const SizedBox(height: 12),
              Text(
                'Layar semat terdeteksi dilepas.\nUjian Anda telah dihentikan dan dilaporkan ke pengawas.',
                textAlign: TextAlign.center,
                style: AppTypography.cardMeta.copyWith(
                  color: Colors.white70,
                  height: 1.5,
                ),
              ),
              const SizedBox(height: 24),
              if (!_showPinField) ...[
                SizedBox(
                  width: double.infinity,
                  child: ElevatedButton(
                    style: ElevatedButton.styleFrom(
                      backgroundColor: const Color(0xFFE63946),
                      foregroundColor: Colors.white,
                      padding: const EdgeInsets.symmetric(vertical: 14),
                      shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(8)),
                    ),
                    onPressed: () => setState(() => _showPinField = true),
                    child: const Text('Masukkan PIN Pengawas'),
                  ),
                ),
              ] else ...[
                TextField(
                  controller: _pinController,
                  keyboardType: TextInputType.number,
                  obscureText: true,
                  maxLength: 8,
                  style: const TextStyle(color: Colors.white),
                  decoration: InputDecoration(
                    labelText: 'PIN Pengawas',
                    labelStyle: const TextStyle(color: Colors.white54),
                    counterStyle: const TextStyle(color: Colors.white38),
                    errorText: _pinError,
                    enabledBorder: const OutlineInputBorder(
                      borderSide: BorderSide(color: Colors.white30),
                    ),
                    focusedBorder: const OutlineInputBorder(
                      borderSide: BorderSide(color: Color(0xFFE9C46A)),
                    ),
                    errorBorder: const OutlineInputBorder(
                      borderSide: BorderSide(color: Color(0xFFE63946)),
                    ),
                    focusedErrorBorder: const OutlineInputBorder(
                      borderSide: BorderSide(color: Color(0xFFE63946)),
                    ),
                  ),
                ),
                const SizedBox(height: 12),
                SizedBox(
                  width: double.infinity,
                  child: ElevatedButton(
                    style: ElevatedButton.styleFrom(
                      backgroundColor: const Color(0xFFE9C46A),
                      foregroundColor: const Color(0xFF1A1A2E),
                      padding: const EdgeInsets.symmetric(vertical: 14),
                      shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(8)),
                    ),
                    onPressed: _submit,
                    child: const Text(
                      'Verifikasi & Lanjutkan',
                      style: TextStyle(fontWeight: FontWeight.bold),
                    ),
                  ),
                ),
              ],
            ],
          ),
        ),
      ),
    );
  }
}

// ── Supporting Widgets (shared dengan exam_player_screen.dart) ─────────────────

class _ExamHeader extends StatelessWidget {
  final String subjectName;
  final String teacherName;

  const _ExamHeader({required this.subjectName, required this.teacherName});

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      color: AppColors.background,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(24, 16, 24, 0),
            child: Row(
              children: [
                _MiniLogo(),
                const SizedBox(width: 12),
                Text('EXAM-PONCOL', style: AppTypography.appTitle),
              ],
            ),
          ),
          const SizedBox(height: 14),
          Container(height: 1, color: AppColors.accentGold),
          Padding(
            padding: const EdgeInsets.fromLTRB(24, 12, 24, 14),
            child: Text(
              '${subjectName.toUpperCase()} - ${teacherName.toUpperCase()}',
              style: AppTypography.labelCaps.copyWith(fontSize: 13),
            ),
          ),
        ],
      ),
    );
  }
}

class _MiniLogo extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    return SizedBox(
      width: 36,
      height: 36,
      child: Image.asset(
        'assets/images/logo_poncol.png',
        fit: BoxFit.contain,
        errorBuilder: (_, __, ___) => Container(
          decoration: BoxDecoration(
            color: AppColors.primary,
            borderRadius: BorderRadius.circular(6),
            border: Border.all(color: AppColors.accentGold, width: 1.5),
          ),
          alignment: Alignment.center,
          child: Text('SMK',
              style: AppTypography.badgeToday.copyWith(fontSize: 10)),
        ),
      ),
    );
  }
}

class _QuestionBox extends StatelessWidget {
  final Question question;
  final ValueChanged<int> onSelectOption;

  const _QuestionBox({required this.question, required this.onSelectOption});

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      decoration: BoxDecoration(
        color: AppColors.surfaceLight,
        borderRadius: BorderRadius.circular(AppRadius.card),
      ),
      child: ClipRRect(
        borderRadius: BorderRadius.circular(AppRadius.card),
        child: SingleChildScrollView(
          padding: const EdgeInsets.all(20),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                'KERJAKAN SOAL DENGAN TENANG DAN BACA SEKSAMA, '
                'SETIAP TINDAKAN DILIHAT PENGAWAS!',
                style: AppTypography.labelCaps
                    .copyWith(color: AppColors.textMuted),
              ),
              const SizedBox(height: 12),
              Container(height: 1, color: AppColors.primary.withOpacity(0.4)),
              const SizedBox(height: 16),
              Text(question.questionText,
                  style: AppTypography.cardTitle
                      .copyWith(fontSize: 19, height: 1.3)),
              if (question.imagePath != null) ...[
                const SizedBox(height: 16),
                ClipRRect(
                  borderRadius: BorderRadius.circular(4),
                  child: question.isNetworkImage
                      ? Image.network(
                          question.imagePath!,
                          fit: BoxFit.contain,
                          loadingBuilder: (_, child, progress) {
                            if (progress == null) return child;
                            return const SizedBox(
                              height: 140,
                              child: Center(
                                child: CircularProgressIndicator(
                                    color: AppColors.primary),
                              ),
                            );
                          },
                          errorBuilder: (_, __, ___) =>
                              const _ImageFallback(),
                        )
                      : Image.asset(
                          question.imagePath!,
                          fit: BoxFit.contain,
                          errorBuilder: (_, __, ___) =>
                              const _ImageFallback(),
                        ),
                ),
              ],
              const SizedBox(height: 20),
              ...List.generate(
                question.options.length,
                (i) => Padding(
                  padding: const EdgeInsets.only(bottom: 12),
                  child: _OptionTile(
                    label: question.options[i],
                    isSelected: question.selectedOptionIndex == i,
                    onTap: () => onSelectOption(i),
                  ),
                ),
              ),
            ],
          ),
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
            fontWeight:
                isSelected ? FontWeight.w600 : FontWeight.w400,
          ),
        ),
      ),
    );
  }
}
