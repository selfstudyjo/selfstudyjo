<template>
  <div class="jk-nd">
    <!-- ===== Nodes ===== -->
    <template v-if="r.page === 'nodes'">
      <div class="jk-app-bar">
        <h1 class="jk-h1">Nodes</h1>
        <div class="jk-nd__bar">
          <button type="button" class="jk-btn" @click="ctx.notify('info', 'Node monitors refreshed')"><JkIcon name="reload" />Refresh status</button>
          <button type="button" class="jk-btn jk-btn--primary" @click="ctx.go({ page: 'nodeNew' })"><JkIcon name="plus" />New Node</button>
        </div>
      </div>
      <div class="jk-table-wrap">
        <table class="jk-table">
          <thead><tr><th class="is-center">S</th><th>Name ↑</th><th>Architecture</th><th>Clock Difference</th><th>Free Temp Space</th><th>Free Disk Space</th><th>Free Swap Space</th><th>Response Time</th><th></th></tr></thead>
          <tbody>
            <tr v-for="node in ctx.nodes.value" :key="node.name">
              <td class="is-center"><JkIcon name="computer" :class="node.online ? 'jk-nd__on' : 'jk-nd__off'" /></td>
              <td>
                <button type="button" class="jk-link jk-nd__name" @click="ctx.go({ page: 'node', node: node.name })">{{ label(node.name) }}</button>
                <span v-if="!node.online" class="jk-nd__offline">offline</span>
              </td>
              <td>{{ node.os }} (amd64)</td>
              <td>{{ node.online ? 'In sync' : 'N/A' }}</td>
              <td>{{ node.online ? '9.40 GiB' : 'N/A' }}</td>
              <td>{{ node.online ? '41.27 GiB' : 'N/A' }}</td>
              <td>{{ node.online ? '2.00 GiB' : 'N/A' }}</td>
              <td>{{ node.online ? (node.name === 'built-in' ? '0ms' : '43ms') : 'N/A' }}</td>
              <td class="is-center">
                <button type="button" class="jk-nd__icon-btn" :aria-label="'Configure ' + node.name" @click="ctx.go({ page: 'node', node: node.name })"><JkIcon name="gear" /></button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </template>

    <!-- ===== One node ===== -->
    <template v-else-if="r.page === 'node'">
      <template v-if="node">
        <div class="jk-app-bar">
          <h1 class="jk-h1"><JkIcon name="computer" class="jk-nd__h1-icon" />{{ label(node.name) }}</h1>
          <div class="jk-nd__bar">
            <button type="button" class="jk-btn" :class="{ 'jk-btn--primary': editing }" @click="startEdit"><JkIcon name="gear" />Configure</button>
            <button v-if="node.online" type="button" class="jk-btn" @click="setOnline(false)">Mark this node temporarily offline</button>
            <button v-else type="button" class="jk-btn jk-btn--primary" @click="setOnline(true)">Bring this node back online</button>
            <button v-if="node.name !== 'built-in'" type="button" class="jk-btn jk-btn--text-danger" @click="remove"><JkIcon name="trash" />Delete Agent</button>
          </div>
        </div>
        <div v-if="!node.online" class="jk-alert jk-alert--warning">Disconnected by {{ ctx.user.value }}. A pipeline whose agent needs only this node's labels now fails with “no node matches the label”.</div>
        <p>{{ node.name === 'built-in' ? 'The Jenkins controller\'s built-in node.' : 'Permanent agent.' }}</p>
        <form v-if="editing" class="jk-card jk-nd__edit" @submit.prevent="saveEdit">
          <div class="jk-field">
            <label class="jk-label" for="jk-nd-edit-exec">Number of executors</label>
            <input id="jk-nd-edit-exec" v-model.number="editExec" class="jk-input jk-nd__num" type="number" :min="node.name === 'built-in' ? 0 : 1" />
            <p v-if="!editExecOk" class="jk-error">Number of executors must be {{ node.name === 'built-in' ? '0' : '1' }} or more</p>
          </div>
          <div class="jk-field">
            <label class="jk-label" for="jk-nd-edit-labels">Labels</label>
            <input id="jk-nd-edit-labels" v-model="editLabels" class="jk-input" type="text" />
            <p class="jk-help">Separate labels with spaces. A pipeline's <code>agent { label '…' }</code> is matched against these.</p>
          </div>
          <div class="jk-bottom-bar">
            <button type="submit" class="jk-btn jk-btn--primary" :disabled="busy || !editExecOk">Save</button>
            <button type="button" class="jk-btn" @click="editing = false">Cancel</button>
          </div>
        </form>
        <h2 class="jk-h2">Labels</h2>
        <div class="jk-nd__labels"><span v-for="l in node.labels" :key="l" class="jk-nd__label">{{ l }}</span></div>
        <h2 class="jk-h2">Executors</h2>
        <p>{{ node.executors }} executor{{ node.executors === 1 ? '' : 's' }}{{ node.executors ? ', all idle' : '' }}.</p>
        <h2 class="jk-h2">Projects tied to {{ label(node.name) }}</h2>
        <p class="jk-muted">None</p>
      </template>
      <div v-else class="jk-empty">No such node.</div>
    </template>

    <!-- ===== New node ===== -->
    <form v-else class="jk-nd__form" @submit.prevent="create">
      <h1 class="jk-h1">New node</h1>
      <div class="jk-field">
        <label class="jk-label" for="jk-nd-name">Node name</label>
        <input id="jk-nd-name" v-model="name" class="jk-input" type="text" autocomplete="off" />
        <p v-if="tried && nameProblem" class="jk-error">{{ nameProblem }}</p>
      </div>
      <div class="jk-field">
        <label class="jk-label">Type</label>
        <label class="jk-check"><input type="radio" checked /> <span><strong>Permanent Agent</strong><br /><span class="jk-muted">Adds a plain, permanent agent to Jenkins. This is called "permanent" because Jenkins doesn't provide higher level of integration with these agents, such as dynamic provisioning.</span></span></label>
      </div>
      <div class="jk-field">
        <label class="jk-label" for="jk-nd-desc">Description</label>
        <input id="jk-nd-desc" class="jk-input" type="text" />
      </div>
      <div class="jk-field">
        <label class="jk-label" for="jk-nd-exec">Number of executors</label>
        <input id="jk-nd-exec" v-model.number="executors" class="jk-input jk-nd__num" type="number" min="1" />
        <p v-if="tried && !(executors >= 1)" class="jk-error">Number of executors must be greater than zero</p>
      </div>
      <div class="jk-field">
        <label class="jk-label">Remote root directory</label>
        <input class="jk-input" type="text" value="/home/jenkins/agent" readonly />
      </div>
      <div class="jk-field">
        <label class="jk-label" for="jk-nd-labels">Labels</label>
        <input id="jk-nd-labels" v-model="labels" class="jk-input" type="text" placeholder="linux docker" />
        <p class="jk-help">Labels (also known as tags) are used to group multiple agents into one logical group. Separate them with spaces.</p>
      </div>
      <div class="jk-field">
        <label class="jk-label">Usage</label>
        <select class="jk-select" disabled><option>Use this node as much as possible</option></select>
      </div>
      <div class="jk-field">
        <label class="jk-label">Launch method</label>
        <select class="jk-select" disabled><option>Launch agent by connecting it to the controller</option></select>
      </div>
      <div class="jk-bottom-bar">
        <button type="submit" class="jk-btn jk-btn--primary" :disabled="busy">Create</button>
        <button type="button" class="jk-btn" @click="ctx.go({ page: 'nodes' })">Cancel</button>
      </div>
    </form>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import JkIcon from './JkIcon.vue';
