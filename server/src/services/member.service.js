// ============================================================
// Service anggota — data member, poin, statistik
// ============================================================
const bcrypt = require('bcrypt');

const prisma = require('../config/prisma');
const ApiError = require('../utils/ApiError');
const { resolveRank } = require('../utils/rank');
const { writeAudit } = require('../utils/audit');
const { generateMemberNumber } = require('../utils/memberNumber');
const { saveImage, removeImage } = require('../lib/storage');
const pointsService = require('./points.service');

async function getRankSettings() {
  return prisma.rankSetting.findMany({
    where: { isActive: true },
    orderBy: { order: 'asc' },
  });
}

/** Bentuk aman untuk daftar/detail member (tanpa hash, tanpa internal) */
function toMemberItem(profile, ranks) {
  const u = profile.user;
  return {
    id: u.id,
    memberNumber: profile.memberNumber,
    fullName: u.fullName,
    alias: u.alias || null,
    email: u.email,
    role: u.role,
    status: u.status,
    photoUrl: profile.photoUrl,
    phone: profile.phone,
    dateJoined: profile.dateJoined,
    birthDate: profile.birthDate,
    gender: profile.gender,
    genderCategory: profile.genderCategory,
    doublesRole: profile.doublesRole,
    dominantHand: profile.dominantHand,
    background: profile.background,
    racket: profile.racket,
    initialPoints: profile.initialPoints,
    currentPoints: profile.currentPoints,
    rank: resolveRank(profile.currentPoints, ranks),
    createdAt: u.createdAt,
  };
}

/** Statistik pertandingan seorang anggota (dihitung dari ledger) */
async function computeStats(userId) {
  const parts = await prisma.matchParticipant.findMany({
    where: { memberId: userId, match: { status: 'COMPLETED' } },
    include: {
      match: {
        select: {
          id: true,
          title: true,
          teamAScore: true,
          teamBScore: true,
          scheduledAt: true,
          completedAt: true,
          createdAt: true,
        },
      },
    },
  });

  let wins = 0;
  let losses = 0;
  const form = [];
  for (const p of parts) {
    const m = p.match;
    const winner = pointsService.winnerSideOf(m);
    if (!winner) continue; // skor belum ada / tidak valid
    const isWin = p.team === winner;
    if (isWin) wins++;
    else losses++;
    form.push({
      matchId: m.id,
      title: m.title,
      win: isWin,
      playedAt: m.completedAt || m.scheduledAt || m.createdAt,
    });
  }
  form.sort((a, b) => new Date(b.playedAt) - new Date(a.playedAt));

  const total = wins + losses;

  // Streak terkini (dari pertandingan terbaru)
  let streakType = null;
  let streakCount = 0;
  for (const f of form) {
    const t = f.win ? 'win' : 'lose';
    if (streakType === null) {
      streakType = t;
      streakCount = 1;
    } else if (t === streakType) {
      streakCount++;
    } else {
      break;
    }
  }

  // Akumulasi poin dari hasil match (hanya yang masih aktif)
  const [sumWin, sumLoss] = await Promise.all([
    prisma.pointTransaction.aggregate({
      where: { memberId: userId, type: 'MATCH_WIN', isReversed: false, reversesId: null },
      _sum: { delta: true },
    }),
    prisma.pointTransaction.aggregate({
      where: { memberId: userId, type: 'MATCH_LOSS', isReversed: false, reversesId: null },
      _sum: { delta: true },
    }),
  ]);

  return {
    totalMatches: total,
    wins,
    losses,
    winRate: total ? Math.round((wins / total) * 1000) / 10 : 0,
    recentForm: form.slice(0, 10).map((f) => (f.win ? 'W' : 'L')),
    currentStreak: streakType ? { type: streakType, count: streakCount } : null,
    pointsFromWins: sumWin._sum.delta ?? 0,
    pointsFromLosses: sumLoss._sum.delta ?? 0,
  };
}

// ---------- Daftar anggota (admin) ----------

