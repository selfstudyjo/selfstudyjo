/**
 * One-shot-but-idempotent codemod: hardcoded colour literals → theme tokens.
 *
 *   node tools/tokenize-colors/tokenize.mjs           # report only
 *   node tools/tokenize-colors/tokenize.mjs --write   # rewrite in place
 *
 * WHY THIS EXISTS
 * ---------------
 * The frontend carried ~34k lines of CSS across 46 stylesheets plus 76 scoped
 * `<style>` blocks, every colour written as a literal. Ten themes cannot be
 * bolted onto that by hand, and a hand pass over that much CSS is where the
 * one missed `#667eea` lives that stays indigo in the Sombrero galaxy.
 *
 * WHY IT CLASSIFIES INSTEAD OF MATCHING A LIST
 * --------------------------------------------
 * A hex list only converts the colours somebody remembered to list. This reads
 * each literal's hue, saturation and luminance and decides which family it
 * belongs to, so a `#5b6fe8` nobody ever wrote down converts too. The lists
 * that remain (OVERRIDES) are only for the handful the maths gets wrong.
 *
 * THE THREE PROPERTIES THAT KEEP IT SAFE
 * --------------------------------------
 * 1. **Every replacement keeps the original literal as the var() fallback.**
 *    `#667eea` becomes `var(--sfs-accent, #667eea)`. A token that fails to
 *    load renders the app exactly as it renders today, and the first paint
 *    before the theme is applied is never colourless.
 *
 * 2. **It is property-aware, because a colour's meaning is its property.**
 *    `#818cf8` is brand ink under `color` and a brand surface under
 *    `background`. Mapping both to one token is how a themed app ends up with
 *    a button the same colour as its label.
 *
 * 3. **It is block-aware, because a light island must stay a light island.**
 *    A certificate is a white page in all ten galaxies, and so is anything
 *    printed. A block whose own background is an opaque light colour is
 *    classified `island` and gets the `--sfs-paper` / `--sfs-on-paper` pair,
 *    which is light-with-dark-ink in every theme. Without that distinction,
 *    "make the background follow the theme" turns a certificate black.
 *
 * IDEMPOTENT: a literal already sitting inside a `var(…)` fallback is skipped,
 * so re-running never produces `var(--x, var(--x, #fff))`.
 *
 * RE-RUNNABLE: `--remap` first UNCONVERTS every token back to the literal it
 * was carrying and then converts again. That is what makes the classifier
 * tunable after the fact — without it, the first run's decisions are frozen,
 * because every literal is now inside a var() fallback and therefore skipped.
 * The round trip is lossless precisely because the original literal was kept
 * as the fallback, which is the third reason for that rule.
 */

import { readFileSync, writeFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const ROOT = process.cwd();
const WRITE = process.argv.includes('--write');
const REMAP = process.argv.includes('--remap');

/*
  Files that were written against the token system by hand rather than
  converted into it.

  The first two DEFINE the tokens and must not be rewritten in terms of them.
  ThemePicker was authored with the semantic token that fits each job — an
  overlay uses `--sfs-overlay`, a border uses `--sfs-border` — and a `--remap`
  round trip re-derives those from the fallback literal, which is a reasonable
  guess and a worse answer than the one already there.
*/
const SKIP_FILES = new Set([
  'theme.css', 'responsive.css', 'ThemePicker.vue',
  /*
    Hand-corrected, and a `--remap` would undo it.

    The Draw app and the Roblox tool were written against a light page they
    never got — their headings are `#0f172a` on a background that is the 3D
    galaxy, so they were invisible in every dark theme. The codemod cannot see
    that: its rule is "dark ink with no light background IN THIS BLOCK is
    probably inside a light card, leave it", which is right almost everywhere
    and wrong here, and it has no way to know there is no card. Those rules
    were pointed at `--sfs-text` by hand; skipping the files keeps them that
    way. `audit:ink` is what proves they are still correct.
  */
  'DrawPapers.vue', 'DrawShared.vue', 'DrawBoard.vue', 'roblox-tool.css',
]);

/* -------------------------------------------------------------------------- *
 * Colour maths (a copy — this script runs in bare node before any build)
 * -------------------------------------------------------------------------- */

function parseHex(hex) {
  let h = hex.slice(1);
  if (h.length === 3) h = h.split('').map(c => c + c).join('');
  if (h.length === 4) h = h.slice(0, 3).split('').map(c => c + c).join('');
  if (h.length === 8) h = h.slice(0, 6);
  if (h.length !== 6) return null;
  const n = parseInt(h, 16);
  if (Number.isNaN(n)) return null;
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255, a: 1 };
}

