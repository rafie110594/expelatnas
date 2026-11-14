// ============================================================
// Controller galeri
// ============================================================
const galleryService = require('../services/gallery.service');

const q = (req) => (req.validated && req.validated.query) || req.query || {};
const body = (req) => req.body || {};

async function list(req, res, next) {
  try {
    res.json({ success: true, data: await galleryService.listPublic(q(req)) });
  } catch (err) {
    next(err);
  }
}

async function listAdmin(req, res, next) {
  try {
    res.json({ success: true, data: await galleryService.listAdmin(q(req)) });
  } catch (err) {
    next(err);
  }
}

async function detail(req, res, next) {
  try {
    res.json({ success: true, data: await galleryService.detail(req.params.id, req.auth) });
  } catch (err) {
    next(err);
  }
}

async function create(req, res, next) {
  try {
    const item = await galleryService.create(body(req), req.file, req.auth);
    res.status(201).json({ success: true, message: 'Item galeri dibuat', data: item });
  } catch (err) {
    next(err);
  }
}

async function update(req, res, next) {
  try {
    const item = await galleryService.update(req.params.id, body(req), req.file, req.auth);
    res.json({ success: true, message: 'Item galeri diperbarui', data: item });
  } catch (err) {
    next(err);
  }
}

async function remove(req, res, next) {
  try {
    const result = await galleryService.remove(req.params.id, req.auth);
    res.json({ success: true, message: 'Item galeri dihapus', data: result });
  } catch (err) {
    next(err);
  }
}

module.exports = { list, listAdmin, detail, create, update, remove };
