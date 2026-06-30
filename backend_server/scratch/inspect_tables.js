const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    try {
        const tables = await prisma.$queryRawUnsafe(`SHOW TABLES`);
        console.log('Tables in DB:', tables);
        
        // Let's also check if there is an academic_years table and describe it
        try {
            const desc = await prisma.$queryRawUnsafe(`DESCRIBE academic_years`);
            console.log('academic_years description:', desc);
            const content = await prisma.$queryRawUnsafe(`SELECT * FROM academic_years`);
            console.log('academic_years content:', content);
        } catch (e) {
            console.log('No academic_years table or failed to query:', e.message);
        }
    } catch (e) {
        console.error('Error:', e);
    } finally {
        await prisma.$disconnect();
    }
}

main();
