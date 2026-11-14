// ============================================================
// Route pertandingan — /api/matches/*
//   ADMIN  : daftar, catat, detail, koreksi skor
//   MEMBER : riwayat pertandingan sendiri
// ============================================================
const router = require('express').Router();

const controller = require('../controllers/match.controller');
const validate = require('../middlewares/validate');
const { requireAuth, requireRole } = require('../middlewares/auth.middleware');
const {
  createMatchSchema,
  correctMatchSchema,
  listQuerySchema,
  historyQuerySchema,
} = require('../validators/match.validator');

const adminOnly = [requireAuth, requireRole('ADMIN')];

// GET /api/matches/me — riwayat pertandingan sendiri (member)
router.get('/me', requireAuth, validate(historyQuerySchema, 'query'), controller.myHistory);

// GET /api/matches — daftar semua pertandingan (admin)
router.get('/', ...adminOnly, validate(listQuerySchema, 'query'), controller.list);

// POST /api/matches — catat pertandingan + poin atomik (admin)
router.post('/', ...adminOnly, validate(createMatchSchema), controller.create);

// GET /api/matches/:id — detail + ledger poin (admin)
router.get('/:id', ...adminOnly, controller.detail);

// PATCH /api/matches/:id/correct — koreksi skor (reversal + recompute)
router.patch('/:id/correct', ...adminOnly, validate(correctMatchSchema), controller.correct);

module.exports = router;
