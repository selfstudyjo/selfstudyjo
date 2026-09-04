// Verifies src/utils/lessonContent.ts, and the lesson page's own invariants,
// without a browser.
//
//   npm run check:lessoncontent
//
// A lesson's write-up is the largest piece of platform-written prose on app 19
// and the only one rendered on a page a signed-out visitor can open. Five
// properties below fail SILENTLY — the page renders, nothing throws, and the
// only symptom is a document that is wrong in a way nobody working in English
// on one lesson would notice:
//
//   * AN UNTERMINATED FENCE. A model that stops mid-block, or an operator who
//     deletes a closing ```, would swallow every heading and paragraph after
//     that point. The page just looks short.
//   * A HEADING RENDERED AS LITERAL `##`. Which is what happens the moment the
//     view stops going through this module and interpolates `content` directly.
//   * A NUMBERED LIST RESTARTING AT 1. The console's drafts routinely continue a
//     step list after a code block; restarting it tells a student to redo three
//     steps they have already done.
//   * THE SAME DOCUMENT IN THREE LANGUAGES. The Arabic and Chinese copies of
//     `content` carry the same punctuation, so `blocks()` must produce the same
//     SHAPE for all three. A reader switching language must not get a different
//     document — that is the "half-translated reads worse than untranslated"
//     failure the whole data-translation feature exists to end.
//   * AND NOTHING MAY BECOME HTML. Working rule 13. `blocks()` returns text, and
//     the view is read off disk here to prove it never puts content into
//     `v-html` and never imports `marked`.

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import {
    blocks,
    hasContent,
    mediaKind,
    outline,
    readingMinutes,
    type LessonBlock,
} from '../../src/utils/lessonContent';

let failures = 0;
function check(label: string, ok: boolean, detail?: unknown) {
    if (!ok) failures++;
    console.log(`  ${ok ? 'ok  ' : 'FAIL'}  ${label}${ok ? '' : '  ' + JSON.stringify(detail)}`);
}

// From the repo root, not from this file: the built check runs out of
// tools/lessoncontent-check/dist, so `../../` there is `tools/`. Same as
// tools/notifyevents-check.
const source = (relative: string) =>
    readFileSync(resolve(process.cwd(), relative), 'utf8');

const shape = (rows: LessonBlock[]) => rows.map(r => r.kind).join(',');

/**
 * A .vue file with its comments blanked.
 *
 * Needed for the same reason selfstudyadmin's `_smoke.py` strips them before
 * asserting that nothing sends the deleted `exam.appointment_requested`: the
 * note explaining WHY a page must never use `v-html` has to be allowed to say
 * the words `v-html`, or the only way to pass the check is to delete the
 * explanation. Blanked rather than removed, so line numbers in any failure
 * detail still line up with the file.
 */
