// src/controllers/admin/questionBanks.controller.js
// ════════════════════════════════════════════════════════════════════════════
// GANTI FILE INI — perubahan utama:
//   listBanks: guru hanya lihat bank soal MILIKNYA, admin lihat semua
// ════════════════════════════════════════════════════════════════════════════

const prisma = require('../../config/database');
const { ok, created, notFound, badRequest, forbidden } = require('../../utils/response');
const { body, validationResult } = require('express-validator');

// ── List bank soal ────────────────────────────────────────────────────────────
// Admin → semua bank soal
// Teacher → hanya bank soal milik sendiri (createdBy = req.user.id)

async function listBanks(req, res, next) {
  try {
    const where = req.user.role === 'teacher'
      ? { createdBy: req.user.id }
      : {}; // admin: semua

    const banks = await prisma.questionBank.findMany({
      where,
      include: {
        creator: { select: { id: true, name: true } },
        _count:  { select: { questions: true, exams: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    return ok(res, banks.map(b => ({
      id:            b.id,
      name:          b.name,
      subject:       b.subject,
      creator:       b.creator?.name,
      createdBy:     b.createdBy,
      questionCount: b._count.questions,
      examCount:     b._count.exams,
      createdAt:     b.createdAt,
    })));
  } catch (e) { next(e); }
}

// ── Get satu bank + soal ──────────────────────────────────────────────────────
async function getBank(req, res, next) {
  try {
    const bank = await prisma.questionBank.findUnique({
      where: { id: +req.params.id },
      include: {
        creator:   { select: { id: true, name: true } },
        questions: {
          include: { options: { orderBy: { orderNum: 'asc' } } },
          orderBy: { orderNum: 'asc' },
        },
      },
    });
    if (!bank) return notFound(res);

    // Guru hanya bisa lihat bank soal miliknya
    if (req.user.role === 'teacher' && bank.createdBy !== req.user.id) {
      return forbidden(res, 'Kamu tidak punya akses ke bank soal ini.');
    }

    return ok(res, bank);
  } catch (e) { next(e); }
}

// ── Buat bank soal ────────────────────────────────────────────────────────────
async function createBank(req, res, next) {
  try {
    const errs = validationResult(req);
    if (!errs.isEmpty()) return badRequest(res, 'Validasi gagal.', errs.array());

    const { name, subject } = req.body;
    const bank = await prisma.questionBank.create({
      data: { name, subject, createdBy: req.user.id },
    });
    
    // Auto-refresh admin panel via WebSocket
    const { getIo } = require('../../socket');
    getIo()?.to('room:admin').emit('admin-refresh', { tab: 'mapel' });

    return created(res, bank, 'Bank soal berhasil dibuat.');
  } catch (e) { next(e); }
}

// ── Update bank soal ──────────────────────────────────────────────────────────
async function updateBank(req, res, next) {
  try {
    const bank = await prisma.questionBank.findUnique({ where: { id: +req.params.id } });
    if (!bank) return notFound(res);

    // Guru hanya bisa edit bank soal miliknya
    if (req.user.role === 'teacher' && bank.createdBy !== req.user.id) {
      return forbidden(res, 'Kamu tidak punya akses ke bank soal ini.');
    }

    const { name, subject } = req.body;
    const data = {};
    if (name !== undefined)    data.name    = name;
    if (subject !== undefined) data.subject = subject;

    const updated = await prisma.questionBank.update({ where: { id: +req.params.id }, data });

    const { getIo } = require('../../socket');
    getIo()?.to('room:admin').emit('admin-refresh', { tab: 'mapel' });

    return ok(res, updated, 'Bank soal diperbarui.');
  } catch (e) { next(e); }
}

// ── Hapus bank soal ───────────────────────────────────────────────────────────
async function deleteBank(req, res, next) {
  try {
    const bank = await prisma.questionBank.findUnique({ where: { id: +req.params.id } });
    if (!bank) return notFound(res);

    // Guru hanya bisa hapus bank soal miliknya
    if (req.user.role === 'teacher' && bank.createdBy !== req.user.id) {
      return forbidden(res, 'Kamu tidak punya akses ke bank soal ini.');
    }

    await prisma.questionBank.delete({ where: { id: +req.params.id } });

    const { getIo } = require('../../socket');
    getIo()?.to('room:admin').emit('admin-refresh', { tab: 'mapel' });

    return ok(res, null, 'Bank soal dihapus.');
  } catch (e) { next(e); }
}

const createRules = [
  body('name').trim().notEmpty().withMessage('Nama bank soal wajib diisi.'),
  body('subject').trim().notEmpty().withMessage('Mata pelajaran wajib diisi.'),
];

module.exports = { listBanks, getBank, createBank, updateBank, deleteBank, createRules };
