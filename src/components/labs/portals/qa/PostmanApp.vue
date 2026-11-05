<template>
  <div class="pm" dir="ltr">
    <header class="pm-head">
      <span class="pm-logo" aria-hidden="true"></span><strong>Postman</strong>
      <span class="pm-ws">My Workspace</span>
      <div class="pm-spacer"></div>
      <label class="pm-env">
        <select v-model="envPath" aria-label="Environment">
          <option value="">No environment</option>
          <option v-for="e in environments" :key="e.path" :value="e.path">{{ e.name }}</option>
        </select>
      </label>
    </header>

    <div class="pm-body">
      <aside class="pm-side">
        <div class="pm-side__tabs">
          <button type="button" :class="{ 'is-active': side === 'collections' }" @click="side = 'collections'">Collections</button>
          <button type="button" :class="{ 'is-active': side === 'environments' }" @click="side = 'environments'">Environments</button>
          <button type="button" :class="{ 'is-active': side === 'history' }" @click="side = 'history'">History</button>
        </div>
        <div v-if="side === 'collections'" class="pm-side__list">
          <p v-if="!collections.length" class="pm-muted">No collections yet. Send a request and save it to create one.</p>
          <details v-for="c in collections" :key="c.path" open class="pm-coll">
            <summary>
              <span>{{ c.name }}</span>
              <button type="button" class="pm-run" title="Run collection" @click.prevent="openRunner(c.path)">&#9654; Run</button>
            </summary>
            <button v-for="(r, i) in c.requests" :key="i" type="button" class="pm-req" @click="load(r)">
              <span class="pm-method" :class="'pm-m-' + r.method">{{ r.method }}</span>{{ r.name }}
            </button>
          </details>
        </div>
        <div v-else-if="side === 'environments'" class="pm-side__list">
          <p v-if="!environments.length" class="pm-muted">No environment files in this lab.</p>
          <div v-for="e in environments" :key="e.path" class="pm-envbox">
            <b>{{ e.name }}</b> <small>{{ e.path }}</small>
            <div v-for="v in e.values" :key="v.key" class="pm-var"><code>{{ v.key }}</code><span>{{ v.value }}</span></div>
          </div>
        </div>
        <div v-else class="pm-side__list">
          <p v-if="!history.length" class="pm-muted">Requests you send appear here.</p>
          <button v-for="(h, i) in history" :key="i" type="button" class="pm-req" @click="method = h.method; url = h.url">
            <span class="pm-method" :class="'pm-m-' + h.method">{{ h.method }}</span>{{ h.url }}
            <small class="pm-code" :class="codeClass(h.status)">{{ h.status }}</small>
          </button>
        </div>
      </aside>

      <main class="pm-main">
        <div class="pm-tabsrow">
          <button type="button" :class="{ 'is-active': mainTab === 'request' }" @click="mainTab = 'request'">Request</button>
          <button type="button" :class="{ 'is-active': mainTab === 'runner' }" @click="mainTab = 'runner'">Collection Runner</button>
        </div>

        <template v-if="mainTab === 'request'">
          <form class="pm-line" @submit.prevent="send">
            <select v-model="method" class="pm-verb" :class="'pm-m-' + method" aria-label="Method">
              <option v-for="m in METHODS" :key="m" :value="m">{{ m }}</option>
            </select>
            <input v-model="url" class="pm-url" spellcheck="false" placeholder="{{baseUrl}}/api/products" aria-label="URL">
            <button type="submit" class="pm-send" :disabled="busy || !url.trim()">Send</button>
            <button type="button" class="pm-save" :disabled="busy || !url.trim()" @click="saving = !saving">Save</button>
          </form>
          <form v-if="saving" class="pm-saveform" @submit.prevent="save">
            <label>Request name <input v-model="saveName" required></label>
            <label>Collection file <input v-model="savePath" required spellcheck="false" list="pm-colls"></label>
            <datalist id="pm-colls"><option v-for="c in collections" :key="c.path" :value="c.path" /></datalist>
            <button type="submit" class="pm-send" :disabled="busy">Save to collection</button>
          </form>

          <div class="pm-sub">
            <button type="button" :class="{ 'is-active': reqTab === 'headers' }" @click="reqTab = 'headers'">Headers ({{ headers.filter(h => h.key).length }})</button>
            <button type="button" :class="{ 'is-active': reqTab === 'body' }" @click="reqTab = 'body'">Body</button>
            <button type="button" :class="{ 'is-active': reqTab === 'auth' }" @click="reqTab = 'auth'">Authorization</button>
          </div>
          <div v-if="reqTab === 'headers'" class="pm-kv">
            <div v-for="(h, i) in headers" :key="i" class="pm-kv__row">
              <input v-model="h.key" placeholder="Key" spellcheck="false">
              <input v-model="h.value" placeholder="Value" spellcheck="false">
              <button type="button" aria-label="Remove header" @click="headers.splice(i, 1)">&times;</button>
            </div>
            <button type="button" class="pm-link" @click="headers.push({ key: '', value: '' })">+ Add header</button>
          </div>
          <div v-else-if="reqTab === 'body'" class="pm-bodyedit">
            <span class="pm-muted">raw &middot; JSON</span>
            <textarea v-model="body" spellcheck="false" rows="7" placeholder='{ "email": "alice@qa.shop", "password": "Passw0rd!" }'></textarea>
          </div>
          <div v-else class="pm-kv">
            <label class="pm-muted">Bearer token
              <input v-model="token" spellcheck="false" placeholder="tok-... (from POST /api/auth/login)">
            </label>
          </div>

          <section class="pm-resp">
            <div class="pm-resp__head">
              <strong>Response</strong>
              <template v-if="response">
                <span class="pm-code" :class="codeClass(response.status)">{{ response.status }} {{ response.reason }}</span>
                <span class="pm-muted">{{ response.time }} ms</span>
                <span class="pm-muted">{{ response.size }} B</span>
              </template>
              <div class="pm-spacer"></div>
              <button type="button" :class="{ 'is-active': respTab === 'body' }" @click="respTab = 'body'">Body</button>
              <button type="button" :class="{ 'is-active': respTab === 'headers' }" @click="respTab = 'headers'">Headers</button>
            </div>
            <p v-if="!response" class="pm-muted pm-pad">Enter the URL and click Send to get a response.</p>
            <pre v-else-if="respTab === 'body'" class="pm-json">{{ prettyJson(response.body) }}</pre>
            <table v-else class="pm-table"><tbody>
              <tr v-for="(v, k) in response.headers" :key="k"><td>{{ k }}</td><td>{{ v }}</td></tr>
            </tbody></table>
            <p v-for="o in response?.observations || []" :key="o" class="pm-obs">&#9888; {{ o }} recorded - this response does not match the spec.</p>
          </section>
        </template>

        <section v-else class="pm-runner">
          <form class="pm-runform" @submit.prevent="runCollection">
            <label>Collection
              <select v-model="runPath" required>
                <option v-for="c in collections" :key="c.path" :value="c.path">{{ c.name }} ({{ c.path }})</option>
              </select>
            </label>
            <label>Environment
              <select v-model="envPath"><option value="">No environment</option>
                <option v-for="e in environments" :key="e.path" :value="e.path">{{ e.name }}</option></select>
            </label>
            <label class="pm-check"><input v-model="junit" type="checkbox"> Export JUnit report</label>
            <button type="submit" class="pm-send" :disabled="busy || !runPath">Run {{ collections.find(c => c.path === runPath)?.name || '' }}</button>
          </form>
          <div v-if="lastRun" class="pm-result">
            <div class="pm-result__sum">
              <span class="pm-pass">Passed {{ lastRun.passed }}</span>
              <span class="pm-fail">Failed {{ lastRun.failed }}</span>
              <span class="pm-muted">{{ lastRun.requests }} requests &middot; {{ lastRun.assertions }} assertions &middot; build {{ lastRun.build }}</span>
            </div>
            <div v-for="(t, i) in lastRun.tests" :key="i" class="pm-fail-row">
              <b>FAIL</b> {{ t.nodeid }}<br><small>{{ t.message }}</small>
            </div>
            <p v-if="!lastRun.tests?.length && lastRun.status === 'passed'" class="pm-pass">All assertions passed.</p>
          </div>
          <p v-else class="pm-muted pm-pad">Runs use newman, the same engine as the CLI.</p>
        </section>
      </main>
    </div>

    <div class="pm-flashes" aria-live="polite">
      <div v-for="f in api.flashes.value" :key="f.id" class="pm-flash" :class="'pm-flash--' + f.type">
        {{ f.title }}<span v-if="f.detail"> - {{ f.detail }}</span>
        <button type="button" aria-label="Dismiss" @click="api.dismiss(f.id)">&times;</button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue';
