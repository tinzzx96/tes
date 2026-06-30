// lib/core/utils/exam_token_repository.dart
// ════════════════════════════════════════════════════════════════════════════
// HERO EXAM — Token Ujian Repository
// Endpoint: POST /api/exam-tokens/validate
// Response sukses: { success, data: { valid: true, examAttemptId: 5521 } }
// Response error:  { success: false, error: { code: 'TOKEN_INVALID', message } }
//
// PENTING: examAttemptId yang dikembalikan WAJIB disimpan ke secure storage.
// Semua request berikutnya (auto-save, heartbeat, report-violation) pakai ini.
// ════════════════════════════════════════════════════════════════════════════

import 'dart:convert';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:http/http.dart' as http;
import '../config/api_config.dart';
import 'auth_repository.dart';

class ExamTokenRepository {
  ExamTokenRepository._();

  static const _storage = FlutterSecureStorage();

  /// Validasi Token Ujian sebelum masuk ExamPlayerScreen.
  /// Simpan examAttemptId ke secure storage setelah berhasil.
  static Future<TokenValidationResult> validate({
    required int examId,
    required String enteredToken,
  }) async {
    final accessToken = await AuthRepository.getToken();

    final res = await http.post(
      Uri.parse('${ApiConfig.baseUrl}/exam-tokens/validate'),
      headers: ApiConfig.headers(accessToken),
      body: jsonEncode({
        'examId': examId,
        'token': enteredToken.toUpperCase().trim(),
      }),
    ).timeout(const Duration(seconds: 10));

    final data = jsonDecode(res.body) as Map<String, dynamic>;

    if (res.statusCode == 200 && data['success'] == true) {
      final attemptId = data['data']['examAttemptId'] as int;

      // Simpan examAttemptId — WAJIB untuk semua request berikutnya
      await _storage.write(
        key: 'exam_attempt_id',
        value: attemptId.toString(),
      );

      return TokenValidationResult.success(examAttemptId: attemptId);
    }

    // Error: TOKEN_INVALID / EXAM_NOT_ACTIVE / EXAM_ALREADY_SUBMITTED
    final message = data['error']?['message'] ??
        'Token Ujian salah. Hubungi pengawas.';
    return TokenValidationResult.failure(message);
  }

  /// Ambil examAttemptId yang tersimpan.
  static Future<int?> getStoredAttemptId() async {
    final raw = await _storage.read(key: 'exam_attempt_id');
    return raw != null ? int.tryParse(raw) : null;
  }

  /// Hapus examAttemptId setelah ujian selesai / submit.
  static Future<void> clearAttemptId() async {
    await _storage.delete(key: 'exam_attempt_id');
  }
}

// ── Model ─────────────────────────────────────────────────────────────────────
class TokenValidationResult {
  final bool isValid;
  final int? examAttemptId;
  final String? errorMessage;

  const TokenValidationResult._({
    required this.isValid,
    this.examAttemptId,
    this.errorMessage,
  });

  factory TokenValidationResult.success({required int examAttemptId}) =>
      TokenValidationResult._(isValid: true, examAttemptId: examAttemptId);

  factory TokenValidationResult.failure(String message) =>
      TokenValidationResult._(isValid: false, errorMessage: message);
}
