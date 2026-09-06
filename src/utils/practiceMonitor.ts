/**
 * The half that watches. Attaches the listeners, decides nothing.
 *
 * Every judgement — what an action is worth, whether it is a strike, whether it
 * is too soon after the last one — is `practiceIntegrity.ts`'s, which is a plain
 * module with a check over it. This file is the DOM: listeners, timers,
 * teardown, and the two heuristics that cannot be expressed without a window.
 *
 * WHAT CAN AND CANNOT BE DETECTED, HONESTLY
 *
 * A browser will not tell a page that Alt+Tab happened. What it will tell it is
 * that focus was lost, that the document became hidden, that a copy was made,
 * and — with `keydown` — that Alt and Tab were pressed together, which most
 * browsers deliver before the switch takes effect. So:
 *
 *  * **`window.alt_tab`** is the keystroke, caught on `keydown`. It is the
 *    strongest signal here and it is also the least reliable: a window manager
 *    that swallows the key never fires it.
 *  * **`window.left`** is `blur` or `visibilitychange`, which is what an Alt+Tab
 *    leaves behind — and also what clicking another window, opening a
 *    notification or a screenshot tool leaves behind. It is deliberately the
 *    catch-all, and `shouldRecord` absorbs it for a moment after an Alt+Tab so
 *    one action is one strike (see `ALT_TAB_ABSORB_MS`).
 *  * **`devtools.opened`** is a HEURISTIC and is treated as one: the gap
 *    between the window's outer and inner size, which a docked panel widens. It
 *    has false positives — a zoomed page, a browser sidebar — so it is throttled
 *    to one strike per half minute and it is not the whole five on its own.
 *
 * The one thing this file must never do is record the CONTENT of anything. A
 * copy is recorded as a character count (`describeCopy`), because the ledger is
 * published and the copied text during an exam is the exam paper.
 *
 * WHAT "STAYED ON TASK" HAS TO MEAN
 *
 * The focus award used to be five minutes in which the tab merely held focus,
 * and that paid a student who opened a lab and walked away: twelve awards for
 * an empty room, which was a quarter of what passing an exam is worth. It now
 * requires at least one GENUINE interaction inside the window - a keystroke, a
 * pointer press, a scroll, a touch. Presence is not work, and a scoring system
 * that cannot tell the difference is one people learn to leave running.
 *
 * The listeners are passive and capture-phase, so nothing here can interfere
 * with a page that is also handling those events, and they set a boolean rather
 * than doing anything per event - a lab console produces a keystroke per
 * character typed.
 *
 * WHY THE NEGATIVES FLUSH IMMEDIATELY AND THE REST DO NOT
 *
 * A positive award can wait: nothing on screen depends on it landing this
 * second. A breach cannot, because the count is what ends the sitting, and a
 * candidate who alt-tabs five times in four seconds must not be able to submit
 * in between. So a breach schedules a flush on a short debounce (long enough to
 * coalesce a burst into one request, short enough to be over before anybody can
 * click Submit) and everything else rides along with it or with the periodic
 * flush.
 */

import {
    FOCUS_AWARD_MS,
    commitThrottle,
    describeCopy,
    isNegative,
    newThrottle,
    sanitiseDetail,
    shouldRecord,
    type PracticeContext,
    type ThrottleState,
} from './practiceIntegrity';

export interface MonitorAction {
    action: string;
    detail?: string;
    at: number;
}

export interface MonitorOptions {
    context: PracticeContext;
    /** Called for every action that survives the throttle. */
    onAction: (action: MonitorAction) => void;
    /**
     * Whether the monitor should be watching at all.
     *
     * A function rather than a boolean, read at each event: a paper that has
     * been submitted must stop collecting strikes, and the alternative is the
     * caller remembering to call `stop()` on every one of the four paths that
     * end a sitting.
     */
    active?: () => boolean;
    /** Which detectors to run. `devtools` and `print` are assessment-only. */
    watch?: {
        window?: boolean;
        clipboard?: boolean;
        devtools?: boolean;
        print?: boolean;
        fullscreen?: boolean;
        focusAward?: boolean;
    };
}

export interface PracticeMonitor {
    /** Detach every listener and stop every timer. Idempotent. */
    stop(): void;
    /** Record something the caller noticed rather than the DOM. */
    note(action: string, detail?: string): void;
    /** For a caller that wants to reset the focus clock — e.g. after a reset. */
    resetFocus(): void;
}

