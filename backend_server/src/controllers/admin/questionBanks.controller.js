// src/controllers/admin/questionBanks.controller.js
// ════════════════════════════════════════════════════════════════════════════
// Perubahan utama:
//   listBanks       : guru hanya lihat bank soal MILIKNYA, admin lihat semua
//   listBanksV2     : GET /admin/question-banks/v2 — endpoint baru dengan
//                     search, filter, pagination, sorting, dan summary stats
//   listBanksSummary: GET /admin/question-banks/summary — 3 kartu statistik
// ════════════════════════════════════════════════════════════════════════════

const prisma = require('../../config/database');
const { ok, created, notFound, badRequest, forbidden } = require('../../utils/response');
const { body, validationResult } = require('express-validator');
const { logActivity, ACTIONS } = require('../../utils/activityLog');

// ── List bank soal (legacy — tanpa pagination) ────────────────────────────────
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

// ── Summary Stats — 3 kartu di atas tabel ─────────────────────────────────────
// GET /admin/question-banks/summary
async function listBanksSummary(req, res, next) {
  try {
    const [totalBanks, totalQuestions, contributorsRaw] = await Promise.all([
      // Total bank soal
      prisma.questionBank.count(),

      // Total soal dari seluruh bank
      prisma.question.count(),

      // Guru kontributor unik (users dengan role teacher yang punya bank soal)
      prisma.questionBank.findMany({
        distinct: ['createdBy'],
        select: {
          createdBy: true,
          creator: { select: { role: true } },
        },
      }),
    ]);

    // Filter hanya yang role-nya teacher
    const guruKontributor = contributorsRaw.filter(
      b => b.creator?.role === 'teacher'
    ).length;

    // Ambil tahun ajaran dari DB jika ada, atau fallback ke default
    let academicYears = [];
    try {
      const rawYears = await prisma.$queryRawUnsafe(`SELECT name FROM academic_years`);
      academicYears = rawYears.map(y => y.name);
    } catch (err) {
      academicYears = ['2023/2024', '2024/2025', '2025/2026', '2026/2027'];
    }

    return ok(res, {
      totalBanks,
      totalQuestions,
      guruKontributor,
      academicYears,
    });
  } catch (e) { next(e); }
}

