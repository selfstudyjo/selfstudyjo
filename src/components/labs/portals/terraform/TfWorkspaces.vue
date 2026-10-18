<template>
  <div class="tf-page">
    <div class="tf-page-head">
      <div>
        <h1 class="tf-display">Workspaces <span class="ws-count">{{ workspaces.length }}</span></h1>
        <p class="tf-faint ws-sub">Workspaces in the <strong>{{ org }}</strong> organization. Each one is a Terraform CLI workspace with its own state.</p>
      </div>
      <div class="tf-page-head__actions">
        <div class="ws-new">
          <button type="button" class="tf-btn tf-btn--primary" :aria-expanded="menuOpen" @click="menuOpen = !menuOpen">
            <TfIcon name="plus" /> New <TfIcon name="chevron-down" :size="14" />
          </button>
          <div v-if="menuOpen" class="tf-menu ws-new__menu" @click="menuOpen = false">
            <button type="button" class="tf-menu__item" @click="go({ page: 'new-workspace' })">
              <TfIcon name="grid" /><span>Workspace<small>Create a workspace for a configuration</small></span>
            </button>
            <button type="button" class="tf-menu__item" @click="go({ page: 'projects' })">
              <TfIcon name="folder" /><span>Project<small>Group workspaces (view projects)</small></span>
            </button>
          </div>
        </div>
      </div>
    </div>

    <div class="ws-tabs" role="tablist">
      <button v-for="tab in tabs" :key="tab.id" type="button" role="tab" class="ws-tab"
              :class="{ 'is-active': filter === tab.id }" :aria-selected="filter === tab.id" @click="filter = tab.id">
        {{ tab.label }} <span class="ws-tab__n">{{ tab.count }}</span>
      </button>
    </div>

    <div class="ws-tools">
      <div class="ws-search">
        <TfIcon name="search" class="ws-search__icon" />
        <input v-model="query" class="tf-input ws-search__input" type="search" placeholder="Search by name" aria-label="Search workspaces by name" />
      </div>
      <span class="tf-faint tf-small">Project: <strong>Default Project</strong></span>
    </div>

    <div class="tf-table-wrap">
      <table class="tf-table">
        <thead>
          <tr>
            <th>Workspace name</th>
            <th>Run status</th>
            <th>Repository</th>
            <th>Latest change</th>
            <th>Terraform version</th>
            <th>Resources</th>
            <th>Updated</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="ws in shown" :key="ws.name">
            <td>
              <div class="ws-name">
                <a href="#" class="ws-name__link" @click.prevent="openWorkspace(ws.name)">{{ ws.name }}</a>
                <TfIcon v-if="ws.locked" name="lock" :size="14" class="ws-name__lock" :title="'Locked by ' + (ws.lock?.user || '')" />
                <span v-if="ws.current" class="tf-badge tf-badge--neutral ws-name__cur" title="terraform workspace show">CLI selected</span>
              </div>
              <div class="tf-faint tf-small ws-id">{{ ws.id }}</div>
            </td>
            <td><TfStatus :status="ws.latest_run?.status" /></td>
            <td class="tf-faint">None (CLI-driven)</td>
            <td>
              <template v-if="ws.latest_run">
                <a href="#" @click.prevent="openRun(ws.name, ws.latest_run.id)">{{ ws.latest_run.id }}</a>
                <div class="tf-faint tf-small">{{ ago(ws.latest_run.created_at, now) }}</div>
              </template>
              <span v-else class="tf-faint">No runs yet</span>
            </td>
            <td>v{{ ws.version }}</td>
            <td>{{ ws.resources }}</td>
            <td class="tf-faint">{{ ago(ws.latest_run?.created_at || ws.created_at, now) }}</td>
          </tr>
          <tr v-if="!shown.length">
            <td colspan="7">
              <div class="tf-empty">
                <div class="tf-empty__title">No workspaces match</div>
                Clear the search or the status filter.
              </div>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import { matches } from '@/utils/portalKit';
import TfIcon from './TfIcon.vue';
import TfStatus from './TfStatus.vue';
import { useTf } from './tfContext';
import { ago, type TfWorkspace } from './tfKit';

const { workspaces, org: orgRef, go, openWorkspace, now } = useTf();
const org = computed(() => orgRef.value);
const menuOpen = ref(false);
const query = ref('');
const filter = ref('all');

function bucket(ws: TfWorkspace): string {
  const status = ws.latest_run?.status;
  if (status === 'planned') return 'attention';
  if (status === 'errored') return 'errored';
  if (status === 'applied' || status === 'planned_and_finished') return 'applied';
  return 'other';
}

const tabs = computed(() => [
  { id: 'all', label: 'All', count: workspaces.value.length },
  { id: 'attention', label: 'Needs attention', count: workspaces.value.filter(ws => bucket(ws) === 'attention').length },
  { id: 'errored', label: 'Errored', count: workspaces.value.filter(ws => bucket(ws) === 'errored').length },
  { id: 'applied', label: 'Applied', count: workspaces.value.filter(ws => bucket(ws) === 'applied').length },
]);

const shown = computed(() => workspaces.value
  .filter(ws => matches(ws as any, query.value, ['name']))
  .filter(ws => filter.value === 'all' || bucket(ws) === filter.value));

async function openRun(ws: string, id: string) {
  await openWorkspace(ws, 'run');
  go({ page: 'run', ws, id });
}
</script>

<style scoped src="./tfBase.css"></style>
<style scoped>
.ws-count { display: inline-block; margin-left: 6px; padding: 0 8px; border-radius: 12px; background: var(--tf-surface-strong); font-size: 14px; line-height: 22px; vertical-align: 4px; color: var(--tf-fg-primary); font-weight: 500; }
.ws-sub { margin-top: 4px; }
.ws-new { position: relative; }
.ws-new__menu { right: 0; top: calc(100% + 4px); width: 280px; }
.ws-tabs { display: flex; gap: 4px; border-bottom: 1px solid var(--tf-border); margin-bottom: 16px; overflow-x: auto; overflow-y: hidden; scrollbar-width: none; }
.ws-tab { padding: 8px 12px; border-bottom: 3px solid transparent; color: var(--tf-fg-faint); font-weight: 500; white-space: nowrap; margin-bottom: -1px; }
.ws-tab:hover { color: var(--tf-fg-strong); }
.ws-tab.is-active { color: var(--tf-fg-action); border-bottom-color: var(--tf-fg-action); }
.ws-tab__n { display: inline-block; min-width: 20px; padding: 0 6px; margin-left: 4px; border-radius: 10px; background: var(--tf-surface-strong); color: var(--tf-fg-primary); font-size: 12px; text-align: center; }
.ws-tools { display: flex; gap: 16px; align-items: center; justify-content: space-between; margin-bottom: 12px; flex-wrap: wrap; }
.ws-search { position: relative; width: min(320px, 100%); }
.ws-search__icon { position: absolute; left: 10px; top: 10px; color: var(--tf-fg-faint); }
.ws-search__input { padding-left: 32px; }
.ws-name { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; }
.ws-name__link { font-weight: 600; }
.ws-name__lock { color: var(--tf-fg-warning); }
.ws-name__cur { font-size: 12px; }
.ws-id { font-family: var(--tf-mono); font-size: 12px; }
</style>
<style scoped>
@container sl-portal (max-width: 720px) {
  .ws-new__menu { right: auto; left: 0; width: min(280px, 80cqw); }
}
</style>
