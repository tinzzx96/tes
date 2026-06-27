const router = require('express').Router();
const prisma = require('../../config/database');
const { ok, badRequest } = require('../../utils/response');
const { body, validationResult } = require('express-validator');
const crypto = require('crypto');
const logger = require('../../utils/logger');

// POST /api/admin/sessions — buat Token Sesi baru
router.post('/', [
  body('roomId').isInt().withMessage('roomId wajib diisi dan berupa integer.'),
  body('proctorId').optional({ nullable: true }).isInt().withMessage('proctorId harus berupa integer.'),
  body('description').optional().isString().isLength({ max: 255 }),
], async (req, res, next) => {
  try {
    const errs = validationResult(req);
    if (!errs.isEmpty()) return badRequest(res, 'Validasi gagal.', errs.array());

    const { roomId, proctorId, description } = req.body;

    const room = await prisma.room.findUnique({
      where: { id: Number(roomId) }
    });
    if (!room) return badRequest(res, 'Ruangan tidak ditemukan.');

    let proctor = null;
    if (proctorId) {
      proctor = await prisma.user.findUnique({
        where: { id: Number(proctorId) }
      });
      if (!proctor || proctor.role !== 'proctor') {
        return badRequest(res, 'Proktor tidak valid atau tidak ditemukan.');
      }
    }

    // Generate unique 6-character token
    let token = '';
    let isUnique = false;
    while (!isUnique) {
      token = crypto.randomBytes(3).toString('hex').toUpperCase();
      const existing = await prisma.session.findUnique({ where: { token } });
      if (!existing) isUnique = true;
    }

    const today = new Date();
    const validFrom = new Date(today.setHours(0, 0, 0, 0));
    const validUntil = new Date(today.setHours(23, 59, 59, 999));

    // Update proctor's room assignment
    if (proctor) {
      await prisma.user.update({
        where: { id: proctor.id },
        data: {
          roomId: room.id,
          room: room.name,
        }
      });
    }

    const session = await prisma.session.create({
      data: {
        token,
        roomId: room.id,
        proctorId: proctor ? proctor.id : null,
        description: description || `Sesi ${room.name} hari ini`,
        validFrom,
        validUntil,
        active: true,
      },
      include: {
        room: true,
        proctor: { select: { id: true, name: true, nisn: true } },
      }
    });

    // Audit Log
    logger.info(`[AUDIT] Session Token generated: ${token} for Room: ${room.name} (ID: ${room.id}) by User (ID: ${req.user.id}, Role: ${req.user.role})`);

    return ok(res, session, 'Token Sesi berhasil dibuat.');
  } catch (e) {
    next(e);
  }
});

// GET /api/admin/sessions — daftar semua Token Sesi
router.get('/', async (req, res, next) => {
  try {
    const sessions = await prisma.session.findMany({
      include: {
        room: true,
        proctor: { select: { id: true, name: true, nisn: true } },
      },
      orderBy: { createdAt: 'desc' }
    });
    return ok(res, sessions);
  } catch (e) { next(e); }
});

// PATCH /api/admin/sessions/:id — aktifkan/nonaktifkan Token Sesi
router.patch('/:id', async (req, res, next) => {
  try {
    const session = await prisma.session.update({
      where: { id: +req.params.id },
      data: { active: req.body.active ?? true },
      include: {
        room: true,
        proctor: { select: { id: true, name: true, nisn: true } },
      }
    });
    
    // Audit Log
    logger.info(`[AUDIT] Session ID: ${session.id} (Token: ${session.token}) updated active status to ${session.active} by User (ID: ${req.user.id}, Role: ${req.user.role})`);

    return ok(res, session);
  } catch (e) { next(e); }
});

module.exports = router;