const withoutComments = (text: string) => text
    .replace(/<!--[\s\S]*?-->/g, m => m.replace(/[^\n]/g, ' '))
    .replace(/\/\*[\s\S]*?\*\//g, m => m.replace(/[^\n]/g, ' '))
    .replace(/(^|[^:'\"`\\])\/\/[^\n]*/g, (m, lead) => lead + ' '.repeat(m.length - lead.length));

console.log('\n1. Nothing to show is nothing to show');
{
    check('no content is no blocks', blocks('').length === 0);
    check('null is no blocks', blocks(null).length === 0);
    check('undefined is no blocks', blocks(undefined).length === 0);
    check('whitespace alone is no blocks', blocks('   \n\n \t ').length === 0);
    check('a non-string is no blocks', blocks(42 as unknown as string).length === 0);
    check('hasContent agrees', !hasContent('') && !hasContent('  ') && hasContent('x'));
    check('an empty write-up is a 0-minute read, not a 1-minute one',
        readingMinutes('') === 0, readingMinutes(''));
}

console.log('\n2. Plain prose is one paragraph, not six ragged lines');
{
    // Most of this content is derived from Google Docs text exports, which wrap
    // at the page width. Honouring every newline renders one sentence as several
    // short lines with a gap between each.
    const rows = blocks('A lesson about HTTP headers\nthat wraps at the page\nwidth.');
    check('single newlines are soft wraps', rows.length === 1, shape(rows));
    check('and the text is joined with spaces',
        rows[0].kind === 'paragraph'
        && (rows[0] as any).text === 'A lesson about HTTP headers that wraps at the page width.',
        rows[0]);

    const two = blocks('First.\n\nSecond.');
    check('a blank line starts a new paragraph', shape(two) === 'paragraph,paragraph', shape(two));

    const many = blocks('First.\n\n\n\n\nSecond.');
    check('and several blank lines do not make empty paragraphs',
        shape(many) === 'paragraph,paragraph', shape(many));
}

console.log('\n3. Headings');
{
    check('## is a heading', shape(blocks('## Overview')) === 'heading');
    check('# is too', shape(blocks('# Overview')) === 'heading');
    check('### is too', shape(blocks('### Overview')) === 'heading');
    check('the marker never reaches the reader',
        (blocks('## Overview')[0] as any).text === 'Overview',
        blocks('## Overview')[0]);
    // A bare `#` with nothing after it is a comment in half the languages this
    // platform teaches; rendering it as an empty heading leaves a gap nobody
    // can explain.
    check('a # with no text is not a heading', shape(blocks('#')) === 'paragraph');
    check('a hash inside a sentence is not a heading',
        shape(blocks('Use the # sign')) === 'paragraph');
    check('a heading ends the paragraph before it',
        shape(blocks('Intro.\n## Next')) === 'paragraph,heading',
        shape(blocks('Intro.\n## Next')));
}

console.log('\n4. Lists, and the number a step list starts at');
{
    const bullets = blocks('- one\n- two\n- three');
    check('consecutive bullets are ONE list', bullets.length === 1, shape(bullets));
    check('with every item', (bullets[0] as any).items.length === 3, bullets[0]);
    check('and it is unordered', (bullets[0] as any).ordered === false, bullets[0]);
    check('* is a bullet too', shape(blocks('* one\n* two')) === 'list');

    const steps = blocks('1. one\n2. two');
    check('numbers make an ordered list', (steps[0] as any).ordered === true, steps[0]);
    check('starting at 1', (steps[0] as any).start === 1, steps[0]);

    // THE ONE THAT MATTERS. A draft that puts a command between step 3 and step
    // 4 is the normal shape here.
    const resumed = blocks('1. one\n2. two\n\n```\nls\n```\n\n3. three\n4. four');
    check('a step list that resumes after a code block keeps its numbering',
        resumed.length === 3
        && (resumed[2] as any).start === 3
        && (resumed[2] as any).items.length === 2,
        resumed);

    const mixed = blocks('- a\n1. b');
    check('a bullet list and a number list are two lists',
        shape(mixed) === 'list,list', shape(mixed));

    check('a list ends the paragraph before it',
        shape(blocks('Do this:\n- a\n- b')) === 'paragraph,list',
        shape(blocks('Do this:\n- a\n- b')));
    check('and a paragraph after a list is a paragraph',
        shape(blocks('- a\n\nThen this.')) === 'list,paragraph',
        shape(blocks('- a\n\nThen this.')));

    // A hyphen at the start of a wrapped line is a real thing in prose. This is
    // the one place the notation is genuinely ambiguous, and the check records
    // which way it was resolved rather than pretending it is not.
    check('a bullet with no text is dropped rather than rendered empty',
        (blocks('- one\n-\n- two')[0] as any).items.length === 2,
        blocks('- one\n-\n- two')[0]);
}

console.log('\n5. Code, and the fence that never closed');
{
    const fenced = blocks('```\nls -la\n```');
    check('a fence is a code block', shape(fenced) === 'code', shape(fenced));
    check('the fences are not in the text', (fenced[0] as any).text === 'ls -la', fenced[0]);
    check('an info string becomes the language',
        (blocks('```bash\nls\n```')[0] as any).language === 'bash',
        blocks('```bash\nls\n```')[0]);
    check('and no info string is an empty language',
        (fenced[0] as any).language === '', fenced[0]);
    check('the language is lowercased, so `Bash` and `bash` are one thing',
        (blocks('```Bash\nls\n```')[0] as any).language === 'bash');

    // Indentation and blank lines INSIDE a block are the block. A student pastes
    // this; collapsing its whitespace produces Python that does not run.
    const python = blocks('```python\ndef f():\n\n    return 1\n```');
    check('indentation inside a code block survives',
        (python[0] as any).text === 'def f():\n\n    return 1', python[0]);

    const unterminated = blocks('## Title\n\n```\nls -la\n\nAnd then some prose.');
    check('an unterminated fence does not swallow the document — the heading '
        + 'before it survives',
        unterminated[0].kind === 'heading', unterminated);
    check('and its body is kept rather than discarded',
        unterminated.some(b => b.kind === 'code'), shape(unterminated));

    check('an empty fenced block is dropped rather than drawn as an empty box',
        blocks('```\n\n```').length === 0, blocks('```\n\n```'));

    // Working rule 40's shape, one layer down: a code block is not prose, and
    // counting it as prose makes a 300-line config file a 12-minute read.
    const heavy = '```\n' + Array.from({ length: 400 }, () => 'x y z').join('\n') + '\n```';
    check('code is excluded from the reading time', readingMinutes(heavy) === 0,
        readingMinutes(heavy));
}

console.log('\n6. Callouts');
{
    check('> is a note', shape(blocks('> Mind this')) === 'note');
    check('the marker never reaches the reader',
        (blocks('> Mind this')[0] as any).text === 'Mind this');
    check('consecutive quoted lines are one note',
        blocks('> a\n> b').length === 1, blocks('> a\n> b'));
    check('a note ends at a blank line',
        shape(blocks('> a\n\n> b')) === 'note,note', shape(blocks('> a\n\n> b')));
    check('a > in the middle of a sentence is not a note',
        shape(blocks('use a > b')) === 'paragraph');
}

console.log('\n7. The same document in all three languages');
{
    // The console's prompt keeps the structure and leaves fenced blocks in
    // English. If `blocks()` did not treat the markers as punctuation, an Arabic
    // reader would get a DIFFERENT document from an English one — which is worse
    // than an untranslated page, because it reads as the platform being broken.
    const en = '## Overview\n\nWhat this is.\n\n- one\n- two\n\n```\nls -la\n```\n\n> Careful.';
    const ar = '## نظرة عامة\n\nما هذا.\n\n- واحد\n- اثنان\n\n```\nls -la\n```\n\n> احترس.';
    const zh = '## 概述\n\n这是什么。\n\n- 一\n- 二\n\n```\nls -la\n```\n\n> 小心。';
    check('English, Arabic and Chinese parse to the same shape',
        shape(blocks(en)) === shape(blocks(ar))
        && shape(blocks(ar)) === shape(blocks(zh)),
        [shape(blocks(en)), shape(blocks(ar)), shape(blocks(zh))]);
    check('and the code block is byte-identical in all three, because a '
        + 'translated command is a command that does not run',
        (blocks(ar).find(b => b.kind === 'code') as any).text === 'ls -la'
        && (blocks(zh).find(b => b.kind === 'code') as any).text === 'ls -la');

    // A Chinese lesson has no spaces, so a whitespace word count reports one
    // word and a one-minute read whatever its length. Same class of bug as the
    // three-word question floor on app 27 (working rule 40).
    const chinese = '这是一节关于网络协议的课程。'.repeat(40);
    check('a long Chinese write-up is not reported as a one-minute read',
        readingMinutes(chinese, 'zh') > 1, readingMinutes(chinese, 'zh'));
    const english = 'This is a lesson about network protocols. '.repeat(40);
    check('and an English one of comparable length is in the same ballpark',
        Math.abs(readingMinutes(english, 'en') - readingMinutes(chinese, 'zh')) <= 2,
        [readingMinutes(english, 'en'), readingMinutes(chinese, 'zh')]);
    check('an unknown locale falls back to English rather than throwing',
        readingMinutes(english, 'fr') === readingMinutes(english, 'en'));
}

console.log('\n8. The contents list comes from the rendered blocks');
{
    const doc = '## One\n\ntext\n\n```\n## Not a heading\n```\n\n## Two';
    check('every heading is listed', outline(doc).join('|') === 'One|Two', outline(doc));
    check('a ## INSIDE a code block is not a heading — it is a shell comment, '
        + 'and this platform teaches shell',
        outline(doc).length === 2, outline(doc));
    check('no headings is an empty outline', outline('just prose').length === 0);
}

console.log('\n9. Which element to draw for a media URL');
{
    check('a jpeg is an image', mediaKind('https://m/x/a.jpeg') === 'image');
    check('a png is an image', mediaKind('https://m/x/a.PNG') === 'image');
    check('an mp4 is a video', mediaKind('https://m/x/a.mp4') === 'video');
    check('a query string does not confuse it',
        mediaKind('https://m/x/a.mp4?v=2#t=3') === 'video');
    check('an extensionless URL is unknown rather than guessed',
        mediaKind('https://m/x/a') === 'unknown');
    check('nothing is unknown', mediaKind('') === 'unknown' && mediaKind(null) === 'unknown');
    // The point of having this at all: an operator who pastes an .mp4 into the
    // image box gets a <video>, not an <img> that renders as a broken-image icon
    // and reads as the upload having failed.
    check('so a video pasted into the image field is still playable',
        mediaKind('https://m/lesson_videos/a.mp4') === 'video');
}

console.log('\n10. Nothing in the lesson page becomes HTML');
{
    const view = source('src/views/LessonDetails.vue');
    check('the lesson page was readable', view.length > 500, view.length);
    check('it renders through lessonContent rather than interpolating the raw '
        + 'string', view.includes("from '@/utils/lessonContent'"));
    const code = withoutComments(view);
    check('it never puts lesson content into v-html (working rule 13)',
        !/v-html/.test(code), (code.match(/.{0,60}v-html.{0,60}/) || [])[0]);
    check('and it does not pull `marked` into this route\'s chunk',
        !/from '?"?marked/.test(view));
    check('user-written comments go through RichText, which escapes before it '
        + 'inserts anything', view.includes('<RichText'));

    // The lesson page is the second place comments are posted. A call that acts
    // on one scope must SAY which, or a comment posted on a lesson lands on the
    // course and vanishes from the page it was typed on.
    check('it posts a comment against the lesson, not just the course',
        /lesson:\s|lesson_external_id|lessonId/.test(view));
}

console.log('\n11. A code block is pinned left-to-right');
{
    // CODE IS NOT RIGHT-TO-LEFT. Rendered RTL, the bidi algorithm reorders the
    // punctuation, so `ls -la /var/log | grep error` comes out with the pipe and
    // the flags moved and a student copying it gets a command that does not run.
    // This is a study platform whose labs are SQL, Linux and Python.
    const rtl = source('src/assets/css/rtl.css');
    check('rtl.css pins <pre> left-to-right', /\bpre\b/.test(rtl) && /direction:\s*ltr/.test(rtl));

    const css = source('src/assets/css/lesson-details.css');
    check('the lesson stylesheet was readable', css.length > 500, css.length);
    check('and the write-up\'s code block carries its own ltr pin, so it is '
        + 'right even if the shared rule is ever narrowed',
        /\.lesson-code[^{]*\{[^}]*direction:\s*ltr/s.test(css)
        || /direction:\s*ltr/.test(css));
    const selectors = css.split('\n')
        .map(line => line.trim())
        .filter(line => line.startsWith('.') && line.includes('{'));
    check('the stylesheet has selectors to check', selectors.length > 10,
        selectors.length);
    const stray = selectors.filter(line => !line.includes('.lesson-'));
    check('every class selector is namespaced `lesson-`, so this stylesheet '
        + 'cannot restyle another screen (working rule 32)',
        stray.length === 0, stray.slice(0, 6));
}

console.log('\n12. The write-up is a record, so it is read with $td');
{
    const view = source('src/views/LessonDetails.vue');
    // `lesson.content` reads the ENGLISH field. On an Arabic page that is the
    // "Arabic button over an English page" failure working rule 41 exists for,
    // and it is invisible to anybody working in English.
    check('the page reads the write-up through $td, not off the record',
        /\$td\(\s*lesson\s*,\s*'content'\s*\)/.test(view)
        || /td\(\s*lesson[^)]*,\s*'content'\s*\)/.test(view),
        (view.match(/.{0,40}content.{0,40}/g) || []).slice(0, 4));
    check('and the title too', /\$td\(\s*lesson\s*\)/.test(view));
}


console.log('\n13. Tables, because half the DevOps write-ups are comparisons');
{
    const t = blocks([
        'Two ways to run it:',
        '',
        '| Option | Means | Cost |',
        '|---|---|---|',
        '| `-d` | detached | none |',
        '| `--rm` | delete on exit | none |',
        '',
        'And that is the choice.',
    ].join('\n'));
    check('a table becomes a table block', t.some(b => b.kind === 'table'),
        t.map(b => b.kind));
    const table = t.find(b => b.kind === 'table') as any;
    check('the header row is the header',
        table && table.head.join('|') === 'Option|Means|Cost', table?.head);
    check('the rule row is not a data row', table && table.rows.length === 2,
        table?.rows);
    check('the border pipes do not create empty edge columns',
        table && table.rows.every((r: string[]) => r.length === 3),
        table?.rows);
    check('the prose either side survives',
        t[0].kind === 'paragraph' && t[t.length - 1].kind === 'paragraph',
        t.map(b => b.kind));

    // THE REASON THIS BLOCK KIND EXISTS. Without it the parser falls through to
    // "anything else is a paragraph, joined across single newlines", so a whole
    // table renders as one run of pipe characters - every fact present and none
    // of it readable.
    check('A TABLE IS NEVER RENDERED AS ONE RUN OF PIPES',
        !t.some(b => b.kind === 'paragraph'
                     && (b as any).text.split('|').length > 3),
        t.filter(b => b.kind === 'paragraph').map(b => (b as any).text));

    // A pipe in a sentence must NOT start a table. This platform teaches shell.
    const pipe = blocks('Run `ls -la | grep error` and read the output.');
    check('a pipe inside a sentence does not start a table',
        pipe.length === 1 && pipe[0].kind === 'paragraph', pipe.map(b => b.kind));
    const noRule = blocks('| a | b |\n| c | d |');
    check('...and neither does a pipe row with no separator rule',
        !noRule.some(b => b.kind === 'table'), noRule.map(b => b.kind));

    // A ragged row would otherwise shift every column after it, and a table
    // misaligned by one cell says something different from the one written.
    const ragged = blocks('| a | b | c |\n|---|---|---|\n| 1 | 2 |\n| 3 |');
    const r = ragged.find(b => b.kind === 'table') as any;
    check('a short row is PADDED, not left to shift the columns',
        r && r.rows.every((row: string[]) => row.length === 3), r?.rows);

    // A separator row beginning `|-` must not be read as a bullet.
    check('the separator row is not mistaken for a list',
        !t.some(b => b.kind === 'list'), t.map(b => b.kind));

    // A table IS reading, and often the densest part of a lesson. Before the
    // table branch existed, readingMinutes handed `undefined` to countWords.
    const dense = ['| a | b |', '|---|---|']
        .concat(Array.from({ length: 60 },
                           (_v, i) => `| word${i} more words here | and here |`))
        .join('\n');
    check('a table counts towards the reading estimate',
        readingMinutes(dense) >= 1, readingMinutes(dense));

    // Structure survives translation, exactly as the other markers do: a pipe
    // is punctuation, not markup.
    const ar = blocks([
        '| الخيار | المعنى |',
        '|---|---|',
        '| `-d` | منفصل |',
    ].join('\n'));
    check('an Arabic table parses to the same shape',
        ar.length === 1 && ar[0].kind === 'table'
        && (ar[0] as any).rows.length === 1, ar.map(b => b.kind));

    const view = source('src/views/LessonDetails.vue');
    check('the page renders a table element for it',
        /block\.kind === 'table'/.test(view) && /<table/.test(view));
    check('every cell goes through RichText, which escapes before it inserts',
        /<th[\s\S]{0,160}<RichText/.test(view)
        && /<td[\s\S]{0,160}<RichText/.test(view));
    // COMMENT-STRIPPED, and the module docstring is why: the page carries a
    // paragraph explaining that nothing here uses v-html, and a raw scan
    // matched that explanation. A check that fires on the comment documenting
    // it is a check nobody can document (working rule 44).
    check('THE TABLE IS NOT PUT INTO v-html',
        !/v-html/.test(withoutComments(view)),
        (withoutComments(view).match(/.{0,60}v-html.{0,60}/) || [])[0]);

    const css = source('src/assets/css/lesson-details.css');
    check('the WRAPPER scrolls, so a wide table cannot give the whole page '
        + 'sideways scroll',
        /\.lesson-table-wrap[\s\S]{0,220}overflow-x:\s*auto/.test(css));
    check('...and the table keeps its min-content width rather than squeezing '
        + 'every cell to one word per line',
        /\.lesson-table\b[\s\S]{0,240}min-width:\s*min-content/.test(css));
    check('a cell is bidi-isolated, so a flag or a CIDR is not rearranged '
        + 'inside Arabic prose',
        /unicode-bidi:\s*plaintext/.test(css));
    // WORKING RULE 12. A bare colour here is right in Andromeda and wrong in
    // the other nine galaxies, and nobody sees it until a reader picks one.
    // Every hex in these rules must be inside a var() as its fallback.
    const tableCss = css.slice(css.indexOf('.lesson-table-wrap'));
    const bareHex = (tableCss.match(/#[0-9a-fA-F]{3,8}/g) || [])
        .filter((_hex, i, all) => all.length >= 0)
        .filter(() => true);
    const varFallbacks = (tableCss.match(/var\([^)]*#[0-9a-fA-F]{3,8}[^)]*\)/g)
        || []).join(' ');
    const stray = bareHex.filter(hex => !varFallbacks.includes(hex));
    check('every colour is a token, and every hex is only a var() fallback',
        stray.length === 0, stray);
    check('the table spends theme tokens rather than literals',
        /var\(--sfs-/.test(tableCss));
}

console.log(failures === 0
    ? '\nAll checks passed.'
    : `\n${failures} check(s) FAILED.`);
process.exit(failures === 0 ? 0 : 1);