import { cli, rows } from '@/utils/portalKit';
import type { PortalApi } from '../usePortal';
import { prettyJson } from './qaKit';

const props = defineProps<{ view: Record<string, any>; api: PortalApi; tool: any; busy?: boolean }>();
const emit = defineEmits<{ (e: 'location', url: string): void; (e: 'refresh'): void }>();

const METHODS = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'];
const collections = computed(() => rows<any>(props.view, 'files.collections'));
const environments = computed(() => rows<any>(props.view, 'files.environments'));
const history = computed(() => rows<any>(props.view, 'http_history'));
const busy = computed(() => Boolean(props.busy) || props.api.busy.value);
const lastRun = computed(() => rows<any>(props.view, 'runs').find(r => r.tool === 'newman' && (!runPath.value || r.target === runPath.value)));

const side = ref<'collections' | 'environments' | 'history'>('collections');
const mainTab = ref<'request' | 'runner'>('request');
const reqTab = ref<'headers' | 'body' | 'auth'>('headers');
const respTab = ref<'body' | 'headers'>('body');
const method = ref('GET');
const url = ref('http://qa-shop.local/api/products');
const headers = reactive<{ key: string; value: string }[]>([{ key: 'Accept', value: 'application/json' }]);
const body = ref('');
const token = ref('');
const envPath = ref('');
const response = ref<any>(null);
const saving = ref(false);
const saveName = ref('');
const savePath = ref('collections/my-requests.json');
const runPath = ref('');
const junit = ref(false);

