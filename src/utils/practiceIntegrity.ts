/**
 * The practice ledger, as the browser understands it: what every action is
 * worth, how many breaches a sitting has left, and what to say about it.
 *
 * A plain module - no Vue, no DOM, no service imports - for the same reason as
 * `photoMask.ts`, `drawEngine.ts`, `leaderboardEngine.ts`, `examShuffle.ts` and
 * `labCatalogue.ts`: everything here is decidable without a browser, and every
 * mistake in it is one nobody can see in a screenshot. `npm run check:practice`
 * drives it, and that check also **reads app 20's `utils/integrity.py` off
 * disk** and fails when the two catalogues disagree (working rule 20).
 *
 * WHY THERE IS A SECOND COPY OF THE CATALOGUE AT ALL
 *
 * The obvious design is to fetch `GET /api/integrity/catalogue/` and print what
 * comes back, which is one place for the numbers and no chance of drift. It is
 * wrong here for two reasons that matter more:
 *
 *  1. **The rules screen is shown before the first question**, and a fetch in
 *     front of it is a round trip to a PythonAnywhere replica whose first
 *     answer of the day is ~20 seconds - so the candidate would stare at a
 *     spinner where the integrity rules should be, or worse, the screen would
 *     render with the rules missing and they would start anyway.
 *  2. **The strike meter has to move the instant something happens.** A
 *     candidate who alt-tabs and sees nothing change for two seconds learns
 *     that alt-tab is free. Counting locally is what makes the deterrent
 *     immediate; the server's count is what makes it true.
 *
 * So there are two copies and a check that they agree, which is the same
 * arrangement `notificationEvents.ts` has with the console's `utils/notify.py`.
 *
 * WHAT THIS MODULE IS NOT
 *
 * It is not the enforcement. `apply_to_result` on app 20 decides whether a
 * paper is scored zero, from the events that actually reached the store - so a
 * client that lies about its own count changes nothing about its mark. What the
 * browser's count is for is the WARNING, and being able to end the sitting on
 * screen at the same moment the service would.
 *
 * Nor is it proctoring. A determined candidate can block the requests this
 * module makes; what they cannot do is submit the paper, because the result
 * goes to the same service over the same connection. Real invigilation is app
 * 21's job and this is a deterrent with an audit trail.
 */

import type { Params } from '@/i18n';

export type Severity = 'positive' | 'negative' | 'neutral';

export type PracticeContext = 'exam' | 'quiz' | 'lab';

export const CONTEXTS: readonly PracticeContext[] = ['exam', 'quiz', 'lab'];

export interface ActionSpec {
    /** Signed. Negative for a breach, positive for conduct, zero for neutral. */
    points: number;
    /**
     * A price that overrides `points` in one context.
     *
     * It exists because one number cannot be right in both places: leaving the
     * window during a paper is misconduct and leaving it during a lab is
     * reading the documentation the lab told you to read. The base price is the
     * ASSESSED one - the strict reading - so an action added without an
     * override is priced as though it were misconduct rather than as though it
     * were free, which is the direction that gets noticed.
     */
    contextPoints?: Partial<Record<PracticeContext, number>>;
    severity: Severity;
    /** Where it may be recorded. An action posted elsewhere is refused. */
    contexts: readonly PracticeContext[];
    /** What the ledger prints. An English catalogue key - see `$t`. */
    label: string;
    /** Why it is worth what it is worth. Printed in the rules and the feed. */
    why: string;
    /**
     * How many times one sitting may collect it. `0` is unlimited, which is
     * only ever right for a breach: refusing to record the sixth thing somebody
     * did wrong would be refusing the evidence.
     */
    once: number;
}

/**
 * The strike limit, and the one number every screen quotes.
 *
 * Both assessed contexts share it deliberately: "five" has to be one number a
 * student can remember, and a quiz that tolerated more than an exam would teach
 * the wrong habit on the cheaper of the two.
 */
export const NEGATIVE_LIMIT = 5;

/**
 * How many breaches end a sitting, per context. `null` is "never".
 *
 * **A LAB IS NEVER FAILED, and that is the whole shape of the feature.**
 * Leaving the window to read documentation is what a practitioner does, and
 * failing somebody for it would teach them to work worse. An exam is a
 * measurement, and a measurement taken while the candidate was somewhere else
 * is not a measurement. So the same action costs the same points in both and
 * only one of them ends the sitting.
 */
