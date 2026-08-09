/**
 * Find text that points the wrong way for the mode.
 *
 *   npm run audit:ink                 # summary
 *   npm run audit:ink -- --theme=cartwheel --list
 *
 * WHY THIS EXISTS ON TOP OF audit-contrast
 * ----------------------------------------
 * `audit-contrast` can only judge a rule that declares BOTH a background and a
 * colour, because it has to know what the text sits on. That is a minority of
 * rules. The overwhelming majority set `color` alone and inherit their
 * background from an ancestor — and those were never checked at all, which is
 * why "white text on a light theme" survived an audit reporting 94% clear.
 *
 * This asks a cruder question that needs no background: **does the ink point
 * the right way for the mode?** In a light galaxy, near-white text is wrong
 * unless the element is sitting on a fill. In a dark galaxy, near-black text is
 * wrong for the same reason. It cannot prove a rule is right, but every hit is
 * either a real bug or a rule that is genuinely on a fill — and the second kind
 * is rare enough to check by hand.
 *
 * The `fill` column is the tell: `-` means nothing in that selector's own rules
 * declares a coloured background, so there is nothing for the ink to be on.
 */

import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const ROOT = process.cwd();
const ARGS = process.argv.slice(2);
const ONLY = (ARGS.find(a => a.startsWith('--theme=')) || '').split('=')[1] || null;
const LIST = ARGS.includes('--list');
const LIMIT = Number((ARGS.find(a => a.startsWith('--limit=')) || '').split('=')[1] || 40);

const { THEMES } = await import('./dist/check-themes.mjs');

/* ------------------------------------------------------------------ maths */

function parse(input) {
  if (!input) return null;
  const v = String(input).trim().toLowerCase();
  if (v === 'white') return { r: 255, g: 255, b: 255, a: 1 };
  if (v === 'black') return { r: 0, g: 0, b: 0, a: 1 };
  if (v === 'transparent') return { r: 0, g: 0, b: 0, a: 0 };
  if (v.startsWith('#')) {
    let h = v.slice(1);
    if (h.length === 3) h = h.split('').map(c => c + c).join('');
    if (h.length !== 6 && h.length !== 8) return null;
    const n = parseInt(h.slice(0, 6), 16);
    if (Number.isNaN(n)) return null;
    return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255, a: 1 };
  }
  const m = v.match(/^(rgba?|hsla?)\(([^()]*)\)$/);
  if (!m) return null;
  const p = m[2].replace(/\//g, ' ').split(/[\s,]+/).filter(Boolean);
  if (p.length < 3) return null;
  const a = p.length > 3 ? parseFloat(p[3]) : 1;
  if (!m[1].startsWith('rgb')) return null;
  const [r, g, b] = p.slice(0, 3).map(Number);
  if ([r, g, b].some(Number.isNaN)) return null;
  return { r, g, b, a: Number.isNaN(a) ? 1 : a };
}

function lum(c) {
  const f = v => { const s = v / 255; return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4); };
  return 0.2126 * f(c.r) + 0.7152 * f(c.g) + 0.0722 * f(c.b);
}

const hex = c => '#' + [c.r, c.g, c.b].map(n =>
  Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, '0')).join('');

/* ------------------------------------------------------------- resolution */

function resolve(value, vars, locals, depth = 0) {
  if (!value || depth > 5) return value;
  let out = value.replace(
    /rgb\(\s*var\(\s*(--[a-z0-9-]+)\s*(?:,\s*([^)]*?))?\s*\)\s*\/\s*([\d.]+)\s*\)/gi,
    (all, name, fallback, alpha) => {
      const triple = vars[name] ?? locals.get(name) ?? fallback;
      if (!triple) return all;
      const n = String(triple).trim().split(/[\s,]+/).slice(0, 3);
      return n.length < 3 ? all : `rgba(${n[0]}, ${n[1]}, ${n[2]}, ${alpha})`;
    }
  ).replace(
    /var\(\s*(--[a-z0-9-]+)\s*(?:,\s*([^()]*(?:\([^()]*\)[^()]*)*))?\)/gi,
    (all, name, fallback) => vars[name] ?? locals.get(name) ?? fallback ?? all
  );
  return out.includes('var(') && out !== value ? resolve(out, vars, locals, depth + 1) : out;
}

