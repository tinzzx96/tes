# Laporan Perbaikan — Exam Poncol

Tanggal: 30 Juni 2026
Status: Root cause terkonfirmasi via penelusuran kode di backend_server, frontend_web, dan dart_mobile.

---

## BUG 1 — Reset Device Lock Tidak Berfungsi

### Gejala
Proktor klik "Reset Kunci Device" di dashboard, modal UI tertutup (sukses), tapi siswa tetap
tidak bisa login dari perangkat baru. Pesan error yang muncul tetap `DEVICE_LOCKED`.

### Root Cause
Ada **mismatch scope** antara aksi reset (per-exam) dan validasi lock (global per-user):

1. `resetStudentDevice` (backend_server/src/controllers/admin/proctor.controller.js) hanya
   menghapus `deviceId` pada **satu** baris `exam_attempts` yang `examId`-nya sama dengan
   ujian yang sedang dipantau proktor di dashboard:
   ```js
   await tx.examAttempt.updateMany({
     where: { userId, examId, status: { not: 'submitted' } },
     data: { deviceId: null },
   });
   ```

2. Tapi validasi device lock saat **login** (backend_server/src/controllers/auth.controller.js)
   dan saat akses endpoint ujian (backend_server/src/middleware/deviceCheck.js) mencari
   **SEMUA** `exam_attempts` milik user tersebut tanpa filter `examId`:
   ```js
   const lockedAttempt = await prisma.examAttempt.findFirst({
     where: { userId: user.id, status: { not: 'submitted' }, deviceId: { not: null } },
     orderBy: { createdAt: 'asc' },
   });
   ```

Karena `exam_attempts` punya constraint `@@unique([userId, examId])`, satu siswa bisa punya
banyak baris (satu per ujian/mapel). Jika siswa punya ujian lain yang attempt-nya juga belum
`submitted` dan `deviceId` masih terisi, reset di ujian A **tidak** menghapus lock dari ujian
B — sehingga proses login tetap menemukan `lockedAttempt` dan menolak akses (403 `DEVICE_LOCKED`).

### Fix
Ubah `resetStudentDevice` agar menghapus `deviceId` di **seluruh** attempt aktif milik siswa
(selaras dengan filosofi "First-Device Lock" yang sifatnya per-user, bukan per-exam), bukan
hanya attempt pada `examId` yang sedang dibuka proktor.

File: `backend_server/src/controllers/admin/proctor.controller.js`

```diff
   let log;
   await prisma.$transaction(async (tx) => {
     // 1. Hapus device dari profil user
     await tx.user.update({
       where: { id: userId },
       data: { device: null },
     });

-    // 2. Hapus deviceId dari exam_attempt yang aktif
+    // 2. Hapus deviceId dari SEMUA exam_attempt aktif milik siswa ini.
+    //    PENTING: validasi lock saat login (auth.controller.js) dan saat akses
+    //    endpoint ujian (deviceCheck.js) mengecek SEMUA attempt milik user
+    //    (tanpa filter examId). Jika hanya attempt examId ini yang dibersihkan,
+    //    attempt ujian lain yang masih terkunci akan tetap memblokir login,
+    //    membuat tombol "Reset Device" terlihat berhasil padahal tidak efektif.
     await tx.examAttempt.updateMany({
       where: {
         userId,
-        examId,
         status: { not: 'submitted' },
+        deviceId: { not: null },
       },
       data: { deviceId: null },
     });
```

Catatan: parameter `examId` di URL/route **tetap dipertahankan** (tidak dihapus dari signature
function maupun route), karena masih dipakai untuk: (a) validasi proktor hanya boleh
mereset siswa di ruangannya sendiri, dan (b) label log aktivitas `targetLabel` yang
menyebutkan ujian mana yang sedang ditangani saat aksi reset dilakukan. Hanya scope
`updateMany` yang diperluas dari per-exam menjadi per-user.

### Dampak setelah fix
- Reset device dari ujian manapun akan benar-benar menghapus seluruh lock siswa tersebut.
- Siswa langsung bisa login dari perangkat baru, device baru akan dikunci ulang (first-lock)
  begitu siswa start ujian berikutnya, sesuai desain awal.
- Tidak mengubah behavior `resetStudentSession` (reset sesi, bukan reset device) yang memang
  sudah didesain per-exam dan sudah benar.

