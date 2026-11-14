// ============================================================
// JWT — akses token (refresh token ditangani auth.service)
// ============================================================
const jwt = require('jsonwebtoken');
const env = require('../config/env');

/** Buat access token singkat (15 menit) untuk satu user */
function signAccessToken(user) {
  return jwt.sign(
    { sub: user.id, role: user.role, email: user.email },
    env.jwt.accessSecret,
    { expiresIn: env.jwt.accessTtl }
  );
}

/** Verifikasi access token — melempar error bila invalid/kedaluwarsa */
function verifyAccessToken(token) {
  return jwt.verify(token, env.jwt.accessSecret);
}

module.exports = { signAccessToken, verifyAccessToken };
