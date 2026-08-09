// Verifies the ten galaxies without a browser.
//
//   npm run check:theme
//
// The theme system is three plain modules (contrast.ts, themes.ts, tokens are
// data) for exactly this reason. What is checked here is the set of properties
// that are invisible until a student hits them on a page nobody re-tested
// after adding an eighth theme:
//
// * requirement 2, stated as arithmetic — every text token clears WCAG against
//   the surface it actually lands on, in all ten galaxies, both modes. The
//   derivation in themes.ts is what makes this pass; the check is what stops
//   somebody "simplifying" the derivation back into hand-picked hex;
// * every theme defines every token, so a theme cannot half-apply and leave
//   the previous galaxy's accent behind on one screen;
// * the ten are actually distinguishable from each other;
// * the stylesheets only reference tokens that exist, and every `var(--sfs-…)`
//   carries a fallback so a pre-hydration paint is never colourless;
// * `paint()` — the runtime half, for backgrounds that come from data rather
//   than from CSS — really does flip the ink at the boundary.

import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

import {
  AA_LARGE,
  AA_TEXT,
  bestTextOn,
  channels,
  contrastRatio,
  ensureContrast,
  isDark,
  paint,
  parseColor,
  relativeLuminance,
  toHex,
} from '../../src/theme/contrast';
import {
  DEFAULT_THEME_ID,
  THEMES,
  THEME_IDS,
  claimHolds,
  contrastClaims,
  getTheme,
  themeIsDark,
} from '../../src/theme/themes';

let failures = 0;

function check(label: string, ok: boolean, detail: any = '') {
  console.log(`  ${ok ? 'ok  ' : 'FAIL'}  ${label}${ok ? '' : '  ' + JSON.stringify(detail)}`);
  if (!ok) failures++;
}

const round = (n: number) => Math.round(n * 100) / 100;

console.log('\n1. Colour maths');
{
  check('#fff parses', toHex(parseColor('#fff')!) === '#ffffff');
  check('#abcdef parses', toHex(parseColor('#abcdef')!) === '#abcdef');
  check('rgb(1, 2, 3) parses', toHex(parseColor('rgb(1, 2, 3)')!) === '#010203');
  check('rgb(1 2 3 / 0.5) space syntax parses', parseColor('rgb(1 2 3 / 0.5)') !== null);
  check('hsl(0 100% 50%) is red', toHex(parseColor('hsl(0, 100%, 50%)')!) === '#ff0000');
  check('hsl(120 100% 50%) is green', toHex(parseColor('hsl(120, 100%, 50%)')!) === '#00ff00');
  check('a gradient is not a colour', parseColor('linear-gradient(#fff, #000)') === null);
  check('currentColor is not a colour', parseColor('currentColor') === null);
  check('var() is not a colour', parseColor('var(--x)') === null);

  check('white luminance is 1', round(relativeLuminance('#ffffff')) === 1);
  check('black luminance is 0', relativeLuminance('#000000') === 0);
  check('black on white is 21:1', round(contrastRatio('#000', '#fff')) === 21);
  check('a colour against itself is 1:1', contrastRatio('#4488cc', '#4488cc') === 1);
  check('contrast is symmetric',
        contrastRatio('#123456', '#abcdef') === contrastRatio('#abcdef', '#123456'));

  check('channels() emits the space-separated triple', channels('#667eea') === '102 126 234');

  // The boundary is where black and white text draw level, not luminance 0.5.
  check('near-black is dark', isDark('#101010'));
  check('near-white is not dark', !isDark('#f0f0f0'));
  check('mid indigo is dark (light text wins)', isDark('#4b5cc4'));
  check('gold is not dark (dark text wins)', !isDark('#f5b642'));
  for (const bg of ['#000000', '#ffffff', '#f5b642', '#4b5cc4', '#34d399', '#7f7f7f']) {
    const ink = bestTextOn(bg);
    const other = ink === '#ffffff' ? '#10131c' : '#ffffff';
    check(`bestTextOn(${bg}) beats the alternative`,
          contrastRatio(ink, bg) >= contrastRatio(other, bg),
          [round(contrastRatio(ink, bg)), round(contrastRatio(other, bg))]);
  }
}

