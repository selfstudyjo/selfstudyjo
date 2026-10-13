<template>
  <div class="sl-cap" :class="{ 'is-running': running }">
    <!-- Main toolbar: the shark fin, the red square, the green fin with an arrow. -->
    <div class="sl-cap__bar">
      <label class="sl-cap__iface">
        <span class="sl-cap__label">{{ $t('Interface') }}</span>
        <select v-model="iface" :disabled="running" class="sl-cap__select">
          <option v-for="row in interfaces" :key="row.name" :value="row.name"
                  :title="row.description">{{ row.name }}</option>
        </select>
      </label>
      <button class="sl-cap__btn sl-cap__btn--start" :disabled="running || busy"
              :title="$t('Start capturing packets')" @click="act(`wireshark start -i ${iface}`)">
        <Play :size="14" /> {{ $t('Start') }}
      </button>
      <button class="sl-cap__btn sl-cap__btn--stop" :disabled="!running || busy"
              :title="$t('Stop capturing packets')" @click="act('wireshark stop')">
        <Square :size="13" /> {{ $t('Stop') }}
      </button>
      <button class="sl-cap__btn" :disabled="busy || !capture"
              :title="$t('Restart the current capture')" @click="act('wireshark restart')">
        <RotateCw :size="13" />
      </button>
      <span class="sl-cap__sep" />
      <button class="sl-cap__btn" :disabled="busy || !capture" @click="stats('hierarchy')">
        <BarChart3 :size="13" /> {{ $t('Protocol Hierarchy') }}
      </button>
      <button class="sl-cap__btn" :disabled="busy || !capture" @click="stats('conversations')">
        <ArrowLeftRight :size="13" /> {{ $t('Conversations') }}
      </button>
      <button class="sl-cap__btn" :disabled="busy || !capture" @click="openExport">
        <Download :size="13" /> {{ $t('Export') }}
      </button>
    </div>

    <!-- The display filter bar: green when it compiles, red when it does not. -->
    <form class="sl-cap__filter" @submit.prevent="applyFilter(filterText)">
      <Filter :size="14" class="sl-cap__filter-icon" />
      <input ref="filterInput" v-model="filterText" class="sl-cap__filter-input" spellcheck="false"
             :class="filterClass" :aria-label="$t('Display filter')"
             :placeholder="$t('Apply a display filter … <Ctrl-/>')" />
      <!-- Never disabled: a disabled default button blocks Enter in the field,
           so a filter typed while another request is in flight would vanish. -->
      <button type="submit" class="sl-cap__btn">{{ $t('Apply') }}</button>
      <button type="button" class="sl-cap__btn" :disabled="busy || !activeFilter"
              @click="applyFilter('')">{{ $t('Clear') }}</button>
    </form>
    <div class="sl-cap__quick">
      <button v-for="q in QUICK" :key="q" class="sl-cap__chip" @click="applyFilter(q)">{{ q }}</button>
    </div>
    <p v-if="filterError" class="sl-cap__error">{{ filterError }}</p>

    <div class="sl-cap__panes">
      <!-- Packet list -->
      <div ref="listBox" class="sl-cap__list" @keydown="onListKey" tabindex="0">
        <table class="sl-cap__table">
          <thead>
            <tr>
              <th class="c-no">No.</th><th class="c-time">Time</th><th>Source</th>
              <th>Destination</th><th>Protocol</th><th class="c-len">Length</th><th>Info</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="row in rows" :key="row.n" :class="rowClass(row)"
                @click="select(row.n)" @contextmenu.prevent="openMenu($event, row)">
              <td class="c-no">{{ row.n }}</td>
              <td class="c-time">{{ row.t }}</td>
              <td>{{ row.src }}</td>
              <td>{{ row.dst }}</td>
              <td>{{ row.proto }}</td>
              <td class="c-len">{{ row.len }}</td>
              <td class="c-info">{{ row.info }}</td>
            </tr>
          </tbody>
        </table>
        <div v-if="!rows.length" class="sl-cap__empty">
          <Activity :size="26" />
          <p v-if="!capture">{{ $t('No capture yet. Choose wlan0 and press Start, then browse a site in the Browser tab.') }}</p>
          <p v-else-if="running">{{ $t('Capturing… open a page in the Browser tab to put packets on the wire.') }}</p>
          <p v-else>{{ $t('No packets match this display filter.') }}</p>
        </div>
      </div>

      <!-- Packet details -->
      <div class="sl-cap__details">
        <div v-if="details" class="sl-cap__details-head">
          <b>{{ $t('Packet {v0}', { v0: details.n }) }}</b>
          <button class="sl-cap__chip" @click="act(`wireshark mark ${details.n}`)">
            {{ marked.includes(details.n) ? $t('Unmark') : $t('Mark') }}
          </button>
          <button v-if="selectedRow?.transport" class="sl-cap__chip"
                  @click="follow(selectedRow)">
            {{ $t('Follow {v0} Stream', { v0: selectedRow.transport.toUpperCase() }) }}
          </button>
        </div>
        <ul v-if="details" class="sl-cap__tree">
          <CaptureNode v-for="(node, i) in details.tree" :key="i" :node="node"
                       :active="highlight" @pick="pickRange" />
        </ul>
        <p v-else class="sl-cap__hint">{{ $t('Select a packet to see its layers.') }}</p>
      </div>

      <!-- Packet bytes -->
      <div class="sl-cap__hex">
        <div v-for="(line, li) in details?.hex || []" :key="li" class="sl-cap__hexrow">
          <span class="sl-cap__off">{{ line.offset }}</span>
          <span class="sl-cap__bytes">
            <span v-for="(b, bi) in line.hex" :key="bi"
                  :class="{ 'is-hit': inRange(li * 16 + Number(bi)) }">{{ b }}</span>
          </span>
          <span class="sl-cap__ascii">
            <span v-for="(ch, ci) in line.ascii" :key="ci"
                  :class="{ 'is-hit': inRange(li * 16 + Number(ci)) }">{{ ch }}</span>
          </span>
        </div>
      </div>
    </div>

    <div class="sl-cap__status">
      <span :class="running ? 'is-live' : ''">●</span>
      <span>{{ capture ? `${capture.iface}` : $t('Ready') }}</span>
      <span>{{ $t('Packets: {v0}', { v0: capture?.total || 0 }) }}</span>
      <span>{{ $t('Displayed: {v0}', { v0: capture?.displayed || 0 }) }}</span>
      <span>{{ $t('Marked: {v0}', { v0: marked.length }) }}</span>
      <span v-if="note" class="sl-cap__note">{{ note }}</span>
    </div>

    <!-- Context menu on a packet -->
    <div v-if="menu" class="sl-cap__menu" :style="{ top: `${menu.y}px`, left: `${menu.x}px` }"
         @mouseleave="menu = null">
      <button @click="menuDo(() => act(`wireshark mark ${menu!.row.n}`))">{{ $t('Mark/Unmark Packet') }}</button>
      <button v-if="menu.row.transport" @click="menuDo(() => follow(menu!.row))">
        {{ $t('Follow {v0} Stream', { v0: menu.row.transport.toUpperCase() }) }}</button>
      <button @click="menuDo(() => applyFilter(menu!.row.proto.toLowerCase()))">
        {{ $t('Apply as Filter: {v0}', { v0: menu.row.proto.toLowerCase() }) }}</button>
      <button @click="menuDo(() => applyFilter(`frame.number == ${menu!.row.n}`))">
        {{ $t('Apply as Filter: this packet') }}</button>
    </div>

    <!-- Follow stream / statistics / export dialog -->
    <div v-if="dialog" class="sl-cap__overlay" @keydown.esc="dialog = null">
      <div class="sl-cap__dialog" role="dialog" :aria-label="dialog.title">
        <div class="sl-cap__dialog-head">
          <b>{{ dialog.title }}</b>
          <button class="sl-cap__x" :aria-label="$t('Close')" @click="dialog = null">×</button>
        </div>
        <template v-if="dialog.kind === 'export'">
          <label class="sl-cap__field">{{ $t('File name') }}
            <input v-model="exportPath" class="sl-cap__filter-input" spellcheck="false" />
          </label>
          <div class="sl-cap__scope">
            <label><input v-model="exportScope" type="radio" value="marked" />
              {{ $t('Marked packets only') }}</label>
            <label><input v-model="exportScope" type="radio" value="displayed" />
              {{ $t('All displayed packets') }}</label>
            <label><input v-model="exportScope" type="radio" value="selected" />
              {{ $t('Selected packet only') }}</label>
            <label><input v-model="exportCsv" type="checkbox" /> CSV</label>
          </div>
          <button class="sl-cap__btn sl-cap__btn--start" :disabled="busy || !exportPath"
                  @click="doExport">{{ $t('Save') }}</button>
          <pre v-if="dialog.text" class="sl-cap__pre">{{ dialog.text }}</pre>
        </template>
        <pre v-else class="sl-cap__pre">{{ dialog.text }}</pre>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
