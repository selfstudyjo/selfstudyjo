<template>
  <div ref="host" class="canvas-host" :class="{ 'is-readonly': readonly, 'is-panning': spaceHeld }">
    <canvas
      ref="canvasEl"
      class="paper"
      :style="canvasStyle"
      @pointerdown="onPointerDown"
      @pointermove="onPointerMove"
      @pointerup="onPointerUp"
      @pointercancel="onPointerUp"
      @pointerleave="onPointerLeave"
      @wheel.prevent="onWheel"
      @contextmenu.prevent
    />

    <!-- Text is typed into a real textarea positioned over the canvas rather than
         keystroke-by-keystroke onto it: that is what gives an IME, autocorrect,
         selection and a caret for free, all of which a canvas-drawn caret does not
         have and mobile users need. -->
    <textarea
      v-if="textDraft"
      ref="textInput"
      v-model="textDraft.value"
      class="text-draft"
      :style="textDraftStyle"
      @blur="commitText"
      @keydown.esc.prevent="cancelText"
      @keydown.enter.exact.prevent="commitText"
    />

    <div v-if="readonly" class="readonly-badge">
      <span class="dot" /> View only
    </div>
  </div>
</template>

<script setup lang="ts">
/**
 * The drawing surface.
 *
 * It owns the pointer, the viewport (pan and zoom) and the render loop, and it owns
 * no persistence at all: it emits `commit` when a gesture finishes and `erase` when
 * strokes are rubbed out, and the parent decides what to do about the network. That
 * split is deliberate — it is what lets a stroke appear under the pointer instantly
 * while the save happens afterwards, and what keeps the retry logic out of the
 * event handlers.
 *
 * Three things here are worth understanding before changing them.
 *
 * **The scene is drawn to a backing canvas at device pixel ratio, and the CSS size
 * is separate.** Skipping that is why hand-drawn ink looks soft on a retina screen.
 *
 * **A stroke in progress is *not* in the scene array.** It lives in `drafting` and
 * is drawn on top each frame. Pushing it into the scene per sample would make every
 * pointer move a reactive array mutation, and Vue would re-run every watcher on the
 * scene several hundred times a stroke.
 *
 * **Rendering is requestAnimationFrame-coalesced.** Pointer events fire faster than
 * the display refreshes, so drawing synchronously in the handler means rendering the
 * same frame three times.
 */
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import {
    boundsOf, drawCursor, drawElement, drawSelection, elementsAt, isFreehand,
    nextZ, renderScene, simplify, sortScene, translateElement,
    type ElementData, type ElementKind, type SceneElement,
} from './drawEngine';

export interface ToolState {
    tool: ElementKind | 'select' | 'eraser' | 'pan';
    stroke: string;
    fill: string;
    width: number;
    fontSize: number;
    opacity: number;
}

export interface RemoteCursor {
    user_id: string;
    username: string;
    colour: string;
    cursor?: { x: number; y: number };
}

const props = withDefaults(defineProps<{
    elements: SceneElement[];
    toolState: ToolState;
    width: number;
    height: number;
    background: string;
    canvasColor: string;
    readonly?: boolean;
    cursors?: RemoteCursor[];
    authorId?: string;
    authorUsername?: string;
}>(), {
    readonly: false,
    cursors: () => [],
    authorId: '',
    authorUsername: '',
});

const emit = defineEmits<{
    (e: 'commit', elements: SceneElement[]): void;
    (e: 'erase', ids: string[]): void;
    (e: 'update', elements: SceneElement[]): void;
    (e: 'pointer', point: { x: number; y: number } | null): void;
    (e: 'select', element: SceneElement | null): void;
}>();

const host = ref<HTMLDivElement | null>(null);
const canvasEl = ref<HTMLCanvasElement | null>(null);
const textInput = ref<HTMLTextAreaElement | null>(null);

const scale = ref(1);
const offset = ref({ x: 0, y: 0 });
const spaceHeld = ref(false);

/** The gesture in flight. Kept out of `props.elements` on purpose — see the note in
 *  the component docstring. */
