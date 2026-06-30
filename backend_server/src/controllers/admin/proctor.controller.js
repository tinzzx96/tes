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
const { logActivity, ACTIONS } = require('../../utils/activityLog');

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

    await logActivity({
      user: req.user,
      action: ACTIONS.CREATE_USER,
      targetType: 'user',
      targetId: proctor.id,
      targetLabel: `${proctor.name} (proctor)`,
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

    await logActivity({
      user: req.user,
      action: ACTIONS.UPDATE_USER,
      targetType: 'user',
      targetId: updated.id,
      targetLabel: `${updated.name} (proctor)`,
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

    await logActivity({
      user: req.user,
      action: ACTIONS.DELETE_USER,
      targetType: 'user',
      targetId: proctor.id,
      targetLabel: `${proctor.name} (proctor)`,
    });

    return ok(res, null, 'Proktor dihapus.');
  } catch (e) { next(e); }
}

// ── List exam yang sesuai room proktor ────────────────────────────────────────
async function listProctorExams(req, res, next) {
  try {
    const userId = req.user.id;
    const user   = await prisma.user.findUnique({ where: { id: userId }, select: { room: true, roomId: true } });

    if (!user?.room) return ok(res, [], 'Proktor belum memiliki ruang yang ditugaskan.');

    const proctorRoomId = user.roomId;
    // Find all classes represented by students in this room
    const studentsInRoom = await prisma.user.findMany({
      where: { roomId: proctorRoomId, role: 'student' },
      select: { classId: true },
      distinct: ['classId'],
    });
    const classIds = studentsInRoom.map(s => s.classId).filter(Boolean);

    if (classIds.length === 0) {
      return ok(res, [], 'Tidak ada kelas yang terdaftar di ruangan ini.');
    }

    // List only exams that are assigned to any of these classIds
    const exams = await prisma.exam.findMany({
      where: {
        examClasses: {
          some: {
            classId: { in: classIds }
          }
        }
      },
      select: {
        id: true, title: true, subject: true,
        status: true, startTime: true, endTime: true,
        durationMinutes: true, token: true,
        teacher: { select: { name: true } },
        questionBank: {
          select: {
            questions: { select: { id: true } }
          }
        }
      },
      orderBy: { startTime: 'asc' },
    });

    return ok(res, exams.map(e => ({
      ...e,
      teacher: e.teacher?.name,
      proctorRoom: user.room,
      totalQuestions: e.questionBank?.questions?.length ?? 0,
    })));
  } catch (e) { next(e); }
}

// ── Monitoring: peserta ujian (filter by room proktor) ────────────────────────
async function getProctorParticipants(req, res, next) {
  try {
    const examId  = +req.params.examId;
    const userId  = req.user.id;
    const role    = req.user.role;

    const exam = await prisma.exam.findUnique({
      where: { id: examId },
      include: {
        questionBank: {
          select: {
            questions: { select: { id: true } }
          }
        }
      }
    });
    if (!exam) return notFound(res, 'Ujian tidak ditemukan.');

    let whereClause = { examId };

    // Proktor: filter peserta yang berada di ruangan yang sama dengan proktor
    if (role === 'proctor') {
      const proctor = await prisma.user.findUnique({ where: { id: userId }, select: { roomId: true } });
      if (!proctor?.roomId) {
        return forbidden(res, 'Kamu belum memiliki ruang yang ditugaskan untuk melakukan monitoring.');
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
        return forbidden(res, 'Kamu tidak memiliki akses untuk memonitor ujian ini.');
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

    const totalQ = exam.questionBank?.questions?.length ?? 40;

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
        progress:           a.status === 'submitted' ? totalQ : a.currentQuestion,
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
      exam:         { id: exam.id, title: exam.title, status: exam.status, totalQuestions: totalQ },
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

    // 4. Reset student device & exam attempt inside transaction
    let log;
    let attempt;
    await prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: userId },
        data: { device: null, verified: true },
      });

      attempt = await tx.examAttempt.findUnique({
        where: { userId_examId: { userId, examId } },
      });

      if (attempt) {
        await tx.examAttempt.update({
          where: { id: attempt.id },
          data: {
            status: 'started',
            finishedAt: null,
            score: null,
            unlockPin: null,
            counterPelanggaran: 0,
            currentQuestion: 1,
          },
        });
      } else {
        attempt = await tx.examAttempt.create({
          data: {
            userId,
            examId,
            status: 'started',
            startedAt: new Date(),
            finishedAt: null,
            score: null,
            unlockPin: null,
            counterPelanggaran: 0,
            currentQuestion: 1,
          },
        });
      }

      log = await tx.activityLog.create({
        data: {
          userId:      proctorId,
          actorName:   req.user?.name ?? 'Pengawas',
          actorRole:   role,
          action:      ACTIONS.RESET_STUDENT_SESSION,
          targetType:  'user',
          targetId:    userId,
          targetLabel: `Ujian: ${exam.title} untuk ${student.name}`,
        }
      });
    });

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
          progress: 1,
          isBlocked: false,
          counterPelanggaran: 0,
        });
      }
    }

    if (log) {
      try {
        if (io) {
          io.to('room:admin').emit('new-activity', log);
          io.to('room:admin').emit('global-activity-admin', log);
        }
      } catch (_) {}
    }

    return ok(res, null, 'Sesi siswa berhasil di-reset.');
  } catch (e) { next(e); }
}

