// ============================================================
// Session — status login pengguna (mengganti sessionStorage lama)
// Bootstrap: coba refresh (cookie httpOnly) → /auth/me.
// Access token hanya hidup di memori halaman.
// ============================================================
(function () {
  'use strict';

  var user = null;
  var listeners = [];
  var initPromise = null;

  function notify() {
    listeners.forEach(function (cb) {
      try {
        cb(user);
      } catch (e) {
        /* abaikan error listener */
      }
    });
  }

  async function fetchMe() {
    user = await window.api.get('/auth/me');
    notify();
    return user;
  }

  /** Panggil sekali di awal halaman — mengembalikan user atau null */
  function init() {
    if (initPromise) return initPromise;
    initPromise = (async function () {
      try {
        var data = await window.api.post('/auth/refresh', {}, { _noRetry: true });
        if (data && data.accessToken) {
          window.api.setToken(data.accessToken);
          return await fetchMe();
        }
      } catch (e) {
        /* belum login / sesi habis — bukan kesalahan */
      }
      user = null;
      notify();
      return null;
    })();
    return initPromise;
  }

  /** Login via email & password — lempar ApiError bila gagal */
  async function login(email, password) {
    var data = await window.api.post(
      '/auth/login',
      { email: email, password: password },
      { _noRetry: true }
    );
    window.api.setToken(data.accessToken);
    user = data.user;
    notify();
    return user;
  }

  /** Logout — cabut refresh token di server, lalu bersihkan memori */
  async function logout() {
    try {
      await window.api.post('/auth/logout', {});
    } catch (e) {
      /* token mungkin sudah kedaluwarsa — tetap lanjut */
    }
    window.api.setToken(null);
    user = null;
    notify();
  }

  function currentUser() {
    return user;
  }
  function isLoggedIn() {
    return !!user;
  }
  function isAdmin() {
    return !!user && user.role === 'ADMIN';
  }
  function isMember() {
    return !!user && user.role === 'MEMBER';
  }
  function onChange(cb) {
    listeners.push(cb);
  }

  /** Guard: bila bukan role yang diminta → redirect. false = dialihkan. */
  function requireRole(role, redirectUrl) {
    if (!user || user.role !== role) {
      window.location.replace(redirectUrl || 'index.html');
      return false;
    }
    return true;
  }

  window.Session = {
    init: init,
    login: login,
    logout: logout,
    currentUser: currentUser,
    isLoggedIn: isLoggedIn,
    isAdmin: isAdmin,
    isMember: isMember,
    onChange: onChange,
    requireRole: requireRole,
  };
})();
