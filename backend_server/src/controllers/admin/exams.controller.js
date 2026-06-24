const crypto = require('crypto');
const prisma = require('../../config/database');
const { ok, created, notFound, badRequest } = require('../../utils/response');
const { body, validationResult } = require('express-validator');

function genCode(len) {
  return crypto.randomBytes(len).toString('hex').toUpperCase().slice(0, len);
}

async function listExams(req, res, next) {
  try {
    const exams = await prisma.exam.findMany({
      include: {
        teacher: { select: { id: true, name: true } },
        questionBank: { select: { id: true, name: true } },
        classes: { select: { className: true } },
        _count: { select: { attempts: true } },
      },
      orderBy: { startTime: 'desc' },
    });

    return ok(res, exams.map(e => ({
      id: e.id, title: e.title, subject: e.subject,
      teacher: e.teacher?.name,
      questionBank: e.questionBank?.name,
      classes: e.classes.map(c => c.className),
      durationMinutes: e.durationMinutes,
      startTime: e.startTime, endTime: e.endTime,
      room: e.room, examCode: e.examCode, token: e.token,
      status: e.status, participantCount: e._count.attempts,
    })));
  } catch (e) { next(e); }
}

async function getExam(req, res, next) {
  try {
    const exam = await prisma.exam.findUnique({
      where: { id: +req.params.id },
      include: {
        teacher: { select: { id: true, name: true } },
        classes: { select: { className: true } },
        questionBank: { include: { questions: { include: { options: { orderBy: { orderNum: 'asc' } } }, orderBy: { orderNum: 'asc' } } } },
      },
    });
    if (!exam) return notFound(res);
    return ok(res, { ...exam, classes: exam.classes.map(c => c.className) });
  } catch (e) { next(e); }
}

async function createExam(req, res, next) {
  try {
    const errs = validationResult(req);
    if (!errs.isEmpty()) return badRequest(res, 'Validasi gagal.', errs.array());

    const { title, subject, teacher_id, question_bank_id, duration_minutes, start_time, end_time, room, exam_code, classes } = req.body;

    const examData = {
      title, subject,
      teacherId: +teacher_id,
      questionBankId: question_bank_id ? +question_bank_id : null,
      durationMinutes: duration_minutes ?? 90,
      startTime: new Date(start_time),
      endTime: new Date(end_time),
      room,
      examCode: exam_code ?? genCode(8),
      token: genCode(6),
      status: 'draft',
    };

    if (classes && Array.isArray(classes) && classes.length > 0) {
      examData.classes = {
        create: classes.map(c => ({ className: c }))
      };
    }

    const exam = await prisma.exam.create({
      data: examData,
      include: { classes: true }
    });
    return created(res, exam, 'Ujian berhasil dibuat.');
  } catch (e) { next(e); }
}

async function updateExam(req, res, next) {
  try {
    const errs = validationResult(req);
    if (!errs.isEmpty()) return badRequest(res, 'Validasi gagal.', errs.array());

    const { title, subject, teacher_id, question_bank_id, duration_minutes, start_time, end_time, room, classes } = req.body;
    const data = {};
    if (title !== undefined) data.title = title;
    if (subject !== undefined) data.subject = subject;
    if (teacher_id !== undefined) data.teacherId = +teacher_id;
    if (question_bank_id !== undefined) data.questionBankId = +question_bank_id;
    if (duration_minutes !== undefined) data.durationMinutes = +duration_minutes;
    if (start_time !== undefined) data.startTime = new Date(start_time);
    if (end_time !== undefined) data.endTime = new Date(end_time);
    if (room !== undefined) data.room = room;

    if (classes && Array.isArray(classes)) {
      await prisma.examClass.deleteMany({ where: { examId: +req.params.id } });
      if (classes.length > 0) {
        data.classes = { create: classes.map(c => ({ className: c })) };
      }
    }

    const exam = await prisma.exam.update({ 
      where: { id: +req.params.id }, 
      data,
      include: { classes: true }
    });
    return ok(res, exam, 'Ujian diperbarui.');
  } catch (e) { next(e); }
}

async function deleteExam(req, res, next) {
  try {
    await prisma.exam.delete({ where: { id: +req.params.id } });
    return ok(res, null, 'Ujian dihapus.');
  } catch (e) { next(e); }
}

async function activateExam(req, res, next) {
  try {
    const exam = await prisma.exam.update({
      where: { id: +req.params.id },
      data: { status: 'active' },
    });
    return ok(res, { token: exam.token }, 'Ujian diaktifkan.');
  } catch (e) { next(e); }
}

async function completeExam(req, res, next) {
  try {
    await prisma.exam.update({ where: { id: +req.params.id }, data: { status: 'completed' } });
    return ok(res, null, 'Ujian ditutup.');
  } catch (e) { next(e); }
}

async function resetToken(req, res, next) {
  try {
    const exam = await prisma.exam.update({
      where: { id: +req.params.id },
      data: { token: genCode(6) },
    });
    return ok(res, { token: exam.token }, 'Token direset.');
  } catch (e) { next(e); }
}

const createRules = [
  body('title').trim().notEmpty(),
  body('subject').trim().notEmpty(),
  body('teacher_id').isInt({ min: 1 }),
  body('duration_minutes').optional().isInt({ min: 1, max: 600 }),
  body('start_time').isISO8601().withMessage('Format start_time tidak valid.'),
  body('end_time').isISO8601().withMessage('Format end_time tidak valid.'),
  body('room').trim().notEmpty(),
  body('classes').optional().isArray(),
];

const updateRules = [
  body('title').optional().trim().notEmpty(),
  body('teacher_id').optional().isInt({ min: 1 }),
  body('question_bank_id').optional().isInt({ min: 1 }),
  body('duration_minutes').optional().isInt({ min: 1, max: 600 }),
  body('start_time').optional().isISO8601(),
  body('end_time').optional().isISO8601(),
  body('classes').optional().isArray(),
];

module.exports = { listExams, getExam, createExam, updateExam, deleteExam, activateExam, completeExam, resetToken, createRules, updateRules };
