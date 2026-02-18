/**
 * Converts an absolute media URL to a relative proxy URL in development,
 * otherwise returns the original URL for production.
 * @param url - The original image URL (e.g., from media service)
 * @returns The proxied URL (dev) or original (prod)
 */
export function getProxiedImageUrl(url: string): string {
    if (!url) return '';

    // In development, use the Vite proxy to avoid CORS
    if (import.meta.env.DEV) {
        const mediaDomains = {
            'selfstudymedia1.pythonanywhere.com': '/media1',
            'selfstudymedia2.pythonanywhere.com': '/media2',
        };

        for (const [domain, proxyPath] of Object.entries(mediaDomains)) {
            if (url.includes(domain)) {
                return url.replace(`https://${domain}`, proxyPath);
            }
        }
    }

    // In production, return the original absolute URL
    // The service worker will add the Authorization header
    return url;
}
