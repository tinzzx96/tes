require('dotenv').config();
const http = require('http');
const app = require('./app');
const { initSocket, getIo } = require('./src/socket');
const { runSessionCleanup } = require('./src/jobs/sessionCleanup');
const { runMidnightCleanup } = require('./src/jobs/midnightCleanup');
const prisma = require('./src/config/database');
const logger = require('./src/utils/logger');
const fs = require('fs');
const path = require('path');

const PORT = process.env.PORT || 8000;

const uploadDir = path.join(__dirname, process.env.UPLOAD_DIR || 'uploads/questions');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

const logsDir = path.join(__dirname, 'logs');
if (!fs.existsSync(logsDir)) fs.mkdirSync(logsDir);

function scheduleMidnightCleanup() {
  const now = new Date();
  const nextMidnight = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate() + 1,
    0, 0, 0, 0
  );
  const delay = nextMidnight.getTime() - now.getTime();

  logger.info(`[MidnightCleanup] Dijadwalkan berjalan dalam ${Math.round(delay / 60_000)} menit (pada 00:00).`);

  setTimeout(() => {
    runMidnightCleanup();
    setInterval(runMidnightCleanup, 24 * 60 * 60 * 1000);
  }, delay);
}

async function start() {
  try {
    await prisma.$connect();
    logger.info('Database MySQL terhubung via Prisma.');

    const httpServer = http.createServer(app);
    await initSocket(httpServer);

    // Session cleanup job: emit offline ke pengawas tiap 2 menit (PRD Addendum §47.5)
    setInterval(runSessionCleanup, 2 * 60_000);

    // Midnight session cleanup job: reset active token jam 00:00
    scheduleMidnightCleanup();

    httpServer.listen(PORT, () => {
      logger.info(`ExamPoncol Backend berjalan di http://localhost:${PORT}`);
      logger.info(`Environment: ${process.env.NODE_ENV || 'development'}`);
    });

    const shutdown = async (signal) => {
      logger.warn(`Menerima ${signal}. Mematikan server...`);
      
      const io = getIo();
      if (io) {
        logger.info('Menutup semua koneksi WebSocket...');
        io.close();
      }

      if (typeof httpServer.closeAllConnections === 'function') {
        logger.info('Memutus semua koneksi HTTP aktif...');
        httpServer.closeAllConnections();
      }

      httpServer.close(async () => {
        await prisma.$disconnect();
        logger.info('Server dan koneksi DB dimatikan dengan bersih.');
        process.exit(0);
      });
      setTimeout(() => process.exit(1), 10_000);
    };

    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));
    process.on('uncaughtException', (err) => {
      logger.error('Uncaught Exception:', err);
      shutdown('uncaughtException');
    });
    process.on('unhandledRejection', (reason) => {
      logger.error('Unhandled Rejection:', reason);
    });

  } catch (err) {
    logger.error('Gagal menjalankan server:', err);
    process.exit(1);
  }
}

start();
// Touch: reload server env config for load testing - v3
