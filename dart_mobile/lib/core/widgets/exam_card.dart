import 'package:flutter/material.dart';
import '../models/exam_schedule.dart';
import '../theme/app_colors.dart';
import '../theme/app_radius.dart';
import '../theme/app_typography.dart';

/// Exam Card (Dark) — dipakai di Home Screen, satu kartu per mapel ujian
/// hari ini, dengan tombol "MULAI UJIAN" di bawah.
///
/// Sesuai DESIGN_SYSTEM.md Section 5 — Exam Card (Dark):
/// - Background colorSurface, radius 8, padding 16
/// - Aksen garis merah (primary) 4px di sisi kiri kartu, sentuhan akhir
///   sesuai referensi desain — dirender di dalam ClipRRect yang sama
///   dengan radius kartu, supaya sudut garis ikut melengkung rapi dan
///   tidak terpotong kotak di pojok.
/// - Divider vertikal kiri-kanan
/// - Kiri: label TODAY'S EXAM + nama mapel + nama guru (merah)
/// - Kanan: Time bold + Duration label + nilai menit
/// - Badge SEGERA pojok kanan atas
/// - Tombol MULAI UJIAN full width dengan icon petir
class ExamCard extends StatelessWidget {
  final ExamSchedule schedule;
  final VoidCallback? onStartExam;
  final bool isCompleted;

  const ExamCard({
    super.key,
    required this.schedule,
    this.onStartExam,
    this.isCompleted = false,
  });

  @override
  Widget build(BuildContext context) {
    return Stack(
      children: [
        Opacity(
          opacity: isCompleted ? 0.55 : 1,
          child: ClipRRect(
            borderRadius: BorderRadius.circular(AppRadius.cardDark),
            child: Stack(
              children: [
                Container(
                  width: double.infinity,
                  padding: const EdgeInsets.fromLTRB(20, 16, 16, 16),
                  decoration: BoxDecoration(
                    color: isCompleted
                        ? Color.alphaBlend(
                      Colors.black.withOpacity(0.35),
                      AppColors.surface,
                    )
                        : AppColors.surface,
                  ),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                      Stack(
                        children: [
                          Row(
                            crossAxisAlignment: CrossAxisAlignment.center,
                            children: [
                              // Bagian kiri: label, nama mapel, nama guru
                              Expanded(
                                flex: 3,
                                child: Column(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  mainAxisSize: MainAxisSize.min,
                                  children: [
                                    Text(
                                      "TODAY'S EXAM",
                                      style: AppTypography.labelCaps,
                                    ),
                                    const SizedBox(height: 10),
                                    Text(
                                      schedule.subjectName.toUpperCase(),
                                      style: AppTypography.examTitle,
                                    ),
                                    const SizedBox(height: 2),
                                    Text(
                                      '-${schedule.teacherShortName}',
                                      style: AppTypography.examTitle.copyWith(
                                        fontSize: 14,
                                        fontWeight: FontWeight.w600,
                                        color: AppColors.textAccent,
                                      ),
                                    ),
                                  ],
                                ),
                              ),
                              Container(
                                width: 1,
                                height: 56,
                                margin:
                                const EdgeInsets.symmetric(horizontal: 12),
                                color: const Color(0xFF444444),
                              ),
                              // Bagian kanan: Time + Duration
                              Expanded(
                                flex: 2,
                                child: Padding(
                                  padding: const EdgeInsets.only(top: 18),
                                  child: Column(
                                    crossAxisAlignment:
                                    CrossAxisAlignment.start,
                                    mainAxisSize: MainAxisSize.min,
                                    children: [
                                      Text('Time',
                                          style:
                                          AppTypography.durationLabel),
                                      const SizedBox(height: 2),
                                      Text(
                                        schedule.timeRangeDash,
                                        style: AppTypography.timeBold,
                                        maxLines: 1,
                                      ),
                                      const SizedBox(height: 8),
                                      Text('Duration',
                                          style:
                                          AppTypography.durationLabel),
                                      const SizedBox(height: 2),
                                      Text(
                                        '${schedule.durationMinutes} Min',
                                        style: AppTypography.durationValue,
                                      ),
                                    ],
                                  ),
                                ),
                              ),
                            ],
                          ),
                          Positioned(
                            top: 0,
                            right: 0,
                            child: isCompleted
                                ? const SizedBox.shrink()
                                : const _SegeraBadge(),
                          ),
                        ],
                      ),
                      const SizedBox(height: 16),
                      _StartExamButton(
                        onPressed: isCompleted ? null : onStartExam,
                        isCompleted: isCompleted,
                      ),
                    ],
                  ),
                ),
                // ── Aksen garis merah di sisi kiri ───────────────────────
                Positioned(
                  top: 0,
                  bottom: 0,
                  left: 0,
                  child: Container(
                    width: 4,
                    color:
                    isCompleted ? AppColors.disabledOutline : AppColors.primary,
                  ),
                ),
              ],
            ),
          ),
        ),
        if (isCompleted)
          const Positioned(
            top: 12,
            right: 12,
            child: _CompletedBadge(),
          ),
      ],
    );
  }
}

class _CompletedBadge extends StatelessWidget {
  const _CompletedBadge();

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(4),
      decoration: const BoxDecoration(
        color: AppColors.submitGreen,
        shape: BoxShape.circle,
      ),
      child: const Icon(Icons.check, size: 16, color: Colors.white),
    );
  }
}

class _SegeraBadge extends StatelessWidget {
  const _SegeraBadge();

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
      decoration: BoxDecoration(
        color: AppColors.primary,
        borderRadius: BorderRadius.circular(4),
      ),
      child: Text(
        'SEGERA',
        style: AppTypography.badgeToday.copyWith(fontSize: 10),
      ),
    );
  }
}

class _StartExamButton extends StatelessWidget {
  final VoidCallback? onPressed;
  final bool isCompleted;

  const _StartExamButton({this.onPressed, this.isCompleted = false});

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      width: double.infinity,
      child: ElevatedButton(
        onPressed: onPressed,
        style: ElevatedButton.styleFrom(
          backgroundColor:
          isCompleted ? AppColors.disabledOutline : AppColors.primary,
          disabledBackgroundColor: AppColors.disabledOutline,
          foregroundColor: AppColors.textPrimary,
          padding: const EdgeInsets.symmetric(vertical: 14),
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(6),
          ),
          elevation: 0,
        ).copyWith(
          overlayColor: WidgetStateProperty.all(AppColors.primaryDark),
        ),
        child: Row(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(isCompleted ? Icons.check_circle : Icons.flash_on, size: 18),
            const SizedBox(width: 8),
            Text(
              isCompleted ? 'SELESAI' : 'MULAI UJIAN',
              style: AppTypography.buttonPrimary,
            ),
          ],
        ),
      ),
    );
  }
}