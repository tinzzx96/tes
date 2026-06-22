import 'package:shared_preferences/shared_preferences.dart';

/// Penyimpanan status "sudah submit" per ujian, SEMENTARA selama belum ada
/// database backend (Hero Exam PRD belum masuk fase production).
///
/// TODO(produksi): ganti seluruh isi class ini dengan pemanggilan Exam API
/// (cek status exam_attempt dari server), lalu hapus dependency
/// shared_preferences. Method signature (getCompletedExamIds, markCompleted,
/// clearAll) sengaja dipertahankan agar widget pemanggil tidak perlu diubah
/// saat migrasi nanti.
class ExamProgressStore {
  ExamProgressStore._();

  static const String _prefsKey = 'completed_exam_ids';

  /// Kunci shared_preferences status blokir & counter pelanggaran — HARUS
  /// identik dengan _kKeyIsBlokir/_kKeyCounter di exam_player_screen.dart.
  /// Diduplikasi sebagai konstanta publik di sini (bukan private di
  /// exam_player_screen.dart) supaya HeaderStatusActions (tombol Refresh)
  /// bisa mereset kunci yang SAMA PERSIS tanpa import privat lintas file.
  static const String keyIsBlokir = 'hero_exam_is_blokir';
  static const String keyCounterPelanggaran = 'hero_exam_counter_pelanggaran';

  /// Ambil seluruh id ujian yang sudah pernah di-submit (akan hilang jika
  /// app di-uninstall atau cache dibersihkan — ini perilaku yang diharapkan
  /// untuk tahap development).
  static Future<Set<String>> getCompletedExamIds() async {
    final prefs = await SharedPreferences.getInstance();
    final list = prefs.getStringList(_prefsKey) ?? <String>[];
    return list.toSet();
  }

  /// Tandai satu ujian sebagai sudah selesai/submit.
  static Future<void> markCompleted(String examId) async {
    final prefs = await SharedPreferences.getInstance();
    final current = prefs.getStringList(_prefsKey) ?? <String>[];
    if (!current.contains(examId)) {
      current.add(examId);
      await prefs.setStringList(_prefsKey, current);
    }
  }

  /// Hapus seluruh data progress submit (dipakai untuk testing/reset
  /// manual). TIDAK menyentuh status blokir/counter pelanggaran — lihat
  /// clearAllCheatStatus() untuk itu.
  static Future<void> clearAll() async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.remove(_prefsKey);
  }

  /// BYPASS DEBUGGING — reset status blokir DAN counter pelanggaran ke 0,
  /// terlepas dari ujian mana yang sedang aktif. Dipakai oleh tombol
  /// Refresh di HeaderStatusActions untuk keperluan testing berulang.
  ///
  /// TODO: Hapus method ini saat rilis Production.
  ///
  /// PRODUCTION BEHAVIOR YANG BENAR (lihat juga catatan di
  /// exam_player_screen.dart): counter pelanggaran TIDAK BOLEH menumpuk
  /// lintas mapel ujian yang berbeda. Setiap mapel/sesi ujian baru harus
  /// mulai dari counter 0, supaya pelanggaran di Ujian Matematika tidak
  /// ikut terbawa dan secara tidak sengaja men-diskualifikasi siswa di
  /// Ujian Produktif RPL yang dimulai setelahnya. Implementasi production
  /// yang benar: counter pelanggaran disimpan dengan kunci YANG MENCAKUP
  /// examId (mis. 'hero_exam_counter_$examId'), BUKAN kunci tunggal global
  /// seperti sekarang — lihat TODO lebih lengkap di exam_player_screen.dart.
  static Future<void> clearAllCheatStatus() async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.remove(keyIsBlokir);
    await prefs.remove(keyCounterPelanggaran);
  }
}