import 'dart:async';
import 'package:flutter/material.dart';
import '../../core/theme/app_colors.dart';
import '../../core/theme/app_typography.dart';
import '../../core/utils/security_guard.dart';
import 'exam_player_screen.dart';

/// Halaman Validasi Awal — layar transisi berlatar putih kosong dengan
/// indikator loading, ditampilkan SEBELUM murid masuk ke ExamPlayerScreen.
///
/// Sesuai Hero Exam PRD Addendum Bagian 43, layar ini menjadi tempat
/// SATU-SATUNYA proses screen pinning awal berlangsung — terisolasi penuh
/// dari ExamPlayerScreen — dengan tiga alasan teknis:
///
/// 1. Dialog konfirmasi sistem Android ("Pasang layar ini?") bersifat
///    asynchronous — perlu beberapa detik sampai murid menyentuh tombol
///    konfirmasi. Selama itu, layar putih KOSONG ini berfungsi sebagai
///    tirai penutup, sehingga TIDAK ADA kemungkinan murid mengintip soal
///    di baliknya sebelum isScreenPinned() benar-benar bernilai true.
/// 2. WidgetsBindingObserver/EventChannel di ExamPlayerScreen TIDAK PERNAH
///    aktif selama proses ini, karena observer tersebut baru dipasang saat
///    ExamPlayerScreen di-mount — popup konfirmasi sistem yang menggoyang
///    fokus window TIDAK BISA disalahartikan sebagai floating app, karena
///    observer ujian belum ada yang mendengarkan sama sekali di titik ini.
/// 3. Pengecekan izin Usage Access (Sinyal 3 deteksi floating app pihak
///    ketiga) dilakukan di sini — tempat paling steril, tanpa mengotori
///    ExamPlayerScreen dengan logic permission yang sebenarnya hanya
///    relevan sekali di awal sesi.
///
/// Alur:
///   MENERIMA dialog pinning -> lanjut otomatis ke ExamPlayerScreen.
///   MENOLAK / timeout -> kembali (pop) ke Home dengan pesan, TANPA
///   menaikkan counter pelanggaran (lihat catatan di _handleResult).
class ValidationScreen extends StatefulWidget {
  final String examId;
  final String subjectName;
  final String teacherName;

  const ValidationScreen({
    super.key,
    required this.examId,
    required this.subjectName,
    required this.teacherName,
  });

  @override
  State<ValidationScreen> createState() => _ValidationScreenState();
}

class _ValidationScreenState extends State<ValidationScreen> {
  static const Duration _kPinningTimeout = Duration(seconds: 30);

