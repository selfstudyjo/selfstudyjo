<template>
  <section class="ihg" :aria-label="$t('How to use it')">
    <div
      ref="stageEl"
      class="ihg-stage"
      tabindex="0"
      :aria-label="$t('Step {v0} of {v1}', { v0: step + 1, v1: steps.length })"
      @keydown.left.prevent="go(step - 1)"
      @keydown.right.prevent="go(step + 1)"
    >
      <!-- Shown until the 3D scene has painted, and for good without WebGL. -->
      <div v-if="!ready" class="ihg-fallback" aria-hidden="true">
        <svg viewBox="0 0 64 64" class="ihg-fallback__icon">
          <g v-if="step === 0"><path d="M32 8v30M20 28l12 12 12-12" /><rect x="14" y="46" width="36" height="8" rx="2" /></g>
          <g v-else-if="step === 1"><circle cx="32" cy="22" r="9" /><path d="M16 52c2-10 9-15 16-15s14 5 16 15" /></g>
          <g v-else-if="step === 2"><rect x="16" y="8" width="32" height="46" rx="3" /><path d="M23 20h18M23 29h18M23 38h12" /></g>
          <g v-else-if="step === 3"><rect x="6" y="18" width="24" height="18" rx="2" /><path d="M36 22c3 3 3 7 0 10M42 18c6 5 6 13 0 18M48 14c9 7 9 19 0 26" /></g>
          <g v-else-if="step === 4"><rect x="8" y="12" width="48" height="40" rx="3" /><path d="M15 22h34M15 31h28M15 40h31" /></g>
          <g v-else><circle cx="22" cy="32" r="10" /><path d="M38 46V34M45 46V24M52 46V30" /></g>
        </svg>
      </div>
      <canvas v-if="webglOk" ref="canvasEl" class="ihg-canvas" :class="{ 'is-ready': ready }" aria-hidden="true" />
      <span class="ihg-badge">{{ step + 1 }} / {{ steps.length }}</span>
    </div>

    <div class="ihg-caption" aria-live="polite">
      <p class="ihg-caption__count">{{ $t('Step {v0} of {v1}', { v0: step + 1, v1: steps.length }) }}</p>
      <h3>{{ current.title }}</h3>
      <p>{{ current.text }}</p>
    </div>

    <div class="ihg-controls">
      <button type="button" class="ihg-btn" :disabled="step === 0" @click="go(step - 1)">{{ $t('Previous') }}</button>
      <button type="button" class="ihg-btn" :aria-pressed="playing" @click="togglePlay">
        {{ playing ? $t('Pause') : $t('Play') }}
      </button>
      <button type="button" class="ihg-btn ihg-btn--primary" :disabled="step === steps.length - 1" @click="go(step + 1)">{{ $t('Next') }}</button>
      <div class="ihg-dots">
        <button
          v-for="(s, i) in steps"
          :key="i"
          type="button"
          class="ihg-dot"
          :class="{ 'is-active': i === step }"
          :aria-label="$t('Step {v0} of {v1}', { v0: i + 1, v1: steps.length }) + ': ' + s.title"
          :aria-current="i === step ? 'step' : undefined"
          @click="go(i)"
        />
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { t } from '@/i18n/runtime';
import type { HelperGuide } from './HelperGuide3D';

const steps = computed(() => [
  { title: t('1. Download and install'), text: t('Press the download button above. Your computer is detected, so you get the right installer. Open it and follow the installer.') },
  { title: t('2. Sign in'), text: t('Open the app and sign in with your SelfStudyJo account. Your plan must include AI Features.') },
  { title: t('3. Set up the interview'), text: t('Write the job title and paste your CV. The app prepares a short pitch, your strengths and stories taken only from your CV.') },
  { title: t('4. Join the call'), text: t('Join the interview on Zoom, Microsoft Teams or Google Meet and press Start. The app hears the interviewer through your computer audio. Use headphones.') },
  { title: t('5. Read the answer'), text: t('When the interviewer finishes a question, the answer appears in very simple English in the READ THIS NOW box, with the question in Arabic above it. Say it in your own voice.') },
  { title: t('6. Get feedback'), text: t('When the interview is over, press End. You get a score, your strengths, what to improve and a better answer for each question. Every interview is saved on your computer.') },
]);

