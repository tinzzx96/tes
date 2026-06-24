/// Semua spacing menggunakan kelipatan 8px sesuai DESIGN_SYSTEM.md Section 3.
/// Jangan pakai nilai arbitrary (13px, 17px, dst) di luar token ini.
class AppSpacing {
  AppSpacing._();

  static const double xs = 4;
  static const double s = 8;
  static const double m = 16;
  static const double l = 24;
  static const double xl = 32;
  static const double xxl = 48;

  /// Padding horizontal standar layar (kiri & kanan).
  static const double screenHorizontal = 24;

  /// Jarak antar card (schedule, exam card, dsb).
  static const double cardGap = 16;
}
