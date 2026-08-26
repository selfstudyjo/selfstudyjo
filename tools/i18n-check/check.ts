/**
 * `npm run check:i18n` — the three languages, verified without a browser.
 *
 * Same shape as `tools/theme-check` and `tools/appnav-check`: the modules under
 * test are plain (no Vue, no DOM), so node can load them and assert the
 * properties that are invisible until they are wrong in front of a reader.
 *
 * ============================================================
 * WHAT IT ACTUALLY GUARDS, IN THE ORDER IT MATTERS
 * ============================================================
 *
 *  1. **A placeholder cannot go missing.** `'{v0} of {v1}'` translated without
 *     its `{v1}` renders a sentence with a number silently absent from ONE
 *     language. Nothing raises, the page looks fine, and only a reader of that
 *     language can see it. This is the check that had to exist.
 *  2. **The sidebar is never half-translated.** Every `NavEntry.text` in
 *     `appNav.ts` must have an entry in both catalogues, because the sidebar is
 *     on every screen at once — a gap there reads as a broken build rather than
 *     as unfinished work.
 *  3. **A key cannot be declared twice.** The catalogues are five modules each,
 *     spread with `...`, so a duplicate is a silent overwrite. With 2,200
 *     strings, "why is this one word wrong on that one screen" is otherwise
 *     unfindable.
 *  4. **An orphan is reported.** An entry no source file asks for is either a
 *     reword nobody carried across — in which case that string has silently
 *     reverted to English — or dead weight. Both are worth seeing, and neither
 *     is visible any other way.
 *  5. **`$t` is never used in a `<script>` block.** It is a template-only
 *     global; in script it is `undefined` and the call throws at runtime, on
 *     whichever branch happens to reach it. The composable is what script uses.
 *  6. **Coverage is a number.** Not a belief. Printed per area, so what is left
 *     is a worklist.
 *
 * Plus the locale invariants and the two gender tables, below.
 */

import fs from 'node:fs';
import path from 'node:path';

import {
    LOCALES, DEFAULT_LOCALE_ID, getLocale, matchLocale, isRtl,
    countWords, endsSentence, type Locale,
} from '../../src/i18n/locales';
import {
    interpolate, placeholdersOf, selectPlural, translate, register,
    formatNumber, formatCurrency, type Catalogue, type Message,
} from '../../src/i18n/index';
import { pickVoice, voicesFor, canSpeak, hasGenderedPair, _KNOWN_GENDER } from '../../src/i18n/speech';

import ar from '../../src/i18n/messages/ar/index';
import zh from '../../src/i18n/messages/zh/index';

import arCommon from '../../src/i18n/messages/ar/common';
import arAccount from '../../src/i18n/messages/ar/account';
import arLearning from '../../src/i18n/messages/ar/learning';
import arSpeaking from '../../src/i18n/messages/ar/speaking';
import arTools from '../../src/i18n/messages/ar/tools';
import arNetsim from '../../src/i18n/messages/ar/netsim';
import arResearch from '../../src/i18n/messages/ar/research';
import arStudio from '../../src/i18n/messages/ar/studio';
import zhCommon from '../../src/i18n/messages/zh/common';
import zhAccount from '../../src/i18n/messages/zh/account';
import zhLearning from '../../src/i18n/messages/zh/learning';
import zhSpeaking from '../../src/i18n/messages/zh/speaking';
import zhTools from '../../src/i18n/messages/zh/tools';
import zhNetsim from '../../src/i18n/messages/zh/netsim';
import zhResearch from '../../src/i18n/messages/zh/research';
import zhStudio from '../../src/i18n/messages/zh/studio';

import {
    APP_SECTIONS, HOME_ENTRY, globalGroups, sectionGroups, type Access,
} from '../../src/navigation/appNav';

/* ------------------------------------------------------------------ *
 * Harness
 * ------------------------------------------------------------------ */

let failures = 0;
let checks = 0;

function ok(label: string, condition: boolean, detail = ''): void {
    checks++;
    if (condition) {
        console.log(`  ok    ${label}`);
        return;
    }
    failures++;
    console.log(`  FAIL  ${label}${detail ? `\n        ${detail}` : ''}`);
}

function section(title: string): void {
    console.log(`\n${title}`);
}

/* ------------------------------------------------------------------ *
 * Source scan
 * ------------------------------------------------------------------ */

const SRC = path.resolve('src');

interface Use {
    key: string;
    file: string;
    inScript: boolean;
    global: boolean;
}

/**
 * Every `$t('…')` / `t('…')` in the app, with where it was and whether it was
 * inside a `<script>` block.
 *
 * The leading `(^|[^\w$])` is load-bearing: without it the pattern matches the
 * TAIL of any identifier ending in `t`, so `split('-')` and
 * `closest('.thing')` register as translatable strings. That put a hyphen and a
 * CSS selector on the translator's worklist the first time this ran. A
 * lookbehind reads better and is deliberately avoided — the repo has been bitten
 * twice by it being a *parse*-time error on Safari before 16.4, and one spelling
 * of the idiom everywhere is worth more than two characters.
 */
