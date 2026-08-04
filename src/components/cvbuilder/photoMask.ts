// src/components/cvbuilder/photoMask.ts
//
// Background segmentation for the CV photo studio.
//
// Pure functions over raw pixel buffers — no canvas, no DOM — so the maths can be
// reasoned about and tested on its own. CvPhotoStudio.vue does the canvas work and
// calls in here for the mask.
//
// The approach is a border-seeded flood fill: start from the edges of the picture,
// where the background provably is, and spread inwards through pixels that match
// the background's colour. That beats a plain colour threshold because an isolated
// patch of wall-coloured shirt is never reached, and it beats a naive centre-out
// approach because it needs no guess about where the subject is.
//
// Two guarantees hold whatever the sliders say:
//
//   1. The fill only ever spreads from the border through contiguous matching
//      pixels, so it cannot appear inside an enclosed region of the subject.
//   2. It refuses to enter the protected ellipse at all. That is what keeps the
//      face intact even at maximum tolerance — the requirement is to change the
//      background, never to remove the person.

export interface BorderSample {
    /** The median RGB of the outer ring — our estimate of "the background". */
    reference: [number, number, number];
    /**
     * Mean absolute deviation of the ring from that median. A plain wall scores
     * near zero; a bookshelf scores high, and the UI warns instead of quietly
     * producing a patchy cut-out.
     */
    spread: number;
}

/** Above this, the background is too varied for a clean flood fill. */
export const BUSY_BACKGROUND_SPREAD = 34;

export interface ProtectRegion {
    centreX: number;
    centreY: number;
    radiusX: number;
    radiusY: number;
}

/**
 * Where the subject is assumed to be, in the source image's own pixels.
 *
 * A head-and-shoulders photo puts the subject slightly below centre, so the
 * ellipse is biased downwards. `protect` (0..1) is the user's slider.
 */
export function protectRegion(width: number, height: number, protect: number): ProtectRegion {
    const amount = Math.max(0, Math.min(1, protect));
    return {
        centreX: width / 2,
        centreY: height * 0.54,
        radiusX: width * (0.17 + 0.25 * amount),
        radiusY: height * (0.22 + 0.30 * amount),
    };
}

export function sampleBorder(pixels: Uint8ClampedArray, width: number, height: number): BorderSample {
    const ring = Math.max(2, Math.round(Math.min(width, height) * 0.04));
    const reds: number[] = [];
    const greens: number[] = [];
    const blues: number[] = [];

    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            if (x >= ring && y >= ring && x < width - ring && y < height - ring) continue;
            const i = (y * width + x) * 4;
            reds.push(pixels[i]);
            greens.push(pixels[i + 1]);
            blues.push(pixels[i + 2]);
        }
    }

    const median = (values: number[]) => {
        if (!values.length) return 0;
        const sorted = values.slice().sort((a, b) => a - b);
        return sorted[Math.floor(sorted.length / 2)];
    };
    const reference: [number, number, number] = [median(reds), median(greens), median(blues)];

    let total = 0;
    for (let n = 0; n < reds.length; n++) {
        total += Math.abs(reds[n] - reference[0])
            + Math.abs(greens[n] - reference[1])
            + Math.abs(blues[n] - reference[2]);
    }

    return { reference, spread: reds.length ? total / reds.length / 3 : 0 };
}

/**
 * Per-pixel alpha for the subject: 255 keeps the pixel, 0 replaces it with the
 * new background colour.
 */
export function floodFillBackground(
    pixels: Uint8ClampedArray,
    width: number,
    height: number,
    reference: [number, number, number],
    tolerance: number,
    protect: number
): Uint8Array {
    const alpha = new Uint8Array(width * height).fill(255);
    const seen = new Uint8Array(width * height);
    const queue = new Int32Array(width * height);
    let head = 0;
    let tail = 0;

    const region = protectRegion(width, height, protect);
    const toleranceSquared = tolerance * tolerance;

    const isProtected = (x: number, y: number) => {
        const dx = (x - region.centreX) / region.radiusX;
        const dy = (y - region.centreY) / region.radiusY;
        return dx * dx + dy * dy <= 1;
    };

    const matchesBackground = (index: number) => {
        const i = index * 4;
        const dr = pixels[i] - reference[0];
        const dg = pixels[i + 1] - reference[1];
        const db = pixels[i + 2] - reference[2];
        return dr * dr + dg * dg + db * db <= toleranceSquared;
    };

    const visit = (x: number, y: number) => {
        if (x < 0 || y < 0 || x >= width || y >= height) return;
        const index = y * width + x;
        if (seen[index]) return;
        seen[index] = 1;
        if (isProtected(x, y) || !matchesBackground(index)) return;
        alpha[index] = 0;
        queue[tail++] = index;
    };

    for (let x = 0; x < width; x++) {
        visit(x, 0);
        visit(x, height - 1);
    }
    for (let y = 0; y < height; y++) {
        visit(0, y);
        visit(width - 1, y);
    }

    while (head < tail) {
        const index = queue[head++];
        const x = index % width;
        const y = (index - x) / width;
        visit(x + 1, y);
        visit(x - 1, y);
        visit(x, y + 1);
        visit(x, y - 1);
    }

    return alpha;
}

/**
 * Separable box blur over the alpha mask, in place.
 *
 * Without it the cut-out edge is a hard staircase that reads as obviously faked;
 * a couple of pixels of ramp is the difference between "replaced background" and
 * "cut out with scissors".
 */
export function boxBlur(alpha: Uint8Array, width: number, height: number, radius: number): void {
    if (radius < 1) return;
    const clampTo = (value: number, high: number) => Math.max(0, Math.min(high, value));
    const temp = new Uint8Array(alpha.length);
    const span = radius * 2 + 1;

    for (let y = 0; y < height; y++) {
        let sum = 0;
        for (let x = -radius; x <= radius; x++) sum += alpha[y * width + clampTo(x, width - 1)];
        for (let x = 0; x < width; x++) {
            temp[y * width + x] = Math.round(sum / span);
            sum -= alpha[y * width + clampTo(x - radius, width - 1)];
            sum += alpha[y * width + clampTo(x + radius + 1, width - 1)];
        }
    }

    for (let x = 0; x < width; x++) {
        let sum = 0;
        for (let y = -radius; y <= radius; y++) sum += temp[clampTo(y, height - 1) * width + x];
        for (let y = 0; y < height; y++) {
            alpha[y * width + x] = Math.round(sum / span);
            sum -= temp[clampTo(y - radius, height - 1) * width + x];
            sum += temp[clampTo(y + radius + 1, height - 1) * width + x];
        }
    }
}

/** Lighten (positive) or darken (negative) a hex colour, for the gradient stop. */
export function shade(hex: string, amount: number): string {
    let value = (hex || '').replace('#', '');
    if (value.length === 3) value = value.split('').map(c => c + c).join('');
    const int = parseInt(value || 'F1F5F9', 16);
    const channels = [(int >> 16) & 255, (int >> 8) & 255, int & 255].map(channel => {
        const next = amount >= 0 ? channel + (255 - channel) * amount : channel * (1 + amount);
        return Math.max(0, Math.min(255, Math.round(next)));
    });
    return `#${channels.map(c => c.toString(16).padStart(2, '0')).join('')}`;
}
