// lib/core/utils/auth_repository.dart
// ════════════════════════════════════════════════════════════════════════════
// HERO EXAM — Authentication Repository
// Endpoint: POST /api/auth/login
// Response contract (API_DOCS Bagian 1):
//   { success, data: { accessToken, student: { id, name, nisn, classLabel, deviceId },
//                      deviceStatus: { deviceId, deviceName, verified } } }
// ════════════════════════════════════════════════════════════════════════════

import 'dart:convert';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:http/http.dart' as http;
import '../config/api_config.dart';
import 'device_info_service.dart';

class AuthException implements Exception {
  final int statusCode;
  final String message;
  AuthException(this.statusCode, this.message);
  @override
  String toString() => message;
}

/// Exception khusus untuk device lock — dibedakan agar UI bisa tampilkan
/// pesan spesifik "perangkat tidak terverifikasi" bukan pesan generic.
class DeviceLockException implements Exception {
  final String message;
  DeviceLockException([
    this.message = 'Akses Ditolak. Anda hanya dapat mengikuti ujian menggunakan perangkat yang telah terverifikasi di awal sesi.',
  ]);
  @override
  String toString() => message;
}

class AuthRepository {
  AuthRepository._();

  static const _storage = FlutterSecureStorage();

  /// Login siswa dengan NISN + password + Token Sesi + Device ID.
  /// Simpan accessToken & device info ke secure storage.
  /// Return StudentProfile jika sukses, throw DeviceLockException jika perangkat dikunci.
  static Future<StudentProfile> login({
    required String nisn,
    required String password,
    required String sessionToken,
  }) async {
    // Ambil device info sebelum request
    final deviceId   = await DeviceInfoService.getDeviceId();
    final deviceName = await DeviceInfoService.getDeviceName();

    final res = await http.post(
      Uri.parse('${ApiConfig.baseUrl}/auth/login'),
      headers: ApiConfig.headers(null),
      body: jsonEncode({
        'nisn':         nisn.trim(),
        'password':     password,
        'sessionToken': sessionToken.trim().toUpperCase(),
        'device_id':    deviceId,
        'device_name':  deviceName,
      }),
    ).timeout(const Duration(seconds: 10));

    final data = jsonDecode(res.body) as Map<String, dynamic>;

    // Device lock — perangkat berbeda
    if (res.statusCode == 403 && data['error']?['code'] == 'DEVICE_LOCKED') {
      throw DeviceLockException(
        data['error']?['message'] ??
            'Akses Ditolak. Anda hanya dapat mengikuti ujian menggunakan perangkat yang telah terverifikasi di awal sesi.',
      );
    }

    if (res.statusCode == 200 && data['success'] == true) {
      final token = data['data']['accessToken'] as String;
      await _storage.write(key: 'access_token', value: token);

      // Simpan device info untuk digunakan di UI (Device Status Card)
      await _storage.write(key: 'local_device_id',   value: deviceId);
      await _storage.write(key: 'local_device_name', value: deviceName);

      // Simpan status verifikasi dari server
      final deviceStatus = data['data']['deviceStatus'];
      if (deviceStatus != null) {
        await _storage.write(key: 'device_verified', value: 'true');
      }

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

  /// Ambil role tersimpan.
  static Future<String> getRole() async {
    return await _storage.read(key: 'user_role') ?? '';
  }

  /// Simpan role.
  static Future<void> saveRole(String role) async {
    await _storage.write(key: 'user_role', value: role);
  }

  /// Ambil nama perangkat lokal yang tersimpan.
  static Future<String> getLocalDeviceName() async {
    return await _storage.read(key: 'local_device_name') ?? await DeviceInfoService.getDeviceName();
  }

  /// Hapus token — dipanggil saat logout / auto-logout tengah malam.
  static Future<void> logout() async {
    await _storage.delete(key: 'access_token');
    await _storage.delete(key: 'user_role');
    await _storage.delete(key: 'exam_attempt_id');
    await _storage.delete(key: 'device_verified');
    // SENGAJA tidak hapus local_device_id & local_device_name
    // agar ID tetap konsisten pada sesi berikutnya
    DeviceInfoService.clearCache();
  }

  /// Ambil profil user yang sedang login dari server.
  /// Endpoint: GET /api/auth/me
  static Future<Map<String, dynamic>> me() async {
    final token = await getToken();
    final res = await http.get(
      Uri.parse('${ApiConfig.baseUrl}/auth/me'),
      headers: ApiConfig.headers(token),
    ).timeout(const Duration(seconds: 10));
    final data = jsonDecode(res.body) as Map<String, dynamic>;
    if (res.statusCode == 200 && data['success'] == true) {
      return data['data'] as Map<String, dynamic>;
    }
    throw AuthException(
      res.statusCode,
      data['error']?['message'] ?? data['message'] ?? 'Gagal memuat profil.',
    );
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
