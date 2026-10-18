<template>
  <form class="jk-new" @submit.prevent="submit">
    <h1 class="jk-h1">New Item</h1>
    <div class="jk-field">
      <label class="jk-label" for="jk-new-name">Enter an item name</label>
      <input id="jk-new-name" ref="nameInput" v-model="name" class="jk-input jk-new__name" type="text"
             autocomplete="off" @input="touched = true" />
      <p v-if="touched && problem" class="jk-error">» {{ problem }}</p>
      <p v-else-if="!touched" class="jk-help">» Required field</p>
    </div>

    <h2 class="jk-new__h2">Select an item type</h2>
    <div class="jk-new__types" role="radiogroup" aria-label="Item type">
      <button v-for="type in TYPES" :key="type.id" type="button" class="jk-new__type"
              :class="{ 'is-selected': kind === type.id }" role="radio" :aria-checked="kind === type.id"
              @click="kind = type.id; copyFrom = ''">
        <span class="jk-new__icon"><JkIcon :name="type.icon" /></span>
        <span class="jk-new__text">
          <span class="jk-new__title">{{ type.label }}</span>
          <span class="jk-new__desc">{{ type.desc }}</span>
        </span>
      </button>
    </div>

    <div v-if="jobs.length" class="jk-field jk-new__copy">
      <label class="jk-label" for="jk-new-copy">If you want to create a new item from other existing, you can use this option:</label>
      <div class="jk-new__copy-row">
        <span class="jk-new__copy-label">Copy from</span>
        <input id="jk-new-copy" v-model="copyFrom" class="jk-input" type="text" list="jk-new-copy-list"
               placeholder="Type to autocomplete" @input="onCopy" />
        <datalist id="jk-new-copy-list"><option v-for="job in jobs" :key="job.name" :value="job.name" /></datalist>
      </div>
      <p v-if="copyFrom && !ctx.job(copyFrom)" class="jk-error">» No such job: {{ copyFrom }}</p>
    </div>

    <div class="jk-bottom-bar">
      <button type="submit" class="jk-btn jk-btn--primary jk-new__ok" :disabled="!ready || submitting">OK</button>
    </div>
  </form>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import JkIcon from './JkIcon.vue';
import { useJk } from './jkContext';
import { jcli, nameProblem } from './jenkinsKit';

const ctx = useJk();
const jobs = computed(() => ctx.jobs.value);
const name = ref('');
const kind = ref('');
const copyFrom = ref('');
const touched = ref(false);
const submitting = ref(false);
const nameInput = ref<HTMLInputElement | null>(null);

onMounted(() => nameInput.value?.focus());

const TYPES = [
  { id: 'freestyle', label: 'Freestyle project', icon: 'freestyle',
    desc: 'Classic, general-purpose job type that checks out from up to one SCM, executes build steps serially, followed by post-build steps like archiving artifacts and sending email notifications.' },
  { id: 'pipeline', label: 'Pipeline', icon: 'pipeline',
    desc: 'Orchestrates long-running activities that can span multiple build agents. Suitable for building pipelines (formerly known as workflows) and/or organizing complex activities that do not easily fit in free-style job type.' },
  { id: 'folder', label: 'Folder', icon: 'folder',
    desc: 'Creates a container that stores nested items in it. Useful for grouping things together. Unlike view, which is just a filter, a folder creates a separate namespace, so you can have multiple things of the same name as long as they are in different folders.' },
  { id: 'multibranch', label: 'Multibranch Pipeline', icon: 'branch',
    desc: 'Creates a set of Pipeline projects according to detected branches in one SCM repository.' },
];

const problem = computed(() => nameProblem(name.value, jobs.value));
const ready = computed(() => !problem.value && (Boolean(kind.value) || Boolean(copyFrom.value && ctx.job(copyFrom.value))));

function onCopy() {
  if (copyFrom.value) kind.value = '';
}

async function submit() {
  touched.value = true;
  if (!ready.value) return;
  submitting.value = true;
  const item = name.value.trim();
  try {
    if (copyFrom.value) {
      const result = await ctx.run(jcli(['copy-job', copyFrom.value, item]), { success: `Created ‘${item}’ from ‘${copyFrom.value}’` });
      if (result.ok) ctx.go({ page: 'configure', job: item });
      return;
    }
    if (kind.value === 'pipeline') {
      // A Pipeline in this lab reads the repository's Jenkinsfile ("Pipeline
      // script from SCM"), which is the file every task grades; with no
      // Jenkinsfile in the repository it starts as an empty inline script.
      let result = await ctx.run(jcli(['create-job', item]), { quiet: true });
      if (!result.ok && /does not exist/.test(String(result.error || ''))) {
        result = await ctx.run(jcli(['create-job', item], { '--inline': true }));
      } else if (!result.ok) {
        ctx.notify('error', 'The item could not be created', String(result.error || result.output || ''));
      }
      if (result.ok) {
        ctx.notify('success', `Created Pipeline ‘${item}’`);
        ctx.go({ page: 'configure', job: item });
      }
      return;
    }
    const result = await ctx.run(jcli(['create-job', item], { '--type': kind.value }),
                                 { success: `Created ‘${item}’` });
    if (result.ok) ctx.go({ page: kind.value === 'folder' ? 'job' : 'configure', job: item });
  } finally {
    submitting.value = false;
  }
}
</script>

<style scoped>
.jk-new { max-width: 960px; }
.jk-new__name { max-width: 544px; font-size: 16px; }
.jk-new__h2 { font-size: 16px; font-weight: 650; margin: 24px 0 12px; }
.jk-new__types { display: flex; flex-direction: column; gap: 2.4px; }
.jk-new__type {
  display: flex; align-items: flex-start; gap: 16px; padding: 13.6px 16px; text-align: left;
  border: 2px solid transparent; border-radius: 12.8px; background: none; font: inherit; color: var(--jk-text); cursor: pointer;
}
.jk-new__type:hover { background: var(--jk-btn-bg); }
.jk-new__type.is-selected { background: rgba(11, 102, 228, 0.08); border-color: var(--jk-accent); }
.jk-new__icon { flex: none; display: grid; place-items: center; width: 48px; height: 48px; border-radius: 11.2px; background: var(--jk-btn-bg); }
.jk-new__icon .jk-icon { width: 28.8px; height: 28.8px; }
.jk-new__text { display: flex; flex-direction: column; gap: 2.4px; min-width: 0; }
.jk-new__title { font-weight: 650; font-size: 15.2px; }
.jk-new__desc { color: var(--jk-secondary); font-size: 13px; line-height: 1.5; }
.jk-new__copy { margin-top: 28.8px; }
.jk-new__copy .jk-label { font-weight: 500; }
.jk-new__copy-row { display: flex; align-items: center; gap: 12px; max-width: 544px; }
.jk-new__copy-label { white-space: nowrap; font-weight: 600; }
.jk-new__ok { min-width: 88px; }
@container sl-portal (max-width: 520px) {
  .jk-new__type { gap: 11.2px; padding: 11.2px; }
  .jk-new__icon { width: 38.4px; height: 38.4px; }
  .jk-new__copy-row { flex-direction: column; align-items: stretch; gap: 4.8px; }
}
</style>
