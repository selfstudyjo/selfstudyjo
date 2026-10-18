<template>
  <div v-if="workspace" class="tf-page">
    <!-- ===== List ===== -->
    <template v-if="route.page === 'states'">
      <TfWsHeader />
      <div class="tf-section__head">
        <h2 class="tf-h2">States <span class="st-n">{{ versions.length }}</span></h2>
      </div>
      <p class="tf-faint st-sub">Each state version is a snapshot of the workspace's state after a change: an apply, an import, a <code class="tf-mono">terraform state rm</code> or a taint.</p>
      <div class="tf-table-wrap">
        <table class="tf-table">
          <thead><tr><th>State version</th><th>Serial</th><th>Run</th><th>Resources</th><th>Created</th></tr></thead>
          <tbody>
            <tr v-for="(version, index) in versions" :key="version.id">
              <td>
                <a href="#" class="st-link" @click.prevent="go({ page: 'state', ws: workspace.name, id: version.id })">#{{ version.id }}</a>
                <span v-if="index === 0" class="tf-badge tf-badge--success st-cur">Current</span>
              </td>
              <td>{{ version.serial }}</td>
              <td>
                <a v-if="version.run && hasRun(version.run)" href="#" @click.prevent="go({ page: 'run', ws: workspace.name, id: version.run })">{{ version.run }}</a>
                <span v-else-if="version.run" class="tf-mono">{{ version.run }}</span>
                <span v-else class="tf-faint">Changed from the CLI</span>
              </td>
              <td>{{ version.resources }}</td>
              <td class="tf-faint">{{ ago(version.created_at, now) }}</td>
            </tr>
            <tr v-if="!versions.length">
              <td colspan="5"><div class="tf-empty"><div class="tf-empty__title">No state versions</div>
                This workspace has no state yet. Apply a run to create the first state version.</div></td>
            </tr>
          </tbody>
        </table>
      </div>
    </template>

    <!-- ===== Detail ===== -->
    <template v-else>
      <a href="#" class="st-back" @click.prevent="go({ page: 'states', ws: workspace.name })"><TfIcon name="arrow-left" :size="14" /> States</a>
      <div v-if="!current" class="tf-card tf-empty"><div class="tf-empty__title">State version not found</div>{{ route.id }} is no longer kept.</div>
      <template v-else>
        <div class="tf-page-head">
          <div>
            <h1 class="tf-display">State version #{{ current.id }}</h1>
            <p class="tf-faint st-sub2">Created {{ longDate(current.created_at) }}<span v-if="isLatest"> · <strong class="st-curtext">Current state</strong></span></p>
          </div>
          <div class="tf-page-head__actions">
            <button type="button" class="tf-btn tf-btn--secondary" @click="copyJson"><TfIcon name="copy" /> Copy JSON</button>
          </div>
        </div>
        <dl class="tf-dl st-dl">
          <dt>Serial</dt><dd>{{ current.serial }}</dd>
          <dt>Lineage</dt><dd class="tf-mono">{{ current.tfstate?.lineage }}</dd>
          <dt>Terraform version</dt><dd>v{{ workspace.version }}</dd>
          <dt>Run</dt><dd>
            <a v-if="current.run && hasRun(current.run)" href="#" @click.prevent="go({ page: 'run', ws: workspace.name, id: current.run })">{{ current.run }}</a>
            <span v-else class="tf-faint">{{ current.run || 'Changed from the CLI (no run)' }}</span>
          </dd>
        </dl>
        <div class="st-tabs" role="tablist">
          <button v-for="tab in ['Resources', 'Outputs', 'Raw state']" :key="tab" type="button" role="tab" class="st-tab"
                  :class="{ 'is-active': tabName === tab }" :aria-selected="tabName === tab" @click="tabName = tab">{{ tab }}</button>
        </div>
        <div v-if="tabName === 'Resources'" class="tf-table-wrap">
          <table class="tf-table">
            <thead><tr><th>Address</th><th>Type</th><th>ID</th><th>Provider</th></tr></thead>
            <tbody>
              <tr v-for="resource in stateResources" :key="resource.address">
                <td class="tf-mono st-addr">{{ resource.address }}<span v-if="resource.tainted" class="tf-badge tf-badge--critical st-cur">tainted</span></td>
                <td class="tf-mono">{{ resource.type }}</td>
                <td class="tf-mono st-id">{{ resource.computed?.id }}</td>
                <td class="tf-faint tf-small">{{ resource.provider }}</td>
              </tr>
              <tr v-if="!stateResources.length"><td colspan="4"><div class="tf-empty">This state version tracks no resources.</div></td></tr>
            </tbody>
          </table>
        </div>
        <div v-else-if="tabName === 'Outputs'" class="tf-table-wrap">
          <table class="tf-table">
            <thead><tr><th>Name</th><th>Value</th></tr></thead>
            <tbody>
              <tr v-for="(value, key) in current.outputs || {}" :key="key"><td class="tf-mono">{{ key }}</td><td class="tf-mono st-id">{{ fmtValue(value) }}</td></tr>
              <tr v-if="!Object.keys(current.outputs || {}).length"><td colspan="2"><div class="tf-empty">No outputs in this state version.</div></td></tr>
            </tbody>
          </table>
        </div>
        <pre v-else class="tf-code st-json">{{ json }}</pre>
      </template>
    </template>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import { rows } from '@/utils/portalKit';
