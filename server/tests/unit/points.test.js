// ============================================================
// Unit test mesin poin (bagian murni)
// - penentuan pemenang dari skor
// - aritmetika ledger before/delta/after (simulasi transaksi)
// - reversal: dampak dibalik persis, tidak ada penghapusan
// ============================================================
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { winnerSideOf } = require('../../src/services/points.service');

// ---------- Penentuan pemenang ----------

test('sisi dengan skor lebih tinggi menang', () => {
  assert.equal(winnerSideOf({ teamAScore: 21, teamBScore: 15 }), 'A');
  assert.equal(winnerSideOf({ teamAScore: 15, teamBScore: 21 }), 'B');
  assert.equal(winnerSideOf({ teamAScore: 0, teamBScore: 1 }), 'B');
});

test('skor seri tidak menghasilkan pemenang', () => {
  assert.equal(winnerSideOf({ teamAScore: 21, teamBScore: 21 }), null);
  assert.equal(winnerSideOf({ teamAScore: 0, teamBScore: 0 }), null);
});

test('skor null/kosong tidak menghasilkan pemenang', () => {
  assert.equal(winnerSideOf({ teamAScore: null, teamBScore: 15 }), null);
  assert.equal(winnerSideOf({ teamAScore: 21, teamBScore: null }), null);
  assert.equal(winnerSideOf({ teamAScore: undefined, teamBScore: undefined }), null);
});

// ---------- Simulasi aritmetika ledger (aturan +3 / -2) ----------

const WIN = 3;
const LOSS = -2;

/** Meniru writeTx: before → after = before + delta */
function simulateTx(profile, { delta, type }) {
  const before = profile.currentPoints;
  const after = before + delta;
  profile.currentPoints = after;
  profile.ledger.push({ type, pointsBefore: before, delta, pointsAfter: after });
  return { pointsBefore: before, delta, pointsAfter: after };
}

test('ledger menang: before/delta/after konsisten', () => {
  const profile = { currentPoints: 10, ledger: [] };
  const tx = simulateTx(profile, { delta: WIN, type: 'MATCH_WIN' });
  assert.deepEqual(tx, { pointsBefore: 10, delta: 3, pointsAfter: 13 });
  assert.equal(profile.currentPoints, 13);
});

test('ledger kalah: poin berkurang dan bisa negatif (tanpa floor)', () => {
  const profile = { currentPoints: 1, ledger: [] };
  simulateTx(profile, { delta: LOSS, type: 'MATCH_LOSS' });
  assert.equal(profile.currentPoints, -1);
});

test('reversal mengembalikan poin persis ke kondisi sebelum transaksi asli', () => {
  const profile = { currentPoints: 10, ledger: [] };
  simulateTx(profile, { delta: WIN, type: 'MATCH_WIN' }); // 10 → 13
  simulateTx(profile, { delta: -WIN, type: 'REVERSAL' }); // 13 → 10
  assert.equal(profile.currentPoints, 10);
  // Tidak ada baris yang dihapus — ledger tetap berisi jejak lengkap
  assert.equal(profile.ledger.length, 2);
  assert.equal(profile.ledger[0].type, 'MATCH_WIN');
  assert.equal(profile.ledger[1].type, 'REVERSAL');
  assert.equal(profile.ledger[1].pointsBefore, 13);
  assert.equal(profile.ledger[1].pointsAfter, 10);
});

test('koreksi penuh: reversal kemenangan lalu terapkan kekalahan (match dibalik)', () => {
  // Pemain menang (10 → 13), lalu koreksi membalik hasil:
  // reversal (+3 dibalik jadi -3) lalu transaksi kalah (-2)
  const profile = { currentPoints: 10, ledger: [] };
  simulateTx(profile, { delta: WIN, type: 'MATCH_WIN' });   // 13
  simulateTx(profile, { delta: -WIN, type: 'REVERSAL' });  // 10
  simulateTx(profile, { delta: LOSS, type: 'MATCH_LOSS' }); // 8
  assert.equal(profile.currentPoints, 8);
  // total delta efektif = +3 -3 -2 = -2
  const total = profile.ledger.reduce((s, t) => s + t.delta, 0);
  assert.equal(total, LOSS);
});

test('koreksi ganda tidak menggandakan dampak (reversal hanya sekali per tx)', () => {
  // Guard bisnis di reverseTx menolak tx yang sudah isReversed/reversesId;
  // di sini dipastikan aritmetika reversal netral untuk satu tx asli.
  const profile = { currentPoints: 50, ledger: [] };
  const original = simulateTx(profile, { delta: WIN, type: 'MATCH_WIN' }); // 53
  // Hanya SATU reversal sah per tx asli:
  simulateTx(profile, { delta: -original.delta, type: 'REVERSAL' }); // 50
  assert.equal(profile.currentPoints, 50);
  const reversals = profile.ledger.filter((t) => t.type === 'REVERSAL');
  assert.equal(reversals.length, 1);
});

test('skor koreksi yang membalik pemenang: total delta = aturan kalah', () => {
  // A menang lalu dikoreksi menjadi B menang — pemain sisi A:
  // +3 (win asli) -3 (reversal) -2 (loss koreksi) = -2
  const deltas = [WIN, -WIN, LOSS];
  assert.equal(deltas.reduce((s, d) => s + d, 0), LOSS);
});
