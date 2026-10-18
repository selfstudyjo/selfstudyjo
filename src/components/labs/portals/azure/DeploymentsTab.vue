<template>
  <div>
    <div class="az-cmdbar">
      <button type="button" class="az-cmd" @click="openDeploy"><AzIcon name="plus" /> Deploy a custom template</button>
      <button type="button" class="az-cmd" @click="az.refresh()"><AzIcon name="refresh" /> Refresh</button>
    </div>
    <div class="az-count">{{ list.length }} deployment(s)</div>
    <AzTable :columns="cols" :rows="list" row-key="key">
      <template #cell-name="{ row }"><span class="az-namecell"><AzIcon name="deploy" /> {{ row.name }}</span></template>
      <template #cell-status="{ row }"><span class="az-status"><AzIcon name="ok" :size="14" /> {{ row.status }}</span></template>
      <template #empty>No deployments. Deploy a template (ARM JSON or Bicep) from the lab's files to see its history here.</template>
    </AzTable>

    <template v-if="whatifs.length">
      <h3 class="az-section-title">What-if results</h3>
      <div v-for="(w, i) in whatifs" :key="i" class="az-card" style="margin-bottom: 10px">
        <div><b>{{ w.file }}</b> <span class="az-muted">· {{ w.scope }} {{ w.group ? '· ' + w.group : '' }} · {{ fmtDate(w.at) }}</span></div>
        <div v-for="(c, j) in w.changes" :key="j" class="az-wi" :class="'is-' + String(c.change).toLowerCase()">
          <span class="az-wi__sym">{{ SYM[c.change] || '~' }}</span>
          <span><b>{{ c.change }}</b> {{ c.type }}/<b>{{ c.name }}</b> <span class="az-muted">{{ c.detail }}</span></span>
        </div>
        <div v-if="!w.changes.length" class="az-muted">No change.</div>
      </div>
    </template>

    <AzPane v-if="deploying" title="Custom deployment" subtitle="Deploy from a custom template" :error="error"
            @close="deploying = false">
      <div class="az-tabs"><button type="button" class="az-tab is-active">Basics</button>
        <button type="button" class="az-tab" disabled>Review + create</button></div>
      <h3 class="az-group-title">Template</h3>
      <div class="az-field"><div class="az-field__label">Template file <span class="az-req">*</span></div>
        <div class="az-field__ctl">
          <select v-model="form.file" class="az-select">
            <option value="">Select a file from the lab workspace</option>
            <option v-for="f in templates" :key="f" :value="f">{{ f }}</option>
          </select>
          <div class="az-help">Write templates (Bicep or ARM JSON) with the Files tool or <code>nano</code> in the console.</div>
        </div></div>
      <h3 class="az-group-title">Project details</h3>
      <div class="az-field"><div class="az-field__label">Deployment scope</div>
        <div class="az-radios">
          <label class="az-radio"><input v-model="form.scope" type="radio" value="group" /> Resource group</label>
          <label class="az-radio"><input v-model="form.scope" type="radio" value="sub" /> Subscription</label>
        </div></div>
      <div v-if="form.scope === 'group'" class="az-field"><div class="az-field__label">Resource group <span class="az-req">*</span></div>
        <div class="az-field__ctl"><select v-model="form.group" class="az-select">
          <option v-for="g in groups" :key="g" :value="g">{{ g }}</option></select></div></div>
      <div v-else class="az-field"><div class="az-field__label">Region <span class="az-req">*</span></div>
        <div class="az-field__ctl"><select v-model="form.location" class="az-select">
          <option v-for="l in locations" :key="l" :value="l">{{ locName(l) }}</option></select></div></div>
      <div class="az-field"><div class="az-field__label">Deployment name</div>
        <div class="az-field__ctl"><input v-model="form.name" class="az-input" placeholder="(optional)" /></div></div>
      <div class="az-field"><div class="az-field__label">Parameters</div>
        <div class="az-field__ctl"><textarea v-model="form.params" class="az-textarea" placeholder="name=value, one per line"></textarea>
          <div class="az-help">Sent as <code>--parameters name=value ...</code></div></div></div>
      <div class="az-field"><div class="az-field__label">Deployment mode</div>
        <div class="az-radios">
          <label class="az-radio"><input v-model="form.mode" type="radio" value="Incremental" /> Incremental</label>
          <label class="az-radio"><input v-model="form.mode" type="radio" value="Complete" /> Complete</label>
        </div></div>
      <div v-if="form.mode === 'Complete'" class="az-banner is-warning"><AzIcon name="warning" />
        <span>Complete mode deletes resources in the resource group that are not in the template.</span></div>
      <pre v-if="output" class="az-code">{{ output }}</pre>
      <template #foot>
        <button type="button" class="az-btn az-btn--primary" :disabled="!ready" @click="deploy('create')">Review + create</button>
        <button type="button" class="az-btn" :disabled="!ready" @click="deploy('what-if')">What-if</button>
        <button type="button" class="az-btn" :disabled="!ready" @click="deploy('validate')">Validate</button>
        <button type="button" class="az-btn" @click="deploying = false">Cancel</button>
      </template>
    </AzPane>
  </div>
