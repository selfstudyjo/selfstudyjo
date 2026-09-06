/**
 * Whether Noor's window is open, shared by every button that can open it.
 *
 * A MODULE-LEVEL ref rather than a prop, for exactly the reason `useTour` is
 * one: the button lives in the top bar, and the top bar is hidden on
 * `/lab/:labId` (`meta.hideTopBar`) because that page has its own workbench.
 * So the assistant needs a second button in the lab's own header, and two
 * buttons must drive ONE window — a second `<AssistantDock>` would be two
 * transcripts, two microphones and two voices talking over each other.
 *
 * Deliberately NOT a Pinia store: it is one boolean about what is on screen
 * right now. And deliberately NOT persisted — a window that reopened itself
 * after a reload, with a microphone in it, is a window that starts listening to
 * somebody who had gone to make tea.
 *
 * The TRANSCRIPT is not here either. It lives in the dock, so closing the
 * window ends the conversation: a question asked an hour ago on another page is
 * context that makes the next answer worse, and a reader who reopens her
 * expects to start again. That is the opposite call from `/ai-chat`, which is a
 * saved room per project — the two are different products and the difference is
 * whether the conversation is worth keeping.
 */

import { ref } from 'vue';

// The SMALL module. This composable is reached from the always-loaded button,
// so importing the engine here would put all 35 kB of it in the entry chunk.
import {
    CAST_STORAGE_KEY, DEFAULT_ASSISTANT, castAssistant, type Assistant,
} from '@/utils/assistantCast';

const open = ref(false);

/**
 * WHO IS ON DUTY THIS VISIT — resolved once, when this module loads.
 *
 * There are two assistants and they alternate: whoever greeted you last time,
 * the other one greets you now. Three decisions in that, and each has a
 * cheaper-looking alternative that is worse:
 *
 *  * **Resolved at LOAD, not on first open**, because the button in the top bar
 *    names them — "Ask Omar, the site assistant" — and it is on every page
 *    whether or not anybody opens the window. A cast made on first open would
 *    leave that button with nobody to name until somebody pressed it.
 *  * **Once per page load, not per open.** The window unmounts when it closes,
 *    so casting on mount would swap the assistant under a reader who shut it
 *    and opened it again — mid-visit, mid-conversation-in-their-head. One
 *    tab, one assistant.
 *  * **Persisted, not random.** Random gives the same assistant three visits
 *    running about a quarter of the time, which reads as one assistant with an
 *    occasional stand-in rather than as a pair.
 *
 * The decision itself is `castAssistant` in the engine, where `check:assistant`
 * can drive it; what is here is the storage, which is the part that cannot be.
 */
function resolveCast(): Assistant {
    try {
        const previous = window.localStorage.getItem(CAST_STORAGE_KEY);
        const next = castAssistant(previous);
        window.localStorage.setItem(CAST_STORAGE_KEY, next.id);
        return next;
    } catch {
        // Safari in private mode throws on `localStorage`, and a browser that
        // cannot remember who was last on duty should still have somebody on
        // duty. It stops alternating, which is a nicety; it does not stop
        // working, which is not.
        return DEFAULT_ASSISTANT;
    }
}

const cast = ref<Assistant>(resolveCast());

export function useAssistant() {
    return {
        open,
        /** Whoever is on duty this visit. Read by the button AND the window. */
        cast,
        start: () => { open.value = true; },
        stop: () => { open.value = false; },
        toggle: () => { open.value = !open.value; },
    };
}
