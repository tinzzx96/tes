// backend_server/src/routes/admin/activity.routes.js
// ─────────────────────────────────────────────────────────────────────────────
// GET /api/admin/activity  — ambil 50 log aktivitas terbaru (admin only)
// ─────────────────────────────────────────────────────────────────────────────

const router = require('express').Router();
const prisma = require('../../config/database');
const { ok } = require('../../utils/response');

// GET /api/admin/activity?limit=50&page=1
router.get('/', async (req, res, next) => {
    try {
        const limit = Math.min(parseInt(req.query.limit) || 50, 100);
        const page  = Math.max(parseInt(req.query.page)  || 1, 1);
        const skip  = (page - 1) * limit;

        const where = {};
        if (req.query.actions) {
            where.action = { in: req.query.actions.split(',') };
        }

        const [logs, total] = await Promise.all([
            prisma.activityLog.findMany({
                where,
                orderBy: { createdAt: 'desc' },
                take:  limit,
                skip,
                select: {
                    id:          true,
                    actorName:   true,
                    actorRole:   true,
                    action:      true,
                    targetType:  true,
                    targetId:    true,
                    targetLabel: true,
                    meta:        true,
                    createdAt:   true,
                },
            }),
            prisma.activityLog.count({ where }),
        ]);

        return ok(res, { logs, total, page, limit });
    } catch (e) { next(e); }
});

module.exports = router;