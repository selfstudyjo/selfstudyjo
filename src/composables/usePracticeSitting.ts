/**
 * One sitting, wired up: the recorder, the DOM monitor, the live verdict, and
 * the decision to end a paper.
 *
 * WHY THIS IS A COMPOSABLE AND NOT ANOTHER MODULE IN `utils/`
 *
 * Everything in `src/utils/` that this platform treats as checkable is PLAIN -
 * no Vue, no DOM - because that is what lets `npm run check:*` drive it in
 * node. This file imports Vue and owns a lifecycle, so it is neither, and
 * putting it in `utils/` would quietly weaken a convention CLAUDE.md is
 * emphatic about. The judgements it needs are `practiceIntegrity.ts`'s and the
 * listeners are `practiceMonitor.ts`'s; what is here is the glue and the
 * lifecycle, which is the part a check cannot see anyway.
 *
 * WHY IT IS SHARED BY THE EXAM AND THE QUIZ AND THE LAB
 *
 * Three copies of "start a sitting, watch it, end it when the fifth breach
 * lands" is three places for the strike count to drift, and the symptom of a
 * drift is a candidate failed at four breaches on one screen and six on
 * another. There is one copy, and the differences between the three contexts
 * are `FAILS_AT` and the `watch` flags - both data.
 *
 * THE ORDER THE END OF A SITTING HAPPENS IN, WHICH IS THE WHOLE OF IT
 *
 * When the fifth breach lands:
 *
 *   1. the monitor stops, so nothing else is collected;
 *   2. the queue is FLUSHED and the verdict settled against the service,
 *      because the service is what decides the mark and the client's count is
 *      only the warning;
 *   3. `onVoided` is called, and the view submits.
 *
 * Two and three in that order matters: submitting first would race the flush,
 * and app 20 computes the verdict from what has actually landed - so a paper
 * submitted before its fifth breach reached the store would be scored on four
 * and pass. Flushing first closes that, and it is why `endSitting` is async and
 * why the view awaits it.
 *
 * AND THE THIRD WAY A SITTING ENDS, WHICH IS THE ONE THAT WAS MISSING
 *
 * `finish` ends a paper and `endSitting` voids one. A LAB had neither: nothing
 * anywhere said a lab was over, so a student who completed every task and left
 * the workspace open went on being charged for every switch to their editor,
 * for as long as the tab lived, on a record anybody can read. `complete` is
 * that third ending - it records the sitting's terminal action, stops the
 * monitor and posts what is left.
 *
 * It is idempotent and it is deliberately reachable more than once: a lab is
 * graded again every time Check my work is pressed, and every one of those
 * presses after the first reports the same completed grade.
 */

import { computed, onBeforeUnmount, ref, shallowRef } from 'vue';
import type { MeterEvent } from '@/components/practice/IntegrityMeter.vue';
import { PracticeRecorder } from '@/services/practice.service';
import {
    TERMINAL_ACTIONS,
    labelOf,
    pointsOf,
    severityOf,
    verdictFor,
    type PracticeContext,
    type Verdict,
} from '@/utils/practiceIntegrity';
import { startPracticeMonitor, type PracticeMonitor } from '@/utils/practiceMonitor';

export interface SittingOptions {
    context: PracticeContext;
    /**
     * Called once, when the sitting has been voided AND the ledger has landed.
     *
     * The view's job from here is to submit; this composable does not know how
     * to. Passing the submit in rather than calling a service is what keeps the
     * exam's four-step submission and the quiz's one-step one out of here.
     */
    onVoided?: () => void | Promise<void>;
    /** Which detectors to run. Assessment defaults; a lab narrows it. */
    watch?: Parameters<typeof startPracticeMonitor>[0]['watch'];
    /**
     * The action to record when the sitting is TORN DOWN unfinished.
     *
     * Opt in, and only the two speaking rooms use it: `interview.left_early`
     * and `meeting.left_early`. A lab and a paper leave nothing out by having
     * no such action - an abandoned paper is a paper with no submission, which
     * the absence of `assessment.submitted` already records.
     *
     * IT IS NOTED HERE AND NOT IN THE VIEW'S LEAVE HANDLER, which is the whole
     * reason it is an option rather than a `note()` call at a call site. There
     * are three ways out of one of these rooms - the Leave button, a router
     * navigation, and closing the tab - and only ONE of them runs a handler
     * the view controls. Every one of the three tears the component down, so
     * the unmount is the single place that sees all three; and it has to be
     * noted from here rather than from a hook the view registers afterwards,
     * because Vue runs `onBeforeUnmount` in registration order and this
     * composable's own hook - the one that FLUSHES the queue - is registered
     * first. A note added after it would be queued and never posted.
     */
    abandonedAs?: string;
}

