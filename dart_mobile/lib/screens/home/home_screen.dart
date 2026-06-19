import 'package:apk_ujian/screens/exam/exam_player_page.dart';
import 'package:flutter/material.dart';
import '../../core/models/exam_schedule.dart';
import '../../core/models/student.dart';
import '../../core/theme/app_colors.dart';
import '../../core/theme/app_typography.dart';
import '../../core/utils/dummy_data_repository.dart';
import '../../core/utils/exam_progress_store.dart';
import '../../core/widgets/app_header.dart';
import '../../core/widgets/avatar_badge.dart';
import '../../core/widgets/device_status_card.dart';
import '../../core/widgets/exam_card.dart';
import '../exam/exam_player_page.dart';

/// Home Screen — sesuai mockup Frame 2.
///
/// CATATAN LAYOUT (PENTING, sesuai permintaan eksplisit):
/// Device Status Card harus SELALU terlihat dan TIDAK PERNAH ikut tergulung
/// oleh scroll — ia bersifat fixed/pinned. Hanya daftar "Today's Exam" (satu
/// atau banyak ExamCard, bisa 3-4 mapel dalam sehari) yang boleh di-scroll,
/// dan scroll itu terbatas hanya pada areanya sendiri di bawah Device Status
/// Card, sehingga tidak pernah menutupi/menimpa/menggeser Device Status Card.
///
/// Implementasi: `Column` dengan Device Status Card sebagai child biasa
/// (bukan di dalam scroll view apa pun), lalu `Expanded(child: ListView)`
/// untuk daftar ExamCard. Karena Device Status Card tidak dibungkus oleh
/// scrollable apa pun, ia tidak akan pernah bergerak ketika daftar ExamCard
/// di bawahnya di-scroll — persis seperti yang diminta.
///
/// Status "selesai" per mapel (opacity turun + badge centang hijau) dibaca
/// dari `ExamProgressStore` (shared_preferences sementara, lihat TODO di
/// file itu untuk migrasi ke backend asli).
class HomeScreen extends StatefulWidget {
  const HomeScreen({super.key});

  @override
  State<HomeScreen> createState() => _HomeScreenState();
}

class _HomeScreenState extends State<HomeScreen> {
  final Student _student = DummyDataRepository.getCurrentStudent();
  final List<ExamSchedule> _todaySchedules = DummyDataRepository.getTodaySchedules();
  Set<String> _completedIds = <String>{};

  @override
  void initState() {
    super.initState();
    _loadCompletedIds();
  }

  Future<void> _loadCompletedIds() async {
    final ids = await ExamProgressStore.getCompletedExamIds();
    if (!mounted) return;
    setState(() => _completedIds = ids);
  }

  Future<void> _openExam(ExamSchedule schedule) async {
    final result = await Navigator.of(context).push<bool>(
      MaterialPageRoute(
        builder: (_) => ExamPlayerPage(
          examId: schedule.id,
          subjectName: schedule.subjectName,
          teacherName: schedule.teacherName,
        ),
      ),
    );
    // Refresh status completed begitu kembali dari Exam Player, supaya
    // mapel yang baru disubmit langsung tampil redup + centang hijau, dan
    // mapel berikutnya (misal Prod A) tetap bisa dilanjutkan seperti biasa.
    if (result == true) {
      await _loadCompletedIds();
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.background,
      body: Column(
        children: [
          const AppHeader(),
          _ProfileSection(student: _student),
          Expanded(
            child: Container(
              color: const Color(0xFFE8E8E8),
              child: Column(
                children: [
                  // ===== FIXED: Device Status Card, tidak ikut scroll =====
                  Padding(
                    padding: const EdgeInsets.fromLTRB(24, 16, 24, 16),
                    child: DeviceStatusCard(student: _student),
                  ),
                  // ===== SCROLLABLE: daftar Exam Card, area sendiri =====
                  Expanded(
                    child: _todaySchedules.isEmpty
                        ? const _EmptyTodayState()
                        : ListView.separated(
                            padding: const EdgeInsets.fromLTRB(24, 0, 24, 16),
                            itemCount: _todaySchedules.length,
                            separatorBuilder: (context, index) =>
                                const SizedBox(height: 16),
                            itemBuilder: (context, index) {
                              final schedule = _todaySchedules[index];
                              final isCompleted = _completedIds.contains(schedule.id);
                              return ExamCard(
                                schedule: schedule,
                                isCompleted: isCompleted,
                                onStartExam: () => _openExam(schedule),
                              );
                            },
                          ),
                  ),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _ProfileSection extends StatelessWidget {
  final Student student;

  const _ProfileSection({required this.student});

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      color: AppColors.background,
      padding: const EdgeInsets.fromLTRB(24, 8, 24, 24),
      child: Row(
        children: [
          AvatarBadge(initials: student.initials),
          const SizedBox(width: 16),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  student.name.toUpperCase(),
                  style: AppTypography.studentName,
                  overflow: TextOverflow.ellipsis,
                ),
                const SizedBox(height: 2),
                Text(
                  '${student.nisn} \u00b7 ${student.classLabel}',
                  style: AppTypography.studentMeta,
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _EmptyTodayState extends StatelessWidget {
  const _EmptyTodayState();

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(vertical: 32),
      alignment: Alignment.center,
      child: Column(
        children: [
          const Icon(
            Icons.event_available_outlined,
            size: 40,
            color: AppColors.textMuted,
          ),
          const SizedBox(height: 12),
          Text(
            'Tidak ada ujian hari ini',
            style: AppTypography.cardMeta.copyWith(color: AppColors.textMuted),
          ),
        ],
      ),
    );
  }
}
