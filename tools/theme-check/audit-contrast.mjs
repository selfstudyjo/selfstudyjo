/**
 * Resolve the REAL stylesheets against each galaxy's tokens and measure what a
 * reader would actually see.
 *
 *   node tools/theme-check/audit-contrast.mjs            # summary per theme
 *   node tools/theme-check/audit-contrast.mjs --theme=cartwheel --list
 *
 * WHY THIS AND NOT `check:theme`
 * ------------------------------
 * `check:theme` proves the PALETTE is coherent: every token is readable
 * against the surface it was derived for. That is necessary and it is not
 * sufficient, because it says nothing about how the 46 page stylesheets
 * actually SPEND those tokens. A rule can pair a token that flips with one
 * that does not, and the palette is still perfect while the page is blank.
 *
 * So this walks every rule that sets both a background and a colour, resolves
 * both against a given theme's token values, composites any transparency down
 * onto the page, and computes the contrast a person would read. It is the
 * difference between "the palette is fine" and "the app is legible".
 *
 * It is a static approximation — it cannot see the cascade, inheritance, or a
 * colour that arrives from a parent — so it reports rather than gates, and it
 * is deliberately not wired into `npm run check`. What it is good at is
 * finding the systematic failure: one token used the wrong way in 200 places.
 */

import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const ROOT = process.cwd();
const ARGS = process.argv.slice(2);
const ONLY = (ARGS.find(a => a.startsWith('--theme=')) || '').split('=')[1] || null;
const LIST = ARGS.includes('--list');
const LIMIT = Number((ARGS.find(a => a.startsWith('--limit=')) || '').split('=')[1] || 25);

/* -------------------------------------------------------------------------- *
 * Colour maths (standalone — this runs in bare node)
 * -------------------------------------------------------------------------- */

function parse(input) {
  if (!input) return null;
  const v = String(input).trim().toLowerCase();
  if (v === 'transparent') return { r: 0, g: 0, b: 0, a: 0 };
  if (v === 'white') return { r: 255, g: 255, b: 255, a: 1 };
  if (v === 'black') return { r: 0, g: 0, b: 0, a: 1 };
  if (v.startsWith('#')) {
    let h = v.slice(1);
    if (h.length === 3) h = h.split('').map(c => c + c).join('');
    if (h.length === 4) h = h.slice(0, 3).split('').map(c => c + c).join('');
    if (h.length !== 6 && h.length !== 8) return null;
    const n = parseInt(h.slice(0, 6), 16);
    if (Number.isNaN(n)) return null;
    const a = h.length === 8 ? parseInt(h.slice(6, 8), 16) / 255 : 1;
    return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255, a };
  }
  const m = v.match(/^(rgba?|hsla?)\(([^()]*)\)$/);
  if (!m) return null;
  const p = m[2].replace(/\//g, ' ').split(/[\s,]+/).filter(Boolean);
  if (p.length < 3) return null;
  const a = p.length > 3 ? (p[3].endsWith('%') ? parseFloat(p[3]) / 100 : parseFloat(p[3])) : 1;
  if (m[1].startsWith('rgb')) {
    const [r, g, b] = p.slice(0, 3).map(x => x.endsWith('%') ? parseFloat(x) / 100 * 255 : parseFloat(x));
    if ([r, g, b].some(Number.isNaN)) return null;
    return { r, g, b, a: Number.isNaN(a) ? 1 : a };
  }
  const h = parseFloat(p[0]), s = parseFloat(p[1]) / 100, l = parseFloat(p[2]) / 100;
  if ([h, s, l].some(Number.isNaN)) return null;
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const hue = ((h % 360) + 360) % 360;
  const x = c * (1 - Math.abs((hue / 60) % 2 - 1));
  const mm = l - c / 2;
  let t;
  if (hue < 60) t = [c, x, 0]; else if (hue < 120) t = [x, c, 0];
  else if (hue < 180) t = [0, c, x]; else if (hue < 240) t = [0, x, c];
  else if (hue < 300) t = [x, 0, c]; else t = [c, 0, x];
  return { r: (t[0] + mm) * 255, g: (t[1] + mm) * 255, b: (t[2] + mm) * 255, a: Number.isNaN(a) ? 1 : a };
}

const over = (fg, bg) => ({
  r: fg.r * fg.a + bg.r * (1 - fg.a),
  g: fg.g * fg.a + bg.g * (1 - fg.a),
  b: fg.b * fg.a + bg.b * (1 - fg.a),
  a: 1,
});

