// lib/core/config/api_config.dart
// ════════════════════════════════════════════════════════════════════════════
// HERO EXAM — Konfigurasi Base URL
// ════════════════════════════════════════════════════════════════════════════

import 'dart:io';
import 'package:flutter/foundation.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import '../utils/device_info_service.dart';

class ApiConfig {
  ApiConfig._();

  static const _storage = FlutterSecureStorage();
  
  // Default values
  static String _baseUrl = 'http://127.0.0.1:8000/api';

  static String get baseUrl => _baseUrl;

  /// Inisialisasi base URL. 
  /// Mencoba membaca dari secure storage, jika kosong gunakan default berdasarkan platform.
  static Future<void> initialize() async {
    try {
      final saved = await _storage.read(key: 'custom_base_url');
      if (saved != null && saved.trim().isNotEmpty) {
        _baseUrl = saved.trim();
        return;
      }
    } catch (_) {}

    // Default based on platform
    if (kIsWeb) {
      _baseUrl = 'http://localhost:8000/api';
    } else {
      try {
        if (Platform.isAndroid) {
          _baseUrl = 'http://10.0.2.2:8000/api';
        } else {
          _baseUrl = 'http://127.0.0.1:8000/api';
        }
      } catch (_) {
        _baseUrl = 'http://127.0.0.1:8000/api';
      }
    }

    // Pre-cache device ID agar request pertama tidak delay
    try {
      await DeviceInfoService.getDeviceId();
    } catch (_) {}
  }

  /// Simpan custom base URL ke storage
  static Future<void> saveBaseUrl(String url) async {
    String cleanUrl = url.trim();
    if (cleanUrl.isNotEmpty) {
      // Pastikan format http:// atau https:// ada
      if (!cleanUrl.startsWith('http://') && !cleanUrl.startsWith('https://')) {
        cleanUrl = 'http://$cleanUrl';
      }
      // Pastikan diakhiri dengan /api
      if (!cleanUrl.endsWith('/api')) {
        if (cleanUrl.endsWith('/')) {
          cleanUrl = '${cleanUrl}api';
        } else {
          cleanUrl = '$cleanUrl/api';
        }
      }
      _baseUrl = cleanUrl;
      try {
        await _storage.write(key: 'custom_base_url', value: cleanUrl);
      } catch (_) {}
    }
  }

  // ── Header standar (tanpa device ID) ──────────────────────────────────────
  // Dipakai untuk: health-check, login, logout, /auth/me
  static Map<String, String> headers(String? token) => {
        'Content-Type': 'application/json',
        if (token != null) 'Authorization': 'Bearer $token',
      };

  // ── Header dengan device ID (untuk request kritis) ─────────────────────────
  // Dipakai untuk: startExam, submitExam, saveAnswer, reportViolation, dll.
  // x-device-id header inilah yang diperiksa oleh deviceCheck middleware.
  static Future<Map<String, String>> headersWithDevice(String? token) async {
    final deviceId = await DeviceInfoService.getDeviceId();
    return {
      'Content-Type': 'application/json',
      if (token != null) 'Authorization': 'Bearer $token',
      'x-device-id': deviceId,
    };
  }
}