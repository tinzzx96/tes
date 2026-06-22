/// Hasil validasi Token Ujian yang dimasukkan murid sebelum memulai ujian.
class TokenValidationResult {
  final bool isValid;
  final String? errorMessage;

  const TokenValidationResult._(this.isValid, this.errorMessage);

  factory TokenValidationResult.success() =>
      const TokenValidationResult._(true, null);

  factory TokenValidationResult.failure(String message) =>
      TokenValidationResult._(false, message);
}

/// Token Ujian — kode unik yang di-generate per sesi ujian (BUKAN "Token
/// Sesi" di Login Screen, yang berfungsi untuk validasi identitas/
/// perangkat awal — lihat LoginScreen). Token Ujian ini diminta ulang
/// setiap kali murid menekan "MULAI UJIAN" di Home Screen.
///
/// TODO(integrasi-backend): generate & validasi Token Ujian SEPENUHNYA
/// ditangani backend Node.js via schema.prisma (model exam_tokens, sudah
/// ada di skema database — PRD Bagian 23). TIDAK PERLU menambah kolom baru
/// di database untuk fitur ini. Endpoint yang dipanggil nanti:
///
///   POST /api/v1/exam-tokens/validate
///   Body: { examId, token }
///   Response: { valid: boolean, message?: string }
///
/// Sampai backend siap, class ini mengembalikan data DUMMY dengan simulasi
/// latency jaringan, supaya alur popup -> validasi -> ExamPlayerScreen bisa
/// dikembangkan & diuji lebih dulu.
class ExamTokenRepository {
  ExamTokenRepository._();

  /// Token dummy yang dianggap "benar" untuk keperluan testing — di
  /// production, validasi ini sepenuhnya pindah ke server, Flutter tidak
  /// pernah menyimpan token yang valid di sisi client.
  static const String _dummyValidToken = 'MATH99';

  /// Memvalidasi Token Ujian yang dimasukkan murid terhadap [examId] yang
  /// sedang dibuka.
  static Future<TokenValidationResult> validate({
    required String examId,
    required String enteredToken,
  }) async {
    await Future.delayed(const Duration(milliseconds: 500));

    final normalized = enteredToken.trim().toUpperCase();
    if (normalized.isEmpty) {
      return TokenValidationResult.failure('Token tidak boleh kosong.');
    }
    if (normalized != _dummyValidToken) {
      return TokenValidationResult.failure(
          'Token Ujian salah. Hubungi pengawas untuk konfirmasi token.');
    }
    return TokenValidationResult.success();
  }
}