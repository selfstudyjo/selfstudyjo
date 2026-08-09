// Verifies src/utils/notificationEvents.ts without a browser.
//
//   npm run check:notifyevents
//
// The catalogue is a plain module for exactly this reason. What is checked here
// is the set of things that are invisible until a notification has already been
// sent to somebody, at which point it is too late to fix the wording:
//
// * every `{placeholder}` in a title, message or link is declared in `params`,
//   and every declared param is actually used — an unfilled placeholder renders
//   as the bare word "course" in the middle of a sentence;
// * every `link` is a path the router can match, because a notification whose
//   View button lands on the catch-all redirect reads as "the button is broken";
// * every category has an icon and every priority is a real one;
// * `fill()` and `buildNotification()` behave at the edges — an unknown key
//   returns null rather than throwing, because the caller is inside a `try`
//   around a user action that has already succeeded;
// * the admin console's copy of the catalogue agrees about which keys exist.
//   There is no shared package (working rule 10), so the two really are copies.

import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import {
    CATEGORIES, CATEGORY_ICONS, EVENT_KEYS, NOTIFICATION_EVENTS, PRIORITIES,
    RESERVED_CATEGORIES,
    buildNotification, fill, placeholdersIn,
    type NotificationEventSpec,
} from '../../src/utils/notificationEvents';

let failures = 0;

function check(label: string, ok: boolean, detail: any = '') {
    console.log(`  ${ok ? 'ok  ' : 'FAIL'}  ${label}${ok ? '' : '  ' + JSON.stringify(detail)}`);
    if (!ok) failures++;
}

/** Sources are read relative to the package root: `npm run` sets the cwd there,
 *  and the bundler rewrites `import.meta.url` on the way into `dist/`. */
const source = (relative: string) => readFileSync(resolve(process.cwd(), relative), 'utf8');

const specs: NotificationEventSpec[] = Object.values(NOTIFICATION_EVENTS);

console.log('\n1. The catalogue is internally consistent');
{
    check('there is a catalogue at all', specs.length > 20, specs.length);

    const mismatched = Object.entries(NOTIFICATION_EVENTS)
        .filter(([key, spec]) => key !== spec.key)
        .map(([key, spec]) => `${key} !== ${spec.key}`);
    check('every entry agrees with the key it is filed under', mismatched.length === 0, mismatched);

    const unnamespaced = EVENT_KEYS.filter(key => !/^[a-z]+\.[a-z0-9_]+$/.test(key));
    check('every key is app.action, lower case', unnamespaced.length === 0, unnamespaced);

    const badCategory = specs.filter(s => !CATEGORIES.includes(s.category)).map(s => s.key);
    check('every category is one the UI knows', badCategory.length === 0, badCategory);

    const badPriority = specs.filter(s => !PRIORITIES.includes(s.priority)).map(s => s.key);
    check('every priority is one of the four', badPriority.length === 0, badPriority);

    const badAudience = specs.filter(s => s.audience !== 'user' && s.audience !== 'operator').map(s => s.key);
    check('every event says who it is for', badAudience.length === 0, badAudience);

    const badSender = specs
        .filter(s => !Array.isArray(s.sentBy) || !s.sentBy.length
            || s.sentBy.some(who => who !== 'app' && who !== 'console'))
        .map(s => s.key);
    check('and who sends it', badSender.length === 0, badSender);

    const empty = specs.filter(s => !s.title.trim() || !s.message.trim()).map(s => s.key);
    check('nothing has an empty title or message', empty.length === 0, empty);

    // Two lines in the bell before it clips. Longer than this is a notification
    // people stop reading, which is the same as one that was never sent.
    const verbose = specs.filter(s => s.title.length > 60).map(s => `${s.key} (${s.title.length})`);
    check('no title runs past 60 characters', verbose.length === 0, verbose);
}

