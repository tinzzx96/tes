const bcrypt = require('bcryptjs');
const prisma = require('../config/database');
const { sign } = require('../utils/jwt');
const { ok, badRequest, unauthorized } = require('../utils/response');
const { body, validationResult } = require('express-validator');
const { setLimit15MinActive, getLimit15MinActive } = require('../middleware/rateLimiter');
const { logActivity, ACTIONS } = require('../utils/activityLog');
const { DEVICE_LOCKED_MSG } = require('../middleware/deviceCheck');
const { compareAsync } = require('../utils/bcryptPool');

// Cache for bcrypt password comparisons to prevent event loop blocking under high concurrent load
const bcryptCache = new Map();

const loginRules = [
  body('nisn').trim().notEmpty().withMessage('NISN wajib diisi.'),
  body('password').notEmpty().withMessage('Password wajib diisi.'),
  body('sessionToken').trim().notEmpty().withMessage('Token Sesi wajib diisi.'),
  // device_id opsional — dikirim oleh Flutter native, tidak wajib untuk web admin
  body('device_id').optional().trim(),
  body('device_name').optional().trim(),
];

async function login(req, res, next) {
  try {
    const errs = validationResult(req);
    if (!errs.isEmpty()) return badRequest(res, 'Validasi gagal.', errs.array());

    console.log('[AuthDebug] Login req.body:', req.body);
    const { nisn, password, sessionToken, device_id, device_name } = req.body;
    const tokenUpper = sessionToken.toUpperCase().trim();
    const isAdminToken = (tokenUpper === 'ADMINTOKEN');
    // device_id dari Flutter native (null/undefined jika login dari web admin)
    const incomingDeviceId = device_id?.trim() || null;

    let session = null;
    if (isAdminToken) {
      // Mock session for admin with unlimited validity
      session = {
        token: 'ADMINTOKEN',
        active: true,
        roomId: null,
        room: null
      };
    } else {
      // Validasi Token Sesi dari DB (PRD Bagian 46)
      const now = new Date();
      session = await prisma.session.findUnique({
        where: { token: tokenUpper },
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
    }

    const user = await prisma.user.findUnique({ where: { nisn } });

    if (!user) {
      return unauthorized(res, 'NISN atau password salah.');
    }

    // Verify password with in-memory cache to prevent blocking Event Loop under load
    const cacheKey = `${password}:${user.password}`;
    let isMatch = false;
    if (bcryptCache.has(cacheKey)) {
      isMatch = bcryptCache.get(cacheKey);
    } else {
      isMatch = await compareAsync(password, user.password);
      if (bcryptCache.size < 10000) {
        bcryptCache.set(cacheKey, isMatch);
      }
    }

    if (!isMatch) {
      return unauthorized(res, 'NISN atau password salah.');
    }

    // Jika menggunakan token khusus admin, pastikan role-nya adalah admin
    if (isAdminToken && user.role !== 'admin') {
      return unauthorized(res, 'Token Sesi khusus Admin tidak valid untuk role Anda.');
    }

    // ── DEVICE LOCK VALIDATION (PRD Bagian 26) ───────────────────────────────
    // Hanya berlaku untuk siswa.
    // 1. Siswa hanya boleh login dari aplikasi mobile (wajib mengirimkan device_id).
    //    Jika login dari web/browser (device_id tidak ada), tolak akses siswa ke dashboard web.
    // 2. Jika siswa memiliki sesi ujian aktif yang sudah terkunci ke suatu perangkat,
    //    maka device_id yang dikirimkan wajib cocok.
if (user.role === 'student') {
      if (!incomingDeviceId) {
        return res.status(403).json({
          success: false,
          error: {
            code:    'DEVICE_NOT_ALLOWED',
            message: 'Akses Ditolak. Siswa hanya dapat login melalui aplikasi mobile resmi.',
          },
        });
      }

      // Cari exam_attempt aktif (bukan submitted) yang sudah terkunci ke perangkat tertentu
      const lockedAttempt = await prisma.examAttempt.findFirst({
        where: {
          userId:   user.id,
          status:   { not: 'submitted' },
          deviceId: { not: null },
        },
        select: { deviceId: true },
        orderBy: { createdAt: 'asc' },
      });

      if (lockedAttempt && lockedAttempt.deviceId !== incomingDeviceId) {
        return res.status(403).json({
          success: false,
          error: {
            code:    'DEVICE_LOCKED',
            message: DEVICE_LOCKED_MSG,
          },
        });
      }

      // ── FIX: First-Login-Device-Lock ──────────────────────────────────────
      // Bug sebelumnya: user.device (field "nama perangkat" di profil siswa,
      // ditampilkan di Device Status Card) ditimpa begitu saja setiap login
      // selama ada incomingDeviceId, TANPA membandingkan dengan device yang
      // sudah pernah tercatat. Ini membuat device manapun — termasuk request
      // yang dipalsukan dari web/Postman menyamar sebagai mobile — bisa
      // "menabrak" dan menimpa device asli siswa yang sudah lebih dulu login,
      // SELAMA belum ada exam_attempt yang benar-benar mengunci deviceId
      // (mis. sesaat setelah reset device oleh proktor, sebelum siswa mulai
      // ujian). Sekarang user.device sendiri diperlakukan sebagai lock:
      // begitu terisi pertama kali (login pertama setelah akun dibuat atau
      // setelah direset proktor), device_id tersebut MENGUNCI siapa yang
      // boleh login berikutnya, sampai direset lagi oleh proktor/admin.
      if (user.device && user.device !== (device_name?.trim() || incomingDeviceId)) {
        // Profil sudah punya device terverifikasi, tapi device_name yang
        // datang sekarang berbeda. Ini TIDAK otomatis berarti device_id-nya
        // juga berbeda (nama bisa sama walau device_id beda dalam kasus
        // langka), jadi bandingkan berdasarkan device_id asli yang tersimpan
        // jika ada (lebih akurat daripada cuma device_name).
      }
      // Bandingkan berdasarkan storedDeviceId yang sebenarnya (lebih akurat
      // daripada device_name yang hanya label tampilan).
      if (user.deviceId && user.deviceId !== incomingDeviceId) {
        return res.status(403).json({
          success: false,
          error: {
            code:    'DEVICE_MISMATCH',
            message: 'Akses Ditolak. Akun ini sudah terverifikasi pada perangkat lain. Hubungi pengawas untuk mereset kunci perangkat jika Anda berganti HP.',
          },
        });
      }}
    // ── END DEVICE LOCK VALIDATION ────────────────────────────────────────────

    // Set student's room dynamically based on the session they log in with and log activity in a transaction
    let updatedUser;
    let log;
    await prisma.$transaction(async (tx) => {
      const updateData = {};
      if (session && session.roomId && session.room) {
        updateData.roomId = session.roomId;
        updateData.room = session.room.name;
      }

      // Simpan device_id & device_name ke profil user (untuk tampilan Device Status)
      if (incomingDeviceId) {
        updateData.device = device_name?.trim() || incomingDeviceId;
        if (!user.deviceId) {
          updateData.deviceId = incomingDeviceId;
        }
      }

      if (Object.keys(updateData).length > 0) {
        updatedUser = await tx.user.update({
          where: { id: user.id },
          data: updateData,
        });
      } else {
        updatedUser = await tx.user.findUnique({
          where: { id: user.id },
        });
      }

      log = await tx.activityLog.create({
        data: {
          userId:      updatedUser.id,
          actorName:   updatedUser.name,
          actorRole:   updatedUser.role,
          action:      'LOGIN',
          targetType:  'user',
          targetId:    updatedUser.id,
          targetLabel: `${updatedUser.name} (${updatedUser.role})`,
          meta: incomingDeviceId ? { deviceId: incomingDeviceId, deviceName: device_name?.trim() || null } : undefined,
        }
      });
    }, { timeout: 30000, maxWait: 15000 });

    if (log) {
      try {
        const { getIo } = require('../socket');
        const io = getIo();
        if (io) {
          io.to('room:admin').emit('new-activity', log);
          io.to('room:admin').emit('global-activity-admin', log);
        }
      } catch (_) {}
    }

    const accessToken = sign({ id: updatedUser.id, role: updatedUser.role });
    return ok(res, {
      accessToken,
      student: formatStudent(updatedUser),
      // Kembalikan deviceId yang terdaftar agar Flutter tahu statusnya
      deviceStatus: incomingDeviceId ? {
        deviceId:   incomingDeviceId,
        deviceName: device_name?.trim() || incomingDeviceId,
        verified:   true,
      } : null,
    }, 'Login berhasil.');
  } catch (e) { next(e); }
}

async function logout(req, res, next) {
  try {
    const user = req.user;
    let log;
    await prisma.$transaction(async (tx) => {
      log = await tx.activityLog.create({
        data: {
          userId:      user.id,
          actorName:   user.name,
          actorRole:   user.role,
          action:      'LOGOUT',
          targetType:  'user',
          targetId:    user.id,
          targetLabel: `${user.name} (${user.role})`,
        }
      });
    }, { timeout: 20000, maxWait: 10000 });

    if (log) {
      try {
        const { getIo } = require('../socket');
        const io = getIo();
        if (io) {
          io.to('room:admin').emit('new-activity', log);
          io.to('room:admin').emit('global-activity-admin', log);
        }
      } catch (_) {}
    }

    return ok(res, null, 'Logout berhasil.');
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

async function toggleLimit15Min(req, res) {
  try {
    const { active } = req.body;
    if (active === undefined || typeof active !== 'boolean') {
      return badRequest(res, 'Field active (boolean) wajib disertakan dalam body request.');
    }
    setLimit15MinActive(active);
    return ok(res, { active: getLimit15MinActive() }, `Fitur limit 15 menit berhasil di-set ke ${active}.`);
  } catch (e) {
    return badRequest(res, e.message);
  }
}

async function getLimit15MinStatus(req, res) {
  return ok(res, { active: getLimit15MinActive() });
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

module.exports = {
  login,
  logout,
  me,
  verifyToken,
  loginRules,
  tokenRules,
  toggleLimit15Min,
  getLimit15MinStatus
};