async function list(query) {
  const { page, limit, search, rank, status } = query;

  const or = search
    ? [
        { fullName: { contains: search, mode: 'insensitive' } },
        { alias: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
        { profile: { is: { memberNumber: { contains: search, mode: 'insensitive' } } } },
      ]
    : undefined;

  const rows = await prisma.user.findMany({
    where: {
      role: 'MEMBER',
      ...(status ? { status } : {}),
      ...(or ? { OR: or } : {}),
    },
    include: { profile: true },
    orderBy: { createdAt: 'asc' },
  });

  const ranks = await getRankSettings();
  let items = rows
    .filter((u) => u.profile)
    .map((u) => {
      const p = u.profile;
      p.user = u;
      return toMemberItem(p, ranks);
    });

  // Urut: poin tertinggi dulu, tie-break nomor anggota (konsisten)
  items.sort(
    (a, b) => b.currentPoints - a.currentPoints || a.memberNumber.localeCompare(b.memberNumber)
  );

  // Filter rank dilakukan setelah resolusi rank (poin → rentang)
  if (rank === 'NONE') items = items.filter((i) => !i.rank);
  else if (rank) items = items.filter((i) => i.rank && i.rank.name === rank);

  const total = items.length;
  const start = (page - 1) * limit;
  items = items.slice(start, start + limit);

  return {
    items,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.max(1, Math.ceil(total / limit)),
    },
  };
}

// ---------- Detail anggota (admin) ----------

async function detail(userId) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: { profile: true },
  });
  if (!user || user.role !== 'MEMBER') throw ApiError.notFound('Anggota tidak ditemukan');
  if (!user.profile) throw ApiError.notFound('Profil anggota tidak ditemukan');

  const [ranks, txs, stats] = await Promise.all([
    getRankSettings(),
    prisma.pointTransaction.findMany({
      where: { memberId: userId },
      orderBy: { createdAt: 'desc' },
      take: 20,
      include: { match: { select: { id: true, title: true } } },
    }),
    computeStats(userId),
  ]);

  return {
    member: toMemberItem({ ...user.profile, user }, ranks),
    stats,
    transactions: txs.map((t) => ({
      id: t.id,
      type: t.type,
      pointsBefore: t.pointsBefore,
      delta: t.delta,
      pointsAfter: t.pointsAfter,
      reason: t.reason,
      isReversed: t.isReversed,
      reversesId: t.reversesId,
      match: t.match,
      createdAt: t.createdAt,
    })),
  };
}

// ---------- Buat anggota (admin) ----------

function profileDataFrom(input) {
  return {
    gender: input.gender ?? null,
    phone: input.phone ?? null,
    birthDate: input.birthDate ? new Date(input.birthDate) : null,
    genderCategory: input.genderCategory ?? null,
    doublesRole: input.doublesRole ?? null,
    dominantHand: input.dominantHand ?? null,
    background: input.background ?? null,
    racket: input.racket ?? null,
  };
}

async function create(input, actor) {
  const existing = await prisma.user.findUnique({ where: { email: input.email } });
  if (existing) throw ApiError.conflict('Email sudah terdaftar');

  const passwordHash = await bcrypt.hash(input.password, 10);
  const initialPoints = input.initialPoints || 0;

  const created = await prisma.$transaction(
    async (tx) => {
      const user = await tx.user.create({
        data: {
          fullName: input.fullName,
          alias: input.alias || null,
          email: input.email,
          passwordHash,
          role: 'MEMBER',
          status: 'ACTIVE',
        },
      });
      const memberNumber = await generateMemberNumber(tx);
      const profile = await tx.memberProfile.create({
        data: {
          userId: user.id,
          memberNumber,
          ...profileDataFrom(input),
          initialPoints,
          currentPoints: initialPoints,
        },
      });

      // Ledger poin awal bila admin memberi poin > 0
      if (initialPoints > 0) {
        await tx.pointTransaction.create({
          data: {
            memberId: user.id,
            type: 'INITIAL',
            pointsBefore: 0,
            delta: initialPoints,
            pointsAfter: initialPoints,
            reason: 'Poin awal saat pembuatan akun oleh admin',
            createdBy: actor.id,
          },
        });
      }

      await writeAudit(tx, {
        adminId: actor.id,
        action: 'MEMBER_CREATE',
        entity: 'User',
        entityId: user.id,
        after: {
          fullName: user.fullName,
          email: user.email,
          memberNumber,
          initialPoints,
        },
        note: 'Anggota dibuat oleh admin',
      });

      return { user, profile };
    },
    { timeout: 10000 }
  );

  const full = await prisma.user.findUnique({
    where: { id: created.user.id },
    include: { profile: true },
  });
  return toMemberItem({ ...full.profile, user: full }, await getRankSettings());
}

