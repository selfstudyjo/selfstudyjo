<template>
  <div class="ide">
    <!-- ===== IDE top bar: branch, environment ===== -->
    <div class="ide__top">
      <span class="ide__branch" title="The lab project is not connected to a git remote - commit and sync are not available here.">
        <DbtIcon name="branch" /> main <span class="ide__ro">read-only</span>
      </span>
      <span class="ide__env"><DbtIcon name="env" /> Development · target <code class="dbt-mono">{{ devTarget }}</code></span>
      <span class="dbt-spacer"></span>
      <span class="ide__status" :class="{ 'is-busy': running }">
        <i class="ide__led"></i>{{ running ? 'Running ' + running : (dbt.parsed.value ? 'Ready' : 'Project not parsed') }}
      </span>
    </div>

    <div class="ide__body">
      <!-- ===== File explorer ===== -->
      <section class="ide__explorer" aria-label="File explorer">
        <header class="ide__pane-head">
          <span>File explorer</span>
          <span class="dbt-spacer"></span>
          <button type="button" class="ide__icon-btn" title="Parse project (dbt parse)" aria-label="Parse project"
                  :disabled="!!running" @click="exec(cli(['dbt', 'parse']))">
            <DbtIcon name="refresh" />
          </button>
        </header>
        <div v-if="starting" class="ide__noproject"><p>Starting the IDE - parsing the project…</p></div>
        <div v-else-if="!tree.length" class="ide__noproject">
          <p>There is no dbt project in this workspace yet.</p>
          <label class="dbt-field">
            <span>Project name</span>
            <input v-model="initName" class="dbt-input" placeholder="shopflow" />
          </label>
          <button type="button" class="dbt-btn dbt-btn--primary" :disabled="!validInit || !!running"
                  @click="exec(cli(['dbt', 'init', initName.trim()]))">Initialize dbt project</button>
          <small class="dbt-help">Runs <code class="dbt-mono">dbt init {{ initName.trim() || '<name>' }}</code>.</small>
        </div>
        <ul v-else class="ide__tree" role="tree">
          <FileTreeRow v-for="node in tree" :key="node.path" :node="node" :depth="0" :open-dirs="openDirs"
                       :active="activePath" @toggle="toggleDir" @open="openFile" />
        </ul>
      </section>

      <!-- ===== Editor + lower panel ===== -->
      <section class="ide__work">
        <div class="ide__tabs" role="tablist">
          <button v-for="path in openTabs" :key="path" type="button" class="ide__tab" role="tab"
                  :class="{ 'is-active': path === activePath }" :aria-selected="path === activePath" @click="activePath = path">
            <DbtIcon :name="iconFor(path)" />
            <span class="ide__tab-name">{{ baseName(path) }}</span>
            <span class="ide__tab-x" role="button" aria-label="Close tab" @click.stop="closeTab(path)"><DbtIcon name="close" /></span>
          </button>
        </div>

        <div class="ide__toolbar">
          <span class="ide__path dbt-mono" :title="activePath">{{ activePath || 'No file open' }}</span>
          <span class="dbt-spacer"></span>
          <template v-if="node">
            <button v-if="node.kind !== 'seed'" type="button" class="dbt-btn dbt-btn--sm" :disabled="!!running" @click="compile">
              <DbtIcon name="code" />Compile
            </button>
            <button type="button" class="dbt-btn dbt-btn--sm" :disabled="!!running" @click="preview">
              <DbtIcon name="eye" />Preview
            </button>
            <span class="ide__menu-anchor">
              <span class="ide__split">
                <button type="button" class="dbt-btn dbt-btn--sm dbt-btn--primary ide__split-main" :disabled="!!running"
                        @click="buildAction(actions[0]!)">
                  <DbtIcon name="hammer" />{{ actions[0]!.label }}
                </button>
                <button type="button" class="dbt-btn dbt-btn--sm dbt-btn--primary ide__split-caret" :disabled="!!running"
                        aria-label="More build options" :aria-expanded="menuOpen" @click="menuOpen = !menuOpen">
                  <DbtIcon name="chevron-down" />
                </button>
              </span>
              <div v-if="menuOpen" class="ide__menu" @mouseleave="menuOpen = false">
                <button v-for="action in actions" :key="action.label" type="button" @click="buildAction(action)">
                  <span>{{ action.label }}</span>
                  <code class="dbt-mono">{{ action.command.replace(/^dbt /, '') }}</code>
                </button>
              </div>
            </span>
          </template>
        </div>

        <div class="ide__editor">
          <div v-if="!activeFile" class="dbt-empty">
            <DbtIcon name="file" />
            <h3>Open a file</h3>
            <p>Choose a model, a YAML file or a seed in the file explorer.</p>
          </div>
          <template v-else>
            <div v-if="activeFile.content === null" class="dbt-empty">
              <DbtIcon name="lock" />
              <h3>{{ activeFile.generated ? 'Generated artifact' : 'File too large to display' }}</h3>
              <p v-if="activeFile.generated">Files under <code class="dbt-mono">target/</code> are written by dbt on every invocation and are not shown in the editor.</p>
            </div>
            <div v-else class="ide__code" role="region" :aria-label="activePath">
              <div v-for="(line, i) in codeLines" :key="i" class="ide__line">
                <span class="ide__ln">{{ i + 1 }}</span>
                <span class="ide__lc"><span v-for="(t, j) in line" :key="j" :class="'tk-' + t.kind">{{ t.text }}</span></span>
              </div>
            </div>
            <div class="ide__note">
              <DbtIcon name="info" /><span>Edit this file in the lab's <strong>Files</strong> tool; the IDE reads the saved file. Save, then Compile or Build here.</span>
            </div>
          </template>
        </div>

        <!-- ===== Lower panel: results / compiled / lineage / commands ===== -->
        <div class="ide__lower">
          <div class="dbt-tabs ide__lower-tabs">
            <button type="button" :class="{ 'is-active': lower === 'results' }" @click="lower = 'results'">Results</button>
            <button type="button" :class="{ 'is-active': lower === 'compiled' }" @click="lower = 'compiled'">Compiled code</button>
            <button type="button" :class="{ 'is-active': lower === 'lineage' }" @click="lower = 'lineage'">Lineage</button>
            <button type="button" :class="{ 'is-active': lower === 'commands' }" @click="lower = 'commands'">
              Commands <span class="dbt-badge">{{ dbt.ide.value.length }}</span>
            </button>
          </div>
          <div class="ide__lower-body">
            <!-- Results -->
            <template v-if="lower === 'results'">
              <div v-if="!grid" class="dbt-empty ide__compact-empty">
                <p>Click <strong>Preview</strong> to run <code class="dbt-mono">dbt show --select {{ node ? node.name : '&lt;model&gt;' }} --limit 100</code> and see its rows.</p>
              </div>
              <div v-else class="ide__grid-wrap">
                <div class="ide__grid-meta">
                  <span><strong>{{ grid.rows.length }}</strong> row{{ grid.rows.length === 1 ? '' : 's' }} returned · {{ grid.title }}</span>
                  <span class="dbt-muted dbt-mono">{{ grid.command }}</span>
                </div>
                <div class="dbt-table-wrap ide__grid">
                  <table class="dbt-table">
                    <thead><tr><th class="ide__rn">#</th><th v-for="c in grid.columns" :key="c">{{ c }}</th></tr></thead>
                    <tbody>
                      <tr v-for="(r, i) in grid.rows" :key="i">
                        <td class="ide__rn">{{ i + 1 }}</td>
                        <td v-for="(cell, j) in r" :key="j" :class="{ 'dbt-num': typeof cell === 'number', 'ide__null': cell === null }">
                          {{ cell === null ? 'NULL' : cell }}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
              <div v-if="previewError" class="dbt-error">{{ previewError }}</div>
            </template>

            <!-- Compiled -->
            <template v-else-if="lower === 'compiled'">
              <div v-if="!compiledSql" class="dbt-empty ide__compact-empty">
                <p v-if="node && node.kind === 'model'">Click <strong>Compile</strong> to render the Jinja into the SQL dbt sends to Snowflake.</p>
                <p v-else>Open a model to see its compiled code.</p>
              </div>
              <pre v-else class="dbt-code ide__compiled">{{ compiledSql }}</pre>
            </template>

            <!-- Lineage -->
            <template v-else-if="lower === 'lineage'">
              <LineageGraph v-if="node" :graph="dbt.graph()" :ids="lineageIds" :active-id="node.id" compact
                            empty-text="Parse the project to see lineage." @select="openNode" />
              <div v-else class="dbt-empty ide__compact-empty"><p>Open a model to see its parents and children.</p></div>
            </template>

            <!-- Commands -->
            <template v-else>
              <div v-if="runningLine" class="ide__pending"><i class="ide__spin"></i><span class="dbt-mono">{{ runningLine }}</span><span class="dbt-muted">Running…</span></div>
              <div v-if="!dbt.ide.value.length && !runningLine" class="dbt-empty ide__compact-empty">
                <p>Commands you run from the command bar or the toolbar appear here with their logs and results.</p>
              </div>
              <div v-else-if="dbt.ide.value.length" class="ide__cmds">
                <ul class="ide__cmd-list">
                  <li v-for="inv in dbt.ide.value" :key="inv.id">
                    <button type="button" :class="{ 'is-active': selectedInv && selectedInv.id === inv.id }" @click="selectedId = inv.id">
                      <DbtIcon :name="inv.ok ? 'ok' : 'bad'" :class="inv.ok ? 'ide__ok' : 'ide__bad'" />
                      <span class="dbt-mono">{{ inv.command }}</span>
                    </button>
                  </li>
                </ul>
                <div v-if="selectedInv" class="ide__cmd-detail">
                  <div v-if="invRun" class="ide__summary">
                    <span v-for="(n, key) in invRun.counts" :key="key" class="dbt-badge"
                          :class="{ 'dbt-badge--ok': key === 'PASS' && n, 'dbt-badge--bad': key === 'ERROR' && n, 'dbt-badge--warn': key === 'WARN' && n }">
                      {{ key }} {{ n }}
                    </span>
                    <span class="dbt-muted">{{ invRun.elapsed_s }}s</span>
                  </div>
                  <table v-if="invRun && invRun.results.length" class="dbt-table ide__nodes">
                    <thead><tr><th>Node</th><th>Status</th><th class="dbt-num">Time</th><th class="dbt-num">Rows</th></tr></thead>
                    <tbody>
                      <tr v-for="r in invRun.results" :key="r.unique_id">
                        <td class="dbt-mono">{{ dbt.nameOf(r.unique_id) }}</td>
                        <td><span class="dbt-status" :class="'dbt-status--' + tone(r.status)"><DbtIcon :name="iconOf(r.status)" />{{ r.status }}</span></td>
                        <td class="dbt-num">{{ r.execution_time ?? '—' }}s</td>
                        <td class="dbt-num">{{ r.rows ?? '—' }}</td>
                      </tr>
                    </tbody>
                  </table>
                  <pre class="dbt-log ide__log"><span v-for="(l, i) in invLines" :key="i" :class="'is-' + logTone(l)">{{ l }}
