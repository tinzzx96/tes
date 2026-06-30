const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const attempts = await prisma.examAttempt.groupBy({
    by: ['status'],
    _count: {
      id: true
    }
  });
  console.log('Attempts by status:', attempts);

  const totalAttempts = await prisma.examAttempt.count();
  console.log('Total attempts:', totalAttempts);
}

main();