watch(collections, list => { if (!runPath.value && list.length) runPath.value = list[0].path; }, { immediate: true });
watch(environments, list => { if (!envPath.value && list.length) envPath.value = list[0].path; }, { immediate: true });
emit('location', 'postman://workspace/my-workspace');

function load(r: any) {
    method.value = r.method; url.value = r.url; body.value = r.body || '';
    headers.splice(0, headers.length, ...(r.headers?.length ? r.headers.map((h: any) => ({ ...h })) : [{ key: '', value: '' }]));
    saveName.value = r.name; mainTab.value = 'request';
}
function headerFlags(): string[] {
    const out = headers.filter(h => h.key.trim()).map(h => `${h.key.trim()}: ${h.value}`);
    if (token.value.trim()) out.push(`Authorization: Bearer ${token.value.trim()}`);
    return out;
}
function requestCommand(extra: Record<string, string> = {}) {
    return cli(['qa', 'http', method.value, url.value.trim()], {
        '-H': headerFlags(), '--body': body.value.trim(), '--env': envPath.value, ...extra,
    });
}
async function send() {
    const result = await props.api.exec(requestCommand(), { failure: 'Could not send request' });
    if (result.ok && result.data) {
        response.value = result.data;
        const t = (result.data as any).body?.token;
        if (t && !token.value) token.value = t;
    }
}
async function save() {
    const result = await props.api.exec(requestCommand({ '--save': savePath.value, '--name': saveName.value }),
                                        { success: `Saved "${saveName.value}"` });
    if (result.ok) { response.value = result.data; saving.value = false; }
}
function openRunner(path: string) {
    runPath.value = path; mainTab.value = 'runner';
}
async function runCollection() {
    await props.api.exec(cli(['newman', 'run', runPath.value], {
        '-e': envPath.value, '-r': junit.value ? 'cli,junit' : '',
        '--reporter-junit-export': junit.value ? 'reports/newman.xml' : '',
    }));
}
function codeClass(status: number) {
    return status >= 500 ? 'is-5xx' : status >= 400 ? 'is-4xx' : 'is-2xx';
}
</script>

