/**
 * Which of the two assistants is on duty, and the copy that names them.
 *
 * ============================================================
 * WHY THIS IS NOT IN `assistantEngine.ts`
 * ============================================================
 *
 * Because of what imports it. The BUTTON is in the top bar of every page and
 * names whoever is on duty — "Ask Omar, the site assistant" — so it needs the
 * cast and one string, and nothing else. The engine is ~35 kB of site map,
 * prompt builder, reply parser, snapshot summariser and refusal table, and the
 * button needs none of it.
 *
 * Left in the engine this cost **5 kB gzip on the entry chunk**, measured
 * against HEAD: the whole engine moved out of the lazily-loaded window and into
 * the bundle every route downloads, including the login page. That is working
 * rule 47 exactly, and it is worth a third file.
 *
 * `assistantEngine.ts` re-exports everything here, so the window and
 * `check:assistant` have one import site and nothing else moved.
 */

import { ASSISTANT_FIGURES } from '@/stage3d/assistants';
import type { Gender } from '@/stage3d/figures';

export interface Assistant {
    /** Also the figure id in `stage3d/figures.ts`, and the localStorage value. */
    id: string;
    /**
     * The English name, which is ALSO a catalogue key.
     *
     * Rendered as `$t(cast.name)`, so an Arabic reader is greeted by نور and a
     * Chinese one by 努尔. The newscast already transliterates its own two
     * anchors on their plates, and this is the same decision: working rule 41
     * refuses to translate a PERSON's name because that is putting words in
     * somebody's mouth, and these are the platform's own characters rather than
     * anybody's account.
     */
    name: string;
    gender: Gender;
}

/**
 * The two of them, DERIVED from the figure table rather than restated.
 *
 * A name on a plate, the gender that casts the voice and the face being
 * rendered are three views of one person, and a second copy here is one that
 * agrees with the pictures only by coincidence. That is exactly the argument
 * `cast/actors.ts` makes about the meeting seats.
 */
export const ASSISTANTS: readonly Assistant[] = ASSISTANT_FIGURES.map(figure => ({
    id: figure.id,
    name: figure.name,
    gender: figure.gender,
}));

/** Where the last cast is remembered, so the next visit gets the other one. */
export const CAST_STORAGE_KEY = 'sfs-assistant-cast';

/**
 * Whose turn it is.
 *
 * ALTERNATING rather than random, and persisted rather than per-tab, because
 * those are different products: random gives a reader the same assistant three
 * visits running about a quarter of the time, which reads as "there is one
 * assistant and occasionally a different one" rather than as a pair. Given the
 * previous id it returns the NEXT one; given nothing, or something it does not
 * recognise, it returns the first.
 *
 * Unrecognised falls back rather than throwing on purpose: the value comes out
 * of `localStorage`, which anything on this origin can write, and an assistant
 * that refused to appear because a string was wrong would be a window that does
 * not open.
 */
export function castAssistant(previousId?: string | null): Assistant {
    const index = ASSISTANTS.findIndex(a => a.id === previousId);
    if (index < 0) return ASSISTANTS[0]!;
    return ASSISTANTS[(index + 1) % ASSISTANTS.length]!;
}

/**
 * The seat number a voice is cast against — see `castVoice` in
 * `cast/actors.ts`.
 *
 * `planSpeech` casts a DIFFERENT device voice per seat, so one seat for both
 * would give Noor and Omar the same voice on any machine that has two — the
 * "both anchors are the same woman" failure, one product along.
 */
export function seatOf(assistant: Assistant): number {
    const index = ASSISTANTS.findIndex(a => a.id === assistant.id);
    return index < 0 ? 0 : index;
}

/** The first of them. What a caller uses before a cast has been made. */
export const DEFAULT_ASSISTANT: Assistant = ASSISTANTS[0]!;

/**
 * The three places outside the transcript that name the assistant.
 *
 * Constants rather than literals in a template because they take a `{bot}`
 * parameter, and a `$t()` call whose key is built by concatenation or
 * interpolation is one every scanner reads wrongly — the coverage report sees a
 * fragment, the orphan pass reports the whole thing missing, and the catalogue
 * ends up keyed on something the runtime never asks for.
 *
 * `BUTTON_LABEL` is here rather than with the rest of the copy for the reason
 * at the top of this file: it is the one string the always-loaded button needs.
 */
export const BUTTON_LABEL = 'Ask {bot}, the site assistant';
export const THINKING_LABEL = '{bot} is thinking';
export const MIC_LABEL = 'Talk to {bot}';
