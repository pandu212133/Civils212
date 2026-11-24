// Separate installations can share an origin on a shared host.
const prefix = 'civic-atlas:' + self.registration.scope + ':';
const cacheName = prefix + 'v3';
const shell = [
  'index.html', 'app.js', 'local-ai.js', 'style.css', 'manifest.webmanifest',
  'icon-180.png', 'icon-192.png', 'icon-512.png',
  'data/brief.json', 'data/study.json'
];
const local = path => new URL(path, self.registration.scope).href;
const allowed = new Set(shell.map(local));

self.addEventListener('install', event => {
  event.waitUntil((async () => {
    const cache = await caches.open(cacheName);
    await cache.addAll(shell.map(path => new Request(local(path), {cache: 'reload'})));
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    for (const name of await caches.keys()) {
      if (name.startsWith(prefix) && name !== cacheName) await caches.delete(name);
    }
    await self.clients.claim();
  })());
});

async function readResource(request, key) {
  const cache = await caches.open(cacheName);
  try {
    const response = await fetch(request, {cache: 'no-cache'});
    if (!response.ok) throw new Error('Resource unavailable');
    // A captive portal or a hosting error can return HTML with HTTP 200.
    if (key.endsWith('.json')) {
      const payload = await response.clone().json();
      const valid = key.endsWith('/brief.json')
        ? Array.isArray(payload?.items) && Array.isArray(payload?.sources)
        : Array.isArray(payload);
      if (!valid) throw new Error('Invalid edition');
    }
    await cache.put(key, response.clone());
    return response;
  } catch {
    return await cache.match(key) || Response.error();
  }
}

self.addEventListener('fetch', event => {
  const {request} = event;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  url.search = '';
  if (url.href === self.registration.scope) url.href = local('index.html');
  if (allowed.has(url.href)) event.respondWith(readResource(request, url.href));
});