console.log('\n2. ensureContrast reaches its target');
{
  const pairs: Array<[string, string, number]> = [
    ['#667eea', '#04040f', AA_TEXT],
    ['#667eea', '#ffffff', AA_TEXT],
    ['#facc15', '#ffffff', AA_TEXT],   // the hard one: yellow on white
    ['#facc15', '#0a0f03', AA_TEXT],
    ['#7f7f7f', '#808080', AA_TEXT],   // starts at 1:1 with nowhere obvious to go
    ['#0d1220', '#0d1220', AA_TEXT],
  ];
  for (const [fg, bg, target] of pairs) {
    const fixed = ensureContrast(fg, bg, target);
    check(`${fg} on ${bg} reaches ${target}`,
          contrastRatio(fixed, bg) >= target,
          [fixed, round(contrastRatio(fixed, bg))]);
  }
  check('a pair that already passes is returned untouched',
        ensureContrast('#ffffff', '#000000', AA_TEXT) === '#ffffff');
  check('an impossible target returns the best available, not a throw',
        contrastRatio(ensureContrast('#808080', '#7f7f7f', 21), '#7f7f7f') > 1);
}

console.log('\n3. Ten galaxies, all present and distinct');
{
  check('there are exactly ten themes', THEMES.length === 10, THEMES.length);
  check('ids are unique', new Set(THEME_IDS).size === THEME_IDS.length, THEME_IDS);
  check('names are unique', new Set(THEMES.map(t => t.name)).size === 10);
  check('the default exists', THEME_IDS.includes(DEFAULT_THEME_ID), DEFAULT_THEME_ID);
  check('an unknown id falls back to the default rather than crashing',
        getTheme('no-such-galaxy').id === DEFAULT_THEME_ID);
  check('getTheme(null) falls back too', getTheme(null).id === DEFAULT_THEME_ID);

  const dark = THEMES.filter(t => t.mode === 'dark');
  const light = THEMES.filter(t => t.mode === 'light');
  check('both modes are represented', dark.length > 0 && light.length > 0,
        [dark.length, light.length]);

  /*
    Requirement 1 says ten DIFFERENT galaxies. Two themes a viewer cannot tell
    apart in the picker are one theme with two names.

    Compared in HSL rather than by RGB distance, because RGB distance answers
    the wrong question: it calls a saturated cobalt and a desaturated slate
    "the same" when they read as completely different palettes, and it calls
    two adjacent cyans "different" when they do not. What distinguishes a
    galaxy is its HUE, or failing that a large gap in how saturated or how
    deep it is — which is exactly how Cartwheel's cobalt and Silver Spiral's
    slate differ while sharing a hue.

    Only themes of the SAME MODE are compared. A light theme and a dark one
    are never mistaken for each other whatever their accents do.
  */
  const hsl = (hex: string) => {
    const c = parseColor(hex)!;
    const r = c.r / 255, g = c.g / 255, b = c.b / 255;
    const max = Math.max(r, g, b), min = Math.min(r, g, b), d = max - min;
    const l = (max + min) / 2;
    const s = d === 0 ? 0 : d / (1 - Math.abs(2 * l - 1));
    let h = 0;
    if (d !== 0) {
      if (max === r) h = (((g - b) / d + 6) % 6) * 60;
      else if (max === g) h = ((b - r) / d + 2) * 60;
      else h = ((r - g) / d + 4) * 60;
    }
    return { h, s, l };
  };

  for (let i = 0; i < THEMES.length; i++) {
    for (let j = i + 1; j < THEMES.length; j++) {
      if (THEMES[i].mode !== THEMES[j].mode) continue;
      const a = hsl(THEMES[i].accent);
      const b = hsl(THEMES[j].accent);
      const raw = Math.abs(a.h - b.h) % 360;
      const hueGap = raw > 180 ? 360 - raw : raw;
      const satGap = Math.abs(a.s - b.s);
      const lumGap = Math.abs(a.l - b.l);
      check(`${THEMES[i].id} and ${THEMES[j].id} are visibly different`,
            hueGap >= 25 || satGap >= 0.3 || lumGap >= 0.25,
            { hueGap: Math.round(hueGap), satGap: round(satGap), lumGap: round(lumGap) });
    }
  }

  // A dark galaxy's space must actually be dark, and a light one's light —
  // otherwise the derivation is being asked to make bricks without straw.
  for (const t of THEMES) {
    check(`${t.id}: space matches its declared mode`,
          t.mode === 'dark' ? isDark(t.space) : !isDark(t.space),
          [t.space, round(relativeLuminance(t.space))]);
    check(`${t.id}: themeIsDark agrees with the seed`, themeIsDark(t) === (t.mode === 'dark'));
  }
}

