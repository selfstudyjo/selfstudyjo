/**
 * Asking for a camera and a microphone, and saying accurately what went wrong.
 *
 * Plain module — no Vue, no DOM — so the mapping can be checked in node
 * (`npm run check:interview`), the same precedent as `interviewSetup.ts`,
 * `linkify.ts` and `proctorQueue.ts`.
 *
 * It exists because of one line that reported every possible failure as
 * "Camera/microphone permission denied", including the one where permission had
 * been granted:
 *
 *     catch (e) { alert('Camera/microphone permission denied: ' + e.message) }
 *
 * `getUserMedia` has at least six distinct failures and only ONE of them is a
 * refusal. A user whose camera is unplugged, disabled in Windows privacy
 * settings, or held by Teams was told to grant a permission they had already
 * granted — so the message sent them to the one place that could not help, and
 * the interview was unreachable for as long as they believed it.
 *
 * The names come from the WebIDL spec; the older Chrome spellings
 * (`PermissionDeniedError`, `DevicesNotFoundError`, `TrackStartError`) are
 * matched too, because they still turn up on Android WebViews.
 */

export type MediaKind = 'microphone' | 'camera';

/** What went wrong, in the form the caller has to react to. */
export type MediaFailure =
    | 'denied'        // the user, or policy, refused
    | 'missing'       // no such device on this machine
    | 'busy'          // there is one, another application is holding it
    | 'unsupported'   // no getUserMedia here at all (usually an insecure origin)
    | 'constraints'   // the device exists but cannot do what was asked
    | 'unknown';

function errorName(err: unknown): string {
    if (!err) return '';
    const e = err as { name?: unknown; message?: unknown };
    return String(e.name || e.message || err || '');
}

export function classifyMediaError(err: unknown): MediaFailure {
    const name = errorName(err);
    if (/NotAllowedError|PermissionDeniedError|PermissionDismissedError|SecurityError/i.test(name)) return 'denied';
    if (/NotFoundError|DevicesNotFoundError/i.test(name)) return 'missing';
    if (/NotReadableError|TrackStartError|AbortError/i.test(name)) return 'busy';
    if (/OverconstrainedError|ConstraintNotSatisfiedError/i.test(name)) return 'constraints';
    if (/UnsupportedError|TypeError/i.test(name)) return 'unsupported';
    return 'unknown';
}

const ARTICLE: Record<MediaKind, string> = { microphone: 'a microphone', camera: 'a camera' };

/**
 * A sentence that names the actual cause and the actual fix.
 *
 * Deliberately does not include the raw `error.message`: Chrome's is
 * "Requested device not found", which is what was being shown after the words
 * "permission denied" and is exactly why the report said the permission had
 * been granted and the app disagreed.
 */
export function describeMediaError(
    err: unknown,
    kind: MediaKind,
    /**
     * Whether the machine actually has such a device, from {@link hasVideoInput}.
     * `undefined`/`null` means nobody checked, or the check could not answer.
     */
    devicePresent?: boolean | null,
): string {
    const device = kind === 'camera' ? 'camera' : 'microphone';
    switch (classifyMediaError(err)) {
        case 'denied':
            return `Access to your ${device} was blocked. Click the padlock (or camera) icon in `
                + `the address bar, set ${device} access to Allow, then reload this page.`;
        case 'missing':
            // The device IS there and the browser still said it could not find
            // one. Telling somebody looking at their webcam that no camera was
            // found is worse than saying nothing: it is confidently wrong, it
            // sends them to a settings page that is already correct, and it
            // hides the retry that usually fixes it. On Windows the capture
            // backend opens the camera lazily and answers NotFoundError while
            // another application still holds it.
            if (devicePresent) {
                return `Your ${device} is connected but the browser could not open it. That is `
                    + `almost always another application still holding it — close Zoom, Teams, `
                    + `Meet or any other tab using it and press the button again. Nothing else `
                    + `about the interview is affected.`;
            }
            return `No ${device} was found. Check that it is plugged in and enabled — on Windows, `
                + `Settings › Privacy & security › ${kind === 'camera' ? 'Camera' : 'Microphone'} `
                + `must also allow desktop apps to use it.`;
        case 'busy':
            return `Your ${device} is being used by another application. Close Zoom, Teams, Meet or `
                + `any other browser tab using it, then try again.`;
        case 'constraints':
            return `Your ${device} does not support the requested settings. Try a different device.`;
        case 'unsupported':
            return `This browser cannot reach ${ARTICLE[kind]} on this page. Use Chrome, Edge, `
                + `Firefox or Safari over https.`;
        default:
            return `Could not start your ${device}. Check it is connected and not in use by `
                + `another application, then try again.`;
    }
}

/** True when the page has no usable getUserMedia at all. */
export function mediaUnsupportedReason(
    nav: { mediaDevices?: { getUserMedia?: unknown } } | undefined,
    isSecureContext: boolean,
    origin = '',
): string {
    if (nav?.mediaDevices?.getUserMedia) return '';
    // Overwhelmingly the cause, and invisible otherwise: a browser hides
    // navigator.mediaDevices entirely on an insecure origin, so the API simply
    // is not there and the failure reads as an unsupported browser.
    if (!isSecureContext) {
        return 'A microphone can only be used over a secure connection. This page is on '
            + `${origin || 'an insecure origin'} — open it over https (or on localhost) and try again.`;
    }
    return 'This browser does not support microphone capture. Use Chrome, Edge, Firefox or Safari.';
}