const createRules = [
  body('name').trim().notEmpty().withMessage('Nama wajib diisi.'),
  body('nisn').trim().notEmpty().withMessage('NISN/NIP wajib diisi.'),
  body('roomId').isInt().withMessage('Ruang wajib dipilih.'),
];

// ── Reset Device ID Siswa (PRD Bagian 21: Reset Authority Pengawas) ───────────
// Pengawas/Admin dapat menghapus kunci device_id jika siswa mengalami
// kendala teknis nyata (HP rusak, dll) sehingga bisa pindah perangkat.
async function resetStudentDevice(req, res, next) {
  try {
    const examId    = +req.params.examId;
    const userId    = +req.params.userId;
    const proctorId = req.user.id;
    const role      = req.user.role;

    const student = await prisma.user.findUnique({ where: { id: userId } });
    if (!student) return notFound(res, 'Siswa tidak ditemukan.');

    // Proktor hanya bisa reset siswa di ruangannya sendiri
    if (role === 'proctor') {
      const proctor = await prisma.user.findUnique({ where: { id: proctorId }, select: { roomId: true } });
      if (!proctor?.roomId || proctor.roomId !== student.roomId) {
        return forbidden(res, 'Kamu hanya bisa me-reset device siswa di ruanganmu sendiri.');
      }
    }

    let log;
    await prisma.$transaction(async (tx) => {
      // 1. Hapus device dari profil user
      await tx.user.update({
        where: { id: userId },
        data: { device: null },
      });

      // 2. Hapus deviceId dari exam_attempt yang aktif
      await tx.examAttempt.updateMany({
        where: {
          userId,
          examId,
          status: { not: 'submitted' },
        },
        data: { deviceId: null },
      });

      // 3. Log aktivitas
      const exam = await tx.exam.findUnique({ where: { id: examId }, select: { title: true } });
      log = await tx.activityLog.create({
        data: {
          userId:      proctorId,
          actorName:   req.user?.name ?? 'Pengawas',
          actorRole:   role,
          action:      'RESET_DEVICE_LOCK',
          targetType:  'user',
          targetId:    userId,
          targetLabel: `Device siswa ${student.name} (Ujian: ${exam?.title ?? examId})`,
        },
      });
    });

    // Notify via WebSocket
    const { getIo } = require('../../socket');
    const io = getIo();
    if (io && log) {
      io.to('room:admin').emit('new-activity', log);
      io.to('room:admin').emit('global-activity-admin', log);
      if (student.room) {
        // Notify student device to show device-reset screen
        io.to(`room:${student.room}`).emit('device-reset', { studentId: `stu_${userId}` });
      }
    }

    return ok(res, null, 'Kunci device siswa berhasil dihapus. Siswa kini dapat login dari perangkat baru.');
  } catch (e) { next(e); }
}

module.exports = {
  listProctors, createProctor, updateProctor, deleteProctor,
  listProctorExams, getProctorParticipants, resetStudentSession, resetStudentDevice,
  createRules,
};