export const FAILS_AT: Record<PracticeContext, number | null> = {
    exam: NEGATIVE_LIMIT, quiz: NEGATIVE_LIMIT, lab: null,
};

/**
 * What one sitting may cost, at most, per context. Signed and negative.
 *
 * **A PENALTY IS A BOUNDED MODIFIER, NOT AN UNBOUNDED SINK**, and the reasoning
 * is different at each end:
 *
 *  * an exam or a quiz already has its real consequence - five breaches and the
 *    paper is scored zero - so a sixth and a seventh adding more arithmetic
 *    buys nothing and turns a voided sitting into a debt carried across the
 *    learner's whole record;
 *  * a lab has no other consequence and is unbounded in TIME. A two-hour
 *    session with forty switches to the documentation is normal practice, and
 *    uncapped that is 160 points - more than an exam pass is worth, for doing
 *    what the lab asked.
 *
 * Over the cap a breach is still recorded and still COUNTS towards the strike
 * limit. What stops is the arithmetic, which is why five still voids a paper.
 */
export const PENALTY_CAP: Record<PracticeContext, number> = {
    exam: -30, quiz: -30, lab: -15,
};

/**
 * The action that ENDS a sitting, per context.
 *
 * Nothing stamped after one of these is scored or counted. Declared rather than
 * inferred from the severity, because "the sitting is over" is a fact about one
 * named action and a rule like "the last neutral event" would silently move the
 * end of the sitting the day somebody added one.
 *
 * **A lab had no end at all until this existed**, which is the whole of the
 * reported bug: a student who finished every task and left the workspace open
 * went on paying for every switch to their editor, for as long as the tab was
 * open, on a record anybody can read.
 */
export const TERMINAL_ACTIONS: Record<PracticeContext, string> = {
    exam: 'assessment.submitted',
    quiz: 'assessment.submitted',
    lab: 'lab.completed',
};

/** Asks of a lab's AI tutor that are free before each further one costs. */
export const AI_FREE_ASKS = 3;

/** How long unbroken attention earns one `focus.sustained` award. */
export const FOCUS_AWARD_MS = 5 * 60 * 1000;

/**
 * Every action, byte-for-byte in step with app 20's `utils/integrity.py`.
 *
 * `npm run check:practice` parses that file and fails on any difference in the
 * points, the severity, the contexts or the cap. The LABEL and the WHY are
 * checked for presence rather than for equality: this side is a translation
 * catalogue key and that side is a log line, so they are allowed to be worded
 * for their own reader.
 */
