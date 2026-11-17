// ============================================================
// Skema validasi pertandingan (Zod)
//
// Catatan klub: skor dicatat sebagai sepasang angka tim
// (bukan asumsi format bulutangkis tertentu) — pemenang
// ditentukan dari skor yang dimasukkan admin.
// ============================================================
const { z } = require('zod');

const scorePair = {
  teamAScore: z.coerce.number().int().min(0).max(999),
  teamBScore: z.coerce.number().int().min(0).max(999),
};

const teams = {
  teamA: z
    .array(z.string().trim().min(1))
    .length(2, 'Tim A harus berisi 2 pemain'),
  teamB: z
    .array(z.string().trim().min(1))
    .length(2, 'Tim B harus berisi 2 pemain'),
};

const noOverlap = (d) => {
  const all = [...d.teamA, ...d.teamB];
  return new Set(all).size === all.length;
};

const createMatchSchema = z
  .object({
    title: z.string().trim().min(3, 'Judul minimal 3 karakter').max(160),
    matchType: z.enum(['DOUBLES']).default('DOUBLES'),
    scheduledAt: z.string().datetime({ offset: true }).optional(),
    ...teams,
    ...scorePair,
  })
  .refine(noOverlap, {
    message: 'Seorang anggota tidak boleh berada di kedua tim',
    path: ['teamB'],
  })
  .refine((d) => d.teamAScore !== d.teamBScore, {
    message: 'Skor tidak boleh seri — harus ada pemenang',
    path: ['teamBScore'],
  });

const correctMatchSchema = z
  .object({
    ...scorePair,
    reason: z.string().trim().min(5, 'Alasan koreksi minimal 5 karakter').max(500),
  })
  .refine((d) => d.teamAScore !== d.teamBScore, {
    message: 'Skor tidak boleh seri — harus ada pemenang',
    path: ['teamBScore'],
  });

const listQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(10),
  search: z.string().trim().max(100).optional(),
  status: z.enum(['DRAFT', 'COMPLETED', 'CANCELLED']).optional(),
});

const historyQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(10),
});

module.exports = {
  createMatchSchema,
  correctMatchSchema,
  listQuerySchema,
  historyQuerySchema,
};
