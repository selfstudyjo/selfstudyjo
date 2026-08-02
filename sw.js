// public/sw.js
//
// Minimal no-op service worker.
//
// Why empty?
//   - Profile pictures are plain <img> — they don't need CORS and the
//     browser handles them natively.
//   - Course images become WebGL textures and so do need CORS, but the media
//     backends already send `Access-Control-Allow-Origin: *` and
//     `planetRenderer.ts` loads them with crossOrigin="anonymous", so the SW
//     doesn't have to be involved at all.
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