export const ACTIONS: Record<string, ActionSpec> = {
    // -- neutral: the shape of the sitting ---------------------------------
    'assessment.started': {
        points: 0, severity: 'neutral', contexts: ['exam', 'quiz'], once: 1,
        label: 'Started the paper',
        why: 'The sitting began.',
    },
    'assessment.rules_acknowledged': {
        points: 0, severity: 'neutral', contexts: ['exam', 'quiz'], once: 1,
        label: 'Read and accepted the integrity rules',
        why: 'The clock does not start until the rules are accepted.',
    },
    'assessment.submitted': {
        points: 0, severity: 'neutral', contexts: ['exam', 'quiz'], once: 1,
        label: 'Submitted the paper',
        why: 'The sitting ended.',
    },
    'lab.opened': {
        points: 0, severity: 'neutral', contexts: ['lab'], once: 1,
        label: 'Opened the lab',
        why: 'So a lab you are working on is visible before you finish it.',
    },
    'lab.checked': {
        points: 0, severity: 'neutral', contexts: ['lab'], once: 0,
        label: 'Pressed Check my work',
        why: 'Free and unlimited. Checking often is how a lab is meant to be worked.',
    },
    'lab.ai_asked': {
        points: 0, severity: 'neutral', contexts: ['lab'], once: AI_FREE_ASKS,
        label: 'Asked the lab tutor',
        why: 'Your first three asks in a lab are free.',
    },
    'lab.reset': {
        points: 0, severity: 'neutral', contexts: ['lab'], once: 0,
        label: 'Reset the environment',
        why: 'Starting again costs nothing.',
    },
    'lab.completed': {
        // THE END OF A LAB. Neutral, because app 11's own task points and the
        // completion bonus already pay for finishing one, and paying again
        // here would be one achievement and two awards.
        points: 0, severity: 'neutral', contexts: ['lab'], once: 1,
        label: 'Finished the lab',
        why: 'Every task verified. Nothing after this is scored.',
    },

    // -- positive: conduct and effort -------------------------------------
    'focus.sustained': {
        // ATTENTION IS EVIDENCED, NOT ASSUMED, and the cap is eight.
        //
        // `practiceMonitor.ts` requires at least one genuine interaction inside
        // the five minutes - a keystroke, a pointer press, a scroll - because
        // the previous rule paid a student who opened a lab and walked away.
        // And twelve awards was 24 points, a quarter of what passing an exam is
        // worth, for sitting still; eight is a contribution rather than a rival.
        points: 2, severity: 'positive', contexts: ['exam', 'quiz', 'lab'],
        once: 8,
        label: 'Stayed on task',
        why: 'One award for every five minutes of unbroken, active work, up to eight.',
    },
    'assessment.all_answered': {
        points: 5, severity: 'positive', contexts: ['exam', 'quiz'], once: 1,
        label: 'Answered every question',
        why: 'Awarded once, for leaving nothing blank.',
    },
    'assessment.clean_sitting': {
        points: 15, severity: 'positive', contexts: ['exam', 'quiz'], once: 1,
        label: 'Sat the whole paper cleanly',
        why: 'No window left, nothing copied, nothing pasted, from the first question to submission.',
    },
    'lab.clean_session': {
        points: 10, severity: 'positive', contexts: ['lab'], once: 1,
        label: 'Finished the lab within the free tutor allowance',
        why: 'Completed every task having asked the tutor three times or fewer.',
    },
    'lab.persisted': {
        points: 3, severity: 'positive', contexts: ['lab'], once: 4,
        label: 'Worked a task through to a verified pass',
        why: 'Awarded when Check my work finds something new, up to four times per lab.',
    },

    // -- negative: why points come off ------------------------------------
    'window.left': {
        // A LAB PRICES THIS AT A QUARTER. Leaving the window during a paper is
        // misconduct; leaving it during a lab is opening the documentation the
        // brief told the student to read. Still recorded, because how the work
        // went is information, and priced as the small thing it is.
        points: -4, severity: 'negative', contexts: ['exam', 'quiz', 'lab'],
        contextPoints: { lab: -1 },
        once: 0,
        label: 'Left the exam window',
        why: 'The tab lost focus or was hidden. In an exam this is one of the five.',
    },
    'window.alt_tab': {
        points: -6, severity: 'negative', contexts: ['exam', 'quiz', 'lab'],
        contextPoints: { lab: -2 },
        once: 0,
        label: 'Switched away with Alt+Tab',
        why: 'A deliberate switch to another application, which is why it costs more.',
    },
    'clipboard.copy': {
        // ASSESSED CONTEXTS ONLY. Copying in a lab is how a command gets from
        // the brief into the terminal - the single most ordinary thing a
        // student does in one - so charging for it penalised the intended
        // behaviour. Priced at zero it would still read as a breach on the
        // record; removed from the context, it is not an event.
        points: -5, severity: 'negative', contexts: ['exam', 'quiz'],
        once: 0,
        label: 'Copied text out of the paper',
        why: 'How many characters is recorded. The text itself never is.',
    },
    'clipboard.paste': {
        points: -5, severity: 'negative', contexts: ['exam', 'quiz'],
        once: 0,
        label: 'Pasted text into the paper',
        why: 'An answer that arrived from somewhere else.',
    },
    'devtools.opened': {
        points: -8, severity: 'negative', contexts: ['exam', 'quiz'], once: 0,
        label: 'Opened the browser developer tools',
        why: 'The heaviest penalty: during a paper its only use is to read what the page was sent.',
    },
    'print.attempt': {
        points: -5, severity: 'negative', contexts: ['exam', 'quiz'], once: 0,
        label: 'Tried to print or save the paper',
        why: 'Taking the questions out of the room.',
    },
    'fullscreen.exited': {
        points: -3, severity: 'negative', contexts: ['exam', 'quiz'], once: 0,
        label: 'Left full screen',
        why: 'Cheapest of the five, because it is the one people do by accident.',
    },
    'ai.overused': {
        points: -3, severity: 'negative', contexts: ['lab'], once: 0,
        label: 'Asked the tutor beyond the free allowance',
        why: 'Each ask past the first three costs. It never fails a lab.',
    },
};