/**
 * What the interview asks for.
 *
 * Separate objects because they are requested in two separate calls, and that
 * split is the fix rather than a tidy-up: asked for together, a missing or busy
 * CAMERA fails the whole call and takes the microphone with it — which is how a
 * machine with a working mic ended up unable to start an interview at all.
 */
export const AUDIO_CONSTRAINTS: MediaStreamConstraints['audio'] = {
    echoCancellation: true,
    noiseSuppression: true,
    autoGainControl: true,
};

/**
 * `ideal`, never `exact`. An exact size is an OverconstrainedError on any
 * webcam that does not offer it, which would put the optional camera back in
 * the business of failing for a reason nobody can act on.
 */
export const VIDEO_CONSTRAINTS: MediaStreamConstraints['video'] = {
    width: { ideal: 640 },
    height: { ideal: 480 },
};

export interface MediaAcquisition<S = MediaStream> {
    /** The microphone. Null means the interview cannot run. */
    audio: S | null;
    /** The camera. Null is fine — nothing reads this track. */
    video: S | null;
    /** True when one stream carries both, so the caller stops it only once. */
    combined: boolean;
    /** Why the microphone failed. Blocks the interview. */
    micError: string;
    /** Why the camera failed. Blocks nothing. */
    cameraError: string;
    /**
     * The raw rejections, kept so the caller can re-describe a failure once it
     * has asked whether the device actually exists — which needs an await and
     * so cannot happen in here without making every caller pay for it.
     */
    micRaw?: unknown;
    cameraRaw?: unknown;
}

/**
 * Open the camera and microphone, preferring the ONE request that browsers
 * actually grant.
 *
 * The order here is the whole of it, and it was got wrong once in each
 * direction:
 *
 *  * The original code asked for `{audio, video}` and nothing else. That is the
 *    request a browser remembers a grant for, and it works — right up until the
 *    camera cannot open, at which point the single call rejects and the
 *    MICROPHONE is lost with it. An interview whose only real requirement is
 *    the microphone then could not start at all.
 *
 *  * Splitting it into audio-then-video fixed that and broke the ordinary case.
 *    A video-only follow-up is a SEPARATE permission request against a
 *    separately-tracked device: a browser that had happily granted the pair
 *    prompts again, or — on Windows, where the camera is opened lazily by the
 *    capture backend — simply answers `NotFoundError` for a camera that is
 *    plugged in and was working a moment earlier.
 *
 * So: ask for both together first, exactly as before, and fall back to the
 * split ONLY when that fails. The common path is byte-for-byte the request that
 * has always worked, one prompt, one grant; the split is reached only when
 * something was going to fail anyway, and there its job is to save the
 * microphone.
 *
 * `getUserMedia` is an argument rather than a reach for `navigator`, so the
 * ordering and the never-lose-the-mic guarantee are checkable in node
 * (`npm run check:interview`) rather than being properties somebody has to
 * reproduce by unplugging a webcam.
 */
export async function acquireInterviewMedia<S>(
    getUserMedia: (constraints: MediaStreamConstraints) => Promise<S>,
): Promise<MediaAcquisition<S>> {
    // 1. Both at once. The request the browser already has a grant for.
    try {
        const both = await getUserMedia({ audio: AUDIO_CONSTRAINTS, video: VIDEO_CONSTRAINTS });
        return { audio: both, video: both, combined: true, micError: '', cameraError: '' };
    } catch {
        // Deliberately not reported. Which device failed is not knowable from
        // this rejection — a NotFoundError here means "one of the two", and
        // guessing is how a working microphone got blamed on a camera. The two
        // calls below find out for certain.
    }

    // 2. The microphone alone. This is the one that decides whether there is an
    //    interview, so it is asked in isolation and its answer is believed.
    let audio: S | null = null;
    let micError = '';
    let micRaw: unknown;
    try {
        audio = await getUserMedia({ audio: AUDIO_CONSTRAINTS });
    } catch (err) {
        micRaw = err;
        micError = describeMediaError(err, 'microphone');
    }

    // 3. The camera alone, whatever happened above. If the microphone failed
    //    this costs one extra rejection and tells the caller which of the two
    //    was really at fault.
    let video: S | null = null;
    let cameraError = '';
    let cameraRaw: unknown;
    try {
        video = await getUserMedia({ video: VIDEO_CONSTRAINTS });
    } catch (err) {
        cameraRaw = err;
        cameraError = describeMediaError(err, 'camera');
    }

    return { audio, video, combined: false, micError, cameraError, micRaw, cameraRaw };
}

/**
 * Whether this machine has a camera at all.
 *
 * `null` when the question cannot be answered — an older browser, or an
 * `enumerateDevices` that threw. Null is not "no": reporting "no camera found"
 * on a failed enumeration is exactly the wrong answer to give somebody looking
 * at their camera.
 *
 * Worth asking even before permission is granted: a browser hides device
 * LABELS until then, but still reports one entry per device kind that exists,
 * so `videoinput` presence is answerable.
 */
export async function hasVideoInput(
    mediaDevices: { enumerateDevices?: () => Promise<{ kind: string }[]> } | undefined,
): Promise<boolean | null> {
    if (!mediaDevices?.enumerateDevices) return null;
    try {
        const devices = await mediaDevices.enumerateDevices();
        if (!Array.isArray(devices) || devices.length === 0) return null;
        return devices.some(d => d?.kind === 'videoinput');
    } catch {
        return null;
    }
}
