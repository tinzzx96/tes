const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const count = await prisma.user.count({
    where: { nisn: { startsWith: '990000' } }
  });
  console.log('Total 990000 prefix users in DB:', count);
}

main();
