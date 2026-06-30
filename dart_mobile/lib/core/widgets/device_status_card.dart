import 'package:flutter/material.dart';
import '../models/student.dart';
import '../theme/app_colors.dart';
import '../theme/app_radius.dart';
import '../theme/app_typography.dart';

/// Device Status Card — bagian atas Home Screen yang TIDAK ikut ter-scroll
/// bersama daftar Exam Card di bawahnya (lihat HomeScreen untuk layout).
///
/// Sesuai PRD Bagian 38 — menampilkan status "Perangkat Terverifikasi" dengan
/// indikator HIJAU jika device_id siswa cocok dengan yang terdaftar di server,
/// atau status "Perangkat Tidak Terverifikasi" MERAH jika ada ketidakcocokan.
class DeviceStatusCard extends StatelessWidget {
  final Student student;

  const DeviceStatusCard({super.key, required this.student});

  @override
  Widget build(BuildContext context) {
    final isVerified = student.deviceVerified;
    final screenHeight = MediaQuery.of(context).size.height;
    final isSmallScreen = screenHeight < 720;

    return Container(
      width: double.infinity,
      padding: EdgeInsets.all(isSmallScreen ? 12 : 16),
      decoration: BoxDecoration(
        color: AppColors.surfaceLight,
        borderRadius: BorderRadius.circular(AppRadius.card),
        // Border hijau tipis jika terverifikasi
        border: Border.all(
          color: isVerified
              ? const Color(0xFF00AA55).withOpacity(0.4)
              : const Color(0xFFCC0000).withOpacity(0.35),
          width: 1,
        ),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            'DEVICE STATUS',
            style: AppTypography.labelCaps.copyWith(
              color: AppColors.textMuted,
              fontSize: isSmallScreen ? 10 : 11,
            ),
          ),
          SizedBox(height: isSmallScreen ? 10 : 16),
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Expanded(
                child: _StatusItem(
                  label: 'Device', 
                  value: student.deviceName,
                  isSmallScreen: isSmallScreen,
                ),
              ),
              Expanded(
                child: _StatusItem(
                  label: 'Room', 
                  value: student.roomName,
                  isSmallScreen: isSmallScreen,
                ),
              ),
            ],
          ),
          SizedBox(height: isSmallScreen ? 10 : 16),
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Expanded(
                child: _StatusItem(
                  label: 'Network',
                  value: student.networkName,
                  isSmallScreen: isSmallScreen,
                ),
              ),
              Expanded(
                child: _StatusItem(
                  label: 'Session',
                  value: student.sessionActive ? 'Active' : 'Inactive',
                  valueColor: student.sessionActive
                      ? AppColors.textDark
                      : AppColors.textMuted,
                  isSmallScreen: isSmallScreen,
                ),
              ),
            ],
          ),
          SizedBox(height: isSmallScreen ? 8 : 12),
          Container(height: 1, color: AppColors.divider.withOpacity(0.15)),
          SizedBox(height: isSmallScreen ? 8 : 12),
          // ── Status Verifikasi Perangkat (PRD Bagian 38) ──────────────────
          Row(
            children: [
              AnimatedSwitcher(
                duration: const Duration(milliseconds: 300),
                child: Icon(
                  isVerified ? Icons.verified_user : Icons.lock_person_outlined,
                  key: ValueKey(isVerified),
                  size: isSmallScreen ? 16 : 18,
                  color: isVerified
                      ? const Color(0xFF00AA55)
                      : const Color(0xFFCC0000),
                ),
              ),
              const SizedBox(width: 8),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    AnimatedSwitcher(
                      duration: const Duration(milliseconds: 300),
                      child: Text(
                        isVerified
                            ? 'Perangkat Terverifikasi'
                            : 'Perangkat Tidak Terverifikasi',
                        key: ValueKey(isVerified),
                        style: AppTypography.cardMeta.copyWith(
                          fontSize: isSmallScreen ? 11 : 12,
                          fontWeight: FontWeight.w700,
                          color: isVerified
                              ? const Color(0xFF00AA55)
                              : const Color(0xFFCC0000),
                        ),
                      ),
                    ),
                    if (!isVerified)
                      Padding(
                        padding: const EdgeInsets.only(top: 2),
                        child: Text(
                          'Hubungi pengawas untuk bantuan perangkat.',
                          style: AppTypography.caption.copyWith(
                            fontSize: isSmallScreen ? 9 : 10,
                            color: const Color(0xFF884444),
                          ),
                        ),
                      ),
                  ],
                ),
              ),
              // Dot indikator animasi (hanya tampil jika verified)
              if (isVerified)
                Container(
                  width: 8,
                  height: 8,
                  decoration: const BoxDecoration(
                    color: Color(0xFF00AA55),
                    shape: BoxShape.circle,
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
  final bool isSmallScreen;

  const _StatusItem({
    required this.label,
    required this.value,
    this.valueColor,
    this.isSmallScreen = false,
  });

  @override
  Widget build(BuildContext context) {
    final displayValue = value.trim().isEmpty ? '-' : value;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          label,
          style: AppTypography.cardMeta.copyWith(
            color: AppColors.textMuted,
            fontSize: isSmallScreen ? 10 : 11,
          ),
        ),
        const SizedBox(height: 4),
        Text(
          displayValue,
          style: AppTypography.cardTitle.copyWith(
            fontSize: isSmallScreen ? 13 : 15,
            color: valueColor ?? AppColors.textDark,
          ),
        ),
      ],
    );
  }
}