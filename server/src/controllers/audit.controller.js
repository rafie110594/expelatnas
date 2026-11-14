// ============================================================
// Controller log audit
// ============================================================
const auditService = require('../services/audit.service');

const q = (req) => (req.validated && req.validated.query) || req.query || {};

async function list(req, res, next) {
  try {
    res.json({ success: true, data: await auditService.list(q(req)) });
  } catch (err) {
    next(err);
  }
}

module.exports = { list };
