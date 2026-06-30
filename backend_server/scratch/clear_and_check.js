const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const countBefore = await prisma.examAttempt.count({ where: { examId: 5 } });
  console.log('Attempts for exam 5 before delete:', countBefore);

  const del = await prisma.examAttempt.deleteMany({ where: { examId: 5 } });
  console.log('Delete result:', del);

  const countAfter = await prisma.examAttempt.count({ where: { examId: 5 } });
  console.log('Attempts for exam 5 after delete:', countAfter);
}

main();
