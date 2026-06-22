import '../models/exam_history_entry.dart';

/// Sumber data riwayat ujian — SENGAJA TIDAK memakai shared_preferences
/// atau penyimpanan lokal apa pun (beda dengan ExamProgressStore lama yang
/// dipakai untuk status "centang hijau" di Home/Schedule).
///
/// Riwayat ujian permanen WAJIB selalu ditarik secara dinamis dari server,
/// supaya data tetap utuh meskipun murid uninstall aplikasi atau berganti
/// perangkat (Hero Exam PRD Addendum Bagian 17 & 40.B).
///
/// TODO(integrasi-backend): ganti seluruh isi fetchHistory() dengan
/// pemanggilan REST API Node.js sungguhan:
///
///   GET /api/v1/exam-attempts/history
///   Header: Authorization: Bearer {token siswa yang sedang login}
///
/// yang menarik data dari tabel exam_attempts dengan kriteria
/// status = 'selesai', difilter otomatis di server berdasarkan ID siswa
/// dari token autentikasi (bukan dikirim sebagai parameter dari client).
/// Response JSON diharapkan berbentuk array objek yang cocok dengan
/// ExamHistoryEntry.fromJson(...).
class ExamHistoryRepository {
  ExamHistoryRepository._();

  /// Mengambil seluruh riwayat ujian yang sudah disubmit murid, diurutkan
  /// dari yang TERBARU ke TERLAMA.
  ///
  /// Saat ini mengembalikan data dummy dengan simulasi latency jaringan,
  /// supaya UI (loading state, pull-to-refresh) bisa dikembangkan dan diuji
  /// sebelum backend Node.js tersedia. Tidak ada bagian dari method ini
  /// yang menulis ke disk/local storage.
  static Future<List<ExamHistoryEntry>> fetchHistory() async {
    await Future.delayed(const Duration(milliseconds: 700));

    final now = DateTime.now();
    final today = DateTime(now.year, now.month, now.day);

    final dummy = <ExamHistoryEntry>[
      ExamHistoryEntry(
        examId: 'exam-1',
        subjectName: 'Matematika',
        examCode: 'MTK-2026-UAS',
        teacherName: 'Drs. Rajan Johnson',
        submittedAt: today.add(const Duration(hours: 9, minutes: 42)),
        score: 88,
      ),
      ExamHistoryEntry(
        examId: 'exam-2',
        subjectName: 'Produktif RPL',
        examCode: 'RPL-2026-UAS',
        teacherName: 'Danang Setiawan',
        submittedAt: today.add(const Duration(hours: 11, minutes: 15)),
        score: null, // belum dikoreksi guru
      ),
      ExamHistoryEntry(
        examId: 'sched-3',
        subjectName: 'Bahasa Inggris',
        examCode: 'ENG-2026-UAS',
        teacherName: 'Siti Aminah, S.Pd',
        submittedAt: today.subtract(const Duration(days: 1, hours: 4)),
        score: 92,
      ),
      ExamHistoryEntry(
        examId: 'exam-old-1',
        subjectName: 'IPA Terpadu',
        examCode: 'IPA-2026-PTS',
        teacherName: 'Budi Santoso, S.Pd',
        submittedAt: today.subtract(const Duration(days: 6, hours: 2)),
        score: 79,
      ),
    ];

    dummy.sort((a, b) => b.submittedAt.compareTo(a.submittedAt));
    return dummy;
  }
}