const router = require('express').Router();
const { heartbeat, getParticipants, heartbeatRules } = require('../controllers/monitor.controller');
const { authenticate } = require('../middleware/auth');
const { requireRole } = require('../middleware/role');

// Siswa: kirim heartbeat setiap 30 detik
router.post('/heartbeat', authenticate, requireRole('student'), heartbeatRules, heartbeat);

// Pengawas/guru/admin: lihat status peserta real-time
router.get('/exam/:examId/participants', authenticate, requireRole('proctor', 'teacher', 'admin'), getParticipants);

module.exports = router;
