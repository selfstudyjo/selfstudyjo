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
import { onBeforeUnmount, ref, type Ref } from 'vue';

const LOCK_CLASS = 'sfs-fs-lock';

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
            // The browser left full screen (Escape, F11, a system gesture).
            native.value = false;
            active.value = false;
        } else if (mine) {
            native.value = true;
            active.value = true;
        }
    }

    function onKey(event: KeyboardEvent) {
        if (event.key === 'Escape' && active.value && !native.value) {
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
                return;
            } catch {
                /* Refused (iframe policy, no gesture): use the overlay instead. */
            }
        }
        native.value = false;
        active.value = true;
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
