const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding database ExamPoncol...');

  // ── Admin ──────────────────────────────────────────────────────────────────
  const adminPassword = await bcrypt.hash('admin123', 12);
  const admin = await prisma.user.upsert({
    where: { nisn: '000000000001' },
    update: {},
    create: {
      name: 'Administrator',
      nisn: '000000000001',
      password: adminPassword,
      role: 'admin',
      verified: true,
    },
  });

  // ── Guru ───────────────────────────────────────────────────────────────────
  const teacherPassword = await bcrypt.hash('guru123', 12);
  const teacher = await prisma.user.upsert({
    where: { nisn: '198001012010011' },
    update: {},
    create: {
      name: 'Drs. Rajan Johnson',
      nisn: '198001012010011',
      password: teacherPassword,
      role: 'teacher',
      room: 'RUANG-14',
      verified: true,
    },
  });

  // ── Pengawas ───────────────────────────────────────────────────────────────
  const proctorPassword = await bcrypt.hash('pengawas123', 12);
  await prisma.user.upsert({
    where: { nisn: '198812122012001' },
    update: {},
    create: {
      name: 'Budi Santoso',
      nisn: '198812122012001',
      password: proctorPassword,
      role: 'proctor',
      room: 'RUANG-14',
      verified: true,
    },
  });

  // ── Siswa ──────────────────────────────────────────────────────────────────
  const studentPassword = await bcrypt.hash('siswa123', 12);
  const students = [
    { name: 'Danang Prakoso', nisn: '0023456794', class: 'XI RPL 1', room: 'RUANG-14' },
    { name: 'Ujang Saputra', nisn: '0023456790', class: 'XI RPL 1', room: 'RUANG-14' },
    { name: 'Asep Permana', nisn: '0023456791', class: 'XI RPL 1', room: 'RUANG-14' },
    { name: 'Marlino Wijaya', nisn: '0023456792', class: 'XI RPL 1', room: 'RUANG-14' },
    { name: 'Dedi Kurniawan', nisn: '0023456793', class: 'XI RPL 1', room: 'RUANG-14' },
  ];

  for (const s of students) {
    await prisma.user.upsert({
      where: { nisn: s.nisn },
      update: {},
      create: { ...s, password: studentPassword, role: 'student', verified: true },
    });
  }

  // ── Bank Soal ──────────────────────────────────────────────────────────────
  const bank = await prisma.questionBank.upsert({
    where: { id: 1 },
    update: {},
    create: {
      name: 'Bank Soal Matematika UAS 2026',
      subject: 'Matematika',
      createdBy: teacher.id,
    },
  });

  // ── Soal ───────────────────────────────────────────────────────────────────
  const questionsData = [
    {
      body: '2 + 2 = ?',
      type: 'multiple_choice',
      points: 1,
      orderNum: 1,
      options: [
        { body: '3', isCorrect: false, orderNum: 1 },
        { body: '4', isCorrect: true, orderNum: 2 },
        { body: '5', isCorrect: false, orderNum: 3 },
        { body: '6', isCorrect: false, orderNum: 4 },
      ],
    },
    {
      body: 'Jika x + 5 = 12, maka x = ?',
      type: 'multiple_choice',
      points: 1,
      orderNum: 2,
      options: [
        { body: '5', isCorrect: false, orderNum: 1 },
        { body: '6', isCorrect: false, orderNum: 2 },
        { body: '7', isCorrect: true, orderNum: 3 },
        { body: '8', isCorrect: false, orderNum: 4 },
      ],
    },
    {
      body: 'Hasil dari 7 × 8 adalah?',
      type: 'multiple_choice',
      points: 1,
      orderNum: 3,
      options: [
        { body: '54', isCorrect: false, orderNum: 1 },
        { body: '56', isCorrect: true, orderNum: 2 },
        { body: '58', isCorrect: false, orderNum: 3 },
        { body: '60', isCorrect: false, orderNum: 4 },
      ],
    },
  ];

  for (const q of questionsData) {
    const existing = await prisma.question.findFirst({
      where: { questionBankId: bank.id, orderNum: q.orderNum },
    });
    if (!existing) {
      await prisma.question.create({
        data: {
          questionBankId: bank.id,
          body: q.body,
          type: q.type,
          points: q.points,
          orderNum: q.orderNum,
          options: { create: q.options },
        },
      });
    }
  }

  // ── Ujian ──────────────────────────────────────────────────────────────────
  const now = new Date();
  const startTime = new Date(now.getTime() - 30 * 60 * 1000); // 30 menit lalu
  const endTime = new Date(now.getTime() + 60 * 60 * 1000);   // 1 jam lagi

  await prisma.exam.upsert({
    where: { examCode: 'MTK-2026-UAS' },
    update: {},
    create: {
      title: 'UAS Matematika Ganjil 2026',
      subject: 'Matematika',
      teacherId: teacher.id,
      questionBankId: bank.id,
      durationMinutes: 90,
      startTime,
      endTime,
      room: 'RUANG-14',
      examCode: 'MTK-2026-UAS',
      token: '8X92K1',
      status: 'active',
    },
  });

  console.log('Seeding selesai!');
  console.log('Login admin   : nisn=000000000001, pass=admin123');
  console.log('Login guru    : nisn=198001012010011, pass=guru123');
  console.log('Login pengawas: nisn=198812122012001, pass=pengawas123');
  console.log('Login siswa   : nisn=0023456794, pass=siswa123');
}

main()
  .catch(e => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
