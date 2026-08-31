<template>
  <div class="ps-backdrop" @click.self="cancel">
    <div class="ps-modal" role="dialog" aria-modal="true" :aria-label="$t('Photo studio')">
      <header class="ps-head">
        <h3>{{ $t('Profile picture') }}</h3>
        <button class="ps-x" @click="cancel" :aria-label="$t('Close')">×</button>
      </header>

      <!-- ═══ No image yet: choose a source ═══ -->
      <div v-if="!sourceImage && !cameraOn" class="ps-choose">
        <p class="ps-lead">
          {{ $t('Start from a photo you already have, or take one now. You can reframe it and change its background in the next step — nothing is saved until you press Apply.') }}
        </p>
        <div class="ps-choose-grid">
          <label class="ps-choice">
            <input type="file" accept="image/png,image/jpeg,image/webp" @change="onFile" />
            <span class="ps-choice-ico">
              <svg width="26" height="26" viewBox="0 0 24 24" fill="currentColor"><path d="M9 16h6v-6h4l-7-7-7 7h4v6zm-4 2h14v2H5v-2z"/></svg>
            </span>
            <strong>{{ $t('Upload a photo') }}</strong>
            <small>{{ $t('PNG, JPG or WEBP') }}</small>
          </label>

          <button class="ps-choice" @click="startCamera">
            <span class="ps-choice-ico">
              <svg width="26" height="26" viewBox="0 0 24 24" fill="currentColor"><path d="M12 15.2a3.2 3.2 0 100-6.4 3.2 3.2 0 000 6.4zM9 4l-1.83 2H4a2 2 0 00-2 2v10a2 2 0 002 2h16a2 2 0 002-2V8a2 2 0 00-2-2h-3.17L15 4H9zm3 14a6 6 0 110-12 6 6 0 010 12z"/></svg>
            </span>
            <strong>{{ $t('Take a photo') }}</strong>
            <small>{{ $t('Use your camera') }}</small>
          </button>
        </div>
        <p v-if="error" class="ps-error">{{ error }}</p>
      </div>

      <!-- ═══ Camera ═══ -->
      <div v-else-if="cameraOn" class="ps-camera">
        <div class="ps-camera-stage">
          <video ref="videoEl" autoplay playsinline muted
                 :class="{ mirrored: cameraMirrored }"></video>
          <div class="ps-guide" :class="`shape-${shape}`">
            <span class="ps-guide-face"></span>
            <span class="ps-guide-eyes"></span>
          </div>
        </div>
        <p class="ps-hint">
          {{ $t('Fill the circle with your head and shoulders, look at the lens, and keep the light in front of you. A plain wall behind you makes the background swap far cleaner.') }}
        </p>
        <div class="ps-camera-actions">
          <button class="ps-btn ps-btn-primary" :disabled="!cameraReady" @click="capture">
            {{ cameraReady ? 'Capture' : 'Starting camera…' }}
          </button>
          <button v-if="cameraDevices.length > 1" class="ps-btn ps-btn-ghost" @click="switchCamera">
            {{ $t('Switch camera') }}
          </button>
          <label class="ps-check">
            <input type="checkbox" v-model="cameraMirrored" /> {{ $t('Mirror preview') }}
          </label>
          <button class="ps-btn ps-btn-ghost" @click="stopCamera">{{ $t('Cancel') }}</button>
        </div>
        <p v-if="error" class="ps-error">{{ error }}</p>
      </div>

      <!-- ═══ Edit ═══ -->
      <div v-else class="ps-edit">
        <div class="ps-stage-col">
          <div class="ps-stage" :class="`shape-${shape}`"
               @pointerdown="onPointerDown" @pointermove="onPointerMove"
               @pointerup="onPointerUp" @pointercancel="onPointerUp"
               @wheel="onWheel">
            <canvas ref="canvasEl" :width="OUTPUT" :height="OUTPUT"></canvas>
            <div v-if="showGuide" class="ps-guide" :class="`shape-${shape}`">
              <span class="ps-guide-face"></span>
              <span class="ps-guide-eyes"></span>
            </div>
            <span v-if="masking" class="ps-working">{{ $t('working…') }}</span>
          </div>
          <p class="ps-drag-hint">{{ $t('Drag the picture to move it · scroll to zoom') }}</p>
          <label class="ps-check">
            <input type="checkbox" v-model="showGuide" /> {{ $t('Show framing guide') }}
          </label>
        </div>

        <div class="ps-controls">
          <!-- Framing -->
          <section class="ps-group">
            <h4>{{ $t('Position & size') }}</h4>
            <label class="ps-slider">
              <span>{{ $t('Zoom') }} <em>{{ edit.zoom.toFixed(2) }}×</em></span>
              <input type="range" min="0.5" max="4" step="0.01" v-model.number="edit.zoom" />
            </label>
            <label class="ps-slider">
              <span>{{ $t('Straighten') }} <em>{{ edit.rotation.toFixed(0) }}°</em></span>
              <input type="range" min="-20" max="20" step="0.5" v-model.number="edit.rotation" />
            </label>
            <div class="ps-row">
              <label class="ps-check">
                <input type="checkbox" v-model="edit.mirrored" /> {{ $t('Flip horizontally') }}
              </label>
              <button class="ps-btn ps-btn-ghost ps-btn-xs" @click="centreFrame">{{ $t('Re-centre') }}</button>
            </div>
            <div class="ps-nudge">
              <span>{{ $t('Nudge') }}</span>
              <button @click="nudge(0, -0.02)" :aria-label="$t('Up')">↑</button>
              <button @click="nudge(-0.02, 0)" :aria-label="$t('Left')">←</button>
              <button @click="nudge(0.02, 0)" :aria-label="$t('Right')">→</button>
              <button @click="nudge(0, 0.02)" :aria-label="$t('Down')">↓</button>
            </div>
          </section>

          <!-- Background -->
          <section class="ps-group">
            <h4>{{ $t('Background') }}</h4>
            <div class="ps-seg">
              <button v-for="option in BACKGROUND_STYLES" :key="option.key"
                      :class="{ active: edit.background_style === option.key }"
                      @click="setStyle(option.key)">{{ option.label }}</button>
            </div>

            <template v-if="edit.background_style !== 'keep'">
              <div class="ps-swatches">
                <button v-for="preset in PRESETS" :key="preset.value"
                        class="ps-swatch" :class="{ active: edit.background === preset.value }"
                        :style="{ background: preset.value }" :title="preset.name"
                        @click="setBackground(preset.value)"></button>
                <label class="ps-swatch-custom" :title="$t('Custom colour')">
                  <input type="color" :value="edit.background || '#F1F5F9'"
                         @input="setBackground(($event.target as HTMLInputElement).value.toUpperCase())" />
                </label>
              </div>

              <label class="ps-slider">
                <span>{{ $t('How much to replace') }} <em>{{ Math.round(edit.tolerance) }}</em></span>
                <input type="range" min="0" max="140" step="1" v-model.number="edit.tolerance" />
              </label>
              <label class="ps-slider">
                <span>{{ $t('Edge softness') }} <em>{{ $t('{v0}px', { v0: edit.feather.toFixed(0) }) }}</em></span>
                <input type="range" min="0" max="10" step="0.5" v-model.number="edit.feather" />
              </label>
              <label class="ps-slider">
                <span>{{ $t('Protect the person') }} <em>{{ Math.round(edit.protect * 100) }}%</em></span>
                <input type="range" min="0" max="1" step="0.02" v-model.number="edit.protect" />
              </label>

              <label class="ps-check">
                <input type="checkbox" v-model="showMask" />
                {{ $t('Highlight what will be replaced') }}
              </label>

              <p class="ps-note">
                {{ $t('The area inside the protected zone is never touched, so your face stays intact whatever the other sliders say. If part of you is being cut out, raise') }}
                <em>{{ $t('Protect the person') }}</em> {{ $t('or lower') }} <em>{{ $t('How much to replace') }}</em>.
              </p>
              <p v-if="busyBackground" class="ps-warn">
                {{ $t('The background in this photo is busy rather than a plain wall, so the swap will look patchy. A photo against a single-colour wall gives a much cleaner result — or leave the background as it is.') }}
              </p>
            </template>
            <p v-else class="ps-note">
              {{ $t('Keeping the photo exactly as taken. Choose a colour or gradient to replace whatever is behind you.') }}
            </p>
          </section>

          <!-- Source -->
          <section class="ps-group">
            <h4>{{ $t('Picture') }}</h4>
            <div class="ps-row wrap">
              <label class="ps-btn ps-btn-ghost ps-btn-xs ps-file">
                {{ $t('Choose another') }}
                <input type="file" accept="image/png,image/jpeg,image/webp" @change="onFile" />
              </label>
              <button class="ps-btn ps-btn-ghost ps-btn-xs" @click="startCamera">{{ $t('Retake') }}</button>
              <button v-if="canReloadOriginal" class="ps-btn ps-btn-ghost ps-btn-xs"
                      :disabled="loadingOriginal" @click="reloadOriginal">
                {{ loadingOriginal ? 'Loading…' : 'Reframe the original' }}
              </button>
            </div>
            <p v-if="fromEditedCopy" class="ps-note">
              {{ $t('You are editing the version already on your CV. “Reframe the original” goes back to the untouched upload, which keeps the quality.') }}
            </p>
          </section>
        </div>
      </div>

      <footer v-if="sourceImage && !cameraOn" class="ps-foot">
        <p v-if="error" class="ps-error ps-error-inline">{{ error }}</p>
        <button class="ps-btn ps-btn-ghost" @click="cancel">{{ $t('Cancel') }}</button>
        <button class="ps-btn ps-btn-primary" :disabled="applying" @click="apply">
          {{ applying ? 'Applying…' : 'Apply to my CV' }}
        </button>
      </footer>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, reactive, ref, watch } from 'vue';
