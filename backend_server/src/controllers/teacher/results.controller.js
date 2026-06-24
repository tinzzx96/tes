const prisma = require('../../config/database');
const { ok, notFound, forbidden } = require('../../utils/response');

async function getResults(req, res, next) {
  try {
    const examId = +req.params.id;
    const user = req.user;

    const exam = await prisma.exam.findUnique({
      where: { id: examId },
      include: { teacher: { select: { id: true, name: true } } },
    });
    if (!exam) return notFound(res);

    if (user.role === 'teacher' && exam.teacherId !== user.id) {
      return forbidden(res, 'Anda tidak memiliki akses ke ujian ini.');
    }

    const attempts = await prisma.examAttempt.findMany({
      where: { examId, status: 'submitted' },
      include: { user: { select: { id: true, name: true, nisn: true, class: true, room: true } } },
      orderBy: { score: 'desc' },
    });

    const results = attempts.map((a, i) => ({
      rank: i + 1,
      studentId: a.user.id,
      name: a.user.name,
      nisn: a.user.nisn,
      class: a.user.class,
      room: a.user.room,
      score: a.score,
      counterPelanggaran: a.counterPelanggaran,
      finishedAt: a.finishedAt,
    }));

    const scores = results.map(r => r.score ?? 0);
    return ok(res, {
      exam: { id: exam.id, title: exam.title, subject: exam.subject, teacher: exam.teacher?.name },
      results,
      summary: {
        totalParticipants: results.length,
        averageScore: scores.length ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length * 100) / 100 : 0,
        highestScore: scores.length ? Math.max(...scores) : 0,
        lowestScore: scores.length ? Math.min(...scores) : 0,
      },
    });
  } catch (e) { next(e); }
}

async function exportResultsCsv(req, res, next) {
  try {
    const examId = +req.params.id;
    const user = req.user;

    const exam = await prisma.exam.findUnique({ where: { id: examId } });
    if (!exam) return notFound(res);
    if (user.role === 'teacher' && exam.teacherId !== user.id) return forbidden(res);

    const attempts = await prisma.examAttempt.findMany({
      where: { examId, status: 'submitted' },
      include: { user: { select: { name: true, nisn: true, class: true, room: true } } },
      orderBy: { score: 'desc' },
    });

    const header = 'No,Nama,NISN,Kelas,Ruang,Skor,Pelanggaran,Waktu Selesai\n';
    const rows = attempts.map((a, i) =>
      [i + 1, `"${a.user.name}"`, a.user.nisn, a.user.class, a.user.room,
       a.score ?? 0, a.counterPelanggaran, a.finishedAt?.toISOString() ?? ''].join(',')
    ).join('\n');

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="hasil_${exam.examCode}.csv"`);
    return res.send('\uFEFF' + header + rows); // BOM untuk Excel
  } catch (e) { next(e); }
}

module.exports = { getResults, exportResultsCsv };
