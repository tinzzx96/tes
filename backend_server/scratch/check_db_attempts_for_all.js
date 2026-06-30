const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const total = await prisma.examAttempt.count();
  console.log('Total attempts in DB:', total);

  const attemptsByExam = await prisma.examAttempt.groupBy({
    by: ['examId'],
    _count: { id: true }
  });
  console.log('Attempts by Exam ID:', attemptsByExam);

  const attemptsByStatus = await prisma.examAttempt.groupBy({
    by: ['status'],
    _count: { id: true }
  });
  console.log('Attempts by status:', attemptsByStatus);
}

main();
