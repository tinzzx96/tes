import 'package:flutter/material.dart';
import '../models/exam_schedule.dart';
import '../theme/app_colors.dart';
import '../theme/app_radius.dart';
import '../theme/app_typography.dart';

/// Schedule Card (Light) — dipakai di Schedule Screen.
///
/// Sesuai DESIGN_SYSTEM.md Section 5 — Schedule Card (Light):
/// - Background colorSurfaceLight, radius 12, padding 16
/// - Badge "TODAY" jika jadwal hari ini
/// - Divider dalam card sebelum tanggal di bawah
class ScheduleCard extends StatelessWidget {
  final ExamSchedule schedule;
  final bool isToday;

  const ScheduleCard({
    super.key,
    required this.schedule,
    required this.isToday,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: AppColors.surfaceLight,
        borderRadius: BorderRadius.circular(AppRadius.card),
        boxShadow: const [
          BoxShadow(
            color: Color(0x1A000000),
            blurRadius: 6,
            offset: Offset(0, 2),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          if (isToday) const _TodayBadge(),
          if (isToday) const SizedBox(height: 8),
          Text(schedule.subjectName, style: AppTypography.cardTitle),
          const SizedBox(height: 2),
          Text(schedule.examCode, style: AppTypography.cardCode),
          const SizedBox(height: 12),
          Row(
            children: [
              Expanded(
                child: _MetaRow(
                  icon: Icons.access_time,
                  text: schedule.timeRangeShort,
                ),
              ),
              Expanded(
                child: _MetaRow(
                  icon: Icons.location_on_outlined,
                  text: schedule.roomName,
                ),
              ),
            ],
          ),
          const SizedBox(height: 8),
          _MetaRow(
            icon: Icons.person_outline,
            text: schedule.teacherName,
          ),
          const SizedBox(height: 12),
          Container(
            height: 1,
            color: AppColors.divider.withOpacity(0.2),
          ),
          const SizedBox(height: 8),
          Text(_formatDate(schedule.startTime), style: AppTypography.cardDate),
        ],
      ),
    );
  }

  static String _formatDate(DateTime date) {
    const days = [
      'Senin',
      'Selasa',
      'Rabu',
      'Kamis',
      'Jumat',
      'Sabtu',
      'Minggu',
    ];
    const months = [
      'Jan',
      'Feb',
      'Mar',
      'Apr',
      'Mei',
      'Jun',
      'Jul',
      'Agu',
      'Sep',
      'Okt',
      'Nov',
      'Des',
    ];
    final dayName = days[date.weekday - 1];
    final monthName = months[date.month - 1];
    return '$dayName, ${date.day} $monthName ${date.year}';
  }
}

class _TodayBadge extends StatelessWidget {
  const _TodayBadge();

  @override
  Widget build(BuildContext context) {
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        Container(
          width: 8,
          height: 8,
          decoration: const BoxDecoration(
            color: AppColors.primary,
            shape: BoxShape.circle,
          ),
        ),
        const SizedBox(width: 6),
        Text(
          'TODAY',
          style: AppTypography.badgeToday.copyWith(color: AppColors.primary),
        ),
      ],
    );
  }
}

class _MetaRow extends StatelessWidget {
  final IconData icon;
  final String text;

  const _MetaRow({required this.icon, required this.text});

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        Icon(icon, size: 16, color: AppColors.textMuted),
        const SizedBox(width: 6),
        Expanded(
          child: Text(
            text,
            style: AppTypography.cardMeta,
            overflow: TextOverflow.ellipsis,
          ),
        ),
      ],
    );
  }
}