function lum(c) {
  const f = v => { const s = v / 255; return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4); };
  return 0.2126 * f(c.r) + 0.7152 * f(c.g) + 0.0722 * f(c.b);
}

const ratio = (a, b) => {
  const la = lum(a), lb = lum(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
};

const hex = c => '#' + [c.r, c.g, c.b].map(n =>
  Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, '0')).join('');

/* -------------------------------------------------------------------------- *
 * Themes — read from the built check bundle so there is one source of truth
 * -------------------------------------------------------------------------- */

const { THEMES } = await import('./dist/check-themes.mjs');

/* -------------------------------------------------------------------------- *
 * Resolving a declaration value against a theme
 * -------------------------------------------------------------------------- */

/** `rgb(var(--sfs-x-rgb, 1 2 3) / .5)` and `var(--sfs-x, #fff)`, plus locals. */
function resolve(value, vars, locals, depth = 0) {
  if (!value || depth > 4) return value;
  let out = value;

  out = out.replace(
    /rgb\(\s*var\(\s*(--[a-z0-9-]+)\s*(?:,\s*([^)]*?))?\s*\)\s*\/\s*([\d.]+)\s*\)/gi,
    (all, name, fallback, alpha) => {
      const triple = vars[name] ?? locals.get(name) ?? fallback;
      if (!triple) return all;
      const nums = String(triple).trim().split(/[\s,]+/).slice(0, 3);
      if (nums.length < 3) return all;
      return `rgba(${nums[0]}, ${nums[1]}, ${nums[2]}, ${alpha})`;
    }
  );

  out = out.replace(
    /var\(\s*(--[a-z0-9-]+)\s*(?:,\s*([^()]*(?:\([^()]*\)[^()]*)*))?\)/gi,
    (all, name, fallback) => vars[name] ?? locals.get(name) ?? fallback ?? all
  );

  return out.includes('var(') && out !== value ? resolve(out, vars, locals, depth + 1) : out;
}

