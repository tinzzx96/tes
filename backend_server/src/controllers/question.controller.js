const prisma = require('../config/database');
const { ok, notFound, forbidden } = require('../utils/response');

async function getQuestions(req, res, next) {
  try {
    const userId = req.user.id;
    const examId = +req.params.examId;

    const [exam, attempt] = await Promise.all([
      prisma.exam.findUnique({
        where: { id: examId },
        include: { questionBank: { include: { questions: { include: { options: { orderBy: { orderNum: 'asc' } } }, orderBy: { orderNum: 'asc' } } } } },
      }),
      prisma.examAttempt.findUnique({ where: { userId_examId: { userId, examId } } }),
    ]);

    if (!exam) return notFound(res, 'Ujian tidak ditemukan.');
    if (!attempt || attempt.status === 'waiting') return forbidden(res, 'Ujian belum dimulai.');
    if (attempt.status === 'submitted') return forbidden(res, 'Ujian sudah dikumpulkan.');

    const answers = await prisma.answer.findMany({ where: { userId, examId } });
    const answerMap = Object.fromEntries(answers.map(a => [a.questionId, a]));

    const questions = (exam.questionBank?.questions ?? []).map(q => ({
      id: q.id,
      body: q.body,
      questionImage: q.questionImage,
      type: q.type,
      orderNum: q.orderNum,
      points: q.points,
      options: q.options.map(o => ({
        id: o.id,
        body: o.body,
        orderNum: o.orderNum,
      })),
      savedOptionId: answerMap[q.id]?.optionId ?? null,
      savedEssayAnswer: answerMap[q.id]?.essayAnswer ?? null,
    }));

    return ok(res, { questions, totalQuestions: questions.length });
  } catch (e) { next(e); }
}

module.exports = { getQuestions };
