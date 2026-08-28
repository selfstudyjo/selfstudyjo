/**
 * src/utils/aichatRooms.ts — the AI Chat room list, as a plain module.
 *
 * No Vue, no DOM, no network. Same precedent as `photoMask.ts`,
 * `drawEngine.ts`, `chatMedia.ts`, `appNav.ts`, `examShuffle.ts`,
 * `proctorQueue.ts`, `newscastEngine.ts` and `lessonContent.ts`, and for the
 * same reason: everything here is decided in a computed that re-evaluates on
 * every poll and on every keystroke in the filter box, and every mistake in it
 * is one nobody can see in a single screenshot.
 *
 * `npm run check:aichat` drives the lot in node in about a second.
 *
 * WHAT IS ACTUALLY EASY TO GET WRONG HERE
 * =======================================
 *
 *   * A NON-TOTAL ORDER. Two rooms that compare equal swap places under the
 *     reader every time the list is recomputed — which is every poll and every
 *     keystroke. The same trap `sortScene` documents for an equal `z` and
 *     `examShuffle` for option order.
 *
 *   * A SEARCH THAT ONLY MATCHES THE RENDERED LANGUAGE. A reader looking at an
 *     Arabic list types Arabic; the same person coming back after switching the
 *     interface types English. A filter narrower than "everything the record
 *     carries" silently stops finding things when a setting changes.
 *
 *   * A BLANK ROW. A chat list is thirty rows whose only distinguishing mark is
 *     the title. `Untitled` six times is not data — it is a rendering fault as
 *     far as the reader is concerned, which is exactly what the leaderboard's
 *     Most-studied chart shipped as before it was corrected.
 *
 *   * DATE BUCKETS THAT DISAGREE WITH THE CLOCK. `now` is a parameter, never
 *     `Date.now()`, so "yesterday" is testable rather than a property of the
 *     hour the check happens to run in.
 */

/** One row of the room list. The transcript is never part of it. */
export interface ChatRoomSummary {
    id: string;
    title: string;
    topic: string;
    message_count: number;
    last_message_at: string;
    last_message_preview: string;
    language: string;
    pinned: boolean;
    archived: boolean;
    /**
     * Whether the assistant has a project brief for this room.
     *
     * A boolean rather than the brief itself, deliberately: the list needs to
     * show a mark meaning "this one can be picked up where it was left" and the
     * brief is a page of prose. Shipping it per row would put every user's whole
     * memory into the list payload for a badge.
     */
    has_brief: boolean;
    created_at: string;
    updated_at: string;
}

export interface ChatMessage {
    id: string;
    role: 'user' | 'assistant';
    content: string;
    created_at: string;
    /**
     * Set only in the browser, on a message whose send failed. Never sent to
     * the backend and never stored — it is how the bubble grows a Retry button.
     */
    failed?: boolean;
}

/** What the assistant is carrying into the next turn. */
export interface ChatContext {
    brief: string;
    summary: string;
    topic: string;
    message_count: number;
    verbatim_messages: number;
    summarised_messages: number;
    stale: boolean;
}

/**
 * Mint a message id in the BROWSER.
 *
 * The backend adopts it as the record's id, which is what makes a retry
 * idempotent: a message whose response was lost is re-sent under the same id
 * and updates the same record instead of saying the same sentence twice. App 35
 * arrived at this the same way; a client that lets the server mint the id has
 * the duplicate-on-flaky-connection bug and cannot fix it from this end.
 *
 * `crypto.randomUUID` is not assumed — it needs a secure context, and this runs
 * in node inside the check as well as in a browser.
 */
export function newMessageId(): string {
    const c = (globalThis as { crypto?: Crypto }).crypto;
    if (c && typeof c.randomUUID === 'function') return c.randomUUID();
    let out = '';
    for (let i = 0; i < 32; i++) {
        out += Math.floor(Math.random() * 16).toString(16);
        if (i === 7 || i === 11 || i === 15 || i === 19) out += '-';
    }
    return out;
}

