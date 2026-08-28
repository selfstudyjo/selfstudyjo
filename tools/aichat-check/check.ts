// Verifies the AI Chat room model, its Markdown renderer, and the view's own
// invariants, without a browser.
//
//   npm run check:aichat
//
// The AI Chat Assistant is the only page on this platform that renders text a
// LANGUAGE MODEL wrote, at the user's own instruction, from a record that is
// stored, replicated and mirrored to a data repo. Almost everything worth
// checking here fails silently:
//
//   * MARKUP. The page it replaced ran `v-html="marked(content)"`. `marked`
//     passes raw HTML through by design, the model emits `<img src=x
//     onerror=...>` in any ordinary answer about image tags, and the user can
//     simply ask it to. That is working rule 13's exact shape, and the only way
//     to keep it closed is to prove the view never reaches for `v-html` or
//     `marked` again -- so the source is read off disk here.
//
//   * A NON-TOTAL SORT. The list is recomputed on every poll and every
//     keystroke in the filter box. Two rooms that compare equal swap places
//     under the reader, and nothing about a single screenshot shows it.
//
//   * THE ORDER DISAGREEING WITH THE BACKEND. `sortRooms` here and `sort_rooms`
//     in aichat.py both order the list. Two different answers is a sidebar that
//     visibly reshuffles the moment a fetch lands, so the Python is read off
//     disk and the two are compared field by field.
//
//   * AN UNTERMINATED FENCE. A reply cut off mid-block -- routine, that is
//     `finish_reason: length` -- must not swallow every paragraph after it.
//
//   * A BLANK ROW. Six rooms called `Untitled` is not data, it is a rendering
//     fault as far as the reader is concerned. The leaderboard already shipped
//     that once.

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import {
    BUCKET_LABELS,
    type Bucket,
    type ChatRoomSummary,
    describeContext,
    groupRooms,
    isResumable,
    matchesQuery,
    newMessageId,
    sortRooms,
    titleOf,
    upsertRoom,
} from '../../src/utils/aichatRooms';
import { previewOf, renderMarkdown } from '../../src/utils/aichatMarkdown';

let failures = 0;
function check(label: string, ok: boolean, detail?: unknown) {
    if (!ok) failures++;
    console.log(`  ${ok ? 'ok  ' : 'FAIL'}  ${label}` +
        (ok ? '' : `  ${JSON.stringify(detail)}`));
}

// `process.cwd()`, never `import.meta.url`. npm scripts run from the package
// root, and the bundler rewrites `import.meta.url` on the way into `dist/` --
// and `new URL(...).pathname` hands back a percent-encoded string that cannot
// be opened, because this workspace lives under a path with a space in it.
// Same spelling as every other check here.
function read(rel: string): string {
    return readFileSync(resolve(process.cwd(), rel), 'utf8');
}

/**
 * The same source with every comment removed.
 *
 * NEEDED, not tidy. Three of the assertions below caught the file's own
 * explanation of the bug rather than the bug: the view's header says
 * `v-html="marked(content)"` while describing what it no longer does, and the
 * service's says the deleted `ai.service.ts` "held VITE_AUTH_TOKEN" and
 * "advanced currentIndex". Every one of those is a check reading its own
 * reassurance copy as evidence -- the exact way check:leaderboard's "no email
 * is rendered" assertion started failing once that sentence moved inside a
 * $t() literal. A rule that fires on the comment explaining it is a rule you
 * cannot document.
 *
 * ONE left-to-right scanner rather than three regex passes, and that is
 * working rule 44 rather than preference: the admin console's `_js_code` has
 * twice silently emptied a file it was preprocessing -- once from a `/*` inside
 * a template literal, once from an odd number of backticks inside a comment --
 * and each time every assertion downstream went green against a blank string.
 * Three passes cannot know which construct came first.
 *
 * A regex literal is tracked too, because `.replace(/'/g, ...)` opens a string
 * that never closes as far as a quote-only scanner is concerned. `//` and `/*`
 * outside a string are unambiguously comments -- an empty regex is not legal
 * syntax -- so the only ambiguity is a `/` that begins one, and that is
 * resolved by scanning to its unescaped close.
 */