console.log('\n2. Every placeholder is declared, and every declaration is used');
{
    const undeclared: string[] = [];
    const unused: string[] = [];
    for (const spec of specs) {
        const used = new Set([
            ...placeholdersIn(spec.title),
            ...placeholdersIn(spec.message),
            ...placeholdersIn(spec.link ?? ''),
        ]);
        const declared = new Set(spec.params);
        for (const name of used) if (!declared.has(name)) undeclared.push(`${spec.key}:{${name}}`);
        for (const name of declared) if (!used.has(name)) unused.push(`${spec.key}:${name}`);
    }
    check('no template uses a placeholder it did not declare', undeclared.length === 0, undeclared);
    check('no event declares a parameter it never renders', unused.length === 0, unused);

    const duplicateParams = specs
        .filter(s => new Set(s.params).size !== s.params.length)
        .map(s => s.key);
    check('no parameter is declared twice', duplicateParams.length === 0, duplicateParams);
}

console.log('\n3. Every link is a route the router can actually match');
{
    // Same reading as tools/appnav-check: the parent is '/', children are
    // relative, and the catch-all is not a destination.
    const routerSource = source('src/router/index.ts');
    const declared = [...routerSource.matchAll(/path:\s*'([^']*)'/g)].map(m => m[1]);
    check('the router file was readable and has routes', declared.length > 20, declared.length);

    const patterns = declared
        .filter(path => !path.includes('catchAll'))
        .map(path => (path.startsWith('/') ? path : '/' + path))
        .map(path => (path === '/' ? '/' : path.replace(/\/+$/, '')));

    const segmentsOf = (path: string) => (path === '/' ? [] : path.slice(1).split('/'));

    function patternMatches(pattern: string, path: string): boolean {
        const pat = segmentsOf(pattern);
        const got = segmentsOf(path);
        for (let i = 0; i < pat.length; i++) {
            const seg = pat[i];
            const optional = seg.endsWith('?');
            if (i >= got.length) {
                if (!optional) return false;
                continue;
            }
            if (seg.startsWith(':')) continue;
            if (seg !== got[i]) return false;
        }
        return got.length <= pat.length;
    }

    // A link is a template. Fill it with something route-shaped before matching,
    // so `/course/{courseId}` is tested as `/course/abc123` rather than being
    // rejected for containing a brace.
    const concrete = (link: string) =>
        fill(link, Object.fromEntries(placeholdersIn(link).map(name => [name, 'sample-id'])));

    const broken = specs
        .filter(s => s.link)
        .map(s => ({ key: s.key, to: concrete(s.link!) }))
        .filter(({ to }) => !patterns.some(pattern => patternMatches(pattern, to)))
        .map(({ key, to }) => `${key} -> ${to}`);
    check('every event link points at a declared route', broken.length === 0, broken);

    const relative = specs.filter(s => s.link && !s.link.startsWith('/')).map(s => s.key);
    check('every link is absolute — a relative one resolves against whatever page '
        + 'the user happens to be on', relative.length === 0, relative);
}

console.log('\n4. Every category has an icon the sidebar already draws');
{
    const used = new Set(specs.map(s => s.category));
    const orphans = CATEGORIES
        .filter(name => !used.has(name) && !RESERVED_CATEGORIES.includes(name));
    check('every category is used by an event, or declared reserved with a reason',
        orphans.length === 0, orphans);

    const reservedButUsed = RESERVED_CATEGORIES.filter(name => used.has(name));
    check('and nothing reserved is quietly in use', reservedButUsed.length === 0, reservedButUsed);

    const missing = CATEGORIES.filter(name => !CATEGORY_ICONS[name]);
    check('every category maps to an icon name', missing.length === 0, missing);

    const extra = Object.keys(CATEGORY_ICONS).filter(name => !CATEGORIES.includes(name as any));
    check('and no icon is mapped for a category that does not exist', extra.length === 0, extra);

    // The bell renders these through the same glyph set as the sidebar. A name
    // with no glyph is an empty square, which is why this is checked against the
    // component's source rather than against a list kept here.
    const sideNav = source('src/components/SideNav.vue');
    const block = sideNav.match(/const icons: Record<IconName, any> = \{([\s\S]*?)\n\};/);
    check('the sidebar icon map was found', !!block);
    const drawn = new Set([...(block?.[1] ?? '').matchAll(/^\s{2}([A-Za-z][\w-]*):/gm)].map(m => m[1]));
    const undrawn = Object.values(CATEGORY_ICONS).filter(name => !drawn.has(name));
    check('every category icon has a glyph in SideNav.vue', undrawn.length === 0, undrawn);
}

