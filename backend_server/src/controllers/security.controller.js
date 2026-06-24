const prisma = require('../config/database');
const { ok, badRequest, notFound } = require('../utils/response');
const { generateUnlockPin } = require('../utils/codeGenerator');
const { calculateScore } = require('../utils/scoring');
const { emitPinGenerated } = require('../socket');
const { body, validationResult } = require('express-validator');

const MAX_VIOLATIONS = 5;

/**
 * POST /api/security/report-violation
 * Dipanggil Flutter saat siswa terdeteksi lepas screen pinning.
 * Body: { examAttemptId, reasonCode, violationNumber }
 *
 * Flow (PRD Bagian 42, API Contract Bagian 6 & 7):
 *  1. Increment counter_pelanggaran
 *  2. Generate unlock_pin, simpan di exam_attempts
 *  3. Emit event "pin-generated" ke room pengawas via WebSocket (BUKAN REST)
 *  4. Jika >= MAX_VIOLATIONS → auto-submit ujian
 */
async function reportViolation(req, res, next) {
  try {
    const errs = validationResult(req);
    if (!errs.isEmpty()) return badRequest(res, 'Validasi gagal.', errs.array());

    const userId = req.user.id;
    const attemptId = +req.body.examAttemptId;

    const attempt = await prisma.examAttempt.findUnique({
      where: { id: attemptId },
      include: {
        user: { select: { id: true, name: true, room: true } },
        exam: { select: { id: true, subject: true, questionBankId: true } },
      },
    });

    if (!attempt) return notFound(res, 'Sesi ujian tidak ditemukan.');
    if (attempt.userId !== userId) return notFound(res, 'Sesi ujian tidak ditemukan.');
    if (attempt.status === 'submitted') return badRequest(res, 'Ujian sudah dikumpulkan.');
    if (attempt.status === 'waiting') return badRequest(res, 'Ujian belum dimulai.');

    const newCount = attempt.counterPelanggaran + 1;

    // Auto-submit saat batas pelanggaran tercapai
    if (newCount >= MAX_VIOLATIONS) {
      const exam = await prisma.exam.findUnique({
        where: { id: attempt.examId },
        include: { questionBank: { include: { questions: { include: { options: true } } } } },
      });
      const questions = exam?.questionBank?.questions ?? [];
      const { score } = await calculateScore(userId, attempt.examId, questions);

      await prisma.examAttempt.update({
        where: { id: attempt.id },
        data: {
          counterPelanggaran: newCount,
          status: 'submitted',
          finishedAt: new Date(),
          score,
        },
      });

      return ok(res, {
        action: 'AUTO_SUBMIT_DISQUALIFIED',
        counterPelanggaran: newCount,
      });
    }

    // Belum auto-submit — generate PIN dan push ke pengawas via WebSocket
    const unlockPin = generateUnlockPin();
    await prisma.examAttempt.update({
      where: { id: attempt.id },
      data: { counterPelanggaran: newCount, unlockPin },
    });

    // Push PIN ke room pengawas (PRD Bagian 42, API Contract Bagian 7)
    const roomName = attempt.user?.room;
    if (roomName) {
      emitPinGenerated(roomName, {
        examAttemptId: attempt.id,
        studentName: attempt.user.name,
        pin: unlockPin,
        subjectName: attempt.exam.subject,
        timestamp: new Date().toISOString(),
      });
    }

    return ok(res, {
      action: 'BLOCK_NORMAL',
      counterPelanggaran: newCount,
    });
  } catch (e) { next(e); }
}

/**
 * POST /api/security/verify-unlock
 * Dipanggil Flutter saat siswa memasukkan unlock_pin dari pengawas.
 * Body: { examAttemptId, pin }
 * Validasi PIN wajib spesifik per examAttemptId (PRD Bagian 42, API Contract Bagian 6).
 */
async function verifyUnlock(req, res, next) {
  try {
    const errs = validationResult(req);
    if (!errs.isEmpty()) return badRequest(res, 'Validasi gagal.', errs.array());

    const userId = req.user.id;
    const { examAttemptId, pin } = req.body;

    const attempt = await prisma.examAttempt.findUnique({
      where: { id: +examAttemptId },
    });

    if (!attempt || attempt.userId !== userId) return notFound(res, 'Sesi ujian tidak ditemukan.');
    if (attempt.status !== 'started') return badRequest(res, 'Sesi tidak aktif.');

    if (!attempt.unlockPin || attempt.unlockPin !== pin.toUpperCase().trim()) {
      return res.status(422).json({
        success: false,
        error: {
          code: 'PIN_INVALID',
          message: 'PIN salah atau tidak berlaku untuk sesi ujian ini.',
        },
      });
    }

    // Hapus PIN setelah berhasil (one-time use)
    await prisma.examAttempt.update({
      where: { id: attempt.id },
      data: { unlockPin: null },
    });

    return ok(res, { unlocked: true });
  } catch (e) { next(e); }
}

/**
 * GET /api/security/status/:examAttemptId
 * Dipanggil Flutter untuk cek status blokir saat restart app.
 */
async function getSecurityStatus(req, res, next) {
  try {
    const userId = req.user.id;
    const attemptId = +req.params.examAttemptId;

    const attempt = await prisma.examAttempt.findUnique({ where: { id: attemptId } });
    if (!attempt || attempt.userId !== userId) return notFound(res, 'Sesi ujian tidak ditemukan.');

    const isBlocked = !!(attempt.unlockPin && attempt.status === 'started');

    return ok(res, {
      isBlocked,
      counterPelanggaran: attempt.counterPelanggaran,
      remainingViolations: MAX_VIOLATIONS - attempt.counterPelanggaran,
      status: attempt.status,
    });
  } catch (e) { next(e); }
}

const violationRules = [
  body('examAttemptId').isInt({ min: 1 }).withMessage('examAttemptId wajib diisi.'),
  body('reasonCode').trim().notEmpty().withMessage('reasonCode wajib diisi.'),
];

const verifyUnlockRules = [
  body('examAttemptId').isInt({ min: 1 }).withMessage('examAttemptId wajib diisi.'),
  body('pin').trim().notEmpty().withMessage('pin wajib diisi.'),
];

module.exports = {
  reportViolation, verifyUnlock, getSecurityStatus,
  violationRules, verifyUnlockRules,
};
