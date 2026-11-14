// ============================================================
// Skema validasi anggota (Zod)
// ============================================================
const { z } = require('zod');

// Field profil olahraga bersama (registrasi + edit)
const profileFields = {
  gender: z.enum(['LAKI_LAKI', 'PEREMPUAN']).optional(),
  phone: z.string().trim().max(20).optional(),
  birthDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Format tanggal harus YYYY-MM-DD')
    .optional(),
  genderCategory: z.enum(['ganda_putra', 'ganda_putri']).optional(),
  doublesRole: z.enum(['playmaker', 'smasher', 'allrounder']).optional(),
  dominantHand: z.enum(['kanan', 'kiri']).optional(),
  background: z.enum(['pelatnas', 'semipro', 'komunitas']).optional(),
  racket: z.string().trim().max(120).optional(),
};

// Versi edit (admin/ member sendiri): boleh dihapus nilainya (null)
const profileFieldsNullable = {
  gender: z.enum(['LAKI_LAKI', 'PEREMPUAN']).nullish(),
  phone: z.string().trim().max(20).nullish(),
  birthDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Format tanggal harus YYYY-MM-DD')
    .nullish(),
  genderCategory: z.enum(['ganda_putra', 'ganda_putri']).nullish(),
  doublesRole: z.enum(['playmaker', 'smasher', 'allrounder']).nullish(),
  dominantHand: z.enum(['kanan', 'kiri']).nullish(),
  background: z.enum(['pelatnas', 'semipro', 'komunitas']).nullish(),
  racket: z.string().trim().max(120).nullish(),
};

const listQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(12),
  search: z.string().trim().max(100).optional(),
  rank: z.enum(['D', 'C', 'B', 'B+', 'A', 'NONE']).optional(),
  status: z.enum(['ACTIVE', 'INACTIVE']).optional(),
});

const createMemberSchema = z.object({
  fullName: z.string().trim().min(2, 'Nama minimal 2 karakter').max(120),
  alias: z.string().trim().max(120).nullish(),
  email: z.string().trim().toLowerCase().email('Email tidak valid').max(160),
  password: z
    .string()
    .min(8, 'Kata sandi minimal 8 karakter')
    .max(72, 'Kata sandi maksimal 72 karakter'),
  initialPoints: z.coerce.number().int().min(0).max(100000).default(0),
  ...profileFields,
});

const updateMemberSchema = z.object({
  fullName: z.string().trim().min(2).max(120).optional(),
  alias: z.string().trim().max(120).nullish(),
  status: z.enum(['ACTIVE', 'INACTIVE']).optional(),
  ...profileFieldsNullable,
});

const adjustPointsSchema = z
  .object({
    delta: z.coerce.number().int().min(-100000).max(100000),
    reason: z.string().trim().min(3, 'Alasan wajib diisi').max(500),
  })
  .refine((d) => d.delta !== 0, { message: 'delta tidak boleh 0' });

// Member mengedit profil sendiri (tanpa poin/status/nomor anggota)
const myProfileSchema = z.object({
  fullName: z.string().trim().min(2).max(120).optional(),
  ...profileFieldsNullable,
});

module.exports = {
  listQuerySchema,
  createMemberSchema,
  updateMemberSchema,
  adjustPointsSchema,
  myProfileSchema,
};
