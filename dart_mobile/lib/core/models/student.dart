/// Model data siswa yang sedang login.
///
/// Field merefleksikan kolom relevan dari tabel `users` (LOGIC.md / Hero Exam
/// PRD Section 23) yang dibutuhkan oleh Home & Login screen.
class Student {
  final String name; // contoh: "Danang Prakoso"
  final String nisn; // contoh: "0023456789"
  final String classLabel; // contoh: "XI RPL 1"
  final String deviceName; // contoh: "ASUS X409FA"
  final String roomName; // contoh: "RUANG - 14"
  final String networkName; // contoh: "LAN-EXAM-14"
  final bool sessionActive;
  // ── Device Lock PRD Bagian 38 ──────────────────────────────────────────
  // True jika device yang dipakai sesuai dengan yang terdaftar di server.
  // Setelah login sukses ini SELALU true (karena login sendiri sudah
  // memvalidasi device). Nilainya bisa false jika ada anomali terdeteksi.
  final bool deviceVerified;

  const Student({
    required this.name,
    required this.nisn,
    required this.classLabel,
    this.deviceName = '',
    this.roomName = '',
    this.networkName = '',
    this.sessionActive = true,
    this.deviceVerified = true,
  });

  /// Inisial nama untuk avatar badge, contoh "Danang Prakoso" -> "DP".
  String get initials {
    final parts = name.trim().split(RegExp(r'\s+'));
    if (parts.isEmpty) return '';
    if (parts.length == 1) {
      return parts.first.isNotEmpty ? parts.first.substring(0, 1).toUpperCase() : '';
    }
    final first = parts.first.isNotEmpty ? parts.first.substring(0, 1) : '';
    final last = parts.last.isNotEmpty ? parts.last.substring(0, 1) : '';
    return (first + last).toUpperCase();
  }

  Student copyWith({
    String? name,
    String? nisn,
    String? classLabel,
    String? deviceName,
    String? roomName,
    String? networkName,
    bool? sessionActive,
    bool? deviceVerified,
  }) {
    return Student(
      name: name ?? this.name,
      nisn: nisn ?? this.nisn,
      classLabel: classLabel ?? this.classLabel,
      deviceName: deviceName ?? this.deviceName,
      roomName: roomName ?? this.roomName,
      networkName: networkName ?? this.networkName,
      sessionActive: sessionActive ?? this.sessionActive,
      deviceVerified: deviceVerified ?? this.deviceVerified,
    );
  }

  factory Student.fromJson(Map<String, dynamic> json) {
    final room = json['room']?.toString() ?? '';
    return Student(
      name: json['name'] ?? '',
      nisn: json['nisn'] ?? '',
      classLabel: json['class'] ?? '',
      deviceName: json['device'] ?? '',
      roomName: room,
      networkName: room.isNotEmpty ? 'LAN-EXAM-$room' : '',
      sessionActive: true,
      // Backend hanya mengembalikan deviceStatus.verified saat login sukses.
      // Jika tidak ada field ini, kita asumsikan terverifikasi (login baru saja berhasil).
      deviceVerified: json['deviceVerified'] ?? true,
    );
  }
}

