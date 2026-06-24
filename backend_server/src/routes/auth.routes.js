const router = require('express').Router();
const { login, me, verifyToken, loginRules, tokenRules } = require('../controllers/auth.controller');
const { authenticate } = require('../middleware/auth');
const { loginLimiter } = require('../middleware/rateLimiter');

router.post('/login', loginLimiter, loginRules, login);
router.post('/token/verify', loginLimiter, tokenRules, verifyToken);
router.get('/me', authenticate, me);

module.exports = router;
