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

const open = ref(false);

export function useAssistant() {
    return {
        open,
        start: () => { open.value = true; },
        stop: () => { open.value = false; },
        toggle: () => { open.value = !open.value; },
    };
}