import { cvBuilderService, type CvPhotoEdit } from '@/services/cvbuilder.service';
import {
  BUSY_BACKGROUND_SPREAD, boxBlur, floodFillBackground, sampleBorder, shade,
} from './photoMask';

const props = defineProps<{
  userId: string;
  /** The CV's photo shape, so the framing mask matches what will be printed. */
  shape: 'circle' | 'rounded' | 'square';
  /** The picture currently on the CV, if any. */
  currentDataUrl?: string;
  /** Repo path of the untouched upload, so the original can be reframed later. */
  sourcePath?: string;
  initialEdit?: Partial<CvPhotoEdit> | null;
}>();

const emit = defineEmits<{
  (e: 'apply', payload: { dataUrl: string; edit: CvPhotoEdit; original: Blob | null }): void;
  (e: 'cancel'): void;
}>();

/** The exported picture is square; 640px is ample for a CV at print size. */
const OUTPUT = 640;
/** The subject mask is computed at this size and scaled up - fast and smooth. */
const MASK_EDGE = 256;
/** Source pixels are capped so a 12MP phone photo does not sit in memory. */
const SOURCE_EDGE = 1280;

const BACKGROUND_STYLES = [
  { key: 'keep', label: 'Keep as is' },
  { key: 'solid', label: 'Solid colour' },
  { key: 'gradient', label: 'Soft gradient' },
] as const;

