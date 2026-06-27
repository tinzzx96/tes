import 'package:flutter/material.dart';
import '../../core/theme/app_colors.dart';
import '../../core/theme/app_typography.dart';
import '../../core/utils/greeting_helper.dart';
import '../../core/utils/auth_repository.dart';
import '../../core/widgets/app_text_field.dart';
import '../../core/widgets/fade_in_item.dart';
import '../../core/widgets/primary_button.dart';
import '../../core/widgets/warning_banner.dart';
import '../shell/app_shell.dart';
import '../proctor/proctor_dashboard_screen.dart';

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
  final bool _serverConnected = true;

  @override
  void dispose() {
    _nisnController.dispose();
    _passwordController.dispose();
    _tokenController.dispose();
    super.dispose();
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
      final role = userProfile['role']?.toString();

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
                    _ServerStatusRow(connected: _serverConnected),
                  ],
                ),
              ),
              const SizedBox(height: 32),
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

  const _ServerStatusRow({required this.connected});

  @override
  Widget build(BuildContext context) {
    return Row(
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
          connected ? 'Server terhubung' : 'Server tidak terjangkau',
          style: AppTypography.deviceVerified,
        ),
      ],
    );
  }
}
