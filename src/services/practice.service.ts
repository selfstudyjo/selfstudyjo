import { apiService, withReplicas } from './api';
import { serviceRegistry } from './config';
import { normalizePaginatedResponse } from '@/utils/api-utils';
import {
    PENALTY_CAP,
    isNegative,
    isTerminal,
    newEventId,
    newSessionId,
    severityOf,
    verdictFor,
    type PracticeContext,
    type PracticeEvent,
    type Verdict,
} from '@/utils/practiceIntegrity';

/**
 * The practice ledger's client: record what a student does, and read it back.
 *
 * One service for all three contexts, because there is one collection - app
 * 20's `practice_events`. A lab's actions live there too, and the reasoning is
 * in `utils/integrity.py`'s header: two collections would be two shapes, two
 * merge policies and two places for the catalogue to drift.
 *
 * THE RECORDER IS A QUEUE, NOT A REQUEST PER EVENT
 *
 * Every write to that store fans out to every peer on a background thread, so
 * one request per action is one fan-out per action - and a sitting produces a
 * handful in quick succession. `record()` queues, and a flush posts the lot to
 * `/practice-events/batch/`, which writes them with one `bulk_put`.
 *
 * **A breach flushes on a short debounce and everything else waits.** The count
 * is what ends a sitting, so a candidate who alt-tabs five times in four
 * seconds must not be able to submit in between - but a burst of five blur
 * events should still be one request. 600ms is the compromise: over before
 * anybody can reach the Submit button, long enough to coalesce a window
 * manager's flurry.
 *
 * NOTHING HERE THROWS
 *
 * The same rule as `notificationService.notify()`, for a stronger reason: every
 * call site hangs off something the student is in the middle of. A paper must
 * not fail to submit because the ledger was unreachable, and a lab command must
 * not fail because a penalty could not be written. What that costs is a lost
 * event, which is the right trade for a deterrent and the wrong one for a
 * record - which is why the enforcement reads the STORE rather than trusting
 * anything this file reports.
 */

const EXAM_APP_ID = Number(import.meta.env.VITE_EXAM_APP_ID || '20');

/** How long a queued breach waits for its neighbours. */
const NEGATIVE_DEBOUNCE_MS = 600;

/** How long everything else waits. */
const IDLE_DEBOUNCE_MS = 8000;

interface QueuedEvent {
    external_id: string;
    user_id: string;
    username: string;
    context: PracticeContext;
    subject_id: string;
    subject_name: string;
    session_id: string;
    action: string;
    detail: string;
    occurred_at: string;
}

export interface RecorderOptions {
    context: PracticeContext;
    subjectId: string;
    subjectName?: string;
    userId: string;
    username?: string;
    /** Reuse a session id across a reload; a fresh one is minted otherwise. */
    sessionId?: string;
    /** Called with the server's verdict after every flush that had one. */
    onVerdict?: (verdict: Verdict) => void;
}

/**
 * One sitting's recorder.
 *
 * Holds the session id, the queue and the locally-known verdict. The local
 * verdict is what the meter draws and the server's is what replaces it when a
 * flush answers - so the meter moves the instant something happens and settles
 * on the truth a moment later.
 */
export class PracticeRecorder {
    readonly sessionId: string;

    private readonly options: RecorderOptions;
    private queue: QueuedEvent[] = [];
    /**
     * Every action this sitting has recorded, for the local verdict.
     *
     * Timestamped, because the verdict has to know which side of the sitting's
     * END each one fell on - a breach recorded after `assessment.submitted` is
     * not misconduct, there being nothing left to cheat at.
     */
    private seen: { action: string; at: number }[] = [];
    private timer: ReturnType<typeof setTimeout> | null = null;
    private flushing = false;
    private stopped = false;
    private serverVerdict: Verdict | null = null;

    constructor(options: RecorderOptions) {
        this.options = options;
        this.sessionId = options.sessionId || newSessionId();
    }

    /**
     * The verdict as best this browser knows it.
     *
     * The server's when there is one, because it has seen events from a reload
     * or a second tab that this instance has not; the local count otherwise,
     * and the local count is what makes the meter immediate.
     *
     * **`Math.max` on the negatives, not "prefer the server".** A flush that
     * has not landed yet leaves the server's count behind the local one, and a
     * meter that went backwards after a breach would teach the candidate the
     * breach was not counted.
     */
    verdict(): Verdict {
        const local = verdictFor(this.seen, this.options.context);
        const remote = this.serverVerdict;
        if (!remote) return local;
        if (remote.negatives >= local.negatives) return remote;
        return { ...remote, ...local, points: local.points };
    }

    /** Whether this sitting has already recorded the action that ends it. */
    get closed(): boolean {
        return this.seen.some(row => isTerminal(row.action, this.options.context));
    }

