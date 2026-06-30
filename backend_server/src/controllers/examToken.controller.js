const prisma = require('../config/database');
const { ok, badRequest, notFound } = require('../utils/response');
const { body, validationResult } = require('express-validator');

/**
 * POST /api/exam-tokens/validate
 * Siswa memasukkan Token Ujian sebelum ExamPlayerScreen dibuka.
 * Divalidasi terhadap tabel exam_tokens (PRD Bagian 23, API Contract Bagian 3).
 */
async function validateExamToken(req, res, next) {
  try {
    const errs = validationResult(req);
    if (!errs.isEmpty()) return badRequest(res, 'Validasi gagal.', errs.array());

    const userId = req.user.id;
    const { examId, token } = req.body;
    const examIdInt = +examId;

    // Cari exam berdasarkan examId dari database
    const exam = await prisma.exam.findUnique({
      where: { id: examIdInt },
    });

    if (!exam || exam.token.toUpperCase().trim() !== token.toUpperCase().trim()) {
      return res.status(422).json({
        success: false,
        error: {
          code: 'TOKEN_INVALID',
          message: 'Token Ujian salah. Hubungi pengawas untuk konfirmasi token.',
        },
      });
    }

    if (exam.status !== 'active') {
      return res.status(422).json({
        success: false,
        error: {
          code: 'EXAM_NOT_ACTIVE',
          message: 'Ujian belum aktif atau sudah selesai.',
        },
      });
    }

    // Cari atau buat exam_attempt — pakai upsert untuk hindari race condition P2002
    let attempt;
    try {
      attempt = await prisma.examAttempt.upsert({
        where: { userId_examId: { userId, examId: examIdInt } },
        create: { userId, examId: examIdInt, status: 'waiting' },
        update: {}, // jika sudah ada, tidak diubah
      });
    } catch (error) {
      if (error.code === 'P2002') {
        attempt = await prisma.examAttempt.findUnique({
          where: { userId_examId: { userId, examId: examIdInt } },
        });
      } else {
        throw error;
      }
    }

    if (attempt.status === 'submitted') {
      return res.status(422).json({
        success: false,
        error: {
          code: 'EXAM_ALREADY_SUBMITTED',
          message: 'Ujian ini sudah dikumpulkan.',
        },
      });
    }

    return ok(res, {
      valid: true,
      examAttemptId: attempt.id,
    });
  } catch (e) { next(e); }
}

const validateExamTokenRules = [
  body('examId').isInt({ min: 1 }).withMessage('examId wajib diisi.'),
  body('token').trim().notEmpty().withMessage('Token Ujian wajib diisi.'),
];

module.exports = { validateExamToken, validateExamTokenRules };