function codeOnly(src: string): string {
    let out = '';
    let i = 0;
    while (i < src.length) {
        const ch = src[i];
        const next = src[i + 1];
        if (ch === '<' && src.startsWith('<!--', i)) {
            const end = src.indexOf('-->', i);
            i = end === -1 ? src.length : end + 3;
            continue;
        }
        if (ch === '/' && next === '/') {
            const end = src.indexOf('\n', i);
            i = end === -1 ? src.length : end;
            continue;
        }
        if (ch === '/' && next === '*') {
            const end = src.indexOf('*/', i + 2);
            i = end === -1 ? src.length : end + 2;
            continue;
        }
        if (ch === "'" || ch === '"' || ch === '`') {
            const quote = ch;
            out += ch;
            i++;
            while (i < src.length) {
                if (src[i] === '\\') { out += src.slice(i, i + 2); i += 2; continue; }
                out += src[i];
                if (src[i] === quote) { i++; break; }
                i++;
            }
            continue;
        }
        if (ch === '/') {
            // A regex literal. Scan to its unescaped close, character classes
            // included, so a quote inside it never opens a string.
            let j = i + 1;
            let inClass = false;
            while (j < src.length) {
                if (src[j] === '\\') { j += 2; continue; }
                if (src[j] === '[') inClass = true;
                else if (src[j] === ']') inClass = false;
                else if (src[j] === '/' && !inClass) { j++; break; }
                else if (src[j] === '\n') break;
                j++;
            }
            out += src.slice(i, j);
            i = j;
            continue;
        }
        out += ch;
        i++;
    }
    return out;
}

function room(over: Partial<ChatRoomSummary> = {}): ChatRoomSummary {
    return {
        id: 'r1', title: 'A chat', topic: '', message_count: 4,
        last_message_at: '2026-08-28T10:00:00.000Z', last_message_preview: '',
        language: 'en', pinned: false, archived: false, has_brief: false,
        created_at: '2026-08-28T09:00:00.000Z',
        updated_at: '2026-08-28T10:00:00.000Z',
        ...over,
    };
}

// ---------------------------------------------------------------------------
console.log('\n1. Ordering');
// ---------------------------------------------------------------------------
{
    const rooms = [
        room({ id: 'b', last_message_at: '2026-08-28T10:00:00Z' }),
        room({ id: 'a', last_message_at: '2026-08-28T10:00:00Z' }),
        room({ id: 'c', last_message_at: '2026-08-28T12:00:00Z' }),
        room({ id: 'd', last_message_at: '2026-08-27T09:00:00Z', pinned: true }),
    ];
    const order = sortRooms(rooms).map((r) => r.id);
    check('pinned first, then most recently spoken in',
        JSON.stringify(order) === JSON.stringify(['d', 'c', 'a', 'b']), order);

    // The property a single screenshot cannot show. Every permutation must give
    // the same answer or the list reshuffles under the reader on every poll.
    const perms = [
        [0, 1, 2, 3], [3, 2, 1, 0], [1, 3, 0, 2], [2, 0, 3, 1], [1, 0, 3, 2],
    ];
    const stable = perms.every((p) =>
        JSON.stringify(sortRooms(p.map((i) => rooms[i])).map((r) => r.id))
        === JSON.stringify(order));
    check('and the order is TOTAL — every input permutation gives it', stable);

    check('sortRooms does not mutate its argument',
        rooms[0].id === 'b', rooms.map((r) => r.id));

    // Two rooms identical but for the id: only the id can separate them, and it
    // must, or they are a tie the comparator cannot break.
    const twins = [room({ id: 'zz' }), room({ id: 'aa' })];
    check('two otherwise identical rooms are still ordered, by id',
        JSON.stringify(sortRooms(twins).map((r) => r.id)) === '["aa","zz"]');

    // A room that has never been spoken in has no last_message_at at all.
    const fresh = [
        room({ id: 'new', last_message_at: '', updated_at: '2026-08-28T13:00:00Z' }),
        room({ id: 'old', last_message_at: '2026-08-28T10:00:00Z' }),
    ];
    check('a brand new room falls back to updated_at rather than to the bottom',
        sortRooms(fresh)[0].id === 'new', sortRooms(fresh).map((r) => r.id));
}

