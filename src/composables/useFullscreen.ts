/**
 * Full screen for one element: the lab workbench, a product portal.
 *
 * TWO MECHANISMS, because one is not available everywhere:
 *
 * - **The Fullscreen API** (`element.requestFullscreen()`), which hides the
 *   browser's own chrome too. Desktop browsers and Android have it.
 * - **A fixed overlay** (`active` with `native === false`), which covers the
 *   page but not the browser bar. iPhone Safari has no element full screen at
 *   all - only video - and an embedded or permission-restricted page can refuse
 *   the API. Falling back to the overlay is what makes the button do something
 *   on every device rather than nothing on the ones students carry most.
 *
 * Exiting works the same three ways whichever mechanism was used: the toggle
 * button, an explicit exit/X button, and Escape. Escape already ends native full
 * screen (the browser does it); for the overlay it is wired here, because a
 * student who cannot find the way out of a full-window console has a broken
 * page.
 *
 * The overlay also locks the page behind it from scrolling (`sfs-fs-lock` on
 * <html>), or a wheel over the product scrolls the lab page underneath.
 */
import { computed, onBeforeUnmount, ref, shallowRef, type Ref } from 'vue';

const LOCK_CLASS = 'sfs-fs-lock';

/**
 * WHERE A DIALOG HAS TO BE TELEPORTED WHILE SOMETHING IS FULL SCREEN.
 *
 * With the native Fullscreen API ONLY the full-screen element's subtree is
 * painted - it sits in the browser's top layer and everything else on the page,
 * `<body>` included, is not drawn at all. So a dialog teleported to `<body>`
 * (every lab dialog is, to escape stacking contexts) opens perfectly, takes the
 * focus, and is INVISIBLE: the task "i" button looked dead in full screen for
 * exactly that reason. The overlay fallback has the same problem one way down -
 * the bench is `z-index: 2147483000` and a dialog at 2000 is painted under it.
 *
 * So every element this composable puts into full screen (either mechanism) is
 * registered here, innermost last - a portal can go full screen inside a
 * full-screen workbench - and `useTeleportTarget()` answers that element while
 * one is active and `'body'` otherwise. Vue's `<Teleport>` moves its children
 * when `to` changes, so a dialog that is OPEN when the student leaves full
 * screen follows them back to the page rather than vanishing with the element.
 *
 * A shallowRef of the elements: they are DOM nodes, never to be proxied.
 */
const hosts = shallowRef<HTMLElement[]>([]);

function addHost(element: HTMLElement) {
    if (!hosts.value.includes(element)) hosts.value = [...hosts.value, element];
}

function removeHost(element: HTMLElement | null | undefined) {
    if (element && hosts.value.includes(element)) {
        hosts.value = hosts.value.filter(row => row !== element);
    }
}

/** The innermost element currently full screen, or null. */
export const fullscreenHost = computed<HTMLElement | null>(() =>
    hosts.value[hosts.value.length - 1] || null);

/** The `to` of any `<Teleport>` that must stay visible in full screen. */
export function useTeleportTarget() {
    return computed<HTMLElement | string>(() => fullscreenHost.value || 'body');
}

export function useFullscreen(target: Ref<HTMLElement | null | undefined>) {
    const active = ref(false);
    const native = ref(false);

    function nativeElement(): Element | null {
        return typeof document === 'undefined' ? null : document.fullscreenElement;
    }

    function setLock(on: boolean) {
        if (typeof document === 'undefined') return;
        document.documentElement.classList.toggle(LOCK_CLASS, on);
    }

    function onNativeChange() {
        const mine = Boolean(target.value) && nativeElement() === target.value;
        if (native.value && !mine) {
            // The browser left full screen (Escape, F11, a system gesture) - or
            // handed it to a nested element (a portal inside this workbench), in
            // which case that element registers itself and this one stays out
            // of the host list until the browser gives full screen back.
            native.value = false;
            active.value = false;
            removeHost(target.value);
        } else if (mine) {
            native.value = true;
            active.value = true;
            if (target.value) addHost(target.value);
        }
    }

    function onKey(event: KeyboardEvent) {
        if (event.key === 'Escape' && active.value && !native.value) {
            /* A dialog open INSIDE the full-screen element (the task info
               window, the assistant - see `useTeleportTarget`) takes Escape
               for itself: one press closes the window the student is looking
               at, the next leaves full screen. Closing both at once would drop
               them out of the workbench for wanting to dismiss a popup.
               The TARGET is asked as well as the tree: a dialog that closes on
               its own keydown is already gone by the time this listener runs
               (Vue flushes between listeners), but the event still knows it
               started inside one. */
            const from = event.target as Element | null;
            if (event.defaultPrevented || from?.closest?.('[role="dialog"]')
                || target.value?.querySelector('[role="dialog"]')) return;
            event.preventDefault();
            exit();
        }
    }

    async function enter() {
        const element = target.value;
        if (!element || active.value) return;
        if (typeof element.requestFullscreen === 'function' && document.fullscreenEnabled) {
            try {
                await element.requestFullscreen({ navigationUI: 'hide' });
                native.value = true;
                active.value = true;
                addHost(element);
                return;
            } catch {
                /* Refused (iframe policy, no gesture): use the overlay instead. */
            }
        }
        native.value = false;
        active.value = true;
        addHost(element);
        setLock(true);
    }

    async function exit() {
        if (!active.value) return;
        if (native.value && nativeElement()) {
            try {
                await document.exitFullscreen();
            } catch {
                /* Already gone. */
            }
        }
        native.value = false;
        active.value = false;
        removeHost(target.value);
        setLock(false);
    }

    function toggle() {
        return active.value ? exit() : enter();
    }

    if (typeof document !== 'undefined') {
        document.addEventListener('fullscreenchange', onNativeChange);
        document.addEventListener('keydown', onKey);
    }

    onBeforeUnmount(() => {
        if (typeof document !== 'undefined') {
            document.removeEventListener('fullscreenchange', onNativeChange);
            document.removeEventListener('keydown', onKey);
        }
        if (active.value) void exit();
    });

    return { active, native, enter, exit, toggle };
}