</span></pre>
                </div>
              </div>
            </template>
          </div>
        </div>
      </section>
    </div>

    <!-- ===== Command bar ===== -->
    <form class="ide__cmdbar" @submit.prevent="submit">
      <DbtIcon name="terminal" class="ide__cmdbar-icon" />
      <input ref="cmdInput" v-model="command" class="ide__cmdbar-input dbt-mono" spellcheck="false" autocomplete="off"
             aria-label="dbt command" placeholder="dbt build --select +my_model" :disabled="!!running"
             @keydown.enter.prevent="submit" @keydown.up.prevent="historyStep(1)" @keydown.down.prevent="historyStep(-1)" />
      <button type="submit" class="dbt-btn dbt-btn--sm dbt-btn--primary" :disabled="!!running || !command.trim()">
        <DbtIcon name="play" />Run
      </button>
    </form>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';
import { cli } from '@/utils/portalKit';
import DbtIcon from './DbtIcon.vue';
import FileTreeRow from './FileTreeRow.vue';
import LineageGraph from './LineageGraph.vue';
import { useDbt } from './dbtContext';
import { fileTree, langOf, logTone, selectNodes, statusTone, tokenize, type GNode } from './dbt';

const dbt = useDbt();

const running = ref('');
const runningLine = ref('');
const command = ref('');
const initName = ref('shopflow');
const validInit = computed(() => /^[A-Za-z_][A-Za-z0-9_]*$/.test(initName.value.trim()));
const lower = ref<'results' | 'compiled' | 'lineage' | 'commands'>('results');
const menuOpen = ref(false);
const selectedId = ref<number | null>(null);
const historyIndex = ref(-1);
const previews = ref<Record<string, { columns: string[]; rows: any[][]; title: string; command: string }>>({});
const previewError = ref('');