// ---------- Update anggota (admin) ----------

async function update(userId, input, actor) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: { profile: true },
  });
  if (!user || user.role !== 'MEMBER') throw ApiError.notFound('Anggota tidak ditemukan');
  if (!user.profile) throw ApiError.notFound('Profil anggota tidak ditemukan');

  const userPatch = {};
  if (input.fullName !== undefined) userPatch.fullName = input.fullName;
  if (input.alias !== undefined) userPatch.alias = input.alias || null;
  if (input.status !== undefined) userPatch.status = input.status;

  const profilePatch = {};
  const nullableKeys = [
    'gender',
    'phone',
    'birthDate',
    'genderCategory',
    'doublesRole',
    'dominantHand',
    'background',
    'racket',
  ];
  for (const k of nullableKeys) {
    if (input[k] !== undefined) {
      profilePatch[k] = k === 'birthDate' && input[k] ? new Date(input[k]) : input[k];
    }
  }

  const before = {
    fullName: user.fullName,
    alias: user.alias,
    status: user.status,
    gender: user.profile.gender,
    phone: user.profile.phone,
    birthDate: user.profile.birthDate,
    genderCategory: user.profile.genderCategory,
    doublesRole: user.profile.doublesRole,
    dominantHand: user.profile.dominantHand,
    background: user.profile.background,
    racket: user.profile.racket,
  };

  await prisma.$transaction(
    async (tx) => {
      if (Object.keys(userPatch).length) {
        await tx.user.update({ where: { id: userId }, data: userPatch });
      }
      if (Object.keys(profilePatch).length) {
        await tx.memberProfile.update({ where: { userId }, data: profilePatch });
      }
      await writeAudit(tx, {
        adminId: actor.id,
        action: 'MEMBER_UPDATE',
        entity: 'User',
        entityId: userId,
        before,
        after: { ...before, ...userPatch, ...profilePatch },
        note: 'Data anggota diperbarui oleh admin',
      });
    },
    { timeout: 10000 }
  );

  const full = await prisma.user.findUnique({
    where: { id: userId },
    include: { profile: true },
  });
  return toMemberItem({ ...full.profile, user: full }, await getRankSettings());
}

// ---------- Penyesuaian poin manual (admin) ----------

async function adjustPoints(userId, { delta, reason }, actor) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: { profile: true },
  });
  if (!user || user.role !== 'MEMBER') throw ApiError.notFound('Anggota tidak ditemukan');
  if (!user.profile) throw ApiError.notFound('Profil anggota tidak ditemukan');

  const txRow = await prisma.$transaction(
    async (tx) => {
      const row = await pointsService.writeTx(tx, {
        memberId: userId,
        type: 'ADJUSTMENT',
        delta,
        reason,
        createdBy: actor.id,
      });
      await writeAudit(tx, {
        adminId: actor.id,
        action: 'POINT_ADJUST',
        entity: 'MemberProfile',
        entityId: user.profile.id,
        before: { currentPoints: row.pointsBefore },
        after: { currentPoints: row.pointsAfter },
        note: reason,
      });
      return row;
    },
    { timeout: 10000 }
  );

  return {
    transactionId: txRow.id,
    before: txRow.pointsBefore,
    delta: txRow.delta,
    after: txRow.pointsAfter,
    rank: resolveRank(txRow.pointsAfter, await getRankSettings()),
  };
}

// ---------- Profil sendiri ----------

