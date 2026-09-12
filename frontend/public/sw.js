// Thumbnail cache.
//
// Google serves these images with a short freshness window — i.ytimg.com
// sends `Cache-Control: max-age=7200`, so after two hours the browser
// re-downloads every thumbnail you have already seen. Artwork for a given
// video never actually changes, so that re-fetch is pure waste and is what
// makes a scrolled library look like it is missing images on a slow
// connection.
//
// This serves thumbnails cache-first and ignores the short max-age, while
// keeping the cache bounded so it can't grow without limit.

const CACHE = 'vimusic-thumbs-v1';
const MAX_ENTRIES = 400;

const THUMBNAIL_HOSTS = ['i.ytimg.com', 'lh3.googleusercontent.com'];

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// Oldest-first eviction. Cache.keys() returns insertion order, so trimming
// from the front approximates least-recently-added.
async function trim(cache) {
  const keys = await cache.keys();
  if (keys.length <= MAX_ENTRIES) return;
  await Promise.all(keys.slice(0, keys.length - MAX_ENTRIES).map((k) => cache.delete(k)));
}

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  let url;
  try {
    url = new URL(request.url);
  } catch {
    return;
  }

  if (!THUMBNAIL_HOSTS.includes(url.hostname)) return;

  event.respondWith(
    caches.open(CACHE).then(async (cache) => {
      const hit = await cache.match(request);
      if (hit) return hit;

      try {
        const response = await fetch(request);
        // Thumbnails are cross-origin and come back opaque (type 'opaque',
        // status 0) unless CORS is negotiated. Opaque responses are still
        // perfectly usable in an <img>, so they're worth caching — but a
        // failed fetch is not.
        if (response && (response.ok || response.type === 'opaque')) {
          await cache.put(request, response.clone());
          trim(cache);
        }
        return response;
      } catch (err) {
        // Offline with nothing cached — let the <img> handle the failure.
        return Response.error();
      }
    })
  );
});
