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
import '../models/exam_schedule.dart';
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
    ).timeout(const Duration(seconds: 10));

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
