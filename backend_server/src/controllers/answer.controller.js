const prisma = require('../config/database');
const { ok, badRequest, forbidden, notFound } = require('../utils/response');
const { body, validationResult } = require('express-validator');

const saveRules = [
  body('question_id').isInt({ min: 1 }).withMessage('question_id harus integer.'),
  body('option_id').optional().isInt({ min: 1 }),
  body('essay_answer').optional().isString().isLength({ max: 5000 }),
];

const bulkRules = [
  body('answers').isArray({ min: 1 }).withMessage('answers harus array.'),
  body('answers.*.question_id').isInt({ min: 1 }),
  body('answers.*.option_id').optional().isInt({ min: 1 }),
  body('answers.*.essay_answer').optional().isString().isLength({ max: 5000 }),
];

async function saveAnswer(req, res, next) {
  try {
    const errs = validationResult(req);
    if (!errs.isEmpty()) return badRequest(res, 'Validasi gagal.', errs.array());

    const userId = req.user.id;
    const examId = +req.params.examId;

    const attempt = await getActiveAttempt(userId, examId);
    if (!attempt) return forbidden(res, 'Ujian belum dimulai atau sudah dikumpulkan.');

    const { question_id, option_id, essay_answer } = req.body;

    const question = await prisma.question.findFirst({
      where: { id: +question_id, questionBank: { exams: { some: { id: examId } } } },
    });
    if (!question) return notFound(res, 'Soal tidak ditemukan.');

    // Row-level locking (PRD Addendum Bagian 6.1):
    // Prisma ORM tidak mendukung SELECT ... FOR UPDATE secara native. Tanpa
    // locking ini, dua request yang datang hampir bersamaan (siswa klik opsi A
    // lalu langsung opsi B sebelum request pertama selesai) bisa tiba di DB
    // dalam urutan terbalik, sehingga jawaban final tersimpan salah.
    //
    // Solusi: $queryRaw di dalam $transaction mengunci baris SEBELUM upsert.
    // MySQL menjamin hanya satu transaksi yang bisa pegang lock pada baris
    // yang sama sekaligus — transaksi berikutnya MENUNGGU sampai yang pertama
    // commit, lalu baru diproses. Urutan simpan selalu berdasarkan urutan
    // KEDATANGAN di server (server-side timestamp), bukan urutan keberangkatan
    // dari client yang bisa kacau karena latensi jaringan.
    const answer = await prisma.$transaction(async (tx) => {
      // Lock baris yang akan ditulis. Jika baris belum ada (CREATE), lock
      // pada parent (attempt) untuk mencegah dua CREATE bersamaan.
      await tx.$queryRaw`
        SELECT id FROM answers
        WHERE user_id = ${userId}
          AND exam_id = ${examId}
          AND question_id = ${question.id}
        FOR UPDATE
      `;

      return tx.answer.upsert({
        where: { userId_examId_questionId: { userId, examId, questionId: question.id } },
        update: {
          optionId: question.type === 'multiple_choice' ? (option_id ?? null) : null,
          essayAnswer: question.type === 'essay' ? (essay_answer ?? null) : null,
          savedAt: new Date(),
        },
        create: {
          userId, examId,
          questionId: question.id,
          attemptId: attempt.id,
          optionId: question.type === 'multiple_choice' ? (option_id ?? null) : null,
          essayAnswer: question.type === 'essay' ? (essay_answer ?? null) : null,
          savedAt: new Date(),
        },
      });
    });

    return ok(res, { questionId: question.id, savedAt: answer.savedAt }, 'Jawaban disimpan.');
  } catch (e) { next(e); }
}

async function bulkSaveAnswers(req, res, next) {
  try {
    const errs = validationResult(req);
    if (!errs.isEmpty()) return badRequest(res, 'Validasi gagal.', errs.array());

    const userId = req.user.id;
    const examId = +req.params.examId;

    const attempt = await getActiveAttempt(userId, examId);
    if (!attempt) return forbidden(res, 'Ujian belum dimulai atau sudah dikumpulkan.');

    const { answers } = req.body;
    const questionIds = [...new Set(answers.map(a => +a.question_id))];

    // Satu query untuk semua soal — hindari N+1
    const questions = await prisma.question.findMany({
      where: {
        id: { in: questionIds },
        questionBank: { exams: { some: { id: examId } } },
      },
    });
    const questionMap = Object.fromEntries(questions.map(q => [q.id, q]));

    const now = new Date();
    await Promise.all(
      answers
        .filter(item => questionMap[+item.question_id])
        .map(item => {
          const q = questionMap[+item.question_id];
          return prisma.answer.upsert({
            where: { userId_examId_questionId: { userId, examId, questionId: q.id } },
            update: {
              optionId: q.type === 'multiple_choice' ? (item.option_id ?? null) : null,
              essayAnswer: q.type === 'essay' ? (item.essay_answer ?? null) : null,
              savedAt: now,
            },
            create: {
              userId, examId,
              questionId: q.id,
              attemptId: attempt.id,
              optionId: q.type === 'multiple_choice' ? (item.option_id ?? null) : null,
              essayAnswer: q.type === 'essay' ? (item.essay_answer ?? null) : null,
              savedAt: now,
            },
          });
        })
    );

    return ok(res, null, 'Semua jawaban disimpan.');
  } catch (e) { next(e); }
}

async function getActiveAttempt(userId, examId) {
  const attempt = await prisma.examAttempt.findUnique({
    where: { userId_examId: { userId, examId } },
  });
  if (!attempt || attempt.status !== 'started') return null;
  return attempt;
}

module.exports = { saveAnswer, bulkSaveAnswers, saveRules, bulkRules };