function parseFunc(text) {
  const m = text.match(/^(rgba?|hsla?)\(([^()]*)\)$/i);
  if (!m) return null;
  const parts = m[2].replace(/\//g, ' ').split(/[\s,]+/).filter(Boolean);
  if (parts.length < 3) return null;
  const alpha = parts.length > 3
    ? (parts[3].endsWith('%') ? parseFloat(parts[3]) / 100 : parseFloat(parts[3]))
    : 1;
  if (m[1].toLowerCase().startsWith('rgb')) {
    const [r, g, b] = parts.slice(0, 3).map(p =>
      p.endsWith('%') ? (parseFloat(p) / 100) * 255 : parseFloat(p));
    if ([r, g, b].some(Number.isNaN)) return null;
    return { r, g, b, a: Number.isNaN(alpha) ? 1 : alpha };
  }
  const h = parseFloat(parts[0]);
  const s = parseFloat(parts[1]) / 100;
  const l = parseFloat(parts[2]) / 100;
  if ([h, s, l].some(Number.isNaN)) return null;
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs((((h % 360) + 360) % 360 / 60) % 2 - 1));
  const mm = l - c / 2;
  const hue = ((h % 360) + 360) % 360;
  let t;
  if (hue < 60) t = [c, x, 0];
  else if (hue < 120) t = [x, c, 0];
  else if (hue < 180) t = [0, c, x];
  else if (hue < 240) t = [0, x, c];
  else if (hue < 300) t = [x, 0, c];
  else t = [0 + x, 0, c].slice(), t = [c, 0, x];
  return {
    r: (t[0] + mm) * 255, g: (t[1] + mm) * 255, b: (t[2] + mm) * 255,
    a: Number.isNaN(alpha) ? 1 : alpha,
  };
}

function luminance({ r, g, b }) {
  const f = v => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
}

/** Perceptual-ish lightness, used for the tone bands. HSL's L, not luminance. */
function hsl({ r, g, b }) {
  const R = r / 255, G = g / 255, B = b / 255;
  const max = Math.max(R, G, B), min = Math.min(R, G, B);
  const l = (max + min) / 2;
  const d = max - min;
  if (d === 0) return { h: 0, s: 0, l };
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h;
  if (max === R) h = ((G - B) / d + (G < B ? 6 : 0)) * 60;
  else if (max === G) h = ((B - R) / d + 2) * 60;
  else h = ((R - G) / d + 4) * 60;
  return { h, s, l };
}

const channels = c => `${Math.round(c.r)} ${Math.round(c.g)} ${Math.round(c.b)}`;

/* -------------------------------------------------------------------------- *
 * Family classification
 *
 * Hue bands, not a hex list. The one judgement call is the 205°–265° band:
 * this app's brand IS blue-indigo, so a blue there is the accent rather than
 * an informational blue, and only 185°–205° (sky/cyan) reads as "info".
 * -------------------------------------------------------------------------- */
function classify(c) {
  const { h, s, l } = hsl(c);

  /*
    Chroma, not HSL saturation, decides whether a colour has a hue worth
    keeping.

    HSL saturation is meaningless near white: `#f1f5f9` — slate-50, which this
    app uses as a plain light card — reports s = 0.39 because its channels
    differ by 8 out of 255. Classified on that it became "an accent", and the
    codemod turned a near-white card into a solid indigo one. Every pale
    tailwind-50 colour in the app had the same problem, and in a light galaxy
    the result was a saturated block with same-coloured text on it: the
    "text not clear, colours inconsistent" report.

    Raw chroma asks the question directly — how far apart are the channels —
    and answers it the same way at every lightness.
  */
  const chroma = Math.max(c.r, c.g, c.b) - Math.min(c.r, c.g, c.b);
  if (chroma < 26) return { family: 'neutral', tone: l };
  if (s < 0.12) return { family: 'neutral', tone: l };
  /*
    A near-black is a surface whatever its hue.

    `rgba(15, 17, 40, 0.92)` is a panel with a cold cast, not the brand indigo,
    and sending it to the accent token paints that panel a saturated purple in
    every galaxy. The threshold is 0.22 rather than something tighter because
    the colours that actually needed catching cluster just above 0.16 — the
    `#1a1a3a` behind a native <option>, `#16213e`, `#1b1d38` — while the
    darkest colour genuinely used as a brand FILL here is `#4338ca` at 0.50.
    There is a wide gap between the two groups and this sits in it.
  */
  if (l < 0.22) return { family: 'neutral', tone: l };
  if (h < 15 || h >= 340) return { family: 'danger', tone: l };   // reds and pinks
  if (h < 78) return { family: 'warning', tone: l };              // orange, amber, yellow
  if (h < 175) return { family: 'success', tone: l };             // lime through teal-green
  if (h < 205) return { family: 'info', tone: l };                // cyan and sky
  if (h < 255) return { family: 'accent', tone: l };              // the brand's blue-indigo
  return { family: 'accent2', tone: l };                          // violet, purple, magenta
}

/**
 * The few the maths gets wrong. Each is a colour whose hue puts it in one
 * family while the app uses it as another.
 */
const OVERRIDES = {
  // The signature gradient. #764ba2 is 275° so it lands in accent2 anyway,
  // but pinning it makes the intent explicit and survives a band tweak.
  '#667eea': 'accent',
  '#764ba2': 'accent2',
  '#5a6fd8': 'accent',
  '#6a3fa0': 'accent2',
  // Teals the app uses as informational, not as success.
  '#4ecdc4': 'info',
  '#14b8a6': 'info',
  '#2dd4bf': 'info',
  '#5eead4': 'info',
  '#0d9488': 'info',
};