const devTarget = computed(() => {
  const env = dbt.envs.value.find(e => e.type === 'development');
  return env?.target_name || dbt.project.value.target || 'dev';
});

const tree = computed(() => fileTree(dbt.files.value));
const openDirs = ref(new Set<string>(['models', 'models/staging', 'models/marts']));
const openTabs = ref<string[]>([]);
const activePath = ref('');

function toggleDir(path: string) {
  const next = new Set(openDirs.value);
  if (next.has(path)) next.delete(path); else next.add(path);
  openDirs.value = next;
}
function openFile(path: string) {
  if (!openTabs.value.includes(path)) openTabs.value = [...openTabs.value, path].slice(-8);
  activePath.value = path;
  const parts = path.split('/');
  const next = new Set(openDirs.value);
  for (let i = 1; i < parts.length; i++) next.add(parts.slice(0, i).join('/'));
  openDirs.value = next;
}
function closeTab(path: string) {
  const idx = openTabs.value.indexOf(path);
  openTabs.value = openTabs.value.filter(p => p !== path);
  if (activePath.value === path) activePath.value = openTabs.value[Math.max(0, idx - 1)] || '';
}

// Open a sensible first file: the first model, else dbt_project.yml.
watch(() => dbt.files.value.length, () => {
  if (activePath.value && dbt.files.value.some(f => f.path === activePath.value)) return;
  const first = dbt.files.value.find(f => /^models\/.*\.sql$/.test(f.path))
    || dbt.files.value.find(f => f.path === 'dbt_project.yml');
  if (first) openFile(first.path);
}, { immediate: true });

