import 'package:shared_preferences/shared_preferences.dart';

/// Helper untuk fitur Auto Logout Tengah Malam.
///
/// Tujuan: memastikan murid logout otomatis setiap pergantian hari (00:00),
/// supaya esok harinya wajib login ulang dengan Token Ruangan yang baru
/// (token ujian berbeda tiap hari/sesi, sesuai PRD — Exam Management
/// Bagian 10 & Single Session Policy Bagian 16). Ini mencegah token hari
/// kemarin yang sudah kedaluwarsa tetap "nyangkut" tersimpan di sesi lokal.
///
/// Dipakai oleh AppShell (lihat app_shell.dart) — TIDAK dipasang di dalam
/// ExamPlayerScreen, karena auto-logout tidak boleh memaksa keluar murid
/// yang sedang mengerjakan ujian (lihat ExamSessionTracker).
class AutoLogoutGuard {
  AutoLogoutGuard._();

  static const String _kLastActiveDateKey = 'hero_exam_last_active_date';

  /// Durasi dari [from] (default: sekarang) sampai pukul 00:00:00 hari
  /// berikutnya. Ditambah buffer 2 detik supaya Timer pasti terpicu
  /// SETELAH tengah malam benar-benar lewat (menghindari race condition
  /// timer yang sangat jarang terpicu beberapa milidetik lebih awal).
  static Duration durationUntilNextMidnight([DateTime? from]) {
    final now = from ?? DateTime.now();
    final nextMidnight = DateTime(now.year, now.month, now.day + 1);
    return nextMidnight.difference(now) + const Duration(seconds: 2);
  }

  static String _dateKey(DateTime d) {
    final y = d.year.toString().padLeft(4, '0');
    final m = d.month.toString().padLeft(2, '0');
    final day = d.day.toString().padLeft(2, '0');
    return '$y-$m-$day';
  }

  /// Mencatat tanggal aktif "hari ini" ke shared_preferences. Dipanggil
  /// setiap AppShell dibuka/di-resume, supaya hasCrossedMidnight... punya
  /// titik referensi yang akurat.
  static Future<void> recordActiveDate([DateTime? now]) async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(_kLastActiveDateKey, _dateKey(now ?? DateTime.now()));
  }

  /// Mengembalikan true jika tanggal SEKARANG berbeda dari tanggal terakhir
  /// yang tercatat (artinya tengah malam sudah lewat sejak terakhir kali
  /// app aktif — termasuk skenario app di-background atau di-kill lalu
  /// dibuka kembali esok harinya).
  ///
  /// Pemanggilan pertama kali (belum ada catatan sama sekali) akan
  /// mencatat tanggal hari ini dan mengembalikan false — tidak memicu
  /// logout pada sesi login pertama.
  static Future<bool> hasCrossedMidnightSinceLastActive([DateTime? now]) async {
    final prefs = await SharedPreferences.getInstance();
    final stored = prefs.getString(_kLastActiveDateKey);
    final todayKey = _dateKey(now ?? DateTime.now());

    if (stored == null) {
      await prefs.setString(_kLastActiveDateKey, todayKey);
      return false;
    }
    return stored != todayKey;
  }

  /// Membersihkan data sesi lokal saat auto-logout dieksekusi.
  ///
  /// TODO(integrasi-backend): panggil Session API (Hero Exam PRD Bagian 27)
  /// untuk menginvalidasi session token di server, bukan hanya membersihkan
  /// state lokal — supaya Single Session Policy (PRD Bagian 16) tetap
  /// konsisten antara client dan server.
  ///
  /// CATATAN: method ini SENGAJA tidak menghapus completed_exam_ids maupun
  /// counter pelanggaran — keduanya melekat pada riwayat exam_attempt yang
  /// sudah terjadi (bukan sesi login), dan harus tetap menjadi catatan
  /// historis terlepas dari logout/login ulang.
  static Future<void> clearSession() async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.remove(_kLastActiveDateKey);
    // Placeholder untuk field sesi lain yang akan ditambahkan saat
    // integrasi Authentication API sungguhan, contoh:
    // await prefs.remove('auth_token');
    // await prefs.remove('exam_room_token');
  }
}