// ============================================================
// Route pengaturan — /api/settings
//   Publik : info klub + rentang rank (dibutuhkan halaman publik)
//   ADMIN  : ubah pengaturan klub + CRUD rentang rank
// ============================================================
const router = require('express').Router();

const controller = require('../controllers/setting.controller');
const validate = require('../middlewares/validate');
const { requireAuth, requireRole } = require('../middlewares/auth.middleware');
const {
  updateSettingsSchema,
  createRankSchema,
  updateRankSchema,
} = require('../validators/setting.validator');

const adminOnly = [requireAuth, requireRole('ADMIN')];

// --- Pengaturan klub ---
// GET /api/settings — publik (info klub + daftar rank)
router.get('/', controller.getSettings);

// PATCH /api/settings — admin (aturan poin, registrasi, tie-break, dll)
router.patch('/', ...adminOnly, validate(updateSettingsSchema), controller.updateSettings);

// --- Rentang rank ---
// GET /api/settings/ranks — publik
router.get('/ranks', controller.listRanks);

// POST /api/settings/ranks — admin, tervalidasi anti tumpang-tindih
router.post('/ranks', ...adminOnly, validate(createRankSchema), controller.createRank);

// PATCH /api/settings/ranks/:id — admin, divalidasi terhadap set penuh
router.patch('/ranks/:id', ...adminOnly, validate(updateRankSchema), controller.updateRank);

// DELETE /api/settings/ranks/:id — admin
router.delete('/ranks/:id', ...adminOnly, controller.deleteRank);

module.exports = router;