// ---------------------------------------------------------------------------
console.log('\n2. The order agrees with the backend');
// ---------------------------------------------------------------------------
{
    // There is no shared package (working rule 10), so `sort_rooms` in
    // aichat.py and `sortRooms` here are two implementations of one decision.
    // Reading the Python off disk is the only thing that stops them drifting --
    // and drift here is a sidebar that jumps the moment a fetch lands.
    let py = '';
    try {
        py = readFileSync(resolve(process.cwd(), '..', 'selfstudyai', 'aichat.py'), 'utf8');
    } catch {
        console.log('  skip  selfstudyai is not checked out beside this repo');
    }
    if (py) {
        const fn = py.slice(py.indexOf('def sort_rooms'), py.indexOf('def out_message'));
        check('the backend sorts pinned first too', /pinned/.test(fn));
        check('...then on last_message_at falling back to updated_at',
            /last_message_at.*or.*updated_at/s.test(fn));
        check('...then created_at', /created_at/.test(fn));
        check("...and breaks the last tie on the id, so its order is total too",
            /room\.get\('id'\)/.test(fn));
        check('and both descend on activity rather than ascending',
            /_invert/.test(fn));
    }
}

// ---------------------------------------------------------------------------
console.log('\n3. Buckets');
// ---------------------------------------------------------------------------
{
    // A fixed clock. Reading Date.now() in the module would make "yesterday" a
    // property of the hour the check happens to run in, and the boundaries are
    // the only interesting part.
    const now = new Date('2026-08-28T15:00:00').getTime();
    const at = (iso: string, over: Partial<ChatRoomSummary> = {}) =>
        room({ id: iso, last_message_at: iso, ...over });

    const groups = groupRooms([
        at('2026-08-28T14:00:00'),
        at('2026-08-27T23:00:00'),
        at('2026-08-24T10:00:00'),
        at('2026-08-10T10:00:00'),
        at('2026-01-01T10:00:00'),
        at('2026-08-01T10:00:00', { pinned: true }),
    ], now);
    const seen = groups.map((g) => g.bucket);
    check('buckets come out in reading order',
        JSON.stringify(seen) ===
        JSON.stringify(['pinned', 'today', 'yesterday', 'week', 'month', 'older']), seen);

    check('an empty bucket is not rendered as an empty heading',
        groupRooms([at('2026-08-28T14:00:00')], now).length === 1);

    // The calendar-day rule, which is the one people get wrong. 23:50 and 00:10
    // are 20 minutes apart and are different days to a reader.
    const lateLast = groupRooms(
        [at('2026-08-27T23:50:00')], new Date('2026-08-28T00:10:00').getTime());
    check('23:50 yesterday is YESTERDAY at 00:10 today, not "today"',
        lateLast[0].bucket === 'yesterday', lateLast[0].bucket);

    const earlyToday = groupRooms(
        [at('2026-08-28T00:05:00')], new Date('2026-08-28T00:10:00').getTime());
    check('...and 00:05 today is today', earlyToday[0].bucket === 'today');

    // A pinned room is pinned wherever it was last used. Without this the
    // pinned section empties itself as its rooms age, which is the opposite of
    // what pinning means.
    check('a pinned room stays pinned however old it is',
        groupRooms([at('2020-01-01T00:00:00', { pinned: true })], now)[0].bucket
        === 'pinned');

    check('an unparseable timestamp lands in Older rather than throwing',
        groupRooms([room({ last_message_at: 'nonsense', updated_at: '',
                           created_at: '' })], now)[0].bucket === 'older');

    // Every bucket the model can emit needs a heading, or one renders as the
    // word `undefined`. Checked against the exported table rather than scraped
    // out of the view with a regex: the view reaches them as
    // `$t(BUCKET_LABELS[bucket])`, so the table IS the source of truth, and a
    // scrape would go on passing after somebody moved it.
    const all: Bucket[] = ['pinned', 'today', 'yesterday', 'week', 'month', 'older'];
    check('every bucket has a label',
        all.every((b) => !!BUCKET_LABELS[b]), all.filter((b) => !BUCKET_LABELS[b]));
    check('and the labels are declared in the order the buckets render in',
        JSON.stringify(Object.keys(BUCKET_LABELS)) === JSON.stringify(all),
        Object.keys(BUCKET_LABELS));
}

// ---------------------------------------------------------------------------
console.log('\n4. Search');
// ---------------------------------------------------------------------------
{
    const r = room({ title: 'تقنيات الويب', topic: 'DRF pagination',
                     last_message_preview: 'Use cursor pagination' });
    check('an empty query matches everything', matchesQuery(r, '   '));
    check('the title matches', matchesQuery(r, 'الويب'));
    // The reason the topic and the preview are searched at all: a reader who
    // switches the interface language types the other one, and a filter that
    // only matched the rendered field would silently stop finding things.
    check('the topic matches, in the other language', matchesQuery(r, 'pagination'));
    check('the last reply matches', matchesQuery(r, 'cursor'));
    check('matching is case-insensitive', matchesQuery(r, 'DRF PAGINATION'));
    check('a miss is a miss', !matchesQuery(r, 'kubernetes'));
    check('a room with no topic or preview does not throw',
        matchesQuery(room({ topic: '', last_message_preview: '' }), 'x') === false);
}

