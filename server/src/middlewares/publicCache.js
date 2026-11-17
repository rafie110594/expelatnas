// ============================================================
// Cache-Control untuk endpoint publik
// — request login/admin tidak boleh memakai cache publik
// ============================================================
function publicCache(sMaxAge, staleWhileRevalidate) {
  return function (req, res, next) {
    if (req.headers.authorization || req.headers.cookie) {
      res.setHeader('Cache-Control', 'private, no-store');
    } else {
      res.setHeader(
        'Cache-Control',
        `public, max-age=0, s-maxage=${sMaxAge}, stale-while-revalidate=${staleWhileRevalidate}`
      );
    }
    next();
  };
}

module.exports = { publicCache };