function scanUses(): Use[] {
    const uses: Use[] = [];
    const walk = (dir: string) => {
        for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
            const p = path.join(dir, entry.name);
            if (entry.isDirectory()) { walk(p); continue; }
            if (!/\.(vue|ts)$/.test(p)) continue;
            // The catalogues themselves are full of key strings, and the engine
            // is full of examples in its own comments.
            if (p.includes(`${path.sep}i18n${path.sep}`)) continue;
            const src = fs.readFileSync(p, 'utf8');

            // Where do the script blocks start and end? Needed for check 5.
            const scriptRanges: [number, number][] = [];
            for (const m of src.matchAll(/<script[\s\S]*?<\/script>/g)) {
                scriptRanges.push([m.index!, m.index! + m[0].length]);
            }
            const inScript = (at: number) =>
                p.endsWith('.ts') || scriptRanges.some(([a, b]) => at >= a && at < b);

            for (const re of [
                /(^|[^\w$])(\$?)\.?tc?\(\s*'((?:[^'\\]|\\.)*)'/g,
                /(^|[^\w$])(\$?)\.?tc?\(\s*"((?:[^"\\]|\\.)*)"/g,
            ]) {
                re.lastIndex = 0;
                for (const m of src.matchAll(re)) {
                    const key = m[3]
                        .replace(/\\'/g, "'")
                        .replace(/\\"/g, '"')
                        .replace(/\\\\/g, '\\');
                    if (!/[A-Za-z]{2}/.test(key)) continue;
                    uses.push({
                        key,
                        file: path.relative(SRC, p).replace(/\\/g, '/'),
                        inScript: inScript(m.index!),
                        global: m[2] === '$',
                    });
                }
            }
        }
    };
    walk(SRC);
    return uses;
}

const uses = scanUses();
const usedKeys = new Set(uses.map(u => u.key));

/**
 * Keys deliberately left in English.
 *
 * A list rather than a silence, and an entry that is no longer used FAILS —
 * the same rule `check:cssleaks` applies to its own exceptions, and for the
 * same reason: a list that can rot is a list nobody trusts. Everything here is
 * a technical value, a sample, or a proper noun where three identical
 * catalogue entries would be three chances to be wrong.
 */
const UNTRANSLATED_PATH = path.resolve('tools/i18n-check/untranslated.json');
const untranslated: string[] = fs.existsSync(UNTRANSLATED_PATH)
    ? JSON.parse(fs.readFileSync(UNTRANSLATED_PATH, 'utf8'))
    : [];
const untranslatedSet = new Set(untranslated);

/* ------------------------------------------------------------------ *
 * 1. Locales
 * ------------------------------------------------------------------ */

section('1. The three locales');

ok('there are exactly three, and `en` is the source language',
    LOCALES.length === 3 && LOCALES[0].id === DEFAULT_LOCALE_ID);

ok('every locale has a native name written in its own script',
    LOCALES.every(l => l.nativeName.length > 0)
    && getLocale('ar').nativeName === 'العربية'
    && getLocale('zh').nativeName === '简体中文');

ok('Arabic is the only right-to-left locale',
    LOCALES.filter(l => l.direction === 'rtl').map(l => l.id).join() === 'ar');

ok('Chinese is the only wordless script',
    LOCALES.filter(l => l.wordless).map(l => l.id).join() === 'zh');

ok('an unknown id resolves to English rather than throwing',
    getLocale('klingon').id === 'en' && getLocale(null).id === 'en');

// A reader whose browser is set to their own language should not have to find a
// picker they cannot read the label of.
ok('a browser tag is matched generously',
    matchLocale('ar-JO')?.id === 'ar'
    && matchLocale('AR')?.id === 'ar'
    && matchLocale('ar_SA')?.id === 'ar'
    && matchLocale('arb')?.id === 'ar'
    && matchLocale('zh-Hant-TW')?.id === 'zh'
    && matchLocale('zh')?.id === 'zh'
    && matchLocale('en-GB')?.id === 'en');

ok('an unrelated tag matches nothing rather than guessing',
    matchLocale('fr-FR') === null && matchLocale('') === null && matchLocale(null) === null);

ok('isRtl agrees with the direction field',
    isRtl('ar') && !isRtl('en') && !isRtl('zh'));

// The bug `wordless` exists to close. A three-word floor on a Chinese question
// rejects every Chinese question ever written.
section('2. countWords, and the Chinese question floor');

const zhLocale = getLocale('zh');
const enLocale = getLocale('en');

ok('a Chinese sentence is counted in characters, not in whitespace runs',
    countWords('这是一个完整的问题吗？', zhLocale) >= 3,
    `got ${countWords('这是一个完整的问题吗？', zhLocale)} — a whitespace split gives 1`);

