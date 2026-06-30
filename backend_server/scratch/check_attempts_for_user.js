const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const attempts = await prisma.examAttempt.findMany({
    where: { userId: 37 } // userId 37 is the user who logged in as 9900000002
  });
  console.log('Attempts for user 37:', attempts);
}

main();
