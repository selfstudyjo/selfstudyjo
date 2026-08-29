<!--
  The newscast SET, on a page with nothing else on it.

  ============================================================
  WHY THIS IS SEPARATE FROM THE CAST PREVIEW
  ============================================================

  `PersonStage` draws people against a plain flat and is what the meeting and
  the interview use. The Newscast uses `createStudioStage`, which builds a whole
  room — cyclorama, lighting rig, video wall, desk, two anchors and a camera
  whose framing every dimension in the room is derived from. None of that is
  reachable through `PersonStage`, and none of it was previewable at all: the
  only way to see the studio was to open `/newscast` against a live app 36 with
  a working bulletin and a working speech provider, and then wait for a story.

  So the set had been tuned by reading numbers. That is how a lighting lamp came
  to be hanging 3 cm in front of the top of the video wall — the two are 45 cm
  apart in Z and neither number is obviously wrong on its own.

  Same shape and same reasons as `tools/leaderboard-preview`: the real stage, the
  real set, the real figures, and four controls for the states that are hard to
  reach in the app.
-->
<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, shallowRef, watch } from 'vue';
import type { StudioStage } from '@/stage3d/studioStage';

const props = defineProps<{
    /** Who is reading, or null for the moment between stories. */
    speaking: 'male' | 'female' | null;
    energy: number;
    live: boolean;
    /** What is on the video wall: a headline, or nothing for the ident. */
    headline: string;
    kicker: string;
    rtl: boolean;
}>();

const hostEl = ref<HTMLElement | null>(null);
const canvasEl = ref<HTMLCanvasElement | null>(null);
const stage = shallowRef<StudioStage | null>(null);

let observer: ResizeObserver | null = null;

function push(): void {
    const active = stage.value;
    if (!active) return;
    active.setSpeaking(props.speaking, props.energy);
    active.setLive(props.live);
    active.setScreen({ title: props.headline, kicker: props.kicker, rtl: props.rtl });
}

onMounted(async () => {
    if (!canvasEl.value || !hostEl.value) return;
    const { createStudioStage } = await import('@/stage3d/studioStage');
    if (!canvasEl.value || !hostEl.value) return;
    stage.value = await createStudioStage(canvasEl.value, { hostEl: hostEl.value });
    push();
    observer = new ResizeObserver(() => stage.value?.resize());
    observer.observe(hostEl.value);
});

onBeforeUnmount(() => {
    observer?.disconnect();
    observer = null;
    stage.value?.dispose();
    stage.value = null;
});

watch(() => [props.speaking, props.energy, props.live, props.headline, props.rtl] as const, push);
</script>

<template>
    <div ref="hostEl" class="sp__stage">
        <canvas ref="canvasEl" class="sp__canvas"></canvas>
    </div>
</template>

<style>
.sp__stage {
    position: relative;
    width: 100%;
    /* The aspect the Newscast's own stylesheet gives it -- and, as of the same
       change, the WIDTH cap that makes the aspect real rather than a preference.
       Without the second line this harness cannot reproduce the clipping the
       real page had, which is exactly why the clipped video wall was never seen
       here: `max-height` alone lets the box go squatter than its own ratio, and
       at 70vh on a 900px window it barely did. See `layout.ts`. */
    aspect-ratio: 1428 / 788;
    max-height: 70vh;
    max-width: calc(70vh * 1428 / 788);
    margin-inline: auto;
    border: 2px solid #26304a;
    border-radius: 12px;
    overflow: hidden;
    background: #05070f;
}

.sp__canvas {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    display: block;
}
</style>
