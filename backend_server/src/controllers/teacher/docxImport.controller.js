// src/controllers/teacher/docxImport.controller.js
// ════════════════════════════════════════════════════════════════════════════
// Import soal massal dari file DOCX ke bank soal.
// Endpoint: POST /api/teacher/question-banks/:bankId/import
//
// Fitur:
//  - Parse format DOCX sesuai PRD Bagian 7 (mammoth.js)
//  - Ekstrak gambar → simpan ke /uploads/questions/
//  - Isolasi: guru hanya bisa import ke bank soal MILIKNYA sendiri
//  - Jalankan di Worker Thread agar Event Loop tidak terblokir (PRD Bagian 45)
//
// Format DOCX yang didukung:
//   MAPEL: Matematika
//   KELAS: X
//   BANK_SOAL: PTS GANJIL
//
//   1. Teks soal
//   a. Opsi A
//   b. Opsi B
//   c. Opsi C
//   d. Opsi D
//   KUNCI: B
// ════════════════════════════════════════════════════════════════════════════

const path    = require('path');
const fs      = require('fs');
const crypto  = require('crypto');
const { Worker } = require('worker_threads');
const sharp   = require('sharp');
const prisma  = require('../../config/database');
const { ok, badRequest, notFound, forbidden } = require('../../utils/response');

// Folder simpan gambar soal
const UPLOAD_DIR = path.resolve(process.env.UPLOAD_DIR || 'uploads/questions');

function runParserWorker(buffer) {
  return new Promise((resolve, reject) => {
    const worker = new Worker(path.join(__dirname, '../../workers/docxParser.worker.js'), {
      workerData: { buffer }
    });
    worker.on('message', (msg) => {
      if (msg.success) {
        resolve(msg);
      } else {
        reject(new Error(msg.error));
      }
    });
    worker.on('error', reject);
    worker.on('exit', (code) => {
      if (code !== 0) {
        reject(new Error(`Worker stopped with exit code ${code}`));
      }
    });
  });
}

// ── Main handler ─────────────────────────────────────────────────────────────

async function importDocx(req, res, next) {
  try {
    const bankId = parseInt(req.params.bankId);
    const userId = req.user.id;
    const role   = req.user.role;

    // 1. Cek bank soal ada
    const bank = await prisma.questionBank.findUnique({ where: { id: bankId } });
    if (!bank) return notFound(res, 'Bank soal tidak ditemukan.');

    // 2. Isolasi: guru hanya bisa import ke bank soal MILIKNYA
    //    Admin bisa import ke bank soal siapapun
    if (role === 'teacher' && bank.createdBy !== userId) {
      return forbidden(res, 'Kamu hanya bisa import ke bank soal milikmu sendiri.');
    }

    // 3. Cek file ada
    if (!req.file) return badRequest(res, 'File DOCX wajib diupload.');

    // 4. Parse DOCX using worker thread (PRD Bagian 45)
    const { questions, meta, errors } = await runParserWorker(req.file.buffer);

    if (questions.length === 0) {
      return badRequest(res, 'Tidak ada soal yang berhasil diparsing. Periksa format file.', { errors });
    }

    // 5. Simpan ke DB dalam satu transaksi
    const { results: saved, log } = await prisma.$transaction(async (tx) => {
      const results = [];
      let orderNum  = await tx.question.count({ where: { questionBankId: bankId } }) + 1;

      for (const q of questions) {
        // Simpan gambar jika ada
        let questionImage = null;
        if (q.imageBuffer) {
          const filename = `q_${bankId}_${Date.now()}_${crypto.randomBytes(4).toString('hex')}.webp`;
          const filepath = path.join(UPLOAD_DIR, filename);
          if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });
          
          // Kompresi webp dengan lebar maksimal 800px dengan sharp (PRD Bagian 47.4)
          const buf = Buffer.from(q.imageBuffer.data || q.imageBuffer);
          await sharp(buf)
            .resize({ width: 800, withoutEnlargement: true })
            .toFormat('webp', { quality: 80 })
            .toFile(filepath);

          questionImage = filename;
        }

        // Buat question
        const question = await tx.question.create({
          data: {
            questionBankId: bankId,
            body:           q.body,
            questionImage,
            type:           'multiple_choice',
            orderNum:       orderNum++,
            points:         1,
          },
        });

        // Buat options + tandai yang benar
        const correctIndex = q.correctIndex; // 0=a, 1=b, 2=c, 3=d
        for (let i = 0; i < q.options.length; i++) {
          const opt = q.options[i];
          let optBody = typeof opt === 'string' ? opt : opt.body;
          const optImgBuf = typeof opt === 'string' ? null : opt.imageBuffer;

          if (optImgBuf) {
            const filename = `opt_${bankId}_${Date.now()}_${crypto.randomBytes(4).toString('hex')}.webp`;
            const filepath = path.join(UPLOAD_DIR, filename);
            if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });

            const buf = Buffer.from(optImgBuf.data || optImgBuf);
            await sharp(buf)
              .resize({ width: 800, withoutEnlargement: true })
              .toFormat('webp', { quality: 80 })
              .toFile(filepath);

            optBody = optBody ? `${optBody} [IMAGE:${filename}]` : `[IMAGE:${filename}]`;
          }

          await tx.option.create({
            data: {
              questionId: question.id,
              body:       optBody,
              isCorrect:  i === correctIndex,
              orderNum:   i + 1,
            },
          });
        }

        results.push(question.id);
      }

      const activityLog = await tx.activityLog.create({
        data: {
          userId:      userId,
          actorName:   req.user?.name ?? 'Guru',
          actorRole:   role,
          action:      'IMPORT_QUESTIONS',
          targetType:  'question_bank',
          targetId:    bankId,
          targetLabel: bank.name,
          meta:        { questionCount: questions.length }
        }
      });

      return { results, log: activityLog };
    });

    if (log) {
      try {
        const { getIo } = require('../../socket');
        const io = getIo();
        if (io) {
          io.to('room:admin').emit('new-activity', log);
          io.to('room:admin').emit('global-activity-admin', log);
        }
      } catch (_) {}
    }

    return ok(res, {
      imported:       saved.length,
      bankId,
      bankName:       bank.name,
      meta,
      parseErrors:    errors,
    }, `${saved.length} soal berhasil diimport ke bank soal "${bank.name}".`);

  } catch (e) {
    next(e);
  }
}

module.exports = { importDocx };

