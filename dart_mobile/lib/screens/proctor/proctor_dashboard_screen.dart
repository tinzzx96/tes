import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:google_fonts/google_fonts.dart';
import '../../core/theme/app_colors.dart';
import '../../core/theme/app_typography.dart';
import '../../core/utils/auth_repository.dart';
import '../../core/utils/socket_service.dart';
import '../../core/utils/proctor_repository.dart';
import '../login/login_screen.dart';

class ProctorDashboardScreen extends StatefulWidget {
  const ProctorDashboardScreen({super.key});

  @override
  State<ProctorDashboardScreen> createState() => _ProctorDashboardScreenState();
}

class _ProctorDashboardScreenState extends State<ProctorDashboardScreen> {
  int _currentTab = 0;
  bool _isLoadingExams = false;
  bool _isLoadingParticipants = false;
  String _errorMessage = '';

  List<ProctorExam> _exams = [];
  int? _selectedExamId;
  List<Participant> _participants = [];
  ProctorSummary? _summary;

  Timer? _pollingTimer;
  Map<String, dynamic>? _currentUser;

  @override
  void initState() {
    super.initState();
    _initDashboard();
    _setupWebSocketListeners();
  }

  @override
  void dispose() {
    _pollingTimer?.cancel();
    // Remove listeners from SocketService to avoid memory leaks/multiple triggers
    SocketService.instance.studentStatusChangedEvent.removeListener(_onStudentStatusChanged);
    SocketService.instance.pinGeneratedEvent.removeListener(_onPinGenerated);
    SocketService.instance.examStatusChangedEvent.removeListener(_onExamStatusChanged);
    super.dispose();
  }

  Future<void> _initDashboard() async {
    setState(() {
      _isLoadingExams = true;
      _errorMessage = '';
    });

    try {
      // Connect socket
      await SocketService.instance.connect();

      // Fetch user profile to get room
      final user = await AuthRepository.me();
      _currentUser = user;

      // Join room via socket
      final room = user['room']?.toString() ?? '';
      if (room.isNotEmpty) {
        SocketService.instance.joinRoom(room);
      }

      // Fetch exams assigned to room
      final examsList = await ProctorRepository.fetchMyExams();
      setState(() {
        _exams = examsList;
        _isLoadingExams = false;
        if (examsList.isNotEmpty) {
          _selectedExamId = examsList.first.id;
          _loadParticipants();
          _startPolling();
        }
      });
    } catch (e) {
      setState(() {
        _isLoadingExams = false;
        _errorMessage = e.toString().replaceFirst('Exception: ', '');
      });
    }
  }

  void _setupWebSocketListeners() {
    SocketService.instance.studentStatusChangedEvent.addListener(_onStudentStatusChanged);
    SocketService.instance.pinGeneratedEvent.addListener(_onPinGenerated);
    SocketService.instance.examStatusChangedEvent.addListener(_onExamStatusChanged);
  }

  void _onStudentStatusChanged() {
    final event = SocketService.instance.studentStatusChangedEvent.value;
    if (event == null || !mounted) return;

    debugPrint('[ProctorDashboard] WebSocket event received (status changed): $event');
    final studentId = event['studentId']?.toString();
    if (studentId == null) return;

    setState(() {
      final index = _participants.indexWhere((p) => p.userId == studentId);
      if (index != -1) {
        final current = _participants[index];
        _participants[index] = Participant(
          userId: current.userId,
          name: current.name,
          nisn: current.nisn,
          className: current.className,
          device: current.device,
          status: event['status']?.toString() ?? current.status,
          progress: event['progress'] as int? ?? current.progress,
          counterPelanggaran: event['counterPelanggaran'] as int? ?? current.counterPelanggaran,
          isBlocked: event['isBlocked'] as bool? ?? current.isBlocked,
        );
        _recalculateSummary();
      }
    });
  }

  void _onPinGenerated() {
    final event = SocketService.instance.pinGeneratedEvent.value;
    if (event == null || !mounted) return;

    debugPrint('[ProctorDashboard] WebSocket event received (pin generated): $event');
    final studentId = event['studentId']?.toString() ?? 'stu_${event['studentId']}';

    setState(() {
      final index = _participants.indexWhere((p) => p.userId == studentId || p.name == event['studentName']);
      if (index != -1) {
        final current = _participants[index];
        _participants[index] = Participant(
          userId: current.userId,
          name: current.name,
          nisn: current.nisn,
          className: current.className,
          device: current.device,
          status: current.status,
          progress: current.progress,
          counterPelanggaran: current.counterPelanggaran,
          isBlocked: true,
        );
        _recalculateSummary();
      }
    });
  }