ok('...and the same string under an English locale gives the broken answer',
    countWords('这是一个完整的问题吗？', enLocale) === 1);

ok('an English sentence is still counted in words',
    countWords('Tell me about a hard project.', enLocale) === 6);

ok('an Arabic question clears a three-word floor',
    countWords('حدّثني عن مشروع صعب واجهته.', getLocale('ar')) >= 3);

ok('mixed Chinese and Latin counts both',
    countWords('请介绍 Kubernetes 的调度器', zhLocale) >= 3);

section('3. Sentence terminators');

ok('the Arabic question mark ends an Arabic sentence',
    endsSentence('ما هو أكبر تحدٍ واجهته؟', getLocale('ar')));

ok('a full-width stop ends a Chinese sentence',
    endsSentence('请介绍你的项目。', zhLocale) && endsSentence('这是什么？', zhLocale));

ok('an unterminated reply is recognised as unterminated in all three',
    !endsSentence('Tell me about a time when you', enLocale)
    && !endsSentence('حدّثني عن وقت', getLocale('ar'))
    && !endsSentence('请讲一个你', zhLocale));

ok('a closing quote after the terminator still ends the sentence',
    endsSentence('Why did you choose that approach?"', enLocale)
    && endsSentence('为什么选这个方案？”', zhLocale));

/* ------------------------------------------------------------------ *
 * 4. The engine
 * ------------------------------------------------------------------ */

section('4. The engine');

ok('a missing key returns its own English text',
    translate('ar', 'A string nothing has translated') === 'A string nothing has translated');

ok('interpolation fills a placeholder',
    interpolate('Hello {name}', { name: 'Sara' }) === 'Hello Sara');

// `{name}` on screen is a bug somebody reports; a gap in a sentence is a bug
// nobody can describe.
ok('a placeholder with no value is left visible rather than blanked',
    interpolate('Hello {name}', {}) === 'Hello {name}'
    && interpolate('Hello {name}', { name: null }) === 'Hello {name}');

ok('Arabic plural rules are six-way',
    new Set([0, 1, 2, 3, 11, 100].map(n => selectPlural(n, getLocale('ar')))).size >= 5);

ok('Chinese has one plural form for every number',
    new Set([0, 1, 2, 3, 11, 100].map(n => selectPlural(n, zhLocale))).size === 1);

// Latin digits for `ar`, deliberately — see `formatNumber`'s header for the
// reasoning. The first version of this check asserted Arabic-Indic and failed,
// which is how the wrong claim in that comment was found. It is asserted rather
// than left implicit because "why are the numbers not in Arabic numerals" is a
// question somebody will ask, and the answer is a decision rather than a bug.
ok('numbers are grouped per locale, with Latin digits in Arabic',
    formatNumber('ar', 2026) === '2,026'
    && formatNumber('en', 2026) === '2,026'
    && formatNumber('zh', 2026) === '2,026');

ok('...and Arabic-Indic digits are one locale extension away if ever wanted',
    /[٠-٩]/.test(new Intl.NumberFormat('ar-u-nu-arab').format(2026)));

ok('money keeps two decimal places, so 19.90 does not become 19.9',
    formatCurrency('en', '19.90').includes('19.90')
    && formatCurrency('zh', 19.9).includes('19.90'));

// English is the source. A catalogue for it would be a second place English
// lives, which is the failure the whole design exists to avoid.
let refused = false;
try { register('en' as never, {}); } catch { refused = true; }
ok('registering an English catalogue is refused', refused);

/* ------------------------------------------------------------------ *
 * 5. Placeholder parity — the check that had to exist
 * ------------------------------------------------------------------ */

section('5. Every translation keeps its key\'s placeholders');

const CATALOGUES: [string, Catalogue][] = [['ar', ar], ['zh', zh]];

/**
 * A placeholder written flush against a letter — `minute{v1}`, `role{v2}`,
 * `item{v1}` — is an English PLURALISATION SUFFIX, not a value.
 *
 * The codemod produced those from expressions like `{{ n === 1 ? '' : 's' }}`,
 * so what gets interpolated is an `s` or an empty string. Neither Arabic nor
 * Chinese pluralises that way, so dropping it is the CORRECT translation, and
 * demanding parity would force a translator to keep a placeholder whose only
 * two possible values are both wrong in their language.
 *
 * A placeholder with a space or punctuation in front of it is a VALUE —
 * `{v0} of {v1}` — and dropping one of those loses a number off the screen in
 * one language only, silently. That is the failure this check exists for.
 *
 * Adding a placeholder the key does not have fails either way: nothing fills it,
 * so it renders as the literal text `{v9}`.
 */
function suffixPlaceholders(key: string): Set<string> {
    const out = new Set<string>();
    for (const m of key.matchAll(/([A-Za-z])\{(v\d+)\}/g)) out.add(m[2]);
    return out;
}

