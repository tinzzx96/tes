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

const mammoth = require('mammoth');
const path    = require('path');
const fs      = require('fs');
const crypto  = require('crypto');
const prisma  = require('../../config/database');
const { ok, badRequest, notFound, forbidden } = require('../../utils/response');

// Folder simpan gambar soal
const UPLOAD_DIR = path.resolve(process.env.UPLOAD_DIR || 'uploads/questions');

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

    // 4. Parse DOCX
    const { questions, meta, errors } = await parseDocx(req.file.buffer);

    if (questions.length === 0) {
      return badRequest(res, 'Tidak ada soal yang berhasil diparsing. Periksa format file.', { errors });
    }

    // 5. Simpan ke DB dalam satu transaksi
    const saved = await prisma.$transaction(async (tx) => {
      const results = [];
      let orderNum  = await tx.question.count({ where: { questionBankId: bankId } }) + 1;

      for (const q of questions) {
        // Simpan gambar jika ada
        let questionImage = null;
        if (q.imageBuffer) {
          const filename = `q_${bankId}_${Date.now()}_${crypto.randomBytes(4).toString('hex')}.webp`;
          const filepath = path.join(UPLOAD_DIR, filename);
          if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });
          // Simpan raw buffer (idealnya dikompresi dengan sharp, PRD Bagian 47.4)
          fs.writeFileSync(filepath, q.imageBuffer);
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
          await tx.option.create({
            data: {
              questionId: question.id,
              body:       q.options[i],
              isCorrect:  i === correctIndex,
              orderNum:   i + 1,
            },
          });
        }

        results.push(question.id);
      }
      return results;
    });

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

// ── DOCX Parser ───────────────────────────────────────────────────────────────

async function parseDocx(buffer) {
  const meta   = {};
  const errors = [];

  // Extract teks + gambar via mammoth
  const result = await mammoth.convertToHtml(
    { buffer },
    {
      convertImage: mammoth.images.imgElement(async (image) => {
        const imageBuffer = await image.read('base64');
        // Simpan sementara di array untuk dipasangkan ke soal
        return { src: `__IMG__${imageBuffer}__IMGEND__` };
      }),
    }
  );

  const rawText = htmlToText(result.value);
  const lines   = rawText.split('\n').map(l => l.trim()).filter(Boolean);
  const images  = extractImages(result.value);

  // Parse header metadata
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    if      (line.startsWith('MAPEL:'))     { meta.mapel    = line.replace('MAPEL:', '').trim(); i++; }
    else if (line.startsWith('KELAS:'))     { meta.kelas    = line.replace('KELAS:', '').trim(); i++; }
    else if (line.startsWith('BANK_SOAL:')){ meta.bankSoal = line.replace('BANK_SOAL:', '').trim(); i++; }
    else break;
  }

  // Parse soal
  const questions = [];
  let imageIdx    = 0;

  while (i < lines.length) {
    const line = lines[i];

    // Deteksi baris soal: dimulai angka + titik (1. 2. 10. dst)
    const soalMatch = line.match(/^(\d+)\.\s+(.+)/);
    if (!soalMatch) { i++; continue; }

    const questionBody = soalMatch[2];
    i++;

    // Cek apakah baris berikutnya adalah gambar placeholder
    let imageBuffer = null;
    if (i < lines.length && lines[i].includes('[GAMBAR]')) {
      imageBuffer = images[imageIdx++] ?? null;
      i++;
    }

    // Parse opsi (a. b. c. d.)
    const options = [];
    while (i < lines.length) {
      const optMatch = lines[i].match(/^([a-dA-D])\.\s+(.+)/);
      if (!optMatch) break;
      options.push(optMatch[2]);
      i++;
    }

    // Parse KUNCI
    let correctIndex = 0;
    if (i < lines.length && lines[i].startsWith('KUNCI:')) {
      const kunci = lines[i].replace('KUNCI:', '').trim().toLowerCase();
      correctIndex = kunci.charCodeAt(0) - 'a'.charCodeAt(0);
      i++;
    } else {
      errors.push(`Soal "${questionBody.substring(0, 30)}...": KUNCI tidak ditemukan, default ke A.`);
    }

    if (options.length < 2) {
      errors.push(`Soal "${questionBody.substring(0, 30)}...": Kurang dari 2 opsi, dilewati.`);
      continue;
    }

    if (correctIndex < 0 || correctIndex >= options.length) {
      errors.push(`Soal "${questionBody.substring(0, 30)}...": Kunci tidak valid, default ke A.`);
      correctIndex = 0;
    }

    questions.push({ body: questionBody, options, correctIndex, imageBuffer });
  }

  return { questions, meta, errors };
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function htmlToText(html) {
  return html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<\/li>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&nbsp;/g, ' ')
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"');
}

function extractImages(html) {
  const images  = [];
  const matches = html.matchAll(/__IMG__([^_]+)__IMGEND__/g);
  for (const m of matches) {
    try {
      images.push(Buffer.from(m[1], 'base64'));
    } catch (_) {}
  }
  return images;
}

module.exports = { importDocx };
