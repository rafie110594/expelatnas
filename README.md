# PB EX PELATNAS — Website Klub Bulutangkis

Backend REST API (Node.js + Express + PostgreSQL + Prisma) dan frontend statis
(HTML + Tailwind + JavaScript murni) untuk klub **PB EX PELATNAS**.

Fitur utama:

- **Autentikasi JWT** — access token (15 menit) di memori + refresh token
  HttpOnly cookie (7 hari) dengan rotasi & pencabutan; bcrypt untuk sandi.
- **RBAC ketat** — `ADMIN` (kelola member, pertandingan, poin, rank, galeri,
  agenda, log audit) vs `MEMBER` (profil sendiri, poin, riwayat, statistik).
- **Mesin poin ledger** — menang `+3` / kalah `-2` (admin ubah via ClubSettings,
  berlaku untuk pertandingan berikutnya). Semua perubahan tercatat sebagai
  transaksi `before/delta/after`; **koreksi skor dilakukan dengan reversal**
  (transaksi asli ditandai `isReversed`, tidak pernah dihapus).
- **Rank on-the-fly** — D (0–19), C (20–39), B (40–59), B+ (60–79), A (80+),
  batas bisa diubah admin; mengubah batas **tidak** mengubah poin member.
- **Profil anggota** — alias/nama panggilan (diatur admin), gender, foto profil,
  dan data olahraga; alias dipakai di leaderboard, riwayat, dan pilihan pemain.
- **Leaderboard publik** — urut poin, tie-break konsisten (menang → senioritas
  → nomor member), posisi global sebelum paginasi, pencarian & filter rank,
  hanya field aman publik, member `INACTIVE` dikeluarkan.
- **Galeri & Agenda** — CRUD dengan upload gambar (multipart, maks. 3MB,
  jpeg/png/webp/gif), kategori galeri `MABAR`/`SPARING`/`UMUM`, status
  draf/terbit, agenda mendatang & selesai.
- **Jadwal latihan** — hari, jam mulai/selesai, lokasi, dan tautan peta
  (default Jumat/Sabtu/Minggu 19:00–22:00 di GOR Tameklan), dapat diubah admin.
- **Keamanan** — Helmet, CORS terbatas, rate limiting, validasi Zod di semua
  input, parameterisasi query (Prisma), audit log untuk aksi admin,
  tanpa stack trace di production.

## Struktur proyek

```
expelatnas/
├── index.html, admin.html, leaderboard.html, events.html,
│   member.html, login.html, member-login.html, member-register.html
│   serve.json (rewrite /admin → admin.html)              ← frontend statis
├── js/
│   ├── config.js     # base URL API (API_BASE)
│   ├── api.js        # klien API terpusat (Bearer, refresh single-flight)
│   ├── session.js    # manajemen sesi (init/login/logout, guard halaman)
│   └── ui.js         # util UI (toast, loading, empty, error, format)
└── server/
    ├── prisma/
    │   ├── schema.prisma      # model User, MemberProfile, Match, dst.
    │   ├── migrations/
    │   └── seed.js            # data awal (admin + 5 member + match + konten)
    ├── src/
    │   ├── config/            # env.js (validasi .env), prisma.js
    │   ├── controllers/       # handler HTTP tipis
    │   ├── services/          # logika bisnis (auth, points, match, dll.)
    │   ├── routes/            # definisi rute + pemasangan middleware
    │   ├── middlewares/       # auth (JWT/RBAC), validate (Zod), upload, error
    │   ├── validators/        # skema Zod per domain
    │   ├── utils/             # jwt, rank, audit, ApiError, memberNumber
    │   ├── lib/storage.js     # driver gambar: local | cloudinary
    │   ├── app.js             # aplikasi Express (diekspor untuk test)
    │   └── server.js          # bootstrap + listen
    ├── tests/
    │   ├── unit/              # rank, mesin poin, validator Zod
    │   └── integration/       # alur auth & RBAC via supertest
    ├── uploads/               # file gambar (driver local)
    ├── .env.example           # templat konfigurasi
    └── API.md                 # referensi endpoint API lengkap
```

## Prasyarat

- Node.js ≥ 20
- PostgreSQL ≥ 14 (uji dengan 17)

## Menjalankan secara lokal

```bash
# 1. Buat database
createdb pb_expelatnas          # atau via pgAdmin / psql -c 'CREATE DATABASE pb_expelatnas;'

# 2. Konfigurasi backend
cd server
cp .env.example .env            # lalu isi DATABASE_URL & secret JWT

# 3. Migrasi + seed data awal
npm install
npm run db:migrate
npm run db:seed

# 4. Jalankan backend (port 4000)
npm run dev                     # atau: npm start

# 5. Jalankan frontend statis (port 4173) dari ROOT proyek
cd ..
npx --yes serve -l 4173 .
```

