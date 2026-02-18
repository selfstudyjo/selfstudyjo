// public/sw.js
const FALLBACK_IMAGE = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';

self.addEventListener('install', event => {
    console.log('[SW] Installing...');
    self.skipWaiting();
});

self.addEventListener('activate', event => {
    console.log('[SW] Activating...');
    event.waitUntil(clients.claim());
});

self.addEventListener('fetch', event => {
    const url = new URL(event.request.url);
    const path = url.pathname;

    // Intercept requests to media domains (production) and proxy paths (development)
    if (
        url.hostname.includes('selfstudymedia') ||
        path.startsWith('/media1/') ||
        path.startsWith('/media2/')
    ) {
        console.log('[SW] Intercepting:', url.href);
        event.respondWith(
            fetch(event.request)
            .then(response => {
                if (response.ok) {
                    console.log('[SW] OK:', url.href);
                    return response;
                }
                console.warn('[SW] Bad response', response.status, 'for', url.href);
                return new Response(FALLBACK_IMAGE, { headers: { 'Content-Type': 'image/png' } });
            })
            .catch(err => {
                console.warn('[SW] Network error for', url.href, err);
                return new Response(FALLBACK_IMAGE, { headers: { 'Content-Type': 'image/png' } });
            })
        );
    }
});
