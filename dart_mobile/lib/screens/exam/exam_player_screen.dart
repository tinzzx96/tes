import 'package:flutter/material.dart';
import '../../core/models/question.dart';
import '../../core/theme/app_colors.dart';
import '../../core/theme/app_radius.dart';
import '../../core/theme/app_typography.dart';
import '../../core/utils/dummy_data_repository.dart';
import '../../core/utils/exam_progress_store.dart';
import '../../core/utils/security_guard.dart';
import 'exam_action_bar.dart';
import 'question_navigator_grid.dart';

/// Exam Player Screen — satu soal per layar, sesuai DESIGN_SYSTEM.md §8
/// dan mockup Frame 5/6/7.
///
/// Layout: header (mapel+guru) fixed, lalu kotak soal yang BISA scroll
/// internal sendiri (jika soal panjang/ada gambar/opsi banyak), lalu grid
/// navigator nomor soal, lalu action bar Sebelumnya/Submit/Selanjutnya.
/// Scroll soal tidak memengaruhi area luar kotak (header/navigator/action
/// bar tetap diam).
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

class _ExamPlayerScreenState extends State<ExamPlayerScreen> {
  late final List<Question> _questions = DummyDataRepository.getExamQuestions();
  int _currentIndex = 0;

  // TODO(integrasi-backend): timer submit harus berjalan di server (Hero
  // Exam PRD §14), bukan dihitung lokal seperti dummy ini.
  Duration _submitCountdown = const Duration(seconds: 30);
  bool _submitUnlocked = false;

  @override
  void initState() {
    super.initState();
    _tickCountdown();
    // Hero Exam PRD §18: layar selalu menyala + fullscreen immersive
    // selama siswa mengerjakan ujian.
    SecurityGuard.enableWakelock();
    SecurityGuard.enterImmersiveMode();
    SecurityGuard.lockUi(); // LOCK TOTAL: blok back, gesture, quick setting
  }

  @override
  void dispose() {
    SecurityGuard.disableWakelock();
    SecurityGuard.exitImmersiveMode();
    SecurityGuard.unlockUi(); // UNLOCK saat keluar exam
    super.dispose();
  }

  void _tickCountdown() {
    Future.delayed(const Duration(seconds: 1), () {
      if (!mounted) return;
      if (_submitCountdown.inSeconds <= 0) {
        setState(() => _submitUnlocked = true);
        return;
      }
      setState(() {
        _submitCountdown -= const Duration(seconds: 1);
      });
      _tickCountdown();
    });
  }

  Question get _currentQuestion => _questions[_currentIndex];

  ExamPagePosition get _position {
    if (_currentIndex == 0) return ExamPagePosition.first;
    if (_currentIndex == _questions.length - 1) return ExamPagePosition.last;
    return ExamPagePosition.middle;
  }

  void _goTo(int index) {
    setState(() => _currentIndex = index);
  }

  void _selectOption(int optionIndex) {
    setState(() {
      _currentQuestion.selectedOptionIndex = optionIndex;
    });
  }

  void _handleSubmit() {
    // TODO(integrasi-backend): kirim seluruh jawaban via Exam API lalu
    // tutup exam_attempt (Hero Exam PRD §15, §26). Saat ini hanya
    // menyimpan status "selesai" secara lokal (shared_preferences) karena
    // backend/database belum tersedia.
    showDialog<void>(
      context: context,
      builder: (context) => AlertDialog(
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
            onPressed: () => Navigator.of(context).pop(),
            child: Text(
              'Batal',
              style: AppTypography.cardMeta.copyWith(color: AppColors.textSecondary),
            ),
          ),
          TextButton(
            onPressed: () async {
              await ExamProgressStore.markCompleted(widget.examId);
              if (!context.mounted) return;
              Navigator.of(context).pop(); // tutup dialog
              Navigator.of(context).pop(true); // kembali ke Home, hasil=true
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

  @override
  Widget build(BuildContext context) {
    return Scaffold(
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
                    // ===== Kotak soal: scroll internal sendiri =====
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
                    // ===== Navigator grid: area sendiri, tidak ikut scroll soal =====
                    Expanded(
                      flex: 2,
                      child: Container(
                        margin: const EdgeInsets.fromLTRB(16, 8, 16, 8),
                        decoration: BoxDecoration(
                          color: AppColors.background,
                          borderRadius: BorderRadius.circular(AppRadius.cardDark),
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
              onPrevious: _currentIndex > 0 ? () => _goTo(_currentIndex - 1) : null,
              onNext: _currentIndex < _questions.length - 1
                  ? () => _goTo(_currentIndex + 1)
                  : null,
              onSubmit: _handleSubmit,
            ),
          ],
        ),
      ),
    );
  }
}

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
                const _MiniLogo(),
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
  const _MiniLogo();

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      width: 36,
      height: 36,
      child: Image.asset(
        'assets/images/logo_poncol.png',
        fit: BoxFit.contain,
        errorBuilder: (context, error, stackTrace) {
          return Container(
            decoration: BoxDecoration(
              color: AppColors.primary,
              borderRadius: BorderRadius.circular(6),
              border: Border.all(color: AppColors.accentGold, width: 1.5),
            ),
            alignment: Alignment.center,
            child: Text('SMK', style: AppTypography.badgeToday.copyWith(fontSize: 10)),
          );
        },
      ),
    );
  }
}

/// Kotak soal — HANYA bagian ini yang scroll jika konten (teks panjang,
/// gambar, opsi jawaban) melebihi tinggi kotak. Area luar (header,
/// navigator, action bar) tidak ikut tergulung karena scroll dibatasi
/// `SingleChildScrollView` di dalam `Container` bertinggi tetap (`Expanded`
/// dari parent), bukan membungkus seluruh screen.
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
                'KERJAKAN SOAL DENGAN TENANG DAN BACA SEKSAMA, SETIAP '
                    'TINDAKAN DILIHAT PENGAWAS!',
                style: AppTypography.labelCaps.copyWith(color: AppColors.textMuted),
              ),
              const SizedBox(height: 12),
              Container(height: 1, color: AppColors.primary.withOpacity(0.4)),
              const SizedBox(height: 16),
              Text(
                question.questionText,
                style: AppTypography.cardTitle.copyWith(fontSize: 19, height: 1.3),
              ),
              if (question.imagePath != null) ...[
                const SizedBox(height: 16),
                ClipRRect(
                  borderRadius: BorderRadius.circular(4),
                  child: question.isNetworkImage
                      ? Image.network(
                    question.imagePath!,
                    fit: BoxFit.contain,
                    loadingBuilder: (context, child, progress) {
                      if (progress == null) return child;
                      return Container(
                        height: 140,
                        alignment: Alignment.center,
                        child: const CircularProgressIndicator(
                          color: AppColors.primary,
                        ),
                      );
                    },
                    errorBuilder: (context, error, stackTrace) {
                      return const _ImageFallback();
                    },
                  )
                      : Image.asset(
                    question.imagePath!,
                    fit: BoxFit.contain,
                    errorBuilder: (context, error, stackTrace) {
                      return const _ImageFallback();
                    },
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
          color: isSelected ? AppColors.primary.withOpacity(0.12) : const Color(0xFFD9D9D9),
          borderRadius: BorderRadius.circular(6),
          border: isSelected ? Border.all(color: AppColors.primary, width: 1.5) : null,
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