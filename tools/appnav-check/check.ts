// Verifies src/navigation/appNav.ts without a browser.
//
//   npm run check:appnav
//
// The registry is a plain module for exactly this reason. What is checked here
// is the handful of properties that are invisible until they are wrong in
// front of a user, plus the two places the registry can silently fall out of
// step with the rest of the app:
//
// * every nav target is a real route — a `to` the router cannot match is
//   swallowed by the catch-all and silently redirects to the dashboard, which
//   reads as "that menu item does nothing";
// * every icon the registry names has a glyph in SideNav.vue — a missing one
//   renders as an empty square, not an error;
// * applications own disjoint paths, and each one's own pages resolve back to
//   it, so the sidebar cannot change out from under somebody mid-task;
// * Home survives every filter, every access flag and every search query,
//   because a scoped sidebar has hidden the rest of the platform;
// * the search reaches the whole platform from inside any application, and
//   never lists the same page twice.

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
    APP_SECTIONS, HOME_ENTRY,
    activePath, canSee, entryMatches, filterGroups, flatten, globalGroups, isUnder,
    matchParts, navLayout, pinnedEntries, resolveSection, searchTerms, sectionGroups,
    type Access, type AppSection, type NavEntry,
} from '../../src/navigation/appNav';

let failures = 0;

function check(label: string, ok: boolean, detail: any = '') {
    console.log(`  ${ok ? 'ok  ' : 'FAIL'}  ${label}${ok ? '' : '  ' + JSON.stringify(detail)}`);
    if (!ok) failures++;
}

const FULL: Access = {
    auth: true, ai: true, lab: true, runbook: true,
    research: true, toastmasters: true, exam: true, proctor: true,
};
const SIGNED_OUT: Access = {
    auth: false, ai: false, lab: false, runbook: false,
    research: false, toastmasters: false, exam: false, proctor: false,
};
const BASIC: Access = { ...SIGNED_OUT, auth: true };

/**
 * Sources are read relative to the package root rather than to this file:
 * `npm run` sets the cwd there, and the bundler rewrites `import.meta.url` on
 * the way into `dist/`, so anchoring on the module's own location resolves to
 * the wrong place.
 */
const source = (relative: string) => readFileSync(resolve(process.cwd(), relative), 'utf8');

const allEntries = (section: AppSection): NavEntry[] => [...section.items, ...(section.related ?? [])];
const everyEntry: NavEntry[] = [
    HOME_ENTRY,
    ...flatten(globalGroups(FULL)),
    ...APP_SECTIONS.flatMap(allEntries),
];

console.log('\n1. Every nav target is a route the router can actually match');
{
    // Route paths as written in the router: the parent is '/', children are
    // relative, and the catch-all is not a destination.
    const routerSource = source('src/router/index.ts');
    const declared = [...routerSource.matchAll(/path:\s*'([^']*)'/g)].map(m => m[1]);
    check('the router file was readable and has routes', declared.length > 20, declared.length);

    const patterns = declared
        .filter(path => !path.includes('catchAll'))
        .map(path => (path.startsWith('/') ? path : '/' + path))
        .map(path => (path === '/' ? '/' : path.replace(/\/+$/, '')));

    const segmentsOf = (path: string) => (path === '/' ? [] : path.slice(1).split('/'));

    /** Does one route pattern match a concrete path? `:id?` may be absent. */
    function patternMatches(pattern: string, path: string): boolean {
        const pat = segmentsOf(pattern);
        const got = segmentsOf(path);
        let i = 0;
        for (; i < pat.length; i++) {
            const seg = pat[i];
            const optional = seg.endsWith('?');
            if (i >= got.length) {
                // Everything left must be optional for this to still match.
                if (!optional) return false;
                continue;
            }
            if (seg.startsWith(':')) continue;
            if (seg !== got[i]) return false;
        }
        return got.length <= pat.length;
    }

    const routable = (to: string) => patterns.some(pattern => patternMatches(pattern, to));

    const unroutable = [...new Set(everyEntry.map(e => e.to))].filter(to => !routable(to));
    check('every nav entry points at a declared route', unroutable.length === 0, unroutable);

    const homelessSections = APP_SECTIONS.filter(s => !routable(s.home)).map(s => s.id);
    check("every application's landing page is a declared route", homelessSections.length === 0, homelessSections);

    // A prefix that matches nothing means an application nobody can ever be
    // "inside" — the sidebar would never scope to it.
    const deadPrefixes = APP_SECTIONS.flatMap(s =>
        s.match.filter(prefix => !patterns.some(p => patternMatches(p, prefix) || isUnder(p.replace(/\/:.*$/, ''), prefix)))
            .map(prefix => `${s.id}:${prefix}`));
    check('every section prefix corresponds to at least one route', deadPrefixes.length === 0, deadPrefixes);
}

