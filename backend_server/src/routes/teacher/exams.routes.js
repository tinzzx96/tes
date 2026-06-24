const router = require('express').Router();
const { listTeacherExams, getTeacherExam } = require('../../controllers/teacher/exams.controller');

router.get('/', listTeacherExams);
router.get('/:id', getTeacherExam);

module.exports = router;
