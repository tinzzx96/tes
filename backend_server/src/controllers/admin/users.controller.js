const bcrypt = require('bcryptjs');
const prisma = require('../../config/database');
const { ok, created, notFound, badRequest } = require('../../utils/response');
const { body, validationResult } = require('express-validator');
const { logActivity, ACTIONS } = require('../../utils/activityLog');

async function listUsers(req, res, next) {
  try {
    const { role, room, class: kelas } = req.query;
    const where = {};
    if (role) where.role = role;
    if (room) where.room = room;
    if (kelas) where.class = kelas;

    const users = await prisma.user.findMany({
      where,
      select: { id: true, name: true, nisn: true, class: true, classId: true, device: true, room: true, role: true, verified: true, academicYear: true, createdAt: true },
      orderBy: { name: 'asc' },
    });
    return ok(res, users);
  } catch (e) { next(e); }
}

async function getUser(req, res, next) {
  try {
    const user = await prisma.user.findUnique({
      where: { id: +req.params.id },
      select: { id: true, name: true, nisn: true, class: true, classId: true, device: true, room: true, role: true, verified: true, academicYear: true, createdAt: true },
    });
    if (!user) return notFound(res);
    return ok(res, user);
  } catch (e) { next(e); }
}

async function createUser(req, res, next) {
  try {
    const errs = validationResult(req);
    if (!errs.isEmpty()) return badRequest(res, 'Validasi gagal.', errs.array());

    const { name, nisn, password, class: kelas, class_id, roomId, role, verified, academicYear } = req.body;
    const hashed = await bcrypt.hash(password, 12);

    let roomName = null;
    if (roomId) {
      const rm = await prisma.room.findUnique({ where: { id: Number(roomId) } });
      if (rm) roomName = rm.name;
    }

    const user = await prisma.user.create({
      data: {
        name, nisn, password: hashed,
        class: kelas, classId: class_id || null,
        roomId: roomId ? Number(roomId) : null, room: roomName,
        role: role ?? 'student', verified: verified ?? false,
        academicYear: academicYear || null
      },
      select: { id: true, name: true, nisn: true, class: true, classId: true, room: true, roomId: true, role: true, verified: true, academicYear: true },
    });

    await logActivity({
      user: req.user,
      action: ACTIONS.CREATE_USER,
      targetType: 'user',
      targetId: user.id,
      targetLabel: `${user.name} (${user.role})`
    });

    return created(res, user, 'Pengguna berhasil dibuat.');
  } catch (e) { next(e); }
}

async function updateUser(req, res, next) {
  try {
    const errs = validationResult(req);
    if (!errs.isEmpty()) return badRequest(res, 'Validasi gagal.', errs.array());

    const { name, class: kelas, class_id, roomId, role, verified, password, device, academicYear } = req.body;
    const data = {};
    if (name !== undefined) data.name = name;
    if (kelas !== undefined) data.class = kelas;
    if (class_id !== undefined) data.classId = class_id || null;
    if (academicYear !== undefined) data.academicYear = academicYear || null;
    if (roomId !== undefined) {
      data.roomId = roomId ? Number(roomId) : null;
      if (roomId) {
        const rm = await prisma.room.findUnique({ where: { id: Number(roomId) } });
        data.room = rm ? rm.name : null;
      } else {
        data.room = null;
      }
    }
    if (role !== undefined) data.role = role;
    if (verified !== undefined) data.verified = verified;
    if (device !== undefined) data.device = device;
    if (password) data.password = await bcrypt.hash(password, 12);

    if (verified === true) {
      data.device = null;
    }

    const user = await prisma.user.update({
      where: { id: +req.params.id },
      data,
      select: { id: true, name: true, nisn: true, class: true, classId: true, room: true, roomId: true, role: true, verified: true, academicYear: true },
    });

    if (verified === true) {
      await prisma.examAttempt.updateMany({
        where: { userId: user.id, status: 'started' },
        data: { unlockPin: null, counterPelanggaran: 0 },
      });

      const { getIo, emitStudentStatusChanged } = require('../../socket');
      const io = getIo();
      if (io) {
        if (user.room) {
          io.to(`room:${user.room}`).emit('student-reset', { studentId: `stu_${user.id}` });
          emitStudentStatusChanged(user.room, {
            studentId: `stu_${user.id}`,
            status: 'online',
            isBlocked: false,
            counterPelanggaran: 0,
            roomId: user.roomId,
          });
        }
      }
    }

    const { getIo } = require('../../socket');
    const io = getIo();
    if (io) {
      io.to('room:admin').emit('admin-refresh', { tab: role === 'teacher' ? 'guru' : 'siswa' });
    }

    await logActivity({
      user: req.user,
      action: ACTIONS.UPDATE_USER,
      targetType: 'user',
      targetId: user.id,
      targetLabel: `${user.name} (${user.role})`
    });

    return ok(res, user, 'Pengguna diperbarui.');
  } catch (e) { next(e); }
}

async function deleteUser(req, res, next) {
  try {
    const user = await prisma.user.findUnique({ where: { id: +req.params.id } });
    if (user) {
      await prisma.user.delete({ where: { id: +req.params.id } });
      await logActivity({
        user: req.user,
        action: ACTIONS.DELETE_USER,
        targetType: 'user',
        targetId: user.id,
        targetLabel: `${user.name} (${user.role})`
      });
    }
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
          academicYear: s.academicYear || s.year || null,
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
