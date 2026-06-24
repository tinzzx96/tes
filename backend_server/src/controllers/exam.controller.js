const prisma = require('../config/database');
const { ok, notFound, badRequest, forbidden } = require('../utils/response');
const { calculateScore } = require('../utils/scoring');

async function listExams(req, res, next) {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const userId = req.user.id;
    const user = await prisma.user.findUnique({ where: { id: userId }, select: { class: true } });
    const userClass = user?.class;

    const [exams, attempts] = await Promise.all([
      prisma.exam.findMany({
        where: { 
          startTime: { gte: today, lt: tomorrow }, 
          status: { not: 'draft' },
          OR: [
            { classes: { none: {} } }, // if no class specified, it's global
            { classes: { some: { className: userClass } } }
          ]
        },
        include: { teacher: { select: { id: true, name: true } } },
        orderBy: { startTime: 'asc' },
      }),
      prisma.examAttempt.findMany({
        where: { userId },
        select: { examId: true, status: true, score: true, startedAt: true, finishedAt: true, counterPelanggaran: true },
      }),
    ]);

    const attemptMap = Object.fromEntries(attempts.map(a => [a.examId, a]));
    const result = exams.map(e => formatExam(e, attemptMap[e.id]));
    return ok(res, result);
  } catch (e) { next(e); }
}

async function getExam(req, res, next) {
  try {
    const userId = req.user.id;
    const examId = +req.params.id;

    const [exam, attempt] = await Promise.all([
      prisma.exam.findUnique({
        where: { id: examId },
        include: { teacher: { select: { id: true, name: true } } },
      }),
      prisma.examAttempt.findUnique({
        where: { userId_examId: { userId, examId } },
        select: { examId: true, status: true, score: true, startedAt: true, finishedAt: true, counterPelanggaran: true },
      }),
    ]);

    if (!exam) return notFound(res);
    return ok(res, formatExam(exam, attempt, true));
  } catch (e) { next(e); }
}

async function startExam(req, res, next) {
  try {
    const userId = req.user.id;
    const examId = +req.params.examId;

    const exam = await prisma.exam.findUnique({ where: { id: examId } });
    if (!exam) return notFound(res, 'Ujian tidak ditemukan.');
    if (exam.status !== 'active') return forbidden(res, 'Ujian belum aktif.');

    const ip = req.headers['x-forwarded-for']?.split(',')[0] || req.socket.remoteAddress;
    const deviceId = req.body.device_id || req.user.device;

    const existing = await prisma.examAttempt.findUnique({
      where: { userId_examId: { userId, examId } },
    });

    if (existing?.status === 'submitted') {
      return badRequest(res, 'Ujian sudah dikumpulkan.');
    }

    let attempt;
    if (!existing) {
      attempt = await prisma.examAttempt.create({
        data: { userId, examId, status: 'started', startedAt: new Date(), deviceId, ipAddress: ip },
      });
    } else if (existing.status === 'waiting') {
      // Sudah dibuat oleh /exam-tokens/validate, sekarang di-start
      attempt = await prisma.examAttempt.update({
        where: { id: existing.id },
        data: { status: 'started', startedAt: new Date(), deviceId, ipAddress: ip },
      });
    } else {
      // status === 'started' — sudah berjalan, kembalikan info yang ada
      attempt = existing;
    }

    return ok(res, { message: 'Ujian dimulai.', startedAt: attempt.startedAt, attemptId: attempt.id });
  } catch (e) { next(e); }
}

async function getTimer(req, res, next) {
  try {
    const userId = req.user.id;
    const examId = +req.params.examId;

    const [exam, attempt] = await Promise.all([
      prisma.exam.findUnique({ where: { id: examId } }),
      prisma.examAttempt.findUnique({ where: { userId_examId: { userId, examId } } }),
    ]);

    if (!exam) return notFound(res, 'Ujian tidak ditemukan.');
    if (!attempt?.startedAt) return forbidden(res, 'Ujian belum dimulai.');

    const endAt = new Date(attempt.startedAt.getTime() + exam.durationMinutes * 60_000);
    const remainingSeconds = Math.max(0, Math.floor((endAt - Date.now()) / 1000));

    return ok(res, {
      startedAt: attempt.startedAt,
      endAt: endAt.toISOString(),
      remainingSeconds,
      durationMinutes: exam.durationMinutes,
      counterPelanggaran: attempt.counterPelanggaran,
    });
  } catch (e) { next(e); }
}

async function submitExam(req, res, next) {
  try {
    const userId = req.user.id;
    const examId = +req.params.examId;

    const attempt = await prisma.examAttempt.findUnique({
      where: { userId_examId: { userId, examId } },
    });

    if (!attempt) return badRequest(res, 'Ujian belum dimulai.');
    if (attempt.status === 'submitted') return badRequest(res, 'Ujian sudah dikumpulkan.');

    const exam = await prisma.exam.findUnique({
      where: { id: examId },
      include: { questionBank: { include: { questions: { include: { options: true } } } } },
    });
    if (!exam) return notFound(res, 'Ujian tidak ditemukan.');

    const questions = exam.questionBank?.questions ?? [];
    const { score, totalQuestions, correctAnswers } = await calculateScore(userId, examId, questions);

    await prisma.examAttempt.update({
      where: { id: attempt.id },
      data: { status: 'submitted', finishedAt: new Date(), score },
    });

    return ok(res, { message: 'Ujian berhasil dikumpulkan.', score, totalQuestions, correctAnswers });
  } catch (e) { next(e); }
}

async function getResult(req, res, next) {
  try {
    const userId = req.user.id;
    const examId = +req.params.examId;

    const attempt = await prisma.examAttempt.findUnique({
      where: { userId_examId: { userId, examId } },
      include: { exam: { select: { title: true, subject: true } } },
    });

    if (!attempt || attempt.status !== 'submitted') {
      return notFound(res, 'Hasil ujian belum tersedia.');
    }

    return ok(res, {
      examId,
      examTitle: attempt.exam.title,
      subject: attempt.exam.subject,
      score: attempt.score,
      finishedAt: attempt.finishedAt,
      counterPelanggaran: attempt.counterPelanggaran,
    });
  } catch (e) { next(e); }
}

// ─── Helper ──────────────────────────────────────────────────────────────────
// Murni sinkron — tidak query DB sendiri. Attempt sudah di-batch di caller.
function formatExam(exam, attempt, withDetail = false) {
  const base = {
    id: exam.id,
    title: exam.title,
    subject: exam.subject,
    teacher: exam.teacher?.name,
    durationMinutes: exam.durationMinutes,
    startTime: exam.startTime,
    endTime: exam.endTime,
    room: exam.room,
    examCode: exam.examCode,
    status: exam.status,
    attemptStatus: attempt?.status ?? 'waiting',
    score: attempt?.score ?? null,
  };

  if (withDetail) {
    base.token = exam.token;
    base.startedAt = attempt?.startedAt ?? null;
    base.finishedAt = attempt?.finishedAt ?? null;
    base.counterPelanggaran = attempt?.counterPelanggaran ?? 0;
  }

  return base;
}

module.exports = { listExams, getExam, startExam, getTimer, submitExam, getResult };
