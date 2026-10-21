<template>
  <div class="fx-page nb">
    <ItemHeader :name="itemName" type="Notebook" :label="item?.label" :endorsement="item?.endorsement"
                :status="saving ? 'Saving…' : 'Saved'" :tabs="['Home', 'Edit', 'Run', 'View']" :model-value="ribbon"
                @update:model-value="v => ribbon = v" @settings="settings = 'about'" @share="settings = 'share'" />
    <div class="fx-cmdbar">
      <template v-if="ribbon === 'Home'">
        <button type="button" class="fx-cmd fx-cmd--primary" :disabled="running" @click="runAll"><FxIcon name="play" />Run all</button>
        <button type="button" class="fx-cmd" :disabled="!sessionOn" @click="stopSession"><FxIcon name="stop" />Stop session</button>
        <span class="nb-session" :class="{ 'is-on': sessionOn }"><span class="nb-dot" />{{ sessionOn ? 'Connected' : 'Session not started' }}</span>
        <span class="fx-cmdbar__sep" />
        <button type="button" class="fx-cmd" @click="addCell('code', insertAt())"><FxIcon name="code" />Code</button>
        <button type="button" class="fx-cmd" @click="addCell('markdown', insertAt())"><FxIcon name="text" />Markdown</button>
        <span class="fx-cmdbar__sep" />
        <button type="button" class="fx-cmd" @click="clearOutputs"><FxIcon name="eraser" />Clear all outputs</button>
        <span class="nb-lang">PySpark (Python)</span>
      </template>
      <template v-else-if="ribbon === 'Edit'">
        <button type="button" class="fx-cmd" :disabled="focus < 0" @click="addCell('code', focus)"><FxIcon name="insertAbove" />Insert code above</button>
        <button type="button" class="fx-cmd" :disabled="focus < 0" @click="addCell('code', focus + 1)"><FxIcon name="insertBelow" />Insert code below</button>
        <button type="button" class="fx-cmd" :disabled="focus <= 0" @click="move(focus, -1)"><FxIcon name="arrowUp" />Move up</button>
        <button type="button" class="fx-cmd" :disabled="focus < 0 || focus >= cells.length - 1" @click="move(focus, 1)"><FxIcon name="arrowDown" />Move down</button>
        <button type="button" class="fx-cmd" :disabled="focus < 0" @click="askDelete(focus)"><FxIcon name="delete" />Delete cell</button>
      </template>
      <template v-else-if="ribbon === 'Run'">
        <button type="button" class="fx-cmd fx-cmd--primary" :disabled="running" @click="runAll"><FxIcon name="play" />Run all</button>
        <button type="button" class="fx-cmd" :disabled="running || focus < 0" @click="runFrom(0, focus)">Run cells above</button>
        <button type="button" class="fx-cmd" :disabled="running || focus < 0" @click="runFrom(focus, cells.length)">Run cell and below</button>
        <button type="button" class="fx-cmd" @click="runJob"><FxIcon name="play" />Run as a job</button>
        <button type="button" class="fx-cmd" @click="settings = 'schedule'"><FxIcon name="calendar" />Schedule</button>
        <button type="button" class="fx-cmd" @click="go({ page: 'monitor' })"><FxIcon name="monitor" />View recent runs</button>
      </template>
      <template v-else>
        <button type="button" class="fx-cmd" @click="explorerOpen = !explorerOpen"><FxIcon name="list" />{{ explorerOpen ? 'Hide' : 'Show' }} explorer</button>
        <button type="button" class="fx-cmd" @click="collapseOutputs = !collapseOutputs"><FxIcon name="eraser" />{{ collapseOutputs ? 'Expand' : 'Collapse' }} outputs</button>
      </template>
    </div>
    <div class="fx-split">
      <aside v-if="explorerOpen" class="fx-explorer" aria-label="Explorer">
        <div class="fx-explorer__head">Explorer</div>
        <div class="fx-explorer__body">
          <div class="nb-sec">Data items</div>
          <template v-if="item?.lakehouse">
            <div class="fx-node nb-row nb-lh" @contextmenu.prevent.stop="openMenu($event, lakehouseMenu())">
              <FxIcon name="Lakehouse" /><span class="fx-node__label">{{ item.lakehouse }}</span>
              <span class="fx-pill fx-pill--brand nb-default">Default</span>
              <button type="button" class="fx-iconbtn nb-more" :aria-label="'More options for ' + item.lakehouse" @click.stop="openMenu($event, lakehouseMenu())"><FxIcon name="more" :size="14" /></button>
            </div>
            <button type="button" class="fx-node nb-l1" @click="openTables = !openTables">
              <span class="fx-node__caret"><FxIcon :name="openTables ? 'chevronDown' : 'chevronRight'" :size="12" /></span>
              <FxIcon name="Schema" /><span class="fx-node__label">Tables</span></button>
            <template v-if="openTables">
              <div v-for="t in lhTables" :key="t.schema + t.name" class="fx-node nb-row nb-l2" title="Right-click for options"
                   @dblclick="insertCode(spark(t))" @contextmenu.prevent.stop="openMenu($event, tableMenu(t))">
                <FxIcon :name="t.shortcut ? 'Shortcut' : 'Table'" /><span class="fx-node__label">{{ t.schema }}.{{ t.name }}</span>
                <button type="button" class="fx-iconbtn nb-more" :aria-label="'More options for ' + t.name" @click.stop="openMenu($event, tableMenu(t))"><FxIcon name="more" :size="14" /></button>
              </div>
              <div v-if="!lhTables.length" class="fx-muted nb-hint nb-l2">No tables</div>
            </template>
            <button type="button" class="fx-node nb-l1" @click="openFiles = !openFiles">
              <span class="fx-node__caret"><FxIcon :name="openFiles ? 'chevronDown' : 'chevronRight'" :size="12" /></span>
              <FxIcon name="Folder" /><span class="fx-node__label">Files</span></button>
            <template v-if="openFiles">
              <div v-for="f in lhFileFolders" :key="f" class="fx-node nb-row nb-l2" @contextmenu.prevent.stop="openMenu($event, fileMenu(f))">
                <FxIcon name="Folder" /><span class="fx-node__label">{{ f.replace(/^Files\//, '') }}</span>
                <button type="button" class="fx-iconbtn nb-more" :aria-label="'More options for ' + f" @click.stop="openMenu($event, fileMenu(f))"><FxIcon name="more" :size="14" /></button>
              </div>
              <div v-if="!lhFileFolders.length" class="fx-muted nb-hint nb-l2">No files</div>
            </template>
          </template>
          <p v-else class="fx-muted nb-hint">No lakehouse attached. Add one so spark.read.table() and %%sql resolve table names.</p>
          <div class="nb-attach">
            <select v-model="attachTo" class="fx-select" aria-label="Lakehouse">
              <option value="">{{ item?.lakehouse ? 'Change lakehouse…' : 'Add data items…' }}</option>
              <option v-for="l in lakehouses" :key="l.workspace + l.name" :value="l.name" :disabled="l.name === item?.lakehouse">{{ l.name }}</option>
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
          <template v-for="(cell, index) in cells" :key="cell.key">
            <div class="nb-between" :class="{ 'is-first': index === 0 }">
              <button type="button" class="nb-between__btn" :aria-label="'Add code cell above cell ' + (index + 1)" @click="addCell('code', index)">+ Code</button>
              <button type="button" class="nb-between__btn" :aria-label="'Add markdown cell above cell ' + (index + 1)" @click="addCell('markdown', index)">+ Markdown</button>
            </div>
            <div class="nb-cell" :class="{ 'is-md': cell.type === 'markdown', 'is-focus': focus === index }"
                 @click="focus = index" @contextmenu.prevent.stop="focus = index; openMenu($event, cellMenu(index))">
              <div class="nb-gutter">
                <button v-if="cell.type !== 'markdown'" type="button" class="nb-runbtn" :title="'Run cell (Shift+Enter)'"
                        :aria-label="'Run cell ' + (index + 1)" :disabled="cell.running" @click.stop="runCell(index)">
                  <FxIcon :name="cell.running ? 'running' : 'play'" :size="14" />
                </button>
                <span class="nb-count">[{{ cell.running ? '*' : cell.count || ' ' }}]</span>
              </div>
              <div class="nb-body">
                <div class="nb-tools">
                  <span class="nb-kind">{{ cell.type === 'markdown' ? 'Markdown' : cell.type === 'parameters' ? 'Parameters' : 'PySpark (Python)' }}</span>
                  <span v-if="cell.type === 'parameters'" class="fx-pill fx-pill--info nb-param">Parameters</span>
                  <span class="fx-cmdbar__grow" />
                  <button type="button" class="fx-iconbtn" title="Move cell up" aria-label="Move cell up" :disabled="index === 0" @click.stop="move(index, -1)"><FxIcon name="arrowUp" :size="14" /></button>
                  <button type="button" class="fx-iconbtn" title="Move cell down" aria-label="Move cell down" :disabled="index === cells.length - 1" @click.stop="move(index, 1)"><FxIcon name="arrowDown" :size="14" /></button>
                  <button type="button" class="fx-iconbtn" title="Delete cell" aria-label="Delete cell" @click.stop="askDelete(index)"><FxIcon name="delete" :size="14" /></button>
                  <button type="button" class="fx-iconbtn" title="More commands" :aria-label="'More commands for cell ' + (index + 1)"
                          @click.stop="focus = index; openMenu($event, cellMenu(index))"><FxIcon name="more" :size="14" /></button>
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
                          @keydown.shift.enter.prevent="runCell(index, true)" @keydown.ctrl.enter.prevent="runCell(index)" />
                <div v-if="(cell.output || cell.grids.length) && !collapseOutputs" class="nb-out" :class="{ 'is-error': cell.error }">
                  <div class="nb-meta fx-muted">
                    <FxIcon :name="cell.error ? 'error' : 'success'" :size="12" />
                    {{ cell.error ? 'Failed' : 'Succeeded' }}<template v-if="cell.duration"> · Command executed in {{ cell.duration }}</template>
                    <span class="fx-cmdbar__grow" />
                    <button type="button" class="fx-iconbtn" title="Clear output" aria-label="Clear output" @click.stop="clearOutput(index)"><FxIcon name="eraser" :size="12" /></button>
                  </div>
                  <pre v-if="cell.output" class="nb-text">{{ cell.output }}</pre>
                  <div v-for="(g, gi) in cell.grids" :key="gi" class="nb-grid"><FxGrid :grid="g" /></div>
                </div>
                <div v-else-if="(cell.output || cell.grids.length) && collapseOutputs" class="nb-out nb-collapsed fx-muted">Output collapsed</div>
              </div>
            </div>
          </template>
          <div v-if="cells.length" class="nb-add nb-addend">
            <button type="button" class="fx-btn fx-btn--sm" @click="addCell('code', cells.length)">+ Code</button>
            <button type="button" class="fx-btn fx-btn--sm" @click="addCell('markdown', cells.length)">+ Markdown</button>
          </div>
        </div>
      </section>
    </div>

    <FxMenu v-if="menu" :at="menu.at" :items="menu.items" @close="menu = null" />

    <FxModal v-if="deleting >= 0" title="Delete cell?" @close="deleting = -1">
      <p class="nb-p">Cell {{ deleting + 1 }} and its output will be removed from {{ itemName }}.</p>
      <template #footer>
        <button type="button" class="fx-btn fx-btn--danger" @click="removeCell(deleting)">Delete</button>
        <button type="button" class="fx-btn" @click="deleting = -1">Cancel</button>
      </template>
    </FxModal>
    <FxModal v-if="confirmDetach" title="Remove lakehouse?" @close="confirmDetach = false">
      <p class="nb-p">{{ item?.lakehouse }} will no longer be this notebook's default lakehouse. Code that uses relative table names will stop resolving until another lakehouse is added.</p>
      <template #footer>
        <button type="button" class="fx-btn fx-btn--primary" @click="detach">Remove</button>
        <button type="button" class="fx-btn" @click="confirmDetach = false">Cancel</button>
      </template>
    </FxModal>
    <ItemSettingsPanel v-if="settings && item" :item="item" :tab="settings" @close="settings = ''" />
  </div>
</template>

<script setup lang="ts">
/**
 * The Fabric notebook. Cells are saved with `fab set <nb> -q cells[N]...`
 * (insert, move, delete, convert and toggle parameters are verbs on the same
 * key), and run on the notebook surface, so the CLI drawer shows both the
 * save and the code that ran.
 */
import { computed, reactive, ref, watch } from 'vue';
import FxIcon from './FxIcon.vue';
import FxGrid from './FxGrid.vue';
import FxMenu from './FxMenu.vue';
import FxModal from './FxModal.vue';
import ItemHeader from './ItemHeader.vue';
import ItemSettingsPanel from './ItemSettingsPanel.vue';
import { cli, errorText, gridsOf, itemPath, messagesOf, rows, useFabric, type Grid } from './fabric';
import { abfsPath, copyText, menuAt, type MenuAt, type MenuEntry } from './menu';

interface Cell { key: number; type: string; source: string; saved: string; output: string; grids: Grid[];
  error: boolean; running: boolean; count: number; duration: string }

const CODE_PLACEHOLDER = '# Write your code here';
const MD_PLACEHOLDER = 'New markdown cell';

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
const lhFileFolders = computed<string[]>(() => {
  const lh = lakehouses.value.find(l => l.name === item.value?.lakehouse);
  const list = ((lh?.file_folders as string[] | undefined) || []);
  return list.filter(f => f.split('/').length <= 3);
});

const ribbon = ref('Home');
const settings = ref('');
const attachTo = ref('');
const focus = ref(-1);
const saving = ref(false);
const running = ref(false);
const sessionOn = ref(false);
const explorerOpen = ref(true);
const collapseOutputs = ref(false);
const openTables = ref(true);
const openFiles = ref(false);
const deleting = ref(-1);
const confirmDetach = ref(false);
const menu = ref<{ at: MenuAt; items: MenuEntry[] } | null>(null);
let keySeq = 0;
let execCount = 0;
const cells = ref<Cell[]>([]);

function sync() {
  const old = cells.value;
  // Match outputs to cells by their source so an insert or a move keeps each
  // cell's output with it rather than with whatever is now at its index.
  const pool = [...old];
  cells.value = stored.value.map((c: any, i: number) => {
    let at = pool.findIndex(p => p.saved === c.source && p.type === c.type);
    if (at < 0 && old[i] && pool.includes(old[i]) && old.length === stored.value.length) at = pool.indexOf(old[i]);
    const prev = at >= 0 ? pool.splice(at, 1)[0] : undefined;
    return reactive<Cell>({ key: prev?.key ?? ++keySeq, type: c.type, source: c.source, saved: c.source,
      output: prev?.output || '', grids: prev?.grids || [], error: prev?.error || false, running: false,
      count: prev?.count || 0, duration: prev?.duration || '' });
  });
}
watch(stored, sync, { immediate: true, deep: true });

function openMenu(event: MouseEvent, items: MenuEntry[]) {
  menu.value = { at: menuAt(event, 260, Math.min(460, items.length * 34 + 12)), items };
}

async function setKey(key: string, value: string, quiet = true) {
  saving.value = true;
  const r = await run(cli(['fab', 'set', path.value, '-q', key, '-i', value]), '', { quiet });
  saving.value = false;
  if (!r.ok) api.notify('error', 'Couldn\'t save the notebook', errorText(r));
  return r.ok;
}
function setCell(index: number, field: string, value: string) {
  return setKey(field === 'source' ? `cells[${index}]` : `cells[${index}].${field}`, value);
}

async function save(index: number) {
  const cell = cells.value[index];
  if (!cell || cell.source === cell.saved) return true;
  const text = cell.source.trim() ? cell.source : (cell.type === 'markdown' ? MD_PLACEHOLDER : CODE_PLACEHOLDER);
  const ok = await setCell(index, 'source', text);
  if (ok) cell.saved = text;
  return ok;
}

function insertAt() { return focus.value >= 0 ? focus.value + 1 : cells.value.length; }

async function addCell(type: string, at: number) {
  at = Math.max(0, Math.min(at, cells.value.length));
  const value = type === 'markdown' ? `%%markdown\n${MD_PLACEHOLDER}` : CODE_PLACEHOLDER;
  if (await setKey(`cells[${at}].insert`, value)) focus.value = at;
}

async function insertCode(code: string) {
  const at = insertAt();
  if (await setKey(`cells[${at}].insert`, code)) focus.value = at;
}

function askDelete(index: number) { if (index >= 0) deleting.value = index; }
async function removeCell(index: number) {
  deleting.value = -1;
  await setCell(index, 'source', 'null');
  focus.value = Math.min(index, cells.value.length - 1);
}

async function setType(index: number, type: string) {
  await save(index);
  await setCell(index, 'type', type);
}

async function move(index: number, delta: number) {
  const target = index + delta;
  if (index < 0 || target < 0 || target >= cells.value.length) return;
  await save(index);
  if (await setKey(`cells[${index}].move`, String(target))) focus.value = target;
}

function clearOutput(index: number) {
  const cell = cells.value[index];
  if (!cell) return;
  cell.output = ''; cell.grids = []; cell.error = false; cell.duration = ''; cell.count = 0;
}
function clearOutputs() { cells.value.forEach((_c, i) => clearOutput(i)); }

async function runCell(index: number, advance = false) {
  const first = cells.value[index];
  if (!first || first.type === 'markdown') { if (advance) focus.value = Math.min(index + 1, cells.value.length - 1); return; }
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
  if (advance) focus.value = Math.min(index + 1, cells.value.length - 1);
}

async function runFrom(start: number, end: number) {
  running.value = true;
  for (let i = start; i < Math.min(end, cells.value.length); i++) {
    if (cells.value[i].type === 'markdown') continue;
    await runCell(i);
    if (cells.value[i].error) break;
  }
  running.value = false;
}
function runAll() { return runFrom(0, cells.value.length); }

function stopSession() {
  sessionOn.value = false;
  execCount = 0;
  api.notify('info', 'Session stopped', 'The Spark session was stopped. Variables are cleared when the next cell starts a new session.');
}

async function runJob() {
  await run(cli(['fab', 'job', 'run', path.value]), `Notebook ${itemName.value} run finished`);
}

async function attach() {
  if (await run(cli(['fab', 'set', path.value], { '-q': 'lakehouse', '-i': attachTo.value }),
    `Default lakehouse set to ${attachTo.value}`).then(r => r.ok)) attachTo.value = '';
}
async function detach() {
  confirmDetach.value = false;
  await run(cli(['fab', 'set', path.value], { '-q': 'lakehouse', '-i': 'none' }), 'Lakehouse removed');
}

function spark(t: Record<string, any>) {
  return `df = spark.sql("SELECT * FROM ${item.value?.lakehouse}.${t.schema}.${t.name} LIMIT 1000")\ndisplay(df)`;
}

function cellMenu(index: number): MenuEntry[] {
  const cell = cells.value[index];
  const md = cell?.type === 'markdown';
  return [
    { label: 'Run cell', icon: 'play', disabled: md, hint: 'Ctrl+Enter', action: () => runCell(index) },
    { label: 'Run cells above', disabled: index === 0, action: () => runFrom(0, index) },
    { label: 'Run cell and below', action: () => runFrom(index, cells.value.length) },
    { sep: true },
    { label: 'Insert code cell above', icon: 'insertAbove', action: () => addCell('code', index) },
    { label: 'Insert code cell below', icon: 'insertBelow', action: () => addCell('code', index + 1) },
    { label: 'Insert markdown cell above', action: () => addCell('markdown', index) },
    { label: 'Insert markdown cell below', action: () => addCell('markdown', index + 1) },
    { sep: true },
    { label: 'Move cell up', icon: 'arrowUp', disabled: index === 0, action: () => move(index, -1) },
    { label: 'Move cell down', icon: 'arrowDown', disabled: index >= cells.value.length - 1, action: () => move(index, 1) },
    { label: md ? 'Convert to code cell' : 'Convert to markdown cell', icon: md ? 'code' : 'text', action: () => setType(index, md ? 'code' : 'markdown') },
    { label: cell?.type === 'parameters' ? 'Remove parameter tag' : 'Toggle parameter cell', disabled: md,
      action: () => setType(index, cell?.type === 'parameters' ? 'code' : 'parameters') },
    { label: 'Clear output', icon: 'eraser', disabled: !cell?.output && !cell?.grids.length, action: () => clearOutput(index) },
    { sep: true },
    { label: 'Delete cell', icon: 'delete', danger: true, action: () => askDelete(index) },
  ];
}
function lakehouseMenu(): MenuEntry[] {
  const lh = String(item.value?.lakehouse || '');
  return [
    { label: 'Open lakehouse', icon: 'open', action: () => go({ page: 'item', ws: wsName.value, item: lh, type: 'Lakehouse' }) },
    { label: 'Copy ABFS path', icon: 'link', action: () => copyText(api, abfsPath(wsName.value, lh, 'Lakehouse', ''), 'ABFS path') },
    { sep: true },
    { label: 'Remove', icon: 'delete', danger: true, action: () => { confirmDetach.value = true; } },
  ];
}
function tableMenu(t: Record<string, any>): MenuEntry[] {
  const lh = String(item.value?.lakehouse || '');
  return [
    { heading: true, label: 'Load data' },
    { label: 'Spark', icon: 'code', action: () => insertCode(spark(t)) },
    { label: 'Spark SQL (%%sql)', icon: 'code', action: () => insertCode(`%%sql\nSELECT * FROM ${lh}.${t.schema}.${t.name} LIMIT 1000`) },
    { sep: true },
    { label: 'Copy ABFS path', icon: 'link', action: () => copyText(api, abfsPath(wsName.value, lh, 'Lakehouse', `Tables/${t.schema}/${t.name}`), 'ABFS path') },
    { label: 'Copy relative path for Spark', icon: 'copy', action: () => copyText(api, `Tables/${t.schema}/${t.name}`, 'Relative path') },
  ];
}
function fileMenu(folder: string): MenuEntry[] {
  return [
    { heading: true, label: 'Load data' },
    { label: 'Spark (JSON)', icon: 'code', action: () => insertCode(`df = spark.read.json("${folder}")\ndisplay(df)`) },
    { label: 'Spark (CSV)', icon: 'code', action: () => insertCode(`df = spark.read.format("csv").option("header", "true").load("${folder}")\ndisplay(df)`) },
    { sep: true },
    { label: 'Copy relative path for Spark', icon: 'copy', action: () => copyText(api, folder, 'Relative path') },
  ];
}
</script>

<style scoped>
.nb-session { display: inline-flex; align-items: center; gap: 6px; margin-left: 8px; font-size: 12px; color: #616161; }
.nb-dot { width: 8px; height: 8px; border-radius: 50%; background: #bdbdbd; }
.nb-session.is-on .nb-dot { background: #107c10; }
.nb-lang { font-size: 12px; color: #616161; padding: 0 6px; margin-left: auto; }
.nb-sec { padding: 4px 8px; font-size: 12px; color: #616161; font-weight: 600; }
.nb-row { position: relative; }
.nb-row .nb-more { visibility: hidden; flex: none; width: 24px; height: 24px; }
.nb-row:hover .nb-more, .nb-row:focus-within .nb-more { visibility: visible; }
.nb-lh { cursor: default; font-weight: 600; }
.nb-default { margin-left: auto; flex: none; }
.nb-l1 { padding-left: 14px; }
.nb-l2 { padding-left: 30px; }
.nb-hint { font-size: 12px; padding: 0 8px; }
.nb-attach { display: flex; gap: 6px; padding: 8px; }
.nb-attach .fx-select { flex: 1; min-width: 0; }
.nb-cells { background: #fafafa; }
.nb-scroll { flex: 1; overflow: auto; padding: 4px 16px 24px; }
.nb-between { display: flex; justify-content: center; gap: 6px; height: 18px; opacity: 0; transition: opacity .1s; margin: 2px 0 2px 54px; }
.nb-between:hover, .nb-between:focus-within { opacity: 1; }
.nb-between__btn { height: 18px; padding: 0 8px; border: 1px solid #d1d1d1; border-radius: 9px; background: #fff; font: 11px "Segoe UI", sans-serif; color: #424242; cursor: pointer; }
.nb-between__btn:hover { border-color: #117865; color: #117865; }
.nb-cell { display: flex; gap: 6px; margin-bottom: 2px; }
.nb-gutter { width: 48px; flex: none; display: flex; flex-direction: column; align-items: center; gap: 2px; padding-top: 30px; }
.nb-runbtn { display: grid; place-items: center; width: 28px; height: 28px; border-radius: 50%; border: 1px solid #d1d1d1; background: #fff; color: #117865; cursor: pointer; }
.nb-runbtn:hover { background: #e6f2ef; }
.nb-count { font: 12px Consolas, monospace; color: #707070; }
.nb-body { flex: 1; min-width: 0; border: 1px solid #e0e0e0; border-radius: 6px; background: #fff; overflow: hidden; }
.nb-cell.is-focus .nb-body { border-color: #117865; box-shadow: 0 0 0 1px #117865; }
.nb-tools { display: flex; align-items: center; gap: 2px; padding: 2px 6px; border-bottom: 1px solid #f0f0f0; background: #fafafa; }
.nb-kind { font-size: 12px; color: #616161; }
.nb-param { margin-left: 6px; }
.nb-code { min-height: 64px; resize: vertical; }
.nb-md { padding: 8px 14px; }
.nb-md h1 { font: 600 22px/28px "Segoe UI", sans-serif; margin: 4px 0; }
.nb-md h2 { font: 600 18px/24px "Segoe UI", sans-serif; margin: 4px 0; }
.nb-md h3 { font: 600 15px/20px "Segoe UI", sans-serif; margin: 4px 0; }
.nb-md p, .nb-md li { margin: 2px 0; }
.nb-out { border-top: 1px solid #f0f0f0; padding: 6px 10px; max-height: 360px; overflow: auto; }
.nb-out.is-error .nb-text { color: #c50f1f; }
.nb-collapsed { font-size: 12px; font-style: italic; }
.nb-meta { display: flex; align-items: center; gap: 4px; font-size: 12px; margin-bottom: 4px; }
.nb-text { margin: 0 0 6px; font: 12px/17px Consolas, monospace; white-space: pre-wrap; }
.nb-grid { max-height: 260px; display: flex; flex-direction: column; border: 1px solid #e0e0e0; border-radius: 4px; margin-bottom: 6px; }
.nb-add { display: flex; gap: 8px; justify-content: center; }
.nb-addend { margin-top: 10px; }
.nb-p { margin: 0 0 12px; }
</style>
