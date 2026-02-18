// public/sw.js
const FALLBACK_IMAGE = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';

let authToken = null;

self.addEventListener('install', event => {
    self.skipWaiting();
});

self.addEventListener('activate', event => {
    event.waitUntil(clients.claim());
});

// Listen for messages from the main thread to set the token
self.addEventListener('message', event => {
    if (event.data && event.data.type === 'SET_AUTH_TOKEN') {
        authToken = event.data.token;
        console.log('Service worker received auth token');
    }
});

self.addEventListener('fetch', event => {
    const url = new URL(event.request.url);
    if (
        url.hostname.includes('selfstudymedia') ||
        url.pathname.startsWith('/media1/') ||
        url.pathname.startsWith('/media2/')
    ) {
        // Clone the request to add headers
        const requestInit = {
            method: event.request.method,
            headers: new Headers(event.request.headers),
                      mode: 'cors',
                      credentials: 'omit',
                      cache: event.request.cache
        };

        // Add Authorization header if token exists
        if (authToken && authToken !== 'Token Not Found!' && authToken !== 'your-actual-auth-token-here') {
            requestInit.headers.set('Authorization', `Token ${authToken}`);
        }

        // Create new request with added headers
        const newRequest = new Request(event.request.url, requestInit);

        event.respondWith(
            fetch(newRequest)
            .then(response => response.ok ? response : new Response(FALLBACK_IMAGE, { headers: { 'Content-Type': 'image/png' } }))
            .catch(() => new Response(FALLBACK_IMAGE, { headers: { 'Content-Type': 'image/png' } }))
        );
    }
});
