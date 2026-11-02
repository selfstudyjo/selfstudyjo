/**
 * The site search: one box in the top bar that finds anything on the platform.
 *
 * A plain module -- no Vue, no DOM, no store, no service -- on the
 * `photoMask.ts` / `appNav.ts` / `leaderboardEngine.ts` precedent, and for the
 * same reason: everything a search DECIDES is invisible in a screenshot and
 * wrong in a way nobody reports. Which result comes first, whether an Arabic
 * query finds a record typed with a hamza, whether a Chinese query matches at
 * all, whether the list reorders itself as somebody types, whether a locked
 * runbook is a dead link -- `npm run check:sitesearch` drives all of it in node.
 *
 * What lives here:
 *
 *  - **Folding** (`fold`, `foldWithMap`): case, Latin diacritics, Arabic
 *    harakat, tatweel and the four letter-form pairs a reader types either way
 *    (أ إ آ ٱ / ا, ى / ي, ة / ه, ؤ ئ / و ي), Arabic-Indic digits, full-width
 *    forms. Punctuation becomes a space, so `ci/cd` and `ci cd` are the same
 *    query.
 *  - **Matching and scoring** (`search`): every term must match somewhere; a
 *    title prefix beats a word start beats a substring beats the context line
 *    beats the description; an exact title wins outright. Chinese has no spaces,
 *    so a CJK term matches as a substring at full word-start weight (working
 *    rule 40: a rule tuned on English prose rejects other scripts).
 *  - **Every language a record carries** is matched, not just the displayed
 *    one, exactly as `records.ts` does for a filter box: a reader who switches
 *    the interface types the other language.
 *  - **A total order**, so a list re-derived on every keystroke never reorders
 *    rows that scored the same (the `sortLabs` / `examShuffle` trap).
 *  - **Highlight ranges** for rendering matched text as segments, never markup.
 *  - **The document builders**, which turn each service's rows into one shape
 *    with its route and, where the reader cannot open it, a LOCK rather than a
 *    link the router guard would bounce.
 */

import type { TranslationMap } from '@/i18n/records';
import type { LocaleId } from '@/i18n/locales';
import {
    APP_SECTIONS, HOME_ENTRY, canSee, globalGroups, isUnder,
    type Access, type AccessKey, type IconName, type NavEntry,
} from '@/navigation/appNav';

/* ------------------------------------------------------------------ *
 * Types
 * ------------------------------------------------------------------ */

/** The result sections, in the order they are drawn. */
export type SectionId = 'pages' | 'courses' | 'lessons' | 'labs' | 'quizzes' | 'exams' | 'runbooks';

export const SECTIONS: readonly SectionId[] = [
    'pages', 'courses', 'lessons', 'labs', 'quizzes', 'exams', 'runbooks',
];

/** A router location. Plain so the module never imports the router. */
export interface Target {
    path: string;
    query?: Record<string, string>;
}

/**
 * Why a result cannot be opened by this reader, and where to send them.
 *
 * `signin`: the page needs an account. `plan`: it needs a subscription feature
 * (`feature` names which, an `AccessKey`). A locked result is still SHOWN --
 * finding out that a runbook exists is worth something -- but its link goes to
 * the place that removes the lock, never to a route the guard would bounce.
 */
export interface Lock {
    kind: 'signin' | 'plan';
    feature?: AccessKey;
    to: Target;
}

export interface SearchDoc {
    section: SectionId;
    /** Unique within its section. */
    id: string;
    /** What is DRAWN, already in the reader's language. */
    title: string;
    /** Every other spelling of the title worth matching -- English and the other languages. */
    alt: string[];
    /** The secondary line, drawn only (course name, track, description snippet). */
    subtitle: string;
    /** Matched at middle weight: the parent's name in every language. */
    ctx: string[];
    /** Matched at the lowest weight: descriptions, keywords, topics. */
    body: string[];
    to: Target;
    /** A name the component maps to a glyph. */
    icon: string;
    /** A small badge beside the title, e.g. "playground". Empty for none. */
    kind: string;
    lock: Lock | null;
    /** Source order, the tie-break after the score. */
    rank: number;
}

