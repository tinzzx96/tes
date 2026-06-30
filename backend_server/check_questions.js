const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function run() {
  try {
    const questions = await prisma.question.findMany({
      include: {
        questionBank: true,
        options: true,
      }
    });
    console.log(`Total questions in database: ${questions.length}`);
    for (const q of questions) {
      console.log(`- Question ID: ${q.id}`);
      console.log(`  Bank ID/Name: ${q.questionBankId} / ${q.questionBank.name}`);
      console.log(`  Body: ${q.body}`);
      console.log(`  questionImage: ${q.questionImage}`);
      console.log(`  Options:`, q.options.map(o => ({ body: o.body, isCorrect: o.isCorrect })));
    }
  } catch (e) {
    console.error(e);
  } finally {
    await prisma.$disconnect();
  }
}

run();
