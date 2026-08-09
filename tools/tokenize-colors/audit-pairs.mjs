/**
 * The one failure mode `check:theme` cannot see.
 *
 *   node tools/tokenize-colors/audit-pairs.mjs
 *
 * check:theme proves the PALETTE is readable — every token against the surface
 * it was derived for. What it cannot know is whether the stylesheets spend
 * those tokens in matched pairs. The dangerous shape is a block whose
 * background follows the theme while its text does not:
 *
 *     .card { background: rgb(var(--sfs-tint-rgb) / .08); color: #ffffff }
 *
 * In a dark galaxy the tint is white-on-black and the white text is correct.
 * In a light one the tint becomes near-black-on-white — a pale card — and that
 * hardcoded white ink is invisible. Nothing in the palette is wrong; the
 * pairing is. Every such block is a page that works in seven themes and is
 * blank in three, which is exactly the kind of thing that ships.
 *
 * Run after any change to the codemod or by hand to a stylesheet.
 */

import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const ROOT = process.cwd();

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) {
      if (['node_modules', 'dist', '.git'].includes(name)) continue;
      walk(p, out);
    } else if (name.endsWith('.css') || name.endsWith('.vue')) {
      out.push(p);
    }
  }
  return out;
}

function luminance(hex) {
  let h = hex.slice(1);
  if (h.length === 3) h = h.split('').map(c => c + c).join('');
  const n = parseInt(h.slice(0, 6), 16);
  const f = v => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * f((n >> 16) & 255) + 0.7152 * f((n >> 8) & 255) + 0.0722 * f(n & 255);
}

/** A background that changes with the galaxy. */
const FLIPS = /background[^;]*var\(--sfs-(?:tint-rgb|shade-rgb|surface|surface-2|surface-3|surface-rgb|space)\b/;

const offenders = [];
for (const file of walk(join(ROOT, 'src'))) {
  const text = readFileSync(file, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
  for (const block of text.matchAll(/\{([^{}]*)\}/g)) {
    const body = block[1];
    if (!FLIPS.test(body)) continue;
    for (const decl of body.matchAll(/(?:^|[;\s])color\s*:\s*(#[0-9a-fA-F]{3,6})\s*(?:!important)?\s*[;]/g)) {
      const hex = decl[1];
      // Light ink is the broken half. Dark ink on a flipping background is
      // equally wrong in principle, but the app has none — every dark literal
      // that survived the codemod is inside a light island.
      if (luminance(hex) > 0.5) {
        offenders.push(`${relative(ROOT, file)}  color: ${hex}`);
      }
    }
  }
}

if (offenders.length) {
  console.log(`\n${offenders.length} block(s) flip their background but keep a hardcoded light ink:\n`);
  for (const o of offenders) console.log('  ' + o);
  console.log('\nConvert the colour, or give the block a background that does not flip.\n');
} else {
  console.log('\nok — no block flips its background while keeping a hardcoded light ink.\n');
}

process.exit(offenders.length ? 1 : 0);