// ---------------------------------------------------------------------------
console.log('\n5. Titles and the memory mark');
// ---------------------------------------------------------------------------
{
    check('a title is used as it is', titleOf(room({ title: 'Shop API' })) === 'Shop API');
    // Never a placeholder word: a chat list is thirty rows whose only
    // distinguishing mark is this string.
    check('a blank title falls back to the last reply, not to "Untitled"',
        titleOf(room({ title: '  ', last_message_preview: 'Use cursor pagination' }))
        === 'Use cursor pagination');
    check('and with neither, to the caller\'s own word',
        titleOf(room({ title: '', last_message_preview: '' }), 'New chat') === 'New chat');
    check('the fallback is never the literal "Untitled"',
        !/Untitled/.test(titleOf(room({ title: '', last_message_preview: '' }))));

    // The mark means "the assistant can pick this up", not "has messages" --
    // marking every room would make it mean nothing.
    check('a room with a brief and a conversation is resumable',
        isResumable(room({ has_brief: true, message_count: 6 })));
    check('a room with no brief is not', !isResumable(room({ has_brief: false })));
    check('and neither is one that has barely started',
        !isResumable(room({ has_brief: true, message_count: 1 })));
}

// ---------------------------------------------------------------------------
console.log('\n6. upsertRoom');
// ---------------------------------------------------------------------------
{
    const list = [room({ id: 'a', last_message_at: '2026-08-28T09:00:00Z' }),
                  room({ id: 'b', last_message_at: '2026-08-28T10:00:00Z' })];
    const after = upsertRoom(list, room({ id: 'a', last_message_at: '2026-08-28T11:00:00Z' }));
    check('a room the server answered with replaces its own row',
        after.length === 2, after.length);
    check('and moves to the top, because it was just spoken in',
        after[0].id === 'a', after.map((r) => r.id));
    const added = upsertRoom(list, room({ id: 'c', last_message_at: '2026-08-28T12:00:00Z' }));
    check('a room not in the list is added', added.length === 3);
    check('a room with no id is ignored rather than added as a blank row',
        upsertRoom(list, room({ id: '' })).length === 2);
}

// ---------------------------------------------------------------------------
console.log('\n7. Message ids');
// ---------------------------------------------------------------------------
{
    const ids = new Set(Array.from({ length: 500 }, () => newMessageId()));
    check('ids are unique', ids.size === 500, ids.size);
    check('and shaped like a uuid, which is what the backend validates against',
        [...ids].every((id) => /^[0-9a-f-]{32,40}$/i.test(id)));

    // The backend's own pattern, so a minted id can never be refused as
    // "invalid room id" or fail to be adopted as a message id.
    const BACKEND = /^[A-Za-z0-9][A-Za-z0-9_-]{7,63}$/;
    check('and every one satisfies the backend\'s id pattern',
        [...ids].every((id) => BACKEND.test(id)));
}