const activeFile = computed(() => dbt.files.value.find(f => f.path === activePath.value) || null);
const codeLines = computed(() => {
  const text = activeFile.value?.content ?? '';
  const lang = langOf(activePath.value);
  return text.replace(/\n$/, '').split('\n').map(line => tokenize(line, lang));
});

function baseName(path: string) { return path.split('/').pop() || path; }
function iconFor(path: string) { return /\.sql$/.test(path) ? 'sql' : /\.ya?ml$/.test(path) ? 'yaml' : 'file'; }

/** The dbt node behind the open file (model, seed or snapshot). */
const node = computed<GNode | null>(() => {
  const path = activePath.value;
  if (!path) return null;
  for (const n of dbt.graph().nodes.values()) {
    if (n.path === path && (n.kind === 'model' || n.kind === 'seed' || n.kind === 'snapshot')) return n;
  }
  return null;
});

interface Action { label: string; command: string }
const actions = computed<Action[]>(() => {
  const n = node.value;
  if (!n) return [{ label: 'Build', command: 'dbt build' }];
  if (n.kind === 'seed') {
    return [{ label: 'Seed', command: cli(['dbt', 'seed'], { '--select': n.name }) },
            { label: 'Build seed', command: cli(['dbt', 'build'], { '--select': n.name }) },
            { label: 'Seed (full refresh)', command: cli(['dbt', 'seed'], { '--select': n.name, '--full-refresh': true }) }];
  }
  if (n.kind === 'snapshot') {
    return [{ label: 'Snapshot', command: cli(['dbt', 'snapshot'], { '--select': n.name }) },
            { label: 'Build snapshot', command: cli(['dbt', 'build'], { '--select': n.name }) }];
  }
  const list: Action[] = [
    { label: 'Build model', command: cli(['dbt', 'build'], { '--select': n.name }) },
    { label: 'Build model +children', command: cli(['dbt', 'build'], { '--select': n.name + '+' }) },
    { label: 'Build +model (upstream)', command: cli(['dbt', 'build'], { '--select': '+' + n.name }) },
    { label: 'Build +model+ (up & downstream)', command: cli(['dbt', 'build'], { '--select': '+' + n.name + '+' }) },
    { label: 'Run model', command: cli(['dbt', 'run'], { '--select': n.name }) },
    { label: 'Test model', command: cli(['dbt', 'test'], { '--select': n.name }) },
  ];
  if (n.materialized === 'incremental') {
    list.push({ label: 'Run model (full refresh)', command: cli(['dbt', 'run'], { '--select': n.name, '--full-refresh': true }) });
  }
  return list;
});

