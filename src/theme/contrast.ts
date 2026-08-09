/**
 * Colour maths for the theme system.
 *
 * This is a PLAIN module — no Vue, no Pinia, no DOM — the same precedent as
 * `photoMask.ts`, `drawEngine.ts`, `chatMedia.ts` and `appNav.ts`. It is what
 * `npm run check:theme` runs in node, and it is the reason requirement 2 —
 * "text is light on a dark object and dark on a light one, everywhere" — is a
 * property the build can prove rather than something somebody eyeballed once.
 *
 * Nothing here picks a colour by taste. Every text token in `themes.ts` is
 * DERIVED from the surface it sits on by `ensureContrast()`, so a new theme
 * cannot be added with unreadable text: the check fails first.
 *
 * The contrast maths is WCAG 2.1 (relative luminance with the sRGB transfer
 * curve, ratio = (L1 + 0.05) / (L2 + 0.05)). AA body text is 4.5, AA large
 * text and UI boundaries are 3.0, AAA is 7.0.
 */

export interface Rgb {
  r: number;
  g: number;
  b: number;
}

/** WCAG AA for normal body text. */
export const AA_TEXT = 4.5;
/** WCAG AA for large text, icons and meaningful UI boundaries. */
export const AA_LARGE = 3;
/** WCAG AAA — what the primary text token aims for before it settles for AA. */
export const AAA_TEXT = 7;

const CLAMP255 = (n: number) => Math.max(0, Math.min(255, Math.round(n)));

const NAMED: Record<string, string> = {
  white: '#ffffff',
  black: '#000000',
  transparent: 'rgba(0,0,0,0)',
};

/**
 * Parse `#abc`, `#aabbcc`, `#aabbccdd`, `rgb()`, `rgba()`, `hsl()`, `hsla()`
 * and the three named colours we actually use. Alpha is *composited onto
 * white* rather than kept, because every caller here is asking "what colour
 * does the eye see", and a half-transparent colour has no luminance of its
 * own. Use `over()` when the real backdrop is known.
 *
 * Returns null for anything unparseable (a gradient, `currentColor`, a
 * `var()` reference) so callers can skip rather than guess.
 */
export function parseColor(input: string): Rgb | null {
  if (!input) return null;
  const raw = String(input).trim().toLowerCase();
  const value = NAMED[raw] ?? raw;

  if (value.startsWith('#')) {
    const hex = value.slice(1);
    if (hex.length === 3 || hex.length === 4) {
      const r = parseInt(hex[0] + hex[0], 16);
      const g = parseInt(hex[1] + hex[1], 16);
      const b = parseInt(hex[2] + hex[2], 16);
      if ([r, g, b].some(Number.isNaN)) return null;
      const a = hex.length === 4 ? parseInt(hex[3] + hex[3], 16) / 255 : 1;
      return flatten({ r, g, b }, a);
    }
    if (hex.length === 6 || hex.length === 8) {
      const r = parseInt(hex.slice(0, 2), 16);
      const g = parseInt(hex.slice(2, 4), 16);
      const b = parseInt(hex.slice(4, 6), 16);
      if ([r, g, b].some(Number.isNaN)) return null;
      const a = hex.length === 8 ? parseInt(hex.slice(6, 8), 16) / 255 : 1;
      return flatten({ r, g, b }, a);
    }
    return null;
  }

  const fn = value.match(/^(rgba?|hsla?)\(([^)]+)\)$/);
  if (!fn) return null;

  // CSS Color 4 allows both `r, g, b, a` and `r g b / a`.
  const parts = fn[2]
    .replace(/\//g, ' ')
    .split(/[\s,]+/)
    .filter(Boolean);
  if (parts.length < 3) return null;

  const alpha = parts.length > 3 ? readAlpha(parts[3]) : 1;

  if (fn[1].startsWith('rgb')) {
    const nums = parts.slice(0, 3).map(p =>
      p.endsWith('%') ? (parseFloat(p) / 100) * 255 : parseFloat(p)
    );
    if (nums.some(Number.isNaN)) return null;
    return flatten({ r: nums[0], g: nums[1], b: nums[2] }, alpha);
  }

  const h = parseFloat(parts[0]);
  const s = parseFloat(parts[1]) / 100;
  const l = parseFloat(parts[2]) / 100;
  if ([h, s, l].some(Number.isNaN)) return null;
  return flatten(hslToRgb(h, s, l), alpha);
}

