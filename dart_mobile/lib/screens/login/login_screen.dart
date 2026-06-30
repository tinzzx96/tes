import 'package:flutter/material.dart';
import 'package:http/http.dart' as http;
import 'dart:async';
import '../../core/config/api_config.dart';
import '../../core/theme/app_colors.dart';
import '../../core/theme/app_typography.dart';
import '../../core/utils/greeting_helper.dart';
import '../../core/utils/auth_repository.dart';
import '../../core/utils/device_info_service.dart';
import '../../core/widgets/app_text_field.dart';
import '../../core/widgets/fade_in_item.dart';
import '../../core/widgets/primary_button.dart';
import '../../core/widgets/warning_banner.dart';
import '../shell/app_shell.dart';
import '../proctor/proctor_dashboard_screen.dart';
import '../../core/utils/auto_logout_guard.dart';

/// Login Screen — sesuai mockup Frame 1/9.
///
/// CATATAN PENTING — "Token Sesi" vs "Token Ujian" (JANGAN TERTUKAR):
/// - Token Sesi (field di halaman ini): dimasukkan SEKALI saat login,
///   untuk validasi identitas/perangkat awal sebelum murid masuk ke
///   AppShell (Home/Schedule/History).
/// - Token Ujian (popup terpisah, lihat ExamTokenDialog): kode unik yang
///   diminta ULANG setiap kali murid menekan "MULAI UJIAN" di Home Screen,
///   khusus untuk sesi pengerjaan soal yang akan dibuka.
class LoginScreen extends StatefulWidget {
  const LoginScreen({super.key});

