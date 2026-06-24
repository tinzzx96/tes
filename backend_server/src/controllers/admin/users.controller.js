const bcrypt = require('bcryptjs');
const prisma = require('../../config/database');
const { ok, created, notFound, badRequest } = require('../../utils/response');
const { body, validationResult } = require('express-validator');

async function listUsers(req, res, next) {
  try {
    const { role, room, class: kelas } = req.query;
    const where = {};
    if (role) where.role = role;
    if (room) where.room = room;
    if (kelas) where.class = kelas;

    const users = await prisma.user.findMany({
      where,
      select: { id: true, name: true, nisn: true, class: true, device: true, room: true, role: true, verified: true, createdAt: true },
      orderBy: { name: 'asc' },
    });
    return ok(res, users);
  } catch (e) { next(e); }
}

async function getUser(req, res, next) {
  try {
    const user = await prisma.user.findUnique({
      where: { id: +req.params.id },
      select: { id: true, name: true, nisn: true, class: true, device: true, room: true, role: true, verified: true, createdAt: true },
    });
    if (!user) return notFound(res);
    return ok(res, user);
  } catch (e) { next(e); }
}

async function createUser(req, res, next) {
  try {
    const errs = validationResult(req);
    if (!errs.isEmpty()) return badRequest(res, 'Validasi gagal.', errs.array());

    const { name, nisn, password, class: kelas, room, role, verified } = req.body;
    const hashed = await bcrypt.hash(password, 12);

    const user = await prisma.user.create({
      data: { name, nisn, password: hashed, class: kelas, room, role: role ?? 'student', verified: verified ?? false },
      select: { id: true, name: true, nisn: true, class: true, room: true, role: true, verified: true },
    });
    return created(res, user, 'Pengguna berhasil dibuat.');
  } catch (e) { next(e); }
}

async function updateUser(req, res, next) {
  try {
    const errs = validationResult(req);
    if (!errs.isEmpty()) return badRequest(res, 'Validasi gagal.', errs.array());

    const { name, class: kelas, room, role, verified, password } = req.body;
    const data = {};
    if (name !== undefined) data.name = name;
    if (kelas !== undefined) data.class = kelas;
    if (room !== undefined) data.room = room;
    if (role !== undefined) data.role = role;
    if (verified !== undefined) data.verified = verified;
    if (password) data.password = await bcrypt.hash(password, 12);

    const user = await prisma.user.update({
      where: { id: +req.params.id },
      data,
      select: { id: true, name: true, nisn: true, class: true, room: true, role: true, verified: true },
    });
    return ok(res, user, 'Pengguna diperbarui.');
  } catch (e) { next(e); }
}

async function deleteUser(req, res, next) {
  try {
    await prisma.user.delete({ where: { id: +req.params.id } });
    return ok(res, null, 'Pengguna dihapus.');
  } catch (e) { next(e); }
}

async function bulkImportStudents(req, res, next) {
  try {
    const errs = validationResult(req);
    if (!errs.isEmpty()) return badRequest(res, 'Validasi gagal.', errs.array());

    const { students } = req.body;
    const defaultPassword = await bcrypt.hash('siswa123', 12);
    let created = 0, skipped = 0;

    for (const s of students) {
      const exists = await prisma.user.findUnique({ where: { nisn: s.nisn } });
      if (exists) { skipped++; continue; }
      await prisma.user.create({
        data: {
          name: s.name, nisn: s.nisn,
          password: s.password ? await bcrypt.hash(s.password, 12) : defaultPassword,
          class: s.class, room: s.room, role: 'student', verified: true,
        },
      });
      created++;
    }

    return ok(res, { created, skipped }, `Import selesai: ${created} dibuat, ${skipped} dilewati.`);
  } catch (e) { next(e); }
}

const createRules = [
  body('name').trim().notEmpty().withMessage('Nama wajib diisi.'),
  body('nisn').trim().notEmpty().withMessage('NISN wajib diisi.').isLength({ max: 20 }),
  body('password').isLength({ min: 6 }).withMessage('Password min 6 karakter.'),
  body('role').optional().isIn(['student', 'teacher', 'admin', 'proctor']),
];

const updateRules = [
  body('name').optional().trim().notEmpty(),
  body('role').optional().isIn(['student', 'teacher', 'admin', 'proctor']),
  body('password').optional().isLength({ min: 6 }),
  body('verified').optional().isBoolean(),
];

const importRules = [
  body('students').isArray({ min: 1 }).withMessage('students harus array.'),
  body('students.*.name').notEmpty(),
  body('students.*.nisn').notEmpty(),
];

module.exports = { listUsers, getUser, createUser, updateUser, deleteUser, bulkImportStudents, createRules, updateRules, importRules };
