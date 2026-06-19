import 'dart:io';
import 'package:device_info_plus/device_info_plus.dart';
import 'package:flutter/services.dart';
import 'package:network_info_plus/network_info_plus.dart';
import 'package:wakelock_plus/wakelock_plus.dart';

class SecurityGuard {
  SecurityGuard._();

  static const MethodChannel _channel = MethodChannel('com.exam.poncol/security');

  // ── Wakelock ──────────────────────────────────────────────────────────────
  static Future<void> enableWakelock() => WakelockPlus.enable();
  static Future<void> disableWakelock() => WakelockPlus.disable();

  // ── Immersive Mode ────────────────────────────────────────────────────────
  static Future<void> enterImmersiveMode() =>
      SystemChrome.setEnabledSystemUIMode(SystemUiMode.immersiveSticky);

  static Future<void> exitImmersiveMode() => SystemChrome.setEnabledSystemUIMode(
    SystemUiMode.manual,
    overlays: SystemUiOverlay.values,
  );

  // ── Immersive UI Lock (existing) ──────────────────────────────────────────
  static Future<void> lockUi() async {
    try {
      await _channel.invokeMethod('lockUi');
    } catch (_) {}
  }

  static Future<void> unlockUi() async {
    try {
      await _channel.invokeMethod('unlockUi');
    } catch (_) {}
  }

  // ── FLAG_SECURE — Screenshot & Recording Protection ───────────────────────
  static Future<void> enableScreenProtection() async {
    try {
      await _channel.invokeMethod('enableSecureFlag');
    } catch (_) {}
  }

  static Future<void> disableScreenProtection() async {
    try {
      await _channel.invokeMethod('disableSecureFlag');
    } catch (_) {}
  }

  // ── Screen Pinning (PRD §18) ──────────────────────────────────────────────

  /// Mengaktifkan Screen Pinning Android + FLAG_SECURE + Immersive Mode
  /// lewat satu panggilan native. Siswa perlu menekan "Mengerti" pada
  /// dialog konfirmasi sistem Android untuk menyelesaikan proses semat.
  static Future<void> startLockTask() async {
    try {
      await _channel.invokeMethod('startLockTask');
    } catch (_) {}
  }

  /// Melepas Screen Pinning dan mencabut FLAG_SECURE.
  /// Dipanggil saat ujian di-submit atau pengawas membuka blokir.
  static Future<void> stopLockTask() async {
    try {
      await _channel.invokeMethod('stopLockTask');
    } catch (_) {}
  }

  /// Mengembalikan `true` jika Screen Pinning sedang aktif.
  /// Dipakai oleh anti-cheat loop di [ExamPlayerPage].
  static Future<bool> isScreenPinned() async {
    try {
      return await _channel.invokeMethod<bool>('isScreenPinned') ?? false;
    } catch (_) {
      return false;
    }
  }

  // ── Device Info ───────────────────────────────────────────────────────────
  static Future<String> getDeviceName() async {
    final plugin = DeviceInfoPlugin();
    try {
      if (Platform.isAndroid) {
        final info = await plugin.androidInfo;
        return '${info.manufacturer} ${info.model}'.trim().toUpperCase();
      }
      if (Platform.isIOS) {
        final info = await plugin.iosInfo;
        return info.utsname.machine.toUpperCase();
      }
    } catch (_) {}
    return 'UNKNOWN DEVICE';
  }

  // ── Network Info ──────────────────────────────────────────────────────────
  static Future<String> getWifiName() async {
    final info = NetworkInfo();
    try {
      final name = await info.getWifiName();
      if (name == null || name.isEmpty) return 'UNKNOWN-NETWORK';
      return name.replaceAll('"', '');
    } catch (_) {
      return 'UNKNOWN-NETWORK';
    }
  }

  static Future<String?> getLocalIp() async {
    final info = NetworkInfo();
    try {
      return await info.getWifiIP();
    } catch (_) {
      return null;
    }
  }
}
