// ============================================================
// Konfigurasi environment — validasi variabel wajib saat startup
// ============================================================
require('dotenv').config();
const path = require('path');

const required = ['DATABASE_URL', 'JWT_ACCESS_SECRET', 'JWT_REFRESH_SECRET'];
const missing = required.filter((k) => !process.env[k]);
if (missing.length) {
  console.error(`❌ Variabel environment belum diisi: ${missing.join(', ')}`);
  console.error('   Salin .env.example menjadi .env lalu lengkapi nilainya.');
  process.exit(1);
}

const env = {
  nodeEnv: process.env.NODE_ENV || 'development',
  isProduction: process.env.NODE_ENV === 'production',
  port: Number(process.env.PORT || 4000),
  databaseUrl: process.env.DATABASE_URL,
  corsOrigin: (process.env.CORS_ORIGIN || 'http://localhost:4173')
    .split(',')
    .map((s) => s.trim()),
  jwt: {
    accessSecret: process.env.JWT_ACCESS_SECRET,
    refreshSecret: process.env.JWT_REFRESH_SECRET,
    accessTtl: process.env.JWT_ACCESS_TTL || '15m',
    refreshTtl: process.env.JWT_REFRESH_TTL || '7d',
  },
  uploads: {
    // local = simpan di disk (default) | cloudinary | vercel-blob
    driver: process.env.STORAGE_DRIVER || 'local',
    dir: process.env.UPLOAD_DIR
      ? path.resolve(process.env.UPLOAD_DIR)
      : path.join(__dirname, '..', '..', 'uploads'),
    maxBytes: Math.max(1, Number(process.env.MAX_UPLOAD_MB || 5)) * 1024 * 1024,
    // URL publik asal server — dipakai membangun imageUrl absolut
    publicBaseUrl: (process.env.PUBLIC_BASE_URL || `http://localhost:${process.env.PORT || 4000}`)
      .replace(/\/+$/, ''),
  },
};

module.exports = env;
