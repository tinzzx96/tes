const multer = require('multer');

const ALLOWED_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
const MAX_SIZE_BYTES = (parseInt(process.env.MAX_FILE_SIZE_MB) || 5) * 1024 * 1024;

const fileFilter = (_req, file, cb) => {
  if (ALLOWED_TYPES.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Tipe file tidak diizinkan. Hanya JPG, PNG, GIF, WEBP.'), false);
  }
};

// memoryStorage: file ada di buffer, sharp kompres sebelum disimpan ke disk
module.exports = multer({ storage: multer.memoryStorage(), fileFilter, limits: { fileSize: MAX_SIZE_BYTES } });
