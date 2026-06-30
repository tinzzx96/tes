// backend_server/src/middleware/deviceCheck.js
// ════════════════════════════════════════════════════════════════════════════
// HERO EXAM — Device Lock Middleware
//
// Filosofi: "First-Device Lock" — perangkat yang dipakai pertama kali saat
// login (exam_attempt.device_id) menjadi "Perangkat Terverifikasi". Request
// berikutnya dari perangkat berbeda DITOLAK, bukan hanya di-kick.
//
// Flow:
//   1. Baca x-device-id dari header.
//   2. Cari exam_attempt aktif milik user (status != 'submitted').
//   3. Jika attempt sudah punya deviceId terkunci → bandingkan dengan header.
//   4. Tidak cocok → 403 dengan pesan eksplisit.
//   5. Cocok / belum ada attempt → lanjutkan.
//
// Middleware ini HANYA diterapkan pada endpoint kritis (exam & exam-attempt).
// Login tidak pakai middleware ini (login lah yang mengunci perangkat).
// ════════════════════════════════════════════════════════════════════════════

const prisma = require('../config/database');
const { forbidden } = require('../utils/response');

/**
 * Pesan error standar untuk device mismatch.
 * Sesuai PRD Bagian 26 — pesan harus tegas dan jelas.
 */
const DEVICE_LOCKED_MSG =
  'Akses Ditolak. Anda hanya dapat mengikuti ujian menggunakan perangkat yang telah terverifikasi di awal sesi.';

/**
 * Middleware: verifikasi x-device-id terhadap device yang terkunci di exam_attempt.
 *
 * Dipasang di route kritis:
 *   - POST   /api/exams/:examId/start
 *   - GET    /api/exams/:examId/timer
 *   - POST   /api/exams/:examId/submit
 *   - POST   /api/exam-attempts/:examAttemptId/answers
 *   - POST   /api/security/report-violation
 *   - POST   /api/security/verify-unlock
 */
async function checkDeviceLock(req, res, next) {
  try {
    const userId   = req.user?.id;
    const incomingDeviceId = req.headers['x-device-id']?.trim();

    // Jika tidak ada user (seharusnya sudah dicegah oleh authenticate), skip
    if (!userId) return next();

    // Hanya berlaku untuk siswa (Guru, Admin, Pengawas tidak dikunci perangkatnya)
    if (req.user?.role !== 'student') {
      return next();
    }

    // Jika tidak ada device header, tidak bisa divalidasi — tolak
    // (kecuali siswa belum punya attempt sama sekali, berarti ini pertama kali)
    if (!incomingDeviceId) {
      // Cek apakah sudah ada attempt dengan deviceId terkunci
      const locked = await prisma.examAttempt.findFirst({
        where: {
          userId,
          status: { not: 'submitted' },
          deviceId: { not: null },
        },
        select: { deviceId: true },
      });

      if (locked) {
        // Ada attempt terkunci tapi request tidak mengirim device header → tolak
        return res.status(403).json({
          success: false,
          error: {
            code: 'DEVICE_LOCK_MISSING_HEADER',
            message: DEVICE_LOCKED_MSG,
          },
        });
      }

      // Belum ada attempt → lanjutkan (device akan dikunci saat startExam)
      return next();
    }

    // Cari attempt aktif dengan deviceId terkunci
    const lockedAttempt = await prisma.examAttempt.findFirst({
      where: {
        userId,
        status: { not: 'submitted' },
        deviceId: { not: null },
      },
      select: { deviceId: true },
      orderBy: { createdAt: 'asc' }, // ambil yang pertama (paling awal)
    });

    if (!lockedAttempt) {
      // Belum ada attempt dengan device terkunci → lanjutkan
      return next();
    }

    // Bandingkan device ID
    if (lockedAttempt.deviceId !== incomingDeviceId) {
      return res.status(403).json({
        success: false,
        error: {
          code: 'DEVICE_LOCKED',
          message: DEVICE_LOCKED_MSG,
          lockedDeviceId: lockedAttempt.deviceId, // opsional, untuk debug
        },
      });
    }

    // Device cocok → lanjutkan
    return next();
  } catch (e) {
    // Jika error DB → jangan blokir user, log saja
    console.error('[DeviceCheck] Error:', e.message);
    return next();
  }
}

module.exports = { checkDeviceLock, DEVICE_LOCKED_MSG };
