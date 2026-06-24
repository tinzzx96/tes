// lib/core/utils/monitor_repository.dart
// ════════════════════════════════════════════════════════════════════════════
// HERO EXAM — Monitor Repository (Heartbeat)
//
// PERUBAHAN dari versi lama:
//   Body berubah: { exam_id } → { examAttemptId, device }
//   Endpoint: POST /api/monitor/heartbeat (TIDAK BERUBAH)
//
// Heartbeat dikirim setiap 30 detik selama ujian berlangsung.
// Jika siswa tidak kirim heartbeat > 90 detik → status otomatis 'offline'
// di dashboard pengawas.
// ════════════════════════════════════════════════════════════════════════════

import 'dart:async';
import 'dart:convert';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:http/http.dart' as http;
import '../config/api_config.dart';
import 'auth_repository.dart';

class MonitorRepository {
  MonitorRepository._();

  static const _storage = FlutterSecureStorage();
  static Timer? _heartbeatTimer;

  /// Kirim satu heartbeat ke server.
  /// Silent fail — jangan throw ke UI.
  static Future<HeartbeatResult?> sendHeartbeat({
    String? deviceName,
  }) async {
    try {
      final token = await AuthRepository.getToken();
      final attemptIdStr = await _storage.read(key: 'exam_attempt_id');
      if (attemptIdStr == null) return null;

      final res = await http.post(
        Uri.parse('${ApiConfig.baseUrl}/monitor/heartbeat'),
        headers: ApiConfig.headers(token),
        body: jsonEncode({
          'examAttemptId': int.parse(attemptIdStr),
          if (deviceName != null) 'device': deviceName,
        }),
      );

      if (res.statusCode == 200) {
        final data = jsonDecode(res.body) as Map<String, dynamic>;
        if (data['success'] == true) {
          return HeartbeatResult.fromJson(data['data'] as Map<String, dynamic>);
        }
      }
    } catch (_) {
      // Koneksi putus — normal, akan dicoba lagi 30 detik kemudian
    }
    return null;
  }

  /// Mulai heartbeat otomatis setiap 30 detik.
  /// Panggil di initState ExamPlayerScreen.
  /// Hentikan di dispose() / beforeUnmount().
  static void startHeartbeat({String? deviceName}) {
    stopHeartbeat(); // hindari double timer
    _heartbeatTimer = Timer.periodic(
      const Duration(seconds: 30),
      (_) => sendHeartbeat(deviceName: deviceName),
    );
    // Kirim satu heartbeat langsung (tidak tunggu 30 detik pertama)
    sendHeartbeat(deviceName: deviceName);
  }

  /// Hentikan heartbeat — panggil di dispose() ExamPlayerScreen.
  static void stopHeartbeat() {
    _heartbeatTimer?.cancel();
    _heartbeatTimer = null;
  }
}

// ── Model ─────────────────────────────────────────────────────────────────────
class HeartbeatResult {
  final bool received;
  final DateTime serverTime;
  final int counterPelanggaran;

  const HeartbeatResult({
    required this.received,
    required this.serverTime,
    required this.counterPelanggaran,
  });

  factory HeartbeatResult.fromJson(Map<String, dynamic> json) => HeartbeatResult(
        received: json['received'] as bool? ?? false,
        serverTime: json['serverTime'] != null
            ? DateTime.parse(json['serverTime'])
            : DateTime.now(),
        counterPelanggaran: json['counterPelanggaran'] as int? ?? 0,
      );
}
