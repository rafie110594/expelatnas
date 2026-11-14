// ============================================================
// Service log audit — daftar untuk panel admin
// ============================================================
const prisma = require('../config/prisma');

async function list(query) {
  const { page, limit, action, entity } = query;
  const where = {
    ...(action ? { action: { equals: action, mode: 'insensitive' } } : {}),
    ...(entity ? { entity: { equals: entity, mode: 'insensitive' } } : {}),
  };

  const [rows, total] = await Promise.all([
    prisma.auditLog.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
      include: { admin: { select: { fullName: true, role: true } } },
    }),
    prisma.auditLog.count({ where }),
  ]);

  return {
    items: rows.map((r) => ({
      id: r.id,
      action: r.action,
      entity: r.entity,
      entityId: r.entityId,
      before: r.before,
      after: r.after,
      note: r.note,
      admin: r.admin?.fullName || null,
      createdAt: r.createdAt,
    })),
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.max(1, Math.ceil(total / limit)),
    },
  };
}

module.exports = { list };
