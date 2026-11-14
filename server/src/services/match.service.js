// ============================================================
// Service pertandingan — pencatatan skor, koreksi, riwayat
//
// Poin diterapkan DALAM transaksi yang sama dengan pembuatan match.
// Koreksi: transaksi lama → REVERSAL (dibatalkan), lalu hasil baru
// ditulis ulang. Skor asli disimpan di originalTeamAScore/BScore,
// riwayat koreksi lengkap ada di AuditLog + ledger poin.
// ============================================================
const prisma = require('../config/prisma');
const ApiError = require('../utils/ApiError');
const { writeAudit } = require('../utils/audit');
const pointsService = require('./points.service');

/** Bentuk ringkas match untuk response list/detail */
function toMatchItem(m) {
  const winnerSide = pointsService.winnerSideOf(m);
  const side = (s) =>
    m.participants
      .filter((p) => p.team === s)
      .sort((a, b) => a.position - b.position)
      .map((p) => ({
        id: p.memberId,
        fullName: p.member?.fullName,
        alias: p.member?.alias || null,
        memberNumber: p.member?.profile?.memberNumber || null,
      }));

  const txs = m.pointTransactions || [];
  const pointsApplied = txs.some((t) => !t.isReversed && !t.reversesId);

  return {
    id: m.id,
    title: m.title,
    matchType: m.matchType,
    status: m.status,
    teamAScore: m.teamAScore,
    teamBScore: m.teamBScore,
    winnerSide,
    originalTeamAScore: m.originalTeamAScore,
    originalTeamBScore: m.originalTeamBScore,
    correctionReason: m.correctionReason,
    isCorrected: m.originalTeamAScore != null,
    pointsApplied,
    scheduledAt: m.scheduledAt,
    completedAt: m.completedAt,
    createdAt: m.createdAt,
    teams: { A: side('A'), B: side('B') },
    recordedBy: m.recordedBy?.fullName || null,
  };
}

const MATCH_INCLUDE = {
  participants: {
    include: {
      member: {
        select: {
          id: true,
          fullName: true,
          alias: true,
          profile: { select: { memberNumber: true } },
        },
      },
    },
  },
  recordedBy: { select: { fullName: true } },
};

// ---------- Catat pertandingan baru (admin) ----------

async function create(input, actor) {
  const allIds = [...input.teamA, ...input.teamB];
  if (new Set(allIds).size !== allIds.length) {
    throw ApiError.badRequest('Seorang anggota tidak boleh berada di kedua tim');
  }

  // Semua peserta harus anggota klub aktif yang punya profil
  const users = await prisma.user.findMany({
    where: { id: { in: allIds }, role: 'MEMBER', status: 'ACTIVE' },
    include: { profile: { select: { userId: true } } },
  });
  if (users.filter((u) => u.profile).length !== allIds.length) {
    throw ApiError.badRequest('Semua peserta harus terdaftar sebagai anggota aktif');
  }

  const winnerSide =
    input.teamAScore > input.teamBScore ? 'A' : 'B';

  const created = await prisma.$transaction(
    async (tx) => {
      const match = await tx.match.create({
        data: {
          title: input.title,
          matchType: input.matchType,
          status: 'COMPLETED',
          scheduledAt: input.scheduledAt ? new Date(input.scheduledAt) : null,
          teamAScore: input.teamAScore,
          teamBScore: input.teamBScore,
          recordedById: actor.id,
          completedAt: new Date(),
        },
      });

      // Buat peserta
      const participants = [];
      let posA = 0;
      let posB = 0;
      for (const memberId of input.teamA) {
        participants.push(
          await tx.matchParticipant.create({
            data: { matchId: match.id, memberId, team: 'A', position: posA++ },
          })
        );
      }
      for (const memberId of input.teamB) {
        participants.push(
          await tx.matchParticipant.create({
            data: { matchId: match.id, memberId, team: 'B', position: posB++ },
          })
        );
      }

      // Terapkan poin atomik (winner +win, loser +loss)
      await pointsService.applyMatchResult(tx, {
        matchId: match.id,
        participants,
        teamAScore: input.teamAScore,
        teamBScore: input.teamBScore,
        createdBy: actor.id,
      });

      await writeAudit(tx, {
        adminId: actor.id,
        action: 'MATCH_COMPLETE',
        entity: 'Match',
        entityId: match.id,
        after: {
          title: match.title,
          teamAScore: match.teamAScore,
          teamBScore: match.teamBScore,
          winnerSide,
        },
        note: 'Pertandingan dicatat, poin diterapkan',
      });

      return match;
    },
    { timeout: 15000, maxWait: 5000 }
  );

  return detail(created.id);
}

// ---------- Daftar pertandingan (admin) ----------

async function list(query) {
  const { page, limit, search, status } = query;
  const where = {
    ...(status ? { status } : {}),
    ...(search ? { title: { contains: search, mode: 'insensitive' } } : {}),
  };

  const [rows, total] = await Promise.all([
    prisma.match.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
      include: MATCH_INCLUDE,
    }),
    prisma.match.count({ where }),
  ]);

  return {
    items: rows.map(toMatchItem),
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.max(1, Math.ceil(total / limit)),
    },
  };
}

// ---------- Detail pertandingan (admin) ----------

