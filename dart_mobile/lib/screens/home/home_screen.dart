import 'package:flutter/material.dart';
import '../../core/models/exam_schedule.dart';
import '../../core/models/student.dart';
import '../../core/theme/app_colors.dart';
import '../../core/theme/app_typography.dart';
import '../../core/utils/dummy_data_repository.dart';
import '../../core/utils/exam_progress_store.dart';
import '../../core/widgets/avatar_badge.dart';
import '../../core/widgets/device_status_card.dart';
import '../../core/widgets/exam_card.dart';
import '../../core/widgets/exam_token_dialog.dart';
import '../../core/widgets/fade_in_item.dart';
import '../../core/widgets/header_status_actions.dart';
import '../../core/utils/greeting_helper.dart';
import '../exam/validation_screen.dart';

/// Home Screen — sesuai mockup Frame 2.
///
/// CATATAN LAYOUT (PENTING, sesuai permintaan eksplisit):
/// Device Status Card harus SELALU terlihat dan TIDAK PERNAH ikut tergulung
/// oleh scroll — ia bersifat fixed/pinned. Hanya daftar "Today's Exam" (satu
/// atau banyak ExamCard, bisa 3-4 mapel dalam sehari) yang boleh di-scroll,
/// dan scroll itu terbatas hanya pada areanya sendiri di bawah Device Status
/// Card, sehingga tidak pernah menutupi/menimpa/menggeser Device Status Card.
///
/// Status "selesai" per mapel (opacity turun + badge centang hijau) dibaca
/// dari `ExamProgressStore` (shared_preferences sementara, lihat TODO di
/// file itu untuk migrasi ke backend asli).
///
/// CATATAN BUG FIX (centang hijau tidak hilang setelah reset di Schedule):
/// HomeScreen & ScheduleScreen adalah instance State TERPISAH karena
/// AppShell memakai IndexedStack (supaya state scroll dsb tetap terjaga
/// saat pindah tab). Akibatnya, menekan tombol Refresh di ScheduleScreen
/// TIDAK otomatis memberi tahu HomeScreen untuk reload `_completedIds`
/// miliknya sendiri — keduanya independen.
///
/// Fix: HomeScreen sekarang expose method `reloadCompletedIds()` publik
/// lewat GlobalKey (lihat AppShell), dipanggil oleh AppShell setiap kali
/// ScheduleScreen selesai refresh. HomeScreen JUGA punya tombol
/// Refresh/HeaderStatusActions sendiri untuk kasus reset langsung dari
/// Home tanpa perlu pindah tab dulu.
class HomeScreen extends StatefulWidget {
  const HomeScreen({super.key});

  @override
  State<HomeScreen> createState() => HomeScreenState();
}

class HomeScreenState extends State<HomeScreen> {
  final Student _student = DummyDataRepository.getCurrentStudent();
  final List<ExamSchedule> _todaySchedules =
  DummyDataRepository.getTodaySchedules();
  Set<String> _completedIds = <String>{};

  @override
  void initState() {
    super.initState();
    reloadCompletedIds();
  }

  /// Publik (dipanggil dari luar lewat GlobalKey<HomeScreenState> di
  /// AppShell) supaya HomeScreen bisa di-refresh dari tab lain, mis.
  /// setelah tombol Refresh di ScheduleScreen ditekan.
  Future<void> reloadCompletedIds() async {
    final ids = await ExamProgressStore.getCompletedExamIds();
    if (!mounted) return;
    setState(() => _completedIds = ids);
  }

