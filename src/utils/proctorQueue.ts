// src/utils/proctorQueue.ts
//
// How a proctor's appointments are ordered and grouped.
//
// A **plain module** — no Vue, no Pinia, no router, no service imports — for the
// same reason `appNav.ts`, `photoMask.ts`, `drawEngine.ts`, `chatMedia.ts`,
// `linkify.ts` and `newscastEngine.ts` are: `npm run check:proctorqueue` runs it
// through node in about a second. The view imports these functions rather than
// carrying its own copy, so the check and the screen cannot disagree — a check
// written against a second copy of the logic proves nothing about the first.
//
// The dashboard used to render every appointment a proctor had ever had in one
// date-descending list. "Descending by date" puts the far future at the top and
// *today* below it, so the only question a proctor actually has — "who am I
// invigilating in the next hour, and is anybody waiting to be let in?" — was
// somewhere in the middle of a page of last month's completed exams.
//
// So rows are grouped by **what the proctor has to do about them**, and the
// groups are ordered by urgency rather than by time. Two invariants matter more
// than the specific windows, and the check enforces both: every appointment
// appears in **exactly one** group, and none is lost.

/** The statuses that mean an appointment is still live rather than history. */
export const LIVE_STATUSES = [
    'Scheduled',
    'In Progress',
    'No Reservation Yet',
] as const;

/**
 * How long before its slot an appointment starts demanding attention, and how
 * long after it stops.
 *
 * Both ends are deliberate. A proctor can do nothing useful about next Tuesday,
 * so the forward window is short; and an appointment from last week that was
 * never approved is not something to act on, it is history — without the backward
 * bound, every un-approved appointment ever booked would pile up in the urgent
 * group and make it useless.
 */
export const ATTENTION_LEAD_MS = 60 * 60 * 1000;          // 1 hour before
export const ATTENTION_TRAIL_MS = 6 * 60 * 60 * 1000;     // 6 hours after

/** Only the fields the grouping reads. Keeps this module free of the service. */
export interface QueueRow {
    external_id: string;
    appointment_status: string;
    appointment_date: string;
    can_start?: boolean;
}

export interface QueueGroup<T extends QueueRow> {
    key: 'attention' | 'today' | 'upcoming' | 'past';
    title: string;
    hint: string;
    rows: T[];
}

const isLive = (row: QueueRow) =>
    (LIVE_STATUSES as readonly string[]).includes(row.appointment_status);

const timeOf = (row: QueueRow) => new Date(row.appointment_date).getTime();

/** Midnight this morning, in the reader's own timezone. */
function startOfDay(now: Date): number {
    const d = new Date(now);
    d.setHours(0, 0, 0, 0);
    return d.getTime();
}

export function isSameDay(a: Date, b: Date): boolean {
    return a.getFullYear() === b.getFullYear()
        && a.getMonth() === b.getMonth()
        && a.getDate() === b.getDate();
}

/** Ascending: within a group, the NEXT one is the one that matters. */
function ascending<T extends QueueRow>(rows: T[]): T[] {
    return [...rows].sort((a, b) => timeOf(a) - timeOf(b));
}

/** Descending: the archive leads with the most recent. */
function descending<T extends QueueRow>(rows: T[]): T[] {
    return [...rows].sort((a, b) => timeOf(b) - timeOf(a));
}

/**
 * Is somebody waiting on the proctor right now?
 *
 * The slot has arrived (or is about to) and the candidate has not been let in.
 * `can_start` is the whole test on that second clause — it is what the exam page
 * checks before letting anybody begin.
 */
export function needsAttention(row: QueueRow, now = new Date()): boolean {
    if (!isLive(row)) return false;
    if (row.can_start) return false;
    const at = timeOf(row);
    if (!Number.isFinite(at)) return false;
    const ms = now.getTime();
    return at >= ms - ATTENTION_TRAIL_MS && at <= ms + ATTENTION_LEAD_MS;
}

/**
 * Is this happening around now? Drives the "Live" marker on a card.
 *
 * Wider than `needsAttention` and asking a different question: this is about
 * whether an exam is in progress, not about whether the proctor owes an action —
 * so a candidate who HAS been let in still shows as live.
 */
export function isLiveNow(row: QueueRow, now = new Date()): boolean {
    if (row.appointment_status === 'In Progress') return true;
    if (row.appointment_status !== 'Scheduled') return false;
    const at = timeOf(row);
    if (!Number.isFinite(at)) return false;
    const ms = now.getTime();
    return at <= ms + 15 * 60 * 1000 && at >= ms - 3 * 60 * 60 * 1000;
}

/**
 * Split a proctor's appointments into the four groups, in urgency order.
 *
 * Each row lands in exactly one group: a row claimed by an earlier group is
 * excluded from every later one, which is why `past` is defined as "everything
 * not already shown" rather than by a rule of its own. Defining it by a rule is
 * how a row ends up in two groups (or in none) the first time a status is added.
 *
 * Empty groups are dropped, so the screen never renders a heading over nothing.
 */
export function groupForProctor<T extends QueueRow>(
    rows: T[], now = new Date(),
): QueueGroup<T>[] {
    const all = rows || [];

    const attention = ascending(all.filter(row => needsAttention(row, now)));
    const claimed = new Set(attention.map(row => row.external_id));

    const today = ascending(all.filter(row =>
        !claimed.has(row.external_id)
        && isSameDay(new Date(row.appointment_date), now)));
    today.forEach(row => claimed.add(row.external_id));

    const dayStart = startOfDay(now);
    const upcoming = ascending(all.filter(row =>
        !claimed.has(row.external_id)
        && isLive(row)
        && timeOf(row) > dayStart
        && !isSameDay(new Date(row.appointment_date), now)));
    upcoming.forEach(row => claimed.add(row.external_id));

    const past = descending(all.filter(row => !claimed.has(row.external_id)));

    return ([
        {
            key: 'attention', title: 'Needs your attention', rows: attention,
            hint: 'The exam time has arrived and the candidate has not been let in yet.',
        },
        {
            key: 'today', title: 'Today', rows: today,
            hint: 'Everything else scheduled with you today.',
        },
        {
            key: 'upcoming', title: 'Upcoming', rows: upcoming,
            hint: 'Booked with you for a later date.',
        },
        {
            key: 'past', title: 'Past and closed', rows: past,
            hint: 'Completed, cancelled and expired appointments.',
        },
    ] as QueueGroup<T>[]).filter(group => group.rows.length > 0);
}

/**
 * A short, human "when" for a card.
 *
 * Today / Tomorrow / Yesterday by name, because a proctor reading a list of
 * appointments is placing them relative to now, and "Mon, 19 Aug at 08:00" makes
 * them do that arithmetic on every row.
 */
export function relativeWhen(dateString: string, now = new Date()): string {
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return '';
    const time = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    if (isSameDay(date, now)) return `Today at ${time}`;

    const tomorrow = new Date(now);
    tomorrow.setDate(now.getDate() + 1);
    if (isSameDay(date, tomorrow)) return `Tomorrow at ${time}`;

    const yesterday = new Date(now);
    yesterday.setDate(now.getDate() - 1);
    if (isSameDay(date, yesterday)) return `Yesterday at ${time}`;

    return date.toLocaleDateString([], {
        weekday: 'short', month: 'short', day: 'numeric',
    }) + ` at ${time}`;
}
