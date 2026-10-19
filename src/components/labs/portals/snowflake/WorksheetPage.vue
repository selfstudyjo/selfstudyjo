<template>
  <div class="ws" v-if="sheet">
    <!-- Worksheet tabs -->
    <div class="ws__tabs" role="tablist">
      <button type="button" class="ws__home" title="All worksheets" @click="sf.go({ page: 'worksheets' })"><SfIcon name="chevron-left" /></button>
      <div class="ws__tablist">
        <div v-for="tab in openTabs" :key="tab.id" class="ws__tab" :class="{ 'is-active': tab.id === sheet.id }" role="tab" :aria-selected="tab.id === sheet.id">
          <button type="button" class="ws__tabbtn" @click="sf.go({ page: 'worksheet', id: tab.id })">
            <SfIcon name="worksheet" /><span>{{ tab.name }}</span>
          </button>
          <button type="button" class="ws__tabx" aria-label="Close tab" @click="closeTab(tab.id)"><SfIcon name="close" /></button>
        </div>
      </div>
      <button type="button" class="ws__newtab" title="New worksheet" aria-label="New worksheet" @click="sf.openWorksheet('')"><SfIcon name="plus" /></button>
    </div>

    <!-- Worksheet header: name, role/warehouse, run -->
    <div class="ws__head">
      <input v-if="renaming" ref="nameInput" v-model="nameDraft" class="sf-input ws__nameinput" @keydown.enter="saveName" @blur="saveName" />
      <button v-else type="button" class="ws__name" title="Rename" @click="startRename">{{ sheet.name }}</button>
      <span class="sf-spacer"></span>
      <div class="sf-rel">
        <button type="button" class="ws__ctxbtn" :aria-expanded="rwOpen" @click="rwOpen = !rwOpen">
          <SfIcon name="role" /><span>{{ cur.role || 'No role' }}</span>
          <span class="ws__ctxsep">·</span>
          <SfIcon name="warehouse" /><span>{{ cur.warehouse || 'No warehouse' }}</span>
          <span v-if="whState" class="sf-dot" :class="whState === 'STARTED' ? 'sf-dot--ok' : ''" :title="whState"></span>
          <SfIcon name="chevron-down" />
        </button>
        <div v-if="rwOpen" class="sf-menu ws__rwmenu" @mouseleave="rwOpen = false">
          <div class="ws__rwcols">
            <div>
              <div class="sf-menu__label">Role</div>
              <button v-for="r in roles" :key="r" type="button" :class="{ 'is-on': r === cur.role }" @click="setRole(r)">
                <SfIcon name="check" :class="r === cur.role ? '' : 'ws__hide'" /> {{ r }}
              </button>
            </div>
            <div>
              <div class="sf-menu__label">Warehouse</div>
              <button v-for="w in warehouses" :key="w.name" type="button" @click="setWarehouse(w.name)">
                <SfIcon name="check" :class="w.name === cur.warehouse ? '' : 'ws__hide'" />
                <span>{{ w.name }}</span><span class="sf-muted sf-small">{{ sizeLabel(w.size) }}</span>
              </button>
            </div>
          </div>
        </div>
      </div>
      <button type="button" class="sf-btn" @click="share"><SfIcon name="share" /> Share</button>
      <div class="ws__run sf-rel">
        <button type="button" class="sf-btn sf-btn--primary ws__runbtn" :disabled="running" title="Run (Ctrl+Enter)" @click="runCurrent()">
          <SfIcon name="play" /> Run
        </button>
        <button type="button" class="sf-btn sf-btn--primary ws__runmore" aria-label="More run options" :aria-expanded="runMenu" @click="runMenu = !runMenu">
          <SfIcon name="chevron-down" />
        </button>
        <div v-if="runMenu" class="sf-menu ws__runmenu" @mouseleave="runMenu = false">
          <button type="button" @click="runMenu = false; runCurrent()">Run <span class="ws__kbd">Ctrl+Enter</span></button>
          <button type="button" @click="runMenu = false; runAll()">Run All <span class="ws__kbd">Ctrl+Shift+Enter</span></button>
        </div>
      </div>
    </div>

    <div class="ws__split">
      <!-- Object explorer -->
      <aside v-if="showExplorer" class="ws__explorer">
        <div class="ws__extabs">
          <button type="button" class="ws__extab" :class="{ 'is-active': exTab === 'db' }" @click="exTab = 'db'">Databases</button>
          <button type="button" class="ws__extab" :class="{ 'is-active': exTab === 'ws' }" @click="exTab = 'ws'">Worksheets</button>
        </div>
        <div class="sf-search ws__exsearch">
          <SfIcon name="search" />
          <input v-model="exFilter" class="sf-input" placeholder="Search objects" />
        </div>
        <div v-if="exTab === 'db'" class="ws__tree">
          <template v-for="db in databases" :key="db.name">
            <button type="button" class="ws__node" @click="toggle(db.name)">
              <SfIcon :name="expanded[db.name] ? 'chevron-down' : 'chevron-right'" class="ws__chev" /><SfIcon name="database" /><span>{{ db.name }}</span>
            </button>
            <template v-if="expanded[db.name]">
              <template v-for="sc in schemasOf(db.name)" :key="db.name + '.' + sc.name">
                <button type="button" class="ws__node ws__node--2" @click="toggle(db.name + '.' + sc.name)">
                  <SfIcon :name="expanded[db.name + '.' + sc.name] ? 'chevron-down' : 'chevron-right'" class="ws__chev" /><SfIcon name="schema" /><span>{{ sc.name }}</span>
                </button>
                <template v-if="expanded[db.name + '.' + sc.name]">
                  <button v-for="t in tablesOf(db.name, sc.name)" :key="t.fqn" type="button" class="ws__node ws__node--3"
                          :title="'Insert ' + t.fqn" @click="insertText(t.fqn)">
                    <SfIcon :name="String(t.kind).toUpperCase() === 'VIEW' ? 'view' : 'table'" /><span>{{ t.name }}</span>
                  </button>
                  <span v-if="!tablesOf(db.name, sc.name).length" class="ws__none">No tables</span>
                </template>
              </template>
            </template>
          </template>
        </div>
        <div v-else class="ws__tree">
          <button v-for="w in filteredSheets" :key="w.id" type="button" class="ws__node" :class="{ 'is-active': w.id === sheet.id }"
                  @click="sf.go({ page: 'worksheet', id: w.id })">
            <SfIcon name="worksheet" /><span>{{ w.name }}</span>
          </button>
        </div>
      </aside>

      <section class="ws__work">
        <div class="ws__ctxbar">
          <button type="button" class="sf-btn sf-btn--ghost sf-btn--icon sf-btn--sm" :title="showExplorer ? 'Hide object explorer' : 'Show object explorer'" @click="showExplorer = !showExplorer">
            <SfIcon name="panel-left" />
          </button>
          <div class="sf-rel">
            <button type="button" class="ws__dbpick" :aria-expanded="dbOpen" @click="dbOpen = !dbOpen">
              <SfIcon name="database" />
              <span>{{ cur.database || 'No database selected' }}<template v-if="cur.database && cur.schema">.{{ cur.schema }}</template></span>
              <SfIcon name="chevron-down" />
            </button>
            <div v-if="dbOpen" class="sf-menu ws__dbmenu" @mouseleave="dbOpen = false">
              <template v-for="db in databases" :key="db.name">
                <button type="button" class="ws__dbitem" @click="setDatabase(db.name)"><SfIcon name="database" /> {{ db.name }}</button>
                <button v-for="sc in schemasOf(db.name)" :key="sc.name" type="button" class="ws__scitem" @click="setSchema(db.name, sc.name)">
                  <SfIcon name="schema" /> {{ sc.name }}
                </button>
              </template>
            </div>
          </div>
          <span class="sf-spacer"></span>
          <span class="ws__saved sf-muted sf-small">{{ running ? 'Running…' : 'Saved' }}</span>
        </div>

        <div class="ws__editor">
          <div class="ws__gutter" aria-hidden="true" :style="{ transform: `translateY(${-scrollTop}px)` }">
            <span v-for="n in lineCount" :key="n" :class="{ 'is-current': n === caretLine }">{{ n }}</span>
          </div>
          <textarea ref="editor" v-model="text" class="ws__textarea" spellcheck="false" autocapitalize="off" autocomplete="off"
                    aria-label="SQL editor" @keydown="onKey" @scroll="onScroll" @click="trackCaret" @keyup="trackCaret"></textarea>
        </div>

        <ResultPane :result="sheet.lastResult" :running="running" @open-query="openQuery" />
      </section>
    </div>
  </div>
  <div v-else class="sf-page">
    <div class="sf-empty"><SfIcon name="worksheet" /><strong>This worksheet was closed.</strong>
      <button type="button" class="sf-btn sf-btn--primary" @click="sf.go({ page: 'worksheets' })">Go to Worksheets</button>
    </div>
  </div>