/* -------------------------------------------------------------------------- *
 * Property → role
 * -------------------------------------------------------------------------- */
const TEXT_PROPS = /^(color|-webkit-text-fill-color|caret-color|text-decoration-color|text-emphasis-color|fill|stroke|column-rule-color)$/;
const BG_PROPS = /^(background|background-color|background-image)$/;
const BORDER_PROPS = /^(border|border-color|border-top|border-right|border-bottom|border-left|border-top-color|border-right-color|border-bottom-color|border-left-color|border-block|border-inline|outline|outline-color|scrollbar-color|accent-color)$/;
const SHADOW_PROPS = /^(box-shadow|text-shadow|filter|-webkit-box-shadow|drop-shadow)$/;

function roleOf(prop) {
  const p = prop.toLowerCase();
  if (TEXT_PROPS.test(p)) return 'text';
  if (BG_PROPS.test(p)) return 'bg';
  if (BORDER_PROPS.test(p)) return 'border';
  if (SHADOW_PROPS.test(p)) return 'shadow';
  if (p.startsWith('--')) return customRole(p);
  return 'other';
}

/**
 * Half the stylesheets declare a private palette of their own —
 * `--np-text`, `--uc-surface`, `--ns-border` — and then use it everywhere. A
 * custom property has no intrinsic role, so those literals would be skipped
 * and the page would keep its old colours while everything around it changed.
 *
 * The name is the role. `--np-text: #ffffff` is white *text*, and it has to
 * flip to dark ink in a light galaxy exactly as a real `color` declaration
 * would. A name with no hint stays 'custom', which converts brand and status
 * hues (unambiguous whatever they are used for) and leaves opaque neutrals
 * alone (ambiguous, and guessing wrong is a page rendered in one colour).
 */
function customRole(name) {
  const isText = /(^|-)(text|txt|ink|fg|foreground|label|title|heading|caption|link|placeholder|copy)(-|$)/.test(name);
  if (isText) {
    /* `--np-text` and `--np-text-soft` are a hierarchy, and flattening both to
       `--sfs-text` loses the only thing that made body copy readable as
       secondary. A name that says it is the quiet one is demoted a step. */
    return /(^|-)(soft|muted|dim|subtle|secondary|faint|quiet|weak|light|low)(-|\d*$)/.test(name)
      ? 'text-soft'
      : 'text';
  }
  if (/(^|-)(bg|background|surface|fill|panel|card|sheet|track|backdrop|scrim|glass|tint|wash|overlay)(-|\d*$)/.test(name)) return 'bg';
  if (/(^|-)(border|line|divider|rule|outline|stroke|edge)(-|\d*$)/.test(name)) return 'border';
  if (/(^|-)(shadow|glow|elevation)(-|\d*$)/.test(name)) return 'shadow';
  return 'custom';
}

/* -------------------------------------------------------------------------- *
 * Token selection
 *
 * Returns a token NAME for an opaque colour, or a `rgb(var(…) / a)` template
 * for a translucent one, or null to leave the literal alone. Leaving it alone
 * is always a legitimate answer: an unconverted colour keeps today's
 * behaviour, a wrongly converted one is a bug in ten themes at once.
 * -------------------------------------------------------------------------- */
/** `accent2` is spelled `accent-2` in the token names. */
const familyBase = family => (family === 'accent2' ? 'accent-2' : family);

/** Custom-property names that really do name a fill rather than an ink. */
const FILLISH_NAME = /(brand|grad|gradient|fill|bg|background|surface|panel|card|chip|badge|pill|dot|swatch|marker|bar|track|glow|shadow|ring|border)/i;

