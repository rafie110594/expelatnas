// ============================================================
// Util error API — pesan error konsisten tanpa membocorkan stack
// ============================================================
class ApiError extends Error {
  constructor(statusCode, message, details = undefined) {
    super(message);
    this.statusCode = statusCode;
    this.details = details;
    this.isOperational = true;
  }

  static badRequest(message = 'Permintaan tidak valid', details) {
    return new ApiError(400, message, details);
  }
  static unauthorized(message = 'Silakan login terlebih dahulu') {
    return new ApiError(401, message);
  }
  static forbidden(message = 'Anda tidak memiliki akses') {
    return new ApiError(403, message);
  }
  static notFound(message = 'Data tidak ditemukan') {
    return new ApiError(404, message);
  }
  static conflict(message = 'Data sudah ada') {
    return new ApiError(409, message);
  }
  static tooMany(message = 'Terlalu banyak permintaan, coba lagi nanti') {
    return new ApiError(429, message);
  }
  static internal(message = 'Terjadi kesalahan pada server') {
    return new ApiError(500, message);
  }
}

module.exports = ApiError;
