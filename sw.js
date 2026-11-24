// Shane's Fit Tracker — service worker
// GitHub Pages sends Cache-Control: max-age=600. A normal fetch honors that,
// so a home-screen app can keep an old index.html (and the old tab bar) for
// the whole 10 minutes. The app shell is fetched with cache: 'no-store'.
// The cache below is only the offline fallback.
const CACHE = 'fit-tracker-v20';

self.addEventListener('install', e => {
  e.waitUntil(self.skipWaiting());
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

function isAppShell(url, request) {
  if (request.mode === 'navigate') return true;
  const path = url.pathname;
  return /\/$/.test(path) || /\.(?:html|js|css)$/.test(path);
}

self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  const url = new URL(e.request.url);
  if (url.origin !== location.origin) return; // let Firebase/CDN requests hit the network directly
  const shell = isAppShell(url, e.request);
  const workerScript = /\/sw\.js$/.test(url.pathname);
  e.respondWith(
    fetch(e.request, shell ? { cache: 'no-store' } : {})
      .then(res => {
        // Never store the worker script in the Cache API. A later offline
        // fallback must not be able to serve an old sw.js as the page.
        if (!workerScript && res && res.ok && res.type === 'basic') {
          const copy = res.clone();
          caches.open(CACHE).then(c => c.put(e.request, copy)).catch(() => {});
        }
        return res;
      })
      .catch(() => caches.match(e.request).then(m => m || caches.match('./index.html') || caches.match('.')))
  );
});