</template>

<script setup lang="ts">
/** Deployments history for a resource group (or the subscription), and "Deploy a custom template". */
import { computed, reactive, ref } from 'vue';
import { cli, errorText, rows } from '@/utils/portalKit';
import AzIcon from './AzIcon';
import AzPane from './AzPane.vue';
import AzTable from './AzTable.vue';
import { fmtDate, locName, useAz } from './azure';

const props = defineProps<{ group?: string }>();
const az = useAz();
const SYM: Record<string, string> = { Create: '+', Delete: '-', Modify: '~', NoChange: '=', Ignore: '*' };

const list = computed(() => rows(az.p.value, 'deployments')
  .filter(d => !props.group || d.group === props.group)
  .map((d, i) => ({ key: `${d.name}-${i}`, name: d.name, status: d.state || 'Succeeded',
                    when: fmtDate(d.at || d.created), template: d.template || '', scope: d.scope || d.group || '' }))
  .reverse());
const cols = [{ key: 'name', label: 'Deployment name' }, { key: 'status', label: 'Status' },
              { key: 'when', label: 'Last modified' }, { key: 'template', label: 'Template' }];
const whatifs = computed(() => rows(az.p.value, 'whatifs')
  .filter(w => !props.group || !w.group || w.group === props.group).slice().reverse());

const templates = computed(() => ((az.p.value.files || []) as string[]).map(String)
  .filter(f => /\.(bicep|json)$/i.test(f)));
const groups = computed(() => rows(az.p.value, 'groups').map(g => String(g.name)));
const locations = computed<string[]>(() => az.p.value.catalogue?.locations || []);

const deploying = ref(false);
const error = ref('');
const output = ref('');
const form = reactive({ file: '', scope: 'group', group: '', location: 'uaenorth', name: '', params: '', mode: 'Incremental' });
function openDeploy() {
  Object.assign(form, { file: templates.value[0] || '', scope: 'group', group: props.group || groups.value[0] || '',
                        location: 'uaenorth', name: '', params: '', mode: 'Incremental' });
  error.value = '';
  output.value = '';
  deploying.value = true;
}
const ready = computed(() => Boolean(form.file) && (form.scope === 'sub' || Boolean(form.group)));

async function deploy(verb: 'create' | 'what-if' | 'validate') {
  error.value = '';
  output.value = '';
  const params = form.params.split(/\n|,/).map(x => x.trim()).filter(x => x.includes('='));
  const base = form.scope === 'group' ? ['az', 'deployment', 'group', verb] : ['az', 'deployment', 'sub', verb];
  const flags: Record<string, any> = form.scope === 'group' ? { '-g': form.group } : { '-l': form.location };
  if (verb !== 'validate' && form.name) flags['--name'] = form.name;
  flags['--template-file'] = form.file;
  flags['--parameters'] = params;
  if (form.mode === 'Complete' && form.scope === 'group') flags['--mode'] = 'Complete';
  const result = await az.run(cli(base, flags),
                              verb === 'create' ? `Deployment succeeded: ${form.file}` : '',
                              { quiet: true });
  if (!result.ok) { error.value = errorText(result); output.value = String(result.error || '').trim(); return; }
  output.value = String(result.output || '').trim();
  if (verb === 'create') az.note('success', 'Deployment succeeded', `${form.file} was deployed.`);
}
</script>

<style scoped>
.az-wi { display: flex; gap: 8px; padding: 3px 0; font-family: Consolas, monospace; font-size: 12px; }
.az-wi__sym { width: 14px; font-weight: 700; }
.az-wi.is-create .az-wi__sym { color: #107c10; }
.az-wi.is-delete .az-wi__sym { color: #c50f1f; }
.az-wi.is-modify .az-wi__sym { color: #8a5d00; }
</style>
