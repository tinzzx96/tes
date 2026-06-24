// lib/core/utils/auth_repository.dart
// ════════════════════════════════════════════════════════════════════════════
// HERO EXAM — Authentication Repository
// Endpoint: POST /api/auth/login
// Response contract (API_DOCS Bagian 1):
//   { success, data: { accessToken, student: { id, name, nisn, classLabel, deviceId } } }
// ════════════════════════════════════════════════════════════════════════════

import 'dart:convert';
import 'package:flutter/foundation.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:http/http.dart' as http;
import '../config/api_config.dart';

class AuthRepository {
  AuthRepository._();

  static const _storage = FlutterSecureStorage();

  /// Login siswa dengan NISN + password + Token Sesi.
  /// Simpan accessToken ke secure storage.
  /// Return StudentProfile jika sukses, throw Exception jika gagal.
  static Future<StudentProfile> login({
    required String nisn,
    required String password,
    required String sessionToken,
  }) async {
    final res = await http.post(
      Uri.parse('${ApiConfig.baseUrl}/auth/login'),
      headers: ApiConfig.headers(null),
      body: jsonEncode({
        'nisn': nisn.trim(),
        'password': password,
        'sessionToken': sessionToken.trim().toUpperCase(),
      }),
    );

    final data = jsonDecode(res.body) as Map<String, dynamic>;

    if (res.statusCode == 200 && data['success'] == true) {
      final token = data['data']['accessToken'] as String;
      await _storage.write(key: 'access_token', value: token);
      return StudentProfile.fromJson(data['data']['student']);
    }

    // Error dari server: 401 token sesi salah / password salah
    final message = data['error']?['message'] ??
        data['message'] ??
        'Login gagal. Periksa NISN, password, dan Token Sesi.';
    throw Exception(message);
  }

  /// Ambil token tersimpan (untuk semua request sesudah login).
  static Future<String> getToken() async {
    return await _storage.read(key: 'access_token') ?? '';
  }

  /// Hapus token — dipanggil saat logout / auto-logout tengah malam.
  static Future<void> logout() async {
    await _storage.delete(key: 'access_token');
    await _storage.delete(key: 'exam_attempt_id');
  }

  /// Ambil profil user yang sedang login dari server.
  /// Endpoint: GET /api/auth/me
  static Future<Map<String, dynamic>> me() async {
    final token = await getToken();
    final res = await http.get(
      Uri.parse('${ApiConfig.baseUrl}/auth/me'),
      headers: ApiConfig.headers(token),
    );
    final data = jsonDecode(res.body) as Map<String, dynamic>;
    if (res.statusCode == 200 && data['success'] == true) {
      return data['data'] as Map<String, dynamic>;
    }
    throw Exception(data['error']?['message'] ?? 'Gagal memuat profil.');
  }
}

// ── Model ─────────────────────────────────────────────────────────────────────
class StudentProfile {
  final String id;
  final String name;
  final String nisn;
  final String classLabel;
  final String? deviceId;

  const StudentProfile({
    required this.id,
    required this.name,
    required this.nisn,
    required this.classLabel,
    this.deviceId,
  });

  factory StudentProfile.fromJson(Map<String, dynamic> json) => StudentProfile(
        id: json['id']?.toString() ?? '',
        name: json['name'] ?? '',
        nisn: json['nisn'] ?? '',
        classLabel: json['classLabel'] ?? '',
        deviceId: json['deviceId'],
      );
}
