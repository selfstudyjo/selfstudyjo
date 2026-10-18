<template>
  <div class="fx-page nb">
    <ItemHeader :name="itemName" type="Notebook" :label="item?.label" :endorsement="item?.endorsement"
                :status="saving ? 'Saving…' : 'Saved'" :tabs="['Home', 'Edit', 'Run', 'View']" :model-value="ribbon"
                @update:model-value="v => ribbon = v" @settings="settings = 'about'" @share="settings = 'share'" />
    <div class="fx-cmdbar">
      <template v-if="ribbon !== 'Run'">
        <button type="button" class="fx-cmd fx-cmd--primary" :disabled="running" @click="runAll"><FxIcon name="play" />Run all</button>
        <span class="nb-session" :class="{ 'is-on': sessionOn }"><span class="nb-dot" />{{ sessionOn ? 'Connected' : 'Session not started' }}</span>
        <span class="fx-cmdbar__sep" />
        <button type="button" class="fx-cmd" @click="addCell('code', cells.length)"><FxIcon name="code" />Code</button>
        <button type="button" class="fx-cmd" @click="addCell('markdown', cells.length)"><FxIcon name="text" />Markdown</button>
        <span class="fx-cmdbar__sep" />
        <span class="nb-lang">PySpark (Python)</span>
      </template>
      <template v-else>
        <button type="button" class="fx-cmd fx-cmd--primary" :disabled="running" @click="runAll"><FxIcon name="play" />Run all</button>
        <button type="button" class="fx-cmd" @click="runJob"><FxIcon name="play" />Run as a job</button>
        <button type="button" class="fx-cmd" @click="settings = 'schedule'"><FxIcon name="calendar" />Schedule</button>
        <button type="button" class="fx-cmd" @click="go({ page: 'monitor' })"><FxIcon name="monitor" />View recent runs</button>
      </template>
    </div>
    <div class="fx-split">
      <aside class="fx-explorer" aria-label="Explorer">
        <div class="fx-explorer__head">Explorer</div>
        <div class="fx-explorer__body">
          <div class="nb-sec">Data items</div>
          <template v-if="item?.lakehouse">
            <div class="fx-node nb-lh"><FxIcon name="Lakehouse" /><span class="fx-node__label">{{ item.lakehouse }}</span>
              <span class="fx-pill fx-pill--brand nb-default">Default</span></div>
            <button v-for="t in lhTables" :key="t.schema + t.name" type="button" class="fx-node nb-l2" title="Insert a cell that reads this table"
                    @click="insertRead(t)">
              <FxIcon name="Table" /><span class="fx-node__label">{{ t.schema }}.{{ t.name }}</span>
            </button>
          </template>
          <p v-else class="fx-muted nb-hint">No lakehouse attached. Add one so spark.read.table() and %%sql resolve table names.</p>
          <div class="nb-attach">
            <select v-model="attachTo" class="fx-select" aria-label="Lakehouse">
              <option value="">Add data items…</option>
              <option v-for="l in lakehouses" :key="l.name" :value="l.name">{{ l.name }}</option>
            </select>
            <button type="button" class="fx-btn" :disabled="!attachTo" @click="attach">{{ item?.lakehouse ? 'Change' : 'Add' }}</button>
          </div>
        </div>
      </aside>

      <section class="fx-content nb-cells">
        <div class="nb-scroll">
          <div v-if="!cells.length" class="fx-empty">
            <FxIcon name="Notebook" :size="44" /><h3>This notebook is empty</h3>
            <div class="nb-add"><button type="button" class="fx-btn" @click="addCell('code', 0)">+ Code</button>
              <button type="button" class="fx-btn" @click="addCell('markdown', 0)">+ Markdown</button></div>
          </div>
          <div v-for="(cell, index) in cells" :key="cell.key" class="nb-cell" :class="{ 'is-md': cell.type === 'markdown', 'is-focus': focus === index }"
               @click="focus = index">
            <div class="nb-gutter">
              <button v-if="cell.type !== 'markdown'" type="button" class="nb-runbtn" :title="'Run cell (Shift+Enter)'"
                      :aria-label="'Run cell ' + (index + 1)" @click.stop="runCell(index)">
                <FxIcon :name="cell.running ? 'running' : 'play'" :size="14" />
              </button>
              <span class="nb-count">[{{ cell.count || ' ' }}]</span>
            </div>
            <div class="nb-body">
              <div class="nb-tools">
                <span class="nb-kind">{{ cell.type === 'markdown' ? 'Markdown' : cell.type === 'parameters' ? 'Parameters' : 'PySpark (Python)' }}</span>
                <span class="fx-cmdbar__grow" />
                <button type="button" class="fx-iconbtn" title="Move up" :disabled="index === 0" @click.stop="move(index, -1)">↑</button>
                <button type="button" class="fx-iconbtn" title="Move down" :disabled="index === cells.length - 1" @click.stop="move(index, 1)">↓</button>
                <button type="button" class="fx-iconbtn" :title="cell.type === 'markdown' ? 'Convert to code' : 'Convert to markdown'" @click.stop="convert(index)">
                  <FxIcon :name="cell.type === 'markdown' ? 'code' : 'text'" :size="14" /></button>
                <button type="button" class="fx-iconbtn" title="Delete cell" @click.stop="removeCell(index)"><FxIcon name="delete" :size="14" /></button>
              </div>
              <div v-if="cell.type === 'markdown' && focus !== index" class="nb-md" @dblclick="focus = index">
                <template v-for="(line, li) in cell.source.split('\n')" :key="li">
                  <h2 v-if="line.startsWith('## ')">{{ line.slice(3) }}</h2>
                  <h1 v-else-if="line.startsWith('# ')">{{ line.slice(2) }}</h1>
                  <h3 v-else-if="line.startsWith('### ')">{{ line.slice(4) }}</h3>
                  <li v-else-if="line.startsWith('- ')">{{ line.slice(2) }}</li>
                  <p v-else-if="line.trim()">{{ line }}</p>
                </template>
                <p v-if="!cell.source.trim()" class="fx-muted">Double-click to edit markdown</p>
              </div>
              <textarea v-else v-model="cell.source" class="fx-code nb-code" spellcheck="false" :rows="Math.max(3, cell.source.split('\n').length + 1)"
                        :aria-label="'Cell ' + (index + 1)" @blur="save(index)"
                        @keydown.shift.enter.prevent="runCell(index)" @keydown.ctrl.enter.prevent="runCell(index)" />
              <div v-if="cell.output || cell.grids.length" class="nb-out" :class="{ 'is-error': cell.error }">
                <div v-if="cell.duration" class="nb-meta fx-muted">{{ cell.error ? 'Failed' : 'Succeeded' }} · Command executed in {{ cell.duration }}</div>
                <pre v-if="cell.output" class="nb-text">{{ cell.output }}</pre>
                <div v-for="(g, gi) in cell.grids" :key="gi" class="nb-grid"><FxGrid :grid="g" /></div>
              </div>
            </div>
          </div>
          <div v-if="cells.length" class="nb-add nb-addend">
            <button type="button" class="fx-btn fx-btn--sm" @click="addCell('code', cells.length)">+ Code</button>
            <button type="button" class="fx-btn fx-btn--sm" @click="addCell('markdown', cells.length)">+ Markdown</button>
          </div>
        </div>
      </section>
    </div>
    <ItemSettingsPanel v-if="settings && item" :item="item" :tab="settings" @close="settings = ''" />
  </div>