console.log('\n2. Every icon the registry names has a glyph in SideNav.vue');
{
    const sideNav = source('src/components/SideNav.vue');
    const block = sideNav.match(/const icons: Record<IconName, any> = \{([\s\S]*?)\n\};/);
    check('the icon map was found in the component', !!block);

    const drawn = new Set([...(block?.[1] ?? '').matchAll(/^\s{2}([A-Za-z][\w]*):/gm)].map(m => m[1]));
    const named = new Set([
        ...everyEntry.map(e => e.icon),
        ...APP_SECTIONS.map(s => s.icon),
        'grid', // the "All applications" disclosure draws this one directly
    ]);

    const missing = [...named].filter(name => !drawn.has(name));
    check('every named icon is drawn', missing.length === 0, missing);

    const unused = [...drawn].filter(name => !named.has(name));
    check('no glyph is drawn that nothing names', unused.length === 0, unused);
}

console.log('\n3. Applications own disjoint paths');
{
    const clashes: string[] = [];
    for (const a of APP_SECTIONS) {
        for (const b of APP_SECTIONS) {
            if (a.id >= b.id) continue;
            for (const pa of a.match) {
                for (const pb of b.match) {
                    if (isUnder(pa, pb) || isUnder(pb, pa)) clashes.push(`${a.id}:${pa} vs ${b.id}:${pb}`);
                }
            }
        }
    }
    check('no two applications claim the same path', clashes.length === 0, clashes);

    const ids = APP_SECTIONS.map(s => s.id);
    check('section ids are unique', new Set(ids).size === ids.length, ids);

    // Resolution is by longest prefix, never by array position, so shuffling
    // the registry must not change any answer.
    const probes = ['/research/library', '/network-simulator/studio/7', '/courses', '/course/12',
        '/my-results', '/certificates', '/all-certificates', '/my-plans', '/messages/abc',
        '/draw/paper/9', '/proctor-appointment/3', '/notifications'];
    const forward = probes.map(p => resolveSection(p, FULL)?.id ?? null);
    const reversed = probes.map(p => {
        // resolveSection walks APP_SECTIONS; prove order-independence by
        // reproducing it against a reversed copy of the same data.
        let best: string | null = null; let len = -1;
        for (const section of [...APP_SECTIONS].reverse()) {
            for (const prefix of section.match) {
                if (isUnder(p, prefix) && prefix.length > len) { best = section.id; len = prefix.length; }
            }
        }
        return best;
    });
    check('resolution does not depend on registry order', JSON.stringify(forward) === JSON.stringify(reversed),
          { forward, reversed });
}

console.log("\n4. An application's own pages resolve back to it");
{
    const strays: string[] = [];
    for (const section of APP_SECTIONS) {
        for (const item of section.items) {
            const landed = resolveSection(item.to, FULL);
            if (landed?.id !== section.id) strays.push(`${section.id}: ${item.to} -> ${landed?.id ?? 'none'}`);
        }
    }
    check('no item navigates out of its own application', strays.length === 0, strays);

    // Related links are supposed to leave — but they must land somewhere real.
    const nowhere: string[] = [];
    for (const section of APP_SECTIONS) {
        for (const item of section.related ?? []) {
            if (!resolveSection(item.to, FULL)) nowhere.push(`${section.id}: ${item.to}`);
        }
    }
    check('every related link lands in some application', nowhere.length === 0, nowhere);

    const landing: string[] = [];
    for (const section of APP_SECTIONS) {
        if (resolveSection(section.home, FULL)?.id !== section.id) landing.push(section.id);
    }
    check("every application's landing page belongs to it", landing.length === 0, landing);
}

