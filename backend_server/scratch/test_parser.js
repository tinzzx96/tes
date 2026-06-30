const mammoth = require('mammoth');

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

function replaceImgTags(html) {
  let imgIndex = 0;
  // Replace each img tag with [GAMBAR_IDX_0], [GAMBAR_IDX_1], etc.
  return html.replace(/<img[^>]*src="[^"]*__IMG__([^_]+)__IMGEND__"[^>]*>/gi, () => {
    return ` [GAMBAR_IDX_${imgIndex++}] `;
  });
}

function parseHtmlContent(htmlValue) {
  const meta   = {};
  const errors = [];

  const images  = extractImages(htmlValue);
  const htmlWithTokens = replaceImgTags(htmlValue);
  const rawText = htmlToText(htmlWithTokens);
  const lines   = rawText.split('\n').map(l => l.trim()).filter(Boolean);

  console.log('--- RAW LINES ---');
  console.log(lines);
  console.log('-----------------');

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

    let questionBody = soalMatch[2];
    i++;

    // Cek apakah ada token gambar di body soal
    let questionImageIdx = null;
    const qImgMatch = questionBody.match(/\[GAMBAR_IDX_(\d+)\]/);
    if (qImgMatch) {
      questionImageIdx = parseInt(qImgMatch[1]);
      questionBody = questionBody.replace(/\[GAMBAR_IDX_\d+\]/g, '').trim();
    }

    // Cek apakah baris berikutnya adalah gambar placeholder (standalone atau legacy [GAMBAR])
    if (i < lines.length && (lines[i].includes('[GAMBAR_IDX_') || lines[i].includes('[GAMBAR]'))) {
      const isOption = lines[i].match(/^([a-zA-Z])\.\s+/);
      const isQuestion = lines[i].match(/^(\d+)\.\s+/);
      if (!isOption && !isQuestion) {
        const standaloneMatch = lines[i].match(/\[GAMBAR_IDX_(\d+)\]/);
        if (standaloneMatch) {
          if (questionImageIdx === null) {
            questionImageIdx = parseInt(standaloneMatch[1]);
          }
          i++;
        } else if (lines[i].includes('[GAMBAR]')) {
          // Fallback legacy
          if (questionImageIdx === null) {
            questionImageIdx = imageIdx++;
          } else {
            imageIdx++;
          }
          i++;
        }
      }
    }

    const imageBuffer = questionImageIdx !== null ? (images[questionImageIdx] ?? null) : null;

    // Parse opsi (a. b. c. d. e. dst)
    const options = [];
    while (i < lines.length) {
      const optMatch = lines[i].match(/^([a-zA-Z])\.\s+(.+)/);
      if (!optMatch) break;
      
      let optBody = optMatch[2];
      let optImageIdx = null;
      const optImgMatch = optBody.match(/\[GAMBAR_IDX_(\d+)\]/);
      if (optImgMatch) {
        optImageIdx = parseInt(optImgMatch[1]);
        optBody = optBody.replace(/\[GAMBAR_IDX_\d+\]/g, '').trim();
      }

      options.push({
        body: optBody,
        imageBuffer: optImageIdx !== null ? (images[optImageIdx] ?? null) : null
      });
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

// Mock html data simulating mammoth output
const mockHtml = `
<p>MAPEL: Sejarah</p>
<p>KELAS: XI</p>
<p>BANK_SOAL: PTS Sejarah</p>
<p>1. Perhatikan gambar berikut: <img src="data:image/png;base64,__IMG__YmFzZTY0XzFfcXVlc3Rpb24=__IMGEND__" /></p>
<p>a. Opsi A dengan gambar <img src="data:image/png;base64,__IMG__YmFzZTY0XzJfb3B0aW9uYQ==__IMGEND__" /></p>
<p>b. Opsi B</p>
<p>c. <img src="data:image/png;base64,__IMG__YmFzZTY0XzNfb3B0aW9uYw==__IMGEND__" /> Opsi C</p>
<p>d. Opsi D</p>
<p>KUNCI: C</p>
<p>2. Ini adalah soal kedua dengan gambar terpisah di baris baru:</p>
<p><img src="data:image/png;base64,__IMG__YmFzZTY0XzRfcXVlc3Rpb24y__IMGEND__" /></p>
<p>a. Pilihan A</p>
<p>b. Pilihan B</p>
<p>KUNCI: B</p>
`;

const res = parseHtmlContent(mockHtml);
console.log('Result:', JSON.stringify(res, (key, value) => {
  if (key === 'imageBuffer' && value) {
    return value.type === 'Buffer' ? Buffer.from(value.data).toString('utf-8') : value.toString('utf-8');
  }
  return value;
}, 2));
