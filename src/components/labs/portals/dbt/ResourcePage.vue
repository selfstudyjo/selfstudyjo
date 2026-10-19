<template>
  <div class="dbt-page">
    <div class="dbt-crumbs">
      <button type="button" @click="dbt.go({ page: 'explore' })">{{ dbt.project.value.name || 'Project' }}</button><span>/</span>
      <span>{{ KIND_LABEL[kind] }}s</span><span>/</span><span>{{ title }}</span>
    </div>
    <div v-if="!found" class="dbt-card"><div class="dbt-empty"><h3>Resource not found</h3><p class="dbt-mono">{{ uid }}</p><p>It is not in the latest manifest - parse or build the project again.</p></div></div>
    <template v-else>
      <div class="dbt-head">
        <div class="dbt-head__title">
          <span class="dbt-kind" :class="'dbt-kind--' + kind"><DbtIcon :name="kind" />{{ KIND_LABEL[kind] }}</span>
          <h1>{{ title }}</h1>
          <p v-if="relation" class="dbt-mono">{{ relation }}</p>
        </div>
        <div class="dbt-head__actions">
          <template v-if="kind === 'model'">
            <button type="button" class="dbt-btn" :disabled="dbt.busy.value || !testsHere.length" @click="exec(cli(['dbt', 'test'], { '--select': model!.name }), 'Tests finished')"><DbtIcon name="test" />Run tests</button>
            <button type="button" class="dbt-btn dbt-btn--primary" :disabled="dbt.busy.value" @click="exec(cli(['dbt', 'build'], { '--select': model!.name }), 'Model built')"><DbtIcon name="hammer" />Build model</button>
          </template>
          <button v-else-if="kind === 'source'" type="button" class="dbt-btn dbt-btn--primary" :disabled="dbt.busy.value || !source!.has_freshness"
                  @click="$emit('freshness', 'source:' + source!.source + '.' + source!.name)"><DbtIcon name="clock" />Check freshness</button>
          <button v-else-if="kind === 'seed'" type="button" class="dbt-btn dbt-btn--primary" :disabled="dbt.busy.value" @click="exec(cli(['dbt', 'seed'], { '--select': seedLike!.name }), 'Seed loaded')"><DbtIcon name="seed" />Run seed</button>
          <button v-else-if="kind === 'snapshot'" type="button" class="dbt-btn dbt-btn--primary" :disabled="dbt.busy.value" @click="exec(cli(['dbt', 'snapshot'], { '--select': seedLike!.name }), 'Snapshot taken')"><DbtIcon name="snapshot" />Run snapshot</button>
          <button v-else-if="kind === 'test'" type="button" class="dbt-btn dbt-btn--primary" :disabled="dbt.busy.value" @click="exec(cli(['dbt', 'test'], { '--select': test!.name }), 'Test finished')"><DbtIcon name="test" />Run test</button>
        </div>
      </div>

      <div class="dbt-tabs">
        <button v-for="t in tabs" :key="t.id" type="button" :class="{ 'is-active': tab === t.id }" @click="tab = t.id">{{ t.label }}</button>
      </div>

      <!-- General -->
      <div v-if="tab === 'general'" class="rs-grid">
        <section class="dbt-card">
          <div class="dbt-card__head"><h3>Description</h3></div>
          <div class="dbt-card__body">
            <p class="rs-desc" :class="{ 'dbt-muted': !description }">{{ description || 'No description. Add one in the resource\'s YAML file (description:).' }}</p>
          </div>
        </section>
        <section class="dbt-card">
          <div class="dbt-card__head"><h3>Details</h3></div>
          <div class="dbt-card__body">
            <dl class="dbt-dl">
              <template v-if="model">
                <dt>Last run status</dt><dd><StatusChip :status="model.last_status" /></dd>
                <dt>Materialization</dt><dd>{{ model.materialized }}<span v-if="model.incremental_strategy" class="dbt-muted"> · {{ model.incremental_strategy }}</span></dd>
                <dt v-if="model.unique_key">Unique key</dt><dd v-if="model.unique_key" class="dbt-mono">{{ model.unique_key }}</dd>
                <dt>Rows</dt><dd>{{ model.rows ?? '—' }}</dd>
                <dt>Execution time</dt><dd>{{ model.execution_time != null ? model.execution_time + 's' : '—' }}</dd>
                <dt>Tags</dt><dd>{{ model.tags.length ? model.tags.join(', ') : '—' }}</dd>
              </template>
              <template v-if="source">
                <dt>Freshness</dt><dd><StatusChip :status="source.freshness.status" :empty="source.has_freshness ? 'Not checked' : 'Not configured'" /></dd>
                <dt>Max loaded at</dt><dd class="dbt-mono">{{ source.freshness.max_loaded_at || '—' }}</dd>
                <dt>Age</dt><dd>{{ source.freshness.age_minutes != null ? ageText(source.freshness.age_minutes) : '—' }}</dd>
                <dt>Loaded at field</dt><dd class="dbt-mono">{{ source.loaded_at_field || '—' }}</dd>
              </template>
              <template v-if="seedLike">
                <dt>Last run status</dt><dd><StatusChip :status="seedLike.last_status" /></dd>
                <dt>Rows</dt><dd>{{ seedLike.rows ?? '—' }}</dd>
                <dt v-if="seedLike.strategy">Strategy</dt><dd v-if="seedLike.strategy">{{ seedLike.strategy }}</dd>
                <dt v-if="seedLike.unique_key">Unique key</dt><dd v-if="seedLike.unique_key" class="dbt-mono">{{ seedLike.unique_key }}</dd>
              </template>
              <template v-if="test">
                <dt>Last status</dt><dd><StatusChip :status="test.last_status" /></dd>
                <dt>Failures</dt><dd>{{ test.failures ?? '—' }}</dd>
                <dt>Test</dt><dd class="dbt-mono">{{ test.test_name }}<span class="dbt-muted"> ({{ test.kind }})</span></dd>
                <dt>Column</dt><dd class="dbt-mono">{{ test.column || '—' }}</dd>
                <dt>Severity</dt><dd>{{ test.severity || 'error' }}</dd>
                <dt>Tested resource</dt><dd><button v-if="test.attached" type="button" class="dbt-link" @click="dbt.go({ page: 'resource', id: test.attached })">{{ test.model }}</button><span v-else>—</span></dd>
              </template>
              <template v-if="exposure">
                <dt>Type</dt><dd>{{ exposure.type }}</dd>
                <dt>Owner</dt><dd>{{ exposure.owner || '—' }}</dd>
                <dt>URL</dt><dd class="dbt-mono">{{ exposure.url || '—' }}</dd>
              </template>
              <dt>Unique ID</dt><dd class="dbt-mono">{{ uid }}</dd>
              <dt v-if="path">File</dt><dd v-if="path" class="dbt-mono">{{ path }}</dd>
            </dl>
          </div>
        </section>
        <section class="dbt-card">
          <div class="dbt-card__head"><h3>Upstream</h3><span class="dbt-muted">{{ parents.length }}</span></div>
          <ul class="rs-links">
            <li v-for="p in parents" :key="p"><span class="dbt-kind" :class="'dbt-kind--' + kindOf(p)"><DbtIcon :name="kindOf(p)" /></span>
              <button type="button" class="dbt-link" @click="dbt.go({ page: 'resource', id: p })">{{ dbt.nameOf(p) }}</button></li>
            <li v-if="!parents.length" class="dbt-muted">No upstream dependencies.</li>
          </ul>
        </section>
        <section class="dbt-card">
          <div class="dbt-card__head"><h3>Downstream</h3><span class="dbt-muted">{{ children.length }}</span></div>
          <ul class="rs-links">
            <li v-for="c in children" :key="c"><span class="dbt-kind" :class="'dbt-kind--' + kindOf(c)"><DbtIcon :name="kindOf(c)" /></span>
              <button type="button" class="dbt-link" @click="dbt.go({ page: 'resource', id: c })">{{ dbt.nameOf(c) }}</button></li>
            <li v-if="!children.length" class="dbt-muted">Nothing depends on this yet.</li>
          </ul>
        </section>
      </div>

      <!-- Columns -->
      <div v-else-if="tab === 'columns'" class="dbt-table-wrap">
        <table class="dbt-table">
          <thead><tr><th>Column</th><th>Description</th><th>Data tests</th></tr></thead>
          <tbody>
            <tr v-for="c in columns" :key="c.name">
              <td class="dbt-mono">{{ c.name }}</td>
              <td :class="{ 'dbt-muted': !c.description }">{{ c.description || 'No description' }}</td>
              <td>
                <span v-for="t in c.tests" :key="t" class="rs-test" :class="'rs-test--' + statusTone(colTestStatus(c.name, t))" :title="colTestStatus(c.name, t) || 'not run'">
                  <DbtIcon :name="iconOf(colTestStatus(c.name, t))" />{{ t }}
                </span>
                <span v-if="!c.tests.length" class="dbt-muted">—</span>
              </td>
            </tr>
            <tr v-if="!columns.length"><td colspan="3" class="dbt-muted">No columns are documented. Declare them under <code class="dbt-mono">columns:</code> in a properties YAML file.</td></tr>
          </tbody>
        </table>
      </div>

      <!-- Tests -->
      <div v-else-if="tab === 'tests'" class="dbt-table-wrap">
        <table class="dbt-table">
          <thead><tr><th>Test</th><th>Column</th><th>Severity</th><th>Last status</th><th class="dbt-num">Failures</th><th></th></tr></thead>
          <tbody>
            <tr v-for="t in testsHere" :key="t.unique_id">
              <td><button type="button" class="dbt-link dbt-mono" @click="dbt.go({ page: 'resource', id: t.unique_id })">{{ t.name }}</button></td>
              <td class="dbt-mono">{{ t.column || '—' }}</td>
              <td>{{ t.severity || 'error' }}</td>
              <td><StatusChip :status="t.last_status" /></td>
              <td class="dbt-num">{{ t.failures ?? '—' }}</td>
              <td class="dbt-num"><button type="button" class="dbt-btn dbt-btn--sm" :disabled="dbt.busy.value" @click="exec(cli(['dbt', 'test'], { '--select': t.name }), 'Test finished')">Run</button></td>
            </tr>
            <tr v-if="!testsHere.length"><td colspan="6" class="dbt-muted">No data tests on this resource.</td></tr>
          </tbody>
        </table>
      </div>

      <!-- Code -->
      <div v-else-if="tab === 'code'" class="dbt-card">
        <div class="dbt-card__head">
          <div class="rs-seg" role="tablist">
            <button type="button" :class="{ 'is-active': codeView === 'source' }" @click="codeView = 'source'">Source code</button>
            <button type="button" :class="{ 'is-active': codeView === 'compiled' }" @click="codeView = 'compiled'">Compiled code</button>
          </div>
          <span class="dbt-spacer"></span>
          <button v-if="codeView === 'compiled' && model" type="button" class="dbt-btn dbt-btn--sm" :disabled="dbt.busy.value" @click="exec(cli(['dbt', 'compile'], { '--select': model.name }), 'Compiled')">Compile</button>
        </div>
        <div class="dbt-card__body">
          <pre v-if="codeView === 'source'" class="dbt-code">{{ rawCode || 'The source file is not available.' }}</pre>
          <pre v-else class="dbt-code">{{ model && model.compiled_sql ? model.compiled_sql : 'Not compiled yet - press Compile (dbt compile --select ' + (model ? model.name : '') + ').' }}</pre>
        </div>
      </div>

      <!-- Lineage -->
      <div v-else class="rs-lineage">
        <LineageGraph :graph="dbt.graph(showTests)" :ids="lineageIds" :active-id="uid" @select="id => dbt.go({ page: 'resource', id })" />
        <label class="dbt-check rs-tests-toggle"><input v-model="showTests" type="checkbox" />Show tests</label>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import { cli } from '@/utils/portalKit';
