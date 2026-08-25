/**
 * The RTL codemod: physical CSS properties -> logical ones.
 *
 *   node tools/i18n-wrap/logical.mjs            # report only
 *   node tools/i18n-wrap/logical.mjs --apply    # rewrite
 *
 * ============================================================
 * WHY LOGICAL PROPERTIES RATHER THAN AN `[dir="rtl"]` OVERRIDE SHEET
 * ============================================================
 *
 * The obvious way to make an app right-to-left is a stylesheet that re-states
 * every directional rule with the sides swapped. It is also the way that rots:
 * it doubles the number of places a spacing decision lives, every new rule
 * needs a matching override nobody remembers to write, and the override is
 * invisible until somebody switches language — which on this platform is a
 * reader, not a developer.
 *
 * `margin-inline-start` has no such failure mode. It is the SAME declaration in
 * both directions, so a rule written once is right in both, and a rule added
 * next year is right in both without anybody thinking about it. There is
 * nothing to keep in step, so nothing can fall out of step.
 *
 * 260-odd declarations across 41 stylesheets and 76 scoped blocks are converted
 * mechanically because that is what a mechanical change deserves, and because a
 * person doing it by hand gets `border-right` on line 1,400 of `netsim.css`
 * wrong once and nobody finds out.
 *
 * ============================================================
 * WHAT IT DELIBERATELY DOES NOT CONVERT, AND WHY EACH ONE WOULD BREAK
 * ============================================================
 *
 *  - **`left` / `right` / `inset`.** `inset-inline-start` is the correct
 *    translation of `left` for a positioned box and it is WRONG for the
 *    commonest use of it in this app: `left: 50%; transform: translateX(-50%)`
 *    is how eleven components centre something. Flipped to
 *    `inset-inline-start: 50%`, the 50% is measured from the right while the
 *    transform still pulls left, so the element lands off-centre by its own
 *    width. There is no way to tell that pattern from an ordinary offset
 *    without understanding the rule's intent, so all of them are left physical
 *    and `rtl.css` handles the ones that actually need to move.
 *  - **`transform: translateX(...)`.** A transform is geometry, not layout, and
 *    it does not flip. Anything that has to flip is in `rtl.css`.
 *  - **The 4-value `border-radius` shorthand.** There is no logical shorthand
 *    for four corners, so converting means expanding one declaration into four
 *    — a real change to specificity and to what a later rule overrides. Thirty
 *    occurrences, all cosmetic, none worth that.
 *  - **Anything whose value mentions `safe-area-inset`.** THIS ONE IS A TRAP
 *    and it is the only conversion here that would be actively harmful:
 *    `env(safe-area-inset-left)` is the physical left edge of the device — the
 *    notch is where it is regardless of what language is being read — so
 *    `padding-left: env(safe-area-inset-left)` is already correct and
 *    `padding-inline-start` would put the inset on the wrong side of an RTL
 *    page. `responsive.css` has four of them.
 */

import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const APPLY = process.argv.includes('--apply');

/** Straight property renames. Order matters: longest first. */
const PROPS = [
    ['border-top-left-radius', 'border-start-start-radius'],
    ['border-top-right-radius', 'border-start-end-radius'],
    ['border-bottom-left-radius', 'border-end-start-radius'],
    ['border-bottom-right-radius', 'border-end-end-radius'],
    ['margin-left', 'margin-inline-start'],
    ['margin-right', 'margin-inline-end'],
    ['padding-left', 'padding-inline-start'],
    ['padding-right', 'padding-inline-end'],
    ['border-left-width', 'border-inline-start-width'],
    ['border-right-width', 'border-inline-end-width'],
    ['border-left-style', 'border-inline-start-style'],
    ['border-right-style', 'border-inline-end-style'],
    ['border-left-color', 'border-inline-start-color'],
    ['border-right-color', 'border-inline-end-color'],
    ['border-left', 'border-inline-start'],
    ['border-right', 'border-inline-end'],
    ['scroll-margin-left', 'scroll-margin-inline-start'],
    ['scroll-margin-right', 'scroll-margin-inline-end'],
    ['scroll-padding-left', 'scroll-padding-inline-start'],
    ['scroll-padding-right', 'scroll-padding-inline-end'],
];