function pickToken(c, family, tone, role, island, fill, clipText, propName) {
  const translucent = c.a < 0.999;
  /* A custom property whose NAME says it is the quiet variant. Treated as
     text, one step down the hierarchy. */
  const demote = role === 'text-soft';
  if (demote) role = 'text';

  /*
    `background-clip: text`.

    The background of such a block is not a background — it IS the text, poured
    through the glyphs, with `color` reduced to a fallback for browsers that
    cannot do it. Every page heading on this app is built that way:

        background: linear-gradient(135deg, #ffffff 0%, #c7d2fe 100%);
        -webkit-background-clip: text;
        color: #fff;

    Classified as a background, that gradient goes to `--sfs-paper` and
    `--sfs-accent-soft` — both light, which is right over a dark galaxy and
    invisible over a pale one. Every h1 on the platform disappeared in the
    three light themes. Reclassifying the whole block as text is the fix, and
    it is one line because the token tables already know what text means.
  */
  if (clipText && (role === 'bg' || role === 'text')) {
    role = 'text';
    island = false;
  }

  /* --- White text on a brand-coloured fill.
   *
   * `.btn { background: linear-gradient(135deg, #667eea, #764ba2); color: #fff }`
   * is the single most common pair in these stylesheets. Sending that `#fff`
   * to `--sfs-text` would be right for a card and wrong here: in a light
   * galaxy the card's text flips to dark ink while the button underneath it
   * stays a saturated indigo, and every primary button on the platform
   * becomes unreadable at once. The ink on a filled control is decided by the
   * FILL, which is what `--sfs-on-*` is for.
   */
  if (role === 'text' && fill && !translucent) {
    return { name: `--sfs-on-${fill === 'accent2' ? 'accent-2' : fill}` };
  }

  /* --- Islands: an opaque light card that must stay light in every theme --- */
  if (island) {
    if (role === 'text') {
      if (family === 'neutral') {
        if (tone < 0.38) return { name: '--sfs-on-paper' };
        if (tone < 0.7) return { name: '--sfs-on-paper-muted' };
        return null;                       // light ink inside a light card: leave it
      }
      return { name: `--sfs-${family === 'accent2' ? 'accent-2' : family}-on-paper` };
    }
    if (role === 'bg' && !translucent) {
      if (family === 'neutral') {
        if (tone >= 0.93) return { name: '--sfs-paper' };
        if (tone >= 0.82) return { name: '--sfs-paper-2' };
        if (tone >= 0.55) return { name: '--sfs-paper-3' };
        return null;
      }
      /*
        A PALE TINTED card — `#fffbeb` behind a warning, `#fed7d7` behind an
        error, `#c6f6d5` behind a pass. It is a light island that happens to
        carry a hue, and it needs a token that is light in every galaxy, the
        way --sfs-paper is. Sending it to the solid `--sfs-warning` instead is
        what produced the worst failure in the whole system: a saturated amber
        block with `--sfs-warning-on-paper` amber text on it, 1:1, unreadable.
      */
      if (tone >= 0.72) return { name: `--sfs-${familyBase(family)}-wash` };
      /* A saturated, genuinely dark fill inside a light card is still a fill —
         a brand button on a white panel — and its ink comes from --sfs-on-*. */
      return { name: `--sfs-${familyBase(family)}` };
    }
    if (role === 'border' && !translucent) {
      if (family === 'neutral') return { name: '--sfs-paper-border' };
      return { name: `--sfs-${familyBase(family)}-wash` };
    }
  }

  /* --- Neutrals: the white/black/grey world --- */
  if (family === 'neutral') {
    if (translucent) {
      /* One channel triple serves every opacity, and flipping that single
         token is what turns 1500 white-alpha literals into a light theme. */
      if (role === 'shadow') return null;                 // shadows stay black in both modes
      if (role === 'text') return { rgbVar: '--sfs-text-rgb' };
      /* A dark wash at 0.7 and up is not a scrim, it is an opaque panel that
         happens to be written with an alpha. It has to flip with the theme;
         a scrim below that threshold has to stay dark in both. */
      if (role === 'bg' && tone < 0.5 && c.a >= 0.5) return { rgbVar: '--sfs-surface-rgb' };
      /* A hairline is the one neutral that must flip with the mode — see the
         --sfs-line-rgb note in themes.ts. The tint no longer does. */
      if (role === 'border') return { rgbVar: tone >= 0.5 ? '--sfs-line-rgb' : '--sfs-shade-rgb' };
      return { rgbVar: tone >= 0.5 ? '--sfs-tint-rgb' : '--sfs-shade-rgb' };
    }
    if (role === 'text') {
      /* A clip-text block's `color` is only the fallback for a browser that
         cannot paint the gradient, so a dark literal there is not 'ink on a
         light card' — it is the heading, and it has to follow the theme. */
      if (clipText && tone < 0.3) return { name: '--sfs-text' };
      if (tone >= 0.86) return { name: demote ? '--sfs-text-muted' : '--sfs-text' };
      if (tone >= 0.58) return { name: demote ? '--sfs-text-faint' : '--sfs-text-muted' };
      if (tone >= 0.3) return { name: '--sfs-text-faint' };
      return null;                          // dark ink with no light bg in this block
    }
    if (role === 'bg') {
      if (tone <= 0.07) return { name: '--sfs-space' };
      if (tone <= 0.2) return { name: '--sfs-surface-2' };
      if (tone <= 0.45) return { name: '--sfs-surface-3' };
      return null;                          // opaque light bg outside an island: leave
    }
    if (role === 'border') {
      if (tone >= 0.75) return { name: '--sfs-border-strong' };
      if (tone >= 0.2) return { name: '--sfs-border' };
      return null;
    }
    return null;
  }

  /* --- Brand and status --- */
  if (translucent) return { rgbVar: `--sfs-${familyBase(family)}-rgb` };

  if (role === 'text') {
    /* A pale brand tint used as body copy is muted text, not a brand accent —
       #c7d2fe is the app's secondary paragraph colour, not a link. */
    if ((family === 'accent' || family === 'accent2') && tone >= 0.72) {
      return { name: '--sfs-text-muted' };
    }
    if (family === 'accent' || family === 'accent2') {
      return { name: `--sfs-${familyBase(family)}-text` };
    }
    return { name: `--sfs-${family}-text` };
  }
  if (role === 'custom' && tone >= 0.55 && !FILLISH_NAME.test(propName || '')) {
    /*
      A page-local token holding a PALE brand tint, with a name that gives no
      clue what it is for.

      `--rf-accent-2: #a78bfa` is a light violet, and on a dark galaxy the only
      thing a light violet can be is ink — you cannot fill a button with it and
      read anything. Sent to the solid `--sfs-accent-2` (`#764ba2`) it became
      dark purple text on a dark page: invisible, and twelve rules across six
      stylesheets had it. The `-text` variant is the safe answer either way,
      since it is derived to be readable on the surface in both modes.

      A name that says fill — `--np-brand-grad`, `--x-bg` — is exempt, because
      those really are fills and are used as gradients.
    */
    return { name: `--sfs-${familyBase(family)}-text` };
  }
  if (role === 'bg' || role === 'border' || role === 'custom' || role === 'other') {
    if (family === 'accent' && tone >= 0.7) return { name: '--sfs-accent-soft' };
    return { name: `--sfs-${familyBase(family)}` };
  }
  if (role === 'shadow') return { name: `--sfs-${familyBase(family)}` };
  return null;
}

