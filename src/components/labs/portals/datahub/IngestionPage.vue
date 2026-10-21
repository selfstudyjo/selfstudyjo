<template>
  <div class="dh-page">
    <div class="dh-page-head">
      <div>
        <h1 class="dh-title">Manage Data Sources</h1>
        <p class="dh-subtitle">Configure and run metadata ingestion from PostgreSQL, Snowflake, dbt, Kafka and Airflow. A source is a recipe file; executing it pulls schemas into the catalogue and, with classification on, tags PII columns.</p>
      </div>
      <button type="button" class="dh-btn" :disabled="dh.busy.value" @click="refresh"><DhIcon name="refresh" /> Refresh</button>
      <button type="button" class="dh-btn dh-btn--primary" @click="showCreate = true"><DhIcon name="plus" /> Create new source</button>
    </div>

    <nav class="dh-tabs" aria-label="Ingestion">
      <button type="button" :class="{ 'is-active': tab === 'sources' }" @click="tab = 'sources'">Sources <span class="dh-count">{{ dh.recipeFiles.value.length }}</span></button>
      <button type="button" :class="{ 'is-active': tab === 'deployed' }" @click="tab = 'deployed'">Scheduled <span class="dh-count">{{ dh.sources.value.length }}</span></button>
      <button type="button" :class="{ 'is-active': tab === 'history' }" @click="tab = 'history'">Run history <span class="dh-count">{{ dh.ingests.value.length }}</span></button>
    </nav>

    <template v-if="tab === 'sources'">
      <div v-if="!dh.recipeFiles.value.length" class="dh-card dh-empty">
        <DhIcon name="plug" />
        <span>No ingestion sources yet.</span>
        <span class="dh-hint">Write a recipe (YAML with a <code>source.type</code>) in the Files tool, then press Refresh.</span>
        <button type="button" class="dh-btn dh-btn--primary" @click="showCreate = true">How do I create one?</button>
      </div>
      <div v-else class="dh-table-wrap">
        <table class="dh-table">
          <thead><tr><th>Name</th><th>Type</th><th>Sink</th><th>Last execution</th><th>Status</th><th class="dh-actions">Actions</th></tr></thead>
          <tbody>
            <tr v-for="r in dh.recipeFiles.value" :key="r.path">
              <td><b>{{ nameOf(r.path) }}</b><div class="dh-mono dh-muted">{{ r.path }}</div></td>
              <td><span class="dh-src"><PlatformIcon :platform="r.type" :size="16" /> {{ platformLabel(r.type) }}</span></td>
              <td class="dh-mono">{{ r.sink }}</td>
              <td>{{ lastRun(r.path) ? clockAgo(lastRun(r.path)!.at, now) : 'Never' }}</td>
              <td>
                <span v-if="failed[r.path]" class="dh-pill dh-pill--bad">Failed</span>
                <span v-else-if="lastRun(r.path)" class="dh-pill dh-pill--ok">Succeeded</span>
                <span v-else class="dh-pill dh-pill--grey">Pending</span>
              </td>
              <td class="dh-actions">
                <button v-if="outputs[r.path]" type="button" class="dh-btn dh-btn--sm" @click="details = r.path">Details</button>
                <button type="button" class="dh-btn dh-btn--sm dh-btn--primary" :disabled="dh.busy.value" @click="execute(r.path)"><DhIcon name="play" :size="11" /> Execute</button>
                <DhMenu :label="'Actions for ' + nameOf(r.path)" :items="recipeActions(r.path)" />
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </template>

    <template v-else-if="tab === 'deployed'">
      <div v-if="!dh.sources.value.length" class="dh-card dh-empty">
        <DhIcon name="clock" />
        <span>No scheduled sources. Use a recipe's <b>...</b> menu and <b>Schedule</b> to deploy it as a DataHub ingestion source.</span>
      </div>
      <div v-else class="dh-table-wrap">
        <table class="dh-table">
          <thead><tr><th>Name</th><th>Type</th><th>Recipe</th><th>Schedule</th><th>Runs</th><th>Last status</th><th class="dh-actions">Actions</th></tr></thead>
          <tbody>
            <tr v-for="src in dh.sources.value" :key="src.name">
              <td><b>{{ src.name }}</b><div class="dh-mono dh-muted">{{ src.urn }}</div></td>
              <td><span class="dh-src"><PlatformIcon :platform="src.type" :size="16" /> {{ platformLabel(src.type) }}</span></td>
              <td class="dh-mono">{{ src.recipe }}</td>
              <td class="dh-mono">{{ src.schedule || 'None' }}</td>
              <td>{{ src.runs }}</td>
              <td><span class="dh-pill" :class="src.last_status === 'SUCCESS' ? 'dh-pill--ok' : 'dh-pill--grey'">{{ src.last_status || 'Never run' }}</span></td>
              <td class="dh-actions">
                <button type="button" class="dh-btn dh-btn--sm dh-btn--primary" :disabled="dh.busy.value" @click="execute(src.recipe)"><DhIcon name="play" :size="11" /> Execute</button>
                <DhMenu :label="'Actions for ' + src.name" :items="sourceActions(src)" />
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </template>

    <template v-else>
      <div v-if="!dh.ingests.value.length" class="dh-card dh-empty"><DhIcon name="clock" /><span>No ingestion runs yet.</span></div>
      <div v-else class="dh-table-wrap">
        <table class="dh-table">
          <thead><tr><th>Recipe</th><th>Source</th><th>Executed</th><th>Assets ingested</th><th>PII columns classified</th></tr></thead>
          <tbody>
            <tr v-for="(g, i) in historyNewestFirst" :key="i">
              <td class="dh-mono">{{ g.recipe }}</td>
              <td><span class="dh-src"><PlatformIcon :platform="g.source" :size="16" /> {{ platformLabel(g.source) }}</span></td>
              <td>{{ clockAgo(g.at, now) }}</td>
              <td>{{ g.datasets }}</td>
              <td><span :class="g.classified ? 'dh-pill dh-pill--warn' : ''">{{ g.classified }}</span></td>
            </tr>
          </tbody>
        </table>
      </div>
    </template>

    <DhModal v-if="details" :title="'Execution details: ' + nameOf(details)" :width="720" @close="details = ''">
      <pre class="dh-pre">{{ outputs[details] }}</pre>
      <template #footer><button type="button" class="dh-btn dh-btn--primary" @click="details = ''">Close</button></template>
    </DhModal>

    <DhModal v-if="deploy" :title="deploy.editing ? 'Edit schedule' : 'Schedule ingestion'" ok-text="Save & Run later"
             :ok-disabled="!deploy.name.trim()" :busy="dh.busy.value" @close="deploy = null" @ok="saveDeploy">
      <p class="dh-muted">Deploys <code>{{ deploy.recipe }}</code> as a DataHub ingestion source (<code>datahub ingest deploy</code>).</p>
      <div class="dh-field"><span class="dh-label"><b>*</b>Name</span>
        <input v-model="deploy.name" class="dh-input" :disabled="deploy.editing" aria-label="Source name" /></div>
      <div class="dh-field"><span class="dh-label">Schedule (cron)</span>
        <select v-model="deploy.preset" class="dh-select" aria-label="Schedule preset" @change="deploy.schedule = deploy.preset">
          <option value="">No schedule (run on demand)</option>
          <option value="0 * * * *">Every hour</option>
          <option value="0 0 * * *">Every day at midnight</option>
          <option value="0 6 * * 1">Every Monday at 06:00</option>
        </select>
        <input v-model="deploy.schedule" class="dh-input dh-mono" placeholder="0 * * * *" aria-label="Cron expression" /></div>
      <div v-if="deployError" class="dh-alert dh-alert--error"><DhIcon name="x-circle" /><span>{{ deployError }}</span></div>
    </DhModal>

    <DhModal v-if="showCreate" title="Create new source" :width="680" @close="showCreate = false">
      <p>In DataHub a source is a <b>recipe</b>: a YAML file naming the source type, its connection and options. Choose a type, then save the recipe with the Files tool (for example as <code>ingestion/{{ sampleType }}.yml</code>) and press <b>Refresh</b> - it appears here, ready to execute.</p>
      <div class="dh-srcgrid">
        <button v-for="t in TYPES" :key="t" type="button" class="dh-srccard" :class="{ 'is-on': sampleType === t }" @click="sampleType = t">
          <PlatformIcon :platform="t" :size="26" /><span>{{ platformLabel(t) }}</span>
        </button>
      </div>
      <pre class="dh-pre">{{ sample }}</pre>
      <template #footer>
        <button type="button" class="dh-btn" @click="copySample"><DhIcon name="copy" /> Copy recipe</button>
        <button type="button" class="dh-btn dh-btn--primary" @click="showCreate = false">Done</button>
      </template>
    </DhModal>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue';
