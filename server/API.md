# Referensi API — PB EX PELATNAS

Semua endpoint berada di bawah **`/api`**, metode **JSON** kecuali upload
(gambar) yang memakai `multipart/form-data`. Server berjalan di
`http://localhost:4000` (sesuaikan `API_BASE` di `js/config.js`).

## Konvensi respons

Berhasil:

```json
{ "success": true, "message": "opsional", "data": { } }
```

Daftar (data terpaginasi):

```json
{
  "success": true,
  "data": {
    "items": [ ],
    "pagination": { "page": 1, "limit": 12, "total": 57, "totalPages": 5 }
  }
}
```

Gagal:

```json
{ "success": false, "message": "Keterangan singkat", "errors": [ ] }
```

`errors` muncul untuk kegagalan validasi Zod (array field/path).

## Autentikasi

| Mekanisme | Keterangan |
|---|---|
| **Access token** | JWT, TTL 15 menit, dikirim sebagai `Authorization: Bearer <token>` |
| **Refresh token** | JWT, TTL 7 hari, cookie **HttpOnly** `pb_refresh` (path `/api/auth`), di-set oleh login/register/refresh |
| **Rotasi** | Setiap `POST /auth/refresh` mencabut cookie lama dan menyetel cookie baru — cookie bekas langsung tidak berlaku |
| **RBAC** | `requireAuth` (login) & `requireRole('ADMIN')` — semua endpoint admin menolak member dengan `403` |

Masa berlaku access token singkat; klien frontend (`js/api.js`) memperbarui
token secara otomatis (single-flight) ketika menerima `401`.

---

## Health

| Method | Path | Auth | Keterangan |
|---|---|---|---|
| GET | `/api/health` | – | `{ success, message, env, timestamp }` |

---

## Auth — `/api/auth`

| Method | Path | Auth | Keterangan |
|---|---|---|---|
| POST | `/api/auth/login` | – | Login; set cookie refresh; rate limit 10 login / 15 menit / IP |
| POST | `/api/auth/register` | publik terbuka | Hanya bila `club.registrationOpen = true`; rate limit 10 / jam |
| POST | `/api/auth/refresh` | cookie | Rotasi refresh token → access token baru |
| POST | `/api/auth/logout` | cookie | Mencabut refresh token |
| GET | `/api/auth/me` | login | Profil user lengkap (termasuk `profile.rank`) |
| PATCH | `/api/auth/password` | login | Ganti sandi: `{ currentPassword, newPassword }` |

Login / register / refresh merespons:

```json
{ "success": true, "data": { "accessToken": "…", "user": { "id": "…", "fullName": "…", "role": "MEMBER", "profile": { } } } }
```

---

## Members — `/api/members`

| Method | Path | Auth | Keterangan |
|---|---|---|---|
| GET | `/api/members/me/stats` | login | Statistik sendiri: `totalMatches, wins, losses, winRate, currentStreak, pointsThisMonth, trend[], rank` |
| PATCH | `/api/members/me/profile` | login | Edit profil sendiri (tanpa poin/status/nomor) |
| POST | `/api/members/me/photo` | login | Multipart field `photo` — foto profil |
| GET | `/api/members` | ADMIN | Query: `search, rank (D\|C\|B\|A\|NONE), status (ACTIVE\|INACTIVE), page, limit` |
| POST | `/api/members` | ADMIN | `{ fullName, email, password, initialPoints?, gender?, birthDate?, phone? }` |
| GET | `/api/members/:id` | ADMIN | Detail member + ledger poin |
| PATCH | `/api/members/:id` | ADMIN | `{ fullName?, status?, gender?, birthDate?, phone? }` — nullish |
| POST | `/api/members/:id/points` | ADMIN | `{ delta, reason }` — penyesuaian manual (tercatat di ledger, `delta ≠ 0`) |

Item daftar member:

```json
{
  "id": "…", "memberNumber": "PB-0004", "fullName": "…", "email": "…",
  "phone": "…", "gender": "LAKI_LAKI", "birthDate": "1996-10-20T00:00:00.000Z",
  "status": "ACTIVE", "currentPoints": 68,
  "rank": { "id": "…", "name": "B", "minPoints": 50, "maxPoints": 79, "order": 3, "isActive": true }
}
```

---

## Matches — `/api/matches`

| Method | Path | Auth | Keterangan |
|---|---|---|---|
| GET | `/api/matches/me` | login | Riwayat sendiri: `page, limit`; item menyertakan `myTeam, isWin, partners, opponents, isCorrected` |
| GET | `/api/matches` | ADMIN | Query: `page, limit, search, status (DRAFT\|COMPLETED\|CANCELLED)` |
| POST | `/api/matches` | ADMIN | Catat hasil → poin langsung diterapkan |
| GET | `/api/matches/:id` | ADMIN | Detail + peserta + transaksi poin |
| PATCH | `/api/matches/:id/correct` | ADMIN | Koreksi skor (reversal + terapkan ulang) |

Buat pertandingan (skor adalah sepasang angka tim; seri ditolak; pemain tidak
boleh di dua tim):

```json
POST /api/matches
{
  "title": "Laga Placement Kamis",
  "matchType": "DOUBLES",            // hanya DOUBLES
  "scheduledAt": "2026-10-15T20:30:00+07:00",   // opsional
  "teamA": ["<memberId>", "<memberId>"],        // tepat 2 pemain
  "teamB": ["<memberId>", "<memberId>"],
  "teamAScore": 21,
  "teamBScore": 15
}
```

Koreksi (wajib alasan ≥5 karakter; skor asli tersimpan di
`originalTeamAScore/originalTeamBScore`; poin lama dibalik via transaksi
`REVERSAL`):

