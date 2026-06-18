import 'dart:io';
import 'package:device_info_plus/device_info_plus.dart';
import 'package:flutter/services.dart';
import 'package:network_info_plus/network_info_plus.dart';
import 'package:wakelock_plus/wakelock_plus.dart';

class SecurityGuard {
  SecurityGuard._();

  static const MethodChannel _channel = MethodChannel('com.exam.poncol/security');

  // ===== Wakelock =====
  static Future<void> enableWakelock() => WakelockPlus.enable();
  static Future<void> disableWakelock() => WakelockPlus.disable();

  // ===== Immersive Mode (Native Flutter) =====
  static Future<void> enterImmersiveMode() {
    return SystemChrome.setEnabledSystemUIMode(SystemUiMode.immersiveSticky);
  }

  static Future<void> exitImmersiveMode() {
    return SystemChrome.setEnabledSystemUIMode(
      SystemUiMode.manual,
      overlays: SystemUiOverlay.values,
    );
  }

  // ===== Lock/Unlock UI via Native (total lockdown) =====
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

  // ===== FLAG_SECURE (Screenshot Protection) =====
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

  // ===== Device Info =====
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

  // ===== Network Info =====
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