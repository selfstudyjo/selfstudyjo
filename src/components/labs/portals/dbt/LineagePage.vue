<template>
  <div ref="lnEl" class="ln">
    <form class="ln__bar" @submit.prevent="apply">
      <label class="ln__sel">
        <span class="ln__sel-label">--select</span>
        <input v-model="draft" class="dbt-input is-mono" placeholder="+fct_orders+  ·  tag:daily  ·  source:shop+" aria-label="Selector" />
      </label>
      <label class="ln__sel ln__sel--ex">
        <span class="ln__sel-label">--exclude</span>
        <input v-model="draftExclude" class="dbt-input is-mono" placeholder="" aria-label="Exclude" />
      </label>
      <button type="submit" class="dbt-btn dbt-btn--primary">Update graph</button>
      <button type="button" class="dbt-btn" @click="reset">Reset</button>
      <label class="dbt-check"><input v-model="showTests" type="checkbox" />Tests</label>
      <span class="dbt-spacer"></span>
      <span v-if="applied" class="dbt-muted ln__count">{{ highlight ? highlight.size : 0 }} node{{ highlight && highlight.size === 1 ? '' : 's' }} selected</span>
    </form>
    <div class="ln__body">
      <div class="ln__graph">
        <LineageGraph :graph="graph" :highlight="highlight" :active-id="activeId"
                      :empty-text="dbt.parsed.value ? 'This project has no nodes.' : 'Parse the project (dbt parse) to draw its lineage.'"
                      @select="selectNode" @menu="nodeMenu" />
      </div>
      <aside v-if="active" class="ln__panel">
        <div class="ln__panel-head">
          <span class="dbt-kind" :class="'dbt-kind--' + active.kind"><DbtIcon :name="active.kind" />{{ KIND_LABEL[active.kind] }}</span>
          <button type="button" class="ln__x" aria-label="Close" @click="activeId = ''"><DbtIcon name="close" /></button>
        </div>
        <h2>{{ active.name }}</h2>
        <StatusChip :status="active.status" :empty="active.kind === 'source' ? 'Freshness not checked' : 'Not run'" />
        <dl class="dbt-dl ln__dl">
          <dt>Parents</dt><dd>{{ (graph.parents.get(active.id) || []).length }}</dd>
          <dt>Children</dt><dd>{{ (graph.children.get(active.id) || []).length }}</dd>
          <dt v-if="active.materialized">Materialized</dt><dd v-if="active.materialized">{{ active.materialized }}</dd>
          <dt v-if="active.path">File</dt><dd v-if="active.path" class="dbt-mono">{{ active.path }}</dd>
        </dl>
        <div class="ln__actions">
          <button type="button" class="dbt-btn dbt-btn--sm" @click="focus('+' + active.name)">Select +{{ short }}</button>
          <button type="button" class="dbt-btn dbt-btn--sm" @click="focus(active.name + '+')">Select {{ short }}+</button>
          <button type="button" class="dbt-btn dbt-btn--sm" @click="focus('+' + active.name + '+')">Select +{{ short }}+</button>
        </div>
        <div class="ln__actions">
          <button type="button" class="dbt-btn dbt-btn--sm" @click="dbt.go({ page: 'resource', id: active.id })"><DbtIcon name="info" />View details</button>
          <button v-if="buildCommand" type="button" class="dbt-btn dbt-btn--sm dbt-btn--primary" :disabled="dbt.busy.value" @click="build"><DbtIcon name="hammer" />{{ buildLabel }}</button>
        </div>
        <p v-if="buildCommand" class="dbt-help">Runs <code class="dbt-mono">{{ buildCommand }}</code></p>
      </aside>
    </div>
    <DbtContextMenu v-if="ctxMenu" :key="ctxMenu.key" :x="ctxMenu.x" :y="ctxMenu.y" :title="ctxMenu.title" :items="ctxMenu.items"
                    @close="ctxMenu = null" />
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import { cli } from '@/utils/portalKit';
import DbtIcon from './DbtIcon.vue';
import LineageGraph from './LineageGraph.vue';
import DbtContextMenu from './DbtContextMenu.vue';
import StatusChip from './StatusChip.vue';
import { useDbt } from './dbtContext';
import { KIND_LABEL, selectNodes, type DbtMenuItem } from './dbt';

