<template>
  <div v-if="workspace" class="tf-page">
    <TfWsHeader />
    <h2 class="tf-h2">Variables</h2>
    <p class="tf-faint va-intro">
      These variables are used for all plans and applies in this workspace. Workspaces using Terraform 0.10.0 or later can also load
      default values from any <code class="tf-mono">*.auto.tfvars</code> files in the configuration. Sensitive variables are hidden from view in the UI.
    </p>
    <div class="tf-alert tf-alert--neutral va-how">
      <TfIcon name="info" />
      <div>HCP Terraform hands workspace variables to Terraform as a <code class="tf-mono">terraform.tfvars</code> file, so Terraform variables here are written to
        <code class="tf-mono">terraform.tfvars</code> in the working directory, and environment variables to <code class="tf-mono">.envrc</code>
        (<code class="tf-mono">TF_VAR_name</code> sets a Terraform variable too).</div>
    </div>

    <section class="tf-section">
      <div class="tf-section__head">
        <h3 class="tf-h3">Workspace variables ({{ editable.length }})</h3>
        <button v-if="!form" type="button" class="tf-btn tf-btn--secondary" @click="startAdd()"><TfIcon name="plus" /> Add variable</button>
      </div>

      <!-- add / edit form -->
      <form v-if="form" class="tf-card va-form" @submit.prevent="save">
        <h4 class="tf-h3 va-form__title">{{ form.original ? 'Edit variable' : 'Add variable' }}</h4>
        <fieldset class="va-cat" :disabled="Boolean(form.original)">
          <legend class="tf-label">Select variable category</legend>
          <label class="tf-check va-cat__opt">
            <input v-model="form.category" type="radio" value="terraform" />
            <span>Terraform variable<span class="tf-check__sub">These variables should match the declarations in your configuration. Click the HCL box to use interpolation or set a non-string value.</span></span>
          </label>
          <label class="tf-check va-cat__opt">
            <input v-model="form.category" type="radio" value="env" />
            <span>Environment variable<span class="tf-check__sub">These variables are available in the Terraform runtime environment.</span></span>
          </label>
        </fieldset>
        <div class="va-grid">
          <div class="tf-field">
            <label class="tf-label" for="va-key">Key</label>
            <input id="va-key" v-model.trim="form.key" class="tf-input tf-mono" :class="{ 'is-invalid': keyError && tried }" placeholder="key" autocomplete="off"
                   :list="form.category === 'terraform' ? 'va-declared' : undefined" />
            <datalist id="va-declared"><option v-for="d in declared" :key="d.name" :value="d.name" /></datalist>
            <p v-if="keyError && tried" class="tf-err"><TfIcon name="alert-circle" :size="14" />{{ keyError }}</p>
          </div>
          <div class="tf-field">
            <label class="tf-label" for="va-value">Value</label>
            <textarea id="va-value" v-model="form.value" class="tf-textarea tf-mono va-value" rows="2"
                      :placeholder="form.original?.sensitive ? 'Sensitive - write only (leave blank to keep the current value)' : 'value'"></textarea>
            <p v-if="valueError && tried" class="tf-err"><TfIcon name="alert-circle" :size="14" />{{ valueError }}</p>
          </div>
        </div>
        <div class="va-checks">
          <label v-if="form.category === 'terraform'" class="tf-check">
            <input v-model="form.hcl" type="checkbox" />
            <span>HCL<span class="tf-check__sub">Parse this field as HCL (numbers, booleans, lists).</span></span>
          </label>
          <label class="tf-check">
            <input v-model="form.sensitive" type="checkbox" :disabled="Boolean(form.original?.sensitive)" />
            <span>Sensitive<span class="tf-check__sub">Sensitive variables will never be shown in the UI. Once set, a variable cannot be made non-sensitive.</span></span>
          </label>
        </div>
        <div class="tf-field va-desc">
          <label class="tf-label" for="va-desc">Description <span class="tf-label__opt">(Optional)</span></label>
          <input id="va-desc" v-model="form.description" class="tf-input" maxlength="512" placeholder="description (optional)" />
        </div>
        <div class="va-actions">
          <button type="submit" class="tf-btn tf-btn--primary" :disabled="busy">{{ form.original ? 'Save variable' : 'Add variable' }}</button>
          <button type="button" class="tf-btn tf-btn--secondary" @click="form = null">Cancel</button>
        </div>
      </form>

      <div class="tf-table-wrap">
        <table class="tf-table va-table">
          <thead><tr><th>Key</th><th>Value</th><th>Category</th><th class="va-th-act"><span class="va-sr">Actions</span></th></tr></thead>
          <tbody>
            <tr v-for="variable in allRows" :key="variable.category + ':' + variable.file + ':' + variable.key">
              <td>
                <div class="va-key">
                  <span class="tf-mono va-key__name">{{ variable.key }}</span>
                  <span v-if="variable.hcl" class="tf-badge tf-badge--neutral va-tag">HCL</span>
                  <span v-if="variable.sensitive" class="tf-badge tf-badge--neutral va-tag">SENSITIVE</span>
                  <span v-if="variable.file !== TFVARS && variable.file !== ENVRC" class="tf-badge tf-badge--action va-tag" :title="'Read from ' + variable.file">{{ variable.file }}</span>
                </div>
                <div v-if="variable.description" class="tf-faint tf-small">{{ variable.description }}</div>
                <div v-if="variable.error" class="tf-err">{{ variable.error }}</div>
              </td>
              <td class="va-val">
                <span v-if="variable.sensitive" class="tf-faint va-sens">Sensitive - write only</span>
                <code v-else class="tf-mono">{{ variable.value }}</code>
              </td>
              <td>{{ variable.category }}</td>
              <td class="va-act">
                <div v-if="variable.file === TFVARS || variable.file === ENVRC" class="va-more">
                  <button type="button" class="va-more__btn" :aria-label="'Actions for ' + variable.key" @click="toggleMenu(variable, $event)">
                    <TfIcon name="more" />
                  </button>
                  <div v-if="menuKey === rowKey(variable)" class="tf-menu va-more__menu" :style="menuStyle" @click="menuKey = ''">
                    <button type="button" class="tf-menu__item" @click="startEdit(variable)"><TfIcon name="edit" />Edit</button>
                    <button type="button" class="tf-menu__item is-critical" @click="remove(variable)"><TfIcon name="trash" />Delete</button>
                  </div>
                </div>
                <span v-else class="tf-faint tf-small">Edit the file</span>
              </td>
            </tr>
            <tr v-if="!allRows.length">
              <td colspan="4"><div class="tf-empty"><div class="tf-empty__title">There are no variables added.</div>Add a variable to set a value for this workspace.</div></td>
            </tr>
          </tbody>
        </table>
      </div>

      <div v-if="unset.length" class="tf-alert tf-alert--info va-unset">
        <TfIcon name="info" />
        <div>
          <span class="tf-alert__title">Declared in the configuration</span>
          These variables use their default unless a value is set here:
          <span v-for="d in unset" :key="d.name" class="va-chip"><button type="button" class="tf-link-btn tf-mono" @click="startAdd(d.name)">{{ d.name }}</button><span v-if="d.default" class="tf-faint"> = {{ d.default }}</span></span>
        </div>
      </div>
    </section>

    <section class="tf-section">
      <div class="tf-section__head">
        <h3 class="tf-h3">Variable sets (0)</h3>
        <button type="button" class="tf-btn tf-btn--secondary" @click="notify('info', 'No variable sets', 'Variable sets are shared across workspaces at the organization level; this lab organization has none.')">Apply variable set</button>
      </div>
      <div class="tf-card tf-empty">
        <div class="tf-empty__title">No variable sets have been applied</div>
        Variable sets allow you to reuse variables across multiple workspaces within your organization.
      </div>
    </section>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import { rows } from '@/utils/portalKit';
