// service worker: ใช้งานออฟไลน์
//   - ติดตั้ง: เก็บทุกไฟล์ในรายการ precache.json (สร้างโดย build) และไลบรารีจาก CDN
//   - ไฟล์เว็บ (html, js, css, i18n, ไอคอน): ลองเครือข่ายก่อน ถ้าไม่มีเน็ตใช้ที่เก็บไว้ จึงได้โค้ดใหม่เสมอเมื่อออนไลน์
//   - ข้อมูล (nexus.json, layout-overview.json) และรูป: ใช้ที่เก็บไว้ก่อน (เร็วและใช้ออฟไลน์ได้)
//     ข้อมูลจะอัปเดตเมื่อผู้ใช้กด "มีข้อมูลใหม่ กดเพื่ออัปเดต" (ดู js/pwa.js) ซึ่งส่งข้อความ 'refresh-data' มาที่นี่
//   - data/version.json (hash ของ nexus.json) ลองเครือข่ายก่อนเสมอ ใช้ตรวจว่ามีข้อมูลใหม่หรือไม่
//   - ไลบรารี/ฟอนต์จาก CDN: ใช้ที่เก็บไว้ก่อน

const CACHE = 'nexus-cache-v1';
const SCOPE = new URL(self.registration.scope);
const DATA_FILES = ['data/nexus.json', 'data/layout-overview.json'];
const CDN_HOSTS = ['cdn.jsdelivr.net', 'fonts.googleapis.com', 'fonts.gstatic.com'];
const CDN_URLS = [
  'https://cdn.jsdelivr.net/npm/layout-base@2.0.1/layout-base.js',
  'https://cdn.jsdelivr.net/npm/cose-base@2.2.0/cose-base.js',
  'https://cdn.jsdelivr.net/npm/cytoscape@3.30.2/dist/cytoscape.min.js',
  'https://cdn.jsdelivr.net/npm/cytoscape-fcose@2.2.0/cytoscape-fcose.js',
  'https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500&family=IBM+Plex+Sans+Thai:wght@400;500;600;700&display=swap',
];

const relPath = (url) => url.pathname.slice(SCOPE.pathname.length);

async function putSafe(cache, request, response) {
  try { if (response && (response.ok || response.type === 'opaque')) await cache.put(request, response.clone()); } catch { /* เก็บไม่ได้ก็ข้าม */ }
}

async function precache() {
  const cache = await caches.open(CACHE);
  let list = [];
  try { list = await (await fetch('precache.json', { cache: 'reload' })).json(); } catch { /* ไม่มีรายการ ใช้เฉพาะ runtime cache */ }
  const urls = ['./', ...list, ...CDN_URLS];
  await Promise.all(urls.map(async (u) => {
    try {
      const res = await fetch(new Request(u, { cache: 'reload' }));
      await putSafe(cache, u, res);
    } catch { /* ไฟล์ใดโหลดไม่ได้ไม่ทำให้การติดตั้งล้มเหลว */ }
  }));
  // ข้อมูลล่าสุดสำหรับตรวจเวอร์ชัน
  try { await putSafe(cache, 'data/version.json', await fetch('data/version.json', { cache: 'reload' })); } catch { /* ข้าม */ }
}

async function networkFirst(request) {
  const cache = await caches.open(CACHE);
  try {
    const res = await fetch(request);
    await putSafe(cache, request, res);
    return res;
  } catch (err) {
    const hit = (await cache.match(request, { ignoreSearch: true })) ||
      (request.mode === 'navigate' ? (await cache.match(SCOPE.href)) || (await cache.match(new URL('index.html', SCOPE).href)) : null);
    if (hit) return hit;
    throw err;
  }
}

async function cacheFirst(request) {
  const cache = await caches.open(CACHE);
  const hit = await cache.match(request, { ignoreVary: true });
  if (hit) return hit;
  const res = await fetch(request);
  await putSafe(cache, request, res);
  return res;
}

async function refreshData() {
  const cache = await caches.open(CACHE);
  for (const f of [...DATA_FILES, 'data/version.json']) {
    try { await putSafe(cache, f, await fetch(f, { cache: 'reload' })); } catch { /* ข้าม */ }
  }
}

self.addEventListener('install', (e) => { e.waitUntil(precache().then(() => self.skipWaiting())); });
self.addEventListener('activate', (e) => { e.waitUntil(self.clients.claim()); });

self.addEventListener('message', (e) => {
  if (e.data === 'refresh-data') {
    e.waitUntil(refreshData().then(() => { if (e.source) e.source.postMessage('data-refreshed'); }));
  }
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin === self.location.origin) {
    const p = relPath(url);
    if (p === 'data/version.json') { e.respondWith(networkFirst(req)); return; }
    if (DATA_FILES.includes(p) || p.startsWith('images/')) { e.respondWith(cacheFirst(req)); return; }
    e.respondWith(networkFirst(req));
    return;
  }
  if (CDN_HOSTS.includes(url.hostname)) e.respondWith(cacheFirst(req));
});
