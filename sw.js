// public/sw.js
// Transparent tiny PNG used as a last-resort fallback for failed image loads.
const FALLBACK_IMAGE_DATA_URL =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(clients.claim());
});

// Kept for backwards-compatibility with existing app code that posts a token.
// We no longer rely on it for media (since /media/ is publicly served + CORS-enabled).
self.addEventListener('message', (event) => {
  // no-op; intentionally left blank
});

/**
 * Build a fallback image Response.
 */
async function fallbackImageResponse() {
  try {
    const res = await fetch(FALLBACK_IMAGE_DATA_URL);
    const buf = await res.arrayBuffer();
    return new Response(buf, {
      status: 200,
      headers: { 'Content-Type': 'image/png', 'Cache-Control': 'no-store' },
    });
  } catch {
    return new Response('', { status: 503 });
  }
}

self.addEventListener('fetch', (event) => {
  // Only GET matters for media display
  if (event.request.method !== 'GET') return;

  let url;
  try {
    url = new URL(event.request.url);
  } catch {
    return;
  }

  const isSelfStudyMediaHost = url.hostname.includes('selfstudymedia');
  const isMediaPath =
    url.pathname.startsWith('/media/') ||
    url.pathname.startsWith('/secure-media/') ||
    url.pathname.startsWith('/media1/') ||
    url.pathname.startsWith('/media2/');

  if (!isSelfStudyMediaHost && !isMediaPath) return;

  // Normalize: if anything still points at /secure-media/, send it through /media/
  // (Django serves /media/ publicly with CORS already.)
  let targetUrl = event.request.url;
  if (url.pathname.startsWith('/secure-media/')) {
    const newPath = url.pathname.replace('/secure-media/', '/media/');
    targetUrl = `${url.origin}${newPath}${url.search}`;
  }

  event.respondWith(
    (async () => {
      try {
        // Build a clean request: no auth header, public endpoint
        const req = new Request(targetUrl, {
          method: 'GET',
          mode: 'cors',
          credentials: 'omit',
          cache: 'default',
        });

        const response = await fetch(req);

        if (response && response.ok) {
          return response;
        }

        // Bad response — only swap to fallback for actual image requests
        if (event.request.destination === 'image') {
          return await fallbackImageResponse();
        }

        return response;
      } catch (err) {
        if (event.request.destination === 'image') {
          return await fallbackImageResponse();
        }
        return new Response('', { status: 503 });
      }
    })(),
  );
});