/**
 * What to render as a room's name.
 *
 * Never empty and never a placeholder word. The backend already refuses to
 * store a blank title, so this is the second line of defence for a record
 * written before that was true, or by a client that has not been updated.
 */
export function titleOf(room: Pick<ChatRoomSummary, 'title' | 'last_message_preview'>,
                        fallback = 'New chat'): string {
    const title = (room?.title || '').trim();
    if (title) return title;
    const preview = (room?.last_message_preview || '').trim();
    return preview ? preview.slice(0, 60) : fallback;
}

/** ISO timestamps sort lexically; this is just the descending direction. */
function desc(a: string, b: string): number {
    return (b || '').localeCompare(a || '');
}

/**
 * Pinned first, then most recently spoken in.
 *
 * A TOTAL order, and that is the point rather than tidiness — see the header.
 * It has to agree with `sort_rooms` in `aichat.py`, because the list is
 * re-sorted here after every optimistic local update and re-fetched from there
 * on the next load: two different orders is a list that visibly reshuffles when
 * a poll lands.
 */
export function sortRooms(rooms: ChatRoomSummary[]): ChatRoomSummary[] {
    return [...(rooms || [])].sort((a, b) => {
        if (!!a.pinned !== !!b.pinned) return a.pinned ? -1 : 1;
        const byActivity = desc(a.last_message_at || a.updated_at,
                                b.last_message_at || b.updated_at);
        if (byActivity) return byActivity;
        const byCreated = desc(a.created_at, b.created_at);
        if (byCreated) return byCreated;
        // Never a meaningful tie-break and not meant to be. It is here so the
        // comparator is a total order and the list cannot reshuffle.
        return (a.id || '').localeCompare(b.id || '');
    });
}

/**
 * Does this room match what the reader typed?
 *
 * Every field the record carries is searched, not the rendered one — the title,
 * the topic and the last reply. A room whose title is Arabic and whose subject
 * line happens to be English must be findable by either.
 *
 * Case-insensitive through `toLocaleLowerCase`, which unlike `toLowerCase`
 * handles the Turkish dotless i and does the right thing for the three
 * languages this platform ships.
 */
export function matchesQuery(room: ChatRoomSummary, query: string): boolean {
    const q = (query || '').trim().toLocaleLowerCase();
    if (!q) return true;
    return [room?.title, room?.topic, room?.last_message_preview]
        .some((field) => (field || '').toLocaleLowerCase().includes(q));
}

export type Bucket = 'pinned' | 'today' | 'yesterday' | 'week' | 'month' | 'older';

/**
 * The heading over each bucket, in reading order.
 *
 * Here rather than in the view for two reasons and both are about checks.
 * `check:aichat` needs to prove every bucket the model can emit HAS a heading,
 * or one renders as `undefined`; and `check:i18n` needs to know these are
 * translation keys at all -- they are reached as `$t(BUCKET_LABELS[bucket])`,
 * a dynamic key, so no source file contains the literal `$t('Yesterday')` and
 * a scan for literals reads every one of them as an orphaned catalogue entry.
 * That is the same shape as the sidebar's labels, which `check:i18n` already
 * verifies against `appNav.ts` instead of against the source scan; this is the
 * `appNav.ts` of the chat list.
 *
 * The ORDER is the render order, so `groupRooms` and the headings cannot
 * disagree about which comes first.
 */
export const BUCKET_LABELS: Record<Bucket, string> = {
    pinned: 'Pinned',
    today: 'Today',
    yesterday: 'Yesterday',
    week: 'Previous 7 days',
    month: 'Previous 30 days',
    older: 'Older',
};

/** Every key `describeContext` can return. Derived, so it cannot go stale. */
export const CONTEXT_KEYS: string[] = [
    describeContext(null).key,
    describeContext({ brief: '', summary: '', topic: '', message_count: 2,
                      verbatim_messages: 2, summarised_messages: 0, stale: false }).key,
    describeContext({ brief: '', summary: '', topic: '', message_count: 40,
                      verbatim_messages: 12, summarised_messages: 28, stale: false }).key,
];