    /**
     * Queue an action. Never throws, never awaits.
     *
     * **A SCORING ACTION AGAINST A FINISHED SITTING IS DROPPED HERE**, before
     * it is queued, before it is drawn on the meter and before it costs a
     * request. App 20 refuses it too - `SittingClosed` - and this is not
     * belt-and-braces for its own sake: the service's refusal arrives a second
     * later and the meter would flicker a penalty on and then off again, which
     * on the one screen that accuses somebody of cheating is worse than the
     * penalty would have been.
     *
     * A NEUTRAL one still goes through. It is free, and the feed is the shape
     * of what happened: a record that stopped dead at the submission would not
     * show that the student went back and reset the lab environment afterwards.
     */
    record(action: string, detail?: string, at?: number): void {
        if (this.stopped) return;
        if (this.closed && severityOf(action) !== 'neutral') return;
        const { context, subjectId, subjectName, userId, username } = this.options;
        if (!userId || !subjectId) return;
        this.queue.push({
            external_id: newEventId(),
            user_id: userId,
            username: username || '',
            context,
            subject_id: subjectId,
            subject_name: subjectName || '',
            session_id: this.sessionId,
            action,
            detail: detail || '',
            occurred_at: new Date(at || Date.now()).toISOString(),
        });
        this.seen.push({ action, at: at || Date.now() });
        this.schedule(isNegative(action) ? NEGATIVE_DEBOUNCE_MS : IDLE_DEBOUNCE_MS);
    }

    private schedule(delay: number) {
        if (this.timer) {
            // A breach arriving behind an idle timer must not wait eight
            // seconds for it. Re-arming on the shorter delay is the whole
            // reason the two are different numbers.
            clearTimeout(this.timer);
        }
        this.timer = setTimeout(() => { this.timer = null; void this.flush(); }, delay);
    }

    /**
     * Post whatever is queued. Safe to call at any time, including twice.
     *
     * A failed batch puts its events BACK on the queue, once. The ids were
     * minted in the browser, so app 20 treats a retry of one that landed as the
     * same record rather than as a second breach - which is what makes a retry
     * safe at all.
     */
    async flush(): Promise<Verdict | null> {
        if (this.flushing || !this.queue.length) return this.serverVerdict;
        this.flushing = true;
        const batch = this.queue;
        this.queue = [];
        try {
            const answer = await postBatch({
                session_id: this.sessionId,
                context: this.options.context,
                user_id: this.options.userId,
                events: batch,
            });
            if (answer?.verdict) {
                this.serverVerdict = normaliseVerdict(answer.verdict,
                                                      this.options.context);
                this.options.onVerdict?.(this.serverVerdict);
            }
            return this.serverVerdict;
        } catch {
            // Put them back at the FRONT, so order survives a failed flush -
            // the feed is sorted by the server's clock, but the batch route's
            // own verdict is computed from what it wrote, and an event that
            // jumped the queue would be counted a moment late.
            this.queue = batch.concat(this.queue);
            return this.serverVerdict;
        } finally {
            this.flushing = false;
        }
    }

    /**
     * Ask the service what this sitting adds up to, from the records.
     *
     * Flushes first, deliberately: asking before the queue has landed answers
     * with a count the caller already knows is short, and the one caller that
     * matters is a submission deciding whether the paper is void.
     */
    async settle(): Promise<Verdict> {
        await this.flush();
        try {
            const answer = await fetchVerdict(this.sessionId, this.options.context,
                                              this.options.userId);
            if (answer) {
                this.serverVerdict = answer.verdict;
                this.options.onVerdict?.(answer.verdict);
            }
        } catch { /* the local verdict is the fallback, and it is honest */ }
        return this.verdict();
    }

    /** Stop accepting anything new, and post what is left. */
    async close(): Promise<void> {
        if (this.timer) { clearTimeout(this.timer); this.timer = null; }
        await this.flush();
        this.stopped = true;
    }
}

/* ------------------------------------------------------------------ *
 * The requests
 * ------------------------------------------------------------------ */

interface BatchAnswer {
    recorded: number;
    results: any[];
    verdict: any | null;
}

async function postBatch(payload: Record<string, unknown>): Promise<BatchAnswer | null> {
    const baseUrl = await serviceRegistry.getRandomExamReplica();
    if (!baseUrl) return null;
    /*
      The PINNED replica, not a fresh pick.

      Replication is push-then-repair, so a sitting whose events were spread
      across two replicas would have its verdict computed from whichever half
      the submission happened to reach - and the submission is pinned too, so
      it is the same replica either way. Failover is deliberately NOT used
      here: a batch that timed out may well have landed, and re-sending it to
      another replica would be fine (the ids are derived) while a verdict read
      from a replica the rest of the sitting never reached would be wrong.
    */
    return apiService.post<BatchAnswer>(baseUrl, '/practice-events/batch/', payload);
}