</template>

<script setup lang="ts">
/**
 * A Snowsight SQL worksheet. Ctrl+Enter runs the statement under the caret (or
 * the selection), Ctrl+Shift+Enter runs every statement, and the role,
 * warehouse and database/schema pickers run the USE statements they stand
 * for - so the session the console sees is the one this worksheet shows.
 */
import { computed, nextTick, reactive, ref, watch } from 'vue';
import SfIcon from './SfIcon.vue';
import ResultPane from './ResultPane.vue';
import { useSf } from './sfContext';
import { matches } from '@/utils/portalKit';
import { ident, inSchema, list, sizeLabel, statementAt } from './snowflake';

const sf = useSf();
const cur = sf.current;
const sheet = computed(() => {
  const r = sf.route.value;
  return r.page === 'worksheet' ? sf.worksheets.value.find(w => w.id === r.id) || null : null;
});

const text = ref(sheet.value?.sql || '');
watch(text, value => {
  if (sheet.value) { sheet.value.sql = value; sheet.value.modified = Date.now(); }
});

const openTabs = computed(() => sf.worksheets.value.filter(w => !closedTabs.has(w.id) || w.id === sheet.value?.id).slice(0, 8));
const closedTabs = reactive(new Set<number>());
function closeTab(id: number) {
  closedTabs.add(id);
  if (id === sheet.value?.id) {
    const next = sf.worksheets.value.find(w => !closedTabs.has(w.id));
    sf.go(next ? { page: 'worksheet', id: next.id } : { page: 'worksheets' });
  }
}

