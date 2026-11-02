<template>
  <!--
    The roadmap in 3D: stage islands on a rising spiral, each one's steps
    floating round it as glowing plates. three.js arrives only when this
    component mounts (roadmapScene.ts), and this component is itself an async
    chunk, so 2D-only visitors download no 3D engine at all (working rule 47).

    A place, not a paragraph: pinned LTR. The canvas is a picture for a pointer;
    everything it shows is also reachable from the stage list beside it, which
    is where keyboard and screen-reader users go.

    The height comes from `--rm3d-height`, which the page sets to 100% in full
    screen; the ResizeObserver then resizes the renderer, and the page also
    calls `resize()` itself on entry and exit.
  -->
  <div ref="host" class="rm3d" :class="{ 'is-ready': ready }">
    <canvas ref="canvas" class="rm3d__canvas" :aria-label="$t('3D roadmap map')" role="img" />
    <div ref="labels" class="rm3d__labels" aria-hidden="true" />
    <div class="rm3d__vignette" aria-hidden="true" />

    <div v-if="!ready && !failed" class="rm3d__state">
      <span class="rm3d__loader" aria-hidden="true"><span /><span /><span /></span>
      {{ $t('Building the 3D map…') }}
    </div>

    <div v-if="ready" class="rm3d__bar">
      <button type="button" class="rm3d__btn" :title="$t('Previous stage')" :aria-label="$t('Previous stage')"
              @click="step(-1)"><ChevronLeft aria-hidden="true" /></button>
      <button type="button" class="rm3d__btn rm3d__btn--wide" @click="overview">
        <Maximize2 aria-hidden="true" /> {{ $t('Whole map') }}
      </button>
      <button type="button" class="rm3d__btn" :title="$t('Next stage')" :aria-label="$t('Next stage')"
              @click="step(1)"><ChevronRight aria-hidden="true" /></button>
    </div>

    <Transition name="rm3d-cap">
      <div v-if="ready && focusStage" :key="focusStage.id" class="rm3d__caption" aria-live="polite">
        <span class="rm3d__eyebrow">
          <span class="rm3d__capnum">{{ focusIndex + 1 }}</span>
          {{ $t('Stage {v0}', { v0: focusIndex + 1 }) }}
          <template v-if="focusStage.weeks"> · {{ $t('{v0} wk', { v0: focusStage.weeks }) }}</template>
        </span>
        <strong class="rm3d__ctitle">{{ focusStage.title }}</strong>
        <span v-if="focusStage.summary" class="rm3d__csum">{{ focusStage.summary }}</span>
      </div>
    </Transition>

    <p v-if="ready" class="rm3d__hint">{{ $t('Drag to turn · scroll or pinch to zoom · right-drag to move') }}</p>
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { ChevronLeft, ChevronRight, Maximize2 } from 'lucide-vue-next';
import { useI18n } from '@/i18n/runtime';
import { layout3D, type NodeKind, type RoadmapDoc } from '@/utils/roadmapLayout';
import { createRoadmapScene, type RoadmapScene } from './roadmapScene';

const props = defineProps<{
  doc: RoadmapDoc;
  selectedId?: string | null;
  animate?: boolean;
}>();
const emit = defineEmits<{
  (e: 'select', id: string | null): void;
  (e: 'focus', stageId: string | null): void;
  (e: 'tour-end'): void;
  /** WebGL failed or was lost: the parent falls back to 2D and says why. */
  (e: 'failed', reason: string): void;
}>();
const { t } = useI18n();

const host = ref<HTMLElement | null>(null);
const canvas = ref<HTMLCanvasElement | null>(null);
const labels = ref<HTMLElement | null>(null);
const ready = ref(false);
const failed = ref(false);
const focusId = ref<string | null>(null);

let scene: RoadmapScene | null = null;
let resizeObs: ResizeObserver | null = null;
let viewObs: IntersectionObserver | null = null;
let themeObs: MutationObserver | null = null;
let onScreen = true;
let gone = false;

const focusIndex = computed(() => props.doc.stages.findIndex(s => s.id === focusId.value));
const focusStage = computed(() => props.doc.stages[focusIndex.value] || null);

function kindLabel(kind: NodeKind): string {
  switch (kind) {
    case 'course': return t('Course');
    case 'lesson': return t('Lesson');
    case 'lab': return t('Lab');
    case 'runbook': return t('Runbook');
    default: return t('Topic');
  }
}

function syncActive() {
  scene?.setActive(onScreen && document.visibilityState !== 'hidden');
}
const onVisibility = () => syncActive();