export interface VerdictAnswer {
    verdict: Verdict;
    ledger: PracticeEvent[];
}

/** One sitting's verdict and its ledger, from the service. */
export async function fetchVerdict(
    sessionId: string, context: PracticeContext, userId: string,
): Promise<VerdictAnswer | null> {
    const baseUrl = await serviceRegistry.getRandomExamReplica();
    if (!baseUrl) return null;
    const query = new URLSearchParams({
        session_id: sessionId, context, user_id: userId || '',
    });
    const answer = await apiService.get<any>(
        baseUrl, `/api/integrity/verdict/?${query.toString()}`);
    if (!answer) return null;
    return {
        verdict: normaliseVerdict(answer, context),
        ledger: (answer.ledger || []).map(toEvent),
    };
}

/**
 * The service's verdict in the engine's own shape.
 *
 * Named fields rather than a cast, because the two sides use different casing -
 * `positive_points` against `positivePoints` - and a cast would silently give
 * every field `undefined`, which renders as a meter reading zero on a sitting
 * with four breaches against it.
 */
function normaliseVerdict(raw: any, context: PracticeContext): Verdict {
    const negatives = Number(raw?.negatives) || 0;
    const limit = raw?.limit === null || raw?.limit === undefined
        ? null : Number(raw.limit);
    return {
        context,
        events: Number(raw?.events) || 0,
        scored: Number(raw?.scored) || 0,
        ignoredAfterClose: Number(raw?.ignored_after_close) || 0,
        /*
          A replica a release behind sends no `closed` at all, and the honest
          reading of a missing field is "this sitting has not ended" - the same
          direction `afterClosure` takes for an undated event. Read the other
          way, a deploy in progress would tell a candidate mid-paper that their
          sitting was over.
        */
        closed: !!raw?.closed,
        negatives,
        positivePoints: Number(raw?.positive_points) || 0,
        penaltyPoints: Number(raw?.penalty_points) || 0,
        penaltyCap: Number(raw?.penalty_cap) || PENALTY_CAP[context],
        penaltyCapped: !!raw?.penalty_capped,
        points: Number(raw?.points) || 0,
        limit,
        remaining: raw?.remaining === null || raw?.remaining === undefined
            ? null : Math.max(0, Number(raw.remaining)),
        failed: !!raw?.failed,
        status: (raw?.status === 'failed' || raw?.status === 'warned')
            ? raw.status : 'clean',
    };
}

function toEvent(raw: any): PracticeEvent {
    const at = new Date(String(raw?.at || raw?.occurred_at || '')).getTime();
    return {
        externalId: String(raw?.external_id || ''),
        userId: String(raw?.user_id || ''),
        username: String(raw?.username || ''),
        context: (raw?.context || 'exam') as PracticeContext,
        subjectId: String(raw?.subject_id || ''),
        subjectName: String(raw?.subject_name || ''),
        sessionId: String(raw?.session_id || ''),
        action: String(raw?.action || ''),
        detail: String(raw?.detail || ''),
        at: Number.isFinite(at) ? at : Number.NaN,
    };
}

/**
 * Every recorded action on the platform, for the leaderboard's activity view.
 *
 * Read with failover, unlike the writes: every replica holds the same records,
 * so a replica that is not answering means asking the next one. A 404 does not
 * fail over - see `withReplicas`.
 *
 * **The whole collection, with no `user_id`.** The leaderboard aggregates in the
 * browser for the reason its own service header gives: a request per learner
 * against a cold PythonAnywhere replica is ~20 seconds each, and there is no
 * per-learner endpoint that would help because the list is what says who to ask
 * about.
 */
export async function loadPracticeEvents(): Promise<PracticeEvent[]> {
    const rows = await withReplicas(EXAM_APP_ID, 'exam', async baseUrl => {
        const response = await apiService.get<any>(baseUrl, '/practice-events/');
        return normalizePaginatedResponse<any>(response).results;
    });
    return rows.map(toEvent);
}

/** One person's actions, for a screen that already knows whose. */
export async function loadPracticeEventsFor(userId: string): Promise<PracticeEvent[]> {
    if (!userId) return [];
    const rows = await withReplicas(EXAM_APP_ID, 'exam', async baseUrl => {
        const response = await apiService.get<any>(
            baseUrl, `/practice-events/?user_id=${encodeURIComponent(userId)}`);
        return normalizePaginatedResponse<any>(response).results;
    });
    return rows.map(toEvent);
}