const AUTOPLAY_MS = 7000;
const current = computed(() => steps.value[step.value] ?? steps.value[0]!);
const reducedMotion = typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

const step = ref(0);
const playing = ref(!reducedMotion);
const ready = ref(false);
const stageEl = ref<HTMLElement | null>(null);
const canvasEl = ref<HTMLCanvasElement | null>(null);

/*
  Can this device do WebGL at all? Asked WITHOUT three.js - deciding whether to
  download a 3D engine must not require downloading it (working rule 47, the
  same probe Planet.vue keeps for the same reason).
*/
function hasWebGL(): boolean {
  try {
    const probe = document.createElement('canvas');
    return !!(window.WebGLRenderingContext && (probe.getContext('webgl2') || probe.getContext('webgl')));
  } catch {
    return false;
  }
}
const webglOk = ref(typeof document !== 'undefined' && hasWebGL());

let guide: HelperGuide | null = null;
let building = 0;
let visible = false;
let timer: ReturnType<typeof setTimeout> | null = null;
let io: IntersectionObserver | null = null;
let ro: ResizeObserver | null = null;
let mo: MutationObserver | null = null;

function go(n: number) {
  step.value = Math.max(0, Math.min(steps.value.length - 1, n));
  schedule();
}

function togglePlay() {
  playing.value = !playing.value;
  if (playing.value && step.value === steps.value.length - 1) step.value = 0;
  schedule();
}

function schedule() {
  if (timer) clearTimeout(timer);
  timer = null;
  if (!playing.value || !visible || document.hidden) return;
  timer = setTimeout(() => {
    if (step.value >= steps.value.length - 1) { playing.value = false; return; }
    step.value += 1;
    schedule();
  }, AUTOPLAY_MS);
}

function syncRunning() {
  guide?.setRunning(visible && !document.hidden);
  schedule();
}

async function build() {
  if (!webglOk.value || !canvasEl.value) return;
  const mine = ++building;
  guide?.dispose();
  guide = null;
  try {
    const { createHelperGuide } = await import('./HelperGuide3D');
    if (mine !== building || !canvasEl.value) return;
    const g = await createHelperGuide(canvasEl.value, { reducedMotion, onFirstFrame: () => { ready.value = true; } });
    if (mine !== building) { g.dispose(); return; }
    guide = g;
    g.setStep(step.value);
    syncRunning();
  } catch {
    // The chunk failed to load or the context was refused: keep the fallback.
    webglOk.value = false;
    ready.value = false;
  }
}

watch(step, (n) => guide?.setStep(n));

function onVisibility() { syncRunning(); }

onMounted(() => {
  document.addEventListener('visibilitychange', onVisibility);
  if (stageEl.value && 'IntersectionObserver' in window) {
    io = new IntersectionObserver((entries) => {
      visible = entries.some((e) => e.isIntersecting);
      // Build lazily: the engine is downloaded only once the guide is near the screen.
      if (visible && !guide && building === 0) build();
      syncRunning();
    }, { rootMargin: '200px' });
    io.observe(stageEl.value);
  } else {
    visible = true;
    build();
  }
  if (stageEl.value && 'ResizeObserver' in window) {
    ro = new ResizeObserver(() => guide?.resize());
    ro.observe(stageEl.value);
  }
  // The scene's colours come from the theme; a new galaxy rebuilds it.
  mo = new MutationObserver(() => { if (guide) build(); });
  mo.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
});

onBeforeUnmount(() => {
  building++;
  document.removeEventListener('visibilitychange', onVisibility);
  io?.disconnect();
  ro?.disconnect();
  mo?.disconnect();
  if (timer) clearTimeout(timer);
  guide?.dispose();
  guide = null;
});
</script>

