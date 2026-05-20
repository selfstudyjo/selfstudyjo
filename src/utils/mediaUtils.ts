/**
 * Returns a media URL that can be safely loaded by the browser.
 *
 * Django (selfstudymedia) serves /media/ publicly with CORS enabled, so we
 * deliberately do NOT rewrite to /secure-media/ for image rendering.
 * (Filenames are UUIDs and the secure endpoint is still available server-side
 *  for callers that explicitly need an authenticated stream.)
 *
 * If a stored URL happens to point to /secure-media/, we normalize it back
 * to /media/ so it loads reliably on first paint.
 */
export function getSecureMediaUrl(originalUrl: string): string {
    if (!originalUrl) return originalUrl;

    // Normalize /secure-media/ -> /media/ for any selfstudymedia host
    try {
        const u = new URL(originalUrl, window.location.href);
        if (u.hostname.includes('selfstudymedia') && u.pathname.startsWith('/secure-media/')) {
            u.pathname = u.pathname.replace('/secure-media/', '/media/');
            return u.toString();
        }
    } catch {
        // If URL parsing fails, fall through to string-based fallback
        if (originalUrl.includes('/secure-media/')) {
            return originalUrl.replace('/secure-media/', '/media/');
        }
    }

    return originalUrl;
}

/**
 * Adds a cache-busting query parameter to an image URL. Useful for retries.
 */
export function withCacheBuster(url: string): string {
    if (!url) return url;
    const separator = url.includes('?') ? '&' : '?';
    return `${url}${separator}_cb=${Date.now()}`;
}

/**
 * Helper to determine if a URL is a placeholder or invalid.
 */
export function isValidImageUrl(url?: string): boolean {
    if (!url) return false;
    const trimmed = url.trim();
    if (!trimmed) return false;
    if (trimmed === 'null' || trimmed === 'undefined') return false;
    return true;
}