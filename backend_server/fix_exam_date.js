const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();

async function fix() {
  try {
    const now = new Date();

    // Set startTime = hari ini jam 07:00, endTime = hari ini jam 17:00
    const startTime = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 7, 0, 0);
    const endTime   = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 17, 0, 0);

    const updated = await p.exam.updateMany({
      where: { status: 'active' },
      data: { startTime, endTime },
    });

    console.log(`✓ ${updated.count} exam diupdate ke hari ini`);
    console.log(`  startTime : ${startTime.toLocaleString('id-ID')}`);
    console.log(`  endTime   : ${endTime.toLocaleString('id-ID')}`);
    console.log('\nSekarang coba GET /exams lagi di Postman.');

  } catch (e) {
    console.error('ERROR:', e.message);
  } finally {
    await p.$disconnect();
  }
}

fix();