onMounted(async () => {
  if (!host.value || !canvas.value || !labels.value) return;
  try {
    const made = await createRoadmapScene({
      host: host.value,
      canvas: canvas.value,
      labelLayer: labels.value,
      motion: props.animate !== false,
      labels: {
        stage: (i, title) => `${i + 1} · ${title}`,
        kind: kindLabel,
      },
      onSelect: id => emit('select', id),
      onHover: () => {},
      onFocus: id => { focusId.value = id; emit('focus', id); },
      onTourEnd: () => emit('tour-end'),
      onLost: () => { failed.value = true; emit('failed', 'lost'); },
    });
    if (gone) { made.dispose(); return; }
    scene = made;
    scene.setDoc(props.doc, layout3D(props.doc));
    if (props.selectedId) scene.select(props.selectedId);
    ready.value = true;
    // The preview harness reads this to prove the canvas is painted.
    (canvas.value as any).__sfsSample = () => scene?.sample() ?? 0;
  } catch (e) {
    failed.value = true;
    emit('failed', e instanceof Error ? e.message : 'load');
    return;
  }

  if (typeof ResizeObserver !== 'undefined') {
    resizeObs = new ResizeObserver(() => scene?.resize());
    resizeObs.observe(host.value);
  }
  if (typeof IntersectionObserver !== 'undefined') {
    viewObs = new IntersectionObserver(entries => {
      onScreen = entries.some(e => e.isIntersecting);
      syncActive();
    });
    viewObs.observe(host.value);
  }
  document.addEventListener('visibilitychange', onVisibility);
  // A canvas cannot read a custom property, so a galaxy change REBUILDS.
  if (typeof MutationObserver !== 'undefined') {
    themeObs = new MutationObserver(() => scene?.rebuild());
    themeObs.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme', 'data-mode'] });
  }
});

onBeforeUnmount(() => {
  gone = true;
  resizeObs?.disconnect();
  viewObs?.disconnect();
  themeObs?.disconnect();
  document.removeEventListener('visibilitychange', onVisibility);
  scene?.dispose();
  scene = null;
});

watch(() => props.doc, doc => { scene?.setDoc(doc, layout3D(doc)); });
watch(() => props.selectedId, id => {
  if (!scene) return;
  scene.select(id || null);
  if (id) scene.flyToNode(id);
});

function step(delta: number) {
  const n = props.doc.stages.length;
  if (!n || !scene) return;
  const cur = focusIndex.value;
  const next = cur < 0 ? (delta > 0 ? 0 : n - 1) : (cur + delta + n) % n;
  scene.flyToStage(props.doc.stages[next].id);
}
function overview() { scene?.overview(); }

defineExpose({
  /** Full screen changes the host's size; the page asks for a resize as well,
      in case the observer fires before the browser has laid the host out. */
  resize: () => scene?.resize(),
  playTour: () => scene?.playTour(),
  stopTour: () => scene?.stopTour(),
  overview,
  flyToStage: (id: string) => scene?.flyToStage(id),
});
</script>