Buka <http://localhost:4173>; admin: <http://localhost:4173/admin>.

Dashboard admin dan member memakai panel berbasis hash: admin
(`#overview`, `#scores`, `#matches`, `#members`, `#ranks`, `#schedule`,
`#events`, `#gallery`) dan member (`#overview`, `#stats`, `#points`, `#profile`).

### Akun hasil seed

| Peran   | Email                     | Kata sandi      | Catatan                       |
|---------|---------------------------|-----------------|-------------------------------|
| ADMIN   | admin@pbexpelatnas.id     | Admin12345!     | Head Official                 |
| MEMBER  | anthony@pbexpelatnas.id   | Member12345!    | PB-0001, punya foto profil    |
| MEMBER  | rina@pbexpelatnas.id      | Rina12345!      | PB-0004, peringkat teratas    |

Lima member (PB-0001…PB-0005), 2 pertandingan selesai (satu sudah dikoreksi
untuk mendemonstrasikan reversal), 3 agenda, dan 1 foto galeri ikut di-seed.

> Masuk sebagai member melalui `member-login.html`; khusus admin melalui
> `login.html` atau langsung ke `/admin`. Kredensial di atas juga berlaku untuk
> akun production; reset kredensial mencabut seluruh sesi lama akun tersebut.

## Variabel environment (server/.env)

| Variabel | Wajib | Keterangan |
|---|---|---|
| `NODE_ENV` | – | `development` / `production` / `test` |
| `PORT` | – | Port API, default `4000` |
| `DATABASE_URL` | ✅ | Koneksi PostgreSQL |
| `JWT_ACCESS_SECRET` | ✅ | Secret access token (acak, ≥48 char) |
| `JWT_REFRESH_SECRET` | ✅ | Secret refresh token (berbeda!) |
| `JWT_ACCESS_TTL` / `JWT_REFRESH_TTL` | – | default `15m` / `7d` |
| `CORS_ORIGIN` | – | Origin frontend (pisahkan dengan koma) |
| `STORAGE_DRIVER` | – | `local` (default) atau `cloudinary` |
| `UPLOAD_DIR` / `MAX_UPLOAD_MB` | – | Lokasi & batas upload (default 3MB) |
| `PUBLIC_BASE_URL` | – | Asal server untuk URL gambar absolut |
| `CLOUDINARY_URL` | – | Wajib bila `STORAGE_DRIVER=cloudinary` |
| `SEED_*` | – | Akun yang dibuat `npm run db:seed` |

## Pengujian

```bash
cd server
npm test                 # unit + integrasi
npm run test:unit        # hanya unit (rank, mesin poin, validator)
npm run test:integration # hanya integrasi auth & RBAC (butuh DB aktif)
```

- **Unit** (`node:test`): resolusi rank (batas inklusif, rentang terbuka,
  non-aktif), aritmetika ledger & reversal, skema Zod (seri, pemain ganda,
  batas skor, alasan koreksi, aturan poin).
- **Integrasi** (supertest → Express): login/me, rotasi & pencabutan refresh
  token, RBAC (member ditolak di endpoint admin), endpoint publik, gerbang
  registrasi mengikuti `registrationOpen` (data uji dibersihkan otomatis).

## Aturan bisnis penting

1. **Poin** — menang `+pointsWin`, kalah `+pointsLoss` (negatif). Perubahan
   aturan hanya berlaku untuk pertandingan berikutnya.
2. **Koreksi skor** (`PATCH /api/matches/:id/correct`) — wajib menyertakan
   alasan; sistem membalik transaksi poin lama (reversal) lalu menerapkan
   hasil baru. Skor asli tetap tersimpan (`originalTeamAScore/B`).
3. **Rank ≠ posisi leaderboard ≠ poin** — rank dihitung on-the-fly dari poin
   vs `RankSettings`; poin di bawah batas terendah masuk rank terendah.
4. **Tanpa penghapusan data poin** — ledger bersifat append-only; koreksi =
   reversal, bukan delete.

## Menuju produksi

- **Database**: ganti `DATABASE_URL` ke Neon/Postgres managed, jalankan
  `npm run db:deploy`.
- **Gambar**: isi `CLOUDINARY_URL` + `STORAGE_DRIVER=cloudinary`, sesuaikan
  `PUBLIC_BASE_URL` dengan domain API.
- **CORS**: set `CORS_ORIGIN` ke domain frontend, ganti semua secret JWT,
  `NODE_ENV=production` (menonaktifkan stack trace & pesan verbose).
- Jalankan backend di belakang reverse proxy (HTTPS) — cookie refresh
  HttpOnly membutuhkan HTTPS di production.

Dokumentasi endpoint lengkap: [`server/API.md`](server/API.md).
