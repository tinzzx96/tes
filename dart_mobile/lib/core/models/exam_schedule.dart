/// Model jadwal ujian untuk satu siswa.
///
/// Field merefleksikan struktur tabel `jadwal_ujians` di LOGIC.md (Section
/// Import Jadwal Ujian Harian) dan tabel `exams` di Hero Exam PRD, sudah
/// dipetakan ke bentuk yang siap dipakai oleh UI Flutter.
class ExamSchedule {
  final String id;
  final String title;
  final String subjectName; // contoh: "Matematika"
  final String examCode; // contoh: "MTK-2026-UAS"
  final DateTime startTime;
  final DateTime endTime;
  final String roomName; // contoh: "Ruang-14" atau "Lab-01"
  final String teacherName; // contoh: "Drs. Rajan Johnson"
  final int durationMinutes;
  final String status;       // draft | active | completed
  final String attemptStatus; // waiting | started | submitted
  final double? score;

  const ExamSchedule({
    required this.id,
    required this.title,
    required this.subjectName,
    required this.examCode,
    required this.startTime,
    required this.endTime,
    required this.roomName,
    required this.teacherName,
    required this.durationMinutes,
    required this.status,
    required this.attemptStatus,
    this.score,
  });

  bool get isCompleted => attemptStatus == 'submitted';
  bool get isActive => status == 'active';

  /// True jika jadwal ini jatuh pada hari ini (dibandingkan dengan [now]).
  bool isToday(DateTime now) {
    return startTime.year == now.year &&
        startTime.month == now.month &&
        startTime.day == now.day;
  }

  /// Format "08:00 - 10:00" dipakai di Schedule Card.
  String get timeRangeShort {
    return '${_two(startTime.hour)}:${_two(startTime.minute)} - '
        '${_two(endTime.hour)}:${_two(endTime.minute)}';
  }

  /// Format "8:00 – 10:00" dipakai di Exam Card (Home), tanpa leading zero
  /// pada jam sesuai mockup Frame 2.
  String get timeRangeDash {
    return '${startTime.hour}:${_two(startTime.minute)} \u2013 '
        '${endTime.hour}:${_two(endTime.minute)}';
  }

  /// Nama guru tanpa gelar di depan, hanya untuk highlight di Exam Card.
  /// Contoh: "Drs. Rajan Johnson" -> "Rajan".
  String get teacherShortName {
    final parts = teacherName
        .replaceAll('Drs.', '')
        .replaceAll('Dra.', '')
        .trim()
        .split(' ');
    return parts.isNotEmpty ? parts.first : teacherName;
  }

  static String _two(int value) => value.toString().padLeft(2, '0');

  factory ExamSchedule.fromJson(Map<String, dynamic> json) {
    return ExamSchedule(
      id: json["id"].toString(),
      title: json["title"] ?? "",
      subjectName: json["subject"] ?? "",
      teacherName: json["teacher"] ?? "",
      startTime: DateTime.parse(json["startTime"]).toLocal(),
      endTime: DateTime.parse(json["endTime"]).toLocal(),
      roomName: json["room"] ?? "",
      examCode: json["examCode"] ?? "",
      durationMinutes: json["durationMinutes"] ?? 90,
      status: json["status"] ?? "draft",
      attemptStatus: json["attemptStatus"] ?? "waiting",
      score: (json["score"] as num?)?.toDouble(),
    );
  }
}