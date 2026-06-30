const router = require('express').Router();
const prisma = require('../../config/database');
const { ok, badRequest, created, notFound } = require('../../utils/response');
const { body, validationResult } = require('express-validator');
const { logActivity, ACTIONS } = require('../../utils/activityLog');

// GET /api/admin/rooms — Daftar semua Ruangan
router.get('/', async (req, res, next) => {
  try {
    const rooms = await prisma.room.findMany({
      orderBy: { name: 'asc' },
    });
    return ok(res, rooms);
  } catch (e) {
    next(e);
  }
});

// POST /api/admin/rooms — Buat Ruangan baru
router.post('/', [
  body('name').trim().notEmpty().withMessage('Nama ruangan wajib diisi.'),
  body('maxCapacity').isInt({ min: 1 }).withMessage('Kapasitas maksimal wajib berupa angka positif.'),
], async (req, res, next) => {
  try {
    const errs = validationResult(req);
    if (!errs.isEmpty()) return badRequest(res, 'Validasi gagal.', errs.array());

    const { name, maxCapacity } = req.body;
    const room = await prisma.room.create({
      data: {
        name: name.trim(),
        maxCapacity: parseInt(maxCapacity, 10),
      },
    });

    await logActivity({
      user: req.user,
      action: ACTIONS.CREATE_ROOM,
      targetType: 'room',
      targetId: room.id,
      targetLabel: room.name
    });

    return created(res, room, 'Ruangan berhasil dibuat.');
  } catch (e) {
    if (e.code === 'P2002') return badRequest(res, 'Nama ruangan sudah digunakan.');
    next(e);
  }
});

// PUT /api/admin/rooms/:id — Perbarui Ruangan
router.put('/:id', [
  body('name').optional().trim().notEmpty().withMessage('Nama ruangan tidak boleh kosong.'),
  body('maxCapacity').optional().isInt({ min: 1 }).withMessage('Kapasitas maksimal wajib berupa angka positif.'),
], async (req, res, next) => {
  try {
    const errs = validationResult(req);
    if (!errs.isEmpty()) return badRequest(res, 'Validasi gagal.', errs.array());

    const roomId = parseInt(req.params.id, 10);
    const exists = await prisma.room.findUnique({ where: { id: roomId } });
    if (!exists) return notFound(res, 'Ruangan tidak ditemukan.');

    const { name, maxCapacity } = req.body;
    const data = {};
    if (name !== undefined) data.name = name.trim();
    if (maxCapacity !== undefined) data.maxCapacity = parseInt(maxCapacity, 10);

    const updated = await prisma.room.update({
      where: { id: roomId },
      data,
    });

    await logActivity({
      user: req.user,
      action: ACTIONS.UPDATE_ROOM,
      targetType: 'room',
      targetId: updated.id,
      targetLabel: updated.name
    });

    return ok(res, updated, 'Ruangan diperbarui.');
  } catch (e) {
    if (e.code === 'P2002') return badRequest(res, 'Nama ruangan sudah digunakan.');
    next(e);
  }
});

// DELETE /api/admin/rooms/:id — Hapus Ruangan
router.delete('/:id', async (req, res, next) => {
  try {
    const roomId = parseInt(req.params.id, 10);
    const exists = await prisma.room.findUnique({ where: { id: roomId } });
    if (!exists) return notFound(res, 'Ruangan tidak ditemukan.');

    await prisma.room.delete({ where: { id: roomId } });

    await logActivity({
      user: req.user,
      action: ACTIONS.DELETE_ROOM,
      targetType: 'room',
      targetId: roomId,
      targetLabel: exists.name
    });

    return ok(res, null, 'Ruangan berhasil dihapus.');
  } catch (e) {
    next(e);
  }
});

module.exports = router;
