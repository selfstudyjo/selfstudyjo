/**
 * Utility for embedding video instructions securely
 */

export interface VideoEmbedOptions {
    authToken: string;
    url: string;
    width?: string;
    height?: string;
    autoplay?: boolean;
    controls?: boolean;
}

export class VideoEmbedService {
    private static AUTH_TOKEN = import.meta.env.VITE_AUTH_TOKEN || '';

    /**
     * Check if a URL can be embedded
     */
    static canEmbed(url: string): boolean {
        try {
            const urlObj = new URL(url);
            const hostname = urlObj.hostname.toLowerCase();
            const pathname = urlObj.pathname.toLowerCase();

            // Allow direct video files (MP4, WebM, etc.)
            const videoExtensions = ['.mp4', '.webm', '.ogg', '.mov', '.avi', '.wmv', '.flv', '.mkv'];
            const isVideoFile = videoExtensions.some(ext => pathname.endsWith(ext));

            if (isVideoFile) {
                return true;
            }

            // Allow common video hosting platforms
            const allowedDomains = [
                'youtube.com',
                'youtu.be',
                'vimeo.com',
                'wistia.com',
                'dailymotion.com',
                'twitch.tv',
                'streamable.com',
                'loom.com'
            ];

            return allowedDomains.some(domain => hostname.includes(domain));
        } catch {
            return false;
        }
    }

    /**
     * Get embed URL for a video with authentication
     */
    static getEmbedUrl(url: string): string | null {
        try {
            const urlObj = new URL(url);
            const hostname = urlObj.hostname.toLowerCase();
            const pathname = urlObj.pathname;

            // Get authentication token
            const authToken = this.AUTH_TOKEN;

            // Handle direct video files
            const videoExtensions = ['.mp4', '.webm', '.ogg', '.mov', '.avi', '.wmv', '.flv', '.mkv'];
            const isVideoFile = videoExtensions.some(ext => pathname.toLowerCase().endsWith(ext));

            if (isVideoFile) {
                // For direct video files, we need to add authentication headers
                // We'll use the original URL but ensure proper headers are sent
                return url;
            }

            const videoId = this.extractVideoId(url);

            if (!videoId) return null;

            const tokenParam = authToken && authToken !== 'Token Not Found!'
            ? `&token=${encodeURIComponent(authToken)}`
            : '';

            // Handle different video platforms
            if (hostname.includes('youtube.com') || hostname.includes('youtu.be')) {
                return `https://www.youtube.com/embed/${videoId}?autoplay=0&rel=0&modestbranding=1${tokenParam}`;
            } else if (hostname.includes('vimeo.com')) {
                return `https://player.vimeo.com/video/${videoId}?autoplay=0&controls=1${tokenParam}`;
            } else if (hostname.includes('wistia.com')) {
                return `https://fast.wistia.net/embed/iframe/${videoId}?autoplay=0${tokenParam}`;
            } else if (hostname.includes('dailymotion.com')) {
                return `https://www.dailymotion.com/embed/video/${videoId}?autoplay=0${tokenParam}`;
            } else if (hostname.includes('twitch.tv')) {
                return `https://player.twitch.tv/?video=${videoId}&parent=${window.location.hostname}&autoplay=false${tokenParam}`;
            } else if (hostname.includes('streamable.com')) {
                return `https://streamable.com/e/${videoId}?autoplay=0${tokenParam}`;
            } else if (hostname.includes('loom.com')) {
                return `https://www.loom.com/embed/${videoId}?autoplay=0${tokenParam}`;
            }

            return null;
        } catch {
            return null;
        }
    }

    /**
     * Extract video ID from URL
     */
    private static extractVideoId(url: string): string | null {
        try {
            const urlObj = new URL(url);
            const hostname = urlObj.hostname.toLowerCase();

            // YouTube
            if (hostname.includes('youtube.com')) {
                return urlObj.searchParams.get('v') ||
                urlObj.pathname.split('/').pop() ||
                null;
            } else if (hostname.includes('youtu.be')) {
                return urlObj.pathname.slice(1);
            }
            // Vimeo
            else if (hostname.includes('vimeo.com')) {
                return urlObj.pathname.split('/').pop() || null;
            }
            // Wistia
            else if (hostname.includes('wistia.com') || hostname.includes('wi.st')) {
                const match = url.match(/wistia\.(?:com|net)\/(?:embed\/)?(?:iframe\/)?([a-zA-Z0-9]+)/);
                return match ? match[1] : null;
            }
            // DailyMotion
            else if (hostname.includes('dailymotion.com')) {
                const match = url.match(/dailymotion\.com\/(?:video|embed\/video)\/([a-zA-Z0-9]+)/);
                return match ? match[1] : null;
            }
            // Twitch
            else if (hostname.includes('twitch.tv')) {
                const match = url.match(/twitch\.tv\/videos\/(\d+)/);
                return match ? match[1] : null;
            }
            // Streamable
            else if (hostname.includes('streamable.com')) {
                const match = url.match(/streamable\.com\/([a-zA-Z0-9]+)/);
                return match ? match[1] : null;
            }
            // Loom
            else if (hostname.includes('loom.com')) {
                const match = url.match(/loom\.com\/(?:share\/)?([a-zA-Z0-9]+)/);
                return match ? match[1] : null;
            }

            return null;
        } catch {
            return null;
        }
    }

