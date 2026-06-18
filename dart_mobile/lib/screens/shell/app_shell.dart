import 'package:flutter/material.dart';
import '../../core/widgets/app_bottom_nav_bar.dart';
import '../home/home_screen.dart';
import '../schedule/schedule_screen.dart';

/// Shell utama setelah login — mengatur perpindahan antara Home dan
/// Schedule Screen lewat Bottom Navigation Bar.
///
/// Memakai `IndexedStack` (bukan mengganti widget tree sepenuhnya) supaya
/// state masing-masing screen (misal posisi scroll) tetap terjaga saat
/// pindah tab.
class AppShell extends StatefulWidget {
  const AppShell({super.key});

  @override
  State<AppShell> createState() => _AppShellState();
}

class _AppShellState extends State<AppShell> {
  int _currentIndex = 0;

  static const List<Widget> _screens = [
    HomeScreen(),
    ScheduleScreen(),
  ];

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: IndexedStack(index: _currentIndex, children: _screens),
      bottomNavigationBar: AppBottomNavBar(
        currentIndex: _currentIndex,
        onTap: (index) => setState(() => _currentIndex = index),
      ),
    );
  }
}
