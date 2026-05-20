import { getSecureMediaUrl, withCacheBuster } from './mediaUtils';

/**
 * Returns a URL suitable for displaying an image in <img>.
 * - Normalizes /secure-media/ -> /media/ (which is public + CORS-enabled)
 * - Leaves other URLs untouched
 */
export function getProxiedImageUrl(originalUrl: string): string {
    if (!originalUrl) return originalUrl;
    return getSecureMediaUrl(originalUrl);
}

/**
 * Adds a cache-busting query parameter to an image URL.
 * Use when retrying after a failed load.
 */
export function addCacheBuster(url: string): string {
    return withCacheBuster(url);
}