const PRESETS = [
  { name: 'Studio white', value: '#FFFFFF' },
  { name: 'Light grey', value: '#F1F5F9' },
  { name: 'Warm grey', value: '#EAE7E1' },
  { name: 'Soft blue', value: '#DCE9F7' },
  { name: 'Slate', value: '#475569' },
  { name: 'Navy', value: '#1E293B' },
  { name: 'Deep teal', value: '#0F5257' },
  { name: 'Charcoal', value: '#27272A' },
];

const DEFAULT_EDIT: CvPhotoEdit = {
  zoom: 1, offset_x: 0, offset_y: 0, rotation: 0, mirrored: false,
  background: '', background_style: 'keep', tolerance: 44, feather: 2,
  protect: 0.5, source: '',
};

const edit = reactive<CvPhotoEdit>({ ...DEFAULT_EDIT, ...(props.initialEdit || {}) });

const canvasEl = ref<HTMLCanvasElement | null>(null);
const videoEl = ref<HTMLVideoElement | null>(null);

const sourceImage = ref<HTMLImageElement | null>(null);
const originalBlob = ref<Blob | null>(null);
const fromEditedCopy = ref(false);
const error = ref('');
const applying = ref(false);
const masking = ref(false);
const busyBackground = ref(false);
const showMask = ref(false);
const showGuide = ref(true);
const loadingOriginal = ref(false);

const cameraOn = ref(false);
const cameraReady = ref(false);
const cameraMirrored = ref(true);
const cameraDevices = ref<MediaDeviceInfo[]>([]);
const cameraIndex = ref(0);
let cameraStream: MediaStream | null = null;

/** The source with its background made transparent. Rebuilt only when it must be. */
let cutout: HTMLCanvasElement | null = null;
let maskTimer: number | null = null;

const canReloadOriginal = computed(() =>
  !!props.sourcePath && (fromEditedCopy.value || !originalBlob.value));

// ---------------------------------------------------------------------------
// Loading a source
// ---------------------------------------------------------------------------

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('That image could not be read.'));
    image.src = src;
  });
}

/**
 * Cap the source to SOURCE_EDGE and return both the image and its bytes.
 *
 * The bytes are what gets archived in the data repo; capping them keeps a phone
 * photo from becoming a multi-megabyte record while leaving plenty of headroom
 * for cropping into a 640px frame.
 */
async function ingest(src: string, mime = 'image/jpeg'): Promise<void> {
  const raw = await loadImage(src);
  const scale = Math.min(1, SOURCE_EDGE / Math.max(raw.width, raw.height));
  const width = Math.max(1, Math.round(raw.width * scale));
  const height = Math.max(1, Math.round(raw.height * scale));

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('This browser cannot process images on a canvas.');
  ctx.drawImage(raw, 0, 0, width, height);

  const type = mime === 'image/png' ? 'image/png' : 'image/jpeg';
  const dataUrl = canvas.toDataURL(type, 0.92);
  sourceImage.value = await loadImage(dataUrl);
  originalBlob.value = await new Promise<Blob | null>(resolve =>
    canvas.toBlob(blob => resolve(blob), type, 0.92));

  cutout = null;
  scheduleMask(true);
}

async function onFile(event: Event) {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0];
  input.value = '';
  if (!file) return;

  error.value = '';
  try {
    const dataUrl = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = () => reject(new Error('That file could not be read.'));
      reader.readAsDataURL(file);
    });
    await ingest(dataUrl, file.type);
    fromEditedCopy.value = false;
    edit.source = 'upload';
    resetFraming();
  } catch (e: any) {
    error.value = e?.message || 'That image could not be loaded.';
  }
}

