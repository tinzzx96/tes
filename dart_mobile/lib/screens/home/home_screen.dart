import 'package:flutter/material.dart';
import '../../core/models/exam_schedule.dart';
import '../../core/models/student.dart';
import '../../core/theme/app_colors.dart';
import '../../core/theme/app_typography.dart';
import '../../core/utils/exam_progress_store.dart';
import '../../core/widgets/avatar_badge.dart';
import '../../core/widgets/device_status_card.dart';
import '../../core/widgets/exam_card.dart';
import '../../core/widgets/exam_token_dialog.dart';
import '../../core/widgets/fade_in_item.dart';
import '../../core/widgets/header_status_actions.dart';
import '../../core/utils/greeting_helper.dart';
import '../../core/utils/exam_schedule_repository.dart';
import '../../core/utils/auth_repository.dart';
import '../exam/validation_screen.dart';
import '../login/login_screen.dart';

/// Home Screen — sesuai mockup Frame 2.
///
/// Jadwal hari ini diambil dari server via ExamScheduleRepository.fetchToday().
/// Device Status Card fixed (tidak scroll). Hanya ExamCard list yang scroll.
class HomeScreen extends StatefulWidget {
  const HomeScreen({super.key});

  @override
  State<HomeScreen> createState() => HomeScreenState();
}

class HomeScreenState extends State<HomeScreen> {
  // Data profil siswa — diambil dari server via AuthRepository.me()
  // atau bisa dari FlutterSecureStorage jika sudah disimpan saat login.
  // Sementara pakai placeholder sampai disambungkan ke profil endpoint.
  Student? _student;

  // Jadwal dari server
  List<ExamSchedule> _todaySchedules = [];
  bool _isLoading = false;
  String? _errorMessage;

  Set<String> _completedIds = <String>{};

