<template>
  <div class="qb" dir="ltr">
    <div class="qb-tabs">
      <div class="qb-tab is-active">
        <span class="qb-fav" aria-hidden="true">QA</span>
        <span class="qb-tab__title">{{ page ? page.title : 'New tab' }}</span>
      </div>
      <div class="qb-spacer"></div>
      <button type="button" class="qb-chip" :class="{ 'is-on': devtools }" @click="devtools = !devtools">
        {{ devtools ? 'Hide DevTools' : 'DevTools' }}
      </button>
    </div>

    <div class="qb-bar">
      <button type="button" class="qb-icon" title="Back" :disabled="busy || !page?.can_back" @click="run([cli(['qa', 'ui', 'back'])])">&#8592;</button>
      <button type="button" class="qb-icon" title="Reload" :disabled="busy" @click="run([cli(['qa', 'ui', 'reload'])])">&#8635;</button>
      <form class="qb-omni" @submit.prevent="openTyped">
        <span class="qb-lock" aria-hidden="true">&#128274;</span>
        <input v-model="address" class="qb-omni__input" spellcheck="false" aria-label="Address" @focus="editing = true" @blur="editing = false">
      </form>
      <button type="button" class="qb-rec" :class="{ 'is-on': page?.recording }" :disabled="busy"
              @click="run([cli(['qa', 'ui', 'record', page?.recording ? 'stop' : 'start'])])">
        <span class="qb-rec__dot"></span>{{ page?.recording ? 'Stop recording' : 'Record' }}
      </button>
      <button type="button" class="qb-icon" title="New browser context (sign out, empty cart)" :disabled="busy"
              @click="run([cli(['qa', 'ui', 'reset'])])">&#10227;</button>
    </div>

    <div v-if="devtools" class="qb-device">
      <label>Device
        <select :value="page?.device.name" :disabled="busy" @change="setDevice(($event.target as HTMLSelectElement).value)">
          <option v-for="d in devices" :key="d.name" :value="d.name">{{ d.name }}</option>
        </select>
      </label>
      <span class="qb-dim">{{ page?.device.width }} &times; {{ page?.device.height }}</span>
      <span class="qb-dim">Signed in: {{ page?.user || 'no' }}</span>
      <span class="qb-dim">Cart: {{ page?.cart_count ?? 0 }}</span>
    </div>

    <div class="qb-main">
      <section class="qb-viewport" :class="{ 'is-emulated': emulated }">
        <div v-if="!page" class="qb-empty">
          <p>Open QA Shop to start testing by hand.</p>
          <button type="button" class="qb-primary" :disabled="busy" @click="run([cli(['qa', 'ui', 'open', '/'])])">Open http://qa-shop.local</button>
        </div>
        <div v-else class="qb-frame" :style="emulated ? { width: page.device.width + 'px' } : undefined">
          <QaPage :page="page" :busy="busy" :compact="page.device.width < 600" :build="build" @act="act" />
        </div>
      </section>

      <aside v-if="devtools" class="qb-tools">
        <div class="qb-tools__tabs">
          <button type="button" :class="{ 'is-active': panel === 'console' }" @click="panel = 'console'">Console</button>
          <button type="button" :class="{ 'is-active': panel === 'recorder' }" @click="panel = 'recorder'">Recorder</button>
          <button type="button" :class="{ 'is-active': panel === 'elements' }" @click="panel = 'elements'">Elements</button>
        </div>
        <div v-if="panel === 'console'" class="qb-tools__body">
          <p v-if="page?.note" class="qb-log">&#8250; {{ page.note }}</p>
          <p v-for="obs in recentObs" :key="obs.id" class="qb-log qb-log--warn">
            &#9888; {{ obs.id }} - {{ obs.summary }}<br><small>Possible defect recorded. File it in the Bug Tracker.</small>
          </p>
          <p v-if="!page?.note && !recentObs.length" class="qb-muted">Nothing logged yet. Anything that does not match the spec is recorded here as an observation.</p>
        </div>
        <div v-else-if="panel === 'recorder'" class="qb-tools__body">
          <p class="qb-muted">Press <b>Record</b>, click through a flow, then generate a Playwright test from it.</p>
          <ol class="qb-steps">
            <li v-for="(s, i) in page?.steps || []" :key="i">{{ describe(s) }}</li>
          </ol>
          <form class="qb-gen" @submit.prevent="generate">
            <label>File <input v-model="genOut" spellcheck="false"></label>
            <label>Test name <input v-model="genName" spellcheck="false"></label>
            <button type="submit" class="qb-primary" :disabled="busy || (page?.steps.length || 0) < 2">Generate test</button>
          </form>
        </div>
        <div v-else class="qb-tools__body qb-elements">
          <div v-for="el in page?.elements || []" :key="el.id" class="qb-el">
            <code>&lt;{{ el.tag }}<template v-if="el.id"> id="{{ el.id }}"</template><template v-if="el.testid"> data-testid="{{ el.testid }}"</template><template v-if="el.tag === 'img'"> alt="{{ el.name }}"</template>&gt;</code>
            <span v-if="!el.visible" class="qb-badge">off-screen</span>
          </div>
        </div>
      </aside>
    </div>

    <div class="qb-flashes" aria-live="polite">
      <div v-for="f in api.flashes.value" :key="f.id" class="qb-flash" :class="'qb-flash--' + f.type">
        <b>{{ f.title }}</b> <span v-if="f.detail">{{ f.detail }}</span>
        <button type="button" aria-label="Dismiss" @click="api.dismiss(f.id)">&times;</button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { cli, pick, rows } from '@/utils/portalKit';
