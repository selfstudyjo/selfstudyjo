<template>
  <div class="qm" dir="ltr">
    <header class="qm-top">
      <strong class="qm-brand">Device Simulator</strong>
      <label class="qm-select">
        <select :value="current" :disabled="busy" @change="setDevice(($event.target as HTMLSelectElement).value)">
          <option v-for="d in phones" :key="d.name" :value="d.name">{{ d.name }} - {{ d.width }}&times;{{ d.height }} ({{ d.platform }})</option>
        </select>
      </label>
      <label class="qm-url">
        <input v-model="address" spellcheck="false" aria-label="Address" @keydown.enter.prevent="openTyped">
      </label>
      <button type="button" class="qm-btn" :disabled="busy" @click="openTyped">Go</button>
      <button type="button" class="qm-btn" :disabled="busy" title="Clear app data" @click="exec(cli(['qa', 'ui', 'reset']))">Reset app</button>
    </header>

    <div class="qm-stage">
      <div class="qm-phone" :class="'qm-phone--' + (device?.platform || 'android')"
           :style="{ '--qm-w': device?.width + 'px', '--qm-h': device?.height + 'px', '--qm-scale': scale }">
        <div class="qm-screen">
          <div class="qm-status">
            <span>9:41</span><span class="qm-notch" aria-hidden="true"></span><span>5G &#9646;&#9646;&#9646; 87%</span>
          </div>
          <div class="qm-browserbar">{{ page?.url.replace('http://', '') || 'qa-shop.local' }}</div>
          <div class="qm-app">
            <div v-if="!page || !isPhone" class="qm-empty">
              <p>QA Shop is not open on this device yet.</p>
              <button type="button" class="qm-btn qm-btn--primary" :disabled="busy" @click="launch">Launch QA Shop</button>
            </div>
            <QaPage v-else :page="page" :busy="busy" compact :build="build" @act="act" />
          </div>
          <div class="qm-nav">
            <button type="button" aria-label="Back" :disabled="busy || !page?.can_back" @click="exec(cli(['qa', 'ui', 'back']))">&#9664;</button>
            <button type="button" aria-label="Home" :disabled="busy" @click="exec(cli(['qa', 'ui', 'open', '/']))">&#9679;</button>
            <button type="button" aria-label="Reload" :disabled="busy" @click="exec(cli(['qa', 'ui', 'reload']))">&#8635;</button>
          </div>
        </div>
      </div>

      <aside class="qm-side">
        <h3>Session</h3>
        <dl>
          <dt>Viewport</dt><dd>{{ device?.width }} &times; {{ device?.height }} CSS px</dd>
          <dt>Signed in</dt><dd>{{ page?.user || 'no' }}</dd>
          <dt>Cart</dt><dd>{{ page?.cart_count ?? 0 }} line(s)</dd>
          <dt>Page</dt><dd>{{ page?.path || '-' }}</dd>
        </dl>
        <p v-if="page?.note" class="qm-note">&#8250; {{ page.note }}</p>
        <p v-if="hidden.length" class="qm-warn">&#9888; Off-screen on this device: {{ hidden.join(', ') }}</p>
        <div v-for="obs in recentObs" :key="obs.id" class="qm-obs">&#9888; {{ obs.id }}: {{ obs.summary }}</div>
        <p class="qm-hint">Test the same flow on several phones - a layout that works at 412px can fail at 375px.</p>
      </aside>
    </div>

    <div class="qm-flashes" aria-live="polite">
      <div v-for="f in api.flashes.value" :key="f.id" class="qm-flash" :class="'qm-flash--' + f.type">
        {{ f.title }} <span v-if="f.detail">- {{ f.detail }}</span>
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
const phones = computed(() => devicesOf(props.view).filter(d => d.platform !== 'desktop'));
const isPhone = computed(() => !!page.value && page.value.device.platform !== 'desktop');
const current = computed(() => (isPhone.value ? page.value!.device.name : phones.value[0]?.name) || 'Pixel 7');
const device = computed(() => phones.value.find(d => d.name === current.value) || phones.value[0]);
const build = computed(() => String(pick(props.view, 'build', '1.0')));
const busy = computed(() => Boolean(props.busy) || props.api.busy.value);
const scale = computed(() => {
    const h = device.value?.height || 800;
    return String(Math.min(1, 560 / h));
});
const hidden = computed(() => (page.value?.elements || []).filter(e => !e.visible).map(e => '#' + e.id));
const recentObs = computed(() => rows<any>(props.view, 'observations').slice(-3).reverse());
const address = ref('qa-shop.local/');

watch(() => page.value?.url, url => {
    if (url) { address.value = url.replace('http://', ''); emit('location', `simulator://${current.value}/${url.replace('http://', '')}`); }
}, { immediate: true });

