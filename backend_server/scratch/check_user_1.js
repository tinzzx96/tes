const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const user = await prisma.user.findUnique({
    where: { nisn: '9900000001' },
    include: { examAttempts: true }
  });
  console.log('User 9900000001:', user);
}

main();
