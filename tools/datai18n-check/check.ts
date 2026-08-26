/**
 * `npm run check:datai18n` — a record's own text, in three languages.
 *
 * Same shape as `tools/leaderboard-check` and `tools/appnav-check`: the module
 * under test (`src/i18n/records.ts`) is plain — no Vue, no DOM, no store — so
 * node can load it and assert the properties that are invisible until they are
 * wrong in front of a reader who cannot report in English.
 *
 * ============================================================
 * WHAT IT GUARDS, IN THE ORDER IT MATTERS
 * ============================================================
 *
 *  1. **English is always the fallback, and it is never worse than before.**
 *     There is no state — no missing map, no missing language, no missing field,
 *     no blank string, no corrupt payload — in which a record renders emptier
 *     than it did before any of this existed. That property is what made it safe
 *     to put `$td` in front of every title on the platform in one change, and it
 *     is the one somebody would break by "tidying" the fallback chain.
 *
 *  2. **A filter box matches EVERY language, not the rendered one.** A reader
 *     looking at an Arabic course list types Arabic; the same person describing
 *     it to a colleague, or coming back after switching the interface, types
 *     English. A search that only matched the current language would silently
 *     stop finding things when you change a setting — for exactly the readers
 *     this whole change is for.
 *
 *  3. **Sorting is by what is DISPLAYED, in a locale collator.**
 *     `a.title.localeCompare(b.title)` is the obvious spelling and it is wrong
 *     twice: it compares the English while the reader looks at the Arabic, and
 *     with no locale it uses the browser's collation, so the same list sorts
 *     differently for two readers of the same language.
 *
 *  4. **There is no cross-language fallback.** Showing a Chinese title to an
 *     Arabic reader because no Arabic one exists is strictly worse than showing
 *     the English, which every reader here has already been reading. Asserted,
 *     because "fall back to any translation we have" sounds generous and is not.
 *
 *  5. **The template global and the module agree.** `$td` is what 30-odd
 *     templates call, and it reads a reactive locale ref rather than taking one
 *     — so the two can come apart in a way no check on the module alone would
 *     see. Same reason `check:i18n` has a section that drives the runtime.
 */

import {
    field, titleOf, hasTranslation, searchText, matches, byField, missingLocales,
    BASE_LOCALE, type Translatable,
} from '../../src/i18n/records';
import { LOCALES, type LocaleId } from '../../src/i18n/locales';

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
 * Fixtures — the shape a backend carrying utils/translations.py sends
 * ------------------------------------------------------------------ */

const full: Translatable = {
    external_course_id: 'c-1',
    title: 'Web Technologies',
    description: 'HTTP and friends',
    translations: {
        ar: { title: 'تقنيات الويب', description: 'إتش تي تي بي وما حولها' },
        zh: { title: '网络技术', description: 'HTTP 及相关内容' },
    },
} as Translatable;

/** Translated into Arabic only — the ordinary half-finished state. */
const partial: Translatable = {
    title: 'Network Fundamentals',
    description: 'Switching and routing',
    translations: { ar: { title: 'أساسيات الشبكات' } },
} as Translatable;

/** A record from a replica that has not pulled the build yet: no key at all. */
const legacy: Translatable = { title: 'Legacy Course', description: 'Old' } as Translatable;

/** Deployed, nothing translated. `{}` rather than absent — a different fact. */
const empty: Translatable = { title: 'Untranslated', translations: {} } as Translatable;

/* ------------------------------------------------------------------ *
 * 1. English is always the floor
 * ------------------------------------------------------------------ */

section('1. Nothing renders emptier than it did before');

ok('a translated field is used', field(full, 'title', 'ar') === 'تقنيات الويب');
ok('...and in Chinese too', field(full, 'title', 'zh') === '网络技术');
ok('English asks for the record\'s own field, never the map',
   field(full, 'title', 'en') === 'Web Technologies');

// Each of these is a state that exists in production, and every one of them has
// to land on the English rather than on ''.
ok('a language with no entry falls back to English',
   field(partial, 'title', 'zh') === 'Network Fundamentals');
ok('a FIELD with no entry falls back to English, even where the language exists',
   field(partial, 'description', 'ar') === 'Switching and routing');
ok('a record with no map at all falls back to English',
   field(legacy, 'title', 'ar') === 'Legacy Course');
