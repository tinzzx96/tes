// src/routes/admin/questionBanks.routes.v1.js
const router = require('express').Router();
const { listBanksV2 } = require('../../controllers/admin/questionBanks.controller');

// GET /api/v1/question-banks
router.get('/', listBanksV2);

module.exports = router;