import type { PortalApi } from '../usePortal';
import QaPage from './QaPage.vue';
import { devicesOf, pageOf, uiCommands } from './qaKit';

const props = defineProps<{ view: Record<string, any>; api: PortalApi; tool: any; busy?: boolean }>();
const emit = defineEmits<{ (e: 'location', url: string): void; (e: 'refresh'): void }>();

const page = computed(() => pageOf(props.view));
const devices = computed(() => devicesOf(props.view));
const build = computed(() => String(pick(props.view, 'build', '1.0')));
const busy = computed(() => Boolean(props.busy) || props.api.busy.value);
const devtools = ref(true);
const panel = ref<'console' | 'recorder' | 'elements'>('console');
const address = ref('http://qa-shop.local/');
const editing = ref(false);
const genOut = ref('tests/test_recorded.py');
const genName = ref('test_recorded_flow');
const emulated = computed(() => !!page.value && page.value.device.platform !== 'desktop');
const seenObs = ref(0);
const observations = computed(() => rows<any>(props.view, 'observations'));
const recentObs = computed(() => observations.value.slice(seenObs.value).slice(-5).reverse());

watch(() => page.value?.url, url => {
    if (url && !editing.value) address.value = url;
    if (url) emit('location', url);
}, { immediate: true });
watch(() => page.value?.recording, on => { if (on) panel.value = 'recorder'; });

async function run(commands: string[]) {
    for (const command of commands) {
        const result = await props.api.exec(command);
        if (!result.ok) return false;
    }
    return true;
}
function act(fills: Record<string, string>, clickId: string) {
    void run(uiCommands(fills, clickId));
}
function openTyped() {
    const raw = address.value.trim().replace(/^https?:\/\/qa-shop\.local/i, '') || '/';
    void run([cli(['qa', 'ui', 'open', raw.startsWith('/') ? raw : '/' + raw])]);
}
function setDevice(name: string) {
    void run([cli(['qa', 'ui', 'device', name])]);
}
async function generate() {
    const ok = await run([cli(['qa', 'ui', 'codegen'], { '--out': genOut.value, '--name': genName.value })]);
    if (ok) props.api.notify('success', `Wrote ${genOut.value}`, 'Run it in Playwright Test or with pytest.');
}
function describe(step: any) {
    if (step.action === 'goto') return `Navigate to ${step.path}`;
    if (step.action === 'fill') return `Fill "${step.label || step.id}" with "${step.value}"`;
    if (step.action === 'click') return `Click "${step.text || step.id}"`;
    if (step.action === 'device') return `Emulate ${step.device}`;
    return step.action;
}
</script>

<style scoped>
.qb { --qb-bg: #dee1e6; --qb-ink: #202124; display: flex; flex-direction: column; height: 100%; min-height: 560px;
  background: var(--qb-bg); color: var(--qb-ink); font: 13px/1.4 system-ui, 'Segoe UI', Roboto, sans-serif; position: relative; }