for (const [id, catalogue] of CATALOGUES) {
    const broken: string[] = [];
    for (const [key, message] of Object.entries(catalogue)) {
        const want = placeholdersOf(key);
        const got = new Set(placeholdersOf(message as Message));
        const suffixes = suffixPlaceholders(key);

        const added = [...got].filter(p => !want.includes(p));
        const lost = want.filter(p => !got.has(p) && !suffixes.has(p));

        if (added.length) broken.push(`${key}\n          ${id} ADDS [${added}] — renders literally`);
        if (lost.length) broken.push(`${key}\n          ${id} DROPS the value [${lost}]`);
    }
    ok(`${id}: no translation adds a placeholder, or drops a value one`,
        broken.length === 0,
        broken.slice(0, 8).join('\n        '));
}

/* ------------------------------------------------------------------ *
 * 6. No duplicate keys across the five modules
 * ------------------------------------------------------------------ */

section('6. No key is declared twice');

const MODULES: [string, Record<string, Catalogue>][] = [
    ['ar', { common: arCommon, account: arAccount, learning: arLearning, speaking: arSpeaking, tools: arTools, netsim: arNetsim, research: arResearch, studio: arStudio }],
    ['zh', { common: zhCommon, account: zhAccount, learning: zhLearning, speaking: zhSpeaking, tools: zhTools, netsim: zhNetsim, research: zhResearch, studio: zhStudio }],
];

for (const [id, modules] of MODULES) {
    const seen = new Map<string, string>();
    const clashes: string[] = [];
    for (const [name, catalogue] of Object.entries(modules)) {
        for (const key of Object.keys(catalogue)) {
            const first = seen.get(key);
            if (first) clashes.push(`"${key}" in ${first} and ${name}`);
            else seen.set(key, name);
        }
    }
    ok(`${id}: no key appears in two modules`,
        clashes.length === 0,
        clashes.slice(0, 10).join('\n        '));
}

/* ------------------------------------------------------------------ *
 * 7. The sidebar
 * ------------------------------------------------------------------ */

section('7. The sidebar is never half-translated');

/**
 * Everything the sidebar can render, with every access flag granted.
 *
 * Full access on purpose: an entry only a paying subscriber sees is still an
 * entry a paying subscriber sees, and gating the scan on the flags would mean
 * the sidebar's most valuable rows — the ones somebody has paid for — were the
 * only ones nothing checked.
 */
const ALL_ACCESS: Access = {
    auth: true, ai: true, lab: true, runbook: true,
    research: true, toastmasters: true, exam: true, proctor: true,
};

const navStrings = new Set<string>();
navStrings.add(HOME_ENTRY.text);
for (const group of globalGroups(ALL_ACCESS)) {
    navStrings.add(group.label);
    for (const item of group.items) navStrings.add(item.text);
}
for (const app of APP_SECTIONS) {
    // A section's group labels ("Practice", "Tools", "Related") come from
    // `sectionGroups`, not from `globalGroups` — walking only the platform menu
    // missed four of them, and "Related" is a heading on every application's
    // sidebar.
    for (const group of sectionGroups(app, ALL_ACCESS)) navStrings.add(group.label);
    navStrings.add(app.title);
    // The subtitle is the line under the title — one sentence saying what the
    // application is for. Left in English it is the only untranslated text on
    // an otherwise translated sidebar, which reads as a rendering fault.
    if (app.subtitle) navStrings.add(app.subtitle);
    for (const item of app.items) navStrings.add(item.text);
    for (const item of app.related ?? []) navStrings.add(item.text);
}

for (const [id, catalogue] of CATALOGUES) {
    const missing = [...navStrings].filter(s => catalogue[s] === undefined && !untranslatedSet.has(s));
    ok(`${id}: every sidebar label is translated`,
        missing.length === 0,
        missing.length ? `${missing.length} missing: ${missing.slice(0, 12).join(' · ')}` : '');
}

/* ------------------------------------------------------------------ *
 * 8. `$t` is template-only
 * ------------------------------------------------------------------ */

section('8. $t is never reached from a script block');

const inScript = uses.filter(u => u.global && u.inScript);
ok('no `$t(` inside a <script> block or a .ts file',
    inScript.length === 0,
    inScript.slice(0, 6).map(u => `${u.file}: ${u.key.slice(0, 50)}`).join('\n        ')
    + (inScript.length ? '\n        use `useI18n()` — $t is a template global and is undefined in script' : ''));

/* ------------------------------------------------------------------ *
 * 9. Orphans
 * ------------------------------------------------------------------ */

section('9. No catalogue entry has been orphaned by a reword');

/**
 * The sidebar's labels are reached as `$t(row.entry.text)` — a dynamic key, so
 * no source file contains the literal `$t('Courses')` and all 70-odd of them
 * would read as orphans. They are not orphans; they are the one set of keys
 * whose call site is a variable, which is exactly why check 7 verifies them
 * against `appNav.ts` instead of against the source scan.
 */