import DhIcon from './DhIcon.vue';
import DhModal from './DhModal.vue';
import DhMenu from './DhMenu.vue';
import { errorText } from '@/utils/portalKit';
import PlatformIcon from './PlatformIcon.vue';
import { clockAgo, dh as cmd, platformLabel, useDh, type DhMenuItem, type DhSource } from './dhContext';

const dh = useDh();
const TYPES = ['postgres', 'snowflake', 'dbt', 'kafka', 'airflow'];
const tab = ref<'sources' | 'deployed' | 'history'>('sources');
const showCreate = ref(false);
const sampleType = ref('postgres');
const details = ref('');
const outputs = reactive<Record<string, string>>({});
const failed = reactive<Record<string, boolean>>({});

const now = computed(() => dh.clock.value);
const historyNewestFirst = computed(() => dh.ingests.value.slice().reverse());

const sample = computed(() => {
  const host: Record<string, string> = {
    postgres: '    host_port: shop-db.shopflow.internal:5432\n    database: shop\n    username: datahub\n    password: ${PG_PASSWORD}',
    snowflake: '    account_id: shopflow-xy12345\n    warehouse: COMPUTE_WH\n    role: DATAHUB_ROLE\n    username: datahub\n    password: ${SNOWFLAKE_PASSWORD}',
    dbt: '    manifest_path: target/manifest.json\n    catalog_path: target/catalog.json\n    target_platform: snowflake',
    kafka: '    connection:\n      bootstrap: kafka-1.shopflow.internal:9092\n      schema_registry_url: http://schema-registry.shopflow.internal:8081',
    airflow: '    base_url: http://airflow.shopflow.internal:8080',
  };
  return `# ingestion/${sampleType.value}.yml\nsource:\n  type: ${sampleType.value}\n  config:\n${host[sampleType.value]}\n    classification:\n      enabled: true\nsink:\n  type: datahub-rest\n  config:\n    server: http://datahub-gms.shopflow.internal:8080\n`;
});

