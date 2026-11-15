<template>
  <div class="ec" dir="ltr" :style="{ '--ec-brand': product.color }">
    <header class="ec-mast">
      <span class="ec-logo" aria-hidden="true">{{ product.name.slice(0, 1) }}</span>
      <span class="ec-title"><b>{{ product.name }}</b><small>{{ product.vendor }}</small></span>
      <span class="ec-spacer"></span>
      <nav class="ec-tabs" aria-label="Sections">
        <button v-for="t in TABS" :key="t.id" type="button" class="ec-tab" :class="{ 'is-on': tab === t.id }"
                :aria-current="tab === t.id ? 'page' : undefined" @click="go(t.id)">{{ t.label }}</button>
      </nav>
    </header>

    <div class="ec-toasts" aria-live="polite">
      <div v-for="f in api.flashes.value" :key="f.id" class="ec-toast" :class="'is-' + f.type">
        <b>{{ f.title }}</b><span v-if="f.detail">{{ f.detail }}</span>
        <button type="button" class="ec-x" aria-label="Dismiss" @click="api.dismiss(f.id)">×</button>
      </div>
    </div>

    <div class="ec-body">
      <!-- ===== Inventory: the live state, read from the lab environment ===== -->
      <template v-if="tab === 'inventory'">
        <nav class="ec-side" aria-label="Pages">
          <template v-for="s in sections" :key="s.sub">
            <div class="ec-side__group">{{ s.sub }}</div>
            <button v-for="p in s.pages" :key="s.sub + '.' + p" type="button" class="ec-side__item"
                    :class="{ 'is-on': page === s.sub + '.' + p }" @click="page = s.sub + '.' + p">{{ label(p) }}</button>
          </template>
        </nav>
        <main class="ec-main">
          <p v-if="!sections.length" class="ec-muted">This lab has no {{ product.name }} systems.</p>
          <template v-else>
            <h1 class="ec-h1">{{ label(page.split('.').slice(1).join('.')) }}</h1>
            <section v-for="(b, i) in pageBlocks" :key="i" class="ec-card">
              <h2 v-if="b.title" class="ec-card__title">{{ label(b.title) }}</h2>
              <table v-if="b.type === 'table'" class="ec-table">
                <thead><tr><th v-for="c in b.cols" :key="c">{{ label(c) }}</th></tr></thead>
                <tbody>
                  <tr v-for="(r, ri) in b.rows" :key="ri">
                    <td v-for="c in b.cols" :key="c" :class="tone(r[c])">{{ fmt(r[c]) }}</td>
                  </tr>
                  <tr v-if="!b.rows.length"><td :colspan="b.cols.length || 1" class="ec-muted">Nothing here yet.</td></tr>
                </tbody>
              </table>
              <dl v-else-if="b.type === 'kv'" class="ec-dl">
                <template v-for="pr in b.pairs" :key="pr[0]"><dt>{{ label(pr[0]) }}</dt><dd :class="tone(pr[1])">{{ fmt(pr[1]) }}</dd></template>
              </dl>
              <div v-else class="ec-chips">
                <span v-for="(c, ci) in b.items" :key="ci" class="ec-chip">{{ fmt(c) }}</span>
                <span v-if="!b.items.length" class="ec-muted">None</span>
              </div>
            </section>
          </template>
        </main>
      </template>

      <!-- ===== Actions: the product's own forms ===== -->
      <main v-else-if="tab === 'actions'" class="ec-main ec-main--wide">
        <div class="ec-forms">
          <form v-for="(f, fi) in product.forms" :key="f.title" class="ec-card ec-form" @submit.prevent="submit(fi)">
            <h2 class="ec-card__title">{{ f.title }}</h2>
            <p v-if="f.hint" class="ec-muted ec-small">{{ f.hint }}</p>
            <label v-for="fd in f.fields" :key="fd.key" class="ec-field" :class="{ 'ec-field--check': fd.check }">
              <template v-if="fd.check">
                <input v-model="checks[fi][fd.key]" type="checkbox" />
                <span>{{ fd.label }}</span>
              </template>
              <template v-else>
                <span>{{ fd.label }}</span>
                <select v-if="fd.options" v-model="values[fi][fd.key]" class="ec-input">
                  <option v-for="o in fd.options" :key="o" :value="o">{{ o || '(any)' }}</option>
                </select>
                <textarea v-else-if="fd.area" v-model="values[fi][fd.key]" class="ec-input ec-input--area" rows="4" spellcheck="false"></textarea>
                <input v-else v-model="values[fi][fd.key]" class="ec-input" spellcheck="false" />
              </template>
            </label>
            <code class="ec-preview" :title="'Runs: ' + preview(fi)">{{ preview(fi) }}</code>
            <button type="submit" class="ec-btn ec-btn--primary" :disabled="busy">{{ f.run }}</button>
            <pre v-if="results[fi]" class="ec-out" :class="{ 'is-bad': !results[fi].ok }">{{ results[fi].text }}</pre>
          </form>
        </div>
      </main>

      <!-- ===== Guided: every task of this lab, step by step, by clicking ===== -->
      <main v-else-if="tab === 'guided'" class="ec-main ec-main--wide">
        <div class="ec-guided-head">
          <label class="ec-field ec-field--inline"><span>Lab</span>
            <select v-model="labId" class="ec-input">
              <option v-for="e in labs" :key="e.lab" :value="e.lab">{{ e.title }}</option>
            </select>
          </label>
          <p class="ec-muted ec-small">Each Run button sends the same command the Ops Console would. Edit it first if you like;
            steps marked "Files" are done in the Files tab. Press <b>Check my work</b> after each task.</p>
        </div>
        <details v-for="t in labEntry?.tasks || []" :key="t.id" class="ec-card ec-task" :open="t.id === openTask"
                 @toggle="onToggle(t.id, $event)">
          <summary><b>{{ t.id.toUpperCase() }}</b> {{ t.goal }}</summary>
          <ol class="ec-steps">
            <li v-for="(s, si) in t.steps" :key="si" :class="'is-' + s.kind">
              <template v-if="s.kind === 'run'">
                <div class="ec-step__head"><span class="ec-badge">{{ s.host }}</span><span class="ec-muted ec-small">{{ s.note }}</span></div>
                <div class="ec-step__run">
                  <textarea v-model="edits[t.id + ':' + si]" class="ec-input ec-input--code" :rows="rowsOf(t.id + ':' + si, s.line)" spellcheck="false"></textarea>
                  <button type="button" class="ec-btn ec-btn--primary" :disabled="busy" @click="runStep(t.id + ':' + si, s.line)">Run</button>
                </div>
                <pre v-if="outs[t.id + ':' + si]" class="ec-out" :class="{ 'is-bad': !outs[t.id + ':' + si].ok }">{{ outs[t.id + ':' + si].text }}</pre>
              </template>
              <p v-else class="ec-step__text"><span v-if="s.kind === 'files'" class="ec-badge ec-badge--files">Files</span>{{ s.text }}</p>
            </li>
          </ol>
          <p class="ec-muted ec-small">Done when: {{ t.done_when }}</p>
        </details>
        <p v-if="!labs.length" class="ec-muted">No guided steps for this console.</p>
      </main>

      <!-- ===== Console: any command, for anything the forms do not cover ===== -->
      <main v-else class="ec-main ec-main--wide">
        <div class="ec-card">
          <h2 class="ec-card__title">Command</h2>
          <p class="ec-muted ec-small">Runs at the workstation, like the Ops Console. Use <code>ssh HOST command</code> for a server and
            <code>pwsh -Command "..."</code> for AD, Graph and Exchange Online.</p>
          <form class="ec-step__run" @submit.prevent="runFree">
            <textarea v-model="free" class="ec-input ec-input--code" rows="3" spellcheck="false" aria-label="Command"></textarea>
            <button type="submit" class="ec-btn ec-btn--primary" :disabled="busy || !free.trim()">Run</button>
          </form>
          <div v-for="h in freeLog" :key="h.id" class="ec-log">
            <code>{{ h.cmd }}</code>
            <pre class="ec-out" :class="{ 'is-bad': !h.ok }">{{ h.text }}</pre>
          </div>
        </div>
      </main>
    </div>
  </div>