for (const [id, catalogue] of CATALOGUES) {
    const orphans = Object.keys(catalogue)
        .filter(k => !usedKeys.has(k) && !navStrings.has(k));
    ok(`${id}: every entry is asked for by some source file`,
        orphans.length === 0,
        orphans.length
            ? `${orphans.length} orphaned — the English was probably reworded, so these strings have\n        silently reverted to English:\n        ${orphans.slice(0, 12).map(o => JSON.stringify(o.slice(0, 60))).join('\n        ')}`
            : '');
}

/* ------------------------------------------------------------------ *
 * 10. The deliberately-untranslated list cannot rot
 * ------------------------------------------------------------------ */

section('10. The untranslated allow-list is current');

const staleAllow = untranslated.filter(k => !usedKeys.has(k));
ok('every allow-listed key is still used in the app',
    staleAllow.length === 0,
    staleAllow.slice(0, 10).map(k => JSON.stringify(k)).join('\n        '));

const pointlessAllow = untranslated.filter(k => ar[k] !== undefined || zh[k] !== undefined);
ok('nothing is both allow-listed and translated',
    pointlessAllow.length === 0,
    pointlessAllow.slice(0, 10).map(k => JSON.stringify(k)).join('\n        '));

/* ------------------------------------------------------------------ *
 * 11. Speech
 * ------------------------------------------------------------------ */

section('11. A voice is never cast in the wrong language');

const DEVICE = [
    { name: 'Microsoft David - English (United States)', lang: 'en-US', localService: true },
    { name: 'Microsoft Zira - English (United States)', lang: 'en-US', localService: true },
    { name: 'Microsoft Hamed - Arabic (Saudi)', lang: 'ar-SA' },
    { name: 'Microsoft Salma - Arabic (Egypt)', lang: 'ar-EG' },
    { name: 'Microsoft Xiaoxiao Online (Natural) - Chinese (Mainland)', lang: 'zh-CN' },
    { name: 'Microsoft Yunxi Online (Natural) - Chinese (Mainland)', lang: 'zh-CN' },
];

// The whole point of `pickVoice`. An assigned `utterance.voice` OVERRIDES
// `utterance.lang`, so a foreign voice reads the characters with the wrong
// phonetics — reported on the newscast as "it reads mixed words, not Arabic".
ok('a language with no device voice returns null, never a foreign voice',
    pickVoice(DEVICE.filter(v => v.lang.startsWith('en')), 'zh') === null
    && pickVoice(DEVICE.filter(v => v.lang.startsWith('en')), 'ar') === null);

ok('an empty voice list is null rather than a crash',
    pickVoice([], 'en') === null && !canSpeak([], 'ar'));

ok('a regional voice satisfies its language — ar-EG is an Arabic voice',
    voicesFor(DEVICE, 'ar').length === 2 && canSpeak(DEVICE, 'ar'));

ok('every cast voice is in the language it was asked for',
    LOCALES.every(l => {
        const v = pickVoice(DEVICE, l.id);
        return v === null || v.lang.toLowerCase().startsWith(l.speechPrefix);
    }));

// Microsoft names its Chinese voices in pinyin and the gender is not guessable
// from the romanisation: Yunxi/Yunjian/Yunyang are all male and share `Yun`,
// Xiaoxiao/Xiaoyi/Xiaohan are all female and share `Xiao`.
ok('Chinese voices are gendered from the known table, not from hints',
    pickVoice(DEVICE, 'zh', 'male')?.name.includes('Yunxi') === true
    && pickVoice(DEVICE, 'zh', 'female')?.name.includes('Xiaoxiao') === true);

ok('Arabic and English voices are gendered correctly too',
    pickVoice(DEVICE, 'ar', 'male')?.name.includes('Hamed') === true
    && pickVoice(DEVICE, 'ar', 'female')?.name.includes('Salma') === true
    && pickVoice(DEVICE, 'en', 'male')?.name.includes('David') === true
    && pickVoice(DEVICE, 'en', 'female')?.name.includes('Zira') === true);

ok('a device with one voice per language cannot field a pair',
    hasGenderedPair(DEVICE, 'zh')
    && !hasGenderedPair(DEVICE.filter(v => v.name.includes('Xiaoxiao')), 'zh'));

// `naayf` is Microsoft's MALE Saudi voice and used to be in both lists, so its
// score cancelled to zero and it was cast at random. `ali` inside `Australia`
// is the other half of the same bug.
ok('the gender table is matched whole-word: no name is in both genders',
    Object.entries(_KNOWN_GENDER).every(([name, g]) =>
        g === 'male' || g === 'female') && _KNOWN_GENDER['naayf'] === 'male');