/**
 * The WIRESHARK pane of the CS471 network lab.
 *
 * Laid out the way Wireshark is - toolbar, display-filter bar, packet list,
 * packet details, packet bytes, status bar - because the lab sheet's
 * screenshots are of Wireshark and a student should be able to follow them
 * here and then on their own machine without relearning anything.
 *
 * Every action is a COMMAND sent to app 11 (`wireshark select 7`,
 * `wireshark filter tcp.flags.syn == 1`, ...), the same command the Terminal
 * accepts. That is deliberate: there is one implementation of what selecting,
 * marking, following and exporting mean, and the grader reads the record those
 * commands leave. A pane that kept its own selection would be a second truth.
 *
 * Three things worth keeping:
 *
 * - **Packet colours are Wireshark's defaults and are the same in every
 *   galaxy**, like the lab terminal: a coloring rule is information (green is
 *   HTTP, dark grey is SYN/FIN, red is RST), and recolouring it per theme
 *   would make the lab disagree with the real tool and with the lab sheet.
 * - **A running capture is POLLED**, once a second, because packets arrive on
 *   the simulated network's own clock (the FIN of a keep-alive connection
 *   really is five seconds after the response), and the list has to grow
 *   while the student watches.
 * - **Nothing reaches `v-html`.** A packet's Info column and its bytes come
 *   from pages anybody can serve; every string here is a text node.
 */
