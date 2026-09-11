// Verifies that no page stylesheet can cover another page's content.
//
//   npm run check:cssleaks
//
// This exists because of a real outage, and the shape is worth stating plainly.
//
// `roblox-tool.css` is loaded with a bare `<style src>` — not `scoped` — and in
// production every page stylesheet is concatenated into one file that is always
// present. So its `.placeholder { position: absolute; top/right/bottom/left: 0 }`
// applied on **every page of the platform**. `ScheduleExam.vue`'s "Please select a
// date to see available time slots" panel is `class="time-selector placeholder"`,
// and `.step-content` is `position: relative` — so that panel was lifted out of
// the grid and stretched across the whole step, on top of the calendar.
//
// Every available date was unclickable. A click landed on the label. It looked
// exactly like "the dates are disabled", which is how it was reported, and it
// pointed every investigation at the calendar and at app 21's availability rather
// than at a stylesheet belonging to an unrelated feature.
//
// It also hid for a long time: the calendar had no selectable dates for a
// different reason entirely (app 21's availability window never rolled forward),
// so there was nothing to click and nothing to notice.
//
// WHAT IS FLAGGED, and why it is this narrow rather than "no unscoped selectors":
// these stylesheets are historically global and there are ~127 bare selectors
// with `position: absolute`. Almost all are harmless, so gating on them would be
// noise nobody could act on. The dangerous shape is specific:
//
//   * a REAL element, not `::before` / `::after` — a pseudo-element can only
//     cover its own box, never a neighbouring page's content;
//   * pinned on ALL SIDES (`inset: 0`, three-plus zero offsets, or 100%/100%) —
//     that is what turns it into a sheet over its containing block;
//   * NOT anchored to a page root — so it escapes its own page;
//   * and the class is used by TWO OR MORE views — which is what makes it a
//     collision rather than one page's private business.
//
// That is exactly the `.placeholder` bug and almost nothing else.

import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, basename, resolve } from 'node:path';

let failures = 0;
function check(label: string, ok: boolean, detail?: unknown) {
    if (!ok) failures++;
    console.log(`  ${ok ? 'ok  ' : 'FAIL'}  ${label}${ok ? '' : '  ' + JSON.stringify(detail, null, 2)}`);
}

/**
 * Known and accepted, with a reason each. Anything NOT here fails the build.
 *
 * An explicit list rather than a cleverer heuristic: there are two, both are one
 * feature's own consistently-prefixed classes, and a reader can check the
 * reasoning in a second. A heuristic that silently absolved them would also
 * silently absolve the next `.placeholder`.
 */
const ACCEPTED: Record<string, string> = {
    // `ns-` is the Network Simulator's namespace and every one of the nine files
    // using it belongs to that feature (roots `netsim-hub` / `ns-studio`, plus its
    // own components). Nothing outside netsim writes an `ns-` class.
    'netsim.css .ns-btn.file input': 'ns- is the netsim namespace; only netsim uses it',
    'netsim.css .ns-modal-backdrop': 'ns- is the netsim namespace; only netsim uses it',
};

/** Stylesheets that are token or layout layers rather than one page's styles. */
const NOT_A_PAGE = new Set([
    'theme.css', 'responsive.css', 'default-layout.css', 'exam-system.css',
    // ui.css is the shared component floor, not a page: every class it owns is
    // `sfs-`-prefixed precisely so it cannot collide with a page's, which is
    // the property this check exists to protect.
    'ui.css',
]);

const root = resolve(process.cwd());
const cssDir = join(root, 'src/assets/css');

function walk(dir: string): string[] {
    let out: string[] = [];
    for (const name of readdirSync(dir)) {
        const full = join(dir, name);
        if (statSync(full).isDirectory()) out = out.concat(walk(full));
        else out.push(full);
    }
    return out;
}

// ---------------------------------------------------------------------------
// Which classes each view uses, and which classes are page roots.
// ---------------------------------------------------------------------------
const pageRoots = new Set<string>();
const usedBy = new Map<string, Set<string>>();

const vueFiles = [
    ...walk(join(root, 'src/views')),
    ...walk(join(root, 'src/components')),
].filter(f => f.endsWith('.vue'));