function nameOf(path: string) {
  return path.split('/').pop()!.replace(/\.(ya?ml)$/, '');
}

function lastRun(path: string) {
  const rows = dh.ingests.value.filter(g => g.recipe === path);
  return rows[rows.length - 1] || null;
}

async function refresh() {
  await dh.run(cmd(['datahub', 'version']), { quiet: true });
}

onMounted(() => { void dh.read(cmd(['datahub', 'version'])); });

async function execute(path: string) {
  const result = await dh.run(cmd(['datahub', 'ingest', '-c', path]), { quiet: true });
  outputs[path] = String(result.ok ? result.output || '' : result.error || result.output || '');
  failed[path] = !result.ok;
  if (result.ok) dh.notify('success', `Execution of ${nameOf(path)} succeeded`, 'Metadata ingested into the catalogue.');
  else dh.notify('error', `Execution of ${nameOf(path)} failed`, outputs[path].split('\n')[0]);
}

function recipeActions(path: string): DhMenuItem[] {
  return [
    { label: 'Execute', icon: 'play', run: () => execute(path) },
    { label: 'Schedule...', icon: 'clock', run: () => openDeploy(path, null) },
    { label: 'View details', icon: 'doc', disabled: !outputs[path], run: () => { details.value = path; } },
  ];
}
function sourceActions(src: DhSource): DhMenuItem[] {
  return [
    { label: 'Execute', icon: 'play', run: () => execute(src.recipe) },
    { label: 'Edit schedule', icon: 'pencil', run: () => openDeploy(src.recipe, src) },
    { label: 'Copy URN', icon: 'copy', run: () => navigator.clipboard?.writeText(src.urn).then(() => dh.notify('success', 'Copied URN')) },
    { divider: true },
    { label: 'Delete', icon: 'trash', danger: true, run: () => removeSource(src) },
  ];
}
const deploy = ref<{ recipe: string; name: string; schedule: string; preset: string; editing: boolean } | null>(null);
const deployError = ref('');
function openDeploy(recipe: string, src: DhSource | null) {
  deployError.value = '';
  deploy.value = { recipe, name: src?.name || nameOf(recipe), schedule: src?.schedule || '0 * * * *',
    preset: src ? (src.schedule || '') : '0 * * * *', editing: Boolean(src) };
}
async function saveDeploy() {
  const d = deploy.value;
  if (!d) return;
  const result = await dh.run(cmd(['datahub', 'ingest', 'deploy'], { '--name': d.name.trim(), '-c': d.recipe, '--schedule': d.schedule.trim() || null }),
                              { success: `Source ${d.name.trim()} saved`, quiet: true });
  if (!result.ok) { deployError.value = errorText(result); return; }
  deploy.value = null;
  tab.value = 'deployed';
}
async function removeSource(src: DhSource) {
  const ok = await dh.confirm({ title: 'Confirm Ingestion Source Removal', message: `Are you sure you want to remove the ingestion source ${src.name}? The metadata it ingested stays in the catalogue.`, yes: 'Yes', danger: true });
  if (ok) await dh.run(cmd(['datahub', 'delete'], { '--urn': src.urn }), { success: 'Removed ingestion source.' });
}

async function copySample() {
  try {
    await navigator.clipboard.writeText(sample.value);
    dh.notify('success', 'Recipe copied');
  } catch {
    dh.notify('info', 'Select the recipe text to copy it');
  }
}
</script>

<style scoped src="./dh.css"></style>
<style scoped>
.dh-subtitle code, .dh-empty code, p code { background: #f5f5f5; padding: 0 4px; border-radius: 3px; font-family: var(--dh-mono); font-size: 12px; }
.dh-src { display: inline-flex; align-items: center; gap: 6px; white-space: nowrap; }
.dh-srcgrid { display: grid; grid-template-columns: repeat(auto-fill, minmax(110px, 1fr)); gap: 8px; }
.dh-srccard { display: flex; flex-direction: column; align-items: center; gap: 6px; padding: 12px 6px; border: 1px solid var(--dh-border-2); border-radius: 8px; background: #fff; cursor: pointer; font: inherit; font-size: 13px; color: var(--dh-text); }
.dh-srccard:hover, .dh-srccard.is-on { border-color: var(--dh-primary); background: #e6f4ff; }
</style>
