<template>
  <div class="jk-pl">
    <h1 class="jk-h1">Plugins</h1>
    <div class="jk-pl__layout">
      <nav class="jk-pl__nav" aria-label="Plugin manager">
        <button v-for="t in TABS" :key="t.id" type="button" class="jk-pl__tab" :class="{ 'is-active': tab === t.id }"
                @click="ctx.go({ page: 'plugins', tab: t.id })"><JkIcon :name="t.icon" />{{ t.label }}</button>
      </nav>
      <section class="jk-pl__body">
        <div class="jk-pl__search">
          <JkIcon name="search" class="jk-pl__search-icon" />
          <input v-model="filter" class="jk-input jk-pl__search-input" type="search" :placeholder="tab === 'available' ? 'Search available plugins' : 'Search installed plugins'" />
        </div>

        <template v-if="tab === 'installed'">
          <div class="jk-table-wrap">
            <table class="jk-table">
              <thead><tr><th>Name ↓</th><th>Enabled</th></tr></thead>
              <tbody>
                <tr v-for="p in installed" :key="p.id">
                  <td><div class="jk-pl__name">{{ p.name }} <span class="jk-pl__ver">{{ p.version }}</span></div><div class="jk-muted jk-pl__id">{{ p.id }}</div></td>
                  <td><span class="jk-pl__switch is-on" title="Enabled"><span></span></span></td>
                </tr>
              </tbody>
            </table>
          </div>
        </template>

        <template v-else-if="tab === 'available'">
          <div class="jk-table-wrap">
            <table class="jk-table">
              <thead><tr><th>Install</th><th>Name ↓</th><th>Released</th></tr></thead>
              <tbody>
                <tr v-for="p in available" :key="p.id">
                  <td class="is-center"><button type="button" class="jk-btn jk-pl__install" :disabled="busy" @click="install(p.id)">Install</button></td>
                  <td><div class="jk-pl__name">{{ p.name }}</div><div class="jk-muted jk-pl__id">{{ p.desc }}</div></td>
                  <td class="jk-muted">{{ p.released }}</td>
                </tr>
              </tbody>
            </table>
          </div>
          <p v-if="!available.length" class="jk-empty">No plugins available.</p>
        </template>

        <template v-else-if="tab === 'updates'">
          <div class="jk-empty">No updates available</div>
        </template>

        <template v-else>
          <div class="jk-card">
            <h2 class="jk-pl__h2">Update Site</h2>
            <div class="jk-field"><label class="jk-label">URL</label><input class="jk-input" type="text" value="https://updates.jenkins.io/update-center.json" readonly /></div>
            <p class="jk-muted">The lab installs plugins from a local catalogue; nothing is downloaded.</p>
          </div>
        </template>
      </section>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import JkIcon from './JkIcon.vue';
import { useJk } from './jkContext';
import { jcli } from './jenkinsKit';

const ctx = useJk();
const r = computed(() => ctx.route.value as any);
const tab = computed(() => r.value.tab || 'installed');
const filter = ref('');
const busy = ref(false);

const TABS = [
  { id: 'updates', label: 'Updates', icon: 'reload' },
  { id: 'available', label: 'Available plugins', icon: 'puzzle' },
  { id: 'installed', label: 'Installed plugins', icon: 'status' },
  { id: 'advanced', label: 'Advanced settings', icon: 'gear' },
];

const CATALOGUE = [
  { id: 'blueocean', name: 'Blue Ocean', desc: 'BlueOcean Aggregator', released: '1 mo 3 days ago' },
  { id: 'docker-workflow', name: 'Docker Pipeline', desc: 'Build and use Docker containers from pipelines.', released: '2 mo 10 days ago' },
  { id: 'pipeline-stage-view', name: 'Pipeline: Stage View', desc: 'Pipeline Stage View Plugin.', released: '3 mo 1 day ago' },
  { id: 'pipeline-graph-view', name: 'Pipeline Graph View', desc: 'Provides a graph view of pipeline runs.', released: '12 days ago' },
  { id: 'timestamper', name: 'Timestamper', desc: 'Adds timestamps to the Console Output.', released: '4 mo 2 days ago' },
  { id: 'ws-cleanup', name: 'Workspace Cleanup', desc: 'Deletes the workspace before or after a build.', released: '6 mo ago' },
  { id: 'slack', name: 'Slack Notification', desc: 'Integrates Jenkins with Slack.', released: '1 mo 20 days ago' },
  { id: 'ansicolor', name: 'AnsiColor', desc: 'Adds support for ANSI escape sequences, including color, to Console Output.', released: '5 mo ago' },
];

const needle = computed(() => filter.value.trim().toLowerCase());
const installed = computed(() => ctx.plugins.value
  .filter(p => !needle.value || `${p.name} ${p.id}`.toLowerCase().includes(needle.value))
  .slice().sort((a, b) => a.name.localeCompare(b.name)));
const available = computed(() => CATALOGUE
  .filter(p => !ctx.plugins.value.some(i => i.id === p.id))
  .filter(p => !needle.value || `${p.name} ${p.id} ${p.desc}`.toLowerCase().includes(needle.value)));

async function install(id: string) {
  busy.value = true;
  try {
    await ctx.run(jcli(['install-plugin', id]), { success: `${id} installed successfully. No restart is required.` });
  } finally {
    busy.value = false;
  }
}
</script>

<style scoped>
.jk-pl { max-width: 82rem; }
.jk-pl__layout { display: grid; grid-template-columns: 14rem minmax(0, 1fr); gap: 1.5rem; align-items: start; }
.jk-pl__nav { display: flex; flex-direction: column; gap: 0.1rem; }
.jk-pl__tab { display: flex; align-items: center; gap: 0.6rem; padding: 0.45rem 0.7rem; border: 0; border-radius: 0.6rem; background: none; font: inherit; font-weight: 500; text-align: left; color: var(--jk-text); cursor: pointer; }
.jk-pl__tab:hover { background: var(--jk-btn-hover); }
.jk-pl__tab.is-active { background: var(--jk-btn-bg); font-weight: 650; }
.jk-pl__tab .jk-icon { width: 1.1rem; height: 1.1rem; }
.jk-pl__search { position: relative; margin-bottom: 0.9rem; max-width: 30rem; }
.jk-pl__search-icon { position: absolute; left: 0.75rem; top: 0.65rem; width: 1rem; height: 1rem; color: var(--jk-secondary); }
.jk-pl__search-input { padding-left: 2.3rem; }
.jk-pl__name { font-weight: 600; }
.jk-pl__ver { color: var(--jk-secondary); font-weight: 500; margin-left: 0.3rem; }
.jk-pl__id { font-size: 0.78rem; }
.jk-pl__switch { display: inline-block; position: relative; width: 2.3rem; height: 1.3rem; border-radius: 1rem; background: rgba(119, 118, 124, 0.35); }
.jk-pl__switch.is-on { background: var(--jk-accent); }
.jk-pl__switch span { position: absolute; top: 0.17rem; left: 1.15rem; width: 0.96rem; height: 0.96rem; border-radius: 50%; background: #fff; }
.jk-pl__install { min-height: 1.9rem; padding: 0.2rem 0.75rem; }
.jk-pl__h2 { margin: 0 0 0.8rem; font-size: 1.05rem; }
@container sl-portal (max-width: 900px) {
  .jk-pl__layout { grid-template-columns: minmax(0, 1fr); }
  .jk-pl__nav { flex-direction: row; overflow-x: auto; }
  .jk-pl__tab { white-space: nowrap; }
}
</style>
