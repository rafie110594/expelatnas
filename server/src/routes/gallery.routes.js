// ============================================================
// Route galeri — /api/gallery
//   Publik : daftar & detail item terbit
//   ADMIN  : daftar semua, buat, ubah, hapus (upload gambar)
// ============================================================
const router = require('express').Router();

const controller = require('../controllers/gallery.controller');
const validate = require('../middlewares/validate');
const { upload } = require('../middlewares/upload');
const { requireAuth, requireRole, optionalAuth } = require('../middlewares/auth.middleware');
const {
  listQuerySchema,
  createGallerySchema,
  updateGallerySchema,
} = require('../validators/gallery.validator');

const adminOnly = [requireAuth, requireRole('ADMIN')];

// GET /api/gallery — publik, hanya item terbit
router.get('/', validate(listQuerySchema, 'query'), controller.list);

// GET /api/gallery/all — admin, semua item (filter ?published=true|false)
router.get('/all', ...adminOnly, validate(listQuerySchema, 'query'), controller.listAdmin);

// POST /api/gallery — admin, multipart: image (wajib) + title/description/isPublished
router.post(
  '/',
  ...adminOnly,
  upload.single('image'),
  validate(createGallerySchema),
  controller.create
);

// GET /api/gallery/:id — terbit = publik, belum terbit = admin saja
router.get('/:id', optionalAuth, controller.detail);

// PATCH /api/gallery/:id — admin, gambar boleh diganti (opsional)
router.patch(
  '/:id',
  ...adminOnly,
  upload.single('image'),
  validate(updateGallerySchema),
  controller.update
);

// DELETE /api/gallery/:id — admin (record + file)
router.delete('/:id', ...adminOnly, controller.remove);

module.exports = router;
