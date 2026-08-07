<template>
  <div class="toolbar" :class="{ 'is-readonly': readonly }">
    <!-- Tools -->
    <div class="group">
      <button
        v-for="item in tools"
        :key="item.tool"
        class="tool"
        :class="{ active: modelValue.tool === item.tool }"
        :disabled="readonly && !item.viewerAllowed"
        :title="`${item.label}${item.key ? ` (${item.key})` : ''}`"
        @click="pick(item.tool)"
      >
        <span class="glyph" v-html="item.glyph" />
        <span class="tool-label">{{ item.label }}</span>
      </button>
    </div>

    <div class="divider" />

    <!-- Stroke colour. A fixed palette rather than only a colour picker: a swatch is
         one tap on a tablet, which is what most of these papers are drawn on. -->
    <div class="group">
      <div class="swatches">
        <button
          v-for="colour in STROKE_COLOURS"
          :key="colour"
          class="swatch"
          :class="{ active: modelValue.stroke === colour }"
          :style="{ background: colour }"
          :disabled="readonly"
          :title="colour"
          @click="update({ stroke: colour })"
        />
        <label class="swatch custom" :class="{ disabled: readonly }" title="Any colour">
          <input
            type="color"
            :value="modelValue.stroke"
            :disabled="readonly"
            @input="update({ stroke: ($event.target as HTMLInputElement).value })"
          >
          <span>+</span>
        </label>
      </div>
    </div>

    <div class="divider" />

    <!-- Fill -->
    <div class="group">
      <span class="field-label">Fill</span>
      <div class="swatches">
        <button
          class="swatch none"
          :class="{ active: modelValue.fill === 'transparent' }"
          :disabled="readonly"
          title="No fill"
          @click="update({ fill: 'transparent' })"
        />
        <button
          v-for="colour in FILL_COLOURS"
          :key="colour"
          class="swatch"
          :class="{ active: modelValue.fill === colour }"
          :style="{ background: colour }"
          :disabled="readonly"
          @click="update({ fill: colour })"
        />
      </div>
    </div>

    <div class="divider" />

    <!-- Size. Doubles as the eraser radius and the font size, because the control
         the user reaches for is "how big", not "which property". -->
    <div class="group grow">
      <span class="field-label">{{ sizeLabel }}</span>
      <input
        type="range"
        class="slider"
        :min="sizeRange.min"
        :max="sizeRange.max"
        :value="sizeValue"
        :disabled="readonly"
        @input="onSize(($event.target as HTMLInputElement).value)"
      >
      <span class="size-value">{{ sizeValue }}</span>
    </div>

    <div class="divider" />

    <!-- History and viewport -->
    <div class="group">
      <button class="icon-btn" :disabled="readonly || !canUndo" title="Undo (Ctrl Z)"
              @click="$emit('undo')">↶</button>
      <button class="icon-btn" :disabled="readonly || !canRedo" title="Redo (Ctrl Shift Z)"
              @click="$emit('redo')">↷</button>
      <button class="icon-btn" title="Zoom out" @click="$emit('zoom-out')">−</button>
      <button class="icon-btn wide" title="Fit to screen (Ctrl 0)" @click="$emit('fit')">
        {{ Math.round(zoom * 100) }}%
      </button>
      <button class="icon-btn" title="Zoom in" @click="$emit('zoom-in')">+</button>
    </div>

    <div class="divider" />

    <div class="group">
      <button class="icon-btn danger" :disabled="readonly" title="Clear the page"
              @click="$emit('clear')">Clear</button>
    </div>
  </div>
</template>

<script setup lang="ts">
/**
 * The tool palette.
 *
 * Presentational: it owns no drawing state, only the currently-selected tool and
 * its settings, which it emits back through `v-model`. The canvas reads that object
 * and never the other way round, so there is one source of truth for "what is the
 * pen doing".
 *
 * A read-only viewer still gets `select` and `pan` — looking at a paper means being
 * able to move round it and click something to see it. Everything that writes is
 * disabled rather than hidden, so a viewer can see what the paper's author had
 * available rather than being shown a different app.
 */
import { computed } from 'vue';
import type { ToolState } from './DrawCanvas.vue';

const props = defineProps<{
    modelValue: ToolState;
    zoom: number;
    canUndo: boolean;
    canRedo: boolean;
    readonly?: boolean;
}>();

const emit = defineEmits<{
    (e: 'update:modelValue', value: ToolState): void;
    (e: 'undo'): void;
    (e: 'redo'): void;
    (e: 'clear'): void;
    (e: 'fit'): void;
    (e: 'zoom-in'): void;
    (e: 'zoom-out'): void;
}>();

