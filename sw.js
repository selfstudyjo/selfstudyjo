// public/sw.js
const FALLBACK_IMAGE = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';

self.addEventListener('install', event => {
    self.skipWaiting(); // Activate immediately
});

self.addEventListener('activate', event => {
    event.waitUntil(clients.claim()); // Take control of all pages
});

self.addEventListener('fetch', event => {
    const url = new URL(event.request.url);

    // Intercept requests to media domains (production) and proxy paths (development)
    if (url.hostname.includes('selfstudymedia') || url.pathname.startsWith('/media1/') || url.pathname.startsWith('/media2/')) {
        event.respondWith(
            fetch(event.request)
            .then(response => {
                if (response.ok) return response;
                // For any non-OK response (403,404,etc), return fallback
                return new Response(FALLBACK_IMAGE, { headers: { 'Content-Type': 'image/png' } });
            })
            .catch(() => new Response(FALLBACK_IMAGE, { headers: { 'Content-Type': 'image/png' } }))
        );
    }
});
