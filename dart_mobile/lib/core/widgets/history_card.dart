import 'package:flutter/material.dart';
import '../models/exam_history_entry.dart';
import '../theme/app_colors.dart';
import '../theme/app_radius.dart';
import '../theme/app_typography.dart';

/// Kartu riwayat satu ujian yang sudah disubmit — dipakai di History
/// Screen.
///
/// Dirancang SELARAS secara visual dengan ExamCard (Home Screen): surface
/// gelap, garis aksen merah 4px di kiri, radius & padding identik —
/// supaya murid langsung mengenali ini sebagai "keluarga" komponen yang
/// sama meski fungsinya beda (riwayat vs ujian aktif).
class HistoryCard extends StatelessWidget {
  final ExamHistoryEntry entry;

  const HistoryCard({super.key, required this.entry});

  String get _timeLabel {
    final h = entry.submittedAt.hour.toString().padLeft(2, '0');
    final m = entry.submittedAt.minute.toString().padLeft(2, '0');
    return '$h:$m';
  }

  @override
  Widget build(BuildContext context) {
    return ClipRRect(
      borderRadius: BorderRadius.circular(AppRadius.cardDark),
      child: Stack(
        children: [
          Container(
            width: double.infinity,
            padding: const EdgeInsets.fromLTRB(20, 14, 16, 14),
            color: AppColors.surface,
            child: Row(
              children: [
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Text(
                        entry.subjectName.toUpperCase(),
                        style: AppTypography.examTitle.copyWith(fontSize: 18),
                      ),
                      const SizedBox(height: 2),
                      Text(
                        '-${entry.teacherName}',
                        style: AppTypography.examTitle.copyWith(
                          fontSize: 13,
                          fontWeight: FontWeight.w600,
                          color: AppColors.textAccent,
                        ),
                      ),
                      const SizedBox(height: 8),
                      Row(
                        children: [
                          Icon(Icons.check_circle,
                              size: 13, color: AppColors.submitGreen),
                          const SizedBox(width: 5),
                          Text(
                            'Disubmit $_timeLabel',
                            style: AppTypography.cardMeta.copyWith(
                              color: AppColors.textSecondary,
                              fontSize: 11,
                            ),
                          ),
                        ],
                      ),
                    ],
                  ),
                ),
                const SizedBox(width: 12),
                _ScoreBadge(score: entry.score),
              ],
            ),
          ),
          Positioned(
            top: 0,
            bottom: 0,
            left: 0,
            child: Container(width: 4, color: AppColors.primary),
          ),
        ],
      ),
    );
  }
}

class _ScoreBadge extends StatelessWidget {
  final int? score;

  const _ScoreBadge({required this.score});

  @override
  Widget build(BuildContext context) {
    if (score == null) {
      return Container(
        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
        decoration: BoxDecoration(
          color: Colors.white.withOpacity(0.06),
          borderRadius: BorderRadius.circular(8),
        ),
        child: Text(
          'Menunggu\nNilai',
          textAlign: TextAlign.center,
          style: AppTypography.cardMeta.copyWith(
            color: AppColors.textSecondary,
            fontSize: 10,
            height: 1.3,
          ),
        ),
      );
    }
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
      decoration: BoxDecoration(
        color: AppColors.submitGreen.withOpacity(0.12),
        borderRadius: BorderRadius.circular(8),
        border: Border.all(color: AppColors.submitGreen.withOpacity(0.4)),
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Text(
            '$score',
            style: AppTypography.timeBold.copyWith(
              color: AppColors.submitGreen,
              fontSize: 18,
            ),
          ),
          Text(
            'Nilai',
            style: AppTypography.cardMeta.copyWith(
              color: AppColors.submitGreen,
              fontSize: 9,
            ),
          ),
        ],
      ),
    );
  }
}