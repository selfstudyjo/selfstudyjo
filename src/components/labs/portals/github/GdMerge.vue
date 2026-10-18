<template>
  <GdDialog :title="`Merge into ${v.branch}`" width="md" @close="$emit('close')">
    <div class="gd-merge__filter">
      <GdIcon name="search" :size="13" />
      <input ref="filterEl" v-model="filter" type="search" placeholder="Filter" aria-label="Filter branches" />
    </div>
    <div class="gd-merge__group">Branches</div>
    <ul class="gd-merge__list" role="listbox" aria-label="Branches to merge">
      <li v-for="b in candidates" :key="b.name" role="option" :aria-selected="selected === b.name"
          :class="{ 'is-selected': selected === b.name }" @click="selected = b.name" @dblclick="merge">
        <GdIcon name="branch" :size="14" /> <span>{{ b.name }}</span>
      </li>
      <li v-if="!candidates.length" class="gd-merge__none">No branches to merge</li>
    </ul>
    <template #footer>
      <div class="gd-merge__status">
        <template v-if="!selected">Choose a branch to merge into <b>{{ v.branch }}</b>.</template>
        <template v-else-if="ahead === 0"><GdIcon name="check" :size="14" class="gd-ok" /> <b>{{ v.branch }}</b>&nbsp;is already up to date with <b>&nbsp;{{ selected }}</b>.</template>
        <template v-else><GdIcon name="check" :size="14" class="gd-ok" /> This will merge&nbsp;<b>{{ plural(ahead, 'commit') }}</b>&nbsp;from&nbsp;<b>{{ selected }}</b>&nbsp;into&nbsp;<b>{{ v.branch }}</b>.</template>
      </div>
      <div class="gd-merge__split">
        <button type="button" class="gd-btn gd-btn--primary" :disabled="busy || !selected || ahead === 0" @click="merge">Create a merge commit</button>
        <button type="button" class="gd-btn gd-btn--primary gd-merge__caret" aria-label="Merge options" @click="menu = !menu">
          <GdIcon name="triangleDown" :size="14" />
        </button>
        <ul v-if="menu" class="gd-merge__menu">
          <li class="is-on"><GdIcon name="check" :size="12" /> <span><b>Create a merge commit</b><br />The commits from the selected branch will be added to the current branch via a merge commit.</span></li>
          <li class="is-off"><span><b>Squash and merge</b><br />Not available in this lab.</span></li>
          <li class="is-off"><span><b>Rebase</b><br />Not available in this lab: rebase is not simulated.</span></li>
        </ul>
      </div>
    </template>
  </GdDialog>
</template>

<script setup lang="ts">
/**
 * "Merge into <branch>": pick a branch, see how many commits it brings, and
 * create a merge commit (`git merge <branch>`). The commit count is computed
 * from the commit graph in the view - the same walk `git log main..feature` does.
 */
import { computed, nextTick, onMounted, ref } from 'vue';
import GdDialog from './GdDialog.vue';
import GdIcon from './GdIcon.vue';
import { plural, type GdView } from './gd';

const props = defineProps<{ v: GdView; busy: boolean; onMerge: (branch: string) => Promise<void> }>();
defineEmits<{ (event: 'close'): void }>();

const filter = ref('');
const selected = ref('');
const menu = ref(false);
const filterEl = ref<HTMLInputElement | null>(null);
onMounted(() => nextTick(() => filterEl.value?.focus()));

const candidates = computed(() => props.v.branches.filter(b => !b.current &&
  b.name.toLowerCase().includes(filter.value.trim().toLowerCase())));

const parents = computed(() => {
  const map = new Map<string, string[]>();
  for (const c of props.v.commits as any[]) map.set(c.full, Array.isArray(c.parents_full) ? c.parents_full : []);
  return map;
});

function reach(sha: string): Set<string> {
  const seen = new Set<string>();
  const stack = sha ? [sha] : [];
  while (stack.length) {
    const s = stack.pop() as string;
    if (!s || seen.has(s)) continue;
    seen.add(s);
    stack.push(...(parents.value.get(s) || []));
  }
  return seen;
}

const ahead = computed(() => {
  const branch = props.v.branches.find(b => b.name === selected.value);
  if (!branch || !branch.full) return 0;
  const mine = reach(props.v.head.sha);
  let count = 0;
  for (const s of reach(branch.full)) if (!mine.has(s)) count++;
  return count;
});

async function merge() {
  if (!selected.value || ahead.value === 0 || props.busy) return;
  await props.onMerge(selected.value);
}
</script>

<style scoped>
.gd-merge__filter {
  display: flex; align-items: center; gap: 4px; border: 1px solid #d1d5da; border-radius: 3px; padding: 0 6px;
  color: var(--gd-text-secondary); margin-bottom: 10px;
}
.gd-merge__filter:focus-within { border-color: var(--gd-blue); box-shadow: 0 0 0 3px rgba(3, 102, 214, 0.3); }
.gd-merge__filter input { flex: 1; border: 0; outline: none; height: 26px; font-size: 12px; background: none; color: var(--gd-text); }
.gd-merge__group { font-weight: 600; padding: 4px 8px; background: #f6f8fa; border: 1px solid var(--gd-border); border-bottom: 0; }
.gd-merge__list { list-style: none; margin: 0; padding: 0; border: 1px solid var(--gd-border); max-height: 220px; overflow: auto; }
.gd-merge__list li { display: flex; align-items: center; gap: 6px; height: 30px; padding: 0 10px; cursor: default; }
.gd-merge__list li:hover { background: var(--gd-hover); }
.gd-merge__list li.is-selected { background: var(--gd-blue); color: #fff; }
.gd-merge__none { color: var(--gd-text-secondary); }
.gd-merge__status { flex: 1 1 100%; display: flex; align-items: center; flex-wrap: wrap; gap: 4px; font-size: 12px; margin-bottom: 4px; }
.gd-ok { color: var(--gd-green); }
.gd-merge__split { display: flex; position: relative; margin-left: auto; }
.gd-merge__split > .gd-btn:first-child { border-top-right-radius: 0; border-bottom-right-radius: 0; }
.gd-merge__caret { border-top-left-radius: 0 !important; border-bottom-left-radius: 0 !important; border-left: 1px solid rgba(255, 255, 255, 0.4) !important; padding: 0 6px !important; }
.gd-merge__menu {
  position: absolute; right: 0; bottom: 34px; width: 300px; list-style: none; margin: 0; padding: 4px 0; background: #fff;
  border: 1px solid rgba(27, 31, 35, 0.15); border-radius: 4px; box-shadow: 0 3px 12px rgba(27, 31, 35, 0.15); z-index: 3;
}
.gd-merge__menu li { display: flex; gap: 6px; padding: 6px 10px; font-size: 11px; color: var(--gd-text-secondary); }
.gd-merge__menu li b { color: var(--gd-text); font-size: 12px; }
.gd-merge__menu li.is-off { opacity: 0.6; padding-left: 28px; }
</style>
