import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'app_colors.dart';

/// Token tipografi sesuai DESIGN_SYSTEM.md Section 2: TYPOGRAPHY.
/// Font heading: Barlow Condensed (ExtraBold/Bold).
/// Font body & UI: Inter.
/// Font aksen (nama siswa & page title besar): Alumni Sans, sesuai desain
/// Figma asli — dipakai konsisten di "EXAM SCHEDULE" (pageTitle) dan nama
/// siswa di header (studentName), supaya kedua elemen itu terlihat seragam.
class AppTypography {
  AppTypography._();

  // ===== Dark Screen Styles =====

  /// "EXAM PONCOL" di AppBar — Barlow Condensed ExtraBold 22sp.
  static TextStyle get appTitle => GoogleFonts.barlowCondensed(
    fontSize: 22,
    fontWeight: FontWeight.w800,
    color: AppColors.textPrimary,
    letterSpacing: 4,
  );

  /// "EXAM SCHEDULE" heading halaman — Alumni Sans ExtraBold 32sp.
  static TextStyle get pageTitle => GoogleFonts.alumniSans(
    fontSize: 32,
    fontWeight: FontWeight.w800,
    color: AppColors.textPrimary,
    height: 1.0,
  );

  /// Nama mapel di exam card gelap — Barlow Condensed ExtraBold 24sp.
  static TextStyle get examTitle => GoogleFonts.barlowCondensed(
    fontSize: 24,
    fontWeight: FontWeight.w800,
    color: AppColors.textPrimary,
    height: 1.1,
  );

  /// Nama siswa (DANANG PRAKOSO) — Alumni Sans Bold 24sp.
  /// Disamakan dengan pageTitle (Alumni Sans) sesuai desain Figma asli;
  /// ukuran sedikit lebih besar dari Inter 20sp lama (24sp) karena Alumni
  /// Sans secara visual lebih ramping/condensed, supaya proporsi tetap
  /// terlihat seimbang di header.
  static TextStyle get studentName => GoogleFonts.alumniSans(
    fontSize: 24,
    fontWeight: FontWeight.w700,
    color: AppColors.textPrimary,
  );

  /// NISN · Kelas (di bawah nama) — Inter Regular 13sp.
  static TextStyle get studentMeta => GoogleFonts.inter(
    fontSize: 13,
    fontWeight: FontWeight.w400,
    color: AppColors.textSecondary,
  );

  /// Subtitle kecil abu-abu di bawah heading halaman, contoh:
  /// "JADWAL ULANGAN KELAS ANDA" di bawah "EXAM SCHEDULE" — Inter Regular
  /// 12sp, pakai textSecondary (abu-abu) yang sudah ada di AppColors.
  static TextStyle get pageSubtitle => GoogleFonts.inter(
    fontSize: 12,
    fontWeight: FontWeight.w500,
    color: AppColors.textSecondary,
    letterSpacing: 1.0,
  );

  /// Label capslock: "TODAY'S EXAM", "DEVICE", "ROOM" — Inter SemiBold 11sp.
  static TextStyle get labelCaps => GoogleFonts.inter(
    fontSize: 11,
    fontWeight: FontWeight.w600,
    color: AppColors.textSecondary,
    letterSpacing: 1.2,
  );

  /// Teks tombol "MASUK", "MULAI UJIAN" — Barlow Condensed Bold 16sp.
  static TextStyle get buttonPrimary => GoogleFonts.barlowCondensed(
    fontSize: 16,
    fontWeight: FontWeight.w700,
    color: AppColors.textPrimary,
    letterSpacing: 1.5,
  );

  // ===== Light Card Styles =====

  /// Nama mapel di schedule card putih — Inter Bold 18sp.
  static TextStyle get cardTitle => GoogleFonts.inter(
    fontSize: 18,
    fontWeight: FontWeight.w700,
    color: AppColors.textDark,
  );

  /// Kode ujian (MTK-2026-UAS) — Inter Regular 13sp.
  static TextStyle get cardCode => GoogleFonts.inter(
    fontSize: 13,
    fontWeight: FontWeight.w400,
    color: AppColors.textMuted,
  );

  /// Waktu, ruangan, nama guru — Inter Regular 13sp.
  static TextStyle get cardMeta => GoogleFonts.inter(
    fontSize: 13,
    fontWeight: FontWeight.w400,
    color: AppColors.textMuted,
  );

  /// Tanggal di bagian bawah card — Inter Regular 12sp.
  static TextStyle get cardDate => GoogleFonts.inter(
    fontSize: 12,
    fontWeight: FontWeight.w400,
    color: AppColors.textMuted,
  );

  /// "TODAY" di badge merah — Inter Bold 11sp.
  static TextStyle get badgeToday => GoogleFonts.inter(
    fontSize: 11,
    fontWeight: FontWeight.w700,
    color: AppColors.textPrimary,
    letterSpacing: 1.0,
  );

  // ===== Form & Utility Styles =====

  /// "Secure Examination System" subtitle — Inter Regular 14sp.
  static TextStyle get subtitle => GoogleFonts.inter(
    fontSize: 14,
    fontWeight: FontWeight.w400,
    color: AppColors.textSecondary,
  );

  /// Label field: "NISN", "PASSWORD" — Inter Bold 12sp.
  static TextStyle get inputLabel => GoogleFonts.inter(
    fontSize: 12,
    fontWeight: FontWeight.w700,
    color: AppColors.textPrimary,
    letterSpacing: 2,
  );

  /// Placeholder dalam field — Inter Regular 14sp.
  static TextStyle get inputHint => GoogleFonts.inter(
    fontSize: 14,
    fontWeight: FontWeight.w400,
    color: AppColors.textSecondary,
  );

  /// "ExamApp v1.0.1 · SMK Poncol Jakarta" — Inter Regular 11sp.
  static TextStyle get caption => GoogleFonts.inter(
    fontSize: 11,
    fontWeight: FontWeight.w400,
    color: AppColors.textSecondary,
  );

  /// "ASUS-X409FA · Verified" — Inter Regular 13sp.
  static TextStyle get deviceVerified => GoogleFonts.inter(
    fontSize: 13,
    fontWeight: FontWeight.w400,
    color: AppColors.textSecondary,
  );

  /// Teks dalam warning banner — Inter Regular 13sp.
  static TextStyle get warning => GoogleFonts.inter(
    fontSize: 13,
    fontWeight: FontWeight.w400,
    color: AppColors.warningText,
  );

  /// "8:00 – 10:00" waktu ujian — Inter Bold 20sp.
  static TextStyle get timeBold => GoogleFonts.inter(
    fontSize: 20,
    fontWeight: FontWeight.w700,
    color: AppColors.textPrimary,
  );

  /// "Duration" label — Inter Regular 12sp.
  static TextStyle get durationLabel => GoogleFonts.inter(
    fontSize: 12,
    fontWeight: FontWeight.w400,
    color: AppColors.textSecondary,
  );

  /// "120 Min" — Inter Bold 18sp.
  static TextStyle get durationValue => GoogleFonts.inter(
    fontSize: 18,
    fontWeight: FontWeight.w700,
    color: AppColors.textPrimary,
  );
}