/**
 * Selectors whose colours are somebody else's property.
 *
 * A WhatsApp icon is #25D366 because that is what WhatsApp is, and a Docker
 * planet is #2496ED for the same reason. Those literals classify as "success"
 * and "accent" like any other green and blue, and theming them turns the share
 * row into a row of identical indigo glyphs — the logo stops being a logo.
 *
 * Anything the theme legitimately owns (layout, the surface behind the icon)
 * still converts; only the colour declarations inside these blocks are left.
 */
const THIRD_PARTY = new RegExp(
  '(^|[^a-z])(' + [
    'linkedin', 'facebook', 'whatsapp', 'twitter', 'telegram', 'instagram',
    'youtube', 'tiktok', 'discord', 'slack', 'github', 'gitlab', 'google',
    'microsoft', 'apple', 'reddit', 'pinterest', 'snapchat', 'is-x',
    'python', 'javascript', 'typescript', 'docker', 'kubernetes', 'k8s',
    'aws', 'azure', 'gcp', 'linux', 'ubuntu', 'windows', 'vuejs', 'react',
    'nodejs', 'mysql', 'postgres', 'mongodb', 'redis', 'nginx',
    'visa', 'mastercard', 'paypal', 'stripe', 'cliq', 'roblox',
  ].join('|') + ')([^a-z]|$)',
  'i'
);

/* -------------------------------------------------------------------------- *
 * Declaration scanning
 * -------------------------------------------------------------------------- */

/* `color: white` is as common in these stylesheets as `#fff`, and leaving
   the keyword unconverted leaves white text on a light galaxy. */
const COLOR_RE = /#[0-9a-fA-F]{3,8}\b|\b(?:rgba?|hsla?)\([^()]*\)|\b(?:white|black)\b/g;

/**
 * Walk a stylesheet body and yield every declaration with the offsets of the
 * block it belongs to. A real parser is overkill; what matters is that
 * comments and `url(...)` payloads are never treated as declarations.
 */
function scanBlocks(css) {
  const blocks = [];
  let depth = 0;
  const stack = [];
  let i = 0;
  let declStart = 0;

  while (i < css.length) {
    if (css.startsWith('/*', i)) {
      const end = css.indexOf('*/', i + 2);
      i = end === -1 ? css.length : end + 2;
      declStart = Math.max(declStart, i);
      continue;
    }
    const ch = css[i];
    if (ch === '{') {
      depth++;
      stack.push({
        decls: [],
        start: i + 1,
        selector: css.slice(declStart, i).trim(),
        /* The at-rules this block sits inside. `@media print` describes a
           different medium entirely, and letting it speak for the screen is
           how `.notifications-container { background: #fff }` — correct for
           paper — marked the whole component a light island and left its white
           screen text unconverted. */
        context: stack.map(b => b.selector),
      });
      declStart = i + 1;
      i++;
      continue;
    }
    if (ch === '}') {
      const block = stack.pop();
      if (block) {
        pushDecl(block, css, declStart, i);
        blocks.push(block);
      }
      depth--;
      i++;
      declStart = i;
      continue;
    }
    if (ch === ';' && stack.length) {
      pushDecl(stack[stack.length - 1], css, declStart, i);
      declStart = i + 1;
      i++;
      continue;
    }
    if (ch === '(') {
      /* Skip balanced parens wholesale so a `;` inside url(data:…) or a
         nested gradient never ends a declaration. */
      let d = 1;
      i++;
      while (i < css.length && d > 0) {
        if (css[i] === '(') d++;
        else if (css[i] === ')') d--;
        i++;
      }
      continue;
    }
    i++;
  }
  return blocks;
}

