// ============================================================
// Skema validasi leaderboard (Zod)
// ============================================================
const { z } = require('zod');

const leaderboardQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(10),
  search: z.string().trim().max(100).optional(),
  rank: z.enum(['D', 'C', 'B', 'B+', 'A', 'NONE']).optional(),
});

module.exports = { leaderboardQuerySchema };
