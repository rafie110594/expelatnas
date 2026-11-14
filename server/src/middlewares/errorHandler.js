// ============================================================
// Middleware penanganan error terpusat
// ============================================================
const env = require('../config/env');
const ApiError = require('../utils/ApiError');

// eslint-disable-next-line no-unused-vars
function notFoundHandler(req, res, next) {
  res.status(404).json({
    success: false,
    message: `Endpoint tidak ditemukan: ${req.method} ${req.originalUrl}`,
  });
}

// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
  // Error multer (upload) → status yang jelas ke klien
  if (err && typeof err.code === 'string' && err.code.startsWith('LIMIT_')) {
    const map = {
      LIMIT_FILE_SIZE: [413, 'Ukuran file melebihi batas yang diizinkan'],
      LIMIT_FILE_COUNT: [400, 'Terlalu banyak file dalam satu permintaan'],
      LIMIT_FIELD_COUNT: [400, 'Terlalu banyak field dalam satu permintaan'],
    };
    const [status, message] = map[err.code] || [400, 'Permintaan upload tidak valid'];
    return res.status(status).json({ success: false, message });
  }

  // Error Prisma yang umum dipetakan ke status yang benar
  if (err.code === 'P2002') {
    return res.status(409).json({
      success: false,
      message: 'Data sudah ada (unique constraint)',
    });
  }
  if (err.code === 'P2025') {
    return res.status(404).json({
      success: false,
      message: 'Data tidak ditemukan',
    });
  }

  const statusCode = err instanceof ApiError ? err.statusCode : err.statusCode || 500;
  const message = err.isOperational || statusCode < 500 ? err.message : 'Terjadi kesalahan pada server';

  if (statusCode >= 500) {
    console.error('[ERROR]', err);
  }

  res.status(statusCode).json({
    success: false,
    message,
    ...(err.details ? { details: err.details } : {}),
    ...(!env.isProduction && statusCode >= 500 ? { stack: err.stack } : {}),
  });
}

module.exports = { notFoundHandler, errorHandler };
