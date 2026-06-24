// src/routes/admin/questionBanks.routes.js
// ════════════════════════════════════════════════════════════════════════════
// GANTI FILE INI — tambah:
//   1. Route import DOCX: POST /:bankId/import
//   2. listBanks sekarang filter by createdBy untuk role teacher
// ════════════════════════════════════════════════════════════════════════════

const router      = require('express').Router();
const multer      = require('multer');
const multerConfig= require('../../config/multer');
const {
  listBanks, getBank, createBank, updateBank, deleteBank, createRules,
} = require('../../controllers/admin/questionBanks.controller');
const {
  listQuestions, createQuestion, updateQuestion, deleteQuestion,
  addOption, updateOption, deleteOption, uploadQuestionImage,
  createRules: qCreateRules, updateRules: qUpdateRules, optionRules,
} = require('../../controllers/admin/questions.controller');
const { importDocx } = require('../../controllers/teacher/docxImport.controller');

// Multer khusus DOCX — terpisah dari multerConfig gambar
const docxUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 20 * 1024 * 1024 }, // 20 MB max
  fileFilter: (_req, file, cb) => {
    const allowed = [
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/msword',
    ];
    if (allowed.includes(file.mimetype) || file.originalname.endsWith('.docx')) {
      cb(null, true);
    } else {
      cb(new Error('Hanya file .docx yang diizinkan.'), false);
    }
  },
});

// ── Bank CRUD ─────────────────────────────────────────────────────────────────
router.get('/',    listBanks);
router.post('/',   createRules, createBank);
router.get('/:id', getBank);
router.put('/:id', updateBank);
router.delete('/:id', deleteBank);

// ── Import DOCX — endpoint baru ───────────────────────────────────────────────
// Guru hanya bisa import ke bank soal miliknya (validasi di controller)
router.post('/:bankId/import', docxUpload.single('file'), importDocx);

// ── Question CRUD dalam bank ──────────────────────────────────────────────────
router.get('/:bankId/questions',  listQuestions);
router.post('/:bankId/questions', qCreateRules, createQuestion);
router.put('/questions/:id',      qUpdateRules, updateQuestion);
router.delete('/questions/:id',   deleteQuestion);

// Upload gambar soal
router.post('/:bankId/questions/upload-image', multerConfig.single('image'), uploadQuestionImage);

// Option CRUD
router.post('/questions/:questionId/options', optionRules, addOption);
router.put('/options/:id',   updateOption);
router.delete('/options/:id', deleteOption);

module.exports = router;