console.log('\n5. Home is unconditional');
{
    check('home points at the dashboard', HOME_ENTRY.to === '/');
    check('home is visible signed out', canSee(HOME_ENTRY, SIGNED_OUT));

    const inEveryGroup = [
        ...flatten(globalGroups(FULL)),
        ...APP_SECTIONS.flatMap(s => flatten(sectionGroups(s, FULL))),
    ].filter(item => item.to === '/');
    check('home is in no group, so nothing can filter it out', inEveryGroup.length === 0, inEveryGroup.length);

    // The property that matters: whatever the user has typed, wherever they
    // are, the pinned entry is still the pinned entry.
    for (const query of ['', 'zzz-nothing-matches', 'research']) {
        for (const section of [null, ...APP_SECTIONS]) {
            const groups = navLayout({ section, access: FULL, query, showAllApps: false });
            const leaked = [...flatten(groups.scoped), ...flatten(groups.extra)].some(i => i.to === '/');
            if (leaked) { check(`home not duplicated in ${section?.id ?? 'platform'} for "${query}"`, false); }
        }
    }
    check('home is never duplicated into the groups', true);

    // resolveSection must not claim the dashboard or the signed-out pages.
    for (const path of ['/', '/login', '/register', '/verify-email']) {
        check(`${path} is not inside an application`, resolveSection(path, FULL) === null,
              resolveSection(path, FULL)?.id);
    }
}

console.log('\n6. Access gating');
{
    const publicOnly = flatten(globalGroups(SIGNED_OUT));
    check('a signed-out visitor sees only public pages',
          publicOnly.every(i => i.requires === 'public'), publicOnly.map(i => i.to));
    check('and still sees the catalogue, exams, plans and public certificates',
          ['/courses', '/exams', '/plans', '/all-certificates'].every(to => publicOnly.some(i => i.to === to)),
          publicOnly.map(i => i.to));

    /*
      The Newscast is public, and the level matters.

      There are two kinds of ungated page here and they are easy to confuse.
      Drawing Papers and Messages are free but need an ACCOUNT — `requiresAuth`
      and nothing else. The Newscast needs neither: a signed-out visitor gets
      the whole bulletin, which is why it sits in this list beside Courses and
      Plans rather than beside Draw and Messages. Sitting in the sidebar's
      "Main" group next to Messages makes that look like an oversight, so it is
      asserted: `requires: 'public'` in appNav.ts and `requiresAuth: false` on
      the route have to stay in step, and neither can be quietly tightened.
    */
    check('the Newscast is visible to a signed-out visitor',
          publicOnly.some(i => i.to === '/newscast'), publicOnly.map(i => i.to));

    /*
      And reachable from EVERY sidebar, which the platform menu alone does not
      give you.

      This is the bug that was reported: the sidebar scopes itself to whichever
      application you are in, so from inside Courses, Messages, Profile or any
      of the other sixteen, `/newscast` was only behind the "All applications"
      disclosure. The free, no-account page was the hardest one to find.
      `pinnedEntries()` puts it above the groups whenever it would otherwise be
      scoped away — and NOT when it is already on screen, or the pin would be a
      duplicate of a visible row.
    */
    for (const access of [SIGNED_OUT, BASIC]) {
        const label = access.auth ? 'signed in' : 'signed out';
        for (const section of [null, ...APP_SECTIONS]) {
            const pins = pinnedEntries(section);
            const visible = flatten(navLayout({
                section, access, query: '', showAllApps: false,
            }).scoped).map(i => i.to);
            const reachable = pins.some(p => p.to === '/newscast') || visible.includes('/newscast');
            check(`${label}: the Newscast is reachable from the ${section?.id ?? 'platform'} sidebar`,
                  reachable, { pinned: pins.map(p => p.to), visible });

            const duplicated = pins.filter(p => visible.includes(p.to)).map(p => p.to);
            check(`${label}: nothing pinned on ${section?.id ?? 'platform'} is duplicated below`,
                  duplicated.length === 0, duplicated);
        }
    }

    check('Home is pinned everywhere, unconditionally',
          [null, ...APP_SECTIONS].every(s => pinnedEntries(s).some(p => p.to === '/')));
    const newscastSection = APP_SECTIONS.find(s => s.id === 'newscast')!;
    check('the Newscast application scopes the sidebar for a signed-out visitor',
          flatten(sectionGroups(newscastSection, SIGNED_OUT)).some(i => i.to === '/newscast'));
    check('and every one of its related links is public too — no dead ends',
          flatten(sectionGroups(newscastSection, SIGNED_OUT)).length
          === (newscastSection.items.length + (newscastSection.related?.length ?? 0)),
          flatten(sectionGroups(newscastSection, SIGNED_OUT)).map(i => i.to));

    // Fail-closed: an entry that forgets `requires` must need an account.
    check('the default requirement is an account',
          !canSee({ to: '/x', text: 'x', icon: 'home' }, SIGNED_OUT));

    const paidPaths = ['/cv-builder', '/job-interview', '/roblox-tool', '/ai-chat',
                       '/research', '/toastmasters', '/labs', '/network-simulator', '/runbooks'];
    const leakedGlobal = flatten(globalGroups(BASIC)).filter(i => paidPaths.includes(i.to));
    check('a user with no features sees no gated tool in the platform menu',
          leakedGlobal.length === 0, leakedGlobal.map(i => i.to));

    const leakedScoped = APP_SECTIONS
        .flatMap(s => flatten(sectionGroups(s, BASIC)))
        .filter(i => paidPaths.includes(i.to));
    check('nor in any application\'s items or related links', leakedScoped.length === 0,
          [...new Set(leakedScoped.map(i => i.to))]);

    // A section whose every entry is gated away must not scope the sidebar,
    // or a lapsed subscription leaves the user staring at a title and nothing.
    check('an application the user cannot see does not scope the sidebar',
          resolveSection('/research/library', BASIC) === null);
    check('but it does with the feature', resolveSection('/research/library', FULL)?.id === 'research');

    // Drawing Papers and Messages are free with an account — the two ungated
    // feature pages, and both look like an omission if you do not know.
    const basic = flatten(globalGroups(BASIC)).map(i => i.to);
    check('drawing papers is free with an account', basic.includes('/draw'), basic);
    check('messages is free with an account', basic.includes('/messages'), basic);

    check('the proctor group only appears for a proctor',
          !globalGroups(BASIC).some(g => g.label === 'Proctoring') &&
          globalGroups(FULL).some(g => g.label === 'Proctoring'));
}

