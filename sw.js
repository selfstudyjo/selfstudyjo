// public/sw.js
//
// Minimal no-op service worker.
//
// Why empty?
//   - Profile pictures are plain <img> — they don't need CORS and the
//     browser handles them natively.
//   - Course images come through THREE.TextureLoader (WebGL) and need
//     CORS, but that fix lives in `planetRenderer.ts.getEffectiveUrl`
//     (route through a CORS proxy in production), so the SW doesn't
//     have to be involved at all.
//
// Keeping this file present + empty also lets any previously-installed
// older version of `sw.js` be cleanly replaced on next visit.

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(clients.claim());
});

self.addEventListener('message', () => {
  // intentionally empty
});