const dbt = useDbt();
const initial = dbt.route.value.page === 'lineage' ? dbt.route.value.select || '' : '';
const draft = ref(initial);
const draftExclude = ref('');
const applied = ref(initial);
const appliedExclude = ref('');
const showTests = ref(false);
const activeId = ref('');

const graph = computed(() => dbt.graph(showTests.value));
const highlight = computed(() => {
  if (!applied.value.trim()) return null;
  const chosen = selectNodes(graph.value, applied.value);
  if (appliedExclude.value.trim()) selectNodes(graph.value, appliedExclude.value).forEach(id => chosen.delete(id));
  return chosen;
});
const active = computed(() => graph.value.nodes.get(activeId.value) || null);
const short = computed(() => {
  const n = active.value?.name || '';
  return n.length > 14 ? n.slice(0, 13) + '…' : n;
});

function apply() {
  applied.value = draft.value.trim();
  appliedExclude.value = draftExclude.value.trim();
  dbt.route.value = { page: 'lineage', select: applied.value || undefined };
}
function reset() { draft.value = ''; draftExclude.value = ''; apply(); }
function focus(expr: string) { draft.value = expr; apply(); }
function selectNode(id: string) { activeId.value = id; }

const buildCommand = computed(() => {
  const n = active.value;
  if (!n) return '';
  if (n.kind === 'model') return cli(['dbt', 'build'], { '--select': n.name });
  if (n.kind === 'seed') return cli(['dbt', 'seed'], { '--select': n.name });
  if (n.kind === 'snapshot') return cli(['dbt', 'snapshot'], { '--select': n.name });
  if (n.kind === 'test') return cli(['dbt', 'test'], { '--select': n.name });
  if (n.kind === 'source') return cli(['dbt', 'source', 'freshness'], { '--select': 'source:' + n.name });
  return '';
});
const buildLabel = computed(() => ({ model: 'Build', seed: 'Seed', snapshot: 'Snapshot', test: 'Run test', source: 'Check freshness' } as Record<string, string>)[active.value?.kind || ''] || 'Run');
const lnEl = ref<HTMLElement | null>(null);
const ctxMenu = ref<{ key: number; x: number; y: number; title: string; items: DbtMenuItem[] } | null>(null);
let ctxSeq = 0;

async function runLine(line: string, label: string) {
  const result = await dbt.run(line, { quiet: true });
  if (result.ok) dbt.notify('success', `${label}: done`, line);
  else dbt.notify('error', `${label}: errors`, 'See the Equivalent CLI drawer for the log.');
}

/** Right-click a node: select around it, run it, open it. */
function nodeMenu(event: MouseEvent, id: string) {
  const n = graph.value.nodes.get(id);
  if (!n) return;
  activeId.value = id;
  const busy = dbt.busy.value;
  const items: DbtMenuItem[] = [
    { label: `Select +${n.name}`, icon: 'lineage', hint: 'parents', action: () => focus('+' + n.name) },
    { label: `Select ${n.name}+`, icon: 'lineage', hint: 'children', action: () => focus(n.name + '+') },
    { label: `Select +${n.name}+`, icon: 'lineage', action: () => focus('+' + n.name + '+') },
    { label: 'Exclude from graph', icon: 'close', action: () => {
      draftExclude.value = [draftExclude.value.trim(), n.name].filter(Boolean).join(' ');
      if (!draft.value.trim()) draft.value = '*';
      apply();
    } },
    { divider: true, label: '' },
  ];
  if (n.kind === 'model') {
    items.push(
      { label: 'Build', icon: 'hammer', hint: 'dbt build', disabled: busy, action: () => runLine(cli(['dbt', 'build'], { '--select': n.name }), 'Build') },
      { label: 'Build with upstream', icon: 'hammer', hint: '+' + n.name, disabled: busy,
        action: () => runLine(cli(['dbt', 'build'], { '--select': '+' + n.name }), 'Build') },
      { label: 'Build with downstream', icon: 'hammer', hint: n.name + '+', disabled: busy,
        action: () => runLine(cli(['dbt', 'build'], { '--select': n.name + '+' }), 'Build') },
      { label: 'Run', icon: 'play', hint: 'dbt run', disabled: busy, action: () => runLine(cli(['dbt', 'run'], { '--select': n.name }), 'Run') },
      { label: 'Test', icon: 'test', hint: 'dbt test', disabled: busy, action: () => runLine(cli(['dbt', 'test'], { '--select': n.name }), 'Test') },
    );
  } else if (n.kind === 'seed') {
    items.push({ label: 'Seed', icon: 'seed', disabled: busy, action: () => runLine(cli(['dbt', 'seed'], { '--select': n.name }), 'Seed') },
      { label: 'Build downstream', icon: 'hammer', disabled: busy, action: () => runLine(cli(['dbt', 'build'], { '--select': n.name + '+' }), 'Build') });
  } else if (n.kind === 'snapshot') {
    items.push({ label: 'Snapshot', icon: 'snapshot', disabled: busy, action: () => runLine(cli(['dbt', 'snapshot'], { '--select': n.name }), 'Snapshot') });
  } else if (n.kind === 'test') {
    items.push({ label: 'Run test', icon: 'test', disabled: busy, action: () => runLine(cli(['dbt', 'test'], { '--select': n.name }), 'Run test') });
  } else if (n.kind === 'source') {
    items.push({ label: 'Check freshness', icon: 'clock', disabled: busy,
      action: () => runLine(cli(['dbt', 'source', 'freshness'], { '--select': 'source:' + n.name }), 'Check freshness') },
    { label: 'Build everything downstream', icon: 'hammer', disabled: busy,
      action: () => runLine(cli(['dbt', 'build'], { '--select': 'source:' + n.name + '+' }), 'Build') });
  }
  items.push({ divider: true, label: '' },
    { label: 'View details', icon: 'info', action: () => dbt.go({ page: 'resource', id: n.id }) });
  if (n.path && dbt.files.value.some(f => f.path === n.path)) {
    items.push({ label: 'Open in Studio IDE', icon: 'code', action: () => dbt.go({ page: 'develop' }) });
  }
  const box = lnEl.value?.getBoundingClientRect();
  ctxMenu.value = { key: ++ctxSeq, x: event.clientX - (box?.left || 0), y: event.clientY - (box?.top || 0), title: n.name, items };
}

