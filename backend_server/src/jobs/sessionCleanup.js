const prisma = require('../config/database');
const { emitStudentStatusChanged } = require('../socket');
const logger = require('../utils/logger');

const OFFLINE_THRESHOLD_MS = 90_000;

/**
 * Cleanup job — berjalan setiap 2 menit (PRD Addendum Bagian 47 §5).
 * Mencari sesi aktif yang heartbeat-nya sudah > 90 detik, lalu emit
 * student-status-changed: offline ke room pengawas via WebSocket.
 *
 * Tidak mengubah kolom DB — "offline" adalah status turunan dari updatedAt,
 * bukan state tersimpan, sesuai desain schema yang ada.
 */
async function runSessionCleanup() {
  try {
    const cutoff = new Date(Date.now() - OFFLINE_THRESHOLD_MS);

    const deadAttempts = await prisma.examAttempt.findMany({
      where: { status: 'started', updatedAt: { lt: cutoff } },
      select: { user: { select: { id: true, room: true } } },
    });

    if (deadAttempts.length === 0) return;

    logger.info(`[SessionCleanup] ${deadAttempts.length} sesi tanpa heartbeat > 90 detik.`);

    for (const attempt of deadAttempts) {
      const roomName = attempt.user?.room;
      if (roomName) {
        emitStudentStatusChanged(roomName, {
          studentId: `stu_${attempt.user.id}`,
          status: 'offline',
        });
      }
    }
  } catch (err) {
    logger.error('[SessionCleanup] Error:', err.message);
  }
}

module.exports = { runSessionCleanup };
