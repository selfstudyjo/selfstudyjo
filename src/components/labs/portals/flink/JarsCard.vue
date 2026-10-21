<template>
  <section class="fk-card">
    <header class="fk-card__head">
      <span class="fk-card__title">Uploaded Jars</span>
      <span class="fk-card__extra">
        <button type="button" class="fk-btn fk-btn--primary" :disabled="fk.busy.value" @click="openUpload"><FkIcon name="upload" />+ Add New</button>
      </span>
    </header>
    <div class="fk-table-wrap">
      <table class="fk-table">
        <thead><tr><th>Name</th><th>Upload Time</th><th>Entry Class</th><th></th></tr></thead>
        <tbody>
          <template v-for="j in jars" :key="j.id">
            <tr class="is-link" :class="{ 'is-selected': selected === j.id }" @click="select(j)">
              <td class="fk-mono wrap">{{ j.name }}</td>
              <td class="nowrap">{{ fmtTime(j.uploaded) }}</td>
              <td class="fk-mono wrap">{{ j.entry?.[0]?.name || '-' }}</td>
              <td class="nowrap"><button type="button" class="fk-btn fk-btn--sm fk-btn--danger" :disabled="fk.busy.value" @click.stop="remove(j)">Delete</button></td>
            </tr>
            <tr v-if="selected === j.id" class="fk-jar-form-row">
              <td colspan="4">
                <div class="fk-jar-form">
                  <label class="fk-field">Entry Class
                    <input v-model="form.entry" class="fk-input fk-mono" type="text" spellcheck="false" /></label>
                  <label class="fk-field">Parallelism
                    <input v-model="form.parallelism" class="fk-input" type="number" min="1" max="8" placeholder="Default" /></label>
                  <label class="fk-field fk-jar-wide">Program Arguments <small>{{ j.args }}</small>
                    <input v-model="form.args" class="fk-input fk-mono" type="text" spellcheck="false" placeholder="--window 15 --checkpointing" /></label>
                  <label class="fk-field fk-jar-wide">Savepoint Path
                    <input v-model="form.savepoint" class="fk-input fk-mono" type="text" list="fk-jar-savepoints" spellcheck="false" placeholder="s3://shopflow-lake/flink/savepoints/savepoint-..." />
                    <datalist id="fk-jar-savepoints"><option v-for="s in fk.savepoints.value" :key="s.path" :value="s.path" /></datalist></label>
                  <label class="fk-check"><input v-model="form.allowNonRestored" type="checkbox" :disabled="!form.savepoint" />Allow Non Restored State</label>
                  <div class="fk-jar-actions">
                    <button type="button" class="fk-btn" :disabled="fk.busy.value" @click="showPlan(j)">Show Plan</button>
                    <button type="button" class="fk-btn fk-btn--primary" :disabled="fk.busy.value" @click="submit(j)"><FkIcon name="play" />Submit</button>
                  </div>
                </div>
                <div v-if="plan" class="fk-jar-plan">
                  <div class="fk-muted">Plan of <strong>{{ plan.name }}</strong></div>
                  <div class="fk-jar-plan__nodes">
                    <template v-for="(n, i) in plan.nodes" :key="n.id">
                      <span v-if="i" class="fk-jar-plan__arrow" aria-hidden="true">&#8594;</span>
                      <span class="fk-jar-plan__node">{{ n.description }}<small>Parallelism: {{ n.parallelism }}</small></span>
                    </template>
                  </div>
                </div>
                <div v-if="error" class="fk-alert fk-alert--error"><FkIcon name="error" /><span class="fk-pre-wrap">{{ error }}</span></div>
              </td>
            </tr>
          </template>
          <tr v-if="!jars.length"><td colspan="4" class="fk-empty">No data. Add a JAR to submit a DataStream job, or use the SQL Gateway below.</td></tr>
        </tbody>
      </table>
    </div>

    <FkModal v-if="uploading" title="Upload Jar" ok-text="Upload" :ok-disabled="!choice" :busy="fk.busy.value" :width="560"
             @close="uploading = false" @ok="upload">
      <p class="fk-muted fk-jar-p">There is no file system to browse in this simulated cluster: these are the JARs in your
        local <code class="fk-mono">jars/</code> folder (the Flink operations playground jobs). Uploading one runs
        <code class="fk-mono">POST /jars/upload</code>, exactly as the dashboard does.</p>
      <label v-for="p in playground" :key="p.path" class="fk-jar-pick" :class="{ 'is-on': choice === p.path }">
        <input v-model="choice" type="radio" name="fk-jar" :value="p.path" />
        <span><strong class="fk-mono">{{ p.name }}</strong> <span class="fk-muted">{{ size(p.size) }}</span>
          <small class="fk-mono">{{ p.entry }}</small><small>{{ p.args }}</small></span>
      </label>
      <div v-if="uploadError" class="fk-alert fk-alert--error"><FkIcon name="error" /><span>{{ uploadError }}</span></div>
    </FkModal>
  </section>
</template>

<script setup lang="ts">
/**
 * The dashboard's "Uploaded Jars" list. Upload, Show Plan, Submit and Delete
 * are the JobManager REST calls the real dashboard makes, sent as curl lines;
 * a submitted playground JAR becomes a job like any other (savepoint, stop,
 * cancel all work on it).
 */
