// ============================================================
// Unit test skema validasi Zod — guard bisnis sebelum DB
// ============================================================
const { test } = require('node:test');
const assert = require('node:assert/strict');

const {
  createMatchSchema,
  correctMatchSchema,
} = require('../../src/validators/match.validator');
const {
  adjustPointsSchema,
  createMemberSchema,
} = require('../../src/validators/member.validator');
const {
  updateSettingsSchema,
  updateRankSchema,
} = require('../../src/validators/setting.validator');
const {
  createGallerySchema,
  listQuerySchema: galleryListQuerySchema,
} = require('../../src/validators/gallery.validator');

const VALID_MATCH = {
  title: 'Laga Placement Kamis',
  matchType: 'SINGLE',
  teamA: ['user-a'],
  teamB: ['user-b'],
  teamAScore: 21,
  teamBScore: 15,
};

// ---------- createMatchSchema ----------

test('match valid diterima', () => {
  const r = createMatchSchema.safeParse(VALID_MATCH);
  assert.equal(r.success, true);
});

test('skor seri ditolak — harus ada pemenang', () => {
  const r = createMatchSchema.safeParse({ ...VALID_MATCH, teamBScore: 21 });
  assert.equal(r.success, false);
});

test('pemain yang sama di kedua tim ditolak', () => {
  const r = createMatchSchema.safeParse({
    ...VALID_MATCH,
    matchType: 'DOUBLES',
    teamA: ['user-a', 'user-x'],
    teamB: ['user-a', 'user-y'],
  });
  assert.equal(r.success, false);
});

test('tim kosong atau lebih dari 2 pemain ditolak', () => {
  assert.equal(createMatchSchema.safeParse({ ...VALID_MATCH, teamA: [] }).success, false);
  assert.equal(
    createMatchSchema.safeParse({ ...VALID_MATCH, teamA: ['a', 'b', 'c'] }).success,
    false
  );
});

test('skor di luar 0-999 atau negatif ditolak', () => {
  assert.equal(createMatchSchema.safeParse({ ...VALID_MATCH, teamAScore: 1000 }).success, false);
  assert.equal(createMatchSchema.safeParse({ ...VALID_MATCH, teamAScore: -1 }).success, false);
});

test('matchType di luar enum ditolak', () => {
  assert.equal(createMatchSchema.safeParse({ ...VALID_MATCH, matchType: 'TRIPLE' }).success, false);
});

test('judul minimal 3 karakter', () => {
  assert.equal(createMatchSchema.safeParse({ ...VALID_MATCH, title: 'ab' }).success, false);
});

// ---------- correctMatchSchema ----------

test('koreksi valid diterima', () => {
  const r = correctMatchSchema.safeParse({
    teamAScore: 15,
    teamBScore: 21,
    reason: 'Input skor terbalik saat pencatatan awal',
  });
  assert.equal(r.success, true);
});

test('koreksi tanpa alasan atau alasan < 5 karakter ditolak', () => {
  assert.equal(
    correctMatchSchema.safeParse({ teamAScore: 15, teamBScore: 21, reason: 'sal' }).success,
    false
  );
  assert.equal(
    correctMatchSchema.safeParse({ teamAScore: 15, teamBScore: 21 }).success,
    false
  );
});

test('koreksi ke skor seri ditolak', () => {
  const r = correctMatchSchema.safeParse({
    teamAScore: 21,
    teamBScore: 21,
    reason: 'Koreksi menuju seri tidak sah',
  });
  assert.equal(r.success, false);
});

// ---------- adjustPointsSchema ----------

test('penyesuaian poin: delta 0 ditolak, alasan wajib', () => {
  assert.equal(
    adjustPointsSchema.safeParse({ delta: 0, reason: 'Hadiah juara' }).success,
    false
  );
  assert.equal(
    adjustPointsSchema.safeParse({ delta: 5, reason: 'ab' }).success,
    false
  );
  assert.equal(
    adjustPointsSchema.safeParse({ delta: -3, reason: 'Koreksi admin' }).success,
    true
  );
});

// ---------- createMemberSchema ----------

test('buat member: password minimal 8 & email wajib', () => {
  assert.equal(
    createMemberSchema.safeParse({
      fullName: 'Tester Baru',
      email: 'tester@example.com',
      password: 'short',
    }).success,
    false
  );
  const ok = createMemberSchema.safeParse({
    fullName: 'Tester Baru',
    email: 'tester@example.com',
    password: 'Password123',
  });
  assert.equal(ok.success, true);
  assert.equal(ok.data.initialPoints, 0); // default
});

// ---------- updateSettingsSchema ----------

test('aturan poin: poin kalah harus ≤ 0 dan poin menang ≤ 100', () => {
  assert.equal(updateSettingsSchema.safeParse({ pointsLoss: 2 }).success, false);
  assert.equal(updateSettingsSchema.safeParse({ pointsWin: 101 }).success, false);
  assert.equal(updateSettingsSchema.safeParse({ pointsWin: 5, pointsLoss: -3 }).success, true);
});

test('patch kosong ditolak (harus ada perubahan)', () => {
  assert.equal(updateSettingsSchema.safeParse({}).success, false);
});

test('registrationOpen boolean', () => {
  assert.equal(updateSettingsSchema.safeParse({ registrationOpen: true }).success, true);
  assert.equal(updateSettingsSchema.safeParse({ registrationOpen: 'yes' }).success, false);
});

// ---------- updateRankSchema ----------

test('ubah rentang rank: maxPoints null = tanpa batas atas', () => {
  const r = updateRankSchema.safeParse({ minPoints: 80, maxPoints: null });
  assert.equal(r.success, true);
});

test('ubah rentang rank: patch kosong ditolak', () => {
  assert.equal(updateRankSchema.safeParse({}).success, false);
});

// ---------- Jadwal latihan ----------

test('jadwal latihan: hari, jam, lokasi, dan link maps valid', () => {
  const r = updateSettingsSchema.safeParse({
    trainingDays: 'Jumat,Sabtu,Minggu',
    trainingStart: '19:00',
    trainingEnd: '22:00',
    trainingLocation: 'GOR Tameklan',
    trainingMapUrl: 'https://maps.app.goo.gl/KN6pikgbKQdZ7BB36',
  });
  assert.equal(r.success, true);
});

test('jadwal latihan: format jam salah ditolak', () => {
  assert.equal(updateSettingsSchema.safeParse({ trainingStart: '7pm' }).success, false);
  assert.equal(updateSettingsSchema.safeParse({ trainingEnd: 'abc' }).success, false);
});

// ---------- Galeri ----------

test('galeri: kategori default MABAR dan kategori valid diterima', () => {
  const def = createGallerySchema.safeParse({ title: 'Mabar Rabu' });
  assert.equal(def.success, true);
  assert.equal(def.data.category, 'MABAR');

  const sparing = createGallerySchema.safeParse({ title: 'Sparing Sabtu', category: 'SPARING' });
  assert.equal(sparing.success, true);
  assert.equal(sparing.data.category, 'SPARING');
});

test('galeri: kategori tidak dikenal ditolak', () => {
  assert.equal(createGallerySchema.safeParse({ title: 'Mabar', category: 'NOPE' }).success, false);
});

test('galeri: filter kategori pada query', () => {
  assert.equal(galleryListQuerySchema.safeParse({ category: 'MABAR' }).success, true);
  assert.equal(galleryListQuerySchema.safeParse({ category: 'NOPE' }).success, false);
});