  Future<void> _openExam(ExamSchedule schedule) async {
    // Langkah 1: minta Token Ujian (kode unik per sesi, di-generate
    // backend via schema.prisma — lihat ExamTokenRepository). Murid bisa
    // membatalkan di sini tanpa konsekuensi apa pun.
    final tokenValid = await ExamTokenDialog.show(
      context,
      examId: schedule.id,
      subjectName: schedule.subjectName,
    );
    if (tokenValid != true) return;
    if (!mounted) return;

    // Langkah 2: masuk ke ValidationScreen (layar putih + loading) untuk
    // proses screen pinning awal, BUKAN langsung ke ExamPlayerScreen.
    // Lihat Hero Exam PRD Addendum Bagian 43 untuk alasan teknis lengkap
    // (isolasi observer, tirai penutup soal, tempat steril cek izin).
    final result = await Navigator.of(context).push<bool>(
      MaterialPageRoute(
        builder: (_) => ValidationScreen(
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
      await reloadCompletedIds();
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.background,
      body: Column(
        children: [
          _HomeHeader(onRefreshComplete: reloadCompletedIds),
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
                  // ===== Greeting + tanggal + ringkasan ujian hari ini =====
                  _TodaySummaryBar(
                    total: _todaySchedules.length,
                    completed: _todaySchedules
                        .where((s) => _completedIds.contains(s.id))
                        .length,
                  ),
                  // ===== SCROLLABLE: daftar Exam Card, area sendiri =====
                  Expanded(
                    child: _todaySchedules.isEmpty
                        ? const _EmptyTodayState()
                        : ListView.separated(
                      padding: const EdgeInsets.fromLTRB(24, 4, 24, 16),
                      itemCount: _todaySchedules.length,
                      separatorBuilder: (context, index) =>
                      const SizedBox(height: 16),
                      itemBuilder: (context, index) {
                        final schedule = _todaySchedules[index];
                        final isCompleted =
                        _completedIds.contains(schedule.id);
                        return FadeInItem(
                          index: index,
                          child: ExamCard(
                            schedule: schedule,
                            isCompleted: isCompleted,
                            onStartExam: () => _openExam(schedule),
                          ),
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

/// Header Home Screen — sebelumnya AppHeader generik, sekarang punya
/// versi khusus Home yang menyertakan HeaderStatusActions (jam + WiFi +
/// Data) dan RefreshScheduleButton di bawah garis emas, identik secara
/// fungsi dengan _ScheduleHeader di ScheduleScreen supaya konsisten di
/// kedua tab.
class _HomeHeader extends StatelessWidget {
  final VoidCallback? onRefreshComplete;

  const _HomeHeader({this.onRefreshComplete});

  @override
  Widget build(BuildContext context) {
    return Container(
      color: AppColors.background,
      child: SafeArea(
        bottom: false,
        child: Column(
          children: [
            Padding(
              padding: const EdgeInsets.fromLTRB(24, 16, 24, 0),
              child: Row(
                children: [
                  const _AppLogo(size: 36),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Text('EXAM-PONCOL', style: AppTypography.appTitle),
                  ),
                  const HeaderStatusActions(),
                ],
              ),
            ),
            const SizedBox(height: 16),
            Container(height: 1, color: AppColors.accentGold),
            Padding(
              padding: const EdgeInsets.fromLTRB(24, 8, 24, 0),
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
    return Container(
      width: double.infinity,
      color: AppColors.background,
      padding: const EdgeInsets.fromLTRB(24, 12, 24, 24),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.center,
        children: [
          // Avatar dengan ring putih tipis — accent halus yang membingkai
          // inisial agar tidak terlihat "telanjang". Mengikuti bentuk kotak
          // AvatarBadge (radius 8), bukan lingkaran.
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
                  style: AppTypography.studentName,
                  overflow: TextOverflow.ellipsis,
                ),
                const SizedBox(height: 8),
                // NISN & kelas dipecah jadi dua chip kecil agar lebih
                // terstruktur & kebaca, bukan teks gabung dengan titik.
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
          // Status badge kanan — titik hijau + "Siap" mengisi ruang kosong
          // dan senada tema device-verified yang sudah ada di app.
          const _ReadyBadge(),
        ],
      ),
    );
  }
}

/// Chip kecil berisi ikon + teks (dipakai untuk NISN & kelas).
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

/// Indikator status siap — ikon polos kecil (BUKAN pill/badge dengan teks),
/// konsisten dengan gaya ikon kecil yang sudah dipakai di subtitle header
/// Schedule (Icons.calendar_today_rounded) dan History
/// (Icons.verified_outlined).
class _ReadyBadge extends StatelessWidget {
  const _ReadyBadge();

  @override
  Widget build(BuildContext context) {
    return Icon(
      Icons.verified_rounded,
      size: 20,
      color: AppColors.online,
    );
  }
}

class _TodaySummaryBar extends StatelessWidget {
  final int total;
  final int completed;

  const _TodaySummaryBar({required this.total, required this.completed});

  @override
  Widget build(BuildContext context) {
    // Ringkasan satu baris: sapaan + tanggal di kiri, status ujian di kanan.
    // Sengaja dibuat tipis & tidak ramai (clean), sekadar memberi konteks
    // cepat dan mengisi ruang yang sebelumnya kosong.
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