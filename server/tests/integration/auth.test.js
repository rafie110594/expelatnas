// ============================================================
// Test integrasi autentikasi & RBAC (supertest → app Express)
// Menjalankan test MELEWATI server terpisah (langsung ke app),
// memakai database yang sama dengan .env.
// ============================================================
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');

const app = require('../../src/app');
const prisma = require('../../src/config/prisma');

const ADMIN = { email: 'admin@pbexpelatnas.id', password: 'Admin12345!' };
const MEMBER = { email: 'anthony@pbexpelatnas.id', password: 'Member12345!' };

let adminToken;
let memberToken;

function bearer(token) {
  return { Authorization: `Bearer ${token}` };
}

/** Ambil nilai cookie tertentu dari respons */
function cookieFrom(res, name) {
  const raw = res.headers['set-cookie'] || [];
  const found = raw.find((c) => c.startsWith(name + '='));
  return found ? found.split(';')[0] : null;
}

before(async () => {
  const a = await request(app)
    .post('/api/auth/login')
    .send(ADMIN)
    .expect(200);
  adminToken = a.body.data.accessToken;

  const m = await request(app)
    .post('/api/auth/login')
    .send(MEMBER)
    .expect(200);
  memberToken = m.body.data.accessToken;
});

after(async () => {
  await prisma.$disconnect();
});

// ---------- Kesehatan & login ----------

test('GET /api/health → 200', async () => {
  const res = await request(app).get('/api/health').expect(200);
  assert.equal(res.body.success, true);
});

test('login admin berhasil → accessToken + user.role ADMIN', async () => {
  const res = await request(app)
    .post('/api/auth/login')
    .send(ADMIN)
    .expect(200);
  assert.ok(res.body.data.accessToken);
  assert.equal(res.body.data.user.role, 'ADMIN');
});

test('login dengan kata sandi salah → ditolak', async () => {
  const res = await request(app)
    .post('/api/auth/login')
    .send({ email: ADMIN.email, password: 'salah-banget' });
  assert.ok([400, 401].includes(res.status), `status ${res.status}`);
  assert.equal(res.body.success, false);
});

test('login dengan email tidak terdaftar → ditolak', async () => {
  const res = await request(app)
    .post('/api/auth/login')
    .send({ email: 'tidakada@contoh.id', password: 'Password123' });
  assert.ok([400, 401].includes(res.status), `status ${res.status}`);
});

// ---------- /auth/me ----------

test('GET /api/auth/me tanpa token → 401', async () => {
  await request(app).get('/api/auth/me').expect(401);
});

test('GET /api/auth/me dengan token admin → 200 + profil', async () => {
  const res = await request(app)
    .get('/api/auth/me')
    .set(bearer(adminToken))
    .expect(200);
  assert.equal(res.body.data.role, 'ADMIN');
});

test('token rusak/garbage → 401', async () => {
  await request(app)
    .get('/api/auth/me')
    .set(bearer('bukan.jwt.sah'))
    .expect(401);
});

// ---------- RBAC ----------

test('member tidak boleh membuka daftar member (admin-only) → 403', async () => {
  await request(app)
    .get('/api/members')
    .set(bearer(memberToken))
    .expect(403);
});

test('member tidak boleh membuka log audit → 403', async () => {
  await request(app)
    .get('/api/audit-logs')
    .set(bearer(memberToken))
    .expect(403);
});

test('tanpa token, endpoint admin → 401', async () => {
  await request(app).get('/api/members').expect(401);
  await request(app).get('/api/audit-logs').expect(401);
});

test('admin boleh membuka daftar member & log audit → 200', async () => {
  const m = await request(app)
    .get('/api/members?limit=1')
    .set(bearer(adminToken))
    .expect(200);
  assert.ok(Array.isArray(m.body.data.items));

  const a = await request(app)
    .get('/api/audit-logs?limit=1')
    .set(bearer(adminToken))
    .expect(200);
  assert.ok(Array.isArray(a.body.data.items));
});

test('member melihat profil sendiri → 200', async () => {
  const res = await request(app)
    .get('/api/members/me/stats')
    .set(bearer(memberToken))
    .expect(200);
  assert.ok(res.body.data);
});

