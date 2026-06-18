import 'package:flutter/material.dart';

/// Sumber kebenaran tunggal untuk seluruh warna di Exam Poncol.
/// Mengacu pada DESIGN_SYSTEM.md — Section 1: COLOR PALETTE.
/// JANGAN hardcode Color(0x...) di widget. Selalu pakai AppColors.xxx.
class AppColors {
  AppColors._();

  // ===== Primary Colors =====
  static const Color background = Color(0xFF1C1C1C);
  static const Color surface = Color(0xFF2A2A2A);
  static const Color surfaceLight = Color(0xFFF0F0F0);
  static const Color primary = Color(0xFFCC0000);
  static const Color primaryDark = Color(0xFF990000);
  static const Color accentGold = Color(0xFFC9A84C);

  // ===== Text Colors =====
  static const Color textPrimary = Color(0xFFFFFFFF);
  static const Color textSecondary = Color(0xFFAAAAAA);
  static const Color textDark = Color(0xFF1C1C1C);
  static const Color textMuted = Color(0xFF666666);
  static const Color textAccent = Color(0xFFCC0000);
  static const Color textGold = Color(0xFFC9A84C);

  // ===== Status & Utility Colors =====
  static const Color online = Color(0xFF00CC66);
  static const Color warningBg = Color(0xFF3D3200);
  static const Color warningBorder = Color(0xFFC9A84C);
  static const Color warningText = Color(0xFFC9A84C);
  static const Color divider = Color(0xFF333333);
  static const Color navBackground = Color(0xFFFFFFFF);
  static const Color navIconActive = Color(0xFFCC0000);
  static const Color navIconInactive = Color(0xFF1C1C1C);

  // ===== Avatar / Initial Badge =====
  static const Color avatarBg = Color(0xFFCC0000);
  static const Color avatarBorder = Color(0xFFFFFFFF);
  static const Color avatarText = Color(0xFFFFFFFF);

  // ===== Exam Player =====
  static const Color submitGreen = Color(0xFF2DAA4F);
  static const Color disabledOutline = Color(0xFF555555);
  static const Color disabledText = Color(0xFF777777);
  static const Color navigatorBoxBg = Color(0xFFD9D9D9);
  static const Color navigatorBoxAnswered = Color(0xFF1C1C1C);
  static const Color navigatorBoxFlagged = Color(0xFFC9A84C);

  // ===== Tambahan non-dokumen (dipakai untuk border input, dsb) =====
  /// Border default input field di login screen (#444444 sesuai mockup).
  static const Color inputBorder = Color(0xFF444444);
}
