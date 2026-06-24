import 'package:flutter/material.dart';
import '../theme/app_colors.dart';
import '../theme/app_radius.dart';
import '../theme/app_typography.dart';

/// Warning Banner — dipakai di Login Screen.
///
/// Sesuai DESIGN_SYSTEM.md Section 5 — Warning Banner:
/// - Background colorWarningBg, border 1px colorWarningBorder, radius 6
/// - Icon segitiga warning, text textWarning, padding 12 semua sisi
class WarningBanner extends StatelessWidget {
  final String message;

  const WarningBanner({super.key, required this.message});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: AppColors.warningBg,
        borderRadius: BorderRadius.circular(AppRadius.warning),
        border: Border.all(color: AppColors.warningBorder),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Icon(
            Icons.warning_amber_rounded,
            size: 20,
            color: AppColors.warningText,
          ),
          const SizedBox(width: 10),
          Expanded(
            child: Text(message, style: AppTypography.warning),
          ),
        ],
      ),
    );
  }
}