/* ------------------------------------------------------------------ *
 * Reading the catalogue
 * ------------------------------------------------------------------ */

export function specOf(action: string): ActionSpec | null {
    return ACTIONS[String(action || '').trim()] ?? null;
}

/**
 * What an action costs or earns, in the context it happened in.
 *
 * `context` is optional and its absence means the STRICT reading: the base
 * price, which is the assessed one. That default is deliberate - a caller that
 * forgets to pass a context prices a lab breach as an exam breach, which is
 * visibly harsh and gets reported, where the other default would be silently
 * generous and nobody would ever notice.
 */
export function pointsOf(action: string, context?: PracticeContext): number {
    const spec = specOf(action);
    if (!spec) return 0;
    if (context) {
        const override = spec.contextPoints?.[context];
        if (typeof override === 'number') return override;
    }
    return spec.points;
}

export function severityOf(action: string): Severity {
    return specOf(action)?.severity ?? 'neutral';
}

export function labelOf(action: string): string {
    return specOf(action)?.label ?? String(action || '');
}

export function isNegative(action: string): boolean {
    return severityOf(action) === 'negative';
}

export function allowedIn(action: string, context: PracticeContext): boolean {
    const spec = specOf(action);
    return !!spec && spec.contexts.includes(context);
}

/**
 * The actions that apply to one context, worst first.
 *
 * Worst first because this is what the rules screen prints, and a list that
 * opened with "leaving full screen costs three points" buries the sentence that
 * matters. Ordered inside a severity by cost and then by name, so it is a total
 * order and the list cannot reshuffle between renders.
 */
export function rulesFor(context: PracticeContext, severity: Severity): ActionSpec[] {
    return Object.entries(ACTIONS)
        .filter(([, spec]) => spec.severity === severity
            && spec.contexts.includes(context))
        .map(([action, spec]) => ({ ...spec, action } as ActionSpec & { action: string }))
        .sort((a, b) => Math.abs(b.points) - Math.abs(a.points)
            || ((a as any).action < (b as any).action ? -1 : 1));
}

/* ------------------------------------------------------------------ *
 * One recorded action
 * ------------------------------------------------------------------ */

export interface PracticeEvent {
    externalId: string;
    userId: string;
    username?: string;
    context: PracticeContext;
    subjectId: string;
    subjectName?: string;
    sessionId: string;
    action: string;
    /** Bounded, never the copied text. See `describeCopy`. */
    detail?: string;
    /** Epoch ms. NaN for an unparseable date, which reads as undated. */
    at: number;
}

export interface Verdict {
    context: PracticeContext;
    /** Every event, including the ones after the close. The record's length. */
    events: number;
    /** How many of them the arithmetic looked at. */
    scored: number;
    /** Scoring events that arrived after the sitting ended. */
    ignoredAfterClose: number;
    /** Whether the sitting holds its terminal event. */
    closed: boolean;
    negatives: number;
    positivePoints: number;
    penaltyPoints: number;
    penaltyCap: number;
    /** Whether the arithmetic hit the cap. The breaches still all count. */
    penaltyCapped: boolean;
    /** The net. Can be negative, and is shown as such. */
    points: number;
    /** Null in a context with no limit. */
    limit: number | null;
    /** Null in a context with no limit. Never negative - see the check. */
    remaining: number | null;
    failed: boolean;
    status: 'clean' | 'warned' | 'failed';
}

/** One event, as much of it as the arithmetic needs. */
export type ScorableEvent = { action: string; at?: number };

/** Whether an action ends a sitting. With no context, any of them. */
export function isTerminal(action: string, context?: PracticeContext): boolean {
    const name = String(action || '');
    if (context) return name === TERMINAL_ACTIONS[context];
    return Object.values(TERMINAL_ACTIONS).includes(name);
}

/**
 * Where a sitting ended: `[stamp, index]`, or `[null, null]`.
 *
 * The FIRST terminal event, not the last: a second submission is a retry and
 * the sitting ended at the first one.
 *
 * Two keys and not one, because the comparison has to survive both shapes this
 * is handed. Real events carry `at` and are ordered by it, so a stamp is the
 * honest test - a breach flushed after the submission genuinely happened later.
 * A caller driving the arithmetic with bare `{ action }` objects has no stamps
 * at all, and there position is the only ordering there is.
 */
