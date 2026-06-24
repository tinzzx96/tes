const router = require('express').Router();
const { listExams, getExam, createExam, updateExam, deleteExam, activateExam, completeExam, resetToken, createRules, updateRules } = require('../../controllers/admin/exams.controller');

router.get('/', listExams);
router.post('/', createRules, createExam);
router.get('/:id', getExam);
router.put('/:id', updateRules, updateExam);
router.delete('/:id', deleteExam);
router.post('/:id/activate', activateExam);
router.post('/:id/complete', completeExam);
router.post('/:id/reset-token', resetToken);

module.exports = router;
