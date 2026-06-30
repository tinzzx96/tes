// backend_server/src/utils/activityLog.js
// ─────────────────────────────────────────────────────────────────────────────
// Helper untuk mencatat aktivitas ke tabel activity_logs.
// Dipakai di controllers: admin (exam, user, session, class, proctor).
// ─────────────────────────────────────────────────────────────────────────────

const prisma = require('../config/database');
const logger = require('./logger');

/**
 * @param {object} opts
 * @param {object|null} opts.user        - req.user dari middleware auth
 * @param {string}      opts.action      - konstanta aksi, cth: 'CREATE_EXAM'
 * @param {string|null} opts.targetType  - 'exam' | 'user' | 'session' | 'class' | dll
 * @param {number|null} opts.targetId    - ID dari record yang dikenai aksi
 * @param {string|null} opts.targetLabel - Nama/label dari record (cth: judul ujian)
 * @param {object|null} opts.meta        - Data tambahan JSON opsional
 */
async function logActivity({ user, action, targetType = null, targetId = null, targetLabel = null, meta = null }, tx = null) {
    try {
        const client = tx || prisma;
        const log = await client.activityLog.create({
            data: {
                userId:      user?.id      ?? null,
                actorName:   user?.name    ?? 'Sistem',
                actorRole:   user?.role    ?? 'system',
                action,
                targetType,
                targetId:    targetId   ? Number(targetId) : null,
                targetLabel: targetLabel ?? null,
                meta:        meta        ?? undefined,
            },
        });

        // Prune logs: Only keep the latest 15 logs
        try {
            const allLogs = await client.activityLog.findMany({
                orderBy: { createdAt: 'desc' },
                select: { id: true }
            });
            if (allLogs.length > 15) {
                const idsToDelete = allLogs.slice(15).map(l => l.id);
                await client.activityLog.deleteMany({
                    where: { id: { in: idsToDelete } }
                });
            }
        } catch (pruneErr) {
            logger.error('[ActivityLog] Gagal merapikan log lama:', pruneErr.message);
        }

        // Broadcast to admin room (only if not in transaction)
        if (!tx) {
            try {
                const { getIo } = require('../socket');
                const io = getIo();
                if (io) {
                    io.to('room:admin').emit('new-activity', log);
                    io.to('room:admin').emit('global-activity-admin', log);
                    io.to('room:global-activity').emit('global-activity', log);
                }
            } catch (_) {}
        }
        return log;
    } catch (err) {
        // Jangan sampai log error merusak flow utama
        logger.error('[ActivityLog] Gagal menulis log:', err.message);
    }
}

// ─── Konstanta Aksi ───────────────────────────────────────────────────────────
const ACTIONS = {
    // Ujian
    CREATE_EXAM:      'CREATE_EXAM',
    UPDATE_EXAM:      'UPDATE_EXAM',
    DELETE_EXAM:      'DELETE_EXAM',
    ACTIVATE_EXAM:    'ACTIVATE_EXAM',
    COMPLETE_EXAM:    'COMPLETE_EXAM',
    RESET_EXAM_TOKEN: 'RESET_EXAM_TOKEN',

    // User (Guru / Siswa / Proktor)
    CREATE_USER:  'CREATE_USER',
    UPDATE_USER:  'UPDATE_USER',
    DELETE_USER:  'DELETE_USER',

    // Kelas
    CREATE_CLASS: 'CREATE_CLASS',
    UPDATE_CLASS: 'UPDATE_CLASS',
    DELETE_CLASS: 'DELETE_CLASS',

    // Ruangan
    CREATE_ROOM:  'CREATE_ROOM',
    UPDATE_ROOM:  'UPDATE_ROOM',
    DELETE_ROOM:  'DELETE_ROOM',

    // Bank Soal
    CREATE_BANK:  'CREATE_BANK',
    UPDATE_BANK:  'UPDATE_BANK',
    DELETE_BANK:  'DELETE_BANK',

    // Token Sesi
    CREATE_SESSION: 'CREATE_SESSION',
    TOGGLE_SESSION: 'TOGGLE_SESSION',
    DELETE_SESSION: 'DELETE_SESSION',

    // Login / Logout
    LOGIN: 'LOGIN',
    LOGOUT: 'LOGOUT',

    // Import Soal
    IMPORT_QUESTIONS: 'IMPORT_QUESTIONS',

    // Reset Sesi
    RESET_STUDENT_SESSION: 'RESET_STUDENT_SESSION',

    // Device Lock (PRD Bagian 21)
    RESET_DEVICE_LOCK: 'RESET_DEVICE_LOCK',
};

module.exports = { logActivity, ACTIONS };