async function getMyStats(userId) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: { profile: true },
  });
  if (!user || !user.profile) throw ApiError.notFound('Profil anggota tidak ditemukan');

  const monthStart = new Date();
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);

  const [stats, ranks, monthAgg, recentTxs] = await Promise.all([
    computeStats(userId),
    getRankSettings(),
    // Net perubahan poin bulan berjalan (semua tipe, termasuk reversal koreksi)
    prisma.pointTransaction.aggregate({
      where: { memberId: userId, createdAt: { gte: monthStart } },
      _sum: { delta: true },
    }),
    // 12 transaksi terakhir → deret tren untuk chart
    prisma.pointTransaction.findMany({
      where: { memberId: userId },
      orderBy: { createdAt: 'desc' },
      take: 12,
      select: { createdAt: true, delta: true, pointsAfter: true, type: true },
    }),
  ]);

  return {
    id: user.id,
    fullName: user.fullName,
    alias: user.alias || null,
    memberNumber: user.profile.memberNumber,
    photoUrl: user.profile.photoUrl,
    gender: user.profile.gender,
    currentPoints: user.profile.currentPoints,
    rank: resolveRank(user.profile.currentPoints, ranks),
    pointsThisMonth: monthAgg._sum.delta ?? 0,
    trend: recentTxs.reverse().map((t) => ({
      createdAt: t.createdAt,
      delta: t.delta,
      pointsAfter: t.pointsAfter,
      type: t.type,
    })),
    ...stats,
  };
}

async function updateMyProfile(userId, input) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: { profile: true },
  });
  if (!user || !user.profile) throw ApiError.notFound('Profil anggota tidak ditemukan');

  const userPatch = {};
  if (input.fullName !== undefined) userPatch.fullName = input.fullName;

  const profilePatch = {};
  const nullableKeys = [
    'gender',
    'phone',
    'birthDate',
    'genderCategory',
    'doublesRole',
    'dominantHand',
    'background',
    'racket',
  ];
  for (const k of nullableKeys) {
    if (input[k] !== undefined) {
      profilePatch[k] = k === 'birthDate' && input[k] ? new Date(input[k]) : input[k];
    }
  }

  await prisma.$transaction(
    async (tx) => {
      if (Object.keys(userPatch).length) {
        await tx.user.update({ where: { id: userId }, data: userPatch });
      }
      if (Object.keys(profilePatch).length) {
        await tx.memberProfile.update({ where: { userId }, data: profilePatch });
      }
      await writeAudit(tx, {
        adminId: userId, // pencatat = pemilik profil
        action: 'PROFILE_SELF_UPDATE',
        entity: 'User',
        entityId: userId,
        after: { ...userPatch, ...profilePatch },
        note: 'Profil diperbarui oleh pemilik akun',
      });
    },
    { timeout: 10000 }
  );

  const full = await prisma.user.findUnique({
    where: { id: userId },
    include: { profile: true },
  });
  return toMemberItem({ ...full.profile, user: full }, await getRankSettings());
}

/** Ganti foto profil sendiri (upload gambar) — file lama dibersihkan */
async function changeMyPhoto(userId, file) {
  if (!file) throw ApiError.badRequest('Foto wajib di-upload');
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: { profile: true },
  });
  if (!user || !user.profile) throw ApiError.notFound('Profil anggota tidak ditemukan');

  const saved = await saveImage(file.buffer, file.mimetype);
  const oldUrl = user.profile.photoUrl;

  try {
    await prisma.$transaction(
      async (tx) => {
        await tx.memberProfile.update({
          where: { userId },
          data: { photoUrl: saved.url },
        });
        await writeAudit(tx, {
          adminId: userId, // pencatat = pemilik profil
          action: 'PROFILE_SELF_UPDATE',
          entity: 'MemberProfile',
          entityId: user.profile.id,
          before: { photoUrl: oldUrl },
          after: { photoUrl: saved.url },
          note: 'Foto profil diperbarui oleh pemilik akun',
        });
      },
      { timeout: 10000 }
    );
  } catch (err) {
    await removeImage(saved.publicId); // bersihkan file baru bila gagal
    throw err;
  }

  // File lama dihapus setelah transaksi sukses
  if (oldUrl && oldUrl.includes('/uploads/')) {
    await removeImage(oldUrl.split('/uploads/')[1]);
  }
  return { photoUrl: saved.url };
}

module.exports = {
  list,
  detail,
  create,
  update,
  adjustPoints,
  getMyStats,
  updateMyProfile,
  changeMyPhoto,
  getRankSettings,
  computeStats,
  toMemberItem,
};
