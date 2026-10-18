<template>
  <div class="tf-page nw">
    <h1 class="tf-display">Create a new Workspace</h1>
    <p class="tf-faint nw-sub">Workspaces determine how HCP Terraform organizes infrastructure. A workspace contains your Terraform configuration, shared variable values, your current and historical Terraform state, and run logs.</p>

    <ol class="nw-steps">
      <li :class="{ 'is-current': step === 1, 'is-done': step > 1 }"><span class="nw-steps__n">1</span> Choose Type</li>
      <li :class="{ 'is-current': step === 2 }"><span class="nw-steps__n">2</span> Configure settings</li>
    </ol>

    <template v-if="step === 1">
      <h2 class="tf-h2 nw-h">Choose your workflow</h2>
      <div class="nw-types">
        <div class="tf-card nw-type is-disabled">
          <TfIcon name="git" :size="24" class="nw-type__icon" />
          <div class="nw-type__name">Version Control Workflow</div>
          <p class="tf-faint tf-small">Store your Terraform configuration in a git repository, and trigger runs based on pull requests and merges.</p>
          <span class="tf-badge tf-badge--neutral">Needs a VCS connection - not available in this lab</span>
        </div>
        <button type="button" class="tf-card nw-type nw-type--pick" @click="step = 2">
          <TfIcon name="terminal" :size="24" class="nw-type__icon" />
          <span class="nw-type__name">CLI-Driven Workflow</span>
          <span class="tf-faint tf-small">Trigger remote Terraform runs from your local command line.</span>
          <span class="nw-type__go">Select <TfIcon name="chevron-right" :size="14" /></span>
        </button>
        <div class="tf-card nw-type is-disabled">
          <TfIcon name="code" :size="24" class="nw-type__icon" />
          <div class="nw-type__name">API-Driven Workflow</div>
          <p class="tf-faint tf-small">A more advanced option. Integrate Terraform into a larger pipeline using the Terraform API.</p>
          <span class="tf-badge tf-badge--neutral">Not available in this lab</span>
        </div>
      </div>
    </template>

    <form v-else class="nw-form" @submit.prevent="create">
      <h2 class="tf-h2 nw-h">Configure settings</h2>
      <div class="tf-field">
        <label class="tf-label" for="nw-name">Workspace Name <span class="tf-label__opt">(required)</span></label>
        <p class="tf-help">The name of your workspace is unique and used in tools, routing, and UI. Dashes, underscores, and alphanumeric characters are permitted. Learn more about naming workspaces.</p>
        <input id="nw-name" v-model.trim="name" class="tf-input" :class="{ 'is-invalid': touched && error }" autocomplete="off" @blur="touched = true" />
        <p v-if="touched && error" class="tf-err"><TfIcon name="alert-circle" :size="14" />{{ error }}</p>
      </div>
      <div class="tf-field">
        <label class="tf-label" for="nw-project">Project <span class="tf-label__opt">(required)</span></label>
        <select id="nw-project" class="tf-select" disabled><option>Default Project</option></select>
        <p class="tf-help">Workspaces are grouped by project. This lab has only the Default Project.</p>
      </div>
      <div class="tf-alert tf-alert--info nw-note">
        <TfIcon name="info" />
        <div>
          <span class="tf-alert__title">CLI-driven workspace</span>
          Creating it runs <code class="tf-mono">terraform workspace new {{ name || 'NAME' }}</code>, which also selects it for the CLI.
        </div>
      </div>
      <div class="nw-actions">
        <button type="submit" class="tf-btn tf-btn--primary" :disabled="busy">Create</button>
        <button type="button" class="tf-btn tf-btn--secondary" @click="step = 1">Back</button>
        <button type="button" class="tf-btn tf-btn--tertiary" @click="go({ page: 'workspaces' })">Cancel</button>
      </div>
    </form>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import TfIcon from './TfIcon.vue';
import { useTf } from './tfContext';
import { cmdWorkspace } from './tfKit';

const { workspaces, go, run, busy } = useTf();
const step = ref(1);
const name = ref('');
const touched = ref(false);

const error = computed(() => {
  if (!name.value) return 'Name can\'t be blank';
  if (!/^[A-Za-z0-9_-]+$/.test(name.value)) return 'Name is invalid - only letters, numbers, dashes and underscores are allowed';
  if (name.value.length > 90) return 'Name is too long (maximum is 90 characters)';
  if (workspaces.value.some(ws => ws.name === name.value)) return 'Name has already been taken';
  return '';
});

async function create() {
  touched.value = true;
  if (error.value) return;
  const result = await run(cmdWorkspace('new', name.value), { success: `Workspace ${name.value} created`, failure: 'Workspace could not be created' });
  if (result.ok) go({ page: 'overview', ws: name.value });
}
</script>

<style scoped src="./tfBase.css"></style>
<style scoped>
.nw { max-width: 980px; }
.nw-sub { margin-top: 6px; max-width: 760px; }
.nw-steps { display: flex; gap: 24px; margin: 24px 0; padding-bottom: 12px; border-bottom: 1px solid var(--tf-border); flex-wrap: wrap; }
.nw-steps li { display: flex; align-items: center; gap: 8px; color: var(--tf-fg-faint); font-weight: 500; }
.nw-steps li.is-current { color: var(--tf-fg-strong); }
.nw-steps__n { display: inline-grid; place-items: center; width: 22px; height: 22px; border-radius: 50%; border: 1px solid var(--tf-border-strong); font-size: 12px; }
.nw-steps li.is-current .nw-steps__n { background: var(--tf-fg-action); border-color: var(--tf-fg-action); color: #fff; }
.nw-steps li.is-done .nw-steps__n { background: var(--tf-fg-success); border-color: var(--tf-fg-success); color: #fff; }
.nw-h { margin-bottom: 16px; }
.nw-types { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 240px), 1fr)); gap: 16px; }
.nw-type { display: flex; flex-direction: column; align-items: flex-start; gap: 8px; padding: 20px; text-align: left; }
.nw-type__icon { color: var(--tf-brand); }
.nw-type__name { font-size: 16px; font-weight: 600; color: var(--tf-fg-strong); }
.nw-type.is-disabled { background: var(--tf-surface-faint); }
.nw-type.is-disabled .nw-type__icon, .nw-type.is-disabled .nw-type__name { color: var(--tf-fg-faint); }
.nw-type--pick { border-color: var(--tf-fg-action); cursor: pointer; }
.nw-type--pick:hover { background: var(--tf-surface-action); }
.nw-type__go { margin-top: auto; display: inline-flex; align-items: center; gap: 4px; color: var(--tf-fg-action); font-weight: 500; }
.nw-note { max-width: 560px; margin-bottom: 20px; }
.nw-actions { display: flex; gap: 8px; flex-wrap: wrap; }
</style>
