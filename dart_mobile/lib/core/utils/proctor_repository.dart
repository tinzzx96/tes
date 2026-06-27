import 'dart:convert';
import 'package:http/http.dart' as http;
import '../config/api_config.dart';
import 'auth_repository.dart';

class ProctorExam {
  final int id;
  final String title;
  final String subject;
  final String room;
  final String status;
  final String token;
  final String teacher;

  ProctorExam({
    required this.id,
    required this.title,
    required this.subject,
    required this.room,
    required this.status,
    required this.token,
    required this.teacher,
  });

  factory ProctorExam.fromJson(Map<String, dynamic> json) {
    return ProctorExam(
      id: json['id'] as int? ?? 0,
      title: json['title'] as String? ?? '',
      subject: json['subject'] as String? ?? '',
      room: json['room'] as String? ?? '',
      status: json['status'] as String? ?? '',
      token: json['token'] as String? ?? '',
      teacher: json['teacher'] as String? ?? '',
    );
  }
}

class Participant {
  final String userId;
  final String name;
  final String nisn;
  final String className;
  final String? device;
  final String status;
  final int progress;
  final int counterPelanggaran;
  final bool isBlocked;
  final String? unlockPin;
  final int? examAttemptId;

  Participant({
    required this.userId,
    required this.name,
    required this.nisn,
    required this.className,
    this.device,
    required this.status,
    required this.progress,
    required this.counterPelanggaran,
    required this.isBlocked,
    this.unlockPin,
    this.examAttemptId,
  });

  factory Participant.fromJson(Map<String, dynamic> json) {
    return Participant(
      userId: json['userId'] as String? ?? '',
      name: json['name'] as String? ?? '',
      nisn: json['nisn'] as String? ?? '',
      className: json['class'] as String? ?? json['classLabel'] as String? ?? '',
      device: json['device'] as String?,
      status: json['status'] as String? ?? 'not_logged_in',
      progress: json['progress'] as int? ?? 0,
      counterPelanggaran: json['counterPelanggaran'] as int? ?? 0,
      isBlocked: json['isBlocked'] as bool? ?? false,
      unlockPin: json['unlockPin'] as String?,
      examAttemptId: json['examAttemptId'] as int?,
    );
  }
}

class ProctorSummary {
  final int total;
  final int online;
  final int offline;
  final int submitted;
  final int waiting;
  final int blocked;

  ProctorSummary({
    required this.total,
    required this.online,
    required this.offline,
    required this.submitted,
    required this.waiting,
    required this.blocked,
  });

  factory ProctorSummary.fromJson(Map<String, dynamic> json) {
    return ProctorSummary(
      total: json['total'] as int? ?? 0,
      online: json['online'] as int? ?? 0,
      offline: json['offline'] as int? ?? 0,
      submitted: json['submitted'] as int? ?? 0,
      waiting: json['waiting'] as int? ?? 0,
      blocked: json['blocked'] as int? ?? 0,
    );
  }
}

class ProctorParticipantsResult {
  final ProctorExam exam;
  final List<Participant> participants;
  final ProctorSummary summary;

  ProctorParticipantsResult({
    required this.exam,
    required this.participants,
    required this.summary,
  });
}

class ProctorRepository {
  ProctorRepository._();

  /// Mengambil daftar ujian yang ditugaskan ke ruang proktor ini.
  /// GET /api/proctor/my-exams
  static Future<List<ProctorExam>> fetchMyExams() async {
    final token = await AuthRepository.getToken();
    final res = await http.get(
      Uri.parse('${ApiConfig.baseUrl}/proctor/my-exams'),
      headers: ApiConfig.headers(token),
    );

    final data = jsonDecode(res.body) as Map<String, dynamic>;
    if (res.statusCode == 200 && data['success'] == true) {
      final list = data['data'] as List<dynamic>? ?? [];
      return list.map((json) => ProctorExam.fromJson(json)).toList();
    }
    throw Exception(data['error']?['message'] ?? 'Gagal memuat ujian pengawas.');
  }

  /// Mengambil daftar peserta ujian dan ringkasannya.
  /// GET /api/proctor/exam/:examId/participants
  static Future<ProctorParticipantsResult> fetchParticipants(int examId) async {
    final token = await AuthRepository.getToken();
    final res = await http.get(
      Uri.parse('${ApiConfig.baseUrl}/proctor/exam/$examId/participants'),
      headers: ApiConfig.headers(token),
    );

    final data = jsonDecode(res.body) as Map<String, dynamic>;
    if (res.statusCode == 200 && data['success'] == true) {
      final examJson = data['data']['exam'] as Map<String, dynamic>;
      final participantsList = data['data']['participants'] as List<dynamic>? ?? [];
      final summaryJson = data['data']['summary'] as Map<String, dynamic>;

      return ProctorParticipantsResult(
        exam: ProctorExam.fromJson(examJson),
        participants: participantsList.map((json) => Participant.fromJson(json)).toList(),
        summary: ProctorSummary.fromJson(summaryJson),
      );
    }
    throw Exception(data['error']?['message'] ?? 'Gagal memuat peserta ujian.');
  }

  /// Melakukan reset sesi ujian siswa.
  /// POST /api/proctor/exam/:examId/reset/:userId
  static Future<void> resetStudentSession(int examId, int userId) async {
    final token = await AuthRepository.getToken();
    final res = await http.post(
      Uri.parse('${ApiConfig.baseUrl}/proctor/exam/$examId/reset/$userId'),
      headers: ApiConfig.headers(token),
      body: jsonEncode({}),
    );

    final data = jsonDecode(res.body) as Map<String, dynamic>;
    if (res.statusCode != 200 || data['success'] != true) {
      throw Exception(data['error']?['message'] ?? 'Gagal melakukan reset sesi.');
    }
  }

  /// Melakukan generate token ujian baru (reset token).
  /// POST /api/proctor/exam/:examId/reset-token
  static Future<String> generateNewToken(int examId) async {
    final token = await AuthRepository.getToken();
    final res = await http.post(
      Uri.parse('${ApiConfig.baseUrl}/proctor/exam/$examId/reset-token'),
      headers: ApiConfig.headers(token),
      body: jsonEncode({}),
    );

    final data = jsonDecode(res.body) as Map<String, dynamic>;
    if (res.statusCode == 200 && data['success'] == true) {
      return data['data']['token'] as String;
    }
    throw Exception(data['error']?['message'] ?? 'Gagal memperbarui token.');
  }
}