import { useJk } from './jkContext';
import { jcli, JOB_NAME } from './jenkinsKit';

const ctx = useJk();
const r = computed(() => ctx.route.value as any);
const node = computed(() => ctx.nodes.value.find(n => n.name === r.value.node));
const name = ref('');
const executors = ref(1);
const labels = ref('');
const tried = ref(false);
const busy = ref(false);

function label(n: string) { return n === 'built-in' ? 'Built-In Node' : n; }

const nameProblem = computed(() => {
  const text = name.value.trim();
  if (!text) return 'Name is mandatory';
  if (!JOB_NAME.test(text)) return `‘${text}’ is not a valid node name`;
  if (ctx.nodes.value.some(n => n.name === text)) return `Agent called ‘${text}’ already exists`;
  return '';
});

async function create() {
  tried.value = true;
  if (nameProblem.value || !(executors.value >= 1)) return;
  busy.value = true;
  try {
    const result = await ctx.run(jcli(['create-node', name.value.trim()], {
      '--executors': String(executors.value), '--labels': labels.value.trim(),
    }), { success: `Created agent ‘${name.value.trim()}’` });
    if (result.ok) ctx.go({ page: 'node', node: name.value.trim() });
  } finally {
    busy.value = false;
  }
}

// ---- Configure (update-node) ----
const editing = ref(false);
const editExec = ref(1);
const editLabels = ref('');
const editExecOk = computed(() => Number.isInteger(editExec.value) && editExec.value >= (node.value?.name === 'built-in' ? 0 : 1));

