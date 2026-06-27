// backend_server/src/controllers/admin/exams.controller.js
// REPLACE FILE INI SEPENUHNYA (patch createExam, updateExam, listExams, getExam)

const crypto = require('crypto');
const prisma = require('../../config/database');
const { ok, created, notFound, badRequest } = require('../../utils/response');
const { body, validationResult } = require('express-validator');

function genCode(len) {
  return crypto.randomBytes(len).toString('hex').toUpperCase().slice(0, len);
}

// ── Helper: sync exam_classes ──────────────────────────────────────────────────
async function syncExamClasses(tx, examId, classIds) {
  if (!Array.isArray(classIds) || classIds.length === 0) return;
  // Hapus semua lama, replace dengan baru
  await tx.examClass.deleteMany({ where: { examId } });
  await tx.examClass.createMany({
    data: classIds.map(cid => ({ examId, classId: +cid })),
    skipDuplicates: true,
  });
}

async function listExams(req, res, next) {
  try {
    const exams = await prisma.exam.findMany({
      include: {
        teacher: { select: { id: true, name: true } },
        questionBank: { select: { id: true, name: true } },
        examClasses: {
          include: { class: { include: { grade: { select: { id: true, name: true, label: true } } } } },
        },
        _count: { select: { attempts: true } },
      },
      orderBy: { startTime: 'desc' },
    });

    return ok(res, exams.map(e => ({
      id: e.id, title: e.title, subject: e.subject,
      teacher: e.teacher?.name,
      questionBank: e.questionBank?.name,
      durationMinutes: e.durationMinutes,
      startTime: e.startTime, endTime: e.endTime,
      examCode: e.examCode, token: e.token,
      status: e.status, participantCount: e._count.attempts,
      classes: e.examClasses.map(ec => ({
        id: ec.class.id,
        name: ec.class.name,
        major: ec.class.major,
        grade: ec.class.grade,
      })),
    })));
  } catch (e) { next(e); }
}

async function getExam(req, res, next) {
  try {
    const exam = await prisma.exam.findUnique({
      where: { id: +req.params.id },
      include: {
        teacher: { select: { id: true, name: true } },
        questionBank: { include: { questions: { include: { options: { orderBy: { orderNum: 'asc' } } }, orderBy: { orderNum: 'asc' } } } },
        examClasses: {
          include: { class: { include: { grade: { select: { id: true, name: true, label: true } } } } },
        },
      },
    });
    if (!exam) return notFound(res);
    return ok(res, {
      ...exam,
      classes: exam.examClasses.map(ec => ({
        id: ec.class.id,
        name: ec.class.name,
        major: ec.class.major,
        grade: ec.class.grade,
      })),
    });
  } catch (e) { next(e); }
}

async function createExam(req, res, next) {
  try {
    const errs = validationResult(req);
    if (!errs.isEmpty()) return badRequest(res, 'Validasi gagal.', errs.array());

    const {
      title, subject, teacher_id, question_bank_id,
      duration_minutes, start_time, end_time, exam_code,
      class_ids,
    } = req.body;

    const exam = await prisma.$transaction(async (tx) => {
      const created = await tx.exam.create({
        data: {
          title, subject,
          teacherId: +teacher_id,
          questionBankId: question_bank_id ? +question_bank_id : null,
          durationMinutes: duration_minutes ?? 90,
          startTime: new Date(start_time),
          endTime: new Date(end_time),
          examCode: exam_code ?? genCode(8),
          token: genCode(6),
          status: 'draft',
        },
      });
      if (class_ids?.length) {
        await syncExamClasses(tx, created.id, class_ids);
      }
      return created;
    });

    const { getIo } = require('../../socket');
    const io = getIo();
    if (io) {
      io.to('room:admin').emit('admin-refresh', { tab: 'ujian' });
      io.emit('exam-status-changed', { examId: exam.id, status: exam.status });
    }

    return created(res, exam, 'Ujian berhasil dibuat.');
  } catch (e) { next(e); }
}

