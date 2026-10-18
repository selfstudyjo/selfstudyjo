<template>
  <div class="fx-page dp">
    <!-- List of deployment pipelines -->
    <template v-if="!current">
      <div class="fx-page__head">
        <h1 class="fx-page__title">Deployment pipelines</h1>
        <span class="fx-cmdbar__grow" />
        <button type="button" class="fx-btn fx-btn--primary" @click="openCreate"><FxIcon name="plus" />New pipeline</button>
      </div>
      <div class="fx-page__scroll fx-tablewrap">
        <table class="fx-table">
          <thead><tr><th>Name</th><th>Stages</th><th>Deployments</th><th>Rules</th><th /></tr></thead>
          <tbody>
            <tr v-for="d in pipelines" :key="d.name">
              <td><span class="fx-cellname"><FxIcon name="deploy" :size="18" /><button type="button" @click="go({ page: 'deploy', dp: d.name })">{{ d.name }}</button></span></td>
              <td>{{ d.stages.map((s: any) => s.name).join(' → ') }}</td>
              <td>{{ d.history.length }}</td><td>{{ d.rules.length }}</td>
              <td><button type="button" class="fx-btn fx-btn--sm" @click="askDelete(d.name)">Delete</button></td>
            </tr>
          </tbody>
        </table>
        <div v-if="!pipelines.length" class="fx-empty"><FxIcon name="deploy" :size="44" />
          <h3>Create a deployment pipeline</h3>
          <p>Promote content between development, test and production workspaces, and keep each stage's settings with deployment rules.</p>
          <button type="button" class="fx-btn fx-btn--primary" @click="openCreate">Create pipeline</button></div>
      </div>
    </template>

    <!-- One pipeline -->
    <template v-else>
      <div class="fx-page__head">
        <button type="button" class="fx-link" @click="go({ page: 'deploy' })">Deployment pipelines</button>
        <FxIcon name="chevronRight" :size="12" />
        <h1 class="fx-page__title">{{ current.name }}</h1>
        <span class="fx-cmdbar__grow" />
        <button type="button" class="fx-btn" @click="rules = true"><FxIcon name="settings" />Deployment rules</button>
        <button type="button" class="fx-btn" @click="askDelete(current.name)"><FxIcon name="delete" />Delete pipeline</button>
      </div>
      <div v-if="error" class="fx-msgbar fx-msgbar--error dp-msg"><FxIcon name="error" /><span>{{ error }}</span></div>
      <div class="fx-page__scroll">
        <div class="dp-stages">
          <template v-for="(st, i) in (current.stages as any[])" :key="st.name">
            <div class="dp-stage" :class="{ 'is-assigned': st.workspace }">
              <div class="dp-stage__head">{{ st.name }}</div>
              <template v-if="st.workspace">
                <button type="button" class="fx-link dp-ws" @click="go({ page: 'workspace', ws: st.workspace })"><FxIcon name="Workspace" />{{ st.workspace }}</button>
                <div class="fx-muted dp-count">{{ itemCount(st.workspace) }} items</div>
                <button type="button" class="fx-btn fx-btn--sm" @click="unassign(st.name)">Unassign workspace</button>
              </template>
              <template v-else>
                <select :value="assignTo[st.name] || ''" class="fx-select" :aria-label="'Workspace for ' + st.name"
                        @change="assignTo[st.name] = ($event.target as HTMLSelectElement).value">
                  <option value="">Select a workspace</option>
                  <option v-for="w in freeWorkspaces" :key="w" :value="w">{{ w }}</option>
                </select>
                <button type="button" class="fx-btn fx-btn--primary fx-btn--sm" :disabled="!assignTo[st.name]" @click="assign(st.name)">Assign</button>
              </template>
            </div>
            <div v-if="i < current.stages.length - 1" class="dp-between">
              <button type="button" class="fx-btn fx-btn--sm" :disabled="!st.workspace || !current.stages[i + 1].workspace" @click="compare(st.name, current.stages[i + 1].name)">
                <FxIcon name="compare" />Compare</button>
              <button type="button" class="fx-btn fx-btn--primary fx-btn--sm" :disabled="!st.workspace || !current.stages[i + 1].workspace" @click="openDeploy(st.name, current.stages[i + 1].name)">
                Deploy →</button>
            </div>
          </template>
        </div>

        <div v-if="diff" class="dp-section">
          <h3 class="fx-h3">Compare {{ diff.from }} with {{ diff.to }}</h3>
          <p v-if="!diff.rows.length" class="fx-msgbar fx-msgbar--success"><FxIcon name="success" />The stages are identical.</p>
          <div v-else class="fx-tablewrap"><table class="fx-table"><thead><tr><th>Item</th><th>Change</th></tr></thead>
            <tbody><tr v-for="(r, i) in diff.rows" :key="i"><td>{{ r[1] }}</td>
              <td><span class="fx-pill" :class="r[0] === 'New' ? 'fx-pill--ok' : r[0] === 'Different' ? 'fx-pill--warn' : ''">{{ r[0] }}</span></td></tr></tbody></table></div>
        </div>

        <div class="dp-section">
          <h3 class="fx-h3">Deployment history</h3>
          <div class="fx-tablewrap"><table class="fx-table"><thead><tr><th>From</th><th>To</th><th>Items</th><th>Deployed by</th><th>Note</th><th>Warnings</th></tr></thead>
            <tbody>
              <tr v-for="(h, i) in [...current.history].reverse()" :key="i">
                <td>{{ h.from }}</td><td>{{ h.to }}</td><td>{{ h.items }}</td><td>{{ h.by }}</td><td>{{ h.note || '—' }}</td>
                <td>{{ (h.warnings || []).length || '—' }}</td></tr>
              <tr v-if="!current.history.length"><td colspan="6" class="fx-muted">Nothing has been deployed yet.</td></tr>
            </tbody></table></div>
        </div>
      </div>
    </template>

    <FxModal v-if="creating" title="Create deployment pipeline" @close="creating = false">
      <div v-if="error" class="fx-msgbar fx-msgbar--error"><FxIcon name="error" /><span>{{ error }}</span></div>
      <div class="fx-field"><label for="dp-name">Pipeline name<span class="fx-field__req">*</span></label>
        <input id="dp-name" v-model="newName" class="fx-input" /></div>
      <div class="fx-field"><label for="dp-stages">Stages</label>
        <input id="dp-stages" v-model="newStages" class="fx-input" />
        <span class="fx-field__help">Between 2 and 10 stages, comma-separated.</span></div>
      <template #footer>
        <button type="button" class="fx-btn fx-btn--primary" :disabled="!newName.trim()" @click="create">Create</button>
        <button type="button" class="fx-btn" @click="creating = false">Cancel</button>
      </template>
    </FxModal>

    <FxModal v-if="deploying" :title="'Deploy to ' + deploying.to" width="560px" @close="deploying = null">
      <div v-if="error" class="fx-msgbar fx-msgbar--error"><FxIcon name="error" /><span>{{ error }}</span></div>
      <p class="dp-p">Content from <b>{{ deploying.from }}</b> is deployed to <b>{{ deploying.to }}</b>. Deployment rules for {{ deploying.to }} are applied.</p>
      <div class="fx-field"><span class="fx-field__label">Items</span>
        <label class="fx-check"><input v-model="deployAll" type="checkbox" />All items</label>
        <div v-if="!deployAll" class="dp-items">
          <label v-for="i in sourceItems" :key="i.name + i.type" class="fx-check"><input v-model="deployItems" type="checkbox" :value="i.name" /><FxIcon :name="i.type" />{{ i.name }}</label>
        </div></div>
      <div class="fx-field"><label for="dp-note">Add a note</label><input id="dp-note" v-model="note" class="fx-input" /></div>
      <template #footer>
        <button type="button" class="fx-btn fx-btn--primary" :disabled="!deployAll && !deployItems.length" @click="deploy">Deploy</button>
        <button type="button" class="fx-btn" @click="deploying = null">Cancel</button>
      </template>
    </FxModal>

    <FxPanel v-if="rules && current" title="Deployment rules" width="560px" @close="rules = false">
      <div v-if="error" class="fx-msgbar fx-msgbar--error"><FxIcon name="error" /><span>{{ error }}</span></div>
      <table class="fx-table"><thead><tr><th>Stage</th><th>Item</th><th>Rule</th><th>Value</th></tr></thead>
        <tbody><tr v-for="(r, i) in current.rules" :key="i"><td>{{ r.stage }}</td><td>{{ r.item }}</td><td>{{ r.kind }}</td><td>{{ r.value }}</td></tr>
          <tr v-if="!current.rules.length"><td colspan="4" class="fx-muted">No rules</td></tr></tbody></table>
      <h3 class="fx-h3">Add rule</h3>
      <div class="fx-field"><span class="fx-field__label">Stage</span>
        <select v-model="rule.stage" class="fx-select" aria-label="Stage"><option v-for="s in current.stages" :key="s.name" :value="s.name">{{ s.name }}</option></select></div>
      <div class="fx-field"><label for="dp-ritem">Item</label><input id="dp-ritem" v-model="rule.item" class="fx-input" placeholder="nb_load_bronze" list="dp-items" />
        <datalist id="dp-items"><option v-for="i in allItems" :key="i" :value="i" /></datalist></div>
      <div class="fx-field"><span class="fx-field__label">Rule type</span>
        <select v-model="rule.kind" class="fx-select" aria-label="Rule type">
          <option value="lakehouse">Default lakehouse (notebook)</option><option value="source">Data source (semantic model)</option>
          <option value="parameter">Parameter</option></select></div>
      <div class="fx-field"><label for="dp-rval">Value</label><input id="dp-rval" v-model="rule.value" class="fx-input" /></div>
      <template #footer>
        <button type="button" class="fx-btn fx-btn--primary" :disabled="!rule.item || !rule.value" @click="addRule">Save</button>
        <button type="button" class="fx-btn" @click="rules = false">Close</button>
      </template>
    </FxPanel>

    <FxModal v-if="deleting" :title="'Delete ' + deleting + '?'" @close="deleting = ''">
      <p class="dp-p">The pipeline is deleted. The workspaces assigned to its stages and their content are not.</p>
      <template #footer>
        <button type="button" class="fx-btn fx-btn--danger" @click="doDelete">Delete</button>
        <button type="button" class="fx-btn" @click="deleting = ''">Cancel</button>
      </template>
    </FxModal>
  </div>