console.log('\n5. Building a notification');
{
    const built = buildNotification('course.homework_added', {
        course: 'Algebra II', homework: 'Unit 4 problems', courseId: 'c-77',
    });
    check('a known event builds', !!built);
    check('the title is filled', built?.title === 'New homework in Algebra II', built?.title);
    check('the link is filled', built?.link === '/course/c-77', built?.link);
    check('the event key rides along, so a client can filter on it',
        built?.event === 'course.homework_added', built?.event);
    check('so do the category and priority',
        built?.category === 'homework' && built?.priority === 'high', built);

    check('an unknown key is null rather than a throw — the caller is inside a '
        + 'catch around something that already succeeded',
        buildNotification('nope.nothing', {}) === null);

    const noLink = buildNotification('system.announcement', { subject: 'S', detail: 'D' });
    check('an event with no link builds an empty one, not undefined',
        noLink?.link === '', noLink?.link);

    check('a missing value renders as the placeholder name, never as "undefined"',
        fill('New homework in {course}', {}) === 'New homework in course',
        fill('New homework in {course}', {}));
    check('and an empty string counts as missing',
        fill('Hello {name}', { name: '' }) === 'Hello name');
    check('a value that is not a string is coerced',
        fill('{days} days', { days: 3 }) === '3 days');
    check('text with no placeholders survives untouched',
        fill('Nothing to fill here', { a: 1 }) === 'Nothing to fill here');
}

console.log('\n6. Every event the app claims to send, it sends');
{
    // A catalogue entry nobody sends is worse than no entry: it reads like a
    // feature that exists. So `sentBy: ['app']` is checked against the source —
    // the key has to appear somewhere under src/ that is not this file.
    const roots = ['src/views', 'src/components', 'src/services', 'src/store'];
    const files: string[] = [];
    const walk = (dir: string) => {
        let entries: string[];
        try { entries = readdirSync(dir); } catch { return; }
        for (const name of entries) {
            const full = join(dir, name);
            if (statSync(full).isDirectory()) walk(full);
            else if (/\.(ts|vue)$/.test(name)) files.push(full);
        }
    };
    for (const root of roots) walk(resolve(process.cwd(), root));
    check('there are sources to search', files.length > 20, files.length);

    const haystack = files.map(f => readFileSync(f, 'utf8')).join('\n');
    const unsent = specs
        .filter(s => s.sentBy.includes('app'))
        .filter(s => !haystack.includes(`'${s.key}'`) && !haystack.includes(`"${s.key}"`))
        .map(s => s.key);
    check('every app-sent event is sent from somewhere under src/', unsent.length === 0, unsent);
}

console.log('\n7. The admin console\'s copy of the catalogue agrees');
{
    // There is no shared package on this platform (working rule 10), so
    // selfstudyadmin carries its own copy of the events an operator sends. It is
    // a sibling repo, not a dependency — when it is not checked out beside this
    // one the check says so rather than passing quietly.
    const sibling = resolve(process.cwd(), '..', 'selfstudyadmin', 'utils', 'notify.py');
    if (!existsSync(sibling)) {
        console.log('  skip  selfstudyadmin is not checked out beside this repo');
    } else {
        const py = readFileSync(sibling, 'utf8');
        const theirs = new Set([...py.matchAll(/^\s*'([a-z]+\.[a-z0-9_]+)':\s*\{/gm)].map(m => m[1]));
        check('the console declares some events', theirs.size > 0, theirs.size);

        const unknown = [...theirs].filter(key => !EVENT_KEYS.includes(key));
        check('every event the console sends exists in this catalogue', unknown.length === 0, unknown);

        const consoleKeys = specs.filter(s => s.sentBy.includes('console')).map(s => s.key);
        const missing = consoleKeys.filter(key => !theirs.has(key));
        check('and the console carries every event marked sentBy console',
            missing.length === 0, missing);
    }
}

console.log(failures === 0 ? '\nAll checks passed.\n' : `\n${failures} failed\n`);
process.exit(failures === 0 ? 0 : 1);
