const path = require('path');

const envFile = process.env.ENV_FILE || path.join(__dirname, '..', '.env');
require('dotenv').config({ path: envFile });
if (process.env.DATABASE_URL_UNPOOLED) {
  process.env.DATABASE_URL = process.env.DATABASE_URL_UNPOOLED;
}

const prisma = require('../src/config/prisma');
const pointsService = require('../src/services/points.service');
const { writeAudit } = require('../src/utils/audit');

const APPLY = process.argv.includes('--apply');
const EXPECTED_TITLE = 'Laga Uji Coba UI Admin';
const REASON = 'Hapus match single uji coba (migrasi doubles-only)';

async function snapshot(memberIds) {
  const profiles = await prisma.memberProfile.findMany({
    where: { userId: { in: memberIds } },
    select: {
      userId: true,
      memberNumber: true,
      currentPoints: true,
      user: { select: { fullName: true } },
    },
  });
  return profiles
    .sort((a, b) => a.memberNumber.localeCompare(b.memberNumber))
    .map((p) => `${p.memberNumber} ${p.user.fullName}: ${p.currentPoints}`);
}

async function main() {
  const singles = await prisma.match.findMany({
    where: { matchType: 'SINGLE' },
    include: { participants: true, pointTransactions: true },
  });

  console.log(`Mode: ${APPLY ? 'APPLY' : 'DRY RUN'}`);
  console.log(`Match SINGLE ditemukan: ${singles.length}`);
  for (const m of singles) {
    const active = m.pointTransactions.filter((t) => !t.isReversed && !t.reversesId);
    console.log(`- ${m.id} | ${m.title} | ${m.status} | ${m.teamAScore}-${m.teamBScore} | tx aktif: ${active.length}`);
  }

  if (singles.length !== 1) {
    throw new Error(`Safety abort: jumlah match SINGLE harus tepat 1, ditemukan ${singles.length}`);
  }

  const match = singles[0];
  if (match.title !== EXPECTED_TITLE) {
    throw new Error(`Safety abort: judul tidak cocok. Ditemukan "${match.title}"`);
  }

  const memberIds = match.participants.map((p) => p.memberId);
  console.log('Poin sebelum:');
  console.log(await snapshot(memberIds));

  if (!APPLY) {
    console.log('Dry run selesai. Jalankan dengan --apply untuk reverse poin + hapus match.');
    return;
  }

  await prisma.$transaction(async (tx) => {
    const txs = await pointsService.getActiveMatchTxs(tx, match.id);
    for (const original of txs) {
      await pointsService.reverseTx(tx, original, {
        reason: REASON,
        createdBy: match.recordedById,
      });
    }
    await writeAudit(tx, {
      adminId: match.recordedById,
      action: 'MATCH_DELETE',
      entity: 'Match',
      entityId: match.id,
      before: match,
      after: null,
      note: `${REASON}; ${txs.length} transaksi poin dibalikkan`,
    });
    await tx.match.delete({ where: { id: match.id } });
  });

  console.log('Poin sesudah:');
  console.log(await snapshot(memberIds));
  console.log('Selesai: poin dibalikkan, audit MATCH_DELETE dicatat, match dihapus.');
}

main()
  .catch((e) => {
    console.error(e.message || e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