console.log('\n4. Requirement 2 — every claim holds, in every galaxy');
{
  for (const theme of THEMES) {
    let worst = { label: '', ratio: Infinity, min: 0 };
    for (const claim of contrastClaims(theme)) {
      const ratio = contrastRatio(claim.fg, claim.bg);
      if (!claimHolds(claim)) {
        check(`${theme.id}: ${claim.label} (${claim.fg} on ${claim.bg})`, false,
              { got: round(ratio), want: claim.min });
      }
      if (ratio - claim.min < worst.ratio - worst.min) {
        worst = { label: claim.label, ratio, min: claim.min };
      }
    }
    check(`${theme.id}: all ${contrastClaims(theme).length} claims hold ` +
          `(tightest: ${worst.label} ${round(worst.ratio)}/${worst.min})`,
          contrastClaims(theme).every(claimHolds));
  }
}

console.log('\n5. Light text on dark objects, dark text on light ones');
{
  // The requirement restated as a property, checked against every accent and
  // status fill of every theme rather than against a list of examples.
  for (const theme of THEMES) {
    const v = theme.vars;
    const fills: Array<[string, string, string]> = [
      ['accent', v['--sfs-accent'], v['--sfs-on-accent']],
      ['accent-2', v['--sfs-accent-2'], v['--sfs-on-accent-2']],
      ['accent-3', v['--sfs-accent-3'], v['--sfs-on-accent-3']],
      ['success', v['--sfs-success'], v['--sfs-on-success']],
      ['warning', v['--sfs-warning'], v['--sfs-on-warning']],
      ['danger', v['--sfs-danger'], v['--sfs-on-danger']],
      ['info', v['--sfs-info'], v['--sfs-on-info']],
      ['paper', v['--sfs-paper'], v['--sfs-on-paper']],
      ['surface', theme.measuredSurface, v['--sfs-text']],
      ['field', v['--sfs-field'], v['--sfs-field-text']],
    ];
    for (const [name, bg, ink] of fills) {
      const inkIsLight = relativeLuminance(ink) > 0.5;
      const bgIsDark = isDark(bg);
      check(`${theme.id}: ink on ${name} points the right way`,
            inkIsLight === bgIsDark,
            { bg, ink, bgLum: round(relativeLuminance(bg)), inkLum: round(relativeLuminance(ink)) });
    }
  }
}

console.log('\n6. paint() — runtime backgrounds that come from data');
{
  // Avatar tints, VLAN swatches, CV accents, role badges: a stylesheet cannot
  // reach these, so they are the one place the old code hardcoded white and
  // produced white-on-yellow.
  const samples = ['#facc15', '#0a0f03', '#ffffff', '#000000', '#7c8cff', '#fde68a', '#334f78'];
  for (const bg of samples) {
    const style = paint(bg);
    check(`paint(${bg}) is readable`, contrastRatio(style.color, bg) >= AA_LARGE,
          round(contrastRatio(style.color, bg)));
    check(`paint(${bg}) keeps the background`, style.background === bg);
  }
  check('paint() flips at the boundary',
        paint('#facc15').color !== paint('#0a0f03').color);
}