// ── List bank soal V2 — dengan search, filter, pagination, sorting ─────────────
// GET /admin/question-banks/v2?search=&subject=&grade=&year=&page=1&limit=10&sortBy=createdAt&sortDir=desc
async function listBanksV2(req, res, next) {
  try {
    const {
      search   = '',
      subject  = '',
      grade    = '',   // filter tingkat (X/XI/XII) — disimpan di nama bank soal / subject
      year     = '',   // filter tahun ajaran (dari nama bank soal)
      page     = '1',
      limit    = '10',
      sortBy   = 'createdAt',
      sortDir  = 'desc',
    } = req.query;

    const pageNum  = Math.max(parseInt(page)  || 1, 1);
    const limitNum = Math.min(Math.max(parseInt(limit) || 10, 1), 100);
    const skip     = (pageNum - 1) * limitNum;

    // Validasi sortBy — hanya kolom yang diizinkan
    const ALLOWED_SORT = ['name', 'subject', 'createdAt', 'questionCount'];
    const safeSortBy  = ALLOWED_SORT.includes(sortBy) ? sortBy : 'createdAt';
    const safeSortDir = sortDir === 'asc' ? 'asc' : 'desc';

    // === Build WHERE clause ===
    const whereConditions = [];

    // Role teacher hanya lihat miliknya
    if (req.user.role === 'teacher') {
      whereConditions.push({ createdBy: req.user.id });
    }

    // Search: nama bank soal ATAU nama guru
    if (search.trim()) {
      whereConditions.push({
        OR: [
          { name:    { contains: search.trim() } },
          { subject: { contains: search.trim() } },
          { creator: { name: { contains: search.trim() } } },
        ],
      });
    }

    // Filter mata pelajaran (subject)
    if (subject.trim()) {
      whereConditions.push({ subject: { contains: subject.trim() } });
    }

    // Filter tingkat (grade) — disimpan dalam nama bank soal atau subject
    // Contoh: bank soal "PTS Kelas X Matematika" → grade = "X"
    if (grade.trim()) {
      whereConditions.push({
        OR: [
          { name:    { contains: grade.trim() } },
          { subject: { contains: grade.trim() } },
        ],
      });
    }

    // Filter tahun ajaran — biasanya ada dalam nama bank soal (cth: "2025/2026")
    if (year.trim()) {
      whereConditions.push({
        name: { contains: year.trim() },
      });
    }

    const where = whereConditions.length > 0
      ? { AND: whereConditions }
      : {};

    // === Query dengan pagination ===
    // Untuk sorting by questionCount kita handle setelah fetch (Prisma tidak support order by count langsung)
    const needsCountSort = safeSortBy === 'questionCount';

    const orderBy = needsCountSort
      ? { createdAt: 'desc' }        // fallback order; sort di app-layer setelah fetch
      : { [safeSortBy]: safeSortDir };

    const [banks, total] = await Promise.all([
      prisma.questionBank.findMany({
        where,
        include: {
          creator: { select: { id: true, name: true, role: true } },
          _count:  { select: { questions: true, exams: true } },
        },
        orderBy,
        // Bila sort by questionCount: fetch semua filtered dulu, sort di JS
        // Untuk perf pada skala besar, kita batasi take/skip hanya jika tidak perlu sort by count
        take:  needsCountSort ? undefined : limitNum,
        skip:  needsCountSort ? undefined : skip,
      }),
      prisma.questionBank.count({ where }),
    ]);

    // Map ke response shape
    let mapped = banks.map(b => ({
      id:            b.id,
      name:          b.name,
      subject:       b.subject,
      creator:       b.creator?.name,
      creatorRole:   b.creator?.role,
      createdBy:     b.createdBy,
      questionCount: b._count.questions,
      examCount:     b._count.exams,
      createdAt:     b.createdAt,
    }));

    // App-layer sort untuk questionCount
    if (needsCountSort) {
      mapped.sort((a, b) =>
        safeSortDir === 'asc'
          ? a.questionCount - b.questionCount
          : b.questionCount - a.questionCount
      );
      // Manual pagination
      mapped = mapped.slice(skip, skip + limitNum);
    }

    return ok(res, {
      data:  mapped,
      total,
      page:  pageNum,
      limit: limitNum,
      totalPages: Math.ceil(total / limitNum),
    });
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

    await logActivity({
      user: req.user,
      action: ACTIONS.CREATE_BANK,
      targetType: 'questionBank',
      targetId: bank.id,
      targetLabel: bank.name
    });

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

    await logActivity({
      user: req.user,
      action: ACTIONS.UPDATE_BANK,
      targetType: 'questionBank',
      targetId: updated.id,
      targetLabel: updated.name
    });

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

    await logActivity({
      user: req.user,
      action: ACTIONS.DELETE_BANK,
      targetType: 'questionBank',
      targetId: bank.id,
      targetLabel: bank.name
    });

    return ok(res, null, 'Bank soal dihapus.');
  } catch (e) { next(e); }
}

// ── Hapus massal bank soal ───────────────────────────────────────────────────
async function deleteBanksBulk(req, res, next) {
  try {
    const { ids } = req.body;
    if (!Array.isArray(ids) || ids.length === 0) {
      return badRequest(res, 'Kirim array ids yang akan dihapus.');
    }

    // Admin hanya; teacher tidak bisa hapus massal
    if (req.user.role === 'teacher') {
      return forbidden(res, 'Guru tidak diizinkan melakukan hapus massal.');
    }

    const intIds = ids.map(Number).filter(Boolean);
    const { count } = await prisma.questionBank.deleteMany({
      where: { id: { in: intIds } },
    });

    const { getIo } = require('../../socket');
    getIo()?.to('room:admin').emit('admin-refresh', { tab: 'mapel' });

    await logActivity({
      user: req.user,
      action: ACTIONS.DELETE_BANK,
      targetType: 'questionBank',
      targetLabel: `${count} bank soal`,
      meta: { ids: intIds },
    });

    return ok(res, { count }, `${count} bank soal berhasil dihapus.`);
  } catch (e) { next(e); }
}

const createRules = [
  body('name').trim().notEmpty().withMessage('Nama bank soal wajib diisi.'),
  body('subject').trim().notEmpty().withMessage('Mata pelajaran wajib diisi.'),
];

module.exports = {
  listBanks,
  listBanksV2,
  listBanksSummary,
  getBank,
  createBank,
  updateBank,
  deleteBank,
  deleteBanksBulk,
  createRules,
};
