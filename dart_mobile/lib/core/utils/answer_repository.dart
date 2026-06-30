// lib/core/utils/answer_repository.dart
// ════════════════════════════════════════════════════════════════════════════
// HERO EXAM — Answer Repository (Auto-Save + Submit)
//
// Auto-save endpoint (BARU dari API_DOCS):
//   POST /api/exam-attempts/:examAttemptId/answers
//   Body: { questionId, selectedOptionIndex, clientTimestamp }
//
// PENTING: URL BERUBAH dari versi lama:
//   LAMA: POST /exams/:examId/answers
//   BARU: POST /exam-attempts/:examAttemptId/answers
//
// Submit endpoint:
//   POST /api/exams/:examId/submit
// ════════════════════════════════════════════════════════════════════════════

import 'dart:convert';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:http/http.dart' as http;
import '../config/api_config.dart';
import 'auth_repository.dart';
import 'exam_token_repository.dart';

class AnswerRepository {
  AnswerRepository._();

  static const _storage = FlutterSecureStorage();

  /// Auto-save satu jawaban ke server.
  /// [questionId]          → ID soal (integer) dari ExamQuestion.id
  /// [selectedOptionIndex] → Index opsi dipilih (0-based) sesuai urutan options dari server.
  ///                         Null jika jawaban dikosongkan/direset.
  ///
  /// Silent fail — jangan throw ke UI, cukup log. Data lokal sudah tersimpan.
  static Future<void> autoSave({
    required int questionId,
    required int? selectedOptionIndex,
  }) async {
    try {
      final token = await AuthRepository.getToken();
      final attemptIdStr = await _storage.read(key: 'exam_attempt_id');
      if (attemptIdStr == null) return; // belum ada attempt aktif

      final headers = await ApiConfig.headersWithDevice(token);
      await http.post(
        Uri.parse(
            '${ApiConfig.baseUrl}/exam-attempts/$attemptIdStr/answers'),
        headers: headers,
        body: jsonEncode({
          'questionId': questionId,
          'selectedOptionIndex': selectedOptionIndex,
          'clientTimestamp': DateTime.now().toIso8601String(),
        }),
      );

      // silent fail — 4xx / 5xx tidak throw ke UI
      // Data akan di-retry heartbeat berikutnya atau resume
    } catch (_) {
      // Koneksi putus saat auto-save — normal di jaringan sekolah
    }
  }

  /// Submit ujian secara manual oleh siswa.
  /// Return ExamSubmitResult berisi score dan total soal.
  static Future<ExamSubmitResult> submitExam(int examId) async {
    final token = await AuthRepository.getToken();
    final headers = await ApiConfig.headersWithDevice(token);

    final res = await http.post(
      Uri.parse('${ApiConfig.baseUrl}/exams/$examId/submit'),
      headers: headers,
      body: jsonEncode({}),
    );

    final data = jsonDecode(res.body) as Map<String, dynamic>;

    if (res.statusCode == 200 && data['success'] == true) {
      // Hapus examAttemptId setelah submit sukses
      await ExamTokenRepository.clearAttemptId();
      return ExamSubmitResult.fromJson(data['data'] as Map<String, dynamic>);
    }

    throw Exception(data['error']?['message'] ?? 'Gagal mengirim jawaban.');
  }

  /// Ambil hasil ujian setelah submit.
  /// Endpoint: GET /api/exams/:examId/result
  static Future<Map<String, dynamic>> getResult(int examId) async {
    final token = await AuthRepository.getToken();

    final res = await http.get(
      Uri.parse('${ApiConfig.baseUrl}/exams/$examId/result'),
      headers: ApiConfig.headers(token),
    );

    final data = jsonDecode(res.body) as Map<String, dynamic>;
    if (res.statusCode == 200 && data['success'] == true) {
      return data['data'] as Map<String, dynamic>;
    }

    throw Exception(data['error']?['message'] ?? 'Hasil ujian belum tersedia.');
  }
}

// ── Model ─────────────────────────────────────────────────────────────────────
class ExamSubmitResult {
  final double score;
  final int totalQuestions;
  final int correctAnswers;

  const ExamSubmitResult({
    required this.score,
    required this.totalQuestions,
    required this.correctAnswers,
  });

  factory ExamSubmitResult.fromJson(Map<String, dynamic> json) =>
      ExamSubmitResult(
        score: (json['score'] as num?)?.toDouble() ?? 0.0,
        totalQuestions: json['totalQuestions'] ?? 0,
        correctAnswers: json['correctAnswers'] ?? 0,
      );
}