const renaming = ref(false);
const nameDraft = ref('');
const nameInput = ref<HTMLInputElement | null>(null);
function startRename() {
  nameDraft.value = sheet.value?.name || '';
  renaming.value = true;
  void nextTick(() => nameInput.value?.select());
}
function saveName() {
  if (sheet.value && nameDraft.value.trim()) sheet.value.name = nameDraft.value.trim();
  renaming.value = false;
}

const view = sf.view;
const databases = computed(() => list.databases(view.value).filter(d => !d.dropped && (!exFilter.value || matchesTree(d.name))));
function schemasOf(db: string) {
  return list.schemas(view.value).filter(s => s.database.toUpperCase() === db.toUpperCase() && !s.dropped);
}
function tablesOf(db: string, schema: string) {
  return inSchema(list.tables(view.value), db, schema).filter(t => !t.dropped && (!exFilter.value || matches(t, exFilter.value, ['name'])));
}
function matchesTree(dbName: string): boolean {
  const needle = exFilter.value.toLowerCase();
  if (dbName.toLowerCase().includes(needle)) return true;
  return list.tables(view.value).some(t => String(t.database).toUpperCase() === dbName.toUpperCase() && t.name.toLowerCase().includes(needle));
}
const warehouses = computed(() => list.warehouses(view.value));
const roles = computed(() => list.roles(view.value).map(r => r.name));
const whState = computed(() => warehouses.value.find(w => w.name === cur.value.warehouse)?.state || '');
const filteredSheets = computed(() => sf.worksheets.value.filter(w => matches(w, exFilter.value, ['name'])));

const expanded = reactive<Record<string, boolean>>({});
if (cur.value.database) {
  expanded[cur.value.database] = true;
  if (cur.value.schema) expanded[cur.value.database + '.' + cur.value.schema] = true;
}
function toggle(key: string) { expanded[key] = !expanded[key]; }

const showExplorer = ref(true);
const exTab = ref<'db' | 'ws'>('db');
const exFilter = ref('');
const rwOpen = ref(false);
const dbOpen = ref(false);
const runMenu = ref(false);
const running = ref(false);

async function setRole(role: string) { rwOpen.value = false; if (role !== cur.value.role) await sf.useRole(role); }
async function setWarehouse(name: string) { rwOpen.value = false; if (name !== cur.value.warehouse) await sf.useWarehouse(name); }
async function setDatabase(db: string) {
  dbOpen.value = false;
  await sf.sql(`USE DATABASE ${ident(db)}`);
}
async function setSchema(db: string, schema: string) {
  dbOpen.value = false;
  await sf.sql(`USE SCHEMA ${ident(db)}.${ident(schema)}`);
}

const editor = ref<HTMLTextAreaElement | null>(null);
const scrollTop = ref(0);
const caretLine = ref(1);
const lineCount = computed(() => Math.max(1, text.value.split('\n').length));
function onScroll() { scrollTop.value = editor.value?.scrollTop || 0; }
function trackCaret() {
  const el = editor.value;
  if (!el) return;
  caretLine.value = text.value.slice(0, el.selectionStart).split('\n').length;
}

