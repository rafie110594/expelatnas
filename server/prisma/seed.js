// ============================================================
// Seed data development — PB EX PELATNAS
// Dijalankan otomatis oleh `prisma migrate dev` / `npm run db:seed`
// ============================================================

const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcrypt');
require('dotenv').config();

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Menjalankan seed...');

  // ---------- 1. Rank (D 0-19, C 20-39, B 40-59, B+ 60-79, A 80+) ----------
  const ranks = [
    { name: 'D', minPoints: 0, maxPoints: 19, order: 1 },
    { name: 'C', minPoints: 20, maxPoints: 39, order: 2 },
    { name: 'B', minPoints: 40, maxPoints: 59, order: 3 },
    { name: 'B+', minPoints: 60, maxPoints: 79, order: 4 },
    { name: 'A', minPoints: 80, maxPoints: null, order: 5 },
  ];
  for (const r of ranks) {
    await prisma.rankSetting.upsert({
      where: { name: r.name },
      update: { minPoints: r.minPoints, maxPoints: r.maxPoints, order: r.order, isActive: true },
      create: r,
    });
  }
  console.log(`   ${ranks.length} rank (D, C, B, B+, A)`);

  // ---------- 2. Pengaturan klub (singleton) ----------
  const training = {
    trainingDays: 'Jumat,Sabtu,Minggu',
    trainingStart: '19:00',
    trainingEnd: '22:00',
    trainingLocation: 'GOR Tameklan',
    trainingMapUrl: 'https://maps.app.goo.gl/KN6pikgbKQdZ7BB36',
  };

  await prisma.clubSettings.upsert({
    where: { id: 1 },
    update: training,
    create: {
      id: 1,
      clubName: 'PB EX PELATNAS',
      description:
        'Klub bulutangkis high performance dengan sistem rating poin resmi untuk pembinaan nomor ganda.',
      contactEmail: 'secretariat@pbexpelatnas.id',
      contactPhone: '+62 812-3456-7890',
      whatsappLink: 'https://wa.me/628123456789',
      pointsWin: 3,
      pointsLoss: -2,
      registrationOpen: true,
      tieBreak: 'MORE_WINS',
      ...training,
    },
  });
  console.log('   ✓ Pengaturan klub (menang +3, kalah -2)');

  // ---------- 3. Akun admin ----------
  const adminEmail = process.env.SEED_ADMIN_EMAIL || 'admin@pbexpelatnas.id';
  const adminPassword = process.env.SEED_ADMIN_PASSWORD || 'Admin12345!';
  const adminName = process.env.SEED_ADMIN_NAME || 'Head Official';
  const adminHash = await bcrypt.hash(adminPassword, 10);

  await prisma.user.upsert({
    where: { email: adminEmail },
    update: { role: 'ADMIN', status: 'ACTIVE' },
    create: {
      fullName: adminName,
      email: adminEmail,
      passwordHash: adminHash,
      role: 'ADMIN',
      status: 'ACTIVE',
    },
  });
  console.log(`   ✓ Admin: ${adminEmail}`);

  // ---------- 4. Member demo ----------
  const memberEmail = process.env.SEED_MEMBER_EMAIL || 'anthony@pbexpelatnas.id';
  const memberPassword = process.env.SEED_MEMBER_PASSWORD || 'Member12345!';
  const memberName = process.env.SEED_MEMBER_NAME || 'Anthony Ginting';
  const memberHash = await bcrypt.hash(memberPassword, 10);

  const member = await prisma.user.upsert({
    where: { email: memberEmail },
    update: {},
    create: {
      fullName: memberName,
      email: memberEmail,
      passwordHash: memberHash,
      role: 'MEMBER',
      status: 'ACTIVE',
      gender: 'LAKI_LAKI',
      birthDate: new Date('1996-10-20'),
      profile: {
        create: {
          memberNumber: 'PB-0001',
          phone: '812-9988-7766',
          initialPoints: 0,
          currentPoints: 0,
        },
      },
    },
    include: { profile: true },
  });
  console.log(`   ✓ Member demo: ${memberEmail} (PB-0001)`);

  console.log('✅ Seed selesai.');
}

main()
  .catch((e) => {
    console.error('❌ Seed gagal:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