async function exec(line: string): Promise<boolean> {
  running.value = line.split(' ').slice(0, 2).join(' ');
  runningLine.value = line;
  try {
    const inv = await dbt.ideRun(line);
    selectedId.value = inv.id;
    const grids = inv.data?.grids;
    if (Array.isArray(grids) && grids.length) {
      const g = grids[grids.length - 1];
      previews.value = { ...previews.value, [node.value?.id || '_']: {
        columns: g.columns || [], rows: g.rows || [], title: g.title || '', command: line } };
    }
    if (!inv.ok) dbt.notify('error', `${line.split(' ').slice(0, 2).join(' ')} failed`, firstError(inv.output));
    return inv.ok;
  } finally {
    running.value = '';
    runningLine.value = '';
  }
}

function firstError(text: string) {
  const lines = String(text || '').split('\n').map(l => l.replace(/^\d\d:\d\d:\d\d\s+/, '').trim()).filter(Boolean);
  const at = lines.findIndex(l => /^Encountered an error/.test(l));
  if (at >= 0 && lines.length > at + 1) return lines.slice(at + 1, at + 3).join(' - ').slice(0, 300);
  const hit = lines.find(l => /error|fail|not found|refused/i.test(l));
  return (hit || lines[lines.length - 1] || '').slice(0, 300);
}

async function buildAction(action: Action) {
  menuOpen.value = false;
  lower.value = 'commands';
  await exec(action.command);
}

async function preview() {
  const n = node.value;
  if (!n) return;
  previewError.value = '';
  lower.value = 'results';
  const line = cli(['dbt', 'show'], { '--select': n.name, '--limit': 100 });
  const ok = await exec(line);
  if (!ok) previewError.value = firstError(dbt.ide.value[0]?.output || '');
}

const lastCompile = ref<Record<string, string>>({});
async function compile() {
  const n = node.value;
  if (!n) return;
  lower.value = 'compiled';
  const ok = await exec(cli(['dbt', 'compile'], { '--select': n.name }));
  const out = dbt.ide.value[0]?.output || '';
  const marker = out.indexOf("' is:");
  if (ok && marker >= 0) lastCompile.value = { ...lastCompile.value, [n.id]: out.slice(out.indexOf('\n', marker) + 1) };
}

const grid = computed(() => previews.value[node.value?.id || '_'] || null);
const compiledSql = computed(() => {
  const n = node.value;
  if (!n) return '';
  return lastCompile.value[n.id] || dbt.models.value.find(m => m.unique_id === n.id)?.compiled_sql || '';
});

