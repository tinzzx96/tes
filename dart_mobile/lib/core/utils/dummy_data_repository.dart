import '../models/exam_schedule.dart';
import '../models/question.dart';
import '../models/student.dart';

/// Penyedia data sementara (dummy) sebelum integrasi dengan `server_backend`.
///
/// PENTING untuk integrasi nanti: cukup ganti isi method di bawah ini dengan
/// pemanggilan API (Authentication API, Exam API, dst sesuai Hero Exam PRD
/// Section 27), tanpa perlu mengubah widget/UI yang memanggilnya.
class DummyDataRepository {
  DummyDataRepository._();

  static Student getCurrentStudent() {
    return const Student(
      name: 'Danang Prakoso',
      nisn: '0023456789',
      classLabel: 'XI RPL 1',
      deviceName: 'ASUS X409FA',
      roomName: 'RUANG - 14',
      networkName: 'LAN-EXAM-14',
      sessionActive: true,
      screenSharingActive: true,
      proctorVisibilityOn: true,
    );
  }

  /// Jadwal ujian hari ini, dipakai di Home Screen (bagian exam card yang
  /// bisa di-scroll di bawah Device Status, sesuai permintaan: bisa lebih
  /// dari 2 mapel dalam satu hari).
  static List<ExamSchedule> getTodaySchedules() {
    final now = DateTime.now();
    final today = DateTime(now.year, now.month, now.day);
    return [
      ExamSchedule(
        id: 'exam-1',
        subjectName: 'Matematika',
        examCode: 'MTK-2026-UAS',
        startTime: today.add(const Duration(hours: 8)),
        endTime: today.add(const Duration(hours: 10)),
        roomName: 'Ruang-14',
        teacherName: 'Drs. Rajan Johnson',
        durationMinutes: 120,
      ),
      ExamSchedule(
        id: 'exam-2',
        subjectName: 'Produktif RPL',
        examCode: 'RPL-2026-UAS',
        startTime: today.add(const Duration(hours: 10, minutes: 30)),
        endTime: today.add(const Duration(hours: 12, minutes: 30)),
        roomName: 'Ruang-14',
        teacherName: 'Danang Setiawan',
        durationMinutes: 120,
      ),
      ExamSchedule(
        id: 'exam-3',
        subjectName: 'Bahasa Inggris',
        examCode: 'ENG-2026-UAS',
        startTime: today.add(const Duration(hours: 13)),
        endTime: today.add(const Duration(hours: 14, minutes: 30)),
        roomName: 'Ruang-14',
        teacherName: 'Siti Aminah, S.Pd',
        durationMinutes: 90,
      ),
    ];
  }

  /// Jadwal ujian beberapa hari ke depan, dipakai di Schedule Screen.
  static List<ExamSchedule> getUpcomingSchedules() {
    final now = DateTime.now();
    final today = DateTime(now.year, now.month, now.day);
    return [
      ExamSchedule(
        id: 'sched-1',
        subjectName: 'Matematika',
        examCode: 'MTK-2026-UAS',
        startTime: today.add(const Duration(hours: 8)),
        endTime: today.add(const Duration(hours: 10)),
        roomName: 'Ruang-14',
        teacherName: 'Drs. Rajan Johnson',
        durationMinutes: 120,
      ),
      ExamSchedule(
        id: 'sched-2',
        subjectName: 'Produktif RPL',
        examCode: 'RPL-2026-UAS',
        startTime: today.add(const Duration(hours: 10, minutes: 30)),
        endTime: today.add(const Duration(hours: 12, minutes: 30)),
        roomName: 'Ruang-14',
        teacherName: 'Danang Setiawan',
        durationMinutes: 120,
      ),
      ExamSchedule(
        id: 'sched-3',
        subjectName: 'Bahasa Inggris',
        examCode: 'ENG-2026-UAS',
        startTime: today.add(const Duration(days: 1, hours: 8)),
        endTime: today.add(const Duration(days: 1, hours: 9, minutes: 30)),
        roomName: 'Ruang-14',
        teacherName: 'Siti Aminah, S.Pd',
        durationMinutes: 90,
      ),
    ];
  }

  /// Soal dummy PER UJIAN. Sekarang menerima [examId] supaya tiap mapel
  /// menghasilkan kumpulan soal yang BERBEDA — sebelumnya method ini tidak
  /// punya parameter sama sekali, sehingga semua ExamCard (Matematika,
  /// Produktif RPL, dst) membuka soal yang identik. Itu BUKAN karena
  /// "file tujuan sama", melainkan karena method ini memang tidak pernah
  /// membedakan mapel.
  ///
  /// TODO(produksi): ganti dengan Exam API — GET /api/exams/{examId}/questions
  /// (lihat Hero Exam PRD §27 Question API). examId di sini sudah siap jadi
  /// path parameter request tersebut.
  static List<Question> getExamQuestions(String examId) {
    final bank = _questionBankFor(examId);
    return List.generate(bank.length, (i) {
      final displayNumber = i + 1;
      final originalNumber = ((i * 7) % bank.length) + 1;
      final item = bank[i];
      return Question(
        displayNumber: displayNumber,
        originalNumber: originalNumber,
        questionText: item.text,
        imagePath: item.withImage ? 'assets/images/sample_question.png' : null,
        options: item.options,
      );
    });
  }

