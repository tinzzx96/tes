const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const sharp = require('sharp');
const prisma = require('../../config/database');
const { ok, created, notFound, badRequest } = require('../../utils/response');
const { body, validationResult } = require('express-validator');

async function listQuestions(req, res, next) {
  try {
    const bankId = +req.params.bankId;
    const bank = await prisma.questionBank.findUnique({ where: { id: bankId } });
    if (!bank) return notFound(res, 'Bank soal tidak ditemukan.');

    const questions = await prisma.question.findMany({
      where: { questionBankId: bankId },
      include: { options: { orderBy: { orderNum: 'asc' } } },
      orderBy: { orderNum: 'asc' },
    });
    return ok(res, questions);
  } catch (e) { next(e); }
}

async function createQuestion(req, res, next) {
  try {
    const errs = validationResult(req);
    if (!errs.isEmpty()) return badRequest(res, 'Validasi gagal.', errs.array());

    const bankId = +req.params.bankId;
    const bank = await prisma.questionBank.findUnique({ where: { id: bankId } });
    if (!bank) return notFound(res, 'Bank soal tidak ditemukan.');

    const { body: qBody, type, points, question_image, options } = req.body;

    const lastOrder = await prisma.question.aggregate({ where: { questionBankId: bankId }, _max: { orderNum: true } });
    const orderNum = (lastOrder._max.orderNum ?? 0) + 1;

    const question = await prisma.question.create({
      data: {
        questionBankId: bankId,
        body: qBody,
        type: type ?? 'multiple_choice',
        points: points ?? 1,
        orderNum,
        questionImage: question_image ?? null,
        options: type !== 'essay' && options ? {
          create: options.map((o, i) => ({ body: o.body, isCorrect: !!o.is_correct, orderNum: i + 1 })),
        } : undefined,
      },
      include: { options: true },
    });
    return created(res, question, 'Soal berhasil dibuat.');
  } catch (e) { next(e); }
}

async function updateQuestion(req, res, next) {
  try {
    const errs = validationResult(req);
    if (!errs.isEmpty()) return badRequest(res, 'Validasi gagal.', errs.array());

    const { body: qBody, points, question_image } = req.body;
    const data = {};
    if (qBody !== undefined) data.body = qBody;
    if (points !== undefined) data.points = +points;
    if (question_image !== undefined) data.questionImage = question_image;

    const question = await prisma.question.update({
      where: { id: +req.params.id },
      data,
      include: { options: { orderBy: { orderNum: 'asc' } } },
    });
    return ok(res, question, 'Soal diperbarui.');
  } catch (e) { next(e); }
}

async function deleteQuestion(req, res, next) {
  try {
    const q = await prisma.question.findUnique({
      where: { id: +req.params.id },
      include: { options: true },
    });
    if (!q) return notFound(res);

    const uploadDir = path.resolve(process.env.UPLOAD_DIR || 'uploads/questions');

    // Hapus file gambar jika ada
    if (q.questionImage) {
      const filePath = path.join(uploadDir, q.questionImage);
      if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    }

    // Hapus file gambar opsi jika ada
    for (const opt of q.options) {
      if (opt.body && opt.body.includes('[IMAGE:')) {
        const match = opt.body.match(/\[IMAGE:(.+?)\]/);
        if (match) {
          const filePath = path.join(uploadDir, match[1]);
          if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
        }
      }
    }

    await prisma.question.delete({ where: { id: +req.params.id } });
    return ok(res, null, 'Soal dihapus.');
  } catch (e) { next(e); }
}

// ── Option CRUD ───────────────────────────────────────────────────────────────

async function addOption(req, res, next) {
  try {
    const errs = validationResult(req);
    if (!errs.isEmpty()) return badRequest(res, 'Validasi gagal.', errs.array());

    const questionId = +req.params.questionId;
    const { body: oBody, is_correct } = req.body;

    const lastOrder = await prisma.option.aggregate({ where: { questionId }, _max: { orderNum: true } });
    const orderNum = (lastOrder._max.orderNum ?? 0) + 1;

    const option = await prisma.option.create({
      data: { questionId, body: oBody, isCorrect: !!is_correct, orderNum },
    });
    return created(res, option, 'Opsi ditambahkan.');
  } catch (e) { next(e); }
}

async function updateOption(req, res, next) {
  try {
    const errs = validationResult(req);
    if (!errs.isEmpty()) return badRequest(res, 'Validasi gagal.', errs.array());

    const { body: oBody, is_correct } = req.body;
    const data = {};
    if (oBody !== undefined) data.body = oBody;
    if (is_correct !== undefined) data.isCorrect = !!is_correct;

    const option = await prisma.option.update({ where: { id: +req.params.id }, data });
    return ok(res, option, 'Opsi diperbarui.');
  } catch (e) { next(e); }
}

async function deleteOption(req, res, next) {
  try {
    const opt = await prisma.option.findUnique({ where: { id: +req.params.id } });
    if (opt && opt.body && opt.body.includes('[IMAGE:')) {
      const match = opt.body.match(/\[IMAGE:(.+?)\]/);
      if (match) {
        const filePath = path.join(path.resolve(process.env.UPLOAD_DIR || 'uploads/questions'), match[1]);
        if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
      }
    }

    await prisma.option.delete({ where: { id: +req.params.id } });
    return ok(res, null, 'Opsi dihapus.');
  } catch (e) { next(e); }
}

/**
 * POST /api/admin/question-banks/:bankId/questions/upload-image
 * Upload gambar soal. Kompres ke WebP (max 800px, quality 80) sebelum simpan ke disk.
 * Hanya simpan filename — TIDAK PERNAH base64.
 */
async function uploadQuestionImage(req, res, next) {
  try {
    if (!req.file) return badRequest(res, 'File gambar tidak ditemukan.');

    const hash = crypto.randomBytes(8).toString('hex');
    const filename = `soal_${Date.now()}_${hash}.webp`;
    const uploadDir = path.resolve(process.env.UPLOAD_DIR || 'uploads/questions');
    const outputPath = path.join(uploadDir, filename);

    // Kompres ke WebP: resize max 800px lebar, quality 80 (PRD Addendum Bagian 47 §4)
    await sharp(req.file.buffer)
      .resize({ width: 800, withoutEnlargement: true })
      .webp({ quality: 80 })
      .toFile(outputPath);

    return ok(res, { filename }, 'Gambar berhasil diupload.');
  } catch (e) { next(e); }
}

const createRules = [
  body('body').trim().notEmpty().withMessage('Isi soal wajib diisi.'),
  body('type').optional().isIn(['multiple_choice', 'essay']),
  body('points').optional().isInt({ min: 1 }),
  body('question_image').optional().isString().isLength({ max: 255 })
    .withMessage('question_image harus berupa nama file, bukan base64.'),
  body('options').optional().isArray({ min: 2 }),
  body('options.*.body').optional().notEmpty(),
  body('options.*.is_correct').optional().isBoolean(),
];

const updateRules = [
  body('body').optional().trim().notEmpty(),
  body('points').optional().isInt({ min: 1 }),
  body('question_image').optional().isString().isLength({ max: 255 }),
];

const optionRules = [
  body('body').trim().notEmpty().withMessage('Isi opsi wajib diisi.'),
  body('is_correct').isBoolean().withMessage('is_correct harus boolean.'),
];

module.exports = {
  listQuestions, createQuestion, updateQuestion, deleteQuestion,
  addOption, updateOption, deleteOption, uploadQuestionImage,
  createRules, updateRules, optionRules,
};
