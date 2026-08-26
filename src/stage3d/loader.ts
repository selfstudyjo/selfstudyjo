/**
 * Getting the renderer, and deciding whether to try at all.
 *
 * Three jobs, and each of them is a thing that must not be done in a component:
 *
 *  1. **The import is dynamic, always.** Babylon is by far the largest thing
 *     this app ships. Three routes need it — the Newscast, the Toastmasters
 *     meeting and the Job Interview — and the other fifty-odd do not, so it is
 *     `await import()` behind this function and it becomes its own chunk. A
 *     static import anywhere would put the whole engine into the entry bundle
 *     and every reader would pay for it on the login page.
 *
 *  2. **WebGL is not guaranteed.** A locked-down corporate browser, a very old
 *     Android, a VM with no GPU passthrough, and Chrome after it has decided
 *     the page is using too many contexts all answer "no". The pages fall back
 *     to a flat card, which is the honest thing to show, and they can only do
 *     that if they are told BEFORE the import — hence {@link hasWebGL}, which
 *     is synchronous and costs one throwaway canvas.
 *
 *  3. **One module, one promise.** Two components mounting at once must not
 *     start two downloads, and the meeting mounts six figures inside one
 *     component. The promise is memoised.
 */

export type Babylon = typeof import('./babylon');

let pending: Promise<Babylon> | null = null;

/** The renderer, downloaded once per tab and shared. */
export function loadBabylon(): Promise<Babylon> {
    if (!pending) pending = import('./babylon');
    return pending;
}

/**
 * Can this browser render at all?
 *
 * Probed with a throwaway canvas rather than by sniffing, because the answer is
 * a runtime one: the same browser answers differently depending on how many
 * contexts are already open, whether the GPU process has crashed and been
 * blocklisted this session, and whether the user has switched hardware
 * acceleration off.
 *
 * The context is explicitly released. Browsers cap live WebGL contexts at
 * around sixteen and silently kill the OLDEST when a new one is asked for, so
 * a probe that leaked one would eventually be the reason a real stage went
 * black.
 */
export function hasWebGL(): boolean {
    if (typeof document === 'undefined') return false;
    try {
        const canvas = document.createElement('canvas');
        const gl = (canvas.getContext('webgl2')
            || canvas.getContext('webgl')) as WebGLRenderingContext | null;
        if (!gl) return false;
        const lose = gl.getExtension('WEBGL_lose_context');
        if (lose) lose.loseContext();
        return true;
    } catch {
        return false;
    }
}

/**
 * How hard to work.
 *
 * `low` halves the mesh detail, drops the render to 30 fps and pins the
 * hardware scaling at 1 device pixel per CSS pixel. It is chosen for a coarse
 * pointer or a narrow viewport rather than by user-agent string: what actually
 * matters is that a phone GPU is filling a 3x pixel ratio, and every phone-like
 * device answers `pointer: coarse`.
 */
export function pickQuality(): 'high' | 'low' {
    if (typeof window === 'undefined') return 'low';
    const coarse = window.matchMedia?.('(pointer: coarse)').matches ?? false;
    const narrow = window.innerWidth < 900;
    const cores = (navigator as any).hardwareConcurrency ?? 4;
    return coarse || narrow || cores <= 4 ? 'low' : 'high';
}

/**
 * Has the reader asked for less movement?
 *
 * Read once. Somebody is not going to change their mind mid-bulletin, and
 * re-querying it inside a render loop is a layout read sixty times a second.
 * Under it the idle amplitudes are SCALED, not switched off — see `figures.ts`.
 */
export function reducedMotion(): boolean {
    if (typeof window === 'undefined') return false;
    return window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
}

/**
 * Device pixel ratio, capped.
 *
 * A 3x phone rendering a full-width studio is nine times the fragments of a 1x
 * one for a difference nobody can see at arm's length, and it is the single
 * most common reason a WebGL page runs hot enough to be throttled. 2 on a
 * desktop, 1.5 on a phone.
 */
export function pixelRatio(quality: 'high' | 'low'): number {
    const dpr = typeof window === 'undefined' ? 1 : (window.devicePixelRatio || 1);
    return Math.min(dpr, quality === 'high' ? 2 : 1.5);
}