  /// Bank soal mentah per examId. Dipisah dari getExamQuestions supaya mudah
  /// menambah mapel baru tanpa menyentuh logic randomisasi nomor di atas.
  static List<_RawQuestion> _questionBankFor(String examId) {
    // Normalisasi: terima baik id Home (exam-1/exam-2) maupun Schedule
    // (sched-1/sched-2), supaya konsisten lintas layar.
    final isMatematika = examId == 'exam-1' || examId == 'sched-1';
    final isRpl = examId == 'exam-2' || examId == 'sched-2';
    final isInggris = examId == 'exam-3' || examId == 'sched-3';

    if (isMatematika) {
      return _generate(
        prefix: 'MATEMATIKA',
        templates: const [
          'Hasil dari 15 × 12 + 48 ÷ 6 adalah ...',
          'Jika f(x) = 2x² − 3x + 5, maka nilai f(4) adalah ...',
          'Akar-akar persamaan x² − 7x + 12 = 0 adalah ...',
          'Turunan pertama dari f(x) = 3x³ + 2x² − x adalah ...',
          'Nilai sin 30° + cos 60° adalah ...',
        ],
        optionSets: const [
          ['180', '188', '192', '196'],
          ['25', '27', '29', '31'],
          ['3 dan 4', '2 dan 6', '1 dan 12', '5 dan 2'],
          ['9x² + 4x − 1', '6x² + 4x', '9x² + 2x − 1', '3x² + 2x'],
          ['0,5', '1', '1,5', '2'],
        ],
      );
    }

    if (isRpl) {
      return _generate(
        prefix: 'PRODUKTIF RPL',
        templates: const [
          'Paradigma pemrograman yang menekankan objek dan kelas disebut ...',
          'Perintah SQL untuk menampilkan data dari tabel adalah ...',
          'Struktur data yang menerapkan prinsip LIFO adalah ...',
          'Tag HTML yang benar untuk membuat tautan adalah ...',
          'HTTP status code untuk "Not Found" adalah ...',
        ],
        optionSets: const [
          ['OOP', 'Prosedural', 'Fungsional', 'Deklaratif'],
          ['SELECT', 'INSERT', 'UPDATE', 'DELETE'],
          ['Stack', 'Queue', 'Array', 'Tree'],
          ['<a href="...">', '<link>', '<url>', '<href>'],
          ['404', '200', '301', '500'],
        ],
      );
    }

    if (isInggris) {
      return _generate(
        prefix: 'BAHASA INGGRIS',
        templates: const [
          'Choose the correct past tense of the verb "go": ...',
          'Which word is a synonym of "happy"?',
          'Complete: "She ___ to school every day."',
          'What is the plural form of "child"?',
          'Choose the correct article: "___ apple a day."',
        ],
        optionSets: const [
          ['went', 'goed', 'gone', 'going'],
          ['joyful', 'angry', 'sad', 'tired'],
          ['goes', 'go', 'going', 'gone'],
          ['children', 'childs', 'childes', 'child'],
          ['An', 'A', 'The', 'Some'],
        ],
      );
    }

    // Fallback untuk examId yang belum dikenal — tetap kembalikan sesuatu
    // yang jelas berbeda supaya mudah teridentifikasi saat testing.
    return _generate(
      prefix: 'UJIAN ($examId)',
      templates: ['Soal contoh untuk ujian dengan id "$examId" nomor'],
      optionSets: const [
        ['Opsi A', 'Opsi B', 'Opsi C', 'Opsi D'],
      ],
    );
  }

  /// Membuat 32 soal (4 baris × 8 kolom navigator) dengan memutar
  /// [templates] & [optionSets] yang tersedia, sambil menambahkan nomor
  /// soal supaya tiap kotak navigator menampilkan teks unik.
  static List<_RawQuestion> _generate({
    required String prefix,
    required List<String> templates,
    required List<List<String>> optionSets,
  }) {
    return List.generate(32, (i) {
      final t = templates[i % templates.length];
      final opts = optionSets[i % optionSets.length];
      return _RawQuestion(
        text: '[$prefix • Soal ${i + 1}] $t',
        options: opts,
        withImage: i % 4 == 0,
      );
    });
  }
}

/// Representasi mentah satu soal sebelum dibungkus jadi [Question] (dengan
/// displayNumber/originalNumber hasil randomisasi).
class _RawQuestion {
  final String text;
  final List<String> options;
  final bool withImage;

  const _RawQuestion({
    required this.text,
    required this.options,
    required this.withImage,
  });
}