</template>

<script setup lang="ts">
import { computed, reactive, ref } from 'vue';
import FxIcon from './FxIcon.vue';
import FxModal from './FxModal.vue';
import FxPanel from './FxPanel.vue';
import { cli, errorText, gridsOf, rows, useFabric, wsPath } from './fabric';

const { portal, route, go, run } = useFabric();
const pipelines = computed(() => rows(portal.value, 'deploy_pipelines'));
const current = computed<any>(() => pipelines.value.find(d => d.name === route.value.dp) || null);
const error = ref('');
const assignTo = reactive<Record<string, string>>({});
const diff = ref<{ from: string; to: string; rows: unknown[][] } | null>(null);
const usedWorkspaces = computed(() => new Set(pipelines.value.flatMap(d => d.stages.map((s: any) => s.workspace)).filter(Boolean)));
const freeWorkspaces = computed(() => rows(portal.value, 'workspaces').map(w => String(w.name)).filter(w => !usedWorkspaces.value.has(w)));
const allItems = computed(() => [...new Set(rows(portal.value, 'items').map(i => String(i.name)))]);
function itemCount(ws: string) { return rows(portal.value, 'items').filter(i => i.workspace === ws).length; }

async function exec(command: string, success: string) {
  error.value = '';
  const r = await run(command, success, { quiet: true });
  if (!r.ok) error.value = errorText(r);
  return r;
}