<style scoped>
.ihg {
  display: grid;
  gap: 1rem;
}
.ihg-stage {
  position: relative;
  aspect-ratio: 16 / 9;
  max-height: 32rem;
  width: 100%;
  border-radius: 1rem;
  overflow: hidden;
  border: 1px solid rgb(var(--sfs-line-rgb, 255 255 255) / 0.12);
  background:
    radial-gradient(ellipse at 50% 30%, rgb(var(--sfs-accent-rgb, 102 126 234) / 0.18), transparent 70%),
    rgb(var(--sfs-sink-rgb, 0 0 0) / 0.35);
  /* A picture is a place, not a paragraph: it never mirrors. */
  direction: ltr;
}
.ihg-stage:focus-visible { outline: 2px solid var(--sfs-accent, #667eea); outline-offset: 2px; }
.ihg-canvas {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  display: block;
  opacity: 0;
  transition: opacity 0.4s ease;
}
.ihg-canvas.is-ready { opacity: 1; }
.ihg-fallback {
  position: absolute;
  inset: 0;
  display: grid;
  place-items: center;
  color: var(--sfs-accent-text, #a5b4fc);
}
.ihg-fallback__icon {
  width: min(40%, 10rem);
  height: auto;
  fill: none;
  stroke: currentColor;
  stroke-width: 3;
  stroke-linecap: round;
  stroke-linejoin: round;
}
.ihg-badge {
  position: absolute;
  top: 0.75rem;
  left: 0.75rem;
  padding: 0.2rem 0.6rem;
  border-radius: 999px;
  font-size: 0.85rem;
  font-weight: 700;
  background: var(--sfs-overlay, rgba(15, 17, 40, 0.6));
  color: var(--sfs-on-overlay, #ffffff);
  unicode-bidi: isolate;
}
.ihg-caption { min-height: 7.5rem; }
.ihg-caption__count {
  margin: 0 0 0.2rem;
  font-size: 0.85rem;
  font-weight: 700;
  color: var(--sfs-accent-text, #a5b4fc);
}
.ihg-caption h3 { margin: 0 0 0.35rem; font-size: 1.15rem; }
.ihg-caption p:last-child { margin: 0; line-height: 1.65; color: var(--sfs-text-muted, #cbd5e1); }
.ihg-controls {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.6rem;
}
.ihg-btn {
  min-height: max(2.5rem, 44px);
  padding: 0.45rem 1rem;
  border-radius: 0.65rem;
  border: 1px solid rgb(var(--sfs-line-rgb, 255 255 255) / 0.2);
  background: rgb(var(--sfs-tint-rgb, 255 255 255) / 0.08);
  color: var(--sfs-text, #f1f5f9);
  font: inherit;
  font-weight: 700;
  cursor: pointer;
}
.ihg-btn:disabled { opacity: 0.45; cursor: default; }
.ihg-btn--primary {
  background: var(--sfs-accent, #667eea);
  border-color: var(--sfs-accent, #667eea);
  color: var(--sfs-on-accent, #ffffff);
}
.ihg-btn:focus-visible, .ihg-dot:focus-visible { outline: 2px solid var(--sfs-accent, #667eea); outline-offset: 2px; }
.ihg-dots { display: flex; gap: 0.15rem; margin-inline-start: auto; }
.ihg-dot {
  width: 44px;
  height: 44px;
  padding: 0;
  border: 0;
  background: none;
  cursor: pointer;
  display: grid;
  place-items: center;
}
.ihg-dot::before {
  content: '';
  width: 0.7rem;
  height: 0.7rem;
  border-radius: 50%;
  background: rgb(var(--sfs-line-rgb, 255 255 255) / 0.3);
  transition: transform 0.2s ease, background-color 0.2s ease;
}
.ihg-dot.is-active::before { background: var(--sfs-accent, #667eea); transform: scale(1.3); }
@media (max-width: 560px) {
  .ihg-dots { margin-inline-start: 0; width: 100%; justify-content: center; }
}
@media (prefers-reduced-motion: reduce) {
  .ihg-canvas, .ihg-dot::before { transition: none; }
}
</style>
