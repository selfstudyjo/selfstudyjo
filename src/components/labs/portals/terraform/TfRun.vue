<template>
  <div v-if="workspace" class="tf-page">
    <a href="#" class="rd-back" @click.prevent="go({ page: 'runs', ws: workspace.name })">
      <TfIcon name="arrow-left" :size="14" /> Runs
    </a>
    <div v-if="!item" class="tf-card tf-empty">
      <div class="tf-empty__title">Run not found</div>
      The run {{ route.id }} is not in this workspace's recent runs.
    </div>
    <template v-else>
      <div class="rd-head">
        <div class="rd-head__main">
          <div class="rd-head__row">
            <TfStatus :status="item.status" />
            <h1 class="tf-display rd-title">{{ title }}</h1>
          </div>
          <div class="rd-head__meta">
            <span class="tf-mono">{{ item.id }}</span>
            <span>·</span><span>{{ operationLabel(item.operation) }}</span>
            <span>·</span><span>Terraform v{{ item.version || workspace.version }}</span>
            <span>·</span><span>{{ longDate(item.created_at) }}</span>
          </div>
        </div>
        <div class="rd-head__actions">
          <button v-if="item.status === 'planned'" type="button" class="tf-btn tf-btn--secondary" @click="startDiscard">Discard run</button>
          <button type="button" class="tf-btn tf-btn--secondary" @click="openComment">
            <TfIcon name="message" /> Add comment
          </button>
        </div>
      </div>

      <ol class="tl">
        <!-- Triggered -->
        <li class="tl__item">
          <span class="tl__dot tl__dot--neutral"><span class="tl__avatar">S</span></span>
          <div class="tl__card tl__card--plain">
            <div class="tl__line">
              <strong>selfstudy-student</strong> triggered a run from CLI
              <span class="tf-faint">{{ ago(item.created_at, now) }}</span>
            </div>
            <code class="tf-mono tl__cmd">$ {{ item.command }}</code>
          </div>
        </li>

        <!-- Plan -->
        <li class="tl__item">
          <span class="tl__dot" :class="'tl__dot--' + planTone"><TfIcon :name="planIcon" :size="14" /></span>
          <div class="tl__card tf-card">
            <button type="button" class="tl__head" :aria-expanded="planOpen" @click="planOpen = !planOpen">
              <div class="tl__head-main">
                <span class="tl__head-title">{{ planHeading }}</span>
                <span v-if="item.status !== 'errored'" class="tf-faint tf-small">
                  Resources: {{ item.counts.add }} to add, {{ item.counts.change }} to change, {{ item.counts.destroy }} to destroy
                </span>
              </div>
              <span class="tf-faint tf-small tl__when">{{ ago(item.plan_finished_at || item.created_at, now) }}</span>
              <TfIcon :name="planOpen ? 'chevron-up' : 'chevron-down'" class="tl__chev" />
            </button>
            <div v-if="planOpen" class="tl__body">
              <div v-if="item.status === 'errored'" class="tf-alert tf-alert--critical">
                <TfIcon name="x-circle" />
                <div class="rd-err"><span class="tf-alert__title">Error</span><pre class="rd-err__pre">{{ item.error }}</pre></div>
              </div>
              <template v-else>
                <div v-if="item.replace?.length" class="tf-alert tf-alert--info rd-mb">
                  <TfIcon name="refresh" />
                  <div>Replace requested for {{ item.replace.join(', ') }}</div>
                </div>
                <TfPlanDiff :actions="item.actions || []" :counts="item.counts" />
                <div class="rd-logbar">
                  <button type="button" class="tf-link-btn" @click="planLog = !planLog">{{ planLog ? 'Hide raw log' : 'View raw log' }}</button>
                </div>
                <pre v-if="planLog" class="tf-code tf-log rd-log">{{ item.plan_log }}</pre>
              </template>
            </div>
          </div>
        </li>

        <!-- Apply -->
        <li v-if="applyState" class="tl__item">
          <span class="tl__dot" :class="'tl__dot--' + applyState.tone"><TfIcon :name="applyState.icon" :size="14" /></span>
          <div class="tl__card tf-card" :class="{ 'tl__card--warning': item.status === 'planned' }">
            <div class="tl__head tl__head--static">
              <div class="tl__head-main">
                <span class="tl__head-title">{{ applyState.title }}</span>
                <span class="tf-faint tf-small">{{ applyState.sub }}</span>
              </div>
              <span v-if="applyState.when" class="tf-faint tf-small tl__when">{{ ago(applyState.when, now) }}</span>
            </div>

            <!-- Needs confirmation -->
            <div v-if="item.status === 'planned'" class="tl__body">
              <div class="tf-alert tf-alert--warning">
                <TfIcon name="alert-circle" />
                <div>
                  <span class="tf-alert__title">Needs Confirmation</span>
                  Check the plan and confirm to apply it, or discard the run.
                </div>
              </div>
              <div v-if="!mode" class="rd-confirm">
                <button type="button" class="tf-btn tf-btn--primary" :disabled="busy" @click="mode = 'apply'">Confirm &amp; apply</button>
                <button type="button" class="tf-btn tf-btn--secondary" :disabled="busy" @click="startDiscard">Discard run</button>
                <button type="button" class="tf-btn tf-btn--tertiary" @click="openComment">Add comment</button>
              </div>
              <form v-else class="rd-form" @submit.prevent="mode === 'apply' ? confirmApply() : discard()">
                <label class="tf-label" for="rd-c">Comment <span class="tf-label__opt">(optional)</span></label>
                <textarea id="rd-c" ref="commentBox" v-model="comment" class="tf-textarea" maxlength="2000"
                          :placeholder="mode === 'apply' ? 'Leave a comment about this apply' : 'Why is this run being discarded?'"></textarea>
                <div class="rd-confirm">
                  <button v-if="mode === 'apply'" type="submit" class="tf-btn tf-btn--primary" :disabled="busy">Confirm plan</button>
                  <button v-else type="submit" class="tf-btn tf-btn--critical-solid" :disabled="busy">Discard run</button>
                  <button type="button" class="tf-btn tf-btn--secondary" @click="mode = ''">Cancel</button>
                </div>
              </form>
            </div>

            <!-- Applied -->
            <div v-else-if="item.status === 'applied'" class="tl__body">
              <div class="rd-logbar">
                <button type="button" class="tf-link-btn" @click="applyLog = !applyLog">{{ applyLog ? 'Hide raw log' : 'View raw log' }}</button>
              </div>
              <pre v-if="applyLog" class="tf-code tf-log rd-log">{{ item.apply_log }}</pre>
            </div>

            <!-- Discarded -->
            <div v-else-if="item.status === 'discarded' && item.discard_reason" class="tl__body">
              <p class="tf-faint">{{ item.discard_reason }}</p>
            </div>
          </div>
        </li>

        <!-- Comments -->
        <li v-for="(entry, index) in item.comments || []" :key="'c' + index" class="tl__item">
          <span class="tl__dot tl__dot--neutral"><TfIcon name="message" :size="14" /></span>
          <div class="tl__card tf-card rd-comment">
            <div class="tl__line"><strong>{{ entry.user }}</strong> commented <span class="tf-faint">{{ ago(entry.at, now) }}</span></div>
            <p class="rd-comment__body">{{ entry.body }}</p>
          </div>
        </li>

        <!-- Final -->
        <li class="tl__item tl__item--end">
          <span class="tl__dot" :class="'tl__dot--' + finalTone"><TfIcon :name="finalIcon" :size="14" /></span>
          <div class="tl__card tl__card--plain"><strong>{{ finalText }}</strong></div>
        </li>
      </ol>

      <form v-if="commenting" class="tf-card rd-addc" @submit.prevent="addComment">
        <label class="tf-label" for="rd-addc">Add a comment</label>
        <textarea id="rd-addc" ref="commentBox2" v-model="newComment" class="tf-textarea" maxlength="2000" placeholder="Leave a comment"></textarea>
        <div class="rd-confirm">
          <button type="submit" class="tf-btn tf-btn--primary" :disabled="busy || !newComment.trim()">Comment</button>
          <button type="button" class="tf-btn tf-btn--secondary" @click="commenting = false">Cancel</button>
        </div>
      </form>
    </template>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, ref } from 'vue';
