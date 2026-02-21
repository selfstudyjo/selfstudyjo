/**
 * Converts a direct media server URL to a secure endpoint URL in production.
 * In development, returns the proxy URL (no change needed because Vite proxy handles it).
 */
export function getSecureMediaUrl(originalUrl: string): string {
    if (!originalUrl) return originalUrl;

    // In development, we keep the original (will be proxied via Vite)
    if (import.meta.env.DEV) {
        return originalUrl;
    }

    // In production, rewrite URLs that point to media servers
    // Example: https://selfstudymedia1.pythonanywhere.com/media/course_images/239.jpg
    //       → https://selfstudymedia1.pythonanywhere.com/secure-media/course_images/239.jpg
    const mediaServerPattern = /^https?:\/\/selfstudymedia\d+\.pythonanywhere\.com\/media\/([^/]+)\/(.+)$/;
    const match = originalUrl.match(mediaServerPattern);

    if (match) {
        const [, mediaType, fileName] = match;
        // Use the same origin but with /secure-media/ prefix
        const base = originalUrl.split('/media/')[0];
        return `${base}/secure-media/${mediaType}/${fileName}`;
    }

    // If it's not a media server URL, return as is (e.g., external CDN)
    return originalUrl;
}

/**
 * Helper to determine if a URL is a placeholder or invalid.
 * (Optional – you can reuse your existing isValidImageUrl logic)
 */
export function isValidImageUrl(url?: string): boolean {
    if (!url) return false;
    // ... (keep your existing validation from courseImage.ts)
    return true;
}
