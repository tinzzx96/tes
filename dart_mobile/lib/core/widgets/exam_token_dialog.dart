import 'package:flutter/material.dart';
import '../theme/app_colors.dart';
import '../theme/app_typography.dart';
import '../utils/exam_token_repository.dart';

/// Popup yang muncul saat murid menekan "MULAI UJIAN" di Home Screen,
/// meminta Token Ujian (kode unik per sesi ujian, BUKAN Token Sesi di
/// Login Screen) sebelum diizinkan melanjutkan ke ValidationScreen.
///
/// Mengembalikan `true` lewat Navigator.pop jika token valid, atau `null`/
/// `false` jika dibatalkan murid.
class ExamTokenDialog extends StatefulWidget {
  final String examId;
  final String subjectName;

  const ExamTokenDialog({
    super.key,
    required this.examId,
    required this.subjectName,
  });

  /// Helper pemanggilan singkat. Mengembalikan true jika token berhasil
  /// divalidasi, false/null jika murid membatalkan.
  static Future<bool?> show(
    BuildContext context, {
    required String examId,
    required String subjectName,
  }) {
    return showDialog<bool>(
      context: context,
      barrierDismissible: false,
      builder: (_) => ExamTokenDialog(examId: examId, subjectName: subjectName),
    );
  }

  @override
  State<ExamTokenDialog> createState() => _ExamTokenDialogState();
}

class _ExamTokenDialogState extends State<ExamTokenDialog> {
  final _controller = TextEditingController();
  bool _isValidating = false;
  String _error = '';

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  Future<void> _handleSubmit() async {
    if (_isValidating) return;
    setState(() {
      _isValidating = true;
      _error = '';
    });

    final result = await ExamTokenRepository.validate(
      examId: int.parse(widget.examId),
      enteredToken: _controller.text,
    );

    if (!mounted) return;

    if (result.isValid) {
      Navigator.of(context).pop(true);
    } else {
      setState(() {
        _isValidating = false;
        _error = result.errorMessage ?? 'Token tidak valid.';
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    return AlertDialog(
      backgroundColor: AppColors.surface,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
      title: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Icon(Icons.vpn_key_outlined, color: AppColors.primary, size: 28),
          const SizedBox(height: 8),
          Text('Token Ujian', style: AppTypography.cardTitle.copyWith(
            color: AppColors.textPrimary,
          )),
        ],
      ),
      content: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            'Masukkan Token Ujian ${widget.subjectName} yang diberikan pengawas ruangan.',
            style: AppTypography.cardMeta.copyWith(
              color: AppColors.textSecondary,
              height: 1.4,
            ),
          ),
          const SizedBox(height: 16),
          TextField(
            controller: _controller,
            autofocus: true,
            textCapitalization: TextCapitalization.characters,
            enabled: !_isValidating,
            style: AppTypography.cardTitle.copyWith(
              color: AppColors.textPrimary,
              letterSpacing: 3,
            ),
            decoration: InputDecoration(
              hintText: 'MIS. MATH99',
              hintStyle: AppTypography.cardMeta.copyWith(color: AppColors.textSecondary),
              filled: true,
              fillColor: AppColors.background,
              border: OutlineInputBorder(
                borderRadius: BorderRadius.circular(8),
                borderSide: const BorderSide(color: AppColors.inputBorder),
              ),
              focusedBorder: OutlineInputBorder(
                borderRadius: BorderRadius.circular(8),
                borderSide: const BorderSide(color: AppColors.primary, width: 1.5),
              ),
              errorText: _error.isEmpty ? null : _error,
              errorStyle: AppTypography.cardMeta.copyWith(color: AppColors.primary, fontSize: 11),
            ),
            onSubmitted: (_) => _handleSubmit(),
          ),
        ],
      ),
      actions: [
        TextButton(
          onPressed: _isValidating ? null : () => Navigator.of(context).pop(false),
          child: Text('Batal', style: AppTypography.cardMeta.copyWith(color: AppColors.textSecondary)),
        ),
        ElevatedButton(
          onPressed: _isValidating ? null : _handleSubmit,
          style: ElevatedButton.styleFrom(
            backgroundColor: AppColors.primary,
            foregroundColor: AppColors.textPrimary,
            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
          ),
          child: _isValidating
              ? const SizedBox(
                  width: 16,
                  height: 16,
                  child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white),
                )
              : Text('LANJUTKAN', style: AppTypography.buttonPrimary.copyWith(fontSize: 13)),
        ),
      ],
    );
  }
}