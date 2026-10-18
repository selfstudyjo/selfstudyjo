<template>
  <div>
    <section class="kd-card">
      <header class="kd-card__head">
        <h2 class="kd-card__title">Helm Releases</h2>
        <span class="kd-spacer" />
        <button type="button" class="kd-btn kd-btn--primary" @click="openInstall">Install chart</button>
      </header>
      <div v-if="!releases.length" class="kd-card__empty">There is nothing to display here</div>
      <div v-else class="kd-table-wrap">
        <table class="kd-table">
          <thead><tr><th /><th>Name</th><th>Namespace</th><th>Revision</th><th>Updated</th><th>Status</th><th>Chart</th><th /></tr></thead>
          <tbody>
            <tr v-for="r in releases" :key="r.name">
              <td class="kd-col-status"><KdStatus :health="r.status === 'deployed' ? 'success' : 'pending'" :title="r.status" /></td>
              <td>{{ r.name }}</td><td>{{ r.namespace }}</td><td>{{ r.revision }}</td><td>{{ r.updated }}</td><td>{{ r.status }}</td>
              <td>{{ String(r.chart).split('/').pop() }}-{{ r.version }}</td>
              <td class="kd-right"><button type="button" class="kd-textbtn" @click="confirm = r">Uninstall</button></td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>
    <section class="kd-card">
      <header class="kd-card__head"><h2 class="kd-card__title">Chart Repositories</h2></header>
      <div v-if="!repos.length" class="kd-card__empty">No repositories added yet. Installing a chart adds its repository first.</div>
      <div v-else class="kd-table-wrap">
        <table class="kd-table"><thead><tr><th>Name</th><th>URL</th></tr></thead>
          <tbody><tr v-for="r in repos" :key="r"><td>{{ r }}</td><td>{{ HELM_REPOS[r] || `https://charts.example/${r}` }}</td></tr></tbody></table>
      </div>
    </section>

    <div v-if="install" class="kd-overlay" @click.self="install = false">
      <form class="kd-dialog" role="dialog" aria-label="Install a chart" novalidate @submit.prevent="doInstall">
        <h2 class="kd-dialog__title">Install a chart</h2>
        <div class="kd-field"><label class="kd-label" for="kd-hname">Release name *</label><input id="kd-hname" v-model="release" class="kd-input" /></div>
        <div class="kd-field"><label class="kd-label" for="kd-hchart">Chart *</label>
          <select id="kd-hchart" v-model="chart" class="kd-input">
            <option v-for="c in charts" :key="c.name" :value="c.name">{{ c.name }} ({{ c.version }})</option>
          </select></div>
        <div class="kd-field"><label class="kd-label" for="kd-hns">Namespace *</label><input id="kd-hns" v-model="ns" class="kd-input" /></div>
        <label class="kd-check"><input v-model="createNs" type="checkbox" /> Create the namespace if it does not exist (--create-namespace)</label>
        <div class="kd-equiv"><span>This action is equivalent to:</span><code v-for="line in lines" :key="line">{{ line }}</code></div>
        <p v-if="error" class="kd-error">{{ error }}</p>
        <div class="kd-actions">
          <button type="submit" class="kd-btn kd-btn--primary" :disabled="working">Install</button>
          <button type="button" class="kd-btn" @click="install = false">Cancel</button>
        </div>
      </form>
    </div>

    <div v-if="confirm" class="kd-overlay" @click.self="confirm = null">
      <div class="kd-dialog" role="dialog" aria-label="Uninstall a release">
        <h2 class="kd-dialog__title">Uninstall a release</h2>
        <p class="kd-text">Are you sure you want to uninstall release <strong>{{ confirm.name }}</strong> in namespace <strong>{{ confirm.namespace }}</strong>? Every object it created is deleted.</p>
        <div class="kd-equiv"><span>This action is equivalent to:</span><code>{{ helmUninstallCommand(confirm.name, confirm.namespace) }}</code></div>
        <p v-if="error" class="kd-error">{{ error }}</p>
        <div class="kd-actions">
          <button type="button" class="kd-btn kd-btn--warn" :disabled="working" @click="doUninstall">Uninstall</button>
          <button type="button" class="kd-btn" @click="confirm = null">Cancel</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
/** Helm releases (k8s-06): install with `helm repo add` + `helm install`, remove with `helm uninstall`. */
import { computed, ref } from 'vue';
import { errorText } from '@/utils/portalKit';
import type { PortalApi } from '../usePortal';
import KdStatus from './KdStatus.vue';
import { dash, HELM_REPOS, helmInstallCommand, helmRepoAddCommand, helmUninstallCommand, validateName, type Row } from './k8s';

const props = defineProps<{ view: Record<string, any>; namespace: string; api: PortalApi }>();

const releases = computed<Row[]>(() => {
  const all = (dash(props.view).helm || []) as Row[];
  return props.namespace === '_all' ? all : all.filter(r => r.namespace === props.namespace);
});
const repos = computed<string[]>(() => (dash(props.view).repos || []) as string[]);
const charts = computed<Row[]>(() => (dash(props.view).charts || []) as Row[]);

const install = ref(false);
const release = ref('');
const chart = ref('bitnami/nginx');
const ns = ref('default');
const createNs = ref(false);
const error = ref('');
const working = ref(false);
const confirm = ref<Row | null>(null);

