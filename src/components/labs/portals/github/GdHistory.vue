<template>
  <div class="gd-history">
    <div class="gd-history__compare" :class="{ 'is-open': pickerOpen }">
      <span class="gd-history__search">
        <GdIcon name="branch" :size="14" />
        <input v-model="filter" type="search" class="gd-history__input" :placeholder="compare ? compare : 'Select branch to compare…'"
               aria-label="Select branch to compare" @focus="pickerOpen = true" @keydown.escape="pickerOpen = false"
               @keydown.enter.prevent="pickFirst" />
        <button v-if="compare" type="button" class="gd-history__clear" aria-label="Clear comparison" @click="clear">
          <GdIcon name="x" :size="12" />
        </button>
      </span>
      <ul v-if="pickerOpen" class="gd-history__picker" role="listbox" aria-label="Branches to compare">
        <template v-for="group in groups" :key="group.label">
          <li v-if="group.items.length" class="gd-history__group">{{ group.label }}</li>
          <li v-for="name in group.items" :key="group.label + name" role="option" :aria-selected="name === compare"
              class="gd-history__opt" @mousedown.prevent="pick(name)">
            <GdIcon name="branch" :size="12" /> {{ name }}
          </li>
        </template>
        <li v-if="!groups.some(g => g.items.length)" class="gd-history__none">No branches to compare</li>
      </ul>
    </div>

    <div v-if="compare" class="gd-history__tabs" role="tablist">
      <button type="button" role="tab" :aria-selected="side === 'behind'" :class="{ 'is-active': side === 'behind' }"
              @click="side = 'behind'">Behind ({{ behind.length }})</button>
      <button type="button" role="tab" :aria-selected="side === 'ahead'" :class="{ 'is-active': side === 'ahead' }"
              @click="side = 'ahead'">Ahead ({{ ahead.length }})</button>
    </div>

    <ul v-if="list.length" class="gd-history__list" role="listbox" aria-label="Commits" tabindex="0"
        @keydown.down.prevent="move(1)" @keydown.up.prevent="move(-1)">
      <li v-for="commit in list" :key="commit.full" class="gd-commit-row" role="option"
          :aria-selected="commit.full === selected" :class="{ 'is-selected': commit.full === selected }"
          @click="$emit('select', commit.full)" @contextmenu.prevent="$emit('context', $event, commit)">
        <div class="gd-commit-row__summary">
          <span class="gd-commit-row__text" :title="commit.summary">{{ commit.summary }}</span>
          <span v-for="t in commit.tags" :key="t" class="gd-tag" :class="{ 'is-local': unpushedTags.has(t) }"
                :title="unpushedTags.has(t) ? `Tag ${t} has not been pushed` : `Tag ${t}`">{{ t }}</span>
          <span v-if="unpushed.has(commit.full)" class="gd-unpushed" title="This commit has not been pushed to the remote repository">
            <GdIcon name="arrowUp" :size="12" />
          </span>
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
      <template v-if="compare && side === 'behind'">The current branch is up to date with <b>{{ compare }}</b>.</template>
      <template v-else-if="compare">The current branch has no commits that <b>{{ compare }}</b> does not have.</template>
      <template v-else-if="unborn">No history yet.<br />Commit something on the Changes tab.</template>
      <template v-else>No commits</template>
    </div>

    <div v-if="compare && side === 'behind' && behind.length && canMerge" class="gd-history__foot">
      <button type="button" class="gd-btn gd-btn--primary gd-history__merge" @click="$emit('merge', compare)">
        Merge into <b>&nbsp;{{ current }}</b>
      </button>
      <p class="gd-history__hint">This will merge {{ behind.length }} commit{{ behind.length === 1 ? '' : 's' }} from <b>{{ compare }}</b> into <b>{{ current }}</b>.</p>
    </div>
  </div>
</template>

<script setup lang="ts">
/**
 * The History tab: the current branch's commits, newest first - and the
 * "Select branch to compare" box above it, which shows the commits another
 * branch (local or remote-tracking) is ahead and behind by, with Merge into
 * <current> at the bottom of the Behind list (that runs `git merge <branch>`).
 * A commit that is not on the upstream yet carries Desktop's up-arrow.
 *
 * The ahead/behind sets are the same walk `git log A..B` does, over the
 * commit graph in the view.
 */
import { computed, ref, watch } from 'vue';
import GdIcon from './GdIcon.vue';
import { relTime, type Commit } from './gd';

const props = defineProps<{
  commits: Commit[];
  all: Commit[];
  selected: string;
  unborn: boolean;
  head: string;
  current: string;
  branches: { name: string; full: string; current: boolean }[];
  remoteBranches: { name: string; full: string }[];
  tags: { name: string; pushed?: boolean }[];
  upstream: string;
  canMerge: boolean;
}>();
const emit = defineEmits<{
  (event: 'select', sha: string): void;
  (event: 'context', ev: MouseEvent, commit: Commit): void;
  (event: 'merge', branch: string): void;
}>();

const filter = ref('');
const compare = ref('');
const side = ref<'behind' | 'ahead'>('behind');
const pickerOpen = ref(false);

const parentMap = computed(() => {
  const map = new Map<string, string[]>();
  for (const c of props.all as any[]) map.set(c.full, Array.isArray(c.parents_full) ? c.parents_full : []);
  return map;
});

function reach(sha: string): Set<string> {
  const seen = new Set<string>();
  const stack = sha ? [sha] : [];
  while (stack.length) {
    const s = stack.pop() as string;
    if (!s || seen.has(s)) continue;
    seen.add(s);
    stack.push(...(parentMap.value.get(s) || []));
  }
  return seen;
}

