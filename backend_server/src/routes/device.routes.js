const router = require('express').Router();
const { updateStatus } = require('../controllers/device.controller');
const { authenticate } = require('../middleware/auth');

router.post('/status', authenticate, updateStatus);

module.exports = router;
