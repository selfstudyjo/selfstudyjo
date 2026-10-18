<template>
  <div v-if="workspace" class="tf-page">
    <TfWsHeader />

    <!-- ===== General ===== -->
    <template v-if="route.page === 'settings'">
      <h2 class="tf-h2">General Settings</h2>
      <div class="tf-card se-card">
        <div class="tf-field">
          <span class="tf-label">ID</span>
          <code class="tf-mono se-id">{{ workspace.id }}</code>
        </div>
        <div class="tf-field">
          <label class="tf-label" for="se-name">Name</label>
          <input id="se-name" class="tf-input" :value="workspace.name" disabled />
          <p class="tf-help">A CLI workspace cannot be renamed - the Terraform CLI has no rename. Create a new workspace instead.</p>
        </div>
        <div class="tf-field">
          <span class="tf-label">Project</span>
          <select class="tf-select" disabled><option>Default Project</option></select>
        </div>
        <fieldset class="se-radios">
          <legend class="tf-label">Execution Mode</legend>
          <label class="tf-check"><input type="radio" disabled /> <span>Organization default <span class="tf-check__sub">Remote</span></span></label>
          <label class="tf-check"><input type="radio" disabled /> <span>Remote <span class="tf-check__sub">Your plans and applies occur on HCP Terraform's infrastructure.</span></span></label>
          <label class="tf-check"><input type="radio" checked disabled /> <span>Local (custom) <span class="tf-check__sub">Your planning and applying jobs are performed on your own machines - here, the lab's terraform CLI. HCP Terraform is only used to store and synchronize state.</span></span></label>
        </fieldset>
        <fieldset class="se-radios">
          <legend class="tf-label">Apply Method</legend>
          <label class="tf-check"><input type="radio" disabled /> <span>Auto apply <span class="tf-check__sub">Automatically apply changes when a Terraform plan is successful.</span></span></label>
          <label class="tf-check"><input type="radio" checked disabled /> <span>Manual apply <span class="tf-check__sub">Require an operator to confirm the result of the Terraform plan before applying.</span></span></label>
        </fieldset>
        <div class="tf-field">
          <span class="tf-label">Terraform Version</span>
          <select class="tf-select" disabled><option>{{ workspace.version }}</option></select>
          <p class="tf-help">The version of Terraform to use for this workspace (the lab's Terraform).</p>
        </div>
        <p class="tf-faint tf-small">These settings are fixed by the lab environment.</p>
      </div>
    </template>

    <!-- ===== Locking ===== -->
    <template v-else-if="route.page === 'locking'">
      <h2 class="tf-h2">Locking</h2>
      <p class="tf-faint se-sub">Locking a workspace prevents Terraform runs from acquiring the state lock. Unlock it to allow runs again.</p>
      <div class="tf-card se-card">
        <template v-if="workspace.locked">
          <div class="tf-alert tf-alert--warning">
            <TfIcon name="lock" />
            <div>
              <span class="tf-alert__title">Locked by {{ workspace.lock?.user }}</span>
              {{ workspace.lock?.reason || 'No reason given.' }}
              <div class="tf-faint tf-small">Locked {{ ago(workspace.lock?.at, now) }} · lock ID <code class="tf-mono">{{ workspace.lock?.id }}</code></div>
            </div>
          </div>
          <div class="se-actions">
            <button type="button" class="tf-btn tf-btn--primary" :disabled="busy" @click="unlock(false)">Unlock {{ workspace.name }}</button>
            <button type="button" class="tf-btn tf-btn--critical" :disabled="busy" @click="forceUnlock">Force unlock</button>
          </div>
          <p class="tf-help se-help">Force unlock runs <code class="tf-mono">terraform force-unlock -force &lt;LOCK_ID&gt;</code>, which is what you would use when a crashed run left the lock behind.</p>
        </template>
        <template v-else>
          <div class="tf-alert tf-alert--success"><TfIcon name="unlock" /><div><span class="tf-alert__title">Unlocked</span>Runs can acquire the state lock.</div></div>
          <div class="tf-field se-reason">
            <label class="tf-label" for="se-reason">Reason <span class="tf-label__opt">(optional)</span></label>
            <input id="se-reason" v-model="reason" class="tf-input" maxlength="200" placeholder="e.g. Investigating a drift" />
          </div>
          <button type="button" class="tf-btn tf-btn--primary" :disabled="busy" @click="lock">Lock {{ workspace.name }}</button>
        </template>
      </div>
    </template>

    <!-- ===== Destruction and Deletion ===== -->
    <template v-else>
      <h2 class="tf-h2">Destruction and Deletion</h2>
      <div class="tf-card se-card">
        <h3 class="tf-h3">Destroy infrastructure</h3>
        <p class="se-p">Queue a destroy plan to destroy all resources managed by this workspace. You will be able to review the plan and confirm it before anything is destroyed.</p>
        <p v-if="!workspace.resources" class="tf-faint tf-small se-p">This workspace manages no resources right now.</p>
        <button type="button" class="tf-btn tf-btn--critical" :disabled="busy" @click="queueDestroy">Queue destroy plan</button>
      </div>

      <div class="tf-card se-card">
        <h3 class="tf-h3">Delete Workspace</h3>
        <p class="se-p">Deleting a workspace removes it, its state and its run history. Two options are available:</p>
        <fieldset class="se-radios">
          <label class="tf-check"><input v-model="deleteMode" type="radio" value="safe" />
            <span>Safe Delete <span class="tf-check__sub">Deletes the workspace only if it is not managing any resources.</span></span></label>
          <label class="tf-check"><input v-model="deleteMode" type="radio" value="force" />
            <span>Force Delete <span class="tf-check__sub">Deletes the workspace even if it is managing resources; Terraform forgets them, they are NOT destroyed.</span></span></label>
        </fieldset>
        <div v-if="workspace.name === 'default'" class="tf-alert tf-alert--neutral se-p"><TfIcon name="info" /><div>The <strong>default</strong> workspace cannot be deleted (Terraform refuses to delete it).</div></div>
        <button type="button" class="tf-btn tf-btn--critical-solid" :disabled="busy || workspace.name === 'default'" @click="deleteWs">Delete from HCP Terraform</button>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { cli } from '@/utils/portalKit';
import TfIcon from './TfIcon.vue';
import TfWsHeader from './TfWsHeader.vue';
import { useTf } from './tfContext';
import { ago, cmdLock, cmdPlan, cmdUnlock, cmdWorkspace } from './tfKit';

const { workspace, workspaces, runs, route, now, run, go, confirm, ensureInit, busy } = useTf();
const reason = ref('');
const deleteMode = ref<'safe' | 'force'>('safe');

async function lock() {
  if (!workspace.value) return;
  const result = await run(cmdLock(workspace.value.id, reason.value.trim()), { success: `Workspace ${workspace.value.name} locked` });
  if (result.ok) reason.value = '';
}

async function unlock(force: boolean) {
  if (!workspace.value) return;
  await run(cmdUnlock(workspace.value.id, force), { success: `Workspace ${workspace.value.name} unlocked` });
}

async function forceUnlock() {
  const ws = workspace.value;
  if (!ws?.lock) return;
  const ok = await confirm({
    title: 'Force unlock workspace?',
    message: 'Only force-unlock when you are sure no run is using the state. Forcing the lock off while a run writes state can corrupt it.',
    yes: 'Force unlock', destructive: true,
  });
  if (ok) await run(cli(['terraform', 'force-unlock'], { '-force': true }) + ' ' + cli([ws.lock.id]), { success: 'Terraform state has been successfully unlocked' });
}

async function queueDestroy() {
  const ws = workspace.value;
  if (!ws) return;
  const ok = await confirm({
    title: 'Queue destroy plan',
    message: `This will queue a plan to destroy all infrastructure managed by "${ws.name}". You will have to confirm the plan before it is applied.`,
    yes: 'Queue destroy plan', typeToConfirm: ws.name, destructive: true,
  });
  if (!ok) return;
  if (!(await ensureInit())) return;
  const before = runs.value[0]?.id || '';
  await run(cmdPlan('destroy'), { success: 'Destroy plan queued', failure: 'Destroy plan errored' });
  const latest = runs.value.find(item => item.workspace === ws.name);
  if (latest && latest.id !== before) go({ page: 'run', ws: ws.name, id: latest.id });
}

async function deleteWs() {
  const ws = workspace.value;
  if (!ws) return;
  if (deleteMode.value === 'safe' && ws.resources > 0) {
    await confirm({
      title: 'Workspace is not empty',
      message: `"${ws.name}" is managing ${ws.resources} resource(s). Destroy them first (Queue destroy plan), or choose Force Delete.`,
      yes: 'OK',
    });
    return;
  }
  const ok = await confirm({
    title: `Delete ${ws.name}?`,
    message: deleteMode.value === 'force'
      ? 'This permanently deletes the workspace and its state. Resources it manages will NOT be destroyed and Terraform will lose track of them.'
      : 'This permanently deletes the workspace, its state versions and run history.',
    yes: 'Delete workspace', typeToConfirm: ws.name, destructive: true,
  });
  if (!ok) return;
  // Terraform cannot delete the selected workspace, so select another first.
  if (ws.current) {
    const other = workspaces.value.find(item => item.name !== ws.name);
    const result = await run(cmdWorkspace('select', other?.name || 'default'));
    if (!result.ok) return;
  }
  const result = await run(cmdWorkspace('delete', ws.name, deleteMode.value === 'force'),
                           { success: `Workspace ${ws.name} deleted`, failure: 'Workspace could not be deleted' });
  if (result.ok) go({ page: 'workspaces' });
}
</script>

<style scoped src="./tfBase.css"></style>
<style scoped>
.se-card { padding: 20px; margin-top: 16px; max-width: 820px; }
.se-sub { margin-top: 6px; }
.se-id { font-size: 13px; color: var(--tf-fg-strong); }
.se-radios { border: 0; padding: 0; margin: 0 0 18px; display: flex; flex-direction: column; gap: 10px; }
.se-radios legend { margin-bottom: 8px; }
.se-actions { display: flex; gap: 8px; margin-top: 16px; flex-wrap: wrap; }
.se-help { margin-top: 10px; }
.se-reason { margin-top: 16px; }
.se-p { margin: 8px 0 14px; }
</style>