const drafting = ref<SceneElement | null>(null);
const selectedId = ref<string | null>(null);
const erasedThisStroke = ref<Set<string>>(new Set());
const dragFrom = ref<{ x: number; y: number } | null>(null);
const dragOrigin = ref<SceneElement | null>(null);
const panFrom = ref<{ x: number; y: number; ox: number; oy: number } | null>(null);
const textDraft = ref<{ x: number; y: number; value: string } | null>(null);

const images = new Map<string, HTMLImageElement>();
let frame = 0;
let pointerId: number | null = null;

const canvasStyle = computed(() => ({
    width: `${props.width * scale.value}px`,
    height: `${props.height * scale.value}px`,
    transform: `translate(${offset.value.x}px, ${offset.value.y}px)`,
}));

const textDraftStyle = computed(() => {
    if (!textDraft.value) return {};
    return {
        left: `${textDraft.value.x * scale.value + offset.value.x}px`,
        top: `${textDraft.value.y * scale.value + offset.value.y}px`,
        fontSize: `${props.toolState.fontSize * scale.value}px`,
        color: props.toolState.stroke,
    };
});

// ---------------------------------------------------------------------------
// Rendering
// ---------------------------------------------------------------------------

function schedule() {
    if (frame) return;
    frame = requestAnimationFrame(() => {
        frame = 0;
        render();
    });
}

function render() {
    const canvas = canvasEl.value;
    if (!canvas) return;

    // Backing store at device resolution, CSS box at logical size. Without this,
    // ink is visibly soft on any high-DPI display.
    const ratio = Math.min(window.devicePixelRatio || 1, 2.5);
    const pixelWidth = Math.round(props.width * scale.value * ratio);
    const pixelHeight = Math.round(props.height * scale.value * ratio);
    if (canvas.width !== pixelWidth || canvas.height !== pixelHeight) {
        canvas.width = pixelWidth;
        canvas.height = pixelHeight;
    }

    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.setTransform(ratio * scale.value, 0, 0, ratio * scale.value, 0, 0);

    renderScene(ctx, props.elements, {
        kind: props.background,
        width: props.width,
        height: props.height,
        colour: props.canvasColor,
    }, images);

    if (drafting.value) drawElement(ctx, drafting.value, images);

    const selected = props.elements.find(e => e.element_id === selectedId.value);
    if (selected) drawSelection(ctx, boundsOf(selected), scale.value);

    for (const person of props.cursors) {
        if (!person.cursor || person.user_id === props.authorId) continue;
        drawCursor(ctx, person.cursor.x, person.cursor.y, person.username,
                   person.colour, scale.value);
    }
}

/** Images are loaded once and cached, then a redraw is scheduled when each arrives.
 *  Without the redraw an image element stays a dashed placeholder until the next
 *  unrelated pointer move, which reads as a failed paste. */
watch(() => props.elements, elements => {
    for (const element of elements) {
        const src = element.data?.src;
        if (element.kind !== 'image' || !src || images.has(src)) continue;
        const image = new Image();
        image.onload = () => schedule();
        image.src = src;
        images.set(src, image);
    }
    schedule();
}, { deep: true, immediate: true });

watch([() => props.background, () => props.canvasColor, () => props.width,
       () => props.height, () => props.cursors, scale, offset], schedule,
      { deep: true });

// ---------------------------------------------------------------------------
// Coordinates
// ---------------------------------------------------------------------------

/** Screen to paper. Every handler goes through this, so pan and zoom are handled in
 *  exactly one place and no gesture has to know they exist. */
function toPaper(event: PointerEvent): { x: number; y: number } {
    const canvas = canvasEl.value!;
    const box = canvas.getBoundingClientRect();
    return {
        x: (event.clientX - box.left) / scale.value,
        y: (event.clientY - box.top) / scale.value,
    };
}

// ---------------------------------------------------------------------------
// Pointer
// ---------------------------------------------------------------------------