function readAlpha(token: string): number {
  const n = token.endsWith('%') ? parseFloat(token) / 100 : parseFloat(token);
  return Number.isNaN(n) ? 1 : Math.max(0, Math.min(1, n));
}

/** Composite a partly transparent colour onto white — the pessimistic default. */
function flatten(c: Rgb, a: number): Rgb {
  if (a >= 1) return { r: CLAMP255(c.r), g: CLAMP255(c.g), b: CLAMP255(c.b) };
  return {
    r: CLAMP255(c.r * a + 255 * (1 - a)),
    g: CLAMP255(c.g * a + 255 * (1 - a)),
    b: CLAMP255(c.b * a + 255 * (1 - a)),
  };
}

function hslToRgb(h: number, s: number, l: number): Rgb {
  const hue = ((h % 360) + 360) % 360;
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((hue / 60) % 2) - 1));
  const m = l - c / 2;
  let rgb: [number, number, number];
  if (hue < 60) rgb = [c, x, 0];
  else if (hue < 120) rgb = [x, c, 0];
  else if (hue < 180) rgb = [0, c, x];
  else if (hue < 240) rgb = [0, x, c];
  else if (hue < 300) rgb = [x, 0, c];
  else rgb = [c, 0, x];
  return {
    r: CLAMP255((rgb[0] + m) * 255),
    g: CLAMP255((rgb[1] + m) * 255),
    b: CLAMP255((rgb[2] + m) * 255),
  };
}

export function toHex(c: Rgb): string {
  const hex = (n: number) => CLAMP255(n).toString(16).padStart(2, '0');
  return `#${hex(c.r)}${hex(c.g)}${hex(c.b)}`;
}

/**
 * `"102 126 234"` — the space-separated channel triple that lets one token
 * serve every alpha in the stylesheets: `rgb(var(--sfs-accent-rgb) / 0.18)`.
 *
 * This is why the codemod could tokenise ~1500 `rgba()` literals without
 * inventing a token per opacity.
 */
export function channels(color: string): string {
  const c = parseColor(color);
  if (!c) return '0 0 0';
  return `${CLAMP255(c.r)} ${CLAMP255(c.g)} ${CLAMP255(c.b)}`;
}

/** WCAG relative luminance, 0 (black) → 1 (white). */
export function relativeLuminance(color: string | Rgb): number {
  const c = typeof color === 'string' ? parseColor(color) : color;
  if (!c) return 0;
  const channel = (v: number) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * channel(c.r) + 0.7152 * channel(c.g) + 0.0722 * channel(c.b);
}

/** WCAG contrast ratio between two colours — 1 (identical) → 21 (black/white). */
export function contrastRatio(a: string | Rgb, b: string | Rgb): number {
  const la = relativeLuminance(a);
  const lb = relativeLuminance(b);
  const light = Math.max(la, lb);
  const dark = Math.min(la, lb);
  return (light + 0.05) / (dark + 0.05);
}

/**
 * Is this colour dark enough that light text belongs on it?
 *
 * The threshold is where black and white text draw level (luminance ≈ 0.179),
 * not the naive 0.5 — at 0.5 a mid-blue gets black text at a ratio of 2.9,
 * which is unreadable and looks like a bug rather than a choice.
 */
export function isDark(color: string | Rgb): boolean {
  return relativeLuminance(color) < 0.179;
}

