/**
 * The i18n codemod: wrap human text in every template in `$t(...)`.
 *
 *   node tools/i18n-wrap/wrap.mjs            # report only, writes nothing
 *   node tools/i18n-wrap/wrap.mjs --apply    # rewrite the files
 *   node tools/i18n-wrap/wrap.mjs --keys     # write tools/i18n-wrap/keys.json
 *
 * ============================================================
 * WHY THIS IS A CODEMOD AND WHY IT IS CHECKED IN
 * ============================================================
 *
 * There are 2,184 distinct human-readable literals across 107 templates. Doing
 * that by hand is not a quality decision, it is a coin-flipping exercise: the
 * strings are not the hard part, *not missing one* is, and a person reading 107
 * files will miss a hundred of them silently. So the extraction is mechanical
 * and the translation — the part that needs judgement — is not.
 *
 * It is checked in rather than run once and deleted, exactly as
 * `tools/tokenize-colors/tokenize.mjs` is, for the same reason: it is
 * **re-runnable**, so the classifier stays tunable after the fact. When a new
 * view is added, this finds what it left untranslated.
 *
 * ============================================================
 * FOUR PROPERTIES THAT KEEP IT SAFE
 * ============================================================
 *
 *  1. **Idempotent.** A run already inside `$t(` is left alone, so a second
 *     pass is a no-op and a third does not produce `$t($t('Save'))`. Verified
 *     by running it twice and diffing — `--apply` twice is the test.
 *  2. **It never touches anything but a template's text and a fixed list of
 *     human attributes.** `<script>`, `<style>`, comments, `<pre>` and `<code>`
 *     are skipped structurally rather than by pattern, because a pattern over
 *     a 1,900-line component with three of each is a pattern that gets one
 *     wrong.
 *  3. **It skips what it cannot be sure of, and SAYS SO.** A run holding an
 *     HTML entity, a lone technical token, or anything with no letters is
 *     reported in the `skipped` tally rather than guessed at. The tally is the
 *     manual worklist; a codemod that silently declined things would be a
 *     codemod that reported 100% coverage of the strings it happened to like.
 *  4. **The key is the English text**, so the output still says what it says.
 *     `- Save changes` / `+ {{ $t('Save changes') }}` is a reviewable diff, and
 *     with no catalogue entry the rendered page is character-for-character what
 *     it was before. That is what makes it safe to run across 107 files at
 *     once: the worst case is no change at all.
 *
 * ============================================================
 * THE ONE THING IT DELIBERATELY DOES NOT DO
 * ============================================================
 *
 * It does not touch `<script>` blocks. Half of the app's user-facing text is
 * there — `error.value = 'Could not load your plans'`, the toast strings, the
 * status labels built in a `computed` — and a codemod cannot tell those from a
 * log line, a localStorage key, an API path, a CSS class or a `console.warn`.
 * Wrapping a storage key in `$t()` is a silent data-loss bug, so those are done
 * by hand. `check:i18n` reports what is left.
 */

import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const TARGETS = ['src/views', 'src/components', 'src/layouts'];

const APPLY = process.argv.includes('--apply');
const WRITE_KEYS = process.argv.includes('--keys') || APPLY;

/* ------------------------------------------------------------------ *
 * The classifier
 * ------------------------------------------------------------------ */

/**
 * Text that is a token rather than a sentence.
 *
 * A run that is ENTIRELY one of these is left alone: `SQL` is `SQL` in every
 * language, and putting it through the catalogue means three identical entries
 * plus a chance for one of them to be wrong. Matched whole and
 * case-insensitively — a brand name *inside* a sentence is translated with the
 * sentence, because the sentence around it has to agree grammatically.
 */
