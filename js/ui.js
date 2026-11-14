// ============================================================
// UI helpers — PB EX PELATNAS
// toast, loading, empty, error+retry, konfirmasi, format tanggal/angka.
// Gaya mengikuti token desain situs (pill uppercase 11px, kartu rounded-2xl).
// ============================================================
(function () {
  'use strict';

  function escapeHtml(s) {
    if (s === null || s === undefined) return '';
    return String(s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  // ---------- Toast (pil, mengikuti pola showToast situs) ----------

  function toast(message, type) {
    var colors = { success: 'bg-emerald-600', error: 'bg-rose-600', info: 'bg-sky-600' };
    var el = document.createElement('div');
    el.className =
      'fixed left-1/2 -translate-x-1/2 bottom-24 z-[60] px-4 py-2 rounded-full ' +
      (colors[type] || 'bg-[#0f172a]') +
      ' text-white text-[11px] font-bold tracking-wider uppercase shadow-lg';
    el.textContent = message;
    document.body.appendChild(el);
    setTimeout(function () {
      el.remove();
    }, 2600);
  }

  // ---------- Blok status (loading / kosong / error) ----------

  function setLoading(el, text) {
    if (!el) return;
    el.innerHTML =
      '<div class="flex flex-col items-center justify-center gap-3 py-14 text-center">' +
      '<div class="w-8 h-8 border-2 border-slate-300 border-t-slate-700 rounded-full animate-spin"></div>' +
      '<p class="text-[11px] font-bold tracking-widest uppercase text-slate-400">' +
      escapeHtml(text || 'Memuat data...') +
      '</p></div>';
  }

  function showEmpty(el, message, icon) {
    if (!el) return;
    el.innerHTML =
      '<div class="flex flex-col items-center justify-center gap-3 py-14 text-center">' +
      '<span class="material-symbols-outlined text-4xl text-slate-300">' +
      escapeHtml(icon || 'inbox') +
      '</span>' +
      '<p class="text-sm text-slate-400">' +
      escapeHtml(message || 'Belum ada data') +
      '</p></div>';
  }

  /** Error + tombol coba lagi (onRetry opsional) */
  function showError(el, message, onRetry) {
    if (!el) return;
    el.innerHTML =
      '<div class="flex flex-col items-center justify-center gap-3 py-14 text-center">' +
      '<span class="material-symbols-outlined text-4xl text-rose-300">error</span>' +
      '<p class="text-sm text-slate-400">' +
      escapeHtml(message || 'Terjadi kesalahan saat memuat data') +
      '</p>' +
      (onRetry
        ? '<button type="button" class="pb-retry px-4 py-2 rounded-xl bg-slate-900 text-white text-[11px] font-bold tracking-wider uppercase hover:bg-slate-800">Coba Lagi</button>'
        : '') +
      '</div>';
    if (onRetry) {
      var btn = el.querySelector('.pb-retry');
      if (btn) btn.addEventListener('click', onRetry);
    }
  }

  /** Alur lengkap: loading → fn() → render | empty | error(retry) */
  async function loadInto(el, fn, opts) {
    opts = opts || {};
    setLoading(el, opts.loadingText);
    try {
      var data = await fn();
      var isEmpty =
        opts.isEmpty !== undefined
          ? opts.isEmpty(data)
          : Array.isArray(data)
            ? data.length === 0
            : data && data.items && data.items.length === 0;
      if (isEmpty) {
        showEmpty(el, opts.emptyText || 'Belum ada data', opts.emptyIcon);
        return null;
      }
      return data;
    } catch (err) {
      showError(el, err && err.message, function () {
        if (opts.onRetry) opts.onRetry();
      });
      return null;
    }
  }

  // ---------- Dialog konfirmasi ----------

  function confirmDialog(message, opts) {
    opts = opts || {};
    return new Promise(function (resolve) {
      var wrap = document.createElement('div');
      wrap.className =
        'fixed inset-0 z-[70] bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4';
      wrap.innerHTML =
        '<div class="bg-white rounded-2xl max-w-sm w-full p-6 shadow-2xl border border-slate-100">' +
        '<p class="text-sm text-slate-600 leading-relaxed">' +
        escapeHtml(message) +
        '</p>' +
        '<div class="mt-6 flex gap-2 justify-end">' +
        '<button type="button" data-act="cancel" class="px-4 py-2 rounded-xl text-[11px] font-bold tracking-wider uppercase text-slate-500 hover:bg-slate-100">Batal</button>' +
        '<button type="button" data-act="ok" class="px-4 py-2 rounded-xl text-[11px] font-bold tracking-wider uppercase text-white ' +
        (opts.danger ? 'bg-rose-600 hover:bg-rose-700' : 'bg-slate-900 hover:bg-slate-800') +
        '">' +
        escapeHtml(opts.confirmText || 'Ya, Lanjutkan') +
        '</button>' +
        '</div></div>';

      function done(v) {
        wrap.remove();
        document.removeEventListener('keydown', onKey);
        resolve(v);
      }
      function onKey(e) {
        if (e.key === 'Escape') done(false);
      }
      wrap.addEventListener('click', function (e) {
        if (e.target === wrap) return done(false);
        var act = e.target.closest ? e.target.closest('[data-act]') : null;
        if (act) done(act.getAttribute('data-act') === 'ok');
      });
      document.addEventListener('keydown', onKey);
      document.body.appendChild(wrap);
    });
  }

  // ---------- Format ----------

  function fmtDate(iso, withTime) {
    if (!iso) return '-';
    var d = new Date(iso);
    if (isNaN(d)) return String(iso);
    var opts = { day: 'numeric', month: 'short', year: 'numeric' };
    if (withTime) {
      opts.hour = '2-digit';
      opts.minute = '2-digit';
    }
    try {
      return d.toLocaleDateString('id-ID', opts);
    } catch (e) {
      return d.toISOString().slice(0, 10);
    }
  }

  function fmtNum(n) {
    if (n === null || n === undefined || isNaN(n)) return '0';
    try {
      return Number(n).toLocaleString('id-ID');
    } catch (e) {
      return String(n);
    }
  }

  /** Bangun query string — lewati null/undefined/kosong */
  function qs(params) {
    var parts = [];
    Object.keys(params || {}).forEach(function (k) {
      var v = params[k];
      if (v === null || v === undefined || v === '') return;
      parts.push(encodeURIComponent(k) + '=' + encodeURIComponent(v));
    });
    return parts.length ? '?' + parts.join('&') : '';
  }

  /** Isi teks aman (tanpa HTML) ke banyak elemen sekaligus */
  function setText(selector, value) {
    document.querySelectorAll(selector).forEach(function (el) {
      el.textContent = value === null || value === undefined ? '-' : value;
    });
  }

  // ---------- Menu mobile ----------

  function initMobileMenu() {
    var btn = document.getElementById('mobileMenuBtn');
    var panel = document.getElementById('mobileMenu');
    if (!btn || !panel) return;
    var icon = btn.querySelector('.material-symbols-outlined');

    function setOpen(open) {
      panel.classList.toggle('hidden', !open);
      panel.setAttribute('aria-hidden', open ? 'false' : 'true');
      btn.setAttribute('aria-expanded', open ? 'true' : 'false');
      btn.setAttribute('aria-label', open ? 'Tutup menu' : 'Buka menu');
      if (icon) icon.textContent = open ? 'close' : 'menu';
    }

    btn.addEventListener('click', function (e) {
      e.stopPropagation();
      setOpen(panel.classList.contains('hidden'));
    });

    document.addEventListener('click', function (e) {
      if (panel.classList.contains('hidden')) return;
      if (panel.contains(e.target) || btn.contains(e.target)) return;
      setOpen(false);
    });

    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') setOpen(false);
    });

    window.addEventListener('resize', function () {
      if (window.innerWidth >= 768) setOpen(false);
    });

    panel.addEventListener('click', function (e) {
      var a = e.target.closest ? e.target.closest('a[href]') : null;
      if (a) setOpen(false);
    });
  }

  function renderMobileAuth(user) {
    var el = document.getElementById('mobileAuthNav');
    if (!el) return;
    if (!user) {
      el.innerHTML =
        '<a href="member-login.html" class="flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-slate-600 hover:bg-slate-50 hover:text-slate-900 transition-colors"><span class="material-symbols-outlined text-[20px]">login</span>Masuk</a>' +
        '<a href="member-register.html" class="flex items-center gap-3 px-3.5 py-2.5 rounded-xl pb-btn"><span class="material-symbols-outlined text-[20px]">person_add</span>Daftar</a>';
      return;
    }
    var dash = user.role === 'ADMIN' ? 'admin.html' : 'member.html';
    el.innerHTML =
      '<a href="' + dash + '" class="flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-slate-600 hover:bg-slate-50 hover:text-slate-900 transition-colors"><span class="material-symbols-outlined text-[20px]">dashboard</span>' + (user.role === 'ADMIN' ? 'Admin' : 'Dashboard') + '</a>';
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initMobileMenu);
  } else {
    initMobileMenu();
  }

  window.PBUI = {
    escapeHtml: escapeHtml,
    toast: toast,
    setLoading: setLoading,
    showEmpty: showEmpty,
    showError: showError,
    loadInto: loadInto,
    confirmDialog: confirmDialog,
    fmtDate: fmtDate,
    fmtNum: fmtNum,
    qs: qs,
    setText: setText,
    renderMobileAuth: renderMobileAuth,
  };
})();
