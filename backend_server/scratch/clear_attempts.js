const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  try {
    // Hapus SEMUA jawaban & attempt dari semua exam
    // agar tidak ada sisa device lock dari exam lain yang menyebabkan 403
    const answersDel = await prisma.answer.deleteMany({});
    console.log('Deleted answers:', answersDel.count);

    const attemptsDel = await prisma.examAttempt.deleteMany({});
    console.log('Deleted exam attempts:', attemptsDel.count);
  } catch (e) {
    console.error('Error:', e);
  } finally {
    await prisma.$disconnect();
  }
}

main();