import DbtIcon from './DbtIcon.vue';
import LineageGraph from './LineageGraph.vue';
import StatusChip from './StatusChip.vue';
import { useDbt } from './dbtContext';
import { KIND_LABEL, selectNodes, statusTone, type NodeKind } from './dbt';

const props = defineProps<{ uid: string }>();
defineEmits<{ (event: 'freshness', select: string): void }>();
const dbt = useDbt();

const model = computed(() => dbt.models.value.find(m => m.unique_id === props.uid) || null);
const source = computed(() => dbt.sources.value.find(s => s.unique_id === props.uid) || null);
const seedLike = computed(() => dbt.seeds.value.find(s => s.unique_id === props.uid)
  || dbt.snapshots.value.find(s => s.unique_id === props.uid) || null);
const test = computed(() => dbt.tests.value.find(t => t.unique_id === props.uid) || null);
const exposure = computed(() => dbt.exposures.value.find(e => `exposure.${e.name}` === props.uid) || null);
const found = computed(() => !!(model.value || source.value || seedLike.value || test.value || exposure.value));

const kind = computed<NodeKind>(() => {
  if (model.value) return 'model';
  if (source.value) return 'source';
  if (test.value) return 'test';
  if (exposure.value) return 'exposure';
  if (seedLike.value) return dbt.snapshots.value.some(s => s.unique_id === props.uid) ? 'snapshot' : 'seed';
  return (String(props.uid).split('.')[0] as NodeKind) || 'model';
});
const title = computed(() => model.value?.name || (source.value ? `${source.value.source}.${source.value.name}` : '')
  || seedLike.value?.name || test.value?.name || exposure.value?.name || props.uid);