---

## BUG 2 — Badge "TODAY" Salah Muncul di Card "BESOK" (Schedule Page — Web)

### Gejala
Admin set ujian mulai besok. Di Schedule Page (web), ujian sudah benar dikelompokkan ke
section "BESOK", tapi pojok kanan atas card tetap menampilkan badge "TODAY".

### Root Cause
File: `frontend_web/src/pages/SchedulePage.js`, fungsi `loadSchedule()`.

Saat memetakan data exam dari API menjadi bentuk yang dipakai `bucketSchedule()`, field
`isToday` di-**hardcode** `true` untuk seluruh item, tidak peduli tanggal aslinya:

```js
const schedule = exams.map(e => ({
    ...
    dateValue: new Date(e.startTime),
    isToday:   true,   // <-- BUG: selalu true
    ...
}));
```

Function `bucketSchedule()` sendiri sudah benar mengelompokkan berdasarkan `dateValue` ke
HARI INI / BESOK / MINGGU INI. Tapi `createScheduleCard()` (frontend_web/src/components/Card.js)
merender badge TODAY berdasarkan `exam.isToday`, bukan berdasarkan bucket aktual:

```js
const todayBadge = exam.isToday
    ? `<div class="absolute top-md right-md ...">TODAY</div>`
    : '';
```

Karena `isToday` selalu `true`, badge TODAY ikut muncul di semua card termasuk yang
sebenarnya ada di grup BESOK/MINGGU INI.

### Fix
Hitung `isToday` berdasarkan perbandingan tanggal asli (`startTime` vs hari ini), bukan
hardcode.

File: `frontend_web/src/pages/SchedulePage.js`

```diff
+    async loadSchedule() {
         try {
             const res = await api.getExams();
             const exams = res.data?.data ?? [];
             ...
+            const startOfDay = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
+            const todayStart = startOfDay(new Date());

             // Konversi ke format yang dipakai bucketSchedule()
-            const schedule = exams.map(e => ({
+            const schedule = exams.map(e => {
+                const examDateStart = startOfDay(new Date(e.startTime));
+                return {
                     subject:   e.subject,
                     code:      e.examCode,
                     time:      `${this._fmt(e.startTime)} - ${this._fmt(e.endTime)}`,
                     room:      e.room ?? '-',
                     teacher:   e.teacher ?? '-',
                     date:      'Hari ini',
                     dateValue: new Date(e.startTime),
-                    isToday:   true,
+                    isToday:   examDateStart.getTime() === todayStart.getTime(),
                     examId:    e.id,
                     status:    e.status,
                     attemptStatus: e.attemptStatus,
-            }));
+                };
+            });
```

### Dampak setelah fix
- Card di grup "HARI INI" tetap menampilkan badge TODAY (perilaku benar, tidak berubah).
- Card di grup "BESOK" dan "MINGGU INI" tidak lagi menampilkan badge TODAY yang salah.
- Tidak menyentuh logic `bucketSchedule()` yang pengelompokannya memang sudah benar.
- Catatan: Flutter mobile (`schedule_screen.dart` + `schedule_card.dart`) **tidak terdampak
  bug ini** — sudah benar sejak awal karena memakai `schedule.isToday(now)` yang dihitung
  dinamis per item, bukan hardcode.

---

## BUG 3 — Ujian "Besok" Langsung Muncul di Home Saat Admin Start (Web & Mobile)

### Gejala
Admin di tab "Kelola Ujian" set waktu mulai ujian = besok, lalu klik "Start" / aktivasi
ujian (status `draft` → `active`). Ujian itu **langsung muncul** di Home Screen (baik web
maupun mobile), padahal jam mulainya belum tiba (masih besok).

### Root Cause
File: `backend_server/src/controllers/exam.controller.js`, fungsi `listExams()`.

Endpoint `GET /api/exams` inilah yang dipakai bersama oleh:
- Home Page web (`frontend_web/src/pages/HomePage.js` → `api.getExams()`)
- Home Screen mobile (`dart_mobile/lib/core/utils/exam_schedule_repository.dart` →
  `fetchToday()`, dengan komentar "Sudah difilter backend berdasarkan startTime = hari ini")
- Schedule Page/Screen (web & mobile)

