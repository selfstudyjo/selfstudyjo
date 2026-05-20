// public/sw.js
//
// Strategy
// --------
// Plain <img> tags (e.g. profile pictures) load cross-origin images
// just fine — the browser does NOT do a CORS check for ordinary image
// rendering. Those requests reach the SW with mode === 'no-cors' and
// we leave them ALONE.
//
// WebGL's THREE.TextureLoader, on the other hand, sets
// crossOrigin = 'anonymous' on the underlying <img>, which forces a
// CORS request (mode === 'cors'). PythonAnywhere's /media/ endpoint
// does not return Access-Control-Allow-Origin, so the CORS check
// fails and the texture never loads.
//
// In this Service Worker we intercept ONLY those CORS-mode media
// requests and route them through a public CORS proxy, which returns
// the same bytes with proper CORS headers attached. WebGL then accepts
// the image as a sphere texture — and `Planet.vue` /
// `planetRenderer.ts` stay completely unchanged.

const FALLBACK_IMAGE_DATA_URL =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';

// Ordered list of CORS proxies — we try them in sequence so a single
// proxy going down doesn't kill all course thumbnails.
const CORS_PROXIES = [
  (url) => `https://corsproxy.io/?${encodeURIComponent(url)}`,
  (url) => `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`,
  (url) => `https://api.codetabs.com/v1/proxy/?quest=${encodeURIComponent(url)}`,
];

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(clients.claim());
});

// Kept for backwards-compatibility with any older code that posts
// messages (e.g. SET_AUTH_TOKEN). No-op now.
self.addEventListener('message', () => {});

async function fallbackImageResponse() {
  try {
    const res = await fetch(FALLBACK_IMAGE_DATA_URL);
    const buf = await res.arrayBuffer();
    return new Response(buf, {
      status: 200,
      headers: {
        'Content-Type': 'image/png',
        'Access-Control-Allow-Origin': '*',
        'Cache-Control': 'no-store',
      },
    });
  } catch {
    return new Response('', { status: 503 });
  }
}

/**
 * Try each CORS proxy in order. Returns the first successful Response
 * (which carries proper CORS headers added by the proxy itself), or
 * `null` if all of them fail.
 */
async function fetchThroughProxies(originalUrl) {
  for (const buildProxyUrl of CORS_PROXIES) {
    try {
      const proxyUrl = buildProxyUrl(originalUrl);
      const response = await fetch(proxyUrl, {
        method: 'GET',
        mode: 'cors',
        credentials: 'omit',
        cache: 'default',
      });
      if (response && response.ok) return response;
    } catch {
      /* try next proxy */
    }
  }
  return null;
}

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;

  let url;
  try {
    url = new URL(event.request.url);
  } catch {
    return;
  }

  // Only intercept CORS-mode requests to selfstudymedia hosts.
  // Plain <img> (mode === 'no-cors') is NOT intercepted.
  const isSelfStudyMediaHost = url.hostname.includes('selfstudymedia');
  const needsCorsHelp = event.request.mode === 'cors';

  if (!isSelfStudyMediaHost || !needsCorsHelp) return;

  event.respondWith(
    (async () => {
      // 1) Try the origin directly first. If you (or PythonAnywhere)
      //    ever add CORS headers later, this becomes a no-op pass-through.
      try {
        const direct = await fetch(event.request);
        if (direct && direct.ok) return direct;
      } catch {
        /* CORS / network failure — fall through to proxy */
      }

      // 2) Route through a public CORS proxy to obtain a CORS-clean Response
      //    that WebGL/canvas can accept.
      const proxied = await fetchThroughProxies(event.request.url);
      if (proxied) return proxied;

      // 3) Last resort fallback (only for image destinations)
      if (event.request.destination === 'image') {
        return fallbackImageResponse();
      }
      return new Response('', { status: 502 });
    })()
  );
});