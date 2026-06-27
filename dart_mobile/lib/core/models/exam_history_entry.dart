/// Model satu entri riwayat ujian yang sudah disubmit, ditarik dari
/// Result API (server), BUKAN dari local storage perangkat.
///
/// Sesuai keputusan arsitektur (lihat Hero Exam PRD Addendum Bagian 40.B):
/// riwayat ujian TIDAK BOLEH bergantung pada shared_preferences atau
/// penyimpanan lokal apa pun, karena data tersebut akan hilang jika murid
/// melakukan uninstall aplikasi atau membersihkan cache. Sumber kebenaran
/// satu-satunya adalah tabel exam_attempts di database server.
class ExamHistoryEntry {
  final String examId;
  final String subjectName;
  final String teacherName;
  final String examCode;

  /// Waktu submit — dipakai untuk pengelompokan tampilan "Hari - Tanggal".
  final DateTime submittedAt;

  /// Nilai hasil ujian. Null jika guru belum melakukan koreksi/rilis nilai
  /// (lihat Dashboard Guru — "Lihat Hasil", PRD Bagian 21).
  final int? score;

  const ExamHistoryEntry({
    required this.examId,
    required this.subjectName,
    required this.teacherName,
    required this.examCode,
    required this.submittedAt,
    this.score,
  });

  factory ExamHistoryEntry.fromJson(Map<String, dynamic> json) {
    return ExamHistoryEntry(
      examId: json['examId']?.toString() ?? '',
      subjectName: json['subjectName'] ?? '',
      teacherName: json['teacherName'] ?? '',
      examCode: json['examCode'] ?? '',
      submittedAt: DateTime.parse(json['submittedAt']),
      score: (json['score'] as num?)?.toInt(),
    );
  }
}