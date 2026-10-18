<template>
  <div class="gd-history">
    <div class="gd-history__compare">
      <GdIcon name="branch" :size="14" />
      <span class="gd-history__compare-label">Select branch to compare…</span>
    </div>
    <ul v-if="list.length" class="gd-history__list" role="listbox" aria-label="Commits" tabindex="0"
        @keydown.down.prevent="move(1)" @keydown.up.prevent="move(-1)">
      <li v-for="commit in list" :key="commit.full" class="gd-commit-row" role="option"
          :aria-selected="commit.full === selected" :class="{ 'is-selected': commit.full === selected }"
          @click="$emit('select', commit.full)" @contextmenu.prevent="$emit('context', $event, commit)">
        <div class="gd-commit-row__summary">
          <span class="gd-commit-row__text" :title="commit.summary">{{ commit.summary }}</span>
          <span v-for="t in commit.tags" :key="t" class="gd-tag" :title="`Tag ${t}`">{{ t }}</span>
        </div>
        <div class="gd-commit-row__meta">
          <span class="gd-avatar" aria-hidden="true"><GdIcon name="person" :size="10" /></span>
          <span class="gd-commit-row__author">{{ commit.author }}</span>
          <span>•</span>
          <span :title="commit.at">{{ relTime(commit.at) }}</span>
        </div>
      </li>
    </ul>
    <div v-else class="gd-history__empty">
      <template v-if="unborn">No history yet.<br />Commit something on the Changes tab.</template>
      <template v-else>No commits</template>
    </div>
  </div>
</template>

<script setup lang="ts">
/** The History tab: the current branch's commits, newest first. */
import { computed } from 'vue';
import GdIcon from './GdIcon.vue';
import { relTime, type Commit } from './gd';

const props = defineProps<{ commits: Commit[]; selected: string; unborn: boolean }>();
const emit = defineEmits<{
  (event: 'select', sha: string): void;
  (event: 'context', ev: MouseEvent, commit: Commit): void;
}>();

// GitHub Desktop's history is the CURRENT branch only (git log), not --all.
const list = computed(() => props.commits.filter(c => c.reachable !== false));

function move(step: number) {
  if (!list.value.length) return;
  const at = list.value.findIndex(c => c.full === props.selected);
  const next = list.value[Math.min(list.value.length - 1, Math.max(0, at + step))];
  emit('select', next.full);
}
</script>

<style scoped>
.gd-history { display: flex; flex-direction: column; min-height: 0; flex: 1; }
.gd-history__compare {
  display: flex; align-items: center; gap: 6px; height: 29px; padding: 0 10px; flex: none;
  border-bottom: 1px solid var(--gd-border); color: var(--gd-text-secondary); font-size: 12px;
}
.gd-history__compare-label { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.gd-history__list { list-style: none; margin: 0; padding: 0; overflow: auto; flex: 1; min-height: 0; outline: none; }
.gd-commit-row {
  padding: 6px 10px; border-bottom: 1px solid #f3f3f3; cursor: default; font-size: 12px; color: var(--gd-text);
}
.gd-commit-row:hover { background: var(--gd-hover); }
.gd-commit-row.is-selected { background: var(--gd-selected); }
.gd-history__list:focus-within .gd-commit-row.is-selected { background: var(--gd-blue); color: #fff; }
.gd-history__list:focus-within .gd-commit-row.is-selected .gd-commit-row__meta { color: #e1e4e8; }
.gd-commit-row__summary { display: flex; align-items: center; gap: 4px; font-weight: 600; }
.gd-commit-row__text { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.gd-commit-row__meta {
  display: flex; align-items: center; gap: 4px; margin-top: 2px; color: var(--gd-text-secondary); font-size: 11px;
}
.gd-commit-row__author { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 60%; }
.gd-avatar {
  width: 14px; height: 14px; border-radius: 50%; background: #e1e4e8; color: #6a737d;
  display: inline-grid; place-items: center; flex: none;
}
.gd-tag {
  flex: none; font-weight: 400; font-size: 11px; padding: 0 5px; border-radius: 9px; line-height: 16px;
  border: 1px solid #c8e1ff; background: #f1f8ff; color: var(--gd-blue);
}
.gd-unpushed { margin-left: auto; display: inline-flex; }
.gd-history__empty { padding: 24px 12px; color: var(--gd-text-secondary); font-size: 12px; text-align: center; }
@container sl-portal (max-width: 700px) {
  .gd-history__list { flex: none; max-height: 260px; }
}
</style>
