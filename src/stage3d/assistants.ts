/**
 * The two site assistants, as data — and nothing else in this file.
 *
 * ============================================================
 * WHY THIS IS NOT IN `figures.ts` WITH THE OTHER EIGHT
 * ============================================================
 *
 * Because of what imports it. `assistantEngine.ts` derives the pair from this
 * table so a name on a plate, the gender that casts the voice and the face
 * being rendered cannot disagree — and the engine is reached from
 * `useAssistant`, which is reached from the BUTTON, which is in the top bar of
 * every page. So whatever this module drags in is downloaded by a visitor
 * reading the login page.
 *
 * `figures.ts` is 48 kB of source: the whole cast, plus the movement model —
 * `jawOpen`, `blink`, `breath`, the saccades, the two-link IK, the reach
 * solver. Importing it for two names and two genders put all of it in the entry
 * chunk and cost **7.8 kB gzip** against HEAD, measured, where the same feature
 * had cost 2.9 the commit before. None of that arithmetic is needed to draw a
 * button (working rule 47).
 *
 * So the DATA lives here, where it is a few hundred bytes, and `figures.ts`
 * imports and re-exports it — which is what keeps `figureById`, `isFigureId`
 * and `check:actors`'s whole-cast sweep working with no special case. The
 * renderer still resolves an assistant exactly as it resolves an anchor.
 *
 * The type is imported `type`-only and therefore erased at build, so this file
 * pulls nothing at runtime.
 */

import type { FigureSpec } from './figures';

/**
 * The pair, and the pair is deliberately one of each.
 *
 * A reader who comes back tomorrow is greeted by the other one, which is the
 * difference between a product with people in it and a product with a mascot.
 * It also means the male voice path is exercised by half of all sessions rather
 * than by nobody: app 36's fallback speech provider has one voice per language
 * and it is female in all three, so Omar is reshaped into a male register by
 * `voiceShaper.ts` on any machine with no device voice for the reader's
 * language — exactly as the newscast's Adam is, and measured the same way.
 * Casting only a woman would have left that whole route unrun until somebody
 * noticed it had rotted.
 *
 * They are NOT meeting seats. `ACTORS` in `cast/actors.ts` derives the six from
 * `FIGURES` by id, so anybody added there is somebody the Toastmasters grid
 * would start seating and the interview room would start casting; these two
 * answer questions about the platform, everywhere, including on the login page.
 *
 * `phase` 0.3 and 2.7 CONTINUE THE SPREAD rather than the arithmetic sequence.
 * The other eight sit on a 0.6 grid, which fills the 4.6-second breath cycle
 * almost exactly, so the next number in the series — 4.8 — is 0.2 from Marcus's
 * 0 ONCE TAKEN MODULO THE CYCLE, and 0.2 is what `check:actors` calls clustered.
 * That is not hypothetical: 4.8 shipped, and it passed both checks, because the
 * cast sweep did not include this table and the assistant's own check measured
 * raw gaps rather than gaps modulo the cycle. Two checks looking at the wrong
 * thing agreed with each other. These sit at the midpoints of two of the
 * existing gaps, which is the only room left.
 */
export const ASSISTANT_FIGURES: readonly FigureSpec[] = [
    {
        id: 'noor', name: 'Noor', gender: 'female',
        skin: '#d9a87e', hair: '#2a1b14', hairStyle: 'bun', eye: '#42291b',
        // Not a suit. A guide rather than an interviewer or an anchor, and the
        // teal reads as help-desk where the meeting's plums and the newscast's
        // crimson read as an occasion somebody has dressed for.
        outfit: { jacket: '#1f4d54', shirt: '#f4fbfb', accent: '#4fb3a7' },
        build: 0.32, height: 1.69, phase: 0.3,
    },
    {
        id: 'omar', name: 'Omar', gender: 'male',
        skin: '#a9764c', hair: '#171009', hairStyle: 'crop', eye: '#3a2416',
        // The same teal family, a shade deeper: they are the same role on
        // different days, and two assistants in unrelated colours would read as
        // two features rather than as one with two faces.
        outfit: { jacket: '#1a3f4a', shirt: '#f2f9fa', accent: '#4fb3a7' },
        build: 0.6, height: 1.79, phase: 2.7,
    },
];

/**
 * The first of them, for the callers that want one figure rather than the pair.
 */
export const ASSISTANT_FIGURE: FigureSpec = ASSISTANT_FIGURES[0]!;