    /**
     * Create iframe embed code with authentication
     */
    static createEmbedIframe(url: string, options?: {
        width?: string;
        height?: string;
        autoplay?: boolean;
        controls?: boolean;
    }): string {
        const embedUrl = this.getEmbedUrl(url);
        if (!embedUrl) {
            return '<div class="video-error">Unable to embed this video</div>';
        }

        const width = options?.width || '100%';
        const height = options?.height || '400px';
        const autoplay = options?.autoplay ? '1' : '0';
        const controls = options?.controls !== false ? '1' : '0';

        // Get authentication token
        const authToken = this.AUTH_TOKEN;

        // Check if it's a direct video file
        const videoExtensions = ['.mp4', '.webm', '.ogg', '.mov', '.avi', '.wmv', '.flv', '.mkv'];
        const isVideoFile = videoExtensions.some(ext => url.toLowerCase().endsWith(ext));

        if (isVideoFile) {
            // For direct video files, use HTML5 video player
            return `
            <div class="video-embed-container">
            <video
            width="${width}"
            height="${height}"
            controls
            ${autoplay === '1' ? 'autoplay' : ''}
            ${controls === '1' ? '' : 'controlsList="nodownload"'}
            style="width: 100%; height: 100%; border-radius: 8px;"
            >
            <source src="${embedUrl}" type="video/mp4">
            Your browser does not support the video tag.
            </video>
            <div class="video-auth-info" style="display: none;" data-token="${authToken || ''}"></div>
            </div>
            `;
        }

        // For external video platforms
        const tokenHeader = authToken && authToken !== 'Token Not Found!'
        ? `data-token="${authToken}"`
        : '';

        return `
        <div class="video-embed-container" ${tokenHeader}>
        <iframe
        src="${embedUrl}"
        width="${width}"
        height="${height}"
        frameborder="0"
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
        allowfullscreen
        loading="lazy"
        title="Video Instructions"
        referrerpolicy="strict-origin-when-cross-origin"
        ></iframe>
        </div>
        `;
    }

    /**
     * Render video embed in Vue component
     */
    static renderVideoEmbed(url: string, containerId: string, options?: {
        width?: string;
        height?: string;
        autoplay?: boolean;
        controls?: boolean;
    }): void {
        const container = document.getElementById(containerId);
        if (!container) return;

        if (!this.canEmbed(url)) {
            container.innerHTML = `
            <div class="video-link-container">
            <p>This video cannot be embedded. Please watch it on the original site.</p>
            <a href="${url}" target="_blank" class="video-external-link">
            Watch Video
            </a>
            </div>
            `;
            return;
        }

        const iframeHtml = this.createEmbedIframe(url, options);
        container.innerHTML = iframeHtml;

        // Add authentication headers for direct video files
        const videoExtensions = ['.mp4', '.webm', '.ogg', '.mov', '.avi', '.wmv', '.flv', '.mkv'];
        const isVideoFile = videoExtensions.some(ext => url.toLowerCase().endsWith(ext));

        if (isVideoFile) {
            const videoElement = container.querySelector('video');
            if (videoElement) {
                const authToken = this.AUTH_TOKEN;
                if (authToken && authToken !== 'Token Not Found!') {
                    // Add headers for authenticated video requests
                    videoElement.addEventListener('error', (e) => {
                        console.error('Video error:', e);
                        // If video fails to load, show alternative link
                        container.innerHTML = `
                        <div class="video-link-container">
                        <p>Video loading failed. Please watch it directly:</p>
                        <a href="${url}" target="_blank" class="video-external-link">
                        Watch Video
                        </a>
                        </div>
                        `;
                    });
                }
            }
        }
    }

    /**
     * Create Vue component props for video embed
     */
    static getVideoEmbedProps(url: string): {
        canEmbed: boolean;
        embedUrl: string | null;
        externalUrl: string;
        authToken: string;
        isDirectVideo: boolean;
    } {
        const videoExtensions = ['.mp4', '.webm', '.ogg', '.mov', '.avi', '.wmv', '.flv', '.mkv'];
        const isDirectVideo = videoExtensions.some(ext => url.toLowerCase().endsWith(ext));

        return {
            canEmbed: this.canEmbed(url),
            embedUrl: this.getEmbedUrl(url),
            externalUrl: url,
            authToken: this.AUTH_TOKEN,
            isDirectVideo
        };
    }

    /**
     * Validate and sanitize video URL
     */
    static sanitizeVideoUrl(url: string): string {
        try {
            // Ensure URL has protocol
            if (!url.startsWith('http://') && !url.startsWith('https://')) {
                url = 'https://' + url;
            }

            // Parse URL to remove any malicious parameters
            const urlObj = new URL(url);

            // Remove tracking parameters and keep only essential ones
            const allowedParams = ['v', 'id', 'video', 'autoplay', 'controls', 'rel'];
            const params = new URLSearchParams();

            urlObj.searchParams.forEach((value, key) => {
                if (allowedParams.includes(key.toLowerCase())) {
                    params.set(key, value);
                }
            });

            // Reconstruct URL with only allowed parameters
            urlObj.search = params.toString();
            return urlObj.toString();
        } catch {
            // If URL parsing fails, return original
            return url;
        }
    }

    /**
     * Get video type from URL
     */
    static getVideoType(url: string): string {
        const urlObj = new URL(url);
        const pathname = urlObj.pathname.toLowerCase();

        if (pathname.endsWith('.mp4')) return 'video/mp4';
        if (pathname.endsWith('.webm')) return 'video/webm';
        if (pathname.endsWith('.ogg')) return 'video/ogg';
        if (pathname.endsWith('.mov')) return 'video/quicktime';
        if (pathname.endsWith('.avi')) return 'video/x-msvideo';
        if (pathname.endsWith('.wmv')) return 'video/x-ms-wmv';
        if (pathname.endsWith('.flv')) return 'video/x-flv';
        if (pathname.endsWith('.mkv')) return 'video/x-matroska';

        return 'video/mp4'; // default
    }
}