function startEdit() {
  if (!node.value) return;
  editExec.value = Number(node.value.executors);
  editLabels.value = node.value.labels.join(' ');
  editing.value = !editing.value;
}

async function saveEdit() {
  if (!node.value || !editExecOk.value) return;
  const n = node.value.name;
  const words = ['update-node', n];
  const flags: Record<string, string> = {};
  if (editExec.value !== Number(node.value.executors)) flags['--executors'] = String(editExec.value);
  const nextLabels = editLabels.value.trim().split(/\s+/).filter(Boolean).join(' ');
  if (nextLabels !== node.value.labels.join(' ')) words.push('--labels', nextLabels);
  if (words.length === 2 && !Object.keys(flags).length) { editing.value = false; return; }
  busy.value = true;
  try {
    const result = await ctx.run(jcli(words, flags), { success: `Saved ${label(n)}` });
    if (result.ok) editing.value = false;
  } finally {
    busy.value = false;
  }
}

async function setOnline(online: boolean) {
  if (!node.value) return;
  await ctx.run(jcli([online ? 'online-node' : 'offline-node', node.value.name]),
                { success: online ? `${label(node.value.name)} is back online` : `${label(node.value.name)} is offline` });
}

async function remove() {
  if (!node.value) return;
  const n = node.value.name;
  const ok = await ctx.confirm({ title: `Delete the agent ‘${n}’?`, message: 'Pipelines that ask for its labels will no longer find a node.', yes: 'Yes', destructive: true });
  if (!ok) return;
  const result = await ctx.run(jcli(['delete-node', n]), { success: `Deleted agent ‘${n}’` });
  if (result.ok) ctx.go({ page: 'nodes' });
}
</script>

<style scoped>
.jk-nd { max-width: 1312px; }
.jk-nd__bar { display: flex; gap: 8px; flex-wrap: wrap; }
.jk-nd__h1-icon { width: 25.6px; height: 25.6px; }
.jk-nd__on { color: var(--jk-text); }
.jk-nd__off { color: var(--jk-secondary); opacity: 0.6; }
.jk-nd__name { font-weight: 600; }
.jk-nd__offline { margin-left: 7.2px; padding: 0 6.4px; border-radius: 5.6px; background: rgba(227, 23, 45, 0.1); color: var(--jk-red); font-size: 12px; font-weight: 600; }
.jk-nd__icon-btn { display: inline-flex; padding: 4.8px; border: 0; border-radius: 8px; background: none; cursor: pointer; color: var(--jk-text); }
.jk-nd__icon-btn:hover { background: var(--jk-btn-hover); }
.jk-nd__icon-btn .jk-icon { width: 16px; height: 16px; }
.jk-nd__labels { display: flex; flex-wrap: wrap; gap: 5.6px; }
.jk-nd__label { padding: 1.6px 9.6px; border-radius: 8px; background: var(--jk-btn-bg); font-weight: 600; font-size: 13px; }
.jk-nd__form { max-width: 704px; }
.jk-nd__num { max-width: 128px; }
.jk-nd__edit { max-width: 640px; margin: 12px 0 8px; }
</style>