import { computed, defineComponent, h, onBeforeUnmount, ref, watch } from 'vue';
import type { PropType } from 'vue';
import {
  Activity, ArrowLeftRight, BarChart3, ChevronDown, ChevronRight, Download,
  Filter, Play, RotateCw, Square,
} from 'lucide-vue-next';
import { useI18n } from '@/i18n/runtime';

interface Row {
  n: number; t: string; src: string; dst: string; proto: string; len: number;
  info: string; color: string; stream: number | null; transport: string;
}
interface TreeNode { label: string; range?: [number, number]; children?: TreeNode[] }

const props = defineProps<{
  toolId: string;
  run: (toolId: string, payload: Record<string, unknown>) => Promise<any>;
}>();

const { t } = useI18n();

const QUICK = ['http', 'tcp', 'udp', 'dns', 'tcp.flags.syn == 1', 'tcp.flags.fin == 1',
  'http.response.code == 404', 'rtp', 'quic'];

const interfaces = ref<Array<{ name: string; description: string }>>([]);
const iface = ref('wlan0');
const capture = ref<any>(null);
const rows = ref<Row[]>([]);
const details = ref<{ n: number; tree: TreeNode[]; hex: any[] } | null>(null);
const marked = ref<number[]>([]);
const selected = ref<number | null>(null);
const activeFilter = ref('');
const filterText = ref('');
const filterError = ref('');
const note = ref('');
const busy = ref(false);
const highlight = ref<[number, number] | null>(null);
const menu = ref<{ x: number; y: number; row: Row } | null>(null);
const dialog = ref<{ kind: string; title: string; text: string } | null>(null);
const exportPath = ref('cs471-labs/lab1/handshake.txt');
const exportScope = ref('marked');
const exportCsv = ref(false);
const listBox = ref<HTMLElement | null>(null);
const filterInput = ref<HTMLInputElement | null>(null);

const running = computed(() => Boolean(capture.value?.running));
const selectedRow = computed(() => rows.value.find(r => r.n === selected.value) || null);
const filterClass = computed(() => {
  if (filterError.value) return 'is-bad';
  if (activeFilter.value && filterText.value.trim() === activeFilter.value) return 'is-ok';
  return '';
});

function absorb(view: any) {
  if (!view) return;
  interfaces.value = Array.isArray(view.interfaces) ? view.interfaces : interfaces.value;
  capture.value = view.capture;
  rows.value = Array.isArray(view.rows) ? view.rows : [];
  details.value = view.details || null;
  marked.value = Array.isArray(view.marked) ? view.marked : [];
  selected.value = view.selected ?? null;
  activeFilter.value = view.filter || '';
  filterError.value = view.filter_error || '';
  // The box shows the filter that is ACTIVE - a filter applied from the
  // Terminal, by Follow Stream, or in an earlier visit would otherwise hide
  // packets behind an empty-looking bar. Not while the student is typing.
  if (document.activeElement !== filterInput.value) filterText.value = activeFilter.value;
  if (view.capture?.iface && !view.capture.running) iface.value = view.capture.iface;
}