  @override
  State<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends State<LoginScreen> {
  final _nisnController = TextEditingController();
  final _passwordController = TextEditingController();
  final _tokenController = TextEditingController();

  bool _obscurePassword = true;
  bool _isLoading = false;
  bool _serverConnected = false;
  Timer? _connCheckTimer;
  String _deviceName = 'Memuat...';

  @override
  void initState() {
    super.initState();
    _checkConnection();
    // Cek koneksi berkala setiap 5 detik
    _connCheckTimer = Timer.periodic(const Duration(seconds: 5), (_) => _checkConnection());
    _checkAutoLogin();
    _loadDeviceName();
  }

  Future<void> _loadDeviceName() async {
    try {
      final name = await DeviceInfoService.getDeviceName();
      if (mounted) setState(() => _deviceName = name);
    } catch (_) {
      if (mounted) setState(() => _deviceName = 'Perangkat Ini');
    }
  }

  Future<void> _checkAutoLogin() async {
    final token = await AuthRepository.getToken();
    if (token.isEmpty) return;

    // Check if we have crossed midnight since last active
    final crossed = await AutoLogoutGuard.hasCrossedMidnightSinceLastActive();
    if (crossed) {
      // If midnight crossed, clear session and force login
      await AutoLogoutGuard.clearSession();
      await AuthRepository.logout();
      return;
    }

    if (mounted) {
      setState(() {
        _isLoading = true;
      });
    }

    try {
      // Verify token/profile against the server to check validity
      final userProfile = await AuthRepository.me();
      final role = userProfile['role']?.toString() ?? '';
      await AuthRepository.saveRole(role);

      if (!mounted) return;

      if (role == 'proctor' || role == 'admin') {
        Navigator.of(context).pushReplacement(
          MaterialPageRoute(builder: (_) => const ProctorDashboardScreen()),
        );
      } else {
        Navigator.of(context).pushReplacement(
          MaterialPageRoute(builder: (_) => const AppShell()),
        );
      }
    } catch (e) {
      // If it's a validation error (401 / Unauthorized / Forbidden), logout.
      // But if it's a network timeout/offline issue, let them continue using their cached session offline!
      if (e is AuthException && (e.statusCode == 401 || e.statusCode == 403)) {
        await AutoLogoutGuard.clearSession();
        await AuthRepository.logout();
        if (mounted) {
          setState(() {
            _isLoading = false;
          });
        }
      } else {
        // Network or server temporarily down, but token might still be valid.
        // Retrieve the stored role so we know where to route the user.
        final role = await AuthRepository.getRole();
        if (!mounted) return;
        if (role.isNotEmpty) {
          if (role == 'proctor' || role == 'admin') {
            Navigator.of(context).pushReplacement(
              MaterialPageRoute(builder: (_) => const ProctorDashboardScreen()),
            );
          } else {
            Navigator.of(context).pushReplacement(
              MaterialPageRoute(builder: (_) => const AppShell()),
            );
          }
        } else {
          // No saved role, stay on login screen.
          if (mounted) {
            setState(() {
              _isLoading = false;
            });
          }
        }
      }
    }
  }

  @override
  void dispose() {
    _connCheckTimer?.cancel();
    _nisnController.dispose();
    _passwordController.dispose();
    _tokenController.dispose();
    super.dispose();
  }

  Future<void> _checkConnection() async {
    try {
      final healthUrl = ApiConfig.baseUrl.replaceAll('/api', '/health');
      final res = await http.get(Uri.parse(healthUrl)).timeout(const Duration(seconds: 3));
      if (res.statusCode == 200) {
        if (mounted) {
          setState(() {
            _serverConnected = true;
          });
        }
        return;
      }
    } catch (_) {}
    if (mounted) {
      setState(() {
        _serverConnected = false;
      });
    }
  }

  void _showServerConfigDialog() {
    final ipController = TextEditingController(text: ApiConfig.baseUrl);
    showDialog(
      context: context,
      barrierDismissible: true,
      builder: (context) {
        return AlertDialog(
          backgroundColor: const Color(0xFF1E1E1E),
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(16),
            side: const BorderSide(color: Color(0xFF333333), width: 1.5),
          ),
          title: Text(
            'KONFIGURASI SERVER IP',
            style: AppTypography.pageTitle.copyWith(fontSize: 18, color: AppColors.accentGold),
          ),
          content: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                'Masukkan alamat server (IP & Port):',
                style: AppTypography.caption.copyWith(color: AppColors.textSecondary),
              ),
              const SizedBox(height: 12),
              TextField(
                controller: ipController,
                style: AppTypography.subtitle.copyWith(color: AppColors.textPrimary),
                decoration: InputDecoration(
                  filled: true,
                  fillColor: const Color(0xFF121212),
                  hintText: 'http://192.168.1.100:8000/api',
                  hintStyle: AppTypography.caption.copyWith(color: Colors.grey[700]),
                  enabledBorder: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(8),
                    borderSide: const BorderSide(color: Color(0xFF444444)),
                  ),
                  focusedBorder: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(8),
                    borderSide: const BorderSide(color: AppColors.primary, width: 1.5),
                  ),
                  contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
                ),
              ),
              const SizedBox(height: 8),
              Text(
                'Contoh:\n- Android Emulator: http://10.0.2.2:8000/api\n- HP Fisik / Lokal: http://192.168.1.50:8000/api\n- Windows Desktop: http://127.0.0.1:8000/api',
                style: AppTypography.caption.copyWith(color: Colors.grey[600], fontSize: 11),
              ),
            ],
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.pop(context),
              child: Text(
                'BATAL',
                style: AppTypography.caption.copyWith(color: AppColors.textSecondary, fontWeight: FontWeight.bold),
              ),
            ),
            ElevatedButton(
              style: ElevatedButton.styleFrom(
                backgroundColor: AppColors.primary,
                foregroundColor: Colors.white,
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(8),
                ),
                padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
              ),
              onPressed: () async {
                final input = ipController.text.trim();
                if (input.isNotEmpty) {
                  await ApiConfig.saveBaseUrl(input);
                  if (mounted) {
                    setState(() {
                      _serverConnected = false;
                    });
                  }
                  Navigator.pop(context);
                  _checkConnection();
                }
              },
              child: Text(
                'SIMPAN',
                style: AppTypography.caption.copyWith(color: Colors.white, fontWeight: FontWeight.bold),
              ),
            ),
          ],
        );
      },
    );
  }

  Future<void> _handleLogin() async {
    setState(() => _isLoading = true);

    try {
      await AuthRepository.login(
        nisn: _nisnController.text.trim(),
        password: _passwordController.text,
        sessionToken: _tokenController.text.trim().toUpperCase(),
      );

      final userProfile = await AuthRepository.me();
      final role = userProfile['role']?.toString() ?? '';
      await AuthRepository.saveRole(role);

      if (!mounted) return;

      if (role == 'proctor' || role == 'admin') {
        Navigator.of(context).pushReplacement(
          MaterialPageRoute(builder: (_) => const ProctorDashboardScreen()),
        );
      } else {
        Navigator.of(context).pushReplacement(
          MaterialPageRoute(builder: (_) => const AppShell()),
        );
      }
    } on DeviceLockException catch (e) {
      // Tampilkan dialog tegas untuk Device Lock — bukan sekadar snackbar
      if (!mounted) return;
      showDialog(
        context: context,
        barrierDismissible: false,
        builder: (ctx) => AlertDialog(
          backgroundColor: const Color(0xFF1E0808),
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(16),
            side: const BorderSide(color: Color(0xFFCC0000), width: 2),
          ),
          icon: const Icon(Icons.lock_person, color: Color(0xFFCC0000), size: 36),
          title: Text(
            'Akses Ditolak',
            style: AppTypography.pageTitle.copyWith(fontSize: 18, color: Colors.redAccent),
            textAlign: TextAlign.center,
          ),
          content: Text(
            e.message,
            style: AppTypography.subtitle.copyWith(color: Colors.white70, fontSize: 14),
            textAlign: TextAlign.center,
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.of(ctx).pop(),
              child: Text(
                'MENGERTI',
                style: AppTypography.caption.copyWith(
                  color: Colors.redAccent,
                  fontWeight: FontWeight.bold,
                ),
              ),
            ),
          ],
        ),
      );
    } on TimeoutException catch (_) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Koneksi timeout. Pastikan IP server diatur dengan benar.'),
        ),
      );
    } on Exception catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(e.toString().replaceFirst('Exception: ', ''))),
      );
    } catch (_) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
            content:
            Text('Tidak bisa terhubung ke server. Periksa koneksi.')),
      );
    } finally {
      if (mounted) setState(() => _isLoading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.background,
      body: SafeArea(
        child: SingleChildScrollView(
          padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 32),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.center,
            children: [
              const SizedBox(height: 16),
              FadeInItem(index: 0, child: const _LogoSection()),
              const SizedBox(height: 24),
              FadeInItem(
                index: 1,
                child: Column(
                  children: [
                    Text(
                      'EXAM PONCOL',
                      style: AppTypography.pageTitle.copyWith(fontSize: 30),
                    ),
                    const SizedBox(height: 8),
                    Text('Secure Examination System',
                        style: AppTypography.subtitle),
                  ],
                ),
              ),
              const SizedBox(height: 14),
              FadeInItem(
                index: 2,
                child: Column(
                  children: [
                    Text(
                      GreetingHelper.greeting(),
                      style: AppTypography.subtitle.copyWith(
                        color: AppColors.textPrimary,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                    const SizedBox(height: 10),
                    _ServerStatusRow(
                      connected: _serverConnected,
                      onTap: _showServerConfigDialog,
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 24),
              FadeInItem(
                index: 3,
                child: Column(
                  children: [
                    AppTextField(
                      label: 'NISN',
                      hint: 'Ketik NISN disini...',
                      controller: _nisnController,
                      keyboardType: TextInputType.number,
                    ),
                    const SizedBox(height: 16),
                    AppTextField(
                      label: 'PASSWORD',
                      hint: 'Ketik Password disini...',
                      controller: _passwordController,
                      obscureText: _obscurePassword,
                      suffixIcon: IconButton(
                        icon: Icon(
                          _obscurePassword
                              ? Icons.visibility_off_outlined
                              : Icons.visibility_outlined,
                          color: AppColors.textSecondary,
                          size: 20,
                        ),
                        onPressed: () {
                          setState(
                                  () => _obscurePassword = !_obscurePassword);
                        },
                      ),
                    ),
                    const SizedBox(height: 16),
                    AppTextField(
                      label: 'TOKEN SESI',
                      hint: 'Ketik Token Sesi disini...',
                      controller: _tokenController,
                    ),
                    // ── Informasi Perangkat (PRD Bagian transparansi) ───────
                    const SizedBox(height: 12),
                    _DeviceInfoBanner(deviceName: _deviceName),
                    // ────────────────────────────────────────────────────────
                    const SizedBox(height: 24),
                    PrimaryButton(
                      label: 'MASUK',
                      icon: Icons.lock_outline,
                      isLoading: _isLoading,
                      onPressed: _handleLogin,
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 24),
              FadeInItem(
                index: 4,
                child: const WarningBanner(
                  message:
                  'Sesi ujian ini dipantau secara langsung. Setiap '
                      'aktivitas mencurigakan akan dilaporkan kepada pengawas.',
                ),
              ),
              const SizedBox(height: 24),
              Text(
                'ExamApp v1.0.1 \u00b7 SMK Poncol Jakarta',
                style: AppTypography.caption,
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _LogoSection extends StatelessWidget {
  const _LogoSection();

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      width: 120,
      height: 120,
      child: Image.asset(
        'assets/images/logo_poncol.png',
        fit: BoxFit.contain,
        errorBuilder: (context, error, stackTrace) {
          return Container(
            decoration: BoxDecoration(
              color: AppColors.primary,
              borderRadius: BorderRadius.circular(16),
              border: Border.all(color: AppColors.accentGold, width: 2),
            ),
            alignment: Alignment.center,
            child: Text(
              'SMK',
              style: AppTypography.pageTitle.copyWith(fontSize: 28),
            ),
          );
        },
      ),
    );
  }
}

class _ServerStatusRow extends StatelessWidget {
  final bool connected;
  final VoidCallback onTap;

  const _ServerStatusRow({
    required this.connected,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(8),
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Container(
              width: 8,
              height: 8,
              decoration: BoxDecoration(
                color: connected ? AppColors.online : AppColors.primary,
                shape: BoxShape.circle,
              ),
            ),
            const SizedBox(width: 8),
            Text(
              connected ? 'Server Terhubung' : 'Server Tidak Terhubung (Ketuk untuk Mengatur)',
              style: AppTypography.deviceVerified.copyWith(
                color: connected ? AppColors.online : AppColors.primary,
                fontWeight: FontWeight.bold,
              ),
            ),
          ],
        ),
      ),
    );
  }
}

/// Banner transparan yang menampilkan nama perangkat saat ini.
/// Memberi kesan bahwa sistem sedang mengenali identitas perangkat siswa.
class _DeviceInfoBanner extends StatelessWidget {
  final String deviceName;
  const _DeviceInfoBanner({required this.deviceName});

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
      decoration: BoxDecoration(
        color: const Color(0xFF1A1A1A),
        borderRadius: BorderRadius.circular(10),
        border: Border.all(color: const Color(0xFF333333)),
      ),
      child: Row(
        children: [
          const Icon(
            Icons.phonelink_setup_outlined,
            size: 16,
            color: Color(0xFF888888),
          ),
          const SizedBox(width: 10),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  'Perangkat Terdeteksi',
                  style: AppTypography.caption.copyWith(
                    color: const Color(0xFF666666),
                    fontSize: 10,
                    letterSpacing: 0.8,
                  ),
                ),
                const SizedBox(height: 2),
                Text(
                  deviceName,
                  style: AppTypography.subtitle.copyWith(
                    color: const Color(0xFFBBBBBB),
                    fontSize: 13,
                    fontWeight: FontWeight.w600,
                  ),
                  overflow: TextOverflow.ellipsis,
                ),
              ],
            ),
          ),
          const Icon(
            Icons.verified_outlined,
            size: 16,
            color: Color(0xFF00AA55),
          ),
        ],
      ),
    );
  }
}
