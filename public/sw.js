// public/sw.js

const FALLBACK_IMAGE = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=='; // 1x1 transparent PNG

// List of media domains to intercept
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

    // Check if the request is to one of our media domains
    if (MEDIA_DOMAINS.includes(hostname)) {
        event.respondWith(
            fetch(event.request)
            .then(response => {
                // If the response is OK, return it
                if (response.ok) return response;
                // Otherwise, return the transparent fallback
                return new Response(
                    FALLBACK_IMAGE,
                    { headers: { 'Content-Type': 'image/png' } }
                );
            })
            .catch(() => {
                // Network error – return fallback
                return new Response(
                    FALLBACK_IMAGE,
                    { headers: { 'Content-Type': 'image/png' } }
                );
            })
        );
    }
});
