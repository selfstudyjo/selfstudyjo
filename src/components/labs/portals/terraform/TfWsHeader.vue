<template>
  <div v-if="workspace" class="wh">
    <div class="wh__top">
      <div class="wh__title-block">
        <div class="wh__title-row">
          <h1 class="tf-display wh__title">{{ workspace.name }}</h1>
          <span v-if="workspace.locked" class="tf-badge tf-badge--warning"><TfIcon name="lock" :size="14" /> Locked</span>
        </div>
        <div class="wh__meta">
          <button type="button" class="wh__id" title="Copy workspace ID" @click="copyId">
            ID: <span class="tf-mono">{{ workspace.id }}</span> <TfIcon name="copy" :size="14" />
          </button>
          <span class="wh__dot" aria-hidden="true"></span>
          <span class="tf-badge tf-badge--neutral"><TfIcon name="layers" :size="14" /> Resources {{ workspace.resources }}</span>
          <span class="tf-badge tf-badge--neutral"><TfIcon name="terraform" :size="14" /> Terraform v{{ workspace.version }}</span>
          <span class="tf-faint tf-small">Updated {{ ago(updated, now) }}</span>
        </div>
      </div>
      <div class="wh__actions">
        <div class="wh__menu-wrap">
          <button type="button" class="tf-btn tf-btn--secondary" :aria-expanded="menuOpen" @click="menuOpen = !menuOpen">
            Actions <TfIcon name="chevron-down" :size="14" />
          </button>
          <div v-if="menuOpen" class="tf-menu wh__menu" @click="menuOpen = false">
            <button v-if="!workspace.locked" type="button" class="tf-menu__item" @click="lock">
              <TfIcon name="lock" /><span>Lock workspace<small>Prevent runs and state changes</small></span>
            </button>
            <button v-else type="button" class="tf-menu__item" @click="unlock">
              <TfIcon name="unlock" /><span>Unlock workspace<small>Locked by {{ workspace.lock?.user }}</small></span>
            </button>
            <button type="button" class="tf-menu__item" @click="go({ page: 'variables', ws: workspace.name })">
              <TfIcon name="code" /><span>Variables</span>
            </button>
            <button type="button" class="tf-menu__item is-critical" @click="go({ page: 'destruction', ws: workspace.name })">
              <TfIcon name="trash" /><span>Destruction and Deletion</span>
            </button>
          </div>
        </div>
        <button type="button" class="tf-btn tf-btn--primary" :disabled="busy" @click="newRunOpen = true">
          <TfIcon name="plus" /> New run
        </button>
      </div>
    </div>
    <TfNewRun v-if="newRunOpen" @close="newRunOpen = false" />
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import TfIcon from './TfIcon.vue';
import TfNewRun from './TfNewRun.vue';
import { useTf } from './tfContext';
import { ago, cmdLock, cmdUnlock } from './tfKit';

const { workspace, runs, now, go, run, notify, confirm, busy } = useTf();
const menuOpen = ref(false);
const newRunOpen = ref(false);

const updated = computed(() => {
  const latest = runs.value.find(item => item.workspace === workspace.value?.name);
  return latest?.applied_at || latest?.created_at || workspace.value?.created_at || '';
});

async function copyId() {
  try {
    await navigator.clipboard.writeText(workspace.value?.id || '');
    notify('success', 'Copied workspace ID');
  } catch {
    notify('info', 'Workspace ID', workspace.value?.id || '');
  }
}

async function lock() {
  if (!workspace.value) return;
  const ok = await confirm({
    title: `Lock ${workspace.value.name}?`,
    message: 'Locking prevents Terraform runs and state changes in this workspace until it is unlocked. Use it while you investigate or make manual changes.',
    yes: 'Lock workspace',
  });
  if (ok) await run(cmdLock(workspace.value.id, 'Locked from the workspace page'), { success: `Workspace ${workspace.value.name} locked` });
}

async function unlock() {
  if (!workspace.value) return;
  await run(cmdUnlock(workspace.value.id), { success: `Workspace ${workspace.value.name} unlocked` });
}
</script>

<style scoped src="./tfBase.css"></style>
<style scoped>
.wh { margin-bottom: 24px; }
.wh__top { display: flex; justify-content: space-between; align-items: flex-start; gap: 16px; flex-wrap: wrap; }
.wh__title-block { min-width: 0; }
.wh__title-row { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
.wh__title { overflow-wrap: anywhere; }
.wh__meta { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; margin-top: 8px; }
.wh__id { display: inline-flex; align-items: center; gap: 4px; font-size: 13px; color: var(--tf-fg-faint); }
.wh__id:hover { color: var(--tf-fg-action); }
.wh__dot { width: 3px; height: 3px; border-radius: 50%; background: var(--tf-fg-faint); }
.wh__actions { display: flex; gap: 8px; align-items: center; }
.wh__menu-wrap { position: relative; }
.wh__menu { right: 0; top: calc(100% + 4px); width: 260px; }
</style>