import TfIcon from './TfIcon.vue';
import TfWsHeader from './TfWsHeader.vue';
import { useTf } from './tfContext';
import { cmdWriteEnvrc, cmdWriteTfvars, ENV_KEY, ENVRC, TF_KEY, TFVARS, type TfVariable } from './tfKit';

interface Declared { name: string; default: string | null; description: string; type: string }
interface FormState { category: 'terraform' | 'env'; key: string; value: string; hcl: boolean; sensitive: boolean; description: string; original: TfVariable | null }

const { view, workspace, variables, run, confirm, notify, busy } = useTf();
const form = ref<FormState | null>(null);
const tried = ref(false);
const menuKey = ref('');

const allRows = computed(() => variables.value);
const editable = computed(() => variables.value.filter(v => v.file === TFVARS || v.file === ENVRC));
const tfvars = computed(() => variables.value.filter(v => v.file === TFVARS));
const envs = computed(() => variables.value.filter(v => v.file === ENVRC));
const declared = computed(() => rows<Declared>(view.value, 'declared_variables'));
const unset = computed(() => declared.value.filter(d => !variables.value.some(v => v.category === 'terraform' && v.key === d.name)
  && !variables.value.some(v => v.category === 'env' && v.key === 'TF_VAR_' + d.name)));

function rowKey(v: TfVariable) { return `${v.category}:${v.key}`; }
const menuStyle = ref<Record<string, string>>({});
// The table scrolls sideways on a narrow frame, which would clip a menu
// positioned inside it; so the menu is placed against the skin root instead.
function toggleMenu(v: TfVariable, event: MouseEvent) {
  if (menuKey.value === rowKey(v)) { menuKey.value = ''; return; }
  const button = event.currentTarget as HTMLElement;
  const root = button.closest('.tf-app') as HTMLElement | null;
  if (root) {
    const a = button.getBoundingClientRect();
    const b = root.getBoundingClientRect();
    menuStyle.value = { top: `${a.bottom - b.top + 4}px`, left: `${Math.max(8, a.right - b.left - 150)}px` };
  }
  menuKey.value = rowKey(v);
}

