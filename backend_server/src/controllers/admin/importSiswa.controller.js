// backend_server/src/controllers/admin/importSiswa.controller.js
// FILE BARU — import siswa via Excel + download template

const prisma  = require('../../config/database');
const XLSX    = require('xlsx');
const path    = require('path');
const crypto  = require('crypto');
const { ok, badRequest } = require('../../utils/response');

// ── Jurusan resmi & alias ─────────────────────────────────────────────────────
const JURUSAN_RESMI = ['RPL', 'DKV', 'TKRO', 'AKL', 'BP', 'TKJ'];

// Alias: kunci = pattern regex (case-insensitive), nilai = jurusan resmi
// Pola ini sengaja pakai regex agar bisa match variasi typo lebih luas.
const ALIAS_MAP = [
  { pattern: /^TKR$|OTO|OTOMOTIF/i,     resmi: 'TKRO' },
  { pattern: /^BDP$|^PM$|PEMASARAN/i,   resmi: 'BP'   },
  { pattern: /^RPL\d+$|PROG|REKAYASA/i, resmi: 'RPL'  },
  { pattern: /^AK$|^AKT$|AKUNTANSI/i,   resmi: 'AKL'  },
  { pattern: /^TKJ\d+$|^NET$|JARINGAN/i,resmi: 'TKJ'  },
  { pattern: /^MM$|^ART$|MULTIMEDIA/i,  resmi: 'DKV'  },
];

function resolveJurusan(raw) {
  const cleaned = (raw || '').trim().toUpperCase();
  if (JURUSAN_RESMI.includes(cleaned)) return cleaned;
  for (const { pattern, resmi } of ALIAS_MAP) {
    if (pattern.test(cleaned)) return resmi;
  }
  return null; // tidak dikenal
}

function buildNamaKelas(tingkat, jurusan, nomor) {
  const n = parseInt(nomor);
  if (!n || n <= 1) return `${tingkat} ${jurusan}`;
  return `${tingkat} ${jurusan}-${n}`;
}

// Session sementara untuk typo confirmation (in-memory, cukup untuk flow ini)
const pendingSessions = new Map();

// ── GET /admin/import/siswa/template ─────────────────────────────────────────
async function downloadTemplate(req, res) {
  const panduan = 'PANDUAN PENTING: Penulisan data Kelas wajib dipisah per kolom. ' +
    'Isikan singkatan Jurusan dengan huruf kapital resmi. ' +
    'DAFTAR JURUSAN UTAMA: RPL, DKV, TKRO, AKL, BP, TKJ. ' +
    'KETENTUAN NOMOR KELAS: Jika jurusan tersebut hanya memiliki 1 kelas, isi dengan angka 1 atau KOSONGKAN. ' +
    'Jika memiliki 2 kelas atau lebih, wajib diisi dengan angka (2, 3, 4, dst) pada kelas berikutnya. ' +
    'Kesalahan pengisian akan memicu kegagalan validasi kartu ujian!';

  const wb = XLSX.utils.book_new();

  // Baris 1 = panduan (merge A1:E1 via cells)
  const wsData = [
    [panduan, '', '', '', ''],
    ['Nama Siswa', 'NISN', 'Tingkat Kelas (X/XI/XII)', 'Jurusan', 'Nomor Kelas (1/2/3)'],
    ['Budi Santoso', '1234567890', 'XI', 'RPL', ''],
    ['Siti Aminah',  '0987654321', 'X',  'TKRO', '2'],
  ];

  const ws = XLSX.utils.aoa_to_sheet(wsData);

  // Style baris panduan (merge A1:E1)
  ws['!merges'] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: 4 } }];
  ws['!cols']   = [{ wch: 30 }, { wch: 15 }, { wch: 22 }, { wch: 10 }, { wch: 18 }];

  XLSX.utils.book_append_sheet(wb, ws, 'Template Siswa');

  const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
  res.setHeader('Content-Disposition', 'attachment; filename="template_import_siswa.xlsx"');
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.send(buf);
}

