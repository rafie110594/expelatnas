// ============================================================
// Skema validasi autentikasi (Zod)
// ============================================================
const { z } = require('zod');

const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email('Email tidak valid').max(160),
  password: z.string().min(1, 'Kata sandi wajib diisi').max(128),
});

const registerSchema = z.object({
  fullName: z.string().trim().min(2, 'Nama minimal 2 karakter').max(120),
  email: z.string().trim().toLowerCase().email('Email tidak valid').max(160),
  password: z
    .string()
    .min(8, 'Kata sandi minimal 8 karakter')
    .max(72, 'Kata sandi maksimal 72 karakter'),
  phone: z.string().trim().max(20).optional(),
  birthDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Format tanggal harus YYYY-MM-DD')
    .optional(),
  gender: z.enum(['LAKI_LAKI', 'PEREMPUAN']).optional(),
});

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Kata sandi saat ini wajib diisi'),
  newPassword: z
    .string()
    .min(8, 'Kata sandi baru minimal 8 karakter')
    .max(72, 'Kata sandi baru maksimal 72 karakter'),
});

module.exports = { loginSchema, registerSchema, changePasswordSchema };