const creating = ref(false);
const newName = ref('');
const newStages = ref('Development, Test, Production');
function openCreate() { error.value = ''; newName.value = 'dp-service-ops'; creating.value = true; }
async function create() {
  const name = newName.value.trim();
  const stages = newStages.value.split(',').map(s => s.trim()).filter(Boolean).join(',');
  if ((await exec(cli(['fab', 'deploypipe', 'create', name], { '--stages': stages }), `Pipeline ${name} created`)).ok) {
    creating.value = false;
    go({ page: 'deploy', dp: name });
  }
}
async function assign(stage: string) {
  await exec(cli(['fab', 'deploypipe', 'assign', current.value.name], { '--stage': stage, '--workspace': wsPath(assignTo[stage]) }),
    `${assignTo[stage]} assigned to ${stage}`);
  assignTo[stage] = '';
}
async function unassign(stage: string) {
  await exec(cli(['fab', 'deploypipe', 'unassign', current.value.name], { '--stage': stage }), `Workspace unassigned from ${stage}`);
}
async function compare(from: string, to: string) {
  const r = await exec(cli(['fab', 'deploypipe', 'compare', current.value.name], { '--from': from, '--to': to }), '');
  if (r.ok) diff.value = { from, to, rows: gridsOf(r)[0]?.rows || [] };
}

