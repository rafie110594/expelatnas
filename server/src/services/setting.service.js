// ============================================================
// Service pengaturan — ClubSettings & rentang RankSetting
//
// PRINSIP PENTING:
// Mengubah batas rank HANYA mengubah rentang — tidak pernah
// menyentuh poin member. Rank dihitung on-the-fly dari poin
// saat dibaca (utils/rank.js), sehingga poin tetap sama.
// ============================================================
const prisma = require('../config/prisma');
const ApiError = require('../utils/ApiError');
const { writeAudit } = require('../utils/audit');

const EDITABLE_KEYS = [
  'clubName',
  'logoUrl',
  'description',
  'contactEmail',
  'contactPhone',
  'whatsappLink',
  'socialLinks',
  'pointsWin',
  'pointsLoss',
  'registrationOpen',
  'tieBreak',
  'trainingDays',
  'trainingStart',
  'trainingEnd',
  'trainingLocation',
  'trainingMapUrl',
];

function rankView(r) {
  return {
    id: r.id,
    name: r.name,
    minPoints: r.minPoints,
    maxPoints: r.maxPoints,
    order: r.order,
    isActive: r.isActive,
  };
}

/**
 * Validasi tidak ada tumpang-tindih antar rentang rank AKTIF:
 * - satu baris boleh maxPoints null (tanpa batas atas) dan hanya
 *   boleh ada satu — itupun harus yang terakhir (tertinggi)
 * - setiap rentang berikutnya harus mulai > batas atas sebelumnya
 * - minPoints <= maxPoints bila maxPoints diisi
 */
function validateNoOverlap(ranks) {
  const active = ranks
    .filter((r) => r.isActive)
    .sort((a, b) => a.minPoints - b.minPoints);

  for (const r of active) {
    if (r.maxPoints != null && r.maxPoints < r.minPoints) {
      throw ApiError.badRequest(
        `Rentang ${r.name} tidak valid: batas atas (${r.maxPoints}) lebih kecil dari batas bawah (${r.minPoints})`
      );
    }
  }

  const unbounded = active.filter((r) => r.maxPoints == null);
  if (unbounded.length > 1) {
    throw ApiError.badRequest(
      'Hanya boleh ada satu rank tanpa batas atas (biasanya Rank A)'
    );
  }

  for (let i = 0; i < active.length - 1; i++) {
    const cur = active[i];
    const next = active[i + 1];
    if (cur.maxPoints == null) {
      throw ApiError.badRequest(
        `Rentang ${cur.name} tanpa batas atas menimpa rank ${next.name}`
      );
    }
    if (next.minPoints <= cur.maxPoints) {
      throw ApiError.badRequest(
        `Rentang tumpang tindih: ${next.name} mulai di ${next.minPoints}, tetapi ${cur.name} berakhir di ${cur.maxPoints}`
      );
    }
  }
}

/** Cek keunikan nama & urutan terhadap kandidat set penuh */
function checkUniqueness(ranks, candidate, excludeId) {
  for (const r of ranks) {
    if (r.id === excludeId) continue;
    if (r.name === candidate.name) {
      throw ApiError.badRequest(`Nama rank '${candidate.name}' sudah dipakai`);
    }
    if (r.order === candidate.order) {
      throw ApiError.badRequest(
        `Urutan ${candidate.order} sudah dipakai oleh rank '${r.name}'`
      );
    }
  }
}

// ---------- Pengaturan klub ----------

async function getPublic() {
  const [club, ranks, members, matches, events] = await Promise.all([
    prisma.clubSettings.findUnique({ where: { id: 1 } }),
    prisma.rankSetting.findMany({ orderBy: { order: 'asc' } }),
    // Ringkasan angka publik untuk beranda (tanpa data individual)
    prisma.user.count({ where: { role: 'MEMBER', status: 'ACTIVE' } }),
    prisma.match.count({ where: { status: 'COMPLETED' } }),
    prisma.event.count({ where: { status: 'PUBLISHED' } }),
  ]);
  // Hanya field publik — timestamp internal tidak dikirim
  const { createdAt, updatedAt, ...clubPublic } = club || {};
  return {
    club: clubPublic,
    ranks: ranks.map(rankView),
    stats: { members, matches, events },
  };
}

