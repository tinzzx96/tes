import 'package:flutter/material.dart';
import '../../core/models/exam_history_entry.dart';
import '../../core/theme/app_colors.dart';
import '../../core/theme/app_typography.dart';
import '../../core/utils/exam_history_repository.dart';
import '../../core/utils/greeting_helper.dart';
import '../../core/widgets/fade_in_item.dart';
import '../../core/widgets/header_status_actions.dart';
import '../../core/widgets/history_card.dart';

/// History Screen — Layar Riwayat Ujian.
///
/// Sesuai Hero Exam PRD Addendum Bagian 40.B:
/// - Sumber data: ExamHistoryRepository.fetchHistory() (simulasi Result
///   API GET /api/v1/exam-attempts/history) — BUKAN local storage.
/// - Jaminan sistem: data tetap utuh meski app di-uninstall/ganti
///   perangkat, karena tidak ada penyimpanan lokal yang dipakai sama
///   sekali di layar ini.
/// - Layout: Grouped History Cards, dikelompokkan dengan header
///   "Hari - Tanggal" (mis. "Selasa - 17 Juni 2026"), kartu mata pelajaran
///   di bawah tiap header sesuai tanggal submit-nya.
class HistoryScreen extends StatefulWidget {
  const HistoryScreen({super.key});

  @override
  State<HistoryScreen> createState() => HistoryScreenState();
}

class HistoryScreenState extends State<HistoryScreen> {
  late Future<List<ExamHistoryEntry>> _futureHistory;

  @override
  void initState() {
    super.initState();
    _futureHistory = ExamHistoryRepository.fetchHistory();
  }

  /// Publik — dipanggil dari AppShell saat tab History baru saja dibuka,
  /// supaya riwayat selalu menampilkan data terbaru dari server (mis.
  /// setelah murid baru saja submit ujian lain).
  Future<void> reload() async {
    setState(() {
      _futureHistory = ExamHistoryRepository.fetchHistory();
    });
    await _futureHistory;
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.background,
      body: Column(
        children: [
          const _HistoryHeader(),
          Expanded(
            child: Container(
              color: const Color(0xFFE8E8E8),
              child: RefreshIndicator(
                color: AppColors.primary,
                onRefresh: reload,
                child: FutureBuilder<List<ExamHistoryEntry>>(
                  future: _futureHistory,
                  builder: (context, snapshot) {
                    if (snapshot.connectionState == ConnectionState.waiting) {
                      return const _LoadingState();
                    }
                    if (snapshot.hasError) {
                      return _ErrorState(onRetry: reload);
                    }
                    final entries = snapshot.data ?? const [];
                    if (entries.isEmpty) {
                      return const _EmptyHistoryState();
                    }
                    return _GroupedHistoryList(entries: entries);
                  },
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _HistoryHeader extends StatelessWidget {
  const _HistoryHeader();

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
                  const HeaderStatusActions(),
                ],
              ),
            ),
            const SizedBox(height: 16),
            Container(height: 1, color: AppColors.accentGold),
            Padding(
              padding: const EdgeInsets.fromLTRB(24, 20, 24, 24),
              child: Stack(
                children: [
                  Positioned(
                    right: -4,
                    top: -2,
                    child: Icon(
                      Icons.history_rounded,
                      size: 64,
                      color: Colors.white.withOpacity(0.04),
                    ),
                  ),
                  Row(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
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
                          Text('EXAM HISTORY', style: AppTypography.pageTitle),
                          const SizedBox(height: 5),
                          Row(
                            mainAxisSize: MainAxisSize.min,
                            children: [
                              Icon(Icons.verified_outlined,
                                  size: 12, color: AppColors.textSecondary),
                              const SizedBox(width: 6),
                              Text(
                                'RIWAYAT UJIAN PERMANEN ANDA',
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

/// Daftar riwayat dikelompokkan per tanggal submit, header format
/// "Hari - Tanggal" sesuai PRD Addendum Bagian 40.B.
class _GroupedHistoryList extends StatelessWidget {
  final List<ExamHistoryEntry> entries;

  const _GroupedHistoryList({required this.entries});

  Map<String, List<ExamHistoryEntry>> _groupByDate() {
    final Map<String, List<ExamHistoryEntry>> grouped = {};
    for (final e in entries) {
      final key = GreetingHelper.dashDate(e.submittedAt);
      grouped.putIfAbsent(key, () => []).add(e);
    }
    return grouped;
  }

  @override
  Widget build(BuildContext context) {
    final grouped = _groupByDate();
    final List<Widget> children = [];
    int animIndex = 0;

    grouped.forEach((dateLabel, items) {
      children.add(_DateHeader(label: dateLabel, count: items.length));
      for (final entry in items) {
        children.add(
          Padding(
            padding: const EdgeInsets.only(bottom: 12),
            child: FadeInItem(
              index: animIndex++,
              child: HistoryCard(entry: entry),
            ),
          ),
        );
      }
    });

    return ListView(
      padding: const EdgeInsets.fromLTRB(24, 20, 24, 16),
      physics: const AlwaysScrollableScrollPhysics(),
      children: children,
    );
  }
}

class _DateHeader extends StatelessWidget {
  final String label;
  final int count;

  const _DateHeader({required this.label, required this.count});

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

class _LoadingState extends StatelessWidget {
  const _LoadingState();

  @override
  Widget build(BuildContext context) {
    return ListView(
      physics: const AlwaysScrollableScrollPhysics(),
      children: [
        SizedBox(
          height: MediaQuery.of(context).size.height * 0.5,
          child: Center(
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                const CircularProgressIndicator(color: AppColors.primary),
                const SizedBox(height: 16),
                Text(
                  'Memuat riwayat ujian...',
                  style: AppTypography.cardMeta
                      .copyWith(color: AppColors.textMuted),
                ),
              ],
            ),
          ),
        ),
      ],
    );
  }
}

class _EmptyHistoryState extends StatelessWidget {
  const _EmptyHistoryState();

  @override
  Widget build(BuildContext context) {
    return ListView(
      physics: const AlwaysScrollableScrollPhysics(),
      children: [
        SizedBox(
          height: MediaQuery.of(context).size.height * 0.55,
          child: Center(
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                const Icon(Icons.history_toggle_off_rounded,
                    size: 40, color: AppColors.textMuted),
                const SizedBox(height: 12),
                Text(
                  'Belum ada riwayat ujian',
                  style: AppTypography.cardMeta
                      .copyWith(color: AppColors.textMuted),
                ),
              ],
            ),
          ),
        ),
      ],
    );
  }
}

class _ErrorState extends StatelessWidget {
  final Future<void> Function() onRetry;

  const _ErrorState({required this.onRetry});

  @override
  Widget build(BuildContext context) {
    return ListView(
      physics: const AlwaysScrollableScrollPhysics(),
      children: [
        SizedBox(
          height: MediaQuery.of(context).size.height * 0.55,
          child: Center(
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                const Icon(Icons.cloud_off_rounded,
                    size: 40, color: AppColors.textMuted),
                const SizedBox(height: 12),
                Text(
                  'Gagal memuat riwayat. Periksa koneksi internet Anda.',
                  textAlign: TextAlign.center,
                  style: AppTypography.cardMeta
                      .copyWith(color: AppColors.textMuted),
                ),
                const SizedBox(height: 12),
                TextButton(
                  onPressed: onRetry,
                  child: Text(
                    'Coba Lagi',
                    style: AppTypography.cardMeta.copyWith(
                      color: AppColors.primary,
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                ),
              ],
            ),
          ),
        ),
      ],
    );
  }
}