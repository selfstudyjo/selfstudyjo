<template>
  <!-- ===== Marketplace: Create a resource ===== -->
  <div v-if="kind === 'marketplace'" class="az-blade">
    <div class="az-blade__head">
      <AzIcon name="marketplace" :size="28" />
      <div class="az-blade__titles"><h1 class="az-blade__title">Create a resource</h1>
        <div class="az-blade__sub">{{ presetGroup ? `In resource group ${presetGroup}` : 'Marketplace' }}</div></div>
    </div>
    <div class="az-filters"><input v-model="needle" class="az-filter" style="min-width: 320px"
                                   placeholder="Search services and marketplace" aria-label="Search services and marketplace" /></div>
    <section v-for="cat in market" :key="cat.category">
      <h2 class="az-section-title">{{ cat.category }}</h2>
      <div class="az-cards">
        <div v-for="item in cat.items" :key="item.kind" class="az-card az-mkt">
          <AzIcon :name="item.icon" :size="36" />
          <div class="az-mkt__body"><b>{{ item.label }}</b><div class="az-muted">Microsoft · Azure Service</div>
            <div class="az-mkt__blurb">{{ item.blurb }}</div>
            <button type="button" class="az-link" @click="az.go({ page: 'create', kind: item.kind, group: presetGroup })">Create</button></div>
        </div>
      </div>
    </section>
  </div>

  <!-- ===== A create wizard ===== -->
  <div v-else-if="spec" class="az-blade az-wiz">
    <div class="az-blade__head">
      <div class="az-blade__titles"><h1 class="az-blade__title">{{ spec.title }}</h1>
        <div v-if="kind !== 'group'" class="az-blade__sub">{{ m.singular }}</div></div>
      <button type="button" class="az-x az-blade__close" aria-label="Close" @click="az.back()"><AzIcon name="close" /></button>
    </div>
    <div class="az-tabs" role="tablist">
      <button v-for="(t, i) in allTabs" :key="t" type="button" role="tab" class="az-tab" :class="{ 'is-active': step === i }"
              @click="goStep(i)">{{ t }}<span v-if="tried && tabHasErrors(i)" class="az-dot-err"></span></button>
    </div>

    <div v-if="step < spec.tabs.length" class="az-form">
      <p v-if="spec.tabs[step].intro" class="az-intro">{{ spec.tabs[step].intro }}</p>
      <template v-for="f in visible(spec.tabs[step].fields)" :key="f.key">
        <div v-if="f.type === 'heading'">
          <h3 class="az-group-title">{{ f.label }}</h3>
          <p v-if="f.help" class="az-intro">{{ helpOf(f) }}</p>
        </div>
        <div v-else class="az-field">
          <label class="az-field__label" :for="'f-' + f.key">{{ f.label }}<span v-if="f.required" class="az-req"> *</span>
            <AzIcon v-if="f.help" name="info" :size="13" :title="helpOf(f)" class="az-info" /></label>
          <div class="az-field__ctl">
            <template v-if="f.type === 'group'">
              <select :id="'f-' + f.key" v-model="values.group" class="az-select" :class="{ 'is-bad': showErr(f) }"
                      @change="values.newGroup = false">
                <option value="">Select a resource group</option>
                <option v-if="values.newGroup" :value="values.group">(New) {{ values.group }}</option>
                <option v-for="g in groupNames" :key="g" :value="g">{{ g }}</option>
              </select>
              <button v-if="!creatingGroup" type="button" class="az-link az-field__sublink" @click="creatingGroup = true; newGroupName = ''">Create new</button>
              <div v-else class="az-newgroup">
                <div class="az-help">A resource group is a container that holds related resources for an Azure solution.</div>
                <input v-model="newGroupName" class="az-input" placeholder="Name" aria-label="New resource group name" />
                <div v-if="newGroupErr" class="az-err">{{ newGroupErr }}</div>
                <div style="display: flex; gap: 6px; margin-top: 6px">
                  <button type="button" class="az-btn az-btn--primary" :disabled="Boolean(newGroupErr) || !newGroupName" @click="useNewGroup">OK</button>
                  <button type="button" class="az-btn" @click="creatingGroup = false">Cancel</button>
                </div>
              </div>
            </template>
            <select v-else-if="f.type === 'select'" :id="'f-' + f.key" v-model="values[f.key]" class="az-select" :class="{ 'is-bad': showErr(f) }">
              <option v-if="!opts(f).length" value="" disabled>No items</option>
              <option v-for="o in opts(f)" :key="o.value" :value="o.value" :disabled="o.disabled">{{ o.label }}</option>
            </select>
            <div v-else-if="f.type === 'radio'" class="az-radios">
              <label v-for="o in opts(f)" :key="o.value" class="az-radio">
                <input v-model="values[f.key]" type="radio" :value="o.value" :disabled="o.disabled" /> {{ o.label }}</label>
            </div>
            <label v-else-if="f.type === 'check'" class="az-check"><input :id="'f-' + f.key" v-model="values[f.key]" type="checkbox" /></label>
            <textarea v-else-if="f.type === 'textarea'" :id="'f-' + f.key" v-model="values[f.key]" class="az-textarea"></textarea>
            <div v-else-if="f.type === 'info'" class="az-wiz__info">{{ f.key === 'location' ? locName(values[f.key]) : values[f.key] }}</div>
            <div v-else-if="f.type === 'subnets'" class="az-subnets">
              <div class="az-cmdbar">
                <button type="button" class="az-cmd" @click="values.subnets.push({ name: '', prefix: '' })"><AzIcon name="plus" /> Add a subnet</button>
              </div>
              <table class="az-table"><thead><tr><th>Subnets</th><th>IP address range</th><th>Size</th><th></th></tr></thead>
                <tbody><tr v-for="(s, i) in values.subnets" :key="i">
                  <td><input v-model="s.name" class="az-input" aria-label="Subnet name" /></td>
                  <td><input v-model="s.prefix" class="az-input" aria-label="Subnet range" placeholder="10.0.1.0/24" /></td>
                  <td class="az-muted">{{ size(s.prefix) }}</td>
                  <td><button type="button" class="az-x" aria-label="Delete subnet" @click="values.subnets.splice(i, 1)"><AzIcon name="trash" /></button></td>
                </tr></tbody></table>
            </div>
            <input v-else :id="'f-' + f.key" v-model="values[f.key]" class="az-input" :class="{ 'is-bad': showErr(f) }"
                   :type="f.type === 'password' ? 'password' : f.type === 'number' ? 'number' : 'text'" :placeholder="f.placeholder || ''" />
            <div v-if="showErr(f)" class="az-err"><AzIcon name="error" :size="12" /> {{ errorOf(f) }}</div>
            <div v-else-if="f.help && helpOf(f) && ['text', 'select'].includes(f.type)" class="az-help">{{ helpOf(f) }}</div>
          </div>
        </div>
      </template>
    </div>

    <!-- Tags -->
    <div v-else-if="allTabs[step] === 'Tags'" class="az-form">
      <AzTagEditor v-model="values.tags" />
      <div class="az-help">Note that if you create tags and then change resource settings on other tabs, your tags will be automatically updated.</div>
    </div>

    <!-- Review + create -->
    <div v-else class="az-form">
      <div v-if="!invalid.length" class="az-banner is-success"><AzIcon name="ok" /><span><b>Validation passed</b></span></div>
      <div v-else class="az-banner is-error"><AzIcon name="error" />
        <span><b>Validation failed.</b> Required information is missing or not valid. <span class="az-muted">({{ invalid.join(', ') }})</span></span></div>
      <template v-for="(t, i) in spec.tabs" :key="t.name">
        <h3 class="az-group-title">{{ t.name }}</h3>
        <template v-for="f in visible(t.fields)" :key="f.key">
          <div v-if="f.type !== 'heading' && !f.noReview" class="az-review">
            <span class="az-review__k">{{ f.label }}</span>
            <span class="az-review__v">{{ reviewValue(f) }}</span>
          </div>
        </template>
        <span v-if="!i" />
      </template>
      <template v-if="spec.tags">
        <h3 class="az-group-title">Tags</h3>
        <div v-if="!Object.keys(values.tags).length" class="az-muted">None</div>
        <div v-for="(val, key) in values.tags" :key="key" class="az-review"><span class="az-review__k">{{ key }}</span><span class="az-review__v">{{ val }}</span></div>
      </template>
    </div>

    <div class="az-wizfoot">
      <template v-if="step < allTabs.length - 1">
        <button type="button" class="az-btn az-btn--primary" @click="goStep(allTabs.length - 1)">Review + create</button>
        <button type="button" class="az-btn" :disabled="step === 0" @click="goStep(step - 1)">&lt; Previous</button>
        <button type="button" class="az-btn" @click="goStep(step + 1)">Next : {{ allTabs[step + 1] }} &gt;</button>
      </template>
      <template v-else>
        <button type="button" class="az-btn az-btn--primary" :disabled="invalid.length > 0" @click="create">Create</button>
        <button type="button" class="az-btn" @click="goStep(step - 1)">&lt; Previous</button>
        <button type="button" class="az-btn" :disabled="invalid.length > 0" @click="automation = true">Download a template for automation</button>
      </template>
    </div>

    <AzPane v-if="automation" title="Template" subtitle="The Azure CLI this deployment runs" @close="automation = false">
      <p class="az-intro">Run these commands in the Azure CLI console to create the same resources.</p>
      <pre v-for="(c, i) in commands" :key="i" class="az-code">{{ c }}</pre>
      <template #foot>
        <button type="button" class="az-btn" @click="copyAll">Copy</button>
        <button type="button" class="az-btn" @click="automation = false">Close</button>
      </template>
    </AzPane>
  </div>
  <div v-else class="az-blade"><div class="az-banner is-warning"><AzIcon name="warning" /><span>There is no create experience for this resource type in the lab.</span></div></div>
