const prisma = require('../config/database');
const { ok, notFound, forbidden } = require('../utils/response');

// Seeded pseudo-random number generator (Mulberry32)
function seededRandom(seed) {
  let h = 0;
  for (let i = 0; i < seed.length; i++) {
    h = Math.imul(31, h) + seed.charCodeAt(i) | 0;
  }
  return function() {
    let t = h += 0x6D2B79F5;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
}

// Seeded shuffle function
function seededShuffle(array, seed) {
  const rand = seededRandom(seed);
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

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

    const baseQuestions = (exam.questionBank?.questions ?? []).map(q => ({
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

    // Randomize order of questions deterministically per-student per-exam
    const seed = `${userId}-${examId}`;
    const shuffledQuestions = seededShuffle(baseQuestions, seed).map((q, idx) => ({
      ...q,
      orderNum: idx + 1 // update orderNum to match the randomized index (1-based)
    }));

    return ok(res, { questions: shuffledQuestions, totalQuestions: shuffledQuestions.length });
  } catch (e) { next(e); }
}

module.exports = { getQuestions };
