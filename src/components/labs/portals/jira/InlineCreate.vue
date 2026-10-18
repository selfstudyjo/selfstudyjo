<template>
  <button v-if="!open" type="button" class="ic__open" @click="begin">
    <JiraIcon name="plus" /> Create issue
  </button>
  <form v-else class="ic" @submit.prevent="create">
    <JiraDropdown :items="types" :selected="type" label="Issue type" trigger-class="ic__type"
                  @select="v => type = v">
      <template #trigger><JiraIcon :name="type" kind="type" /><JiraIcon name="chevron-down" :size="12" /></template>
    </JiraDropdown>
    <input ref="field" v-model="title" class="ic__input" type="text" maxlength="255"
           placeholder="What needs to be done?" aria-label="What needs to be done?"
           @keydown.esc.prevent="cancel" @keydown.enter.prevent="create" />
    <span class="ic__hint">Enter to create · Esc to cancel</span>
    <button type="submit" class="j-btn j-btn--primary j-btn--compact" :disabled="!title.trim() || saving">Create</button>
  </form>
</template>

<script setup lang="ts">
/** Jira's inline "+ Create issue" at the foot of a backlog container. */
import { nextTick, ref } from 'vue';
import { cli } from '@/utils/portalKit';
import JiraIcon from './JiraIcon.vue';
import JiraDropdown, { type DropItem } from './JiraDropdown.vue';
import { createdKey } from './jiraKit';
import { useJira } from './useJira';

const props = defineProps<{ toSprint: boolean }>();
const { ctx, addToSprint } = useJira();

const open = ref(false);
const title = ref('');
const type = ref('story');
const saving = ref(false);
const field = ref<HTMLInputElement | null>(null);
const types: DropItem[] = [{ label: 'Story', value: 'story' }, { label: 'Task', value: 'task' },
  { label: 'Bug', value: 'bug' }];

function begin() {
  open.value = true;
  nextTick(() => field.value?.focus());
}

function cancel() {
  open.value = false;
  title.value = '';
}

async function create() {
  const summary = title.value.trim();
  if (!summary || saving.value) return;
  saving.value = true;
  try {
    const result = await ctx.exec(cli(['mgr', 'backlog', 'add'], { '--title': summary, '--type': type.value }), {
      success: '',
    });
    if (!result.ok) return;
    const key = createdKey(result);
    if (props.toSprint && key) await addToSprint([key]);
    else ctx.flag('success', `${key || 'Issue'} has been created`);
    title.value = '';
    nextTick(() => field.value?.focus());
  } finally {
    saving.value = false;
  }
}
</script>

<style scoped>
.ic__open {
  display: flex; align-items: center; gap: 6px; width: 100%; margin-top: 4px; padding: 8px; border: 0;
  border-radius: 3px; background: transparent; color: var(--j-text-subtle); font: inherit; font-weight: 500;
  cursor: pointer; text-align: left;
}
.ic__open:hover { background: var(--j-neutral-hover); }
.ic {
  display: flex; align-items: center; gap: 8px; margin-top: 4px; padding: 4px 8px; border-radius: 3px;
  background: var(--j-surface); box-shadow: inset 0 0 0 2px var(--j-focus);
}
.ic :deep(.ic__type) { gap: 2px; padding: 4px; border-radius: 3px; }
.ic :deep(.ic__type:hover) { background: var(--j-neutral-hover); }
.ic__input { flex: 1; min-width: 60px; height: 32px; border: 0; outline: none; background: transparent; font: inherit; color: var(--j-text); }
.ic__hint { font-size: 11px; color: var(--j-text-subtlest); white-space: nowrap; }
@container sl-portal (max-width: 560px) { .ic__hint { display: none; } }
</style>