const ATOMIC = new Set([
    'selfstudy', 'self study', 'selfstudyjo', 'toastmasters',
    'sql', 'linux', 'python', 'javascript', 'typescript', 'html', 'css', 'json',
    'pdf', 'docx', 'csv', 'png', 'jpg', 'jpeg', 'webp', 'mp3', 'mp4', 'svg',
    'github', 'whatsapp', 'linkedin', 'twitter', 'facebook', 'youtube', 'gmail',
    'roblox', 'lua', 'openalex', 'orcid', 'doi', 'google scholar', 'scholar',
    'jod', 'usd', 'eur', 'iban', 'cliq', 'vat',
    'ai', 'api', 'url', 'id', 'ip', 'os', 'ui', 'ux', 'cv', 'otp', 'wifi',
    'vlan', 'dhcp', 'dns', 'tcp', 'udp', 'http', 'https', 'ssh', 'ftp', 'nat',
    'ok', 'n/a', 'na', 'am', 'pm', 'vs', 'etc',
    'cisco', 'packet tracer', 'wireshark', 'docker', 'visa', 'mastercard',
    // Network Simulator vocabulary, and units. Every one of these is a
    // protocol's or a unit's own name and is written the same way in a Chinese
    // or an Arabic textbook, so a catalogue entry for it is three identical
    // strings and one chance for one of them to be wrong. The first run
    // classified all of them as translatable prose.
    'acl', 'arp', 'stp', 'mtu', 'mac', 'ttl', 'mx', 'txt', 'ptr', 'cname',
    'soa', 'ospf', 'bgp', 'rip', 'vtp', 'lacp', 'qos', 'vpn', 'lan', 'wan',
    'ssid', 'poe', 'sfp', 'rx', 'tx', 'ipv4', 'ipv6', 'cidr', 'gbps', 'mbps',
    'kbps', 'ms', 'kb', 'mb', 'gb', 'tb', 'px', 'rem', 'hz', 'khz', 'db',
    '2d', '3d', 'aa', 'bsc', 'msc', 'phd', 'hr', 'ceo', 'cto', 'qr', 'faq',
]);

/** Entities we can safely turn back into the character they mean. */
const DECODE = { '&amp;': '&' };

/**
 * Does this text run belong in the catalogue?
 *
 * Returns the key, or `null` with a reason for the tally.
 */
