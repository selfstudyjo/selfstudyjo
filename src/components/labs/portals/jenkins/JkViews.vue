<template>
  <!-- ===== New view (/newView) ===== -->
  <form v-if="r.page === 'newView'" class="jk-vw" @submit.prevent="create">
    <h1 class="jk-h1">New view</h1>
    <div class="jk-field">
      <label class="jk-label" for="jk-vw-name">Name</label>
      <input id="jk-vw-name" ref="nameInput" v-model="name" class="jk-input jk-vw__name" type="text" autocomplete="off" @input="touched = true" />
      <p v-if="touched && problem" class="jk-error">» {{ problem }}</p>
    </div>
    <div class="jk-field">
      <span class="jk-label">Type</span>
      <label class="jk-check jk-vw__type">
        <input v-model="kind" type="radio" value="list" />
        <span><strong>List View</strong><br /><span class="jk-muted">Shows items in a simple list format. You can choose which jobs are to be displayed in which view.</span></span>
      </label>
      <label class="jk-check jk-vw__type is-off">
        <input type="radio" value="my" disabled />
        <span><strong>My View</strong><br /><span class="jk-muted">This view automatically displays all the jobs that the current user has an access to. (Not available in this lab.)</span></span>
      </label>
    </div>
    <div class="jk-bottom-bar">
      <button type="submit" class="jk-btn jk-btn--primary" :disabled="Boolean(problem) || saving">Create</button>
    </div>
  </form>

  <!-- ===== Edit View (/view/NAME/configure) ===== -->
  <form v-else-if="current" class="jk-vw" @submit.prevent="save">
    <h1 class="jk-h1">{{ current.name }}</h1>
    <div class="jk-field">
      <label class="jk-label" for="jk-vw-desc">Description</label>
      <textarea id="jk-vw-desc" v-model="description" class="jk-textarea" rows="3"></textarea>
      <p class="jk-help">Shown at the top of the view.</p>
    </div>
    <h2 class="jk-h2">Job Filters</h2>
    <div class="jk-field">
      <span class="jk-label">Jobs</span>
      <div class="jk-vw__filter">
        <input v-model="filter" class="jk-input" type="search" placeholder="Filter jobs" aria-label="Filter jobs" />
        <button type="button" class="jk-btn" @click="selectAll(true)">Select all</button>
        <button type="button" class="jk-btn" @click="selectAll(false)">Clear</button>
      </div>
      <ul v-if="shownJobs.length" class="jk-vw__jobs">
        <li v-for="job in shownJobs" :key="job.name">
          <label class="jk-check"><input v-model="picked" type="checkbox" :value="job.name" /> <span>{{ job.name }}</span></label>
        </li>
      </ul>
      <p v-else class="jk-muted">{{ ctx.jobs.value.length ? 'No jobs match.' : 'There are no jobs yet.' }}</p>
    </div>
    <h2 class="jk-h2">Columns</h2>
    <p class="jk-muted">Status, Weather, Name, Last Success, Last Failure, Last Duration, Build Button.</p>
    <div class="jk-bottom-bar">
      <button type="submit" class="jk-btn jk-btn--primary" :disabled="saving || !dirty">Save</button>
      <button type="button" class="jk-btn" :disabled="saving || !dirty" @click="apply">Apply</button>
      <button type="button" class="jk-btn jk-btn--text-danger jk-vw__del" @click="actions.deleteView(current.name)"><JkIcon name="trash" />Delete View</button>
    </div>
  </form>
  <div v-else class="jk-empty">No such view.</div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';
import JkIcon from './JkIcon.vue';
import { useJk } from './jkContext';
import { useActions } from './jkActions';
import { jcli, JOB_NAME } from './jenkinsKit';

const ctx = useJk();
const actions = useActions(ctx);
const r = computed(() => ctx.route.value as any);

// ---- New view ----
const name = ref('');
const kind = ref('list');
const touched = ref(false);
const saving = ref(false);
const nameInput = ref<HTMLInputElement | null>(null);
onMounted(() => nameInput.value?.focus());

const problem = computed(() => {
  const text = name.value.trim();
  if (!text) return 'This field cannot be empty';
  if (text.toLowerCase() === 'all' || ctx.views.value.some(v => v.name === text)) return `A view already exists with the name "${text}"`;
  if (!JOB_NAME.test(text)) return `‘${text}’ is not a valid name in this lab (letters, digits, . _ -)`;
  return '';
});

async function create() {
  touched.value = true;
  if (problem.value) return;
  saving.value = true;
  const view = name.value.trim();
  try {
    const result = await ctx.run(jcli(['create-view', view]), { success: `Created the view ‘${view}’` });
    // A new List View opens on its configuration page, as in Jenkins.
    if (result.ok) ctx.go({ page: 'editView', view });
  } finally {
    saving.value = false;
  }
}

// ---- Edit View ----
const current = computed(() => ctx.views.value.find(v => v.name === r.value.view));
const description = ref('');
const picked = ref<string[]>([]);
const filter = ref('');

function load() {
  description.value = current.value?.description || '';
  picked.value = [...(current.value?.jobs || [])];
}
watch(() => r.value.view, load, { immediate: true });

const shownJobs = computed(() => {
  const needle = filter.value.trim().toLowerCase();
  return ctx.jobs.value.filter(job => !needle || job.name.toLowerCase().includes(needle));
});

function selectAll(on: boolean) {
  const names = shownJobs.value.map(job => job.name);
  picked.value = on ? [...new Set([...picked.value, ...names])] : picked.value.filter(n => !names.includes(n));
}

const added = computed(() => picked.value.filter(n => !(current.value?.jobs || []).includes(n)).sort());
const removed = computed(() => (current.value?.jobs || []).filter(n => !picked.value.includes(n)).sort());
const descChanged = computed(() => description.value !== (current.value?.description || ''));
const dirty = computed(() => descChanged.value || added.value.length > 0 || removed.value.length > 0);

async function apply(): Promise<boolean> {
  const view = current.value?.name;
  if (!view) return false;
  saving.value = true;
  try {
    const commands: string[] = [];
    if (descChanged.value) {
      commands.push(description.value.trim()
        ? jcli(['update-view', view], { '--description': description.value.trim() })
        : jcli(['update-view', view, '--no-description']));
    }
    if (added.value.length) commands.push(jcli(['add-job-to-view', view, ...added.value]));
    if (removed.value.length) commands.push(jcli(['remove-job-from-view', view, ...removed.value]));
    for (const command of commands) {
      const result = await ctx.run(command);
      if (!result.ok) return false;
    }
    ctx.notify('success', 'Saved');
    return true;
  } finally {
    saving.value = false;
  }
}

async function save() {
  const view = current.value?.name;
  if (view && await apply()) ctx.go({ page: 'dashboard', view });
}
</script>

<style scoped>
.jk-vw { max-width: 820px; }
.jk-vw__name { max-width: 480px; }
.jk-vw__type { margin-top: 6px; }
.jk-vw__type.is-off { opacity: 0.55; }
.jk-vw__filter { display: flex; gap: 8px; align-items: center; max-width: 560px; margin-bottom: 8px; }
.jk-vw__filter .jk-input { flex: 1; min-width: 0; }
.jk-vw__jobs { list-style: none; margin: 0; padding: 8px 12px; max-height: 280px; overflow: auto; border: 1px solid var(--jk-border); border-radius: 10px; max-width: 560px; }
.jk-vw__jobs li { padding: 2px 0; }
.jk-vw__del { margin-left: auto; }
@container sl-portal (max-width: 520px) {
  .jk-vw__filter { flex-wrap: wrap; }
}
</style>