export interface Hit {
    doc: SearchDoc;
    score: number;
    /** True when at least one term matched only by a one-letter typo. */
    fuzzy: boolean;
}

export interface SectionResult {
    section: SectionId;
    hits: Hit[];
    total: number;
    /** How many more there are beyond `hits`. */
    more: number;
}

/* ------------------------------------------------------------------ *
 * Folding
 * ------------------------------------------------------------------ */

/** Letters a reader types either way, after NFKD has already removed the marks. */
const LETTER_MAP: Record<string, string> = {
    'ٱ': 'ا', // ٱ alef wasla -> ا
    'ى': 'ي', // ى alef maqsura -> ي
    'ی': 'ي', // ی Farsi yeh -> ي
    'ة': 'ه', // ة teh marbuta -> ه
    'ک': 'ك', // ک keheh -> ك
    'ـ': '',       // ـ tatweel: stretching, not a letter
    '‌': '', '‍': '', '‎': '', '‏': '',
};
for (let i = 0; i < 10; i++) {
    LETTER_MAP[String.fromCharCode(0x0660 + i)] = String(i); // Arabic-Indic
    LETTER_MAP[String.fromCharCode(0x06f0 + i)] = String(i); // Extended (Persian)
}

const MARKS = /\p{M}+/gu;
const WORDISH = /[\p{L}\p{N}]/u;
const CJK = /[぀-ヿ㐀-䶿一-鿿豈-﫿가-힯]/;

/** One code point, folded. May be '' (removed), ' ' (a separator) or several characters. */
function foldPoint(ch: string): string {
    const code = ch.charCodeAt(0);
    if (code < 128) {
        if ((code >= 48 && code <= 57) || (code >= 97 && code <= 122)) return ch;
        if (code >= 65 && code <= 90) return String.fromCharCode(code + 32);
        return ' ';
    }
    let out = '';
    for (const c of ch.normalize('NFKD').replace(MARKS, '').toLowerCase()) {
        const mapped = LETTER_MAP[c];
        const v = mapped === undefined ? c : mapped;
        if (!v) continue;
        out += WORDISH.test(v) ? v : ' ';
    }
    return out;
}

/**
 * A string as the matcher sees it: lowercase, unaccented, letter forms unified,
 * punctuation as single spaces, trimmed.
 */
export function fold(text: string): string {
    if (!text) return '';
    let out = '';
    let space = true; // suppresses leading and repeated separators
    for (const ch of String(text)) {
        for (const c of foldPoint(ch)) {
            if (c === ' ') {
                if (!space) { out += ' '; space = true; }
            } else {
                out += c;
                space = false;
            }
        }
    }
    return space && out.endsWith(' ') ? out.slice(0, -1) : out;
}

/**
 * `fold`, plus where each folded character came from, so a match found in the
 * folded text can be drawn on the original. `start[i]` / `end[i]` are the
 * UTF-16 offsets of the original code point folded character `i` came from.
 */
export function foldWithMap(text: string): { folded: string; start: number[]; end: number[] } {
    const start: number[] = [];
    const end: number[] = [];
    let folded = '';
    let space = true;
    let offset = 0;
    for (const ch of String(text || '')) {
        const from = offset;
        offset += ch.length;
        for (const c of foldPoint(ch)) {
            if (c === ' ') {
                if (space) continue;
                space = true;
            } else {
                space = false;
            }
            folded += c;
            start.push(from);
            end.push(offset);
        }
    }
    if (folded.endsWith(' ')) {
        folded = folded.slice(0, -1);
        start.pop();
        end.pop();
    }
    return { folded, start, end };
}

/** The query's terms: folded, de-duplicated, at most eight. */
export function terms(query: string): string[] {
    const seen = new Set<string>();
    for (const term of fold(query).split(' ')) {
        if (term) seen.add(term);
        if (seen.size >= 8) break;
    }
    return [...seen];
}

const isCjk = (c: string | undefined) => !!c && CJK.test(c);