import TfIcon from './TfIcon.vue';
import TfWsHeader from './TfWsHeader.vue';
import { useTf } from './tfContext';
import { ago, fmtValue, longDate } from './tfKit';

interface StateVersion { id: string; workspace: string; serial: number; run: string; created_at: string; resources: number; outputs: Record<string, unknown>; tfstate: any }

const { view, workspace, runs, route, go, now, notify } = useTf();
const tabName = ref('Resources');
const versions = computed(() => rows<StateVersion>(view.value, 'state_versions').filter(v => v.workspace === workspace.value?.name));
const current = computed(() => versions.value.find(v => v.id === route.value.id) || null);
const isLatest = computed(() => versions.value[0]?.id === current.value?.id);
const stateResources = computed(() => (current.value?.tfstate?.resources || []) as Record<string, any>[]);
const json = computed(() => JSON.stringify(current.value?.tfstate || {}, null, 2));

function hasRun(id: string) { return runs.value.some(run => run.id === id); }

async function copyJson() {
  try {
    await navigator.clipboard.writeText(json.value);
    notify('success', 'State JSON copied');
  } catch {
    notify('info', 'Copy is not available', 'Select the Raw state tab and copy the text.');
  }
}
</script>

<style scoped src="./tfBase.css"></style>
<style scoped>
.st-n { display: inline-block; margin-left: 6px; padding: 0 8px; border-radius: 12px; background: var(--tf-surface-strong); font-size: 13px; font-weight: 500; line-height: 20px; vertical-align: 2px; color: var(--tf-fg-primary); }
.st-sub { margin-bottom: 12px; }
.st-sub2 { margin-top: 4px; }
.st-curtext { color: var(--tf-fg-success); }
.st-link { font-family: var(--tf-mono); font-weight: 600; }
.st-cur { margin-left: 8px; font-size: 12px; }
.st-back { display: inline-flex; align-items: center; gap: 4px; font-size: 13px; margin-bottom: 12px; }
.st-dl { margin-bottom: 20px; }
.st-tabs { display: flex; gap: 4px; border-bottom: 1px solid var(--tf-border); margin-bottom: 16px; overflow-x: auto; overflow-y: hidden; scrollbar-width: none; }
.st-tab { flex: none; padding: 8px 12px; border-bottom: 3px solid transparent; margin-bottom: -1px; color: var(--tf-fg-faint); font-weight: 500; white-space: nowrap; }
.st-tab.is-active { color: var(--tf-fg-action); border-bottom-color: var(--tf-fg-action); }
.st-addr, .st-id { overflow-wrap: anywhere; }
.st-json { max-height: 520px; }
@container sl-portal (max-width: 560px) {
  .st-tabs { flex-wrap: wrap; overflow: visible; row-gap: 0; }
}
</style>
