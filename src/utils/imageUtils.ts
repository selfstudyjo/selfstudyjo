/**
 * Converts an absolute media URL to a relative proxy URL if it matches known media domains.
 * This allows images to be served through the same origin as the frontend, avoiding CORS issues.
 * @param url - The original image URL (e.g., from media service)
 * @returns The proxied URL or the original if no match
 */
export function getProxiedImageUrl(url: string): string {
    if (!url) return '';

    // Known media domains (match those in vite.config.ts proxy)
    const mediaDomains = {
        'selfstudymedia1.pythonanywhere.com': '/media1',
        'selfstudymedia2.pythonanywhere.com': '/media2',
    };

    for (const [domain, proxyPath] of Object.entries(mediaDomains)) {
        if (url.includes(domain)) {
            // Replace the full domain with the proxy path
            // Assumes URL starts with https://domain
            return url.replace(`https://${domain}`, proxyPath);
        }
    }
    return url;
}