export interface RoomGroup {
    bucket: Bucket;
    rooms: ChatRoomSummary[];
}

const DAY = 86400000;

/**
 * Buckets, in the order they are rendered.
 *
 * `now` is a PARAMETER. Reading the clock in here would make "yesterday" a
 * property of the minute the check happens to run in, and the boundary cases
 * are the only interesting ones. Same reason `leaderboardEngine.ts` takes it.
 *
 * Buckets are compared on the LOCAL calendar day rather than on elapsed hours,
 * because that is what a reader means: a message at 23:50 and one at 00:10 are
 * different days to a person and 20 minutes apart to a subtraction.
 */
export function groupRooms(rooms: ChatRoomSummary[], now: number): RoomGroup[] {
    const sorted = sortRooms(rooms);
    const groups = new Map<Bucket, ChatRoomSummary[]>();
    const push = (bucket: Bucket, room: ChatRoomSummary) => {
        const list = groups.get(bucket);
        if (list) list.push(room);
        else groups.set(bucket, [room]);
    };

    const startOfToday = new Date(now);
    startOfToday.setHours(0, 0, 0, 0);
    const todayMs = startOfToday.getTime();

    for (const room of sorted) {
        if (room.pinned) { push('pinned', room); continue; }
        const stamp = Date.parse(room.last_message_at || room.updated_at
                                 || room.created_at || '');
        if (!Number.isFinite(stamp)) { push('older', room); continue; }
        if (stamp >= todayMs) push('today', room);
        else if (stamp >= todayMs - DAY) push('yesterday', room);
        else if (stamp >= todayMs - 7 * DAY) push('week', room);
        else if (stamp >= todayMs - 30 * DAY) push('month', room);
        else push('older', room);
    }

    return (Object.keys(BUCKET_LABELS) as Bucket[])
        .filter((bucket) => (groups.get(bucket) || []).length > 0)
        .map((bucket) => ({ bucket, rooms: groups.get(bucket) as ChatRoomSummary[] }));
}

/**
 * Is this room one the assistant can pick up where it was left?
 *
 * What the "memory" mark on a row means. It is deliberately NOT "has any
 * messages": a room with two turns and no brief yet is one the assistant will
 * answer perfectly well from the verbatim window alone, and marking it would
 * make the mark meaningless.
 */
export function isResumable(room: ChatRoomSummary): boolean {
    return !!room?.has_brief && (room?.message_count || 0) >= 2;
}

/**
 * How the context panel describes what the assistant is carrying.
 *
 * Returns a key and its parameters rather than a sentence, because the caller
 * has to put it through `$t` — building the sentence here would put three
 * untranslatable strings in a plain module, which is the one thing
 * `check:i18n` cannot see (it reads templates).
 */
export function describeContext(ctx: ChatContext | null):
    { key: string; params: Record<string, string | number> } {
    if (!ctx || !ctx.message_count) {
        return { key: 'Nothing yet — the assistant learns what you are working on as you go.', params: {} };
    }
    if (!ctx.summarised_messages) {
        return {
            key: 'The assistant can see all {v0} messages in this chat.',
            params: { v0: ctx.verbatim_messages },
        };
    }
    return {
        key: 'The assistant reads the last {v0} messages in full, and remembers the {v1} before them as notes.',
        params: { v0: ctx.verbatim_messages, v1: ctx.summarised_messages },
    };
}

/**
 * Merge a room the server just answered with into the list held in the browser.
 *
 * Replaces by id rather than appending, so the reply to a send does not put a
 * second copy of the room in the sidebar — and re-sorts, because the room has
 * just become the most recently spoken in and has to move to the top.
 */
export function upsertRoom(rooms: ChatRoomSummary[],
                           room: ChatRoomSummary): ChatRoomSummary[] {
    if (!room?.id) return rooms;
    return sortRooms([...(rooms || []).filter((r) => r.id !== room.id), room]);
}