import TfIcon from './TfIcon.vue';
import TfStatus from './TfStatus.vue';
import TfPlanDiff from './TfPlanDiff.vue';
import { useTf } from './tfContext';
import { ago, cmdComment, cmdConfirm, cmdDiscard, longDate, operationLabel } from './tfKit';

const { workspace, runs, route, go, now, run, busy } = useTf();
const item = computed(() => runs.value.find(entry => entry.id === route.value.id) || null);
const planOpen = ref(true);
const planLog = ref(false);
const applyLog = ref(false);
const mode = ref<'' | 'apply' | 'discard'>('');
const comment = ref('');
const commenting = ref(false);
const newComment = ref('');
const commentBox2 = ref<HTMLTextAreaElement | null>(null);

const title = computed(() => {
  const value = item.value;
  if (!value) return '';
  if (value.comments?.length) return value.comments[0].body;
  if (value.operation === 'destroy') return 'Queued destroy plan';
  if (value.operation === 'plan_only') return 'Speculative plan';
  return 'Triggered via CLI';
});

const planTone = computed(() => item.value?.status === 'errored' ? 'critical' : 'success');
const planIcon = computed(() => item.value?.status === 'errored' ? 'x-circle' : 'check-circle');
const planHeading = computed(() => {
  const value = item.value;
  if (!value) return '';
  if (value.status === 'errored') return 'Plan errored';
  if (!value.has_changes) return 'Plan finished - no changes';
  return 'Plan finished';
});