/**
 * How strongly `term` occurs in `hay`: 3 at the very start, 2 at the start of
 * a word, 1 anywhere, 0 not at all.
 *
 * A CJK character is a word start wherever it falls -- Chinese writes no spaces,
 * so "at the start of a word" means nothing there and requiring it would make
 * every Chinese query a weak substring match. A single Latin letter anywhere is
 * noise rather than a match ("e" is in nearly every title), so it counts only at
 * a word start.
 */
export function strength(hay: string, term: string): number {
    if (!hay || !term) return 0;
    let at = hay.indexOf(term);
    if (at < 0) return 0;
    if (at === 0) return 3;
    const single = term.length === 1 && !isCjk(term);
    while (at >= 0) {
        if (hay[at - 1] === ' ' || isCjk(hay[at])) return 2;
        at = hay.indexOf(term, at + 1);
    }
    return single ? 0 : 1;
}

/**
 * Is `a` within one edit (insert, delete, substitute, or swap of two
 * neighbours) of `b`? Bounded, so it gives up the moment a second edit is
 * needed -- it runs against every title word of every record per keystroke.
 */
export function withinOneEdit(a: string, b: string): boolean {
    if (a === b) return true;
    const la = a.length;
    const lb = b.length;
    if (Math.abs(la - lb) > 1) return false;
    let i = 0;
    while (i < la && i < lb && a[i] === b[i]) i++;
    if (la === lb) {
        if (a.slice(i + 1) === b.slice(i + 1)) return true;                       // substitute
        return a[i] === b[i + 1] && a[i + 1] === b[i] && a.slice(i + 2) === b.slice(i + 2); // swap
    }
    return la > lb ? a.slice(i + 1) === b.slice(i) : a.slice(i) === b.slice(i + 1);
}

/* ------------------------------------------------------------------ *
 * The index
 * ------------------------------------------------------------------ */

interface Prepared {
    doc: SearchDoc;
    title: string;      // folded displayed title
    titles: string[];   // folded title in every language, displayed first
    words: string[];    // title words of 4+ letters, for the typo pass
    ctx: string;
    body: string;
    sortKey: string;
}

export interface SearchIndex {
    readonly size: number;
    readonly bySection: ReadonlyMap<SectionId, Prepared[]>;
}

/** Fold everything once, so a keystroke only runs `indexOf`. */
export function buildIndex(docs: readonly SearchDoc[]): SearchIndex {
    const bySection = new Map<SectionId, Prepared[]>();
    for (const doc of docs) {
        const title = fold(doc.title);
        const titles = [title];
        for (const alt of doc.alt) {
            const f = fold(alt);
            if (f && !titles.includes(f)) titles.push(f);
        }
        const words = new Set<string>();
        for (const t of titles) {
            for (const w of t.split(' ')) if (w.length >= 4 && /^[a-z0-9]+$/.test(w)) words.add(w);
        }
        const row: Prepared = {
            doc,
            title,
            titles,
            words: [...words],
            ctx: doc.ctx.map(fold).filter(Boolean).join(' \u0001 '),
            body: doc.body.map(fold).filter(Boolean).join(' \u0001 '),
            sortKey: title,
        };
        const list = bySection.get(doc.section);
        if (list) list.push(row);
        else bySection.set(doc.section, [row]);
    }
    return { size: docs.length, bySection };
}

const TITLE_WEIGHT = [0, 40, 70, 100];
const CTX_WEIGHT = [0, 14, 28, 28];
const BODY_WEIGHT = [0, 8, 18, 18];

