const router = require('express').Router();
const { validateExamToken, validateExamTokenRules } = require('../controllers/examToken.controller');
const { authenticate } = require('../middleware/auth');
const { requireRole } = require('../middleware/role');

router.post('/validate', authenticate, requireRole('student'), validateExamTokenRules, validateExamToken);

module.exports = router;
