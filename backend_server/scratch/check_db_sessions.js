const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  try {
    const sessionsDescribe = await prisma.$queryRawUnsafe('DESCRIBE sessions;');
    console.log('Describe sessions:', sessionsDescribe);

    const roomsDescribe = await prisma.$queryRawUnsafe('DESCRIBE rooms;');
    console.log('Describe rooms:', roomsDescribe);

    const sessions = await prisma.$queryRawUnsafe('SELECT * FROM sessions LIMIT 5;');
    console.log('Sessions rows:', sessions);

    const rooms = await prisma.$queryRawUnsafe('SELECT * FROM rooms LIMIT 5;');
    console.log('Rooms rows:', rooms);

  } catch (e) {
    console.error('Error:', e);
  } finally {
    await prisma.$disconnect();
  }
}

main();