ok('a record with an empty map falls back to English',
   field(empty, 'title', 'ar') === 'Untranslated');
ok('a blank translation is a gap, not an answer',
   field({ title: 'Real', translations: { ar: { title: '   ' } } } as Translatable,
         'title', 'ar') === 'Real');

// A corrupt payload must degrade, not throw: this runs inside a template, so an
// exception blanks the whole page rather than one title.
ok('a map that is not an object degrades to English',
   field({ title: 'Safe', translations: 'nope' } as unknown as Translatable, 'title', 'ar')
   === 'Safe');
ok('a language entry that is not an object degrades to English',
   field({ title: 'Safe', translations: { ar: 'nope' } } as unknown as Translatable,
         'title', 'ar') === 'Safe');
ok('a null record is the empty string, not a crash', field(null, 'title', 'ar') === '');
ok('a missing field on a record with no translation is the empty string',
   field(legacy, 'nope', 'ar') === '');
ok('a non-string own value is stringified rather than dropped',
   field({ title: 7 } as unknown as Translatable, 'title', 'en') === '7');

ok('titleOf is field(record, "title")',
   titleOf(full, 'ar') === field(full, 'title', 'ar'));
ok('...and takes another field name when a service calls its title something else',
   titleOf({ course_name: 'Grammar', translations: { ar: { course_name: 'قواعد' } } } as Translatable,
           'ar', 'course_name') === 'قواعد');

/* ------------------------------------------------------------------ *
 * 2. No cross-language fallback
 * ------------------------------------------------------------------ */

section('2. There is no "any translation will do" step');

// This is the one somebody would add on purpose, reasoning that a Chinese title
// is better than an English one for a reader who wanted Arabic. It is not: the
// reader cannot read it, and cannot tell whether the platform is broken or they
// have picked the wrong language.
ok('an Arabic reader is NEVER shown the Chinese translation',
   field(partial, 'title', 'zh') !== 'أساسيات الشبكات'
   && field({ title: 'E', translations: { zh: { title: 'C' } } } as Translatable,
            'title', 'ar') === 'E');
ok('and English is never taken out of the map even if a backend put it there',
   field({ title: 'Own', translations: { en: { title: 'Smuggled' } } } as unknown as Translatable,
         'title', 'en') === 'Own');

/* ------------------------------------------------------------------ *
 * 3. Searching
 * ------------------------------------------------------------------ */

section('3. A filter box matches every language the record carries');

ok('the English matches', matches(full, ['title'], 'web technologies'));
ok('the Arabic matches', matches(full, ['title'], 'تقنيات'));
ok('the Chinese matches', matches(full, ['title'], '网络'));
ok('a description matches as well as a title',
   matches(full, ['title', 'description'], 'friends'));
ok('a field NOT named is not searched',
   !matches(full, ['title'], 'friends'));
ok('an empty query matches everything, so a blank box is not a filter',
   matches(full, ['title'], '') && matches(full, ['title'], '   '));
ok('a query nothing carries does not match', !matches(full, ['title'], 'astrophysics'));
ok('English matching is case-insensitive', matches(full, ['title'], 'WEB'));
ok('a null record does not match, and does not throw',
   !matches(null, ['title'], 'x'));
ok('searchText joins with a separator, so two fields cannot form a false match',
   !searchText(full, ['title', 'description']).includes('technologieshttp'));

/* ------------------------------------------------------------------ *
 * 4. Sorting
 * ------------------------------------------------------------------ */

section('4. Sorting is on the displayed text, in the reader\'s collation');

const rows: Translatable[] = [
    { title: 'Zebra', translations: { ar: { title: 'ألف' } } } as Translatable,
    { title: 'Apple', translations: { ar: { title: 'ياء' } } } as Translatable,
];

const inEnglish = [...rows].sort(byField('title', 'en')).map(r => r.title);
ok('in English, Apple precedes Zebra',
   JSON.stringify(inEnglish) === JSON.stringify(['Apple', 'Zebra']), String(inEnglish));

// The whole point: the ARABIC order is the reverse of the English one here, so a
// comparator reading the English field cannot produce it by accident.
const inArabic = [...rows].sort(byField('title', 'ar')).map(r => r.title);
ok('in Arabic, the order follows the Arabic titles rather than the English',
   JSON.stringify(inArabic) === JSON.stringify(['Zebra', 'Apple']), String(inArabic));

