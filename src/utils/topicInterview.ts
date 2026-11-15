/**
 * "Interview on this topic" -- everything the window DECIDES, as a plain module.
 *
 * No Vue, no DOM, no service imports, on the `photoMask.ts` / `labCatalogue.ts`
 * precedent, so `npm run check:topicinterview` can drive it in node.
 *
 * The window is opened from a lesson, a lab, a quiz or a practice exam and runs
 * a SHORT interview about that material only (app 27 enforces the scope in every
 * prompt; see `_ji_scope` in selfstudyai/app.py). This file builds the scope the
 * page hands over, sizes the interview, and supplies the fallbacks used when app
 * 27 cannot be reached -- built from the scope too, because a generic question is
 * exactly the off-topic question this mode exists to prevent.
 */

export type TopicKind = 'lesson' | 'lab' | 'quiz' | 'exam';

export interface TopicScopeInput {
    kind: TopicKind;
    title: string;
    course?: string;
    refId?: string;
    url?: string;
    /** Questions in the quiz/exam, or tasks in the lab. */
    size?: number;
    /** The text the student was shown. Joined, cleaned and clipped here. */
    parts?: Array<string | null | undefined>;
}

export interface TopicScope {
    kind: TopicKind;
    title: string;
    course?: string;
    ref_id?: string;
    url?: string;
    size?: number;
    material: string;
}

/** A topic interview is a short check, never a second exam. Same cap as app 27. */
export const MAX_TOPIC_QUESTIONS = 5;
export const MIN_TOPIC_QUESTIONS = 2;
/** What app 27 reads of the material; anything longer is clipped there anyway. */
export const MATERIAL_CHARS = 6000;

/** Collapse whitespace and drop empties, keeping line structure for headings. */
export function joinMaterial(parts: Array<string | null | undefined>, max = MATERIAL_CHARS): string {
    const text = parts
        .map(p => String(p ?? '').replace(/\r\n?/g, '\n').replace(/[ \t]+/g, ' ').replace(/\n{3,}/g, '\n\n').trim())
        .filter(Boolean)
        .join('\n\n');
    if (text.length <= max) return text;
    // Cut on a line boundary when one is near, so the last line is whole.
    const cut = text.lastIndexOf('\n', max);
    return text.slice(0, cut > max * 0.8 ? cut : max).trim();
}

export function buildScope(input: TopicScopeInput): TopicScope {
    const size = Math.max(0, Math.min(500, Math.floor(Number(input.size) || 0)));
    const scope: TopicScope = {
        kind: input.kind,
        title: String(input.title || '').trim().slice(0, 200),
        material: joinMaterial(input.parts || []),
    };
    if (input.course) scope.course = String(input.course).trim().slice(0, 200);
    if (input.refId) scope.ref_id = String(input.refId).trim().slice(0, 120);
    if (input.url) scope.url = String(input.url).trim().slice(0, 300);
    if (size) scope.size = size;
    return scope;
}

/**
 * How many questions, without a model. Mirrors `_ji_scope_count` in app 27,
 * which is what the planner falls back to; used here only when the plan call
 * did not answer at all.
 */
export function scopeQuestionCount(scope: Pick<TopicScope, 'size' | 'material'>): number {
    const size = scope.size || 0;
    let n: number;
    if (size) n = size <= 5 ? 2 : size <= 10 ? 3 : size <= 20 ? 4 : 5;
    else {
        const words = (scope.material || '').split(/\s+/).filter(Boolean).length;
        n = words < 150 ? 2 : words < 450 ? 3 : words < 1000 ? 4 : 5;
    }
    return Math.max(MIN_TOPIC_QUESTIONS, Math.min(MAX_TOPIC_QUESTIONS, n));
}

/** The plan as the window will run it: deduplicated, trimmed, never over the cap. */
export function clampPlan(areas: string[], scope: TopicScope, lang: string): string[] {
    const seen = new Set<string>();
    const out: string[] = [];
    for (const raw of areas || []) {
        const area = String(raw || '').trim();
        const key = area.toLowerCase();
        if (!area || seen.has(key)) continue;
        seen.add(key);
        out.push(area);
        if (out.length >= MAX_TOPIC_QUESTIONS) break;
    }
    if (out.length >= MIN_TOPIC_QUESTIONS) return out;
    const target = scopeQuestionCount(scope);
    for (const area of fallbackAreas(scope, lang, target)) {
        if (out.length >= target) break;
        if (!seen.has(area.toLowerCase())) out.push(area);
    }
    return out.slice(0, MAX_TOPIC_QUESTIONS);
}