const applyState = computed(() => {
  const value = item.value;
  if (!value || value.status === 'errored') return null;
  if (value.status === 'planned') {
    return { tone: 'warning', icon: 'alert-circle', title: 'Apply pending', sub: 'Waiting for confirmation', when: '' };
  }
  if (value.status === 'applied') {
    return {
      tone: 'success', icon: 'check-circle', title: 'Apply finished',
      sub: `Resources: ${value.counts.add} added, ${value.counts.change} changed, ${value.counts.destroy} destroyed`,
      when: value.applied_at || '',
    };
  }
  if (value.status === 'discarded') {
    return { tone: 'neutral', icon: 'skip', title: 'Apply discarded', sub: 'The run was discarded and will not be applied.', when: value.discarded_at || '' };
  }
  if (value.operation === 'plan_only' && value.has_changes) {
    return { tone: 'neutral', icon: 'minus-circle', title: 'Apply will not run', sub: 'This was a plan-only run; it cannot be applied.', when: '' };
  }
  return null;
});

const finalText = computed(() => {
  const value = item.value;
  if (!value) return '';
  if (value.status === 'applied') return 'Run applied';
  if (value.status === 'errored') return 'Run errored';
  if (value.status === 'discarded') return 'Run discarded';
  if (value.status === 'planned') return 'Waiting for confirmation';
  return value.has_changes ? 'Planned and finished' : 'Planned and finished - no changes';
});
const finalTone = computed(() => ({ applied: 'success', errored: 'critical', discarded: 'neutral', planned: 'warning' } as Record<string, string>)[item.value?.status || ''] || 'success');
const finalIcon = computed(() => ({ applied: 'check-circle', errored: 'x-circle', discarded: 'skip', planned: 'clock' } as Record<string, string>)[item.value?.status || ''] || 'check-circle');

async function confirmApply() {
  const value = item.value;
  if (!value) return;
  if (comment.value.trim()) await run(cmdComment(value.id, comment.value.trim()), { quiet: true });
  const result = await run(cmdConfirm(value), {
    success: value.operation === 'destroy' ? 'Destroy applied' : 'Apply finished', failure: 'Apply errored',
  });
  if (result.ok) { mode.value = ''; comment.value = ''; }
}

function startDiscard() {
  mode.value = 'discard';
}

async function discard() {
  const value = item.value;
  if (!value) return;
  const result = await run(cmdDiscard(value.id, comment.value.trim()), { success: 'Run discarded', failure: 'Run could not be discarded' });
  if (result.ok) { mode.value = ''; comment.value = ''; }
}

function openComment() {
  commenting.value = true;
  nextTick(() => commentBox2.value?.focus());
}

