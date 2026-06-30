const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const count = await prisma.user.count({
    where: { role: 'student' }
  });
  console.log('Total students in DB:', count);

  const firstFew = await prisma.user.findMany({
    where: { role: 'student' },
    select: { nisn: true },
    take: 10
  });
  console.log('First 10 student NISNs:', firstFew.map(u => u.nisn));
}

main();
