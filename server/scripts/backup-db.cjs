const fs = require('fs');
const path = require('path');

const envFile = process.env.ENV_FILE || path.join(__dirname, '..', '.env');
require('dotenv').config({ path: envFile });
if (process.env.DATABASE_URL_UNPOOLED) {
  process.env.DATABASE_URL = process.env.DATABASE_URL_UNPOOLED;
}

const prisma = require('../src/config/prisma');

const TABLES = [
  'User',
  'MemberProfile',
  'RankSetting',
  'Match',
  'MatchParticipant',
  'PointTransaction',
  'Gallery',
  'Event',
  'ClubSettings',
  'AuditLog',
  'RefreshToken',
];

async function main() {
  const outDir = process.env.BACKUP_DIR || path.join(process.cwd(), 'backups');
  fs.mkdirSync(outDir, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const data = {};
  for (const table of TABLES) {
    data[table] = await prisma.$queryRawUnsafe(`SELECT * FROM "${table}"`);
    console.log(`${table}: ${data[table].length}`);
  }
  const payload = {
    generatedAt: new Date().toISOString(),
    source: process.env.VERCEL_ENV || 'local',
    models: data,
  };
  const file = path.join(outDir, `db-backup-${stamp}.json`);
  fs.writeFileSync(file, JSON.stringify(payload, null, 2));
  console.log(`Backup written: ${file}`);
  console.log(`Size: ${fs.statSync(file).size} bytes`);
}

main()
  .catch((e) => {
    console.error(e.message || e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
