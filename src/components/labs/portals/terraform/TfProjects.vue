<template>
  <div class="tf-page">
    <div class="tf-page-head">
      <div>
        <h1 class="tf-display">Projects</h1>
        <p class="tf-faint pj-sub">Projects let you group related workspaces in your organization.</p>
      </div>
      <div class="tf-page-head__actions">
        <button type="button" class="tf-btn tf-btn--secondary" @click="go({ page: 'workspaces' })">View all workspaces</button>
        <button type="button" class="tf-btn tf-btn--primary"
                @click="notify('info', 'One project in this lab', 'Every workspace here belongs to the Default Project. Terraform CLI workspaces have no project; HCP Terraform puts them in the default one.')">
          <TfIcon name="plus" /> New project
        </button>
      </div>
    </div>

    <div class="pj-grid">
      <a href="#" class="tf-card pj-card" @click.prevent="go({ page: 'workspaces' })">
        <div class="pj-card__head">
          <TfIcon name="folder" :size="20" class="pj-card__icon" />
          <span class="pj-card__name">Default Project</span>
          <span class="tf-badge tf-badge--neutral">Default</span>
        </div>
        <dl class="pj-card__stats">
          <div><dt>Workspaces</dt><dd>{{ workspaces.length }}</dd></div>
          <div><dt>Resources</dt><dd>{{ resources }}</dd></div>
          <div><dt>Needs attention</dt><dd>{{ attention }}</dd></div>
        </dl>
        <p class="tf-faint tf-small">The default project for the {{ org }} organization.</p>
      </a>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import TfIcon from './TfIcon.vue';
import { useTf } from './tfContext';

const { workspaces, go, notify, org } = useTf();
const resources = computed(() => workspaces.value.reduce((sum, ws) => sum + (ws.resources || 0), 0));
const attention = computed(() => workspaces.value.filter(ws => ws.latest_run?.status === 'planned').length);
</script>

<style scoped src="./tfBase.css"></style>
<style scoped>
.pj-sub { margin-top: 4px; }
.pj-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(min(100%, 320px), 1fr)); gap: 16px; }
.pj-card { display: flex; flex-direction: column; gap: 12px; padding: 16px; color: inherit; }
.pj-card:hover { text-decoration: none; border-color: var(--tf-fg-action); color: inherit; }
.pj-card__head { display: flex; align-items: center; gap: 8px; }
.pj-card__icon { color: var(--tf-brand); }
.pj-card__name { font-weight: 600; font-size: 16px; color: var(--tf-fg-action); flex: 1; }
.pj-card__stats { display: flex; gap: 24px; margin: 0; }
.pj-card__stats dt { font-size: 13px; color: var(--tf-fg-faint); }
.pj-card__stats dd { margin: 0; font-size: 18px; font-weight: 600; color: var(--tf-fg-strong); }
</style>
