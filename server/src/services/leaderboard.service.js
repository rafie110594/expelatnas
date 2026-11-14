// ============================================================
// Service leaderboard
//
// Urutan: poin desc → tie-break (ClubSettings.tieBreak:
//   MORE_WINS = kemenangan terbanyak, OLDEST_JOINED = bergabung
//   paling dulu) → nomor anggota (penentu akhir, selalu konsisten).
// Posisi dihitung TERLEBIH DAHULU atas seluruh anggota, baru
// filter/pencarian/paginasi diterapkan — posisi tetap global.
// Field publik aman: tanpa email, telepon, status, tanggal lahir.
// ============================================================
const prisma = require('../config/prisma');
const ApiError = require('../utils/ApiError');
const { resolveRank } = require('../utils/rank');
const memberService = require('./member.service');

/** Susun klasemen lengkap (urut + posisi) dari seluruh anggota aktif */
async function buildStandings() {
  const [users, parts, settings, ranks] = await Promise.all([
    prisma.user.findMany({
      where: { role: 'MEMBER', status: 'ACTIVE' },
      include: { profile: true },
    }),
    // Semua partisipasi match selesai — untuk hitung kemenangan (tie-break)
    prisma.matchParticipant.findMany({
      where: { match: { status: 'COMPLETED' } },
      select: {
        memberId: true,
        team: true,
        match: { select: { teamAScore: true, teamBScore: true } },
      },
    }),
    prisma.clubSettings.findUnique({ where: { id: 1 } }),
    memberService.getRankSettings(),
  ]);

  const wins = new Map();
  const losses = new Map();
  for (const p of parts) {
    const { teamAScore, teamBScore } = p.match;
    if (teamAScore == null || teamBScore == null || teamAScore === teamBScore) continue;
    const winner = teamAScore > teamBScore ? 'A' : 'B';
    if (p.team === winner) wins.set(p.memberId, (wins.get(p.memberId) || 0) + 1);
    else losses.set(p.memberId, (losses.get(p.memberId) || 0) + 1);
  }

  const tieBreak = settings?.tieBreak || 'MORE_WINS';

  const items = users
    .filter((u) => u.profile)
    .map((u) => ({
      id: u.id,
      memberNumber: u.profile.memberNumber,
      fullName: u.fullName,
      alias: u.alias || null,
      photoUrl: u.profile.photoUrl,
      currentPoints: u.profile.currentPoints,
      rank: resolveRank(u.profile.currentPoints, ranks),
      wins: wins.get(u.id) || 0,
      losses: losses.get(u.id) || 0,
      matchesPlayed: (wins.get(u.id) || 0) + (losses.get(u.id) || 0),
      dateJoined: u.profile.dateJoined,
    }));

  items.sort((a, b) => {
    if (b.currentPoints !== a.currentPoints) return b.currentPoints - a.currentPoints;
    if (tieBreak === 'OLDEST_JOINED') {
      const d = new Date(a.dateJoined) - new Date(b.dateJoined);
      if (d !== 0) return d;
    } else {
      if (b.wins !== a.wins) return b.wins - a.wins;
    }
    return a.memberNumber.localeCompare(b.memberNumber); // deterministik
  });

  items.forEach((it, i) => {
    it.position = i + 1;
    delete it.dateJoined;
  });

  return { items, tieBreak };
}

// ---------- Daftar leaderboard (publik) ----------

async function list(query) {
  const { page, limit, search, rank } = query;
  const { items: all, tieBreak } = await buildStandings();

  let items = all;
  if (search) {
    const s = search.toLowerCase();
    items = items.filter(
      (i) =>
        i.fullName.toLowerCase().includes(s) ||
        (i.alias || '').toLowerCase().includes(s) ||
        i.memberNumber.toLowerCase().includes(s)
    );
  }
  if (rank === 'NONE') items = items.filter((i) => !i.rank);
  else if (rank) items = items.filter((i) => i.rank && i.rank.name === rank);

  const total = items.length;
  const start = (page - 1) * limit;
  const pageItems = items.slice(start, start + limit).map(({ id, ...safe }) => safe);

  return {
    items: pageItems,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.max(1, Math.ceil(total / limit)),
    },
    tieBreak,
  };
}

// ---------- Posisi sendiri (member login) ----------

async function myPosition(userId) {
  const { items, tieBreak } = await buildStandings();
  const idx = items.findIndex((i) => i.id === userId);
  if (idx === -1) {
    throw ApiError.notFound('Anda tidak terdaftar di leaderboard');
  }
  return {
    position: idx + 1,
    totalParticipants: items.length,
    tieBreak,
    member: items[idx], // milik sendiri: id ikut disertakan
  };
}

module.exports = { list, myPosition, buildStandings };