export interface ToolDef {
    tool: ToolState['tool'];
    label: string;
    glyph: string;
    key?: string;
    viewerAllowed?: boolean;
}

const svg = (body: string) =>
    `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">${body}</svg>`;

const tools: ToolDef[] = [
    { tool: 'select', label: 'Select', key: 'V', viewerAllowed: true,
      glyph: svg('<path d="M4 3l7 17 2-6 6-2z"/>') },
    { tool: 'pan', label: 'Pan', key: 'Space', viewerAllowed: true,
      glyph: svg('<path d="M9 11V5a1.5 1.5 0 013 0v6m0-2a1.5 1.5 0 013 0v2m0-1a1.5 1.5 0 013 0v5a6 6 0 01-6 6h-1a6 6 0 01-6-6v-4a1.5 1.5 0 013 0"/>') },
    { tool: 'pen', label: 'Pen', key: 'P',
      glyph: svg('<path d="M3 21l3-1 11-11-2-2L4 18z"/><path d="M15 5l2-2 2 2-2 2z"/>') },
    { tool: 'marker', label: 'Marker', key: 'M',
      glyph: svg('<path d="M5 19h14"/><path d="M8 15l8-9 3 3-8 9H8z"/>') },
    { tool: 'highlighter', label: 'Highlight', key: 'H',
      glyph: svg('<path d="M4 20h16"/><rect x="7" y="5" width="7" height="11" rx="1.5"/>') },
    { tool: 'eraser', label: 'Eraser', key: 'E',
      glyph: svg('<path d="M8 20h11"/><path d="M14 5l5 5-8 8H6l-2-2z"/>') },
    { tool: 'line', label: 'Line', key: 'L', glyph: svg('<path d="M4 20L20 4"/>') },
    { tool: 'arrow', label: 'Arrow', key: 'A',
      glyph: svg('<path d="M4 20L20 4"/><path d="M13 4h7v7"/>') },
    { tool: 'rect', label: 'Rectangle', key: 'R',
      glyph: svg('<rect x="4" y="6" width="16" height="12" rx="1.5"/>') },
    { tool: 'ellipse', label: 'Ellipse', key: 'O',
      glyph: svg('<ellipse cx="12" cy="12" rx="8" ry="6"/>') },
    { tool: 'triangle', label: 'Triangle',
      glyph: svg('<path d="M12 5l8 14H4z"/>') },
    { tool: 'diamond', label: 'Diamond',
      glyph: svg('<path d="M12 4l8 8-8 8-8-8z"/>') },
    { tool: 'star', label: 'Star',
      glyph: svg('<path d="M12 4l2.5 5.5 6 .7-4.4 4.1 1.2 5.9L12 17.3 6.7 20.2l1.2-5.9L3.5 10.2l6-.7z"/>') },
    { tool: 'text', label: 'Text', key: 'T',
      glyph: svg('<path d="M5 6h14"/><path d="M12 6v13"/>') },
    { tool: 'sticky', label: 'Sticky note', key: 'N',
      glyph: svg('<path d="M5 4h14v10l-5 5H5z"/><path d="M19 14h-5v5"/>') },
];

const STROKE_COLOURS = [
    '#111827', '#dc2626', '#2563eb', '#16a34a', '#d97706', '#7c3aed', '#0891b2',
    '#db2777', '#ffffff',
];

const FILL_COLOURS = [
    '#fee2e2', '#dbeafe', '#dcfce7', '#fef3c7', '#ede9fe', '#cffafe', '#fce7f3',
    '#f1f5f9',
];

/** One slider, three meanings, and the label says which. A separate control per
 *  property would be three sliders where two are always irrelevant. */
const sizeLabel = computed(() => {
    if (props.modelValue.tool === 'eraser') return 'Eraser';
    if (['text', 'sticky'].includes(props.modelValue.tool)) return 'Text size';
    return 'Size';
});

const sizeRange = computed(() =>
    ['text', 'sticky'].includes(props.modelValue.tool)
        ? { min: 10, max: 72 }
        : { min: 1, max: 48 });

const sizeValue = computed(() =>
    ['text', 'sticky'].includes(props.modelValue.tool)
        ? props.modelValue.fontSize
        : props.modelValue.width);

function onSize(raw: string) {
    const value = parseInt(raw) || 1;
    update(['text', 'sticky'].includes(props.modelValue.tool)
        ? { fontSize: value } : { width: value });
}

