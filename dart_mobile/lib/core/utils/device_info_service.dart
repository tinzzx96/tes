// lib/core/utils/device_info_service.dart
// ════════════════════════════════════════════════════════════════════════════
// HERO EXAM — Device Info Service
//
// Mengambil ID unik perangkat dan nama perangkat yang human-readable.
// Digunakan oleh:
//   - LoginScreen   : tampilkan nama perangkat di form login (transparansi)
//   - AuthRepository: kirim device_id + device_name saat login (PRD Bagian 26)
//   - ApiConfig     : tambahkan x-device-id header ke semua request kritis
// ════════════════════════════════════════════════════════════════════════════

import 'dart:io';
import 'package:device_info_plus/device_info_plus.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';

class DeviceInfoService {
  DeviceInfoService._();

  static const _storage = FlutterSecureStorage();
  static const _keyDeviceId   = 'device_unique_id';
  static const _keyDeviceName = 'device_display_name';

  static String? _cachedDeviceId;
  static String? _cachedDeviceName;

  /// Ambil Device ID unik (cached ke secure storage untuk konsistensi).
  static Future<String> getDeviceId() async {
    if (_cachedDeviceId != null) return _cachedDeviceId!;

    // Cek cache di storage terlebih dahulu
    final stored = await _storage.read(key: _keyDeviceId);
    if (stored != null && stored.isNotEmpty) {
      _cachedDeviceId = stored;
      return stored;
    }

    final id = await _fetchNativeDeviceId();
    _cachedDeviceId = id;
    await _storage.write(key: _keyDeviceId, value: id);
    return id;
  }

  /// Ambil nama perangkat yang human-readable (misal "Redmi Note 12").
  static Future<String> getDeviceName() async {
    if (_cachedDeviceName != null) return _cachedDeviceName!;

    final stored = await _storage.read(key: _keyDeviceName);
    if (stored != null && stored.isNotEmpty) {
      _cachedDeviceName = stored;
      return stored;
    }

    final name = await _fetchNativeDeviceName();
    _cachedDeviceName = name;
    await _storage.write(key: _keyDeviceName, value: name);
    return name;
  }

  /// Reset cache (dipanggil saat logout)
  static void clearCache() {
    _cachedDeviceId   = null;
    _cachedDeviceName = null;
    // Sengaja TIDAK menghapus dari storage agar ID tetap konsisten
    // pada sesi berikutnya di perangkat yang sama.
  }

  // ── Private helpers ────────────────────────────────────────────────────────

  static Future<String> _fetchNativeDeviceId() async {
    try {
      final plugin = DeviceInfoPlugin();

      if (kIsWeb) {
        final info = await plugin.webBrowserInfo;
        // Web tidak punya device ID yang stabil; gunakan kombinasi user agent hash
        return 'web-${info.userAgent?.hashCode.abs() ?? 0}';
      }

      if (Platform.isAndroid) {
        final info = await plugin.androidInfo;
        // androidId: stable per device + factory reset
        return info.id.isNotEmpty ? info.id : 'android-${info.device}-${info.model}'.hashCode.abs().toString();
      }

      if (Platform.isIOS) {
        final info = await plugin.iosInfo;
        return info.identifierForVendor ?? 'ios-unknown';
      }

      if (Platform.isWindows) {
        final info = await plugin.windowsInfo;
        return info.deviceId.isNotEmpty ? info.deviceId : 'win-${info.computerName}'.hashCode.abs().toString();
      }

      if (Platform.isLinux) {
        final info = await plugin.linuxInfo;
        return info.machineId ?? 'linux-${info.name}'.hashCode.abs().toString();
      }

      if (Platform.isMacOS) {
        final info = await plugin.macOsInfo;
        return 'mac-${info.systemGUID ?? info.computerName}';
      }
    } catch (_) {}

    // Fallback: generate random stable ID
    return 'fallback-${DateTime.now().millisecondsSinceEpoch}';
  }

  static Future<String> _fetchNativeDeviceName() async {
    try {
      final plugin = DeviceInfoPlugin();

      if (kIsWeb) {
        final info = await plugin.webBrowserInfo;
        return info.browserName.name;
      }

      if (Platform.isAndroid) {
        final info = await plugin.androidInfo;
        // Contoh: "Redmi Note 12" atau "Samsung Galaxy A53"
        final brand = _capitalize(info.brand);
        final model = info.model;
        return '$brand $model'.trim();
      }

      if (Platform.isIOS) {
        final info = await plugin.iosInfo;
        return info.name.isNotEmpty ? info.name : info.utsname.machine;
      }

      if (Platform.isWindows) {
        final info = await plugin.windowsInfo;
        return info.computerName.isNotEmpty ? info.computerName : 'Windows PC';
      }

      if (Platform.isLinux) {
        final info = await plugin.linuxInfo;
        return info.prettyName.isNotEmpty ? info.prettyName : 'Linux PC';
      }

      if (Platform.isMacOS) {
        final info = await plugin.macOsInfo;
        return info.computerName.isNotEmpty ? info.computerName : 'Mac';
      }
    } catch (_) {}

    return 'Perangkat Tidak Dikenal';
  }

  static String _capitalize(String s) {
    if (s.isEmpty) return s;
    return s[0].toUpperCase() + s.substring(1).toLowerCase();
  }
}
