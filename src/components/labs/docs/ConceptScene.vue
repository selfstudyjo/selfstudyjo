<template>
  <figure class="scs" :aria-label="caption || labels">
    <div class="scs__stage">
      <canvas v-if="webgl" ref="canvas" class="scs__canvas" role="img" :aria-label="labels" />
      <!-- No WebGL (an old machine, a locked-down browser): the labels in
           order, which carry most of what the picture says. -->
      <ol v-else class="scs__fallback">
        <li v-for="(item, at) in scene.labels" :key="at">{{ item }}</li>
      </ol>
      <p v-if="loading" class="scs__loading">{{ $t('Drawing the illustration...') }}</p>
    </div>
    <figcaption v-if="caption" class="scs__caption">{{ caption }}</figcaption>
  </figure>
</template>

<script setup lang="ts">
/**
 * One 3D concept illustration. three.js is fetched the first time any is
 * shown (working rule 47) and the WebGL context is released when the figure
 * leaves the page - the Definitions window shows one term at a time, so there
 * is only ever one or two live contexts.
 */
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { hasWebGL } from '@/stage3d/loader';
import type { SceneSpec } from '@/utils/labDocs';
import { themePalette } from './themePalette';

const props = defineProps<{ scene: SceneSpec; caption?: string }>();

const canvas = ref<HTMLCanvasElement | null>(null);
const webgl = hasWebGL();
const loading = ref(false);
const labels = computed(() => props.scene.labels.join(' → '));
let dispose: (() => void) | null = null;
let generation = 0;
let themeWatch: MutationObserver | null = null;

async function build() {
  const mine = ++generation;
  dispose?.();
  dispose = null;
  if (!webgl || !canvas.value) return;
  loading.value = true;
  try {
    const [kit, scenes] = await Promise.all([
      import('@/utils/labDocs3d/sceneKit'),
      import('@/utils/labDocs3d/conceptScenes'),
    ]);
    if (mine !== generation || !canvas.value) return;
    const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches || false;
    const stage = kit.createStage(canvas.value, themePalette(), { reduced });
    scenes.buildConceptScene(stage, props.scene.kind, props.scene.labels);
    dispose = () => stage.dispose();
  } catch {
    // A chunk that failed to load leaves the labels' text in the caption.
  } finally {
    if (mine === generation) loading.value = false;
  }
}

onMounted(() => {
  build();
  themeWatch = new MutationObserver(() => build());
  themeWatch.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
});
watch(() => [props.scene.kind, props.scene.labels.join('|')], () => build());
onBeforeUnmount(() => {
  generation += 1;
  themeWatch?.disconnect();
  dispose?.();
});
</script>

<style scoped>
.scs { margin: 0.75rem 0; }
.scs__stage {
  position: relative; aspect-ratio: 16 / 9; max-height: 320px; width: 100%;
  border-radius: 12px; overflow: hidden;
  background: radial-gradient(ellipse at 50% 30%, rgb(var(--sfs-accent-rgb, 102 126 234) / 0.14), transparent 70%),
              rgb(var(--sfs-sink-rgb, 0 0 0) / 0.25);
}
.scs__canvas { display: block; width: 100%; height: 100%; }
.scs__fallback { display: flex; flex-wrap: wrap; gap: 0.5rem; align-items: center; justify-content: center;
  height: 100%; margin: 0; padding: 1rem; list-style: none; }
.scs__fallback li { padding: 0.4rem 0.75rem; border-radius: 8px; background: rgb(var(--sfs-tint-rgb, 255 255 255) / 0.1); }
.scs__loading { position: absolute; inset: auto 0 0.5rem; text-align: center; font-size: 0.8rem;
  color: var(--sfs-text-muted, #94a3b8); margin: 0; }
.scs__caption { text-align: center; font-size: 0.85rem; color: var(--sfs-text-muted, #94a3b8); margin-top: 0.35rem; }
</style>
