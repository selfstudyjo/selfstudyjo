<template>
  <section class="dd-page">
    <div v-if="!build" class="dd-empty">
      <h2>This build record no longer exists</h2>
      <button type="button" class="dd-btn dd-btn--primary" @click="$emit('go', { page: 'builds' })">Back to Builds</button>
    </div>
    <template v-else>
      <div class="dd-detail-head">
        <button type="button" class="dd-icon-btn" aria-label="Back" title="Back" @click="$emit('go', { page: 'builds' })"><DdIcon name="back" :size="20" /></button>
        <DdIcon :name="ok ? 'check' : 'error'" :size="30" :class="ok ? 'bd-ok' : 'bd-bad'" />
        <div class="dd-detail-title">
          <h1>{{ build.name }}</h1>
          <div class="dd-detail-meta">
            <span :class="['dd-chip', ok ? 'dd-chip--green' : 'dd-chip--red']">{{ ok ? 'Completed' : 'Error' }}</span>
            <span class="dd-mono">{{ build.id }}</span>
            <span>{{ build.created }}</span>
            <span>{{ build.duration }}s</span>
          </div>
        </div>
        <button type="button" class="dd-btn dd-btn--danger-outline" @click="deleting = true"><DdIcon name="trash" :size="14" /> Delete</button>
      </div>

      <nav class="dd-tabs" aria-label="Build details">
        <button v-for="t in tabs" :key="t" type="button" class="dd-tab" :class="{ 'is-active': tab === t }" @click="setTab(t)">{{ label(t) }}</button>
      </nav>

      <div v-if="tab === 'info'" class="bd-info">
        <div class="dd-box bd-card">
          <h3>Build timing</h3>
          <div class="bd-bar"><span :style="{ width: cachedPct + '%' }" class="bd-bar__cached"></span><span :style="{ width: (100 - cachedPct) + '%' }" class="bd-bar__run"></span></div>
          <dl class="dd-kv">
            <dt>Real time</dt><dd>{{ build.duration }}s</dd>
            <dt>Build steps</dt><dd>{{ build.steps }}</dd>
            <dt>Cached steps</dt><dd>{{ build.cached }} ({{ cachedPct }}%)</dd>
          </dl>
        </div>
        <div class="dd-box bd-card">
          <h3>Configuration</h3>
          <dl class="dd-kv">
            <dt>Builder</dt><dd>desktop-linux</dd>
            <dt>Context</dt><dd class="dd-mono">{{ build.context }}</dd>
            <dt>Dockerfile</dt><dd class="dd-mono">{{ build.dockerfile }}</dd>
            <dt>Platform</dt><dd>linux/amd64</dd>
          </dl>
        </div>
        <div class="dd-box bd-card">
          <h3>Build results</h3>
          <dl v-if="build.image" class="dd-kv">
            <dt>Image</dt><dd><button type="button" class="dd-link" @click="$emit('go', { page: 'images', id: build.image })">{{ build.image }}</button></dd>
            <dt>Image ID</dt><dd class="dd-mono">sha256:{{ build.image_id }}</dd>
          </dl>
          <p v-else class="dd-muted">The build did not produce an image.</p>
        </div>
      </div>
      <div v-else-if="tab === 'source'">
        <pre class="dd-pre dd-box bd-src"><template v-for="(line, i) in sourceLines" :key="i"><span class="bd-ln">{{ i + 1 }}</span>{{ line }}
</template></pre>
      </div>
      <div v-else-if="tab === 'error'" class="bd-error">
        <DdIcon name="error" :size="20" />
        <pre class="dd-pre">{{ build.error }}</pre>
      </div>
      <div v-else-if="tab === 'logs'">
        <div class="dd-toolbar">
          <span class="dd-spacer"></span>
          <button type="button" class="dd-btn dd-btn--ghost" @click="copyText(build.log)"><DdIcon name="copy" :size="14" /> Copy</button>
        </div>
        <pre class="dd-pre dd-box bd-log">{{ build.log }}</pre>
      </div>
      <div v-else class="dd-table-wrap">
        <table class="dd-table">
          <thead><tr><th>Past builds of {{ build.dockerfile }}</th><th>Status</th><th>Duration</th><th>Created</th></tr></thead>
          <tbody>
            <tr v-for="b in history" :key="b.id">
              <td><button type="button" class="dd-link" @click="$emit('go', { page: 'builds', id: b.id })">{{ b.name }}</button></td>
              <td>{{ b.status === 'completed' ? 'Completed' : 'Error' }}</td>
              <td>{{ b.duration }}s</td>
              <td>{{ b.created }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </template>

    <DdModal v-if="deleting && build" title="Delete build record?" @close="deleting = false">
      <p>The build record and its logs are deleted from the build history. Images it produced are kept.</p>
      <template #footer>
        <button type="button" class="dd-btn dd-btn--ghost" @click="deleting = false">Cancel</button>
        <button type="button" class="dd-btn dd-btn--danger" :disabled="busy" @click="confirmDelete">Delete</button>
      </template>
    </DdModal>
  </section>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import type { PortalApi } from '../usePortal';
import DdIcon from './DdIcon.vue';
import DdModal from './DdModal.vue';
import { builds, cmd, copyText, type DdRoute } from './dd';

const props = defineProps<{ view: Record<string, any>; api: PortalApi; busy?: boolean; route: DdRoute }>();
const emit = defineEmits<{ (event: 'go', route: DdRoute): void; (event: 'refresh'): void }>();

const build = computed(() => builds(props.view).find(b => b.id === props.route.id));
const ok = computed(() => build.value?.status === 'completed');
const tabs = computed(() => ['info', ok.value ? 'source' : 'error', 'logs', 'history']);
const tab = computed(() => tabs.value.includes(props.route.tab || '') ? props.route.tab! : 'info');
const sourceLines = computed(() => String(build.value?.source || '').replace(/\n$/, '').split('\n'));
const cachedPct = computed(() => build.value?.steps ? Math.round(build.value.cached / build.value.steps * 100) : 0);
const history = computed(() => builds(props.view).filter(b => b.dockerfile === build.value?.dockerfile));
const deleting = ref(false);

function label(t: string) { return t[0].toUpperCase() + t.slice(1); }
function setTab(value: string) { emit('go', { page: 'builds', id: props.route.id, tab: value }); }
async function confirmDelete() {
  if (!build.value) return;
  const result = await props.api.exec(cmd.buildRm([build.value.id]), { success: 'Deleted build record' });
  if (result.ok) { deleting.value = false; emit('go', { page: 'builds' }); }
}
</script>

<style scoped src="./dd.css"></style>
<style scoped>
.dd-spacer { flex: 1; }
.bd-ok { color: var(--dd-green); }
.bd-bad { color: var(--dd-red); }
.bd-info { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 280px), 1fr)); gap: 14px; }
.bd-card { padding: 14px 16px; display: flex; flex-direction: column; gap: 12px; }
.bd-card h3 { margin: 0; font-size: 15px; font-weight: 500; }
.bd-bar { display: flex; height: 8px; border-radius: 4px; overflow: hidden; background: var(--dd-hover-strong); }
.bd-bar__cached { background: #9DB9F6; }
.bd-bar__run { background: var(--dd-blue); }
.bd-src, .bd-log { max-height: 460px; background: #FAFAFB; }
.bd-ln { display: inline-block; width: 2.5em; color: var(--dd-text-2); user-select: none; }
.bd-error { display: flex; gap: 10px; padding: 12px 14px; background: #FCE8EA; border: 1px solid #F3B9BF; border-radius: 6px; color: #8E1824; }
.bd-error pre { padding: 0; color: inherit; }
</style>
