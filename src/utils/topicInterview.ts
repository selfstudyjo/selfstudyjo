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
