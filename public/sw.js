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

    // Intercept requests to the media domains via the proxy paths
    if (url.pathname.startsWith('/media1/') || url.pathname.startsWith('/media2/')) {
        event.respondWith(
            fetch(event.request)
            .then(response => {
                if (response.ok) return response;
                // For any non-OK status, return the transparent fallback
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
