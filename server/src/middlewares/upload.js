// ============================================================
// Middleware upload multipart (multer)
// — buffer di memori, batas tipe & ukuran, disimpan via lib/storage
// ============================================================
const multer = require('multer');

const env = require('../config/env');
const ApiError = require('../utils/ApiError');

const ALLOWED_MIME = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: env.uploads.maxBytes,
    files: 1,
    fields: 20,
  },
  fileFilter: (req, file, cb) => {
    if (ALLOWED_MIME.includes(file.mimetype)) return cb(null, true);
    cb(
      ApiError.badRequest(
        'Tipe file tidak diizinkan. Gunakan JPEG, PNG, WEBP, atau GIF.'
      )
    );
  },
});

module.exports = { upload };
