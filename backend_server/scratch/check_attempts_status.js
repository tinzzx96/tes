const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  try {
    const attempts = await prisma.examAttempt.groupBy({
      by: ['status'],
      where: { examId: 5 },
      _count: {
        id: true
      }
    });
    console.log('Exam 5 attempts by status:', attempts);
  } catch (e) {
    console.error('Error:', e);
  } finally {
    await prisma.$disconnect();
  }
}

main();
