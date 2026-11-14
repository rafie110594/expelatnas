// ============================================================
// Konfigurasi frontend — PB EX PELATNAS
// Lokal memakai backend terpisah; produksi memakai origin yang sama
// lewat serverless function /api di Vercel.
// ============================================================
(function () {
  var host = location.hostname;
  var isLocal = host === 'localhost' || host === '127.0.0.1' || host === '::1';
  window.PB_CONFIG = {
    API_BASE: isLocal ? 'http://localhost:4000/api' : '/api',
  };
})();