Untuk siswa yang sudah punya `classId` (kasus normal/produksi), filter query yang dipakai:

```js
const examClasses = await prisma.examClass.findMany({
  where: {
    classId: user.classId,
    exam: {
      status: { not: 'draft' },   // (A) lolos begitu admin start exam
      endTime: { gte: now },      // (B) lolos selama ujian belum "kadaluarsa"
    }
  },
  ...
});
```

Filter ini **tidak pernah memeriksa `startTime <= now`**. Begitu admin start ujian
(`status: draft → active`), syarat (A) langsung terpenuhi. Syarat (B) juga otomatis
terpenuhi untuk ujian besok karena `endTime` (besok + durasi) jelas masih `>= now`
(sekarang). Akibatnya ujian besok ikut lolos dan dikembalikan oleh API — padahal
secara definisi seharusnya endpoint ini hanya mengembalikan ujian yang sudah "dimulai
waktunya", bukan sekadar "sudah diaktifkan adminnya".

Catatan: jalur fallback (siswa belum punya `classId`) sebenarnya sudah benar — di situ
ada filter `startTime: { gte: today, lt: tomorrow }`. Bug ini spesifik ada di jalur
utama (siswa dengan `classId`, yang dipakai mayoritas siswa).

### Fix
Tambahkan syarat `startTime <= now` pada filter, sehingga ujian baru muncul di Home
begitu jam & menit mulai yang di-set admin benar-benar sudah tiba — bukan begitu admin
menekan tombol start.

File: `backend_server/src/controllers/exam.controller.js`

```diff
     const [examClasses, attempts] = await Promise.all([
       prisma.examClass.findMany({
         where: { 
           classId: user.classId,
           exam: {
             status: { not: 'draft' },
-            endTime: { gte: now },
+            startTime: { lte: now },  // ujian baru tampil saat jam mulainya sudah tiba
+            endTime:   { gte: now },  // dan belum melewati jam selesainya
           }
         },
         include: {
           exam: {
             include: { teacher: { select: { id: true, name: true } } },
           },
         },
       }),
       ...
     ]);
```

### Dampak setelah fix
- Ujian dengan `startTime` di masa depan (mis. besok) **tidak akan muncul** di Home
  Page/Screen meskipun admin sudah men-start-nya (status `active`), sampai waktu mulai
  yang di-set admin benar-benar tercapai.
- Ujian tersebut tetap akan muncul lebih dulu di **Schedule Page/Screen** (grup "BESOK"),
  karena Schedule memang menampilkan rentang waktu lebih luas (hari ini, besok, minggu
  ini) — sesuai ekspektasi awal kasus ini (yang dipermasalahkan hanya kemunculannya di
  Home, bukan di Schedule).
- Begitu jam sistem mencapai `startTime` ujian, pada request `GET /exams` berikutnya
  (baik via polling otomatis maupun event socket `exam-status-changed` yang sudah
  ada di FE), ujian otomatis muncul di Home tanpa perlu aksi admin tambahan.
- Tidak mengubah perilaku ujian yang statusnya masih `draft` (tetap tidak pernah
  muncul, sesuai semula) maupun ujian yang sudah `completed`/lewat `endTime`
  (tetap hilang dari Home, sesuai semula).
- Perbaikan otomatis berlaku untuk **web dan mobile sekaligus**, karena keduanya
  mengonsumsi endpoint backend yang sama (`GET /api/exams`).

---

## Ringkasan File yang Diubah

| # | File | Jenis perubahan |
|---|------|------------------|
| 1 | `backend_server/src/controllers/admin/proctor.controller.js` | Perluas scope `updateMany` reset device dari per-exam → per-user |
| 2 | `frontend_web/src/pages/SchedulePage.js` | Hitung `isToday` dinamis berdasarkan tanggal, hapus hardcode `true` |
| 3 | `backend_server/src/controllers/exam.controller.js` | Tambah filter `startTime: { lte: now }` di `listExams` (jalur classId) |

Ketiga fix bersifat lokal/minimal — tidak mengubah skema database, tidak mengubah kontrak
response API (field/struktur tetap sama), dan tidak mengubah behavior lain yang sudah
berjalan benar (mis. reset sesi, fallback listExams tanpa classId, schedule grouping mobile).