</template>

<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue';
import FxIcon from './FxIcon.vue';
import FxGrid from './FxGrid.vue';
import ItemHeader from './ItemHeader.vue';
import ItemSettingsPanel from './ItemSettingsPanel.vue';
import { cli, errorText, gridsOf, itemPath, messagesOf, rows, useFabric, type Grid } from './fabric';

interface Cell { key: number; type: string; source: string; saved: string; output: string; grids: Grid[];
  error: boolean; running: boolean; count: number; duration: string }

const { portal, route, go, api, run } = useFabric();
const wsName = computed(() => String(route.value.ws || ''));
const itemName = computed(() => String(route.value.item || ''));
const item = computed(() => rows(portal.value, 'items').find(i => i.workspace === wsName.value
  && i.name === itemName.value && i.type === 'Notebook'));
const path = computed(() => itemPath(wsName.value, itemName.value, 'Notebook'));
const stored = computed(() => rows(portal.value, 'notebooks').find(n => n.workspace === wsName.value
  && n.name === itemName.value)?.cells || []);
const lakehouses = computed(() => rows(portal.value, 'items').filter(i => i.type === 'Lakehouse'));
const lhTables = computed(() => rows(portal.value, 'objects').filter(o => o.item === item.value?.lakehouse));

const ribbon = ref('Home');
const settings = ref('');
const attachTo = ref('');
const focus = ref(-1);
const saving = ref(false);
const running = ref(false);
const sessionOn = ref(false);
let keySeq = 0;
let execCount = 0;
const cells = ref<Cell[]>([]);

