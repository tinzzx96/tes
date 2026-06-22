import 'package:flutter/material.dart';
import '../../core/models/exam_schedule.dart';
import '../../core/theme/app_colors.dart';
import '../../core/theme/app_typography.dart';
import '../../core/utils/dummy_data_repository.dart';
import '../../core/widgets/fade_in_item.dart';
import '../../core/widgets/header_status_actions.dart';
import '../../core/widgets/schedule_card.dart';

/// Schedule Screen — sesuai mockup Frame 3.
///
/// Layout: header "EXAM SCHEDULE" tetap berada di area gelap atas (tidak
/// di-scroll), lalu daftar ScheduleCard di area abu-abu bawah memiliki
/// scroll-nya sendiri (`Expanded` + `ListView`) sehingga bisa menampilkan
/// banyak jadwal (3, 4, atau lebih mapel) tanpa masalah, persis seperti
/// behaviour scroll yang diminta di Home Screen.
///
/// CATATAN INTEGRASI BACKEND (sesuai arahan): jadwal yang tampil di sini
/// HARUS berbeda per kelas siswa yang sedang login. Saat ini masih memakai
/// DummyDataRepository.getUpcomingSchedules() (data statis untuk semua
/// siswa). Saat backend siap, ganti pemanggilan itu dengan, misalnya:
///
///   final schedules = await ExamApi.getWeeklySchedule(
///     classLabel: currentStudent.classLabel, // contoh: "X RPL 1"
///   );
///
/// CATATAN BUG FIX (centang hijau tidak reset): tombol Refresh di sini
/// HANYA me-reset data milik ScheduleScreen sendiri. Karena AppShell
/// memakai IndexedStack, HomeScreen adalah instance State terpisah yang
/// TIDAK otomatis tahu ExamProgressStore berubah. Lihat AppShell untuk
/// mekanisme yang menyalakan reload di kedua screen sekaligus.
class ScheduleScreen extends StatefulWidget {
  /// Dipanggil setiap kali tombol Refresh di header ditekan dan selesai,
  /// supaya AppShell (induk) bisa memberi tahu HomeScreen untuk reload
  /// _completedIds miliknya juga — lihat AppShell.
  final VoidCallback? onGlobalRefresh;

  const ScheduleScreen({super.key, this.onGlobalRefresh});

  @override
  State<ScheduleScreen> createState() => _ScheduleScreenState();
}

class _ScheduleScreenState extends State<ScheduleScreen> {
  List<ExamSchedule> _schedules = DummyDataRepository.getUpcomingSchedules();

  void _handleRefreshComplete() {
    // TODO: Hapus fungsi bypass ini saat rilis Production
    setState(() {
      _schedules = DummyDataRepository.getUpcomingSchedules();
    });
    // Beri tahu AppShell supaya HomeScreen ikut reload status completed-nya
    // sendiri — tanpa ini, centang hijau di Home tidak akan hilang
    // meskipun data di shared_preferences sudah direset di sini.
    widget.onGlobalRefresh?.call();
  }

  @override
  Widget build(BuildContext context) {
    final now = DateTime.now();

    return Scaffold(
      backgroundColor: AppColors.background,
      body: Column(
        children: [
          _ScheduleHeader(onRefreshComplete: _handleRefreshComplete),
          Expanded(
            child: Container(
              color: const Color(0xFFE8E8E8),
              child: _schedules.isEmpty
                  ? const _EmptyScheduleState()
                  : _GroupedScheduleList(schedules: _schedules, now: now),
            ),
          ),
        ],
      ),
    );
  }
}

/// Menampilkan jadwal yang dikelompokkan ke section "Hari Ini", "Besok",
/// dan "Minggu Ini", masing-masing dengan header kecil. Memberi konteks
/// waktu yang sebelumnya tidak ada (daftar dulu rata tanpa pemisah).
class _GroupedScheduleList extends StatelessWidget {
  final List<ExamSchedule> schedules;
  final DateTime now;

  const _GroupedScheduleList({required this.schedules, required this.now});

  /// Mengelompokkan jadwal berdasarkan selisih hari dari hari ini.
  Map<String, List<ExamSchedule>> _grouped() {
    final today = DateTime(now.year, now.month, now.day);
    final result = <String, List<ExamSchedule>>{
      'Hari Ini': [],
      'Besok': [],
      'Minggu Ini': [],
      'Mendatang': [],
    };

    for (final s in schedules) {
      final d = DateTime(s.startTime.year, s.startTime.month, s.startTime.day);
      final diff = d.difference(today).inDays;
      if (diff <= 0) {
        result['Hari Ini']!.add(s);
      } else if (diff == 1) {
        result['Besok']!.add(s);
      } else if (diff <= 7) {
        result['Minggu Ini']!.add(s);
      } else {
        result['Mendatang']!.add(s);
      }
    }
    // Buang grup kosong.
    result.removeWhere((key, value) => value.isEmpty);
    return result;
  }

