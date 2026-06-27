const bcrypt = require('bcryptjs');
const prisma = require('../config/database');
const { sign } = require('../utils/jwt');
const { ok, badRequest, unauthorized } = require('../utils/response');
const { body, validationResult } = require('express-validator');

const loginRules = [
  body('nisn').trim().notEmpty().withMessage('NISN wajib diisi.'),
  body('password').notEmpty().withMessage('Password wajib diisi.'),
  body('sessionToken').trim().notEmpty().withMessage('Token Sesi wajib diisi.'),
];

async function login(req, res, next) {
  try {
    const errs = validationResult(req);
    if (!errs.isEmpty()) return badRequest(res, 'Validasi gagal.', errs.array());

    const { nisn, password, sessionToken } = req.body;

    // Validasi Token Sesi (PRD Bagian 46)
    const now = new Date();
    const session = await prisma.session.findUnique({
      where: { token: sessionToken.toUpperCase().trim() },
      include: { room: true },
    });

    if (
      !session ||
      !session.active ||
      (session.validFrom && session.validFrom > now) ||
      (session.validUntil && session.validUntil < now)
    ) {
      return unauthorized(res, 'Token Sesi tidak valid atau sudah kedaluwarsa.');
    }

    const user = await prisma.user.findUnique({ where: { nisn } });

    if (!user || !(await bcrypt.compare(password, user.password))) {
      return unauthorized(res, 'NISN atau password salah.');
    }

    // Set student's room dynamically based on the session they log in with
    const updatedUser = await prisma.user.update({
      where: { id: user.id },
      data: {
        roomId: session.roomId,
        room: session.room.name,
      },
    });

    const accessToken = sign({ id: updatedUser.id, role: updatedUser.role });
    return ok(res, {
      accessToken,
      student: formatStudent(updatedUser),
    }, 'Login berhasil.');
  } catch (e) { next(e); }
}

async function me(req, res) {
  return ok(res, formatUser(req.user));
}

async function verifyToken(req, res, next) {
  try {
    const errs = validationResult(req);
    if (!errs.isEmpty()) return badRequest(res, 'Validasi gagal.', errs.array());

    const { token } = req.body;
    const exam = await prisma.exam.findFirst({
      where: { token: token.toUpperCase().trim(), status: 'active' },
      select: { id: true, title: true, subject: true, durationMinutes: true },
    });

    if (!exam) {
      return badRequest(res, 'Token ujian tidak valid atau ujian belum aktif.');
    }

    return ok(res, { valid: true, exam });
  } catch (e) { next(e); }
}

// Format respons login mobile (API Contract Bagian 2)
function formatStudent(user) {
  return {
    id: `stu_${user.id}`,
    name: user.name,
    nisn: user.nisn,
    classLabel: user.class,
    deviceId: user.device,
  };
}

// Format respons /me — field asli untuk semua role (dashboard web)
function formatUser(user) {
  return {
    id: user.id,
    name: user.name,
    nisn: user.nisn,
    class: user.class,
    device: user.device,
    room: user.room,
    role: user.role,
    verified: user.verified,
  };
}

const tokenRules = [body('token').trim().notEmpty().withMessage('Token ujian wajib diisi.')];

module.exports = { login, me, verifyToken, loginRules, tokenRules };
