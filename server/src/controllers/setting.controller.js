// ============================================================
// Controller pengaturan klub & rank
// ============================================================
const settingService = require('../services/setting.service');

async function getSettings(req, res, next) {
  try {
    res.json({ success: true, data: await settingService.getPublic() });
  } catch (err) {
    next(err);
  }
}

async function updateSettings(req, res, next) {
  try {
    const club = await settingService.updateSettings(req.body, req.auth);
    res.json({ success: true, message: 'Pengaturan diperbarui', data: { club } });
  } catch (err) {
    next(err);
  }
}

async function listRanks(req, res, next) {
  try {
    res.json({ success: true, data: { ranks: await settingService.listRanks() } });
  } catch (err) {
    next(err);
  }
}

async function createRank(req, res, next) {
  try {
    const rank = await settingService.createRank(req.body, req.auth);
    res.status(201).json({ success: true, message: 'Rank dibuat', data: rank });
  } catch (err) {
    next(err);
  }
}

async function updateRank(req, res, next) {
  try {
    const rank = await settingService.updateRank(req.params.id, req.body, req.auth);
    res.json({ success: true, message: 'Rank diperbarui', data: rank });
  } catch (err) {
    next(err);
  }
}

async function deleteRank(req, res, next) {
  try {
    const result = await settingService.deleteRank(req.params.id, req.auth);
    res.json({ success: true, message: 'Rank dihapus', data: result });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  getSettings,
  updateSettings,
  listRanks,
  createRank,
  updateRank,
  deleteRank,
};
