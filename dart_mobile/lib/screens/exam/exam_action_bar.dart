import 'package:flutter/material.dart';
import '../../core/theme/app_colors.dart';
import '../../core/theme/app_radius.dart';
import '../../core/theme/app_typography.dart';

/// Posisi soal saat ini, menentukan style tombol Sebelumnya/Selanjutnya.
enum ExamPagePosition { first, middle, last }

/// Action bar bawah Exam Player: Sebelumnya, Submit (+timer), Selanjutnya.
///
/// Aturan tampilan (sesuai spek):
/// - first: Sebelumnya solid non-aktif look (disabled), Selanjutnya solid,
///   Submit outlined+timer.
/// - middle: Sebelumnya outlined, Selanjutnya solid, Submit outlined+timer.
/// - last + timer berjalan: Sebelumnya outlined, Selanjutnya hilang,
///   Submit outlined+timer (disabled).
/// - last + timer selesai: Submit solid hijau aktif, Selanjutnya tetap
///   hilang.
class ExamActionBar extends StatelessWidget {
  final ExamPagePosition position;
  final bool isSubmitUnlocked;
  final Duration submitCountdown;
  final VoidCallback? onPrevious;
  final VoidCallback? onNext;
  final VoidCallback? onSubmit;

  const ExamActionBar({
    super.key,
    required this.position,
    required this.isSubmitUnlocked,
    required this.submitCountdown,
    this.onPrevious,
    this.onNext,
    this.onSubmit,
  });

  String get _timerLabel {
    final minutes = submitCountdown.inMinutes.remainder(60).toString().padLeft(2, '0');
    final seconds = submitCountdown.inSeconds.remainder(60).toString().padLeft(2, '0');
    return '$minutes:$seconds';
  }

  @override
  Widget build(BuildContext context) {
    final bool showNext = position != ExamPagePosition.last;
    final bool previousEnabled = position != ExamPagePosition.first;

    return Padding(
      padding: const EdgeInsets.fromLTRB(16, 12, 16, 16),
      child: Row(
        children: [
          Expanded(
            child: _OutlinedActionButton(
              label: '< SEBELUMNYA',
              enabled: previousEnabled,
              onPressed: previousEnabled ? onPrevious : null,
            ),
          ),
          const SizedBox(width: 8),
          Expanded(
            child: _SubmitButton(
              isUnlocked: isSubmitUnlocked,
              timerLabel: _timerLabel,
              onPressed: isSubmitUnlocked ? onSubmit : null,
            ),
          ),
          const SizedBox(width: 8),
          Expanded(
            child: showNext
                ? _SolidActionButton(label: 'SELANJUTNYA >', onPressed: onNext)
                : const SizedBox.shrink(),
          ),
        ],
      ),
    );
  }
}

class _SolidActionButton extends StatelessWidget {
  final String label;
  final VoidCallback? onPressed;

  const _SolidActionButton({required this.label, this.onPressed});

  @override
  Widget build(BuildContext context) {
    return ElevatedButton(
      onPressed: onPressed,
      style: ElevatedButton.styleFrom(
        backgroundColor: AppColors.primary,
        foregroundColor: AppColors.textPrimary,
        padding: const EdgeInsets.symmetric(vertical: 14),
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(AppRadius.button),
        ),
        elevation: 0,
      ).copyWith(
        overlayColor: WidgetStateProperty.all(AppColors.primaryDark),
      ),
      child: Text(
        label,
        style: AppTypography.buttonPrimary.copyWith(fontSize: 13),
        textAlign: TextAlign.center,
      ),
    );
  }
}

class _OutlinedActionButton extends StatelessWidget {
  final String label;
  final bool enabled;
  final VoidCallback? onPressed;

  const _OutlinedActionButton({
    required this.label,
    required this.enabled,
    this.onPressed,
  });

  @override
  Widget build(BuildContext context) {
    final Color color = enabled ? AppColors.textPrimary : AppColors.disabledText;
    final Color borderColor = enabled ? AppColors.primary : AppColors.disabledOutline;

    return OutlinedButton(
      onPressed: onPressed,
      style: OutlinedButton.styleFrom(
        side: BorderSide(color: borderColor),
        padding: const EdgeInsets.symmetric(vertical: 14),
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(AppRadius.button),
        ),
      ),
      child: Text(
        label,
        style: AppTypography.buttonPrimary.copyWith(fontSize: 13, color: color),
        textAlign: TextAlign.center,
      ),
    );
  }
}

class _SubmitButton extends StatelessWidget {
  final bool isUnlocked;
  final String timerLabel;
  final VoidCallback? onPressed;

  const _SubmitButton({
    required this.isUnlocked,
    required this.timerLabel,
    this.onPressed,
  });

  @override
  Widget build(BuildContext context) {
    if (isUnlocked) {
      return ElevatedButton(
        onPressed: onPressed,
        style: ElevatedButton.styleFrom(
          backgroundColor: AppColors.submitGreen,
          foregroundColor: AppColors.textPrimary,
          padding: const EdgeInsets.symmetric(vertical: 14),
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(AppRadius.button),
          ),
          elevation: 0,
        ),
        child: Text(
          'SUBMIT',
          style: AppTypography.buttonPrimary.copyWith(fontSize: 13),
          textAlign: TextAlign.center,
        ),
      );
    }

    return OutlinedButton(
      onPressed: null,
      style: OutlinedButton.styleFrom(
        side: const BorderSide(color: AppColors.disabledOutline),
        padding: const EdgeInsets.symmetric(vertical: 14),
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(AppRadius.button),
        ),
      ),
      child: Text(
        'Submit ($timerLabel)',
        style: AppTypography.buttonPrimary.copyWith(
          fontSize: 12,
          color: AppColors.disabledText,
        ),
        textAlign: TextAlign.center,
      ),
    );
  }
}
