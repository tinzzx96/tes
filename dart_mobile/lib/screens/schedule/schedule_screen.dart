import 'package:flutter/material.dart';
import '../../core/models/exam_schedule.dart';
import '../../core/theme/app_colors.dart';
import '../../core/theme/app_typography.dart';
import '../../core/utils/dummy_data_repository.dart';
import '../../core/widgets/schedule_card.dart';

/// Schedule Screen — sesuai mockup Frame 3.
///
/// Layout: header "EXAM SCHEDULE" tetap berada di area gelap atas (tidak
/// di-scroll), lalu daftar ScheduleCard di area abu-abu bawah memiliki
/// scroll-nya sendiri (`Expanded` + `ListView`) sehingga bisa menampilkan
/// banyak jadwal (3, 4, atau lebih mapel) tanpa masalah, persis seperti
/// behaviour scroll yang diminta di Home Screen.
class ScheduleScreen extends StatelessWidget {
  const ScheduleScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final List<ExamSchedule> schedules =
        DummyDataRepository.getUpcomingSchedules();
    final now = DateTime.now();

    return Scaffold(
      backgroundColor: AppColors.background,
      body: Column(
        children: [
          const _ScheduleHeader(),
          Expanded(
            child: Container(
              color: const Color(0xFFE8E8E8),
              child: schedules.isEmpty
                  ? const _EmptyScheduleState()
                  : ListView.separated(
                      padding: const EdgeInsets.fromLTRB(24, 24, 24, 16),
                      itemCount: schedules.length,
                      separatorBuilder: (context, index) =>
                          const SizedBox(height: 16),
                      itemBuilder: (context, index) {
                        final schedule = schedules[index];
                        return ScheduleCard(
                          schedule: schedule,
                          isToday: schedule.isToday(now),
                        );
                      },
                    ),
            ),
          ),
        ],
      ),
    );
  }
}

class _ScheduleHeader extends StatelessWidget {
  const _ScheduleHeader();

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      color: AppColors.background,
      child: SafeArea(
        bottom: false,
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
            const SizedBox(height: 16),
            Container(height: 1, color: AppColors.accentGold),
            Padding(
              padding: const EdgeInsets.fromLTRB(24, 20, 24, 24),
              child: Text('EXAM SCHEDULE', style: AppTypography.pageTitle),
            ),
          ],
        ),
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
            child: Text(
              'SMK',
              style: AppTypography.badgeToday.copyWith(fontSize: 10),
            ),
          );
        },
      ),
    );
  }
}

class _EmptyScheduleState extends StatelessWidget {
  const _EmptyScheduleState();

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          const Icon(
            Icons.event_busy_outlined,
            size: 40,
            color: AppColors.textMuted,
          ),
          const SizedBox(height: 12),
          Text(
            'Belum ada jadwal ujian',
            style: AppTypography.cardMeta.copyWith(color: AppColors.textMuted),
          ),
        ],
      ),
    );
  }
}