async function detail(matchId) {
  const m = await prisma.match.findUnique({
    where: { id: matchId },
    include: {
      ...MATCH_INCLUDE,
      pointTransactions: {
        orderBy: { createdAt: 'asc' },
        include: { member: { select: { fullName: true } } },
      },
    },
  });
  if (!m) throw ApiError.notFound('Pertandingan tidak ditemukan');

  return {
    ...toMatchItem(m),
    transactions: m.pointTransactions.map((t) => ({
      id: t.id,
      member: t.member?.fullName,
      type: t.type,
      pointsBefore: t.pointsBefore,
      delta: t.delta,
      pointsAfter: t.pointsAfter,
      reason: t.reason,
      isReversed: t.isReversed,
      reversesId: t.reversesId,
      createdAt: t.createdAt,
    })),
  };
}

// ---------- Koreksi skor (admin) ----------

async function correct(matchId, input, actor) {
  await prisma.$transaction(
    async (tx) => {
      // 1. Kunci baris match → koreksi paralel pada match yang sama
      //    diserialisasi (tidak bisa dobel proses / balik dua kali).
      const locked = await tx.$queryRaw`
        SELECT id FROM "Match" WHERE id = ${matchId} FOR UPDATE`;
      if (!locked.length) throw ApiError.notFound('Pertandingan tidak ditemukan');

      const match = await tx.match.findUnique({
        where: { id: matchId },
        include: { participants: true },
      });
      if (!match) throw ApiError.notFound('Pertandingan tidak ditemukan');
      if (match.status !== 'COMPLETED') {
        throw ApiError.badRequest('Hanya pertandingan selesai yang dapat dikoreksi');
      }

      // 2. Guard anti pemrosesan ganda: transaksi aktif harus ada
      const activeTxs = await pointsService.getActiveMatchTxs(tx, matchId);
      if (!activeTxs.length) {
        throw ApiError.badRequest('Poin pertandingan ini belum pernah diproses');
      }

      const beforeScores = {
        teamAScore: match.teamAScore,
        teamBScore: match.teamBScore,
      };
      const preserveOriginal = match.originalTeamAScore == null;
      const reason = `Koreksi skor: ${input.reason}`;

      // 3. Balikkan SEMUA transaksi aktif (urut memberId ascending)
      const sorted = [...activeTxs].sort((a, b) =>
        a.memberId.localeCompare(b.memberId)
      );
      for (const original of sorted) {
        await pointsService.reverseTx(tx, original, {
          reason,
          createdBy: actor.id,
        });
      }

      // 4. Terapkan hasil BARU (urut memberId ascending, konsisten)
      const { winnerSide } = await pointsService.applyMatchResult(tx, {
        matchId,
        participants: match.participants,
        teamAScore: input.teamAScore,
        teamBScore: input.teamBScore,
        createdBy: actor.id,
      });

      // 5. Simpan skor baru + pertahankan skor asli (koreksi pertama)
      await tx.match.update({
        where: { id: matchId },
        data: {
          teamAScore: input.teamAScore,
          teamBScore: input.teamBScore,
          ...(preserveOriginal && {
            originalTeamAScore: match.teamAScore,
            originalTeamBScore: match.teamBScore,
          }),
          correctionReason: input.reason,
        },
      });

      // 6. Audit — riwayat koreksi tersimpan permanen
      await writeAudit(tx, {
        adminId: actor.id,
        action: 'MATCH_CORRECT',
        entity: 'Match',
        entityId: matchId,
        before: beforeScores,
        after: {
          teamAScore: input.teamAScore,
          teamBScore: input.teamBScore,
          winnerSide,
        },
        note: input.reason,
      });
    },
    { timeout: 20000, maxWait: 5000 }
  );

  return detail(matchId);
}

// ---------- Riwayat pertandingan member ----------

async function myHistory(memberId, query) {
  const { page, limit } = query;
  const where = { memberId, match: { status: 'COMPLETED' } };

  const [parts, total] = await Promise.all([
    prisma.matchParticipant.findMany({
      where,
      orderBy: { match: { createdAt: 'desc' } },
      skip: (page - 1) * limit,
      take: limit,
      include: {
        match: {
          include: {
            participants: {
              include: { member: { select: { id: true, fullName: true, alias: true } } },
            },
          },
        },
      },
    }),
    prisma.matchParticipant.count({ where }),
  ]);

  const items = parts.map((p) => {
    const m = p.match;
    const winnerSide = pointsService.winnerSideOf(m);
    const partners = m.participants
      .filter((x) => x.team === p.team && x.memberId !== memberId)
      .map((x) => x.member.alias || x.member.fullName);
    const opponents = m.participants
      .filter((x) => x.team !== p.team)
      .map((x) => x.member.alias || x.member.fullName);

    return {
      matchId: m.id,
      title: m.title,
      matchType: m.matchType,
      status: m.status,
      teamAScore: m.teamAScore,
      teamBScore: m.teamBScore,
      winnerSide,
      myTeam: p.team,
      isWin: winnerSide === p.team,
      playedAt: m.completedAt || m.scheduledAt || m.createdAt,
      partners,
      opponents,
      isCorrected: m.originalTeamAScore != null,
    };
  });

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

module.exports = { create, list, detail, correct, myHistory, toMatchItem };