async function reloadOriginal() {
  if (!props.sourcePath) return;
  loadingOriginal.value = true;
  error.value = '';
  try {
    const dataUrl = await cvBuilderService.getImageDataUrl(props.userId, props.sourcePath);
    await ingest(dataUrl, 'image/jpeg');
    // Re-uploading the original would just duplicate it in the repo.
    originalBlob.value = null;
    fromEditedCopy.value = false;
  } catch (e: any) {
    error.value = e?.message
      || 'The original upload could not be loaded. You can still edit the current picture.';
  } finally {
    loadingOriginal.value = false;
  }
}

// ---------------------------------------------------------------------------
// Camera
// ---------------------------------------------------------------------------

async function startCamera() {
  error.value = '';
  if (!navigator.mediaDevices?.getUserMedia) {
    error.value = 'This browser cannot use the camera. Upload a photo instead.';
    return;
  }

  cameraOn.value = true;
  cameraReady.value = false;
  await nextTick();

  try {
    stopStream();
    const device = cameraDevices.value[cameraIndex.value];
    cameraStream = await navigator.mediaDevices.getUserMedia({
      video: device?.deviceId
        ? { deviceId: { exact: device.deviceId }, width: { ideal: 1280 }, height: { ideal: 1280 } }
        : { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 1280 } },
      audio: false,
    });

    if (videoEl.value) {
      videoEl.value.srcObject = cameraStream;
      await videoEl.value.play().catch(() => undefined);
    }
    cameraReady.value = true;

    // Labels are only populated once permission has been granted, so the device
    // list is read after getUserMedia rather than before it.
    const devices = await navigator.mediaDevices.enumerateDevices();
    cameraDevices.value = devices.filter(d => d.kind === 'videoinput');
  } catch (e: any) {
    cameraOn.value = false;
    error.value = e?.name === 'NotAllowedError'
      ? 'Camera permission was denied. Allow it in your browser, or upload a photo instead.'
      : `The camera could not be opened: ${e?.message || e}`;
  }
}

async function switchCamera() {
  if (cameraDevices.value.length < 2) return;
  cameraIndex.value = (cameraIndex.value + 1) % cameraDevices.value.length;
  await startCamera();
}

function stopStream() {
  cameraStream?.getTracks().forEach(track => track.stop());
  cameraStream = null;
}

function stopCamera() {
  stopStream();
  cameraOn.value = false;
  cameraReady.value = false;
}

async function capture() {
  const video = videoEl.value;
  if (!video || !video.videoWidth) return;

  // Centre-crop the frame to a square so what was inside the guide is what is kept.
  const side = Math.min(video.videoWidth, video.videoHeight);
  const canvas = document.createElement('canvas');
  canvas.width = side;
  canvas.height = side;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  if (cameraMirrored.value) {
    // The preview is mirrored so it feels like a mirror; the capture matches it,
    // otherwise the photo looks "wrong" to the person who just posed for it.
    ctx.translate(side, 0);
    ctx.scale(-1, 1);
  }
  ctx.drawImage(video, (video.videoWidth - side) / 2, (video.videoHeight - side) / 2,
                side, side, 0, 0, side, side);

  stopCamera();
  try {
    await ingest(canvas.toDataURL('image/jpeg', 0.92), 'image/jpeg');
    fromEditedCopy.value = false;
    edit.source = 'camera';
    resetFraming();
  } catch (e: any) {
    error.value = e?.message || 'That capture could not be processed.';
  }
}

// ---------------------------------------------------------------------------
// Framing
// ---------------------------------------------------------------------------

function resetFraming() {
  edit.zoom = 1;
  edit.offset_x = 0;
  edit.offset_y = 0;
  edit.rotation = 0;
  render();
}

function centreFrame() {
  edit.offset_x = 0;
  edit.offset_y = 0;
  render();
}

function nudge(dx: number, dy: number) {
  edit.offset_x = clamp(edit.offset_x + dx, -1.5, 1.5);
  edit.offset_y = clamp(edit.offset_y + dy, -1.5, 1.5);
  render();
}

function setStyle(key: 'keep' | 'solid' | 'gradient') {
  edit.background_style = key;
  // Switching to a replacement style with no colour picked yet would render an
  // invisible change, so fall back to the studio grey.
  if (key !== 'keep' && !edit.background) edit.background = PRESETS[1].value;
}

function setBackground(value: string) {
  edit.background = value;
  // Picking a colour is the user saying they want it used.
  if (edit.background_style === 'keep') setStyle('solid');
}

let dragging = false;
let lastX = 0;
let lastY = 0;

function onPointerDown(event: PointerEvent) {
  if (!sourceImage.value) return;
  dragging = true;
  lastX = event.clientX;
  lastY = event.clientY;
  (event.currentTarget as HTMLElement).setPointerCapture?.(event.pointerId);
}

function onPointerMove(event: PointerEvent) {
  if (!dragging) return;
  const stage = (event.currentTarget as HTMLElement).getBoundingClientRect();
  edit.offset_x = clamp(edit.offset_x + (event.clientX - lastX) / stage.width, -1.5, 1.5);
  edit.offset_y = clamp(edit.offset_y + (event.clientY - lastY) / stage.height, -1.5, 1.5);
  lastX = event.clientX;
  lastY = event.clientY;
  render();
}

