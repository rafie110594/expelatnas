// ============================================================
// Service autentikasi — login, registrasi, sesi, ganti sandi
// ============================================================
const bcrypt = require('bcrypt');
const crypto = require('crypto');

const prisma = require('../config/prisma');
const ApiError = require('../utils/ApiError');
const { signAccessToken } = require('../utils/jwt');
const { generateMemberNumber } = require('../utils/memberNumber');
const { resolveRank } = require('../utils/rank');

const REFRESH_COOKIE = 'pb_refresh';

// ---------- Util refresh token ----------

function hashToken(raw) {
  return crypto.createHash('sha256').update(raw).digest('hex');
}

function generateRefreshToken() {
  return crypto.randomBytes(48).toString('hex');
}

/** Ubah '7d' | '15m' | '12h' menjadi Date kedaluwarsa */
function refreshExpiry() {
  const ttl = process.env.JWT_REFRESH_TTL || '7d';
  const match = /^(\d+)([smhd])$/.exec(ttl);
  const multipliers = { s: 1000, m: 60000, h: 3600000, d: 86400000 };
  const ms = match ? Number(match[1]) * multipliers[match[2]] : 7 * 86400000;
  return new Date(Date.now() + ms);
}

function publicUser(user) {
  const { passwordHash, ...safe } = user;
  return safe;
}

/** Terbitkan pasangan access token + refresh token (disimpan hashed) */
async function issueSession(user, req) {
  const raw = generateRefreshToken();
  await prisma.refreshToken.create({
    data: {
      tokenHash: hashToken(raw),
      userId: user.id,
      userAgent: req?.headers?.['user-agent'] || null,
      expiresAt: refreshExpiry(),
    },
  });
  return { accessToken: signAccessToken(user), refreshToken: raw };
}

// ---------- Login ----------

async function login({ email, password }, req) {
  const user = await prisma.user.findUnique({
    where: { email },
    include: { profile: true },
  });

  const invalid = ApiError.unauthorized('Email atau kata sandi salah');
  if (!user) throw invalid;

  const ok = await bcrypt.compare(password, user.passwordHash);
  if (!ok) throw invalid;

  if (user.status !== 'ACTIVE') {
    throw ApiError.forbidden('Akun dinonaktifkan. Hubungi pengurus klub.');
  }

  const session = await issueSession(user, req);
  return { ...session, user: publicUser(user) };
}

// ---------- Registrasi (hanya bila dibuka admin) ----------
// generateMemberNumber diambil dari utils/memberNumber.js (dipakai bersama)

async function register(data, req) {
  const settings = await prisma.clubSettings.findUnique({ where: { id: 1 } });
  if (settings && !settings.registrationOpen) {
    throw ApiError.forbidden('Registrasi sedang ditutup oleh pengurus klub');
  }

  const existing = await prisma.user.findUnique({ where: { email: data.email } });
  if (existing) throw ApiError.conflict('Email sudah terdaftar');

  const passwordHash = await bcrypt.hash(data.password, 10);

  const created = await prisma.$transaction(async (tx) => {
    const created = await tx.user.create({
      data: {
        fullName: data.fullName,
        email: data.email,
        passwordHash,
        role: 'MEMBER',
        status: 'ACTIVE',
        gender: data.gender || null,
        birthDate: data.birthDate ? new Date(data.birthDate) : null,
      },
    });
    await tx.memberProfile.create({
      data: {
        userId: created.id,
        memberNumber: await generateMemberNumber(tx),
        phone: data.phone || null,
        initialPoints: 0,
        currentPoints: 0,
      },
    });
    return created;
  });

  // Ambil ulang lengkap dengan profile agar respons memuat nomor anggota
  const user = await prisma.user.findUnique({
    where: { id: created.id },
    include: { profile: true },
  });

  const session = await issueSession(user, req);
  return { ...session, user: publicUser(user) };
}

// ---------- Refresh token (rotasi) ----------

async function refresh(rawToken, req) {
  if (!rawToken) throw ApiError.unauthorized('Refresh token tidak ditemukan');

  const stored = await prisma.refreshToken.findUnique({
    where: { tokenHash: hashToken(rawToken) },
    include: { user: { include: { profile: true } } },
  });

  if (!stored || stored.revokedAt || stored.expiresAt < new Date()) {
    throw ApiError.unauthorized('Sesi berakhir, silakan login ulang');
  }
  if (stored.user.status !== 'ACTIVE') {
    throw ApiError.forbidden('Akun dinonaktifkan. Hubungi pengurus klub.');
  }

  // Rotasi: token lama dicabut, token baru diterbitkan
  await prisma.refreshToken.update({
    where: { id: stored.id },
    data: { revokedAt: new Date() },
  });
  const session = await issueSession(stored.user, req);
  return { ...session, user: publicUser(stored.user) };
}

// ---------- Logout ----------

async function logout(rawToken) {
  if (!rawToken) return;
  await prisma.refreshToken.updateMany({
    where: { tokenHash: hashToken(rawToken), revokedAt: null },
    data: { revokedAt: new Date() },
  });
}

// ---------- Ganti password ----------

async function changePassword(userId, currentPassword, newPassword) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw ApiError.notFound('Pengguna tidak ditemukan');

  const ok = await bcrypt.compare(currentPassword, user.passwordHash);
  if (!ok) throw ApiError.badRequest('Kata sandi saat ini salah');

  const passwordHash = await bcrypt.hash(newPassword, 10);
  await prisma.$transaction([
    prisma.user.update({ where: { id: userId }, data: { passwordHash } }),
    // Semua sesi lama dicabut — user harus login ulang
    prisma.refreshToken.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    }),
  ]);
}

// ---------- Profil sendiri ----------

async function getMe(userId) {
  const [user, ranks] = await Promise.all([
    prisma.user.findUnique({
      where: { id: userId },
      include: { profile: { include: { rank: true } } },
    }),
    prisma.rankSetting.findMany({
      where: { isActive: true },
      orderBy: { order: 'asc' },
    }),
  ]);
  if (!user) throw ApiError.notFound('Pengguna tidak ditemukan');

  const safe = publicUser(user);
  if (safe.profile) {
    safe.profile.rank = resolveRank(safe.profile.currentPoints, ranks);
  }
  return safe;
}

module.exports = {
  REFRESH_COOKIE,
  login,
  register,
  refresh,
  logout,
  changePassword,
  getMe,
  hashToken,
  issueSession,
};
