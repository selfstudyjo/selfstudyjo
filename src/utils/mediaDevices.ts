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
export function describeMediaError(err: unknown, kind: MediaKind): string {
    const device = kind === 'camera' ? 'camera' : 'microphone';
    switch (classifyMediaError(err)) {
        case 'denied':
            return `Access to your ${device} was blocked. Click the padlock (or camera) icon in `
                + `the address bar, set ${device} access to Allow, then reload this page.`;
        case 'missing':
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
    /** Why the microphone failed. Blocks the interview. */
    micError: string;
    /** Why the camera failed. Blocks nothing. */
    cameraError: string;
}

/**
 * Open the microphone, then — separately — the camera.
 *
 * TWO calls, and the separation is the entire fix. Asking for
 * `{video: …, audio: …}` in one call resolves only if BOTH devices open, so a
 * machine with a working microphone and a camera that is unplugged, disabled in
 * Windows privacy settings, or held by Teams got a single rejection and no
 * microphone either — and the interview, whose only real requirement is the
 * microphone, could not be started at all.
 *
 * Takes `getUserMedia` as an argument rather than reaching for `navigator`, so
 * the ordering and the never-lose-the-mic guarantee can be checked in node
 * (`npm run check:interview`) instead of being a property somebody has to
 * reproduce by unplugging a webcam.
 */
export async function acquireInterviewMedia<S>(
    getUserMedia: (constraints: MediaStreamConstraints) => Promise<S>,
): Promise<MediaAcquisition<S>> {
    let audio: S | null = null;
    try {
        // Audio ONLY. No video key at all — a video constraint riding along
        // here is what makes a camera fault a microphone fault.
        audio = await getUserMedia({ audio: AUDIO_CONSTRAINTS });
    } catch (err) {
        return { audio: null, video: null, micError: describeMediaError(err, 'microphone'), cameraError: '' };
    }

    let video: S | null = null;
    let cameraError = '';
    try {
        video = await getUserMedia({ video: VIDEO_CONSTRAINTS });
    } catch (err) {
        // Recorded and returned, never thrown: the caller has a microphone and
        // that is all an interview needs.
        cameraError = describeMediaError(err, 'camera');
    }
    return { audio, video, micError: '', cameraError };
}
