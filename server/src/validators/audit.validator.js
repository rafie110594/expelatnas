// ============================================================
// Validasi log audit (Zod)
// ============================================================
const { z } = require('zod');

const listQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  action: z.string().trim().max(60).optional(),
  entity: z.string().trim().max(60).optional(),
});

module.exports = { listQuerySchema };
