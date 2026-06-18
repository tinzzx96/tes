import 'package:flutter/material.dart';
import '../../core/theme/app_colors.dart';
import '../../core/theme/app_typography.dart';
import '../../core/widgets/app_text_field.dart';
import '../../core/widgets/primary_button.dart';
import '../../core/widgets/warning_banner.dart';
import '../shell/app_shell.dart';

/// Login Screen — sesuai mockup Frame 1/9.
///
/// Komponen: Logo + judul, status verifikasi device, 3 input (NISN,
/// PASSWORD, TOKEN UJIAN), tombol MASUK, warning banner, dan caption versi.
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

  // TODO(integrasi-backend): device info asli harus diambil lewat
  // package `device_info_plus` (lihat LOGIC.md - exambro-mobile key packages)
  // lalu dicocokkan/registrasi ke Authentication API (Hero Exam PRD Section 27).
  final String _deviceName = 'ASUS-X409FA';
  final bool _deviceVerified = true;

  @override
  void dispose() {
    _nisnController.dispose();
    _passwordController.dispose();
    _tokenController.dispose();
    super.dispose();
  }

  Future<void> _handleLogin() async {
    // TODO(integrasi-backend): panggil Authentication API di sini
    // (validasi NISN, password, dan token ruangan terhadap jadwal_ujians).
    setState(() => _isLoading = true);
    await Future.delayed(const Duration(milliseconds: 600));
    if (!mounted) return;
    setState(() => _isLoading = false);
    Navigator.of(context).pushReplacement(
      MaterialPageRoute(builder: (_) => const AppShell()),
    );
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
              const _LogoSection(),
              const SizedBox(height: 24),
              Text(
                'EXAM PONCOL',
                style: AppTypography.pageTitle.copyWith(fontSize: 30),
              ),
              const SizedBox(height: 8),
              Text(
                'Secure Examination System',
                style: AppTypography.subtitle,
              ),
              const SizedBox(height: 16),
              _DeviceVerifiedRow(
                deviceName: _deviceName,
                verified: _deviceVerified,
              ),
              const SizedBox(height: 32),
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
                    setState(() => _obscurePassword = !_obscurePassword);
                  },
                ),
              ),
              const SizedBox(height: 16),
              AppTextField(
                label: 'TOKEN UJIAN',
                hint: 'Ketik Token disini...',
                controller: _tokenController,
              ),
              const SizedBox(height: 24),
              PrimaryButton(
                label: 'MASUK',
                icon: Icons.lock_outline,
                isLoading: _isLoading,
                onPressed: _handleLogin,
              ),
              const SizedBox(height: 24),
              const WarningBanner(
                message:
                    'Sesi ujian ini dipantau secara langsung. Setiap '
                    'aktivitas mencurigakan akan dilaporkan kepada pengawas.',
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

class _DeviceVerifiedRow extends StatelessWidget {
  final String deviceName;
  final bool verified;

  const _DeviceVerifiedRow({
    required this.deviceName,
    required this.verified,
  });

  @override
  Widget build(BuildContext context) {
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        Container(
          width: 8,
          height: 8,
          decoration: BoxDecoration(
            color: verified ? AppColors.online : AppColors.textMuted,
            shape: BoxShape.circle,
          ),
        ),
        const SizedBox(width: 8),
        Text(
          '$deviceName \u00b7 ${verified ? 'Verified' : 'Not Verified'}',
          style: AppTypography.deviceVerified,
        ),
      ],
    );
  }
}
