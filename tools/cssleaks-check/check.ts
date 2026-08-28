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
        // Self Study TV, same reasoning: a NEW globally loaded page stylesheet
        // starts at zero and is gated from its first commit. Every selector in
        // it is `iptv-`-prefixed and anchored on `.iptv-page` / `.iptv-watch`,
        // which is what makes a globally loaded sheet safe. Debt is only
        // tolerable where it predates the check.
        'iptv.css',
    ]);
    const LAYERS = new Set(['theme.css', 'responsive.css', 'default-layout.css',
        'exam-system.css', 'side-nav.css', 'style.css']);

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

console.log(failures === 0 ? '\nAll checks passed.\n' : `\n${failures} failed\n`);
process.exit(failures === 0 ? 0 : 1);
