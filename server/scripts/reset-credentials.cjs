const fs = require('fs');
const os = require('os');
const path = require('path');

const envFile = process.env.ENV_FILE || path.join(__dirname, '..', '.env');
require('dotenv').config({ path: envFile });
if (process.env.DATABASE_URL_UNPOOLED) {
  process.env.DATABASE_URL = process.env.DATABASE_URL_UNPOOLED;
}

const bcrypt = require('bcrypt');
const prisma = require('../src/config/prisma');
const { writeAudit } = require('../src/utils/audit');

const APPLY = process.argv.includes('--apply');
const ACCOUNTS = [
  {
    email: 'admin@pbexpelatnas.id',
    password: 'Admin12345!',
    role: 'ADMIN',
    label: 'Admin',
  },
  {
    email: 'anthony@pbexpelatnas.id',
    password: 'Member12345!',
    role: 'MEMBER',
    label: 'Member Anthony',
  },
  {
    email: 'rina@pbexpelatnas.id',
    password: 'Rina12345!',
    role: 'MEMBER',
    label: 'Member Rina',
  },
];

async function main() {
  console.log(`Mode: ${APPLY ? 'APPLY' : 'DRY RUN'}`);
  console.log(`Environment: ${process.env.VERCEL_ENV || 'local'}`);

  const users = [];
  for (const account of ACCOUNTS) {
    const user = await prisma.user.findUnique({ where: { email: account.email } });
    if (!user) throw new Error(`Akun tidak ditemukan: ${account.email}`);
    const matches = await bcrypt.compare(account.password, user.passwordHash);
    console.log(`${account.label}: ${user.email} role=${user.role} status=${user.status} password_sesuai=${matches}`);
    users.push({ account, user });
  }

  if (!APPLY) {
    console.log('Dry run selesai. Jalankan dengan --apply untuk reset password + cabut sesi.');
    return;
  }

  const admin = users.find((x) => x.account.role === 'ADMIN').user;
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupDir = process.env.BACKUP_DIR || path.join(os.tmpdir(), 'expelatnas-secrets');
  fs.mkdirSync(backupDir, { recursive: true });
  const backupFile = path.join(backupDir, `credential-hashes-${stamp}.json`);
  fs.writeFileSync(
    backupFile,
    JSON.stringify(
      users.map(({ account, user }) => ({
        email: user.email,
        role: user.role,
        status: user.status,
        passwordHash: user.passwordHash,
      })),
      null,
      2
    )
  );
  console.log(`Backup hash lama: ${backupFile}`);

  for (const { account, user } of users) {
    const passwordHash = await bcrypt.hash(account.password, 10);
    await prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: user.id },
        data: {
          passwordHash,
          role: account.role,
          status: 'ACTIVE',
        },
      });
      const revoked = await tx.refreshToken.updateMany({
        where: { userId: user.id, revokedAt: null },
        data: { revokedAt: new Date() },
      });
      await writeAudit(tx, {
        adminId: admin.id,
        action: 'PASSWORD_RESET',
        entity: 'User',
        entityId: user.id,
        before: { role: user.role, status: user.status },
        after: { role: account.role, status: 'ACTIVE', passwordReset: true },
        note: `Password direset ke default README; ${revoked.count} sesi aktif dicabut`,
      });
    });
    console.log(`${account.label}: password direset, ${account.role}, ACTIVE`);
  }

  for (const { account } of users) {
    const user = await prisma.user.findUnique({ where: { email: account.email } });
    const matches = await bcrypt.compare(account.password, user.passwordHash);
    if (!matches) throw new Error(`Verifikasi gagal untuk ${account.email}`);
    console.log(`${account.email}: verifikasi password berhasil`);
  }
}

main()
  .catch((e) => {
    console.error(e.message || e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