export function usePracticeSitting(options: SittingOptions) {
    const context = options.context;

    const recorder = shallowRef<PracticeRecorder | null>(null);
    const monitor = shallowRef<PracticeMonitor | null>(null);
    /** What the meter lists. Newest first, and capped - see `MAX_LOG`. */
    const log = ref<MeterEvent[]>([]);
    /** The recorder's verdict, mirrored into a ref so the template follows it. */
    const verdict = ref<Verdict>(verdictFor([], context));
    const running = ref(false);
    const voided = ref(false);
    /** Ended because the work was finished, rather than because it was void. */
    const completed = ref(false);

    /**
     * How many log lines are kept in memory.
     *
     * The panel shows six; this is the bound on what is held. A sitting that
     * somehow produced hundreds would otherwise grow an array nobody reads,
     * and the full record is on the service either way - which is the copy that
     * matters, because this one dies with the tab.
     */
    const MAX_LOG = 60;

    function refresh() {
        const answer = recorder.value?.verdict();
        if (answer) verdict.value = answer;
    }

    /**
     * Begin. Idempotent, because a view can reach this from two places.
     *
     * `TakeQuiz.vue` calls it from the Start button and `TakeExam.vue` from the
     * rules gate, and both can be reached twice - a double click, a re-render
     * of a `v-if`. Two recorders would be two session ids and a verdict
     * computed over half the sitting each.
     */
    function begin(subject: { id: string; name?: string },
                   who: { userId: string; username?: string }) {
        if (running.value || !who.userId || !subject.id) return;
        running.value = true;
        voided.value = false;
        completed.value = false;

        recorder.value = new PracticeRecorder({
            context,
            subjectId: subject.id,
            subjectName: subject.name,
            userId: who.userId,
            username: who.username,
            onVerdict: () => refresh(),
        });

        monitor.value = startPracticeMonitor({
            context,
            active: () => running.value && !voided.value,
            watch: options.watch,
            onAction: action => {
                recorder.value?.record(action.action, action.detail, action.at);
                log.value = [{
                    id: `${action.action}:${action.at}:${log.value.length}`,
                    label: labelOf(action.action),
                    // PRICED IN THIS CONTEXT. Without the argument the meter
                    // shows a lab a switched window at -4 while the ledger
                    // charges -1, and the student is left to work out which
                    // of the two numbers is the real one.
                    points: pointsOf(action.action, context),
                    severity: severityOf(action.action),
                    at: action.at,
                }, ...log.value].slice(0, MAX_LOG);
                refresh();
                // The check happens on EVERY action rather than only on a
                // negative, because `verdictFor` is what decides and reading
                // the answer is cheaper than deciding which actions could have
                // changed it.
                if (verdict.value.failed && !voided.value) void endSitting();
            },
        });
    }

    /**
     * Record something the DOM cannot see: a tick, a tutor ask, a submission.
     *
     * Goes through the monitor rather than straight to the recorder, so a
     * NEGATIVE noted by a caller in a loop is still throttled. See
     * `PracticeMonitor.note`.
     */
    function note(action: string, detail?: string) {
        if (!running.value) return;
        monitor.value?.note(action, detail);
    }

    /**
     * End the sitting because the limit was reached.
     *
     * Called from the action handler and safe to call twice; the second call
     * returns immediately, which matters because a burst of breaches can carry
     * the count past the limit before the first flush answers.
     */
    async function endSitting() {
        if (voided.value) return;
        voided.value = true;
        monitor.value?.stop();
        // Settle against the SERVICE before the view submits. App 20 scores the
        // paper from the events that have landed, so submitting first would race
        // the flush and a paper could be scored on four breaches and pass.
        await recorder.value?.settle();
        refresh();
        await options.onVoided?.();
    }

    /**
     * Finish normally: award what was earned, then post the lot.
     *
     * The awards are recorded HERE rather than by the caller because all three
     * are conditions on the sitting as a whole, and the caller would have to
     * re-derive "was it clean" from a verdict it has already been handed.
     */
    /**
     * End the sitting because the work is DONE.
     *
     * For a lab, which has no submission and cannot be voided. Records the
     * terminal action, which is what stops everything downstream scoring:
     * `PracticeRecorder.record` drops a later breach before it is queued, app
     * 20 refuses one with `SittingClosed`, and `verdictFor` and
     * `applyConductCaps` both ignore anything already stored past that point.
     *
     * The monitor is stopped as well rather than instead. Stopping it alone
     * would leave the sitting open on the service, so a second tab - or the
     * same student coming back tomorrow to the same lab - would carry on
     * accumulating against it.
     */
    async function complete() {
        if (!running.value || completed.value || voided.value) return verdict.value;
        completed.value = true;
        note(TERMINAL_ACTIONS[context]);
        running.value = false;
        monitor.value?.stop();
        await recorder.value?.close();
        refresh();
        return verdict.value;
    }

    async function finish(opts: { allAnswered?: boolean } = {}) {
        if (!running.value) return verdict.value;
        if (!voided.value) {
            if (opts.allAnswered) note('assessment.all_answered');
            // "Clean" is zero breaches, not "under the limit". A sitting with
            // four recorded breaches is not a clean sitting and paying for one
            // would make the award meaningless - the cap that would then matter
            // is the strike limit, which is not what this rewards.
            if (verdict.value.negatives === 0) note('assessment.clean_sitting');
            note('assessment.submitted');
        }
        running.value = false;
        monitor.value?.stop();
        await recorder.value?.close();
        refresh();
        return verdict.value;
    }

    onBeforeUnmount(() => {
        /*
          WALKING OUT, recorded before anything is stopped.

          `running` is only still true when the sitting was neither finished
          nor voided nor completed - i.e. the person left partway - so this
          cannot fire on an interview that ended properly, and it cannot fire
          twice (`MIN_GAP_MS` declares a minute for both, because a second
          note inside one sitting is always a teardown path that ran twice and
          never a second departure).

          Before `monitor.stop()`, because `note` goes through the monitor and
          a stopped monitor records nothing.
        */
        if (running.value && !voided.value && !completed.value
            && options.abandonedAs) {
            note(options.abandonedAs);
        }
        monitor.value?.stop();
        running.value = false;
        /*
          A LAST FLUSH ON THE WAY OUT, not awaited.

          A candidate who closes the tab mid-paper leaves whatever is queued
          unposted, and the queue is where the breaches are. `close()` posts it;
          nothing can wait for the answer because the component is going away,
          so this is best effort - and it is better than the alternative, which
          is losing the last few seconds of every abandoned sitting.
        */
        void recorder.value?.close();
    });

    return {
        /** Null until `begin`. The result payload carries it. */
        sessionId: computed(() => recorder.value?.sessionId ?? ''),
        verdict: computed(() => verdict.value),
        log: computed(() => log.value as readonly MeterEvent[]),
        running: computed(() => running.value),
        voided: computed(() => voided.value),
        completed: computed(() => completed.value),
        begin,
        note,
        finish,
        complete,
        endSitting,
        /** For a caller that wants the settled server verdict before submitting. */
        settle: async () => {
            await recorder.value?.settle();
            refresh();
            return verdict.value;
        },
    };
}