for (const file of vueFiles) {
    const src = readFileSync(file, 'utf8');
    const end = src.indexOf('</template>');
    const template = end > 0 ? src.slice(0, end) : src;

    const rootMatch = src.match(/<template>\s*<div class="([a-z0-9-]+)"/);
    if (rootMatch) pageRoots.add(rootMatch[1]);

    for (const m of template.matchAll(/class="([^"]+)"/g)) {
        for (const cls of m[1].split(/\s+/)) {
            if (!/^[a-z][a-z0-9-]*$/.test(cls)) continue;
            if (!usedBy.has(cls)) usedBy.set(cls, new Set());
            usedBy.get(cls)!.add(basename(file));
        }
    }
}

console.log('\n1. There is something to check');
check('page roots were found', pageRoots.size > 20, pageRoots.size);
check('template classes were collected', usedBy.size > 200, usedBy.size);

// ---------------------------------------------------------------------------
// The scan.
// ---------------------------------------------------------------------------
/** Does this rule body turn the element into a sheet over its containing block? */
function stretchesOverParent(body: string): boolean {
    if (/inset\s*:\s*0/.test(body)) return true;
    const zeroed = ['top', 'right', 'bottom', 'left']
        .filter(side => new RegExp(`(^|;|\\s)${side}\\s*:\\s*0`).test(body));
    if (zeroed.length >= 3) return true;
    return /width\s*:\s*100%/.test(body) && /height\s*:\s*100%/.test(body);
}

const offenders: string[] = [];
const seen = new Set<string>();