```json
PATCH /api/matches/:id/correct
{ "teamAScore": 15, "teamBScore": 21, "reason": "Input skor terbalik" }
```

Item match (admin):

```json
{
  "id": "…", "title": "…", "matchType": "DOUBLES", "status": "COMPLETED",
  "teamAScore": 21, "teamBScore": 15, "winnerSide": "A",
  "originalTeamAScore": null, "originalTeamBScore": null, "correctionReason": null,
  "isCorrected": false, "pointsApplied": true,
  "teams": { "A": [ { "id": "…", "fullName": "…", "memberNumber": "PB-0001" } ], "B": [ ] },
  "recordedBy": "Head Official", "completedAt": "…"
}
```

---

## Leaderboard — `/api/leaderboard`

| Method | Path | Auth | Keterangan |
|---|---|---|---|
| GET | `/api/leaderboard` | publik | Query: `search, rank (D\|C\|B\|B+\|A\|NONE), page, limit`; pencarian juga mencakup alias; posisi global dihitung sebelum paginasi; hanya member `ACTIVE`; field aman publik (`position, memberNumber, fullName, alias, photoUrl, currentPoints, rank, wins, losses, matchesPlayed`) |
| GET | `/api/leaderboard/me` | login | Posisi sendiri: `{ position, totalParticipants, tieBreak, member }` |

Tie-break konsisten: poin → jumlah menang → senioritas → nomor member.

---

## Settings — `/api/settings`

| Method | Path | Auth | Keterangan |
|---|---|---|---|
| GET | `/api/settings` | publik | `{ club, ranks, stats }` — `stats: { members, matches, events }` untuk beranda |
| PATCH | `/api/settings` | ADMIN | `clubName?, description?, contactEmail?, contactPhone?, whatsappLink?, pointsWin?, pointsLoss? (≤0), registrationOpen?, tieBreak?, trainingDays?, trainingStart?, trainingEnd?, trainingLocation?, trainingMapUrl?, …` |
| GET | `/api/settings/ranks` | publik | Daftar rentang rank |
| POST | `/api/settings/ranks` | ADMIN | `{ name, minPoints, maxPoints?, order, isActive }` |
| PATCH | `/api/settings/ranks/:id` | ADMIN | Ubah rentang; divalidasi anti tumpang-tindih terhadap seluruh set; `maxPoints: null` = tanpa batas atas |
| DELETE | `/api/settings/ranks/:id` | ADMIN | Hapus rentang rank |

Aturan poin baru hanya berlaku untuk pertandingan berikutnya — ledger lama
tidak pernah diubah.

Jadwal latihan: `trainingDays` berupa daftar hari dipisah koma
(`Jumat,Sabtu,Minggu`), `trainingStart`/`trainingEnd` format `HH:MM`, serta
`trainingLocation` dan `trainingMapUrl` (opsional).

---

## Gallery — `/api/gallery`

| Method | Path | Auth | Keterangan |
|---|---|---|---|
| GET | `/api/gallery` | publik | Hanya item terbit; `page, limit, search, category (MABAR\|SPARING\|UMUM)` |
| GET | `/api/gallery/all` | ADMIN | Semua item; filter `published=true\|false`, `category` |
| POST | `/api/gallery` | ADMIN | Multipart: `image` (wajib, ≤3MB, jpeg/png/webp/gif), `title`, `description?`, `category (MABAR\|SPARING\|UMUM, default MABAR)`, `isPublished ('true'\|'false')` |
| GET | `/api/gallery/:id` | publik* | Item terbit bebas; draf hanya ADMIN |
| PATCH | `/api/gallery/:id` | ADMIN | JSON `{ title?, description?, category?, isPublished? }` atau multipart + `image` (ganti gambar) |
| DELETE | `/api/gallery/:id` | ADMIN | Hapus record + file gambar |

---

## Events (Agenda) — `/api/events`

| Method | Path | Auth | Keterangan |
|---|---|---|---|
| GET | `/api/events` | publik | Hanya `PUBLISHED`; `time=upcoming\|past`, `search`, `page, limit` |
| GET | `/api/events/all` | ADMIN | Semua status; filter `status=DRAFT\|PUBLISHED` |
| POST | `/api/events` | ADMIN | JSON `{ title, description?, location?, startAt, endAt?, status? }` atau multipart + field `image` |
| GET | `/api/events/:id` | opsional | Draf hanya ADMIN |
| PATCH | `/api/events/:id` | ADMIN | JSON atau multipart; `endAt: ""`/`null` mengosongkan; multipart mendukung `clearImage: 'true'` |
| DELETE | `/api/events/:id` | ADMIN | Hapus agenda + banner |

Waktu memakai ISO-8601 ber-offset (`2026-11-02T19:30:00+07:00` atau `Z`);
`endAt` tidak boleh sebelum `startAt`.

---

## Audit logs — `/api/audit-logs`

| Method | Path | Auth | Keterangan |
|---|---|---|---|
| GET | `/api/audit-logs` | ADMIN | `page, limit`; item: `{ id, action, entity, entityId, before, after, note, admin, createdAt }` |

---

## Batas & pesan umum

- **Upload gambar**: maks. `MAX_UPLOAD_MB` (default 3MB), MIME diizinkan
  `jpeg, png, webp, gif` (SVG ditolak); nama file dihasilkan server.
- **Skor**: integer 0–999, tidak boleh seri.
- **Pesan error** berbahasa Indonesia, mis. `"Skor tidak boleh seri — harus
  ada pemenang"`, `"Email atau kata sandi salah"`.
- **Rate limit**: login 10/15 menit/IP, register 10/jam/IP.
- **Produksi**: `NODE_ENV=production` menyembunyikan detail error internal
  (tanpa stack trace pada respons).
