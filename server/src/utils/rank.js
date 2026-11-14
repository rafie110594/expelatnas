// ============================================================
// Resolusi rank dari poin ??" rank ?%? posisi leaderboard
// Aturan: rank dihitung murni dari rentang RankSetting aktif.
// Poin di bawah batas terendah otomatis masuk rank terendah (D),
// sehingga poin negatif tetap memiliki rank dasar.
// Perubahan batas rentang TIDAK mengubah poin member,
// karena rank selalu dihitung on-the-fly dari RankSetting.
// ============================================================

function toRank(r) {
  // Hanya field aman untuk response (tanpa timestamps internal)
  return {
    id: r.id,
    name: r.name,
    minPoints: r.minPoints,
    maxPoints: r.maxPoints,
    order: r.order,
    isActive: r.isActive,
  };
}

/**
 * Cocokkan poin ke salah satu rentang rank aktif.
 * @param {number} points poin saat ini
 * @param {Array<{name:string,minPoints:number,maxPoints:number|null,order:number,isActive:boolean}>} settings
 * @returns objek rank | null (belum masuk rentang mana pun = belum ber-rank)
 */
function resolveRank(points, settings) {
  if (typeof points !== 'number' || Number.isNaN(points)) return null;

  const active = (settings || [])
    .filter((r) => r.isActive)
    .sort((a, b) => a.order - b.order);
  if (!active.length) return null;

  const lowest = [...active].sort((a, b) => a.minPoints - b.minPoints)[0];
  if (points < lowest.minPoints) return toRank(lowest);

  for (const r of active) {
    if (points >= r.minPoints && (r.maxPoints == null || points <= r.maxPoints)) {
      return toRank(r);
    }
  }
  return null;
}

module.exports = { resolveRank };