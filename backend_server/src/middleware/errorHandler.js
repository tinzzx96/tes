const logger = require('../utils/logger');

function errorHandler(err, req, res, _next) {
  logger.error(`${req.method} ${req.originalUrl} — ${err.message}`, { stack: err.stack });

  if (err.name === 'MulterError') {
    return res.status(422).json({ success: false, message: `Upload gagal: ${err.message}` });
  }

  if (err.code === 'P2025') {
    return res.status(404).json({ success: false, message: 'Data tidak ditemukan.' });
  }

  if (err.code === 'P2002') {
    return res.status(409).json({ success: false, message: 'Data sudah ada (duplikat).' });
  }

  const status = err.status || 500;
  const message = process.env.NODE_ENV === 'production' && status === 500
    ? 'Terjadi kesalahan pada server.'
    : err.message;

  res.status(status).json({ success: false, message });
}

module.exports = { errorHandler };
