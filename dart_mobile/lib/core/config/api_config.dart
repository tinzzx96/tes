// lib/core/config/api_config.dart
// ════════════════════════════════════════════════════════════════════════════
// HERO EXAM — Konfigurasi Base URL
// Ganti baseUrl dengan IP server saat testing di jaringan sekolah.
// ════════════════════════════════════════════════════════════════════════════

class ApiConfig {
  ApiConfig._();

  // ── Ganti IP ini sesuai jaringan ─────────────────────────────────────────
  // Emulator Android  → http://10.0.2.2:8000/api
  // HP fisik / sekolah → http://192.168.1.XXX:8000/api  (cek dengan ipconfig)
  static const String baseUrl = 'http://10.0.2.2:8000/api';

  // ── Header standar ────────────────────────────────────────────────────────
  static Map<String, String> headers(String? token) => {
        'Content-Type': 'application/json',
        if (token != null) 'Authorization': 'Bearer $token',
      };
}