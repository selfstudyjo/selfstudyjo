/**
 * Converts an absolute media URL to a relative proxy URL in development,
 * otherwise returns the original URL for production with a cache-busting parameter.
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
        return url;
    }

    // In production, add a cache-busting query parameter
    const cacheBuster = `_cb=${Date.now()}`;
    const separator = url.includes('?') ? '&' : '?';
    return `${url}${separator}${cacheBuster}`;
}
