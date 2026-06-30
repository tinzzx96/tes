const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  try {
    const sessionsColumns = await prisma.$queryRaw`DESCRIBE sessions`;
    console.log('sessions table structure:', sessionsColumns);

    const usersColumns = await prisma.$queryRaw`DESCRIBE users`;
    console.log('users table structure:', usersColumns);

    const roomsColumns = await prisma.$queryRaw`DESCRIBE rooms`;
    console.log('rooms table structure:', roomsColumns);
  } catch (e) {
    console.error('Error describing tables:', e);
  } finally {
    await prisma.$disconnect();
  }
}

main();