function sync() {
  const old = cells.value;
  cells.value = stored.value.map((c: any, i: number) => {
    const prev = old[i];
    return reactive<Cell>({ key: prev?.key ?? ++keySeq, type: c.type, source: c.source, saved: c.source,
      output: prev?.output || '', grids: prev?.grids || [], error: prev?.error || false, running: false,
      count: prev?.count || 0, duration: prev?.duration || '' });
  });
}
watch(stored, sync, { immediate: true, deep: true });

async function setCell(index: number, field: string, value: string, quiet = true) {
  saving.value = true;
  const key = field === 'source' ? `cells[${index}]` : `cells[${index}].${field}`;
  const r = await run(cli(['fab', 'set', path.value, '-q', key, '-i', value]), '', { quiet });
  saving.value = false;
  if (!r.ok) api.notify('error', 'Couldn\'t save the notebook', errorText(r));
  return r.ok;
}

async function save(index: number) {
  const cell = cells.value[index];
  if (!cell || cell.source === cell.saved) return;
  if (await setCell(index, 'source', cell.source)) cell.saved = cell.source;
}

async function addCell(type: string, at: number) {
  // Cells are appended by the engine; insertion in the middle rewrites the tail.
  if (at !== cells.value.length) at = cells.value.length;
  if (type === 'markdown') await setCell(at, 'type', 'markdown');
  else await setCell(at, 'source', '# New cell');
  focus.value = at;
}

async function removeCell(index: number) {
  await setCell(index, 'source', 'null');
  focus.value = -1;
}

async function convert(index: number) {
  const cell = cells.value[index];
  await save(index);
  await setCell(index, 'type', cell.type === 'markdown' ? 'code' : 'markdown');
}

async function move(index: number, delta: number) {
  const other = index + delta;
  const a = cells.value[index];
  const b = cells.value[other];
  if (!a || !b) return;
  await setCell(index, 'source', b.source);
  await setCell(other, 'source', a.source);
  if (a.type !== b.type) {
    await setCell(index, 'type', b.type);
    await setCell(other, 'type', a.type);
  }
  focus.value = other;
}

async function runCell(index: number) {
  const first = cells.value[index];
  if (!first || first.type === 'markdown') return;
  await save(index);
  // Saving and running both refresh the view, which rebuilds the cell list,
  // so the cell is looked up again after every await.
  const source = cells.value[index]?.source ?? first.source;
  // A notebook runs against ITS default lakehouse; the interactive session is
  // pointed at it first when another notebook moved it elsewhere.
  if (item.value?.lakehouse && portal.value.nb_lakehouse !== item.value.lakehouse) {
    await api.exec(`%%configure
${JSON.stringify({ defaultLakehouse: { name: item.value.lakehouse } })}`,
      { surface: 'fabric_notebook', quiet: true, unlogged: true });
  }
  if (cells.value[index]) cells.value[index].running = true;
  const started = performance.now();
  const result = await api.exec(source, { surface: 'fabric_notebook', quiet: true });
  const cell = cells.value[index];
  if (!cell) return;
  cell.running = false;
  sessionOn.value = true;
  execCount += 1;
  cell.count = execCount;
  cell.duration = `${((performance.now() - started) / 1000).toFixed(1)} sec`;
  cell.error = !result.ok;
  cell.grids = result.ok ? gridsOf(result) : [];
  cell.output = result.ok ? messagesOf(result).join('\n') : errorText(result);
}

