/* =====================================================================
   Esteshari Mobile / PWA layer
   ---------------------------------------------------------------------
   Loaded ONLY by the mobile build (never by the Electron desktop app).
   It adds:
     - PWA install prompt (Android Chrome / iPhone Safari instructions)
     - Service worker registration + automatic / manual update flow
     - Offline / online banner
     - Android WebView bridge helpers (PDF save, external links, back)
     - APK update check (shell version only — the UI updates instantly)
   The desktop code in app.js is not modified.
   ===================================================================== */
(function () {
  'use strict';

  var bridge = window.EsteshariAndroid || null;
  var standalone = false;
  try {
    standalone = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
  } catch (e) { standalone = false; }

  var ua = navigator.userAgent || '';
  var isIOS = /iphone|ipad|ipod/i.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  var isMobile = isIOS || /android|mobile/i.test(ua) || window.innerWidth < 820;
  var hadController = ('serviceWorker' in navigator) && !!navigator.serviceWorker.controller;
  var deferredPrompt = null;
  var updateShown = false;
  var lastCheck = 0;
  var pdfPatched = false;
  var origHideUpdateBanner = (typeof window.hideUpdateBanner === 'function') ? window.hideUpdateBanner : null;

  function onReady(fn) {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', fn, { once: true });
    else fn();
  }
  function toast(msg) {
    try { if (typeof window.toastFlash === 'function') window.toastFlash(msg); } catch (e) {}
  }
  function isAppVisible() {
    var app = document.getElementById('appScreen');
    return !!(app && !app.classList.contains('hidden'));
  }

  /* ------------------------------------------------------------------
     Install (PWA)
     ------------------------------------------------------------------ */
  function hideInstallUI() {
    ['pwaInstallBox', 'pwaInstallSide'].forEach(function (id) {
      var el = document.getElementById(id);
      if (el) el.classList.add('hidden');
    });
  }

  function showInstallHelp() {
    var old = document.querySelector('.pwa-modal');
    if (old) old.remove();

    var iosSteps =
      '<h4>على الآيفون (Safari)</h4><ol>' +
      '<li>افتح الرابط في <b>Safari</b> (مش Chrome).</li>' +
      '<li>اضغط زر المشاركة <b>⬆️</b> في أسفل الشاشة.</li>' +
      '<li>اختر <b>إضافة إلى الشاشة الرئيسية</b> ثم <b>إضافة</b>.</li>' +
      '</ol>' +
      '<p style="color:var(--muted);font-size:12px;margin-top:10px">بعد كده افتح «إستشاري» من الأيقونة — نفس الحساب والبيانات.</p>';

    var androidSteps =
      '<h4>على الأندرويد (Chrome)</h4><ol>' +
      '<li>اضغط قائمة <b>⋮</b> في أعلى المتصفح.</li>' +
      '<li>اختر <b>تثبيت التطبيق</b> أو <b>إضافة إلى الشاشة الرئيسية</b>.</li>' +
      '<li>اضغط <b>تثبيت</b>.</li>' +
      '</ol>' +
      '<p style="color:var(--muted);font-size:12px;margin-top:10px">لو ظهرت رسالة «التطبيق مثبّت بالفعل» — افتحه من أيقونة الشاشة الرئيسية.</p>';

    var wrap = document.createElement('div');
    wrap.className = 'modal-back pwa-modal';
    wrap.innerHTML =
      '<div class="modal" style="max-width:460px">' +
        '<div class="modal-h"><span>📲 تثبيت إستشاري</span><button type="button" class="modal-x">×</button></div>' +
        '<div class="modal-b" style="font-size:14px;line-height:1.7">' +
          (isIOS ? iosSteps : androidSteps) +
          '<p style="color:var(--muted);font-size:12px;margin-top:12px">التطبيق يفتح full-screen ويشتغل بنفس حسابك على الديسكتوب.</p>' +
        '</div>' +
      '</div>';
    document.body.appendChild(wrap);
    wrap.addEventListener('click', function (e) {
      if (e.target === wrap || (e.target.closest && e.target.closest('.modal-x'))) wrap.remove();
    });
  }

  function promptPwaInstall() {
    if (bridge || standalone) { hideInstallUI(); return; }
    if (deferredPrompt) {
      deferredPrompt.prompt();
      deferredPrompt.userChoice.then(function (choice) {
        if (choice && choice.outcome === 'accepted') hideInstallUI();
        deferredPrompt = null;
      }).catch(function () { deferredPrompt = null; });
      return;
    }
    showInstallHelp();
  }
  window.promptPwaInstall = promptPwaInstall;

  function initInstallUI() {
    if (bridge || standalone || !isMobile) { hideInstallUI(); return; }

    var btn = document.getElementById('pwaInstallBtn');
    if (btn) {
      btn.textContent = isIOS ? '📲 كيف أثبّت التطبيق على الآيفون؟' : '📲 تثبيت التطبيق على الموبايل';
      btn.addEventListener('click', promptPwaInstall);
    }
    var box = document.getElementById('pwaInstallBox');
    if (box) box.classList.remove('hidden');
    var side = document.getElementById('pwaInstallSide');
    if (side) side.classList.remove('hidden');
  }

  window.addEventListener('beforeinstallprompt', function (e) {
    e.preventDefault();
    deferredPrompt = e;
  });
  window.addEventListener('appinstalled', function () {
    deferredPrompt = null;
    hideInstallUI();
  });

  /* ------------------------------------------------------------------
     Service worker / updates
     ------------------------------------------------------------------ */
  function showPwaUpdate(worker) {
    if (!worker || updateShown) return;
    updateShown = true;
    if (typeof window.showUpdateBanner === 'function') {
      window.showUpdateBanner(
        'نسخة جديدة من التطبيق متاحة — اضغط «تحديث الآن»',
        'تحديث الآن',
        function () {
          try { worker.postMessage({ type: 'SKIP_WAITING' }); } catch (e) {}
        }
      );
    }
  }

  // Keep the close button working, and allow the banner to re-appear later.
  window.hideUpdateBanner = function () {
    updateShown = false;
    if (origHideUpdateBanner) origHideUpdateBanner();
  };

  async function checkSwUpdate(manual) {
    if (!('serviceWorker' in navigator)) {
      if (manual) toast('التحديث التلقائي غير مدعوم في هذا المتصفح');
      return;
    }
    try {
      var reg = await navigator.serviceWorker.getRegistration();
      if (!reg) {
        if (manual) toast('التطبيق غير مسجّل — افتحه من الرابط الرسمي');
        return;
      }
      await reg.update();
      if (reg.waiting) {
        showPwaUpdate(reg.waiting);
        if (manual) toast('نسخة جديدة متاحة — اضغط «تحديث الآن»');
      } else if (reg.installing) {
        if (manual) toast('جارٍ تحميل التحديث…');
      } else if (manual) {
        var v = (typeof window.currentVersion === 'function') ? window.currentVersion() : '';
        toast('أنت على أحدث إصدار' + (v ? ' (' + v + ')' : ''));
      }
    } catch (e) {
      if (manual) toast('تعذّر فحص التحديثات');
    }
  }
  window.checkUpdate = function (manual) { checkSwUpdate(!!manual); };

  async function forcePwaUpdate() {
    var ok = true;
    try { ok = window.confirm('سيتم مسح كاش التطبيق وإعادة تحميله من السيرفر. متابعة؟'); } catch (e) { ok = true; }
    if (!ok) return;
    try {
      var regs = await navigator.serviceWorker.getRegistrations();
      await Promise.all(regs.map(function (r) { return r.unregister(); }));
    } catch (e) {}
    try {
      var keys = await caches.keys();
      await Promise.all(keys.map(function (k) { return caches.delete(k); }));
    } catch (e) {}
    try { sessionStorage.clear(); } catch (e) {}
    location.replace(location.pathname + '?v=' + Date.now());
  }
  window.forcePwaUpdate = forcePwaUpdate;

  function registerSw() {
    if (!('serviceWorker' in navigator) || location.protocol === 'file:') return;
    navigator.serviceWorker.register('sw.js', { scope: './' }).then(function (reg) {
      reg.addEventListener('updatefound', function () {
        var nw = reg.installing;
        if (!nw) return;
        nw.addEventListener('statechange', function () {
          if (nw.state === 'installed' && navigator.serviceWorker.controller) showPwaUpdate(nw);
        });
      });
      if (reg.waiting && navigator.serviceWorker.controller) showPwaUpdate(reg.waiting);
      navigator.serviceWorker.addEventListener('controllerchange', function () {
        if (!hadController) return;
        try {
          if (sessionStorage.getItem('esteshari_sw_reloaded') === '1') return;
          sessionStorage.setItem('esteshari_sw_reloaded', '1');
        } catch (e) {}
        location.reload();
      });
      setTimeout(function () { checkSwUpdate(false); }, 2500);
    }).catch(function (e) {
      console.warn('[pwa] service worker registration failed', e);
    });
  }

  function maybeCheck() {
    var now = Date.now();
    if (now - lastCheck < 30000) return;
    lastCheck = now;
    checkSwUpdate(false);
  }

  /* ------------------------------------------------------------------
     Online / offline banner
     ------------------------------------------------------------------ */
  function setOnline(online) {
    var el = document.getElementById('pwaOffline');
    if (!el) return;
    if (online) el.classList.remove('show');
    else el.classList.add('show');
  }
  window.addEventListener('online', function () { setOnline(true); maybeCheck(); });
  window.addEventListener('offline', function () { setOnline(false); });

  /* ------------------------------------------------------------------
     Android bridge helpers
     ------------------------------------------------------------------ */
  function openExternal(url) {
    if (bridge && bridge.openExternal) {
      try { bridge.openExternal(String(url)); return true; } catch (e) {}
    }
    return false;
  }

  if (bridge) {
    var nativeOpen = window.open;
    window.open = function (url) {
      if (url && /^https?:\/\//i.test(String(url)) && openExternal(url)) return null;
      return nativeOpen.apply(window, arguments);
    };
    document.addEventListener('click', function (e) {
      var a = e.target && e.target.closest ? e.target.closest('a[href]') : null;
      if (!a) return;
      var href = a.getAttribute('href') || '';
      if (!/^https?:\/\//i.test(href)) return;
      if (a.hasAttribute('download') || a.target === '_blank') {
        if (openExternal(href)) e.preventDefault();
      }
    }, true);
  }

  function patchPdfSave() {
    if (pdfPatched) return;
    var J = window.jspdf && window.jspdf.jsPDF;
    if (!J || !J.prototype) return;
    var orig = J.prototype.save;
    J.prototype.save = function (filename) {
      if (bridge && bridge.savePdfBase64) {
        try {
          var data = this.output('datauristring');
          var b64 = String(data).split(',')[1] || '';
          bridge.savePdfBase64(b64, filename || 'Esteshari.pdf');
          return this;
        } catch (e) {
          console.warn('[apk] PDF bridge failed', e);
        }
      }
      return orig.call(this, filename);
    };
    pdfPatched = true;
  }

  /* ------------------------------------------------------------------
     Android back button (optional navigation stack)
     ------------------------------------------------------------------ */
  var pageStack = [];
  var origGo = window.go;
  if (typeof origGo === 'function') {
    window.go = function (p) {
      try {
        var cur = window.page || '';
        if (cur && String(p) !== String(cur)) {
          pageStack.push(cur);
          if (pageStack.length > 40) pageStack.shift();
        }
      } catch (e) {}
      return origGo.apply(this, arguments);
    };
  }

  window.__esteshariBack = function () {
    var modal = document.querySelector('.modal-back');
    if (modal) { modal.remove(); return true; }
    if (!isAppVisible()) return false;

    var side = document.getElementById('sidebar');
    if (side && side.classList.contains('open')) {
      try { window.closeSide(); } catch (e) {}
      return true;
    }

    if (pageStack.length) {
      var prev = pageStack.pop();
      try { origGo.call(window, prev); return true; } catch (e) { return false; }
    }
    try {
      if (window.page && window.page !== 'dashboard') {
        origGo.call(window, 'dashboard');
        return true;
      }
    } catch (e) {}
    return false;
  };

  /* ------------------------------------------------------------------
     Version tag + APK shell update check
     ------------------------------------------------------------------ */
  function tagVersions() {
    if (bridge) return;
    ['sideVersion', 'profVersion'].forEach(function (id) {
      var el = document.getElementById(id);
      if (!el || !el.textContent) return;
      if (/PWA|APK/.test(el.textContent)) return;
      el.textContent += ' · PWA';
    });
  }

  function cmpVersion(a, b) {
    var pa = String(a || '').split('.').map(Number);
    var pb = String(b || '').split('.').map(Number);
    for (var i = 0; i < 3; i++) {
      var x = pa[i] || 0, y = pb[i] || 0;
      if (x > y) return 1;
      if (x < y) return -1;
    }
    return 0;
  }

  function checkApkUpdate() {
    if (!bridge || typeof bridge.versionName !== 'function') return;
    fetch('../manifest.json', { cache: 'no-store' }).then(function (r) {
      return r.ok ? r.json() : null;
    }).then(function (info) {
      if (!info || !info.apkVersion || !info.apkUrl) return;
      var cur = '';
      try { cur = bridge.versionName() || ''; } catch (e) {}
      if (cur && cmpVersion(info.apkVersion, cur) > 0 && typeof window.showUpdateBanner === 'function') {
        window.showUpdateBanner(
          'نسخة جديدة من تطبيق الموبايل (' + info.apkVersion + ')',
          'تحميل التحديث',
          function () { if (bridge.openExternal) bridge.openExternal(info.apkUrl); }
        );
      }
    }).catch(function () {});
  }

  /* ------------------------------------------------------------------
     Boot
     ------------------------------------------------------------------ */
  onReady(function () {
    initInstallUI();
    registerSw();
    setOnline(navigator.onLine !== false);
    patchPdfSave();

    var tries = 0;
    var t = setInterval(function () {
      patchPdfSave();
      if (pdfPatched || ++tries > 20) clearInterval(t);
    }, 500);

    tagVersions();
    setTimeout(tagVersions, 1200);
    setTimeout(tagVersions, 3000);

    var pc = document.getElementById('pageContent');
    if (pc && window.MutationObserver) {
      new MutationObserver(tagVersions).observe(pc, { childList: true, subtree: true });
    }

    setInterval(maybeCheck, 120000);
    document.addEventListener('visibilitychange', function () {
      if (document.visibilityState === 'visible') maybeCheck();
    });
    window.addEventListener('focus', maybeCheck);

    setTimeout(function () {
      try { sessionStorage.removeItem('esteshari_sw_reloaded'); } catch (e) {}
    }, 5000);

    setTimeout(checkApkUpdate, 4000);
  });
})();