</template>

<script setup lang="ts">
/**
 * A create wizard (Basics … Tags, Review + create) for any spec in
 * createSpecs.ts, and the Marketplace's "Create a resource" page. Create hands
 * the generated `az` lines to the deployment blade, which runs them.
 */
import { computed, reactive, ref } from 'vue';
import { rows } from '@/utils/portalKit';
import AzIcon from './AzIcon';
import AzPane from './AzPane.vue';
import AzTagEditor from './AzTagEditor.vue';
import { deploymentName, locName, meta, useAz } from './azure';
import { MARKET, SPECS, type Field, type Opt, type SpecCtx } from './createSpecs';

const az = useAz();
const kind = computed(() => String(az.route.value.kind || 'marketplace'));
const presetGroup = computed(() => az.route.value.group || '');
const spec = computed(() => SPECS[kind.value] || null);
const m = computed(() => meta(kind.value));

const needle = ref('');
const market = computed(() => MARKET.map(cat => ({ ...cat, items: cat.items.filter(i =>
  !needle.value || i.label.toLowerCase().includes(needle.value.toLowerCase())) })).filter(cat => cat.items.length));

// ----- form state -----
const values = reactive<Record<string, any>>({ tags: {}, newGroup: false, group: '' });
const ctx = computed<SpecCtx>(() => ({ p: az.p.value, v: az.v.value, values }));
function initValues() {
  if (!spec.value) return;
  values.group = presetGroup.value || '';
  if (az.route.value.extra?.server) values.server = az.route.value.extra.server;
  for (const t of spec.value.tabs) {
    for (const f of t.fields) {
      if (f.key in values && f.key !== 'tags') continue;
      const def = typeof f.def === 'function' ? (f.def as (c: SpecCtx) => unknown)(ctx.value) : f.def;
      if (f.type === 'subnets') values[f.key] = JSON.parse(JSON.stringify(def || []));
      else if (def !== undefined) values[f.key] = def;
      else if (f.type === 'select') { const o = optsRaw(f); values[f.key] = o[0]?.value ?? ''; }
      else if (f.type !== 'heading' && f.type !== 'group') values[f.key] = '';
    }
  }
}
function optsRaw(f: Field): Opt[] {
  if (!f.options) return [];
  return typeof f.options === 'function' ? f.options(ctx.value) : f.options;
}
function opts(f: Field): Opt[] {
  const o = optsRaw(f);
  // keep a select pointing at a real option (e.g. subnet after the VNet changes)
  if (f.type === 'select' && o.length && !o.some(x => x.value === values[f.key])) {
    values[f.key] = o.find(x => !x.disabled)?.value ?? '';
  }
  return o;
}
initValues();

