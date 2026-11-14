// ============================================================
// Generator nomor anggota PB-XXXX (aman dari tabrakan unique)
// ============================================================
const ApiError = require('../utils/ApiError');

/**
 * Buat nomor anggota unik berikutnya. Harus dipanggil di dalam
 * transaksi yang sama dengan pembuatan profil.
 * @param tx transaksi Prisma aktif
 * @returns {Promise<string>} contoh: 'PB-0004'
 */
async function generateMemberNumber(tx) {
  const count = await tx.memberProfile.count();
  for (let i = 0; i < 1000; i++) {
    const candidate = `PB-${String(count + 1 + i).padStart(4, '0')}`;
    const found = await tx.memberProfile.findUnique({
      where: { memberNumber: candidate },
    });
    if (!found) return candidate;
  }
  throw ApiError.internal('Gagal membuat nomor anggota');
}

module.exports = { generateMemberNumber };