const GENERIC_AREAS: Record<string, string[]> = {
    en: ['the core idea', 'how it works step by step', 'applying it in practice',
         'a common mistake and its fix', 'verifying the result'],
    ar: ['الفكرة الأساسية', 'كيف يعمل خطوة بخطوة', 'التطبيق العملي',
         'خطأ شائع وكيفية إصلاحه', 'التحقق من النتيجة'],
    zh: ['核心概念', '逐步的工作原理', '实际应用', '常见错误及其解决方法', '验证结果'],
};

/** The material's own headings first, then generic areas in the interview's language. */
export function fallbackAreas(scope: TopicScope, lang: string, count: number): string[] {
    const out: string[] = [];
    for (const line of (scope.material || '').split('\n')) {
        const m = line.trim().match(/^#{1,4}\s+(.+)$/);
        if (!m) continue;
        const label = m[1].trim();
        if (label.length > 3 && label.length < 90 && !out.includes(label)) out.push(label);
        if (out.length >= count) return out;
    }
    for (const area of GENERIC_AREAS[lang] || GENERIC_AREAS.en) {
        if (out.length >= count) break;
        out.push(area);
    }
    return out.slice(0, count);
}

const FALLBACK_Q: Record<string, string[]> = {
    en: ['In your own words, what is {area}, and why does it matter in {title}?',
         'Walk me through how you would apply {area} from {title} in practice.',
         'What is a common mistake with {area}, and how would you avoid it?',
         'How would you check that your work on {area} is correct?',
         'If a colleague asked you to explain {area} from {title}, what would you say?'],
    ar: ['بكلماتك الخاصة، ما هو {area}، ولماذا هو مهم في {title}؟',
         'اشرح لي كيف ستطبّق {area} من {title} عمليًا.',
         'ما هو الخطأ الشائع في {area}، وكيف تتجنبه؟',
         'كيف تتحقق من أن عملك في {area} صحيح؟',
         'لو طلب منك زميل أن تشرح {area} من {title}، ماذا ستقول؟'],
    zh: ['请用你自己的话解释什么是{area}，以及它在{title}中为什么重要？',
         '请说明你会如何在实践中应用{title}中的{area}。',
         '关于{area}，常见的错误是什么？你会如何避免？',
         '你会如何检查自己在{area}上的工作是正确的？',
         '如果同事请你解释{title}中的{area}，你会怎么说？'],
};

/** A question when app 27 did not answer: about this area of this material. */
export function fallbackQuestion(scope: TopicScope, area: string, index: number, lang: string): string {
    const pool = FALLBACK_Q[lang] || FALLBACK_Q.en;
    return pool[Math.abs(index) % pool.length]
        .replace('{area}', area || scope.title)
        .replace('{title}', scope.title);
}

/** The `topic` column in My Interviews: kind and title, readable in a list. */
export function sessionTopic(kindLabel: string, title: string): string {
    return `${kindLabel}: ${title}`.slice(0, 220);
}

/** The speech-synthesis tag for an interview language. */
export function speechTag(lang: string): string {
    return lang === 'ar' ? 'ar-SA' : lang === 'zh' ? 'zh-CN' : 'en-US';
}

/* ------------------------------------------------------------------ *
 * The live transcript: spoken corrections, word by word
 *
 * The Job Interview room's `answerEditing.ts` takes back a comma-delimited
 * PART per "sorry". Here a "sorry" takes back one WORD, and each further
 * "sorry" one more -- what was asked for, and the better unit for a short
 * topic answer. The parsing (which words are commands, where a run of them
 * starts and ends) is reused from that module unchanged; only the undo and the
 * multilingual command words are this file's.
 * ------------------------------------------------------------------ */

import {
    insertSpeech, parseSpokenChunk, MAX_VOICE_UNDO_SEGMENTS, type AnswerState,
} from './answerEditing';

/** "Sorry" as an Arabic or Chinese speaker says it, mapped to the English command. */
const ARABIC_SORRY = /(^|[^\p{L}])(آسف|آسفة|اسف|عذرا|عذرًا|عفوا|عفوًا)(?=$|[^\p{L}])/gu;
const CHINESE_SORRY = /(对不起|抱歉|不好意思)/g;

export function normaliseCommands(chunk: string): string {
    return String(chunk ?? '')
        .replace(ARABIC_SORRY, '$1 sorry ')
        .replace(CHINESE_SORRY, ' sorry ');
}

const HAN = /[㐀-䶿一-鿿]/;

/**
 * The text with its last `count` words removed.
 *
 * A Chinese "word" is one character: Chinese has no spaces, so taking the last
 * whitespace-delimited run would delete a whole clause per "sorry". Trailing
 * punctuation goes with the word it followed.
 */
export function removeLastWords(text: string, count: number): string {
    let out = String(text ?? '');
    const n = Math.min(Math.max(0, Math.round(Number(count) || 0)), MAX_VOICE_UNDO_SEGMENTS);
    for (let i = 0; i < n && out; i++) {
        out = out.replace(/[\s,.;:!?،؛؟。，、！？]+$/u, '');
        if (!out) break;
        const last = out[out.length - 1];
        out = HAN.test(last) ? out.slice(0, -1) : out.replace(/\S+$/u, '');
    }
    return out.replace(/[\s,;:،؛，、]+$/u, '');
}

function undoWords(state: AnswerState, count: number): AnswerState {
    if (state.caret === null) return { text: removeLastWords(state.text, count), caret: null, anchor: null };
    // Never back past where the student started dictating into a selection.
    const caret = Math.max(0, Math.min(state.caret, state.text.length));
    const floor = Math.max(0, Math.min(state.anchor ?? 0, caret));
    const head = state.text.slice(0, floor) + removeLastWords(state.text.slice(floor, caret), count);
    return { text: head + state.text.slice(caret), caret: head.length, anchor: Math.min(floor, head.length) };
}

/** One transcribed chunk, applied: words inserted, spoken "sorry"s taking words back. */
export function applyTopicChunk(state: AnswerState, chunk: string, voiceEditing = true): AnswerState {
    const parsed = parseSpokenChunk(voiceEditing ? normaliseCommands(chunk) : chunk, voiceEditing);
    let next = insertSpeech(state, parsed.before);
    if (parsed.commands > 0) next = undoWords(next, parsed.commands);
    return insertSpeech(next, parsed.after);
}

/**
 * The English technical terms of the material, for Whisper to be primed with.
 *
 * Whisper continues the script it was primed with, so "Terraform" in Latin in
 * the prompt is what keeps it Latin inside an Arabic sentence. Taken from code
 * spans and from words that look like names: capitalised, acronyms, or with a
 * digit or dot in them. Most frequent first.
 */
export function extractTerms(material: string, max = 25): string[] {
    const counts = new Map<string, number>();
    const add = (raw: string) => {
        const term = raw.trim().replace(/^[^A-Za-z0-9]+|[^A-Za-z0-9+#]+$/g, '');
        if (term.length < 2 || term.length > 30 || !/[A-Za-z]/.test(term)) return;
        counts.set(term, (counts.get(term) || 0) + 1);
    };
    const text = String(material || '');
    for (const m of text.matchAll(/`([^`\n]{2,30})`/g)) add(m[1]);
    for (const m of text.matchAll(/\b([A-Z][A-Za-z0-9+#.-]*[A-Za-z0-9+#]|[A-Za-z]+[0-9][A-Za-z0-9]*)\b/g)) add(m[1]);
    const stop = new Set(['The', 'This', 'That', 'These', 'Those', 'You', 'Your', 'When', 'What', 'How',
        'Why', 'Task', 'Objectives', 'Correct', 'And', 'For', 'With', 'Use', 'If', 'In', 'On', 'It', 'A', 'An']);
    return [...counts.entries()]
        .filter(([term]) => !stop.has(term))
        .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
        .slice(0, max)
        .map(([term]) => term);
}