/** The first solid colour in a value — a gradient's first stop counts. */
function colourOf(value) {
  if (!value) return null;
  const v = value.trim();
  if (/^(none|inherit|initial|unset|currentcolor|transparent)$/i.test(v)) return null;
  if (/url\(/i.test(v)) return null;
  const m = v.match(/#[0-9a-f]{3,8}\b|\b(?:rgba?|hsla?)\([^()]*\)|\b(white|black)\b/i);
  return m ? parse(m[0]) : null;
}

/* -------------------------------------------------------------------------- *
 * Reading the stylesheets
 * -------------------------------------------------------------------------- */

function walk(dir, out = []) {
  for (const n of readdirSync(dir)) {
    const p = join(dir, n);
    if (statSync(p).isDirectory()) {
      if (['node_modules', 'dist', '.git'].includes(n)) continue;
      walk(p, out);
    } else if (n.endsWith('.css') || n.endsWith('.vue')) out.push(p);
  }
  return out;
}

/**
 * Remove `@media print`, `forced-colors` and `prefers-contrast` blocks whole.
 *
 * They set colours for a different medium — a printed page is white — and
 * merging them into the screen picture makes a glass card look like a white
 * one. `.runbook-card` reported light text on white paper for exactly this
 * reason, and the stylesheet was right.
 */
function stripAlternateMedia(text) {
  let out = '';
  let i = 0;
  const at = /@media[^{]*\b(print|forced-colors|prefers-contrast)\b[^{]*\{/gi;
  let m;
  while ((m = at.exec(text)) !== null) {
    out += text.slice(i, m.index);
    // Walk to the matching close brace.
    let depth = 1;
    let j = m.index + m[0].length;
    while (j < text.length && depth > 0) {
      if (text[j] === '{') depth++;
      else if (text[j] === '}') depth--;
      j++;
    }
    i = j;
    at.lastIndex = j;
  }
  return out + text.slice(i);
}

/** Every rule, with its declarations, merged by selector across the file. */
function readRules() {
  const rules = [];
  for (const file of walk(join(ROOT, 'src'))) {
    let text = readFileSync(file, 'utf8');
    if (file.endsWith('.vue')) {
      text = [...text.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/g)].map(m => m[1]).join('\n');
    }
    text = stripAlternateMedia(text.replace(/\/\*[\s\S]*?\*\//g, ''));
    const locals = new Map();
    for (const m of text.matchAll(/(--[a-z0-9-]+)\s*:([^;{}]*)[;}]/gi)) locals.set(m[1], m[2].trim());

    const bySelector = new Map();
    for (const m of text.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
      const selector = m[1].split('\n').pop().trim();
      if (!selector || selector.startsWith('@') || /^\d+%$|^(from|to)$/.test(selector)) continue;
      /*
        `background-clip: text` means the background IS the text, poured
        through the glyphs, with `color` reduced to a fallback for browsers
        that cannot do it. Comparing the two is comparing the text with
        itself — every gradient heading on the platform reported 1.00:1 and
        buried the real findings underneath.
      */
      if (/background-clip\s*:\s*text/i.test(m[2])) continue;

      for (const part of selector.split(',').map(s => s.replace(/\s+/g, ' ').trim()).filter(Boolean)) {
        const entry = bySelector.get(part) ?? { file, selector: part, locals, bg: null, fg: null };
        for (const d of m[2].matchAll(/(^|[;\s])(background|background-color|color)\s*:\s*([^;]+)/g)) {
          const prop = d[2].toLowerCase();
          const val = d[3].replace(/!important/i, '').trim();
          /* Last wins, which is the cascade for equal specificity. Taking the
             first instead reported a component's shared base ink even where a
             later rule for that exact selector overrode it — several of the
             "white text on a pale button" findings were the audit reading the
             wrong declaration, not the stylesheet being wrong. */
          if (prop === 'color') entry.fg = val;
          else entry.bg = val;
        }
        bySelector.set(part, entry);
      }
    }
    for (const entry of bySelector.values()) if (entry.bg && entry.fg) rules.push(entry);
  }
  return rules;
}

/* -------------------------------------------------------------------------- *
 * Audit
 * -------------------------------------------------------------------------- */

/**
 * Rules this static pass cannot judge, with the reason.
 *
 * The audit composites a background over the PAGE, because that is the only
 * backdrop it can know statically. A rule that by construction only ever
 * renders on top of something else is therefore measured against the wrong
 * thing. Keeping the list explicit and short is the point — anything added
 * here needs a reason that is about the audit's blind spot, never about a
 * finding being inconvenient.
 */
const KNOWN_BLIND_SPOTS = [
  {
    match: /\.on-fill\b/,
    why: 'only rendered inside a filled bubble, never over the page',
  },
];

const rules = readRules().filter(r => !KNOWN_BLIND_SPOTS.some(b => b.match.test(r.selector)));
const themes = ONLY ? THEMES.filter(t => t.id === ONLY) : THEMES;
let worstOverall = 0;

console.log(`\nResolving ${rules.length} background+colour rules against ${themes.length} galax${themes.length === 1 ? 'y' : 'ies'}\n`);

for (const theme of themes) {
  const page = parse(theme.vars['--sfs-space']);
  const fails = [];

  for (const rule of rules) {
    const bgRaw = resolve(rule.bg, theme.vars, rule.locals);
    const fgRaw = resolve(rule.fg, theme.vars, rule.locals);
    const bg = colourOf(bgRaw);
    const fg = colourOf(fgRaw);
    if (!bg || !fg) continue;
    if (bg.a < 0.02) continue;                     // effectively no background of its own

    const solidBg = over(bg, page);
    const solidFg = over(fg, solidBg);
    const r = ratio(solidFg, solidBg);
    if (r < 4.5) {
      fails.push({ r, rule, bg: hex(solidBg), fg: hex(solidFg) });
    }
  }

  fails.sort((a, b) => a.r - b.r);
  const pct = ((1 - fails.length / rules.length) * 100).toFixed(1);
  worstOverall = Math.max(worstOverall, fails.length);
  console.log(`  ${theme.id.padEnd(11)} ${theme.mode.padEnd(6)} ` +
              `${String(fails.length).padStart(4)} below 4.5:1   (${pct}% clear)` +
              (fails.length ? `   worst ${fails[0].r.toFixed(2)}:1` : ''));

  if (LIST) {
    for (const f of fails.slice(0, LIMIT)) {
      console.log(`      ${f.r.toFixed(2)}:1  ${f.fg} on ${f.bg}  ${relative(ROOT, f.rule.file)}  ${f.rule.selector.slice(0, 46)}`);
      console.log(`             bg: ${f.rule.bg.slice(0, 96)}`);
      console.log(`             fg: ${f.rule.fg.slice(0, 96)}`);
    }
    if (fails.length > LIMIT) console.log(`      … and ${fails.length - LIMIT} more`);
  }
}

console.log('');
