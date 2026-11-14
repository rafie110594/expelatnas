// ============================================================
// Skema validasi event (Zod)
// Menerima JSON biasa maupun multipart (field datang sebagai string)
// ============================================================
const { z } = require('zod');

const datetime = z
  .string()
  .datetime({ offset: true })
  .transform((s) => new Date(s));

const statusEnum = z.enum(['DRAFT', 'PUBLISHED']);

// Boolean multipart (bila ada field teks pada form upload)
const multipartBool = z
  .union([z.boolean(), z.enum(['true', 'false'])])
  .optional()
  .transform((v) => {
    if (v === true || v === 'true') return true;
    if (v === false || v === 'false') return false;
    return undefined;
  });

const createEventSchema = z
  .object({
    title: z.string().trim().min(3, 'Judul minimal 3 karakter').max(160),
    description: z.string().trim().max(3000).nullish(),
    location: z.string().trim().max(300).nullish(),
    startAt: datetime,
    endAt: datetime.optional(),
    status: statusEnum.default('DRAFT'),
    // Alternatif tanpa file: URL gambar yang sudah ada
    imageUrl: z.string().trim().max(500).nullish(),
    published: multipartBool, // bila dikirim via form, menimpa status
  })
  .refine((d) => !d.endAt || d.endAt >= d.startAt, {
    message: 'Waktu selesai tidak boleh sebelum waktu mulai',
    path: ['endAt'],
  });

const updateEventSchema = z
  .object({
    title: z.string().trim().min(3).max(160).optional(),
    description: z.string().trim().max(3000).nullish(),
    location: z.string().trim().max(300).nullish(),
    startAt: datetime.optional(),
    // boleh null / string kosong untuk mengosongkan waktu selesai
    endAt: z
      .union([
        datetime,
        z.literal('').transform(() => null),
        z.null().transform(() => null),
      ])
      .optional(),
    status: statusEnum.optional(),
    imageUrl: z.string().trim().max(500).nullish(),
    clearImage: z.enum(['true', 'false']).optional(), // hapus banner via form
  })
  .refine((d) => Object.values(d).some((v) => v !== undefined), {
    message: 'Tidak ada perubahan yang dikirim',
  });

const listQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(10),
  search: z.string().trim().max(100).optional(),
  time: z.enum(['upcoming', 'past']).optional(), // daftar publik
  status: statusEnum.optional(), // daftar admin
});

module.exports = { createEventSchema, updateEventSchema, listQuerySchema };
