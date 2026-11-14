// ============================================================
// Middleware autentikasi (RBAC)
// ============================================================
const prisma = require('../config/prisma');
const env = require('../config/env');
const ApiError = require('../utils/ApiError');
const { verifyAccessToken } = require('../utils/jwt');

/**
 * Wajib login: Authorization: Bearer <accessToken>
 * Status akun dicek ulang ke DB setiap request agar akun
 * yang dinonaktifkan admin langsung kehilangan akses.
 */
async function requireAuth(req, res, next) {
  try {
    const header = req.headers.authorization || '';
    const [scheme, token] = header.split(' ');
    if (scheme !== 'Bearer' || !token) {
      throw ApiError.unauthorized('Token tidak ditemukan, silakan login');
    }

    let payload;
    try {
      payload = verifyAccessToken(token);
    } catch (err) {
      throw ApiError.unauthorized('Token tidak valid atau kedaluwarsa');
    }

    const user = await prisma.user.findUnique({
      where: { id: payload.sub },
      select: { id: true, fullName: true, email: true, role: true, status: true },
    });
    if (!user) throw ApiError.unauthorized('Akun tidak ditemukan');
    if (user.status !== 'ACTIVE') {
      throw ApiError.forbidden('Akun dinonaktifkan. Hubungi pengurus klub.');
    }

    req.auth = user; // { id, fullName, email, role, status }
    next();
  } catch (err) {
    next(err);
  }
}

/** Batasi akses berdasarkan role, contoh: requireRole('ADMIN') */
function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.auth) return next(ApiError.unauthorized());
    if (!roles.includes(req.auth.role)) {
      return next(ApiError.forbidden('Anda tidak memiliki akses ke resource ini'));
    }
    next();
  };
}

/**
 * Autentikasi OPSIONAL — bila ada Bearer token valid, req.auth diisi
 * (tanpa cek DB, cukup klaim token). Bila tidak ada/salah, request
 * tetap lanjut sebagai anonim. Dipakai detail konten publik yang
 * boleh dilihat lebih luas oleh admin.
 */
function optionalAuth(req, res, next) {
  const header = req.headers.authorization || '';
  const [scheme, token] = header.split(' ');
  if (scheme === 'Bearer' && token) {
    try {
      const payload = verifyAccessToken(token);
      req.auth = { id: payload.sub, role: payload.role, email: payload.email };
    } catch (err) {
      // token kedaluwarsa/invalid → perlakukan sebagai anonim
    }
  }
  next();
}

module.exports = { requireAuth, requireRole, optionalAuth };