console.log('\n7. The stylesheets agree with the token contract');
{
  const cssDir = join(process.cwd(), 'src', 'assets', 'css');
  const files = readdirSync(cssDir).filter(f => f.endsWith('.css'));
  files.push('../../style.css');

  const declared = new Set<string>();
  for (const theme of THEMES) for (const key of Object.keys(theme.vars)) declared.add(key);
  // theme.css and responsive.css declare the tokens that are not colours and
  // therefore have no business being derived per galaxy — the spacing scale,
  // the safe-area insets, the shell width.
  for (const file of ['theme.css', 'responsive.css']) {
    const text = readFileSync(join(cssDir, file), 'utf8');
    for (const m of text.matchAll(/^\s*(--sfs-[a-z0-9-]+)\s*:/gim)) declared.add(m[1]);
  }

  check('every theme declares the same token set',
        THEMES.every(t =>
          Object.keys(t.vars).length === Object.keys(THEMES[0].vars).length &&
          Object.keys(t.vars).every(k => k in THEMES[0].vars)),
        THEMES.map(t => `${t.id}:${Object.keys(t.vars).length}`));

  let referenced = 0;
  let missing: string[] = [];
  let noFallback: string[] = [];
  for (const file of files) {
    const text = readFileSync(join(cssDir, file), 'utf8');
    for (const m of text.matchAll(/var\(\s*(--sfs-[a-z0-9-]+)\s*(,?)/gi)) {
      referenced++;
      if (!declared.has(m[1]) && !missing.includes(m[1])) missing.push(m[1]);
      // A var() with no fallback paints nothing at all if the token is ever
      // absent — during the first frame, or in a print stylesheet. Every
      // reference the codemod wrote carries one.
      if (!m[2] && noFallback.length < 12) noFallback.push(`${file}: ${m[1]}`);
    }
  }
  check(`the stylesheets reference tokens (${referenced} references)`, referenced > 200, referenced);
  check('every referenced token is declared by every theme or by theme.css',
        missing.length === 0, missing.slice(0, 20));
  check('every var(--sfs-…) reference carries a fallback', noFallback.length === 0, noFallback);
}

console.log('\n8. No stylesheet still hardcodes the old indigo');
{
  // The codemod's own regression test. These six literals were the app's
  // identity before the port and are the ones that make a theme fail to apply
  // if they come back: an un-tokenised #667eea stays indigo in the Sombrero
  // galaxy and looks like a rendering bug rather than a missed replacement.
  const banned = ['#667eea', '#764ba2', '#818cf8', '#c7d2fe', '#6366f1', '#a5b4fc'];
  const cssDir = join(process.cwd(), 'src', 'assets', 'css');
  const offenders: string[] = [];
  for (const file of readdirSync(cssDir).filter(f => f.endsWith('.css'))) {
    // A comment naming the old brand gradient is documentation, not a colour
    // anything renders — several page headers describe the palette they were
    // written against and those notes are still true of the default galaxy.
    const text = readFileSync(join(cssDir, file), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
    for (const line of text.split('\n')) {
      // Inside a var() fallback is exactly where they are supposed to be.
      const stripped = line.replace(/var\([^)]*\)/g, '');
      for (const hex of banned) {
        if (stripped.toLowerCase().includes(hex) && offenders.length < 15) {
          offenders.push(`${file}: ${line.trim().slice(0, 80)}`);
        }
      }
    }
  }
  check('no bare pre-theme indigo outside a var() fallback',
        offenders.length === 0, offenders);
}

console.log(failures ? `\n${failures} failed\n` : '\nAll checks passed.\n');
process.exit(failures ? 1 : 0);