function onPointerDown(event: PointerEvent) {
    const canvas = canvasEl.value;
    if (!canvas) return;
    const point = toPaper(event);

    // Middle button or held space pans, whatever the selected tool is. A viewer with
    // no write access can still pan and zoom — looking is not editing.
    if (event.button === 1 || spaceHeld.value || props.toolState.tool === 'pan') {
        panFrom.value = { x: event.clientX, y: event.clientY,
                          ox: offset.value.x, oy: offset.value.y };
        canvas.setPointerCapture(event.pointerId);
        pointerId = event.pointerId;
        return;
    }

    if (props.readonly) return;
    canvas.setPointerCapture(event.pointerId);
    pointerId = event.pointerId;

    const tool = props.toolState.tool;

    if (tool === 'select') {
        const hit = elementsAt(props.elements, point.x, point.y)[0] || null;
        selectedId.value = hit?.element_id || null;
        emit('select', hit);
        if (hit) {
            dragFrom.value = point;
            dragOrigin.value = hit;
        }
        schedule();
        return;
    }

    if (tool === 'eraser') {
        erasedThisStroke.value = new Set();
        eraseAt(point);
        return;
    }

    if (tool === 'text' || tool === 'sticky') {
        openTextDraft(point);
        return;
    }

    drafting.value = {
        element_id: crypto.randomUUID(),
        kind: tool as ElementKind,
        z: nextZ(props.elements),
        author_id: props.authorId,
        author_username: props.authorUsername,
        data: baseData(tool as ElementKind, point),
    };
    schedule();
}

function baseData(kind: ElementKind, point: { x: number; y: number }): ElementData {
    const state = props.toolState;
    const common: ElementData = {
        stroke: state.stroke,
        width: state.width,
        opacity: kind === 'highlighter' ? undefined : state.opacity,
    };
    if (isFreehand(kind)) {
        return { ...common, points: [point.x, point.y] };
    }
    return { ...common, x: point.x, y: point.y, w: 0, h: 0,
             fill: state.fill, arrowEnd: kind === 'arrow' };
}

function onPointerMove(event: PointerEvent) {
    const point = canvasEl.value ? toPaper(event) : null;
    if (point) emit('pointer', point);

    if (panFrom.value) {
        offset.value = {
            x: panFrom.value.ox + (event.clientX - panFrom.value.x),
            y: panFrom.value.oy + (event.clientY - panFrom.value.y),
        };
        return;
    }
    if (props.readonly || !point) return;

    if (dragFrom.value && dragOrigin.value) {
        const moved = translateElement(dragOrigin.value,
                                      point.x - dragFrom.value.x,
                                      point.y - dragFrom.value.y);
        emit('update', [moved]);
        return;
    }

    if (props.toolState.tool === 'eraser' && pointerId !== null) {
        eraseAt(point);
        return;
    }

    const draft = drafting.value;
    if (!draft) return;

    if (isFreehand(draft.kind)) {
        // Mutating the draft's own array rather than replacing it: this runs once per
        // pointer sample, and a fresh array each time is hundreds of allocations a
        // stroke for no benefit — nothing watches this object deeply.
        draft.data.points!.push(point.x, point.y);
    } else {
        draft.data.w = point.x - (draft.data.x || 0);
        draft.data.h = point.y - (draft.data.y || 0);
        // Shift constrains: a square, a circle, or a 45° line. Standard in every
        // drawing tool, and the only way to get a true square by hand.
        if (event.shiftKey) {
            const size = Math.max(Math.abs(draft.data.w), Math.abs(draft.data.h));
            draft.data.w = Math.sign(draft.data.w || 1) * size;
            draft.data.h = Math.sign(draft.data.h || 1) * size;
        }
    }
    schedule();
}

function onPointerUp(event: PointerEvent) {
    if (pointerId !== null && canvasEl.value?.hasPointerCapture?.(pointerId)) {
        canvasEl.value.releasePointerCapture(pointerId);
    }
    pointerId = null;

    if (panFrom.value) {
        panFrom.value = null;
        return;
    }

    if (dragFrom.value && dragOrigin.value) {
        const moved = props.elements.find(e => e.element_id === dragOrigin.value!.element_id);
        dragFrom.value = null;
        dragOrigin.value = null;
        if (moved) emit('commit', [moved]);
        return;
    }

    if (props.toolState.tool === 'eraser') {
        const ids = [...erasedThisStroke.value];
        erasedThisStroke.value = new Set();
        if (ids.length) emit('erase', ids);
        return;
    }

    const draft = drafting.value;
    drafting.value = null;
    if (!draft) return;

    if (isFreehand(draft.kind)) {
        const points = draft.data.points || [];
        if (points.length < 2) return;
        // Simplified only here, on the way out. The user has already seen every
        // sample they made; the wire carries the ones that change the shape.
        draft.data.points = simplify(points);
    } else if (Math.abs(draft.data.w || 0) < 2 && Math.abs(draft.data.h || 0) < 2) {
        // A click rather than a drag. Dropped rather than stored as a zero-size
        // shape, which would be invisible and un-erasable.
        return;
    }
    emit('commit', [draft]);
    schedule();
}

