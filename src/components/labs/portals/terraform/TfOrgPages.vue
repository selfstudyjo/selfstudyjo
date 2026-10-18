<template>
  <div class="tf-page">
    <!-- Registry -->
    <template v-if="route.page === 'registry'">
      <div class="tf-page-head">
        <div>
          <h1 class="tf-display">Registry</h1>
          <p class="tf-faint og-sub">Your organization's private registry of modules and providers.</p>
        </div>
        <div class="tf-page-head__actions">
          <button type="button" class="tf-btn tf-btn--secondary" @click="notify('info', 'Search public registry', 'The public registry is registry.terraform.io; this lab installs providers from it during terraform init.')">Search public registry</button>
          <button type="button" class="tf-btn tf-btn--primary" @click="notify('info', 'Publishing needs a VCS connection', 'Publishing a private module requires a connected VCS provider, which this lab does not have.')">
            <TfIcon name="plus" /> Publish
          </button>
        </div>
      </div>
      <div class="og-tabs"><span class="og-tab is-active">Modules</span><span class="og-tab">Providers</span></div>
      <div class="tf-card tf-empty">
        <div class="tf-empty__title">There are no private modules in this organization</div>
        Modules let you reuse configuration across workspaces. The providers this lab's configuration uses are listed below.
        <div class="og-prov">
          <span v-for="provider in providers" :key="provider.name" class="tf-badge tf-badge--neutral">
            hashicorp/{{ provider.name }} v{{ provider.version }}
          </span>
          <span v-if="!providers.length" class="tf-faint">Run a plan to install providers.</span>
        </div>
      </div>
    </template>

    <!-- Usage -->
    <template v-else-if="route.page === 'usage'">
      <div class="tf-page-head">
        <div>
          <h1 class="tf-display">Usage</h1>
          <p class="tf-faint og-sub">Resources under management and runs for the {{ org }} organization.</p>
        </div>
      </div>
      <div class="og-kpis">
        <div class="tf-card og-kpi"><span class="og-kpi__label">Managed resources</span><span class="og-kpi__value">{{ managed }}</span><span class="tf-faint tf-small">Across {{ workspaces.length }} workspace(s)</span></div>
        <div class="tf-card og-kpi"><span class="og-kpi__label">Applies</span><span class="og-kpi__value">{{ applies }}</span><span class="tf-faint tf-small">Runs that reached Applied</span></div>
        <div class="tf-card og-kpi"><span class="og-kpi__label">Total runs</span><span class="og-kpi__value">{{ runs.length }}</span><span class="tf-faint tf-small">Recent runs kept by this lab</span></div>
        <div class="tf-card og-kpi"><span class="og-kpi__label">Plan</span><span class="og-kpi__value og-kpi__value--text">Free</span><span class="tf-faint tf-small">Up to 500 managed resources</span></div>
      </div>
      <div class="tf-section">
        <div class="tf-section__head"><h2 class="tf-h2">Resources by workspace</h2></div>
        <div class="tf-table-wrap">
          <table class="tf-table">
            <thead><tr><th>Workspace</th><th>Resources</th><th>Runs</th><th>Latest run</th></tr></thead>
            <tbody>
              <tr v-for="ws in workspaces" :key="ws.name">
                <td><a href="#" @click.prevent="openWorkspace(ws.name)">{{ ws.name }}</a></td>
                <td>{{ ws.resources }}</td>
                <td>{{ ws.runs }}</td>
                <td><TfStatus :status="ws.latest_run?.status" /></td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </template>

    <!-- Organization settings -->
    <template v-else>
      <div class="tf-page-head"><h1 class="tf-display">Organization settings</h1></div>
      <div class="og-settings">
        <ul class="og-settings__nav">
          <li class="is-active">General</li><li>Plan &amp; billing</li><li>Teams</li><li>Users</li>
          <li>Variable sets</li><li>Policies</li><li>API tokens</li><li>Agents</li>
        </ul>
        <div class="tf-card og-settings__body">
          <h2 class="tf-h2">General settings</h2>
          <dl class="tf-dl og-dl">
            <dt>Organization name</dt><dd class="tf-mono">{{ org }}</dd>
            <dt>Organization ID</dt><dd class="tf-mono">org-{{ org }}</dd>
            <dt>Default execution mode</dt><dd>Local (CLI-driven runs execute on the lab's machine)</dd>
            <dt>Default Terraform version</dt><dd>v{{ version }}</dd>
            <dt>Workspaces</dt><dd>{{ workspaces.length }}</dd>
          </dl>
        </div>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { pick, rows } from '@/utils/portalKit';
import TfIcon from './TfIcon.vue';
import TfStatus from './TfStatus.vue';
import { useTf } from './tfContext';

const { route, view, workspaces, runs, org, notify, openWorkspace } = useTf();
const providers = computed(() => rows<{ name: string; version: string }>(view.value, 'providers'));
const managed = computed(() => workspaces.value.reduce((sum, ws) => sum + (ws.resources || 0), 0));
const applies = computed(() => runs.value.filter(run => run.status === 'applied').length);
const version = computed(() => String(pick(view.value, 'version', '')));
</script>

<style scoped src="./tfBase.css"></style>
<style scoped>
.og-sub { margin-top: 4px; }
.og-tabs { display: flex; gap: 4px; border-bottom: 1px solid var(--tf-border); margin-bottom: 16px; }
.og-tab { flex: none; padding: 8px 12px; color: var(--tf-fg-faint); font-weight: 500; border-bottom: 3px solid transparent; margin-bottom: -1px; }
.og-tab.is-active { color: var(--tf-fg-action); border-bottom-color: var(--tf-fg-action); }
.og-prov { display: flex; gap: 6px; flex-wrap: wrap; justify-content: center; margin-top: 16px; }
.og-kpis { display: grid; grid-template-columns: repeat(auto-fill, minmax(min(100%, 200px), 1fr)); gap: 16px; }
.og-kpi { display: flex; flex-direction: column; gap: 4px; padding: 16px; }
.og-kpi__label { font-size: 13px; color: var(--tf-fg-faint); font-weight: 500; }
.og-kpi__value { font-size: 30px; line-height: 38px; font-weight: 700; color: var(--tf-fg-strong); }
.og-kpi__value--text { font-size: 22px; }
.og-settings { display: grid; grid-template-columns: 200px minmax(0, 1fr); gap: 24px; }
.og-settings__nav { display: flex; flex-direction: column; gap: 2px; }
.og-settings__nav li { padding: 6px 10px; border-radius: 5px; color: var(--tf-fg-faint); }
.og-settings__nav li.is-active { background: var(--tf-surface-strong); color: var(--tf-fg-strong); font-weight: 500; }
.og-settings__body { padding: 20px; }
.og-dl { margin-top: 16px; }
@container sl-portal (max-width: 720px) {
  .og-settings { grid-template-columns: 1fr; }
  .og-settings__nav { flex-direction: row; flex-wrap: wrap; }
}
@container sl-portal (max-width: 560px) {
  .og-tabs { flex-wrap: wrap; overflow: visible; row-gap: 0; }
}
</style>
