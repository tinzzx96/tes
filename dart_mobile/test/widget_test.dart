// Smoke test dasar untuk Exam Poncol.
//
// Test ini hanya memastikan LoginScreen bisa dirender tanpa error dan
// menampilkan elemen-elemen kunci (judul, tombol MASUK). Test counter
// bawaan template Flutter (`Counter increments smoke test`) dihapus karena
// sudah tidak relevan — aplikasi ini bukan counter app.

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:apk_ujian/main.dart';

void main() {
  testWidgets('LoginScreen menampilkan judul dan tombol MASUK', (
    WidgetTester tester,
  ) async {
    await tester.pumpWidget(const ExamPoncolApp());

    expect(find.text('EXAM PONCOL'), findsOneWidget);
    expect(find.text('MASUK'), findsOneWidget);
    expect(find.text('Secure Examination System'), findsOneWidget);
  });

  testWidgets('Form login memiliki 3 input field', (
    WidgetTester tester,
  ) async {
    await tester.pumpWidget(const ExamPoncolApp());

    expect(find.byType(TextField), findsNWidgets(3));
  });
}