function startAdd(key = '') {
  tried.value = false;
  form.value = { category: 'terraform', key: typeof key === 'string' ? key : '', value: '', hcl: false, sensitive: false, description: '', original: null };
}

function startEdit(v: TfVariable) {
  tried.value = false;
  form.value = {
    category: v.category, key: v.key, value: v.sensitive ? '' : v.value, hcl: v.hcl,
    sensitive: v.sensitive, description: v.description, original: v,
  };
}

const keyError = computed(() => {
  const f = form.value;
  if (!f) return '';
  if (!f.key) return 'Key can\'t be blank';
  const pattern = f.category === 'env' ? ENV_KEY : TF_KEY;
  if (!pattern.test(f.key)) {
    return f.category === 'env'
      ? 'Key must start with a letter or underscore and contain only letters, numbers and underscores'
      : 'Key must start with a letter or underscore and contain only letters, numbers, underscores and dashes';
  }
  const taken = (f.category === 'env' ? envs.value : tfvars.value)
    .some(v => v.key === f.key && v.key !== f.original?.key);
  if (taken) return 'Key has already been taken';
  return '';
});

const valueError = computed(() => {
  const f = form.value;
  if (!f || !f.hcl) return '';
  if (!f.value.trim()) return 'An HCL value can\'t be blank';
  return '';
});

async function write(category: 'terraform' | 'env', list: TfVariable[], success: string) {
  const command = category === 'env' ? cmdWriteEnvrc(list) : cmdWriteTfvars(list);
  return run(command, { success, failure: 'Variable could not be saved' });
}

async function save() {
  tried.value = true;
  const f = form.value;
  if (!f || keyError.value || valueError.value) return;
  const keepValue = f.original?.sensitive && !f.value ? f.original.value : f.value;
  const entry: TfVariable = {
    key: f.key, value: keepValue, category: f.category, hcl: f.category === 'terraform' && f.hcl,
    sensitive: f.sensitive, description: f.description.trim(), file: f.category === 'env' ? ENVRC : TFVARS, error: '',
  };
  const base = f.category === 'env' ? envs.value : tfvars.value;
  const list = f.original
    ? base.map(v => (v.key === f.original!.key ? entry : v))
    : [...base, entry];
  const result = await write(f.category, list, f.original ? `Variable ${f.key} saved` : `Variable ${f.key} added`);
  if (result.ok) form.value = null;
}

async function remove(v: TfVariable) {
  const ok = await confirm({
    title: 'Delete variable',
    message: `Are you sure you want to delete the ${v.category} variable "${v.key}"? This cannot be undone.`,
    yes: 'Delete variable',
    destructive: true,
  });
  if (!ok) return;
  const base = v.category === 'env' ? envs.value : tfvars.value;
  await write(v.category, base.filter(item => item.key !== v.key), `Variable ${v.key} deleted`);
}
</script>

<style scoped src="./tfBase.css"></style>
<style scoped>
.va-intro { margin-top: 6px; max-width: 900px; }
.va-how { margin-top: 12px; max-width: 900px; }
.va-form { padding: 20px; margin-bottom: 16px; }
.va-form__title { margin-bottom: 12px; }
.va-cat { border: 0; padding: 0; margin: 0 0 16px; display: flex; flex-direction: column; gap: 10px; }
.va-cat legend { margin-bottom: 8px; }
.va-cat__opt { max-width: 640px; }
.va-grid { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1.4fr); gap: 16px; }
.va-grid .tf-field { max-width: none; margin-bottom: 12px; }
.va-value { min-height: 38px; }
.va-checks { display: flex; gap: 24px; flex-wrap: wrap; margin-bottom: 16px; }
.va-desc { max-width: none; }
.va-actions { display: flex; gap: 8px; }
.va-table td { vertical-align: top; }
.va-key { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; }
.va-key__name { font-weight: 600; color: var(--tf-fg-strong); }
.va-tag { font-size: 12px; padding: 0 5px; line-height: 16px; }
.va-val { min-width: 160px; }
#va-key::-webkit-calendar-picker-indicator { display: none; }
.va-val code { overflow-wrap: anywhere; white-space: pre-wrap; }
.va-sens { font-style: italic; }
.va-th-act { width: 60px; }
.va-sr { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); }
.va-act { text-align: right; }
.va-more { display: inline-block; }
.va-more__btn { padding: 4px 8px; border: 1px solid var(--tf-border-strong); border-radius: 5px; background: var(--tf-surface-faint); color: var(--tf-fg-primary); }
.va-more__btn:hover { background: var(--tf-surface-strong); }
.va-more__menu { width: 150px; min-width: 150px; }
.va-unset { margin-top: 12px; }
.va-chip { display: inline-block; margin: 2px 10px 0 0; }
@container sl-portal (max-width: 720px) {
  .va-grid { grid-template-columns: minmax(0, 1fr); gap: 0; }
}
</style>
