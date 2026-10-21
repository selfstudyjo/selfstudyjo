<template>
  <div class="jk-ws">
    <div class="jk-app-bar">
      <h1 class="jk-h1"><JkIcon name="folder" class="jk-ws__h1-icon" />Workspace of {{ r.job }} on {{ nodeLabel }}</h1>
      <div class="jk-ws__bar">
        <button type="button" class="jk-btn" :disabled="loading" @click="load"><JkIcon name="reload" />Refresh</button>
        <button type="button" class="jk-btn jk-btn--text-danger" :disabled="!files.length" @click="wipe"><JkIcon name="trash" />Wipe Out Current Workspace</button>
      </div>
    </div>

    <p v-if="error" class="jk-alert jk-alert--warning">{{ error }}</p>

    <!-- one file -->
    <template v-else-if="r.path">
      <div class="jk-ws__path">
        <button type="button" class="jk-link" @click="ctx.go({ page: 'workspace', job: r.job })">{{ r.job }}</button>
        <template v-for="(part, index) in pathParts" :key="index"> / <span>{{ part }}</span></template>
        <span class="jk-ws__meta">{{ content.length }} B</span>
        <button type="button" class="jk-btn jk-ws__copy" :disabled="content === ''" @click="copy"><JkIcon name="copy" />Copy</button>
      </div>
      <pre class="jk-ws__file">{{ loading ? 'Loading…' : content }}</pre>
    </template>

    <!-- the directory listing -->
    <template v-else>
      <p v-if="!loading && !files.length" class="jk-empty">
        Error: no workspace
        <span class="jk-muted jk-ws__hint">The project either does not have a workspace yet or it was wiped out. Run a build to have Jenkins create one.</span>
        <button v-if="job && !job.disabled && job.type !== 'folder'" type="button" class="jk-btn jk-btn--primary" @click="actions.buildNow(job.name)">Build Now</button>
      </p>
      <div v-else class="jk-table-wrap">
        <table class="jk-table">
          <thead><tr><th>Name</th><th class="is-right">Size</th><th class="is-right">view</th></tr></thead>
          <tbody>
            <tr v-for="row in tree" :key="row.path">
              <td :style="{ paddingLeft: 12 + row.depth * 18 + 'px' }">
                <template v-if="row.dir"><JkIcon name="folder" class="jk-ws__ic" />{{ row.name }}/</template>
                <button v-else type="button" class="jk-link" @click="ctx.go({ page: 'workspace', job: r.job, path: row.path })"><JkIcon name="doc" class="jk-ws__ic" />{{ row.name }}</button>
              </td>
              <td class="is-right jk-muted">{{ row.dir ? '' : size(row.size) }}</td>
              <td class="is-right"><button v-if="!row.dir" type="button" class="jk-link" @click="ctx.go({ page: 'workspace', job: r.job, path: row.path })">view</button></td>
            </tr>
          </tbody>
        </table>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';
import JkIcon from './JkIcon.vue';
import { useJk } from './jkContext';
import { useActions } from './jkActions';
import { jcli } from './jenkinsKit';

const ctx = useJk();
const actions = useActions(ctx);
const r = computed(() => ctx.route.value as any);
const job = computed(() => ctx.job(r.value.job));
const nodeLabel = computed(() => 'built-in');

const files = ref<{ path: string; size: number }[]>([]);
const content = ref('');
const error = ref('');
const loading = ref(false);
const pathParts = computed(() => String(r.value.path || '').split('/'));

async function load() {
  loading.value = true;
  error.value = '';
  try {
    if (r.value.path) {
      const result = await ctx.run(jcli(['workspace', r.value.job, r.value.path]), { quiet: true, unlogged: true, direct: true });
      if (!result.ok) { error.value = String(result.error || 'The file could not be read.'); return; }
      const data = result.data as { content?: string } | undefined;
      content.value = String(data?.content ?? result.output ?? '');
    } else {
      const result = await ctx.run(jcli(['workspace', r.value.job]), { quiet: true, unlogged: true, direct: true });
      if (!result.ok) { error.value = String(result.error || 'The workspace could not be read.'); return; }
      const data = result.data as { files?: { path: string; size: number }[] } | undefined;
      files.value = Array.isArray(data?.files) ? data!.files : [];
    }
  } finally {
    loading.value = false;
  }
}
onMounted(load);
// A new build changes the workspace.
watch(() => job.value?.next, () => { void load(); });

interface Row { path: string; name: string; depth: number; dir: boolean; size: number }

/** The flat file list as Jenkins' directory browser draws it: folders first. */
const tree = computed<Row[]>(() => {
  const out: Row[] = [];
  const seen = new Set<string>();
  const sorted = [...files.value].sort((a, b) => {
    const da = a.path.includes('/') ? 0 : 1;
    const db = b.path.includes('/') ? 0 : 1;
    return da - db || (a.path < b.path ? -1 : a.path > b.path ? 1 : 0);
  });
  for (const file of sorted) {
    const parts = file.path.split('/');
    for (let i = 0; i < parts.length - 1; i++) {
      const dir = parts.slice(0, i + 1).join('/');
      if (!seen.has(dir)) { seen.add(dir); out.push({ path: dir + '/', name: parts[i], depth: i, dir: true, size: 0 }); }
    }
    out.push({ path: file.path, name: parts[parts.length - 1], depth: parts.length - 1, dir: false, size: file.size });
  }
  return out;
});

function size(bytes: number): string {
  const n = Number(bytes) || 0;
  if (n < 1024) return `${n} B`;
  return `${(n / 1024).toFixed(2)} KiB`;
}

async function wipe() {
  if (await actions.wipeWorkspace(r.value.job)) {
    if (r.value.path) ctx.go({ page: 'workspace', job: r.value.job });
    else await load();
  }
}

async function copy() {
  try {
    await navigator.clipboard.writeText(content.value);
    ctx.notify('success', 'Copied to clipboard');
  } catch {
    ctx.notify('error', 'The browser refused the clipboard');
  }
}
</script>

<style scoped>
.jk-ws__bar { display: flex; gap: 8px; flex-wrap: wrap; }
.jk-ws__h1-icon { width: 28px; height: 28px; }
.jk-ws__ic { width: 16px; height: 16px; margin-right: 6px; vertical-align: -3px; }
.jk-ws__path { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; margin-bottom: 10px; font-family: var(--jk-mono); font-size: 13px; }
.jk-ws__meta { color: var(--jk-secondary); margin-left: 8px; }
.jk-ws__copy { margin-left: auto; }
.jk-ws__file {
  margin: 0; padding: 14px 16px; background: var(--jk-table-bg); border-radius: 10px; overflow: auto;
  max-height: 60vh; font-family: var(--jk-mono); font-size: 13px; line-height: 1.5; white-space: pre; tab-size: 4;
}
.jk-ws__hint { display: block; margin: 6px 0 12px; }
.is-right { text-align: right; }
@container sl-portal (max-width: 520px) {
  .jk-ws__copy { margin-left: 0; }
}
</style>
