// Verifies src/utils/linkify.ts without a browser.
//
//   npm run check:linkify
//
// linkify is a plain module for exactly this reason. It is the only code in
// the app that hands generated HTML to `v-html`, so what is checked here is
// mostly not "does it find URLs" but "can a student put anything in a comment
// that ends up as markup":
//
// * every character of the input is escaped before anything is inserted;
// * an anchor is only ever built for an allow-listed scheme, so a
//   `javascript:` URL is shown and not clickable;
// * every external link carries rel="noopener", without which the page it
//   opens can navigate this tab somewhere else;
// * the sentence's punctuation does not end up inside the href.

import {
  escapeHtml,
  hasLinkable,
  linkify,
  shortenLabel,
} from '../../src/utils/linkify';

let failures = 0;

function check(label: string, ok: boolean, detail: any = '') {
  console.log(`  ${ok ? 'ok  ' : 'FAIL'}  ${label}${ok ? '' : '  ' + JSON.stringify(detail)}`);
  if (!ok) failures++;
}

/* The app runs on one origin; node has no `location`, so it is passed in. */
const HERE = { internalOrigins: ['https://selfstudy.jo'] };

console.log('\n1. Escaping');
{
  check('angle brackets', escapeHtml('<b>') === '&lt;b&gt;');
  check('ampersand', escapeHtml('a & b') === 'a &amp; b');
  check('quotes', escapeHtml(`"x" 'y'`) === '&quot;x&quot; &#39;y&#39;');
  check('no double-escaping of &amp;', escapeHtml('&amp;') === '&amp;amp;');
  check('null is empty, not "null"', escapeHtml(null as any) === '');
}

console.log('\n2. Nothing a user writes can become markup');
{
  const attacks = [
    '<img src=x onerror=alert(1)>',
    '<script>alert(1)</script>',
    '<svg/onload=alert(1)>',
    '"><img src=x onerror=alert(1)>',
    `<a href="javascript:alert(1)">click</a>`,
    "<iframe src='https://evil.example'></iframe>",
    '<style>body{display:none}</style>',
    '<body onload=alert(1)>',
    '<div onmouseover="alert(1)">hover</div>',
    '<!--[if IE]><script>alert(1)</script><![endif]-->',
  ];
  for (const attack of attacks) {
    const html = linkify(attack, HERE);
    // The only tags in the output must be the ones linkify itself emits.
    const tags = html.match(/<[^>]+>/g) ?? [];
    const foreign = tags.filter(t => !/^<(a class="rt-|span class="rt-|\/a|\/span|br)/.test(t));
    check(`no foreign tag survives: ${attack.slice(0, 34)}`, foreign.length === 0, foreign);
    check(`  …and the original < is escaped`, !html.includes('<img') && !html.includes('<script'), html.slice(0, 60));
  }

  // The regression that prompted all of this: CourseDetails.vue used to run
  // `text.replace(/@(\w+)/…)` straight into v-html with no escaping at all.
  const comment = 'nice work <img src=x onerror=alert(1)> @teacher';
  const out = linkify(comment, HERE);
  check('a mention still renders alongside escaped markup',
        out.includes('rt-mention') && out.includes('&lt;img'), out);
}

console.log('\n3. Only safe schemes become anchors');
{
  const dangerous = [
    'javascript:alert(1)',
    'JaVaScRiPt:alert(1)',
    'data:text/html;base64,PHNjcmlwdD5hbGVydCgxKTwvc2NyaXB0Pg==',
    'vbscript:msgbox(1)',
    'file:///etc/passwd',
    'blob:https://evil.example/x',
  ];
  for (const url of dangerous) {
    const html = linkify(`look at ${url} now`, HERE);
    check(`${url.slice(0, 26)} is not an anchor`, !html.includes('<a '), html.slice(0, 80));
    // It must still be visible — deleting part of a message is worse than
    // showing an unclickable one.
    check('  …but the text is still shown', html.includes('now'), html.slice(0, 80));
  }

  for (const url of ['https://a.dev/x', 'http://a.dev/x', 'mailto:a@b.dev']) {
    check(`${url} is an anchor`, linkify(url, HERE).includes('<a '), linkify(url, HERE));
  }
}

console.log('\n4. External links cannot reach back through window.opener');
{
  const html = linkify('see https://example.com/page', HERE);
  check('target=_blank is set', html.includes('target="_blank"'), html);
  check('rel carries noopener', /rel="[^"]*noopener/.test(html), html);
  check('rel carries noreferrer', /rel="[^"]*noreferrer/.test(html), html);

  const internal = linkify('see https://selfstudy.jo/courses', HERE);
  check('an internal link opens in the same tab', !internal.includes('target='), internal);
  check('an internal link needs no rel', !internal.includes('rel='), internal);

  const relative = linkify('go to /notifications now', HERE);
  check('a bare path is not mistaken for a link', !relative.includes('<a '), relative);
}

console.log('\n5. Recognition');
{
  const cases: Array<[string, boolean, string]> = [
    ['https://x.dev', true, 'plain https'],
    ['www.x.dev/page', true, 'bare www'],
    ['someone@example.com', true, 'email'],
    ['no links at all here', false, 'plain prose'],
    ['version 1.2.3 released', false, 'a version number is not a domain'],
    ['ratio 3:4 today', false, 'a colon is not a scheme'],
  ];
  for (const [text, expected, label] of cases) {
    const got = linkify(text, HERE).includes('<a ');
    check(`${label}: ${text}`, got === expected, linkify(text, HERE));
  }

  check('a bare www host gets https',
        linkify('www.x.dev', HERE).includes('href="https://www.x.dev"'),
        linkify('www.x.dev', HERE));

  check('an email becomes mailto',
        linkify('a@b.dev', HERE).includes('href="mailto:a@b.dev"'),
        linkify('a@b.dev', HERE));

  // An address must not be shredded into a mention of @b.
  check('an email is not read as a mention',
        !linkify('a@b.dev', HERE).includes('rt-mention'),
        linkify('a@b.dev', HERE));
}

