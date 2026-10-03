// ChiragOS service worker: offline shell + fast repeat loads.
// - /_next/static/* (content-hashed): cache-first
// - page navigations: network-first, fall back to the last cached copy
// - other same-origin GETs (icons, saga art): stale-while-revalidate
// Supabase/API calls are never cached (the app's offline queue handles writes).

const VERSION = 'v1'
const STATIC = `lokios-static-${VERSION}`
const PAGES = `lokios-pages-${VERSION}`
const ASSETS = `lokios-assets-${VERSION}`

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(PAGES).then(c => c.addAll(['/today', '/dashboard']).catch(() => {})))
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keep = new Set([STATIC, PAGES, ASSETS])
    for (const key of await caches.keys()) if (!keep.has(key)) await caches.delete(key)
    await self.clients.claim()
  })())
})

self.addEventListener('fetch', (event) => {
  const req = event.request
  if (req.method !== 'GET') return
  const url = new URL(req.url)
  if (url.origin !== self.location.origin) return
  if (url.pathname.startsWith('/api/') || url.pathname.startsWith('/auth/')) return

  if (url.pathname.startsWith('/_next/static/')) {
    event.respondWith(cacheFirst(req, STATIC))
  } else if (req.mode === 'navigate') {
    event.respondWith(networkFirst(req, PAGES))
  } else if (!url.pathname.startsWith('/_next/')) {
    event.respondWith(staleWhileRevalidate(req, ASSETS))
  }
})

async function cacheFirst(req, name) {
  const cached = await caches.match(req)
  if (cached) return cached
  const res = await fetch(req)
  if (res.ok) (await caches.open(name)).put(req, res.clone())
  return res
}

async function networkFirst(req, name) {
  try {
    const res = await fetch(req)
    if (res.ok) (await caches.open(name)).put(req, res.clone())
    return res
  } catch {
    return (await caches.match(req)) || (await caches.match('/today')) || (await caches.match('/dashboard')) || Response.error()
  }
}

async function staleWhileRevalidate(req, name) {
  const cache = await caches.open(name)
  const cached = await cache.match(req)
  const network = fetch(req).then(res => { if (res.ok) cache.put(req, res.clone()); return res }).catch(() => cached)
  return cached || network
}

// Reminder notifications open the Today screen
self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  event.waitUntil((async () => {
    const all = await self.clients.matchAll({ type: 'window', includeUncontrolled: true })
    const existing = all.find(c => 'focus' in c)
    if (existing) { await existing.navigate('/today').catch(() => {}); return existing.focus() }
    return self.clients.openWindow('/today')
  })())
})
