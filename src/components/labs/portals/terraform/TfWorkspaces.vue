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
      <div class="ws-filters">
        <select v-model="tagFilter" class="tf-select ws-tagsel" aria-label="Filter by tag">
          <option value="">All tags</option>
          <option v-for="tag in allTags" :key="tag" :value="tag">{{ tag }}</option>
        </select>
        <span class="tf-faint tf-small">Project: <strong>Default Project</strong></span>
      </div>
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
            <th><span class="ws-sr">Actions</span></th>
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
              <div v-if="ws.description" class="tf-small ws-desc">{{ ws.description }}</div>
              <div v-if="ws.tags?.length" class="ws-tags">
                <button v-for="tag in ws.tags" :key="tag" type="button" class="ws-tag" :title="'Filter by ' + tag" @click="tagFilter = tag">{{ tag }}</button>
              </div>
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
            <td class="ws-act">
              <button type="button" class="ws-more" :aria-label="'Actions for ' + ws.name" :aria-expanded="rowMenu === ws.name" @click="toggleRow(ws, $event)">
                <TfIcon name="more" />
              </button>
              <div v-if="rowMenu === ws.name" class="tf-menu ws-rowmenu" :style="rowStyle" @click="rowMenu = ''">
                <button type="button" class="tf-menu__item" @click="openWorkspace(ws.name)"><TfIcon name="home" /><span>Overview</span></button>
                <button type="button" class="tf-menu__item" @click="openWorkspace(ws.name, 'runs')"><TfIcon name="list" /><span>Runs</span></button>
                <button type="button" class="tf-menu__item" @click="openWorkspace(ws.name, 'variables')"><TfIcon name="code" /><span>Variables</span></button>
                <button v-if="!ws.locked" type="button" class="tf-menu__item" :disabled="busy" @click="lockWs(ws)"><TfIcon name="lock" /><span>Lock workspace</span></button>
                <button v-else type="button" class="tf-menu__item" :disabled="busy" @click="unlockWs(ws)"><TfIcon name="unlock" /><span>Unlock workspace</span></button>
                <button type="button" class="tf-menu__item" @click="openWorkspace(ws.name, 'settings')"><TfIcon name="settings" /><span>Settings</span></button>
                <button v-if="ws.name !== 'default'" type="button" class="tf-menu__item is-critical" @click="openWorkspace(ws.name, 'destruction')"><TfIcon name="trash" /><span>Delete workspace</span></button>
              </div>
            </td>
          </tr>
          <tr v-if="!shown.length">
            <td colspan="8">
              <div class="tf-empty">
                <div class="tf-empty__title">No workspaces match</div>
                Clear the search, the tag or the status filter.
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
import { ago, cmdLock, cmdUnlock, type TfWorkspace } from './tfKit';

const { workspaces, org: orgRef, go, openWorkspace, now, run, confirm, busy } = useTf();
const tagFilter = ref('');
const allTags = computed(() => [...new Set(workspaces.value.flatMap(ws => ws.tags || []))].sort());

// Row menus are placed against the skin root: the table scrolls sideways on a
// narrow frame and would clip a menu positioned inside it.
const rowMenu = ref('');
const rowStyle = ref<Record<string, string>>({});
function toggleRow(ws: TfWorkspace, event: MouseEvent) {
  if (rowMenu.value === ws.name) { rowMenu.value = ''; return; }
  const button = event.currentTarget as HTMLElement;
  const root = button.closest('.tf-app') as HTMLElement | null;
  if (root) {
    const a = button.getBoundingClientRect();
    const b = root.getBoundingClientRect();
    rowStyle.value = { top: `${a.bottom - b.top + 4}px`, left: `${Math.max(8, a.right - b.left - 210)}px` };
  }
  rowMenu.value = ws.name;
}

async function lockWs(ws: TfWorkspace) {
  const ok = await confirm({
    title: `Lock ${ws.name}?`,
    message: 'Locking prevents Terraform runs and state changes in this workspace until it is unlocked.',
    yes: 'Lock workspace',
  });
  if (ok) await run(cmdLock(ws.id, 'Locked from the workspace list'), { success: `Workspace ${ws.name} locked` });
}
async function unlockWs(ws: TfWorkspace) {
  await run(cmdUnlock(ws.id), { success: `Workspace ${ws.name} unlocked` });
}
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
  .filter(ws => !tagFilter.value || (ws.tags || []).includes(tagFilter.value))
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
.ws-tab { flex: none; padding: 8px 12px; border-bottom: 3px solid transparent; color: var(--tf-fg-faint); font-weight: 500; white-space: nowrap; margin-bottom: -1px; }
.ws-tab:hover { color: var(--tf-fg-strong); }
.ws-tab.is-active { color: var(--tf-fg-action); border-bottom-color: var(--tf-fg-action); }
.ws-tab__n { display: inline-block; min-width: 20px; padding: 0 6px; margin-left: 4px; border-radius: 10px; background: var(--tf-surface-strong); color: var(--tf-fg-primary); font-size: 12px; text-align: center; }
.ws-tools { display: flex; gap: 16px; align-items: center; justify-content: space-between; margin-bottom: 12px; flex-wrap: wrap; }
.ws-search { position: relative; width: min(320px, 100%); }
.ws-search__icon { position: absolute; left: 10px; top: 10px; color: var(--tf-fg-faint); }
.ws-search__input { padding-left: 32px; }
.ws-name { display: flex; align-items: center; gap: 6px; flex-wrap: nowrap; white-space: nowrap; }
.ws-name__link { font-weight: 600; }
.ws-name__lock { color: var(--tf-fg-warning); }
.ws-name__cur { font-size: 12px; }
.ws-id { font-family: var(--tf-mono); font-size: 12px; }
.ws-desc { margin-top: 2px; max-width: 320px; color: var(--tf-fg-primary); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.ws-tags { display: flex; flex-wrap: wrap; gap: 4px; margin-top: 4px; }
.ws-tag { padding: 0 7px; border-radius: 10px; background: var(--tf-surface-strong); border: 1px solid var(--tf-border); font-size: 12px; line-height: 18px; color: var(--tf-fg-strong); }
.ws-tag:hover { border-color: var(--tf-fg-action); color: var(--tf-fg-action); }
.ws-filters { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; }
.ws-tagsel { min-height: 32px; padding-top: 5px; padding-bottom: 5px; width: auto; min-width: 140px; }
.ws-act { width: 1%; text-align: right; }
.ws-more { padding: 4px 8px; border: 1px solid var(--tf-border-strong); border-radius: 5px; background: var(--tf-surface-faint); color: var(--tf-fg-primary); }
.ws-more:hover { background: var(--tf-surface-strong); }
.ws-rowmenu { width: 210px; min-width: 210px; }
.ws-sr { position: absolute; width: 1px; height: 1px; overflow: hidden; clip-path: inset(50%); white-space: nowrap; }
</style>
<style scoped>
@container sl-portal (max-width: 720px) {
  .ws-new__menu { width: min(280px, 90cqw); }
}
@container sl-portal (max-width: 560px) {
  .ws-tabs { flex-wrap: wrap; overflow: visible; row-gap: 0; }
}
</style>
