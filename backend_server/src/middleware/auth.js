const { verify } = require('../utils/jwt');
const prisma = require('../config/database');
const { unauthorized } = require('../utils/response');

async function authenticate(req, res, next) {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    return unauthorized(res, 'Token tidak ditemukan.');
  }

  const token = header.slice(7);
  try {
    const payload = verify(token);
    const user = await prisma.user.findUnique({ where: { id: payload.id } });
    if (!user) return unauthorized(res, 'Pengguna tidak ditemukan.');
    req.user = user;
    next();
  } catch {
    return unauthorized(res);
  }
}

module.exports = { authenticate };
