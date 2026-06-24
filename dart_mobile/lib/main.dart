import 'package:flutter/material.dart';
import 'core/theme/app_theme.dart';
import 'screens/login/login_screen.dart';
import 'core/utils/security_guard.dart'; // ✅ import SecurityGuard

void main() async {
  WidgetsFlutterBinding.ensureInitialized();
  await SecurityGuard.enableScreenProtection();
  await SecurityGuard.enterImmersiveMode(); // TAMBAHKAN
  runApp(const ExamPoncolApp());
}

class ExamPoncolApp extends StatelessWidget {
  const ExamPoncolApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'Exam Poncol',
      debugShowCheckedModeBanner: false,
      theme: AppTheme.darkTheme,
      home: const LoginScreen(),
    );
  }
}