  @override
  void initState() {
    super.initState();
    _loadData();
  }

Future<void> _loadData() async {
    if (!mounted) return;
    setState(() {
      _isLoading = true;
      _errorMessage = null;
    });

    try {
      // Ambil profil siswa dari server
      final studentMap = await AuthRepository.me();
      var student = Student.fromJson(studentMap);

      // Fallback: Jika di DB device name masih kosong, gunakan nama perangkat lokal
      if (student.deviceName.isEmpty) {
        final localDeviceName = await AuthRepository.getLocalDeviceName();
        student = student.copyWith(deviceName: localDeviceName);
      }

      // Ambil jadwal dari server.
      //
      // FIX (Bug: "Schedule ngaco di Home" — ujian besok/minggu ini ikut
      // muncul sebagai Today's Exam):
      // GET /api/exams (dipanggil oleh fetchToday()) TIDAK hanya
      // mengembalikan ujian hari ini — ia mengembalikan semua ujian yang
      // sudah waktu mulainya tercapai (startTime <= now) dan belum
      // melewati endTime, termasuk ujian besok/lusa/minggu ini yang sudah
      // diaktifkan admin (status: active). Endpoint ini memang dipakai
      // bersama oleh Home & Schedule Screen, jadi Home WAJIB memfilter
      // sendiri hanya untuk hari ini menggunakan ExamSchedule.isToday(),
      // bukan mengasumsikan backend sudah melakukannya.
      final allSchedules = await ExamScheduleRepository.fetchToday();
      final now = DateTime.now();
      final schedules = allSchedules.where((s) => s.isToday(now)).toList();

      // Ambil status ujian yang sudah selesai
      final ids = await ExamProgressStore.getCompletedExamIds();

      if (!mounted) return;
      setState(() {
        _student = student;
        _todaySchedules = schedules;
        _completedIds = ids;
        _isLoading = false;
      });
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _isLoading = false;
        _errorMessage = e.toString().replaceFirst('Exception: ', '');
      });
    }
  }

  /// Publik — dipanggil dari luar lewat GlobalKey<HomeScreenState> di AppShell.
  Future<void> reloadCompletedIds() async {
    final ids = await ExamProgressStore.getCompletedExamIds();
    if (!mounted) return;
    setState(() => _completedIds = ids);
  }

  Future<void> _openExam(ExamSchedule schedule) async {
    final tokenValid = await ExamTokenDialog.show(
      context,
      examId: schedule.id,
      subjectName: schedule.subjectName,
    );
    if (tokenValid != true) return;
    if (!mounted) return;

    final result = await Navigator.of(context).push<bool>(
      MaterialPageRoute(
        builder: (_) => ValidationScreen(
          examId: schedule.id,
          subjectName: schedule.subjectName,
          teacherName: schedule.teacherName,
        ),
      ),
    );
    if (result == true) {
      await reloadCompletedIds();
    }
  }

  @override
  Widget build(BuildContext context) {
    // Gunakan student dari state jika ada, fallback ke placeholder
    final student = _student ??
        const Student(
          name: 'Siswa',
          nisn: '-',
          classLabel: '-',
        );

    final screenHeight = MediaQuery.of(context).size.height;
    final isSmallScreen = screenHeight < 720;

    return Scaffold(
      backgroundColor: AppColors.background,
      body: Column(
        children: [
          _HomeHeader(onRefreshComplete: reloadCompletedIds),
          _ProfileSection(student: student),
          Expanded(
            child: Container(
              color: const Color(0xFFE8E8E8),
              child: CustomScrollView(
                slivers: [
                  // ===== Device Status Card (Scrollable) =====
                  SliverPadding(
                    padding: EdgeInsets.fromLTRB(
                      24,
                      isSmallScreen ? 10 : 16,
                      24,
                      isSmallScreen ? 10 : 16,
                    ),
                    sliver: SliverToBoxAdapter(
                      child: DeviceStatusCard(student: student),
                    ),
                  ),
                  // ===== Greeting + tanggal + ringkasan ujian hari ini =====
                  SliverToBoxAdapter(
                    child: _TodaySummaryBar(
                      total: _todaySchedules.length,
                      completed: _todaySchedules
                          .where((s) => _completedIds.contains(s.id) || s.isCompleted)
                          .length,
                    ),
                  ),
                  // ===== SCROLLABLE: daftar Exam Card =====
                  _buildSliverScheduleList(isSmallScreen),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildSliverScheduleList(bool isSmallScreen) {
    if (_isLoading) {
      return const SliverFillRemaining(
        hasScrollBody: false,
        child: Center(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              CircularProgressIndicator(),
              SizedBox(height: 12),
              Text('Memuat jadwal ujian...'),
            ],
          ),
        ),
      );
    }

    if (_errorMessage != null) {
      return SliverFillRemaining(
        hasScrollBody: false,
        child: Center(
          child: Padding(
            padding: const EdgeInsets.all(24),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                const Icon(Icons.error_outline, color: AppColors.primary, size: 40),
                const SizedBox(height: 12),
                Text(
                  _errorMessage!,
                  textAlign: TextAlign.center,
                  style: AppTypography.cardMeta
                      .copyWith(color: AppColors.textSecondary),
                ),
                const SizedBox(height: 16),
                ElevatedButton.icon(
                  onPressed: _loadData,
                  icon: const Icon(Icons.refresh),
                  label: const Text('Coba Lagi'),
                ),
              ],
            ),
          ),
        ),
      );
    }

    if (_todaySchedules.isEmpty) {
      return const SliverToBoxAdapter(
        child: _EmptyTodayState(),
      );
    }

    return SliverPadding(
      padding: EdgeInsets.fromLTRB(24, 4, 24, isSmallScreen ? 12 : 24),
      sliver: SliverList(
        delegate: SliverChildBuilderDelegate(
          (context, index) {
            // Menghasilkan item list dengan separator SizedBox
            if (index.isOdd) {
              return SizedBox(height: isSmallScreen ? 12 : 16);
            }
            final itemIndex = index ~/ 2;
            final schedule = _todaySchedules[itemIndex];
            final isCompleted = _completedIds.contains(schedule.id) || schedule.isCompleted;
            return FadeInItem(
              index: itemIndex,
              child: ExamCard(
                schedule: schedule,
                isCompleted: isCompleted,
                onStartExam: () => _openExam(schedule),
              ),
            );
          },
          childCount: _todaySchedules.length * 2 - 1,
        ),
      ),
    );
  }
}

/// Header Home Screen.
class _HomeHeader extends StatelessWidget {
  final VoidCallback? onRefreshComplete;

  const _HomeHeader({this.onRefreshComplete});

  @override
  Widget build(BuildContext context) {
    final screenHeight = MediaQuery.of(context).size.height;
    final isSmallScreen = screenHeight < 720;

    return Container(
      color: AppColors.background,
      child: SafeArea(
        bottom: false,
        child: Column(
          children: [
            Padding(
              padding: EdgeInsets.fromLTRB(24, isSmallScreen ? 8 : 16, 24, 0),
              child: Row(
                children: [
                  _AppLogo(size: isSmallScreen ? 28 : 36),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Text(
                      'EXAM-PONCOL', 
                      style: AppTypography.appTitle.copyWith(
                        fontSize: isSmallScreen ? 18 : 22,
                      ),
                    ),
                  ),
                  const HeaderStatusActions(),
                ],
              ),
            ),
            SizedBox(height: isSmallScreen ? 8 : 16),
            Container(height: 1, color: AppColors.accentGold),
            Padding(
              padding: EdgeInsets.fromLTRB(24, isSmallScreen ? 4 : 8, 24, 0),
              child: Align(
                alignment: Alignment.centerRight,
                child: RefreshScheduleButton(
                  onRefreshComplete: onRefreshComplete,
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _AppLogo extends StatelessWidget {
  final double size;

  const _AppLogo({required this.size});

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      width: size,
      height: size,
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
              style: AppTypography.badgeToday.copyWith(fontSize: size * 0.28),
            ),
          );
        },
      ),
    );
  }
}

class _ProfileSection extends StatelessWidget {
  final Student student;

  const _ProfileSection({required this.student});

  @override
  Widget build(BuildContext context) {
    final screenHeight = MediaQuery.of(context).size.height;
    final isSmallScreen = screenHeight < 720;

    return Container(
      width: double.infinity,
      color: AppColors.background,
      padding: EdgeInsets.fromLTRB(24, isSmallScreen ? 6 : 12, 24, isSmallScreen ? 12 : 24),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.center,
        children: [
          Container(
            padding: const EdgeInsets.all(2.5),
            decoration: BoxDecoration(
              borderRadius: BorderRadius.circular(11),
              border: Border.all(
                color: Colors.white.withOpacity(0.85),
                width: 1.5,
              ),
            ),
            child: AvatarBadge(initials: student.initials),
          ),
          const SizedBox(width: 16),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  student.name.toUpperCase(),
                  style: AppTypography.studentName.copyWith(
                    fontSize: isSmallScreen ? 14 : 16,
                  ),
                  overflow: TextOverflow.ellipsis,
                ),
                SizedBox(height: isSmallScreen ? 4 : 8),
                Wrap(
                  spacing: 8,
                  runSpacing: 6,
                  children: [
                    _InfoChip(
                      icon: Icons.badge_outlined,
                      label: student.nisn,
                    ),

                    _InfoChip(
                      icon: Icons.school_outlined,
                      label: student.classLabel,
                    ),
                  ],
                ),
              ],
            ),
          ),
          const SizedBox(width: 12),
          const _LogoutButton(),
        ],
      ),
    );
  }
}

