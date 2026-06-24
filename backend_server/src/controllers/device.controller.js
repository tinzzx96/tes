const prisma = require('../config/database');
const { ok } = require('../utils/response');

async function updateStatus(req, res, next) {
  try {
    const { device, network, seb_active } = req.body;
    const user = req.user;

    if (device) {
      await prisma.user.update({ where: { id: user.id }, data: { device } });
    }

    const fresh = await prisma.user.findUnique({ where: { id: user.id } });

    return ok(res, {
      status: 'online',
      device: fresh.device,
      room: fresh.room,
      verified: fresh.verified,
      sebActive: seb_active ?? null,
      network: network ?? null,
      timestamp: new Date().toISOString(),
    });
  } catch (e) { next(e); }
}

module.exports = { updateStatus };
