// backend_server/src/routes/admin/classes.routes.js
const router = require('express').Router();
const {
  listGrades,
  listClasses, createClass, updateClass, deleteClass,
  createClassRules, updateClassRules,
} = require('../../controllers/admin/classes.controller');

// ── Grades (read-only, di-seed) ───────────────────────────────────────────────
router.get('/grades', listGrades);

// ── Classes ───────────────────────────────────────────────────────────────────
router.get('/',         listClasses);
router.post('/',        createClassRules, createClass);
router.put('/:id',      updateClassRules, updateClass);
router.delete('/:id',   deleteClass);

module.exports = router;