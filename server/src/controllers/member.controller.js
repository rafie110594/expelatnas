// ============================================================
// Controller anggota — HTTP glue
// ============================================================
const memberService = require('../services/member.service');

// Query divalidasi Zod tersimpan di req.validated.query
const q = (req) => (req.validated && req.validated.query) || req.query || {};

async function list(req, res, next) {
  try {
    res.json({ success: true, data: await memberService.list(q(req)) });
  } catch (err) {
    next(err);
  }
}

async function create(req, res, next) {
  try {
    const member = await memberService.create(req.body, req.auth);
    res.status(201).json({ success: true, message: 'Anggota berhasil dibuat', data: member });
  } catch (err) {
    next(err);
  }
}

async function detail(req, res, next) {
  try {
    res.json({ success: true, data: await memberService.detail(req.params.id) });
  } catch (err) {
    next(err);
  }
}

async function update(req, res, next) {
  try {
    const member = await memberService.update(req.params.id, req.body, req.auth);
    res.json({ success: true, message: 'Anggota berhasil diperbarui', data: member });
  } catch (err) {
    next(err);
  }
}

async function adjust(req, res, next) {
  try {
    const result = await memberService.adjustPoints(req.params.id, req.body, req.auth);
    res.json({ success: true, message: 'Poin disesuaikan', data: result });
  } catch (err) {
    next(err);
  }
}

async function myStats(req, res, next) {
  try {
    res.json({ success: true, data: await memberService.getMyStats(req.auth.id) });
  } catch (err) {
    next(err);
  }
}

async function myProfile(req, res, next) {
  try {
    const member = await memberService.updateMyProfile(req.auth.id, req.body);
    res.json({ success: true, message: 'Profil berhasil diperbarui', data: member });
  } catch (err) {
    next(err);
  }
}

/** POST /api/members/me/photo — ganti foto profil (multipart 'photo') */
async function myPhoto(req, res, next) {
  try {
    const result = await memberService.changeMyPhoto(req.auth.id, req.file);
    res.json({ success: true, message: 'Foto profil diperbarui', data: result });
  } catch (err) {
    next(err);
  }
}

module.exports = { list, create, detail, update, adjust, myStats, myProfile, myPhoto };