// ---------------------------------------------------------------------------
console.log('\n8. Markdown becomes DATA, never markup');
// ---------------------------------------------------------------------------
{
    const blocks = renderMarkdown(
        '## Heading\n\nA paragraph that\nwraps.\n\n- one\n- two\n\n' +
        '3. third\n4. fourth\n\n> quoted\n\n```py\nprint(1)\n```\n');
    const kinds = blocks.map((b) => b.kind);
    check('every block kind is recognised',
        JSON.stringify(kinds) ===
        JSON.stringify(['heading', 'paragraph', 'list', 'ordered', 'quote', 'code']), kinds);

    const para = blocks[1] as { text: string };
    check('a single newline is a soft wrap, not a line break',
        para.text === 'A paragraph that wraps.', para.text);

    const ord = blocks[3] as { start: number; items: string[] };
    check('a numbered list keeps the number it started at',
        ord.start === 3, ord.start);
    check('...and its items are the text, not the marker',
        JSON.stringify(ord.items) === '["third","fourth"]', ord.items);

    const code = blocks[5] as { text: string; lang: string };
    check('a fence keeps its language tag', code.lang === 'py');
    check('...and its content verbatim, newlines and all',
        code.text === 'print(1)', code.text);

    // A reply cut off mid-block is routine: that is `finish_reason: length`.
    // Swallowing everything after it would make a truncated answer look empty.
    const open = renderMarkdown('Before.\n\n```js\nconst x = 1;\nconst y =');
    check('an unterminated fence does not swallow what came before it',
        open.length === 2 && open[0].kind === 'paragraph', open.map((b) => b.kind));
    check('...and what was open is still shown as code',
        open[1].kind === 'code' && (open[1] as { text: string }).text.includes('const y ='));

    // This platform teaches shell.
    const shell = renderMarkdown('```bash\n# install it\nnpm i\n```');
    check('a # inside a fence is a comment, not a heading',
        shell.length === 1 && shell[0].kind === 'code', shell.map((b) => b.kind));

    // An answer about Markdown contains both fence characters.
    const nested = renderMarkdown('```\n~~~\nstill code\n~~~\n```\nafter');
    check('a ~~~ inside a ``` block does not close it',
        nested[0].kind === 'code'
        && (nested[0] as { text: string }).text.includes('still code'), nested);
    check('...and the text after the real close is a paragraph',
        nested[1]?.kind === 'paragraph');

    // Inline emphasis is deliberately NOT parsed: eating the * out of SELECT *
    // or the _ out of user_id is worse than leaving the asterisks visible.
    const sql = renderMarkdown('Run **SELECT * FROM user_ratings** now.');
    check('inline markers are left exactly as the model wrote them',
        (sql[0] as { text: string }).text.includes('SELECT * FROM user_ratings'),
        sql[0]);

    check('an empty reply is an empty list, not one empty paragraph',
        renderMarkdown('').length === 0 && renderMarkdown('   \n\n  ').length === 0);

    // The whole point. Whatever the model emits, nothing here is markup.
    const evil = renderMarkdown(
        'Here you go:\n\n<img src=x onerror="alert(1)">\n\n<script>alert(2)</script>');
    check('HTML in a reply comes back as TEXT in a block, never as markup',
        evil.every((b) => b.kind === 'paragraph'), evil.map((b) => b.kind));
    check('...and is carried through unchanged, for the template to escape',
        JSON.stringify(evil).includes('onerror'));

    // A continuation line under a list item belongs to the item.
    const wrapped = renderMarkdown('- first item\n  continued here\n- second');
    check('a wrapped list item stays one item',
        (wrapped[0] as { items: string[] }).items.length === 2,
        (wrapped[0] as { items: string[] }).items);

    check('previewOf skips a leading code block, which is not a preview',
        previewOf('```js\nx\n```\n\nThe actual answer.') === 'The actual answer.');
    check('previewOf is bounded', previewOf('y'.repeat(400)).length <= 121);
    check('previewOf of nothing but code is empty rather than backticks',
        previewOf('```\nx\n```') === '');
}

// ---------------------------------------------------------------------------
console.log('\n9. describeContext');
// ---------------------------------------------------------------------------
{
    const none = describeContext(null);
    check('an empty room says the memory is still being learned',
        !!none.key && Object.keys(none.params).length === 0);
    const short = describeContext({ brief: '', summary: '', topic: '',
        message_count: 4, verbatim_messages: 4, summarised_messages: 0, stale: false });
    check('a short chat says everything is visible', short.params.v0 === 4);
    const long = describeContext({ brief: 'b', summary: 's', topic: '',
        message_count: 40, verbatim_messages: 12, summarised_messages: 28, stale: false });
    check('a long one says how much is verbatim and how much is notes',
        long.params.v0 === 12 && long.params.v1 === 28, long.params);

    // Returned as a KEY plus params rather than a sentence, so it goes through
    // $t. A sentence built here would be three untranslatable strings in a
    // plain module, which is the one thing check:i18n cannot see.
    const view = read('src/views/AiChat.vue');
    check('and the view puts the key through t(), rather than printing it',
        /t\(key,\s*params\)/.test(view));
    const ar = read('src/i18n/messages/ar/tools.ts') + read('src/i18n/messages/ar/common.ts');
    check('every describeContext key is translated into Arabic',
        [none.key, short.key, long.key].every((k) => ar.includes(k.slice(0, 30))),
        [none.key, short.key, long.key].filter((k) => !ar.includes(k.slice(0, 30))));
}

