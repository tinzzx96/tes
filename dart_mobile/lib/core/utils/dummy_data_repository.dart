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

  /// 32 soal dummy (4 baris x 8 kolom navigator), nomor tampilan vs nomor
  /// asli sengaja diacak untuk simulasi randomisasi soal per siswa.
  static List<Question> getExamQuestions() {
    return List.generate(32, (i) {
      final displayNumber = i + 1;
      final originalNumber = ((i * 7) % 32) + 1;
      return Question(
        displayNumber: displayNumber,
        originalNumber: originalNumber,
        questionText:
            'Berapakah Hasil kawin silang aljabar 90x dan sin cost '
            '85*(12).70',
        imagePath: i % 4 == 0 ? 'assets/images/sample_question.png' : null,
        options: const [
          'Opsi Jawaban A',
          'Opsi Jawaban B',
          'Opsi Jawaban C',
          'Opsi Jawaban D',
        ],
      );
    });
  }
}
