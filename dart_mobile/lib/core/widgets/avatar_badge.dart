import 'package:flutter/material.dart';
import '../theme/app_colors.dart';
import '../theme/app_radius.dart';
import '../theme/app_typography.dart';

/// Avatar / Inisial Badge — kotak 56x56 dengan inisial nama siswa.
///
/// Sesuai DESIGN_SYSTEM.md Section 5 — Avatar / Inisial Badge:
/// - Ukuran 56x56, background colorAvatarBg, border 2px colorAvatarBorder
/// - Border radius 8 (radiusAvatar)
class AvatarBadge extends StatelessWidget {
  final String initials;
  final double size;

  const AvatarBadge({super.key, required this.initials, this.size = 56});

  @override
  Widget build(BuildContext context) {
    return Container(
      width: size,
      height: size,
      decoration: BoxDecoration(
        color: AppColors.avatarBg,
        borderRadius: BorderRadius.circular(AppRadius.avatar),
        border: Border.all(color: AppColors.avatarBorder, width: 2),
      ),
      alignment: Alignment.center,
      child: Text(
        initials,
        style: AppTypography.studentName.copyWith(
          color: AppColors.avatarText,
          fontSize: size * 0.32,
        ),
      ),
    );
  }
}
