const router = require('express').Router();
const { getHistory, saveAnswer, saveAnswerRules } = require('../controllers/examAttempt.controller');
const { authenticate } = require('../middleware/auth');
const { requireRole } = require('../middleware/role');

router.use(authenticate, requireRole('student'));

router.get('/history', getHistory);
router.post('/:examAttemptId/answers', saveAnswerRules, saveAnswer);

module.exports = router;