const mixed: Translatable[] = [
    { title: 'b' } as Translatable,
    { title: 'A' } as Translatable,
];
ok('the collator is case-insensitive, so "A" precedes "b" rather than following it',
   [...mixed].sort(byField('title', 'en'))[0].title === 'A');

const numbered: Translatable[] = [
    { title: 'Lesson 10' } as Translatable,
    { title: 'Lesson 2' } as Translatable,
];
ok('numeric collation puts Lesson 2 before Lesson 10',
   [...numbered].sort(byField('title', 'en'))[0].title === 'Lesson 2');

ok('an untranslated row sorts on its English without falling to the bottom',
   [...[legacy, full]].sort(byField('title', 'ar'))
       .map(r => r.title).includes('Legacy Course'));

/* ------------------------------------------------------------------ *
 * 5. Reporting gaps — for the console
 * ------------------------------------------------------------------ */

section('5. What is missing, named rather than counted');

ok('a fully translated record has no gaps',
   missingLocales(full, ['title'], LOCALES.map(l => l.id)).length === 0);
ok('a half-translated record names the language that is missing',
   JSON.stringify(missingLocales(partial, ['title'], LOCALES.map(l => l.id)))
   === JSON.stringify(['zh']));
ok('an untranslated record names both',
   JSON.stringify(missingLocales(legacy, ['title'], LOCALES.map(l => l.id)))
   === JSON.stringify(['ar', 'zh']));
ok('English is never reported as a gap - it is the record\'s own field',
   !missingLocales(legacy, ['title'], LOCALES.map(l => l.id))
       .includes('en' as LocaleId));
ok('a gap in ONE of two fields is not a gap for the record',
   missingLocales(partial, ['title', 'description'], ['ar'] as LocaleId[]).length === 0);

ok('hasTranslation is true where there is text', hasTranslation(full, 'ar'));
ok('...false where the language is absent', !hasTranslation(partial, 'zh'));
ok('...false for a whitespace-only entry',
   !hasTranslation({ translations: { ar: { title: '  ' } } } as Translatable, 'ar'));
ok('...and false for English, which is not a translation',
   !hasTranslation(full, 'en'));

/* ------------------------------------------------------------------ *
 * 6. The invariants the shape rests on
 * ------------------------------------------------------------------ */

section('6. The invariants');

ok('English is the base locale', BASE_LOCALE === 'en');
ok('the base locale is one of the three', LOCALES.some(l => l.id === BASE_LOCALE));
ok('there are three languages, which is what the backends declare',
   LOCALES.length === 3);

/* ------------------------------------------------------------------ *
 * 7. The template global, not just the module
 * ------------------------------------------------------------------ */

section('7. $td reads the same locale the page is in');

// The module takes a locale as an argument, which is what makes everything above
// testable -- and it means none of it proves the RUNTIME wrapper reads the right
// ref. `$td` on an Arabic page returning English would leave every check above
// green and every title on screen in English. Same reason `check:i18n` has a
// section that drives `setLocale` rather than passing a locale in.
const { td, tdMatches, tdSort } = await import('../../src/i18n/runtime');
const { setLocale } = await import('../../src/i18n/runtime');

setLocale('ar');
ok('setLocale("ar") makes $td answer in Arabic', td(full) === 'تقنيات الويب');
ok('...and $td(record, field) too', td(full, 'description') === 'إتش تي تي بي وما حولها');
ok('...and tdMatches searches every language from that state',
   tdMatches(full, ['title'], 'web') && tdMatches(full, ['title'], 'تقنيات'));
ok('...and tdSort orders by the Arabic',
   [...rows].sort(tdSort()).map(r => r.title)[0] === 'Zebra');

setLocale('zh');
ok('setLocale("zh") makes $td answer in Chinese', td(full) === '网络技术');
ok('...and an untranslated field still falls back to English',
   td(partial) === 'أساسيات الشبكات' ? false : td(partial) === 'Network Fundamentals');

setLocale('en');
ok('and back in English it is the record\'s own field',
   td(full) === 'Web Technologies');

/* ------------------------------------------------------------------ *
 * Result
 * ------------------------------------------------------------------ */

console.log('');
if (failures) {
    console.log(`FAIL — ${failures} of ${checks} checks failed.`);
    process.exit(1);
}
console.log(`All ${checks} checks passed.`);