function insertText(snippet: string) {
  const el = editor.value;
  if (!el) { text.value += snippet; return; }
  const start = el.selectionStart;
  const end = el.selectionEnd;
  text.value = text.value.slice(0, start) + snippet + text.value.slice(end);
  void nextTick(() => {
    el.focus();
    el.selectionStart = el.selectionEnd = start + snippet.length;
  });
}

function onKey(event: KeyboardEvent) {
  if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) {
    event.preventDefault();
    if (event.shiftKey) void runAll();
    else void runCurrent();
    return;
  }
  if (event.key === 'Tab') {
    event.preventDefault();
    insertText('    ');
  }
}

async function execute(statement: string) {
  const sqlText = statement.trim();
  if (!sqlText || !sheet.value) {
    sf.notify('warning', 'Nothing to run', 'Place the cursor in a statement, or select the SQL to run.');
    return;
  }
  running.value = true;
  try {
    const result = await sf.query(sqlText);
    if (sheet.value) sheet.value.lastResult = result;
  } finally {
    running.value = false;
  }
}

function runCurrent() {
  const el = editor.value;
  if (el && el.selectionEnd > el.selectionStart) return execute(text.value.slice(el.selectionStart, el.selectionEnd));
  return execute(statementAt(text.value, el ? el.selectionStart : text.value.length));
}
function runAll() { return execute(text.value); }

function openQuery(id: string) {
  sf.go({ page: 'query-history', queryId: id, tab: 'profile' });
}
function share() {
  sf.notify('info', 'Share worksheet', 'Sharing a worksheet with other users of the account is not part of this lab.');
}
</script>

