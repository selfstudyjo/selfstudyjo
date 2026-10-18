<template>
  <div v-if="job" class="jk-job">
    <!-- ===== Changes ===== -->
    <template v-if="r.page === 'changes'">
      <h1 class="jk-h1"><JkIcon name="changes" />Changes</h1>
      <div v-if="!job.builds.length" class="jk-empty">No builds.</div>
      <div v-for="build in job.builds" v-else :key="build.number" class="jk-job__change">
        <h2 class="jk-job__change-head">
          <button type="button" class="jk-link" @click="ctx.go({ page: 'build', job: job.name, build: build.number })">#{{ build.number }}</button>
          <span class="jk-muted">({{ shortDate(build.at) }})</span>
        </h2>
        <p class="jk-muted">No changes.</p>
      </div>
    </template>

    <!-- ===== Full Stage View ===== -->
    <template v-else-if="r.page === 'stageView'">
      <h1 class="jk-h1">{{ job.name }} - Stage View</h1>
      <JkStageView :job="job" :limit="30" />
    </template>

    <!-- ===== Status ===== -->
    <template v-else>
      <div class="jk-app-bar">
        <h1 class="jk-h1">
          <JkIcon v-if="job.type === 'folder'" name="folder" class="jk-job__type-icon" />
          <JkStatus v-else :ball="ballOf(job.builds[0]?.result, job.disabled)" :size="26" />
          {{ job.name }}
        </h1>
        <div class="jk-job__bar-buttons">
          <button type="button" class="jk-btn" @click="startEdit"><JkIcon name="pencil" />{{ job.description ? 'Edit description' : 'Add description' }}</button>
        </div>
      </div>

      <div v-if="job.disabled" class="jk-alert jk-alert--warning jk-job__disabled">
        <span>This project is currently disabled</span>
        <button type="button" class="jk-btn jk-btn--primary" @click="actions.setEnabled(job.name, true)">Enable</button>
      </div>

      <form v-if="editing" class="jk-job__edit" @submit.prevent="saveDescription">
        <textarea v-model="draft" class="jk-textarea" rows="4" aria-label="Description"></textarea>
        <div class="jk-job__edit-buttons">
          <button type="submit" class="jk-btn jk-btn--primary">Save</button>
          <button type="button" class="jk-btn" @click="editing = false">Cancel</button>
        </div>
      </form>
      <p v-else-if="job.description" class="jk-job__desc">{{ job.description }}</p>

      <p v-if="job.type !== 'folder'" class="jk-job__source jk-muted">
        {{ TYPE_LABEL[job.type] || 'Pipeline' }}
        <template v-if="job.type === 'pipeline' || job.type === 'multibranch'">
          · {{ job.from_scm ? `Pipeline script from SCM (${job.script_path}, branch ${ctx.branch.value})` : 'Pipeline script' }}
        </template>
      </p>

      <template v-if="job.type === 'folder'">
        <div class="jk-empty">This folder is empty. The lab keeps every job at the top level.</div>
      </template>

      <template v-else>
        <template v-if="job.type !== 'freestyle'">
          <h2 class="jk-h2">Stage View</h2>
          <JkStageView :job="job" :limit="10" />
        </template>
        <template v-else-if="!job.builds.length">
          <div class="jk-empty">This project has not been built yet.</div>
        </template>

        <template v-if="tests">
          <h2 class="jk-h2">Test Result Trend</h2>
          <p>Latest Test Result ({{ tests.failed ? `${tests.failed} failure${tests.failed === 1 ? '' : 's'}` : 'no failures' }}) · {{ tests.total }} tests</p>
        </template>

        <h2 class="jk-h2">Permalinks</h2>
        <ul v-if="permalinks.length" class="jk-job__perma">
          <li v-for="link in permalinks" :key="link.label">
            <button type="button" class="jk-link" @click="ctx.go({ page: 'build', job: job.name, build: link.build.number })">
              {{ link.label }} (#{{ link.build.number }}), {{ since(link.build.at, ctx.now.value) }} ago
            </button>
          </li>
        </ul>
        <p v-else class="jk-muted">No builds yet.</p>

        <div class="jk-job__footer">
          <button v-if="!job.disabled" type="button" class="jk-btn" @click="actions.setEnabled(job.name, false)">
            <JkIcon name="power" />Disable Project
          </button>
        </div>
      </template>
    </template>
  </div>
  <div v-else class="jk-empty">No such job.</div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import JkIcon from './JkIcon.vue';
import JkStatus from './JkStatus.vue';
import JkStageView from './JkStageView.vue';
import { useJk } from './jkContext';
import { useActions } from './jkActions';
import { ballOf, jcli, lastWhere, shortDate, since, TYPE_LABEL, type Build } from './jenkinsKit';

const ctx = useJk();
const actions = useActions(ctx);
const r = computed(() => ctx.route.value as any);
const job = computed(() => ctx.job(r.value.job));
const editing = ref(false);
const draft = ref('');

function startEdit() {
  draft.value = job.value?.description || '';
  editing.value = true;
}

async function saveDescription() {
  if (!job.value) return;
  const text = draft.value;
  const command = text.trim()
    ? jcli(['update-job', job.value.name], { '--description': text })
    : jcli(['update-job', job.value.name], { '--no-description': true });
  const result = await ctx.run(command, { success: 'Saved' });
  if (result.ok) editing.value = false;
}

const permalinks = computed(() => {
  const j = job.value;
  if (!j) return [] as { label: string; build: Build }[];
  const done = (b: Build) => ['SUCCESS', 'UNSTABLE', 'FAILURE', 'ABORTED'].includes(String(b.result));
  const spec: [string, (b: Build) => boolean][] = [
    ['Last build', () => true],
    ['Last stable build', b => b.result === 'SUCCESS'],
    ['Last successful build', b => b.result === 'SUCCESS' || b.result === 'UNSTABLE'],
    ['Last failed build', b => b.result === 'FAILURE'],
    ['Last unsuccessful build', b => b.result !== 'SUCCESS'],
    ['Last completed build', done],
  ];
  return spec.map(([label, test]) => ({ label, build: lastWhere(j, test) }))
    .filter((link): link is { label: string; build: Build } => Boolean(link.build));
});

const tests = computed(() => {
  const last = job.value?.builds.find(b => (b.tests?.total || 0) > 0);
  return last ? { total: last.tests.total || 0, failed: last.tests.failed || 0 } : null;
});
</script>

<style scoped>
.jk-job { max-width: 1280px; }
.jk-job__type-icon { width: 25.6px; height: 25.6px; }
.jk-job__bar-buttons { display: flex; gap: 8px; }
.jk-job__disabled { display: flex; align-items: center; justify-content: space-between; gap: 16px; }
.jk-job__edit { margin-bottom: 16px; max-width: 832px; }
.jk-job__edit-buttons { display: flex; gap: 8px; margin-top: 8px; }
.jk-job__desc { white-space: pre-wrap; margin: 0 0 16px; word-break: break-word; }
.jk-job__source { margin: -6.4px 0 6.4px; font-size: 13px; }
.jk-job__perma { margin: 0; padding-left: 19.2px; }
.jk-job__perma li { margin: 2.4px 0; }
.jk-job__footer { margin-top: 25.6px; display: flex; justify-content: flex-end; }
.jk-job__change { margin-bottom: 12.8px; }
.jk-job__change-head { display: flex; gap: 8px; align-items: baseline; font-size: 16px; margin: 0; }
.jk-job__change p { margin: 1.6px 0 0; }
</style>