function pushDecl(block, css, start, end) {
  const text = css.slice(start, end);
  if (!text.trim()) return;
  const colon = text.indexOf(':');
  if (colon === -1) return;
  const prop = text.slice(0, colon).trim();
  if (!prop || /[{}]/.test(prop)) return;
  block.decls.push({
    prop,
    valueStart: start + colon + 1,
    valueEnd: end,
    value: text.slice(colon + 1),
  });
}

/**
 * What does this block paint itself?
 *
 * `island` — an opaque LIGHT background. A certificate, a printable panel, a
 * white card. It keeps the `--sfs-paper` pair, which is light-with-dark-ink in
 * all ten galaxies, so it survives every theme unchanged.
 *
 * `fill` — an opaque BRAND or STATUS background. A filled button, a badge, a
 * gradient header. Neutral text in such a block belongs to the fill, not to
 * the page.
 */
function blockPaint(block, locals) {
  let island = false;
  let fill = null;
  let hasBackground = false;
  /* See the note in pickToken: this block's "background" is its text. */
  const clipText = block.decls.some(d =>
    /^-?(webkit-)?background-clip$/i.test(d.prop) && /\btext\b/i.test(d.value));
  if (clipText) return { island: false, fill: null, clipText: true, hasBackground: false };

  for (const d of block.decls) {
    if (roleOf(d.prop) !== 'bg') continue;
    hasBackground = true;
    if (/url\(/i.test(d.value)) continue;
    for (const m of expandLocals(d.value, locals).match(COLOR_RE) || []) {
      const k = m.toLowerCase();
      const c = k === 'white' ? { r: 255, g: 255, b: 255, a: 1 }
             : k === 'black' ? { r: 0, g: 0, b: 0, a: 1 }
             : m.startsWith('#') ? parseHex(m) : parseFunc(m);
      /* A translucent wash does not decide the ink — whatever is behind it
         still shows through, and that is the themed surface. */
      if (!c || c.a < 0.9) continue;
      if (luminance(c) >= 0.5) island = true;
      const family = OVERRIDES[m.toLowerCase()] ?? classify(c).family;
      /* A pale brand tint is a surface, not a fill: white text was never
         legible on it and is not the pairing we are preserving. */
      if (family !== 'neutral' && !fill && luminance(c) < 0.5) fill = family;
    }
  }
  return { island, fill, clipText: false, hasBackground };
}

/**
 * Every `--name: value` in the file, so a background written as
 * `background: var(--np-brand-grad)` can still be recognised as a brand fill.
 *
 * These stylesheets declare a private palette at the top of the page and then
 * refer to it everywhere, so without this the button rule that matters most —
 * a gradient fill with white text — looks like a block with no background at
 * all, and its `color: #fff` gets sent to `--sfs-text` and inverts under a
 * light galaxy. One level of indirection covers the pattern as written; three
 * passes cover a palette defined in terms of itself.
 */
function collectLocals(css) {
  const table = new Map();
  for (const m of css.matchAll(/(--[a-z0-9-]+)\s*:([^;{}]*)[;}]/gi)) {
    table.set(m[1], m[2].trim());
  }
  return table;
}

/**
 * Is this block describing a different medium or rendering mode?
 *
 * `@media print` is paper, `forced-colors` is the OS palette and
 * `prefers-contrast` is an override. Each legitimately sets colours the screen
 * must not inherit, so none of them may contribute to what a selector paints
 * on screen. They are still converted — on their own terms.
 */
function isAlternateMedium(block) {
  return (block.context || []).some(s =>
    /^\s*@media\b/i.test(s) && /(?:^|[^a-z-])(print|forced-colors|prefers-contrast)(?![a-z-])/i.test(s));
}

/** The individual selectors of a rule, normalised. */
function selectorParts(selector) {
  return String(selector || '')
    .split(',')
    .map(s => s.replace(/\s+/g, ' ').trim())
    .filter(Boolean);
}

/**
 * What paints the element this block is styling — including the fill declared
 * by its BEM modifier rather than by itself.
 *
 *     .enroll-btn          { …; color: #fff }
 *     .enroll-btn--enroll  { background: linear-gradient(…#667eea…) }
 *
 * The ink lives on the base and the fill on the modifier, which is the normal
 * way to write a two-variant button and the reason the `#fff` above would
 * otherwise be read as page text. A modifier is always present when the
 * element renders — you always apply one of them — so the base's ink is always
 * over a fill.
 *
 * Only `--` and a compound class count as an extension DOWNWARD. A
 * pseudo-class does not: `.btn:hover { background: accent }` describes a state
 * the element is in for a fraction of its life, and taking the hover fill as
 * the resting ink gets the common case wrong to fix the rare one.
 *
 * The other direction is different and does apply. When the block being
 * classified IS the state —
 *
 *     .room-link        { background: linear-gradient(…#14b8a6…) }
 *     .room-link:hover  { …; color: #fff }
 *
 * — the fill is on the base and the element unquestionably has it while
 * hovered, so the state's ink is decided by the base's fill.
 */
