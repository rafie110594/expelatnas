// ============================================================
// Route anggota — /api/members/*
//   ADMIN  : daftar, detail, buat, ubah, penyesuaian poin
//   MEMBER : profil sendiri, statistik sendiri
// ============================================================
const router = require('express').Router();

const controller = require('../controllers/member.controller');
const validate = require('../middlewares/validate');
const { upload } = require('../middlewares/upload');
const { requireAuth, requireRole } = require('../middlewares/auth.middleware');
const {
  listQuerySchema,
  createMemberSchema,
  updateMemberSchema,
  adjustPointsSchema,
  myProfileSchema,
} = require('../validators/member.validator');

const adminOnly = [requireAuth, requireRole('ADMIN')];

// --- Rute "milik sendiri" didefinisikan lebih dulu ---
// GET /api/members/me/stats — statistik pribadi (member)
router.get('/me/stats', requireAuth, controller.myStats);

// PATCH /api/members/me/profile — edit profil sendiri (member)
router.patch('/me/profile', requireAuth, validate(myProfileSchema), controller.myProfile);

// POST /api/members/me/photo — ganti foto profil sendiri (multipart 'photo')
router.post('/me/photo', requireAuth, upload.single('photo'), controller.myPhoto);

// --- Rute admin ---
// GET /api/members — daftar anggota (search + filter rank + paginasi)
router.get('/', ...adminOnly, validate(listQuerySchema, 'query'), controller.list);

// POST /api/members — buat anggota baru
router.post('/', ...adminOnly, validate(createMemberSchema), controller.create);

// GET /api/members/:id — detail anggota + ledger poin
router.get('/:id', ...adminOnly, controller.detail);

// PATCH /api/members/:id — ubah data/status anggota
router.patch('/:id', ...adminOnly, validate(updateMemberSchema), controller.update);

// POST /api/members/:id/points — penyesuaian poin manual (audit)
router.post('/:id/points', ...adminOnly, validate(adjustPointsSchema), controller.adjust);

module.exports = router;
