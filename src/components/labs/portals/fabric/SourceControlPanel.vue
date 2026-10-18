<template>
  <FxPanel title="Source control" width="520px" @close="$emit('close')">
    <div v-if="error" class="fx-msgbar fx-msgbar--error"><FxIcon name="error" /><span>{{ error }}</span></div>
    <template v-if="!ws?.git">
      <p class="sc-p">This workspace isn't connected to Git. Connect it to a repository to track changes,
        commit, update and branch out.</p>
      <div class="fx-field">
        <span class="fx-field__label">Git provider</span>
        <select v-model="provider" class="fx-select" aria-label="Git provider">
          <option value="GitHub">GitHub</option><option value="AzureDevOps">Azure DevOps</option>
        </select>
      </div>
      <div class="fx-field">
        <label for="sc-repo">Repository<span class="fx-field__req">*</span></label>
        <input id="sc-repo" v-model="repo" class="fx-input" placeholder="org/repository" />
      </div>
      <div class="fx-field">
        <label for="sc-branch">Branch<span class="fx-field__req">*</span></label>
        <input id="sc-branch" v-model="branch" class="fx-input" />
      </div>
      <button type="button" class="fx-btn fx-btn--primary" :disabled="!repo.trim() || !branch.trim()" @click="connect">Connect and sync</button>
    </template>
    <template v-else>
      <div class="sc-branch"><FxIcon name="git" />{{ ws.git.repo }} · <b>{{ ws.git.branch }}</b></div>
      <div class="fx-tabs sc-tabs">
        <button type="button" class="fx-tab" :class="{ 'is-active': tab === 'changes' }" @click="tab = 'changes'">Changes ({{ changes.length }})</button>
        <button type="button" class="fx-tab" :class="{ 'is-active': tab === 'updates' }" @click="tab = 'updates'">Updates ({{ updates.length }})</button>
        <button type="button" class="fx-tab" :class="{ 'is-active': tab === 'branches' }" @click="tab = 'branches'">Branches</button>
      </div>
      <template v-if="tab === 'changes'">
        <ul class="sc-list">
          <li v-for="c in changes" :key="c.path"><span class="fx-pill" :class="c.change.startsWith('added') ? 'fx-pill--ok' : 'fx-pill--warn'">{{ c.change.startsWith('added') ? 'New' : 'Modified' }}</span>
            <span class="sc-path">{{ c.path }}</span></li>
          <li v-if="!changes.length" class="fx-muted">There are no uncommitted changes.</li>
        </ul>
        <div class="fx-field">
          <label for="sc-msg">Commit message<span class="fx-field__req">*</span></label>
          <textarea id="sc-msg" v-model="message" class="fx-textarea" placeholder="Enter a commit message" />
          <span class="fx-field__help">At least 8 characters - say why, not just what.</span>
        </div>
        <button type="button" class="fx-btn fx-btn--primary" :disabled="!changes.length || !message.trim()" @click="commit">Commit</button>
      </template>
      <template v-else-if="tab === 'updates'">
        <ul class="sc-list">
          <li v-for="u in updates" :key="u.path"><span class="fx-pill fx-pill--info">Incoming</span><span class="sc-path">{{ u.path }}</span></li>
          <li v-if="!updates.length" class="fx-muted">The workspace is up to date with {{ ws.git.branch }}.</li>
        </ul>
        <button type="button" class="fx-btn fx-btn--primary" @click="update">Update all</button>
      </template>
      <template v-else>
        <p class="sc-p">Branch out to a new workspace to work on changes in isolation.</p>
        <div class="fx-field">
          <label for="sc-nb">New branch name<span class="fx-field__req">*</span></label>
          <input id="sc-nb" v-model="newBranch" class="fx-input" placeholder="feature/my-change" />
        </div>
        <div class="fx-field">
          <label for="sc-nw">Workspace name<span class="fx-field__req">*</span></label>
          <input id="sc-nw" v-model="newWorkspace" class="fx-input" placeholder="ws-ops-feature" />
        </div>
        <button type="button" class="fx-btn fx-btn--primary" :disabled="!newBranch.trim() || !newWorkspace.trim()" @click="branchOut">Branch out</button>
        <h3 class="fx-h3">Branches in {{ ws.git.repo }}</h3>
        <ul class="sc-list"><li v-for="b in branches" :key="b">{{ b }}</li></ul>
      </template>
    </template>
  </FxPanel>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';
import FxPanel from './FxPanel.vue';
import FxIcon from './FxIcon.vue';
import { cli, errorText, gridsOf, rows, useFabric, wsPath } from './fabric';

const props = defineProps<{ ws: string }>();
defineEmits<{ (event: 'close'): void }>();
const { portal, api, run, go } = useFabric();
const ws = computed(() => rows(portal.value, 'workspaces').find(w => w.name === props.ws));
const tab = ref('changes');
const error = ref('');
const provider = ref('GitHub');
const repo = ref('');
const branch = ref('main');
const message = ref('');
const newBranch = ref('');
const newWorkspace = ref('');
const status = ref<{ change: string; path: string }[]>([]);
const changes = computed(() => status.value.filter(s => !s.change.startsWith('in branch')));
const updates = computed(() => status.value.filter(s => s.change.startsWith('in branch')));
const branches = computed(() => rows(portal.value, 'repos').find(r => r.name === ws.value?.git?.repo)?.branches || []);

async function refreshStatus() {
  if (!ws.value?.git) { status.value = []; return; }
  const result = await api.exec(cli(['fab', 'git', 'status', wsPath(props.ws)]), { quiet: true, unlogged: true });
  const grid = gridsOf(result)[0];
  status.value = grid ? grid.rows.map(r => ({ change: String(r[0]), path: String(r[1]) })) : [];
}
onMounted(refreshStatus);
watch(() => ws.value?.git?.branch, refreshStatus);

async function exec(command: string, success: string) {
  error.value = '';
  const result = await run(command, success, { quiet: true });
  if (!result.ok) error.value = errorText(result);
  await refreshStatus();
  return result.ok;
}

async function connect() {
  await exec(cli(['fab', 'git', 'connect', wsPath(props.ws)], { '--provider': provider.value,
    '--repo': repo.value.trim(), '--branch': branch.value.trim() }), `Connected to ${repo.value.trim()}`);
}
async function commit() {
  if (await exec(cli(['fab', 'git', 'commit', wsPath(props.ws)], { '-m': message.value.trim() }), 'Committed to Git')) {
    message.value = '';
  }
}
async function update() {
  await exec(cli(['fab', 'git', 'update', wsPath(props.ws)]), 'Workspace updated from Git');
}
async function branchOut() {
  const target = newWorkspace.value.trim();
  if (await exec(cli(['fab', 'git', 'branch-out', wsPath(props.ws)], { '--branch': newBranch.value.trim(),
    '--workspace': target }), `Branched out to ${target}`)) {
    go({ page: 'workspace', ws: target });
  }
}
</script>

<style scoped>
.sc-p { margin: 0 0 12px; color: #424242; }
.sc-branch { display: flex; align-items: center; gap: 6px; margin-bottom: 8px; font-size: 13px; }
.sc-tabs { padding: 0; margin-bottom: 12px; }
.sc-list { list-style: none; margin: 0 0 16px; padding: 0; display: flex; flex-direction: column; gap: 6px; font-size: 13px; }
.sc-list li { display: flex; gap: 8px; align-items: center; }
.sc-path { font-family: Consolas, monospace; word-break: break-all; }
</style>