const allTabs = computed(() => (spec.value ? [...spec.value.tabs.map(t => t.name), ...(spec.value.tags ? ['Tags'] : []), 'Review + create'] : []));
const step = ref(0);
const tried = ref(false);
function goStep(i: number) {
  if (i < 0 || i >= allTabs.value.length) return;
  if (i === allTabs.value.length - 1) tried.value = true;
  step.value = i;
}
function visible(fields: Field[]) { return fields.filter(f => !f.show || f.show(ctx.value)); }
function helpOf(f: Field) { return typeof f.help === 'function' ? f.help(ctx.value) : f.help || ''; }

const groupNames = computed(() => rows(az.p.value, 'groups').map(g => String(g.name)));
const creatingGroup = ref(false);
const newGroupName = ref('');
const newGroupErr = computed(() => {
  const v = newGroupName.value;
  if (!v) return '';
  if (!/^[-\w.()]{1,90}$/.test(v) || v.endsWith('.')) return 'Resource group names only allow alphanumeric characters, periods, underscores, hyphens and parenthesis and cannot end in a period.';
  if (groupNames.value.some(g => g.toLowerCase() === v.toLowerCase())) return 'A resource group with this name already exists.';
  return '';
});
function useNewGroup() {
  values.group = newGroupName.value;
  values.newGroup = true;
  creatingGroup.value = false;
}

