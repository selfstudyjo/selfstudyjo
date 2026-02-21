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
        url.pathname.startsWith('/media2/') ||
        url.pathname.startsWith('/secure-media/')
    ) {
        // Rewrite /media/... to /secure-media/... (catches any missed transformations)
        let requestUrl = event.request.url;
        if (url.pathname.startsWith('/media/')) {
            const newPath = url.pathname.replace('/media/', '/secure-media/');
            requestUrl = `${url.origin}${newPath}${url.search}`;
            console.log(`SW rewriting: ${event.request.url} -> ${requestUrl}`);
        }

        // Clone the request to add headers
        const requestInit = {
            method: event.request.method,
            headers: new Headers(event.request.headers),
                      mode: 'cors',
                      credentials: 'omit',
                      cache: event.request.cache
        };

        // Add Authorization header if token exists (only for non-GET? We'll keep it for all, but server now allows GET without token)
        if (authToken && authToken !== 'Token Not Found!' && authToken !== 'your-actual-auth-token-here') {
            requestInit.headers.set('Authorization', `Token ${authToken}`);
        }

        // Create new request with added headers (and possibly new URL)
        const newRequest = new Request(requestUrl, requestInit);

        event.respondWith(
            fetch(newRequest)
            .then(response => response.ok ? response : new Response(FALLBACK_IMAGE, { headers: { 'Content-Type': 'image/png' } }))
            .catch(() => new Response(FALLBACK_IMAGE, { headers: { 'Content-Type': 'image/png' } }))
        );
    }
});
