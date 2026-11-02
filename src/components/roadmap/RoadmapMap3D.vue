<template>
  <!--
    The roadmap in 3D: stages on a rising spiral, each one's steps orbiting it.
    three.js arrives only when this component mounts (roadmapScene.ts), and
    this component is itself an async chunk, so 2D-only visitors download no
    3D engine at all (working rule 47).

    A place, not a paragraph: pinned LTR. The canvas is a picture for a pointer;
    everything it shows is also reachable from the stage list beside it, which
    is where keyboard and screen-reader users go.
  -->
  <div ref="host" class="rm3d" :class="{ 'is-ready': ready }">
    <canvas ref="canvas" class="rm3d__canvas" :aria-label="$t('3D roadmap map')" role="img" />
    <div ref="labels" class="rm3d__labels" aria-hidden="true" />

    <div v-if="!ready && !failed" class="rm3d__state">
      <LoaderCircle class="rm3d__spin" aria-hidden="true" /> {{ $t('Building the 3D map…') }}
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

    <div v-if="ready && focusStage" class="rm3d__caption" aria-live="polite">
      <span class="rm3d__eyebrow">{{ $t('Stage {v0}', { v0: focusIndex + 1 }) }}</span>
      <strong class="rm3d__ctitle">{{ focusStage.title }}</strong>
      <span v-if="focusStage.summary" class="rm3d__csum">{{ focusStage.summary }}</span>
    </div>

    <p v-if="ready" class="rm3d__hint">{{ $t('Drag to turn · scroll or pinch to zoom · right-drag to move') }}</p>
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { ChevronLeft, ChevronRight, LoaderCircle, Maximize2 } from 'lucide-vue-next';
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
  height: clamp(22rem, 62vh, 46rem);
  border-radius: var(--sfs-radius-lg, 16px);
  overflow: hidden;
  background: var(--sfs-space, #0b1020);
  border: 1px solid var(--sfs-border, rgba(255, 255, 255, 0.14));
  touch-action: none;
}
.rm3d__canvas { position: absolute; inset: 0; width: 100%; height: 100%; display: block; }
.rm3d__labels { position: absolute; inset: 0; pointer-events: none; overflow: hidden; }
.rm3d__state {
  position: absolute; inset: 0; display: grid; place-content: center; gap: 0.5rem;
  grid-auto-flow: column; align-items: center;
  color: var(--sfs-text-muted, #94a3b8);
}
.rm3d__spin { width: 1.2em; height: 1.2em; }
@media (prefers-reduced-motion: no-preference) {
  .rm3d__spin { animation: rm3d-spin 1s linear infinite; }
}
@keyframes rm3d-spin { to { transform: rotate(360deg); } }

.rm3d__bar {
  position: absolute; inset-block-end: 0.75rem; left: 50%; transform: translateX(-50%);
  display: flex; gap: 0.4rem;
}
.rm3d__btn {
  display: inline-flex; align-items: center; justify-content: center; gap: 0.35rem;
  min-width: 2.5rem; min-height: 2.5rem; padding: 0 0.6rem;
  border-radius: var(--sfs-radius-pill, 999px);
  border: 1px solid var(--sfs-border, rgba(255, 255, 255, 0.18));
  background: var(--sfs-overlay, rgba(10, 12, 25, 0.72));
  color: var(--sfs-on-overlay, #fff);
  font: inherit; font-size: 0.85rem; cursor: pointer;
}
.rm3d__btn:hover { border-color: var(--sfs-accent, #667eea); }
.rm3d__btn:focus-visible { outline: 2px solid var(--sfs-focus, #a5b4fc); outline-offset: 2px; }
.rm3d__btn svg { width: 1.1em; height: 1.1em; }
.rm3d__btn--wide { padding: 0 0.9rem; white-space: nowrap; }

.rm3d__caption {
  position: absolute; inset-block-start: 0.75rem; left: 0.75rem;
  max-width: min(24rem, calc(100% - 1.5rem));
  display: grid; gap: 0.15rem; padding: 0.6rem 0.8rem;
  border-radius: var(--sfs-radius, 12px);
  background: var(--sfs-overlay, rgba(10, 12, 25, 0.72));
  color: var(--sfs-on-overlay, #fff);
  pointer-events: none;
}
.rm3d__eyebrow { font-size: 0.7rem; text-transform: uppercase; letter-spacing: 0.08em; color: var(--sfs-on-overlay-muted, #cbd5e1); }
.rm3d__ctitle { font-size: 1rem; }
.rm3d__csum { font-size: 0.82rem; color: var(--sfs-on-overlay-muted, #cbd5e1); line-height: 1.35; }
.rm3d__hint {
  position: absolute; inset-block-start: 0.75rem; right: 0.75rem; margin: 0;
  font-size: 0.72rem; color: var(--sfs-text-faint, #94a3b8);
  pointer-events: none; max-width: 40%; text-align: right;
}
@media (max-width: 640px) {
  .rm3d__hint { display: none; }
  .rm3d { height: clamp(20rem, 58vh, 32rem); }
}
</style>

<style>
/*
  The labels are created by roadmapScene.ts at runtime, so they carry no
  scoped attribute and are styled here, unscoped - every selector prefixed
  `rm3d-` so nothing on another page can match it (working rule 32).
*/
.rm3d-label {
  display: grid; gap: 1px; text-align: center; white-space: nowrap;
  font-family: var(--sfs-font-sans, system-ui, sans-serif);
  transform-origin: center bottom;
  pointer-events: none;
}
.rm3d-label__title { font-weight: 700; }
.rm3d-label--stage {
  padding: 0.25rem 0.6rem; border-radius: 999px;
  background: var(--sfs-overlay, rgba(10, 12, 25, 0.72));
  color: var(--sfs-on-overlay, #fff);
  font-size: 12px;
  max-width: 16rem; overflow: hidden; text-overflow: ellipsis;
}
.rm3d-label--stage .rm3d-label__sub { display: none; }
.rm3d-label--node {
  opacity: 0; transition: opacity 0.2s;
  padding: 0.2rem 0.5rem; border-radius: 8px;
  background: var(--sfs-overlay, rgba(10, 12, 25, 0.78));
  color: var(--sfs-on-overlay, #fff);
  font-size: 11px; max-width: 10rem;
}
/* A focused stage shows twelve labels at once: titles only, one line each,
   so they read as a ring of names rather than a pile of cards. The kind line
   comes back for the step being pointed at or chosen. */
.rm3d-label--node .rm3d-label__sub { display: none; }
.rm3d-label--node.is-hover, .rm3d-label--node.is-selected { max-width: 16rem; z-index: 3; }
.rm3d-label--node.is-hover .rm3d-label__sub,
.rm3d-label--node.is-selected .rm3d-label__sub { display: block; }
.rm3d-label--node .rm3d-label__title { overflow: hidden; text-overflow: ellipsis; }
.rm3d-label--node .rm3d-label__sub { font-size: 10px; color: var(--sfs-on-overlay-muted, #cbd5e1); }
.rm3d-label--node.is-shown { opacity: 1; }
.rm3d-label--node.is-selected { outline: 2px solid var(--sfs-focus, #a5b4fc); z-index: 2; }
@media (prefers-reduced-motion: reduce) { .rm3d-label--node { transition: none; } }
</style>