const lineageIds = computed(() => {
  const n = node.value;
  if (!n) return new Set<string>();
  return selectNodes(dbt.graph(), `2+${n.name}+2`);
});
function openNode(id: string) {
  const n = dbt.graph().nodes.get(id);
  if (n && n.path && dbt.files.value.some(f => f.path === n.path)) openFile(n.path);
  else if (n) dbt.go({ page: 'resource', id });
}

const selectedInv = computed(() => dbt.ide.value.find(i => i.id === selectedId.value) || dbt.ide.value[0] || null);
const invRun = computed(() => selectedInv.value?.data?.dbt_run || null);
const invLines = computed(() => String(selectedInv.value?.output || '').split('\n'));
function tone(status: string) { return statusTone(status); }
function iconOf(status: string) { const t = statusTone(status); return t === 'ok' ? 'ok' : t === 'bad' ? 'bad' : t === 'warn' ? 'warn' : 'skip'; }

async function submit() {
  const line = command.value.trim();
  if (!line) return;
  if (!/^dbt(\s|$)/.test(line)) {
    dbt.notify('error', 'Invalid command', 'The command bar runs dbt commands only - start with "dbt", e.g. dbt build --select my_model.');
    return;
  }
  historyIndex.value = -1;
  lower.value = 'commands';
  const ok = await exec(line);
  if (ok) command.value = '';
  if (/^dbt\s+show\b/.test(line) && ok) lower.value = 'results';
}
/*
 * Starting the IDE parses the project, as dbt Cloud does when a developer
 * opens it - which is also what builds this lab's starting world on its first
 * command. Skipped once the manifest is there.
 */
const starting = ref(false);
onMounted(async () => {
  if (dbt.parsed.value) return;
  starting.value = true;
  try {
    await exec(cli(['dbt', 'parse']));
  } finally {
    starting.value = false;
  }
});

function historyStep(delta: number) {
  const past = dbt.ide.value.map(i => i.command);
  if (!past.length) return;
  historyIndex.value = Math.max(-1, Math.min(past.length - 1, historyIndex.value + delta));
  command.value = historyIndex.value < 0 ? '' : past[historyIndex.value] ?? '';
}
</script>