function update(patch: Partial<ToolState>) {
    emit('update:modelValue', { ...props.modelValue, ...patch });
}

function pick(tool: ToolState['tool']) {
    // A highlighter is a wide translucent pen, so switching to it bumps the width if
    // the user was on a fine pen — a 2px highlighter is not a highlighter.
    const patch: Partial<ToolState> = { tool };
    if (tool === 'highlighter' && props.modelValue.width < 12) patch.width = 18;
    if (tool === 'marker' && props.modelValue.width < 6) patch.width = 8;
    if (tool === 'pen' && props.modelValue.width > 12) patch.width = 3;
    update(patch);
}

defineExpose({ tools });
</script>

<style scoped>
.toolbar {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
  padding: 10px 14px;
  background: rgba(255, 255, 255, 0.94);
  border-bottom: 1px solid rgba(15, 23, 42, 0.08);
  backdrop-filter: blur(10px);
}

.group {
  display: flex;
  align-items: center;
  gap: 6px;
}

.group.grow { flex: 1; min-width: 170px; }

.divider {
  width: 1px;
  align-self: stretch;
  margin: 2px 2px;
  background: rgba(15, 23, 42, 0.1);
}

.tool {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
  min-width: 46px;
  padding: 6px 6px 5px;
  border: 1px solid transparent;
  border-radius: 9px;
  background: transparent;
  color: #334155;
  cursor: pointer;
  transition: background 0.15s, color 0.15s, border-color 0.15s;
}

.tool:hover:not(:disabled) { background: rgba(37, 99, 235, 0.08); }

.tool.active {
  background: #2563eb;
  border-color: #1d4ed8;
  color: #fff;
  box-shadow: 0 4px 12px rgba(37, 99, 235, 0.28);
}

.tool:disabled { opacity: 0.35; cursor: not-allowed; }

.glyph { display: flex; }
.tool-label { font-size: 0.62rem; font-weight: 600; letter-spacing: 0.01em; }

.field-label {
  font-size: 0.7rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: #64748b;
}

.swatches { display: flex; gap: 4px; align-items: center; }

.swatch {
  width: 22px;
  height: 22px;
  border: 2px solid rgba(15, 23, 42, 0.15);
  border-radius: 6px;
  padding: 0;
  cursor: pointer;
  transition: transform 0.12s, border-color 0.12s;
}

.swatch:hover:not(:disabled) { transform: scale(1.12); }
.swatch.active { border-color: #2563eb; box-shadow: 0 0 0 2px rgba(37, 99, 235, 0.25); }
.swatch:disabled { opacity: 0.4; cursor: not-allowed; }

/* A diagonal line, which is the conventional way to say "no fill" and needs no
   label to be understood. */
.swatch.none {
  background:
    linear-gradient(to top right, transparent calc(50% - 1px), #dc2626 50%,
                    transparent calc(50% + 1px)),
    #fff;
}

.swatch.custom {
  position: relative;
  display: grid;
  place-items: center;
  background: linear-gradient(135deg, #f87171, #60a5fa, #4ade80);
  color: #fff;
  font-weight: 700;
  font-size: 0.8rem;
}

.swatch.custom input { position: absolute; inset: 0; opacity: 0; cursor: pointer; }
.swatch.custom.disabled { opacity: 0.4; }

.slider { flex: 1; min-width: 70px; accent-color: #2563eb; }

.size-value {
  min-width: 24px;
  font-size: 0.75rem;
  font-weight: 700;
  color: #334155;
  text-align: right;
}

.icon-btn {
  min-width: 30px;
  height: 30px;
  padding: 0 8px;
  border: 1px solid rgba(15, 23, 42, 0.12);
  border-radius: 8px;
  background: #fff;
  color: #334155;
  font-size: 0.82rem;
  font-weight: 600;
  cursor: pointer;
  transition: background 0.15s, border-color 0.15s;
}

.icon-btn.wide { min-width: 54px; }
.icon-btn:hover:not(:disabled) { background: #f1f5f9; border-color: rgba(15, 23, 42, 0.22); }
.icon-btn:disabled { opacity: 0.4; cursor: not-allowed; }
.icon-btn.danger { color: #b91c1c; border-color: rgba(185, 28, 28, 0.25); }
.icon-btn.danger:hover:not(:disabled) { background: #fef2f2; }

@media (max-width: 900px) {
  .tool-label { display: none; }
  .tool { min-width: 36px; }
}
</style>
