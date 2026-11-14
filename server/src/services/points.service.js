// ============================================================
// Mesin poin — ledger atomik before/delta/after
//
// Prinsip:
// 1. Semua perubahan poin terjadi DI DALAM transaksi Prisma.
// 2. Baris profil dikunci dengan SELECT ... FOR UPDATE per anggota
//    sehingga dua request paralel tidak bisa menimpa poin.
// 3. Poin asli TIDAK PERNAH dihapus — koreksi dilakukan dengan
//    transaksi REVERSAL (delta dibalik) lalu tulis hasil baru.
// 4. Urutan kunci selalu diurutkan berdasar memberId (ascending)
//    agar tidak pernah terjadi deadlock antar transaksi.
// ============================================================
const prisma = require('../config/prisma');
const ApiError = require('../utils/ApiError');

/** Ambil aturan poin klub (menang/kalah) dari ClubSettings */
async function getScoringRules(tx = prisma) {
  const settings = await tx.clubSettings.findUnique({ where: { id: 1 } });
  return {
    win: settings?.pointsWin ?? 3,
    loss: settings?.pointsLoss ?? -2,
  };
}

/** Menang = skor tim lebih tinggi (koreksi boleh membalik hasil) */
function winnerSideOf({ teamAScore, teamBScore }) {
  if (teamAScore == null || teamBScore == null) return null;
  if (teamAScore === teamBScore) return null; // tidak ada seri
  return teamAScore > teamBScore ? 'A' : 'B';
}

/**
 * Kunci baris MemberProfile dan baca poin saat ini.
 * FOR UPDATE menahan baris sampai transaksi selesai.
 */
async function lockProfile(tx, memberId) {
  const rows = await tx.$queryRaw`
    SELECT "currentPoints" FROM "MemberProfile"
    WHERE "userId" = ${memberId} FOR UPDATE`;
  if (!rows.length) {
    throw ApiError.badRequest('Anggota tidak memiliki profil klub');
  }
  return Number(rows[0].currentPoints);
}

/**
 * Tulis satu transaksi poin: kunci profil → baca before →
 * hitung after → update cache → catat ledger.
 * (Asumsi urutan kunci sudah dijaga pemanggil.)
 */
async function writeTx(tx, {
  memberId,
  matchId = null,
  type,
  delta,
  reason = null,
  createdBy = null,
  reversesId = null,
}) {
  const before = await lockProfile(tx, memberId);
  const after = before + delta;
  await tx.memberProfile.update({
    where: { userId: memberId },
    data: { currentPoints: after },
  });
  return tx.pointTransaction.create({
    data: {
      memberId,
      matchId,
      type,
      pointsBefore: before,
      delta,
      pointsAfter: after,
      reason,
      createdBy,
      reversesId,
    },
  });
}

/**
 * Terapkan hasil pertandingan untuk SEMUA peserta.
 * Pemenang dapat pointsWin, yang kalah dapat pointsLoss.
 * Dipanggil saat membuat match maupun saat menerapkan hasil koreksi.
 *
 * @param participants [{memberId, team:'A'|'B'}]
 * @returns side pemenang ('A' | 'B')
 */
async function applyMatchResult(tx, { matchId, participants, teamAScore, teamBScore, createdBy }) {
  const rules = await getScoringRules(tx);
  const winner = winnerSideOf({ teamAScore, teamBScore });
  if (!winner) throw ApiError.badRequest('Skor tidak menentukan pemenang');

  // Urutkan memberId ascending → urutan kunci konsisten (anti deadlock)
  const sorted = [...participants].sort((a, b) => a.memberId.localeCompare(b.memberId));
  const written = [];
  for (const p of sorted) {
    const isWinner = p.team === winner;
    written.push(
      await writeTx(tx, {
        memberId: p.memberId,
        matchId,
        type: isWinner ? 'MATCH_WIN' : 'MATCH_LOSS',
        delta: isWinner ? rules.win : rules.loss,
        reason: isWinner ? 'Kemenangan pertandingan' : 'Kekalahan pertandingan',
        createdBy,
      })
    );
  }
  return { winnerSide: winner, written };
}

/**
 * Batalkan dampak SATU transaksi aktif dengan membuat transaksi
 * REVERSAL (delta dibalik) — transaksi asli ditandai isReversed,
 * tetap tersimpan permanen di ledger.
 */
async function reverseTx(tx, original, { reason, createdBy }) {
  if (original.isReversed || original.reversesId) {
    throw ApiError.badRequest('Transaksi poin sudah dibalikkan');
  }
  const reversal = await writeTx(tx, {
    memberId: original.memberId,
    matchId: original.matchId,
    type: 'REVERSAL',
    delta: -original.delta, // membalik dampak persis
    reason,
    createdBy,
    reversesId: original.id, // penanda: tx ini membalik tx tsb
  });
  await tx.pointTransaction.update({
    where: { id: original.id },
    data: { isReversed: true },
  });
  return reversal;
}

/**
 * Ambil transaksi AKTIF milik suatu match (bukan reversal,
 * belum dibalikkan) — dasar guard anti pemrosesan ganda.
 */
async function getActiveMatchTxs(tx, matchId) {
  return tx.pointTransaction.findMany({
    where: { matchId, isReversed: false, reversesId: null },
  });
}

module.exports = {
  getScoringRules,
  winnerSideOf,
  lockProfile,
  writeTx,
  applyMatchResult,
  reverseTx,
  getActiveMatchTxs,
};