function errorOf(f: Field): string {
  if (f.type === 'heading' || f.type === 'info') return '';
  const value = values[f.key];
  if (f.type === 'group') return values.group ? '' : 'The value must not be empty.';
  if (f.required && (value === '' || value === undefined || value === null)) return 'The value must not be empty.';
  if (f.validate && value !== '' && value !== undefined) return f.validate(value, ctx.value);
  return '';
}
function showErr(f: Field) {
  const e = errorOf(f);
  if (!e) return false;
  return tried.value || (values[f.key] !== '' && values[f.key] !== undefined && f.type !== 'group');
}
function tabHasErrors(i: number) {
  const t = spec.value?.tabs[i];
  return Boolean(t && visible(t.fields).some(f => errorOf(f)));
}
const invalid = computed(() => (spec.value ? spec.value.tabs.filter((_, i) => tabHasErrors(i)).map(t => t.name) : []));

function size(prefix: string) {
  const mm = String(prefix || '').match(/\/(\d{1,2})$/);
  return mm ? `${(2 ** (32 - Number(mm[1]))).toLocaleString()} addresses` : '';
}
function reviewValue(f: Field) {
  const value = values[f.key];
  if (f.type === 'password') return value ? '••••••••' : '—';
  if (f.type === 'check') return value ? 'Enabled' : 'Disabled';
  if (f.type === 'group') return values.group ? `${values.newGroup ? '(new) ' : ''}${values.group}` : '—';
  if (f.type === 'subnets') return (value || []).map((s: any) => `${s.name} (${s.prefix})`).join(', ');
  if (f.type === 'select' || f.type === 'radio') return optsRaw(f).find(o => o.value === value)?.label || value || '—';
  if (f.key === 'location') return locName(value);
  return value === '' || value === undefined ? '—' : String(value);
}

const commands = computed(() => (spec.value ? spec.value.build(values, ctx.value) : []));
const automation = ref(false);
function copyAll() { navigator.clipboard?.writeText(commands.value.join('\n')); }

function create() {
  if (!spec.value || invalid.value.length) return;
  const name = spec.value.name(values);
  const group = spec.value.group(values);
  const dname = deploymentName(kind.value);
  az.note('progress', 'Deployment in progress...', `Deployment to resource group '${group}' is in progress.`);
  az.go({ page: 'deploy', name: dname, kind: kind.value, group,
          id: `/subscriptions/${az.p.value.account?.subscription}/resourceGroups/${group}/providers/Microsoft.Resources/deployments/${dname}`,
          extra: { commands: commands.value, resource: name, token: `${dname}-${Math.random().toString(36).slice(2)}` } });
}
</script>

<style scoped>
.az-mkt { display: flex; gap: 12px; align-items: flex-start; }
.az-mkt__body { min-width: 0; }
.az-mkt__blurb { margin: 6px 0; color: #424242; }
.az-info { color: #616161; cursor: help; }
.az-field__sublink { display: inline-block; margin-top: 4px; }
.az-newgroup { margin-top: 8px; padding: 10px; border: 1px solid #e0e0e0; border-radius: 4px; background: #fafafa; }
.az-wiz__info { padding-top: 6px; }
.az-review { display: grid; grid-template-columns: 240px 1fr; gap: 16px; padding: 4px 0; }
.az-review__k { color: #424242; }
.az-review__v { overflow-wrap: anywhere; }
.az-subnets .az-table td { padding: 4px; }
@container sl-portal (max-width: 560px) { .az-review { grid-template-columns: 1fr; gap: 0; } }
</style>
