<template>
  <div class="sl-prev">
    <div class="sl-prev__bar">
      <button class="sl-prev__nav" :disabled="!canBack" :title="$t('Back')"
              @click="back"><ChevronLeft :size="15" /></button>
      <button class="sl-prev__nav" :title="$t('Reload')" @click="go(path)">
        <RotateCw :size="14" />
      </button>
      <form class="sl-prev__url" @submit.prevent="go(typed)">
        <span class="sl-prev__host">{{ host }}</span>
        <input v-model="typed" class="sl-prev__input" spellcheck="false"
               :aria-label="$t('Address')" />
      </form>
      <span v-if="status" class="sl-prev__status" :class="statusClass">
        {{ status }}
      </span>
    </div>

    <div v-if="routes.length" class="sl-prev__routes">
      <button v-for="row in routes" :key="row.route" class="sl-prev__route"
              :class="{ 'is-active': row.route === path }"
              :title="row.view" @click="go(row.route)">{{ row.route }}</button>
    </div>

    <div class="sl-prev__stage">
      <!--
        SANDBOXED, AND WITHOUT `allow-same-origin`.

        The document here is rendered from the student's own template with
        their own data in it. `allow-same-origin` beside `allow-scripts` is not
        a sandbox - it is a same-origin script tag with extra steps, and
        anything in that page would reach this document and the session token
        in it. `srcdoc` rather than a blob URL for the same reason: a `blob:`
        inherits THIS origin.
      -->
      <iframe ref="frame" class="sl-prev__frame" :title="$t('Preview')"
              sandbox="allow-scripts allow-forms allow-modals"
              :srcdoc="srcdoc"></iframe>
      <div v-if="!running && !srcdoc" class="sl-prev__idle">
        <Globe :size="26" />
        <p>{{ $t('The development server is not running yet.') }}</p>
        <code>{{ startCommand }}</code>
      </div>
    </div>

    <details v-if="queries.length" class="sl-prev__sql">
      <summary>{{ $t('{v0} SQL queries ran for this page', { v0: queries.length }) }}</summary>
      <ol>
        <li v-for="(q, i) in queries" :key="i"><code>{{ q }}</code></li>
      </ol>
    </details>
  </div>
</template>

<script setup lang="ts">
/**
 * The BROWSER pane for a backend lab: the page the student's view returned.
 *
 * A backend course is the one place where a lab can otherwise never show the
 * thing the student is building. They write a model, a view, a URL and a
 * template, and the only feedback a console can give is a wall of HTML. This
 * pane fetches the URL through the lab service - which runs the real view
 * against the real database and renders the real template - and draws what
 * came back.
 *
 * Three decisions worth keeping:
 *
 * - **Links and forms inside the page navigate the PANE.** A shim is appended
 *   to the document that posts a click or a submit up to this component, which
 *   re-requests through the service. Without it, every link in a rendered page
 *   is dead and the student cannot walk their own site - which is most of what
 *   "does my URL routing work" means. It is appended rather than injected at
 *   the top because it must not shadow anything the student wrote.
 * - **The SQL the page ran is listed underneath.** One line of template can be
 *   twenty queries, and this is where N+1 stops being an abstraction.
 * - **A 500 is rendered, not swallowed.** The engine returns an error page with
 *   the offending line on it; showing that IS the debugging lesson.
 */
import { computed, ref, watch } from 'vue';
import { ChevronLeft, Globe, RotateCw } from 'lucide-vue-next';

const props = defineProps<{
  family: string;
  toolId: string;
  running?: boolean;
  run: (toolId: string, payload: Record<string, unknown>) => Promise<any>;
}>();

const path = ref('/');
const typed = ref('/');
const srcdoc = ref('');
const status = ref('');
const queries = ref<string[]>([]);
const routes = ref<Array<{ route: string; name: string; view: string }>>([]);
const history = ref<string[]>([]);
const frame = ref<HTMLIFrameElement | null>(null);

const host = computed(() =>
  props.family === 'flask' ? 'http://127.0.0.1:5000' : 'http://127.0.0.1:8000');
const startCommand = computed(() =>
  props.family === 'flask' ? 'flask run' : 'python manage.py runserver');
const canBack = computed(() => history.value.length > 1);
const statusClass = computed(() => {
  const code = parseInt(status.value, 10);
  if (!code) return '';
  if (code >= 500) return 'is-bad';
  if (code >= 400) return 'is-warn';
  if (code >= 300) return 'is-info';
  return 'is-ok';
});

