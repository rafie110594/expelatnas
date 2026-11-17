// ============================================================
// Route event — /api/events
//   Publik : daftar & detail event PUBLISHED
//   ADMIN  : daftar semua status, buat, ubah (bit penerbitan), hapus
// ============================================================
const router = require('express').Router();

const controller = require('../controllers/event.controller');
const validate = require('../middlewares/validate');
const { publicCache } = require('../middlewares/publicCache');
const { upload } = require('../middlewares/upload');
const { requireAuth, requireRole, optionalAuth } = require('../middlewares/auth.middleware');
const {
  listQuerySchema,
  createEventSchema,
  updateEventSchema,
} = require('../validators/event.validator');

const adminOnly = [requireAuth, requireRole('ADMIN')];

// GET /api/events — publik, hanya PUBLISHED (?time=upcoming|past)
router.get('/', publicCache(60, 300), validate(listQuerySchema, 'query'), controller.list);

// GET /api/events/all — admin, semua status (?status=DRAFT|PUBLISHED)
router.get('/all', ...adminOnly, validate(listQuerySchema, 'query'), controller.listAdmin);

// POST /api/events — admin (JSON atau multipart dgn file 'image')
router.post(
  '/',
  ...adminOnly,
  upload.single('image'),
  validate(createEventSchema),
  controller.create
);

// GET /api/events/:id — terbit = publik, DRAFT = admin saja
router.get('/:id', publicCache(60, 300), optionalAuth, controller.detail);

// PATCH /api/events/:id — admin (ubah data / status / banner)
router.patch(
  '/:id',
  ...adminOnly,
  upload.single('image'),
  validate(updateEventSchema),
  controller.update
);

// DELETE /api/events/:id — admin
router.delete('/:id', ...adminOnly, controller.remove);

module.exports = router;