function lookupPaint(block, index, locals) {
  const own = blockPaint(block, locals);
  /* A print or forced-colours rule is judged entirely on its own terms. */
  if (isAlternateMedium(block)) return own;
  /* clip-text is a property of THIS rule, never inherited from a selector
     relative — a heading and its container are not the same element. */
  if (own.clipText) return { island: false, fill: null, clipText: true };
  let island = false;
  let fill = null;
  for (const part of selectorParts(block.selector)) {
    const direct = index.get(part);
    if (direct) {
      island = island || direct.island;
      fill = fill ?? direct.fill;
    }
    if (!fill) {
      // This block is a state of something: inherit the base's fill.
      const base = part.replace(/(?::{1,2}[a-z-]+(?:\([^)]*\))?)+$/i, '');
      if (base && base !== part) {
        const from = index.get(base);
        if (from) {
          island = island || from.island;
          fill = fill ?? from.fill;
        }
      }
    }
    if (fill) continue;
    for (const [selector, paint] of index) {
      if (selector.length <= part.length || !selector.startsWith(part)) continue;
      const next = selector.slice(part.length);
      if (!/^--[a-z0-9-]+$/i.test(next)) continue;
      island = island || paint.island;
      fill = fill ?? paint.fill;
      if (fill) break;
    }
  }
  if (!island && !fill) return own;
  return { island, fill, clipText: false };
}

function expandLocals(value, locals) {
  let out = value;
  for (let pass = 0; pass < 3 && out.includes('var(') && locals.size; pass++) {
    out = out.replace(/var\(\s*(--[a-z0-9-]+)\s*(?:,([^()]*))?\)/gi,
      (all, name, fallback) => locals.get(name) ?? (fallback ?? all));
  }
  return out;
}

/* -------------------------------------------------------------------------- *
 * Rewriting
 * -------------------------------------------------------------------------- */

/**
 * Put every tokenised colour back to the literal it carries.
 *
 * The inverse of one conversion each:
 *   `var(--sfs-accent, #667eea)`                 → `#667eea`
 *   `rgb(var(--sfs-tint-rgb, 255 255 255) / .5)` → `rgba(255, 255, 255, 0.5)`
 *
 * Only `--sfs-` tokens are touched, so a page's own `var(--np-brand-1, …)`
 * survives untouched.
 */
