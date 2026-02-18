// public/sw.js
const FALLBACK_IMAGE = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';

self.addEventListener('install', event => {
    self.skipWaiting();
});

self.addEventListener('activate', event => {
    event.waitUntil(clients.claim());
});

self.addEventListener('fetch', event => {
    const url = new URL(event.request.url);
    if (
        url.hostname.includes('selfstudymedia') ||
        url.pathname.startsWith('/media1/') ||
        url.pathname.startsWith('/media2/')
    ) {
        event.respondWith(
            fetch(event.request)
            .then(response => response.ok ? response : new Response(FALLBACK_IMAGE, { headers: { 'Content-Type': 'image/png' } }))
            .catch(() => new Response(FALLBACK_IMAGE, { headers: { 'Content-Type': 'image/png' } }))
        );
    }
});
