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
  /// floating app terdeteksi segera tanpa delay 1 detik. Channel name HARUS
  /// identik dengan FOCUS_CHANNEL di MainActivity.java.
  static const EventChannel _focusChannel =
  EventChannel('com.exam.poncol/focus_events');

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
  ///
  /// CATATAN: floating app PIHAK KETIGA dari Play Store (mis. floating
  /// browser) yang pakai SYSTEM_ALERT_WINDOW seringkali SENGAJA didesain
  /// untuk tidak mencuri window focus, sehingga method ini bisa gagal
  /// mendeteksinya. Untuk kasus itu, gunakan isOtherAppForeground() sebagai
  /// sinyal tambahan.
  static Future<bool> hasWindowFocus() async {
    try {
      final result = await _channel.invokeMethod<bool>('hasWindowFocus');
      return result ?? true;
    } catch (_) {
      return true;
    }
  }

  /// Stream yang memancarkan [false] setiap kali window Activity KEHILANGAN
  /// fokus (floating app/overlay/dialog sistem muncul di atasnya) dan
  /// [true] saat fokus kembali. Menggunakan EventChannel sehingga
  /// notifikasi INSTAN dari native — tidak menunggu polling 1 detik dari
  /// anti-cheat timer.
  ///
  /// CATATAN PENTING: sinyal [false] juga terpicu oleh dialog SISTEM
  /// Android sendiri (mis. dialog konfirmasi "Pasang layar ini?" saat
  /// startLockTask() pertama kali dipanggil), bukan hanya floating app
  /// musuh. Pemanggil (ExamPlayerScreen) WAJIB menerapkan grace period di
  /// awal boot sebelum memperlakukan sinyal ini sebagai pelanggaran — lihat
  /// _kFocusGracePeriod di exam_player_screen.dart.
  static Stream<bool> get windowFocusStream {
    return _focusChannel.receiveBroadcastStream().map((event) => event as bool);
  }

  // ===== Usage Access — deteksi floating app pihak ketiga =====

  /// Mengecek apakah izin "Usage Access" (PACKAGE_USAGE_STATS) sudah
  /// diaktifkan murid lewat Settings. Ini WAJIB diaktifkan manual oleh user
  /// karena merupakan special permission — tidak bisa lewat dialog biasa.
  static Future<bool> hasUsageStatsPermission() async {
    try {
      final result =
      await _channel.invokeMethod<bool>('hasUsageStatsPermission');
      return result ?? false;
    } catch (_) {
      return false;
    }
  }

  /// Membuka halaman Settings > Apps > Special Access > Usage Access,
  /// supaya murid bisa mengaktifkan izin secara manual sebelum ujian
  /// dimulai. Sebaiknya dipanggil dari Halaman Validasi Awal (sebelum
  /// masuk ExamPlayerScreen), bukan saat ujian sudah berjalan.
  static Future<void> openUsageAccessSettings() async {
    try {
      await _channel.invokeMethod('openUsageAccessSettings');
    } catch (_) {}
  }

  /// Mengecek apakah ada app LAIN (bukan app ujian ini) yang baru saja
  /// pindah ke foreground dalam ~4 detik terakhir. Ini sinyal tambahan
  /// untuk mendeteksi floating app/browser pihak ketiga (mis. dari Play
  /// Store) yang tampil di atas layar ujian tanpa mencuri window focus.
  /// Mengembalikan false jika izin Usage Access belum diaktifkan.
  static Future<bool> isOtherAppForeground() async {
    try {
      final result = await _channel.invokeMethod<bool>('isOtherAppForeground');
      return result ?? false;
    } catch (_) {
      return false;
    }
  }

  // ===== Shortcut ke Settings Sistem =====

  /// Membuka halaman pengaturan WiFi sistem Android (Settings.ACTION_WIFI_
  /// SETTINGS). Dipakai oleh tombol indikator WiFi di header — app TIDAK
  /// bisa menyalakan/mematikan WiFi secara langsung (itu kontrol sistem,
  /// bukan kewenangan app biasa di Android modern), jadi ini hanya
  /// shortcut supaya murid tidak perlu keluar manual mencari menu Settings.
  static Future<void> openWifiSettings() async {
    try {
      await _channel.invokeMethod('openWifiSettings');
    } catch (_) {}
  }

  /// Membuka halaman pengaturan jaringan/data seluler sistem Android.
  /// Sama seperti openWifiSettings, ini cuma shortcut — app tidak bisa
  /// toggle data seluler secara programatik.
  static Future<void> openNetworkSettings() async {
    try {
      await _channel.invokeMethod('openNetworkSettings');
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