  void _onExamStatusChanged() {
    final event = SocketService.instance.examStatusChangedEvent.value;
    if (event == null || !mounted) return;

    debugPrint('[ProctorDashboard] WebSocket event received (exam status changed): $event');
    final examId = event['examId'] != null ? int.tryParse(event['examId'].toString()) : null;

    if (examId != null) {
      // If our current exam changed, or if token changed, reload exams info
      setState(() {
        final idx = _exams.indexWhere((e) => e.id == examId);
        if (idx != -1 && event['token'] != null) {
          final old = _exams[idx];
          _exams[idx] = ProctorExam(
            id: old.id,
            title: old.title,
            subject: old.subject,
            room: old.room,
            status: event['status']?.toString() ?? old.status,
            token: event['token'].toString(),
            teacher: old.teacher,
          );
        } else {
          // General reload of exams list to sync states
          _reloadExamsOnly();
        }
      });
    }
  }

  Future<void> _reloadExamsOnly() async {
    try {
      final examsList = await ProctorRepository.fetchMyExams();
      if (mounted) {
        setState(() {
          _exams = examsList;
        });
      }
    } catch (_) {}
  }

  Future<void> _loadParticipants() async {
    if (_selectedExamId == null) return;

    setState(() {
      _isLoadingParticipants = true;
    });

    try {
      final result = await ProctorRepository.fetchParticipants(_selectedExamId!);
      if (mounted) {
        setState(() {
          _participants = result.participants;
          _summary = result.summary;
          _isLoadingParticipants = false;
        });
      }
    } catch (e) {
      if (mounted) {
        setState(() {
          _isLoadingParticipants = false;
        });
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Gagal memuat peserta: $e')),
        );
      }
    }
  }

  void _recalculateSummary() {
    int total = _participants.length;
    int online = _participants.where((p) => p.status == 'online').length;
    int offline = _participants.where((p) => p.status == 'offline').length;
    int submitted = _participants.where((p) => p.status == 'submitted').length;
    int waiting = _participants.where((p) => p.status == 'not_logged_in').length;
    int blocked = _participants.where((p) => p.isBlocked).length;

    _summary = ProctorSummary(
      total: total,
      online: online,
      offline: offline,
      submitted: submitted,
      waiting: waiting,
      blocked: blocked,
    );
  }

  void _startPolling() {
    _pollingTimer?.cancel();
    _pollingTimer = Timer.periodic(const Duration(seconds: 30), (_) {
      _loadParticipants();
    });
  }

  Future<void> _handleResetStudent(Participant student) async {
    if (_selectedExamId == null) return;

    final confirm = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        backgroundColor: AppColors.surface,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
        title: Text('Reset Sesi Siswa', style: AppTypography.examTitle),
        content: Text(
          'Reset sesi untuk ${student.name}?\nSiswa dapat login ulang dan melanjutkan ujian tanpa kehilangan jawaban yang sudah tersimpan.',
          style: AppTypography.studentMeta.copyWith(color: AppColors.textPrimary),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context, false),
            child: Text('BATAL', style: AppTypography.buttonPrimary.copyWith(color: AppColors.textSecondary)),
          ),
          ElevatedButton(
            style: ElevatedButton.styleFrom(
              backgroundColor: AppColors.primary,
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
            ),
            onPressed: () => Navigator.pop(context, true),
            child: Text('RESET', style: AppTypography.buttonPrimary),
          ),
        ],
      ),
    );

    if (confirm == true) {
      try {
        final plainUserId = int.tryParse(student.userId.replaceAll('stu_', '')) ?? 0;
        await ProctorRepository.resetStudentSession(_selectedExamId!, plainUserId);
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(content: Text('Sesi ${student.name} berhasil di-reset.')),
          );
          _loadParticipants();
        }
      } catch (e) {
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(content: Text('Gagal reset sesi: $e')),
          );
        }
      }
    }
  }

  Future<void> _handleGenerateNewToken(ProctorExam exam) async {
    final confirm = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        backgroundColor: AppColors.surface,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
        title: Text('Generate Token Baru', style: AppTypography.examTitle),
        content: Text(
          'Apakah Anda yakin ingin mengganti Token Ujian untuk "${exam.title}"?\nToken lama tidak akan berlaku lagi.',
          style: AppTypography.studentMeta.copyWith(color: AppColors.textPrimary),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context, false),
            child: Text('BATAL', style: AppTypography.buttonPrimary.copyWith(color: AppColors.textSecondary)),
          ),
          ElevatedButton(
            style: ElevatedButton.styleFrom(
              backgroundColor: AppColors.primary,
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
            ),
            onPressed: () => Navigator.pop(context, true),
            child: Text('GENERATE', style: AppTypography.buttonPrimary),
          ),
        ],
      ),
    );

    if (confirm == true) {
      try {
        final newToken = await ProctorRepository.generateNewToken(exam.id);
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(content: Text('Token ujian berhasil diperbarui: $newToken')),
          );
          _reloadExamsOnly();
        }
      } catch (e) {
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(content: Text('Gagal memperbarui token: $e')),
          );
        }
      }
    }
  }


  Future<void> _handleLogout() async {
    final confirm = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        backgroundColor: AppColors.surface,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
        title: Text('Keluar dari App', style: AppTypography.examTitle),
        content: const Text(
          'Apakah Anda yakin ingin keluar dari akun pengawas?',
          style: TextStyle(color: AppColors.textPrimary),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context, false),
            child: Text('BATAL', style: AppTypography.buttonPrimary.copyWith(color: AppColors.textSecondary)),
          ),
          ElevatedButton(
            style: ElevatedButton.styleFrom(backgroundColor: AppColors.primary),
            onPressed: () => Navigator.pop(context, true),
            child: Text('KELUAR', style: AppTypography.buttonPrimary),
          ),
        ],
      ),
    );

    if (confirm == true) {
      await AuthRepository.logout();
      SocketService.instance.disconnect();
      if (mounted) {
        Navigator.of(context).pushAndRemoveUntil(
          MaterialPageRoute(builder: (_) => const LoginScreen()),
          (route) => false,
        );
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: AppBar(
        backgroundColor: AppColors.background,
        elevation: 0,
        title: Row(
          children: [
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
              decoration: BoxDecoration(
                color: AppColors.primary.withOpacity(0.15),
                borderRadius: BorderRadius.circular(8),
                border: Border.all(color: AppColors.primary, width: 1.5),
              ),
              child: Text(
                _currentUser?['room']?.toString() ?? 'MONITOR',
                style: GoogleFonts.barlowCondensed(
                  fontSize: 16,
                  fontWeight: FontWeight.w800,
                  color: AppColors.primary,
                  letterSpacing: 1.5,
                ),
              ),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Text(
                'PENGAWAS',
                style: AppTypography.appTitle,
                overflow: TextOverflow.ellipsis,
              ),
            ),
          ],
        ),
        actions: [
          IconButton(
            icon: const Icon(Icons.logout, color: AppColors.textSecondary),
            onPressed: _handleLogout,
          ),
        ],
      ),
      body: _isLoadingExams
          ? const Center(child: CircularProgressIndicator(color: AppColors.primary))
          : _errorMessage.isNotEmpty
              ? _buildErrorState()
              : _exams.isEmpty
                  ? _buildEmptyState()
                  : _buildDashboardContent(),
      bottomNavigationBar: Theme(
        data: Theme.of(context).copyWith(
          canvasColor: AppColors.surface,
        ),
        child: Container(
          decoration: const BoxDecoration(
            border: Border(top: BorderSide(color: AppColors.divider, width: 1)),
          ),
          child: BottomNavigationBar(
            currentIndex: _currentTab,
            onTap: (index) {
              setState(() {
                _currentTab = index;
              });
            },
            backgroundColor: AppColors.surface,
            selectedItemColor: AppColors.primary,
            unselectedItemColor: AppColors.textSecondary,
            selectedLabelStyle: GoogleFonts.inter(fontWeight: FontWeight.w700, fontSize: 12),
            unselectedLabelStyle: GoogleFonts.inter(fontWeight: FontWeight.w500, fontSize: 12),
            items: const [
              BottomNavigationBarItem(
                icon: Icon(Icons.monitor_heart_outlined),
                activeIcon: Icon(Icons.monitor_heart),
                label: 'Monitoring',
              ),
              BottomNavigationBarItem(
                icon: Icon(Icons.key_outlined),
                activeIcon: Icon(Icons.key),
                label: 'Token',
              ),
              BottomNavigationBarItem(
                icon: Icon(Icons.lock_open_outlined),
                activeIcon: Icon(Icons.lock),
                label: 'Lock PIN',
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildErrorState() {
    return Padding(
      padding: const EdgeInsets.all(24.0),
      child: Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            const Icon(Icons.error_outline, size: 64, color: AppColors.primary),
            const SizedBox(height: 16),
            Text(
              'Gagal memuat data dashboard',
              style: AppTypography.examTitle,
              textAlign: TextAlign.center,
            ),
            const SizedBox(height: 8),
            Text(
              _errorMessage,
              style: AppTypography.subtitle,
              textAlign: TextAlign.center,
            ),
            const SizedBox(height: 24),
            ElevatedButton(
              style: ElevatedButton.styleFrom(
                backgroundColor: AppColors.primary,
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 12),
              ),
              onPressed: _initDashboard,
              child: Text('COBA LAGI', style: AppTypography.buttonPrimary),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildEmptyState() {
    return Padding(
      padding: const EdgeInsets.all(24.0),
      child: Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            const Icon(Icons.upcoming_outlined, size: 80, color: AppColors.textSecondary),
            const SizedBox(height: 24),
            Text(
              'Tidak ada ujian aktif hari ini',
              style: AppTypography.examTitle,
              textAlign: TextAlign.center,
            ),
            const SizedBox(height: 8),
            Text(
              'Belum ada jadwal ujian yang ditugaskan ke ruang ${_currentUser?['room'] ?? 'Anda'}.',
              style: AppTypography.subtitle,
              textAlign: TextAlign.center,
            ),
            const SizedBox(height: 24),
            IconButton(
              icon: const Icon(Icons.refresh, color: AppColors.primary, size: 32),
              onPressed: _initDashboard,
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildDashboardContent() {
    return Column(
      children: [
        // Dropdown seleksi ujian
        Container(
          padding: const EdgeInsets.all(16),
          color: AppColors.surface,
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text('PILIH UJIAN MONITORING', style: AppTypography.labelCaps),
              const SizedBox(height: 8),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 12),
                decoration: BoxDecoration(
                  color: AppColors.background,
                  borderRadius: BorderRadius.circular(12),
                  border: Border.all(color: AppColors.divider, width: 1.5),
                ),
                child: DropdownButtonHideUnderline(
                  child: DropdownButton<int>(
                    value: _selectedExamId,
                    isExpanded: true,
                    dropdownColor: AppColors.surface,
                    icon: const Icon(Icons.keyboard_arrow_down, color: AppColors.textSecondary),
                    items: _exams.map((exam) {
                      return DropdownMenuItem<int>(
                        value: exam.id,
                        child: Text(
                          '${exam.title} (${exam.subject})',
                          style: GoogleFonts.inter(
                            color: AppColors.textPrimary,
                            fontWeight: FontWeight.w600,
                            fontSize: 14,
                          ),
                        ),
                      );
                    }).toList(),
                    onChanged: (val) {
                      if (val != null) {
                        setState(() {
                          _selectedExamId = val;
                          _loadParticipants();
                        });
                      }
                    },
                  ),
                ),
              ),
            ],
          ),
        ),

        // Live Summary Header Row (Grid style)
        if (_summary != null) _buildSummaryRow(),

        // Konten Tab
        Expanded(
          child: RefreshIndicator(
            color: AppColors.primary,
            onRefresh: _loadParticipants,
            child: _isLoadingParticipants
                ? const Center(child: CircularProgressIndicator(color: AppColors.primary))
                : IndexedStack(
                    index: _currentTab,
                    children: [
                      _buildMonitoringTab(),
                      _buildTokenTab(),
                      _buildLockPinTab(),
                    ],
                  ),
          ),
        ),
      ],
    );
  }

  Widget _buildSummaryRow() {
    final s = _summary!;
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
      decoration: const BoxDecoration(
        color: AppColors.background,
        border: Border(bottom: BorderSide(color: AppColors.divider, width: 1)),
      ),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          _buildSummaryItem(Icons.people_alt, s.total.toString(), 'Total'),
          _buildSummaryItem(Icons.wifi, s.online.toString(), 'Online', color: AppColors.online),
          _buildSummaryItem(Icons.wifi_off, s.offline.toString(), 'Offline', color: AppColors.textSecondary),
          _buildSummaryItem(Icons.lock, s.blocked.toString(), 'Terblokir', color: AppColors.accentGold),
        ],
      ),
    );
  }

  Widget _buildSummaryItem(IconData icon, String count, String label, {Color color = AppColors.textPrimary}) {
    return Expanded(
      child: Column(
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Icon(icon, size: 16, color: color),
              const SizedBox(width: 6),
              Text(
                count,
                style: GoogleFonts.barlowCondensed(
                  fontSize: 18,
                  fontWeight: FontWeight.w800,
                  color: color,
                ),
              ),
            ],
          ),
          const SizedBox(height: 2),
          Text(
            label.toUpperCase(),
            style: GoogleFonts.inter(
              fontSize: 10,
              fontWeight: FontWeight.w600,
              color: AppColors.textSecondary,
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildMonitoringTab() {
    if (_participants.isEmpty) {
      return _buildNoParticipantsState();
    }

    return ListView.builder(
      padding: const EdgeInsets.all(16),
      physics: const AlwaysScrollableScrollPhysics(),
      itemCount: _participants.length,
      itemBuilder: (context, index) {
        final student = _participants[index];
        return _buildStudentCard(student);
      },
    );
  }

  Widget _buildNoParticipantsState() {
    return Center(
      child: SingleChildScrollView(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            const Icon(Icons.people_outline, size: 64, color: AppColors.textSecondary),
            const SizedBox(height: 16),
            Text(
              'Belum ada peserta bergabung',
              style: AppTypography.examTitle,
            ),
            const SizedBox(height: 8),
            Text(
              'Siswa di ruang ujian Anda belum login.',
              style: AppTypography.subtitle,
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildStudentCard(Participant student) {
    // Determine connection status colors & pulsing shadow
    final isOnline = student.status == 'online';
    final isSubmitted = student.status == 'submitted';
    final isOffline = student.status == 'offline';

    Color dotColor = AppColors.textMuted;
    List<BoxShadow> dotShadow = [];

    if (isOnline) {
      dotColor = AppColors.online;
      dotShadow = [
        BoxShadow(
          color: AppColors.online.withOpacity(0.4),
          blurRadius: 6,
          spreadRadius: 2,
        ),
      ];
    } else if (isSubmitted) {
      dotColor = AppColors.submitGreen;
    } else if (isOffline) {
      dotColor = AppColors.primary;
    }

    // Determine status badge
    String statusLabel = 'Offline';
    Color badgeColor = AppColors.surface;
    Color textColor = AppColors.textSecondary;

    if (isSubmitted) {
      statusLabel = 'SELESAI';
      badgeColor = AppColors.submitGreen.withOpacity(0.15);
      textColor = AppColors.submitGreen;
    } else if (isOnline) {
      statusLabel = student.isBlocked ? 'BLOKIR' : 'AKTIF';
      badgeColor = student.isBlocked
          ? AppColors.primary.withOpacity(0.15)
          : AppColors.online.withOpacity(0.15);
      textColor = student.isBlocked ? AppColors.primary : AppColors.online;
    } else if (student.status == 'not_logged_in') {
      statusLabel = 'BELUM LOGIN';
      badgeColor = AppColors.surface;
      textColor = AppColors.textSecondary;
    }

    // Progress bar calculations (assume total 40 questions as default)
    const int totalQ = 40;
    final int currentProgress = student.progress;
    final double progressPct = (currentProgress / totalQ).clamp(0.0, 1.0);

    return Container(
      margin: const EdgeInsets.only(bottom: 12),
      decoration: BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(
          color: student.isBlocked ? AppColors.primary : AppColors.divider,
          width: student.isBlocked ? 1.5 : 1.0,
        ),
      ),
      child: Padding(
        padding: const EdgeInsets.all(16.0),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Row 1: Status Dot + Name + Badge Status
            Row(
              children: [
                AnimatedContainer(
                  duration: const Duration(milliseconds: 500),
                  width: 8,
                  height: 8,
                  decoration: BoxDecoration(
                    color: dotColor,
                    shape: BoxShape.circle,
                    boxShadow: dotShadow,
                  ),
                ),
                const SizedBox(width: 10),
                Expanded(
                  child: Text(
                    student.name,
                    style: GoogleFonts.inter(
                      fontSize: 16,
                      fontWeight: FontWeight.w700,
                      color: AppColors.textPrimary,
                    ),
                  ),
                ),
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                  decoration: BoxDecoration(
                    color: badgeColor,
                    borderRadius: BorderRadius.circular(8),
                  ),
                  child: Text(
                    statusLabel,
                    style: GoogleFonts.barlowCondensed(
                      fontSize: 11,
                      fontWeight: FontWeight.w800,
                      color: textColor,
                      letterSpacing: 0.8,
                    ),
                  ),
                ),
              ],
            ),

            const SizedBox(height: 4),

            // Row 2: NISN / Class
            Padding(
              padding: const EdgeInsets.only(left: 18.0),
              child: Text(
                '${student.nisn} · ${student.className}',
                style: AppTypography.studentMeta,
              ),
            ),

            const SizedBox(height: 16),

            // Progress bar and info
            Row(
              children: [
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                        children: [
                          Text(
                            'Pengerjaan Soal',
                            style: GoogleFonts.inter(
                              fontSize: 12,
                              fontWeight: FontWeight.w500,
                              color: AppColors.textSecondary,
                            ),
                          ),
                          Text(
                            '$currentProgress / $totalQ',
                            style: GoogleFonts.barlowCondensed(
                              fontSize: 14,
                              fontWeight: FontWeight.w700,
                              color: AppColors.textPrimary,
                            ),
                          ),
                        ],
                      ),
                      const SizedBox(height: 6),
                      ClipRRect(
                        borderRadius: BorderRadius.circular(4),
                        child: LinearProgressIndicator(
                          value: progressPct,
                          minHeight: 6,
                          backgroundColor: AppColors.background,
                          valueColor: AlwaysStoppedAnimation<Color>(
                            isSubmitted
                                ? AppColors.submitGreen
                                : student.isBlocked
                                    ? AppColors.primary
                                    : AppColors.primary,
                          ),
                        ),
                      ),
                    ],
                  ),
                ),

                // Action buttons: Reset Session
                if (!isSubmitted && student.status != 'not_logged_in') ...[
                  const SizedBox(width: 16),
                  IconButton(
                    icon: const Icon(Icons.restart_alt, color: AppColors.accentGold),
                    tooltip: 'Reset Sesi',
                    onPressed: () => _handleResetStudent(student),
                  ),
                ],
              ],
            ),

            // Violations Warning Banner
            if (student.counterPelanggaran > 0) ...[
              const SizedBox(height: 12),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                decoration: BoxDecoration(
                  color: AppColors.primary.withOpacity(0.08),
                  borderRadius: BorderRadius.circular(8),
                  border: Border.all(color: AppColors.primary.withOpacity(0.2), width: 1),
                ),
                child: Row(
                  children: [
                    const Icon(Icons.warning_amber_rounded, color: AppColors.primary, size: 14),
                    const SizedBox(width: 6),
                    Text(
                      'Terdeteksi ${student.counterPelanggaran}x Pelanggaran',
                      style: GoogleFonts.inter(
                        fontSize: 12,
                        fontWeight: FontWeight.w700,
                        color: AppColors.primary,
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ],
        ),
      ),
    );
  }

  Widget _buildTokenTab() {
    final exam = _exams.firstWhere((e) => e.id == _selectedExamId, orElse: () => _exams.first);

    return SingleChildScrollView(
      padding: const EdgeInsets.all(24),
      physics: const AlwaysScrollableScrollPhysics(),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            'TOKEN UJIAN AKTIF',
            style: AppTypography.labelCaps,
          ),
          const SizedBox(height: 12),
          Container(
            width: double.infinity,
            padding: const EdgeInsets.all(24),
            decoration: BoxDecoration(
              color: AppColors.surface,
              borderRadius: BorderRadius.circular(20),
              border: Border.all(color: AppColors.divider, width: 1.5),
            ),
            child: Column(
              children: [
                Text(
                  exam.subject.toUpperCase(),
                  style: GoogleFonts.barlowCondensed(
                    fontSize: 20,
                    fontWeight: FontWeight.w800,
                    color: AppColors.textSecondary,
                    letterSpacing: 2.0,
                  ),
                ),
                const SizedBox(height: 4),
                Text(
                  exam.title,
                  style: GoogleFonts.inter(
                    fontSize: 14,
                    color: AppColors.textMuted,
                  ),
                ),
                const SizedBox(height: 32),
                Container(
                  padding: const EdgeInsets.symmetric(vertical: 16, horizontal: 32),
                  decoration: BoxDecoration(
                    color: AppColors.background,
                    borderRadius: BorderRadius.circular(16),
                    border: Border.all(color: AppColors.accentGold.withOpacity(0.3), width: 1.5),
                  ),
                  child: Row(
                    mainAxisAlignment: MainAxisAlignment.center,
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Text(
                        exam.token.isEmpty ? 'BELUM SET' : exam.token,
                        style: GoogleFonts.barlowCondensed(
                          fontSize: 48,
                          fontWeight: FontWeight.w900,
                          color: AppColors.accentGold,
                          letterSpacing: 8.0,
                        ),
                      ),
                      if (exam.token.isNotEmpty) ...[
                        const SizedBox(width: 16),
                        GestureDetector(
                          onTap: () {
                            Clipboard.setData(ClipboardData(text: exam.token));
                            ScaffoldMessenger.of(context).showSnackBar(
                              const SnackBar(content: Text('Token disalin ke clipboard')),
                            );
                          },
                          child: const Icon(Icons.copy, color: AppColors.textSecondary, size: 24),
                        ),
                      ],
                    ],
                  ),
                ),
                const SizedBox(height: 16),
                Text(
                  'Siswa wajib menginput kode token di atas untuk membuka layar pengerjaan ujian.',
                  style: GoogleFonts.inter(
                    fontSize: 12,
                    color: AppColors.textSecondary,
                  ),
                  textAlign: TextAlign.center,
                ),
                const SizedBox(height: 32),
                SizedBox(
                  width: double.infinity,
                  height: 52,
                  child: ElevatedButton(
                    style: ElevatedButton.styleFrom(
                      backgroundColor: AppColors.primary,
                      elevation: 4,
                      shadowColor: AppColors.primary.withOpacity(0.4),
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(12), // rounded-xl
                      ),
                    ),
                    onPressed: () => _handleGenerateNewToken(exam),
                    child: Row(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        const Icon(Icons.refresh, color: AppColors.textPrimary),
                        const SizedBox(width: 8),
                        Text(
                          'GENERATE TOKEN BARU',
                          style: AppTypography.buttonPrimary,
                        ),
                      ],
                    ),
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 24),
          _buildHelpCard(
            'Informasi Sinkronisasi',
            'Token terhubung langsung dengan WebSocket server. Jika token di-generate ulang dari sini atau oleh administrator pusat, data token di aplikasi siswa dan dashboard ini akan ter-update seketika tanpa perlu restart.',
            Icons.sync,
          ),
        ],
      ),
    );
  }

  Widget _buildLockPinTab() {
    final blockedStudents = _participants.where((p) => p.isBlocked).toList();

    if (blockedStudents.isEmpty) {
      return Center(
        child: SingleChildScrollView(
          padding: const EdgeInsets.all(32),
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Container(
                padding: const EdgeInsets.all(24),
                decoration: BoxDecoration(
                  color: AppColors.online.withOpacity(0.1),
                  shape: BoxShape.circle,
                ),
                child: const Icon(Icons.verified_user_outlined, size: 72, color: AppColors.online),
              ),
              const SizedBox(height: 24),
              Text(
                'Sistem Berjalan Kondusif',
                style: AppTypography.examTitle,
                textAlign: TextAlign.center,
              ),
              const SizedBox(height: 8),
              Text(
                'Tidak ada siswa terblokir di ruang ujian ini.',
                style: AppTypography.subtitle,
                textAlign: TextAlign.center,
              ),
            ],
          ),
        ),
      );
    }

    return ListView.builder(
      padding: const EdgeInsets.all(16),
      physics: const AlwaysScrollableScrollPhysics(),
      itemCount: blockedStudents.length,
      itemBuilder: (context, index) {
        final student = blockedStudents[index];
        return _buildBlockedStudentCard(student);
      },
    );
  }

  Widget _buildBlockedStudentCard(Participant student) {
    // We can fetch or mock a 4-digit PIN. In this project,
    // when a student gets blocked, the server generates a PIN (e.g. 4 digits)
    // and sends it via 'pin-generated' event.
    // Wait, since we get pin-generated events via socket, where do we save them?
    // Let's create a local mapping of PINs received for each student.
    // Wait, let's look at getProctorParticipants in the backend: does it return unlockPin?
    // Let's find out! Let's check `backend_server/src/controllers/admin/proctor.controller.js` to see if unlockPin is returned.
    // We can query that using view_file or grep_search.
    return _BlockedStudentWidget(
      student: student,
      selectedExamId: _selectedExamId ?? 0,
      roomName: _currentUser?['room']?.toString() ?? '',
      onUnlockSuccess: () {
        _loadParticipants();
      },
    );
  }

  Widget _buildHelpCard(String title, String body, IconData icon) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: AppColors.divider, width: 1),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Icon(icon, color: AppColors.accentGold, size: 20),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  title,
                  style: GoogleFonts.inter(
                    fontWeight: FontWeight.w700,
                    fontSize: 13,
                    color: AppColors.textPrimary,
                  ),
                ),
                const SizedBox(height: 4),
                Text(
                  body,
                  style: GoogleFonts.inter(
                    fontSize: 12,
                    color: AppColors.textSecondary,
                    height: 1.4,
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _BlockedStudentWidget extends StatefulWidget {
  final Participant student;
  final int selectedExamId;
  final String roomName;
  final VoidCallback onUnlockSuccess;

  const _BlockedStudentWidget({
    required this.student,
    required this.selectedExamId,
    required this.roomName,
    required this.onUnlockSuccess,
  });

  @override
  State<_BlockedStudentWidget> createState() => _BlockedStudentWidgetState();
}

class _BlockedStudentWidgetState extends State<_BlockedStudentWidget> {
  bool _isSending = false;

  Future<void> _triggerAutoUnlock() async {
    if (widget.student.unlockPin == null || widget.student.unlockPin!.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('PIN tidak tersedia. Coba refresh data.')),
      );
      return;
    }

    setState(() {
      _isSending = true;
    });

    try {
      // Jalur Otomatis: Emit event 'pin-generated' via WebSocket.
      final payload = {
        'studentId': int.tryParse(widget.student.userId.replaceAll('stu_', '')) ?? 0,
        'studentName': widget.student.name,
        'examAttemptId': widget.student.examAttemptId,
        'pin': widget.student.unlockPin,
        'roomName': widget.roomName,
        'subjectName': 'Ujian',
      };

      SocketService.instance.emit('pin-generated', payload);
      
      // Give a tiny delay for visual response
      await Future.delayed(const Duration(milliseconds: 600));

      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Sinyal buka otomatis dikirim ke ${widget.student.name}.'),
            backgroundColor: AppColors.submitGreen,
          ),
        );
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Gagal mengirim sinyal: $e')),
        );
      }
    } finally {
      if (mounted) {
        setState(() {
          _isSending = false;
        });
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final pin = widget.student.unlockPin ?? '----';
    return Container(
      margin: const EdgeInsets.only(bottom: 12),
      decoration: BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: AppColors.primary, width: 1.5),
      ),
      child: Padding(
        padding: const EdgeInsets.all(16.0),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Header: Warning Icon, Student Name & Class
            Row(
              children: [
                const Icon(Icons.lock, color: AppColors.primary, size: 20),
                const SizedBox(width: 10),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        widget.student.name,
                        style: GoogleFonts.inter(
                          fontSize: 16,
                          fontWeight: FontWeight.w700,
                          color: AppColors.textPrimary,
                        ),
                      ),
                      Text(
                        '${widget.student.nisn} · ${widget.student.className}',
                        style: AppTypography.studentMeta,
                      ),
                    ],
                  ),
                ),
              ],
            ),
            const SizedBox(height: 16),
            const Divider(color: AppColors.divider, height: 1),
            const SizedBox(height: 16),

            // Two columns/rows for Automatic vs Manual Unlock
            Text('METODE BUKA BLOKIR', style: AppTypography.labelCaps),
            const SizedBox(height: 12),

            Row(
              children: [
                // Jalur Otomatis
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        'JALUR OTOMATIS',
                        style: GoogleFonts.inter(
                          fontSize: 11,
                          fontWeight: FontWeight.w700,
                          color: AppColors.textSecondary,
                        ),
                      ),
                      const SizedBox(height: 8),
                      SizedBox(
                        width: double.infinity,
                        height: 48,
                        child: ElevatedButton(
                          style: ElevatedButton.styleFrom(
                            backgroundColor: AppColors.primary,
                            shape: RoundedRectangleBorder(
                              borderRadius: BorderRadius.circular(12),
                            ),
                          ),
                          onPressed: _isSending ? null : _triggerAutoUnlock,
                          child: _isSending
                              ? const SizedBox(
                                  width: 20,
                                  height: 20,
                                  child: CircularProgressIndicator(
                                    color: AppColors.textPrimary,
                                    strokeWidth: 2,
                                  ),
                                )
                              : Text(
                                  'BUKA OTOMATIS',
                                  style: AppTypography.buttonPrimary.copyWith(fontSize: 13),
                                ),
                        ),
                      ),
                    ],
                  ),
                ),

                const SizedBox(width: 16),

                // Jalur Manual
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        'JALUR MANUAL (PIN)',
                        style: GoogleFonts.inter(
                          fontSize: 11,
                          fontWeight: FontWeight.w700,
                          color: AppColors.textSecondary,
                        ),
                      ),
                      const SizedBox(height: 8),
                      Container(
                        height: 48,
                        alignment: Alignment.center,
                        decoration: BoxDecoration(
                          color: AppColors.background,
                          borderRadius: BorderRadius.circular(12),
                          border: Border.all(color: AppColors.divider, width: 1.5),
                        ),
                        child: Text(
                          pin,
                          style: GoogleFonts.barlowCondensed(
                            fontSize: 24,
                            fontWeight: FontWeight.w900,
                            color: AppColors.accentGold,
                            letterSpacing: 4.0,
                          ),
                        ),
                      ),
                    ],
                  ),
                ),
              ],
            ),
            const SizedBox(height: 12),
            Text(
              'Gunakan Jalur Otomatis untuk membuka layar siswa secara remote. Jika internet siswa bermasalah, bacakan kode PIN manual di atas.',
              style: GoogleFonts.inter(
                fontSize: 10,
                color: AppColors.textSecondary,
              ),
            ),
          ],
        ),
      ),
    );
  }
}
