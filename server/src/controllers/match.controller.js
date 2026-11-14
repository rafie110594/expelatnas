// ============================================================
// Controller pertandingan — HTTP glue
// ============================================================
const matchService = require('../services/match.service');

const q = (req) => (req.validated && req.validated.query) || req.query || {};

async function list(req, res, next) {
  try {
    res.json({ success: true, data: await matchService.list(q(req)) });
  } catch (err) {
    next(err);
  }
}

async function create(req, res, next) {
  try {
    const match = await matchService.create(req.body, req.auth);
    res.status(201).json({ success: true, message: 'Pertandingan dicatat', data: match });
  } catch (err) {
    next(err);
  }
}

async function detail(req, res, next) {
  try {
    res.json({ success: true, data: await matchService.detail(req.params.id) });
  } catch (err) {
    next(err);
  }
}

async function correct(req, res, next) {
  try {
    const match = await matchService.correct(req.params.id, req.body, req.auth);
    res.json({ success: true, message: 'Koreksi skor diterapkan', data: match });
  } catch (err) {
    next(err);
  }
}

async function myHistory(req, res, next) {
  try {
    res.json({ success: true, data: await matchService.myHistory(req.auth.id, q(req)) });
  } catch (err) {
    next(err);
  }
}

module.exports = { list, create, detail, correct, myHistory };