function onPointerUp(event: PointerEvent) {
  dragging = false;
  (event.currentTarget as HTMLElement).releasePointerCapture?.(event.pointerId);
}

function onWheel(event: WheelEvent) {
  if (!sourceImage.value) return;
  event.preventDefault();
  edit.zoom = clamp(edit.zoom * (event.deltaY < 0 ? 1.06 : 0.94), 0.5, 4);
  render();
}

function clamp(value: number, low: number, high: number) {
  return Math.max(low, Math.min(high, value));
}

// ---------------------------------------------------------------------------
// Background replacement
//
// The mask is computed in the *source* image's own space, not in the framed
// crop. That matters: at a high zoom the frame's border can be all skin, and a
// border-seeded fill would then eat the face. The source image's border is
// where the background actually is. It also means panning and zooming never
// recompute the mask - only the sliders do.
// ---------------------------------------------------------------------------

function scheduleMask(immediate = false) {
  if (maskTimer) window.clearTimeout(maskTimer);
  if (edit.background_style === 'keep') {
    cutout = null;
    render();
    return;
  }
  masking.value = true;
  maskTimer = window.setTimeout(() => {
    buildCutout();
    masking.value = false;
    render();
  }, immediate ? 0 : 140);
}

function buildCutout() {
  const image = sourceImage.value;
  if (!image) return;

  const width = image.width;
  const height = image.height;
  const maskScale = Math.min(1, MASK_EDGE / Math.max(width, height));
  const mw = Math.max(8, Math.round(width * maskScale));
  const mh = Math.max(8, Math.round(height * maskScale));

  const small = document.createElement('canvas');
  small.width = mw;
  small.height = mh;
  const smallCtx = small.getContext('2d', { willReadFrequently: true });
  if (!smallCtx) return;
  smallCtx.drawImage(image, 0, 0, mw, mh);
  const pixels = smallCtx.getImageData(0, 0, mw, mh).data;

  const { reference, spread } = sampleBorder(pixels, mw, mh);
  busyBackground.value = spread > BUSY_BACKGROUND_SPREAD;

  const alpha = floodFillBackground(pixels, mw, mh, reference, edit.tolerance, edit.protect);
  if (edit.feather > 0) boxBlur(alpha, mw, mh, Math.max(1, Math.round(edit.feather)));

  // Paint the mask into a canvas so the browser's own smoothing does the
  // upscale to full resolution.
  const maskCanvas = document.createElement('canvas');
  maskCanvas.width = mw;
  maskCanvas.height = mh;
  const maskCtx = maskCanvas.getContext('2d');
  if (!maskCtx) return;
  const maskData = maskCtx.createImageData(mw, mh);
  for (let i = 0; i < alpha.length; i++) {
    maskData.data[i * 4] = 255;
    maskData.data[i * 4 + 1] = 255;
    maskData.data[i * 4 + 2] = 255;
    maskData.data[i * 4 + 3] = alpha[i];
  }
  maskCtx.putImageData(maskData, 0, 0);

  const scaled = document.createElement('canvas');
  scaled.width = width;
  scaled.height = height;
  const scaledCtx = scaled.getContext('2d', { willReadFrequently: true });
  if (!scaledCtx) return;
  scaledCtx.imageSmoothingEnabled = true;
  scaledCtx.drawImage(maskCanvas, 0, 0, width, height);
  const upscaled = scaledCtx.getImageData(0, 0, width, height).data;

  const layer = document.createElement('canvas');
  layer.width = width;
  layer.height = height;
  const layerCtx = layer.getContext('2d', { willReadFrequently: true });
  if (!layerCtx) return;
  layerCtx.drawImage(image, 0, 0);
  const layerData = layerCtx.getImageData(0, 0, width, height);
  for (let i = 0; i < width * height; i++) {
    layerData.data[i * 4 + 3] = upscaled[i * 4 + 3];
  }
  layerCtx.putImageData(layerData, 0, 0);
  cutout = layer;
}

// ---------------------------------------------------------------------------
// Rendering
// ---------------------------------------------------------------------------

function paintBackground(ctx: CanvasRenderingContext2D, size: number) {
  const colour = edit.background || '#F1F5F9';
  if (edit.background_style === 'gradient') {
    const gradient = ctx.createLinearGradient(0, 0, 0, size);
    gradient.addColorStop(0, colour);
    gradient.addColorStop(1, shade(colour, -0.22));
    ctx.fillStyle = gradient;
  } else if (edit.background_style === 'solid') {
    ctx.fillStyle = colour;
  } else {
    // Nothing is being replaced, but the frame still needs a base in case the
    // picture is zoomed out past its edges.
    ctx.fillStyle = '#FFFFFF';
  }
  ctx.fillRect(0, 0, size, size);
}