const repoOf = computed(() => chart.value.split('/')[0]);
const lines = computed(() => {
  const out: string[] = [];
  if (!repos.value.includes(repoOf.value)) out.push(helmRepoAddCommand(repoOf.value, HELM_REPOS[repoOf.value] || ''));
  out.push(helmInstallCommand(release.value.trim() || 'RELEASE', chart.value, ns.value.trim() || 'default', createNs.value));
  return out;
});

function openInstall() {
  install.value = true; error.value = ''; release.value = '';
  ns.value = props.namespace === '_all' ? 'default' : props.namespace;
}

async function doInstall() {
  error.value = validateName(release.value, 'Release name', 53) || validateName(ns.value, 'Namespace');
  if (error.value) return;
  working.value = true;
  try {
    for (const line of lines.value) {
      const result = await props.api.exec(line, { quiet: true });
      if (!result.ok) { error.value = errorText(result); return; }
    }
    props.api.notify('success', `Release ${release.value.trim()} installed`);
    install.value = false;
  } finally { working.value = false; }
}

async function doUninstall() {
  if (!confirm.value) return;
  working.value = true;
  error.value = '';
  try {
    const result = await props.api.exec(helmUninstallCommand(confirm.value.name, confirm.value.namespace),
      { quiet: true, success: `Release ${confirm.value.name} uninstalled` });
    if (!result.ok) { error.value = errorText(result); return; }
    confirm.value = null;
  } finally { working.value = false; }
}
</script>

<style scoped>
.kd-card { background: #fff; box-shadow: var(--kd-shadow); border-radius: 2px; margin-bottom: 16px; }
.kd-card__head { display: flex; align-items: center; min-height: 56px; padding: 0 16px 0 20px; }
.kd-card__title { margin: 0; font-size: 18px; font-weight: 400; color: rgb(0 0 0 / 0.87); }
.kd-card__empty { padding: 4px 20px 24px; color: rgb(0 0 0 / 0.54); font-size: 14px; }
.kd-spacer { flex: 1; }
.kd-table-wrap { overflow-x: auto; }
.kd-table { width: 100%; border-collapse: collapse; font-size: 14px; }
.kd-table th { text-align: left; font-size: 12px; font-weight: 500; color: rgb(0 0 0 / 0.54); height: 56px; padding: 0 12px; border-bottom: 1px solid rgb(0 0 0 / 0.12); white-space: nowrap; }
.kd-table td { height: 48px; padding: 4px 12px; border-bottom: 1px solid rgb(0 0 0 / 0.12); color: rgb(0 0 0 / 0.87); }
.kd-col-status { width: 36px; padding-left: 20px !important; }
.kd-right { text-align: right; }
.kd-textbtn { border: 0; background: none; color: var(--kd-primary); font: inherit; font-size: 14px; font-weight: 500; text-transform: uppercase; padding: 6px 12px; border-radius: 4px; cursor: pointer; }
.kd-overlay { position: absolute; inset: 0; z-index: 60; background: rgb(0 0 0 / 0.32); display: grid; place-items: center; padding: 16px; }
.kd-dialog { background: #fff; border-radius: 4px; padding: 24px; width: min(560px, 100%); max-height: 92%; overflow: auto;
  box-shadow: 0 11px 15px -7px rgb(0 0 0 / 0.2), 0 24px 38px 3px rgb(0 0 0 / 0.14), 0 9px 46px 8px rgb(0 0 0 / 0.12); }
.kd-dialog__title { margin: 0 0 16px; font-size: 20px; font-weight: 500; }
.kd-text { font-size: 14px; margin: 0 0 12px; line-height: 1.5; }
.kd-field { display: flex; flex-direction: column; gap: 2px; margin-bottom: 14px; }
.kd-label { font-size: 12px; color: rgb(0 0 0 / 0.54); }
.kd-input { border: 0; border-bottom: 1px solid rgb(0 0 0 / 0.42); padding: 6px 0; font: inherit; font-size: 15px; background: transparent; outline: 0; }
.kd-input:focus { border-bottom: 2px solid var(--kd-primary); padding-bottom: 5px; }
.kd-check { display: flex; align-items: center; gap: 8px; font-size: 14px; margin-bottom: 8px; }
.kd-equiv { display: flex; flex-direction: column; gap: 4px; background: #f5f5f5; padding: 10px 12px; margin: 8px 0 4px; font-size: 12px; color: rgb(0 0 0 / 0.54); }
.kd-equiv code { font: 12px/1.5 'Roboto Mono', Consolas, monospace; color: rgb(0 0 0 / 0.87); word-break: break-all; }
.kd-actions { display: flex; gap: 8px; margin-top: 20px; }
.kd-btn { height: 36px; padding: 0 16px; border: 0; border-radius: 4px; background: transparent; color: var(--kd-primary); font: inherit; font-size: 14px; font-weight: 500; text-transform: uppercase; cursor: pointer; }
.kd-btn--primary { background: var(--kd-primary); color: #fff; box-shadow: 0 3px 1px -2px rgb(0 0 0 / 0.2), 0 2px 2px 0 rgb(0 0 0 / 0.14), 0 1px 5px 0 rgb(0 0 0 / 0.12); }
.kd-btn--warn { background: #f44336; color: #fff; }
.kd-btn:disabled { opacity: 0.38; }
.kd-error { color: #f44336; font-size: 13px; margin: 8px 0 0; }
</style>