<style scoped>
.rm3d {
  direction: ltr;
  position: relative;
  width: 100%;
  height: var(--rm3d-height, clamp(24rem, 66vh, 50rem));
  border-radius: var(--rm3d-radius, var(--sfs-radius-xl, 20px));
  overflow: hidden;
  background:
    radial-gradient(120% 90% at 70% 0%, rgb(var(--sfs-accent-rgb, 102 126 234) / 0.22), transparent 60%),
    var(--sfs-space, #0b1020);
  border: 1px solid rgb(var(--sfs-line-rgb, 255 255 255) / 0.12);
  box-shadow: var(--sfs-elev-2, 0 18px 50px rgba(0, 0, 0, 0.35));
  touch-action: none;
  isolation: isolate;
}
.rm3d__canvas { position: absolute; inset: 0; width: 100%; height: 100%; display: block; }
/* The label layer is its own stacking context (CSS2DRenderer writes a
   z-index on every label), so no label can paint over the controls. */
.rm3d__labels { position: absolute; inset: 0; pointer-events: none; overflow: hidden; z-index: 1; }
.rm3d__bar, .rm3d__caption, .rm3d__hint, .rm3d__state { z-index: 2; }
/* A soft edge so the dome meets the card's corners; pointer-transparent. */
.rm3d__vignette {
  position: absolute; inset: 0; pointer-events: none;
  background: radial-gradient(140% 110% at 50% 45%, transparent 62%, rgb(var(--sfs-space-rgb, 11 16 32) / 0.55));
}
.rm3d__state {
  position: absolute; inset: 0; display: grid; place-content: center; gap: 0.9rem;
  justify-items: center; color: var(--sfs-text-muted, #94a3b8); font-size: 0.9rem;
}
.rm3d__loader { position: relative; width: 3rem; height: 3rem; }
.rm3d__loader span {
  position: absolute; inset: 0; border-radius: 50%;
  border: 2px solid transparent; border-top-color: var(--sfs-accent, #667eea);
}
.rm3d__loader span:nth-child(2) { inset: 0.45rem; border-top-color: var(--sfs-accent-2, #764ba2); }
.rm3d__loader span:nth-child(3) { inset: 0.9rem; border-top-color: var(--sfs-accent-3, #f093fb); }
@media (prefers-reduced-motion: no-preference) {
  .rm3d__loader span { animation: rm3d-spin 1.3s linear infinite; }
  .rm3d__loader span:nth-child(2) { animation-duration: 1.9s; animation-direction: reverse; }
  .rm3d__loader span:nth-child(3) { animation-duration: 0.9s; }
}
@keyframes rm3d-spin { to { transform: rotate(360deg); } }

.rm3d__bar {
  position: absolute; inset-block-end: 0.9rem; left: 50%; transform: translateX(-50%);
  display: flex; gap: 0.3rem; padding: 0.3rem;
  border-radius: var(--sfs-radius-pill, 999px);
  background: var(--sfs-overlay, rgba(10, 12, 25, 0.72));
  border: 1px solid color-mix(in srgb, var(--sfs-on-overlay, #fff) 12%, transparent);
  box-shadow: 0 10px 30px rgb(var(--sfs-shade-rgb, 0 0 0) / 0.35);
}
.rm3d__btn {
  display: inline-flex; align-items: center; justify-content: center; gap: 0.35rem;
  min-width: 2.5rem; min-height: 2.5rem; padding: 0 0.6rem;
  border-radius: var(--sfs-radius-pill, 999px);
  border: 1px solid transparent;
  background: transparent;
  color: var(--sfs-on-overlay, #fff);
  font: inherit; font-size: 0.85rem; font-weight: 600; cursor: pointer;
  transition: background var(--sfs-dur-fast, 0.15s), border-color var(--sfs-dur-fast, 0.15s);
}
.rm3d__btn:hover { background: color-mix(in srgb, var(--sfs-on-overlay, #fff) 10%, transparent); border-color: color-mix(in srgb, var(--sfs-on-overlay, #fff) 16%, transparent); }
.rm3d__btn:focus-visible { outline: 2px solid var(--sfs-focus, #a5b4fc); outline-offset: 2px; }
.rm3d__btn svg { width: 1.1em; height: 1.1em; }
.rm3d__btn--wide { padding: 0 0.9rem; white-space: nowrap; }

.rm3d__caption {
  position: absolute; inset-block-start: 0.9rem; left: 0.9rem;
  max-width: min(26rem, calc(100% - 1.8rem));
  display: grid; gap: 0.25rem; padding: 0.75rem 0.95rem;
  border-radius: var(--sfs-radius-lg, 16px);
  background: var(--sfs-overlay, rgba(10, 12, 25, 0.72));
  border: 1px solid color-mix(in srgb, var(--sfs-on-overlay, #fff) 12%, transparent);
  border-inline-start: 3px solid var(--sfs-accent, #667eea);
  color: var(--sfs-on-overlay, #fff);
  box-shadow: 0 14px 40px rgb(var(--sfs-shade-rgb, 0 0 0) / 0.35);
  pointer-events: none;
}
.rm3d__eyebrow {
  display: inline-flex; align-items: center; gap: 0.45rem;
  font-size: 0.7rem; text-transform: uppercase; letter-spacing: 0.08em; font-weight: 700;
  color: var(--sfs-on-overlay-muted, #cbd5e1);
}
.rm3d__capnum {
  display: inline-grid; place-items: center; width: 1.35rem; height: 1.35rem; border-radius: 50%;
  background: var(--sfs-accent, #667eea); color: var(--sfs-on-accent, #fff); font-size: 0.7rem; letter-spacing: 0;
}
.rm3d__ctitle { font-size: 1.05rem; line-height: 1.3; unicode-bidi: plaintext; }
.rm3d__csum { font-size: 0.82rem; color: var(--sfs-on-overlay-muted, #cbd5e1); line-height: 1.4; unicode-bidi: plaintext; }
@media (prefers-reduced-motion: no-preference) {
  .rm3d-cap-enter-active, .rm3d-cap-leave-active { transition: opacity 0.3s var(--sfs-ease-out, ease-out), transform 0.3s var(--sfs-ease-out, ease-out); }
  .rm3d-cap-enter-from { opacity: 0; transform: translateY(-6px); }
  .rm3d-cap-leave-to { opacity: 0; }
}
.rm3d__hint {
  position: absolute; inset-block-start: 0.9rem; right: 0.9rem; margin: 0;
  padding: 0.3rem 0.65rem; border-radius: 999px;
  font-size: 0.72rem; color: var(--sfs-on-overlay-muted, #cbd5e1);
  background: var(--sfs-overlay, rgba(10, 12, 25, 0.6));
  pointer-events: none; max-width: 40%; text-align: right; opacity: 0.85;
}
@media (max-width: 640px) {
  .rm3d__hint { display: none; }
  .rm3d { height: var(--rm3d-height, clamp(22rem, 62vh, 34rem)); }
}
</style>

<style>
/*
  The labels are created by roadmapScene.ts at runtime, so they carry no
  scoped attribute and are styled here, unscoped - every selector prefixed
  `rm3d-` so nothing on another page can match it (working rule 32).
*/
.rm3d-label {
  display: inline-flex; align-items: center; gap: 0.35rem; white-space: nowrap;
  font-family: var(--sfs-font-sans, system-ui, sans-serif);
  transform-origin: center bottom;
  pointer-events: none;
}
.rm3d-label__body { display: grid; gap: 1px; min-width: 0; text-align: start; }
.rm3d-label__title { font-weight: 700; unicode-bidi: plaintext; }
.rm3d-label__icon {
  width: 14px; height: 14px; flex: none;
  fill: none; stroke: currentColor; stroke-width: 2.2; stroke-linecap: round; stroke-linejoin: round;
}
.rm3d-label--stage {
  padding: 0.3rem 0.7rem; border-radius: 999px;
  background: var(--sfs-overlay, rgba(10, 12, 25, 0.78));
  border: 1px solid color-mix(in srgb, var(--sfs-on-overlay, #fff) 14%, transparent);
  color: var(--sfs-on-overlay, #fff);
  font-size: 12px;
  max-width: 17rem;
  box-shadow: 0 6px 18px rgb(var(--sfs-shade-rgb, 0 0 0) / 0.3);
}
.rm3d-label--stage .rm3d-label__body { grid-auto-flow: column; align-items: baseline; gap: 0.45rem; }
.rm3d-label--stage .rm3d-label__title { overflow: hidden; text-overflow: ellipsis; }
.rm3d-label--stage .rm3d-label__sub { font-size: 10.5px; font-weight: 700; color: var(--sfs-on-overlay-muted, #cbd5e1); direction: ltr; }
.rm3d-label--node {
  opacity: 0; transform: translateY(4px);
  transition: opacity 0.22s, transform 0.22s;
  padding: 0.22rem 0.55rem 0.22rem 0.4rem; border-radius: 999px;
  background: var(--sfs-overlay, rgba(10, 12, 25, 0.82));
  border: 1px solid color-mix(in srgb, var(--sfs-on-overlay, #fff) 12%, transparent);
  color: var(--sfs-on-overlay, #fff);
  font-size: 11px; max-width: 11rem;
}
/* A focused stage shows twelve labels at once: titles only, one line each,
   so they read as a ring of names rather than a pile of cards. The kind line
   comes back for the step being pointed at or chosen. */
.rm3d-label--node .rm3d-label__sub { display: none; }
.rm3d-label--node.is-hover, .rm3d-label--node.is-selected { max-width: 17rem; z-index: 3; border-radius: 12px; }
.rm3d-label--node.is-hover .rm3d-label__sub,
.rm3d-label--node.is-selected .rm3d-label__sub { display: block; }
.rm3d-label--node .rm3d-label__title { overflow: hidden; text-overflow: ellipsis; }
.rm3d-label--node .rm3d-label__sub { font-size: 10px; color: var(--sfs-on-overlay-muted, #cbd5e1); }
.rm3d-label--node.is-shown { opacity: 1; transform: none; }
.rm3d-label--node.is-selected { outline: 2px solid var(--sfs-focus, #a5b4fc); z-index: 2; }
@media (prefers-reduced-motion: reduce) { .rm3d-label--node { transition: none; transform: none; } }
</style>
