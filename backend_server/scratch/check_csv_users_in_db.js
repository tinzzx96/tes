const fs = require('fs');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const csv = fs.readFileSync('users.csv', 'utf8').trim().split('\n').slice(1);
  const csvNisns = csv.map(line => line.split(',')[0].trim());

  const users = await prisma.user.findMany({
    where: { nisn: { in: csvNisns } },
    select: { id: true, nisn: true }
  });

  console.log('Total NISNs in CSV:', csvNisns.length);
  console.log('Total matching users in DB:', users.length);
  
  // Check if there are any duplicate IDs
  const ids = users.map(u => u.id);
  const uniqueIds = new Set(ids);
  console.log('Total unique User IDs in DB:', uniqueIds.size);
}

main();
