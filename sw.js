// Pi Trade service worker: uygulama kabuğunu önbelleğe alır; piyasa verisi (API) her zaman ağdan gelir.
const VERSION = 'pitrade-v3'; // değişince eski önbellek (eski ad ve simgeler) silinir
// Yollar sw.js'e göre göreli: kök (/) ya da alt klasör (/pitrade/) yayında aynı çalışır
const SCOPE = self.registration.scope; // ör. https://…/pitrade/
const BASE = new URL(SCOPE).pathname;
const SHELL = ['./', 'manifest.webmanifest', 'icon-192.png', 'icon-512.png', 'apple-touch-icon.png', 'favicon-64.png', 'logo-128.png'];
// Canlı veri: proxy yolları ve diğer kökenler önbelleğe alınmaz
const LIVE = [/^\/fapi\//, /^\/futures\//, /^\/x\//];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(VERSION).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin || LIVE.some((r) => r.test(url.pathname))) return; // tarayıcıya bırak

  // Sayfa: önce ağ (yeni sürüm gelsin), çevrimdışıysa önbellekteki kabuk
  if (req.mode === 'navigate') {
    e.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(VERSION).then((c) => c.put(SCOPE, copy));
          return res;
        })
        .catch(() => caches.match(SCOPE)),
    );
    return;
  }

  // Derlenmiş dosyalar adlarında içerik özeti taşır (index-AbC123.js) → önce önbellek
  if (url.pathname.startsWith(BASE + 'assets/')) {
    e.respondWith(
      caches.match(req).then(
        (hit) =>
          hit ||
          fetch(req).then((res) => {
            if (res.ok) {
              const copy = res.clone();
              caches.open(VERSION).then((c) => c.put(req, copy));
            }
            return res;
          }),
      ),
    );
    return;
  }

  // Diğer statik dosyalar: önbellek varsa ondan, yoksa ağ
  e.respondWith(caches.match(req).then((hit) => hit || fetch(req)));
});
