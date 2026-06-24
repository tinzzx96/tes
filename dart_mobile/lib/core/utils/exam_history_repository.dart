// lib/core/utils/exam_history_repository.dart
// ════════════════════════════════════════════════════════════════════════════
// HERO EXAM — Exam History Repository
// Endpoint: GET /api/exam-attempts/history
//
// CATATAN dari Integration Tutorial:
//   Endpoint ini sudah ADA di backend (PRD Bagian 40.B, examAttempt.controller.js)
//   Filter: status = 'submitted', userId dari JWT token
//
// Response: { success, data: [{ examId, subjectName, examCode, teacherName,
//                               submittedAt, score }] }
//   score: null → tampilkan "Menunggu Nilai"
// ════════════════════════════════════════════════════════════════════════════

import 'dart:convert';
import 'package:http/http.dart' as http;
import '../config/api_config.dart';
import 'auth_repository.dart';

class ExamHistoryRepository {
  ExamHistoryRepository._();

  /// Ambil riwayat ujian permanen dari server.
  /// Data dari DB server — bukan localStorage. Tetap ada meski reinstall app.
  static Future<List<ExamHistoryEntry>> fetchHistory() async {
    final token = await AuthRepository.getToken();

    final res = await http.get(
      Uri.parse('${ApiConfig.baseUrl}/exam-attempts/history'),
      headers: ApiConfig.headers(token),
    );

    final data = jsonDecode(res.body) as Map<String, dynamic>;

    if (res.statusCode == 200 && data['success'] == true) {
      final list = data['data'] as List<dynamic>;
      final entries = list
          .map((e) => ExamHistoryEntry.fromJson(e as Map<String, dynamic>))
          .toList();

      // Sort terbaru dulu (backend sudah urut desc, ini safety sort)
      entries.sort((a, b) => b.submittedAt.compareTo(a.submittedAt));
      return entries;
    }

    throw Exception(
        data['error']?['message'] ?? 'Gagal memuat riwayat ujian.');
  }
}

// ── Model ─────────────────────────────────────────────────────────────────────
class ExamHistoryEntry {
  final String examId;
  final String subjectName;
  final String examCode;
  final String teacherName;
  final DateTime submittedAt;
  final double? score; // null = belum dinilai guru

  const ExamHistoryEntry({
    required this.examId,
    required this.subjectName,
    required this.examCode,
    required this.teacherName,
    required this.submittedAt,
    this.score,
  });

  /// Tampilkan "Menunggu Nilai" jika score null
  String get scoreDisplay =>
      score != null ? score!.toStringAsFixed(1) : 'Menunggu Nilai';

  factory ExamHistoryEntry.fromJson(Map<String, dynamic> json) =>
      ExamHistoryEntry(
        examId: json['examId']?.toString() ?? '',
        subjectName: json['subjectName'] ?? '',
        examCode: json['examCode'] ?? '',
        teacherName: json['teacherName'] ?? '',
        submittedAt: DateTime.parse(json['submittedAt']),
        score: (json['score'] as num?)?.toDouble(),
      );
}