console.log('\n7. Exactly one entry is active, and it is the deepest one');
{
    const netsim = APP_SECTIONS.find(s => s.id === 'netsim')!;
    const paths = flatten(sectionGroups(netsim, FULL)).map(i => i.to);
    check('a studio deep link activates Studio, not Overview',
          activePath(paths, '/network-simulator/studio/7') === '/network-simulator/studio',
          activePath(paths, '/network-simulator/studio/7'));
    check('the overview activates itself',
          activePath(paths, '/network-simulator') === '/network-simulator');

    // Segment boundaries: the two pairs on this platform that a bare
    // startsWith would confuse.
    check('/courses does not activate /course', !isUnder('/courses', '/course'));
    check('/course/5 does activate /course', isUnder('/course/5', '/course'));
    check('/my-plans does not activate /plans', !isUnder('/my-plans', '/plans'));
    check('/all-certificates does not activate /certificates', !isUnder('/all-certificates', '/certificates'));
    check('/messages/abc activates /messages', isUnder('/messages/abc', '/messages'));
    check('nothing but / activates /', !isUnder('/anything', '/') && isUnder('/', '/'));

    const research = APP_SECTIONS.find(s => s.id === 'research')!;
    const rPaths = flatten(sectionGroups(research, FULL)).map(i => i.to);
    check('a research sub-page does not also activate the overview',
          activePath(rPaths, '/research/library') === '/research/library');
    check('an unlisted sub-page falls back to the nearest listed ancestor',
          activePath(rPaths, '/research/project/42') === '/research');
}

console.log('\n8. Search reaches the whole platform from inside an application');
{
    const research = APP_SECTIONS.find(s => s.id === 'research')!;

    // A page Research Flow neither owns nor links to, so it can only be found
    // by the search reaching outside the open application.
    const away = navLayout({ section: research, access: FULL, query: 'diploma', showAllApps: false });
    check('"diploma" finds the certificates pages from inside Research Flow',
          flatten(away.extra).some(i => i.to === '/all-certificates'), flatten(away.extra).map(i => i.to));
    check('and files them under All applications',
          away.extra.some(g => g.label === 'All applications'), away.extra.map(g => g.label));

    // A page the open application *does* link to stays where the user is,
    // rather than being listed a second time as somewhere else.
    const related = navLayout({ section: research, access: FULL, query: 'resume', showAllApps: false });
    check('a related page is answered in place, not repeated under All applications',
          flatten(related.scoped).some(i => i.to === '/cv-builder') && related.extra.length === 0,
          { scoped: flatten(related.scoped).map(i => i.to), extra: flatten(related.extra).map(i => i.to) });

    const near = navLayout({ section: research, access: FULL, query: 'library', showAllApps: false });
    const nearHits = flatten(near.scoped).map(i => i.to);
    check('"library" finds the in-application page first', nearHits.includes('/research/library'), nearHits);

    const all = navLayout({ section: research, access: FULL, query: 'research', showAllApps: false });
    const tos = [...flatten(all.scoped), ...flatten(all.extra)].map(i => i.to);
    check('no page is listed twice', new Set(tos).size === tos.length,
          tos.filter((to, i) => tos.indexOf(to) !== i));

    const none = navLayout({ section: research, access: FULL, query: 'qqzzxx', showAllApps: false });
    check('a query matching nothing renders no groups at all',
          none.scoped.length === 0 && none.extra.length === 0);

    // Multi-term and keyword search, which is the whole reason entries carry
    // `keywords` — "netsim" and "packet tracer" are what people actually type.
    const platform = globalGroups(FULL);
    const byKeyword = (q: string) => flatten(filterGroups(platform, searchTerms(q))).map(i => i.to);
    check('"netsim" finds the Network Simulator', byKeyword('netsim').includes('/network-simulator'));
    check('"packet tracer" finds it too', byKeyword('packet tracer').includes('/network-simulator'));
    check('"voice note" finds Messages', byKeyword('voice').includes('/messages'));
    check('"whiteboard" finds Drawing Papers', byKeyword('whiteboard').includes('/draw'));
    check('terms are ANDed, not ORed',
          !byKeyword('netsim resume').length, byKeyword('netsim resume'));
    check('search is case and whitespace insensitive',
          byKeyword('  NETWORK   Simulator ').includes('/network-simulator'));

    check('an entry with no terms always matches', entryMatches(HOME_ENTRY, []));
}

