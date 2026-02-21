import { getSecureMediaUrl } from './mediaUtils';

/**
 * Returns a proxied (or secure) image URL suitable for the current environment.
 * In development, it may use a Vite proxy; in production, it rewrites to the secure endpoint.
 * Falls back to the original URL if no transformation is needed.
 */
export function getProxiedImageUrl(originalUrl: string): string {
    if (!originalUrl) return originalUrl;

    // In development, you might want to use a proxy path if needed.
    // For now, we reuse the same logic as getSecureMediaUrl, which handles both.
    return getSecureMediaUrl(originalUrl);
}

/**
 * Adds a cache-busting query parameter to an image URL.
 */
export function addCacheBuster(url: string): string {
    if (!url) return url;
    const separator = url.includes('?') ? '&' : '?';
    return `${url}${separator}_cb=${Date.now()}`;
}
