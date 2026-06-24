// lib/core/utils/exam_schedule_repository.dart
// ════════════════════════════════════════════════════════════════════════════
// HERO EXAM — Exam Schedule Repository
// Endpoint: GET /api/exams
// Response: { success, data: [ { id, title, subject, teacher, durationMinutes,
//             startTime, endTime, room, examCode, status, attemptStatus, score } ] }
// ════════════════════════════════════════════════════════════════════════════

import 'dart:convert';
import 'package:http/http.dart' as http;
import '../config/api_config.dart';
import 'auth_repository.dart';

class ExamScheduleRepository {
  ExamScheduleRepository._();

  /// Ambil daftar ujian hari ini dari server.
  /// Sudah difilter backend berdasarkan startTime = hari ini.
  static Future<List<ExamSchedule>> fetchToday() async {
    final token = await AuthRepository.getToken();

    final res = await http.get(
      Uri.parse('${ApiConfig.baseUrl}/exams'),
      headers: ApiConfig.headers(token),
    );

    final data = jsonDecode(res.body) as Map<String, dynamic>;

    if (res.statusCode == 200 && data['success'] == true) {
      final list = data['data'] as List<dynamic>;
      return list
          .map((e) => ExamSchedule.fromJson(e as Map<String, dynamic>))
          .toList();
    }

    throw Exception(
        data['error']?['message'] ?? 'Gagal memuat jadwal ujian.');
  }
}

// ── Model ─────────────────────────────────────────────────────────────────────
class ExamSchedule {
  final int id;
  final String title;
  final String subject;
  final String? teacher;
  final int durationMinutes;
  final DateTime startTime;
  final DateTime endTime;
  final String room;
  final String examCode;
  final String status;       // draft | active | completed
  final String attemptStatus; // waiting | started | submitted
  final double? score;

  const ExamSchedule({
    required this.id,
    required this.title,
    required this.subject,
    this.teacher,
    required this.durationMinutes,
    required this.startTime,
    required this.endTime,
    required this.room,
    required this.examCode,
    required this.status,
    required this.attemptStatus,
    this.score,
  });

  bool get isCompleted => attemptStatus == 'submitted';
  bool get isActive => status == 'active';

  factory ExamSchedule.fromJson(Map<String, dynamic> json) => ExamSchedule(
        id: json['id'] as int,
        title: json['title'] ?? '',
        subject: json['subject'] ?? '',
        teacher: json['teacher'],
        durationMinutes: json['durationMinutes'] ?? 90,
        startTime: DateTime.parse(json['startTime']),
        endTime: DateTime.parse(json['endTime']),
        room: json['room'] ?? '',
        examCode: json['examCode'] ?? '',
        status: json['status'] ?? 'draft',
        attemptStatus: json['attemptStatus'] ?? 'waiting',
        score: (json['score'] as num?)?.toDouble(),
      );
}