function firstColour(value) {
  if (!value) return null;
  const v = value.trim();
  if (/^(inherit|initial|unset|currentcolor|transparent|none)$/i.test(v)) return null;
  if (/url\(/i.test(v)) return null;
  const m = v.match(/#[0-9a-f]{3,8}\b|\b(?:rgba?|hsla?)\([^()]*\)|\b(?:white|black)\b/i);
  return m ? parse(m[0]) : null;
}

/* ----------------------------------------------------------------- reading */

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

function stripAlternateMedia(text) {
  let out = '', i = 0;
  const at = /@media[^{]*\b(print|forced-colors|prefers-contrast)\b[^{]*\{/gi;
  let m;
  while ((m = at.exec(text)) !== null) {
    out += text.slice(i, m.index);
    let depth = 1, j = m.index + m[0].length;
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

/** Every rule that sets a colour, plus whether that selector is ever filled. */
function readInk() {
  const rules = [];
  for (const file of walk(join(ROOT, 'src'))) {
    let text = readFileSync(file, 'utf8');
    if (file.endsWith('.vue')) {
      text = [...text.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/g)].map(m => m[1]).join('\n');
    }
    text = stripAlternateMedia(text.replace(/\/\*[\s\S]*?\*\//g, ''));

    const locals = new Map();
    for (const m of text.matchAll(/(--[a-z0-9-]+)\s*:([^;{}]*)[;}]/gi)) locals.set(m[1], m[2].trim());

    /*
      Which selectors are painted a real FILL — a brand or status colour that
      the ink is allowed to point away from the page for.

      A translucent tint does not count, and getting that wrong is what made
      the first run of this audit report six light-theme problems instead of
      the real number: `background: rgb(var(--sfs-tint-rgb) / 0.08)` is a card,
      it is the page colour with a lift, and white text on it is just as
      invisible as white text on the page.
    */
    const filled = new Set();

    /* A BEM modifier's fill belongs to its base too: `.enroll-btn` carries the
       ink while `.enroll-btn--enroll` carries the background. */
    const markFilled = selRaw => {
      for (const part of selRaw.split('\n').pop().split(',').map(x => x.trim()).filter(Boolean)) {
        const norm = part.replace(/\s+/g, ' ');
        filled.add(norm);
        const bem = norm.replace(/--[a-z0-9-]+$/i, '');
        if (bem && bem !== norm) filled.add(bem);
      }
    };

    for (const m of text.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
      const body = m[2];
      const bg = /(^|[;\s])(background|background-color|background-image)\s*:\s*([^;]+)/.exec(body);
      if (!bg) continue;
      const value = bg[3];
      if (/^\s*(none|transparent|inherit|initial|unset)\s*$/i.test(value)) continue;

      /* Paper and the status washes are light islands: dark ink is correct on
         them in EVERY galaxy, so a rule over one of those is not the mode's
         business either. */
      if (/--sfs-(paper|[a-z0-9-]*-wash)\b/.test(value)) { markFilled(m[1]); continue; }

      const isTint = /--sfs-(tint|shade|surface|space|line)\b/.test(value);
      /* A page-local token named after a brand or a status is a fill — this app
         is full of `--tm-success-2` and `--np-brand-grad`. */
      const isBrand = /--sfs-(accent|success|warning|danger|info)\b/.test(value)
        || /--[a-z0-9-]*(brand|grad|accent|primary|success|warning|danger|error|info)[a-z0-9-]*\)/i.test(value);
      if (isTint && !isBrand) continue;
      if (!isBrand && !/#[0-9a-f]{3,8}|rgba?\(|linear-gradient/i.test(value)) continue;
      markFilled(m[1]);
    }

    /*
      One entry per selector, holding the LAST `color` declared for it.

      Pushing one entry per block instead reported a component's shared base
      ink even where a later rule for that exact selector replaced it — which
      is not a finding, it is the cascade. Four glass buttons stayed on the
      list after they had already been fixed, purely because of this.
    */
    const bySelector = new Map();
    for (const m of text.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
      const selRaw = m[1].split('\n').pop().trim();
      if (!selRaw || selRaw.startsWith('@') || /^\d+%$|^(from|to)$/.test(selRaw)) continue;
      /* A clip-text block's `color` is a fallback, not the rendered ink. */
      if (/background-clip\s*:\s*text/i.test(m[2])) continue;
      const decl = [...m[2].matchAll(/(^|[;\s])color\s*:\s*([^;]+)/g)].pop();
      if (!decl) continue;
      const value = decl[2].replace(/!important/i, '').trim();
      for (const part of selRaw.split(',').map(x => x.replace(/\s+/g, ' ').trim()).filter(Boolean)) {
        /* Does this selector, or any ancestor written in the same selector,
           declare a background? A descendant of a filled thing is on a fill. */
        const words = part.split(' ');
        const onFill = words.some((_, i) => filled.has(words.slice(0, i + 1).join(' ')));
        bySelector.set(part, { file, selector: part, value, locals, onFill });
      }
    }
    for (const entry of bySelector.values()) rules.push(entry);
  }
  return rules;
}

/* ------------------------------------------------------------------- audit */

const rules = readInk();
const themes = ONLY ? THEMES.filter(t => t.id === ONLY) : THEMES;

console.log(`\nChecking the direction of ${rules.length} colour declarations\n`);

let total = 0;
for (const theme of themes) {
  const wantLightInk = theme.mode === 'dark';
  const bad = [];

  for (const rule of rules) {
    const c = firstColour(resolve(rule.value, theme.vars, rule.locals));
    if (!c || c.a < 0.25) continue;
    const l = lum(c);
    /* Only flag the unambiguous end of each range. A mid-tone is a judgement
       call and would drown the real hits. */
    const inkIsLight = l > 0.5;
    const inkIsDark = l < 0.12;
    const wrong = wantLightInk ? inkIsDark : inkIsLight;
    if (!wrong) continue;
    /* Text on a fill legitimately points the other way. */
    if (rule.onFill) continue;
    /* A rule scoped to the other mode is not this theme's business. */
    const scoped = /\[data-mode=['"]?(dark|light)['"]?\]/.exec(rule.selector);
    if (scoped && scoped[1] !== theme.mode) continue;
    bad.push({ rule, hex: hex(c), l });
  }

  total += bad.length;
  bad.sort((a, b) => (wantLightInk ? a.l - b.l : b.l - a.l));
  console.log(`  ${theme.id.padEnd(11)} ${theme.mode.padEnd(6)} ${String(bad.length).padStart(4)} ` +
              `rules with ${wantLightInk ? 'DARK' : 'LIGHT'} ink and no fill under them`);
  if (LIST) {
    for (const b of bad.slice(0, LIMIT)) {
      console.log(`      ${b.hex}  ${relative(ROOT, b.rule.file)}  ${b.rule.selector.slice(0, 44)}`);
      console.log(`               ${b.rule.value.slice(0, 92)}`);
    }
    if (bad.length > LIMIT) console.log(`      … and ${bad.length - LIMIT} more`);
  }
}

console.log('');
process.exit(0);
