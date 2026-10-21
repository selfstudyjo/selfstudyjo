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
          <div v-if="restart" class="jk-alert jk-alert--warning jk-pl__restart">Changes will take effect when you restart Jenkins.</div>
          <div class="jk-table-wrap">
            <table class="jk-table">
              <thead><tr><th>Name ↓</th><th>Enabled</th></tr></thead>
              <tbody>
                <tr v-for="p in installed" :key="p.id">
                  <td><div class="jk-pl__name">{{ p.name }} <span class="jk-pl__ver">{{ p.version }}</span></div><div class="jk-muted jk-pl__id">{{ p.id }}</div></td>
                  <td>
                    <button type="button" class="jk-pl__switch" :class="{ 'is-on': p.enabled !== false }" role="switch"
                            :aria-checked="p.enabled !== false" :aria-label="(p.enabled !== false ? 'Disable ' : 'Enable ') + p.name"
                            :title="p.enabled !== false ? 'Enabled' : 'Disabled'" :disabled="busy" @click="toggle(p.id, p.enabled === false)"><span></span></button>
                  </td>
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

const restart = ref(false);

async function toggle(id: string, enable: boolean) {
  busy.value = true;
  try {
    const result = await ctx.run(jcli([enable ? 'enable-plugin' : 'disable-plugin', id]),
                                 { success: `${id} ${enable ? 'enabled' : 'disabled'}` });
    if (result.ok) restart.value = true;
  } finally {
    busy.value = false;
  }
}

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
.jk-pl { max-width: 1312px; }
.jk-pl__layout { display: grid; grid-template-columns: 224px minmax(0, 1fr); gap: 24px; align-items: start; }
.jk-pl__nav { display: flex; flex-direction: column; gap: 1.6px; }
.jk-pl__tab { display: flex; align-items: center; gap: 9.6px; padding: 7.2px 11.2px; border: 0; border-radius: 9.6px; background: none; font: inherit; font-weight: 500; text-align: left; color: var(--jk-text); cursor: pointer; }
.jk-pl__tab:hover { background: var(--jk-btn-hover); }
.jk-pl__tab.is-active { background: var(--jk-btn-bg); font-weight: 650; }
.jk-pl__tab .jk-icon { width: 17.6px; height: 17.6px; }
.jk-pl__search { position: relative; margin-bottom: 14.4px; max-width: 480px; }
.jk-pl__search-icon { position: absolute; left: 12px; top: 10.4px; width: 16px; height: 16px; color: var(--jk-secondary); }
.jk-pl__search-input { padding-left: 36.8px; }
.jk-pl__name { font-weight: 600; }
.jk-pl__ver { color: var(--jk-secondary); font-weight: 500; margin-left: 4.8px; }
.jk-pl__id { font-size: 12.48px; }
.jk-pl__switch { display: inline-block; position: relative; width: 36.8px; height: 20.8px; padding: 0; border: 0; border-radius: 16px; background: rgba(119, 118, 124, 0.35); cursor: pointer; transition: background 0.15s; }
.jk-pl__switch.is-on { background: var(--jk-accent); }
.jk-pl__switch:disabled { opacity: 0.6; cursor: progress; }
.jk-pl__switch span { position: absolute; top: 2.72px; left: 2.72px; width: 15.36px; height: 15.36px; border-radius: 50%; background: #fff; transition: left 0.15s; }
.jk-pl__switch.is-on span { left: 18.4px; }
.jk-pl__restart { margin-bottom: 12px; }
.jk-pl__install { min-height: 30.4px; padding: 3.2px 12px; }
.jk-pl__h2 { margin: 0 0 12.8px; font-size: 16.8px; }
@container sl-portal (max-width: 900px) {
  .jk-pl__layout { grid-template-columns: minmax(0, 1fr); }
  .jk-pl__nav { flex-direction: row; overflow-x: auto; }
  .jk-pl__tab { white-space: nowrap; }
}
</style>
