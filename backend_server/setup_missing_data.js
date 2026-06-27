const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();

async function setup() {
  try {
    // ── 1. Buat Token Sesi ─────────────────────────────────────────────────
    // Token ini yang diketik siswa di field "TOKEN SESI" saat login.
    // Berlaku hari ini sampai tengah malam.
    const today = new Date();
    const midnight = new Date(today);
    midnight.setHours(23, 59, 59, 999);

    const room = await p.room.upsert({
      where: { name: 'RUANG-14' },
      update: {},
      create: { name: 'RUANG-14', maxCapacity: 40 },
    });

    const session = await p.session.upsert({
      where: { token: 'SESI01' },
      update: { active: true, validUntil: midnight, roomId: room.id },
      create: {
        token: 'SESI01',
        description: 'Token Sesi Hari Ini',
        roomId: room.id,
        validFrom: new Date(today.setHours(0, 0, 0, 0)),
        validUntil: midnight,
        active: true,
      },
    });
    console.log('✓ Token Sesi dibuat:', session.token);

    // ── 2. Cek exam yang ada ───────────────────────────────────────────────
    const exams = await p.exam.findMany({
      select: { id: true, title: true, status: true, token: true, startTime: true, endTime: true },
    });
    console.log('\n=== EXAMS DI DATABASE ===');
    exams.forEach(e => console.log(`  ID:${e.id} | ${e.title} | status:${e.status} | token:${e.token}`));

    // ── 3. Aktifkan exam + buat ExamToken untuk setiap exam ────────────────
    for (const exam of exams) {
      // Aktifkan exam jika masih draft
      if (exam.status === 'draft') {
        await p.exam.update({
          where: { id: exam.id },
          data: {
            status: 'active',
            startTime: new Date(today.setHours(7, 0, 0, 0)),
            endTime: new Date(new Date().setHours(17, 0, 0, 0)),
          },
        });
        console.log(`✓ Exam ID:${exam.id} diaktifkan`);
      }

      // Buat ExamToken (token ujian per mapel)
      const examToken = await p.examToken.upsert({
        where: { examId_token: { examId: exam.id, token: 'UJIAN01' } },
        update: {},
        create: { examId: exam.id, token: 'UJIAN01' },
      });
      console.log(`✓ Token Ujian untuk exam ID:${exam.id} → token: ${examToken.token}`);
    }

    // ── 4. Tampilkan ringkasan login ───────────────────────────────────────
    const students = await p.user.findMany({
      where: { role: 'student' },
      select: { id: true, name: true, nisn: true },
      take: 3,
    });

    console.log('\n=== SIAP UNTUK TEST LOGIN ===');
    console.log('Token Sesi  :', 'SESI01');
    console.log('Token Ujian :', 'UJIAN01');
    console.log('\nContoh akun siswa:');
    students.forEach(s => console.log(`  NISN: ${s.nisn} | Nama: ${s.name}`));
    console.log('  Password  : siswa123  (default dari seed)');
    console.log('\nCara login di Postman:');
    console.log('  POST http://localhost:8000/api/auth/login');
    console.log('  Body: { "nisn": "<nisn>", "password": "siswa123", "sessionToken": "SESI01" }');

  } catch (e) {
    console.error('ERROR:', e.message);
  } finally {
    await p.$disconnect();
  }
}

setup();
