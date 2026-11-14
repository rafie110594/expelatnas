// ============================================================
// Route leaderboard — /api/leaderboard
//   Publik : daftar klasemen
//   Member : posisi sendiri
// ============================================================
const router = require('express').Router();

const controller = require('../controllers/leaderboard.controller');
const validate = require('../middlewares/validate');
const { requireAuth } = require('../middlewares/auth.middleware');
const { leaderboardQuerySchema } = require('../validators/leaderboard.validator');

// GET /api/leaderboard/me — posisi member sendiri (wajib login)
router.get('/me', requireAuth, controller.myPosition);

// GET /api/leaderboard — klasemen publik (search, filter rank, paginasi)
router.get('/', validate(leaderboardQuerySchema, 'query'), controller.list);

module.exports = router;
