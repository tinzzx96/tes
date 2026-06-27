// src/controllers/admin/proctor.controller.js
// ════════════════════════════════════════════════════════════════════════════
// Kelola akun Proktor/Pengawas.
// Proktor terikat ke satu room (tabel rooms).
// Endpoint: /api/admin/proctors
// ════════════════════════════════════════════════════════════════════════════

const prisma  = require('../../config/database');
const bcrypt  = require('bcryptjs');
const { ok, created, notFound, badRequest, forbidden } = require('../../utils/response');
const { body, validationResult } = require('express-validator');
const logger  = require('../../utils/logger');

// ── List semua proktor ────────────────────────────────────────────────────────
async function listProctors(req, res, next) {
  try {
    const proctors = await prisma.user.findMany({
      where: { role: 'proctor' },
      select: {
        id: true, name: true, nisn: true,
        room: true, roomId: true, verified: true,
        createdAt: true,
      },
      orderBy: { name: 'asc' },
    });
    return ok(res, proctors);
  } catch (e) { next(e); }
}

// ── Buat proktor baru ─────────────────────────────────────────────────────────
async function createProctor(req, res, next) {
  try {
    const errs = validationResult(req);
    if (!errs.isEmpty()) return badRequest(res, 'Validasi gagal.', errs.array());

    const { name, nisn, password, roomId } = req.body;

    const exists = await prisma.user.findUnique({ where: { nisn } });
    if (exists) return badRequest(res, `NISN/NIP ${nisn} sudah terdaftar.`);

    let roomName = null;
    if (roomId) {
      const rm = await prisma.room.findUnique({ where: { id: Number(roomId) } });
      if (rm) roomName = rm.name;
    }

    const hashed = await bcrypt.hash(password || 'proktor123', 12);
    const proctor = await prisma.user.create({
      data: {
        name,
        nisn,
        password: hashed,
        role: 'proctor',
        roomId: roomId ? Number(roomId) : null,
        room: roomName,
        verified: true,
      },
      select: { id: true, name: true, nisn: true, roomId: true, room: true, verified: true },
    });
    return created(res, proctor, 'Akun proktor berhasil dibuat.');
  } catch (e) { next(e); }
}

// ── Update proktor ────────────────────────────────────────────────────────────
async function updateProctor(req, res, next) {
  try {
    const proctor = await prisma.user.findUnique({ where: { id: +req.params.id } });
    if (!proctor || proctor.role !== 'proctor') return notFound(res, 'Proktor tidak ditemukan.');

    const { name, roomId, password, verified } = req.body;
    const data = {};
    if (name     !== undefined) data.name     = name;
    if (verified !== undefined) data.verified = verified;
    if (password) data.password = await bcrypt.hash(password, 12);

    if (roomId !== undefined) {
      data.roomId = roomId ? Number(roomId) : null;
      if (roomId) {
        const rm = await prisma.room.findUnique({ where: { id: Number(roomId) } });
        data.room = rm ? rm.name : null;
      } else {
        data.room = null;
      }
    }

    const updated = await prisma.user.update({
      where: { id: +req.params.id },
      data,
      select: { id: true, name: true, nisn: true, roomId: true, room: true, verified: true },
    });
    return ok(res, updated, 'Proktor diperbarui.');
  } catch (e) { next(e); }
}

// ── Hapus proktor ─────────────────────────────────────────────────────────────
async function deleteProctor(req, res, next) {
  try {
    const proctor = await prisma.user.findUnique({ where: { id: +req.params.id } });
    if (!proctor || proctor.role !== 'proctor') return notFound(res, 'Proktor tidak ditemukan.');

    await prisma.user.delete({ where: { id: +req.params.id } });
    return ok(res, null, 'Proktor dihapus.');
  } catch (e) { next(e); }
}

// ── List exam yang sesuai room proktor ────────────────────────────────────────
async function listProctorExams(req, res, next) {
  try {
    const userId = req.user.id;
    const user   = await prisma.user.findUnique({ where: { id: userId }, select: { room: true, roomId: true } });

    if (!user?.room) return ok(res, [], 'Proktor belum memiliki ruang yang ditugaskan.');

    // List all exams because they are no longer restricted to a specific room at creation time
    const exams = await prisma.exam.findMany({
      select: {
        id: true, title: true, subject: true,
        status: true, startTime: true, endTime: true,
        durationMinutes: true, token: true,
        teacher: { select: { name: true } },
      },
      orderBy: { startTime: 'asc' },
    });

    return ok(res, exams.map(e => ({
      ...e,
      teacher: e.teacher?.name,
      proctorRoom: user.room,
    })));
  } catch (e) { next(e); }
}

