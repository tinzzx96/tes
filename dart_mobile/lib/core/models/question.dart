/// Status jawaban siswa untuk satu soal, dipakai Question Navigator.
enum QuestionStatus { unanswered, answered, flagged }

/// Model satu soal ujian (hasil randomisasi per siswa).
///
/// `displayNumber` = nomor kotak di navigator (1, 2, 3, ...).
/// `originalNumber` = nomor asli soal di bank soal sebelum diacak.
class Question {
  final int id;
  final int displayNumber;
  final int originalNumber;
  final String questionText;
  final String? imagePath;
  final List<String> options;
  int? selectedOptionIndex;
  bool isFlagged;

  Question({
    required this.id,
    required this.displayNumber,
    required this.originalNumber,
    required this.questionText,
    required this.options,
    this.imagePath,
    this.selectedOptionIndex,
    this.isFlagged = false,
  });

  QuestionStatus get status {
    if (isFlagged) return QuestionStatus.flagged;
    if (selectedOptionIndex != null) return QuestionStatus.answered;
    return QuestionStatus.unanswered;
  }

  /// True jika `imagePath` adalah URL dari server (hasil import DOCX via
  /// PHPWord, lihat Hero Exam PRD §8: "Soal Bergambar & Import Flow" —
  /// gambar diekstrak ke storage backend lalu dikirim sebagai URL).
  /// False jika `imagePath` adalah path asset lokal (dummy/testing).
  bool get isNetworkImage {
    final path = imagePath;
    return path != null && (path.startsWith('http://') || path.startsWith('https://'));
  }
}