function drawTo(canvas: HTMLCanvasElement, size: number, highlight = false) {
  const ctx = canvas.getContext('2d');
  const image = sourceImage.value;
  if (!ctx || !image) return;

  ctx.save();
  ctx.clearRect(0, 0, size, size);

  if (highlight) {
    // Magenta reads as "not a photo colour", so whatever shows through is
    // unmistakably the area about to be replaced.
    ctx.fillStyle = '#FF00A8';
    ctx.fillRect(0, 0, size, size);
  } else {
    paintBackground(ctx, size);
  }

  const layer: CanvasImageSource =
    (edit.background_style !== 'keep' && cutout) ? cutout : image;
  const layerWidth = (layer as HTMLCanvasElement | HTMLImageElement).width;
  const layerHeight = (layer as HTMLCanvasElement | HTMLImageElement).height;

  // Zoom 1 means "cover the frame", which is the framing a user expects to start from.
  const base = size / Math.min(layerWidth, layerHeight);
  const scale = base * edit.zoom;

  ctx.translate(size / 2 + edit.offset_x * size, size / 2 + edit.offset_y * size);
  ctx.rotate((edit.rotation * Math.PI) / 180);
  if (edit.mirrored) ctx.scale(-1, 1);
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(layer, (-layerWidth * scale) / 2, (-layerHeight * scale) / 2,
                layerWidth * scale, layerHeight * scale);
  ctx.restore();
}

function render() {
  if (canvasEl.value) drawTo(canvasEl.value, OUTPUT, showMask.value);
}

// Panning and zooming reuse the cached cutout; only these change the mask.
watch(() => [edit.tolerance, edit.feather, edit.protect], () => scheduleMask());
watch(() => edit.background_style, () => scheduleMask(true));
watch(() => [edit.background, edit.mirrored, edit.rotation, edit.zoom, showMask.value],
      () => render());
watch(sourceImage, () => nextTick(render));

// ---------------------------------------------------------------------------
// Apply / cancel
// ---------------------------------------------------------------------------

async function apply() {
  if (!sourceImage.value) return;
  applying.value = true;
  error.value = '';
  try {
    // Make sure a pending slider change is in the mask before exporting.
    if (maskTimer) {
      window.clearTimeout(maskTimer);
      maskTimer = null;
      if (edit.background_style !== 'keep') buildCutout();
      masking.value = false;
    }

    const out = document.createElement('canvas');
    out.width = OUTPUT;
    out.height = OUTPUT;
    drawTo(out, OUTPUT, false);

    emit('apply', {
      dataUrl: out.toDataURL('image/jpeg', 0.92),
      edit: { ...edit },
      original: originalBlob.value,
    });
  } catch (e: any) {
    error.value = e?.message || 'That picture could not be applied.';
  } finally {
    applying.value = false;
  }
}

function cancel() {
  stopCamera();
  emit('cancel');
}

onBeforeUnmount(() => {
  stopStream();
  if (maskTimer) window.clearTimeout(maskTimer);
});

// Open straight into the editor when the CV already has a picture.
(async () => {
  if (props.currentDataUrl) {
    try {
      await ingest(props.currentDataUrl, 'image/jpeg');
      fromEditedCopy.value = true;
      // The saved picture already has its background baked in, so reopening on
      // "keep" avoids replacing a replaced background by accident.
      edit.background_style = 'keep';
      await nextTick();
      render();
    } catch {
      error.value = 'The picture on your CV could not be loaded for editing. '
        + 'Choose or take a new one.';
    }
  }
})();
</script>

<style scoped>
.ps-backdrop {
  position: fixed; inset: 0; z-index: 1000; padding: 18px;
  background: rgb(var(--sfs-surface-rgb, 2 4 14) / 0.72); backdrop-filter: blur(4px);
  display: flex; align-items: flex-start; justify-content: center; overflow: auto;
}