for (const name of readdirSync(cssDir).filter(f => f.endsWith('.css'))) {
    if (NOT_A_PAGE.has(name)) continue;
    const css = readFileSync(join(cssDir, name), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');

    for (const rule of css.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
        const body = rule[2];
        if (!/position:\s*(absolute|fixed)/.test(body)) continue;
        if (!stretchesOverParent(body)) continue;

        for (const raw of rule[1].split(',')) {
            const sel = raw.trim();
            if (!sel || sel.startsWith('@')) continue;
            if (/::?(before|after)\b/.test(sel)) continue;          // covers only itself
            if ([...pageRoots].some(r => sel.includes('.' + r))) continue;   // scoped

            const lead = sel.match(/^\.([a-z][a-z0-9-]*)/)?.[1];
            if (!lead) continue;
            const users = usedBy.get(lead);
            if (!users || users.size < 2) continue;                 // one page's business

            const key = `${name} ${sel}`;
            if (seen.has(key)) continue;
            seen.add(key);
            if (ACCEPTED[key]) continue;
            offenders.push(`${key}   (.${lead} is used by ${users.size} views: `
                + `${[...users].slice(0, 6).join(', ')})`);
        }
    }
}

console.log('\n2. No page stylesheet can cover another page');
check('no unscoped, all-sides-pinned selector is shared between views',
    offenders.length === 0, offenders);

console.log('\n3. The rule that caused the outage stays scoped');
{
    const roblox = readFileSync(join(cssDir, 'roblox-tool.css'), 'utf8');
    // A bare `.placeholder {` at the start of a line is the exact regression.
    check('roblox-tool.css does not declare a bare .placeholder',
        !/^\s*\.placeholder\s*[,{]/m.test(roblox));
    check('and it still styles its own, under the page root',
        /\.roblox-tool\s+\.placeholder\s*\{/.test(roblox));

    const schedule = readFileSync(join(cssDir, 'schedule-exam.css'), 'utf8');
    // Belt and braces on the victim's side: this panel is a grid ITEM and must
    // stay in flow whatever any other stylesheet decides `.placeholder` means.
    check('the schedule-exam placeholder panel pins itself into flow',
        /\.time-selector\.placeholder\s*\{[^}]*position:\s*static/m.test(schedule));
}

console.log('\n4. Every accepted exception is still real');
{
    // An allowlist that outlives the thing it excuses is how a check rots.
    const stale = Object.keys(ACCEPTED).filter(key => !seen.has(key));
    check('no accepted exception has become obsolete', stale.length === 0, stale);
}

console.log('\n5. A globally loaded page stylesheet stays on its own page');
{
    // The second instance of the same family, and the one that showed section 2's
    // definition was too narrow.
    //
    // `exam-approval.css` carried a bare, unscoped
    // `.header-content { flex-direction: column }`. It is loaded with a JS import,
    // so it is global - and `.header-content` is a class eight views use. On the
    // Take Exam page that one declaration turned `.exam-info`'s `flex: 1 1 240px`
    // from a 240px-wide basis into a 240px-TALL one, and the sticky header became
    // **389px on a 1440x900 desktop (43% of the viewport)** and 411px (72%) at
    // 320px, with the question scrolling underneath it. Reported as "the header
    // height too long and cover the exam question".
    //
    // Section 2 above did not catch it: nothing was positioned or pinned. The
    // common factor with `.placeholder` is not `position` - it is a bare selector
    // in a stylesheet that escapes its page, landing on a class name somebody else
    // uses. So this checks the general shape.
    //
    // WHY IT IS SPLIT INTO GATED AND REPORTED. Only a stylesheet loaded by a JS
    // `import` is global; one reached through `@import` inside a scoped block, or
    // `<style scoped src>`, is scoped by Vite and cannot leak. Of the globally
    // loaded ones the eight exam-system files are at zero and must stay there, so
    // those FAIL the build. Six others (login, notifications, register,
    // user-certificate, user-chat, verify-email) still leak 47 classes between
    // them; that is real debt on pages outside this system, and it is REPORTED
    // with counts rather than gated - a check that fails on 47 pre-existing things
    // nobody is fixing today is a check somebody switches off.

    const GATED = new Set([
        'exams.css', 'schedule-exam.css', 'exam-approval.css', 'take-exam.css',
        'proctor-dashboard.css',
        // The leaderboard is a NEW globally loaded page stylesheet, so it starts
        // at zero and is gated from the first commit. Every selector in it is
        // `lb-`-prefixed, a namespace no other view uses, which is what makes a
        // globally loaded sheet safe. Debt is only tolerable where it predates
        // the check.
        'leaderboard.css',
        // Added with the activity record. Gated from the day it was written,
        // which is the only time that is cheap: every class in it is
        // `lb-sheet`-, `lb-feed`-, `lb-conduct`- or `lb-list`-prefixed and used
        // by exactly one file, so there is no debt to grandfather in.
        'leaderboard-activity.css',
    ]);
    const LAYERS = new Set(['theme.css', 'responsive.css', 'default-layout.css',
        'exam-system.css', 'side-nav.css', 'style.css', 'ui.css']);

    // Which stylesheets are imported from a script (global) rather than from a
    // style block (scoped)?
    const vueFilesAll = vueFiles;
    const globalSheets = new Set<string>();
    for (const file of vueFilesAll) {
        const src = readFileSync(file, 'utf8');
        const cut = src.lastIndexOf('</script>');
        const script = cut > 0 ? src.slice(0, cut) : src;
        for (const m of script.matchAll(/import\s+'@\/assets\/css\/([^']+)'/g)) {
            globalSheets.add(m[1]);
        }
    }
    check('the globally imported stylesheets were found', globalSheets.size > 5,
        [...globalSheets]);

    const leaks = new Map<string, string[]>();
    for (const name of globalSheets) {
        if (LAYERS.has(name)) continue;
        let css: string;
        try { css = readFileSync(join(cssDir, name), 'utf8'); } catch { continue; }
        css = css.replace(/\/\*[\s\S]*?\*\//g, '');
        const bad = new Set<string>();
        for (const rule of css.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
            for (const raw of rule[1].split(',')) {
                const sel = raw.trim();
                if (!sel || sel.startsWith('@') || /^\d/.test(sel)
                    || sel === 'from' || sel === 'to') continue;
                if ([...pageRoots].some(r => sel.includes('.' + r))) continue;
                const lead = sel.match(/^\.([a-z][a-z0-9-]*)/)?.[1];
                if (!lead) continue;
                const users = usedBy.get(lead);
                if (!users || users.size < 2) continue;   // one page's own business
                bad.add(lead);
            }
        }
        if (bad.size) leaks.set(name, [...bad]);
    }

    const gatedLeaks = [...leaks.entries()]
        .filter(([name]) => GATED.has(name))
        .map(([name, classes]) => `${name}: ${classes.join(', ')}`);
    check('every exam-system stylesheet anchors its selectors on its page root',
        gatedLeaks.length === 0, gatedLeaks);

    const rest = [...leaks.entries()].filter(([name]) => !GATED.has(name));
    if (rest.length) {
        const total = rest.reduce((n, [, c]) => n + c.length, 0);
        console.log(`  note  ${total} classes still leak from ${rest.length} other `
            + `globally loaded stylesheets (not gated, see the comment):`);
        for (const [name, classes] of rest.sort((a, b) => b[1].length - a[1].length)) {
            console.log(`          ${name.padEnd(24)} ${String(classes.length).padStart(3)}  `
                + classes.slice(0, 6).join(', '));
        }
    }
}

console.log('\n6. The Take Exam header cannot grow back');
{
    // The page must state `flex-direction` on the container another stylesheet got
    // at. Specificity is no defence for a property you never declared: take-exam's
    // own `.take-exam-page .header-content` is more specific than a bare
    // `.header-content`, and it lost anyway because it said nothing about the axis.
    const takeExam = readFileSync(join(cssDir, 'take-exam.css'), 'utf8');
    const block = takeExam.match(/\.take-exam-page \.header-content\s*\{[^}]*\}/);
    check('take-exam.css declares its own header axis', !!block && /flex-direction:\s*row/.test(block[0]),
        block ? block[0].slice(0, 160) : null);
    check('and the question card clears the sticky header when scrolled to',
        /scroll-margin-top:/.test(takeExam));
}

console.log('\n7. The shared component floor only owns names nobody else can use');
{
    // ui.css is loaded from main.ts, so it is global on every page — the same
    // exposure `.placeholder` had. It is exempted from section 2 as a layer, so
    // this is what keeps that exemption honest: every CLASS it invents must be
    // `sfs-`-prefixed, a namespace no view writes, and the only unprefixed
    // classes it may touch are ones it is deliberately defining platform-wide.
    //
    // `.glass-effect` is the one such name. ~30 templates use it and it had
    // THREE competing definitions (theme.css, style.css twice behind
    // `.dark-mode`, and a non-scoped block inside App.vue) with three different
    // alphas and blur radii, so which one won depended on the order Vite
    // happened to emit the chunks in. Defining it once, centrally, is the fix.
    const ALLOWED_UNPREFIXED = new Set(['glass-effect']);

    const ui = readFileSync(join(cssDir, 'ui.css'), 'utf8')
        .replace(/\/\*[\s\S]*?\*\//g, '');
    const owned = new Set<string>();
    for (const rule of ui.matchAll(/([^{}]+)\{[^{}]*\}/g)) {
        for (const raw of rule[1].split(',')) {
            const sel = raw.trim();
            if (!sel || sel.startsWith('@') || /^\d/.test(sel)
                || sel === 'from' || sel === 'to') continue;
            for (const m of sel.matchAll(/\.([a-z][a-z0-9-]*)/g)) {
                if (m[1].startsWith('sfs-')) continue;
                if (ALLOWED_UNPREFIXED.has(m[1])) continue;
                owned.add(m[1]);
            }
        }
    }
    check('ui.css declares no class outside the sfs- namespace', owned.size === 0, [...owned]);

    // A floor that can win an argument is not a floor. An `!important` in here
    // would reach into 46 page stylesheets it has never seen, which is exactly
    // how a globally loaded sheet stops being safe to load. The two exceptions
    // are the blocks where the thing being overridden is the browser or the
    // printer rather than another stylesheet.
    const guarded = ui.split(/@media\s*\(forced-colors: active\)|@media print/);
    const outside = guarded[0];
    check('ui.css uses no !important outside its forced-colors and print blocks',
        !outside.includes('!important') && guarded.length === 3,
        { sections: guarded.length, firstOffender: outside.split('\n').find(l => l.includes('!important')) });
}

console.log('\n8. A field has ONE boundary, and it is the field\'s own edge');
{
    /*
      The third family, and the one that was true of the whole platform rather
      than of one page.

      `:focus` in style.css and `:focus-visible` in theme.css both draw
      `outline: 2px solid; outline-offset: 2px`. That is right for a button, a
      link or a card — they have no border for it to be concentric with, and the
      gap is what makes the ring visible on top of a fill. Around a TEXT FIELD,
      which already has a 1px border, it is a line, a transparent gap and a
      second line, at two different corner radii.

      Measured on the live bundle before this check existed: focusing the
      sidebar search drew THREE edges — the field's border, a 3px ring, and a
      bright 2px rounded rectangle around the bare `<input>` INSIDE the field,
      cutting across the search icon and the clear button. It was reported as
      "2 borders appear in the search-input, the shape is ugly".

      ui.css now turns the outline off for form controls at (0,1,1), which beats
      both global rules on specificity alone — deliberately not on source order,
      because the order is not what anybody assumes: the production bundle emits
      every component and page stylesheet BEFORE the sheets main.ts imports, so
      `side-nav.css`'s own `.search-input { outline: none }` was LOSING to
      theme.css. What ui.css cannot beat is a page rule at (0,2,x), and there
      were twelve of those. This is what stops a thirteenth.

      WHAT IS FLAGGED: a rule that targets a text-entry control and declares a
      NON-ZERO `outline-offset`. Offset zero is flush against the border and is
      a single edge, so it is allowed — it is what the `prefers-contrast` and
      `forced-colors` blocks in ui.css use. The widgets that are not text
      fields keep their offset ring and are exempt by name: a checkbox, a radio,
      a slider, a colour well, a file picker and `input[type=submit]` have no
      border to double up with.
    */
    const NOT_A_TEXT_FIELD = /\[type\s*=\s*['"]?(checkbox|radio|range|color|file|submit|reset|button|image)['"]?\]/i;
    const TEXT_FIELD = /(^|[\s,>+~(])(input|textarea|select)\b|[-_]input\b|[-_]textarea\b|[-_]select\b|__input|__textarea/i;

    /*
      EVERY SHEET, INCLUDING THE ONES INSIDE COMPONENTS.

      The first version of this scanned `src/assets/css` and `style.css` only,
      and that blind spot held two live offenders — `DrawBoard.vue`'s title
      field, and `ChatBox.vue`'s composer, which is the support widget and is
      therefore on EVERY page of the platform with an offset ring plus a 4px
      shadow around a bordered input. Scoping does not help here: a `<style
      scoped>` rule still draws a second ring, it just does it on one page.
    */
    const sheets: Array<[string, string]> = [];
    for (const name of readdirSync(cssDir).filter(f => f.endsWith('.css'))) {
        sheets.push([name, readFileSync(join(cssDir, name), 'utf8')]);
    }
    sheets.push(['style.css', readFileSync(join(root, 'src/style.css'), 'utf8')]);
    for (const file of vueFiles) {
        const src = readFileSync(file, 'utf8');
        for (const block of src.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/g)) {
            sheets.push([basename(file), block[1]]);
        }
    }

    const doubled: string[] = [];
    for (const [label, raw] of sheets) {
        // Comments are stripped first: this file documents the shape it forbids,
        // and a check that fires on the paragraph explaining it is a check
        // nobody can document.
        const css = raw.replace(/\/\*[\s\S]*?\*\//g, '');
        for (const rule of css.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
            const body = rule[2];
            const offset = body.match(/outline-offset\s*:\s*([^;]+)/);
            if (!offset) continue;
            const value = offset[1].trim();
            if (value === '0' || /^0[a-z%]*$/.test(value)) continue;   // flush: one edge
            for (const raw of rule[1].split(',')) {
                const sel = raw.trim();
                if (!sel || sel.startsWith('@')) continue;
                if (!TEXT_FIELD.test(sel)) continue;
                if (NOT_A_TEXT_FIELD.test(sel)) continue;
                doubled.push(`${label}   ${sel}   { outline-offset: ${value} }`);
            }
        }
    }
    check('the scan reached the component style blocks too',
        sheets.length > readdirSync(cssDir).length, sheets.length);
    check('no stylesheet gives a text field an offset focus outline',
        doubled.length === 0, doubled);

    // The contract itself, so it cannot be deleted by somebody tidying up.
    const ui = readFileSync(join(cssDir, 'ui.css'), 'utf8');
    const contract = ui.match(/input:focus,[\s\S]{0,400}?\{[^}]*\}/);
    check('ui.css turns the outline off for text fields',
        !!contract && /outline:\s*none/.test(contract[0]), contract?.[0].slice(0, 120));
    check('...and draws the one indicator from --sfs-field-ring',
        !!contract && /box-shadow:\s*var\(--sfs-field-ring/.test(contract[0]));
    check('...and makes the focused border visibly different from the resting one',
        !!contract && /border-color:\s*var\(--sfs-focus/.test(contract[0]));

    const theme = readFileSync(join(cssDir, 'theme.css'), 'utf8')
        .replace(/\/\*[\s\S]*?\*\//g, '');
    const ring = theme.match(/--sfs-field-ring:\s*([^;]+);/);
    check('theme.css declares --sfs-field-ring', !!ring, ring?.[1]);
    // The whole point of the token: the crisp layer is FLUSH (offset 0, spread
    // 1px) and the prominence comes from a BLURRED layer, which has no edge and
    // therefore cannot read as a second border. A second hard ring in here
    // would put the reported bug back for every field at once.
    check('...as one flush ring plus a blurred halo, not two hard rings',
        !!ring && /0 0 0 1px/.test(ring[1]) && (ring[1].match(/0 0 0 \d/g) || []).length === 1,
        ring?.[1]);
}

console.log('\n9. A bare field inside a shell draws nothing of its own');
{
    /*
      The other half of section 8, and the half that a global rule creates.

      A search box on this platform is usually a bordered flex row holding an
      icon, a borderless input and a clear button — `.search-field` in the
      sidebar, `.sl-search`, `.lb-search`, `.search-input-wrapper`, the AI chat
      composer, both terminals. There the SHELL carries the border and the focus
      ring, and an indicator on the input inside it is a ring floating in the
      middle of a box.

      ui.css's field contract gives every `input:focus` a `box-shadow`, so every
      one of those inputs has to say `box-shadow: none` for itself — and at a
      specificity that beats (0,1,1), which for `.sl-console__input` and
      `.search-input` means two classes rather than one, because those files are
      emitted BEFORE ui.css and a tie goes to the later sheet.

      A terminal is the sharpest case: the line being typed is the last line of
      the transcript, so a ring around it is a rounded pill drawn across the
      width of the terminal next to the prompt. That is exactly what "there is a
      green border around the input field that looks unnatural" was.
    */
    const TEXT_FIELD = /(^|[\s,>+~(])(input|textarea|select)\b|[-_]input\b|[-_]textarea\b|__input/i;
    const unguarded: string[] = [];

    for (const name of readdirSync(cssDir).filter(f => f.endsWith('.css'))) {
        if (name === 'ui.css' || name === 'theme.css') continue;
        const css = readFileSync(join(cssDir, name), 'utf8')
            .replace(/\/\*[\s\S]*?\*\//g, '');

        // Every selector in this file that switches its own border off.
        const bare: string[] = [];
        for (const rule of css.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
            if (!/border\s*:\s*(0|none)\b/.test(rule[2])) continue;
            for (const raw of rule[1].split(',')) {
                const sel = raw.trim();
                if (!sel || sel.startsWith('@') || /:focus/.test(sel)) continue;
                if (!TEXT_FIELD.test(sel)) continue;
                bare.push(sel);
            }
        }
        if (!bare.length) continue;

        // Every selector in this file that suppresses the ring on focus.
        const guarded: string[] = [];
        for (const rule of css.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
            if (!/box-shadow\s*:\s*none/.test(rule[2])) continue;
            for (const raw of rule[1].split(',')) {
                const sel = raw.trim();
                if (/:focus/.test(sel)) guarded.push(sel.replace(/:focus(-visible)?/g, '').trim());
            }
        }

        for (const sel of new Set(bare)) {
            // The guard may be written more specifically than the bare rule —
            // `.sl-console .sl-console__input` guards `.sl-console__input` —
            // so a suffix match is what "the same element" means here.
            const covered = guarded.some(g => g === sel || g.endsWith(' ' + sel)
                || sel.endsWith(' ' + g) || g.includes(sel));
            if (!covered) unguarded.push(`${name}   ${sel}`);
        }
    }
    check('every borderless field switches the shared focus ring off',
        unguarded.length === 0, unguarded);
}

console.log('\n10. The sidebar search is one control, not three');
{
    // The reported bug, asserted from both ends. The shell owns the indicator
    // and the input owns nothing — and the input's rule has to be TWO classes,
    // because `.search-input { outline: none }` is (0,1,0), theme.css's
    // `:focus-visible` is also (0,1,0), and this file is emitted first.
    const nav = readFileSync(join(cssDir, 'side-nav.css'), 'utf8')
        .replace(/\/\*[\s\S]*?\*\//g, '');

    const shell = nav.match(/\.search-field:focus-within\s*\{[^}]*\}/);
    check('the search field carries the one focus indicator',
        !!shell && /box-shadow:\s*var\(--sfs-field-ring/.test(shell[0]),
        shell?.[0]);
    check('...and no hard ring of its own beside it',
        !!shell && !/box-shadow:\s*0 0 0 \d+px rgb/.test(shell[0]), shell?.[0]);

    const inner = nav.match(/\.search-field \.search-input:focus[\s\S]{0,120}?\{[^}]*\}/);
    check('the input inside it draws nothing, at two classes so it wins',
        !!inner && /outline:\s*none/.test(inner[0]) && /box-shadow:\s*none/.test(inner[0]),
        inner?.[0]);
}

console.log(failures === 0 ? '\nAll checks passed.\n' : `\n${failures} failed\n`);
process.exit(failures === 0 ? 0 : 1);
