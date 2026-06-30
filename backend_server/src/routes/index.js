// backend_server/src/routes/index.js
// ─────────────────────────────────────────────────────────────────────────────
// PERUBAHAN dari versi sebelumnya:
//   + Tambah route /admin/activity  (GET — ambil activity log, admin only)
// ─────────────────────────────────────────────────────────────────────────────

const router = require('express').Router();
const { authenticate } = require('../middleware/auth');
const { requireRole }  = require('../middleware/role');

router.use('/auth',          require('./auth.routes'));
router.use('/exam-tokens',   require('./examTokens.routes'));
router.use('/exam-attempts', require('./examAttempts.routes'));
router.use('/exams',         require('./exam.routes'));
router.use('/security',      require('./security.routes'));
router.use('/monitor',       require('./monitor.routes'));
router.use('/device',        require('./device.routes'));

// Teacher routes
router.use('/teacher/exams',
  authenticate, requireRole('teacher', 'admin'),
  require('./teacher/exams.routes')
);
router.use('/teacher/exams',
  authenticate, requireRole('teacher', 'admin'),
  require('./teacher/results.routes')
);

// Admin-only routes
router.use('/admin/users',
  authenticate, requireRole('admin'),
  require('./admin/users.routes')
);
router.use('/admin/exams',
  authenticate, requireRole('admin'),
  require('./admin/exams.routes')
);
router.use('/admin/question-banks',
  authenticate, requireRole('admin', 'teacher'),
  require('./admin/questionBanks.routes')
);
router.use('/v1/question-banks',
  authenticate, requireRole('admin', 'teacher'),
  require('./admin/questionBanks.routes.v1')
);
router.use('/admin/sessions',
  authenticate, requireRole('admin'),
  require('./admin/sessions.routes')
);
router.use('/admin/rooms',
  authenticate, requireRole('admin'),
  require('./admin/rooms.routes')
);
router.use('/admin/classes',
  authenticate, requireRole('admin'),
  require('./admin/classes.routes')
);
// Import siswa via Excel
router.use('/admin/import',
  authenticate, requireRole('admin'),
  require('./admin/importSiswa.routes')
);
// Proktor
router.use('/admin/proctors',
  authenticate, requireRole('admin'),
  require('./admin/proctor.routes')
);
router.use('/proctor',
  authenticate, requireRole('proctor', 'admin'),
  require('./admin/proctor.routes')
);

// ── Activity Log (NEW) ────────────────────────────────────────────────────────
router.use('/admin/activity',
  authenticate, requireRole('admin'),
  require('./admin/activity.routes')
);

module.exports = router;