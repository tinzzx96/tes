const router = require('express').Router();
const prisma = require('../../config/database');
const { ok, badRequest, notFound } = require('../../utils/response');
const { body, validationResult } = require('express-validator');

// POST /api/admin/exam-tokens — buat Token Ujian untuk exam tertentu
router.post('/', [
  body('examId').isInt({ min: 1 }).withMessage('examId wajib diisi.'),
  body('token').trim().notEmpty().isLength({ max: 20 }).withMessage('token wajib diisi, max 20 karakter.'),
], async (req, res, next) => {
  try {
    const errs = validationResult(req);
    if (!errs.isEmpty()) return badRequest(res, 'Validasi gagal.', errs.array());

    const { examId, token } = req.body;
    const exam = await prisma.exam.findUnique({ where: { id: +examId } });
    if (!exam) return notFound(res, 'Ujian tidak ditemukan.');

    const examToken = await prisma.examToken.create({
      data: { examId: +examId, token: token.toUpperCase().trim() },
    });
    return ok(res, examToken, 'Token Ujian berhasil dibuat.');
  } catch (e) {
    if (e.code === 'P2002') return badRequest(res, 'Token Ujian sudah ada untuk ujian ini.');
    next(e);
  }
});

// GET /api/admin/exam-tokens?examId=1 — daftar token untuk satu ujian
router.get('/', async (req, res, next) => {
  try {
    const where = req.query.examId ? { examId: +req.query.examId } : {};
    const tokens = await prisma.examToken.findMany({
      where,
      include: { exam: { select: { title: true, subject: true } } },
      orderBy: { createdAt: 'desc' },
    });
    return ok(res, tokens);
  } catch (e) { next(e); }
});

module.exports = router;
