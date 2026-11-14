// ============================================================
// Entry point — menjalankan HTTP server
// ============================================================
const env = require('./config/env');
const prisma = require('./config/prisma');
const app = require('./app');

const server = app.listen(env.port, () => {
  console.log(`🚀 PB EX PELATNAS API berjalan di http://localhost:${env.port}`);
  console.log(`   Health check: http://localhost:${env.port}/api/health`);
});

// Pastikan koneksi DB tersambung
prisma
  .$connect()
  .then(() => console.log('   Database: terhubung (PostgreSQL)'))
  .catch((err) => {
    console.error('   Database: GAGAL terhubung —', err.message);
    process.exit(1);
  });

// Graceful shutdown
const shutdown = async () => {
  console.log('\n🛑 Mematikan server...');
  server.close(async () => {
    await prisma.$disconnect();
    process.exit(0);
  });
};
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