export function closureOf(
    events: readonly ScorableEvent[], context?: PracticeContext,
): [number | null, number | null] {
    for (let index = 0; index < (events || []).length; index++) {
        const row = events[index];
        if (isTerminal(row?.action ?? '', context)) {
            const at = Number(row?.at);
            return [Number.isFinite(at) ? at : null, index];
        }
    }
    return [null, null];
}

/**
 * Whether one event falls outside the sitting it belongs to.
 *
 * An UNDATED event is never assumed to be late. That direction is chosen
 * deliberately: reading a missing timestamp as "after the end" would silently
 * stop scoring a whole sitting, and the failure would look like a learner who
 * earned nothing rather than like a missing field.
 */
export function afterClosure(
    row: ScorableEvent, index: number,
    stamp: number | null, atIndex: number | null,
): boolean {
    if (atIndex === null) return false;
    if (stamp === null) return index > atIndex;
    const at = Number(row?.at);
    return Number.isFinite(at) && at > stamp;
}

/**
 * What a sitting's events add up to.
 *
 * The same arithmetic as `integrity.verdict` on app 20, and the check asserts
 * the two agree on the same input - because a candidate watching their
 * remaining strikes and the service ending the sitting must be counting the
 * same events, or the fail arrives with no warning at all.
 *
 * An action this build does not recognise scores zero and is not a strike. A
 * replica a release ahead can send one, and the honest reading of "I do not
 * know what this is" is not "this is a breach".
 */
export function verdictFor(
    events: readonly ScorableEvent[],
    context: PracticeContext,
): Verdict {
    const limit = FAILS_AT[context] ?? null;
    const cap = PENALTY_CAP[context];
    const rows = events || [];
    const [stamp, atIndex] = closureOf(rows, context);
    let negatives = 0;
    let positivePoints = 0;
    let penaltyPoints = 0;
    let ignoredAfterClose = 0;
    let scored = 0;
    for (let index = 0; index < rows.length; index++) {
        const event = rows[index];
        const spec = specOf(event?.action ?? '');
        if (!spec) continue;
        if (afterClosure(event, index, stamp, atIndex)) {
            /*
              AFTER THE SITTING ENDED. Kept in the feed - the record of what
              happened is the point of publishing one - and scored at nothing,
              and NOT counted as a strike: a queue flushed a second after the
              paper went in must not be able to void a paper that was already
              submitted.
            */
            if (spec.severity !== 'neutral') ignoredAfterClose += 1;
            continue;
        }
        scored += 1;
        const value = pointsOf(event.action, context);
        if (spec.severity === 'negative') {
            negatives += 1;
            penaltyPoints += value;
        } else if (value > 0) {
            positivePoints += value;
        }
    }
    // The cap bounds the ARITHMETIC and never the count, so five breaches still
    // void a paper however cheaply the sixth was priced.
    const penaltyCapped = penaltyPoints < cap;
    if (penaltyCapped) penaltyPoints = cap;
    return {
        context,
        events: rows.length,
        scored,
        ignoredAfterClose,
        closed: atIndex !== null,
        negatives,
        positivePoints,
        penaltyPoints,
        penaltyCap: cap,
        penaltyCapped,
        points: positivePoints + penaltyPoints,
        limit,
        // Clamped. A negative "strikes remaining" renders as "-2 left" on the
        // candidate's own screen, which reads as a bug in the page rather than
        // as a sitting that is already over.
        remaining: limit === null ? null : Math.max(0, limit - negatives),
        failed: limit !== null && negatives >= limit,
        status: statusFor(negatives, limit),
    };
}

export function statusFor(negatives: number, limit: number | null):
    'clean' | 'warned' | 'failed' {
    if (limit === null) return negatives ? 'warned' : 'clean';
    if (negatives >= limit) return 'failed';
    return negatives ? 'warned' : 'clean';
}

/**
 * How loudly the meter should shout: four bands, not three.
 *
 * `critical` exists because "warned" covers one breach and four breaches, and
 * those want completely different treatment on screen - the first is a note and
 * the second is the last thing somebody sees before their paper is voided.
 * Split at two remaining, so there is a step before the cliff.
 */
export type Band = 'clean' | 'warned' | 'critical' | 'failed';

