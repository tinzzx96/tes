const prisma = require('../../config/database');
const { ok, notFound, forbidden } = require('../../utils/response');

async function listTeacherExams(req, res, next) {
  try {
    const where = req.user.role === 'teacher' ? { teacherId: req.user.id } : {};
    const exams = await prisma.exam.findMany({
      where,
      include: {
        questionBank: { select: { id: true, name: true } },
        _count: { select: { attempts: true } },
      },
      orderBy: { startTime: 'desc' },
    });
    return ok(res, exams);
  } catch (e) { next(e); }
}

async function getTeacherExam(req, res, next) {
  try {
    const exam = await prisma.exam.findUnique({
      where: { id: +req.params.id },
      include: {
        questionBank: { include: { questions: { include: { options: true }, orderBy: { orderNum: 'asc' } } } },
        _count: { select: { attempts: true } },
      },
    });
    if (!exam) return notFound(res);
    if (req.user.role === 'teacher' && exam.teacherId !== req.user.id) return forbidden(res);
    return ok(res, exam);
  } catch (e) { next(e); }
}

module.exports = { listTeacherExams, getTeacherExam };
