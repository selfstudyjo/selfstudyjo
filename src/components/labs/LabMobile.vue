<template>
  <div class="sl-mob">
    <div class="sl-mob__bar">
      <label class="sl-mob__pick">
        <Smartphone :size="14" />
        <select v-model="device" @change="build()">
          <option v-for="d in devices" :key="d.id" :value="d.id">
            {{ d.label }} — {{ d.width }}×{{ d.height }}
          </option>
        </select>
      </label>
      <label v-if="pages.length > 1" class="sl-mob__pick">
        <Layers :size="14" />
        <select v-model="page" @change="build()">
          <option v-for="p in pages" :key="p" :value="p">{{ p }}</option>
        </select>
      </label>
      <button class="sl-mob__btn" :disabled="busy" @click="build()">
        <RotateCw :size="13" /> {{ $t('Reload') }}
      </button>
      <span class="sl-mob__zoom">{{ Math.round(scale * 100) }}%</span>
    </div>

    <div ref="stage" class="sl-mob__stage">
      <div class="sl-mob__device" :class="`is-${meta.platform}`"
           :style="frameStyle">
        <div v-if="meta.notch" class="sl-mob__notch"></div>
        <div class="sl-mob__screen" :style="screenStyle">
          <!--
            SANDBOXED, AND WITHOUT `allow-same-origin`.

            The document is compiled from the student's own pages and may
            contain their own script. `allow-same-origin` beside
            `allow-scripts` is not a sandbox - it is a same-origin script tag
            with extra steps, and the page would reach this document and the
            session token in it. `srcdoc`, never a blob URL, for the same
            reason: a `blob:` inherits THIS origin.

            THE FRAME IS THE DEVICE'S OWN PIXEL SIZE and the whole device is
            then scaled with a transform. Rendering at the pane's size and
            scaling the iframe's *contents* would be a lie: a media query at
            768px would fire on a phone, which is exactly the bug a device
            preview exists to catch.
          -->
          <iframe ref="frame" class="sl-mob__frame" :title="$t('App preview')"
                  sandbox="allow-scripts allow-forms allow-modals"
                  :style="innerStyle" :srcdoc="srcdoc"></iframe>
        </div>
        <div v-if="meta.platform === 'android'" class="sl-mob__nav">
          <span></span><span class="is-home"></span><span></span>
        </div>
      </div>
    </div>

    <p v-if="!serving" class="sl-mob__hint">
      {{ $t('Run') }} <code>ionic serve</code>
      {{ $t('in the console to build the app.') }}
    </p>
    <details v-else-if="log.length" class="sl-mob__log">
      <summary>{{ $t('{v0} network calls', { v0: log.length }) }}</summary>
      <ul><li v-for="(line, i) in log" :key="i"><code>{{ line }}</code></li></ul>
    </details>
  </div>
</template>

<script setup lang="ts">
/**
 * The PHONE pane: the student's Ionic app, rendered at a real device size.
 *
 * A mobile layout is a thing you have to see at the size it will be seen at,
 * and a 1400px browser window is the one size that never tells you the truth.
 * So the frame is the device's own pixel width and height, and the whole
 * device is scaled down with a `transform` to fit the pane.
 *
 * That distinction is the point of the component. Scaling the iframe's
 * CONTENTS instead - a zoom, or a smaller frame - would report the pane's
 * width to the page, so a `@media (max-width: 480px)` rule would fire on a
 * desktop and not fire on a phone. The preview would then be confidently
 * wrong about the one thing it exists to answer.
 */
import { computed, onBeforeUnmount, onMounted, ref } from 'vue';
import { Layers, RotateCw, Smartphone } from 'lucide-vue-next';

const props = defineProps<{
  toolId: string;
  run: (toolId: string, payload: Record<string, unknown>) => Promise<any>;
}>();

interface Device {
  id: string; label: string; width: number; height: number;
  platform: string; notch: boolean; radius: number;
}

const FALLBACK: Device = {
  id: 'iphone15', label: 'iPhone 15', width: 393, height: 852,
  platform: 'ios', notch: true, radius: 47,
};

const devices = ref<Device[]>([FALLBACK]);
const device = ref('iphone15');
const page = ref('');
const pages = ref<string[]>([]);
const srcdoc = ref('');
const log = ref<string[]>([]);
const serving = ref(false);
const busy = ref(false);
const scale = ref(1);
const stage = ref<HTMLElement | null>(null);

const meta = computed<Device>(() =>
  devices.value.find(d => d.id === device.value) || devices.value[0] || FALLBACK);

const frameStyle = computed(() => ({
  width: `${meta.value.width + 20}px`,
  height: `${meta.value.height + 20}px`,
  borderRadius: `${meta.value.radius + 8}px`,
  transform: `scale(${scale.value})`,
}));
const screenStyle = computed(() => ({
  width: `${meta.value.width}px`,
  height: `${meta.value.height}px`,
  borderRadius: `${Math.max(meta.value.radius - 4, 2)}px`,
}));
const innerStyle = computed(() => ({
  width: `${meta.value.width}px`,
  height: `${meta.value.height}px`,
}));

function fit() {
  const box = stage.value;
  if (!box) return;
  const available = {
    width: box.clientWidth - 24,
    height: box.clientHeight - 24,
  };
  const needed = { width: meta.value.width + 20, height: meta.value.height + 20 };
  if (needed.width <= 0 || needed.height <= 0) return;
  // Never scale UP: a 375px phone blown up to fill a 1200px pane looks like a
  // tablet, which is the same lie in the other direction.
  scale.value = Math.min(1, available.width / needed.width,
                         available.height / needed.height);
}