  @override
  Widget build(BuildContext context) {
    final groups = _grouped();

    // Bangun daftar widget berurutan: header grup, lalu kartu-kartunya.
    final List<Widget> children = [];
    int animIndex = 0;
    groups.forEach((label, items) {
      children.add(_SectionHeader(label: label, count: items.length));
      for (final s in items) {
        children.add(
          Padding(
            padding: const EdgeInsets.only(bottom: 16),
            child: FadeInItem(
              index: animIndex++,
              child: ScheduleCard(schedule: s, isToday: s.isToday(now)),
            ),
          ),
        );
      }
    });

    return ListView(
      padding: const EdgeInsets.fromLTRB(24, 20, 24, 16),
      children: children,
    );
  }
}

/// Header kecil pemisah antar grup waktu (mis. "HARI INI · 3").
class _SectionHeader extends StatelessWidget {
  final String label;
  final int count;

  const _SectionHeader({required this.label, required this.count});

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 12, top: 4),
      child: Row(
        children: [
          Text(
            label.toUpperCase(),
            style: AppTypography.labelCaps.copyWith(
              color: AppColors.textDark,
              fontSize: 12,
              fontWeight: FontWeight.w700,
            ),
          ),
          const SizedBox(width: 8),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 1),
            decoration: BoxDecoration(
              color: AppColors.primary.withOpacity(0.12),
              borderRadius: BorderRadius.circular(10),
            ),
            child: Text(
              '$count',
              style: AppTypography.cardMeta.copyWith(
                color: AppColors.primary,
                fontSize: 11,
                fontWeight: FontWeight.w700,
              ),
            ),
          ),
          const SizedBox(width: 10),
          Expanded(
            child: Container(height: 1, color: Colors.black.withOpacity(0.08)),
          ),
        ],
      ),
    );
  }
}

class _ScheduleHeader extends StatelessWidget {
  final VoidCallback? onRefreshComplete;

  const _ScheduleHeader({this.onRefreshComplete});

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
                  Expanded(
                    child: Text('EXAM-PONCOL', style: AppTypography.appTitle),
                  ),
                  // ── Jam digital + indikator WiFi/Data, mengisi ruang
                  // kosong di kanan header.
                  const HeaderStatusActions(),
                ],
              ),
            ),
            const SizedBox(height: 16),
            Container(height: 1, color: AppColors.accentGold),
            // ── Tombol Refresh, DI BAWAH garis kuning, rata kanan ──────
            Padding(
              padding: const EdgeInsets.fromLTRB(24, 8, 24, 0),
              child: Align(
                alignment: Alignment.centerRight,
                child: RefreshScheduleButton(
                  onRefreshComplete: onRefreshComplete,
                ),
              ),
            ),
            Padding(
              padding: const EdgeInsets.fromLTRB(24, 4, 24, 24),
              child: Stack(
                children: [
                  // Ikon kalender besar samar di kanan sebagai latar
                  // dekoratif — mengisi ruang kosong tanpa menambah teks.
                  Positioned(
                    right: -4,
                    top: -2,
                    child: Icon(
                      Icons.event_note_rounded,
                      size: 64,
                      color: Colors.white.withOpacity(0.04),
                    ),
                  ),
                  Row(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      // Garis aksen vertikal putih di kiri judul.
                      Container(
                        width: 3,
                        height: 44,
                        margin: const EdgeInsets.only(right: 12, top: 2),
                        decoration: BoxDecoration(
                          color: Colors.white.withOpacity(0.85),
                          borderRadius: BorderRadius.circular(2),
                        ),
                      ),
                      Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text('EXAM SCHEDULE', style: AppTypography.pageTitle),
                          const SizedBox(height: 5),
                          Row(
                            mainAxisSize: MainAxisSize.min,
                            children: [
                              Icon(
                                Icons.calendar_today_rounded,
                                size: 12,
                                color: AppColors.textSecondary,
                              ),
                              const SizedBox(width: 6),
                              Text(
                                'JADWAL ULANGAN KELAS ANDA',
                                style: AppTypography.pageSubtitle,
                              ),
                            ],
                          ),
                        ],
                      ),
                    ],
                  ),
                ],
              ),
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