/**
 * The shim, appended to every rendered document.
 *
 * `allow-same-origin` is absent, so this frame's origin is opaque and
 * `postMessage` has to target `'*'`. The parent therefore filters on the
 * marker rather than on the origin - the same arrangement `LabWeb.vue` uses
 * for its console capture, and the reason is worth restating: an opaque origin
 * cannot be named, so the only thing that can be checked is the payload.
 */
const SHIM = `<script>(function(){
  function send(m){ try{ parent.postMessage(Object.assign({sfsPreview:1},m),'*'); }catch(e){} }
  document.addEventListener('click', function(e){
    var a = e.target && e.target.closest ? e.target.closest('a') : null;
    if(!a) return;
    var href = a.getAttribute('href') || '';
    if(!href || href.charAt(0)==='#') return;
    if(/^[a-z]+:/i.test(href) && !/^https?:/i.test(href)) return;
    e.preventDefault(); send({go: href});
  }, true);
  document.addEventListener('submit', function(e){
    var f = e.target; if(!f || f.tagName!=='FORM') return;
    e.preventDefault();
    var data = {};
    try{ new FormData(f).forEach(function(v,k){ data[k]=v; }); }catch(err){}
    send({go: f.getAttribute('action') || location.pathname || '/',
          method: (f.getAttribute('method')||'GET').toUpperCase(), data: data});
  }, true);
})()<\/script>`;

function absolute(href: string): string {
  let target = String(href || '/').trim();
  target = target.replace(/^https?:\/\/[^/]+/i, '');
  if (!target.startsWith('/')) {
    const base = path.value.replace(/[^/]*$/, '');
    target = (base + target).replace(/\/{2,}/g, '/');
  }
  return target || '/';
}

async function go(target: string, method = 'GET', data?: Record<string, unknown>) {
  const next = absolute(target);
  path.value = next;
  typed.value = next;
  const result = await props.run(props.toolId, { path: next, method, data: data || {} });
  if (!result?.ok) {
    status.value = '';
    srcdoc.value = errorDoc(result?.error || 'The preview could not be built');
    return;
  }
  const response = result.response || {};
  status.value = `${response.status || ''} ${response.reason || ''}`.trim();
  queries.value = Array.isArray(response.queries) ? response.queries : [];
  routes.value = Array.isArray(result.routes) ? result.routes : routes.value;
  if (response.status === 302 && response.headers?.Location) {
    // Follow one redirect, exactly as a browser does. Not a loop: a chain is a
    // bug in the student's views and they need to SEE it stop somewhere.
    const location = String(response.headers.Location);
    if (location !== next) { await go(location); return; }
  }
  const body = String(response.body || '');
  srcdoc.value = (response.content_type === 'application/json'
    ? jsonDoc(body)
    : body) + SHIM;
  if (history.value[history.value.length - 1] !== next) history.value.push(next);
}

function back() {
  history.value.pop();
  const previous = history.value[history.value.length - 1];
  if (previous) { history.value.pop(); go(previous); }
}

function jsonDoc(body: string): string {
  const escaped = body.replace(/&/g, '&amp;').replace(/</g, '&lt;');
  return `<!doctype html><html><head><meta charset="utf-8"><style>
body{font:13px/1.55 ui-monospace,Menlo,Consolas,monospace;background:#0f1420;
color:#d7e0ee;margin:0;padding:18px}pre{margin:0;white-space:pre-wrap}
.h{color:#7dd3fc;font:12px system-ui;margin:0 0 10px;opacity:.8}
</style></head><body><p class="h">application/json</p><pre>${escaped}</pre></body></html>`;
}

function errorDoc(message: string): string {
  const escaped = String(message).replace(/&/g, '&amp;').replace(/</g, '&lt;');
  return `<!doctype html><html><body style="font:14px system-ui;padding:24px;
color:#7f1d1d;background:#fee2e2"><b>Preview unavailable</b>
<p>${escaped}</p></body></html>`;
}

function onMessage(event: MessageEvent) {
  const data: any = event.data;
  if (!data || data.sfsPreview !== 1 || typeof data.go !== 'string') return;
  go(data.go, data.method || 'GET', data.data);
}

window.addEventListener('message', onMessage);

watch(() => props.running, (isRunning, was) => {
  if (isRunning && !was && !srcdoc.value) go('/');
});

