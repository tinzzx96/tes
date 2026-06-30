const router = require('express').Router();
const { listExams, getExam, startExam, getTimer, submitExam, getResult } = require('../controllers/exam.controller');
const { saveAnswer, bulkSaveAnswers, saveRules, bulkRules } = require('../controllers/answer.controller');
const { getQuestions } = require('../controllers/question.controller');
const { authenticate } = require('../middleware/auth');
const { requireRole } = require('../middleware/role');
const { checkDeviceLock } = require('../middleware/deviceCheck');

router.use(authenticate, requireRole('student'));

router.get('/', listExams);
router.get('/:id', getExam);
// ── Endpoint kritis: wajib lolos checkDeviceLock ────────────────────────────
router.post('/:examId/start',       checkDeviceLock, startExam);
router.get('/:examId/timer',        checkDeviceLock, getTimer);
router.post('/:examId/submit',      checkDeviceLock, submitExam);
router.get('/:examId/questions',    checkDeviceLock, getQuestions);
router.post('/:examId/answers/save',checkDeviceLock, saveRules, saveAnswer);
router.post('/:examId/answers',     checkDeviceLock, bulkRules, bulkSaveAnswers);
router.get('/:examId/result', getResult);

module.exports = router;
