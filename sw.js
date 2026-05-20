// public/sw.js
//
// Minimal Service Worker.
//
// We intentionally do NOT register a 'fetch' handler.
// Why?
//   - Cross-origin <img> requests load fine natively (no CORS check needed
//     for plain image rendering).
//   - If we intercept them and call `fetch(request)` inside the SW, the
//     browser treats that as a CORS-protected fetch. PythonAnywhere's
//     /media/ endpoint does not return Access-Control-Allow-Origin headers,
//     so every intercepted media request would be blocked.
//
// Image error fallback is now handled inside the Vue components themselves
// (initials fallback + cache-buster retry).
//

self.addEventListener('install', () => {
    // Activate immediately, replacing any previous version of this SW.
    self.skipWaiting();
});

self.addEventListener('activate', (event) => {
    // Take control of all open clients right after activation.
    event.waitUntil(clients.claim());
});

// Kept for backwards-compatibility with any code that still posts messages
// to the SW (e.g. older `SET_AUTH_TOKEN` calls). No-op.
self.addEventListener('message', () => {
    // intentionally empty
});

// NOTE: No 'fetch' event handler. The browser handles all requests directly.