function onPointerLeave() {
    // Tell the other participants the cursor has left, so their canvas does not keep
    // a stale pointer parked at the edge.
    emit('pointer', null);
}

function eraseAt(point: { x: number; y: number }) {
    const radius = Math.max(8, props.toolState.width * 2);
    for (const element of elementsAt(props.elements, point.x, point.y, radius)) {
        if (erasedThisStroke.value.has(element.element_id)) continue;
        erasedThisStroke.value.add(element.element_id);
    }
    if (erasedThisStroke.value.size) {
        // Removed from view straight away and reported on pointer-up as one batch.
        // One request per erased stroke would be dozens of requests for one sweep.
        emit('update', [...erasedThisStroke.value].map(id => ({
            element_id: id, kind: 'pen' as ElementKind, data: {}, z: 0, deleted: true,
        })));
    }
}

// ---------------------------------------------------------------------------
// Text
// ---------------------------------------------------------------------------

function openTextDraft(point: { x: number; y: number }) {
    textDraft.value = { x: point.x, y: point.y, value: '' };
    nextTick(() => textInput.value?.focus());
}

function commitText() {
    const draft = textDraft.value;
    textDraft.value = null;
    if (!draft || !draft.value.trim()) return;

    const isSticky = props.toolState.tool === 'sticky';
    emit('commit', [{
        element_id: crypto.randomUUID(),
        kind: isSticky ? 'sticky' : 'text',
        z: nextZ(props.elements),
        author_id: props.authorId,
        author_username: props.authorUsername,
        data: {
            x: draft.x,
            y: draft.y,
            w: isSticky ? 220 : 420,
            h: isSticky ? 180 : undefined,
            text: draft.value,
            fontSize: props.toolState.fontSize,
            stroke: props.toolState.stroke,
            fill: isSticky ? (props.toolState.fill === 'transparent'
                              ? '#fef08a' : props.toolState.fill) : undefined,
        },
    }]);
}

function cancelText() {
    textDraft.value = null;
}

// ---------------------------------------------------------------------------
// Viewport
// ---------------------------------------------------------------------------

function onWheel(event: WheelEvent) {
    if (event.ctrlKey || event.metaKey) {
        zoomAt(event.clientX, event.clientY, event.deltaY < 0 ? 1.1 : 1 / 1.1);
        return;
    }
    offset.value = {
        x: offset.value.x - event.deltaX,
        y: offset.value.y - event.deltaY,
    };
}

/** Zoom about the pointer rather than about the origin, so the thing under the
 *  cursor stays under the cursor. Zooming about the origin makes a zoomed-in canvas
 *  effectively impossible to navigate. */
function zoomAt(clientX: number, clientY: number, factor: number) {
    const canvas = canvasEl.value;
    if (!canvas) return;
    const box = canvas.getBoundingClientRect();
    const before = { x: (clientX - box.left) / scale.value,
                     y: (clientY - box.top) / scale.value };
    const next = Math.max(0.15, Math.min(6, scale.value * factor));
    if (next === scale.value) return;
    scale.value = next;
    offset.value = {
        x: offset.value.x + (clientX - box.left) - before.x * next,
        y: offset.value.y + (clientY - box.top) - before.y * next,
    };
}

function fit() {
    const box = host.value?.getBoundingClientRect();
    if (!box) return;
    const next = Math.min((box.width - 48) / props.width,
                          (box.height - 48) / props.height, 1);
    scale.value = Math.max(0.15, next);
    offset.value = {
        x: Math.max(24, (box.width - props.width * scale.value) / 2),
        y: Math.max(24, (box.height - props.height * scale.value) / 2),
    };
}