async function updateSettings(input, actor) {
  return prisma.$transaction(
    async (tx) => {
      const before = await tx.clubSettings.findUnique({ where: { id: 1 } });
      if (!before) throw ApiError.notFound('Pengaturan klub tidak ditemukan');

      const patch = {};
      for (const k of EDITABLE_KEYS) {
        if (input[k] !== undefined) patch[k] = input[k];
      }

      const after = await tx.clubSettings.update({ where: { id: 1 }, data: patch });

      await writeAudit(tx, {
        adminId: actor.id,
        action: 'SETTINGS_UPDATE',
        entity: 'ClubSettings',
        entityId: '1',
        before: Object.fromEntries(EDITABLE_KEYS.map((k) => [k, before[k]])),
        after: Object.fromEntries(EDITABLE_KEYS.map((k) => [k, after[k]])),
        note: 'Pengaturan klub diperbarui',
      });

      return after;
    },
    { timeout: 10000 }
  );
}

// ---------- Rentang rank ----------

async function listRanks() {
  const ranks = await prisma.rankSetting.findMany({ orderBy: { order: 'asc' } });
  return ranks.map(rankView);
}

async function createRank(input, actor) {
  const candidate = {
    name: input.name,
    minPoints: input.minPoints,
    maxPoints: input.maxPoints ?? null,
    order: input.order,
    isActive: input.isActive !== false,
  };

  return prisma.$transaction(
    async (tx) => {
      const all = await tx.rankSetting.findMany();
      checkUniqueness(all, candidate, null);
      validateNoOverlap([...all, candidate]);

      const created = await tx.rankSetting.create({ data: candidate });

      await writeAudit(tx, {
        adminId: actor.id,
        action: 'RANK_CREATE',
        entity: 'RankSetting',
        entityId: created.id,
        after: rankView(created),
        note: 'Rentang rank baru ditambahkan (poin member tidak berubah)',
      });
      return rankView(created);
    },
    { timeout: 10000 }
  );
}

async function updateRank(id, input, actor) {
  return prisma.$transaction(
    async (tx) => {
      const all = await tx.rankSetting.findMany();
      const target = all.find((r) => r.id === id);
      if (!target) throw ApiError.notFound('Rank tidak ditemukan');

      const patch = {};
      for (const k of ['name', 'minPoints', 'maxPoints', 'order', 'isActive']) {
        if (input[k] !== undefined) patch[k] = input[k];
      }

      // Uji kandidat penuh SEBELUM menyimpan
      const candidate = all.map((r) => (r.id === id ? { ...r, ...patch } : r));
      const candSelf = candidate.find((r) => r.id === id);
      checkUniqueness(candidate, candSelf, id);
      validateNoOverlap(candidate);

      const updated = await tx.rankSetting.update({ where: { id }, data: patch });

      await writeAudit(tx, {
        adminId: actor.id,
        action: 'RANK_UPDATE',
        entity: 'RankSetting',
        entityId: id,
        before: rankView(target),
        after: rankView(updated),
        note: 'Rentang rank diubah — poin member TIDAK berubah',
      });
      return rankView(updated);
    },
    { timeout: 10000 }
  );
}

async function deleteRank(id, actor) {
  return prisma.$transaction(
    async (tx) => {
      const target = await tx.rankSetting.findUnique({ where: { id } });
      if (!target) throw ApiError.notFound('Rank tidak ditemukan');

      // Menghapus rentang hanya membuat celah — tidak bisa memunculkan
      // tumpang tindih, jadi tidak perlu validasi ulang.
      await tx.rankSetting.delete({ where: { id } });

      await writeAudit(tx, {
        adminId: actor.id,
        action: 'RANK_DELETE',
        entity: 'RankSetting',
        entityId: id,
        before: rankView(target),
        note: 'Rentang rank dihapus (poin member tidak berubah)',
      });
      return { id, deleted: true };
    },
    { timeout: 10000 }
  );
}

module.exports = {
  getPublic,
  updateSettings,
  listRanks,
  createRank,
  updateRank,
  deleteRank,
};
