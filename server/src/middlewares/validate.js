// ============================================================
// Validasi input generik dengan Zod
// ============================================================
const ApiError = require('../utils/ApiError');

/**
 * Jalankan skema Zod terhadap req[source] (default: body).
 * Bila gagal → 400 dengan daftar field yang bermasalah.
 */
function validate(schema, source = 'body') {
  return (req, res, next) => {
    const result = schema.safeParse(req[source]);
    if (!result.success) {
      const details = result.error.issues.map((i) => ({
        field: i.path.join('.'),
        message: i.message,
      }));
      return next(ApiError.badRequest('Validasi input gagal', details));
    }
    // Simpan hasil validasi. req.body boleh ditimpa langsung, tetapi
    // req.query di beberapa versi Express hanya-setter-ada-getter —
    // karena itu hasil parse disimpan di req.validated[source] dan
    // controller membaca dari sana.
    req.validated = req.validated || {};
    req.validated[source] = result.data;
    if (source === 'body') req.body = result.data;
    next();
  };
}

module.exports = validate;
