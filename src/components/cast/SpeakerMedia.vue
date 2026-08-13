<!--
  One person's picture inside a video tile: a still while they are listening, a
  looping clip while they are talking.

  Used by the Toastmasters meeting room (six of these) and by the job interview
  (one), which is why it is a component rather than markup in either view. It
  renders the two layers and nothing else -- the border, the glow, the name tag
  and the speaking dot stay with each page's own tile, so neither stylesheet had
  to be rearranged.

  Three things here are deliberate:

  * **The still sits underneath at full opacity and the clip fades in on top.**
    That one arrangement covers the first paint, a browser that refuses to
    autoplay, and `prefers-reduced-motion` -- the same trick the newscast studio
    uses. It also means the tile is never blank and never a black rectangle.

  * **A hidden clip is paused**, unlike the newscast, where all four loops run
    all the time. There it was buying against a decoder showing one stale frame
    at a handover; here a stale frame is the person sitting still in exactly the
    framing the still already shows, because both assets were cut from the same
    square. That makes pausing free -- and it is worth having, because this page
    also runs face detection every 350ms and a MediaRecorder loop, and six idle
    video decoders would be competing with them for a phone's CPU.

  * **The still drifts, very slightly, and each tile is given its own phase.**
    A grid of six photographs reads as a grid of photographs. A 0.6% scale over
    11 seconds is below the threshold of "something is moving" and above the one
    that makes a room feel switched off. Six tiles drifting in unison would read
    as a screensaver, which is the newscast's phase-offset lesson.
-->
<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { actorById, type ActorId } from '@/cast/actors';
import { mediaFor } from '@/cast/actorAssets';

const props = withDefaults(defineProps<{
    actor: ActorId;
    /** Are they talking right now? Drives still vs loop. */
    speaking: boolean;
    /**
     * Vertical framing, for a tile that is not square. The assets are square;
     * the job interview's tile is 16/10, so a plain `cover` would take equal
     * bites out of the forehead and the desk. Pulling the window up keeps the
     * head and gives away the desk instead.
     */
    align?: string;
    /** Seconds of animation delay, so neighbouring tiles do not breathe together. */
    phase?: number;
    alt?: string;
}>(), { align: '50%', phase: 0, alt: '' });

const media = computed(() => mediaFor(props.actor));
const label = computed(() => props.alt || actorById(props.actor).name);

const loop = ref<HTMLVideoElement | null>(null);

/**
 * Read once, and not reactive on purpose: a person who has asked for less
 * motion is not going to change their mind mid-meeting, and re-querying on
 * every speaker change is a layout read in a hot path.
 */
const reduceMotion = typeof window !== 'undefined'
    && typeof window.matchMedia === 'function'
    && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

function sync(speaking: boolean) {
    const video = loop.value;
    if (!video) return;
    if (speaking && !reduceMotion) {
        // Autoplay of a muted clip is allowed everywhere, but a refusal is a
        // rejected promise nobody sees -- and it costs motion and nothing else,
        // because the still underneath is the same shot.
        video.play().catch(() => undefined);
    } else if (!video.paused) {
        video.pause();
    }
}

watch(() => props.speaking, sync);
// A tile can mount already speaking: the job interview casts its interviewer and
// the intro starts in the same tick.
onMounted(() => sync(props.speaking));
onBeforeUnmount(() => loop.value?.pause());
</script>

<template>
    <div class="cast" :style="{ '--cast-align': align, '--cast-phase': `-${phase}s` }">
        <img
            class="cast__still" :class="{ 'cast__still--held': speaking }"
            :src="media.idle" :alt="label" draggable="false"
        />
        <video
            ref="loop"
            class="cast__loop" :class="{ 'cast__loop--on': speaking }"
            :src="media.speak" :poster="media.idle"
            muted loop playsinline preload="auto" disablepictureinpicture
        ></video>
    </div>
</template>

<style scoped>
.cast {
    position: absolute;
    inset: 0;
    overflow: hidden;
    /* Both assets are 512x512 and identically framed, so whatever a tile's
       shape is, the two layers crop the same way and the cut between them
       moves nothing. */
    background: var(--sfs-space, #0b1020);
}

.cast__still,
.cast__loop {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    object-fit: cover;
    object-position: center var(--cast-align, 50%);
    display: block;
}

.cast__still {
    animation: cast-drift 11s ease-in-out infinite alternate;
    animation-delay: var(--cast-phase, 0s);
}

/* Holding the drift while the clip is on top means the two layers cannot be a
   fraction of a percent apart at the moment of the cross-fade. */
.cast__still--held { animation-play-state: paused; }

.cast__loop {
    opacity: 0;
    transition: opacity 0.22s ease-in-out;
}

.cast__loop--on { opacity: 1; }

@keyframes cast-drift {
    from { transform: scale(1); }
    to   { transform: scale(1.006) translateY(-0.25%); }
}

@media (prefers-reduced-motion: reduce) {
    .cast__still { animation: none; }
    /* The clip is paused in script too -- CSS cannot stop a video, and a
       running clip under `opacity: 1` would still be motion. */
    .cast__loop { transition: none; }
}
</style>