/**
 * The newscast keeps its own copy of the gender table (working rule 10's cost,
 * paid deliberately — its casting is F0-measured and two-anchor, and merging
 * would make it depend on a general-purpose module). What must not happen is
 * the two DISAGREEING about a name they both know: a voice that is male on the
 * newscast and female in the interview room is one bug wearing two faces.
 */
const newscastSrc = fs.readFileSync(
    path.resolve('src/components/newscast/newscastEngine.ts'), 'utf8');
const nsTable = newscastSrc.match(/const KNOWN_GENDER[\s\S]*?\n\};/)?.[0] ?? '';
const nsPairs = [...nsTable.matchAll(/(\w+):\s*'(female|male)'/g)]
    .map(m => [m[1], m[2]] as [string, string]);
const disagreements = nsPairs.filter(([name, g]) =>
    _KNOWN_GENDER[name] !== undefined && _KNOWN_GENDER[name] !== g);

ok('the newscast\'s gender table and speech.ts do not disagree about any name',
    nsPairs.length > 0 && disagreements.length === 0,
    nsPairs.length === 0
        ? 'could not read KNOWN_GENDER out of newscastEngine.ts'
        : disagreements.map(([n, g]) => `${n}: newscast=${g} speech=${_KNOWN_GENDER[n]}`).join(', '));

/* ------------------------------------------------------------------ *
 * 12. The runtime, end to end
 * ------------------------------------------------------------------ */

section('12. Switching language actually switches the language');

/*
 * Everything above tests the ENGINE — `translate(localeId, key)` with the
 * locale passed in. None of it proves the thing a reader does: press a button
 * and see the page change. That needs `runtime.ts`, which is the only file here
 * that imports Vue, holds the one reactive ref, and is what `$t` is bound to.
 *
 * Worth its own section because the two can come apart in a way nothing else
 * would catch: a catalogue registered under the wrong id, a `setLocale` that
 * writes the ref but not the document, an `aiLanguage()` reading a different
 * variable from `t()`. Every one of those leaves 45 green checks and a page
 * that does not translate.
 */
{
    // Imported here rather than at the top of the file: it pulls in Vue, and
    // the plain modules above are deliberately loadable without it.
    const runtime = await import('../../src/i18n/runtime');

    runtime.setLocale('en');
    const englishSample = runtime.t('Cancel');

    runtime.setLocale('ar');
    ok('setLocale("ar") makes t() answer in Arabic',
        runtime.t('Cancel') === 'إلغاء',
        `got ${JSON.stringify(runtime.t('Cancel'))}`);

    ok('...and the locale object follows, direction and all',
        runtime.locale.value.id === 'ar'
        && runtime.isRtl.value === true
        && runtime.dir.value === 'rtl');

    // The AI half reads the same ref as the interface half. If it did not, a
    // reader would get an Arabic page and an English interviewer — which is the
    // failure working rule 39 exists for.
    ok('...and aiLanguage() reads the same choice, so the model agrees with the page',
        runtime.aiLanguage() === 'ar'
        && runtime.aiLanguageHeaders()['X-SFS-Language'] === 'ar');

    runtime.setLocale('zh');
    ok('setLocale("zh") makes t() answer in Chinese',
        runtime.t('Cancel') === '取消',
        `got ${JSON.stringify(runtime.t('Cancel'))}`);

    ok('...and Chinese does NOT flip the layout',
        runtime.isRtl.value === false && runtime.dir.value === 'ltr');

    // Interpolation and plurals through the runtime rather than the engine.
    ok('a placeholder is filled in the translated string',
        runtime.t('Page {v0} of {v1}', { v0: 2, v1: 9 }) === '第 2 页，共 9 页',
        `got ${JSON.stringify(runtime.t('Page {v0} of {v1}', { v0: 2, v1: 9 }))}`);

    runtime.setLocale('ar');
    ok('tc() picks an Arabic plural form by count',
        runtime.tc('{n} unread', 1) !== runtime.tc('{n} unread', 5)
        && runtime.tc('{n} unread', 2) !== runtime.tc('{n} unread', 5));

    runtime.setLocale('en');
    ok('and going back to English returns the key itself, unchanged',
        runtime.t('Cancel') === 'Cancel' && englishSample === 'Cancel');
}

/* ------------------------------------------------------------------ *
 * 13. Coverage
 * ------------------------------------------------------------------ */

/* ------------------------------------------------------------------ *
 * RTL corrections that correct nothing
 * ------------------------------------------------------------------ */