.ps-modal {
  width: 100%; max-width: 900px; margin: 2vh 0;
  background: var(--sfs-surface-2, #12132a); border: 1px solid rgb(var(--sfs-line-rgb, 255 255 255) / 0.12);
  border-radius: 16px; color: var(--sfs-text, #fff); box-shadow: 0 24px 60px rgba(0, 0, 0, 0.5);
}

.ps-head {
  display: flex; align-items: center; justify-content: space-between;
  padding: 15px 18px; border-bottom: 1px solid rgb(var(--sfs-line-rgb, 255 255 255) / 0.09);
}
.ps-head h3 { font-size: 1.05rem; font-weight: 650; }
.ps-x {
  background: none; border: none; color: var(--sfs-text-muted, rgb(255 255 255 / 0.7));
  font-size: 1.6rem; line-height: 1; cursor: pointer;
}
.ps-x:hover { color: var(--sfs-text, #fff); }

.ps-lead, .ps-hint {
  color: var(--sfs-text-muted, rgb(255 255 255 / 0.7)); font-size: 0.87rem; line-height: 1.6;
}

/* ── Choose a source ─────────────────────────────────────────── */
.ps-choose { padding: 20px 18px 24px; }
.ps-choose-grid {
  display: grid; grid-template-columns: repeat(auto-fit, minmax(190px, 1fr));
  gap: 12px; margin-top: 16px;
}
.ps-choice {
  display: flex; flex-direction: column; align-items: center; gap: 5px;
  padding: 24px 16px; cursor: pointer; text-align: center;
  background: rgb(var(--sfs-tint-rgb, 255 255 255) / 0.04); color: var(--sfs-text, #fff); font-family: inherit;
  border: 1.5px dashed rgb(var(--sfs-line-rgb, 255 255 255) / 0.22); border-radius: 13px;
  transition: border-color 0.18s ease, background 0.18s ease, transform 0.18s ease;
}
.ps-choice:hover {
  border-color: rgb(var(--sfs-accent-2-rgb, 139 92 246) / 0.75); background: rgb(var(--sfs-accent-2-rgb, 139 92 246) / 0.09);
  transform: translateY(-2px);
}
.ps-choice input { display: none; }
.ps-choice-ico { color: var(--sfs-text-muted, #c4b5fd); }
.ps-choice strong { font-size: 0.94rem; }
.ps-choice small { color: var(--sfs-text-muted, rgb(255 255 255 / 0.7)); font-size: 0.77rem; }

/* ── Camera ──────────────────────────────────────────────────── */
.ps-camera { padding: 18px; }
.ps-camera-stage {
  position: relative; width: 100%; max-width: 380px; aspect-ratio: 1;
  margin: 0 auto 14px; border-radius: 12px; overflow: hidden; background: var(--sfs-space, #000);
}
.ps-camera-stage video { width: 100%; height: 100%; object-fit: cover; display: block; }
.ps-camera-stage video.mirrored { transform: scaleX(-1); }
.ps-camera-actions {
  display: flex; gap: 9px; align-items: center; flex-wrap: wrap;
  justify-content: center; margin-top: 14px;
}

/* ── Edit ────────────────────────────────────────────────────── */
.ps-edit {
  display: grid; grid-template-columns: minmax(0, 320px) minmax(0, 1fr);
  gap: 20px; padding: 18px;
}
.ps-stage-col { display: flex; flex-direction: column; gap: 9px; align-items: center; }
.ps-stage {
  position: relative; width: 100%; max-width: 320px; aspect-ratio: 1;
  overflow: hidden; touch-action: none; cursor: grab;
  background: repeating-conic-gradient(var(--sfs-surface-2, #1b1d38) 0% 25%, var(--sfs-surface-2, #202346) 0% 50%) 50% / 18px 18px;
}
.ps-stage:active { cursor: grabbing; }
.ps-stage.shape-circle { border-radius: 50%; }
.ps-stage.shape-rounded { border-radius: 18px; }
.ps-stage.shape-square { border-radius: 4px; }
.ps-stage canvas { width: 100%; height: 100%; display: block; }

.ps-guide { position: absolute; inset: 0; pointer-events: none; }
.ps-guide-face {
  position: absolute; left: 19%; top: 8%; width: 62%; height: 74%;
  border: 1.5px dashed rgb(var(--sfs-line-rgb, 255 255 255) / 0.5); border-radius: 50%;
}
.ps-guide-eyes {
  position: absolute; left: 12%; right: 12%; top: 40%; height: 0;
  border-top: 1px dashed rgb(var(--sfs-line-rgb, 255 255 255) / 0.32);
}

.ps-working {
  position: absolute; bottom: 8px; left: 50%; transform: translateX(-50%);
  background: rgb(var(--sfs-surface-rgb, 0 0 0) / 0.62); color: var(--sfs-text, #fff); font-size: 0.72rem;
  padding: 3px 10px; border-radius: 20px;
}
.ps-drag-hint { color: var(--sfs-text-muted, rgb(255 255 255 / 0.7)); font-size: 0.78rem; text-align: center; }

.ps-controls { display: flex; flex-direction: column; gap: 16px; min-width: 0; }
.ps-group {
  background: rgb(var(--sfs-tint-rgb, 255 255 255) / 0.04); border: 1px solid rgb(var(--sfs-line-rgb, 255 255 255) / 0.08);
  border-radius: 12px; padding: 14px;
}
.ps-group h4 {
  font-size: 0.74rem; font-weight: 700; text-transform: uppercase;
  letter-spacing: 0.07em; color: var(--sfs-text-muted, rgb(255 255 255 / 0.7)); margin-bottom: 11px;
}

.ps-slider { display: block; margin-bottom: 11px; }
.ps-slider > span {
  display: flex; justify-content: space-between; align-items: baseline;
  font-size: 0.8rem; color: rgb(var(--sfs-text-rgb, 255 255 255) / 0.72); margin-bottom: 5px;
}
.ps-slider em { font-style: normal; color: var(--sfs-text-muted, rgb(255 255 255 / 0.7)); font-variant-numeric: tabular-nums; }
.ps-slider input[type="range"] { width: 100%; accent-color: var(--sfs-accent-2, #8b5cf6); }

.ps-row { display: flex; align-items: center; justify-content: space-between; gap: 10px; }
.ps-row.wrap { flex-wrap: wrap; justify-content: flex-start; }
.ps-check {
  display: inline-flex; align-items: center; gap: 7px; cursor: pointer;
  font-size: 0.82rem; color: rgb(var(--sfs-text-rgb, 255 255 255) / 0.72);
}
.ps-check input { width: 15px; height: 15px; accent-color: var(--sfs-accent-2, #8b5cf6); }

.ps-nudge { display: flex; align-items: center; gap: 6px; margin-top: 10px; }
.ps-nudge span { font-size: 0.78rem; color: var(--sfs-text-muted, rgb(255 255 255 / 0.7)); margin-inline-end: 3px; }
.ps-nudge button {
  width: 28px; height: 28px; border-radius: 7px; cursor: pointer;
  background: rgb(var(--sfs-tint-rgb, 255 255 255) / 0.07); color: var(--sfs-text, #fff);
  border: 1px solid rgb(var(--sfs-line-rgb, 255 255 255) / 0.14); font-size: 0.85rem;
}
.ps-nudge button:hover { background: rgb(var(--sfs-tint-rgb, 255 255 255) / 0.14); }

.ps-seg {
  display: flex; gap: 4px; background: rgb(var(--sfs-sink-rgb, 0 0 0) / 0.28);
  border-radius: 9px; padding: 3px; margin-bottom: 12px;
}
.ps-seg button {
  flex: 1; padding: 7px 8px; border: none; border-radius: 7px; cursor: pointer;
  background: transparent; color: var(--sfs-text-muted, rgb(255 255 255 / 0.7));
  font-size: 0.78rem; font-weight: 600; font-family: inherit;
}
.ps-seg button.active { background: rgb(var(--sfs-accent-2-rgb, 139 92 246) / 0.35); color: var(--sfs-text, #fff); }

.ps-swatches { display: flex; flex-wrap: wrap; gap: 7px; margin-bottom: 13px; align-items: center; }
.ps-swatch {
  width: 28px; height: 28px; border-radius: 8px; cursor: pointer;
  border: 2px solid rgb(var(--sfs-line-rgb, 255 255 255) / 0.18);
}
.ps-swatch.active { border-color: var(--sfs-border-strong, #fff); box-shadow: 0 0 0 3px rgba(255, 255, 255, 0.18); }
.ps-swatch-custom { display: inline-flex; cursor: pointer; }
.ps-swatch-custom input {
  width: 28px; height: 28px; padding: 0; border: none; background: none; cursor: pointer;
}

.ps-note, .ps-warn {
  font-size: 0.78rem; line-height: 1.55; margin-top: 10px;
}
.ps-note { color: var(--sfs-text-muted, rgb(255 255 255 / 0.7)); }
.ps-note em { color: rgb(var(--sfs-text-rgb, 255 255 255) / 0.72); font-style: normal; }
.ps-warn {
  color: var(--sfs-warning-text, #fcd34d); background: rgb(var(--sfs-warning-rgb, 245 158 11) / 0.1);
  border: 1px solid rgb(var(--sfs-warning-rgb, 245 158 11) / 0.3); border-radius: 9px; padding: 9px 11px;
}

.ps-file { position: relative; overflow: hidden; }
.ps-file input { position: absolute; inset: 0; opacity: 0; cursor: pointer; }

/* ── Buttons / footer ────────────────────────────────────────── */
.ps-btn {
  display: inline-flex; align-items: center; gap: 6px; padding: 9px 16px;
  border: none; border-radius: 9px; font-size: 0.86rem; font-weight: 600;
  cursor: pointer; font-family: inherit;
  transition: transform 0.15s ease, filter 0.15s ease;
}
.ps-btn:hover:not(:disabled) { transform: translateY(-1px); filter: brightness(1.08); }
.ps-btn:disabled { opacity: 0.5; cursor: not-allowed; }
.ps-btn-xs { padding: 6px 11px; font-size: 0.78rem; border-radius: 7px; }
.ps-btn-primary { background: linear-gradient(135deg, var(--sfs-accent, #667eea), var(--sfs-accent-2, #764ba2)); color: var(--sfs-on-accent, #fff); }
.ps-btn-ghost {
  background: rgb(var(--sfs-tint-rgb, 255 255 255) / 0.07); color: rgb(var(--sfs-text-rgb, 255 255 255) / 0.85);
  border: 1px solid rgb(var(--sfs-line-rgb, 255 255 255) / 0.14);
}

.ps-foot {
  display: flex; gap: 9px; justify-content: flex-end; align-items: center;
  padding: 14px 18px; border-top: 1px solid rgb(var(--sfs-line-rgb, 255 255 255) / 0.09); flex-wrap: wrap;
}
.ps-error { color: var(--sfs-danger-text, #fca5a5); font-size: 0.83rem; line-height: 1.5; margin-top: 10px; }
.ps-error-inline { margin: 0; margin-inline-end: auto; flex: 1 1 200px; }

@media (max-width: 760px) {
  .ps-edit { grid-template-columns: 1fr; }
  .ps-stage { max-width: 280px; }
}
</style>