class _InfoChip extends StatelessWidget {
  final IconData icon;
  final String label;

  const _InfoChip({required this.icon, required this.label});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
      decoration: BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: Colors.white.withOpacity(0.08)),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(icon, size: 13, color: AppColors.textSecondary),
          const SizedBox(width: 5),
          Text(
            label,
            style: AppTypography.studentMeta.copyWith(fontSize: 12),
          ),
        ],
      ),
    );
  }
}

class _LogoutButton extends StatelessWidget {
  const _LogoutButton();

  Future<void> _handleLogout(BuildContext context) async {
    final proceed = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        backgroundColor: AppColors.surface,
        title: const Text('Log out', style: TextStyle(color: AppColors.textPrimary)),
        content: const Text('Apakah Anda yakin ingin keluar dari akun?', style: TextStyle(color: AppColors.textSecondary)),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(ctx).pop(false),
            child: const Text('Batal', style: TextStyle(color: AppColors.textSecondary)),
          ),
          TextButton(
            onPressed: () => Navigator.of(ctx).pop(true),
            child: const Text('Keluar', style: TextStyle(color: AppColors.primary, fontWeight: FontWeight.bold)),
          ),
        ],
      ),
    );

    if (proceed == true) {
      await AuthRepository.logout();
      if (context.mounted) {
        Navigator.of(context).pushAndRemoveUntil(
          MaterialPageRoute(builder: (_) => const LoginScreen()),
          (route) => false,
        );
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return InkWell(
      borderRadius: BorderRadius.circular(20),
      onTap: () => _handleLogout(context),
      child: const Padding(
        padding: EdgeInsets.all(8.0),
        child: Icon(
          Icons.logout_rounded,
          size: 22,
          color: AppColors.primary,
        ),
      ),
    );
  }
}

class _TodaySummaryBar extends StatelessWidget {
  final int total;
  final int completed;

  const _TodaySummaryBar({required this.total, required this.completed});

  @override
  Widget build(BuildContext context) {
    final String statusText = total == 0
        ? 'Tidak ada ujian'
        : (completed >= total
        ? 'Semua ujian selesai'
        : '$total ujian \u00b7 $completed selesai');

    return Padding(
      padding: const EdgeInsets.fromLTRB(24, 0, 24, 12),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.center,
        children: [
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  GreetingHelper.greeting(),
                  style: AppTypography.cardTitle.copyWith(
                    color: AppColors.textDark,
                    fontSize: 15,
                  ),
                ),
                const SizedBox(height: 2),
                Text(
                  GreetingHelper.fullDate(),
                  style: AppTypography.cardMeta.copyWith(
                    color: AppColors.textMuted,
                    fontSize: 12,
                  ),
                ),
              ],
            ),
          ),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
            decoration: BoxDecoration(
              color: AppColors.surface,
              borderRadius: BorderRadius.circular(20),
            ),
            child: Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                Icon(
                  completed >= total && total > 0
                      ? Icons.check_circle_outline
                      : Icons.assignment_outlined,
                  size: 14,
                  color: completed >= total && total > 0
                      ? AppColors.submitGreen
                      : AppColors.textSecondary,
                ),
                const SizedBox(width: 6),
                Text(
                  statusText,
                  style: AppTypography.cardMeta.copyWith(
                    color: AppColors.textSecondary,
                    fontSize: 11,
                    fontWeight: FontWeight.w600,
                  ),
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
