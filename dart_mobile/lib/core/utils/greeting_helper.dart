/// Utility untuk sapaan kontekstual berdasarkan jam dan format tanggal
/// berbahasa Indonesia — dipakai di Login & Home untuk mengisi ruang kosong
/// dengan elemen yang manusiawi namun tetap clean (bukan dekorasi).
class GreetingHelper {
  GreetingHelper._();

  /// "Selamat pagi" (00:00–10.59), "Selamat siang" (11:00–14.59),
  /// "Selamat sore" (15:00–17.59), "Selamat malam" (18:00–23.59).
  static String greeting([DateTime? now]) {
    final hour = (now ?? DateTime.now()).hour;
    if (hour < 11) return 'Selamat pagi';
    if (hour < 15) return 'Selamat siang';
    if (hour < 18) return 'Selamat sore';
    return 'Selamat malam';
  }

  static const List<String> _hari = [
    'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu', 'Minggu',
  ];

  static const List<String> _bulan = [
    '', 'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
    'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember',
  ];

  /// Format "Rabu, 18 Juni 2026".
  static String fullDate([DateTime? now]) {
    final d = now ?? DateTime.now();
    // DateTime.weekday: 1=Senin ... 7=Minggu → index 0..6
    final namaHari = _hari[d.weekday - 1];
    return '$namaHari, ${d.day} ${_bulan[d.month]} ${d.year}';
  }

  /// Format "Selasa - 17 Juni 2026" — dipakai sebagai header pengelompokan
  /// di History Screen, sesuai spesifikasi Hero Exam PRD Addendum
  /// Bagian 40.B (Grouped History Cards): "header/title penanda waktu
  /// berformat 'Hari - Tanggal'".
  static String dashDate([DateTime? now]) {
    final d = now ?? DateTime.now();
    final namaHari = _hari[d.weekday - 1];
    return '$namaHari - ${d.day} ${_bulan[d.month]} ${d.year}';
  }
}