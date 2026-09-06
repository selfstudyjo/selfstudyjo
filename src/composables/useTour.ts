/**
 * Whether the guided tour is running, shared by every button that can start it.
 *
 * A MODULE-LEVEL ref rather than a prop, and the reason is one route: the lab
 * workspace sets `meta.hideTopBar`, because it has its own workbench with the
 * same three tools in it and two consoles for one command is a student
 * wondering which one they are typing into. So the button that lives in the top
 * bar is not on the one page where a tour has the most to explain.
 *
 * The alternatives were both worse. A second `<TourGuide>` in the lab's own
 * header is two overlays racing to draw one caption; passing an `open` prop
 * down from the layout is a prop threaded through a component that has nothing
 * to do with tours. One ref, any number of buttons, exactly one overlay -
 * mounted in `DefaultLayout` where the top bar's absence cannot reach it.
 *
 * Deliberately NOT a Pinia store and deliberately NOT persisted. It is one
 * boolean about what is on screen right now; a tour that resumed itself after a
 * reload would start talking to somebody who had gone to make tea.
 */

import { ref } from 'vue';

const open = ref(false);

export function useTour() {
    return {
        open,
        start: () => { open.value = true; },
        stop: () => { open.value = false; },
        toggle: () => { open.value = !open.value; },
    };
}
