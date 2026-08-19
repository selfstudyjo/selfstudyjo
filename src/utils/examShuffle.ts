// src/utils/examShuffle.ts
//
// The order a question's answers are shown in.
//
// **Why this exists.** Measured against the live exam data on 2026-08-19: of 89
// questions across the three published exams, **70 had the correct answer at
// index 0** — 79%. A candidate who picked the first option every time scored 79%,
// against a 70% pass mark. The exams were passable without reading them.
//
// **A plain module** — no Vue, no Pinia — for the same reason `proctorQueue.ts`,
// `appNav.ts`, `photoMask.ts`, `drawEngine.ts` and `linkify.ts` are:
// `npm run check:examshuffle` runs it through node in about a second, and the
// properties that matter here are exactly the ones that fail silently.
//
// **The order is DETERMINISTIC, and that is the whole design.** A
// `Math.random()` shuffle would be a disaster in this component rather than a
// nicety, because the order is read inside a computed that recomputes on every
// selection, every timer tick and every re-render:
//
//   * the options would visibly reshuffle while the candidate was reading them;
//   * the option they had selected would appear to jump to a different row —
//     the selection is tracked by `external_id`, so it would still be the right
//     answer, and it would look like the page had changed their mind for them;
//   * and a reload mid-exam would produce a different paper from the one they
//     had partly answered.
//
// So the order is a pure function of `(seed, questionId)`. Same inputs, same
// permutation, for ever — across re-renders, navigation between questions, and a
// reload. Nothing is stored.
//
// **The seed is the candidate**, so two students sitting the same exam side by
// side cannot compare "it's the second one", and the order is fixed for that
// person - which is what lets the review screen reproduce it after submission.
// See `attemptSeed` at the bottom for why it is the user and not the appointment,
// and what that costs on a retake.
//
// **It cannot affect marking.** `calculateCorrectAnswers` in TakeExam.vue matches
// the selected answer by `external_id` and reads `is_correct` off the question,
// so the result is independent of display order. This module only decides what
// order they are painted in.
//
// **What this does NOT fix**, and it is worth being plain about: `is_correct`
// travels to the browser inside the exam payload, and marking happens in the
// browser. Shuffling removes the "always the first one" tell; it does not stop
// somebody reading the answers out of the network response. Closing that means
// app 20 withholding `is_correct` until a paper is submitted and marking server
// side — a real change to the exam service and its two clients, not a frontend
// one.

/** Only the fields the ordering needs. Keeps this module free of the service. */
export interface ShufflableAnswer {
    external_id: string;
}

/**
 * A 32-bit hash of a string. FNV-1a, chosen because it is short enough to read
 * and its output is well spread for the short, similar keys used here — an
 * appointment id plus a uuid differ in only a few characters, and a weaker mix
 * would give neighbouring questions near-identical seeds and therefore
 * near-identical permutations.
 */
function hash32(text: string): number {
    let h = 0x811c9dc5;
    for (let i = 0; i < text.length; i++) {
        h ^= text.charCodeAt(i);
        // The FNV prime, as shifts: `h * 16777619` overflows past 2^53 and loses
        // the low bits that carry the mixing.
        h = (h + (h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24)) >>> 0;
    }
    return h >>> 0;
}

/** mulberry32: one multiply-xor-shift round per number. Deterministic. */
function prng(seed: number): () => number {
    let a = seed >>> 0;
    return () => {
        a = (a + 0x6d2b79f5) >>> 0;
        let t = a;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

/**
 * The answers of one question, in a stable pseudo-random order.
 *
 * Never mutates the input: the array belongs to the exam record, which the
 * grading pass and the review screen also read.
 */
export function shuffleAnswers<T extends ShufflableAnswer>(
    answers: T[] | undefined | null,
    questionId: string,
    seed = '',
): T[] {
    const list = Array.isArray(answers) ? [...answers] : [];
    // Nothing to reorder, and no reason to burn a hash on it.
    if (list.length < 2) return list;

    const random = prng(hash32(`${seed}|${questionId}`));

    // Fisher-Yates, downward. The upward variant with `Math.floor(random() * n)`
    // is the classic off-by-one that never produces some permutations.
    for (let i = list.length - 1; i > 0; i--) {
        const j = Math.floor(random() * (i + 1));
        [list[i], list[j]] = [list[j], list[i]];
    }
    return list;
}

/**
 * The seed for one candidate.
 *
 * **The user id, not the appointment**, and the reason is the review screen.
 * `ReviewResults.vue` shows the same questions back after submission, and it
 * knows the result's `user_id` but has no appointment reference — an exam result
 * record does not carry one. Seeded on the appointment, the review would list the
 * options in a *different* order from the paper the candidate had just sat, so
 * the answer they remember choosing second would appear first. That is a
 * confusing thing to show somebody about their own exam, and it would also put
 * the stored order — correct answer first — back on screen.
 *
 * The cost is that a **retake shows the same order as the first attempt**. That is
 * a real but small loss: the review already tells the candidate which answer was
 * correct, so somebody re-sitting knows the answer *content*, not merely its
 * position, and per-attempt shuffling was never what stood between them and a
 * memorised paper. Consistency is what every candidate sees; retake-shuffling
 * would only matter to one who had not read their own results.
 *
 * `appointmentId` is still accepted and still preferred when no user id is
 * available, which keeps an anonymous or practice run per-attempt rather than
 * shared. An empty seed gives a stable order that is simply the same for
 * everybody — still far better than always-first.
 */
export function attemptSeed(userId?: string | null,
                            appointmentId?: string | null): string {
    return String(userId || appointmentId || '');
}
