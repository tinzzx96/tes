// backend_server/src/controllers/admin/classes.controller.js
const prisma = require('../../config/database');
const { ok, created, notFound, badRequest } = require('../../utils/response');
const { body, validationResult } = require('express-validator');

// ── Auto-seed grades jika belum ada ──────────────────────────────────────────
const GRADE_SEEDS = [
  { name: 'X',   label: 'Kelas X' },
  { name: 'XI',  label: 'Kelas XI' },
  { name: 'XII', label: 'Kelas XII' },
];

async function ensureGrades() {
  const count = await prisma.grade.count();
  if (count === 0) {
    await prisma.grade.createMany({ data: GRADE_SEEDS, skipDuplicates: true });
  }
}

// ── Grades ────────────────────────────────────────────────────────────────────

async function listGrades(req, res, next) {
  try {
    await ensureGrades();
    const grades = await prisma.grade.findMany({
      include: { classes: { orderBy: { name: 'asc' } } },
      orderBy: { name: 'asc' },
    });
    return ok(res, grades);
  } catch (e) { next(e); }
}

// ── Classes ───────────────────────────────────────────────────────────────────

async function listClasses(req, res, next) {
  try {
    const classes = await prisma.class.findMany({
      include: {
        grade: { select: { id: true, name: true, label: true } },
        _count: { select: { users: true } },
      },
      orderBy: [{ grade: { name: 'asc' } }, { name: 'asc' }],
    });
    return ok(res, classes.map(c => ({
      id: c.id,
      name: c.name,
      major: c.major,
      gradeId: c.gradeId,
      grade: c.grade,
      studentCount: c._count.users,
    })));
  } catch (e) { next(e); }
}

async function createClass(req, res, next) {
  try {
    const errs = validationResult(req);
    if (!errs.isEmpty()) return badRequest(res, 'Validasi gagal.', errs.array());

    const { name, grade_id, major } = req.body;
    const cls = await prisma.class.create({
      data: { name, gradeId: +grade_id, major: major ?? null },
      include: { grade: true },
    });
    return created(res, cls, 'Kelas berhasil dibuat.');
  } catch (e) {
    if (e.code === 'P2002') return badRequest(res, 'Nama kelas sudah digunakan.');
    next(e);
  }
}

async function updateClass(req, res, next) {
  try {
    const errs = validationResult(req);
    if (!errs.isEmpty()) return badRequest(res, 'Validasi gagal.', errs.array());

    const { name, grade_id, major } = req.body;
    const data = {};
    if (name     !== undefined) data.name    = name;
    if (grade_id !== undefined) data.gradeId = +grade_id;
    if (major    !== undefined) data.major   = major;

    const cls = await prisma.class.update({
      where: { id: +req.params.id },
      data,
      include: { grade: true },
    });
    return ok(res, cls, 'Kelas diperbarui.');
  } catch (e) {
    if (e.code === 'P2025') return notFound(res);
    next(e);
  }
}

async function deleteClass(req, res, next) {
  try {
    await prisma.class.delete({ where: { id: +req.params.id } });
    return ok(res, null, 'Kelas dihapus.');
  } catch (e) {
    if (e.code === 'P2025') return notFound(res);
    next(e);
  }
}

// ── Validation rules ──────────────────────────────────────────────────────────
const createClassRules = [
  body('name').trim().notEmpty().withMessage('Nama kelas wajib diisi.'),
  body('grade_id').isInt({ min: 1 }).withMessage('grade_id harus integer valid.'),
  body('major').optional().trim().notEmpty(),
];

const updateClassRules = [
  body('name').optional().trim().notEmpty(),
  body('grade_id').optional().isInt({ min: 1 }),
];

module.exports = {
  listGrades,
  listClasses, createClass, updateClass, deleteClass,
  createClassRules, updateClassRules,
};