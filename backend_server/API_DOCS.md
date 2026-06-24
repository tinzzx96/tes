# Hero Exam Backend — Dokumentasi API

Base URL: `http://localhost:8000/api`

Header wajib (kecuali login):
```
Authorization: Bearer {accessToken}
Content-Type: application/json
```

Format response sukses: `{ "success": true, "data": { ... } }`
Format response error: `{ "success": false, "error": { "code": "...", "message": "..." } }`

---

## 1. Authentication — Token Sesi (Login)

### POST `/auth/login`
Login siswa. Wajib menyertakan **Token Sesi** yang sudah dibuat admin.

**Request:**
```json
{
  "nisn": "0023456789",
  "password": "siswa123",
  "sessionToken": "ABCD12"
}
```

**Response 200:**
```json
{
  "success": true,
  "data": {
    "accessToken": "eyJhbGciOiJIUzI1NiIs...",
    "student": {
      "id": "stu_1",
      "name": "Danang Prakoso",
      "nisn": "0023456789",
      "classLabel": "XI RPL 1",
      "deviceId": "device_uuid"
    }
  }
}
```

> ⚠️ Field response berubah dari versi lama: `token` → `accessToken`, `user` → `student`, `class` → `classLabel`, `device` → `deviceId`

**Response 401 — Token Sesi salah/kadaluarsa:**
```json
{ "success": false, "error": { "code": "...", "message": "Token Sesi tidak valid atau sudah kedaluwarsa." } }
```

---

### GET `/auth/me`
Data user yang sedang login (semua role).

**Response:** field lengkap: `id`, `name`, `nisn`, `class`, `device`, `room`, `role`, `verified`

---

## 2. Token Ujian — Validasi Sebelum Masuk Exam

### POST `/exam-tokens/validate`
Dipanggil saat siswa menekan "MULAI UJIAN" dan memasukkan Token Ujian.
Token divalidasi terhadap tabel `exam_tokens`.

**Request:**
```json
{
  "examId": 1,
  "token": "MATH99"
}
```

**Response 200 — Token valid:**
```json
{
  "success": true,
  "data": {
    "valid": true,
    "examAttemptId": 5521
  }
}
```

> `examAttemptId` ini **wajib disimpan** dan dipakai untuk semua request selanjutnya (auto-save, report-violation, verify-unlock, heartbeat).

**Response 422 — Token salah:**
```json
{
  "success": false,
  "error": { "code": "TOKEN_INVALID", "message": "Token Ujian salah. Hubungi pengawas untuk konfirmasi token." }
}
```

---

## 3. Riwayat Ujian

### GET `/exam-attempts/history`
Riwayat permanen ujian yang sudah disubmit siswa. Data dari server, bukan local storage.

**Response 200:**
```json
{
  "success": true,
  "data": [
    {
      "examId": "exam-1",
      "subjectName": "Matematika",
      "examCode": "MTK-2026-UAS",
      "teacherName": "Drs. Rajan Johnson",
      "submittedAt": "2026-06-17T09:42:00.000Z",
      "score": 88
    }
  ]
}
```

> `score: null` jika guru belum menilai — tampilkan "Menunggu Nilai".

---

## 4. Ujian (Student)

| Method | Endpoint | Deskripsi |
|--------|----------|-----------|
| GET | `/exams` | List ujian hari ini |
| GET | `/exams/:id` | Detail ujian |
| POST | `/exams/:examId/start` | Mulai ujian (ubah status → started) |
| GET | `/exams/:examId/timer` | Sisa waktu ujian |
| POST | `/exams/:examId/submit` | Kumpulkan ujian |
| GET | `/exams/:examId/questions` | Ambil soal beserta jawaban tersimpan |
| GET | `/exams/:examId/result` | Lihat hasil ujian |

---

## 5. Auto-Save Jawaban

### POST `/exam-attempts/:examAttemptId/answers`
Auto-save jawaban satu soal. Gunakan `examAttemptId` dari `/exam-tokens/validate`.
Server menggunakan timestamp server (bukan `clientTimestamp`) sebagai penentu urutan tulis.

> ⚠️ URL berubah dari versi lama: `/exams/:examId/answers/save` → `/exam-attempts/:examAttemptId/answers`

**Request:**
```json
{
  "questionId": 104,
  "selectedOptionIndex": 1,
  "clientTimestamp": "2026-06-21T08:12:33.501Z"
}
```