async function runAll() {
  running.value = true;
  for (let i = 0; i < cells.value.length; i++) {
    if (cells.value[i].type === 'markdown') continue;
    await runCell(i);
    if (cells.value[i].error) break;
  }
  running.value = false;
}

async function runJob() {
  await run(cli(['fab', 'job', 'run', path.value]), `Notebook ${itemName.value} run finished`);
}

async function attach() {
  if (await run(cli(['fab', 'set', path.value], { '-q': 'lakehouse', '-i': attachTo.value }),
    `Default lakehouse set to ${attachTo.value}`).then(r => r.ok)) attachTo.value = '';
}

async function insertRead(t: Record<string, any>) {
  const at = cells.value.length;
  await setCell(at, 'source', `df = spark.read.table("${t.schema}.${t.name}")\ndisplay(df.limit(10))`);
  focus.value = at;
}
</script>

<style scoped>
.nb-session { display: inline-flex; align-items: center; gap: 6px; margin-left: 8px; font-size: 12px; color: #616161; }
.nb-dot { width: 8px; height: 8px; border-radius: 50%; background: #bdbdbd; }
.nb-session.is-on .nb-dot { background: #107c10; }
.nb-lang { font-size: 12px; color: #616161; padding: 0 6px; }
.nb-sec { padding: 4px 8px; font-size: 12px; color: #616161; font-weight: 600; }
.nb-lh { cursor: default; font-weight: 600; }
.nb-default { margin-left: auto; flex: none; }
.nb-l2 { padding-left: 22px; }
.nb-hint { font-size: 12px; padding: 0 8px; }
.nb-attach { display: flex; gap: 6px; padding: 8px; }
.nb-attach .fx-select { flex: 1; min-width: 0; }
.nb-cells { background: #fafafa; }
.nb-scroll { flex: 1; overflow: auto; padding: 12px 16px 24px; }
.nb-cell { display: flex; gap: 6px; margin-bottom: 10px; }
.nb-gutter { width: 48px; flex: none; display: flex; flex-direction: column; align-items: center; gap: 2px; padding-top: 30px; }
.nb-runbtn { display: grid; place-items: center; width: 28px; height: 28px; border-radius: 50%; border: 1px solid #d1d1d1; background: #fff; color: #117865; cursor: pointer; }
.nb-runbtn:hover { background: #e6f2ef; }
.nb-count { font: 12px Consolas, monospace; color: #707070; }
.nb-body { flex: 1; min-width: 0; border: 1px solid #e0e0e0; border-radius: 6px; background: #fff; overflow: hidden; }
.nb-cell.is-focus .nb-body { border-color: #117865; box-shadow: 0 0 0 1px #117865; }
.nb-tools { display: flex; align-items: center; gap: 2px; padding: 2px 6px; border-bottom: 1px solid #f0f0f0; background: #fafafa; }
.nb-kind { font-size: 12px; color: #616161; }
.nb-code { min-height: 64px; resize: vertical; }
.nb-md { padding: 8px 14px; }
.nb-md h1 { font: 600 22px/28px "Segoe UI", sans-serif; margin: 4px 0; }
.nb-md h2 { font: 600 18px/24px "Segoe UI", sans-serif; margin: 4px 0; }
.nb-md h3 { font: 600 15px/20px "Segoe UI", sans-serif; margin: 4px 0; }
.nb-md p, .nb-md li { margin: 2px 0; }
.nb-out { border-top: 1px solid #f0f0f0; padding: 6px 10px; max-height: 360px; overflow: auto; }
.nb-out.is-error .nb-text { color: #c50f1f; }
.nb-meta { font-size: 12px; margin-bottom: 4px; }
.nb-text { margin: 0 0 6px; font: 12px/17px Consolas, monospace; white-space: pre-wrap; }
.nb-grid { max-height: 260px; display: flex; flex-direction: column; border: 1px solid #e0e0e0; border-radius: 4px; margin-bottom: 6px; }
.nb-add { display: flex; gap: 8px; justify-content: center; }
.nb-addend { margin-top: 4px; }
</style>
