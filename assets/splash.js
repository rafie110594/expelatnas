(function () {
  "use strict";

  var NAV_KEY = "pb-splash-nav";

  document.addEventListener(
    "click",
    function (e) {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      var el = e.target;
      var a = el && el.closest ? el.closest("a[href]") : null;
      if (!a || (a.target && a.target !== "_self") || a.hasAttribute("download")) return;
      var raw = a.getAttribute("href");
      if (!raw || raw.charAt(0) === "#") return;
      var url;
      try {
        url = new URL(a.href, location.href);
      } catch (err) {
        return;
      }
      if (url.origin !== location.origin) return;
      if (url.pathname === location.pathname && url.search === location.search) return;
      try {
        sessionStorage.setItem(NAV_KEY, "1");
      } catch (err) {}
    },
    true
  );

  var overlay = document.getElementById("pbSplash");
  if (!overlay) return;

  var isReload = false;
  var internalNav = false;
  try {
    var navEntries = performance.getEntriesByType("navigation");
    isReload = !!(navEntries && navEntries[0] && navEntries[0].type === "reload");
  } catch (e) {}
  try {
    internalNav = sessionStorage.getItem(NAV_KEY) === "1";
  } catch (e) {}

  if (internalNav && !isReload) {
    if (overlay.parentNode) overlay.parentNode.removeChild(overlay);
    document.documentElement.classList.remove("pb-splash-active");
    return;
  }

  document.documentElement.classList.add("pb-splash-active");

  overlay.innerHTML =
    '<div class="pb-splash-stage" id="pbSplashStage">' +
    '<div class="pb-splash-wrap" id="pbSplashWrap">' +
    '<img alt="" src="assets/logo-no-kok.png" />' +
    '<svg id="pbSplashFill" viewBox="0 0 512 512">' +
    '<defs>' +
    '<filter id="pbSplashBlur" x="-5%" y="-20%" width="110%" height="140%"><feGaussianBlur stdDeviation=".6"/></filter>' +
    '<clipPath id="pbSplashClip"><rect id="pbSplashClipRect" x="200" y="80" width="0" height="230"/></clipPath>' +
    '</defs>' +
    '<g clip-path="url(#pbSplashClip)" filter="url(#pbSplashBlur)">' +
    '<path d="M224 111C300 100 380 99 444 98L414 123C370 117 300 116 224 120Z" fill="#ff6a05"/>' +
    '<path d="M236 161C300 151 380 151 438 155L414 168C360 168 300 168 236 164Z" fill="#ff6a05"/>' +
    '<path d="M296 247C330 236 370 214 408 196L446 184L412 203C380 226 340 243 296 250Z" fill="#ff6a05"/>' +
    '<path d="M229 249L336 254L336 268L229 268Z" fill="#ff6a05"/>' +
    '</g>' +
    '<g id="pbSplashFx"></g>' +
    '</svg>' +
    '<img id="pbSplashFull" alt="Logo PB EX PELATNAS" src="assets/logo-round.png" />' +
    '<canvas id="pbSplashCanvas"></canvas>' +
    '</div>' +
    '</div>';

  var NS = "http://www.w3.org/2000/svg";
  var stage = document.getElementById("pbSplashStage");
  var wrap = document.getElementById("pbSplashWrap");
  var clipRect = document.getElementById("pbSplashClipRect");
  var fx = document.getElementById("pbSplashFx");
  var cv = document.getElementById("pbSplashCanvas");
  var full = document.getElementById("pbSplashFull");
  var ctx = cv.getContext("2d");

  var D = 5000;
  var FLY_START = 1200;
  var FLY_DUR = 600;
  var TI = FLY_START + FLY_DUR;
  var start = 0;
  var raf = 0;
  var animDone = false;
  var finished = false;
  var reduce = false;

  try {
    reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  } catch (e) {}

  var dpr = Math.min(window.devicePixelRatio || 1, 2);
  var PX = 0;

  function size() {
    PX = Math.round(stage.clientWidth * 2 * dpr);
    if (!PX) PX = Math.round(Math.min(window.innerWidth, window.innerHeight) * 2 * dpr);
    cv.width = PX;
    cv.height = PX;
  }

  size();
  window.addEventListener("resize", function () {
    if (!finished) size();
  });

  function mk(name, attrs, parent) {
    var el = document.createElementNS(NS, name);
    for (var key in attrs) el.setAttribute(key, attrs[key]);
    parent.appendChild(el);
    return el;
  }

  var ring = mk("circle", { cx: 310, cy: 195, r: 0, fill: "none", stroke: "#ff6a05", "stroke-width": 7 }, fx);
  var ring2 = mk("circle", { cx: 310, cy: 195, r: 0, fill: "none", stroke: "#2b6be0", "stroke-width": 4 }, fx);

  function cl(x) {
    return Math.max(0, Math.min(1, x));
  }
  function eOut(x) {
    return 1 - Math.pow(1 - x, 3);
  }

  var CX = 310;
  var CY = 193;
  var AX = 36;
  var L = 168;
  var R = 90;
  var RB = 16;
  var N = 14;
  var F = 620;
  var NAVY = "#18288f";
  var DEG = Math.PI / 180;

  function pp(i, u, h) {
    var ph = ((i + u) / N) * Math.PI * 2;
    var r = RB + (R - RB) * h;
    var y = L * h + (h > 0.98 ? 8 * Math.sin(Math.PI * u) : 0);
    return [Math.cos(ph) * r, y - L / 2, Math.sin(ph) * r];
  }

  function rgb(c, k) {
    return "rgb(" + Math.min(255, (c[0] * k) | 0) + "," + Math.min(255, (c[1] * k) | 0) + "," + Math.min(255, (c[2] * k) | 0) + ")";
  }

  function xf(v, P) {
    var x = v[0];
    var y = v[1];
    var z = v[2];
    var x1 = x * P.cs + z * P.sn;
    var z1 = -x * P.sn + z * P.cs;
    var y2 = y * P.cp - z1 * P.sp;
    var z2 = y * P.sp + z1 * P.cp;
    var x3 = x1 * P.cr - y2 * P.sr;
    var y3 = x1 * P.sr + y2 * P.cr;
    return [x3, y3, z2];
  }

  function prj(w, P) {
    var s = (P.sc * F) / (F - w[2]);
    return [P.ox + w[0] * s, P.oy - w[1] * s];
  }

  function drawKok(P, alpha) {
    var items = [];
    var i;
    var j;

    for (i = 0; i < N; i++) {
      var wp = [[0, 0], [0, 1], [0.25, 1], [0.5, 1], [0.75, 1], [1, 1], [1, 0]].map(function (q) {
        return xf(pp(i, q[0], q[1]), P);
      });
      var cz = 0;
      wp.forEach(function (w) {
        cz += w[2];
      });
      cz /= wp.length;
      var ph = ((i + 0.5) / N) * Math.PI * 2;
      var sl = (R - RB) / L;
      var n = xf([Math.cos(ph), sl, Math.sin(ph)], P);
      var df = Math.abs((n[0] * -0.35 + n[1] * 0.55 + n[2] * 0.75) / Math.hypot(n[0], n[1], n[2]));
      items.push({ t: "p", z: cz, i: i, k: 0.72 + 0.4 * df });
    }

    var cw = xf([0, -L / 2 - 4, 0], P);
    items.push({ t: "c", z: cw[2] - 14, w: cw });
    items.sort(function (a, b) {
      return a.z - b.z;
    });

    ctx.globalAlpha = alpha;
    ctx.lineJoin = "round";
    ctx.lineCap = "round";

    items.forEach(function (it) {
      if (it.t === "c") {
        var c = prj(it.w, P);
        var r = (26 * P.sc * F) / (F - it.w[2]);
        var gr = ctx.createRadialGradient(c[0] - r * 0.3, c[1] - r * 0.35, r * 0.1, c[0], c[1], r);
        gr.addColorStop(0, "#ffb35a");
        gr.addColorStop(0.55, "#ff6a05");
        gr.addColorStop(1, "#d94f00");
        ctx.beginPath();
        ctx.arc(c[0], c[1], r, 0, 7);
        ctx.fillStyle = gr;
        ctx.fill();
        ctx.lineWidth = 4.2 * P.sc;
        ctx.strokeStyle = NAVY;
        ctx.stroke();
        return;
      }

      var idx = it.i;
      var k = it.k;
      var pth = [[0, 0], [0, 1], [0.25, 1], [0.5, 1], [0.75, 1], [1, 1], [1, 0]];
      ctx.beginPath();
      pth.forEach(function (q, m) {
        var p = prj(xf(pp(idx, q[0], q[1]), P), P);
        if (m) ctx.lineTo(p[0], p[1]);
        else ctx.moveTo(p[0], p[1]);
      });
      ctx.closePath();
      ctx.fillStyle = rgb([244, 247, 255], k);
      ctx.fill();

      var bl = [[0.5, 0.1], [0.92, 0.62], [0.5, 0.93], [0.08, 0.62]];
      ctx.beginPath();
      bl.forEach(function (q, m) {
        var p = prj(xf(pp(idx, q[0], q[1]), P), P);
        if (m) ctx.lineTo(p[0], p[1]);
        else ctx.moveTo(p[0], p[1]);
      });
      ctx.closePath();
      ctx.fillStyle = rgb(idx % 2 ? [44, 124, 232] : [30, 86, 205], k);
      ctx.fill();

      ctx.lineWidth = 2.6 * P.sc;
      ctx.strokeStyle = NAVY;
      ctx.beginPath();
      pth.forEach(function (q, m) {
        var p = prj(xf(pp(idx, q[0], q[1]), P), P);
        if (m) ctx.lineTo(p[0], p[1]);
        else ctx.moveTo(p[0], p[1]);
      });
      ctx.closePath();
      ctx.stroke();

      var a = prj(xf(pp(idx, 0.5, 0.08), P), P);
      var b = prj(xf(pp(idx, 0.5, 0.97), P), P);
      ctx.lineWidth = 1.6 * P.sc;
      ctx.beginPath();
      ctx.moveTo(a[0], a[1]);
      ctx.lineTo(b[0], b[1]);
      ctx.stroke();
    });

    ctx.lineWidth = 5 * P.sc;
    ctx.strokeStyle = NAVY;
    ctx.beginPath();
    for (i = 0; i < N; i++) {
      for (j = 0; j <= 4; j++) {
        var p = prj(xf(pp(i, j / 4, 1), P), P);
        if (i || j) ctx.lineTo(p[0], p[1]);
        else ctx.moveTo(p[0], p[1]);
      }
    }
    ctx.closePath();
    ctx.stroke();
    ctx.globalAlpha = 1;
  }

  function params(o) {
    var sp = o.th;
    var rl = -(AX + o.rot) * DEG;
    var pt = o.psi * DEG;
    return {
      cs: Math.cos(sp),
      sn: Math.sin(sp),
      cp: Math.cos(pt),
      sp: Math.sin(pt),
      cr: Math.cos(rl),
      sr: Math.sin(rl),
      sc: o.sc,
      ox: CX + o.dx,
      oy: CY + o.dy
    };
  }

  function pos(p) {
    var q = 1 - p;
    return { dx: q * 330, dy: -q * 440, rot: q * 14, sc: 1 + q * 0.8, th: q * 14, psi: 0 };
  }

  function frame(now) {
    var ms = now - start;
    var t = Math.min(ms, D);

    clipRect.setAttribute("width", eOut(cl(t / 1100)) * 260);

    var f = cl((t - FLY_START) / FLY_DUR);
    var p = Math.pow(f, 1.3);
    var s = t - TI;
    var o = pos(p);
    var k = PX / 1024;

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, PX, PX);
    ctx.setTransform(k, 0, 0, k, k * 256, k * 256);

    if (s > 0) {
      var dent = Math.exp(-s / 110) * Math.cos(s / 45);
      o.sc = 1 - 0.07 * dent;
      o.dx = -9 * dent;
      o.dy = 9 * dent;
      var e = cl(s / 2000);
      var ee = eOut(e);
      o.th = ee * Math.PI * 2 * 5;
      o.psi = 40 * Math.sin(Math.PI * Math.min(1, e * 1.15)) * Math.exp(-e * 0.6);
      o.rot = 7 * Math.sin(e * Math.PI * 3) * (1 - e);
    }

    var vis = t >= FLY_START;
    if (vis) {
      if (f > 0 && f < 1) {
        for (var i = 4; i >= 1; i--) {
          var q = pos(Math.max(0, p - 0.03 * i));
          drawKok(params(q), cl(p * 4) * (0.3 / i));
        }
      }
      drawKok(params(o), 1);
      if (f > 0.02 && f < 1) {
        var cols = ["#ff6a05", "#2b6be0", "#ff6a05", "#18288f", "#ff9a3c", "#2b6be0"];
        for (i = 0; i < 6; i++) {
          var off = (i - 2.5) * 16;
          var ox = CX + o.dx + 0.8 * off;
          var oy = CY + o.dy + 0.6 * off;
          var Ln = (60 + 240 * p) * (0.6 + 0.1 * (i % 3));
          ctx.globalAlpha = cl(p * 5) * 0.85;
          ctx.strokeStyle = cols[i];
          ctx.lineWidth = 3.5;
          ctx.lineCap = "round";
          ctx.beginPath();
          ctx.moveTo(ox, oy);
          ctx.lineTo(ox + 0.6 * Ln, oy - 0.8 * Ln);
          ctx.stroke();
        }
        ctx.globalAlpha = 1;
      }
    }

    var fe = cl((t - 4400) / 450);
    full.style.opacity = fe;
    cv.style.opacity = 1 - fe;

    var r = cl(s / 650);
    ring.setAttribute("r", r * 170);
    ring.setAttribute("opacity", s > 0 ? (1 - r) * 0.9 : 0);

    var r2 = cl((s - 120) / 650);
    ring2.setAttribute("r", r2 * 130);
    ring2.setAttribute("opacity", s > 120 ? (1 - r2) * 0.7 : 0);

    var sh = s > 0 ? Math.sin(s / 24) * 8 * Math.exp(-s / 170) : 0;
    wrap.style.transform = s > 0 ? "translate(" + sh * 0.7 + "px," + -sh * 0.7 + "px)" : "none";

    if (ms < D) {
      raf = requestAnimationFrame(frame);
    } else {
      animDone = true;
      maybeFinish();
    }
  }

  function finish() {
    if (finished) return;
    finished = true;
    cancelAnimationFrame(raf);
    overlay.classList.add("is-hiding");
    document.documentElement.classList.remove("pb-splash-active");
    window.setTimeout(function () {
      if (overlay.parentNode) overlay.parentNode.removeChild(overlay);
    }, 500);
  }

  window.setTimeout(finish, 12000);

  function maybeFinish() {
    if (!animDone || finished) return;
    if (document.readyState === "complete") {
      window.setTimeout(finish, 450);
      return;
    }
    window.addEventListener(
      "load",
      function () {
        window.setTimeout(finish, 450);
      },
      { once: true }
    );
    window.setTimeout(finish, 2500);
  }

  function play() {
    cancelAnimationFrame(raf);
    start = performance.now();
    raf = requestAnimationFrame(frame);
  }

  if (reduce) {
    full.style.opacity = 1;
    cv.style.opacity = 0;
    animDone = true;
    window.setTimeout(finish, 900);
    return;
  } else {
    play();
  }
})();
