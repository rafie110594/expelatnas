// ============================================================
// Route log audit — /api/audit-logs (ADMIN saja)
// ============================================================
const router = require('express').Router();

const controller = require('../controllers/audit.controller');
const validate = require('../middlewares/validate');
const { requireAuth, requireRole } = require('../middlewares/auth.middleware');
const { listQuerySchema } = require('../validators/audit.validator');

router.get(
  '/',
  requireAuth,
  requireRole('ADMIN'),
  validate(listQuerySchema, 'query'),
  controller.list
);

module.exports = router;
