<template>
  <section class="sgw">
    <header class="sgw__head">
      <span class="sgw__chip" :style="{ background: section.brand }">{{ section.product }}</span>
      <h4 class="sgw__title">{{ section.title }}</h4>
    </header>
    <p class="sgw__cmd">
      {{ $t('Does the same as') }}
      <code dir="ltr">{{ section.command }}</code>
    </p>

    <div class="sgw__grid">
      <div class="sgw__player">
        <div v-if="webgl" class="sgw__stage">
          <canvas ref="canvas" class="sgw__canvas" role="img"
                  :aria-label="$t('Animated walkthrough of the steps in {v0}', { v0: section.product })" />
        </div>
        <div v-if="webgl" class="sgw__controls">
          <button type="button" class="sl-btn sl-btn--ghost sl-btn--sm" :disabled="active === 0" @click="go(active - 1)">
            <ChevronLeft class="sgw__i" aria-hidden="true" /><span class="sgw__sr">{{ $t('Previous step') }}</span>
          </button>
          <button v-if="!reduced" type="button" class="sl-btn sl-btn--primary sl-btn--sm" @click="toggle">
            <Pause v-if="playing" class="sgw__i" aria-hidden="true" />
            <Play v-else class="sgw__i" aria-hidden="true" />
            {{ playing ? $t('Pause') : $t('Play') }}
          </button>
          <button type="button" class="sl-btn sl-btn--ghost sl-btn--sm" :disabled="active >= section.steps.length - 1"
                  @click="go(active + 1)">
            <ChevronRight class="sgw__i" aria-hidden="true" /><span class="sgw__sr">{{ $t('Next step') }}</span>
          </button>
          <button type="button" class="sl-btn sl-btn--ghost sl-btn--sm" @click="restart">
            <RotateCcw class="sgw__i" aria-hidden="true" /> {{ $t('Restart') }}
          </button>
          <label v-if="!reduced" class="sgw__speed">
            {{ $t('Speed') }}
            <select v-model.number="speed">
              <option :value="0.5">0.5×</option>
              <option :value="1">1×</option>
              <option :value="1.5">1.5×</option>
              <option :value="2">2×</option>
            </select>
          </label>
        </div>
      </div>

      <ol class="sgw__steps">
        <li v-for="(step, at) in section.steps" :key="at" :class="{ 'is-active': at === active }">
          <button type="button" class="sgw__step" :aria-current="at === active ? 'step' : undefined" @click="go(at)">
            <span class="sgw__num">{{ at + 1 }}</span>
            <span class="sgw__say">
              {{ step.say }}
              <span class="sgw__meta">
                <span class="sgw__action">{{ actionLabel(step.action) }}</span>
                <code dir="ltr">{{ step.target }}</code>
                <template v-if="step.value && step.action !== 'click'">
                  → <code dir="ltr">{{ step.value }}</code>
                </template>
              </span>
            </span>
          </button>
        </li>
      </ol>
    </div>
    <p v-if="section.verify" class="sgw__verify">
      <CheckCircle2 class="sgw__i" aria-hidden="true" /> {{ section.verify }}
    </p>
  </section>
</template>

<script setup lang="ts">
/**
 * One GUI recipe: its steps as text, and the same steps animated on a 3D
 * monitor with a moving mouse pointer. The list is the source of truth and the
 * animation follows it - clicking a step jumps the animation there - so the
 * animation can never show something the text does not say.
 *
 * The product chrome in the steps (button and field labels) is the product's
 * own English, like the portal itself; the sentence around it is the recipe's.
 */
import { onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { CheckCircle2, ChevronLeft, ChevronRight, Pause, Play, RotateCcw } from 'lucide-vue-next';
import { hasWebGL } from '@/stage3d/loader';
import type { GuiAction, GuiSection } from '@/utils/labDocs';
import { themePalette } from './themePalette';
import { t } from '@/i18n/runtime';

const props = defineProps<{ section: GuiSection; autoplay?: boolean }>();

/** Literal `t()` calls so the catalogue scan sees every label it has to cover. */
function actionLabel(action: GuiAction): string {
  switch (action) {
    case 'type': return t('Type');
    case 'select': return t('Choose');
    case 'check': return t('Tick');
    case 'drag': return t('Drag');
    case 'see': return t('Look at');
    default: return t('Click');
  }
}

const canvas = ref<HTMLCanvasElement | null>(null);
const webgl = hasWebGL();
const reduced = typeof window !== 'undefined' && (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches || false);
const active = ref(0);
const playing = ref(false);
const speed = ref(1);
let player: { play(): void; pause(): void; goTo(i: number): void; setSpeed(s: number): void; dispose(): void } | null = null;
let generation = 0;

async function build() {
  const mine = ++generation;
  player?.dispose();
  player = null;
  if (!webgl || !canvas.value) return;
  try {
    const mod = await import('@/utils/labDocs3d/walkthroughStage');
    if (mine !== generation || !canvas.value) return;
    player = mod.createWalkthrough(canvas.value, props.section, themePalette(), {
      reduced,
      onStep: (i) => { active.value = i; },
      onEnd: () => { playing.value = false; },
    });
    player.setSpeed(speed.value);
    if (props.autoplay && !reduced) { player.play(); playing.value = true; }
  } catch {
    player = null;
  }
}

function toggle() {
  if (!player) return;
  if (playing.value) player.pause(); else player.play();
  playing.value = !playing.value;
}
function go(i: number) {
  active.value = Math.max(0, Math.min(props.section.steps.length - 1, i));
  player?.goTo(active.value);
}
function restart() {
  player?.goTo(0);
  active.value = 0;
  if (!reduced && player) { player.play(); playing.value = true; }
}

watch(speed, s => player?.setSpeed(s));
watch(() => props.section, () => { active.value = 0; playing.value = false; build(); });
onMounted(build);
onBeforeUnmount(() => { generation += 1; player?.dispose(); });
</script>

<style scoped>
.sgw { border: 1px solid rgb(var(--sfs-line-rgb, 148 163 184) / 0.3); border-radius: 12px; padding: 0.9rem; margin: 0.75rem 0;
  background: rgb(var(--sfs-tint-rgb, 255 255 255) / 0.04); }
.sgw__head { display: flex; align-items: center; gap: 0.6rem; flex-wrap: wrap; }
.sgw__chip { color: #fff; font-size: 0.75rem; font-weight: 700; padding: 0.2rem 0.55rem; border-radius: 999px; }
.sgw__title { margin: 0; font-size: 1rem; }
.sgw__cmd { margin: 0.4rem 0 0.6rem; font-size: 0.85rem; color: var(--sfs-text-muted, #94a3b8); overflow-wrap: anywhere; }
.sgw__cmd code, .sgw__meta code { font-size: 0.8rem; padding: 0.05rem 0.35rem; border-radius: 5px;
  background: rgb(var(--sfs-sink-rgb, 0 0 0) / 0.3); color: var(--sfs-text, #e5e7eb); overflow-wrap: anywhere; }
.sgw__grid { display: grid; grid-template-columns: minmax(0, 1.25fr) minmax(0, 1fr); gap: 0.9rem; align-items: start; }
@media (max-width: 900px) { .sgw__grid { grid-template-columns: minmax(0, 1fr); } }
.sgw__stage { aspect-ratio: 16 / 10; border-radius: 10px; overflow: hidden;
  background: radial-gradient(ellipse at 50% 20%, rgb(var(--sfs-accent-rgb, 102 126 234) / 0.18), transparent 70%),
              rgb(var(--sfs-sink-rgb, 0 0 0) / 0.3); }
.sgw__canvas { display: block; width: 100%; height: 100%; }
.sgw__controls { display: flex; flex-wrap: wrap; align-items: center; gap: 0.4rem; margin-top: 0.5rem; }
.sgw__speed { display: inline-flex; align-items: center; gap: 0.3rem; font-size: 0.8rem; margin-inline-start: auto; }
.sgw__i { width: 1em; height: 1em; vertical-align: -0.12em; }
.sgw__sr { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); }
.sgw__steps { list-style: none; margin: 0; padding: 0; display: grid; gap: 0.35rem; }
.sgw__step { display: flex; gap: 0.6rem; width: 100%; text-align: start; background: transparent; border: 1px solid transparent;
  border-radius: 8px; padding: 0.45rem 0.5rem; color: inherit; cursor: pointer; font: inherit; }
.sgw__step:hover { background: rgb(var(--sfs-tint-rgb, 255 255 255) / 0.06); }
.is-active .sgw__step { border-color: var(--sfs-accent, #667eea); background: rgb(var(--sfs-accent-rgb, 102 126 234) / 0.12); }
.sgw__num { flex: none; width: 1.6rem; height: 1.6rem; border-radius: 50%; display: grid; place-items: center; font-weight: 700;
  font-size: 0.8rem; background: rgb(var(--sfs-tint-rgb, 255 255 255) / 0.12); }
.is-active .sgw__num { background: var(--sfs-accent, #667eea); color: var(--sfs-on-accent, #fff); }
.sgw__say { font-size: 0.9rem; line-height: 1.45; min-width: 0; }
.sgw__meta { display: flex; flex-wrap: wrap; align-items: center; gap: 0.3rem; margin-top: 0.25rem; font-size: 0.78rem;
  color: var(--sfs-text-muted, #94a3b8); }
.sgw__action { font-weight: 700; text-transform: uppercase; letter-spacing: 0.03em; font-size: 0.7rem; }
.sgw__verify { display: flex; gap: 0.4rem; align-items: center; margin: 0.6rem 0 0; font-size: 0.85rem; color: var(--sfs-success-text, #4ade80); }
</style>