async function build() {
  const line = buildCommand.value;
  if (!line) return;
  const result = await dbt.run(line, { quiet: true });
  if (result.ok) dbt.notify('success', `${buildLabel.value}: done`, line);
  else dbt.notify('error', `${buildLabel.value}: errors`, 'See the Equivalent CLI drawer for the log.');
}
</script>

<style scoped src="./dbt.css"></style>
<style scoped>
.ln { position: relative; flex: 1; min-height: 0; display: flex; flex-direction: column; }
.ln__bar { flex: none; display: flex; align-items: center; gap: 8px; padding: 10px 16px; background: #fff; border-bottom: 1px solid var(--dbt-border); flex-wrap: wrap; }
.ln__sel { display: flex; align-items: center; flex: 1 1 260px; min-width: 0; border: 1px solid var(--dbt-border-strong); border-radius: 6px; overflow: hidden; }
.ln__sel--ex { flex: 0 1 200px; }
.ln__sel-label { white-space: nowrap; padding: 0 8px; font-family: var(--dbt-mono); font-size: 12px; color: var(--dbt-muted); background: var(--dbt-bg-2); align-self: stretch; display: flex; align-items: center; border-right: 1px solid var(--dbt-border); }
.ln__sel .dbt-input { border: 0; border-radius: 0; }
.ln__sel .dbt-input:focus { box-shadow: none; }
.ln__count { font-size: 12px; }
.ln__body { flex: 1; min-height: 0; display: flex; }
.ln__graph { flex: 1; min-width: 0; padding: 12px; display: flex; flex-direction: column; }
.ln__panel { flex: none; width: 290px; border-left: 1px solid var(--dbt-border); background: #fff; padding: 14px 16px; overflow: auto; display: flex; flex-direction: column; gap: 10px; }
.ln__panel-head { display: flex; align-items: center; }
.ln__panel-head .dbt-kind { flex: 1; }
.ln__panel h2 { margin: 0; font-size: 16px; font-weight: 600; overflow-wrap: anywhere; }
.ln__x { border: 0; background: none; width: 26px; height: 26px; border-radius: 6px; cursor: pointer; color: var(--dbt-muted); display: grid; place-items: center; }
.ln__x:hover { background: var(--dbt-hover); }
.ln__dl { grid-template-columns: 90px 1fr !important; }
.ln__actions { display: flex; gap: 6px; flex-wrap: wrap; }
@container sl-portal (max-width: 860px) {
  .ln__body { flex-direction: column; }
  .ln__panel { width: auto; border-left: 0; border-top: 1px solid var(--dbt-border); max-height: 45%; }
}
</style>
