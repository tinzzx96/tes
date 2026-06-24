const router = require('express').Router();
const prisma = require('../../config/database');
const { ok, badRequest } = require('../../utils/response');
const { body, validationResult } = require('express-validator');

// POST /api/admin/sessions — buat Token Sesi baru
router.post('/', [
  body('token').trim().notEmpty().isLength({ max: 20 }).withMessage('token wajib diisi, max 20 karakter.'),
  body('description').optional().isString().isLength({ max: 255 }),
  body('validFrom').optional().isISO8601(),
  body('validUntil').optional().isISO8601(),
], async (req, res, next) => {
  try {
    const errs = validationResult(req);
    if (!errs.isEmpty()) return badRequest(res, 'Validasi gagal.', errs.array());

    const { token, description, validFrom, validUntil } = req.body;
    const session = await prisma.session.create({
      data: {
        token: token.toUpperCase().trim(),
        description,
        validFrom: validFrom ? new Date(validFrom) : null,
        validUntil: validUntil ? new Date(validUntil) : null,
      },
    });
    return ok(res, session, 'Token Sesi berhasil dibuat.');
  } catch (e) {
    if (e.code === 'P2002') return badRequest(res, 'Token Sesi sudah ada.');
    next(e);
  }
});

// GET /api/admin/sessions — daftar semua Token Sesi
router.get('/', async (req, res, next) => {
  try {
    const sessions = await prisma.session.findMany({ orderBy: { createdAt: 'desc' } });
    return ok(res, sessions);
  } catch (e) { next(e); }
});

// PATCH /api/admin/sessions/:id — aktifkan/nonaktifkan Token Sesi
router.patch('/:id', async (req, res, next) => {
  try {
    const session = await prisma.session.update({
      where: { id: +req.params.id },
      data: { active: req.body.active ?? true },
    });
    return ok(res, session);
  } catch (e) { next(e); }
});

module.exports = router;
