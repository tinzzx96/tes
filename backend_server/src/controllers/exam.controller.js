// backend_server/src/controllers/exam.controller.js
// REPLACE FILE INI SEPENUHNYA
// Perubahan kunci: listExams sekarang filter via exam_classes berdasarkan
// class_id siswa + rentang waktu aktif + tingkat (grade) sesuai kelas siswa.

const prisma = require('../config/database');
const { ok, notFound, badRequest, forbidden } = require('../utils/response');
const { calculateScore } = require('../utils/scoring');

// ─── listExams: hanya tampilkan ujian yang class_id siswa terdaftar ────────────
async function listExams(req, res, next) {
  try {
    const userId = req.user.id;
    const now    = new Date();

    // Ambil data user termasuk class_id dan grade untuk validasi tingkat
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        classId: true,
        classRef: { select: { id: true, name: true, gradeId: true, grade: { select: { id: true, name: true } } } },
      },
    });

    // Fallback: jika siswa belum dipetakan ke class, gunakan logika lama (hari ini saja)
    if (!user?.classId) {
      const today    = new Date(); today.setHours(0, 0, 0, 0);
      const tomorrow = new Date(today); tomorrow.setDate(tomorrow.getDate() + 1);

      const [exams, attempts] = await Promise.all([
        prisma.exam.findMany({
          where: { startTime: { gte: today, lt: tomorrow }, status: { not: 'draft' } },
          include: { teacher: { select: { id: true, name: true } } },
          orderBy: { startTime: 'asc' },
        }),
        prisma.examAttempt.findMany({
          where: { userId },
          select: { examId: true, status: true, score: true, startedAt: true, finishedAt: true, counterPelanggaran: true },
        }),
      ]);
      const attemptMap = Object.fromEntries(attempts.map(a => [a.examId, a]));
      return ok(res, exams.map(e => formatExam(e, attemptMap[e.id])));
    }

    // ── Filter berdasarkan class_id siswa dan rentang waktu ──────────────────
    // Ambil ujian yang:
    // 1. Punya entri di exam_classes dengan class_id === siswa
    // 2. endTime masih di masa depan (ujian belum expired) ATAU startTime hari ini
    // 3. Status bukan draft
    const [examClasses, attempts] = await Promise.all([
      prisma.examClass.findMany({
        where: { 
          classId: user.classId,
          exam: {
            status: { not: 'draft' },
            endTime: { gte: now },
          }
        },
        include: {
          exam: {
            include: { teacher: { select: { id: true, name: true } } },
          },
        },
      }),
      prisma.examAttempt.findMany({
        where: { userId },
        select: { examId: true, status: true, score: true, startedAt: true, finishedAt: true, counterPelanggaran: true },
      }),
    ]);

    const attemptMap = Object.fromEntries(attempts.map(a => [a.examId, a]));

    // Filter hanya yang exam-nya valid (exam bisa null kalau filtered out oleh where di atas)
    const exams = examClasses
      .filter(ec => ec.exam !== null)
      .map(ec => ec.exam)
      .sort((a, b) => a.startTime - b.startTime);

    return ok(res, exams.map(e => formatExam(e, attemptMap[e.id])));
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

    // Validasi akses: class siswa harus terdaftar di exam_classes (jika ada mapping)
    const user = await prisma.user.findUnique({ where: { id: userId }, select: { classId: true } });
    if (user?.classId) {
      const hasAccess = await prisma.examClass.findFirst({
        where: { examId, classId: user.classId },
      });
      if (!hasAccess) return forbidden(res, 'Anda tidak memiliki akses ke ujian ini.');
    }

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
    // ── First-Device Lock: ambil device_id dari header (sudah divalidasi oleh checkDeviceLock)
    // Prioritas: x-device-id header → body.device_id → user.device
    const incomingDeviceId = req.headers['x-device-id']?.trim()
      || req.body?.device_id
      || req.user.device
      || null;

    const existing = await prisma.examAttempt.findUnique({
      where: { userId_examId: { userId, examId } },
    });

    if (existing?.status === 'submitted') {
      return badRequest(res, 'Ujian sudah dikumpulkan.');
    }

    let attempt;
    if (existing) {
      // PENTING: jangan overwrite deviceId yang sudah terkunci!
      // deviceId hanya bisa direset oleh proktor via /reset-device
      const updateData = {
        status: 'started',
        startedAt: existing.startedAt ?? new Date(),
        ipAddress: ip,
      };
      // Hanya set deviceId jika belum ada (first lock)
      if (!existing.deviceId && incomingDeviceId) {
        updateData.deviceId = incomingDeviceId;
      }

      attempt = await prisma.examAttempt.update({
        where: { id: existing.id },
        data: updateData,
      });
    } else {
      // Buat attempt baru — langsung kunci device_id
      attempt = await prisma.examAttempt.create({
        data: {
          userId,
          examId,
          status: 'started',
          startedAt: new Date(),
          ipAddress: ip,
          deviceId: incomingDeviceId, // First-Device Lock!
        },
      });
    }

    return ok(res, { attemptId: attempt.id, startedAt: attempt.startedAt });
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

    const now           = Date.now();
    const examEndMs     = exam.endTime.getTime();
    const startedAtMs   = attempt?.startedAt?.getTime() ?? now;
    const durationMs    = exam.durationMinutes * 60 * 1000;
    const attemptEndMs  = startedAtMs + durationMs;
    const effectiveEnd  = Math.min(examEndMs, attemptEndMs);
    const remainingSec  = Math.max(0, Math.round((effectiveEnd - now) / 1000));

    return ok(res, { 
      remainingSeconds: remainingSec, 
      endAt: new Date(effectiveEnd).toISOString(),
      startedAt: attempt?.startedAt ? attempt.startedAt.toISOString() : new Date(now).toISOString(),
      durationMinutes: exam.durationMinutes,
      counterPelanggaran: attempt?.counterPelanggaran || 0
    });
  } catch (e) { next(e); }
}

async function submitExam(req, res, next) {
  try {
    const userId = req.user.id;
    const examId = +req.params.examId;

    const attempt = await prisma.examAttempt.findUnique({ where: { userId_examId: { userId, examId } } });
    if (!attempt) return notFound(res, 'Attempt tidak ditemukan.');
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

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { room: true, roomId: true },
    });

    const { emitStudentStatusChanged } = require('../socket');
    if (user?.room) {
      emitStudentStatusChanged(user.room, {
        studentId: `stu_${userId}`,
        status: 'submitted',
        progress: questions.length,
        roomId: user.roomId,
      });
    }

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

// ─── Helper ───────────────────────────────────────────────────────────────────
function formatExam(exam, attempt, withDetail = false) {
  const base = {
    id: exam.id,
    title: exam.title,
    subject: exam.subject,
    teacher: exam.teacher?.name,
    durationMinutes: exam.durationMinutes,
    startTime: exam.startTime,
    endTime: exam.endTime,
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