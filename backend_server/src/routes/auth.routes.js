const router = require('express').Router();
const {
  login, logout, me, verifyToken, loginRules, tokenRules,
  toggleLimit15Min, getLimit15MinStatus
} = require('../controllers/auth.controller');
const { authenticate } = require('../middleware/auth');
const { loginLimiter } = require('../middleware/rateLimiter');

router.post('/login', loginLimiter, loginRules, login);
router.post('/logout', authenticate, logout);
router.post('/token/verify', loginLimiter, tokenRules, verifyToken);
router.get('/me', authenticate, me);

// Dev endpoints to query/modify the 15-minute login limit
router.post('/limit-15min', toggleLimit15Min);
router.get('/limit-15min', getLimit15MinStatus);

module.exports = router;

