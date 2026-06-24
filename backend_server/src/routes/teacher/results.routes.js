const router = require('express').Router();
const { getResults, exportResultsCsv } = require('../../controllers/teacher/results.controller');

router.get('/:id/results', getResults);
router.get('/:id/results/export', exportResultsCsv);

module.exports = router;
