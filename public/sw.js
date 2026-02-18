// public/sw.js
const FALLBACK_IMAGE = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=='; // 1x1 transparent PNG

const MEDIA_DOMAINS = [
    'selfstudymedia1.pythonanywhere.com',
'selfstudymedia2.pythonanywhere.com'
];

self.addEventListener('install', event => {
    self.skipWaiting(); // Activate immediately
});

self.addEventListener('activate', event => {
    event.waitUntil(clients.claim()); // Take control of all clients
});

self.addEventListener('fetch', event => {
    const url = new URL(event.request.url);
    const hostname = url.hostname;

    if (MEDIA_DOMAINS.includes(hostname)) {
        event.respondWith(
            fetch(event.request)
            .then(response => {
                if (response.ok) return response;
                return new Response(FALLBACK_IMAGE, { headers: { 'Content-Type': 'image/png' } });
            })
            .catch(() => new Response(FALLBACK_IMAGE, { headers: { 'Content-Type': 'image/png' } }))
        );
    }
});
