// ============================================================
// API client terpusat — PB EX PELATNAS
// - Bearer token di memori (tanpa penyimpanan di browser)
// - Refresh otomatis (single-flight) memakai httpOnly cookie
// - Normalisasi error: { status, message, details }
// ============================================================
(function () {
  'use strict';

  var CFG = window.PB_CONFIG || {};
  var API_BASE = String(CFG.API_BASE || 'http://localhost:4000/api').replace(/\/+$/, '');
  var token = null;
  var refreshPromise = null;

  function setToken(t) {
    token = t || null;
  }
  function getToken() {
    return token;
  }

  function ApiError(status, message, details) {
    var err = new Error(message);
    err.name = 'ApiError';
    err.status = status;
    err.details = details || [];
    return err;
  }

  function normalizeError(status, json) {
    var msg;
    if (json && json.message) msg = json.message;
    else if (status === 0) msg = 'Tidak dapat terhubung ke server. Periksa koneksi internet Anda.';
    else if (status === 401) msg = 'Sesi Anda telah berakhir, silakan masuk kembali';
    else if (status === 403) msg = 'Anda tidak memiliki akses ke resource ini';
    else if (status === 404) msg = 'Data tidak ditemukan';
    else if (status === 413) msg = 'Ukuran file melebihi batas yang diizinkan';
    else if (status === 429) msg = 'Terlalu banyak permintaan, coba lagi beberapa saat lagi';
    else msg = 'Terjadi kesalahan pada server';
    return ApiError(status, msg, json && json.details);
  }

  async function rawRequest(method, path, opts) {
    opts = opts || {};
    var url = /^https?:\/\//i.test(path) ? path : API_BASE + path;
    var init = { method: method, headers: {}, credentials: 'include' };
    if (token) init.headers['Authorization'] = 'Bearer ' + token;

    var body = opts.body;
    if (typeof FormData !== 'undefined' && body instanceof FormData) {
      init.body = body; // browser mengisi boundary multipart
    } else if (body !== undefined && body !== null) {
      init.headers['Content-Type'] = 'application/json';
      init.body = JSON.stringify(body);
    }
    if (opts.signal) init.signal = opts.signal;

    var res;
    try {
      res = await fetch(url, init);
    } catch (e) {
      throw normalizeError(0, null);
    }
    var json = null;
    try {
      json = await res.json();
    } catch (e) {
      /* respons tanpa body JSON */
    }
    return { res: res, json: json };
  }

  // Refresh token (cookie httpOnly) — satu permintaan bersama (single-flight)
  function tryRefresh() {
    if (!refreshPromise) {
      refreshPromise = rawRequest('POST', '/auth/refresh', { body: {} })
        .then(function (r) {
          if (r.res.ok && r.json && r.json.data && r.json.data.accessToken) {
            token = r.json.data.accessToken;
            return true;
          }
          return false;
        })
        .catch(function () {
          return false;
        })
        .finally(function () {
          refreshPromise = null;
        });
    }
    return refreshPromise;
  }

  async function request(method, path, opts) {
    opts = opts || {};
    var r = await rawRequest(method, path, opts);

    // 401 → coba refresh sekali lalu ulangi request
    if (r.res.status === 401 && !opts._noRetry && !/^\/auth\/(login|refresh)/.test(path)) {
      var ok = await tryRefresh();
      if (ok) {
        opts._noRetry = true;
        return request(method, path, opts);
      }
      // refresh gagal → beri tahu halaman (bisa redirect ke login)
      try {
        window.dispatchEvent(new CustomEvent('pb:unauthorized'));
      } catch (e) {
        /* CustomEvent lama */
      }
      throw normalizeError(401, r.json);
    }

    if (!r.res.ok) throw normalizeError(r.res.status, r.json);
    if (r.json && r.json.success === false) throw normalizeError(r.res.status || 500, r.json);
    return r.json ? r.json.data : null;
  }

  window.api = {
    base: API_BASE,
    get: function (path, opts) {
      return request('GET', path, opts);
    },
    post: function (path, body, opts) {
      opts = opts || {};
      if (body !== undefined) opts.body = body;
      return request('POST', path, opts);
    },
    patch: function (path, body, opts) {
      opts = opts || {};
      if (body !== undefined) opts.body = body;
      return request('PATCH', path, opts);
    },
    del: function (path, opts) {
      return request('DELETE', path, opts);
    },
    // Upload multipart — kirim FormData berisi file + field teks
    upload: function (path, formData, opts) {
      opts = opts || {};
      opts.body = formData;
      return request('POST', path, opts);
    },
    uploadPatch: function (path, formData, opts) {
      opts = opts || {};
      opts.body = formData;
      return request('PATCH', path, opts);
    },
    setToken: setToken,
    getToken: getToken,
    ApiError: ApiError,
  };
})();
