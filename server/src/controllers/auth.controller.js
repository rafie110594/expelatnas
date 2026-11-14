// ============================================================
// Controller autentikasi — HTTP glue, cookie refresh token
// ============================================================
const env = require('../config/env');
const authService = require('../services/auth.service');
const { REFRESH_COOKIE } = require('../services/auth.service');

function refreshCookieOptions() {
  const ttl = process.env.JWT_REFRESH_TTL || '7d';
  const match = /^(\d+)([smhd])$/.exec(ttl);
  const multipliers = { s: 1000, m: 60000, h: 3600000, d: 86400000 };
  const ms = match ? Number(match[1]) * multipliers[match[2]] : 7 * 86400000;
  return {
    httpOnly: true, // tidak bisa diakses JavaScript
    sameSite: 'lax',
    secure: env.isProduction,
    path: '/api/auth', // hanya dikirim ke endpoint auth
    maxAge: ms,
  };
}

async function login(req, res, next) {
  try {
    const result = await authService.login(req.body, req);
    res.cookie(REFRESH_COOKIE, result.refreshToken, refreshCookieOptions());
    res.json({
      success: true,
      message: 'Login berhasil',
      data: { accessToken: result.accessToken, user: result.user },
    });
  } catch (err) {
    next(err);
  }
}

async function register(req, res, next) {
  try {
    const result = await authService.register(req.body, req);
    res.cookie(REFRESH_COOKIE, result.refreshToken, refreshCookieOptions());
    res.status(201).json({
      success: true,
      message: 'Registrasi berhasil',
      data: { accessToken: result.accessToken, user: result.user },
    });
  } catch (err) {
    next(err);
  }
}

async function refresh(req, res, next) {
  try {
    const raw = req.cookies?.[REFRESH_COOKIE];
    const result = await authService.refresh(raw, req);
    res.cookie(REFRESH_COOKIE, result.refreshToken, refreshCookieOptions());
    res.json({
      success: true,
      message: 'Sesi diperbarui',
      data: { accessToken: result.accessToken, user: result.user },
    });
  } catch (err) {
    res.clearCookie(REFRESH_COOKIE, { path: '/api/auth' });
    next(err);
  }
}

async function logout(req, res, next) {
  try {
    const raw = req.cookies?.[REFRESH_COOKIE];
    await authService.logout(raw);
    res.clearCookie(REFRESH_COOKIE, { path: '/api/auth' });
    res.json({ success: true, message: 'Berhasil keluar' });
  } catch (err) {
    next(err);
  }
}

async function me(req, res, next) {
  try {
    const user = await authService.getMe(req.auth.id);
    res.json({ success: true, data: user });
  } catch (err) {
    next(err);
  }
}

async function changePassword(req, res, next) {
  try {
    const { currentPassword, newPassword } = req.body;
    await authService.changePassword(req.auth.id, currentPassword, newPassword);
    res.clearCookie(REFRESH_COOKIE, { path: '/api/auth' });
    res.json({
      success: true,
      message: 'Kata sandi berhasil diubah. Silakan login kembali.',
    });
  } catch (err) {
    next(err);
  }
}

module.exports = { login, register, refresh, logout, me, changePassword };