<style scoped src="./sf.css"></style>
<style scoped>
.ws { display: flex; flex-direction: column; min-height: 0; flex: 1; }
.ws__tabs { display: flex; align-items: stretch; gap: 0; height: 40px; border-bottom: 1px solid var(--sf-border); background: var(--sf-bg-2); flex: none; min-width: 0; }
.ws__home, .ws__newtab { flex: none; width: 40px; border: 0; background: none; color: var(--sf-text-2); cursor: pointer; display: grid; place-items: center; }
.ws__home:hover, .ws__newtab:hover { background: var(--sf-hover); color: var(--sf-text); }
.ws__tablist { display: flex; min-width: 0; overflow-x: auto; }
.ws__tab { display: flex; align-items: center; max-width: 220px; border-right: 1px solid var(--sf-border); background: var(--sf-bg-2); }
.ws__tab.is-active { background: var(--sf-bg); box-shadow: inset 0 2px 0 var(--sf-primary); }
.ws__tabbtn { display: flex; align-items: center; gap: 6px; min-width: 0; height: 100%; padding: 0 4px 0 12px; border: 0; background: none; font: inherit; font-size: 12px; color: var(--sf-text); cursor: pointer; }
.ws__tabbtn span { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.ws__tabbtn .sf-ico { width: 14px; height: 14px; color: var(--sf-text-2); }
.ws__tabx { border: 0; background: none; width: 24px; height: 24px; margin-right: 6px; border-radius: 4px; color: var(--sf-text-3); cursor: pointer; display: grid; place-items: center; }
.ws__tabx:hover { background: var(--sf-hover); color: var(--sf-text); }
.ws__tabx .sf-ico { width: 12px; height: 12px; }

.ws__head { display: flex; align-items: center; gap: 8px; padding: 8px 14px; border-bottom: 1px solid var(--sf-border); flex: none; flex-wrap: wrap; }
.ws__name { border: 0; background: none; font: inherit; font-size: 15px; font-weight: 600; color: var(--sf-text); cursor: text; padding: 2px 6px; border-radius: 4px; max-width: 360px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.ws__name:hover { background: var(--sf-hover); }
.ws__nameinput { width: 280px; }
.ws__ctxbtn { display: inline-flex; align-items: center; gap: 6px; height: 32px; padding: 0 10px; border: 1px solid var(--sf-border-strong); border-radius: var(--sf-radius); background: var(--sf-bg); font: inherit; font-size: 12px; color: var(--sf-text); cursor: pointer; }
.ws__ctxbtn:hover { background: var(--sf-hover); }
.ws__ctxbtn .sf-ico { width: 14px; height: 14px; color: var(--sf-text-2); }
.ws__ctxsep { color: var(--sf-text-3); }
.ws__rwmenu { right: 0; top: calc(100% + 4px); }
.ws__rwcols { display: grid; grid-template-columns: 1fr 1fr; gap: 4px; min-width: 380px; }
.ws__rwcols button { width: 100%; }
.ws__hide { visibility: hidden; }
.ws__run { display: flex; }
.ws__runbtn { border-top-right-radius: 0; border-bottom-right-radius: 0; }
.ws__runmore { border-top-left-radius: 0; border-bottom-left-radius: 0; width: 28px; padding: 0; border-left: 1px solid rgba(255, 255, 255, 0.35); }
.ws__runmenu { right: 0; top: calc(100% + 4px); }
.ws__kbd { margin-left: auto; padding-left: 16px; color: var(--sf-text-3); font-size: 11px; }

.ws__split { flex: 1; min-height: 0; display: flex; }
.ws__explorer { width: 240px; flex: none; border-right: 1px solid var(--sf-border); display: flex; flex-direction: column; min-height: 0; background: var(--sf-bg); }
.ws__extabs { display: flex; gap: 16px; padding: 8px 12px 0; border-bottom: 1px solid var(--sf-border); }
.ws__extab { border: 0; background: none; padding: 6px 0; font: inherit; font-size: 12px; color: var(--sf-text-2); border-bottom: 2px solid transparent; margin-bottom: -1px; cursor: pointer; }
.ws__extab.is-active { color: var(--sf-text); border-bottom-color: var(--sf-primary); font-weight: 600; }
.ws__exsearch { margin: 8px 10px; }
.ws__exsearch .sf-input { height: 28px; font-size: 12px; }
.ws__tree { flex: 1; overflow: auto; padding: 0 6px 10px; display: flex; flex-direction: column; }
.ws__node { display: flex; align-items: center; gap: 6px; width: 100%; height: 26px; padding: 0 6px; border: 0; border-radius: 4px; background: none; font: inherit; font-size: 12px; color: var(--sf-text); cursor: pointer; text-align: left; white-space: nowrap; }
.ws__node span { overflow: hidden; text-overflow: ellipsis; }
.ws__node:hover { background: var(--sf-hover); }
.ws__node.is-active { background: var(--sf-selected); }
.ws__node .sf-ico { width: 14px; height: 14px; color: var(--sf-text-2); }
.ws__node .ws__chev { width: 12px; height: 12px; color: var(--sf-text-3); }
.ws__node--2 { padding-left: 20px; }
.ws__node--3 { padding-left: 52px; }
.ws__none { padding: 2px 0 4px 52px; font-size: 11px; color: var(--sf-text-3); }

.ws__work { flex: 1; min-width: 0; display: flex; flex-direction: column; min-height: 0; }
.ws__ctxbar { display: flex; align-items: center; gap: 8px; padding: 6px 10px; border-bottom: 1px solid var(--sf-border); flex: none; }
.ws__dbpick { display: inline-flex; align-items: center; gap: 6px; height: 28px; padding: 0 8px; border: 0; border-radius: 6px; background: none; font: inherit; font-size: 12px; font-weight: 500; color: var(--sf-text); cursor: pointer; }
.ws__dbpick:hover { background: var(--sf-hover); }
.ws__dbpick .sf-ico { width: 14px; height: 14px; color: var(--sf-text-2); }
.ws__dbmenu { left: 0; top: calc(100% + 4px); max-height: 320px; overflow-y: auto; min-width: 240px; }
.ws__scitem { padding-left: 30px !important; }
.ws__dbitem { font-weight: 600; }
.ws__editor { position: relative; height: 42%; min-height: 140px; flex: none; display: flex; overflow: hidden; border-bottom: 1px solid var(--sf-border); background: var(--sf-bg); }
.ws__gutter { flex: none; width: 44px; padding: 10px 8px 10px 0; display: flex; flex-direction: column; align-items: flex-end; font-family: var(--sf-mono); font-size: 12.5px; line-height: 20px; color: var(--sf-text-3); background: var(--sf-bg-2); border-right: 1px solid var(--sf-border); user-select: none; }
.ws__gutter span.is-current { color: var(--sf-text); font-weight: 600; }
.ws__textarea {
  flex: 1; min-width: 0; height: 100%; resize: none; border: 0; outline: none; padding: 10px 12px; margin: 0; box-sizing: border-box;
  font-family: var(--sf-mono); font-size: 12.5px; line-height: 20px; color: #1E252F; background: var(--sf-bg); white-space: pre; overflow: auto; tab-size: 4;
}
.ws__saved { white-space: nowrap; }
@container sl-portal (max-width: 900px) {
  .ws__explorer { display: none; }
  .ws__editor { height: 32%; min-height: 120px; }
  .ws__rwcols { grid-template-columns: 1fr; min-width: 220px; }
}
</style>