async function build() {
  busy.value = true;
  try {
    const result = await props.run(props.toolId, {
      device: device.value,
      page: page.value || undefined,
    });
    const preview = result?.preview;
    if (!result?.ok || !preview) {
      srcdoc.value = `<!doctype html><body style="font:14px system-ui;padding:22px;
color:#7f1d1d">${String(result?.error || 'The app could not be built')}</body>`;
      return;
    }
    if (Array.isArray(preview.devices) && preview.devices.length) {
      devices.value = preview.devices;
    }
    if (preview.device?.id) device.value = preview.device.id;
    pages.value = Array.isArray(preview.pages) ? preview.pages : [];
    if (preview.page) page.value = preview.page;
    serving.value = !!preview.serving;
    log.value = Array.isArray(preview.log) ? preview.log : [];
    srcdoc.value = String(preview.html || '');
  } finally {
    busy.value = false;
    fit();
  }
}

let observer: ResizeObserver | null = null;
onMounted(() => {
  build();
  if (typeof ResizeObserver !== 'undefined' && stage.value) {
    observer = new ResizeObserver(() => fit());
    observer.observe(stage.value);
  }
  window.addEventListener('resize', fit);
});
onBeforeUnmount(() => {
  observer?.disconnect();
  window.removeEventListener('resize', fit);
});

defineExpose({ reload: build });
</script>

<style scoped>
.sl-mob { display: flex; flex-direction: column; height: 100%; min-height: 0; }
.sl-mob__bar {
  display: flex; align-items: center; gap: 8px; flex-wrap: wrap; flex: 0 0 auto;
  padding: 7px 9px; border-bottom: 1px solid rgb(var(--sfs-line-rgb) / 0.16);
  background: rgb(var(--sfs-tint-rgb) / 0.05);
}
.sl-mob__pick {
  display: inline-flex; align-items: center; gap: 5px;
  background: rgb(var(--sfs-sink-rgb) / 0.14); border-radius: 8px;
  padding: 3px 8px; color: var(--sfs-text-muted);
}
.sl-mob__pick select {
  border: 0; background: transparent; color: var(--sfs-text);
  font-size: 0.78rem; outline: none; max-width: 190px;
}
.sl-mob__btn {
  display: inline-flex; align-items: center; gap: 5px; border: 0;
  border-radius: 8px; padding: 5px 10px; cursor: pointer; font-size: 0.78rem;
  background: rgb(var(--sfs-tint-rgb) / 0.12); color: var(--sfs-text);
}
.sl-mob__btn:disabled { opacity: 0.5; cursor: default; }
.sl-mob__zoom {
  margin-inline-start: auto; font-size: 0.72rem; color: var(--sfs-text-muted);
  font-variant-numeric: tabular-nums;
}
.sl-mob__stage {
  flex: 1 1 auto; min-height: 0; overflow: auto; display: flex;
  align-items: center; justify-content: center; padding: 12px;
  background:
    radial-gradient(circle at 50% 0%, rgb(var(--sfs-tint-rgb) / 0.07), transparent 60%),
    rgb(var(--sfs-sink-rgb) / 0.1);
  /* A device is a PLACE, not a paragraph: it must not mirror when the page
     flips. Same rule the newscast set and the score ring follow. */
  direction: ltr;
}
.sl-mob__device {
  position: relative; flex: 0 0 auto; padding: 10px; background: #14161c;
  transform-origin: center center;
  box-shadow: 0 18px 44px rgb(0 0 0 / 0.42), 0 0 0 2px #2a2e38 inset;
}
.sl-mob__device.is-web { padding: 6px; border-radius: 10px; }
.sl-mob__screen {
  position: relative; overflow: hidden; background: #fff;
}
.sl-mob__frame { border: 0; display: block; background: #fff; }
.sl-mob__notch {
  position: absolute; top: 12px; left: 50%; transform: translateX(-50%);
  width: 108px; height: 26px; background: #14161c; border-radius: 0 0 16px 16px;
  z-index: 2;
}
.sl-mob__nav {
  position: absolute; bottom: 12px; left: 50%; transform: translateX(-50%);
  display: flex; gap: 46px; align-items: center; z-index: 2;
}
.sl-mob__nav span {
  width: 9px; height: 9px; border-radius: 2px; background: #6d7280;
}
.sl-mob__nav span.is-home { width: 13px; height: 13px; border-radius: 50%; }
.sl-mob__hint {
  flex: 0 0 auto; margin: 0; padding: 8px 10px; font-size: 0.78rem;
  color: var(--sfs-text-muted);
  border-top: 1px solid rgb(var(--sfs-line-rgb) / 0.14);
}
.sl-mob__hint code, .sl-mob__log code {
  background: rgb(var(--sfs-sink-rgb) / 0.16); padding: 2px 6px;
  border-radius: 5px; font-family: ui-monospace, Consolas, monospace;
  direction: ltr; unicode-bidi: isolate;
}
.sl-mob__log {
  flex: 0 0 auto; max-height: 26%; overflow: auto; padding: 6px 10px;
  font-size: 0.75rem; border-top: 1px solid rgb(var(--sfs-line-rgb) / 0.14);
}
.sl-mob__log summary { cursor: pointer; color: var(--sfs-text-muted); }
.sl-mob__log ul { margin: 6px 0 0; padding-inline-start: 18px; }
</style>
