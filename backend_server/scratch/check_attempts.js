const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  try {
    const totalAttempts = await prisma.examAttempt.count();
    console.log('Total exam attempts:', totalAttempts);
    
    const attemptsByStatus = await prisma.examAttempt.groupBy({
      by: ['status'],
      _count: true
    });
    console.log('Attempts by status:', attemptsByStatus);
  } catch (e) {
    console.error('Error:', e);
  } finally {
    await prisma.$disconnect();
  }
}

main();