async function addComment() {
  const value = item.value;
  if (!value || !newComment.value.trim()) return;
  const result = await run(cmdComment(value.id, newComment.value.trim()), { success: 'Comment added' });
  if (result.ok) { newComment.value = ''; commenting.value = false; }
}
</script>

<style scoped src="./tfBase.css"></style>
<style scoped>
.rd-back { display: inline-flex; align-items: center; gap: 4px; font-size: 13px; margin-bottom: 12px; }
.rd-head { display: flex; justify-content: space-between; gap: 16px; flex-wrap: wrap; margin-bottom: 24px; }
.rd-head__main { min-width: 0; }
.rd-head__row { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
.rd-title { overflow-wrap: anywhere; }
.rd-head__meta { display: flex; gap: 6px; flex-wrap: wrap; margin-top: 6px; font-size: 13px; color: var(--tf-fg-faint); }
.rd-head__actions { display: flex; gap: 8px; align-items: flex-start; }
.tl { position: relative; display: flex; flex-direction: column; gap: 16px; padding-left: 40px; max-width: 980px; }
.tl::before { content: ''; position: absolute; left: 13px; top: 8px; bottom: 8px; width: 2px; background: var(--tf-surface-strong); }
.tl__item { position: relative; }
.tl__dot { position: absolute; left: -40px; top: 10px; display: inline-grid; place-items: center; width: 28px; height: 28px; border-radius: 50%; border: 2px solid #fff; background: var(--tf-surface-strong); color: var(--tf-fg-primary); }
.tl__dot--success { background: #d5f4e0; color: #00781e; }
.tl__dot--warning { background: #fbeabf; color: #9e4b00; }
.tl__dot--critical { background: #fbd4d4; color: #c00005; }
.tl__dot--neutral { background: var(--tf-surface-strong); color: var(--tf-fg-primary); }
.tl__avatar { display: inline-grid; place-items: center; width: 22px; height: 22px; border-radius: 50%; background: var(--tf-brand); color: #fff; font-size: 12px; font-weight: 600; }
.tl__card--plain { padding: 12px 0; }
.tl__card--warning { border-color: #fbeabf; }
.tl__line { display: flex; gap: 6px; flex-wrap: wrap; align-items: baseline; }
.tl__cmd { display: inline-block; margin-top: 6px; padding: 2px 8px; border-radius: 4px; background: var(--tf-surface-strong); font-size: 12px; color: var(--tf-fg-primary); overflow-wrap: anywhere; white-space: pre-wrap; }
.tl__head { display: flex; align-items: center; gap: 12px; width: 100%; padding: 14px 16px; text-align: left; }
.tl__head:not(.tl__head--static):hover { background: var(--tf-surface-faint); }
.tl__head-main { display: flex; flex-direction: column; flex: 1; min-width: 0; }
.tl__head-title { font-weight: 600; color: var(--tf-fg-strong); font-size: 15px; }
.tl__when { white-space: nowrap; }
.tl__chev { color: var(--tf-fg-faint); }
.tl__body { padding: 0 16px 16px; display: flex; flex-direction: column; gap: 12px; }
.rd-mb { margin-bottom: 0; }
.rd-logbar { display: flex; justify-content: flex-end; }
.rd-log { max-height: 420px; white-space: pre; }
.rd-err { min-width: 0; }
.rd-err__pre { font-family: var(--tf-mono); font-size: 12px; white-space: pre-wrap; overflow-wrap: anywhere; color: var(--tf-fg-primary); margin-top: 4px; }
.rd-confirm { display: flex; gap: 8px; flex-wrap: wrap; }
.rd-form { display: flex; flex-direction: column; gap: 8px; }
.rd-comment { padding: 12px 16px; }
.rd-comment__body { margin-top: 4px; white-space: pre-wrap; overflow-wrap: anywhere; color: var(--tf-fg-strong); }
.rd-addc { padding: 16px; margin-top: 16px; max-width: 980px; display: flex; flex-direction: column; gap: 8px; }
@container sl-portal (max-width: 600px) {
  .tl { padding-left: 32px; }
  .tl::before { left: 9px; }
  .tl__dot { left: -32px; width: 22px; height: 22px; }
}
</style>
