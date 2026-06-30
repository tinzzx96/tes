// backend_server/src/controllers/admin/exams.controller.js
// REPLACE FILE INI SEPENUHNYA (patch createExam, updateExam, listExams, getExam)

const crypto = require('crypto');
const prisma = require('../../config/database');
const { ok, created, notFound, badRequest, forbidden } = require('../../utils/response');
const { body, validationResult } = require('express-validator');
const { logActivity, ACTIONS } = require('../../utils/activityLog');

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

    let log;
    const exam = await prisma.$transaction(async (tx) => {
      const createdExam = await tx.exam.create({
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
        await syncExamClasses(tx, createdExam.id, class_ids);
      }

      log = await tx.activityLog.create({
        data: {
          userId:      req.user?.id ?? null,
          actorName:   req.user?.name ?? 'Sistem',
          actorRole:   req.user?.role ?? 'system',
          action:      ACTIONS.CREATE_EXAM,
          targetType:  'exam',
          targetId:    createdExam.id,
          targetLabel: createdExam.title,
        }
      });

      return createdExam;
    });

    const { getIo } = require('../../socket');
    const io = getIo();
    if (io) {
      io.to('room:admin').emit('admin-refresh', { tab: 'ujian' });
      io.emit('exam-status-changed', { examId: exam.id, status: exam.status });
    }

    if (log) {
      try {
        if (io) {
          io.to('room:admin').emit('new-activity', log);
          io.to('room:admin').emit('global-activity-admin', log);
        }
      } catch (_) {}
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

    await logActivity({
      user: req.user,
      action: ACTIONS.UPDATE_EXAM,
      targetType: 'exam',
      targetId: exam.id,
      targetLabel: exam.title,
    });

    return ok(res, exam, 'Ujian diperbarui.');
  } catch (e) { next(e); }
}

async function deleteExam(req, res, next) {
  try {
    const examId = +req.params.id;
    const exam = await prisma.exam.findUnique({ where: { id: examId } });
    if (exam) {
      await prisma.exam.delete({ where: { id: examId } });
      
      const { getIo } = require('../../socket');
      const io = getIo();
      if (io) {
        io.to('room:admin').emit('admin-refresh', { tab: 'ujian' });
        io.emit('exam-status-changed', { examId: examId, status: 'deleted' });
      }

      await logActivity({
        user: req.user,
        action: ACTIONS.DELETE_EXAM,
        targetType: 'exam',
        targetId: examId,
        targetLabel: exam.title,
      });
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

    await logActivity({
      user: req.user,
      action: ACTIONS.ACTIVATE_EXAM,
      targetType: 'exam',
      targetId: exam.id,
      targetLabel: exam.title,
    });

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

    await logActivity({
      user: req.user,
      action: ACTIONS.COMPLETE_EXAM,
      targetType: 'exam',
      targetId: exam.id,
      targetLabel: exam.title,
    });

    return ok(res, null, 'Ujian ditutup.');
  } catch (e) { next(e); }
}

async function resetToken(req, res, next) {
  try {
    const examId = +req.params.id;
    const role = req.user.role;
    const userId = req.user.id;

    if (role === 'proctor') {
      const proctor = await prisma.user.findUnique({ where: { id: userId }, select: { roomId: true } });
      if (!proctor?.roomId) {
        return forbidden(res, 'Kamu belum memiliki ruang yang ditugaskan.');
      }

      // Get all classes in proctor's room
      const studentsInRoom = await prisma.user.findMany({
        where: { roomId: proctor.roomId, role: 'student' },
        select: { classId: true },
        distinct: ['classId'],
      });
      const classIds = studentsInRoom.map(s => s.classId).filter(Boolean);

      // Verify if the exam is assigned to any of these classes
      const isAssigned = await prisma.exam.findFirst({
        where: {
          id: examId,
          examClasses: {
            some: {
              classId: { in: classIds }
            }
          }
        }
      });

      if (!isAssigned) {
        return forbidden(res, 'Kamu tidak memiliki akses ke ujian ini.');
      }
    }

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

    await logActivity({
      user: req.user,
      action: ACTIONS.RESET_EXAM_TOKEN,
      targetType: 'exam',
      targetId: exam.id,
      targetLabel: exam.title,
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