</template>

<script setup lang="ts">
/**
 * One component for the twelve enterprise consoles of SRE labs 19-30. The
 * product (chrome, colour, forms) comes from products.ts by the tool's skin;
 * the inventory pages are drawn from whatever the lab's subsystem reports, so a
 * new field on app 11 appears here without a frontend change; the guided tab
 * is the lab's task cards, with every command a Run button.
 */
import { computed, reactive, ref, watch } from 'vue';
import { errorText } from '@/utils/portalKit';
import { PRODUCTS, type Product } from './products';
import GUIDED from './guided.json';

interface Step { kind: string; line?: string; host?: string; note?: string; text?: string }
interface Task { id: string; goal: string; steps: Step[]; done_when: string }
interface LabEntry { lab: string; title: string; subsystems: string[]; tasks: Task[] }
interface Block { type: 'table' | 'kv' | 'chips'; title: string; cols: string[]; rows: any[]; pairs: [string, any][]; items: any[] }

const props = defineProps<{ view: Record<string, any>; api: any; tool: any; busy?: boolean }>();
const emit = defineEmits<{ (e: 'location', url: string): void; (e: 'refresh'): void }>();
const api = props.api;

const FALLBACK: Product = { name: 'Console', vendor: '', color: '#444', location: 'about:blank', subsystems: [], forms: [] };
const skin = String(props.tool?.skin || '');
const product: Product = PRODUCTS[skin] || FALLBACK;
const TABS = [
    { id: 'inventory', label: 'Inventory' }, { id: 'actions', label: 'Actions' },
    { id: 'guided', label: 'Guided tasks' }, { id: 'console', label: 'Console' },
];