**Response 200:**
```json
{
  "success": true,
  "data": { "saved": true, "savedAt": "2026-06-21T08:12:33.812Z" }
}
```

---

## 6. Keamanan & Anti-Curang (REST)

> ⚠️ **Perubahan besar dari versi lama:**
> - Body sekarang pakai `examAttemptId` (integer), bukan `exam_id`
> - PIN dikirim ke pengawas via **WebSocket** (otomatis) — endpoint `GET /security/get-unlock-pin` **DIHAPUS**
> - `report-violation` tidak lagi mengembalikan `challengeCode` ke siswa

### POST `/security/report-violation`
Dipanggil Flutter saat screen pinning lepas.

**Request:**
```json
{
  "examAttemptId": 5521,
  "reasonCode": "screen_pin_released",
  "violationNumber": 3
}
```

**Response 200 — Normal (counter < 5):**
```json
{
  "success": true,
  "data": { "action": "BLOCK_NORMAL", "counterPelanggaran": 3 }
}
```

> Saat response ini, server **langsung emit event `pin-generated`** ke room pengawas via WebSocket. PIN tidak dikirim ke siswa.

**Response 200 — Auto-submit (counter ≥ 5):**
```json
{
  "success": true,
  "data": { "action": "AUTO_SUBMIT_DISQUALIFIED", "counterPelanggaran": 5 }
}
```

---

### POST `/security/verify-unlock`
Dipanggil Flutter saat siswa memasukkan PIN dari pengawas.
PIN divalidasi spesifik terhadap `examAttemptId` yang sama.

> ⚠️ Body berubah: `exam_id` + `unlock_pin` → `examAttemptId` + `pin`

**Request:**
```json
{
  "examAttemptId": 5521,
  "pin": "4452"
}
```

**Response 200:**
```json
{ "success": true, "data": { "unlocked": true } }
```

**Response 422 — PIN salah:**
```json
{
  "success": false,
  "error": { "code": "PIN_INVALID", "message": "PIN salah atau tidak berlaku untuk sesi ujian ini." }
}
```

---

### GET `/security/status/:examAttemptId`
Cek status blokir saat app di-restart.

> ⚠️ URL parameter berubah: `:examId` → `:examAttemptId`

**Response 200:**
```json
{
  "success": true,
  "data": {
    "isBlocked": true,
    "counterPelanggaran": 3,
    "remainingViolations": 2,
    "status": "started"
  }
}
```

---

## 7. WebSocket (Socket.io) — Dashboard Pengawas

> Pengawas **PASIF** — hanya listen event, tidak pernah polling.

### Koneksi
```js
const socket = io('http://localhost:8000', {
  auth: { token: supervisorAccessToken }
});
socket.emit('join-room', { roomName: 'room-13' });
```

### Event: `pin-generated` (server → client)
Dikirim otomatis saat ada siswa di ruangan tersebut terblokir (counter < 5).
```js
socket.on('pin-generated', (payload) => {
  // payload:
  // {
  //   examAttemptId: 5521,
  //   studentName: "Danang Prakoso",
  //   pin: "4452",
  //   subjectName: "Matematika",
  //   timestamp: "2026-06-21T08:30:11.000Z"
  // }
});
```

### Event: `student-status-changed` (server → client)
Dikirim saat status siswa berubah (online kembali, atau 90 detik tanpa heartbeat → offline).
```js
socket.on('student-status-changed', (payload) => {
  // { studentId: "stu_8821", status: "online" | "offline" | "submit" | "not_logged_in" }
});
```

---

## 8. Monitoring — Heartbeat

### POST `/monitor/heartbeat`
Dikirim siswa setiap 30 detik.

> ⚠️ Body berubah: `exam_id` → `examAttemptId`

**Request:**
```json
{
  "examAttemptId": 5521,
  "device": "ASUS X409FA"
}
```

**Response 200:**
```json
{
  "success": true,
  "data": { "received": true, "serverTime": "2026-06-21T08:30:00.000Z", "counterPelanggaran": 1 }
}
```

---

### GET `/monitor/exam/:examId/participants`
Snapshot status peserta (fallback REST — WebSocket adalah sumber utama).

