// src/routes/admin/proctor.routes.js
// ════════════════════════════════════════════════════════════════════════════
// Routes untuk kelola proktor (admin) dan monitoring ruang (proktor sendiri).
// Daftarkan di index.js:
//   router.use('/admin/proctors', authenticate, requireRole('admin'), require('./admin/proctor.routes'));
//   router.use('/proctor', authenticate, requireRole('proctor','admin'), require('./admin/proctor.routes'));
// ════════════════════════════════════════════════════════════════════════════

const router = require('express').Router();
const {
  listProctors, createProctor, updateProctor, deleteProctor,
  listProctorExams, getProctorParticipants, resetStudentSession, resetStudentDevice,
  createRules,
} = require('../../controllers/admin/proctor.controller');
const { resetToken } = require('../../controllers/admin/exams.controller');

// ── Admin: CRUD proktor ───────────────────────────────────────────────────────
router.get('/',      listProctors);
router.post('/',     createRules, createProctor);
router.put('/:id',   updateProctor);
router.delete('/:id',deleteProctor);

// ── Proktor: exam di ruangnya + monitoring ────────────────────────────────────
router.get('/my-exams',                         listProctorExams);
router.get('/exam/:examId/participants',         getProctorParticipants);
router.post('/exam/:examId/reset/:userId',       resetStudentSession);
router.post('/exam/:examId/reset-token',         resetToken);
// ── Reset Device Lock (PRD Bagian 21) ────────────────────────────────────────
router.post('/exam/:examId/reset-device/:userId', resetStudentDevice);

module.exports = router;
