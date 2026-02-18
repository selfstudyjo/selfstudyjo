// public/sw.js

const FALLBACK_IMAGE = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=='; // 1x1 transparent PNG

self.addEventListener('install', event => {
    self.skipWaiting(); // Activate immediately
});

self.addEventListener('activate', event => {
    event.waitUntil(clients.claim()); // Take control of all clients
});

self.addEventListener('fetch', event => {
    const url = new URL(event.request.url);
    const path = url.pathname;

    // Intercept requests to the proxy paths
    if (path.startsWith('/media1/') || path.startsWith('/media2/')) {
        event.respondWith(
            fetch(event.request)
            .then(response => {
                // If the response is OK (status 200-299), return it
                if (response.ok) return response;
                // Otherwise (403, 404, etc.) return the fallback
                return new Response(
                    FALLBACK_IMAGE,
                    { headers: { 'Content-Type': 'image/png' } }
                );
            })
            .catch(() => {
                // Network error – also return fallback
                return new Response(
                    FALLBACK_IMAGE,
                    { headers: { 'Content-Type': 'image/png' } }
                );
            })
        );
    }
});
