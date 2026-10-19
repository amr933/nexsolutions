/* =========================================================
   بيب بيب — Service Worker (تطبيق الويب المثبَّت)
   الهدف: يعمل التطبيق كاملًا بدون إنترنت بعد أول فتح،
   مع تحديث تلقائي هادئ عند صدور نسخة جديدة.
   ========================================================= */
var VERSION = "bb-pwa-2";
var SHELL = "bb-shell-" + VERSION;   // ملفات التطبيق (HTML/CSS/JS)
var MEDIA = "bb-media-" + VERSION;   // الأصوات والأيقونات (لا تتغير)

/* نواة التطبيق — يتوقف عليها التشغيل بدون إنترنت */
var CORE = [
  "./",
  "./index.html",
  "./styles.css",
  "./pack-default.js",
  "./vehicles.js",
  "./voice-map.js",
  "./app.js",
  "./manifest.webmanifest",
  "./icons/icon-180.png",
  "./icons/icon-192.png",
  "./icons/icon-512.png"
];

/* ملفات لا يجوز تخزينها: حزمة التحديث والمحتوى (لازم تتقرأ من السيرفر كل مرة) */
function isLiveData(path) {
  return /manifest\.json$/.test(path) || /pack-v\d+\.json$/.test(path) || /voice-list\.json$/.test(path);
}

/* ---------- التثبيت: نخزّن النواة ثم كل مقاطع الصوت ---------- */
self.addEventListener("install", function (e) {
  e.waitUntil(
    caches.open(SHELL).then(function (c) {
      return Promise.all(CORE.map(function (u) {
        return c.add(new Request(u, { cache: "reload" })).catch(function () {});
      }));
    }).then(function () {
      /* نزّل كل مقاطع الصوت في الخلفية حتى يعمل النطق بدون إنترنت */
      return fetch("./voice-list.json", { cache: "no-store" })
        .then(function (r) { return r.ok ? r.json() : []; })
        .catch(function () { return []; })
        .then(function (list) {
          if (!list || !list.length) return;
          return caches.open(MEDIA).then(function (c) {
            return Promise.all(list.map(function (f) {
              return c.add(new Request("./voice/" + f, { cache: "reload" })).catch(function () {});
            }));
          });
        });
    }).then(function () {
      return self.skipWaiting();
    })
  );
});

/* ---------- التنشيط: نظّف النسخ القديمة ---------- */
self.addEventListener("activate", function (e) {
  e.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(keys.map(function (k) {
        if (k !== SHELL && k !== MEDIA) return caches.delete(k);
      }));
    }).then(function () {
      return self.clients.claim();
    })
  );
});

/* ---------- الجلب ---------- */
self.addEventListener("fetch", function (e) {
  var req = e.request;
  if (req.method !== "GET") return;

  var url;
  try { url = new URL(req.url); } catch (err) { return; }

  /* الروابط الخارجية وحزمة التحديث: من الشبكة مباشرة (لا تخزين) */
  if (url.origin !== self.location.origin) return;
  if (isLiveData(url.pathname)) return;   // يمرّ للشبكة كما هو

  /* الأصوات والأيقونات: من الكاش أولًا (لا تتغير) */
  if (/\/voice\//.test(url.pathname) || /\.mp3$/.test(url.pathname) || /\/icons\//.test(url.pathname)) {
    e.respondWith(
      caches.open(MEDIA).then(function (c) {
        return c.match(req).then(function (hit) {
          if (hit) return hit;
          return fetch(req).then(function (res) {
            if (res && res.ok) c.put(req, res.clone());
            return res;
          });
        });
      }).catch(function () { return fetch(req); })
    );
    return;
  }

  /* بقية الملفات: الكاش فورًا + تحديث صامت في الخلفية للنسخة القادمة */
  e.respondWith(
    caches.open(SHELL).then(function (c) {
      return c.match(req, { ignoreSearch: true }).then(function (hit) {
        var fromNet = fetch(req).then(function (res) {
          if (res && res.ok) c.put(req, res.clone());
          return res;
        }).catch(function () { return null; });
        if (hit) return hit;
        return fromNet.then(function (res) {
          return res || new Response("غير متصل", { status: 503, headers: { "Content-Type": "text/plain; charset=utf-8" } });
        });
      });
    })
  );
});
