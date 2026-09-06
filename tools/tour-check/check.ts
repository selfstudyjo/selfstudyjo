// Verifies the guided tour without a browser.
//
//   npm run check:tour
//
// WHAT IS WORTH ASSERTING, AND WHY NONE OF IT IS VISIBLE IN A SCREENSHOT
//
// A tour looks fine right up until the moment it does not, and every one of its
// failures is silent:
//
//  * **a step pointing at nothing.** Half these screens render conditionally -
//    signed out, no subscription, empty, still loading - so a selector that
//    matched yesterday matches nothing today, and a box drawn round nothing is
//    a tour describing something the reader cannot find. Both directions are
//    asserted: a resolvable step survives and an unresolvable one is dropped,
//    because a filter that dropped everything would also pass the first half.
//  * **an empty tour.** Every path has to produce at least one step whatever
//    the DOM says, or the button does nothing and reads as broken.
//  * **the wrong chapter.** `/courses` against `/course/:id` and `/plans`
//    against `/my-plans` are both real pairs here, and a bare `startsWith`
//    gets both wrong.
//  * **a caption off the edge of the screen, or on top of its own target.**
//    The first is a tour that has silently stopped working and the second is a
//    tour explaining a rectangle the reader cannot see. Checked at 320px, which
//    is where neither fits and the fallback is all there is.
//  * **an untranslated caption.** Every string is spent through a variable, so
//    `check:i18n` cannot see the literal - `TOUR_KEYS` is what it verifies
//    against, and it is derived here rather than written twice.

import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import {
    ALL_CHAPTERS,
    GAP,
    MARGIN,
    PLATFORM_STEPS,
    TOUR_KEYS,
    chapterFor,
    connector,
    edgePoint,
    isPointable,
    isUnder,
    MAX_TARGET_SHARE,
    normalisePath,
    overlaps,
    placeCard,
    stepsFor,
    targetFor,
    titleFor,
    visibleSteps,
    type Placement,
    type Rect,
    type TourStep,
} from '../../src/utils/tourSteps';

let failures = 0;
function check(label: string, ok: boolean, detail?: unknown) {
    if (!ok) failures++;
    console.log(`  ${ok ? 'ok  ' : 'FAIL'}  ${label}${ok ? '' : '  ' + JSON.stringify(detail)}`);
}
function section(title: string) {
    console.log(`\n${title}\n${'-'.repeat(title.length)}`);
}

const source = (relative: string) =>
    readFileSync(resolve(process.cwd(), relative), 'utf8');

/* ------------------------------------------------------------------ *
 * 1. The catalogue
 * ------------------------------------------------------------------ */