// ---------------------------------------------------------------------------
console.log('\n10. The view keeps its two hard rules');
// ---------------------------------------------------------------------------
{
    const raw = read('src/views/AiChat.vue');
    const view = codeOnly(raw);

    // A CHECK WHOSE INPUT HAS BEEN SILENTLY EMPTIED PASSES, which is the worst
    // way for one to be wrong (working rule 44). `codeOnly` is a preprocessor,
    // so it needs a fixture of its own asserting in BOTH directions: a marker
    // after each known trap must survive, and a name that appears only in a
    // comment must not.
    check('codeOnly keeps the code', view.includes('renderMarkdown')
        && view.includes('newMessageId') && view.length > raw.length / 3,
        [view.length, raw.length]);
    check('...and drops the comments that explain it',
        !view.includes('working rule 13') && !view.includes('Tuesday'));
    // The two constructs that have silently emptied a file on this platform:
    // a comment marker inside a STRING, and a quote inside a REGEX LITERAL.
    // Built out of char codes so the fixture cannot be mangled by the very
    // shapes it is testing for.
    const Q = String.fromCharCode(39);      // '
    const D = String.fromCharCode(34);      // "
    const fixture = codeOnly(
        'const a = ' + Q + '/* not a comment */' + Q + '; // gone\n'
        + 'const b = /[' + Q + D + ']/g; /* also gone */ const KEEP = 1;');
    check('...and survives a comment marker inside a string',
        fixture.includes('/* not a comment */'), fixture);
    check('...and a quote inside a regex literal',
        fixture.includes('KEEP'), fixture);
    check('...and really does remove both comments',
        !fixture.includes('gone'), fixture);

    // WORKING RULE 13. The page this replaced ran v-html on `marked(content)`.
    check('the view never uses v-html', !/v-html/.test(view));
    check('...and never imports marked or highlight.js',
        !/from ['"]marked['"]/.test(view) && !/highlight\.js/.test(view),
        view.match(/import .*(marked|highlight).*/g));
    check('assistant text goes through renderMarkdown', /renderMarkdown\(/.test(view));
    check('...and prose through RichText, which escapes before it inserts',
        /<RichText/.test(view));

    // The message id is minted HERE, which is what makes Retry idempotent
    // rather than a second copy of the same sentence.
    check('the client mints the message id', /newMessageId\(\)/.test(view));
    check('...and Retry re-sends the SAME id rather than a new one',
        /deliver\(failed\.id/.test(view), 'retry must reuse failed.id');

    // A reply arriving after the reader has moved on must not land in the room
    // they are now looking at.
    check('a reply is discarded when the room changed while it was in flight',
        /activeId\.value !== roomId/.test(view));

    // The model is imported rather than reimplemented -- a check written
    // against a second copy of the logic proves nothing about the first.
    check('the view imports the model rather than sorting inline',
        /from '@\/utils\/aichatRooms'/.test(view) && !/\.sort\(/.test(view));
}

// ---------------------------------------------------------------------------
console.log('\n11. The service uses the shared, pinned replica resolver');
// ---------------------------------------------------------------------------
{
    const svc = codeOnly(read('src/services/aichat.service.ts'));
    check('codeOnly keeps the service code', svc.includes('getRandomAiReplica'));
    // Working rule 31. Nine services wrote their own resolver and every one of
    // them dropped the argument that applies the pin; runbook.service.ts went
    // further and inlined Math.random() under the same method name. Under
    // push-then-repair replication that makes the reply to a message a coin
    // flip on whether it was composed with the message.
    check('it resolves through serviceRegistry.getRandomAiReplica',
        /serviceRegistry\.getRandomAiReplica\(\)/.test(svc));
    check('...and never picks a replica itself',
        !/Math\.random/.test(svc) && !/currentIndex/.test(svc));
    check('...and never fetches the registry itself',
        !/VITE_API_BASE_REGISTRY/.test(svc) && !/\/apps\//.test(svc));
    check('...and never holds the auth token', !/VITE_AUTH_TOKEN/.test(svc));

    // The service ai.service.ts did all four, which is why it is gone.
    let gone = true;
    try { read('src/services/ai.service.ts'); gone = false; } catch { /* expected */ }
    check('and the old unpinned ai.service.ts is deleted, not left beside it', gone);

    check('the user is named on every call, as a header rather than a query',
        /'X-User-ID'/.test(svc) && !/user_id=/.test(svc));
    check('a room is updated with PATCH, so a rename cannot blank the brief',
        /apiService\.patch/.test(svc) && !/apiService\.put/.test(svc));
}

console.log('');
if (failures) {
    console.log(`❌ ai chat: ${failures} check(s) failed`);
    process.exit(1);
}
console.log('✅ ai chat: all checks passed');