export function bandOf(verdict: Verdict): Band {
    if (verdict.failed) return 'failed';
    if (verdict.remaining !== null && verdict.remaining <= 2) return 'critical';
    return verdict.negatives ? 'warned' : 'clean';
}

/**
 * The sentence a finished sitting shows in place of the strike count.
 *
 * Its own message rather than a variant of the clean one, because the two say
 * different things: "nothing has gone wrong yet" is about a paper still in
 * front of you, and this is about one that is over. Without it the meter goes
 * on counting down at somebody who has already submitted, which is exactly the
 * anxiety the closure rule exists to remove.
 */
export const CLOSED_MESSAGE = 'This sitting is finished. Nothing further is scored against it.';

/* ------------------------------------------------------------------ *
 * Throttling, which is the difference between a ledger and a log
 * ------------------------------------------------------------------ */

/**
 * The shortest gap between two recordings of the same action, in ms.
 *
 * **Without this the feature does not work at all**, and the failure is not
 * subtle: a browser fires `blur` and `visibilitychange` for one alt-tab, a
 * window manager can fire several as focus settles, and a candidate who clicks
 * the taskbar once would collect five strikes and have their paper voided for
 * a single action. That is worse than not counting at all, because it is
 * unfair in a way they cannot argue with.
 *
 * Chosen per action rather than one number: two deliberate copies four seconds
 * apart are two events, and two blur events 200ms apart are one.
 */
export const MIN_GAP_MS: Record<string, number> = {
    'window.left': 3000,
    'window.alt_tab': 3000,
    'clipboard.copy': 1200,
    'clipboard.paste': 1200,
    'print.attempt': 2000,
    'fullscreen.exited': 3000,
    // The detector is a heuristic on the window's own geometry, so it fires
    // repeatedly while the panel stays open. One strike per half minute.
    'devtools.opened': 30000,
    'ai.overused': 0,
};

/** How long after an Alt+Tab a `window.left` is treated as the same action. */
export const ALT_TAB_ABSORB_MS = 2500;

export interface ThrottleState {
    /** Last accepted time per action, epoch ms. */
    lastAt: Record<string, number>;
}

export function newThrottle(): ThrottleState {
    return { lastAt: {} };
}

/**
 * Whether an action should be recorded now, given what has already been.
 *
 * Returns the decision AND mutates nothing - the caller commits with
 * `commitThrottle`, so a caller that decides not to record for its own reasons
 * does not poison the gap. Two rules:
 *
 *  * the per-action minimum gap above;
 *  * **an Alt+Tab absorbs the blur it causes.** Pressing Alt+Tab makes the
 *    window lose focus, so both detectors fire for one action; counted
 *    separately that is two strikes for one keystroke, which is the single
 *    most likely way this feature would be reported as broken.
 */
export function shouldRecord(
    state: ThrottleState, action: string, now: number,
): boolean {
    const gap = MIN_GAP_MS[action] ?? 0;
    const last = state.lastAt[action];
    if (gap > 0 && typeof last === 'number' && now - last < gap) return false;
    if (action === 'window.left') {
        const altTab = state.lastAt['window.alt_tab'];
        if (typeof altTab === 'number' && now - altTab < ALT_TAB_ABSORB_MS) {
            return false;
        }
    }
    return true;
}

export function commitThrottle(state: ThrottleState, action: string, now: number): void {
    state.lastAt[action] = now;
}

/* ------------------------------------------------------------------ *
 * Details, and the one that is a security rule
 * ------------------------------------------------------------------ */

/** The longest detail this side will send. App 20 truncates again. */
export const MAX_DETAIL = 120;

/**
 * What to record about a copy: HOW MUCH, never WHAT.
 *
 * This is the one privacy rule here that is also a security rule. The ledger is
 * published on a page that needs no account, and app 20 ships `is_correct` to
 * the browser inside the exam payload - so a copy during a paper is most likely
 * a question and its answer key. A `detail` carrying the copied text would put
 * the exam paper on a public page, which is a far worse outcome than the
 * cheating it was recording.
 *
 * `check:practice` asserts this function's output contains none of its input.
 */
export function describeCopy(text: string): string {
    const length = String(text ?? '').length;
    return `${length} characters`;
}