const DEFAULT_WATCH = {
    window: true, clipboard: true, devtools: true, print: true,
    fullscreen: true, focusAward: true,
};

/**
 * How much the outer/inner gap has to grow before it reads as a docked panel.
 *
 * Generous. A narrow threshold catches a browser sidebar, a zoom change and a
 * bookmarks bar appearing; the cost of a false positive here is a strike
 * against somebody who did nothing, and there are only five.
 */
const DEVTOOLS_THRESHOLD = 170;

export function startPracticeMonitor(options: MonitorOptions): PracticeMonitor {
    const watch = { ...DEFAULT_WATCH, ...(options.watch || {}) };
    const throttle: ThrottleState = newThrottle();
    const cleanups: Array<() => void> = [];
    let stopped = false;
    let focusSince = Date.now();
    /**
     * Whether anything has actually been DONE since the clock last restarted.
     *
     * The whole of the evidence rule. Set by a real interaction and cleared
     * every time an award is paid or the clock restarts, so each five minutes
     * has to be earned on its own rather than on the strength of one keystroke
     * an hour ago.
     */
    let worked = false;

    const isActive = () => !stopped && (options.active ? options.active() : true);

    function record(action: string, detail?: string) {
        if (!isActive()) return;
        const now = Date.now();
        if (!shouldRecord(throttle, action, now)) return;
        commitThrottle(throttle, action, now);
        options.onAction({
            action,
            detail: detail === undefined ? undefined : sanitiseDetail(detail),
            at: now,
        });
    }

    /* ---------------- leaving the window ---------------- */
    if (watch.window && typeof window !== 'undefined') {
        const onBlur = () => {
            // The focus clock restarts whichever way attention was lost, so a
            // candidate cannot bank a five-minute award by leaving the window
            // for four of them - and the EVIDENCE goes with it, or a keystroke
            // from before the departure would pay for the stretch after it.
            focusSince = Date.now();
            worked = false;
            record('window.left');
        };
        const onHidden = () => {
            if (typeof document !== 'undefined' && document.hidden) onBlur();
        };
        const onKeyDown = (event: KeyboardEvent) => {
            // `altKey && key === 'Tab'` is the switch itself. Most browsers
            // deliver it before the window manager takes over; the ones that do
            // not leave the blur above to catch it.
            if (event.altKey && (event.key === 'Tab' || event.code === 'Tab')) {
                focusSince = Date.now();
                worked = false;
                record('window.alt_tab');
            }
            // Ctrl/Cmd+P is a print, and it is a keystroke rather than a
            // `beforeprint` on several browsers when the dialog is refused.
            if (watch.print && (event.ctrlKey || event.metaKey)
                && String(event.key).toLowerCase() === 'p') {
                record('print.attempt');
            }
            // F12 and Ctrl/Cmd+Shift+I/J/C are the developer tools. Caught as
            // keystrokes as well as by the geometry heuristic, because the
            // geometry says nothing about an undocked window.
            if (watch.devtools) {
                const key = String(event.key).toLowerCase();
                const combo = (event.ctrlKey || event.metaKey) && event.shiftKey
                    && ['i', 'j', 'c'].includes(key);
                if (key === 'f12' || combo) record('devtools.opened');
            }
        };
        window.addEventListener('blur', onBlur);
        window.addEventListener('keydown', onKeyDown, true);
        document.addEventListener('visibilitychange', onHidden);
        cleanups.push(() => {
            window.removeEventListener('blur', onBlur);
            window.removeEventListener('keydown', onKeyDown, true);
            document.removeEventListener('visibilitychange', onHidden);
        });
    }

    /* ---------------- the clipboard ---------------- */
    if (watch.clipboard && typeof document !== 'undefined') {
        const onCopy = (event: ClipboardEvent) => {
            /*
              HOW MUCH, NEVER WHAT.

              `describeCopy` returns a character count. The selection during an
              exam is a question and its options, and app 20 ships `is_correct`
              inside the exam payload — so a detail carrying the text would put
              the paper, with its answer key, onto a page that needs no account.
            */
            const selection = typeof window !== 'undefined'
                ? String(window.getSelection?.() ?? '') : '';
            record('clipboard.copy', describeCopy(selection));
        };
        const onCut = onCopy;
        const onPaste = (event: ClipboardEvent) => {
            const text = event.clipboardData?.getData('text') ?? '';
            record('clipboard.paste', describeCopy(text));
        };
        document.addEventListener('copy', onCopy);
        document.addEventListener('cut', onCut);
        document.addEventListener('paste', onPaste);
        cleanups.push(() => {
            document.removeEventListener('copy', onCopy);
            document.removeEventListener('cut', onCut);
            document.removeEventListener('paste', onPaste);
        });
    }

    /* ---------------- printing ---------------- */
    if (watch.print && typeof window !== 'undefined') {
        const onBeforePrint = () => record('print.attempt');
        window.addEventListener('beforeprint', onBeforePrint);
        cleanups.push(() => window.removeEventListener('beforeprint', onBeforePrint));
    }

    /* ---------------- full screen ---------------- */
    if (watch.fullscreen && typeof document !== 'undefined') {
        let wasFullscreen = !!document.fullscreenElement;
        const onFullscreen = () => {
            const now = !!document.fullscreenElement;
            // An EDGE, not a state. Recording on every event would fire on
            // entering full screen as well as on leaving it, which is a strike
            // for doing the thing the rules ask for.
            if (wasFullscreen && !now) record('fullscreen.exited');
            wasFullscreen = now;
        };
        document.addEventListener('fullscreenchange', onFullscreen);
        cleanups.push(() =>
            document.removeEventListener('fullscreenchange', onFullscreen));
    }

    /* ---------------- the developer tools heuristic ---------------- */
    if (watch.devtools && typeof window !== 'undefined') {
        const timer = window.setInterval(() => {
            if (!isActive()) return;
            const wide = window.outerWidth - window.innerWidth > DEVTOOLS_THRESHOLD;
            const tall = window.outerHeight - window.innerHeight > DEVTOOLS_THRESHOLD;
            if (wide || tall) record('devtools.opened');
        }, 2000);
        cleanups.push(() => window.clearInterval(timer));
    }

    /* ---------------- staying on task ---------------- */
    if (watch.focusAward && typeof window !== 'undefined') {
        /*
          EVIDENCE, not presence.

          Passive and capture-phase: passive so a page that scrolls is never
          made to wait on this, capture so a handler that stops propagation
          cannot make the student's own work invisible to the award. Each one
          sets a boolean and nothing else - a lab console fires a keydown per
          character typed, and anything heavier here would be paid for on every
          keystroke of every session.
        */
        const marker = () => { worked = true; };
        const evidence = ['keydown', 'pointerdown', 'wheel', 'touchstart'];
        for (const name of evidence) {
            window.addEventListener(name, marker, { passive: true, capture: true });
        }
        cleanups.push(() => {
            for (const name of evidence) {
                window.removeEventListener(name, marker, { capture: true } as any);
            }
        });

        const timer = window.setInterval(() => {
            if (!isActive()) return;
            if (typeof document !== 'undefined' && document.hidden) return;
            if (!document.hasFocus?.()) return;
            const now = Date.now();
            if (now - focusSince < FOCUS_AWARD_MS) return;
            /*
              THE CLOCK RESTARTS EITHER WAY.

              An idle five minutes buys nothing and also does not accumulate
              towards the next award, or somebody who worked for thirty seconds
              after an hour away would be paid for the hour. What it does not do
              is punish: no award is not a penalty, and a lab is a place to sit
              and read the brief.
            */
            focusSince = now;
            if (!worked) return;
            worked = false;
            // The cap is the server's: it refuses the ninth and the client
            // simply stops earning. Enforcing it here as well would be a second
            // copy of a number that is already checked.
            options.onAction({ action: 'focus.sustained', at: now });
        }, 15000);
        cleanups.push(() => window.clearInterval(timer));
    }

    return {
        stop() {
            if (stopped) return;
            stopped = true;
            for (const cleanup of cleanups) {
                try { cleanup(); } catch { /* a detach that throws is not worth reporting */ }
            }
            cleanups.length = 0;
        },
        note(action: string, detail?: string) {
            // Deliberately bypasses the throttle for a NEUTRAL or POSITIVE
            // action the caller has already decided about — `lab.checked` and
            // `lab.ai_asked` are one press each and the caller knows it. A
            // negative still goes through the throttle, because the caller may
            // be a loop.
            if (isNegative(action)) record(action, detail);
            else if (isActive()) {
                options.onAction({
                    action,
                    detail: detail === undefined ? undefined : sanitiseDetail(detail),
                    at: Date.now(),
                });
            }
        },
        resetFocus() {
            focusSince = Date.now();
            worked = false;
        },
    };
}