console.log('\n9. The disclosure, and the platform menu outside an application');
{
    const draw = APP_SECTIONS.find(s => s.id === 'draw')!;

    const closed = navLayout({ section: draw, access: FULL, query: '', showAllApps: false });
    check('a thin application shows its own pages and its related links',
          closed.scoped.length === 2 && closed.extra.length === 0,
          closed.scoped.map(g => g.label));

    const open = navLayout({ section: draw, access: FULL, query: '', showAllApps: true });
    check('the disclosure reveals the whole platform underneath',
          open.extra.length > 0 && flatten(open.extra).some(i => i.to === '/courses'),
          open.extra.map(g => g.label));
    check('and does not repeat the scoped groups',
          JSON.stringify(open.scoped) === JSON.stringify(closed.scoped));

    const platform = navLayout({ section: null, access: FULL, query: '', showAllApps: false });
    check('outside an application the sidebar is the platform menu',
          platform.scoped.length > 0 && platform.extra.length === 0,
          platform.scoped.map(g => g.label));
    /*
      The exact inventory, on purpose. It is not a style assertion - it is a
      tripwire on the shape of the platform menu, so a group added or reordered
      has to be a deliberate edit here rather than something that happens.
      'Watch' arrived with Self Study TV (app 38) on 2026-08-28.
    */
    check('grouped rather than flat',
          platform.scoped.map(g => g.label).join(',')
              === 'Main,Learn,Tools,Watch,Account,Proctoring',
          platform.scoped.map(g => g.label));

    const filtered = navLayout({ section: null, access: FULL, query: 'cert', showAllApps: false });
    check('and the search filters it in place, keeping the group labels',
          filtered.scoped.every(g => g.items.length > 0) &&
          flatten(filtered.scoped).every(i => i.to.includes('cert')),
          filtered.scoped.map(g => `${g.label}:${g.items.length}`));

    // Every application must be reachable from the platform menu or through a
    // related link, or it exists only for people who already know the URL.
    const reachable = new Set(flatten(globalGroups(FULL)).map(i => i.to));
    const orphans = APP_SECTIONS
        .filter(s => !s.items.some(i => reachable.has(i.to)) && !reachable.has(s.home))
        .map(s => s.id);
    check('every application is reachable from the platform menu', orphans.length === 0, orphans);
}

console.log('\n10. Highlighting a match never rewrites the label');
{
    const cases: [string, string][] = [
        ['Network Simulator', 'network'],
        ['Network Simulator', 'net or'],
        ['My Researcher Profile', 'r'],
        ['Import from OpenAlex', 'openalex'],
        ['Drawing Papers', 'zzz'],
        ['Messages', ''],
    ];
    for (const [text, query] of cases) {
        const parts = matchParts(text, searchTerms(query));
        check(`"${text}" / "${query}" reassembles exactly`,
              parts.map(p => p.text).join('') === text, parts);
    }

    const overlapping = matchParts('Research Researchers', searchTerms('research resea'));
    check('overlapping terms merge into one run rather than nesting',
          overlapping.map(p => p.text).join('') === 'Research Researchers' &&
          overlapping.filter(p => p.match).length === 2, overlapping);
}

console.log(`\n${failures === 0 ? 'PASS' : `FAIL — ${failures} check(s)`}\n`);
process.exit(failures === 0 ? 0 : 1);