.qb-tabs { display: flex; align-items: flex-end; padding: 8px 8px 0; gap: 6px; }
.qb-tab { display: flex; align-items: center; gap: 8px; background: #fff; border-radius: 8px 8px 0 0; padding: 7px 14px; max-width: 260px; }
.qb-tab__title { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.qb-fav { background: #14b8a6; color: #04201d; border-radius: 4px; font-size: 10px; font-weight: 700; padding: 1px 4px; }
.qb-spacer { flex: 1; }
.qb-chip { border: 0; background: transparent; border-radius: 6px; padding: 5px 10px; cursor: pointer; color: var(--qb-ink); font: inherit; }
.qb-chip.is-on { background: #fff; }
.qb-bar { display: flex; gap: 6px; align-items: center; padding: 6px 8px; background: #fff; border-bottom: 1px solid #dadce0; }
.qb-icon { width: 32px; height: 32px; border: 0; border-radius: 50%; background: transparent; cursor: pointer; font-size: 16px; color: #5f6368; }
.qb-icon:hover:not(:disabled) { background: #f1f3f4; }
.qb-icon:disabled { opacity: .4; }
.qb-omni { flex: 1; display: flex; align-items: center; background: #f1f3f4; border-radius: 16px; padding: 0 12px; min-width: 0; }
.qb-lock { font-size: 11px; margin-right: 6px; }
.qb-omni__input { flex: 1; min-width: 0; border: 0; background: transparent; padding: 7px 0; font: inherit; color: var(--qb-ink); outline: none; }
.qb-rec { display: inline-flex; align-items: center; gap: 6px; border: 1px solid #dadce0; background: #fff; border-radius: 16px; padding: 5px 12px; cursor: pointer; font: inherit; color: var(--qb-ink); }
.qb-rec__dot { width: 9px; height: 9px; border-radius: 50%; background: #9aa0a6; }
.qb-rec.is-on { border-color: #d93025; color: #d93025; }
.qb-rec.is-on .qb-rec__dot { background: #d93025; animation: qb-blink 1s infinite; }
@keyframes qb-blink { 50% { opacity: .2; } }
@media (prefers-reduced-motion: reduce) { .qb-rec.is-on .qb-rec__dot { animation: none; } }
.qb-device { display: flex; flex-wrap: wrap; gap: 14px; align-items: center; padding: 5px 10px; background: #f8f9fa; border-bottom: 1px solid #dadce0; }
.qb-device select { margin-left: 6px; font: inherit; padding: 2px 4px; }
.qb-dim { color: #5f6368; }
.qb-main { flex: 1; display: grid; grid-template-columns: minmax(0, 1fr) minmax(240px, 32%); min-height: 0; }
.qb-viewport { overflow: auto; background: #fff; min-height: 420px; }
.qb-viewport.is-emulated { background: #e8eaed; padding: 16px; display: flex; justify-content: center; }
.qb-frame { min-height: 100%; }
.qb-viewport.is-emulated .qb-frame { overflow: hidden; box-shadow: 0 2px 10px rgba(0,0,0,.2); background: #fff; flex: none; min-height: 600px; }
.qb-empty { display: grid; place-items: center; gap: 12px; padding: 60px 20px; text-align: center; color: #5f6368; }
.qb-primary { background: #1a73e8; color: #fff; border: 0; border-radius: 6px; padding: 8px 14px; cursor: pointer; font: inherit; font-weight: 600; }
.qb-primary:disabled { opacity: .5; cursor: default; }
.qb-tools { border-left: 1px solid #dadce0; background: #fff; display: flex; flex-direction: column; min-height: 0; }
.qb-tools__tabs { display: flex; border-bottom: 1px solid #dadce0; background: #f1f3f4; }
.qb-tools__tabs button { border: 0; background: transparent; padding: 7px 12px; cursor: pointer; font: inherit; color: #5f6368; border-bottom: 2px solid transparent; }
.qb-tools__tabs button.is-active { color: #1a73e8; border-bottom-color: #1a73e8; }
.qb-tools__body { padding: 8px 10px; overflow: auto; flex: 1; font-family: ui-monospace, Consolas, monospace; font-size: 12px; }
.qb-log { margin: 0 0 6px; padding: 4px 6px; border-bottom: 1px solid #f1f3f4; }
.qb-log--warn { background: #fef7e0; color: #7a4f01; }
.qb-muted { color: #5f6368; font-family: system-ui, sans-serif; }
.qb-steps { padding-left: 18px; margin: 6px 0 10px; }
.qb-gen { display: grid; gap: 6px; font-family: system-ui, sans-serif; }
.qb-gen label { display: grid; gap: 2px; }
.qb-gen input { font: 12px ui-monospace, Consolas, monospace; padding: 4px 6px; border: 1px solid #dadce0; border-radius: 4px; }
.qb-el { display: flex; gap: 6px; align-items: center; padding: 2px 0; }
.qb-el code { color: #881280; }
.qb-badge { background: #fce8e6; color: #c5221f; border-radius: 4px; padding: 0 5px; font-size: 10px; }
.qb-flashes { position: absolute; right: 12px; bottom: 12px; display: grid; gap: 6px; max-width: 360px; z-index: 2; }
.qb-flash { background: #323232; color: #fff; padding: 9px 30px 9px 12px; border-radius: 6px; position: relative; box-shadow: 0 2px 8px rgba(0,0,0,.3); }
.qb-flash--error { background: #b3261e; }
.qb-flash button { position: absolute; top: 4px; right: 6px; background: none; border: 0; color: #fff; cursor: pointer; font-size: 16px; }
@container sl-portal (max-width: 760px) {
  .qb-main { grid-template-columns: 1fr; }
  .qb-tools { border-left: 0; border-top: 1px solid #dadce0; max-height: 260px; }
}
</style>
