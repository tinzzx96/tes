const prisma = require('../config/database');
const { ok, badRequest, notFound } = require('../utils/response');
const { body, validationResult } = require('express-validator');

/**
 * GET /api/exam-attempts/history
 * Riwayat ujian permanen siswa (PRD Bagian 40.B, API Contract Bagian 4).
 * Filter status='submitted' berdasarkan userId dari token — BUKAN query param.
 */
async function getHistory(req, res, next) {
  try {
    const userId = req.user.id;

    const attempts = await prisma.examAttempt.findMany({
      where: { userId, status: 'submitted' },
      include: {
        exam: {
          select: {
            id: true,
            title: true,
            subject: true,
            examCode: true,
            teacher: { select: { name: true } },
          },
        },
      },
      orderBy: { finishedAt: 'desc' },
    });

    const data = attempts.map(a => ({
      examId: `exam-${a.examId}`,
      subjectName: a.exam.subject,
      examCode: a.exam.examCode,
      teacherName: a.exam.teacher.name,
      submittedAt: a.finishedAt?.toISOString() ?? a.updatedAt.toISOString(),
      score: a.score ?? null,
    }));

    return ok(res, data);
  } catch (e) { next(e); }
}

/**
 * POST /api/exam-attempts/:examAttemptId/answers
 * Auto-save jawaban per soal (PRD Bagian 15 & 44, API Contract Bagian 5).
 * Menggunakan Prisma transaction + row-level locking untuk mencegah race condition.
 */
async function saveAnswer(req, res, next) {
  try {
    const errs = validationResult(req);
    if (!errs.isEmpty()) return badRequest(res, 'Validasi gagal.', errs.array());

    const userId = req.user.id;
    const attemptId = +req.params.examAttemptId;
    const { questionId, selectedOptionIndex, clientTimestamp } = req.body;

    const attempt = await prisma.examAttempt.findUnique({
      where: { id: attemptId },
      include: {
        user: { select: { id: true, room: true, roomId: true } },
        exam: { include: { questionBank: { select: { id: true } } } },
      },
    });

    if (!attempt || attempt.userId !== userId) return notFound(res, 'Sesi ujian tidak ditemukan.');
    if (attempt.status !== 'started') return badRequest(res, 'Ujian belum dimulai atau sudah dikumpulkan.');

    const question = await prisma.question.findFirst({
      where: {
        id: +questionId,
        questionBankId: attempt.exam.questionBankId,
      },
      include: { options: { orderBy: { orderNum: 'asc' } } },
    });

    if (!question) return notFound(res, 'Soal tidak ditemukan.');

    let optionId = null;
    if (question.type === 'multiple_choice' && selectedOptionIndex != null) {
      const option = question.options[+selectedOptionIndex];
      optionId = option?.id ?? null;
    }

    const serverSavedAt = new Date();

    // Row-level locking nyata via SELECT ... FOR UPDATE (PRD Bagian 44, Addendum 47 §6.1).
    // Prisma transaction biasa tidak cukup — FOR UPDATE mengunci baris di MySQL
    // sehingga urutan tulis dijamin oleh server, bukan oleh urutan kedatangan request.
    await prisma.$transaction(async (tx) => {
      await tx.$queryRaw`
        SELECT id FROM answers
        WHERE user_id = ${userId}
          AND exam_id = ${attempt.examId}
          AND question_id = ${question.id}
        FOR UPDATE
      `;
      await tx.answer.upsert({
        where: {
          userId_examId_questionId: {
            userId,
            examId: attempt.examId,
            questionId: question.id,
          },
        },
        update: { optionId, savedAt: serverSavedAt },
        create: {
          userId,
          examId: attempt.examId,
          questionId: question.id,
          attemptId: attempt.id,
          optionId,
          savedAt: serverSavedAt,
        },
      });
    });

    const progressCount = await prisma.answer.count({
      where: { attemptId: attempt.id },
    });

    const { emitStudentStatusChanged } = require('../socket');
    if (attempt.user?.room) {
      emitStudentStatusChanged(attempt.user.room, {
        studentId: `stu_${userId}`,
        status: 'online',
        progress: progressCount,
        roomId: attempt.user.roomId,
      });
    }

    return ok(res, { saved: true, savedAt: serverSavedAt.toISOString() });
  } catch (e) { next(e); }
}

const saveAnswerRules = [
  body('questionId').isInt({ min: 1 }).withMessage('questionId wajib diisi.'),
  body('selectedOptionIndex').optional().isInt({ min: 0 }),
  body('clientTimestamp').optional().isISO8601(),
];

module.exports = { getHistory, saveAnswer, saveAnswerRules };