defineExpose({ reload: () => go(path.value) });
go('/');
</script>

<style scoped>
.sl-prev { display: flex; flex-direction: column; height: 100%; min-height: 0; }
.sl-prev__bar {
  display: flex; align-items: center; gap: 6px; padding: 7px 8px;
  border-bottom: 1px solid rgb(var(--sfs-line-rgb) / 0.16);
  background: rgb(var(--sfs-tint-rgb) / 0.05); flex: 0 0 auto;
}
.sl-prev__nav {
  width: 28px; height: 28px; display: inline-flex; align-items: center;
  justify-content: center; border-radius: 7px; border: 0; cursor: pointer;
  background: rgb(var(--sfs-tint-rgb) / 0.1); color: var(--sfs-text);
}
.sl-prev__nav:disabled { opacity: 0.4; cursor: default; }
.sl-prev__url {
  flex: 1; display: flex; align-items: center; gap: 0; min-width: 0;
  background: rgb(var(--sfs-sink-rgb) / 0.16); border-radius: 8px;
  padding: 0 10px; height: 30px;
  /* A URL is a machine identifier: rendered RTL the bidi algorithm relocates
     the slashes and the student reads a path that does not exist. */
  direction: ltr; unicode-bidi: isolate;
}
.sl-prev__host { font-size: 0.74rem; color: var(--sfs-text-muted); flex: 0 0 auto; }
.sl-prev__input {
  flex: 1; min-width: 0; border: 0; background: transparent; outline: none;
  color: var(--sfs-text); font: 0.8rem ui-monospace, Consolas, monospace;
  padding: 0 4px;
}
.sl-prev__status {
  font: 600 0.72rem ui-monospace, Consolas, monospace; padding: 3px 8px;
  border-radius: 999px; flex: 0 0 auto;
}
.sl-prev__status.is-ok { background: rgb(var(--sfs-success-rgb) / 0.22); color: var(--sfs-success-text); }
.sl-prev__status.is-info { background: rgb(var(--sfs-info-rgb) / 0.22); color: var(--sfs-info-text); }
.sl-prev__status.is-warn { background: rgb(var(--sfs-warning-rgb) / 0.22); color: var(--sfs-warning-text); }
.sl-prev__status.is-bad { background: rgb(var(--sfs-danger-rgb) / 0.22); color: var(--sfs-danger-text); }
.sl-prev__routes {
  display: flex; gap: 5px; padding: 6px 8px; overflow-x: auto; flex: 0 0 auto;
  border-bottom: 1px solid rgb(var(--sfs-line-rgb) / 0.12);
}
.sl-prev__route {
  border: 1px solid rgb(var(--sfs-line-rgb) / 0.22); background: transparent;
  color: var(--sfs-text-muted); border-radius: 999px; padding: 2px 10px;
  font: 0.72rem ui-monospace, Consolas, monospace; cursor: pointer;
  white-space: nowrap; direction: ltr;
}
.sl-prev__route.is-active {
  background: var(--sfs-accent); color: var(--sfs-on-accent); border-color: transparent;
}
.sl-prev__stage { position: relative; flex: 1 1 auto; min-height: 0; background: #fff; }
.sl-prev__frame { width: 100%; height: 100%; border: 0; display: block; background: #fff; }
.sl-prev__idle {
  position: absolute; inset: 0; display: flex; flex-direction: column;
  align-items: center; justify-content: center; gap: 8px; text-align: center;
  color: var(--sfs-text-muted); background: var(--sfs-paper);
}
.sl-prev__idle code {
  background: rgb(var(--sfs-sink-rgb) / 0.14); padding: 4px 10px;
  border-radius: 6px; font-size: 0.8rem; direction: ltr;
}
.sl-prev__sql {
  flex: 0 0 auto; max-height: 32%; overflow: auto; font-size: 0.75rem;
  border-top: 1px solid rgb(var(--sfs-line-rgb) / 0.16);
  background: rgb(var(--sfs-tint-rgb) / 0.04); padding: 6px 10px;
}
.sl-prev__sql summary { cursor: pointer; color: var(--sfs-text-muted); }
.sl-prev__sql ol { margin: 6px 0 0; padding-inline-start: 20px; }
.sl-prev__sql code {
  font-family: ui-monospace, Consolas, monospace; direction: ltr;
  unicode-bidi: isolate; word-break: break-all;
}
</style>
