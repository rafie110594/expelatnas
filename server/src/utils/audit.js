// ============================================================
// Penulisan audit log (dipanggil DI DALAM transaksi yang sama
// dengan perubahan data, agar selesai atau batal bersama-sama)
// ============================================================

/**
 * Pastikan payload aman untuk kolom Json Prisma
 * (objek Date otomatis menjadi string ISO, key undefined dibuang).
 */
function jsonSafe(value) {
  if (value === undefined || value === null) return value;
  return JSON.parse(JSON.stringify(value));
}

/**
 * @param {import('@prisma/client').PrismaClient|any} tx transaksi Prisma aktif
 * @param {{adminId:string, action:string, entity:string, entityId?:string,
 *          before?:object, after?:object, note?:string}} entry
 */
async function writeAudit(tx, { adminId, action, entity, entityId, before, after, note }) {
  return tx.auditLog.create({
    data: {
      adminId,
      action, // MATCH_COMPLETE | MATCH_CORRECT | POINT_ADJUST | MEMBER_CREATE ...
      entity,
      entityId: entityId || null,
      before: jsonSafe(before),
      after: jsonSafe(after),
      note: note || null,
    },
  });
}

module.exports = { writeAudit };
