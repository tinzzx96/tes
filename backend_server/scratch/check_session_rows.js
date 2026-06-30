const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  try {
    const sessions = await prisma.$queryRaw`SELECT * FROM sessions`;
    console.log('Sessions rows:', sessions);

    const rooms = await prisma.$queryRaw`SELECT * FROM rooms`;
    console.log('Rooms rows:', rooms);
  } catch (e) {
    console.error('Error fetching rows:', e);
  } finally {
    await prisma.$disconnect();
  }
}

main();
