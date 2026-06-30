const { PrismaClient } = require('@prisma/client');
const jwt = require('jsonwebtoken');
const prisma = new PrismaClient();

async function run() {
  try {
    const admin = await prisma.user.findUnique({
      where: { nisn: '000000000001' }
    });
    if (!admin) {
      console.log('Error: Admin user not found. Please run seed script first.');
      return;
    }
    console.log('Admin user found:', admin.name);

    // Simulate query parameters like listBanksV2 would receive
    const search = '';
    const subject = '';
    const grade = '';
    const year = '';
    const page = '1';
    const limit = '10';
    const sortBy = 'createdAt';
    const sortDir = 'desc';

    const pageNum  = Math.max(parseInt(page)  || 1, 1);
    const limitNum = Math.min(Math.max(parseInt(limit) || 10, 1), 100);
    const skip     = (pageNum - 1) * limitNum;

    const ALLOWED_SORT = ['name', 'subject', 'createdAt', 'questionCount'];
    const safeSortBy  = ALLOWED_SORT.includes(sortBy) ? sortBy : 'createdAt';
    const safeSortDir = sortDir === 'asc' ? 'asc' : 'desc';

    const whereConditions = [];

    const where = whereConditions.length > 0
      ? { AND: whereConditions }
      : {};

    const needsCountSort = safeSortBy === 'questionCount';

    const orderBy = needsCountSort
      ? { createdAt: 'desc' }
      : { [safeSortBy]: safeSortDir };

    console.log('Running query against DB...');
    const [banks, total] = await Promise.all([
      prisma.questionBank.findMany({
        where,
        include: {
          creator: { select: { id: true, name: true, role: true } },
          _count:  { select: { questions: true, exams: true } },
        },
        orderBy,
        take:  needsCountSort ? undefined : limitNum,
        skip:  needsCountSort ? undefined : skip,
      }),
      prisma.questionBank.count({ where }),
    ]);

    console.log('Query successful! Total rows:', total);
    console.log('Data:', JSON.stringify(banks, null, 2));

  } catch (err) {
    console.error('CRASH ERROR:', err);
  } finally {
    await prisma.$disconnect();
  }
}

run();