const relation = computed(() => model.value?.relation || source.value?.relation || seedLike.value?.relation || '');
const description = computed(() => model.value?.description || '');
const path = computed(() => model.value?.path || seedLike.value?.path || test.value?.path || exposure.value?.path || '');
const columns = computed(() => model.value?.columns || []);
const testsHere = computed(() => dbt.tests.value.filter(t => t.attached === props.uid));

const tabs = computed(() => {
  const list: { id: string; label: string }[] = [{ id: 'general', label: 'General' }];
  if (kind.value === 'model') {
    list.push({ id: 'columns', label: `Columns (${columns.value.length})` });
    list.push({ id: 'tests', label: `Tests (${testsHere.value.length})` });
    list.push({ id: 'code', label: 'Code' });
  } else if (kind.value === 'source' || kind.value === 'seed' || kind.value === 'snapshot') {
    list.push({ id: 'tests', label: `Tests (${testsHere.value.length})` });
  }
  list.push({ id: 'lineage', label: 'Lineage' });
  return list;
});
const tab = ref('general');
const codeView = ref<'source' | 'compiled'>('source');
const showTests = ref(false);

const graph = computed(() => dbt.graph(true));
const parents = computed(() => (graph.value.parents.get(props.uid) || []).filter(p => !p.startsWith('test.')));
const children = computed(() => (graph.value.children.get(props.uid) || []).filter(p => !p.startsWith('test.')));
const lineageIds = computed(() => {
  const name = graph.value.nodes.get(props.uid)?.name || '';
  const ids = selectNodes(dbt.graph(showTests.value), `+${name}+`);
  ids.add(props.uid);
  return ids;
});

