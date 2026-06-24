const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();

async function check() {
  try {
    const users    = await p.user.count();
    const sessions = await p.session.count();
    const exams    = await p.exam.count();
    const tokens   = await p.examToken.count();

    console.log('=== CEK DATABASE ===');
    console.log('Users     :', users);
    console.log('Sessions  :', sessions);
    console.log('Exams     :', exams);
    console.log('ExamTokens:', tokens);
  } catch (e) {
    console.error('ERROR:', e.message);
  } finally {
    await p.$disconnect();
  }
}

check();