async function refresh() {
  const result = await props.run(props.toolId, {});
  if (result?.ok !== false) absorb(result?.capture);
}

async function act(command: string) {
  busy.value = true;
  try {
    const result = await props.run(props.toolId, { command });
    absorb(result?.capture);
    const message = String(result?.error || result?.output || '').trim();
    note.value = message.split('\n')[0].slice(0, 160);
    return result;
  } finally {
    busy.value = false;
  }
}

async function applyFilter(expr: string) {
  filterText.value = expr;
  await act(expr ? `wireshark filter ${expr}` : 'wireshark filter --clear');
}

async function select(n: number) {
  highlight.value = null;
  await act(`wireshark select ${n}`);
}

async function follow(row: Row) {
  const result = await act(`wireshark follow ${row.transport} ${row.stream}`);
  dialog.value = {
    kind: 'follow',
    title: t('Follow {v0} Stream ({v1}.stream eq {v2})',
      { v0: row.transport.toUpperCase(), v1: row.transport, v2: row.stream }),
    text: String(result?.output || result?.error || ''),
  };
}

async function stats(kind: string) {
  const result = await act(`wireshark stats ${kind}`);
  dialog.value = {
    kind: 'stats',
    title: kind === 'hierarchy' ? t('Protocol Hierarchy') : t('Conversations'),
    text: String(result?.output || result?.error || ''),
  };
}

function openExport() {
  dialog.value = { kind: 'export', title: t('Export Specified Packets'), text: '' };
}

async function doExport() {
  const flags = [`--${exportScope.value}`, exportCsv.value ? '--csv' : ''].filter(Boolean);
  const result = await act(`wireshark export ${exportPath.value.trim()} ${flags.join(' ')}`);
  if (dialog.value) dialog.value.text = String(result?.output || result?.error || '');
}

function openMenu(event: MouseEvent, row: Row) {
  const box = (event.currentTarget as HTMLElement).closest('.sl-cap') as HTMLElement;
  const rect = box.getBoundingClientRect();
  menu.value = { x: event.clientX - rect.left, y: event.clientY - rect.top, row };
}

function menuDo(fn: () => unknown) {
  menu.value = null;
  fn();
}

function rowClass(row: Row) {
  return [`c-${row.color || 'none'}`, {
    'is-selected': row.n === selected.value,
    'is-marked': marked.value.includes(row.n),
  }];
}

function onListKey(event: KeyboardEvent) {
  if (!rows.value.length) return;
  const index = rows.value.findIndex(r => r.n === selected.value);
  if (event.key === 'ArrowDown') {
    event.preventDefault();
    select(rows.value[Math.min(rows.value.length - 1, index + 1)].n);
  } else if (event.key === 'ArrowUp') {
    event.preventDefault();
    select(rows.value[Math.max(0, index - 1)].n);
  } else if ((event.key === 'm' || event.key === 'M') && event.ctrlKey && selected.value) {
    event.preventDefault();
    act(`wireshark mark ${selected.value}`);
  }
}

function pickRange(range: [number, number] | undefined) {
  highlight.value = range || null;
}

function inRange(offset: number) {
  const r = highlight.value;
  return Boolean(r && offset >= r[0] && offset < r[1]);
}

/** One node of the details tree, expanded by default only at the top level. */
const CaptureNode: any = defineComponent({
  name: 'CaptureNode',
  props: {
    node: { type: Object as PropType<TreeNode>, required: true },
    active: { type: Array as unknown as PropType<[number, number] | null>, default: null },
    depth: { type: Number, default: 0 },
  },
  emits: ['pick'],
  setup(nodeProps, { emit }) {
    const open = ref(false);
    return () => {
      const node = nodeProps.node;
      const kids = node.children || [];
      const hit = nodeProps.active && node.range &&
        nodeProps.active[0] === node.range[0] && nodeProps.active[1] === node.range[1];
      return h('li', { class: 'sl-cap__node' }, [
        h('div', {
          class: ['sl-cap__node-row', { 'is-hit': hit }],
          onClick: () => { if (kids.length) open.value = !open.value; emit('pick', node.range); },
        }, [
          kids.length
            ? h(open.value ? ChevronDown : ChevronRight, { size: 12 })
            : h('span', { class: 'sl-cap__node-pad' }),
          h('span', node.label),
        ]),
        open.value && kids.length
          ? h('ul', kids.map((child, i) => h(CaptureNode, {
            key: i, node: child, active: nodeProps.active, depth: nodeProps.depth + 1,
            onPick: (range: unknown) => emit('pick', range),
          })))
          : null,
      ]);
    };
  },
});