section('1. The chapters are coherent');
{
    const ids = ALL_CHAPTERS.map(c => c.id);
    check('every chapter id is unique', new Set(ids).size === ids.length, ids);
    check('every chapter has a title and at least one step',
        ALL_CHAPTERS.every(c => !!c.title && c.steps.length > 0),
        ALL_CHAPTERS.filter(c => !c.steps.length).map(c => c.id));

    for (const chapter of ALL_CHAPTERS) {
        const stepIds = chapter.steps.map(s => s.id);
        check(`${chapter.id}: step ids are unique within the chapter`,
            new Set(stepIds).size === stepIds.length, stepIds);
    }
    const tailIds = PLATFORM_STEPS.map(s => s.id);
    check('the platform tail has unique ids too',
        new Set(tailIds).size === tailIds.length, tailIds);

    const all = [...ALL_CHAPTERS.flatMap(c => c.steps), ...PLATFORM_STEPS];
    check('every step has a title and a body to print',
        all.every(s => !!s.title && !!s.body),
        all.filter(s => !s.title || !s.body).map(s => s.id));
    // A title that IS the body is a step somebody meant to come back to.
    check('and they are different sentences',
        all.every(s => s.title !== s.body));
    check('every selector is a plain CSS selector rather than a path or a URL',
        all.flatMap(s => s.target ?? [])
            .every(sel => /^[.#[a-zA-Z]/.test(sel) && !sel.includes('http')),
        all.flatMap(s => s.target ?? []).filter(sel => sel.includes('http')));
    check('every declared placement is a real one',
        all.every(s => !s.prefer
            || ['top', 'bottom', 'left', 'right', 'center'].includes(s.prefer)),
        all.filter(s => s.prefer
            && !['top', 'bottom', 'left', 'right', 'center'].includes(s.prefer))
            .map(s => s.id));

    /*
      THE TOUR CAN NEVER BE EMPTY.

      The platform tail's first step has to work on a page where nothing else
      does - a signed-out reader on a route with no chapter and no sidebar. It
      is the only guarantee `stepsFor` has, and without it the button reads as
      broken on exactly the pages a newcomer is most likely to press it.
    */
    check('at least one step in the platform tail needs no target at all',
        PLATFORM_STEPS.some(s => !s.target?.length)
        || ALL_CHAPTERS.every(c => c.steps.some(s => !s.target?.length)),
        PLATFORM_STEPS.map(s => s.id));

    // The last step points at the button, so a reader learns it can be replayed.
    check('the tail ends by naming the button that starts it',
        PLATFORM_STEPS[PLATFORM_STEPS.length - 1]?.target?.[0] === '.sfs-tour-btn',
        PLATFORM_STEPS[PLATFORM_STEPS.length - 1]);
}

/* ------------------------------------------------------------------ *
 * 2. Choosing the chapter
 * ------------------------------------------------------------------ */

section('2. The right chapter, by longest match and by segment');
{
    check('the dashboard is the dashboard', chapterFor('/').id === 'home');
    check('and `/` does not swallow every other page',
        chapterFor('/courses').id === 'courses'
        && chapterFor('/exams').id === 'exams');

    // THE PAIRS A BARE startsWith GETS WRONG, and both exist on this platform.
    check('/courses is the catalogue and /course/:id is one course',
        chapterFor('/courses').id === 'courses'
        && chapterFor('/course/abc').id === 'course');
    check('/plans is not /my-plans by accident',
        chapterFor('/plans').id === 'plans'
        && chapterFor('/my-plans').id === 'plans');
    check('/labs is the catalogue and /lab/:id is a workspace',
        chapterFor('/labs').id === 'labs'
        && chapterFor('/lab/lin-01').id === 'lab');

    // LONGEST MATCH, not array order. `/course` and `/course/:id/lesson` both
    // claim the path; resolving that by position makes the answer depend on
    // where somebody happened to add a chapter.
    check('a lesson gets the lesson chapter and not the course one',
        chapterFor('/course/c1/lesson/l1').id === 'lesson',
        chapterFor('/course/c1/lesson/l1').id);
    check('while the course page still gets the course one',
        chapterFor('/course/c1').id === 'course');

    check('a query string and a hash are ignored',
        chapterFor('/labs?track=docker#top').id === 'labs');
    check('and a trailing slash', chapterFor('/courses/').id === 'courses');
    check('normalisePath leaves the root alone',
        normalisePath('/') === '/' && normalisePath('') === '/');

    check('an unknown page gets the generic chapter rather than nothing',
        chapterFor('/something/nobody/wrote').id === 'page');
    check('and it still has a title to print',
        !!titleFor('/something/nobody/wrote'));

    check('isUnder is segment aware',
        isUnder('/course/1', '/course') && !isUnder('/courses', '/course'));
    check('and the root matches only itself',
        isUnder('/', '/') && !isUnder('/courses', '/'));

    check('every path gets at least one step',
        ['/', '/courses', '/exams', '/labs', '/lab/x', '/tools', '/leaderboard',
            '/plans', '/notifications', '/newscast', '/ai-chat', '/messages',
            '/profile', '/certificates', '/my-results', '/take-exam',
            '/nowhere', '/research/library']
            .every(path => stepsFor(path).length > 0));
    check('and the platform tail is on every one of them',
        stepsFor('/nowhere').some(s => s.id === 'replay')
        && stepsFor('/').some(s => s.id === 'replay'));
    check('the page comes first and the platform second - the reader asked '
        + 'about this page',
        stepsFor('/leaderboard')[0]!.id !== 'sidebar');
}

/* ------------------------------------------------------------------ *
 * 3. A step that points at nothing is dropped
 * ------------------------------------------------------------------ */

section('3. Nothing is described that is not on the page');
{
    const steps: TourStep[] = [
        { id: 'a', title: 't', body: 'b' },
        { id: 'b', target: ['.here'], title: 't', body: 'b' },
        { id: 'c', target: ['.gone'], title: 't', body: 'b' },
        { id: 'd', target: ['.gone', '.here'], title: 't', body: 'b' },
    ];
    const present = (sel: string) => sel === '.here';
    const kept = visibleSteps(steps, present).map(s => s.id);

    check('a step with no target is always kept', kept.includes('a'));
    check('a step whose target is there is kept', kept.includes('b'));
    // THE OTHER DIRECTION, and without it a filter that dropped everything
    // would pass the two checks above.
    check('a step whose target is NOT there is dropped', !kept.includes('c'), kept);
    check('and a step falls back to its second selector, so a renamed class '
        + 'costs a selector rather than a step',
        kept.includes('d'), kept);
    check('targetFor answers the first selector that resolves',
        targetFor(steps[3]!, present) === '.here');
    check('and an empty string when none does',
        targetFor(steps[2]!, present) === '');

    check('with nothing on the page at all there is still a tour',
        visibleSteps(stepsFor('/'), () => false).length > 0,
        visibleSteps(stepsFor('/'), () => false).map(s => s.id));
    check('and with everything on the page nothing is lost',
        visibleSteps(stepsFor('/'), () => true).length === stepsFor('/').length);
}

/* ------------------------------------------------------------------ *
 * 4. Where the caption goes
 * ------------------------------------------------------------------ */

section('4. The caption is on the screen, and not on the target');
{
    const CARD = { width: 340, height: 220 };
    const DESKTOP = { width: 1440, height: 900 };
    const PHONE = { width: 320, height: 568 };

    const boxOf = (at: { x: number; y: number; placement: Placement }): Rect =>
        ({ x: at.x, y: at.y, width: CARD.width, height: CARD.height });
    const inside = (r: Rect, view: { width: number; height: number }) =>
        r.x >= 0 && r.y >= 0
        && r.x + r.width <= view.width && r.y + r.height <= view.height;

    check('no target at all centres the caption',
        placeCard(null, CARD, DESKTOP).placement === 'center');
    check('and centring is inside the viewport',
        inside(boxOf(placeCard(null, CARD, DESKTOP)), DESKTOP));

    const middle: Rect = { x: 600, y: 380, width: 200, height: 80 };
    check('the preferred side is honoured when it fits',
        placeCard(middle, CARD, DESKTOP, 'right').placement === 'right');
    check('and so is the other one',
        placeCard(middle, CARD, DESKTOP, 'top').placement === 'top');

    // The four edges. Each one makes the preferred side impossible, and the
    // fallback has to find another - not hang the caption off the screen.
    const edges: Record<string, Rect> = {
        'top edge': { x: 600, y: 4, width: 200, height: 60 },
        'bottom edge': { x: 600, y: 840, width: 200, height: 56 },
        'left edge': { x: 0, y: 400, width: 60, height: 60 },
        'right edge': { x: 1380, y: 400, width: 60, height: 60 },
    };
    for (const [name, target] of Object.entries(edges)) {
        for (const prefer of ['top', 'bottom', 'left', 'right'] as Placement[]) {
            const at = placeCard(target, CARD, DESKTOP, prefer);
            check(`${name}, preferring ${prefer}: the caption is on screen`,
                inside(boxOf(at), DESKTOP), at);
        }
    }

    // A FULL-WIDTH TARGET, which is what a header or a table is, and the case
    // where left and right are both impossible.
    const banner: Rect = { x: 0, y: 0, width: 1440, height: 120 };
    const atBanner = placeCard(banner, CARD, DESKTOP, 'left');
    check('a full-width target still gets a caption on the screen',
        inside(boxOf(atBanner), DESKTOP), atBanner);
    check('and it does not land on top of it',
        !overlaps(boxOf(atBanner), banner), atBanner);

    /*
      320px, WHERE NOTHING FITS.

      Every placement is off the screen at this width, so the fallback is the
      only branch that runs - and it is the branch a phone takes every single
      time. Being inside the viewport is the property that matters; not
      overlapping is not always possible when the target is most of the screen.
    */
    const phoneTargets: Rect[] = [
        { x: 8, y: 8, width: 304, height: 44 },
        { x: 8, y: 500, width: 304, height: 60 },
        { x: 100, y: 250, width: 120, height: 40 },
        { x: 0, y: 0, width: 320, height: 568 },
    ];
    for (const [n, target] of phoneTargets.entries()) {
        for (const prefer of ['top', 'bottom', 'left', 'right'] as Placement[]) {
            const at = placeCard(target, { width: 296, height: 200 }, PHONE, prefer);
            check(`320px target ${n} preferring ${prefer}: still on screen`,
                inside({ ...at, width: 296, height: 200 }, PHONE), at);
        }
    }

    // A caption bigger than the screen cannot be placed inside it; what it must
    // not do is go NEGATIVE, which scrolls the page and hides the controls.
    const huge = placeCard(middle, { width: 2000, height: 2000 }, PHONE, 'top');
    check('a caption larger than the viewport is clamped to the top left '
        + 'rather than pushed off it',
        huge.x >= 0 && huge.y >= 0, huge);

    /*
      A TARGET THAT IS MOST OF THE SCREEN IS NOT A TARGET.

      Reported by `tools/tour-check/shoot.mjs` on five steps at 1440px: a course
      grid, an exams page root and a plans container are each 1,300 x 1,900, and
      a box round one of them is a border round the screen with the caption
      necessarily on top of it. Both directions, because a rule that rejected
      everything would also stop every overlap.
    */
    check('a card-sized target is pointable',
        isPointable({ x: 100, y: 100, width: 320, height: 220 }, DESKTOP));
    check('a whole grid is not',
        !isPointable({ x: 40, y: 0, width: 1320, height: 1120 }, DESKTOP));
    check('and neither is anything taller than the screen, whatever its area',
        !isPointable({ x: 0, y: 0, width: 40, height: 2000 }, DESKTOP));
    check('nor is nothing at all', !isPointable(null, DESKTOP));
    check('the boundary is a real one - nothing on these pages sits near it',
        MAX_TARGET_SHARE > 0.3 && MAX_TARGET_SHARE < 0.8, MAX_TARGET_SHARE);
    check('an unpointable target is placed as though there were none, so the '
        + 'caption is centred rather than clamped on top of it',
        placeCard({ x: 40, y: 0, width: 1320, height: 1120 }, CARD, DESKTOP,
            'bottom').placement === 'center');

    check('the answer is the same twice - the fallback order is fixed, so the '
        + 'caption cannot move between two renders of the same page',
        JSON.stringify(placeCard(middle, CARD, DESKTOP, 'bottom'))
        === JSON.stringify(placeCard(middle, CARD, DESKTOP, 'bottom')));
    check('the gap and the margin are real numbers a stylesheet could not '
        + 'silently ignore', GAP > 0 && MARGIN > 0);
    /*
      THE GAP HAS TO CLEAR THE ARROWHEAD, or there is no arrow.

      At 18 the caption sat almost against the box and the connector came out
      shorter than the 11px head, so the component drew no line at all - a tour
      with a box and a caption and nothing joining them, which is most of what
      makes the pairing readable. It was invisible in every assertion here and
      obvious in the first screenshot.
    */
    check('and the gap clears the arrowhead, so a line is actually drawn',
        GAP >= 30, GAP);
    const beside = placeCard(middle, CARD, DESKTOP, 'bottom');
    check('a caption placed beside its target is far enough away to join to '
        + 'it with a visible line',
        connector({ ...beside, ...CARD }, middle).length >= 14,
        connector({ ...beside, ...CARD }, middle).length);
}

/* ------------------------------------------------------------------ *
 * 5. The line and the arrow
 * ------------------------------------------------------------------ */

section('5. The line joins two edges, not two centres');
{
    const card: Rect = { x: 100, y: 100, width: 200, height: 100 };
    const target: Rect = { x: 600, y: 400, width: 120, height: 80 };
    const joined = connector(card, target);

    const on = (r: Rect, p: { x: number; y: number }) =>
        p.x >= r.x - 0.01 && p.x <= r.x + r.width + 0.01
        && p.y >= r.y - 0.01 && p.y <= r.y + r.height + 0.01;

    check('it starts on the caption and ends on the target',
        on(card, joined.from) && on(target, joined.to), joined);
    // Border to border, so the line does not run underneath either rectangle
    // and the arrowhead lands ON the edge of the thing it points at.
    const touchesEdge = (r: Rect, p: { x: number; y: number }) =>
        Math.min(Math.abs(p.x - r.x), Math.abs(p.x - (r.x + r.width)),
            Math.abs(p.y - r.y), Math.abs(p.y - (r.y + r.height))) < 0.01;
    check('and both ends are ON an edge rather than inside the box',
        touchesEdge(card, joined.from) && touchesEdge(target, joined.to), joined);
    check('the length is the distance between them',
        Math.abs(joined.length - Math.hypot(joined.to.x - joined.from.x,
            joined.to.y - joined.from.y)) < 0.01);
    check('the angle points from the caption towards the target',
        joined.angle > 0 && joined.angle < 90, joined.angle);

    const left = connector({ x: 900, y: 400, width: 200, height: 100 }, target);
    check('and the other way round it points back',
        Math.abs(left.angle) > 90, left.angle);

    // The degenerate case: a zero-size target, or a caption exactly over its
    // own box, would otherwise divide by zero and place the arrow at NaN.
    check('a concentric caption and target do not produce NaN',
        Number.isFinite(connector(card, { ...card }).angle));
    check('and edgePoint answers the centre rather than dividing by zero',
        edgePoint(card, { x: card.x + card.width / 2, y: card.y + card.height / 2 })
            .x === card.x + card.width / 2);
    check('a zero-size target is still a finite point',
        Number.isFinite(edgePoint({ x: 5, y: 5, width: 0, height: 0 },
            { x: 50, y: 50 }).x));
}

/* ------------------------------------------------------------------ *
 * 6. The strings
 * ------------------------------------------------------------------ */

section('6. Every caption can be translated');
{
    const all = [...ALL_CHAPTERS.flatMap(c => [c.title, ...c.steps.flatMap(s => [s.title, s.body])]),
        ...PLATFORM_STEPS.flatMap(s => [s.title, s.body])];
    const missing = all.filter(key => !TOUR_KEYS.includes(key));
    check('TOUR_KEYS covers every chapter title, step title and step body - it '
        + 'is derived rather than written twice, so a step added without its '
        + 'Arabic fails check:i18n instead of rendering English',
        missing.length === 0, missing.slice(0, 5));
    check('and holds nothing that is not asked for',
        TOUR_KEYS.every(key => all.includes(key)),
        TOUR_KEYS.filter(key => !all.includes(key)).slice(0, 5));
    check('no key is a placeholder nobody filled',
        TOUR_KEYS.every(key => !/\{v\d\}/.test(key)),
        TOUR_KEYS.filter(key => /\{v\d\}/.test(key)));
    check('no key is blank or a bare id',
        TOUR_KEYS.every(key => key.trim().length > 3));
}

/* ------------------------------------------------------------------ *
 * 7. The source rules
 * ------------------------------------------------------------------ */

section('7. The overlay obeys the rules the rest of the app does');
{
    const guide = source('src/components/TourGuide.vue');
    const button = source('src/components/TourButton.vue');
    const css = source('src/assets/css/tour.css');

    // Working rule 13. The captions are catalogue keys this repo ships, but the
    // rule is unconditional and the cost of an exception here is a script tag
    // in an overlay that sits above every page on the platform.
    check('nothing in the tour reaches v-html',
        !guide.includes('v-html') && !button.includes('v-html'));

    // The one page with no top bar is the one with the most to explain, so the
    // overlay cannot live where the button does.
    check('the overlay is mounted once, in the layout',
        source('src/layouts/DefaultLayout.vue').includes('<TourGuide />'));
    check('and the button appears in the top bar',
        source('src/components/TopBar.vue').includes('<TourButton />'));
    check('AND in the lab workspace, which hides the top bar',
        source('src/views/LabWorkspace.vue').includes('<TourButton />'));
    check('both reach the same state rather than each holding their own',
        button.includes('useTour') && guide.includes('useTour'));

    // Teleported, or a page wrapper with a z-index traps the overlay under the
    // sidebar - which is the exact failure the admin console's modals had.
    check('the overlay teleports to body, so a page stacking context cannot '
        + 'paint it under the sidebar',
        /<Teleport to="body">/.test(guide));

    // Working rule 32: a globally loaded stylesheet may only own names nobody
    // else can collide with.
    const owned = new Set<string>();
    for (const match of css.replace(/\/\*[\s\S]*?\*\//g, '')
        .matchAll(/\.([a-zA-Z][\w-]*)/g)) {
        if (!match[1]!.startsWith('sfs-tour') && !/^is-/.test(match[1]!)) {
            owned.add(match[1]!);
        }
    }
    check('tour.css declares no class outside the sfs-tour namespace',
        owned.size === 0, [...owned]);
    check('and no colour literal outside a var() fallback - a hardcoded hex is '
        + 'right in one galaxy and wrong in nine',
        !/(?<!var\([^)]{0,80})#[0-9a-fA-F]{3,8}\b/.test(
            css.replace(/var\([^)]*\)/g, 'VAR').replace(/\/\*[\s\S]*?\*\//g, '')),
        css.replace(/var\([^)]*\)/g, 'VAR').replace(/\/\*[\s\S]*?\*\//g, '')
            .match(/#[0-9a-fA-F]{3,8}\b/g));
    check('and no !important outside the print and forced-colors blocks',
        (css.match(/!important/g) || []).length
        === (css.match(/display: none !important/g) || []).length,
        css.match(/[^;{]*!important/g));

    /*
      `2 / 10`, NOT `10 / 2`.

      Every character in the counter is bidi-neutral, so inside an Arabic card
      the algorithm orders the two digit runs right-to-left and the reader is
      told they are on step ten of two. Isolation alone does not fix it - it
      stops the counter disturbing its neighbours and says nothing about the
      order inside it. Reported by an Arabic screenshot.
    */
    check('the step counter is pinned left to right, or Arabic reads it '
        + 'backwards',
        /\.sfs-tour__count\s*\{[^}]*direction:\s*ltr/.test(css),
        css.match(/\.sfs-tour__count\s*\{[^}]*\}/)?.[0]);

    // A tour that could be dismissed only by finishing it is a trap.
    check('Escape stops the tour', /Escape/.test(guide));
    check('and there is a Stop control on every step',
        /sfs-tour__stop/.test(guide));

    // The steps were resolved against the page that was on screen.
    check('a route change stops the tour rather than describing a page that '
        + 'is no longer there',
        /watch\(\(\) => route\.path/.test(guide));

    check('the stylesheet is loaded globally, or a teleported overlay has no '
        + 'styles at all',
        source('src/main.ts').includes("assets/css/tour.css"));
}

/* ------------------------------------------------------------------ *
 * 8. The routes the chapters claim are real
 * ------------------------------------------------------------------ */

section('8. Every chapter points at a route that exists');
{
    const routerPath = resolve(process.cwd(), 'src/router/index.ts');
    if (!existsSync(routerPath)) {
        console.log('  skip  the router is not where it was expected.');
    } else {
        const router = readFileSync(routerPath, 'utf8');
        const declared = new Set<string>();
        for (const match of router.matchAll(/path:\s*'([^']*)'/g)) {
            const raw = match[1]!;
            const clean = raw.replace(/\(.*?\)/g, '').replace(/^\//, '');
            declared.add('/' + clean);
        }
        const missing: string[] = [];
        for (const chapter of ALL_CHAPTERS) {
            for (const pattern of chapter.match) {
                // The first segment is enough: a chapter matches by prefix, so
                // the question is whether the router has anything under it.
                const head = pattern.split('/').filter(Boolean)[0];
                if (!head) continue;
                const found = [...declared].some(path =>
                    path === '/' + head || path.startsWith('/' + head + '/'));
                if (!found) missing.push(`${chapter.id} -> ${pattern}`);
            }
        }
        check('no chapter claims a path the router has never heard of - a '
            + 'renamed route would otherwise leave a chapter permanently '
            + 'unreachable, with the generic one shown in its place',
            missing.length === 0, missing);
    }
}

console.log(failures ? `\n${failures} failed` : '\nAll checks passed.');
process.exit(failures ? 1 : 0);
