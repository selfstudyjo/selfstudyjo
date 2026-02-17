/**
 * Utility functions for course images
 */

/**
 * Get the first two initials from a course title
 */
export function getCourseInitials(title: string): string {
    if (!title || typeof title !== 'string' || title.trim().length === 0) return 'CS';

    const trimmedTitle = title.trim();
    const words = trimmedTitle.split(/\s+/).filter(word => word.length > 0);

    if (words.length >= 2) {
        const firstChar = words[0][0] || 'C';
        const secondChar = words[1][0] || 'S';
        return `${firstChar}${secondChar}`.toUpperCase();
    }

    if (trimmedTitle.length >= 2) {
        return trimmedTitle.substring(0, 2).toUpperCase();
    }

    return (trimmedTitle.charAt(0) + 'S').toUpperCase();
}

/**
 * Get a consistent color for a course based on its title
 */
export function getCourseColor(title: string): string {
    if (!title) return 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)';

    const colors = [
        'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        'linear-gradient(135deg, #f56565 0%, #ed8936 100%)',
        'linear-gradient(135deg, #48bb78 0%, #38a169 100%)',
        'linear-gradient(135deg, #4299e1 0%, #3182ce 100%)',
        'linear-gradient(135deg, #9f7aea 0%, #805ad5 100%)',
        'linear-gradient(135deg, #ed64a6 0%, #d53f8c 100%)',
        'linear-gradient(135deg, #38b2ac 0%, #319795 100%)',
        'linear-gradient(135deg, #f6ad55 0%, #ed8936 100%)',
        'linear-gradient(135deg, #4c51bf 0%, #2d3748 100%)',
        'linear-gradient(135deg, #2b6cb0 0%, #2c5282 100%)'
    ];

    const index = title.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0) % colors.length;
    return colors[index];
}

/**
 * Check if we should use the generated image (color + initials)
 * Returns true if the image URL is invalid or empty
 */
export function shouldUseGeneratedImage(imageUrl?: string): boolean {
    // If no URL or empty string, use generated image
    if (!imageUrl || imageUrl.trim() === '') {
        console.log('No image URL provided, using generated image');
        return true;
    }

    const url = imageUrl.toLowerCase().trim();

    // Check for common placeholder/empty image patterns
    const invalidPatterns = [
        'placeholder',
        'via.placeholder',
        'default.jpg',
        'default.png',
        'no-image',
        'null',
        'undefined',
        'example.com',
        'dummyimage.com',
        'lorempixel.com'
    ];

    for (const pattern of invalidPatterns) {
        if (url.includes(pattern)) {
            console.log(`Image URL contains invalid pattern "${pattern}", using generated image`);
            return true;
        }
    }

    // Check if it's a valid URL (starts with http/https)
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
        console.log('Image URL does not start with http/https, using generated image');
        return true;
    }

    // Check for common image file extensions
    const imageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg', '.bmp', '.tiff'];
    const hasImageExtension = imageExtensions.some(ext => url.includes(ext));

    // Check for common image hosting services
    const imageHosts = [
        'cloudinary.com',
        's3.amazonaws.com',
        'storage.googleapis.com',
        'imgur.com',
        'images.unsplash.com',
        'picsum.photos',
        'cdn.',
        'storage.',
        'media.',
        'images.',
        'img.'
    ];

    const hasImageHost = imageHosts.some(host => url.includes(host));

    // If it has an image extension or is from an image host, it's valid
    if (hasImageExtension || hasImageHost) {
        console.log('Image URL is valid, using real image:', imageUrl);
        return false;
    }

    console.log('Image URL appears invalid, using generated image:', imageUrl);
    return true;
}

/**
 * Check if an image URL is valid
 * This is the opposite of shouldUseGeneratedImage
 */
export function isValidImageUrl(url?: string): boolean {
    return !shouldUseGeneratedImage(url);
}