let timer: number | undefined;
watch(running, (live) => {
  window.clearInterval(timer);
  if (live) timer = window.setInterval(() => { if (!busy.value) refresh(); }, 1000);
}, { immediate: true });
onBeforeUnmount(() => window.clearInterval(timer));

defineExpose({ refresh });
refresh();
</script>

<style scoped>
/*
 * Wireshark's own default colouring rules. Fixed in every galaxy for the
 * reason the lab terminal's palette is: they carry meaning, and the lab sheet
 * and the real tool both use them.
 */
.sl-cap {
  --cap-bg: #ffffff; --cap-ink: #12141a; --cap-line: #c9ced6; --cap-head: #eef1f5;
  --cap-sel: #2f6fd6; --cap-sel-ink: #ffffff;
  position: relative; display: flex; flex-direction: column; height: 100%;
  min-height: min(78vh, 820px); background: var(--cap-bg); color: var(--cap-ink);
  font: 12px/1.45 system-ui, -apple-system, 'Segoe UI', sans-serif;
  direction: ltr;
}
.sl-cap__bar, .sl-cap__filter, .sl-cap__quick {
  display: flex; align-items: center; gap: 6px; padding: 5px 8px;
  border-bottom: 1px solid var(--cap-line); background: var(--cap-head); flex-wrap: wrap;
}
.sl-cap__quick { padding-top: 3px; padding-bottom: 4px; }
.sl-cap__label { margin-inline-end: 4px; color: #4b5563; }
.sl-cap__select { font: inherit; padding: 2px 4px; }
.sl-cap__btn {
  display: inline-flex; align-items: center; gap: 4px; font: inherit;
  border: 1px solid #b8bfca; background: #fff; color: var(--cap-ink);
  padding: 3px 9px; border-radius: 5px; cursor: pointer;
}
.sl-cap__btn:disabled { opacity: 0.45; cursor: default; }
.sl-cap__btn--start { background: #1f7a3a; border-color: #1f7a3a; color: #fff; }
.sl-cap__btn--stop { background: #b42318; border-color: #b42318; color: #fff; }
.sl-cap__sep { width: 1px; height: 18px; background: var(--cap-line); margin: 0 2px; }
.sl-cap__filter-icon { color: #6b7280; }
.sl-cap__filter-input {
  flex: 1; min-width: 120px; font: 12px ui-monospace, Consolas, monospace;
  padding: 4px 8px; border: 1px solid #b8bfca; border-radius: 4px; background: #fff;
  color: var(--cap-ink);
}
.sl-cap__filter-input.is-ok { background: #afffaf; }
.sl-cap__filter-input.is-bad { background: #ffafaf; }
.sl-cap__chip {
  font: 11px ui-monospace, Consolas, monospace; border: 1px solid #c3cad5;
  background: #fff; color: #1f2937; border-radius: 999px; padding: 1px 9px; cursor: pointer;
}
.sl-cap__error {
  margin: 0; padding: 4px 10px; background: #fff1f1; color: #9f1212;
  border-bottom: 1px solid #f3c2c2; font: 11.5px ui-monospace, Consolas, monospace;
}
.sl-cap__panes {
  flex: 1 1 auto; min-height: 0; display: grid;
  grid-template-rows: minmax(120px, 1.25fr) minmax(90px, 1fr) minmax(70px, 0.7fr);
}
.sl-cap__list { overflow: auto; border-bottom: 3px solid var(--cap-line); outline: none; position: relative; }
.sl-cap__table { width: 100%; border-collapse: collapse; font: 11.5px ui-monospace, Consolas, monospace; }
.sl-cap__table th {
  position: sticky; top: 0; background: var(--cap-head); text-align: start;
  font: 600 11.5px system-ui, sans-serif; padding: 3px 6px;
  border-bottom: 1px solid var(--cap-line); white-space: nowrap; z-index: 1;
}
.sl-cap__table td { padding: 1px 6px; white-space: nowrap; color: #12141a; }
.sl-cap__table .c-info { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 0; width: 45%; }
.sl-cap__table .c-no, .sl-cap__table .c-len { text-align: end; }
.sl-cap__table tr { cursor: default; }
tr.c-http td { background: #e4ffc7; }
tr.c-tcp td { background: #e7e6ff; }
tr.c-udp td { background: #daeeff; }
tr.c-dns td { background: #daeeff; }
tr.c-tls td { background: #e7e6ff; }
tr.c-synfin td { background: #a0a0a0; }
tr.c-rst td { background: #a40000; color: #fffc9c; }
tr.c-arp td { background: #faf0d7; }
tr.c-icmp td { background: #fce0ff; }
tr.c-voip td { background: #e6e2ff; }
tr.is-marked td { background: #000 !important; color: #fff !important; }
tr.is-selected td { background: var(--cap-sel) !important; color: var(--cap-sel-ink) !important; }
.sl-cap__empty {
  position: absolute; inset: 30px 0 0; display: flex; flex-direction: column;
  align-items: center; justify-content: center; gap: 6px; color: #6b7280;
  text-align: center; padding: 10px;
}
.sl-cap__details { overflow: auto; border-bottom: 3px solid var(--cap-line); padding: 4px 6px; }
.sl-cap__details-head { display: flex; align-items: center; gap: 6px; margin-bottom: 3px; }
.sl-cap__tree, .sl-cap__tree :deep(ul) { list-style: none; margin: 0; padding-inline-start: 14px; }
.sl-cap__tree { padding-inline-start: 0; font: 11.5px ui-monospace, Consolas, monospace; }
.sl-cap__tree :deep(.sl-cap__node-row) {
  display: flex; align-items: center; gap: 3px; padding: 0 3px; cursor: default;
  white-space: nowrap;
}
.sl-cap__tree :deep(.sl-cap__node-row.is-hit) { background: var(--cap-sel); color: #fff; }
.sl-cap__tree :deep(.sl-cap__node-pad) { display: inline-block; width: 12px; }
.sl-cap__hint { color: #6b7280; margin: 6px; }
.sl-cap__hex { overflow: auto; padding: 4px 8px; font: 11.5px ui-monospace, Consolas, monospace; }
.sl-cap__hexrow { display: flex; gap: 14px; white-space: pre; }
.sl-cap__off { color: #6b7280; }
.sl-cap__bytes span { margin-inline-end: 4px; }
.sl-cap__bytes .is-hit, .sl-cap__ascii .is-hit { background: var(--cap-sel); color: #fff; }
.sl-cap__status {
  display: flex; gap: 14px; align-items: center; padding: 3px 10px;
  background: var(--cap-head); border-top: 1px solid var(--cap-line); color: #374151;
  flex-wrap: wrap;
}
.sl-cap__status .is-live { color: #d92d20; animation: sl-cap-blink 1s steps(2) infinite; }
.sl-cap__note { color: #4b5563; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 50%; }
@keyframes sl-cap-blink { 50% { opacity: 0.25; } }
@media (prefers-reduced-motion: reduce) { .sl-cap__status .is-live { animation: none; } }
.sl-cap__menu {
  position: absolute; z-index: 5; background: #fff; border: 1px solid #b8bfca;
  border-radius: 6px; box-shadow: 0 6px 18px rgb(0 0 0 / 0.18); padding: 4px 0;
  display: flex; flex-direction: column; min-width: 200px;
}
.sl-cap__menu button {
  border: 0; background: none; text-align: start; padding: 5px 12px; font: inherit;
  color: var(--cap-ink); cursor: pointer;
}
.sl-cap__menu button:hover { background: #e8eefb; }
.sl-cap__overlay {
  position: absolute; inset: 0; z-index: 6; background: rgb(0 0 0 / 0.35);
  display: flex; align-items: center; justify-content: center; padding: 16px;
}
.sl-cap__dialog {
  background: #fff; color: var(--cap-ink); border-radius: 8px; width: min(760px, 100%);
  max-height: 100%; display: flex; flex-direction: column; gap: 8px; padding: 10px 12px;
  box-shadow: 0 12px 32px rgb(0 0 0 / 0.3);
}
.sl-cap__dialog-head { display: flex; justify-content: space-between; align-items: center; }
.sl-cap__x { border: 0; background: none; font-size: 20px; cursor: pointer; color: #374151; }
.sl-cap__pre {
  margin: 0; overflow: auto; max-height: 60vh; background: #f8fafc; border: 1px solid #e2e8f0;
  padding: 8px; font: 11.5px/1.5 ui-monospace, Consolas, monospace; white-space: pre-wrap;
  word-break: break-all;
}
.sl-cap__field { display: flex; flex-direction: column; gap: 4px; }
.sl-cap__scope { display: flex; gap: 14px; flex-wrap: wrap; }
</style>
