// ============================================================
// Controller leaderboard
// ============================================================
const leaderboardService = require('../services/leaderboard.service');

const q = (req) => (req.validated && req.validated.query) || req.query || {};

async function list(req, res, next) {
  try {
    res.json({ success: true, data: await leaderboardService.list(q(req)) });
  } catch (err) {
    next(err);
  }
}

async function myPosition(req, res, next) {
  try {
    res.json({ success: true, data: await leaderboardService.myPosition(req.auth.id) });
  } catch (err) {
    next(err);
  }
}

module.exports = { list, myPosition };