/** One record against the query, or null when some term matches nothing. */
function scoreOne(row: Prepared, qTerms: string[], whole: string): Hit | null {
    let score = 0;
    let fuzzy = false;
    let allInTitle = true;
    for (const term of qTerms) {
        let best = 0;
        let inTitle = false;
        for (const t of row.titles) {
            const s = strength(t, term);
            if (s && TITLE_WEIGHT[s] > best) { best = TITLE_WEIGHT[s]; inTitle = true; }
            if (best === 100) break;
        }
        if (best < 28) {
            const s = strength(row.ctx, term);
            if (s) best = Math.max(best, CTX_WEIGHT[s]);
        }
        if (best < 18) {
            const s = strength(row.body, term);
            // A short substring in a description is almost always a coincidence.
            if (s >= 2 || (s === 1 && term.length >= 3)) best = Math.max(best, BODY_WEIGHT[s]);
        }
        if (!best && term.length >= 5 && /^[a-z]+$/.test(term)
            && row.words.some(w => withinOneEdit(term, w))) {
            best = 22;
            fuzzy = true;
            inTitle = true;
        }
        if (!best) return null;
        if (!inTitle) allInTitle = false;
        score += best;
    }
    if (row.titles.includes(whole)) score += 150;
    else if (row.titles.some(t => t.startsWith(whole))) score += 50;
    if (allInTitle && qTerms.length > 1) score += 25;
    score -= Math.min(15, Math.floor(row.title.length / 12));
    if (row.doc.lock) score -= 12;
    return { doc: row.doc, score: Math.max(1, score), fuzzy };
}

/**
 * The total order a section is drawn in: score, then the source's own order,
 * then the title, then the id. The last two are never meaningful and are there
 * so two rows can never compare equal -- the list is re-derived on every
 * keystroke, and an unstable sort is a row that moves under the pointer.
 */
function compare(a: Hit & { key: string }, b: Hit & { key: string }): number {
    if (a.score !== b.score) return b.score - a.score;
    if (a.doc.rank !== b.doc.rank) return a.doc.rank - b.doc.rank;
    if (a.key !== b.key) return a.key < b.key ? -1 : 1;
    if (a.doc.id !== b.doc.id) return a.doc.id < b.doc.id ? -1 : 1;
    return 0;
}

export interface SearchOptions {
    /** Rows per section when it is not expanded. */
    limit?: number;
    /** Sections the reader asked to see more of. */
    expanded?: readonly SectionId[];
    /** Rows per expanded section. */
    expandedLimit?: number;
}

export const DEFAULT_LIMIT = 5;
export const EXPANDED_LIMIT = 50;

/** Every section, in `SECTIONS` order, with its best hits and how many more there are. */
export function search(index: SearchIndex, query: string, options: SearchOptions = {}): SectionResult[] {
    const qTerms = terms(query);
    if (!qTerms.length) return [];
    const whole = qTerms.join(' ');
    const limit = Math.max(1, options.limit ?? DEFAULT_LIMIT);
    const expandedLimit = Math.max(limit, options.expandedLimit ?? EXPANDED_LIMIT);
    const expanded = new Set(options.expanded ?? []);
    const out: SectionResult[] = [];
    for (const section of SECTIONS) {
        const rows = index.bySection.get(section) ?? [];
        const hits: (Hit & { key: string })[] = [];
        for (const row of rows) {
            const hit = scoreOne(row, qTerms, whole);
            if (hit) hits.push({ ...hit, key: row.sortKey });
        }
        hits.sort(compare);
        const cap = expanded.has(section) ? expandedLimit : limit;
        const shown = hits.slice(0, cap).map(({ key: _key, ...hit }) => hit);
        out.push({ section, hits: shown, total: hits.length, more: Math.max(0, hits.length - shown.length) });
    }
    return out;
}

/* ------------------------------------------------------------------ *
 * Highlighting
 * ------------------------------------------------------------------ */

export interface Segment { text: string; match: boolean }

/**
 * `text` split into matched and unmatched runs, for rendering as `<mark>`
 * elements. Matching happens on the folded text and is mapped back, so an
 * unaccented query highlights the accented letters it found.
 */