import { computed, ref } from 'vue';
import { errorText } from '@/utils/portalKit';
import FkIcon from './FkIcon.vue';
import FkModal from './FkModal.vue';
import { useFk } from './fkContext';
import { fmtTime, jarsOf, playgroundJarsOf, rest, restAnswer, type FkJar } from './flink';

const fk = useFk();
const jars = computed(() => jarsOf(fk.view.value).slice().reverse());
const playground = computed(() => playgroundJarsOf(fk.view.value));

const selected = ref('');
const form = ref({ entry: '', parallelism: '' as string | number, args: '', savepoint: '', allowNonRestored: false });
const error = ref('');
const plan = ref<{ name: string; nodes: { id: string; description: string; parallelism: number }[] } | null>(null);

function size(n: number) { return n ? (n / 1024 / 1024).toFixed(1) + ' MB' : ''; }

function select(j: FkJar) {
  if (selected.value === j.id) { selected.value = ''; return; }
  selected.value = j.id;
  form.value = { entry: j.entry?.[0]?.name || '', parallelism: '', args: '', savepoint: '', allowNonRestored: false };
  error.value = '';
  plan.value = null;
}
function parallelismValue(): number | null {
  const p = Number(form.value.parallelism);
  return String(form.value.parallelism).trim() && Number.isFinite(p) && p > 0 ? Math.floor(p) : null;
}

async function showPlan(j: FkJar) {
  error.value = '';
  const result = await fk.run(rest.plan(j.id, parallelismValue()), { quiet: true });
  const answer = result.ok ? restAnswer(result.output) : { body: null, error: errorText(result) };
  if (answer.error) { error.value = answer.error; plan.value = null; return; }
  plan.value = answer.body?.plan || null;
}

async function submit(j: FkJar) {
  error.value = '';
  const before = new Set(fk.jobs.value.map(x => x.jid));
  const result = await fk.run(rest.run(j.id, {
    entryClass: form.value.entry.trim(), parallelism: parallelismValue(), programArgs: form.value.args.trim(),
    savepointPath: form.value.savepoint.trim(), allowNonRestoredState: form.value.allowNonRestored && Boolean(form.value.savepoint.trim()),
  }), { quiet: true });
  const answer = result.ok ? restAnswer(result.output) : { body: null, error: errorText(result) };
  if (answer.error) { error.value = answer.error; return; }
  const jid = String(answer.body?.jobid || '') || fk.jobs.value.find(x => !before.has(x.jid))?.jid || '';
  fk.notify('success', 'Job submitted', jid);
  selected.value = '';
  if (jid) fk.go({ page: 'job', jid, tab: 'overview' });
}

async function remove(j: FkJar) {
  const yes = await fk.confirm({ title: 'Delete', message: `Are you sure you want to delete ${j.name}? Jobs already submitted from it keep running.`, yes: 'Delete', danger: true });
  if (!yes) return;
  const result = await fk.run(rest.remove(j.id), { quiet: true });
  const answer = result.ok ? restAnswer(result.output) : { body: null, error: errorText(result) };
  if (answer.error) fk.notify('error', 'Delete failed', answer.error);
  else fk.notify('success', 'Jar deleted', j.name);
  if (selected.value === j.id) selected.value = '';
}

const uploading = ref(false);
const choice = ref('');
const uploadError = ref('');
function openUpload() { uploading.value = true; choice.value = playground.value[0]?.path || ''; uploadError.value = ''; }
async function upload() {
  const result = await fk.run(rest.upload(choice.value), { quiet: true });
  const answer = result.ok ? restAnswer(result.output) : { body: null, error: errorText(result) };
  if (answer.error) { uploadError.value = answer.error; return; }
  fk.notify('success', 'Upload succeeded', choice.value.split('/').pop() || '');
  uploading.value = false;
}
</script>

<style scoped src="./fk.css"></style>
<style scoped>
.fk-jar-form-row td { background: #fafafa; }
.fk-jar-form { display: grid; grid-template-columns: minmax(0, 2fr) 140px; gap: 12px 16px; align-items: end; padding: 6px 0; }
.fk-jar-wide { grid-column: 1 / -1; }
.fk-jar-actions { display: flex; gap: 8px; justify-content: flex-end; }
.fk-jar-plan { margin-top: 12px; display: flex; flex-direction: column; gap: 8px; }
.fk-jar-plan__nodes { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
.fk-jar-plan__node { display: inline-flex; flex-direction: column; gap: 2px; padding: 8px 12px; border: 1px solid #91d5ff; background: #e6f7ff; border-radius: 2px; font-size: 13px; }
.fk-jar-plan__node small { color: var(--fk-text-3); }
.fk-jar-plan__arrow { color: var(--fk-text-3); }
.fk-jar-p { margin: 0; }
.fk-jar-pick { display: flex; gap: 10px; align-items: flex-start; padding: 10px 12px; border: 1px solid var(--fk-border-split); border-radius: 2px; cursor: pointer; }
.fk-jar-pick span { display: flex; flex-direction: column; gap: 2px; min-width: 0; overflow-wrap: anywhere; }
.fk-jar-pick small { color: var(--fk-text-3); }
.fk-jar-pick.is-on { border-color: var(--fk-primary); background: #e6f7ff; }
.fk-pre-wrap { white-space: pre-wrap; overflow-wrap: anywhere; }
@container sl-portal (max-width: 760px) {
  .fk-jar-form { grid-template-columns: minmax(0, 1fr); }
}
</style>
