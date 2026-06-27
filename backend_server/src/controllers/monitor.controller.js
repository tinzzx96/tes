const prisma = require('../config/database');
const { ok, notFound, forbidden, badRequest } = require('../utils/response');
const { emitStudentStatusChanged } = require('../socket');
const { body, validationResult } = require('express-validator');

const OFFLINE_THRESHOLD_MS = 90_000;

/**
 * POST /api/monitor/heartbeat
 * Dikirim siswa setiap 30 detik (PRD §32).
 * Jika siswa sebelumnya offline, emit student-status-changed ke room pengawas.
 */
async function heartbeat(req, res, next) {
  try {
    const errs = validationResult(req);
    if (!errs.isEmpty()) return badRequest(res, 'Validasi gagal.', errs.array());

    const userId = req.user.id;
    const { examAttemptId, device } = req.body;

    const [attempt] = await Promise.all([
      prisma.examAttempt.findUnique({
        where: { id: +examAttemptId },
        include: { user: { select: { id: true, room: true } } },
      }),
      device ? prisma.user.update({ where: { id: userId }, data: { device } }) : Promise.resolve(),
    ]);

    if (!attempt || attempt.userId !== userId || attempt.status !== 'started') {
      return ok(res, { received: false });
    }

    const wasOffline = Date.now() - attempt.updatedAt.getTime() > OFFLINE_THRESHOLD_MS;

    await prisma.examAttempt.update({
      where: { id: attempt.id },
      data: { updatedAt: new Date() },
    });

    // Emit student-status-changed saat siswa kembali online setelah offline
    if (wasOffline) {
      const roomName = attempt.user?.room;
      if (roomName) {
        emitStudentStatusChanged(roomName, {
          studentId: `stu_${userId}`,
          status: 'online',
        });
      }
    }

    return ok(res, {
      received: true,
      serverTime: new Date().toISOString(),
      counterPelanggaran: attempt.counterPelanggaran,
    });
  } catch (e) { next(e); }
}

/**
 * GET /api/monitor/exam/:examId/participants
 * Fallback REST untuk dashboard pengawas (student-status-changed via WebSocket adalah utama).
 */
async function getParticipants(req, res, next) {
  try {
    const examId = +req.params.examId;
    const exam = await prisma.exam.findUnique({ where: { id: examId } });
    if (!exam) return notFound(res, 'Ujian tidak ditemukan.');

    if (req.user.role === 'teacher' && exam.teacherId !== req.user.id) {
      return forbidden(res, 'Akses ditolak.');
    }

    const attempts = await prisma.examAttempt.findMany({
      where: { examId },
      include: {
        user: { select: { id: true, name: true, nisn: true, class: true, room: true, roomId: true, device: true } },
        answers: { select: { id: true } },
      },
      orderBy: { user: { name: 'asc' } },
    });

    const now = Date.now();
    const participants = attempts.map(a => {
      const msSince = now - a.updatedAt.getTime();
      const isOffline = a.status === 'started' && msSince > OFFLINE_THRESHOLD_MS;
      return {
        userId: `stu_${a.user.id}`,
        name: a.user.name,
        nisn: a.user.nisn,
        class: a.user.class,
        room: a.user.room,
        roomId: a.user.roomId,
        device: a.user.device,
        status: a.status === 'submitted' ? 'submitted' : isOffline ? 'offline' : a.status === 'started' ? 'online' : 'not_logged_in',
        progress: a.answers.length,
        counterPelanggaran: a.counterPelanggaran,
        isBlocked: !!(a.unlockPin && a.status === 'started'),
        lastSeen: a.updatedAt.toISOString(),
        score: a.score,
        finishedAt: a.finishedAt,
      };
    });

    const summary = {
      total: participants.length,
      online: participants.filter(p => p.status === 'online').length,
      offline: participants.filter(p => p.status === 'offline').length,
      submitted: participants.filter(p => p.status === 'submitted').length,
      waiting: participants.filter(p => p.status === 'not_logged_in').length,
      blocked: participants.filter(p => p.isBlocked).length,
    };

    return ok(res, { exam: { id: exam.id, title: exam.title, status: exam.status }, participants, summary });
  } catch (e) { next(e); }
}

const heartbeatRules = [
  body('examAttemptId').isInt({ min: 1 }).withMessage('examAttemptId wajib diisi.'),
];

module.exports = { heartbeat, getParticipants, heartbeatRules };