// ── POST /admin/import/siswa ──────────────────────────────────────────────────
async function importSiswa(req, res, next) {
  try {
    if (!req.file) return badRequest(res, 'File Excel wajib diupload.');

    const wb   = XLSX.read(req.file.buffer, { type: 'buffer' });
    const ws   = wb.Sheets[wb.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });

    // Skip baris panduan (baris 0) dan header kolom (baris 1), mulai baris 2
    const dataRows = rows.slice(2).filter(r => r[0] || r[1]);

    const resolved   = [];
    const unresolved = [];

    for (let i = 0; i < dataRows.length; i++) {
      const [nama, nisn, tingkat, jurusanRaw, nomor] = dataRows[i].map(v => String(v).trim());
      if (!nama || !nisn || !tingkat) continue;

      const jurusan = resolveJurusan(jurusanRaw);
      const rowNum  = i + 3; // offset: 1 panduan + 1 header + 1-based

      if (!jurusan) {
        unresolved.push({ row: rowNum, nama, nisn, tingkat: tingkat.toUpperCase(), jurusanRaw, nomor });
      } else {
        resolved.push({ nama, nisn, tingkat: tingkat.toUpperCase(), jurusan, nomor });
      }
    }

    if (unresolved.length > 0) {
      // Simpan resolved ke session sementara
      const sessionToken = crypto.randomBytes(16).toString('hex');
      pendingSessions.set(sessionToken, { resolved, timestamp: Date.now() });
      // Bersihkan sessions lama (> 10 menit)
      for (const [k, v] of pendingSessions) {
        if (Date.now() - v.timestamp > 10 * 60 * 1000) pendingSessions.delete(k);
      }
      return ok(res, {
        needsConfirmation: true,
        sessionToken,
        unresolved,
        resolvedCount: resolved.length,
      });
    }

    // Semua resolved → langsung insert
    const imported = await bulkInsert(resolved);
    return ok(res, { imported }, `Berhasil import ${imported} siswa.`);
  } catch (e) { next(e); }
}

// ── POST /admin/import/siswa/confirm ─────────────────────────────────────────
async function confirmImport(req, res, next) {
  try {
    const { sessionToken, fixes } = req.body;
    if (!sessionToken || !fixes?.length) return badRequest(res, 'Data tidak valid.');

    const session = pendingSessions.get(sessionToken);
    if (!session) return badRequest(res, 'Sesi sudah kedaluwarsa. Upload ulang file.');

    const fixedRows = fixes.map(f => ({
      nama: f.nama, nisn: f.nisn,
      tingkat: f.tingkat, jurusan: f.jurusanFixed, nomor: f.nomor,
    }));

    const allRows = [...session.resolved, ...fixedRows];
    pendingSessions.delete(sessionToken);

    const imported = await bulkInsert(allRows);
    return ok(res, { imported }, `Berhasil import ${imported} siswa.`);
  } catch (e) { next(e); }
}

// ── Helper: bulk insert ke tabel users + mapping class_id ────────────────────
async function bulkInsert(rows) {
  const bcrypt = require('bcryptjs');
  let imported = 0;

  // Ambil semua kelas sekaligus (untuk lookup class_id)
  const classes = await prisma.class.findMany({ select: { id: true, name: true } });
  const classMap = Object.fromEntries(classes.map(c => [c.name.toUpperCase(), c.id]));

  for (const { nama, nisn, tingkat, jurusan, nomor } of rows) {
    const namaKelas = buildNamaKelas(tingkat, jurusan, nomor);
    const classId   = classMap[namaKelas.toUpperCase()] ?? null;
    const password  = await bcrypt.hash('siswa123', 10);

    try {
      await prisma.user.upsert({
        where: { nisn },
        update: { name: nama, class: namaKelas, classId, verified: true },
        create: { name: nama, nisn, password, class: namaKelas, classId, role: 'student', verified: true },
      });
      imported++;
    } catch (_) { /* skip duplikat / error baris */ }
  }

  return imported;
}

module.exports = { downloadTemplate, importSiswa, confirmImport };