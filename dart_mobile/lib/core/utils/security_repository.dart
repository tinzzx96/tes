// lib/core/utils/security_repository.dart
// ════════════════════════════════════════════════════════════════════════════
// HERO EXAM — Security Repository (Anti-Curang)
//
// PERUBAHAN BESAR dari versi lama (API_DOCS Bagian 6):
//   - Body pakai examAttemptId (int), BUKAN exam_id
//   - PIN tidak dikembalikan ke siswa — dikirim ke pengawas via WebSocket
//   - report-violation response: { action: 'BLOCK_NORMAL' | 'AUTO_SUBMIT_DISQUALIFIED' }
//   - verify-unlock body: { examAttemptId, pin } (BUKAN exam_id + unlock_pin)
//   - GET status pakai :examAttemptId (BUKAN :examId)
//   - GET /security/get-unlock-pin DIHAPUS — tidak ada lagi
// ════════════════════════════════════════════════════════════════════════════

import 'dart:convert';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:http/http.dart' as http;
import '../config/api_config.dart';
import 'auth_repository.dart';

class SecurityRepository {
  SecurityRepository._();

  static const _storage = FlutterSecureStorage();

  /// Laporan pelanggaran saat screen pinning lepas.
  /// Endpoint: POST /api/security/report-violation
  /// [examAttemptId] → dari secure storage (disimpan saat validasi token ujian)
  /// [reasonCode]    → 'screen_pin_released' | 'focus_lost' | 'overlay_detected'
  /// [violationNumber] → nomor pelanggaran saat ini (dari counterPelanggaran lokal)
  ///
  /// Return: ViolationResult dengan action BLOCK_NORMAL atau AUTO_SUBMIT_DISQUALIFIED
  static Future<ViolationResult> reportViolation({
    required int examAttemptId,
    required String reasonCode,
    int violationNumber = 1,
  }) async {
    final token = await AuthRepository.getToken();

    final res = await http.post(
      Uri.parse('${ApiConfig.baseUrl}/security/report-violation'),
      headers: ApiConfig.headers(token),
      body: jsonEncode({
        'examAttemptId': examAttemptId,
        'reasonCode': reasonCode,
        'violationNumber': violationNumber,
      }),
    );

    final data = jsonDecode(res.body) as Map<String, dynamic>;

    if (res.statusCode == 200 && data['success'] == true) {
      final action = data['data']['action'] as String;
      final counter = data['data']['counterPelanggaran'] as int;

      return ViolationResult(
        action: action,
        counterPelanggaran: counter,
        shouldAutoSubmit: action == 'AUTO_SUBMIT_DISQUALIFIED',
      );
    }

    throw Exception(data['error']?['message'] ?? 'Gagal melaporkan pelanggaran.');
  }

  /// Verifikasi PIN dari pengawas.
  /// Endpoint: POST /api/security/verify-unlock
  ///
  /// PIN bersifat unik per examAttemptId — server MENOLAK PIN yang benar
  /// tapi milik siswa lain (anti-tertukar, PRD Bagian 42).
  static Future<bool> verifyUnlockPin({
    required int examAttemptId,
    required String pin,
  }) async {
    final token = await AuthRepository.getToken();

    final res = await http.post(
      Uri.parse('${ApiConfig.baseUrl}/security/verify-unlock'),
      headers: ApiConfig.headers(token),
      body: jsonEncode({
        'examAttemptId': examAttemptId,
        'pin': pin.trim().toUpperCase(),
      }),
    );

    final data = jsonDecode(res.body) as Map<String, dynamic>;

    if (res.statusCode == 200 && data['success'] == true) {
      return data['data']['unlocked'] == true;
    }

    // 422 PIN_INVALID — PIN salah atau bukan milik attempt ini
    return false;
  }

  /// Cek status blokir saat app restart / resume.
  /// Endpoint: GET /api/security/status/:examAttemptId
  static Future<SecurityStatus> getStatus(int examAttemptId) async {
    final token = await AuthRepository.getToken();

    final res = await http.get(
      Uri.parse('${ApiConfig.baseUrl}/security/status/$examAttemptId'),
      headers: ApiConfig.headers(token),
    );

    final data = jsonDecode(res.body) as Map<String, dynamic>;

    if (res.statusCode == 200 && data['success'] == true) {
      return SecurityStatus.fromJson(data['data'] as Map<String, dynamic>);
    }

    throw Exception(data['error']?['message'] ?? 'Gagal memuat status keamanan.');
  }

  /// Ambil examAttemptId tersimpan dari secure storage.
  static Future<int?> getStoredAttemptId() async {
    final raw = await _storage.read(key: 'exam_attempt_id');
    return raw != null ? int.tryParse(raw) : null;
  }
}

// ── Models ────────────────────────────────────────────────────────────────────
class ViolationResult {
  /// 'BLOCK_NORMAL' atau 'AUTO_SUBMIT_DISQUALIFIED'
  final String action;
  final int counterPelanggaran;
  final bool shouldAutoSubmit;

  const ViolationResult({
    required this.action,
    required this.counterPelanggaran,
    required this.shouldAutoSubmit,
  });
}

class SecurityStatus {
  final bool isBlocked;
  final int counterPelanggaran;
  final int remainingViolations;
  final String status; // waiting | started | submitted

  const SecurityStatus({
    required this.isBlocked,
    required this.counterPelanggaran,
    required this.remainingViolations,
    required this.status,
  });

  factory SecurityStatus.fromJson(Map<String, dynamic> json) => SecurityStatus(
        isBlocked: json['isBlocked'] as bool? ?? false,
        counterPelanggaran: json['counterPelanggaran'] as int? ?? 0,
        remainingViolations: json['remainingViolations'] as int? ?? 5,
        status: json['status'] ?? 'waiting',
      );
}
