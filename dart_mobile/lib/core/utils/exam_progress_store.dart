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

  /// Hapus seluruh data progress (dipakai untuk testing/reset manual).
  static Future<void> clearAll() async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.remove(_prefsKey);
  }
}
