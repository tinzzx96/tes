// backend_server/src/routes/admin/importSiswa.routes.js
// FILE BARU

const router  = require('express').Router();
const multer  = require('multer');
const { downloadTemplate, importSiswa, confirmImport } = require('../../controllers/admin/importSiswa.controller');

// Multer: simpan di memory (tidak ke disk), max 5MB
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const ok = file.mimetype === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
            || file.originalname.endsWith('.xlsx');
    cb(ok ? null : new Error('Hanya file .xlsx yang diterima.'), ok);
  },
});

router.get('/siswa/template',     downloadTemplate);
router.post('/siswa',             upload.single('file'), importSiswa);
router.post('/siswa/confirm',     confirmImport);

module.exports = router;