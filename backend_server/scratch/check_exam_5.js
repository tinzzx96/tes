const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const exam = await prisma.exam.findUnique({
    where: { id: 5 },
    include: { examTokens: true }
  });
  console.log('Exam 5:', exam);
}

main();
