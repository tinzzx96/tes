const router = require('express').Router();
const { listExams, getExam, startExam, getTimer, submitExam, getResult } = require('../controllers/exam.controller');
const { saveAnswer, bulkSaveAnswers, saveRules, bulkRules } = require('../controllers/answer.controller');
const { getQuestions } = require('../controllers/question.controller');
const { authenticate } = require('../middleware/auth');
const { requireRole } = require('../middleware/role');

router.use(authenticate, requireRole('student'));

router.get('/', listExams);
router.get('/:id', getExam);
router.post('/:examId/start', startExam);
router.get('/:examId/timer', getTimer);
router.post('/:examId/submit', submitExam);
router.get('/:examId/questions', getQuestions);
router.post('/:examId/answers/save', saveRules, saveAnswer);
router.post('/:examId/answers', bulkRules, bulkSaveAnswers);
router.get('/:examId/result', getResult);

module.exports = router;