<style scoped>
.pm { --pm-orange: #ff6c37; --pm-line: #e6e6e6; display: flex; flex-direction: column; height: 100%; min-height: 600px; background: #fff; color: #212121;
  font: 13px/1.45 Inter, system-ui, 'Segoe UI', Roboto, sans-serif; position: relative; }
.pm-head { display: flex; align-items: center; gap: 10px; padding: 8px 12px; border-bottom: 1px solid var(--pm-line); background: #f9f9f9; flex-wrap: wrap; }
.pm-logo { width: 20px; height: 20px; border-radius: 50%; background: var(--pm-orange); box-shadow: inset -5px -3px 0 rgba(0,0,0,.12); }
.pm-ws { color: #6b6b6b; border-left: 1px solid var(--pm-line); padding-left: 10px; }
.pm-spacer { flex: 1; }
.pm-env select, .pm-verb, .pm-runform select { font: inherit; padding: 5px 8px; border: 1px solid #d4d4d4; border-radius: 4px; background: #fff; color: inherit; }
.pm-body { flex: 1; display: grid; grid-template-columns: minmax(200px, 26%) minmax(0, 1fr); min-height: 0; }
.pm-side { border-right: 1px solid var(--pm-line); display: flex; flex-direction: column; min-height: 0; }
.pm-side__tabs, .pm-tabsrow, .pm-sub { display: flex; border-bottom: 1px solid var(--pm-line); }
.pm-side__tabs button, .pm-tabsrow button, .pm-sub button, .pm-resp__head button { border: 0; background: none; padding: 8px 10px; cursor: pointer; color: #6b6b6b; font: inherit;
  border-bottom: 2px solid transparent; }
.pm-side__tabs .is-active, .pm-tabsrow .is-active, .pm-sub .is-active, .pm-resp__head .is-active { color: #212121; border-bottom-color: var(--pm-orange); }
.pm-side__list { overflow: auto; padding: 6px; flex: 1; }
.pm-coll summary { display: flex; align-items: center; gap: 6px; padding: 6px; cursor: pointer; font-weight: 600; }
.pm-coll summary span { flex: 1; }
.pm-run { border: 1px solid #d4d4d4; background: #fff; border-radius: 4px; font-size: 11px; padding: 2px 6px; cursor: pointer; }
.pm-req { display: flex; width: 100%; gap: 8px; align-items: center; border: 0; background: none; text-align: left; padding: 5px 6px 5px 18px; cursor: pointer;
  font: inherit; color: inherit; border-radius: 4px; }
.pm-req:hover { background: #f2f2f2; }
.pm-method { font-size: 10px; font-weight: 700; width: 44px; flex: none; }
.pm-m-GET { color: #007f31; } .pm-m-POST { color: #ad7a03; } .pm-m-PUT { color: #0053b8; } .pm-m-PATCH { color: #623497; } .pm-m-DELETE { color: #8e1a10; }
.pm-envbox { padding: 6px; border-bottom: 1px solid var(--pm-line); }
.pm-var { display: flex; justify-content: space-between; gap: 8px; font-size: 12px; }
.pm-main { display: flex; flex-direction: column; min-width: 0; overflow: auto; }
.pm-line { display: flex; gap: 6px; padding: 10px 12px; }
.pm-verb { font-weight: 700; }
.pm-url { flex: 1; min-width: 0; border: 1px solid #d4d4d4; border-radius: 4px; padding: 7px 10px; font: 13px ui-monospace, Consolas, monospace; }
.pm-send { background: #0265d2; color: #fff; border: 0; border-radius: 4px; padding: 7px 18px; cursor: pointer; font: inherit; font-weight: 600; }
.pm-send:disabled { opacity: .5; cursor: default; }
.pm-save { border: 1px solid #d4d4d4; background: #fff; border-radius: 4px; padding: 7px 12px; cursor: pointer; font: inherit; }
.pm-saveform, .pm-runform { display: flex; flex-wrap: wrap; gap: 10px; align-items: end; padding: 0 12px 10px; }
.pm-saveform label, .pm-runform label { display: grid; gap: 2px; font-size: 12px; color: #6b6b6b; }
.pm-saveform input { border: 1px solid #d4d4d4; border-radius: 4px; padding: 5px 8px; font: inherit; min-width: 200px; }
.pm-check { display: flex !important; align-items: center; gap: 6px; }
.pm-kv { padding: 8px 12px; display: grid; gap: 6px; }
.pm-kv__row { display: grid; grid-template-columns: 1fr 1.5fr auto; gap: 6px; }
.pm-kv input, .pm-kv label input { border: 1px solid #d4d4d4; border-radius: 4px; padding: 5px 8px; font: 12px ui-monospace, Consolas, monospace; width: 100%; box-sizing: border-box; }
.pm-kv__row button { border: 0; background: none; cursor: pointer; font-size: 16px; color: #8a8a8a; }
.pm-link { justify-self: start; border: 0; background: none; color: #0265d2; cursor: pointer; font: inherit; padding: 0; }
.pm-bodyedit { padding: 8px 12px; display: grid; gap: 4px; }
.pm-bodyedit textarea { font: 12px/1.5 ui-monospace, Consolas, monospace; border: 1px solid #d4d4d4; border-radius: 4px; padding: 8px; resize: vertical; }
.pm-resp { border-top: 1px solid var(--pm-line); margin-top: 8px; flex: 1; display: flex; flex-direction: column; min-height: 220px; }
.pm-resp__head { display: flex; align-items: center; gap: 10px; padding: 4px 12px; border-bottom: 1px solid var(--pm-line); flex-wrap: wrap; }
.pm-code { font-weight: 700; } .pm-code.is-2xx { color: #007f31; } .pm-code.is-4xx { color: #ad7a03; } .pm-code.is-5xx { color: #8e1a10; }
.pm-json { margin: 0; padding: 10px 12px; font: 12px/1.5 ui-monospace, Consolas, monospace; overflow: auto; flex: 1; background: #fafafa; }
.pm-table { border-collapse: collapse; margin: 8px 12px; font-size: 12px; }
.pm-table td { border-bottom: 1px solid var(--pm-line); padding: 4px 10px; }
.pm-obs { margin: 6px 12px; background: #fff4e5; color: #8a4b00; padding: 6px 8px; border-radius: 4px; }
.pm-muted { color: #8a8a8a; }
.pm-pad { padding: 10px 12px; }
.pm-runner { padding: 12px 0; }
.pm-result { padding: 0 12px; }
.pm-result__sum { display: flex; gap: 14px; flex-wrap: wrap; align-items: center; margin-bottom: 8px; }
.pm-pass { color: #007f31; font-weight: 600; } .pm-fail { color: #8e1a10; font-weight: 600; }
.pm-fail-row { border-left: 3px solid #8e1a10; background: #fdf2f1; padding: 6px 8px; margin: 4px 0; }
.pm-flashes { position: absolute; right: 12px; bottom: 12px; display: grid; gap: 6px; max-width: 380px; z-index: 2; }
.pm-flash { background: #212121; color: #fff; padding: 8px 28px 8px 10px; border-radius: 4px; position: relative; }
.pm-flash--error { background: #8e1a10; }
.pm-flash button { position: absolute; right: 6px; top: 4px; background: none; border: 0; color: inherit; cursor: pointer; font-size: 16px; }
@container sl-portal (max-width: 720px) { .pm-body { grid-template-columns: 1fr; } .pm-side { border-right: 0; border-bottom: 1px solid var(--pm-line); max-height: 220px; } }
</style>
