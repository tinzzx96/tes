import 'dart:io';
import 'package:device_info_plus/device_info_plus.dart';
import 'package:flutter/services.dart';
import 'package:network_info_plus/network_info_plus.dart';
import 'package:wakelock_plus/wakelock_plus.dart';

class SecurityGuard {
  SecurityGuard._();

  static const MethodChannel _channel = MethodChannel('com.exam.poncol/security');

  /// EventChannel untuk notifikasi instan saat window Activity kehilangan
  /// fokus — digunakan sebagai pengganti polling hasWindowFocus() agar
  /// floating app terdeteksi segera tanpa delay 1 detik.
  static const EventChannel _focusChannel = EventChannel('com.exam.poncol/focus_events');

  // ===== Wakelock =====
  static Future<void> enableWakelock() => WakelockPlus.enable();
  static Future<void> disableWakelock() => WakelockPlus.disable();

  // ===== Immersive Mode =====
  static Future<void> enterImmersiveMode() {
    return SystemChrome.setEnabledSystemUIMode(SystemUiMode.immersiveSticky);
  }

  static Future<void> exitImmersiveMode() {
    return SystemChrome.setEnabledSystemUIMode(
      SystemUiMode.manual,
      overlays: SystemUiOverlay.values,
    );
  }

  // ===== Lock/Unlock UI =====
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

  // ===== FLAG_SECURE =====
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

  // ===== Screen Pinning (LockTask) =====

  /// Memicu startLockTask() di sisi Android — menyematkan layar agar murid
  /// tidak bisa keluar ke home/recent apps. Perlu konfirmasi murid (dialog
  /// sistem Android) atau whitelist DPC untuk silent pinning.
  static Future<void> startLockTask() async {
    try {
      await _channel.invokeMethod('startLockTask');
    } catch (_) {}
  }

  /// Melepas screen pinning. Dipanggil saat ujian selesai / submit normal.
  static Future<void> stopLockTask() async {
    try {
      await _channel.invokeMethod('stopLockTask');
    } catch (_) {}
  }

  /// Mengembalikan true jika layar sedang dalam kondisi disematkan
  /// (LOCK_TASK_MODE_LOCKED atau LOCK_TASK_MODE_PINNED).
  static Future<bool> isScreenPinned() async {
    try {
      final result = await _channel.invokeMethod<bool>('isScreenPinned');
      return result ?? false;
    } catch (_) {
      return false;
    }
  }

  /// Mengembalikan true jika window Activity MASIH memegang fokus input
  /// (tidak ada overlay/floating app di atasnya). Ini mendeteksi floating
  /// window OEM (Smart Sidebar, Floating Apps Oppo/Vivo/Realme, dsb) yang
  /// TIDAK memicu perubahan AppLifecycleState karena bukan Activity baru,
  /// hanya window overlay biasa — sehingga WidgetsBindingObserver saja
  /// tidak cukup untuk mendeteksinya.
  static Future<bool> hasWindowFocus() async {
    try {
      final result = await _channel.invokeMethod<bool>('hasWindowFocus');
      return result ?? true;
    } catch (_) {
      return true;
    }
  }

  /// Stream yang memancarkan [false] setiap kali window Activity KEHILANGAN
  /// fokus (floating app/overlay muncul di atasnya) dan [true] saat fokus
  /// kembali. Menggunakan EventChannel sehingga notifikasi INSTAN dari
  /// native — tidak menunggu polling 1 detik dari anti-cheat timer.
  static Stream<bool> get windowFocusStream {
    return _focusChannel
        .receiveBroadcastStream()
        .map((event) => event as bool);
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