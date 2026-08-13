/**
 * Bundled URLs for the cast's twelve assets.
 *
 * Kept apart from `actors.ts` on purpose, and for the reason `appNav.ts` names
 * icons that `SideNav.vue` draws: importing an asset is a build-tool feature, so
 * a module that does it cannot be loaded by `npm run check:actors` in node. This
 * file is the browser half; the registry stays plain.
 *
 * Static imports rather than `import.meta.glob` so a filename that does not
 * exist fails the BUILD. A glob resolves a missing file to `undefined`, which
 * reaches the page as `<img src="undefined">` — a broken tile in a grid of six,
 * on a page nobody rebuilds often.
 *
 * These are URLs, not payloads: naming all twelve here costs twelve strings in
 * the bundle and fetches nothing. A job interview pulls the one actor it cast.
 */
import type { ActorId } from './actors';

import davidIdle from '@/assets/actors/david_idle.webp';
import davidSpeak from '@/assets/actors/david_speak.mp4';
import emmaIdle from '@/assets/actors/emma_idle.webp';
import emmaSpeak from '@/assets/actors/emma_speak.mp4';
import jamesIdle from '@/assets/actors/james_idle.webp';
import jamesSpeak from '@/assets/actors/james_speak.mp4';
import marcusIdle from '@/assets/actors/marcus_idle.webp';
import marcusSpeak from '@/assets/actors/marcus_speak.mp4';
import saraIdle from '@/assets/actors/sara_idle.webp';
import saraSpeak from '@/assets/actors/sara_speak.mp4';
import sophiaIdle from '@/assets/actors/sophia_idle.webp';
import sophiaSpeak from '@/assets/actors/sophia_speak.mp4';

export interface ActorMedia {
    /** Shown whenever the person is not speaking. */
    idle: string;
    /** Looping clip, silent — the words come from speech synthesis. */
    speak: string;
}

export const ACTOR_MEDIA: Record<ActorId, ActorMedia> = {
    marcus: { idle: marcusIdle, speak: marcusSpeak },
    sara: { idle: saraIdle, speak: saraSpeak },
    david: { idle: davidIdle, speak: davidSpeak },
    emma: { idle: emmaIdle, speak: emmaSpeak },
    sophia: { idle: sophiaIdle, speak: sophiaSpeak },
    james: { idle: jamesIdle, speak: jamesSpeak },
};

export function mediaFor(id: ActorId): ActorMedia {
    return ACTOR_MEDIA[id];
}
