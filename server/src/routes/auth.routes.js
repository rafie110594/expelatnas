// ============================================================
// Route autentikasi — /api/auth/*
// ============================================================
const router = require('express').Router();
const rateLimit = require('express-rate-limit');

const controller = require('../controllers/auth.controller');
const validate = require('../middlewares/validate');
const { requireAuth } = require('../middlewares/auth.middleware');
const {
  loginSchema,
  registerSchema,
  changePasswordSchema,
} = require('../validators/auth.validator');

// Pembatas percobaan login (anti brute-force): 10x gagal per IP / 15 menit
// Login yang berhasil tidak dihitung agar user sah tidak ikut terblokir
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  skipSuccessfulRequests: true,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) =>
    res.status(429).json({
      success: false,
      message: 'Terlalu banyak percobaan login. Coba lagi dalam 15 menit.',
    }),
});

const registerLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) =>
    res.status(429).json({
      success: false,
      message: 'Terlalu banyak permintaan registrasi. Coba lagi nanti.',
    }),
});

// POST /api/auth/login — publik
router.post('/login', loginLimiter, validate(loginSchema), controller.login);

// POST /api/auth/register — publik, hanya bila admin membuka registrasi
router.post(
  '/register',
  registerLimiter,
  validate(registerSchema),
  controller.register
);

// POST /api/auth/refresh — memakai cookie httpOnly
router.post('/refresh', controller.refresh);

// POST /api/auth/logout — mencabut sesi
router.post('/logout', controller.logout);

// GET /api/auth/me — wajib login
router.get('/me', requireAuth, controller.me);

// PATCH /api/auth/password — wajib login
router.patch(
  '/password',
  requireAuth,
  validate(changePasswordSchema),
  controller.changePassword
);

module.exports = router;
