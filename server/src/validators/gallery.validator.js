// ============================================================
// Skema validasi galeri (Zod) — input datang dari multipart/form-data
// sehingga boolean tiba sebagai string 'true'/'false'
// ============================================================
const { z } = require('zod');

/** Boolean dari multipart: menerima boolean JSON maupun string 'true'/'false' */
const multipartBool = z
  .union([z.boolean(), z.enum(['true', 'false'])])
  .optional()
  .transform((v) => {
    if (v === true || v === 'true') return true;
    if (v === false || v === 'false') return false;
    return undefined; // tidak dikirim
  });

const galleryCategory = z.enum(['MABAR', 'SPARING', 'UMUM']);

const listQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(12),
  search: z.string().trim().max(100).optional(),
  published: z.enum(['true', 'false']).optional(), // filter daftar admin
  category: galleryCategory.optional(),
});

const createGallerySchema = z.object({
  title: z.string().trim().min(3, 'Judul minimal 3 karakter').max(160),
  description: z.string().trim().max(1000).optional(),
  category: galleryCategory.optional().default('MABAR'),
  isPublished: multipartBool.default(true),
});

const updateGallerySchema = z
  .object({
    title: z.string().trim().min(3).max(160).optional(),
    description: z.string().trim().max(1000).nullish(),
    category: galleryCategory.optional(),
    isPublished: multipartBool,
  })
  .refine((obj) => Object.values(obj).some((v) => v !== undefined), {
    message: 'Tidak ada perubahan yang dikirim',
  });

module.exports = { listQuerySchema, createGallerySchema, updateGallerySchema };
