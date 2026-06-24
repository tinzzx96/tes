// src/controllers/admin/proctor.controller.js
// ════════════════════════════════════════════════════════════════════════════
// Kelola akun Proktor/Pengawas.
// Proktor terikat ke satu room (field `room` di tabel users).
// Endpoint: /api/admin/proctors
// ════════════════════════════════════════════════════════════════════════════

const prisma  = require('../../config/database');
const bcrypt  = require('bcryptjs');
const { ok, created, notFound, badRequest, forbidden } = require('../../utils/response');
const { body, validationResult } = require('express-validator');

// ── List semua proktor ────────────────────────────────────────────────────────
async function listProctors(req, res, next) {
  try {
    const proctors = await prisma.user.findMany({
      where: { role: 'proctor' },
      select: {
        id: true, name: true, nisn: true,
        room: true, verified: true,
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

    const { name, nisn, password, room } = req.body;

    const exists = await prisma.user.findUnique({ where: { nisn } });
    if (exists) return badRequest(res, `NISN/NIP ${nisn} sudah terdaftar.`);

    const hashed = await bcrypt.hash(password || 'proktor123', 12);
    const proctor = await prisma.user.create({
      data: { name, nisn, password: hashed, role: 'proctor', room, verified: true },
      select: { id: true, name: true, nisn: true, room: true, verified: true },
    });
    return created(res, proctor, 'Akun proktor berhasil dibuat.');
  } catch (e) { next(e); }
}

// ── Update proktor ────────────────────────────────────────────────────────────
async function updateProctor(req, res, next) {
  try {
    const proctor = await prisma.user.findUnique({ where: { id: +req.params.id } });
    if (!proctor || proctor.role !== 'proctor') return notFound(res, 'Proktor tidak ditemukan.');

    const { name, room, password, verified } = req.body;
    const data = {};
    if (name     !== undefined) data.name     = name;
    if (room     !== undefined) data.room     = room;
    if (verified !== undefined) data.verified = verified;
    if (password) data.password = await bcrypt.hash(password, 12);

    const updated = await prisma.user.update({
      where: { id: +req.params.id }, data,
      select: { id: true, name: true, nisn: true, room: true, verified: true },
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
// Proktor hanya bisa lihat ujian yang room-nya sama dengan room dia.
async function listProctorExams(req, res, next) {
  try {
    const userId = req.user.id;
    const user   = await prisma.user.findUnique({ where: { id: userId }, select: { room: true } });

    if (!user?.room) return ok(res, [], 'Proktor belum memiliki ruang yang ditugaskan.');

    const exams = await prisma.exam.findMany({
      where: { room: user.room },
      select: {
        id: true, title: true, subject: true,
        room: true, status: true, startTime: true, endTime: true,
        durationMinutes: true,
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
// Override getParticipants — proktor hanya lihat peserta di ruangnya.
async function getProctorParticipants(req, res, next) {
  try {
    const examId  = +req.params.examId;
    const userId  = req.user.id;
    const role    = req.user.role;

    const exam = await prisma.exam.findUnique({ where: { id: examId } });
    if (!exam) return notFound(res, 'Ujian tidak ditemukan.');

    // Proktor: validasi room ujian === room proktor
    if (role === 'proctor') {
      const proctor = await prisma.user.findUnique({ where: { id: userId }, select: { room: true } });
      if (!proctor?.room || proctor.room !== exam.room) {
        return forbidden(res, `Kamu hanya bisa monitoring ruang ${proctor?.room || '(belum diset)'}. Ujian ini ada di ruang ${exam.room}.`);
      }
    }

    const OFFLINE_MS = 90_000;
    const now        = Date.now();

    const attempts = await prisma.examAttempt.findMany({
      where: { examId },
      include: {
        user:    { select: { id: true, name: true, nisn: true, class: true, room: true, device: true } },
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
      exam:         { id: exam.id, title: exam.title, room: exam.room, status: exam.status },
      participants,
      summary,
    });
  } catch (e) { next(e); }
}

const createRules = [
  body('name').trim().notEmpty().withMessage('Nama wajib diisi.'),
  body('nisn').trim().notEmpty().withMessage('NISN/NIP wajib diisi.'),
  body('room').trim().notEmpty().withMessage('Ruang wajib diisi.'),
];

module.exports = {
  listProctors, createProctor, updateProctor, deleteProctor,
  listProctorExams, getProctorParticipants,
  createRules,
};