export function highlight(text: string, query: string): Segment[] {
    const source = String(text || '');
    const qTerms = terms(query);
    if (!source || !qTerms.length) return source ? [{ text: source, match: false }] : [];
    const { folded, start, end } = foldWithMap(source);
    const ranges: [number, number][] = [];
    for (const term of qTerms) {
        const single = term.length === 1 && !isCjk(term);
        let at = folded.indexOf(term);
        while (at >= 0) {
            if (!single || at === 0 || folded[at - 1] === ' ') ranges.push([at, at + term.length]);
            at = folded.indexOf(term, at + term.length);
        }
    }
    if (!ranges.length) return [{ text: source, match: false }];
    ranges.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
    const merged: [number, number][] = [];
    for (const [a, b] of ranges) {
        const from = start[a];
        const to = end[b - 1];
        const last = merged[merged.length - 1];
        if (last && from <= last[1]) last[1] = Math.max(last[1], to);
        else merged.push([from, to]);
    }
    const segments: Segment[] = [];
    let cursor = 0;
    for (const [a, b] of merged) {
        if (a > cursor) segments.push({ text: source.slice(cursor, a), match: false });
        segments.push({ text: source.slice(a, b), match: true });
        cursor = b;
    }
    if (cursor < source.length) segments.push({ text: source.slice(cursor), match: false });
    return segments;
}

/* ------------------------------------------------------------------ *
 * Recent searches
 * ------------------------------------------------------------------ */

export const RECENT_MAX = 8;

/** `query` at the front of `list`, duplicates (by folded form) removed, capped. */
export function addRecent(list: readonly string[], query: string, max = RECENT_MAX): string[] {
    const q = String(query || '').replace(/\s+/g, ' ').trim().slice(0, 120);
    const key = fold(q);
    if (!key) return list.slice(0, max);
    return [q, ...list.filter(item => fold(item) !== key)].slice(0, max);
}

/** Whatever came out of storage, made safe to render. */
export function cleanRecent(value: unknown, max = RECENT_MAX): string[] {
    if (!Array.isArray(value)) return [];
    const out: string[] = [];
    const seen = new Set<string>();
    for (const item of value) {
        if (typeof item !== 'string') continue;
        const q = item.replace(/\s+/g, ' ').trim().slice(0, 120);
        const key = fold(q);
        if (!key || seen.has(key)) continue;
        seen.add(key);
        out.push(q);
        if (out.length >= max) break;
    }
    return out;
}

/* ------------------------------------------------------------------ *
 * Records: reading a translated field without importing the runtime
 * ------------------------------------------------------------------ */

interface WithTranslations { translations?: TranslationMap | null }

/** The field in `locale`, falling back to the record's own English. Never another language. */
export function textIn(record: WithTranslations & Record<string, unknown>, name: string, locale: LocaleId): string {
    if (locale !== 'en') {
        const entry = (record.translations as Record<string, Record<string, unknown>> | undefined)?.[locale];
        const value = entry?.[name];
        if (typeof value === 'string' && value.trim()) return value;
    }
    const own = record[name];
    return typeof own === 'string' ? own : '';
}

/** The field in every language the record carries, English first. */
export function textAll(record: WithTranslations & Record<string, unknown>, name: string): string[] {
    const out: string[] = [];
    const own = record[name];
    if (typeof own === 'string' && own.trim()) out.push(own);
    const map = record.translations as Record<string, Record<string, unknown>> | undefined;
    if (map && typeof map === 'object') {
        for (const entry of Object.values(map)) {
            const value = entry && typeof entry === 'object' ? entry[name] : undefined;
            if (typeof value === 'string' && value.trim() && !out.includes(value)) out.push(value);
        }
    }
    return out;
}