**Response 200:**
```json
{
  "success": true,
  "data": {
    "exam": { "id": 1, "title": "UAS Matematika", "status": "active" },
    "participants": [
      {
        "userId": "stu_1",
        "name": "Danang Prakoso",
        "status": "online",
        "progress": 15,
        "counterPelanggaran": 1,
        "isBlocked": false,
        "lastSeen": "2026-06-21T08:30:00Z"
      }
    ],
    "summary": { "total": 30, "online": 25, "offline": 2, "submitted": 3, "waiting": 0, "blocked": 1 }
  }
}
```

---

## 9. Admin

| Method | Endpoint | Deskripsi |
|--------|----------|-----------|
| GET/POST | `/admin/users` | CRUD pengguna |
| POST | `/admin/users/import` | Import siswa massal (JSON array) |
| GET/POST | `/admin/exams` | CRUD ujian |
| POST | `/admin/exams/:id/activate` | Aktifkan ujian |
| POST | `/admin/exams/:id/complete` | Tutup ujian |
| GET/POST | `/admin/question-banks` | CRUD bank soal |
| GET/POST | `/admin/question-banks/:bankId/questions` | CRUD soal |
| POST | `/admin/question-banks/:bankId/questions/upload-image` | Upload gambar soal |
| **POST** | **`/admin/sessions`** | **Buat Token Sesi (baru)** |
| **GET** | **`/admin/sessions`** | **Daftar Token Sesi (baru)** |
| **PATCH** | **`/admin/sessions/:id`** | **Aktifkan/nonaktifkan Token Sesi (baru)** |
| **POST** | **`/admin/exam-tokens`** | **Buat Token Ujian per exam (baru)** |
| **GET** | **`/admin/exam-tokens?examId=1`** | **Daftar Token Ujian (baru)** |

### POST `/admin/sessions` — Buat Token Sesi
```json
{
  "token": "SESI01",
  "description": "Sesi UAS Hari 1",
  "validFrom": "2026-06-21T07:00:00.000Z",
  "validUntil": "2026-06-21T17:00:00.000Z"
}
```

### POST `/admin/exam-tokens` — Buat Token Ujian
```json
{ "examId": 1, "token": "MATH99" }
```

---

## 10. Teacher

| Method | Endpoint | Deskripsi |
|--------|----------|-----------|
| GET | `/teacher/exams` | Ujian milik guru |
| GET | `/teacher/exams/:id/results` | Hasil peserta |
| GET | `/teacher/exams/:id/results/export` | Export CSV |

---

## Status Codes

| Code | Arti |
|------|------|
| 200 | Sukses |
| 201 | Resource baru dibuat |
| 400 | Request tidak valid |
| 401 | Token tidak ada / kadaluarsa |
| 403 | Role tidak punya akses |
| 404 | Data tidak ditemukan |
| 409 | Konflik (Single Session Policy) |
| 422 | Validasi bisnis gagal (token salah, PIN salah, dll) |
| 429 | Rate limit |
| 500 | Server error |

---

## Ringkasan Breaking Changes dari Versi Lama

| Aspek | Versi Lama | Versi Baru |
|-------|-----------|------------|
| Login body | `{ nisn, password }` | `{ nisn, password, sessionToken }` |
| Login response field | `token`, `user` | `accessToken`, `student` |
| Login response student fields | `class`, `device`, `id: 1` | `classLabel`, `deviceId`, `id: "stu_1"` |
| Token Ujian | `POST /auth/token/verify` | `POST /exam-tokens/validate` → dapat `examAttemptId` |
| Auto-save URL | `POST /exams/:examId/answers/save` | `POST /exam-attempts/:examAttemptId/answers` |
| Auto-save body | `question_id`, `option_id` | `questionId`, `selectedOptionIndex` |
| Report violation body | `{ exam_id }` | `{ examAttemptId, reasonCode }` |
| Report violation response | `{ challengeCode, autoSubmitted }` | `{ action: "BLOCK_NORMAL" \| "AUTO_SUBMIT_DISQUALIFIED" }` |
| Verify unlock body | `{ exam_id, unlock_pin }` | `{ examAttemptId, pin }` |
| Security status param | `:examId` | `:examAttemptId` |
| Heartbeat body | `{ exam_id, progress, ... }` | `{ examAttemptId, device }` |
| PIN ke pengawas | REST `POST /security/get-unlock-pin` (**DIHAPUS**) | WebSocket event `pin-generated` (otomatis) |
| Status peserta | REST polling `/monitor/exam/:id/participants` | WebSocket event `student-status-changed` (utama) + REST sebagai fallback |
