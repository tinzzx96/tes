const rateLimit = require('express-rate-limit');

const windowMs = parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 60_000;
const max = parseInt(process.env.RATE_LIMIT_MAX) || 100;

const globalLimiter = rateLimit({
  windowMs,
  max,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Terlalu banyak request, coba lagi nanti.' },
});

// Lebih ketat untuk login — cegah brute force
const loginLimiter = rateLimit({
  windowMs: 15 * 60_000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Terlalu banyak percobaan login. Tunggu 15 menit.' },
});

// Sangat ketat untuk verify-unlock — PIN hanya 4 digit, brute-force 0000–9999 (PRD Bagian 47 §6.3).
// Key: IP + examAttemptId agar siswa berbeda tidak berbagi kuota limit.
const verifyUnlockLimiter = rateLimit({
  windowMs: 5 * 60_000,
  max: 3,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    const ip = req.headers['x-forwarded-for']?.split(',')[0] || req.socket.remoteAddress || 'unknown';
    const attemptId = req.body?.examAttemptId ?? 'unknown';
    return `verify-unlock:${ip}:${attemptId}`;
  },
  message: {
    success: false,
    error: {
      code: 'TOO_MANY_ATTEMPTS',
      message: 'Terlalu banyak percobaan PIN. Tunggu 5 menit.',
    },
  },
});

module.exports = { globalLimiter, loginLimiter, verifyUnlockLimiter };
