const router = require('express').Router();
const prisma = require('../../config/database');
const { ok, badRequest } = require('../../utils/response');
const { body, validationResult } = require('express-validator');
const crypto = require('crypto');
const logger = require('../../utils/logger');
const { logActivity, ACTIONS } = require('../../utils/activityLog');

// POST /api/admin/sessions — buat Token Sesi baru
router.post('/', [
  body('roomId').isInt().withMessage('roomId wajib diisi dan berupa integer.'),
  body('proctorId').optional({ nullable: true }).isInt().withMessage('proctorId harus berupa integer.'),
  body('description').optional().isString().isLength({ max: 255 }),
  body('validFrom').optional({ nullable: true }).isISO8601().withMessage('validFrom harus berupa format tanggal ISO8601.'),
  body('validUntil').optional({ nullable: true }).isISO8601().withMessage('validUntil harus berupa format tanggal ISO8601.'),
], async (req, res, next) => {
  try {
    const errs = validationResult(req);
    if (!errs.isEmpty()) return badRequest(res, 'Validasi gagal.', errs.array());

    const { roomId, proctorId, description, validFrom, validUntil } = req.body;

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
    let parsedValidFrom = new Date(today.setHours(0, 0, 0, 0));
    if (validFrom) {
      const d = new Date(validFrom);
      if (!isNaN(d.getTime())) parsedValidFrom = d;
    }

    let parsedValidUntil = new Date(today.setHours(23, 59, 59, 999));
    if (validUntil) {
      const d = new Date(validUntil);
      if (!isNaN(d.getTime())) parsedValidUntil = d;
    }

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
        validFrom: parsedValidFrom,
        validUntil: parsedValidUntil,
        active: true,
      },
      include: {
        room: true,
        proctor: { select: { id: true, name: true, nisn: true } },
      }
    });

    // Audit Log
    logger.info(`[AUDIT] Session Token generated: ${token} for Room: ${room.name} (ID: ${room.id}) by User (ID: ${req.user.id}, Role: ${req.user.role})`);

    await logActivity({
      user: req.user,
      action: ACTIONS.CREATE_SESSION,
      targetType: 'session',
      targetId: session.id,
      targetLabel: `${session.token} (${room.name})`
    });

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

// PATCH /api/admin/sessions/:id — update Token Sesi (termasuk status aktif/nonaktif, validFrom, validUntil)
router.patch('/:id', async (req, res, next) => {
  try {
    const { active, roomId, proctorId, description, validFrom, validUntil } = req.body;
    
    const updateData = {};
    if (active !== undefined) updateData.active = !!active;
    if (description !== undefined) updateData.description = description;
    
    if (roomId !== undefined) {
      const room = await prisma.room.findUnique({ where: { id: Number(roomId) } });
      if (!room) return badRequest(res, 'Ruangan tidak ditemukan.');
      updateData.roomId = room.id;
    }
    
    if (proctorId !== undefined) {
      if (proctorId === null) {
        updateData.proctorId = null;
      } else {
        const proctor = await prisma.user.findUnique({ where: { id: Number(proctorId) } });
        if (!proctor || proctor.role !== 'proctor') {
          return badRequest(res, 'Proktor tidak valid atau tidak ditemukan.');
        }
        updateData.proctorId = proctor.id;
      }
    }
    
    if (validFrom !== undefined) {
      if (validFrom === null) {
        updateData.validFrom = null;
      } else {
        const d = new Date(validFrom);
        if (!isNaN(d.getTime())) updateData.validFrom = d;
      }
    }
    if (validUntil !== undefined) {
      if (validUntil === null) {
        updateData.validUntil = null;
      } else {
        const d = new Date(validUntil);
        if (!isNaN(d.getTime())) updateData.validUntil = d;
      }
    }

    const session = await prisma.session.update({
      where: { id: +req.params.id },
      data: updateData,
      include: {
        room: true,
        proctor: { select: { id: true, name: true, nisn: true } },
      }
    });
    
    // Audit Log
    logger.info(`[AUDIT] Session ID: ${session.id} (Token: ${session.token}) updated by User (ID: ${req.user.id}, Role: ${req.user.role})`);

    await logActivity({
      user: req.user,
      action: ACTIONS.TOGGLE_SESSION,
      targetType: 'session',
      targetId: session.id,
      targetLabel: `${session.token} (${session.active ? 'Aktif' : 'Nonaktif'})`
    });

    return ok(res, session);
  } catch (e) { next(e); }
});

// DELETE /api/admin/sessions/:id — hapus Token Sesi
router.delete('/:id', async (req, res, next) => {
  try {
    const id = +req.params.id;
    const session = await prisma.session.findUnique({
      where: { id },
      include: { room: true }
    });
    if (!session) return badRequest(res, 'Token Sesi tidak ditemukan.');

    await prisma.session.delete({ where: { id } });

    // Audit Log
    logger.info(`[AUDIT] Session ID: ${session.id} (Token: ${session.token}) deleted by User (ID: ${req.user.id}, Role: ${req.user.role})`);

    await logActivity({
      user: req.user,
      action: ACTIONS.DELETE_SESSION,
      targetType: 'session',
      targetId: session.id,
      targetLabel: `${session.token} (${session.room?.name || 'Unknown Room'})`
    });

    return ok(res, null, 'Token Sesi berhasil dihapus.');
  } catch (e) { next(e); }
});

module.exports = router;
