/* =====================================================================
   Esteshari PWA service worker
   Build: 4
   Strategy:
     - App shell: versioned cache (cache-first) — a new build = new cache.
     - Navigation: network-first, fallback to the cached shell.
     - Supabase API: network only (never cached).
     - CDN scripts: cache-first so the shell still boots offline.
   ===================================================================== */
'use strict';

const BUILD = '4';
const VERSION = 'esteshari-pwa-' + BUILD;
const CACHE = VERSION;

const SHELL = [
  './',
  './index.html',
  './app.js',
  './config.js',
  './mobile.js',
  './manifest.webmanifest',
  './icon.svg',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-maskable-512.png',
  './icons/apple-touch-icon.png'
];

const CDN = [
  'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.118.0',
  'https://cdn.jsdelivr.net/npm/jspdf@2.5.1/dist/jspdf.umd.min.js',
  'https://cdn.jsdelivr.net/npm/html2canvas@1.4.1/dist/html2canvas.min.js'
];

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    await cache.addAll(SHELL);
    for (const url of CDN) {
      try {
        await cache.add(new Request(url, { mode: 'cors' }));
      } catch (e) {
        console.warn('[esteshari-sw] CDN precache skipped', url, e);
      }
    }
  })());
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(
      keys
        .filter((k) => k.indexOf('esteshari-pwa-') === 0 && k !== CACHE)
        .map((k) => caches.delete(k))
    );
    await self.clients.claim();
  })());
});

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

function isSupabase(url) {
  return /(^|\.)supabase\.co$/i.test(url.hostname);
}

async function networkFirstNavigation(request) {
  const cache = await caches.open(CACHE);
  const cached = (await cache.match('./index.html')) || (await cache.match('./'));
  try {
    const fresh = await fetch(request, { cache: 'no-store' });
    if (fresh && fresh.ok) {
      try { await cache.put('./index.html', fresh.clone()); } catch (e) {}
      return fresh;
    }
    return cached || fresh;
  } catch (e) {
    return cached || new Response(
      '<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">' +
      '<body style="margin:0;background:#0b1220;color:#e8eef7;font-family:Segoe UI,system-ui,sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;text-align:center">' +
      '<div><h2>لا يوجد اتصال بالإنترنت</h2><p style="color:#8b9bb4">Offline — افتح التطبيق مرة واحدة أونلاين لتجهيز النسخة المحلية.</p></div></body>',
      { headers: { 'Content-Type': 'text/html; charset=utf-8' } }
    );
  }
}

async function cacheFirst(request) {
  const cache = await caches.open(CACHE);
  const hit = await cache.match(request);
  if (hit) return hit;
  try {
    const res = await fetch(request);
    if (res && (res.ok || res.type === 'opaque')) {
      try { await cache.put(request, res.clone()); } catch (e) {}
    }
    return res;
  } catch (e) {
    return new Response('', { status: 504, statusText: 'Offline' });
  }
}

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  let url;
  try { url = new URL(req.url); } catch (e) { return; }

  // Supabase (auth / REST / storage / realtime): always live.
  if (isSupabase(url)) return;

  if (req.mode === 'navigate') {
    event.respondWith(networkFirstNavigation(req));
    return;
  }

  // Same-origin assets + CDN scripts: cache-first (cache is versioned).
  event.respondWith(cacheFirst(req));
});