const tab = ref('inventory');
const page = ref('');
const busy = computed(() => Boolean(props.busy));

function go(id: string) {
    tab.value = id;
    emit('location', product.location.replace(/[#?].*$/, '') + (id === 'inventory' ? '' : '#/' + id));
}

/* ---------- inventory ---------- */
const ent = computed<Record<string, any>>(() => (props.view && props.view.ent) || {});
const sections = computed(() => product.subsystems
    .filter(sub => ent.value[sub] && typeof ent.value[sub] === 'object')
    .map(sub => ({ sub, pages: Object.keys(ent.value[sub]).filter(k => k !== 'error') })));

watch(sections, list => {
    if (!list.length) return;
    if (!list.some(s => s.pages.some(p => page.value === s.sub + '.' + p))) page.value = list[0].sub + '.' + list[0].pages[0];
}, { immediate: true });

function isRecordList(v: any): boolean {
    return Array.isArray(v) && v.length > 0 && v.every(x => x && typeof x === 'object' && !Array.isArray(x));
}

function toBlocks(title: string, v: any, depth: number): Block[] {
    const base = { title, cols: [] as string[], rows: [] as any[], pairs: [] as [string, any][], items: [] as any[] };
    if (isRecordList(v)) {
        const cols: string[] = [];
        for (const r of v.slice(0, 20)) for (const k of Object.keys(r)) if (!cols.includes(k)) cols.push(k);
        return [{ ...base, type: 'table', cols: cols.slice(0, 10), rows: v }];
    }
    if (Array.isArray(v)) return [{ ...base, type: 'chips', items: v }];
    if (v && typeof v === 'object') {
        const pairs: [string, any][] = [];
        const nested: Block[] = [];
        for (const [k, x] of Object.entries(v)) {
            if (x && typeof x === 'object' && depth < 2 && (isRecordList(x) || (!Array.isArray(x) && Object.keys(x).length > 3))) {
                nested.push(...toBlocks(k, x, depth + 1));
            } else {
                pairs.push([k, x]);
            }
        }
        const out: Block[] = pairs.length ? [{ ...base, type: 'kv', pairs }] : [];
        return out.concat(nested);
    }
    return [{ ...base, type: 'kv', pairs: [[title || 'value', v]] }];
}

const pageBlocks = computed<Block[]>(() => {
    const [sub, ...rest] = page.value.split('.');
    const key = rest.join('.');
    if (!sub || !ent.value[sub]) return [];
    return toBlocks('', ent.value[sub][key], 0);
});

function label(key: string): string {
    const text = String(key || '').replace(/_/g, ' ');
    return text.charAt(0).toUpperCase() + text.slice(1);
}

function fmt(v: any): string {
    if (v === true) return '✔ yes';
    if (v === false) return '✖ no';
    if (v === null || v === undefined || v === '') return '—';
    if (Array.isArray(v)) return v.map(x => (x && typeof x === 'object' ? JSON.stringify(x) : String(x))).join(', ') || '—';
    if (typeof v === 'object') return Object.entries(v).map(([k, x]) => k + '=' + (typeof x === 'object' ? JSON.stringify(x) : x)).join(' · ');
    return String(v);
}

const GOOD = /^(true|ok|pass(ed)?|healthy|up|running|succeeded|success|resolved|closed|compliant|connected|enabled|active|normal|completed?|synced)$/i;
const BAD = /^(false|fail(ed)?|down|unhealthy|critical|error|stopped|locked|blocked|rolled ?back|rollback_complete|disabled)$/i;
const WARN = /^(draining|pending|warning|warn|important|in progress|new|degraded|queued|syncing|partial)$/i;

function tone(v: any): string {
    const s = String(v ?? '').trim();
    if (GOOD.test(s)) return 'is-good';
    if (BAD.test(s)) return 'is-bad';
    if (WARN.test(s)) return 'is-warn';
    return '';
}

/* ---------- actions ---------- */
const values = reactive(product.forms.map(f => Object.fromEntries(f.fields.filter(x => !x.check).map(x => [x.key, x.value ?? '']))));
const checks = reactive(product.forms.map(f => Object.fromEntries(f.fields.filter(x => x.check).map(x => [x.key, x.value === 'true']))));
const results = reactive<Record<number, { ok: boolean; text: string }>>({});

function formValues(fi: number): Record<string, string> {
    const out: Record<string, string> = { ...values[fi] };
    for (const [k, on] of Object.entries(checks[fi])) out[k] = on ? 'true' : '';
    return out;
}

function preview(fi: number): string {
    try { return product.forms[fi].build(formValues(fi)); } catch { return ''; }
}

async function exec(line: string) {
    const res = await api.exec(line, { quiet: true });
    emit('refresh');
    return { ok: Boolean(res.ok), text: res.ok ? (res.output || '(done)') : errorText(res) || res.output || 'The command failed.' };
}

async function submit(fi: number) {
    const line = preview(fi);
    if (!line) return;
    results[fi] = await exec(line);
}

/* ---------- guided ---------- */
const labs = computed<LabEntry[]>(() => ((GUIDED as any)[skin] || []) as LabEntry[]);
const here = computed(() => [...((ent.value.subsystems as string[]) || [])].sort().join(','));
const labId = ref('');
watch([labs, here], () => {
    if (labs.value.some(e => e.lab === labId.value)) return;
    const match = labs.value.find(e => e.subsystems.join(',') === here.value);
    labId.value = (match || labs.value[0] || { lab: '' }).lab;
}, { immediate: true });
const labEntry = computed(() => labs.value.find(e => e.lab === labId.value) || null);
const openTask = ref('t1');
const edits = reactive<Record<string, string>>({});
const outs = reactive<Record<string, { ok: boolean; text: string }>>({});

function onToggle(id: string, event: Event) {
    if ((event.target as HTMLDetailsElement).open) openTask.value = id;
}

watch(labEntry, entry => {
    for (const t of entry?.tasks || []) {
        t.steps.forEach((s, si) => {
            const key = t.id + ':' + si;
            if (s.kind === 'run' && edits[key] === undefined) edits[key] = s.line || '';
        });
    }
}, { immediate: true });

function rowsOf(key: string, line = ''): number {
    const text = edits[key] ?? line;
    return Math.min(14, Math.max(1, text.split('\n').length, Math.ceil(text.length / 110)));
}

async function runStep(key: string, line = '') {
    const text = (edits[key] ?? line).trim();
    if (text) outs[key] = await exec(text);
}

/* ---------- console ---------- */
const free = ref('');
const freeLog = ref<{ id: number; cmd: string; ok: boolean; text: string }[]>([]);
let seq = 0;

async function runFree() {
    const cmd = free.value.trim();
    if (!cmd) return;
    const r = await exec(cmd);
    freeLog.value = [{ id: ++seq, cmd, ...r }, ...freeLog.value].slice(0, 20);
}
</script>

<style scoped src="./enterprise.css"></style>
