// ============================================================
// Unit test resolusi rank dari poin
// Prinsip: rank = posisi leaderboard = poin; poin di bawah batas
// terendah masuk rank terendah; batas rentang selalu dihitung
// on-the-fly.
// ============================================================
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { resolveRank } = require('../../src/utils/rank');

// Set rentang default klub (D 0-19, C 20-39, B 40-59, B+ 60-79, A 80+)
const DEFAULT_RANKS = [
  { id: 'r-d', name: 'D', minPoints: 0, maxPoints: 19, order: 1, isActive: true },
  { id: 'r-c', name: 'C', minPoints: 20, maxPoints: 39, order: 2, isActive: true },
  { id: 'r-b', name: 'B', minPoints: 40, maxPoints: 59, order: 3, isActive: true },
  { id: 'r-bp', name: 'B+', minPoints: 60, maxPoints: 79, order: 4, isActive: true },
  { id: 'r-a', name: 'A', minPoints: 80, maxPoints: null, order: 5, isActive: true },
];

test('poin di bawah batas terendah masuk rank terendah (termasuk 0 dan negatif)', () => {
  assert.equal(resolveRank(0, DEFAULT_RANKS).name, 'D');
  assert.equal(resolveRank(-5, DEFAULT_RANKS).name, 'D');
});

test('poin bukan angka -> null', () => {
  assert.equal(resolveRank('80', DEFAULT_RANKS), null);
  assert.equal(resolveRank(undefined, DEFAULT_RANKS), null);
  assert.equal(resolveRank(null, DEFAULT_RANKS), null);
});

test('batas bawah dan atas tiap rentang inklusif', () => {
  assert.equal(resolveRank(0, DEFAULT_RANKS).name, 'D');
  assert.equal(resolveRank(19, DEFAULT_RANKS).name, 'D');
  assert.equal(resolveRank(20, DEFAULT_RANKS).name, 'C');
  assert.equal(resolveRank(39, DEFAULT_RANKS).name, 'C');
  assert.equal(resolveRank(40, DEFAULT_RANKS).name, 'B');
  assert.equal(resolveRank(59, DEFAULT_RANKS).name, 'B');
  assert.equal(resolveRank(60, DEFAULT_RANKS).name, 'B+');
  assert.equal(resolveRank(79, DEFAULT_RANKS).name, 'B+');
  assert.equal(resolveRank(80, DEFAULT_RANKS).name, 'A');
});

test('rentang tanpa batas atas (maxPoints null) terbuka ke atas', () => {
  assert.equal(resolveRank(10000, DEFAULT_RANKS).name, 'A');
});

test('rank non-aktif dilewati ??" poin di rentangnya menjadi belum ber-rank', () => {
  const ranks = DEFAULT_RANKS.map((r) =>
    r.name === 'B+' ? { ...r, isActive: false } : r
  );
  // 65 hanya masuk B+ yang kini non-aktif -> null
  assert.equal(resolveRank(65, ranks), null);
  // 85 tetap A
  assert.equal(resolveRank(85, ranks).name, 'A');
});

test('urutan array pengaturan tidak memengaruhi hasil', () => {
  const shuffled = [...DEFAULT_RANKS].reverse();
  assert.equal(resolveRank(25, shuffled).name, 'C');
  assert.equal(resolveRank(45, shuffled).name, 'B');
  assert.equal(resolveRank(65, shuffled).name, 'B+');
});

test('perubahan batas rank TIDAK mengubah poin (skor murni dari input)', () => {
  // Admin memperlebar C menjadi 20-49: poin 45 kini C, bukan B ??"
  // resolveRank hanya MEMETAKAN, tidak menyentuh poin.
  const widened = DEFAULT_RANKS.map((r) => {
    if (r.name === 'C') return { ...r, maxPoints: 49 };
    if (r.name === 'B') return { ...r, minPoints: 50, maxPoints: 59 };
    return r;
  });
  assert.equal(resolveRank(45, widened).name, 'C');
  assert.equal(resolveRank(45, DEFAULT_RANKS).name, 'B');
});

test('field rank aman untuk response publik', () => {
  const r = resolveRank(70, DEFAULT_RANKS);
  assert.deepEqual(Object.keys(r).sort(), [
    'id', 'isActive', 'maxPoints', 'minPoints', 'name', 'order',
  ]);
});

test('daftar kosong -> null', () => {
  assert.equal(resolveRank(80, []), null);
  assert.equal(resolveRank(80, null), null);
});