function unconvert(css) {
  return css
    .replace(
      /rgb\(\s*var\(\s*--sfs-[a-z0-9-]+\s*,\s*(\d+)\s+(\d+)\s+(\d+)\s*\)\s*\/\s*([\d.]+)\s*\)/gi,
      (_all, r, g, b, a) => `rgba(${r}, ${g}, ${b}, ${a})`
    )
    .replace(
      /var\(\s*--sfs-[a-z0-9-]+\s*,\s*(#[0-9a-f]{3,8}|(?:rgba?|hsla?)\([^()]*\))\s*\)/gi,
      (_all, literal) => literal
    );
}

function rewrite(source, stats) {
  const css = REMAP ? unconvert(source) : source;
  const blocks = scanBlocks(css);
  const locals = collectLocals(css);
  const edits = [];

  /*
    What a selector paints, gathered across EVERY rule that uses it.

    These stylesheets routinely split one component in two: a base rule with
    the layout and the text colour, and a second rule — a state, a variant, a
    media query, or just further down the file — with the fill.

        .wrong-badge { …layout…; color: #fff }
        .wrong-badge { background: linear-gradient(135deg, #fc8181, #ef4444) }

    Looking at one block at a time, the first has no background, so its `#fff`
    is read as page text and sent to `--sfs-text` — which inverts to dark ink
    under a light galaxy while the badge underneath stays red. Merging by
    selector first is what lets the `#fff` be recognised as the ink on a danger
    fill and sent to `--sfs-on-danger` instead.
  */
  const paintBySelector = new Map();
  for (const block of blocks) {
    if (isAlternateMedium(block)) continue;
    const paint = blockPaint(block, locals);
    /* A block that declares a background REPLACES what the selector paints,
       even when that background is a plain tint — "this is no longer filled"
       is exactly the information the last-wins rule exists to carry. A block
       with no background at all says nothing and is skipped. */
    if (!paint.hasBackground) continue;
    /* A rule is usually written for several selectors at once —
       `.correct-badge, .wrong-badge { … }` — so each one is indexed
       separately. Indexing the whole list as one string is why the first
       attempt at this missed most of the app's badges. */
    for (const part of selectorParts(block.selector)) {
      /*
        Last background wins, because that is the cascade.

        `.save-btn, .refresh-btn { background: <brand gradient> }` followed by
        `.refresh-btn { background: <glass> }` means the refresh button is
        glass, not brand — and its ink therefore comes from the page rather
        than from a fill it no longer has. Merging with `??` kept the first
        answer and re-broke the button on every re-run.
      */
      paintBySelector.set(part, { island: paint.island, fill: paint.fill });
    }
  }

  for (const block of blocks) {
    if (THIRD_PARTY.test(block.selector || '')) { stats.thirdParty++; continue; }
    const { island, fill, clipText } = lookupPaint(block, paintBySelector, locals);
    for (const decl of block.decls) {
      const role = roleOf(decl.prop);
      if (role === 'other' && !/color|shadow|gradient|fill|stroke/i.test(decl.prop)) {
        /* Properties that never carry a colour: transitions, fonts, grid. */
        if (!/^(background|border|outline|box-shadow|text-shadow|color|fill|stroke|--)/i.test(decl.prop)) continue;
      }
      /* An encoded SVG carries hexes that belong to the image, not the theme. */
      if (/url\(/i.test(decl.value)) continue;

      const value = decl.value;
      COLOR_RE.lastIndex = 0;
      let m;
      while ((m = COLOR_RE.exec(value)) !== null) {
        const literal = m[0];
        const at = decl.valueStart + m.index;

        /* Idempotency: a literal already serving as a var() fallback stays. */
        if (insideVarFallback(css, at)) continue;

        const named = literal.toLowerCase();
        const c = named === 'white' ? { r: 255, g: 255, b: 255, a: 1 }
               : named === 'black' ? { r: 0, g: 0, b: 0, a: 1 }
               : literal.startsWith('#') ? parseHex(literal) : parseFunc(literal);
        if (!c) continue;

        const key = literal.toLowerCase();
        const auto = classify(c);
        const family = OVERRIDES[key] ?? auto.family;
        const pick = pickToken(c, family, auto.tone, role, island, fill, clipText, decl.prop);
        /* `SFS_DEBUG=<substring>` prints the decision for every declaration
           whose property name contains it. Every wrong mapping found while
           building this was found with it — the classification is otherwise
           invisible until it shows up as a colour on a page. */
        if (process.env.SFS_DEBUG && decl.prop.includes(process.env.SFS_DEBUG)) {
          console.log('debug', decl.prop, literal, '->',
                      JSON.stringify({ role, family, tone: Number(auto.tone.toFixed(3)), island, fill, clipText, pick }));
        }
        if (!pick) { stats.skipped++; continue; }

        let replacement;
        if (pick.rgbVar) {
          const a = Math.round(c.a * 1000) / 1000;
          replacement = `rgb(var(${pick.rgbVar}, ${channels(c)}) / ${a})`;
        } else {
          replacement = `var(${pick.name}, ${literal})`;
        }
        edits.push({ start: at, end: at + literal.length, replacement });
        stats.converted++;
        stats.byToken[pick.rgbVar || pick.name] = (stats.byToken[pick.rgbVar || pick.name] || 0) + 1;
      }
    }
  }

  if (!edits.length) return css;
  edits.sort((a, b) => b.start - a.start);
  let out = css;
  for (const e of edits) out = out.slice(0, e.start) + e.replacement + out.slice(e.end);
  return out;
}

/** Is this offset inside the fallback half of a `var(--x, …)` already? */
function insideVarFallback(css, at) {
  /* Walk back over balanced parens looking for an enclosing `var(`. */
  let depth = 0;
  for (let i = at - 1; i >= 0 && at - i < 400; i--) {
    const ch = css[i];
    if (ch === ')') depth++;
    else if (ch === '(') {
      if (depth === 0) return /var\s*$/i.test(css.slice(Math.max(0, i - 4), i));
      depth--;
    }
  }
  return false;
}

/* -------------------------------------------------------------------------- *
 * File walking
 * -------------------------------------------------------------------------- */

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    const st = statSync(p);
    if (st.isDirectory()) {
      if (name === 'node_modules' || name === 'dist' || name === '.git') continue;
      walk(p, out);
    } else if (name.endsWith('.css') || name.endsWith('.vue')) {
      if (SKIP_FILES.has(name)) continue;
      out.push(p);
    }
  }
  return out;
}

const stats = { converted: 0, skipped: 0, thirdParty: 0, files: 0, byToken: {} };
const files = walk(join(ROOT, 'src'));

for (const file of files) {
  const original = readFileSync(file, 'utf8');
  let updated;

  if (file.endsWith('.css')) {
    updated = rewrite(original, stats);
  } else {
    /* A .vue file: rewrite only inside <style> blocks. */
    updated = original.replace(
      /(<style[^>]*>)([\s\S]*?)(<\/style>)/g,
      (_all, open, body, close) => open + rewrite(body, stats) + close
    );
  }

  if (updated !== original) {
    stats.files++;
    if (WRITE) writeFileSync(file, updated, 'utf8');
    else console.log(`  would rewrite ${relative(ROOT, file)}`);
  }
}

console.log(`\n${WRITE ? 'Rewrote' : 'Would rewrite'} ${stats.files} files`);
console.log(`  ${stats.converted} literals tokenised, ${stats.skipped} deliberately left alone`);
console.log(`  ${stats.thirdParty} blocks skipped as third-party brand colour`);
const top = Object.entries(stats.byToken).sort((a, b) => b[1] - a[1]);
console.log('  top tokens:');
for (const [token, n] of top) console.log(`    ${String(n).padStart(5)}  ${token}`);
console.log(`  ${top.length} distinct tokens referenced\n`);
