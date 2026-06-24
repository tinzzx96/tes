// src/routes/index.js
// ════════════════════════════════════════════════════════════════════════════
// GANTI SELURUH FILE INI — tambah routes proktor
// ════════════════════════════════════════════════════════════════════════════

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

// Teacher routes (teacher + admin)
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
router.use('/admin/sessions',
  authenticate, requireRole('admin'),
  require('./admin/sessions.routes')
);
router.use('/admin/exam-tokens',
  authenticate, requireRole('admin', 'teacher'),
  require('./admin/examTokens.routes')
);

// ── Proktor: kelola akun (admin only) ─────────────────────────────────────────
router.use('/admin/proctors',
  authenticate, requireRole('admin'),
  require('./admin/proctor.routes')
);

// ── Proktor: akses monitoring ruangnya sendiri ────────────────────────────────
router.use('/proctor',
  authenticate, requireRole('proctor', 'admin'),
  require('./admin/proctor.routes')
);

module.exports = router;