const deploying = ref<{ from: string; to: string } | null>(null);
const deployAll = ref(true);
const deployItems = ref<string[]>([]);
const note = ref('');
const sourceItems = computed(() => {
  const st = current.value?.stages.find((s: any) => s.name === deploying.value?.from);
  return rows(portal.value, 'items').filter(i => i.workspace === st?.workspace);
});
function openDeploy(from: string, to: string) {
  error.value = ''; deployAll.value = true; deployItems.value = []; note.value = '';
  deploying.value = { from, to };
}
async function deploy() {
  if (!deploying.value) return;
  const { from, to } = deploying.value;
  const r = await exec(cli(['fab', 'deploypipe', 'deploy', current.value.name], { '--from': from, '--to': to,
    '--items': deployAll.value ? '' : deployItems.value.join(','), '--note': note.value.trim() }), `Deployed ${from} to ${to}`);
  if (r.ok) { deploying.value = null; diff.value = null; }
}

const rules = ref(false);
const rule = reactive({ stage: 'Production', item: '', kind: 'lakehouse', value: '' });
async function addRule() {
  if ((await exec(cli(['fab', 'deploypipe', 'rule', current.value.name], { '--stage': rule.stage, '--item': rule.item,
    '--kind': rule.kind, '--value': rule.value }), 'Deployment rule saved')).ok) { rule.item = ''; rule.value = ''; }
}

const deleting = ref('');
function askDelete(name: string) { deleting.value = name; }
async function doDelete() {
  if ((await exec(cli(['fab', 'deploypipe', 'rm', deleting.value]), `Pipeline ${deleting.value} deleted`)).ok) {
    deleting.value = '';
    go({ page: 'deploy' });
  }
}
</script>

<style scoped>
.dp-msg { margin: 0 20px 8px; }
.dp-stages { display: flex; align-items: stretch; gap: 0; padding: 12px 20px; overflow-x: auto; }
.dp-stage { width: 240px; flex: none; display: flex; flex-direction: column; gap: 10px; padding: 14px; border: 1px solid #e0e0e0; border-top: 4px solid #bdbdbd; border-radius: 8px; background: #fff; }
.dp-stage.is-assigned { border-top-color: #117865; }
.dp-stage__head { font-weight: 600; font-size: 16px; }
.dp-ws { display: inline-flex; align-items: center; gap: 6px; }
.dp-count { font-size: 12px; }
.dp-between { display: flex; flex-direction: column; justify-content: center; gap: 8px; padding: 0 12px; }
.dp-section { padding: 0 20px 16px; }
.dp-p { margin: 0 0 12px; }
.dp-items { max-height: 200px; overflow: auto; padding-left: 8px; }
@container sl-portal (max-width: 700px) {
  .dp-stages { flex-direction: column; }
  .dp-stage { width: auto; }
  .dp-between { flex-direction: row; padding: 10px 0; }
}
@container sl-portal (max-width: 600px) {
  .dp-stages { padding: 12px; }
  .dp-section { padding: 0 12px 16px; }
  .dp-msg { margin: 0 12px 8px; }
}
</style>
