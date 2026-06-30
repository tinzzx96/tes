// lib/core/utils/question_repository.dart
// ════════════════════════════════════════════════════════════════════════════
// HERO EXAM — Question Repository
// ALUR WAJIB sebelum ambil soal:
//   1. validate exam token → dapat examAttemptId, disimpan di storage
//   2. start exam → ubah status attempt jadi 'started'
//   3. ambil soal → GET /api/exams/:examId/questions
//
// Endpoint start:    POST /api/exams/:examId/start
// Endpoint soal:     GET  /api/exams/:examId/questions
// Endpoint timer:    GET  /api/exams/:examId/timer
//
// Response soal: { success, data: { questions: [...], totalQuestions: N } }
// Setiap soal: { id, body, questionImage, type, orderNum, points,
//               options: [{id, body, orderNum}],
//               savedOptionId, savedEssayAnswer }
// ════════════════════════════════════════════════════════════════════════════

import 'dart:convert';
import 'package:http/http.dart' as http;
import '../config/api_config.dart';
import 'auth_repository.dart';

class QuestionRepository {
  QuestionRepository._();

  /// Mulai sesi ujian — ubah status attempt: waiting → started.
  /// Dipanggil SETELAH token ujian divalidasi dan SEBELUM ambil soal.
  static Future<ExamStartResult> startExam(int examId) async {
    final token = await AuthRepository.getToken();
    final headers = await ApiConfig.headersWithDevice(token);

    final res = await http.post(
      Uri.parse('${ApiConfig.baseUrl}/exams/$examId/start'),
      headers: headers,
      body: jsonEncode({}),
    );

    final data = jsonDecode(res.body) as Map<String, dynamic>;

    if (res.statusCode == 200 && data['success'] == true) {
      return ExamStartResult(
        startedAt: data['data']['startedAt'] != null
            ? DateTime.parse(data['data']['startedAt'])
            : DateTime.now(),
        attemptId: data['data']['attemptId'] as int,
      );
    }

    throw Exception(data['error']?['message'] ?? 'Gagal memulai ujian.');
  }

  /// Ambil daftar soal ujian (sudah teracak per siswa oleh backend).
  /// Sudah termasuk savedOptionId agar jawaban sebelumnya bisa di-restore.
  static Future<List<ExamQuestion>> fetchQuestions(int examId) async {
    final token = await AuthRepository.getToken();
    final headers = await ApiConfig.headersWithDevice(token);

    final res = await http.get(
      Uri.parse('${ApiConfig.baseUrl}/exams/$examId/questions'),
      headers: headers,
    );

    final data = jsonDecode(res.body) as Map<String, dynamic>;

    if (res.statusCode == 200 && data['success'] == true) {
      final list = data['data']['questions'] as List<dynamic>;
      return list
          .map((q) => ExamQuestion.fromJson(q as Map<String, dynamic>))
          .toList();
    }

    throw Exception(data['error']?['message'] ?? 'Gagal memuat soal.');
  }

  /// Ambil sisa waktu ujian dari server (timer server-side).
  /// Gunakan remainingSeconds ini sebagai acuan — BUKAN timer lokal.
  static Future<ExamTimer> fetchTimer(int examId) async {
    final token = await AuthRepository.getToken();
    final headers = await ApiConfig.headersWithDevice(token);

    final res = await http.get(
      Uri.parse('${ApiConfig.baseUrl}/exams/$examId/timer'),
      headers: headers,
    );

    final data = jsonDecode(res.body) as Map<String, dynamic>;

    if (res.statusCode == 200 && data['success'] == true) {
      return ExamTimer.fromJson(data['data'] as Map<String, dynamic>);
    }

    throw Exception(data['error']?['message'] ?? 'Gagal memuat timer.');
  }
}

// ── Models ────────────────────────────────────────────────────────────────────
class ExamQuestion {
  final int id;
  final String body;
  final String? questionImage; // path file, bukan base64
  final String type;           // multiple_choice | essay
  final int orderNum;
  final int points;
  final List<QuestionOption> options;
  final int? savedOptionId;    // jawaban tersimpan sebelumnya (resume)
  final String? savedEssayAnswer;

  const ExamQuestion({
    required this.id,
    required this.body,
    this.questionImage,
    required this.type,
    required this.orderNum,
    required this.points,
    required this.options,
    this.savedOptionId,
    this.savedEssayAnswer,
  });

  factory ExamQuestion.fromJson(Map<String, dynamic> json) => ExamQuestion(
        id: json['id'] as int,
        body: json['body'] ?? '',
        questionImage: json['questionImage'],
        type: json['type'] ?? 'multiple_choice',
        orderNum: json['orderNum'] ?? 1,
        points: json['points'] ?? 1,
        options: (json['options'] as List<dynamic>)
            .map((o) => QuestionOption.fromJson(o as Map<String, dynamic>))
            .toList(),
        savedOptionId: json['savedOptionId'] as int?,
        savedEssayAnswer: json['savedEssayAnswer'] as String?,
      );
}

class QuestionOption {
  final int id;
  final String body;
  final int orderNum;

  const QuestionOption({
    required this.id,
    required this.body,
    required this.orderNum,
  });

  factory QuestionOption.fromJson(Map<String, dynamic> json) => QuestionOption(
        id: json['id'] as int,
        body: json['body'] ?? '',
        orderNum: json['orderNum'] ?? 1,
      );
}

class ExamStartResult {
  final DateTime startedAt;
  final int attemptId;

  const ExamStartResult({required this.startedAt, required this.attemptId});
}

class ExamTimer {
  final DateTime startedAt;
  final DateTime endAt;
  final int remainingSeconds;
  final int durationMinutes;
  final int counterPelanggaran;

  const ExamTimer({
    required this.startedAt,
    required this.endAt,
    required this.remainingSeconds,
    required this.durationMinutes,
    required this.counterPelanggaran,
  });

  factory ExamTimer.fromJson(Map<String, dynamic> json) => ExamTimer(
        startedAt: DateTime.parse(json['startedAt']),
        endAt: DateTime.parse(json['endAt']),
        remainingSeconds: json['remainingSeconds'] as int,
        durationMinutes: json['durationMinutes'] as int,
        counterPelanggaran: json['counterPelanggaran'] ?? 0,
      );
}
