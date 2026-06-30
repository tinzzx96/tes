const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  try {
    const exam = await prisma.exam.findUnique({
      where: { id: 5 },
      include: {
        questionBank: {
          include: {
            questions: true
          }
        }
      }
    });
    console.log('Exam 5 details:', {
      id: exam?.id,
      title: exam?.title,
      questionBankId: exam?.questionBankId,
      questionsCount: exam?.questionBank?.questions?.length
    });
  } catch (e) {
    console.error('Error:', e);
  } finally {
    await prisma.$disconnect();
  }
}

main();