/*
 * EVERY CLASS `rtl.css` NAMES MUST EXIST SOMEWHERE ELSE.
 *
 * This is the check that had to exist, and it is here rather than in
 * `check:cssleaks` because the failure it catches is a *language* failure: the
 * page is correct in English and broken in Arabic, so nobody working in English
 * can see it and no other check looks at `dir` at all.
 *
 * `rtl.css` is the one stylesheet on the platform whose entire job is to
 * correct declarations another file has already made. That makes it uniquely
 * fragile in a way no amount of care in the file itself can fix: a selector
 * that names a class which does not exist is not an error, it is not a warning,
 * and it is not visibly different from a correction that is working. It just
 * silently does nothing.
 *
 * It had three of them, and together they broke the mobile drawer in Arabic for
 * the whole life of the file. `.sidebar.mobile-hidden` and `.sidebar.is-closed`
 * were invented names — `SideNav.vue` uses `.active` — and `.mobile-menu-btn`
 * was a guess at `.mobile-toggle`. The consequence was not a missing
 * correction: the rule that DID match re-pinned the rail to `right: 0`, and the
 * rule that was supposed to park it off-screen never ran, so the closed drawer
 * sat `position: fixed` in the middle of the viewport with the page flowing
 * underneath it. Reported as the side menu being "destroyed and mixed into the
 * pages".
 *
 * A class is "defined" if any other stylesheet declares it, or any template
 * mentions it in a `class` / `:class` binding. That is deliberately generous —
 * the point is to catch a name that exists NOWHERE, which is always a typo or a
 * rename nobody carried across, and never a judgement call.
 */
section('14. rtl.css corrects something that exists');

const CSS_DIR = path.resolve('src/assets/css');
const RTL_CSS = path.join(CSS_DIR, 'rtl.css');

/** Class names appearing in the selector half of a stylesheet. */
function classesInCss(source: string): Set<string> {
    const found = new Set<string>();
    // Strip comments and declaration blocks, so a `content: '.foo'` or a note
    // in prose cannot register as a selector.
    const selectorsOnly = source
        .replace(/\/\*[\s\S]*?\*\//g, '')
        .replace(/\{[^{}]*\}/g, '{}');
    for (const m of selectorsOnly.matchAll(/\.(-?[A-Za-z_][\w-]*)/g)) found.add(m[1]);
    return found;
}

const rtlSource = fs.readFileSync(RTL_CSS, 'utf8');
const rtlClasses = classesInCss(rtlSource);

const defined = new Set<string>();
for (const name of fs.readdirSync(CSS_DIR)) {
    if (!name.endsWith('.css') || name === 'rtl.css') continue;
    for (const c of classesInCss(fs.readFileSync(path.join(CSS_DIR, name), 'utf8'))) defined.add(c);
}
for (const extra of ['src/style.css']) {
    if (fs.existsSync(extra)) {
        for (const c of classesInCss(fs.readFileSync(extra, 'utf8'))) defined.add(c);
    }
}

// Templates, including `<style scoped>` blocks and every `class` / `:class`
// binding — a class applied only from a component and styled only in a scoped
// block is still a real class.
const walkVue = (dir: string) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) { walkVue(full); continue; }
        if (!full.endsWith('.vue')) continue;
        const src = fs.readFileSync(full, 'utf8');
        for (const c of classesInCss(src)) defined.add(c);
        for (const m of src.matchAll(/:?class\s*=\s*"([^"]*)"/g)) {
            for (const c of m[1].matchAll(/[\w-]+/g)) defined.add(c[0]);
        }
        for (const m of src.matchAll(/'([\w-]+)'\s*:/g)) defined.add(m[1]);
    }
};
walkVue(path.resolve('src'));

/*
 * The allow-list, and why it is a list of names with a reason each rather than
 * a pattern.
 *
 * Two kinds of class in `rtl.css` legitimately match nothing in `src/`:
 *
 *  1. **A hook this file OFFERS.** `class="sfs-ltr"` on a uuid is the documented
 *     way to stop the bidi algorithm rearranging its hyphens. Nothing has to be
 *     using it yet for the rule to be correct — it is an interface, and an
 *     unused interface is a real state.
 *  2. **A class rendered by something that is not in `src/`.** `highlight.js`
 *     emits `.hljs`, an editor emits `.cm-editor`, and neither appears in any
 *     file here. Pinning those left-to-right is the single most valuable rule in
 *     the file (a shell command with its pipe relocated is a command that does
 *     not run), and it cannot be verified from this repository.
 *
 * Everything else is a typo, and the triage that produced this list found three:
 * `.stage` (the newscast uses `studio__stage`), `.terminal` (`lab.css` calls it
 * `terminal-wrapper`) and `.comment-text` (the research screens use
 * `rf-comment-text`). All three were corrections that silently did nothing.
 *
 * An entry that becomes defined is REMOVED, and the check below fails until it
 * is — the same rule `check:cssleaks` applies to its own exceptions and for the
 * same reason: a list that may contain dead entries is a list nobody trusts, and
 * an exemption left behind is an exemption that hides the next real typo.
 */