// ── Monitoring: peserta ujian (filter by room proktor) ────────────────────────
async function getProctorParticipants(req, res, next) {
  try {
    const examId  = +req.params.examId;
    const userId  = req.user.id;
    const role    = req.user.role;

    const exam = await prisma.exam.findUnique({ where: { id: examId } });
    if (!exam) return notFound(res, 'Ujian tidak ditemukan.');

    let whereClause = { examId };

    // Proktor: filter peserta yang berada di ruangan yang sama dengan proktor
    if (role === 'proctor') {
      const proctor = await prisma.user.findUnique({ where: { id: userId }, select: { roomId: true } });
      if (!proctor?.roomId) {
        return forbidden(res, 'Kamu belum memiliki ruang yang ditugaskan untuk melakukan monitoring.');
      }
      whereClause.user = { roomId: proctor.roomId };
    }

    const OFFLINE_MS = 90_000;
    const now        = Date.now();

    const attempts = await prisma.examAttempt.findMany({
      where: whereClause,
      include: {
        user:    { select: { id: true, name: true, nisn: true, class: true, room: true, roomId: true, device: true } },
        answers: { select: { id: true } },
      },
      orderBy: { user: { name: 'asc' } },
    });

    const participants = attempts.map(a => {
      const msSince   = now - a.updatedAt.getTime();
      const isOffline = a.status === 'started' && msSince > OFFLINE_MS;
      return {
        userId:             `stu_${a.user.id}`,
        name:               a.user.name,
        nisn:               a.user.nisn,
        class:              a.user.class,
        room:               a.user.room,
        device:             a.user.device,
        status:             a.status === 'submitted' ? 'submitted'
                          : isOffline                ? 'offline'
                          : a.status === 'started'   ? 'online'
                          : 'not_logged_in',
        progress:           a.answers.length,
        counterPelanggaran: a.counterPelanggaran,
        isBlocked:          !!(a.unlockPin && a.status === 'started'),
        unlockPin:          a.unlockPin,
        examAttemptId:      a.id,
        lastSeen:           a.updatedAt.toISOString(),
        score:              a.score,
      };
    });

    const summary = {
      total:     participants.length,
      online:    participants.filter(p => p.status === 'online').length,
      offline:   participants.filter(p => p.status === 'offline').length,
      submitted: participants.filter(p => p.status === 'submitted').length,
      waiting:   participants.filter(p => p.status === 'not_logged_in').length,
      blocked:   participants.filter(p => p.isBlocked).length,
    };

    return ok(res, {
      exam:         { id: exam.id, title: exam.title, status: exam.status },
      participants,
      summary,
    });
  } catch (e) { next(e); }
}

async function resetStudentSession(req, res, next) {
  try {
    const examId = +req.params.examId;
    const userId = +req.params.userId;
    const proctorId = req.user.id;
    const role = req.user.role;

    // 1. Verify exam exists
    const exam = await prisma.exam.findUnique({ where: { id: examId } });
    if (!exam) return notFound(res, 'Ujian tidak ditemukan.');

    // 2. Find the student
    const student = await prisma.user.findUnique({ where: { id: userId } });
    if (!student) return notFound(res, 'Siswa tidak ditemukan.');

    // 3. If user is proctor, verify student is in proctor's room
    if (role === 'proctor') {
      const proctor = await prisma.user.findUnique({ where: { id: proctorId }, select: { roomId: true } });
      if (!proctor?.roomId || proctor.roomId !== student.roomId) {
        return forbidden(res, 'Kamu hanya bisa me-reset siswa di ruanganmu sendiri.');
      }
    }

    // 4. Reset student device
    await prisma.user.update({
      where: { id: userId },
      data: { device: null, verified: true },
    });

    // 5. Reset exam attempt for this specific exam
    const attempt = await prisma.examAttempt.findUnique({
      where: { userId_examId: { userId, examId } },
    });

    if (attempt) {
      await prisma.examAttempt.update({
        where: { id: attempt.id },
        data: {
          status: 'started',
          finishedAt: null,
          score: null,
          unlockPin: null,
          counterPelanggaran: 0,
        },
      });
    } else {
      await prisma.examAttempt.create({
        data: {
          userId,
          examId,
          status: 'started',
          startedAt: new Date(),
          finishedAt: null,
          score: null,
          unlockPin: null,
          counterPelanggaran: 0,
        },
      });
    }

    // Audit Log for Reset Sesi murid
    logger.info(`[AUDIT] Proctor ID: ${proctorId} reset student session for NISN: ${student.nisn} (Student ID: ${userId}) on Exam ID: ${examId}`);

    // 6. Emit real-time WebSocket events
    const { getIo, emitStudentStatusChanged } = require('../../socket');
    const io = getIo();
    if (io) {
      const roomName = student.room;
      if (roomName) {
        // Emit to the room to notify the student device to reload their exam list/status
        io.to(`room:${roomName}`).emit('student-reset', { studentId: `stu_${userId}` });
        
        // Emit status update to the proctor monitoring UI
        emitStudentStatusChanged(roomName, {
          studentId: `stu_${userId}`,
          status: 'online',
          progress: attempt ? await prisma.answer.count({ where: { attemptId: attempt.id } }) : 0,
          isBlocked: false,
          counterPelanggaran: 0,
        });
      }
    }

    return ok(res, null, 'Sesi siswa berhasil di-reset.');
  } catch (e) { next(e); }
}

const createRules = [
  body('name').trim().notEmpty().withMessage('Nama wajib diisi.'),
  body('nisn').trim().notEmpty().withMessage('NISN/NIP wajib diisi.'),
  body('roomId').isInt().withMessage('Ruang wajib dipilih.'),
];

module.exports = {
  listProctors, createProctor, updateProctor, deleteProctor,
  listProctorExams, getProctorParticipants, resetStudentSession,
  createRules,
};