async function updateExam(req, res, next) {
  try {
    const errs = validationResult(req);
    if (!errs.isEmpty()) return badRequest(res, 'Validasi gagal.', errs.array());

    const { title, subject, teacher_id, question_bank_id, duration_minutes, start_time, end_time, class_ids } = req.body;
    const data = {};
    if (title           !== undefined) data.title          = title;
    if (subject         !== undefined) data.subject        = subject;
    if (teacher_id      !== undefined) data.teacherId      = +teacher_id;
    if (question_bank_id !== undefined) data.questionBankId = +question_bank_id;
    if (duration_minutes !== undefined) data.durationMinutes = +duration_minutes;
    if (start_time      !== undefined) data.startTime      = new Date(start_time);
    if (end_time        !== undefined) data.endTime        = new Date(end_time);

    const examId = +req.params.id;
    const exam = await prisma.$transaction(async (tx) => {
      const updated = await tx.exam.update({ where: { id: examId }, data });
      if (class_ids !== undefined) {
        await syncExamClasses(tx, examId, class_ids);
      }
      return updated;
    });

    const { getIo } = require('../../socket');
    const io = getIo();
    if (io) {
      io.to('room:admin').emit('admin-refresh', { tab: 'ujian' });
      io.emit('exam-status-changed', { examId: examId, status: exam.status });
    }

    return ok(res, exam, 'Ujian diperbarui.');
  } catch (e) { next(e); }
}

async function deleteExam(req, res, next) {
  try {
    const examId = +req.params.id;
    await prisma.exam.delete({ where: { id: examId } });

    const { getIo } = require('../../socket');
    const io = getIo();
    if (io) {
      io.to('room:admin').emit('admin-refresh', { tab: 'ujian' });
      io.emit('exam-status-changed', { examId: examId, status: 'deleted' });
    }

    return ok(res, null, 'Ujian dihapus.');
  } catch (e) { next(e); }
}

async function activateExam(req, res, next) {
  try {
    const examId = +req.params.id;
    const exam = await prisma.exam.update({
      where: { id: examId },
      data: { status: 'active' },
    });

    const { getIo } = require('../../socket');
    const io = getIo();
    if (io) {
      io.to('room:admin').emit('admin-refresh', { tab: 'ujian' });
      io.emit('exam-status-changed', { examId: exam.id, status: 'active' });
    }

    return ok(res, { token: exam.token }, 'Ujian diaktifkan.');
  } catch (e) { next(e); }
}

async function completeExam(req, res, next) {
  try {
    const examId = +req.params.id;
    const exam = await prisma.exam.update({
      where: { id: examId },
      data: { status: 'completed' },
    });

    const { getIo } = require('../../socket');
    const io = getIo();
    if (io) {
      io.to('room:admin').emit('admin-refresh', { tab: 'ujian' });
      io.emit('exam-status-changed', { examId: exam.id, status: 'completed' });
    }

    return ok(res, null, 'Ujian ditutup.');
  } catch (e) { next(e); }
}

async function resetToken(req, res, next) {
  try {
    const examId = +req.params.id;
    const exam = await prisma.exam.update({
      where: { id: examId },
      data: { token: genCode(6) },
    });

    const { getIo } = require('../../socket');
    const io = getIo();
    if (io) {
      io.to('room:admin').emit('admin-refresh', { tab: 'ujian' });
      io.emit('exam-status-changed', { examId: exam.id, token: exam.token });
    }

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
  body('class_ids').optional().isArray().withMessage('class_ids harus array.'),
  body('class_ids.*').optional().isInt({ min: 1 }),
];

const updateRules = [
  body('title').optional().trim().notEmpty(),
  body('teacher_id').optional().isInt({ min: 1 }),
  body('question_bank_id').optional().isInt({ min: 1 }),
  body('duration_minutes').optional().isInt({ min: 1, max: 600 }),
  body('start_time').optional().isISO8601(),
  body('end_time').optional().isISO8601(),
  body('class_ids').optional().isArray(),
  body('class_ids.*').optional().isInt({ min: 1 }),
];

module.exports = { listExams, getExam, createExam, updateExam, deleteExam, activateExam, completeExam, resetToken, createRules, updateRules };