/** Bounded, single-line, control-character-free. App 20 does this again. */
export function sanitiseDetail(value: unknown): string {
    return String(value ?? '')
        .replace(/[\u0000-\u001f\u007f]+/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
        .slice(0, MAX_DETAIL);
}

/* ------------------------------------------------------------------ *
 * Identity
 * ------------------------------------------------------------------ */

/**
 * A session id for one sitting, minted in the browser.
 *
 * The browser mints it for the reason the message id in `userchat.service.ts`
 * and the element id in `drawEngine.ts` are minted there: it has to exist
 * before the first request, so that request can be retried idempotently. It is
 * **not a secret** - app 20 filters a verdict by the owner as well as by the
 * session, precisely because anybody could guess one.
 */
export function newSessionId(): string {
    return `sit_${randomId()}`;
}

/** An event id, so a retry of a failed batch is an update and not a duplicate. */
export function newEventId(): string {
    return `pe_${randomId()}`;
}

function randomId(): string {
    const crypto = typeof globalThis !== 'undefined'
        ? (globalThis as any).crypto : undefined;
    if (crypto?.randomUUID) return String(crypto.randomUUID()).replace(/-/g, '');
    if (crypto?.getRandomValues) {
        const bytes = new Uint8Array(16);
        crypto.getRandomValues(bytes);
        return Array.from(bytes, byte => byte.toString(16).padStart(2, '0')).join('');
    }
    // Node, and any browser old enough to lack both. Never security-bearing:
    // the id only has to be unique, and the server filters by owner.
    return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 12)}`;
}

/* ------------------------------------------------------------------ *
 * What the screens say
 * ------------------------------------------------------------------ */

/**
 * The one sentence a candidate reads while a paper is open.
 *
 * English catalogue keys with `{v0}` placeholders, so the caller passes them
 * through `$t`. It returns a key and its params rather than a finished string
 * for exactly that reason: a sentence assembled here would be untranslatable,
 * and `check:i18n` would report it as an orphan because no source file contains
 * the literal.
 */
export function strikeMessage(verdict: Verdict): { key: string; params: Params } {
    // FIRST, and before the limit is even looked at. A finished lab and a
    // submitted paper are both over, and neither should be told how many
    // breaches would end them.
    if (verdict.closed) return { key: CLOSED_MESSAGE, params: {} };
    if (verdict.limit === null) {
        return verdict.negatives
            ? {
                key: '{v0} points lost so far. Nothing here can fail you — a lab is for trying things.',
                params: { v0: Math.abs(verdict.penaltyPoints) },
            }
            : { key: 'No points lost. Keep going.', params: {} };
    }
    if (verdict.failed) {
        return {
            key: 'This sitting has been ended. {v0} integrity breaches were recorded and {v1} is the limit.',
            params: { v0: verdict.negatives, v1: verdict.limit },
        };
    }
    if (verdict.negatives === 0) {
        return {
            key: 'Clean so far. {v0} breaches would end this sitting.',
            params: { v0: verdict.limit },
        };
    }
    if (verdict.remaining === 1) {
        return {
            key: 'One more breach will end this sitting and score it zero.',
            params: {},
        };
    }
    return {
        key: '{v0} of {v1} breaches recorded. {v2} more will end this sitting.',
        params: { v0: verdict.negatives, v1: verdict.limit, v2: verdict.remaining },
    };
}

/**
 * The reprimand, worded as a key.
 *
 * Firm, specific, and it names the count rather than listing the actions: the
 * actions are on the ledger the student can read, and a message that listed
 * them here would be the only place a reprimand is delivered without the
 * evidence beside it. App 20 stores its own copy of this on the result, because
 * the record has to carry the reason even when nobody is looking at this page.
 */
export const FAIL_HEADLINE = 'This sitting was ended for cheating';

export const FAIL_BODY = 'Leaving the exam window, switching away with Alt+Tab, copying, pasting, printing or opening the developer tools during a paper is cheating. {v0} breaches were recorded against this sitting and {v1} is the limit, so it has been submitted and scored zero. Every action is on your activity record with the time it happened, and that record is public. Speak to your instructor if you believe any of it is wrong.';

/**
 * How a lab earns points, as a list of English keys.
 *
 * Printed on the lab catalogue and inside a workspace. It is here rather than in
 * either component because both print it and a second copy is a second thing to
 * keep in step - and because `check:practice` asserts every claim in it matches
 * a real number in `ACTIONS`, which is the failure worth catching: a page that
 * promises ten points for something worth three is worse than a page that
 * promises nothing.
 */
export function labEarningRules(): { key: string; params: Params }[] {
    // The body is below the derived key lists at the bottom of the file, which
    // call this - so this function has to be declared before them and they are
    // hoisted constants. See LEDGER_KEYS.
    return [
        {
            key: 'Every task the service verifies in your environment is worth {v0} points.',
            params: { v0: 4 },
        },
        {
            key: 'Finishing every task in a lab adds {v0} more.',
            params: { v0: 40 },
        },
        {
            key: 'Finishing a lab having asked the tutor {v0} times or fewer adds {v1}.',
            params: { v0: AI_FREE_ASKS, v1: ACTIONS['lab.clean_session'].points },
        },
        {
            key: 'Every five minutes of unbroken, active work adds {v0}, up to {v1} times.',
            params: {
                v0: ACTIONS['focus.sustained'].points,
                v1: ACTIONS['focus.sustained'].once,
            },
        },
        {
            key: 'Working a task through to a verified pass adds {v0}, up to {v1} times.',
            params: {
                v0: ACTIONS['lab.persisted'].points,
                v1: ACTIONS['lab.persisted'].once,
            },
        },
        {
            key: 'Asking the tutor a fourth time and beyond costs {v0} each.',
            params: { v0: Math.abs(ACTIONS['ai.overused'].points) },
        },
        {
            // THE LAB'S OWN PRICES, not the exam's. Quoting the base numbers
            // here would tell a student a switched window costs four when it
            // costs one - a page that promises the wrong figure is worse than a
            // page that promises nothing, which is the whole reason
            // `check:practice` compares these against the catalogue.
            key: 'Leaving the window costs {v0}, and Alt+Tab costs {v1} — but nothing in a lab can fail you.',
            params: {
                v0: Math.abs(pointsOf('window.left', 'lab')),
                v1: Math.abs(pointsOf('window.alt_tab', 'lab')),
            },
        },
        {
            key: 'A lab is capped at {v0} points lost however long you work, and once every task is verified nothing further is scored at all.',
            params: { v0: Math.abs(PENALTY_CAP.lab) },
        },
    ];
}

/* ------------------------------------------------------------------ *
 * Every string reached through a VARIABLE, for `check:i18n`
 * ------------------------------------------------------------------ */

/**
 * The keys no source file contains as a literal.
 *
 * `$t(rule.label)`, `$t(rule.why)`, `$t(message.key, message.params)` - every
 * one of them is spent through a variable, so the orphan scan in
 * `check:i18n` would report all of them and the coverage scan would report
 * none. They are the opposite of orphans: keys whose call site cannot be
 * scanned for. Exported so that check can verify them against the table
 * instead, which is how the sidebar's labels, the dashboard's badges and the
 * labs' panel titles are all handled.
 *
 * DERIVED by reading the catalogue and calling the functions, never a second
 * hand-written list. A copy goes stale the day somebody rewords a penalty, and
 * the symptom is a line that silently reverts to English in both languages -
 * on a screen whose whole job is to tell somebody why they were penalised.
 */
export const PRACTICE_KEYS: readonly string[] = (() => {
    const keys = new Set<string>();
    for (const spec of Object.values(ACTIONS)) {
        keys.add(spec.label);
        keys.add(spec.why);
    }
    keys.add(FAIL_HEADLINE);
    keys.add(FAIL_BODY);
    for (const rule of labEarningRules()) keys.add(rule.key);
    /*
      The strike messages, driven over the whole decision space rather than
      listed.

      Six verdicts: a clean exam, one breach, four (the "one more" sentence),
      five (failed), and both lab states. Every branch of `strikeMessage` is
      reached by one of them, and a branch added without a translation fails
      `check:i18n` rather than rendering English inside an Arabic panel.
    */
    const sample = (negatives: number, context: PracticeContext) =>
        verdictFor(Array.from({ length: negatives }, () => ({ action: 'window.left' })),
                   context);
    // Seven now: the six above plus a CLOSED one, which takes the branch none
    // of the others can reach.
    const closed = verdictFor([{ action: 'lab.completed' }], 'lab');
    for (const verdict of [sample(0, 'exam'), sample(1, 'exam'), sample(4, 'exam'),
        sample(5, 'exam'), sample(0, 'lab'), sample(2, 'lab'), closed]) {
        keys.add(strikeMessage(verdict).key);
    }
    return [...keys];
})();