function shaOf(name: string): string {
  return props.branches.find(b => b.name === name)?.full
    || props.remoteBranches.find(b => b.name === name)?.full || '';
}

const byFull = computed(() => new Map(props.all.map(c => [c.full, c])));
const mine = computed(() => reach(props.head));
const theirs = computed(() => reach(shaOf(compare.value)));
const ordered = computed(() => [...props.all].sort((a, b) => Date.parse(b.at) - Date.parse(a.at)));
const behind = computed(() => compare.value
  ? ordered.value.filter(c => theirs.value.has(c.full) && !mine.value.has(c.full)) : []);
const ahead = computed(() => compare.value
  ? ordered.value.filter(c => mine.value.has(c.full) && !theirs.value.has(c.full)) : []);

// GitHub Desktop's history is the CURRENT branch only (git log), not --all.
const list = computed(() => {
  if (compare.value) return side.value === 'behind' ? behind.value : ahead.value;
  return props.commits.filter(c => c.reachable !== false);
});

const unpushed = computed(() => {
  if (!props.upstream) return new Set<string>();
  const remote = reach(shaOf(props.upstream));
  return new Set([...mine.value].filter(s => !remote.has(s) && byFull.value.has(s)));
});
const unpushedTags = computed(() => new Set(props.upstream
  ? props.tags.filter(t => t.pushed === false).map(t => t.name) : []));

const groups = computed(() => {
  const needle = filter.value.trim().toLowerCase();
  const ok = (name: string) => !needle || name.toLowerCase().includes(needle);
  return [
    { label: 'Branches', items: props.branches.filter(b => !b.current && ok(b.name)).map(b => b.name) },
    { label: 'Remote branches', items: props.remoteBranches.filter(b => ok(b.name)).map(b => b.name) },
  ];
});

watch(() => props.branches.map(b => b.name).join(','), () => {
  if (compare.value && !shaOf(compare.value)) clear();
});

function pick(name: string) {
  compare.value = name;
  filter.value = '';
  pickerOpen.value = false;
  side.value = behind.value.length || !ahead.value.length ? 'behind' : 'ahead';
}
function pickFirst() {
  const first = groups.value.find(g => g.items.length)?.items[0];
  if (first) pick(first);
}
function clear() { compare.value = ''; filter.value = ''; pickerOpen.value = false; }

function move(step: number) {
  if (!list.value.length) return;
  const at = list.value.findIndex(c => c.full === props.selected);
  const next = list.value[Math.min(list.value.length - 1, Math.max(0, at + step))];
  emit('select', next.full);
}
</script>

<style scoped>
.gd-history { display: flex; flex-direction: column; min-height: 0; flex: 1; position: relative; }
.gd-history__compare { position: relative; padding: 6px 8px; flex: none; border-bottom: 1px solid var(--gd-border); }
.gd-history__search {
  display: flex; align-items: center; gap: 4px; border: 1px solid #d1d5da; border-radius: 3px; padding: 0 6px;
  color: var(--gd-text-secondary); background: #fff;
}
.gd-history__search:focus-within { border-color: var(--gd-blue); box-shadow: 0 0 0 3px rgba(3, 102, 214, 0.3); }
.gd-history__input { flex: 1; min-width: 0; border: 0; outline: none; height: 22px; font-size: 12px; background: none; color: var(--gd-text); }
.gd-history__clear { border: 0; background: none; color: var(--gd-text-secondary); padding: 2px; display: inline-flex; cursor: default; }
.gd-history__picker {
  position: absolute; left: 8px; right: 8px; top: 34px; z-index: 5; list-style: none; margin: 0; padding: 0;
  max-height: 260px; overflow: auto; background: #fff; border: 1px solid var(--gd-border);
  box-shadow: 0 8px 24px rgba(149, 157, 165, 0.3);
}
.gd-history__group { padding: 4px 10px; font-weight: 600; background: #f6f8fa; border-bottom: 1px solid var(--gd-border); }
.gd-history__opt { display: flex; align-items: center; gap: 6px; padding: 5px 10px; cursor: default; }
.gd-history__opt:hover { background: var(--gd-blue); color: #fff; }
.gd-history__none { padding: 10px; color: var(--gd-text-secondary); text-align: center; }
.gd-history__tabs { display: flex; flex: none; border-bottom: 1px solid var(--gd-border); }
.gd-history__tabs button {
  flex: 1; height: 28px; border: 0; border-bottom: 2px solid transparent; background: #fff; font-size: 12px;
  color: var(--gd-text-secondary); cursor: default;
}
.gd-history__tabs button.is-active { color: var(--gd-text); font-weight: 600; border-bottom-color: var(--gd-blue); }
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
.gd-tag.is-local { border-style: dashed; }
.gd-unpushed { margin-left: 2px; display: inline-flex; color: var(--gd-text-secondary); }
.gd-history__empty { padding: 24px 12px; color: var(--gd-text-secondary); font-size: 12px; text-align: center; }
.gd-history__foot { flex: none; padding: 10px; border-top: 1px solid var(--gd-border); background: #fafbfc; }
.gd-history__merge { width: 100%; justify-content: center; height: 28px; }
.gd-history__hint { margin: 6px 0 0; font-size: 11px; color: var(--gd-text-secondary); }
@container sl-portal (max-width: 700px) {
  .gd-history__list { flex: none; max-height: 260px; }
}
</style>
