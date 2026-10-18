<template>
  <div class="az-logs">
    <div class="az-logs__bar">
      <button type="button" class="az-btn az-btn--primary" :disabled="!query.trim() || running" @click="run"><AzIcon name="play" /> Run</button>
      <label class="az-pill">Time range : <b>Last 24 hours</b></label>
      <label class="az-pill">Scope : <select v-model="ws" aria-label="Workspace"><option v-for="w in workspaces" :key="w" :value="w">{{ w }}</option></select></label>
      <span class="az-logs__mode"><span class="az-pill">KQL mode</span></span>
    </div>
    <div class="az-logs__body">
      <aside class="az-logs__side">
        <div class="az-section-title" style="margin-top: 0">Tables</div>
        <button v-for="t in tables" :key="t" type="button" class="az-logs__table" @click="query = t + '\n| take 10'">
          <AzIcon name="columns" :size="14" /> {{ t }}</button>
        <div v-if="!tables.length" class="az-muted">No tables with data. Create a Log Analytics workspace first.</div>
        <div class="az-section-title">Queries</div>
        <button v-for="q in EXAMPLES" :key="q.label" type="button" class="az-logs__table" @click="query = q.text">
          <AzIcon name="query" :size="14" /> {{ q.label }}</button>
      </aside>
      <div class="az-logs__main">
        <textarea v-model="query" class="az-logs__editor" spellcheck="false" aria-label="Query editor"
                  placeholder="Type your query here or click one of the queries to start"
                  @keydown.shift.enter.prevent="run"></textarea>
        <div class="az-tabs" style="margin: 8px 0 6px"><button type="button" class="az-tab is-active">Results</button>
          <button type="button" class="az-tab" disabled>Chart</button></div>
        <div v-if="error" class="az-banner is-error"><AzIcon name="error" /><span>{{ error }}</span></div>
        <template v-else-if="result">
          <div class="az-count">{{ result.total }} result(s){{ result.total > result.rows.length ? ` (showing ${result.rows.length})` : '' }}</div>
          <div class="az-tablewrap">
            <table class="az-table"><thead><tr><th v-for="c in result.columns" :key="c">{{ c }}</th></tr></thead>
              <tbody><tr v-for="(r, i) in result.rows" :key="i"><td v-for="(cell, j) in r" :key="j">{{ cell ?? '' }}</td></tr>
                <tr v-if="!result.rows.length"><td :colspan="result.columns.length || 1" class="az-muted" style="text-align: center; padding: 20px">No results found from the specified time range</td></tr>
              </tbody></table>
          </div>
        </template>
        <div v-else class="az-muted" style="padding: 24px 0">Get started by running a query. Press Shift+Enter or select Run.</div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
/** The Logs blade: KQL against the workspace, run by `az monitor log-analytics query`. */
import { computed, ref } from 'vue';
import { cli, errorText, rows } from '@/utils/portalKit';
import AzIcon from './AzIcon';
import { useAz } from './azure';

const props = defineProps<{ workspace?: string }>();
const az = useAz();
const workspaces = computed(() => rows(az.p.value, 'workspaces').map(w => String(w.name)));
const ws = ref(props.workspace || workspaces.value[0] || '');
const tables = computed<string[]>(() => az.p.value.log_tables || []);
const EXAMPLES = [
  { label: 'Activity by caller', text: 'AzureActivity\n| summarize count() by Caller\n| order by count_ desc' },
  { label: 'Requests per hour', text: 'AppRequests\n| summarize requests = count() by bin(TimeGenerated, 1h)' },
  { label: 'Heartbeat by computer', text: 'Heartbeat\n| summarize count() by Computer' },
  { label: 'Failed requests', text: 'AppRequests\n| where Success == false\n| take 20' },
];
const query = ref(tables.value.length ? `${tables.value[0]}\n| take 10` : '');
const running = ref(false);
const error = ref('');
const result = ref<{ columns: string[]; rows: unknown[][]; total: number } | null>(null);

async function run() {
  running.value = true;
  error.value = '';
  const text = query.value.replace(/\s*\n\s*/g, ' ').trim();
  const res = await az.run(cli(['az', 'monitor', 'log-analytics', 'query'], { '--workspace': ws.value, '--analytics-query': text }),
                           '', { quiet: true });
  running.value = false;
  if (!res.ok) { error.value = errorText(res); result.value = null; return; }
  const data = (res.data || {}) as Record<string, any>;
  result.value = { columns: data.columns || [], rows: data.rows || [], total: Number(data.total ?? (data.rows || []).length) };
}
</script>

<style scoped>
.az-logs__bar { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; padding: 6px 0 10px; border-bottom: 1px solid #e0e0e0; }
.az-logs__mode { margin-left: auto; }
.az-logs__body { display: flex; gap: 12px; padding-top: 10px; }
.az-logs__side { flex: none; width: 210px; }
.az-logs__table { display: flex; align-items: center; gap: 6px; width: 100%; padding: 4px 6px; border: 0; background: none; border-radius: 4px;
  font: inherit; color: #242424; cursor: pointer; text-align: left; }
.az-logs__table:hover { background: #f5f5f5; }
.az-logs__main { flex: 1; min-width: 0; }
.az-logs__editor { width: 100%; min-height: 130px; padding: 10px; border: 1px solid #d1d1d1; border-radius: 4px; resize: vertical;
  font: 13px Consolas, 'Cascadia Mono', monospace; color: #242424; background: #fff; }
.az-logs__editor:focus { outline: 2px solid #0f6cbd; outline-offset: -1px; }
@container sl-portal (max-width: 900px) { .az-logs__body { flex-direction: column; } .az-logs__side { width: 100%; } }
</style>
