const router = require('express').Router();
const {
  reportViolation, verifyUnlock, getSecurityStatus,
  violationRules, verifyUnlockRules,
} = require('../controllers/security.controller');
const { authenticate } = require('../middleware/auth');
const { requireRole } = require('../middleware/role');
const { verifyUnlockLimiter } = require('../middleware/rateLimiter');

// Siswa: lapor pelanggaran — PIN dikirim ke pengawas via WebSocket (bukan REST)
router.post('/report-violation', authenticate, requireRole('student'), violationRules, reportViolation);
// Siswa: verifikasi PIN dari pengawas — limit ketat 3x per 5 menit (anti brute-force PIN 4 digit)
router.post('/verify-unlock', authenticate, requireRole('student'), verifyUnlockLimiter, verifyUnlockRules, verifyUnlock);
// Siswa: cek status blokir saat restart app
router.get('/status/:examAttemptId', authenticate, requireRole('student'), getSecurityStatus);

module.exports = router;