// ---------- Endpoints publik ----------

test('leaderboard & settings publik tanpa token → 200', async () => {
  const lb = await request(app).get('/api/leaderboard?limit=3').expect(200);
  assert.ok(Array.isArray(lb.body.data.items));

  const st = await request(app).get('/api/settings').expect(200);
  assert.ok(st.body.data.club);
  assert.ok(Array.isArray(st.body.data.ranks));
});

// ---------- Refresh token: rotasi & pencabutan ----------

test('refresh dengan cookie valid → token baru; cookie lama langsung tidak berlaku', async () => {
  const login = await request(app)
    .post('/api/auth/login')
    .send(MEMBER)
    .expect(200);
  const cookie = cookieFrom(login, 'pb_refresh');
  assert.ok(cookie, 'login harus menyetel cookie pb_refresh');

  // Pakai cookie → dapat token baru
  const ref1 = await request(app)
    .post('/api/auth/refresh')
    .set('Cookie', cookie)
    .expect(200);
  assert.ok(ref1.body.data.accessToken);

  // Cookie yang SAMA dipakai lagi → sudah diputar, ditolak
  const reuse = await request(app)
    .post('/api/auth/refresh')
    .set('Cookie', cookie);
  assert.ok([400, 401].includes(reuse.status), `status ${reuse.status}`);
});

test('logout mencabut refresh token → refresh berikutnya ditolak', async () => {
  const login = await request(app)
    .post('/api/auth/login')
    .send(MEMBER)
    .expect(200);
  const cookie = cookieFrom(login, 'pb_refresh');

  await request(app)
    .post('/api/auth/logout')
    .set('Cookie', cookie)
    .expect(200);

  const after = await request(app)
    .post('/api/auth/refresh')
    .set('Cookie', cookie);
  assert.ok([400, 401].includes(after.status), `status ${after.status}`);
});

// ---------- Registrasi publik mengikuti pengaturan klub ----------

test('registrasi publik: mengikuti flag registrationOpen dan membersihkan data uji', async () => {
  // Baca pengaturan asli untuk dikembalikan
  const beforeRes = await request(app).get('/api/settings').expect(200);
  const original = !!beforeRes.body.data.club.registrationOpen;
  const testEmail = `uji-auth-${Date.now()}@contoh.id`;

  try {
    // Paksa registrasi terbuka
    await request(app)
      .patch('/api/settings')
      .set(bearer(adminToken))
      .send({ registrationOpen: true })
      .expect(200);

    // Daftar member baru → sukses
    const reg = await request(app)
      .post('/api/auth/register')
      .send({
        fullName: 'Anggota Uji Otomatis',
        email: testEmail,
        password: 'Password123',
      });
    assert.ok([200, 201].includes(reg.status), `status ${reg.status}`);
    assert.ok(reg.body.data.accessToken);

    // Tutup registrasi → pendaftaran berikutnya ditolak
    await request(app)
      .patch('/api/settings')
      .set(bearer(adminToken))
      .send({ registrationOpen: false })
      .expect(200);

    const rejected = await request(app)
      .post('/api/auth/register')
      .send({
        fullName: 'Anggota Uji Ditolak',
        email: `uji-ditolak-${Date.now()}@contoh.id`,
        password: 'Password123',
      });
    assert.ok([400, 403].includes(rejected.status), `status ${rejected.status}`);
  } finally {
    // Bersihkan user uji (urutan: dependen dulu, lalu user)
    const user = await prisma.user.findUnique({ where: { email: testEmail } });
    if (user) {
      await prisma.refreshToken.deleteMany({ where: { userId: user.id } });
      await prisma.auditLog.deleteMany({ where: { adminId: user.id } });
      await prisma.auditLog.deleteMany({ where: { entityId: user.id } });
      await prisma.memberProfile.deleteMany({ where: { userId: user.id } });
      await prisma.user.delete({ where: { id: user.id } });
    }
    // Kembalikan pengaturan asli
    await prisma.clubSettings.update({
      where: { id: 1 },
      data: { registrationOpen: original },
    });
  }
});
