const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  try {
    const user = await prisma.user.findUnique({
      where: { nisn: '9900000001' },
    });
    console.log('User found:', user);
    
    // Let's find one user by any query
    const anyUser = await prisma.user.findFirst({
      where: { role: 'student' }
    });
    console.log('Sample student:', anyUser);
  } catch (e) {
    console.error('Error:', e);
  } finally {
    await prisma.$disconnect();
  }
}

main();
