// ============================================================
// Skema validasi pengaturan klub & rank (Zod)
// ============================================================
const { z } = require('zod');

const updateSettingsSchema = z
  .object({
    clubName: z.string().trim().min(1).max(80).optional(),
    logoUrl: z.string().trim().max(500).nullish(),
    description: z.string().trim().max(2000).nullish(),
    contactEmail: z.string().trim().toLowerCase().email().max(160).nullish(),
    contactPhone: z.string().trim().max(20).nullish(),
    whatsappLink: z.string().trim().max(300).nullish(),
    socialLinks: z.record(z.string().max(40), z.string().max(500)).nullish(),
    // Aturan poin baru hanya berlaku untuk pertandingan BERIKUTNYA —
    // ledger lama tidak pernah diubah.
    pointsWin: z.coerce.number().int().min(0).max(100).optional(),
    pointsLoss: z.coerce.number().int().min(-100).max(0).optional(),
    registrationOpen: z.boolean().optional(),
    tieBreak: z.enum(['MORE_WINS', 'OLDEST_JOINED']).optional(),
    // Jadwal latihan rutin
    trainingDays: z.string().trim().max(80).optional(),
    trainingStart: z.string().trim().regex(/^\d{2}:\d{2}$/, 'Format jam HH:MM').optional(),
    trainingEnd: z.string().trim().regex(/^\d{2}:\d{2}$/, 'Format jam HH:MM').optional(),
    trainingLocation: z.string().trim().min(1).max(160).optional(),
    trainingMapUrl: z.string().trim().max(500).nullish(),
  })
  .refine((obj) => Object.values(obj).some((v) => v !== undefined), {
    message: 'Tidak ada perubahan yang dikirim',
  });

const rankName = z.string().trim().min(1, 'Nama rank wajib diisi').max(20);

const createRankSchema = z.object({
  name: rankName,
  minPoints: z.coerce.number().int().min(0).max(1000000),
  // null / tidak dikirim = tanpa batas atas (mis. Rank A)
  maxPoints: z.coerce.number().int().min(0).max(1000000).nullish(),
  order: z.coerce.number().int().min(0).max(1000),
  isActive: z.boolean().default(true),
});

const updateRankSchema = z
  .object({
    name: rankName.optional(),
    minPoints: z.coerce.number().int().min(0).max(1000000).optional(),
    maxPoints: z.coerce.number().int().min(0).max(1000000).nullish(),
    order: z.coerce.number().int().min(0).max(1000).optional(),
    isActive: z.boolean().optional(),
  })
  .refine((obj) => Object.values(obj).some((v) => v !== undefined), {
    message: 'Tidak ada perubahan yang dikirim',
  });

module.exports = { updateSettingsSchema, createRankSchema, updateRankSchema };