function onKeyDown(event: KeyboardEvent) {
    // Ignored while a textarea has focus, or space would pan instead of typing.
    const target = event.target as HTMLElement | null;
    if (target && ['INPUT', 'TEXTAREA'].includes(target.tagName)) return;

    if (event.code === 'Space') {
        spaceHeld.value = true;
        event.preventDefault();
        return;
    }
    if ((event.key === 'Delete' || event.key === 'Backspace') && selectedId.value
        && !props.readonly) {
        emit('erase', [selectedId.value]);
        emit('update', [{ element_id: selectedId.value, kind: 'pen' as ElementKind,
                          data: {}, z: 0, deleted: true }]);
        selectedId.value = null;
        emit('select', null);
        event.preventDefault();
    }
    if (event.key === '0' && (event.ctrlKey || event.metaKey)) {
        fit();
        event.preventDefault();
    }
}

function onKeyUp(event: KeyboardEvent) {
    if (event.code === 'Space') spaceHeld.value = false;
}

onMounted(() => {
    fit();
    render();
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('resize', schedule);
});

onBeforeUnmount(() => {
    if (frame) cancelAnimationFrame(frame);
    window.removeEventListener('keydown', onKeyDown);
    window.removeEventListener('keyup', onKeyUp);
    window.removeEventListener('resize', schedule);
});

/** A PNG of the current scene, for the paper's preview card.
 *
 *  Rendered to an off-screen canvas at a fixed small size rather than by reading the
 *  visible one: the visible canvas carries the current zoom, the pan offset and
 *  other people's cursors, none of which belong in a thumbnail. */
function thumbnail(maxWidth = 480): string {
    const ratio = maxWidth / props.width;
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(props.width * ratio);
    canvas.height = Math.round(props.height * ratio);
    const ctx = canvas.getContext('2d');
    if (!ctx) return '';
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    renderScene(ctx, props.elements, {
        kind: props.background, width: props.width, height: props.height,
        colour: props.canvasColor,
    }, images);
    return canvas.toDataURL('image/png');
}

function clearSelection() {
    selectedId.value = null;
    emit('select', null);
    schedule();
}

defineExpose({ fit, thumbnail, zoomIn: () => zoomAt(0, 0, 1.2),
               zoomOut: () => zoomAt(0, 0, 1 / 1.2), scale, clearSelection,
               selectedId });
</script>

<style scoped>
.canvas-host {
  position: relative;
  flex: 1;
  min-height: 0;
  overflow: hidden;
  background:
    radial-gradient(circle at 20% 20%, rgb(var(--sfs-accent-rgb, 59 130 246) / 0.08), transparent 45%),
    radial-gradient(circle at 80% 70%, rgb(var(--sfs-accent-2-rgb, 168 85 247) / 0.08), transparent 45%),
    var(--sfs-paper, #eef2f7);
  touch-action: none;
}

.paper {
  position: absolute;
  top: 0;
  left: 0;
  transform-origin: 0 0;
  border-radius: 8px;
  box-shadow: 0 12px 40px rgba(15, 23, 42, 0.16), 0 0 0 1px rgba(15, 23, 42, 0.06);
  cursor: crosshair;
}

.is-readonly .paper { cursor: default; }
.is-panning .paper { cursor: grab; }

.text-draft {
  position: absolute;
  min-width: 200px;
  min-height: 2.2em;
  padding: 4px 6px;
  border: 2px dashed var(--sfs-accent-wash, #2563eb);
  border-radius: 6px;
  background: rgb(var(--sfs-tint-rgb, 255 255 255) / 0.96);
  font-family: Inter, system-ui, sans-serif;
  line-height: 1.3;
  resize: both;
  outline: none;
}

.readonly-badge {
  position: absolute;
  top: 14px;
  right: 14px;
  display: flex;
  align-items: center;
  gap: 7px;
  padding: 6px 12px;
  border-radius: 999px;
  background: rgb(var(--sfs-surface-rgb, 15 23 42) / 0.82);
  color: var(--sfs-text, #f8fafc);
  font-size: 0.78rem;
  font-weight: 600;
  letter-spacing: 0.01em;
  backdrop-filter: blur(6px);
}

.readonly-badge .dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: var(--sfs-warning, #fbbf24);
}
</style>
