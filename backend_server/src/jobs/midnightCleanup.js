const prisma = require('../config/database');
const logger = require('../utils/logger');

/**
 * Pembersihan sesi otomatis / Auto Logout pada tengah malam di jam 00:00 (PRD Addendum §47.6).
 * Menonaktifkan semua token sesi aktif dengan mengubah active=false.
 */
async function runMidnightCleanup() {
  try {
    const result = await prisma.session.updateMany({
      where: { active: true },
      data: { active: false }
    });
    logger.info(`[MidnightCleanup] Sesi dibersihkan. ${result.count} token sesi dinonaktifkan.`);
  } catch (err) {
    logger.error('[MidnightCleanup] Error saat membersihkan sesi:', err.message);
  }
}

module.exports = { runMidnightCleanup };
