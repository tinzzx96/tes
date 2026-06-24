import 'package:flutter/material.dart';
import '../../core/models/question.dart';
import '../../core/theme/app_colors.dart';
import '../../core/theme/app_radius.dart';
import '../../core/theme/app_typography.dart';

/// Grid kotak nomor soal (Question Navigator).
///
/// Klik kotak nomor tampilan (1, 2, 3, ...) -> loncat ke soal dengan
/// `displayNumber` itu, walau soal aslinya sudah diacak posisinya.
class QuestionNavigatorGrid extends StatelessWidget {
  final List<Question> questions;
  final int currentIndex;
  final ValueChanged<int> onSelect;

  const QuestionNavigatorGrid({
    super.key,
    required this.questions,
    required this.currentIndex,
    required this.onSelect,
  });

  @override
  Widget build(BuildContext context) {
    return GridView.builder(
      padding: const EdgeInsets.all(16),
      gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
        crossAxisCount: 8,
        mainAxisSpacing: 8,
        crossAxisSpacing: 8,
        childAspectRatio: 1,
      ),
      itemCount: questions.length,
      itemBuilder: (context, index) {
        final question = questions[index];
        final isActive = index == currentIndex;
        return _NavigatorBox(
          question: question,
          isActive: isActive,
          onTap: () => onSelect(index),
        );
      },
    );
  }
}

class _NavigatorBox extends StatelessWidget {
  final Question question;
  final bool isActive;
  final VoidCallback onTap;

  const _NavigatorBox({
    required this.question,
    required this.isActive,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    final Color bg;
    final Color textColor;
    switch (question.status) {
      case QuestionStatus.answered:
        bg = AppColors.navigatorBoxAnswered;
        textColor = AppColors.textPrimary;
        break;
      case QuestionStatus.flagged:
        bg = AppColors.navigatorBoxFlagged;
        textColor = AppColors.textDark;
        break;
      case QuestionStatus.unanswered:
        bg = AppColors.navigatorBoxBg;
        textColor = AppColors.textDark;
        break;
    }

    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(AppRadius.badge),
      child: Container(
        decoration: BoxDecoration(
          color: bg,
          borderRadius: BorderRadius.circular(AppRadius.badge),
          border: isActive
              ? Border.all(color: AppColors.primary, width: 2)
              : null,
        ),
        alignment: Alignment.center,
        child: Text(
          '${question.displayNumber}',
          style: AppTypography.cardMeta.copyWith(
            color: textColor,
            fontWeight: FontWeight.w700,
          ),
        ),
      ),
    );
  }
}
