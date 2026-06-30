const router = require('express').Router();
const { getHistory, saveAnswer, saveAnswerRules } = require('../controllers/examAttempt.controller');
const { authenticate } = require('../middleware/auth');
const { requireRole } = require('../middleware/role');
const { checkDeviceLock } = require('../middleware/deviceCheck');

router.use(authenticate, requireRole('student'));

router.get('/history', getHistory);
router.post('/:examAttemptId/answers', checkDeviceLock, saveAnswerRules, saveAnswer);

module.exports = router;
