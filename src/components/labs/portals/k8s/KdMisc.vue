<template>
  <div v-if="page === 'settings'">
    <section class="kd-card">
      <header class="kd-card__head"><h2 class="kd-card__title">Global settings</h2></header>
      <div class="kd-settings">
        <div class="kd-set"><div><b>Cluster name</b><p>Cluster name appears in the browser window title if set.</p></div>
          <input v-model="local.clusterName" class="kd-input" /></div>
        <div class="kd-set"><div><b>Items per page</b><p>Max number of items that can be displayed on each list page.</p></div>
          <input v-model.number="local.itemsPerPage" type="number" min="5" max="100" class="kd-input" /></div>
        <div class="kd-set"><div><b>Labels limit</b><p>Max number of labels that are displayed by default on most views.</p></div>
          <input v-model.number="local.labelsLimit" type="number" min="1" max="20" class="kd-input" /></div>
        <div class="kd-set"><div><b>Resource auto-refresh time interval</b><p>Auto-refresh is not simulated - lists refresh after every action.</p></div>
          <input value="5" disabled class="kd-input" /></div>
        <div class="kd-set"><div><b>Default namespace</b><p>The namespace selected when the Dashboard opens.</p></div>
          <select v-model="local.defaultNamespace" class="kd-input">
            <option v-for="n in namespaces" :key="n" :value="n">{{ n }}</option>
          </select></div>
      </div>
      <div class="kd-actions">
        <button type="button" class="kd-btn kd-btn--primary" @click="$emit('save', { ...local })">Save</button>
        <button type="button" class="kd-btn" @click="reset">Reset</button>
      </div>
    </section>
    <section class="kd-card">
      <header class="kd-card__head"><h2 class="kd-card__title">Local settings</h2></header>
      <div class="kd-settings">
        <div class="kd-set"><div><b>Theme</b><p>The Dashboard's light theme is used in this lab.</p></div><select class="kd-input" disabled><option>Light</option></select></div>
        <div class="kd-set"><div><b>Language</b><p>Product text stays in English, as in the real Dashboard's documentation.</p></div><select class="kd-input" disabled><option>English</option></select></div>
      </div>
    </section>
  </div>
  <section v-else class="kd-card kd-about">
    <svg class="kd-about__logo" viewBox="0 0 64 64" aria-hidden="true"><polygon points="32,3 55,14 61,39 45,59 19,59 3,39 9,14" fill="#326de6" />
      <circle cx="32" cy="33" r="13" fill="none" stroke="#fff" stroke-width="3.5" />
      <g stroke="#fff" stroke-width="3" stroke-linecap="round"><line x1="32" y1="14" x2="32" y2="52" /><line x1="15" y1="25" x2="49" y2="41" /><line x1="15" y1="41" x2="49" y2="25" /></g>
      <circle cx="32" cy="33" r="4" fill="#fff" /></svg>
    <h2>Kubernetes Dashboard</h2>
    <p>General-purpose web UI for Kubernetes clusters.</p>
    <p class="kd-about__v">Version v2.7.0 &middot; cluster {{ cluster }} &middot; Kubernetes {{ version }}</p>
    <p class="kd-about__sim">This is a simulated Dashboard: every action runs the kubectl command shown in the equivalent-CLI drawer against the lab's simulated control plane.</p>
    <p class="kd-about__copy">Copyright 2019 The Kubernetes Authors.</p>
  </section>
</template>

<script setup lang="ts">
/** The Settings and About pages. */
import { computed, reactive } from 'vue';
import { dash, type KdSettings, type Row } from './k8s';

const props = defineProps<{ page: 'settings' | 'about'; view: Record<string, any>; settings: KdSettings }>();
defineEmits<{ (e: 'save', s: KdSettings): void }>();

const local = reactive<KdSettings>({ ...props.settings });
function reset() { Object.assign(local, { clusterName: '', itemsPerPage: 10, labelsLimit: 3, defaultNamespace: 'default' }); }
const namespaces = computed<string[]>(() => ((dash(props.view).namespaces || []) as Row[]).map(n => n.name));
const cluster = computed(() => dash(props.view).cluster || '-');
const version = computed(() => dash(props.view).version || '-');
</script>

<style scoped>
.kd-card { background: #fff; box-shadow: var(--kd-shadow); border-radius: 2px; margin-bottom: 16px; padding-bottom: 8px; }
.kd-card__head { display: flex; align-items: center; min-height: 56px; padding: 0 20px; }
.kd-card__title { margin: 0; font-size: 18px; font-weight: 400; }
.kd-settings { display: flex; flex-direction: column; }
.kd-set { display: grid; grid-template-columns: minmax(0, 2fr) minmax(120px, 1fr); gap: 24px; align-items: center; padding: 12px 20px; border-top: 1px solid rgb(0 0 0 / 0.08); }
.kd-set b { font-weight: 500; font-size: 14px; }
.kd-set p { margin: 4px 0 0; font-size: 12px; color: rgb(0 0 0 / 0.54); }
.kd-input { border: 0; border-bottom: 1px solid rgb(0 0 0 / 0.42); padding: 6px 0; font: inherit; font-size: 14px; background: transparent; outline: 0; min-width: 0; }
.kd-actions { display: flex; gap: 8px; padding: 12px 20px; }
.kd-btn { height: 36px; padding: 0 16px; border: 0; border-radius: 4px; background: transparent; color: var(--kd-primary); font: inherit; font-size: 14px; font-weight: 500; text-transform: uppercase; cursor: pointer; }
.kd-btn--primary { background: var(--kd-primary); color: #fff; }
.kd-about { text-align: center; padding: 40px 24px; }
.kd-about__logo { width: 96px; height: 96px; }
.kd-about h2 { font-size: 24px; font-weight: 400; margin: 12px 0 4px; }
.kd-about p { font-size: 14px; color: rgb(0 0 0 / 0.6); margin: 6px 0; }
.kd-about__sim { max-width: 520px; margin: 16px auto !important; }
@container sl-portal (max-width: 600px) { .kd-set { grid-template-columns: 1fr; gap: 8px; } }
</style>
