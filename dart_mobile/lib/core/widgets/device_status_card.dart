import 'package:flutter/material.dart';
import '../models/student.dart';
import '../theme/app_colors.dart';
import '../theme/app_radius.dart';
import '../theme/app_typography.dart';

/// Device Status Card — bagian atas Home Screen yang TIDAK ikut ter-scroll
/// bersama daftar Exam Card di bawahnya (lihat HomeScreen untuk layout).
///
/// Sesuai DESIGN_SYSTEM.md Section 5 — Device Status Card:
/// - Background colorSurfaceLight, radius 12
/// - Label (Device, Room, Network, Session) pakai labelCaps mute
/// - Value pakai cardTitle bold dark
/// - Footer ikon device-check + status "Perangkat Terverifikasi"
///
/// CATATAN PERUBAHAN TEKS FOOTER: sebelumnya footer bertuliskan "Screen
/// sharing active · Proctor visibility: ON". Teks itu DIHAPUS karena
/// bertentangan langsung dengan filosofi Hero Exam PRD Section 2 ("PREVENT
/// CHEATING — bukan DETECT CHEATING... bukan melalui pengawasan invasif
/// berbasis AI, kamera, atau analisis perilaku") dan Section 33 yang
/// eksplisit menolak "Webcam Monitoring"/"Behavior Analysis" sebagai
/// "Invasif, tidak selaras filosofi". App ini TIDAK punya fitur live
/// screen-sharing/human-proctor-watching sungguhan — istilah lama itu
/// menciptakan ekspektasi salah & terasa mengintimidasi. Footer sekarang
/// menyatakan apa yang SUNGGUHAN dilakukan sistem: verifikasi device,
/// bukan pengawasan real-time.
class DeviceStatusCard extends StatelessWidget {
  final Student student;

  const DeviceStatusCard({super.key, required this.student});

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: AppColors.surfaceLight,
        borderRadius: BorderRadius.circular(AppRadius.card),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            'DEVICE STATUS',
            style: AppTypography.labelCaps.copyWith(color: AppColors.textMuted),
          ),
          const SizedBox(height: 16),
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Expanded(
                child: _StatusItem(label: 'Device', value: student.deviceName),
              ),
              Expanded(
                child: _StatusItem(label: 'Room', value: student.roomName),
              ),
            ],
          ),
          const SizedBox(height: 16),
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Expanded(
                child: _StatusItem(
                  label: 'Network',
                  value: student.networkName,
                ),
              ),
              Expanded(
                child: _StatusItem(
                  label: 'Session',
                  value: student.sessionActive ? 'Active' : 'Inactive',
                  valueColor: student.sessionActive
                      ? AppColors.textDark
                      : AppColors.textMuted,
                ),
              ),
            ],
          ),
          const SizedBox(height: 12),
          Container(height: 1, color: AppColors.divider.withOpacity(0.15)),
          const SizedBox(height: 12),
          Row(
            children: [
              const Icon(
                Icons.verified_user_outlined,
                size: 16,
                color: AppColors.textMuted,
              ),
              const SizedBox(width: 8),
              Expanded(
                child: Text(
                  'Perangkat Terverifikasi',
                  style: AppTypography.cardMeta.copyWith(fontSize: 12),
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }
}

class _StatusItem extends StatelessWidget {
  final String label;
  final String value;
  final Color? valueColor;

  const _StatusItem({
    required this.label,
    required this.value,
    this.valueColor,
  });

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          label,
          style: AppTypography.cardMeta.copyWith(color: AppColors.textMuted),
        ),
        const SizedBox(height: 4),
        Text(
          value,
          style: AppTypography.cardTitle.copyWith(
            fontSize: 15,
            color: valueColor ?? AppColors.textDark,
          ),
        ),
      ],
    );
  }
}