/** One line of a description, cut at a word near `max`. */
export function snippet(text: string, max = 110): string {
    const flat = String(text || '').replace(/[#>*_`]+/g, ' ').replace(/\s+/g, ' ').trim();
    if (flat.length <= max) return flat;
    const cut = flat.slice(0, max);
    const space = cut.lastIndexOf(' ');
    return `${(space > max * 0.6 ? cut.slice(0, space) : cut).trim()}…`;
}

/** Ids from different services spell the same uuid with or without dashes. */
export const canon = (id: unknown) => String(id ?? '').trim().toLowerCase().replace(/-/g, '');

/* ------------------------------------------------------------------ *
 * Locks
 * ------------------------------------------------------------------ */

/** What locks a destination that needs `need`, for this reader. Null when it is open. */
export function lockFor(need: AccessKey, access: Access, target: Target): Lock | null {
    if (canSee({ requires: need }, access)) return null;
    if (!access.auth) {
        const redirect = target.query && Object.keys(target.query).length
            ? `${target.path}?${new URLSearchParams(target.query).toString()}`
            : target.path;
        return { kind: 'signin', to: { path: '/login', query: { redirect } } };
    }
    return { kind: 'plan', feature: need, to: { path: '/plans' } };
}

/** Where a click on a result goes: the destination, or the place that unlocks it. */
export const destination = (doc: SearchDoc): Target => doc.lock?.to ?? doc.to;

/* ------------------------------------------------------------------ *
 * The document builders
 * ------------------------------------------------------------------ */

/** Translate one of the registry's English strings. Passed in, as `appNav` does it. */
export type Translate = (text: string) => string;

const FULL_ACCESS: Access = {
    auth: true, ai: true, lab: true, runbook: true, research: true,
    toastmasters: true, exam: true, proctor: true,
};

/**
 * Every page the sidebar knows about, once each.
 *
 * Built from the sidebar's own registry rather than a second list, so a page
 * added to the sidebar is searchable the same day. A page this reader may not
 * open is kept with a lock -- except a proctor's pages, which no plan unlocks
 * and which the sidebar never shows to anybody else either.
 */
export function pageDocs(access: Access, t: Translate): SearchDoc[] {
    const seen = new Map<string, NavEntry>();
    const add = (entry: NavEntry) => { if (!seen.has(entry.to)) seen.set(entry.to, entry); };
    add(HOME_ENTRY);
    for (const group of globalGroups(FULL_ACCESS)) group.items.forEach(add);
    for (const section of APP_SECTIONS) {
        section.items.forEach(add);
        (section.related ?? []).forEach(add);
    }
    const docs: SearchDoc[] = [];
    let rank = 0;
    for (const entry of seen.values()) {
        const need: AccessKey = entry.requires ?? 'auth';
        if (need === 'proctor' && !access.proctor) continue;
        const owner = APP_SECTIONS.find(s => s.items.some(i => i.to === entry.to))
            ?? [...APP_SECTIONS]
                .map(s => ({ s, len: Math.max(-1, ...s.match.filter(m => isUnder(entry.to, m)).map(m => m.length)) }))
                .filter(x => x.len >= 0)
                .sort((a, b) => b.len - a.len)[0]?.s;
        const title = t(entry.text);
        const ownerTitle = owner ? t(owner.title) : '';
        const to: Target = { path: entry.to };
        docs.push({
            section: 'pages',
            id: entry.to,
            title,
            alt: title === entry.text ? [] : [entry.text],
            subtitle: owner && ownerTitle !== title ? ownerTitle : '',
            ctx: owner ? [owner.title, ownerTitle] : [],
            body: [entry.keywords ?? '', entry.to.replace(/[/-]/g, ' ')],
            to,
            icon: entry.icon as IconName,
            kind: '',
            lock: lockFor(need, access, to),
            rank: rank++,
        });
    }
    return docs;
}

export interface CourseRow extends WithTranslations {
    id: string;
    title: string;
    description?: string;
    [key: string]: unknown;
}

export function courseDocs(rows: readonly CourseRow[], locale: LocaleId): SearchDoc[] {
    return rows.filter(r => r.id && r.title).map((row, rank) => ({
        section: 'courses' as const,
        id: row.id,
        title: textIn(row, 'title', locale),
        alt: textAll(row, 'title'),
        subtitle: snippet(textIn(row, 'description', locale)),
        ctx: [],
        body: textAll(row, 'description'),
        to: { path: `/course/${encodeURIComponent(row.id)}` },
        icon: 'course',
        kind: '',
        lock: null,
        rank,
    }));
}

export interface LessonRow extends WithTranslations {
    id: string;
    title: string;
    course: string;
    [key: string]: unknown;
}

const byCanon = <T extends { id: string }>(rows: readonly T[]) =>
    new Map(rows.map(r => [canon(r.id), r] as const));

export function lessonDocs(rows: readonly LessonRow[], courses: readonly CourseRow[], locale: LocaleId): SearchDoc[] {
    const courseMap = byCanon(courses);
    return rows.filter(r => r.id && r.title && r.course).map((row, rank) => {
        const course = courseMap.get(canon(row.course));
        return {
            section: 'lessons' as const,
            id: row.id,
            title: textIn(row, 'title', locale),
            alt: textAll(row, 'title'),
            subtitle: course ? textIn(course, 'title', locale) : '',
            ctx: course ? textAll(course, 'title') : [],
            body: [],
            to: { path: `/course/${encodeURIComponent(row.course)}/lesson/${encodeURIComponent(row.id)}` },
            icon: 'lesson',
            kind: '',
            lock: null,
            rank,
        };
    });
}

export interface LabRow extends WithTranslations {
    id: string;
    title: string;
    track: string;
    summary?: string;
    difficulty?: string;
    topics?: string[];
    [key: string]: unknown;
}

export interface TrackRow extends WithTranslations {
    id: string;
    title: string;
    [key: string]: unknown;
}

export interface PlaygroundRow extends WithTranslations {
    id: string;
    title: string;
    summary?: string;
    tools?: string[];
    [key: string]: unknown;
}

/**
 * Labs and playgrounds, one section: both are "somewhere to practise", and a
 * student looking for "kubernetes" wants the labs AND the free workspace.
 * Playgrounds sort after labs on a tie and carry a badge saying which they are.
 */
export function labDocs(
    labs: readonly LabRow[], tracks: readonly TrackRow[], playgrounds: readonly PlaygroundRow[],
    locale: LocaleId, access: Access, t: Translate,
): SearchDoc[] {
    const trackMap = new Map(tracks.map(tr => [tr.id, tr] as const));
    const docs: SearchDoc[] = [];
    labs.filter(r => r.id && r.title).forEach((row, rank) => {
        const track = trackMap.get(row.track);
        const trackTitle = track ? textIn(track, 'title', locale) : '';
        const level = row.difficulty ? t(row.difficulty.charAt(0).toUpperCase() + row.difficulty.slice(1)) : '';
        const to: Target = { path: `/lab/${encodeURIComponent(row.id)}` };
        docs.push({
            section: 'labs',
            id: row.id,
            title: textIn(row, 'title', locale),
            alt: textAll(row, 'title'),
            subtitle: [trackTitle, level].filter(Boolean).join(' · '),
            ctx: track ? [...textAll(track, 'title'), row.track] : [row.track],
            body: [...textAll(row, 'summary'), ...(row.topics ?? [])],
            to,
            icon: 'lab',
            kind: '',
            lock: lockFor('lab', access, to),
            rank,
        });
    });
    playgrounds.filter(r => r.id && r.title).forEach((row, i) => {
        const to: Target = { path: `/playground/${encodeURIComponent(row.id)}` };
        docs.push({
            section: 'labs',
            id: row.id,
            title: textIn(row, 'title', locale),
            alt: textAll(row, 'title'),
            subtitle: snippet(textIn(row, 'summary', locale), 90),
            ctx: ['playground'],
            body: [...textAll(row, 'summary'), ...(row.tools ?? [])],
            to,
            icon: 'playground',
            kind: 'playground',
            lock: lockFor('lab', access, to),
            rank: 100000 + i,
        });
    });
    return docs;
}

export interface AssessmentRow extends WithTranslations {
    id: string;
    title: string;
    course: string;
    lesson: string;
    [key: string]: unknown;
}

/**
 * Quizzes open on their own page, which needs an account; a lesson's quiz is
 * named after the lesson it belongs to.
 */
export function quizDocs(
    rows: readonly AssessmentRow[], lessons: readonly LessonRow[], courses: readonly CourseRow[],
    locale: LocaleId, access: Access,
): SearchDoc[] {
    const lessonMap = byCanon(lessons);
    const courseMap = byCanon(courses);
    return rows.filter(r => r.id && r.title).map((row, rank) => {
        const lesson = lessonMap.get(canon(row.lesson));
        const course = courseMap.get(canon(row.course));
        const query: Record<string, string> = { quizId: row.id };
        if (row.lesson) query.lessonId = row.lesson;
        if (row.course) query.courseId = row.course;
        const to: Target = { path: '/take-quiz', query };
        return {
            section: 'quizzes' as const,
            id: row.id,
            title: textIn(row, 'title', locale),
            alt: textAll(row, 'title'),
            subtitle: lesson ? textIn(lesson, 'title', locale) : course ? textIn(course, 'title', locale) : '',
            ctx: [...(lesson ? textAll(lesson, 'title') : []), ...(course ? textAll(course, 'title') : [])],
            body: [],
            to,
            icon: 'quiz',
            kind: '',
            lock: lockFor('auth', access, to),
            rank,
        };
    });
}

/**
 * An exam has no page of its own: it is booked, practised and sat from the
 * Exams page, which is open to everybody. So the link is that page filtered to
 * this exam -- by its ENGLISH title, which is what the page's own filter reads.
 */
export function examDocs(rows: readonly AssessmentRow[], courses: readonly CourseRow[], locale: LocaleId): SearchDoc[] {
    const courseMap = byCanon(courses);
    return rows.filter(r => r.id && r.title).map((row, rank) => {
        const course = courseMap.get(canon(row.course));
        return {
            section: 'exams' as const,
            id: row.id,
            title: textIn(row, 'title', locale),
            alt: textAll(row, 'title'),
            subtitle: course ? textIn(course, 'title', locale) : '',
            ctx: course ? textAll(course, 'title') : [],
            body: [],
            to: { path: '/exams', query: { q: row.title } },
            icon: 'exam',
            kind: '',
            lock: null,
            rank,
        };
    });
}

export interface RunbookRow extends WithTranslations {
    id: string;
    title: string;
    course?: string;
    lesson?: string;
    [key: string]: unknown;
}

export function runbookDocs(
    rows: readonly RunbookRow[], lessons: readonly LessonRow[], courses: readonly CourseRow[],
    locale: LocaleId, access: Access,
): SearchDoc[] {
    const lessonMap = byCanon(lessons);
    const courseMap = byCanon(courses);
    return rows.filter(r => r.id && r.title).map((row, rank) => {
        const lesson = row.lesson ? lessonMap.get(canon(row.lesson)) : undefined;
        const course = row.course ? courseMap.get(canon(row.course)) : undefined;
        const to: Target = { path: `/runbooks/${encodeURIComponent(row.id)}` };
        return {
            section: 'runbooks' as const,
            id: row.id,
            title: textIn(row, 'title', locale),
            alt: textAll(row, 'title'),
            subtitle: course ? textIn(course, 'title', locale) : lesson ? textIn(lesson, 'title', locale) : '',
            ctx: [...(course ? textAll(course, 'title') : []), ...(lesson ? textAll(lesson, 'title') : [])],
            body: [],
            to,
            icon: 'runbook',
            kind: '',
            lock: lockFor('runbook', access, to),
            rank,
        };
    });
}

/* ------------------------------------------------------------------ *
 * The keyboard
 * ------------------------------------------------------------------ */

/** One focusable row in the panel, in render order. */
export interface OptionRef {
    section: string;
}

/**
 * The option Tab (or Shift+Tab) lands on: the first option of the next (or
 * previous) section. Null at either end, so the key falls through and focus
 * leaves the field the way Tab always does.
 */
export function sectionJump(options: readonly OptionRef[], active: number, backwards: boolean): number | null {
    if (!options.length) return null;
    const firsts: number[] = [];
    options.forEach((o, i) => { if (i === 0 || options[i - 1].section !== o.section) firsts.push(i); });
    const current = active < 0 ? -1 : options[active].section;
    const at = active < 0 ? -1 : firsts.findIndex(i => options[i].section === current);
    const next = backwards ? at - 1 : at + 1;
    if (active < 0) return backwards ? null : firsts[0];
    if (next < 0 || next >= firsts.length) return null;
    return firsts[next];
}

/** Up/Down with wrap-around; -1 means nothing active yet. */
export function stepActive(count: number, active: number, delta: 1 | -1): number {
    if (!count) return -1;
    if (active < 0) return delta > 0 ? 0 : count - 1;
    return (active + delta + count) % count;
}
