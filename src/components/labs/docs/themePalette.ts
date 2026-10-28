/**
 * The theme's colours for a three.js illustration. A canvas cannot read a CSS
 * custom property (working rule 37), so the tokens are resolved off <html> at
 * the moment a scene is built; the scene is rebuilt when `data-theme` changes.
 */
import type { Palette } from '@/utils/labDocs3d/sceneKit';

function token(style: CSSStyleDeclaration, name: string, fallback: string): string {
    const value = style.getPropertyValue(name).trim();
    return /^(#|rgb|hsl)/.test(value) ? value : fallback;
}

export function themePalette(): Palette {
    const style = getComputedStyle(document.documentElement);
    return {
        ink: token(style, '--sfs-text', '#e5e7eb'),
        muted: token(style, '--sfs-text-muted', '#9ca3af'),
        accent: token(style, '--sfs-accent', '#667eea'),
        accent2: token(style, '--sfs-accent-2', '#f472b6'),
        accent3: token(style, '--sfs-accent-3', '#22d3ee'),
        surface: token(style, '--sfs-paper', '#f8fafc'),
        good: token(style, '--sfs-success', '#22c55e'),
        bad: token(style, '--sfs-danger', '#ef4444'),
    };
}