  String _statusLabel = 'Menyiapkan sesi ujian...';

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) => _runValidation());
  }

  Future<void> _runValidation() async {
    // Langkah 1: aktifkan proteksi layar & immersive sejak awal, sebelum
    // konten apa pun (termasuk layar putih ini sendiri) berisiko terekam.
    await SecurityGuard.enableWakelock();
    await SecurityGuard.enterImmersiveMode();
    await SecurityGuard.lockUi();

    // Langkah 2: cek izin Usage Access (Sinyal 3, PRD Bagian 36 & 43).
    // Tempat paling steril untuk pengecekan ini — tidak mengotori
    // ExamPlayerScreen dengan logic permission yang hanya relevan sekali.
    if (!mounted) return;
    setState(() => _statusLabel = 'Memeriksa izin sistem...');
    final hasUsagePermission =
        await SecurityGuard.hasUsageStatsPermission().catchError((_) => false);

    if (!hasUsagePermission && mounted) {
      final proceed = await _showUsageAccessPrompt();
      if (!mounted) return;
      if (!proceed) {
        _handleResult(success: false, message: 'Validasi dibatalkan.');
        return;
      }
    }

    // Langkah 3: mulai proses screen pinning, isolasi penuh dari
    // ExamPlayerScreen. Dialog konfirmasi sistem Android akan muncul DI
    // ATAS layar putih ini, bukan di atas lembar soal.
    if (!mounted) return;
    setState(() => _statusLabel = 'Menyematkan layar ujian...');
    await SecurityGuard.startLockTask();

    // Poll cepat (300ms) sampai isScreenPinned() benar-benar true, atau
    // sampai timeout (murid menolak/mengabaikan dialog konfirmasi).
    final stopwatch = Stopwatch()..start();
    while (mounted) {
      final pinned = await SecurityGuard.isScreenPinned().catchError((_) => false);
      if (pinned) {
        _handleResult(success: true, message: '');
        return;
      }
      if (stopwatch.elapsed >= _kPinningTimeout) {
        _handleResult(
          success: false,
          message: 'Penyematan layar dibatalkan. Coba lagi untuk memulai ujian.',
        );
        return;
      }
      await Future.delayed(const Duration(milliseconds: 300));
    }
  }

  Future<bool> _showUsageAccessPrompt() async {
    final result = await showDialog<bool>(
      context: context,
      barrierDismissible: false,
      builder: (ctx) => AlertDialog(
        backgroundColor: AppColors.surface,
        title: Text('Izin Tambahan Diperlukan',
            style: AppTypography.cardTitle.copyWith(color: AppColors.textPrimary)),
        content: Text(
          'Aktifkan izin "Akses Penggunaan" agar sistem dapat mendeteksi '
          'aplikasi lain yang berjalan di atas layar ujian. Tekan AKTIFKAN, '
          'lalu kembali ke aplikasi ini setelah mengaktifkan.',
          style: AppTypography.cardMeta.copyWith(color: AppColors.textSecondary, height: 1.4),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(ctx).pop(false),
            child: Text('Lewati', style: AppTypography.cardMeta.copyWith(color: AppColors.textSecondary)),
          ),
          ElevatedButton(
            onPressed: () async {
              await SecurityGuard.openUsageAccessSettings();
              if (ctx.mounted) Navigator.of(ctx).pop(true);
            },
            style: ElevatedButton.styleFrom(
              backgroundColor: AppColors.primary,
              foregroundColor: AppColors.textPrimary,
            ),
            child: Text('AKTIFKAN', style: AppTypography.buttonPrimary.copyWith(fontSize: 13)),
          ),
        ],
      ),
    );
    return result ?? false;
  }

  Future<void> _handleResult({required bool success, required String message}) async {
    if (!mounted) return;
    if (success) {
      // PENTING: gunakan push() biasa (BUKAN pushReplacement), lalu pop()
      // ValidationScreen dengan hasil yang SAMA setelah ExamPlayerScreen
      // benar-benar kembali (submit/selesai). pushReplacement akan
      // langsung menyelesaikan Future yang ditunggu pemanggil (Home) saat
      // itu juga dengan null — BUKAN menunggu hasil submit ujian yang
      // sebenarnya — sehingga status "centang hijau" di Home tidak pernah
      // ter-refresh dengan benar. push() biasa menjaga rantai Future tetap
      // utuh dari Home -> ValidationScreen -> ExamPlayerScreen.
      final examResult = await Navigator.of(context).push<bool>(
        MaterialPageRoute(
          builder: (_) => ExamPlayerScreen(
            examId: widget.examId,
            subjectName: widget.subjectName,
            teacherName: widget.teacherName,
          ),
        ),
      );
      if (!mounted) return;
      Navigator.of(context).pop(examResult);
    } else {
      // PENTING: penolakan/timeout DI SINI tidak pernah menaikkan counter
      // pelanggaran. Counter pelanggaran HANYA berlaku untuk pelanggaran
      // yang terjadi SETELAH ExamPlayerScreen aktif (lihat PRD Addendum
      // Bagian 43, "Ketentuan Krusial"). Murid langsung dikembalikan ke
      // Home tanpa hukuman apa pun.
      SecurityGuard.exitImmersiveMode();
      SecurityGuard.unlockUi();
      SecurityGuard.disableWakelock();
      Navigator.of(context).pop();
      if (message.isNotEmpty) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(message)),
        );
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    // Layar putih kosong + loading — tirai penutup selama proses pinning
    // berlangsung, mencegah murid mengintip apa pun di baliknya (lihat
    // alasan teknis #1 di dokumentasi class ini).
    return PopScope(
      canPop: false,
      child: Scaffold(
        backgroundColor: Colors.white,
        body: Center(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              const CircularProgressIndicator(
                color: AppColors.primary,
                strokeWidth: 2.5,
              ),
              const SizedBox(height: 20),
              Text(
                _statusLabel,
                style: AppTypography.cardMeta.copyWith(
                  color: AppColors.textMuted,
                  fontSize: 12,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}