console.log('\n6. Trailing punctuation stays in the sentence');
{
  const cases: Array<[string, string]> = [
    ['see https://x.dev/a.', 'https://x.dev/a'],
    ['see https://x.dev/a, then', 'https://x.dev/a'],
    ['see https://x.dev/a!', 'https://x.dev/a'],
    ['(see https://x.dev/a)', 'https://x.dev/a'],
    ['see https://x.dev/a?q=1', 'https://x.dev/a?q=1'],
  ];
  for (const [text, wantHref] of cases) {
    const html = linkify(text, HERE);
    const href = /href="([^"]+)"/.exec(html)?.[1];
    check(`${text} → ${wantHref}`, href === wantHref, href);
  }

  // A URL may legitimately contain balanced brackets.
  const wiki = linkify('https://en.wikipedia.org/wiki/Galaxy_(disambiguation)', HERE);
  check('balanced brackets stay in the href',
        /href="[^"]*\(disambiguation\)"/.test(wiki), wiki);

  // Nothing may be lost: the visible text plus the hrefs must still account
  // for every character the user typed.
  for (const [text] of cases) {
    const visible = linkify(text, HERE)
      .replace(/<a [^>]*>|<\/a>|<span [^>]*>|<\/span>/g, '')
      .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"').replace(/&#39;/g, "'");
    const shortened = shortenLabel(/https?:\/\/\S+?(?=[.,!)]|$)/.exec(text)?.[0] ?? '');
    check(`  nothing dropped from: ${text}`,
          visible.includes(shortened) && visible.endsWith(text.slice(-1)),
          visible);
  }
}

console.log('\n7. Mentions');
{
  const html = linkify('thanks @teacher and @a.b-c', { ...HERE, mentionHref: u => `/u/${u}` });
  check('a mention is linked when a href is supplied',
        html.includes('href="/u/teacher"'), html);
  check('dots and dashes are part of a username',
        html.includes('href="/u/a.b-c"'), html);

  const plain = linkify('thanks @teacher', HERE);
  check('with no href it is a span, not a dead anchor',
        plain.includes('<span class="rt-mention">') && !plain.includes('<a class="rt-mention"'),
        plain);

  check('a trailing full stop is not part of the username',
        linkify('ask @sara.', { ...HERE, mentionHref: u => `/u/${u}` }).includes('href="/u/sara"'),
        linkify('ask @sara.', { ...HERE, mentionHref: u => `/u/${u}` }));

  check('mentions can be turned off',
        !linkify('hi @x', { ...HERE, mentions: false }).includes('rt-mention'));

  check('an email-like mention target is escaped',
        !linkify('@a"onmouseover="alert(1)', { ...HERE, mentionHref: u => `/u/${u}` }).includes('"onmouseover"'),
        linkify('@a"onmouseover="alert(1)', { ...HERE, mentionHref: u => `/u/${u}` }));
}

console.log('\n8. Labels and layout');
{
  const long = 'https://example.com/' + 'segment/'.repeat(20) + 'end';
  const html = linkify(long, HERE);
  const label = />([^<]+)<\/a>/.exec(html)?.[1] ?? '';
  check('a very long URL is elided in the label', label.length <= 62, label.length);
  check('  …but the href is complete',
        html.includes(`href="${long}"`), html.slice(0, 90));
  check('  …and the elision keeps the host', label.startsWith('example.com'), label);
  check('  …and the tail', label.endsWith('end'), label);

  check('the scheme is dropped from the label',
        !shortenLabel('https://x.dev/a').startsWith('https'), shortenLabel('https://x.dev/a'));
}

console.log('\n9. Newlines and empties');
{
  check('newlines become <br> by default', linkify('a\nb', HERE) === 'a<br>b', linkify('a\nb', HERE));
  check('CRLF too', linkify('a\r\nb', HERE) === 'a<br>b');
  check('breaks can be turned off',
        linkify('a\nb', { ...HERE, breaks: false }) === 'a\nb');
  check('empty in, empty out', linkify('', HERE) === '');
  check('null in, empty out', linkify(null as any, HERE) === '');
  check('undefined in, empty out', linkify(undefined as any, HERE) === '');
}

console.log('\n10. hasLinkable agrees with linkify');
{
  const samples = [
    'nothing here', 'https://x.dev', 'a@b.dev', '@someone',
    'javascript:alert(1)', 'www.x.dev', 'version 1.2.3',
  ];
  for (const s of samples) {
    const rendered = linkify(s, HERE);
    const marked = rendered.includes('<a ') || rendered.includes('rt-mention');
    check(`hasLinkable("${s}") === ${marked}`, hasLinkable(s) === marked,
          [hasLinkable(s), marked]);
  }
}

console.log('\n11. Repeated calls are stable');
{
  // The regex is module-level and global; a forgotten lastIndex reset makes
  // every second call silently skip the first match. That failure only shows
  // up in a list of messages, which is the only place this is ever used.
  const text = 'see https://x.dev and @sara';
  const first = linkify(text, HERE);
  for (let i = 0; i < 5; i++) {
    check(`call ${i + 2} matches call 1`, linkify(text, HERE) === first);
  }
  check('hasLinkable does not disturb linkify',
        (hasLinkable(text), linkify(text, HERE)) === first);
}

console.log(failures ? `\n${failures} failed\n` : '\nAll checks passed.\n');
process.exit(failures ? 1 : 0);