const RTL_ALLOWED_ORPHANS: Record<string, string> = {
    // Hooks this file offers to templates.
    'sfs-flip': 'opt-in mirror for a directional glyph',
    'sfs-noflip': 'the escape hatch back out of it',
    'sfs-ltr': 'pin a machine identifier left-to-right',
    'uuid': 'bidi isolation for an id printed in prose',
    'record-id': 'as above',
    'external-id': 'as above',
    'nav-arrow': 'directional glyph hook',
    'back-arrow': 'directional glyph hook',
    'chevron': 'directional glyph hook — note `.nav-more-chevron` is a DISCLOSURE '
        + 'caret pointing down, and is deliberately not mirrored',
    'collapse-btn': 'the absolutely-positioned rail handle some layouts use',
    'bar-fill': 'a meter fill positioned with `left`',
    'meter__fill': 'as above',
    'msg-body': 'chat bubble text, for `unicode-bidi: plaintext`',
    'bubble__text': 'as above',
    // Rendered outside src/.
    'hljs': 'highlight.js emits this — code must never render right-to-left',
    'cm-editor': 'CodeMirror',
    'monaco-editor': 'Monaco',
    'lab-output': 'sandbox output, inserted as text at runtime',
};

const staleAllowances = Object.keys(RTL_ALLOWED_ORPHANS)
    .filter(c => defined.has(c))
    .sort();
ok('no allow-listed rtl.css orphan has since become a real class',
    staleAllowances.length === 0,
    staleAllowances.length
        ? `these are defined now, so remove them from RTL_ALLOWED_ORPHANS: ${staleAllowances.join(', ')}`
        : '');

const orphanRtl = [...rtlClasses]
    .filter(c => !(c in RTL_ALLOWED_ORPHANS) && !defined.has(c))
    .sort();

ok('every class rtl.css corrects exists somewhere else',
    orphanRtl.length === 0,
    orphanRtl.length
        ? `rtl.css names ${orphanRtl.length} class(es) nothing else defines, so the `
          + `correction silently does nothing:\n        ${orphanRtl.join(', ')}`
        : '');

/*
 * The mobile drawer specifically, because it is the one that was broken and the
 * one whose breakage is worst. `side-nav.css` parks the closed drawer with a
 * transform inside a `max-width` query; a right-pinned drawer parked with a
 * NEGATIVE translate is on-screen, so the sign is the whole bug. Assert the
 * correction exists, is inside a media query, and pushes the right way.
 */
const sideNav = fs.readFileSync(path.join(CSS_DIR, 'side-nav.css'), 'utf8');
const parksNegative = /\.sidebar[^{}]*\{[^{}]*translateX\(-100%\)/.test(sideNav);
ok('side-nav.css still parks the mobile drawer at translateX(-100%)', parksNegative,
    'if this moved, the RTL correction below is describing a layout that no longer exists');

const rtlMedia = rtlSource.match(/@media[^{]*max-width:\s*768px[^{]*\{([\s\S]*?)\n\}/);
ok('rtl.css corrects the parked drawer inside a max-width: 768px query',
    !!rtlMedia && /translateX\(100%\)/.test(rtlMedia[1]),
    'outside the query the correction would also translate the DESKTOP rail off-screen');
ok('rtl.css brings the open drawer back to translateX(0)',
    !!rtlMedia && /\.sidebar\.active[\s\S]*translateX\(0\)/.test(rtlMedia[1]),
    'the parked rule matches the open drawer too, so this has to be restated');

section('13. Coverage');

const byArea = new Map<string, Set<string>>();
for (const use of uses) {
    const area = use.file.split('/').slice(0, 2).join('/');
    if (!byArea.has(area)) byArea.set(area, new Set());
    byArea.get(area)!.add(use.key);
}

const translatable = [...usedKeys].filter(k => !untranslatedSet.has(k));

for (const [id, catalogue] of CATALOGUES) {
    const done = translatable.filter(k => catalogue[k] !== undefined).length;
    const pct = Math.round((done / translatable.length) * 1000) / 10;
    console.log(`  ${id}: ${done} / ${translatable.length} translatable keys — ${pct}%`);
}
console.log(`  (${untranslated.length} keys deliberately left in English — see tools/i18n-check/untranslated.json)`);

if (process.argv.includes('--gaps')) {
    console.log('\n  Untranslated, by area:');
    const areas = [...byArea.entries()].sort((a, b) => b[1].size - a[1].size);
    for (const [area, keys] of areas) {
        const missing = [...keys].filter(k =>
            !untranslatedSet.has(k) && (ar[k] === undefined || zh[k] === undefined));
        if (!missing.length) continue;
        console.log(`\n  ### ${area} (${missing.length})`);
        for (const k of missing.sort()) console.log(`  ${k}`);
    }
}

/* ------------------------------------------------------------------ *
 * Result
 * ------------------------------------------------------------------ */

console.log('');
if (failures) {
    console.log(`FAIL — ${failures} of ${checks} checks failed.`);
    process.exit(1);
}
console.log(`All ${checks} checks passed.`);