/** Composite `fg` at `a` opacity over `bg` — what the eye actually receives. */
export function over(fg: string, a: number, bg: string): string {
  const f = parseColor(fg);
  const b = parseColor(bg);
  if (!f || !b) return toHex(f ?? b ?? { r: 0, g: 0, b: 0 });
  return toHex({
    r: f.r * a + b.r * (1 - a),
    g: f.g * a + b.g * (1 - a),
    b: f.b * a + b.b * (1 - a),
  });
}

/** Linear blend, `t` = 0 → a, 1 → b. */
export function mix(a: string, b: string, t: number): string {
  const ca = parseColor(a);
  const cb = parseColor(b);
  if (!ca || !cb) return a;
  const k = Math.max(0, Math.min(1, t));
  return toHex({
    r: ca.r + (cb.r - ca.r) * k,
    g: ca.g + (cb.g - ca.g) * k,
    b: ca.b + (cb.b - ca.b) * k,
  });
}

export const lighten = (color: string, amount: number) => mix(color, '#ffffff', amount);
export const darken = (color: string, amount: number) => mix(color, '#000000', amount);

/** `rgb(r g b / a)` — the modern spelling, which every target browser parses. */
export function alpha(color: string, a: number): string {
  const c = parseColor(color);
  if (!c) return color;
  return `rgb(${CLAMP255(c.r)} ${CLAMP255(c.g)} ${CLAMP255(c.b)} / ${Math.max(0, Math.min(1, a))})`;
}

/**
 * The ink that reads best on `bg` — requirement 2 in one function.
 *
 * Both candidates are compared rather than the luminance being thresholded,
 * because the two answers disagree near the boundary and the ratio is the
 * thing that actually matters.
 */
export function bestTextOn(
  bg: string,
  light = '#ffffff',
  dark = '#10131c'
): string {
  const onLight = contrastRatio(light, bg);
  const onDark = contrastRatio(dark, bg);
  return onLight >= onDark ? light : dark;
}

/**
 * Return `fg` if it already clears `target` against `bg`, otherwise the
 * nearest shade of it that does.
 *
 * It walks `fg` toward whichever of white/black is *further* from `bg`, one
 * percent at a time, and hands back the first step that clears the bar — so a
 * theme's accent keeps its hue and only gives up as much saturation as the
 * contrast actually costs. If even the endpoint cannot clear it (a target
 * above 21 is the only way), the endpoint comes back, which is the best that
 * exists.
 *
 * Every derived text token in `themes.ts` goes through this, which is what
 * makes the contrast guarantee structural rather than editorial.
 */
export function ensureContrast(fg: string, bg: string, target = AA_TEXT): string {
  if (contrastRatio(fg, bg) >= target) return fg;
  const goal = isDark(bg) ? '#ffffff' : '#000000';
  let best = fg;
  let bestRatio = contrastRatio(fg, bg);
  for (let step = 1; step <= 100; step++) {
    const candidate = mix(fg, goal, step / 100);
    const ratio = contrastRatio(candidate, bg);
    if (ratio > bestRatio) {
      best = candidate;
      bestRatio = ratio;
    }
    if (ratio >= target) return candidate;
  }
  return best;
}

/**
 * Inline style for an element whose background is decided at runtime rather
 * than in a stylesheet — an avatar tinted from a username, a VLAN swatch, a
 * CV accent the user picked, a role badge.
 *
 * Those are exactly the places a token cannot reach, and they are where the
 * old code hardcoded white text and produced white-on-yellow. Bind the pair
 * instead of the background alone:
 *
 *   :style="paint(getUserColor(username))"
 */
export function paint(background: string, opts: { light?: string; dark?: string } = {}) {
  return {
    background,
    color: bestTextOn(background, opts.light ?? '#ffffff', opts.dark ?? '#10131c'),
  };
}

/** `paint()` for a border-and-text treatment over an unknown page surface. */
export function paintOutline(tint: string, surface: string) {
  const ink = ensureContrast(tint, surface, AA_LARGE);
  return { color: ink, borderColor: alpha(tint, 0.55) };
}