const rawCode = computed(() => dbt.files.value.find(f => f.path === path.value)?.content || '');

function kindOf(uid: string): string { return String(uid).split('.')[0] ?? ''; }
function colTestStatus(column: string, testName: string) {
  return testsHere.value.find(t => t.column === column && (t.test_name === testName || t.name.startsWith(testName)))?.last_status || null;
}
function iconOf(s: string | null) { const t = statusTone(s); return t === 'ok' ? 'ok' : t === 'bad' ? 'bad' : t === 'warn' ? 'warn' : 'none'; }
function ageText(min: number) {
  if (min < 0) return 'just loaded';
  if (min < 60) return `${min} minutes`;
  if (min < 2880) return `${Math.round(min / 60)} hours`;
  return `${Math.round(min / 1440)} days`;
}
async function exec(command: string, success: string) {
  const result = await dbt.run(command, { quiet: true });
  if (result.ok) dbt.notify('success', success, command);
  else dbt.notify('error', `${command.split(' ').slice(0, 2).join(' ')} reported errors`, 'See the Equivalent CLI drawer for the full log.');
}
</script>

<style scoped src="./dbt.css"></style>
<style scoped>
.dbt-head__title .dbt-kind { align-self: flex-start; }
.rs-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 16px; }
.rs-desc { margin: 0; line-height: 20px; overflow-wrap: anywhere; white-space: pre-wrap; }
.rs-links { list-style: none; margin: 0; padding: 10px 16px 14px; display: flex; flex-direction: column; gap: 8px; }
.rs-links li { display: flex; align-items: center; gap: 8px; }
.rs-test { display: inline-flex; align-items: center; gap: 4px; margin: 2px 6px 2px 0; padding: 1px 8px; border-radius: 10px; font-size: 12px; background: var(--dbt-tag); color: var(--dbt-ink-2); }
.rs-test--ok { background: var(--dbt-ok-bg); color: var(--dbt-ok-ink); }
.rs-test--bad { background: var(--dbt-bad-bg); color: var(--dbt-bad-ink); }
.rs-test--warn { background: var(--dbt-warn-bg); color: var(--dbt-warn-ink); }
.rs-seg { display: inline-flex; border: 1px solid var(--dbt-border-strong); border-radius: 6px; overflow: hidden; }
.rs-seg button { border: 0; background: #fff; padding: 5px 12px; font: 500 12px var(--dbt-font); color: var(--dbt-muted); cursor: pointer; }
.rs-seg button + button { border-left: 1px solid var(--dbt-border-strong); }
.rs-seg button.is-active { background: var(--dbt-blue-bg); color: var(--dbt-blue-ink); }
.rs-lineage { position: relative; flex: 1; min-height: 360px; display: flex; flex-direction: column; border: 1px solid var(--dbt-border); border-radius: 8px; overflow: hidden; }
.rs-tests-toggle { position: absolute; left: 12px; top: 10px; background: #fff; padding: 4px 10px; border: 1px solid var(--dbt-border); border-radius: 6px; }
@container sl-portal (max-width: 860px) { .rs-grid { grid-template-columns: 1fr; } }
</style>