function classify(raw) {
    // Internal whitespace is collapsed, and that is not cosmetic — it is what
    // makes the key a valid JS string literal. A sentence wrapped across three
    // source lines carries two newlines, and a newline inside `'...'` is an
    // unterminated-string *parse* error that takes the whole bundle down. HTML
    // collapses runs of whitespace when it renders, so the page is unchanged;
    // the only places that do not are `<pre>` and `<textarea>`, which are
    // structurally opaque here.
    const text = raw.trim().replace(/\s+/g, ' ');
    if (!text) return { skip: 'blank' };

    // An entity other than `&amp;` cannot be decoded without deciding what the
    // author meant — `&nbsp;` becomes an invisible character in the middle of a
    // catalogue key, and `&times;` is a glyph pretending to be a word. Both are
    // rare enough to do by hand and expensive enough to get wrong.
    const entities = text.match(/&[a-zA-Z#][a-zA-Z0-9]*;/g) || [];
    if (entities.some(e => !(e in DECODE))) return { skip: 'entity' };

    let decoded = text;
    for (const [from, to] of Object.entries(DECODE)) decoded = decoded.split(from).join(to);

    // Two consecutive letters somewhere. Rules out `+`, `×`, `3`, `100%`, `—`,
    // `1 / 4` and every other run that is punctuation or arithmetic.
    if (!/[A-Za-z]{2}/.test(decoded)) return { skip: 'no-words' };

    // A lone token. `ATOMIC` above says why.
    if (ATOMIC.has(decoded.toLowerCase().replace(/[:：.\s]+$/, ''))) return { skip: 'atomic' };

    // A Vue/HTML expression fragment that leaked out of a tag, or a path.
    if (/^[a-z][a-zA-Z0-9]*\(/.test(decoded)) return { skip: 'looks-like-code' };
    if (/^\/[a-z0-9/_-]+$/.test(decoded)) return { skip: 'looks-like-path' };

    return { key: decoded };
}

/* ------------------------------------------------------------------ *
 * The template walker
 * ------------------------------------------------------------------ */

/** Blocks whose contents are never prose. */
const OPAQUE = new Set(['script', 'style', 'pre', 'code', 'textarea', 'svg', 'path']);

/**
 * Split a template into segments, tracking what each one is.
 *
 * Hand-written rather than a parser because the only structure that matters
 * here is "am I inside a tag, a mustache, a comment, or an opaque element" —
 * four states — and taking a dependency on a full HTML parser to answer that
 * would mean a parser that also has opinions about self-closing Vue components.
 */
function segments(tpl) {
    const out = [];
    let i = 0;
    let opaqueDepth = 0;
    let opaqueTag = '';

    while (i < tpl.length) {
        if (tpl.startsWith('<!--', i)) {
            const end = tpl.indexOf('-->', i);
            const stop = end === -1 ? tpl.length : end + 3;
            out.push({ kind: 'comment', text: tpl.slice(i, stop) });
            i = stop;
            continue;
        }
        if (tpl[i] === '<') {
            let end = i + 1;
            let quote = '';
            while (end < tpl.length) {
                const ch = tpl[end];
                if (quote) { if (ch === quote) quote = ''; }
                else if (ch === '"' || ch === "'") quote = ch;
                else if (ch === '>') break;
                end++;
            }
            const tag = tpl.slice(i, end + 1);
            const nameMatch = tag.match(/^<\/?\s*([a-zA-Z][\w.-]*)/);
            const name = nameMatch ? nameMatch[1].toLowerCase() : '';
            const closing = tag.startsWith('</');
            const selfClosing = /\/>$/.test(tag);

            if (opaqueDepth > 0) {
                if (name === opaqueTag) opaqueDepth += closing ? -1 : (selfClosing ? 0 : 1);
            } else if (OPAQUE.has(name) && !closing && !selfClosing) {
                opaqueDepth = 1;
                opaqueTag = name;
            }

            out.push({ kind: 'tag', text: tag, opaque: opaqueDepth > 0 });
            i = end + 1;
            continue;
        }
        if (tpl.startsWith('{{', i)) {
            const end = tpl.indexOf('}}', i);
            const stop = end === -1 ? tpl.length : end + 2;
            out.push({ kind: 'mustache', text: tpl.slice(i, stop) });
            i = stop;
            continue;
        }
        let end = i;
        while (end < tpl.length && tpl[end] !== '<' && !tpl.startsWith('{{', end)) end++;
        out.push({ kind: 'text', text: tpl.slice(i, end), opaque: opaqueDepth > 0 });
        i = end;
    }
    return out;
}

/* ------------------------------------------------------------------ *
 * The rewrite
 * ------------------------------------------------------------------ */

/**
 * A JS string literal for a template context.
 *
 * Single-quoted, because the result sits inside a double-quoted attribute
 * (`:title="$t('…')"`) as often as it sits in a mustache, and one form that
 * works in both is one fewer thing to get wrong.
 */
function literal(key) {
    return `'${key.replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`;
}

/** Human-readable attributes. Anything not here is markup, not prose. */
const HUMAN_ATTRS = ['placeholder', 'title', 'aria-label', 'alt', 'aria-placeholder', 'aria-description'];

function rewriteTag(tag, keys, tally) {
    // `v-pre` means "do not compile this subtree", so a mustache inside it is
    // literal text and adding one would put `{{ $t('…') }}` on screen.
    if (/\sv-pre\b/.test(tag)) return tag;

    let out = tag;
    for (const attr of HUMAN_ATTRS) {
        const re = new RegExp(`(\\s)${attr}="([^"]*)"`, 'g');
        out = out.replace(re, (whole, space, value) => {
            if (value.includes('{{') || value.includes('$t(')) return whole;
            const verdict = classify(value);
            if (!verdict.key) { tally[verdict.skip] = (tally[verdict.skip] || 0) + 1; return whole; }
            keys.add(verdict.key);
            return `${space}:${attr}="$t(${literal(verdict.key)})"`;
        });
    }
    return out;
}

/**
 * Rewrite one run of text and mustaches between two tags.
 *
 * ============================================================
 * WHY THIS TAKES A GROUP AND NOT A TEXT NODE
 * ============================================================
 *
 * `All ({{ list.length }})` is three segments — `All (`, the expression, `)` —
 * and translating them one at a time produces `$t('All (')` next to a bare
 * `)`. That is not a translation, it is two fragments: no translator can place
 * a parenthesis they cannot see, Arabic puts the number on the other side of
 * the phrase, and Chinese uses a full-width bracket. It was the first thing the
 * codemod got wrong and it got it wrong 200 times.
 *
 * So a whole run becomes ONE key with `{v0}`-style placeholders and the
 * expressions are passed as params:
 *
 *     All ({{ n }})   ->   {{ $t('All ({v0})', { v0: n }) }}
 *
 * The translator now sees the whole phrase and can put the number wherever
 * their language puts it. `check:i18n` asserts a translation's placeholder set
 * matches its key's, so dropping `{v0}` in one language is a build failure
 * rather than a number that silently vanishes from one locale.
 */
function rewriteGroup(group, keys, tally) {
    const verbatim = group.map(s => s.text).join('');

    // Nothing to do for a run with no expressions in it beyond the ordinary
    // single-text case, and nothing to do for a run with no text in it at all.
    const hasText = group.some(s => s.kind === 'text' && s.text.trim());
    if (!hasText) return verbatim;

    // Already translated, or holding a call we must not nest.
    if (verbatim.includes('$t(')) return verbatim;

    const params = [];
    let assembled = '';
    for (const seg of group) {
        if (seg.kind === 'text') { assembled += seg.text; continue; }
        const expr = seg.text.slice(2, -2).trim();
        if (!expr) continue;
        const name = `v${params.length}`;
        params.push([name, expr]);
        assembled += `{${name}}`;
    }

    const verdict = classify(assembled);
    if (!verdict.key) {
        if (verdict.skip !== 'blank' && verdict.skip !== 'no-words') {
            tally[verdict.skip] = (tally[verdict.skip] || 0) + 1;
        }
        return verbatim;
    }

    // A key whose placeholders are ALL of it is a bare expression wearing a
    // sentence's clothes — `{v0}` alone, or `{v0} {v1}`. There is nothing to
    // translate and wrapping it costs a lookup per render.
    if (!/[A-Za-z]{2}/.test(verdict.key.replace(/\{v\d+\}/g, ''))) return verbatim;

    keys.add(verdict.key);

    // Whitespace on either side of the whole run is preserved verbatim: it is
    // what carries the file's indentation, and collapsing it reflows 91
    // templates into one unreadable diff.
    const lead = verbatim.match(/^\s*/)[0];
    const trail = verbatim.match(/\s*$/)[0];
    const args = params.length
        ? `, { ${params.map(([k, v]) => `${k}: ${v}`).join(', ')} }`
        : '';
    return `${lead}{{ $t(${literal(verdict.key)}${args}) }}${trail}`;
}

/**
 * Undo a wrap the classifier would no longer make.
 *
 * WHY THE CODEMOD HAS TO RUN BACKWARDS AS WELL AS FORWARDS
 *
 * The classifier is tunable after the fact — that is most of the reason this
 * tool is checked in rather than run once and deleted. But tuning it is
 * worthless if the previous run's output is frozen: adding `mtu` to `ATOMIC`
 * stops the NEXT `$t('MTU')` being written and leaves the eleven already in the
 * templates exactly where they were, so the worklist never shrinks and the
 * translator is still asked what MTU is in Arabic.
 *
 * So a run also unwraps any `$t('X')` whose `X` the classifier now rejects. It
 * only ever touches a wrap with no params — one carrying `{v0}` is a phrase the
 * classifier accepted for its words, not for the token, and unwrapping it would
 * drop the expression on the floor.
 */
function unwrapRejected(text, tally) {
    return text.replace(/\{\{\s*\$t\('((?:[^'\\]|\\.)*)'\)\s*\}\}/g, (whole, raw) => {
        const key = raw.replace(/\\'/g, "'").replace(/\\\\/g, '\\');
        const verdict = classify(key);
        if (verdict.key) return whole;
        tally[`unwrapped:${verdict.skip}`] = (tally[`unwrapped:${verdict.skip}`] || 0) + 1;
        return key;
    }).replace(/(\s):([a-z-]+)="\$t\('((?:[^'\\]|\\.)*)'\)"/g, (whole, space, attr, raw) => {
        if (!HUMAN_ATTRS.includes(attr)) return whole;
        const key = raw.replace(/\\'/g, "'").replace(/\\\\/g, '\\');
        const verdict = classify(key);
        if (verdict.key) return whole;
        tally[`unwrapped:${verdict.skip}`] = (tally[`unwrapped:${verdict.skip}`] || 0) + 1;
        return `${space}${attr}="${key}"`;
    });
}

function processFile(file, keys, tally) {
    const src = fs.readFileSync(file, 'utf8');
    const match = src.match(/^([\s\S]*?<template[^>]*>)([\s\S]*)(<\/template>[\s\S]*)$/);
    if (!match) return { changed: false, src };

    const [, head, rawBody, tail] = match;
    // Backwards first, so a token the classifier has just learned to skip is
    // out of the way before the forward pass looks at the run it was sitting in.
    const body = unwrapRejected(rawBody, tally);
    const segs = segments(body);
    let changed = false;
    const parts = [];

    for (let i = 0; i < segs.length; i++) {
        const seg = segs[i];
        if (seg.kind === 'comment') { parts.push(seg.text); continue; }
        if (seg.kind === 'tag') {
            const next = seg.opaque ? seg.text : rewriteTag(seg.text, keys, tally);
            if (next !== seg.text) changed = true;
            parts.push(next);
            continue;
        }
        if (seg.opaque) { parts.push(seg.text); continue; }

        // Gather the whole run of text and mustaches up to the next tag: that
        // run is one phrase as far as a reader is concerned, so it is one key.
        const group = [];
        let j = i;
        while (j < segs.length && (segs[j].kind === 'text' || segs[j].kind === 'mustache') && !segs[j].opaque) {
            group.push(segs[j]);
            j++;
        }
        const next = rewriteGroup(group, keys, tally);
        const before = group.map(s => s.text).join('');
        if (next !== before) changed = true;
        parts.push(next);
        i = j - 1;
    }

    return { changed: changed || body !== rawBody, src: head + parts.join('') + tail };
}

/* ------------------------------------------------------------------ *
 * Existing keys — so a re-run's key list is the whole app, not the diff
 * ------------------------------------------------------------------ */

/**
 * Every `$t('…')` / `t('…')` / `tc('…', n)` already in the source.
 *
 * Collected across ALL of `src/`, script blocks included, because the key list
 * this writes is what the translator works from and a hand-wired
 * `error.value = t('Could not load your plans')` is as much a string needing
 * Arabic as anything a template holds.
 */
function existingKeys(dir, keys) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const p = path.join(dir, entry.name);
        if (entry.isDirectory()) { existingKeys(p, keys); continue; }
        if (!/\.(vue|ts)$/.test(entry.name)) continue;
        if (p.includes(`${path.sep}i18n${path.sep}messages${path.sep}`)) continue;
        const src = fs.readFileSync(p, 'utf8');
        // The leading `(^|[^\w$])` is not decoration. Without it `tc?\(`
        // matches the TAIL of any identifier ending in `t`, so `split('-')`,
        // `closest('.mobile-toggle')`, `format('…')` and `parseInt('…')` all
        // registered their arguments as translatable text. That put `'-'`,
        // `','`, `'::'`, `'./config'` and a CSS selector on the worklist, which
        // is how a translator ends up being asked what a hyphen is in Chinese.
        //
        // A lookbehind would read better and is deliberately not used: it is a
        // PARSE-time error on Safari before 16.4, and while nothing under
        // `tools/` ships to a browser, this repo has been bitten by that exact
        // construct twice (`linkify.ts`, `newscastEngine.ts`) and one spelling
        // of the idiom everywhere is worth more than two characters.
        for (const m of src.matchAll(/(^|[^\w$])\.?\$?tc?\(\s*'((?:[^'\\]|\\.)*)'/g)) {
            keys.add(m[2].replace(/\\'/g, "'").replace(/\\\\/g, '\\'));
        }
        for (const m of src.matchAll(/(^|[^\w$])\.?\$?tc?\(\s*"((?:[^"\\]|\\.)*)"/g)) {
            keys.add(m[2].replace(/\\"/g, '"').replace(/\\\\/g, '\\'));
        }
    }
}

/* ------------------------------------------------------------------ *
 * Run
 * ------------------------------------------------------------------ */

const files = [];
for (const target of TARGETS) {
    const abs = path.join(ROOT, target);
    if (!fs.existsSync(abs)) continue;
    const walk = d => {
        for (const e of fs.readdirSync(d, { withFileTypes: true })) {
            const p = path.join(d, e.name);
            if (e.isDirectory()) walk(p);
            else if (e.name.endsWith('.vue')) files.push(p);
        }
    };
    walk(abs);
}

const keys = new Set();
const tally = {};
let touched = 0;

for (const file of files) {
    const { changed, src } = processFile(file, keys, tally);
    if (!changed) continue;
    touched++;
    if (APPLY) fs.writeFileSync(file, src);
    else console.log(`would change  ${path.relative(ROOT, file)}`);
}

existingKeys(path.join(ROOT, 'src'), keys);

console.log('');
console.log(`templates scanned : ${files.length}`);
console.log(`templates ${APPLY ? 'rewritten' : 'to rewrite'} : ${touched}`);
console.log(`keys in the app   : ${keys.size}`);
console.log(`skipped by class  : ${JSON.stringify(tally)}`);

if (WRITE_KEYS) {
    // A last filter, deliberately duplicating `classify`'s letter rule.
    //
    // `classify` guards what the codemod WRITES; this guards what a translator
    // is ASKED FOR, and the two sets are not the same — this list also absorbs
    // hand-written `t('…')` calls out of script blocks, which no classifier has
    // ever seen. Both gates are cheap, and the failure they prevent is an
    // afternoon spent translating punctuation.
    const sorted = [...keys]
        .filter(k => /[A-Za-z]{2}/.test(k) || /[一-鿿؀-ۿ]/.test(k))
        .sort((a, b) => a.localeCompare(b, 'en'));
    const out = path.join(ROOT, 'tools/i18n-wrap/keys.json');
    fs.writeFileSync(out, JSON.stringify(sorted, null, 0).replace(/","/g, '",\n  "')
        .replace(/^\["/, '[\n  "').replace(/"\]$/, '"\n]\n'));
    console.log(`keys written      : ${path.relative(ROOT, out)}`);
}