/** Value renames, applied per property. */
const VALUES = [
    [/(text-align\s*:\s*)left\b/g, '$1start'],
    [/(text-align\s*:\s*)right\b/g, '$1end'],
    [/(float\s*:\s*)left\b/g, '$1inline-start'],
    [/(float\s*:\s*)right\b/g, '$1inline-end'],
    [/(clear\s*:\s*)left\b/g, '$1inline-start'],
    [/(clear\s*:\s*)right\b/g, '$1inline-end'],
];

const counts = {};

function convert(css) {
    // Split on declarations so a value can be inspected before its property is
    // renamed. Anything not a declaration (a selector, an at-rule, a comment)
    // passes through untouched.
    return css.replace(/([-a-zA-Z]+)(\s*:\s*)([^;{}]*)(;|(?=\s*}))/g,
        (whole, prop, sep, value, end) => {
            // The `safe-area-inset` trap — see the header. Physical stays
            // physical. `--sfs-safe-left` / `--sfs-safe-right` are matched too:
            // `responsive.css` stores the four insets in custom properties, and
            // a value read out of one of those is exactly as physical as the
            // `env()` it came from. Today they are only spent in a `padding`
            // shorthand this does not touch, so this clause is closing the
            // trapdoor before somebody falls through it rather than after.
            if (/safe-area-inset|--sfs-safe-(left|right)/.test(value)) return whole;

            const lower = prop.toLowerCase();
            for (const [from, to] of PROPS) {
                if (lower === from) {
                    counts[from] = (counts[from] || 0) + 1;
                    return `${to}${sep}${value}${end}`;
                }
            }

            let out = `${prop}${sep}${value}${end}`;
            for (const [re, sub] of VALUES) {
                const next = out.replace(re, sub);
                if (next !== out) {
                    const name = re.source.match(/\(([-a-z]+)/)?.[1] || 'value';
                    counts[name] = (counts[name] || 0) + 1;
                    out = next;
                }
            }
            return out;
        });
}

/* ------------------------------------------------------------------ *
 * Files
 * ------------------------------------------------------------------ */

const files = [];
const walk = (dir, test) => {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
        const p = path.join(dir, e.name);
        if (e.isDirectory()) walk(p, test);
        else if (test(e.name)) files.push(p);
    }
};
walk(path.join(ROOT, 'src/assets/css'), n => n.endsWith('.css'));
walk(path.join(ROOT, 'src'), n => n.endsWith('.vue'));

let touched = 0;
for (const file of files) {
    const src = fs.readFileSync(file, 'utf8');
    let out;

    if (file.endsWith('.css')) {
        // `rtl.css` is the file whose whole job is to be physical. Converting
        // it would delete the corrections it exists to make.
        if (path.basename(file) === 'rtl.css') continue;
        out = convert(src);
    } else {
        // Only `<style>` blocks. A `.vue` file's template and script hold
        // strings and object keys that look exactly like CSS declarations —
        // `style="margin-left: 4px"` is fine to convert, `{ 'border-left': x }`
        // in a chart config is not, and neither is a `padding-right` inside a
        // comment explaining why something is the way it is.
        out = src.replace(/(<style[^>]*>)([\s\S]*?)(<\/style>)/g,
            (_, open, body, close) => open + convert(body) + close);
    }

    if (out === src) continue;
    touched++;
    if (APPLY) fs.writeFileSync(file, out);
    else console.log(`would change  ${path.relative(ROOT, file)}`);
}

console.log('');
console.log(`files ${APPLY ? 'rewritten' : 'to rewrite'} : ${touched}`);
console.log('conversions       :', JSON.stringify(counts, null, 0));