<style scoped src="./dbt.css"></style>
<style scoped>
.ide { flex: 1; min-height: 0; display: flex; flex-direction: column; background: #fff; }
.ide__top { flex: none; display: flex; align-items: center; gap: 14px; padding: 6px 14px; border-bottom: 1px solid var(--dbt-border); background: var(--dbt-bg-2); font-size: 12px; flex-wrap: wrap; }
.ide__branch, .ide__env { display: inline-flex; align-items: center; gap: 6px; color: var(--dbt-ink-2); white-space: nowrap; }
.ide__ro { font-size: 10px; text-transform: uppercase; letter-spacing: .04em; color: var(--dbt-muted); border: 1px solid var(--dbt-border); border-radius: 4px; padding: 0 4px; }
.ide__status { display: inline-flex; align-items: center; gap: 6px; color: var(--dbt-muted); white-space: nowrap; }
.ide__led { width: 8px; height: 8px; border-radius: 50%; background: var(--dbt-ok); display: inline-block; }
.ide__status.is-busy .ide__led { background: var(--dbt-orange); animation: ide-pulse 1s infinite alternate; }
@keyframes ide-pulse { from { opacity: 1; } to { opacity: .35; } }

.ide__body { flex: 1; min-height: 0; display: grid; grid-template-columns: 250px minmax(0, 1fr); }
.ide__explorer { border-right: 1px solid var(--dbt-border); display: flex; flex-direction: column; min-height: 0; overflow: hidden; background: var(--dbt-bg-2); }
.ide__pane-head { flex: none; display: flex; align-items: center; gap: 6px; padding: 8px 10px 8px 14px; font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: .05em; color: var(--dbt-muted); border-bottom: 1px solid var(--dbt-border-light); }
.ide__icon-btn { border: 0; background: none; color: var(--dbt-ink-2); width: 26px; height: 26px; border-radius: 5px; cursor: pointer; display: grid; place-items: center; }
.ide__icon-btn:hover:not(:disabled) { background: var(--dbt-hover); }
.ide__tree { list-style: none; margin: 0; padding: 6px 0; overflow: auto; flex: 1; min-height: 0; }
.ide__noproject { padding: 14px; display: flex; flex-direction: column; gap: 10px; font-size: 13px; }
.ide__noproject p { margin: 0; color: var(--dbt-muted); }

.ide__work { min-width: 0; min-height: 0; display: flex; flex-direction: column; overflow: hidden; }
.ide__tabs { flex: none; display: flex; overflow-x: auto; background: var(--dbt-bg-2); border-bottom: 1px solid var(--dbt-border); min-height: 34px; }
.ide__tab { display: inline-flex; align-items: center; gap: 6px; padding: 0 8px 0 12px; height: 34px; border: 0; border-right: 1px solid var(--dbt-border); background: transparent; color: var(--dbt-muted); font: 13px var(--dbt-font); cursor: pointer; white-space: nowrap; }
.ide__tab.is-active { background: #fff; color: var(--dbt-ink); box-shadow: inset 0 2px 0 var(--dbt-orange); }
.ide__tab-x { display: grid; place-items: center; width: 18px; height: 18px; border-radius: 4px; color: var(--dbt-muted); }
.ide__tab-x:hover { background: var(--dbt-hover); color: var(--dbt-ink); }
.ide__toolbar { flex: none; display: flex; align-items: center; gap: 8px; padding: 6px 12px; border-bottom: 1px solid var(--dbt-border-light); flex-wrap: wrap; }
.ide__path { color: var(--dbt-muted); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; min-width: 0; flex: 0 1 auto; }
.ide__menu-anchor { position: relative; }
.ide__split { display: inline-flex; }
.ide__split-main { border-top-right-radius: 0; border-bottom-right-radius: 0; }
.ide__split-caret { border-top-left-radius: 0; border-bottom-left-radius: 0; border-left: 1px solid rgba(255, 255, 255, .35); padding: 0 7px; }
.ide__menu { position: absolute; right: 0; top: calc(100% + 4px); z-index: 20; min-width: 300px; background: #fff; border: 1px solid var(--dbt-border); border-radius: 8px; box-shadow: 0 8px 24px rgba(20, 24, 38, .16); padding: 4px; display: flex; flex-direction: column; }
.ide__menu button { display: flex; flex-direction: column; align-items: flex-start; gap: 2px; border: 0; background: none; padding: 7px 10px; border-radius: 6px; cursor: pointer; text-align: left; font: 13px var(--dbt-font); color: var(--dbt-ink); }
.ide__menu button:hover { background: var(--dbt-hover); }
.ide__menu code { color: var(--dbt-muted); font-size: 11px; }

.ide__editor { flex: 1 1 48%; min-height: 120px; display: flex; flex-direction: column; overflow: hidden; }
.ide__code { flex: 1; overflow: auto; font-family: var(--dbt-mono); font-size: 12.5px; line-height: 20px; padding: 8px 0; color: #262A38; }
.ide__line { display: flex; white-space: pre; }
.ide__ln { flex: none; width: 46px; text-align: right; padding-right: 14px; color: #8A92A6; user-select: none; }
.ide__lc { flex: 1; padding-right: 16px; }
.tk-kw { color: #0B5FA8; font-weight: 600; }
.tk-jinja { color: #A33B22; background: #FFF1EC; }
.tk-str { color: #1D7A3E; }
.tk-num { color: #8A4B00; }
.tk-com { color: #6B7285; font-style: italic; }
.tk-fn { color: #6E3FB5; }
.tk-key { color: #0B5675; font-weight: 600; }
.ide__note { flex: none; display: flex; align-items: center; gap: 6px; padding: 5px 12px; font-size: 12px; color: var(--dbt-muted); background: var(--dbt-bg-2); border-top: 1px solid var(--dbt-border-light); }

.ide__lower { flex: 1 1 52%; min-height: 150px; display: flex; flex-direction: column; border-top: 1px solid var(--dbt-border); }
.ide__lower-tabs { padding: 0 8px; background: var(--dbt-bg-2); }
.ide__lower-body { flex: 1; min-height: 0; overflow: auto; padding: 10px 12px; display: flex; flex-direction: column; gap: 8px; }
.ide__compact-empty { padding: 18px 12px; }
.ide__grid-wrap { display: flex; flex-direction: column; gap: 6px; min-height: 0; flex: 1; }
.ide__grid-meta { display: flex; gap: 12px; flex-wrap: wrap; font-size: 12px; color: var(--dbt-ink-2); }
.ide__grid { flex: 1; min-height: 0; }
.ide__grid .dbt-table td, .ide__grid .dbt-table th { padding: 5px 10px; font-family: var(--dbt-mono); font-size: 12px; white-space: nowrap; }
.ide__rn { color: var(--dbt-muted); width: 1%; text-align: right; }
.ide__null { color: var(--dbt-muted); font-style: italic; }
.ide__compiled { max-height: none; flex: 1; }
.ide__cmds { display: grid; grid-template-columns: minmax(180px, 32%) minmax(0, 1fr); gap: 10px; min-height: 0; flex: 1; }
.ide__cmd-list { list-style: none; margin: 0; padding: 0; overflow: auto; border: 1px solid var(--dbt-border); border-radius: 6px; }
.ide__cmd-list button { width: 100%; display: flex; align-items: center; gap: 8px; border: 0; border-bottom: 1px solid var(--dbt-border-light); background: #fff; padding: 7px 10px; cursor: pointer; text-align: left; color: var(--dbt-ink); }
.ide__cmd-list button span { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.ide__cmd-list button:hover { background: var(--dbt-row-hover); }
.ide__cmd-list button.is-active { background: var(--dbt-blue-bg); }
.ide__ok { color: var(--dbt-ok); }
.ide__bad { color: var(--dbt-bad); }
.ide__cmd-detail { min-width: 0; display: flex; flex-direction: column; gap: 8px; overflow: auto; }
.ide__summary { display: flex; gap: 6px; flex-wrap: wrap; align-items: center; }
.ide__nodes td, .ide__nodes th { padding: 5px 10px; }
.ide__log { max-height: 260px; flex: none; }

.ide__pending { display: flex; align-items: center; gap: 10px; padding: 8px 10px; border: 1px solid var(--dbt-border); border-radius: 6px; background: var(--dbt-bg-2); }
.ide__spin { width: 14px; height: 14px; border-radius: 50%; border: 2px solid var(--dbt-border-strong); border-top-color: var(--dbt-orange); animation: ide-spin .8s linear infinite; flex: none; }
@keyframes ide-spin { to { transform: rotate(360deg); } }
.ide__cmdbar { flex: none; display: flex; align-items: center; gap: 8px; padding: 8px 12px; border-top: 1px solid var(--dbt-border); background: var(--dbt-bg-2); }
.ide__cmdbar-icon { color: var(--dbt-muted); }
.ide__cmdbar-input { flex: 1; min-width: 0; height: 32px; border: 1px solid var(--dbt-border-strong); border-radius: 6px; padding: 0 10px; background: #fff; color: var(--dbt-ink); font-size: 13px; }
.ide__cmdbar-input:focus { outline: none; border-color: var(--dbt-focus); box-shadow: 0 0 0 3px var(--dbt-focus-ring); }

@container sl-portal (max-width: 900px) {
  .ide__body { grid-template-columns: 190px minmax(0, 1fr); }
  .ide__cmds { grid-template-columns: 1fr; }
}
@container sl-portal (max-width: 640px) {
  .ide__body { grid-template-columns: 1fr; grid-template-rows: minmax(110px, 26%) minmax(0, 1fr); }
  .ide__explorer { border-right: 0; border-bottom: 1px solid var(--dbt-border); }
  .ide__env { display: none; }
  .ide__menu { min-width: 240px; }
  .ide__lower-tabs { padding: 0; }
  .ide__lower-tabs button { padding: 9px 7px; font-size: 12px; }
}
</style>
