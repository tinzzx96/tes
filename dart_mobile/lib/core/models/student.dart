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
  final bool screenSharingActive;
  final bool proctorVisibilityOn;

  const Student({
    required this.name,
    required this.nisn,
    required this.classLabel,
    required this.deviceName,
    required this.roomName,
    required this.networkName,
    this.sessionActive = true,
    this.screenSharingActive = true,
    this.proctorVisibilityOn = true,
  });

  /// Inisial nama untuk avatar badge, contoh "Danang Prakoso" -> "DP".
  String get initials {
    final parts = name.trim().split(RegExp(r'\s+'));
    if (parts.isEmpty) return '';
    if (parts.length == 1) {
      return parts.first.substring(0, 1).toUpperCase();
    }
    final first = parts.first.substring(0, 1);
    final last = parts.last.substring(0, 1);
    return (first + last).toUpperCase();
  }
}
