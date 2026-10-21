<template>
  <JiraModal v-if="issue" :title="title" width="small" @close="$emit('close')">
    <!-- Labels -->
    <form v-if="kind === 'labels'" id="jid-form" @submit.prevent="saveLabels">
      <div class="j-field">
        <label class="j-label" for="jid-label">Labels</label>
        <div class="jid__chips">
          <span v-for="label in draft" :key="label" class="jid__chip">
            {{ label }}
            <button type="button" class="jid__chip-x" :aria-label="'Remove ' + label" @click="removeDraft(label)">
              <JiraIcon name="close" :size="10" /></button>
          </span>
          <input id="jid-label" v-model="text" class="jid__chip-input" list="jid-label-list" autocomplete="off"
                 placeholder="Type a label and press Enter" @keydown.enter.prevent="addDraft"
                 @keydown.backspace="!text && draft.length && draft.pop()" />
          <datalist id="jid-label-list">
            <option v-for="label in known" :key="label" :value="label" />
          </datalist>
        </div>
        <span class="j-help">Labels group work across the project. They don't contain spaces.</span>
      </div>
    </form>

    <!-- Link work item -->
    <form v-else-if="kind === 'link'" id="jid-form" @submit.prevent="saveLink">
      <div class="j-grid2">
        <div class="j-field"><label class="j-label" for="jid-ltype">{{ issue.id }}</label>
          <select id="jid-ltype" v-model="linkType" class="j-select">
            <option v-for="t in LINK_TYPES" :key="t.value" :value="t.value">{{ t.label }}</option>
          </select></div>
        <div class="j-field"><label class="j-label" for="jid-lissue">Work item<span class="j-req">*</span></label>
          <select id="jid-lissue" v-model="linkTo" class="j-select">
            <option value="" disabled>Search for work items</option>
            <option v-for="row in candidates" :key="row.id" :value="row.id">{{ row.id }} {{ row.title }}</option>
          </select></div>
      </div>
      <p class="j-small">A link records a relationship. Linking a blocker does not schedule it — it still has to be planned into a sprint.</p>
    </form>

    <!-- Add flag -->
    <form v-else id="jid-form" @submit.prevent="saveFlag">
      <p class="jid__flag-intro"><JiraIcon name="flag" class="jid__flag" /> Flag {{ issue.id }} as impeded so the team sees it is blocked.</p>
      <div class="j-field"><label class="j-label" for="jid-reason">Add a comment (optional)</label>
        <textarea id="jid-reason" v-model="reason" class="j-textarea" rows="3" placeholder="Why is it blocked?" /></div>
    </form>

    <template #footer>
      <button type="button" class="j-btn j-btn--subtle" @click="$emit('close')">Cancel</button>
      <button type="submit" form="jid-form" class="j-btn j-btn--primary" :disabled="!canSave || busy">{{ action }}</button>
    </template>
  </JiraModal>
</template>

<script setup lang="ts">
/** The three dialogs the card menu opens from any page: labels, link work item, add flag. */
import { computed, ref, watch } from 'vue';
import JiraModal from './JiraModal.vue';
import JiraIcon from './JiraIcon.vue';
import { LINK_TYPES, type IssueDialogKind } from './jiraKit';
import { useJira } from './useJira';

const props = defineProps<{ kind: IssueDialogKind; issueKey: string }>();
const emit = defineEmits<{ (event: 'close'): void }>();
const { ctx, all, labels, linkIssue, setFlag } = useJira();
const busy = ctx.busy;

const issue = computed(() => all.value.find(row => row.id === props.issueKey) || null);
const title = computed(() => props.kind === 'labels' ? `Labels · ${props.issueKey}`
  : props.kind === 'link' ? `Link work item · ${props.issueKey}` : `Add flag · ${props.issueKey}`);
const action = computed(() => props.kind === 'labels' ? 'Save' : props.kind === 'link' ? 'Link' : 'Add flag');

const draft = ref<string[]>([]);
const text = ref('');
watch(issue, row => { if (row && !draft.value.length) draft.value = [...row.labels]; }, { immediate: true });
const known = computed(() => Array.from(new Set(all.value.flatMap(row => row.labels)))
  .filter(label => !draft.value.includes(label)).sort());

function addDraft() {
  const parts = text.value.split(/[,\s]+/).map(part => part.trim()).filter(Boolean);
  for (const part of parts) if (!draft.value.includes(part)) draft.value.push(part.slice(0, 60));
  text.value = '';
}
function removeDraft(label: string) { draft.value = draft.value.filter(item => item !== label); }

const linkType = ref('blocks');
const linkTo = ref('');
const candidates = computed(() => {
  const linked = new Set((issue.value?.links || []).map(l => l.key));
  return all.value.filter(row => row.id !== props.issueKey && !linked.has(row.id));
});

const reason = ref('');

const canSave = computed(() => props.kind === 'link' ? Boolean(linkTo.value) : true);

async function saveLabels() {
  if (text.value.trim()) addDraft();
  const row = issue.value!;
  const add = draft.value.filter(label => !row.labels.includes(label));
  const remove = row.labels.filter(label => !draft.value.includes(label));
  if (await labels(row, add, remove)) emit('close');
}
async function saveLink() {
  if (await linkIssue(issue.value!, linkTo.value, linkType.value)) emit('close');
}
async function saveFlag() {
  if (await setFlag(issue.value!, true, reason.value.trim())) emit('close');
}
</script>

<style scoped>
.jid__chips {
  display: flex; flex-wrap: wrap; gap: 4px; align-items: center; min-height: 36px; padding: 4px 6px;
  border: 1px solid var(--j-border-input); border-radius: 3px; background: var(--j-surface);
}
.jid__chips:focus-within { border-color: var(--j-focus); box-shadow: inset 0 0 0 1px var(--j-focus); }
.jid__chip { display: inline-flex; align-items: center; gap: 2px; padding: 0 2px 0 6px; height: 22px; border-radius: 3px;
  background: var(--j-neutral); font-size: 12px; }
.jid__chip-x { display: inline-grid; place-items: center; width: 18px; height: 18px; border: 0; border-radius: 2px; background: none; cursor: pointer; color: var(--j-text-subtle); }
.jid__chip-x:hover { background: var(--j-neutral-hover); }
.jid__chip-input { flex: 1; min-width: 120px; border: 0; outline: none; background: transparent; font: inherit; padding: 4px; }
.jid__flag-intro { display: flex; align-items: center; gap: 8px; margin: 0 0 12px; }
.jid__flag { color: #C9372C; }
</style>
