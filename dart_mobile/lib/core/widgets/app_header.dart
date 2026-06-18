import 'package:flutter/material.dart';
import '../theme/app_colors.dart';
import '../theme/app_typography.dart';

/// Header/AppBar standar yang dipakai di Home & Schedule Screen.
///
/// Sesuai DESIGN_SYSTEM.md Section 5 — AppBar / Header:
/// - Background colorBackground
/// - Logo di kiri, tinggi 36px
/// - Title "EXAM PONCOL" textAppTitle, letter spacing 4px
/// - Divider bawah header 1px colorAccentGold
class AppHeader extends StatelessWidget {
  const AppHeader({super.key});

  @override
  Widget build(BuildContext context) {
    return Container(
      color: AppColors.background,
      child: SafeArea(
        bottom: false,
        child: Column(
          children: [
            Padding(
              padding: const EdgeInsets.symmetric(
                horizontal: 24,
                vertical: 16,
              ),
              child: Row(
                children: [
                  const _AppLogo(size: 36),
                  const SizedBox(width: 12),
                  Text('EXAM-PONCOL', style: AppTypography.appTitle),
                ],
              ),
            ),
            Container(height: 1, color: AppColors.accentGold),
          ],
        ),
      ),
    );
  }
}

/// Logo shield SMK Poncol. Memakai asset PNG jika tersedia di
/// `assets/images/logo_poncol.png`, dengan fallback ke ikon shield buatan
/// (CustomPaint sederhana) supaya layar tidak pernah blank jika asset belum
/// diisi oleh tim desain.
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
          return _LogoFallback(size: size);
        },
      ),
    );
  }
}

class _LogoFallback extends StatelessWidget {
  final double size;

  const _LogoFallback({required this.size});

  @override
  Widget build(BuildContext context) {
    return Container(
      width: size,
      height: size,
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
  }
}
