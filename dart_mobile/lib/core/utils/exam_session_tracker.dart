import 'package:flutter/foundation.dart';

/// Penanda global (singleton) apakah murid SEDANG berada di dalam
/// ExamPlayerScreen. Dipakai oleh AutoLogoutGuard (lihat auto_logout_guard.dart)
/// agar auto-logout tengah malam TIDAK PERNAH memaksa keluar murid yang
/// sedang mengerjakan ujian — itu akan bentrok dengan screen pinning yang
/// aktif dan berisiko meninggalkan layar dalam kondisi terkunci tanpa jalan
/// keluar yang aman.
///
/// ExamPlayerScreen WAJIB men-set `isExamActive.value = true` di initState()
/// dan `= false` di dispose(), supaya AppShell tahu kapan aman untuk
/// menjalankan logout yang tertunda (lihat AppShell._handleExamActiveChanged).
class ExamSessionTracker {
  ExamSessionTracker._();

  static final ValueNotifier<bool> isExamActive = ValueNotifier<bool>(false);
}