async function exec(command: string) {
    return props.api.exec(command);
}
async function runAll(commands: string[]) {
    for (const c of commands) if (!(await exec(c)).ok) return;
}
function act(fills: Record<string, string>, clickId: string) {
    void runAll(uiCommands(fills, clickId));
}
function setDevice(name: string) {
    void exec(cli(['qa', 'ui', 'device', name]));
}
function launch() {
    void runAll([cli(['qa', 'ui', 'device', current.value]), cli(['qa', 'ui', 'open', '/'])]);
}
function openTyped() {
    const raw = address.value.trim().replace(/^(https?:\/\/)?qa-shop\.local/i, '') || '/';
    const commands = isPhone.value ? [] : [cli(['qa', 'ui', 'device', current.value])];
    commands.push(cli(['qa', 'ui', 'open', raw.startsWith('/') ? raw : '/' + raw]));
    void runAll(commands);
}
</script>

<style scoped>
.qm { display: flex; flex-direction: column; height: 100%; min-height: 600px; background: #1e1f22; color: #e8eaed;
  font: 13px/1.4 system-ui, 'Segoe UI', Roboto, sans-serif; position: relative; }
.qm-top { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; padding: 8px 12px; background: #2b2d31; border-bottom: 1px solid #3c3f44; }
.qm-brand { margin-right: 6px; }
.qm-select select, .qm-url input { background: #1e1f22; color: #e8eaed; border: 1px solid #4a4d52; border-radius: 6px; padding: 5px 8px; font: inherit; }
.qm-url { flex: 1; min-width: 160px; display: flex; }
.qm-url input { flex: 1; min-width: 0; }
.qm-btn { background: #3c3f44; color: #e8eaed; border: 0; border-radius: 6px; padding: 6px 12px; cursor: pointer; font: inherit; }
.qm-btn--primary { background: #0f766e; }
.qm-btn:disabled { opacity: .5; }
.qm-stage { flex: 1; display: flex; gap: 20px; padding: 20px; overflow: auto; align-items: flex-start; justify-content: center; flex-wrap: wrap; }
.qm-phone { width: calc(var(--qm-w) * var(--qm-scale) + 24px); flex: none; background: #0b0b0c; border-radius: 42px; padding: 12px;
  box-shadow: 0 0 0 2px #3c3f44, 0 18px 40px rgba(0,0,0,.5); }
.qm-phone--android { border-radius: 30px; }
.qm-screen { width: var(--qm-w); height: var(--qm-h); transform: scale(var(--qm-scale)); transform-origin: top left;
  margin-bottom: calc(var(--qm-h) * (var(--qm-scale) - 1)); margin-right: calc(var(--qm-w) * (var(--qm-scale) - 1));
  background: #fff; border-radius: 30px; overflow: hidden; display: flex; flex-direction: column; color: #111; }
.qm-phone--android .qm-screen { border-radius: 18px; }
.qm-status { display: flex; justify-content: space-between; align-items: center; padding: 10px 22px 4px; font-weight: 600; font-size: 13px; }
.qm-notch { width: 110px; height: 24px; background: #0b0b0c; border-radius: 0 0 14px 14px; margin-top: -10px; }
.qm-phone--android .qm-notch { width: 12px; height: 12px; border-radius: 50%; margin-top: 0; }
.qm-browserbar { margin: 4px 12px 6px; background: #f1f3f4; border-radius: 18px; padding: 6px 12px; font-size: 13px; color: #3c4043; text-align: center;
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.qm-app { flex: 1; overflow: auto; overflow-x: hidden; }
.qm-empty { display: grid; gap: 12px; place-items: center; padding: 80px 20px; text-align: center; color: #5f6368; }
.qm-nav { display: flex; justify-content: space-around; padding: 8px 0 12px; background: #f8f9fa; border-top: 1px solid #e8eaed; }
.qm-nav button { background: none; border: 0; font-size: 18px; color: #3c4043; cursor: pointer; padding: 4px 18px; }
.qm-nav button:disabled { opacity: .35; }
.qm-side { width: 260px; max-width: 100%; background: #2b2d31; border-radius: 10px; padding: 12px 14px; }
.qm-side h3 { margin: 0 0 8px; font-size: 14px; }
.qm-side dl { display: grid; grid-template-columns: auto 1fr; gap: 4px 10px; margin: 0 0 10px; }
.qm-side dt { color: #9aa0a6; }
.qm-side dd { margin: 0; }
.qm-note { color: #a8c7fa; }
.qm-warn, .qm-obs { background: #4a3a10; color: #fde293; padding: 6px 8px; border-radius: 6px; margin: 6px 0; }
.qm-hint { color: #9aa0a6; font-size: 12px; }
.qm-flashes { position: absolute; left: 12px; bottom: 12px; display: grid; gap: 6px; max-width: 380px; z-index: 2; }
.qm-flash { background: #3c3f44; padding: 8px 28px 8px 10px; border-radius: 6px; position: relative; }
.qm-flash--error { background: #8c1d18; }
.qm-flash button { position: absolute; right: 6px; top: 4px; background: none; border: 0; color: inherit; cursor: pointer; font-size: 16px; }
</style>
