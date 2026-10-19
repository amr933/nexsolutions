/* _worker.js — عدّاد تحميلات BeebBeeb على D1 + مرور شفاف لكل ملفات الموقع الثابتة.
   القواعد:
   1) أي طلب تطابقه /.apk$ تحت /apps/beebeeb/ يُسجل في القاعدة قبل التقديم (من الخادم مباشرة — أقوى إشارة تحميل).
   2) POST /apps/beebeeb/api/track = نبضة من صفحة التحميل (k: 'vw' فتح الصفحة | 'dl' نقر زر التحميل).
   3) GET  /apps/beebeeb/api/stats.json?t=<توكن> = بيانات لوحة العدادات (التوكن من secret اسمه METRICS_TOKEN).
   4) أي طلب آخر يمرر لملفات الموقع الثابتة كما هي؛ فشل العد لا يمنع التحميل أبداً.
*/
const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const APK_RE = /^\/apps\/beebeeb\/[^/]+\.apk$/i;

function json(data, status, extra) {
  return new Response(JSON.stringify(data), {
    status: status || 200,
    headers: Object.assign(
      { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" },
      extra || {}
    ),
  });
}

function dayNow() {
  try {
    return new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Cairo" }).format(new Date());
  } catch (e) {
    return new Date().toISOString().slice(0, 10);
  }
}

async function hash12(s) {
  const b = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  const h = [...new Uint8Array(b)].map((x) => x.toString(16).padStart(2, "0")).join("");
  return h.slice(0, 12);
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const path = url.pathname;
    const method = request.method;

    /* دعم CORS للنبضة من file:// (التطبيق) إن استُخدمت لاحقاً */
    if (method === "OPTIONS") return new Response(null, { status: 204, headers: CORS });

    try {
      /* 1) عدّاد الخادم لكل طلب ملف apk فعلي (يشمل روابط التحديث من داخل التطبيق) */
      if (method === "GET" && APK_RE.test(path) && env && env.beebeeb_metrics) {
        const day = dayNow();
        const ip = request.headers.get("CF-Connecting-IP") || "x";
        const ua = (request.headers.get("User-Agent") || "").slice(0, 72);
        const rid = "a" + day + ":" + (await hash12(ip + "|" + ua));
        ctx.waitUntil(
          (async () => {
            try {
              await env.beebeeb_metrics
                .prepare(
                  "INSERT OR IGNORE INTO events (k, rid, day, ua, created_at) VALUES (?1, ?2, ?3, ?4, ?5)"
                )
                .bind("apk", rid, day, ua, Date.now())
                .run();
            } catch (e) {}
          })()
        );
      }
    } catch (e) {}

    /* 2) نبضة صفحة التحميل */
    if (method === "POST" && path === "/apps/beebeeb/api/track") {
      try {
        if (!env || !env.beebeeb_metrics) return json({ ok: false, e: "no-db" }, 503, CORS);
        let body = {};
        try {
          body = await request.json();
        } catch (e) {}
        const k = body.k === "dl" || body.k === "vw" ? body.k : "";
        const rid =
          typeof body.r === "string" ? body.r.replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 40) : "";
        if (!k || !rid) return json({ ok: false }, 400, CORS);
        await env.beebeeb_metrics
          .prepare(
            "INSERT OR IGNORE INTO events (k, rid, day, ua, created_at) VALUES (?1, ?2, ?3, ?4, ?5)"
          )
          .bind(k, rid, dayNow(), "", Date.now())
          .run();
        return json({ ok: true }, 200, CORS);
      } catch (e) {
        return json({ ok: false }, 500, CORS);
      }
    }

    /* 3) لوحة العدادات (محميّة بالتوكن) */
    if (method === "GET" && path === "/apps/beebeeb/api/stats.json") {
      try {
        const t = url.searchParams.get("t") || "";
        const tok = String((env && env.METRICS_TOKEN) || "");
        if (!tok || tok.length < 16 || t !== tok) return json({ forbidden: true }, 403);
        if (!env.beebeeb_metrics) return json({ ok: false, e: "no-db" }, 503);
        const nt =
          (await env.beebeeb_metrics
            .prepare(
              "SELECT SUM(CASE WHEN k='apk' THEN 1 ELSE 0 END) AS apk, SUM(CASE WHEN k='dl' THEN 1 ELSE 0 END) AS dl, SUM(CASE WHEN k='vw' THEN 1 ELSE 0 END) AS vw, SUM(CASE WHEN k='apk' AND ua LIKE '%android%' THEN 1 ELSE 0 END) AS apk_android FROM events"
            )
            .first()) || {};
        const rs = await env.beebeeb_metrics
          .prepare(
            "SELECT day, SUM(CASE WHEN k='apk' THEN 1 ELSE 0 END) AS apk, SUM(CASE WHEN k='dl' THEN 1 ELSE 0 END) AS dl, SUM(CASE WHEN k='vw' THEN 1 ELSE 0 END) AS vw FROM events GROUP BY day ORDER BY day DESC LIMIT 30"
          )
          .all();
        return json({
          generated: Date.now(),
          total: {
            apk: nt.apk || 0,
            dl: nt.dl || 0,
            vw: nt.vw || 0,
            apkAndroid: nt.apk_android || 0,
          },
          series: rs.results || [],
        });
      } catch (e) {
        return json({ ok: false, e: "err" }, 500);
      }
    }

    /* 4) كل شيء آخر = الموقع الثابت كما هو */
    return env.ASSETS.fetch(request);
  },
};
