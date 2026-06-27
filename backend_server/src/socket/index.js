const { Server } = require('socket.io');
const { verify } = require('../utils/jwt');
const logger = require('../utils/logger');
const prisma = require('../config/database');

let io = null;

async function initSocket(httpServer) {
  io = new Server(httpServer, {
    cors: {
      origin: (process.env.CORS_ORIGINS || '').split(',').map(o => o.trim()).filter(Boolean),
      methods: ['GET', 'POST'],
      credentials: true,
    },
  });

  // Redis adapter untuk horizontal scaling (PM2 cluster / multi-instance).
  // Graceful fallback: jika Redis tidak tersedia, tetap jalan dengan in-memory adapter.
  if (process.env.REDIS_URL) {
    try {
      const { createAdapter } = require('@socket.io/redis-adapter');
      const { createClient } = require('redis');
      const pubClient = createClient({ url: process.env.REDIS_URL });
      const subClient = pubClient.duplicate();
      await Promise.all([pubClient.connect(), subClient.connect()]);
      io.adapter(createAdapter(pubClient, subClient));
      logger.info('Socket.io Redis adapter aktif.');
    } catch (err) {
      logger.warn('Redis adapter gagal, fallback ke in-memory:', err.message);
    }
  } else {
    logger.warn('REDIS_URL tidak diset — Socket.io pakai in-memory adapter (single-instance only).');
  }

  io.use((socket, next) => {
    try {
      const token = socket.handshake.auth?.token;
      if (!token) return next(new Error('Token wajib untuk koneksi WebSocket.'));
      socket.user = verify(token);
      next();
    } catch {
      next(new Error('Token tidak valid.'));
    }
  });

  io.on('connection', (socket) => {
    logger.info(`WebSocket terhubung: userId=${socket.user?.id} role=${socket.user?.role}`);

    socket.on('join-room', ({ roomName, roomId }) => {
      if (roomId) {
        socket.join(`room-channel-${roomId}`);
        logger.info(`Socket userId=${socket.user?.id} bergabung channel: room-channel-${roomId}`);
      }
      if (roomName) {
        socket.join(`room-channel-${roomName}`);
        socket.join(`room:${roomName}`);
        logger.info(`Socket userId=${socket.user?.id} bergabung channel: room-channel-${roomName}`);
      }
    });

    socket.on('pin-generated', (payload) => {
      logger.info(`Forwarding pin-generated event: studentId=${payload.studentId}`);
      const roomId = payload.roomId;
      const roomName = payload.roomName;
      if (roomId) {
        io.to(`room-channel-${roomId}`).emit('pin-generated', payload);
      }
      if (roomName) {
        io.to(`room-channel-${roomName}`).emit('pin-generated', payload);
        io.to(`room:${roomName}`).emit('pin-generated', payload);
      }
    });

    socket.on('disconnect', () => {
      logger.info(`WebSocket putus: userId=${socket.user?.id}`);
    });
  });

  // Cek siswa yang BARU SAJA offline (dalam window 30 detik terakhir) setiap 30 detik.
  // Batas bawah 90s + 30s = 120s: hindari emit berulang untuk siswa yang sudah lama offline.
  const OFFLINE_THRESHOLD_MS = 90_000;
  const CHECK_INTERVAL_MS = 30_000;
  setInterval(async () => {
    try {
      const now = Date.now();
      const offlineCutoff = new Date(now - OFFLINE_THRESHOLD_MS);
      const windowStart  = new Date(now - OFFLINE_THRESHOLD_MS - CHECK_INTERVAL_MS);

      const justWentOffline = await prisma.examAttempt.findMany({
        where: {
          status: 'started',
          updatedAt: { lt: offlineCutoff, gte: windowStart },
        },
        include: { user: { select: { id: true, room: true, roomId: true } } },
      });

      for (const attempt of justWentOffline) {
        const roomName = attempt.user?.room;
        const roomId = attempt.user?.roomId;
        const payload = {
          studentId: `stu_${attempt.user.id}`,
          status: 'offline',
          roomId,
        };
        if (roomId) {
          io.to(`room-channel-${roomId}`).emit('student-status-changed', payload);
        }
        if (roomName) {
          io.to(`room-channel-${roomName}`).emit('student-status-changed', payload);
          io.to(`room:${roomName}`).emit('student-status-changed', payload);
        }
      }
    } catch (err) {
      logger.error('Offline check error:', err);
    }
  }, CHECK_INTERVAL_MS);

  return io;
}

function getIo() {
  return io;
}

function emitPinGenerated(roomName, payload) {
  if (!io) return;
  const roomId = payload.roomId;
  if (roomId) {
    io.to(`room-channel-${roomId}`).emit('pin-generated', payload);
  }
  if (roomName) {
    io.to(`room-channel-${roomName}`).emit('pin-generated', payload);
    io.to(`room:${roomName}`).emit('pin-generated', payload);
  }
}

function emitStudentStatusChanged(roomName, payload) {
  if (!io) return;
  const roomId = payload.roomId;
  if (roomId) {
    io.to(`room-channel-${roomId}`).emit('student-status-changed', payload);
  }
  if (roomName) {
    io.to(`room-channel-${roomName}`).emit('student-status-changed', payload);
    io.to(`room:${roomName}`).emit('student-status-changed', payload);
  }
}

module.exports = { initSocket, getIo, emitPinGenerated, emitStudentStatusChanged };
