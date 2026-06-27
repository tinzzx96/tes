import 'package:flutter/foundation.dart';
import 'package:socket_io_client/socket_io_client.dart' as io;
import 'auth_repository.dart';
import '../config/api_config.dart';

/// Service untuk mengelola koneksi real-time WebSocket via Socket.io.
///
/// Digunakan oleh aplikasi untuk menerima pemberitahuan instan dari proctor/admin,
/// seperti generate PIN baru, status perubahan siswa, dan reset sesi siswa.
class SocketService {
  SocketService._();
  static final SocketService instance = SocketService._();

  io.Socket? _socket;

  // Event Notifiers agar UI dapat mendengarkan perubahan secara reaktif.
  final ValueNotifier<Map<String, dynamic>?> pinGeneratedEvent = ValueNotifier(null);
  final ValueNotifier<Map<String, dynamic>?> studentResetEvent = ValueNotifier(null);
  final ValueNotifier<Map<String, dynamic>?> studentStatusChangedEvent = ValueNotifier(null);
  final ValueNotifier<Map<String, dynamic>?> examStatusChangedEvent = ValueNotifier(null);

  bool get isConnected => _socket?.connected ?? false;

  /// Mengirim event ke server websocket
  void emit(String event, dynamic data) {
    if (_socket != null && _socket!.connected) {
      _socket!.emit(event, data);
    }
  }

  /// Menginisialisasi dan menghubungkan ke server WebSocket.
  Future<void> connect() async {
    if (_socket != null) {
      if (_socket!.connected) return;
      _socket!.connect();
      return;
    }

    final token = await AuthRepository.getToken();
    if (token.isEmpty) {
      debugPrint('[SocketService] Token tidak ditemukan. Batal menghubungkan.');
      return;
    }

    // Parse root URL dari ApiConfig.baseUrl (mis. 'http://10.0.2.2:8000/api' -> 'http://10.0.2.2:8000')
    final socketUrl = ApiConfig.baseUrl.replaceAll('/api', '');

    debugPrint('[SocketService] Menghubungkan ke WebSocket di $socketUrl...');
    _socket = io.io(socketUrl, io.OptionBuilder()
      .setTransports(['websocket'])
      .disableAutoConnect()
      .setAuth({'token': token})
      .build());

    _socket!.onConnect((_) async {
      debugPrint('[SocketService] Terhubung ke server WebSocket.');

      // Otomatis gabung ke room sesuai ruang kelas siswa
      try {
        final studentMap = await AuthRepository.me();
        final roomName = studentMap['room'];
        if (roomName != null && roomName.toString().isNotEmpty) {
          joinRoom(roomName.toString());
        }
      } catch (e) {
        debugPrint('[SocketService] Gagal join room otomatis: $e');
      }
    });

    _socket!.onDisconnect((_) {
      debugPrint('[SocketService] Koneksi WebSocket terputus.');
    });

    _socket!.onConnectError((err) {
      debugPrint('[SocketService] Error koneksi WebSocket: $err');
    });

    // ── WebSocket Listeners ──────────────────────────────────────────────────
    _socket!.on('pin-generated', (data) {
      debugPrint('[SocketService] Event received: pin-generated -> $data');
      pinGeneratedEvent.value = Map<String, dynamic>.from(data);
    });

    _socket!.on('student-reset', (data) {
      debugPrint('[SocketService] Event received: student-reset -> $data');
      studentResetEvent.value = Map<String, dynamic>.from(data);
    });

    _socket!.on('student-status-changed', (data) {
      debugPrint('[SocketService] Event received: student-status-changed -> $data');
      studentStatusChangedEvent.value = Map<String, dynamic>.from(data);
    });

    _socket!.on('exam-status-changed', (data) {
      debugPrint('[SocketService] Event received: exam-status-changed -> $data');
      examStatusChangedEvent.value = Map<String, dynamic>.from(data);
    });

    _socket!.connect();
  }

  /// Bergabung ke room WebSocket tertentu.
  void joinRoom(String roomName) {
    if (_socket == null || !_socket!.connected) {
      debugPrint('[SocketService] Gagal join room. Socket tidak terhubung.');
      return;
    }
    debugPrint('[SocketService] Bergabung ke room: $roomName');
    _socket!.emit('join-room', {'roomName': roomName});
  }

  /// Memutuskan koneksi WebSocket secara bersih.
  void disconnect() {
    if (_socket != null) {
      _socket!.disconnect();
      _socket = null;
      debugPrint('[SocketService] Koneksi ditutup.');
    }
  }
}
