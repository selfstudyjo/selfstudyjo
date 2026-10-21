<template>
  <div class="nr-back" @keydown.esc="$emit('close')">
    <form class="nr" role="dialog" aria-modal="true" aria-label="Start a new run" @submit.prevent="start">
      <div class="nr__head">
        <h2 class="nr__title">Start a new run</h2>
        <button type="button" class="nr__x" aria-label="Dismiss" @click="$emit('close')"><TfIcon name="x" /></button>
      </div>
      <div class="nr__body">
        <div class="tf-field">
          <label class="tf-label" for="nr-reason">Reason for starting run <span class="tf-label__opt">(optional)</span></label>
          <textarea id="nr-reason" v-model="reason" class="tf-textarea nr__reason" maxlength="500" placeholder="I'm going to..."></textarea>
          <p class="tf-help">Added to the run as a comment.</p>
        </div>

        <fieldset class="nr__types">
          <legend class="tf-label">Choose run type</legend>
          <label v-for="option in options" :key="option.id" class="nr__type" :class="{ 'is-checked': kind === option.id }">
            <input v-model="kind" type="radio" name="nr-kind" :value="option.id" />
            <span>
              <span class="nr__type-name">{{ option.name }}</span>
              <span class="nr__type-sub">{{ option.sub }}</span>
            </span>
          </label>
        </fieldset>

        <details v-if="kind !== 'destroy' && resources.length" class="nr__extra">
          <summary>Additional planning options</summary>
          <div class="nr__replace">
            <span class="tf-label">Replace resources</span>
            <p class="tf-help">Force the selected resources to be destroyed and recreated (<code class="tf-mono">-replace</code>).</p>
            <label v-for="resource in resources" :key="resource.address" class="tf-check nr__res">
              <input v-model="replace" type="checkbox" :value="resource.address" />
              <span class="tf-mono">{{ resource.address }}</span>
            </label>
          </div>
        </details>

        <div v-if="!initialised" class="tf-alert tf-alert--info nr__note">
          <TfIcon name="info" />
          <div>The working directory has not been initialized yet - HCP Terraform runs <code class="tf-mono">terraform init</code> before the plan.</div>
        </div>
        <div v-if="workspace?.auto_apply && kind !== 'plan'" class="tf-alert tf-alert--info nr__note">
          <TfIcon name="info" />
          <div><span class="tf-alert__title">Auto-apply is on</span>A successful plan is applied without waiting for confirmation (Settings &gt; General &gt; Apply Method).</div>
        </div>
        <div v-if="locked" class="tf-alert tf-alert--warning nr__note">
          <TfIcon name="lock" />
          <div><span class="tf-alert__title">This workspace is locked</span>A run cannot acquire the state lock until the workspace is unlocked.</div>
        </div>
      </div>
      <div class="nr__foot">
        <button type="submit" class="tf-btn tf-btn--primary" :disabled="busy">Start</button>
        <button type="button" class="tf-btn tf-btn--secondary" @click="$emit('close')">Cancel</button>
      </div>
    </form>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import { pick, rows } from '@/utils/portalKit';
import TfIcon from './TfIcon.vue';
import { useTf } from './tfContext';
import { cmdComment, cmdPlan } from './tfKit';

const props = withDefaults(defineProps<{ initial?: 'apply' | 'plan' | 'destroy' }>(), { initial: 'apply' });
const emit = defineEmits<{ (event: 'close'): void }>();

const { view, workspace, runs, run, ensureInit, maybeAutoApply, go, busy } = useTf();
const reason = ref('');
const kind = ref<'apply' | 'plan' | 'destroy'>(props.initial);
const replace = ref<string[]>([]);
const resources = computed(() => rows<{ address: string }>(view.value, 'state.resources'));
const initialised = computed(() => Boolean(pick(view.value, 'initialised', false)));
const locked = computed(() => Boolean(workspace.value?.locked));

const options = [
  { id: 'apply', name: 'Plan and apply (standard)', sub: 'Plan and wait for confirmation before applying the changes.' },
  { id: 'plan', name: 'Plan only', sub: 'Run a speculative plan. It cannot be applied.' },
  { id: 'destroy', name: 'Destroy', sub: 'Plan to destroy every resource in the workspace, then confirm it.' },
] as const;

async function start() {
  if (!workspace.value) return;
  if (!(await ensureInit())) return;
  const before = runs.value.length ? runs.value[0].id : '';
  const label = kind.value === 'plan' ? 'Plan only run queued' : kind.value === 'destroy' ? 'Destroy run queued' : 'Run queued';
  const result = await run(cmdPlan(kind.value, kind.value === 'destroy' ? [] : replace.value), { success: label, failure: 'Run errored' });
  const latest = runs.value.find(item => item.workspace === workspace.value?.name);
  if (latest && latest.id !== before) {
    if (reason.value.trim()) await run(cmdComment(latest.id, reason.value.trim()), { quiet: true });
    await maybeAutoApply(latest.id);
    emit('close');
    go({ page: 'run', ws: workspace.value.name, id: latest.id });
  } else if (result.ok) {
    emit('close');
  }
}
</script>

<style scoped src="./tfBase.css"></style>
<style scoped>
.nr-back { position: absolute; inset: 0; z-index: 55; display: grid; place-items: center; padding: 16px; background: rgba(59, 61, 69, 0.4); }
.nr { width: min(600px, 100%); max-height: 100%; display: flex; flex-direction: column; background: #fff; border-radius: 8px; box-shadow: 0 16px 32px rgba(59,61,69,.3); overflow: hidden; }
.nr__head { display: flex; align-items: center; padding: 16px 20px; border-bottom: 1px solid var(--tf-border); background: var(--tf-surface-faint); }
.nr__title { flex: 1; font-size: 18px; line-height: 24px; }
.nr__x { padding: 4px; border-radius: 4px; }
.nr__x:hover { background: rgba(0,0,0,.06); }
.nr__body { padding: 20px; overflow-y: auto; }
.nr__reason { min-height: 64px; }
.nr__types { border: 0; padding: 0; margin: 0 0 16px; display: flex; flex-direction: column; gap: 8px; }
.nr__types legend { margin-bottom: 8px; }
.nr__type { display: flex; gap: 10px; align-items: flex-start; padding: 12px; border: 1px solid var(--tf-border); border-radius: 6px; cursor: pointer; }
.nr__type.is-checked { border-color: var(--tf-fg-action); background: var(--tf-surface-action); }
.nr__type input { width: 16px; height: 16px; flex: none; margin-top: 3px; accent-color: var(--tf-btn-primary); }
.nr__type-name { display: block; font-weight: 500; color: var(--tf-fg-strong); }
.nr__type-sub { display: block; font-size: 13px; color: var(--tf-fg-faint); }
.nr__extra { border: 1px solid var(--tf-border); border-radius: 6px; padding: 10px 12px; margin-bottom: 12px; }
.nr__extra summary { cursor: pointer; font-weight: 500; color: var(--tf-fg-strong); }
.nr__replace { margin-top: 10px; display: flex; flex-direction: column; gap: 6px; }
.nr__res { font-size: 13px; }
.nr__note { margin-top: 8px; }
.nr__foot { display: flex; gap: 8px; padding: 16px 20px; border-top: 1px solid var(--tf-border); background: var(--tf-surface-faint); }
</style>
