<template>
  <div class="gd-changes">
    <div v-if="v.changes.length" class="gd-changes__header">
      <input :ref="setAllBox" type="checkbox" class="gd-check" :checked="allState === 'all'"
             :disabled="busy || !stageable.length" aria-label="Include all changes"
             @change="act.toggleAll(allState === 'all')" />
      <span>{{ plural(v.changes.length, 'changed file') }}</span>
    </div>
    <ul class="gd-changes__list" role="listbox" aria-label="Changed files" tabindex="0"
        @keydown.down.prevent="move(1)" @keydown.up.prevent="move(-1)"
        @keydown.space.prevent="toggleSelected">
      <li v-for="change in v.changes" :key="change.path" class="gd-file" role="option"
          :aria-selected="change.path === selected" :class="{ 'is-selected': change.path === selected }"
          :title="change.path" @click="$emit('select', change.path)"
          @contextmenu.prevent="$emit('context', $event, change)">
        <input :ref="el => setBox(el, change)" type="checkbox" class="gd-check"
               :checked="change.staged === 'all'"
               :disabled="busy || (change.status === 'conflicted' && (change.markers || 0) > 0)"
               :aria-label="`Include ${change.path} in the commit`"
               @click.stop @change="act.toggle(change)" />
        <span class="gd-file__path"><span class="gd-dim">{{ splitPath(change.path)[0] }}</span>{{ splitPath(change.path)[1] }}</span>
        <span class="gd-file__status" :class="`is-${change.status}`" :title="statusLabel(change.status)">
          <GdIcon :name="ICON[change.status]" :size="16" />
        </span>
      </li>
    </ul>

    <button v-if="stash" type="button" class="gd-stashed" :class="{ 'is-selected': selected === '::stash' }"
            @click="$emit('select', '::stash')">
      <GdIcon name="stash" :size="16" /> <span>Stashed Changes</span>
    </button>

    <div v-if="undo" class="gd-undo">
      <div class="gd-undo__text">
        <span class="gd-undo__when">Committed {{ relTime(undo.at) || 'just now' }}</span>
        <span class="gd-undo__summary" :title="undo.summary">{{ undo.summary }}</span>
      </div>
      <button type="button" class="gd-btn" :disabled="busy" @click="act.undo()">Undo</button>
    </div>

    <form class="gd-commit" @submit.prevent="submit">
      <div class="gd-commit__summary">
        <span class="gd-avatar" :title="`${v.user.name} <${v.user.email}>`"><GdIcon name="person" :size="14" /></span>
        <input v-model="summary" class="gd-input" type="text" placeholder="Summary (required)"
               aria-label="Commit summary" maxlength="200" :disabled="busy" />
      </div>
      <div class="gd-commit__desc">
        <textarea v-model="description" class="gd-textarea" placeholder="Description"
                  aria-label="Commit description" :disabled="busy"></textarea>
        <div class="gd-commit__tools">
          <button type="button" class="gd-commit__coauthor" title="Add co-authors" aria-label="Add co-authors"
                  disabled><GdIcon name="personAdd" :size="14" /></button>
        </div>
      </div>
      <button type="submit" class="gd-btn gd-btn--primary gd-commit__go" :disabled="!canCommit">
        <template v-if="v.merging || v.sequencer">Commit merge</template>
        <template v-else>Commit {{ stagedCount > 1 ? plural(stagedCount, 'file') + ' ' : '' }}to <b>{{ v.detached ? 'detached HEAD' : v.branch }}</b></template>
      </button>
    </form>
  </div>
</template>

<script setup lang="ts">
/**
 * The Changes tab: the file list with its checkboxes, and the commit box.
 *
 * A checkbox IS the index. Ticking runs `git add <path>`, unticking
 * `git restore --staged <path>`, and the tick is read back from the engine's
 * per-file `staged` (all / none / partial) - so a file staged from the console
 * shows ticked here, and a half-staged one shows the indeterminate dash.
 */
import { computed, ref, watch } from 'vue';
import GdIcon from './GdIcon.vue';
import { plural, relTime, splitPath, statusLabel, type Change, type GdView } from './gd';

const props = defineProps<{
  v: GdView;
  selected: string;
  busy: boolean;
  undo: { summary: string; at: string } | null;
  act: {
    toggle: (change: Change) => void;
    toggleAll: (allStaged: boolean) => void;
    commit: (summary: string, description: string) => Promise<boolean>;
    undo: () => void;
  };
}>();
const emit = defineEmits<{
  (event: 'select', path: string): void;
  (event: 'context', ev: MouseEvent, change: Change): void;
}>();

const ICON: Record<string, string> = {
  new: 'diffAdded', modified: 'diffModified', deleted: 'diffRemoved', conflicted: 'alert',
  renamed: 'diffRenamed',
};

const summary = ref('');
const description = ref('');

const stageable = computed(() => props.v.changes.filter(c =>
  !(c.status === 'conflicted' && (c.markers || 0) > 0)));
const stagedCount = computed(() => props.v.changes.filter(c => c.staged !== 'none').length);
const allState = computed(() => {
  if (!stagedCount.value) return 'none';
  return props.v.changes.every(c => c.staged === 'all') ? 'all' : 'partial';
});
const stash = computed(() => props.v.stashes.find(s => s.desktop && s.branch === props.v.branch) || null);
const canCommit = computed(() => {
  if (props.busy || !summary.value.trim()) return false;
  if (props.v.conflicts.length) return false;
  if (props.v.merging || props.v.sequencer) return true;
  return stagedCount.value > 0;
});

let allBox: HTMLInputElement | null = null;
function setAllBox(el: any) {
  allBox = el as HTMLInputElement | null;
  if (allBox) allBox.indeterminate = allState.value === 'partial';
}
watch(allState, state => { if (allBox) allBox.indeterminate = state === 'partial'; });

function setBox(el: any, change: Change) {
  if (el) (el as HTMLInputElement).indeterminate = change.staged === 'partial';
}

// A merge pre-fills its own message, as GitHub Desktop does.
watch(() => props.v.merging?.message || props.v.sequencer?.message || '', message => {
  if (message && !summary.value) {
    const [first, ...rest] = message.split('\n');
    summary.value = first;
    description.value = rest.join('\n').trim();
  }
}, { immediate: true });

async function submit() {
  if (!canCommit.value) return;
  const ok = await props.act.commit(summary.value.trim(), description.value);
  if (ok) {
    summary.value = '';
    description.value = '';
  }
}

function move(step: number) {
  const list = props.v.changes;
  if (!list.length) return;
  const at = list.findIndex(c => c.path === props.selected);
  const next = list[Math.min(list.length - 1, Math.max(0, at + step))];
  emit('select', next.path);
}

function toggleSelected() {
  const change = props.v.changes.find(c => c.path === props.selected);
  if (change && !(change.status === 'conflicted' && (change.markers || 0) > 0)) props.act.toggle(change);
}
</script>

<style scoped>
.gd-changes { display: flex; flex-direction: column; min-height: 0; flex: 1; }
.gd-changes__header {
  display: flex; align-items: center; gap: 8px; height: 29px; padding: 0 10px; flex: none;
  border-bottom: 1px solid var(--gd-border); font-size: 12px; color: var(--gd-text);
}
.gd-changes__list { list-style: none; margin: 0; padding: 0; flex: 1; overflow: auto; min-height: 0; outline: none; }
.gd-check { margin: 0; width: 13px; height: 13px; flex: none; accent-color: var(--gd-blue); cursor: pointer; }
.gd-file {
  display: flex; align-items: center; gap: 8px; height: 29px; padding: 0 10px; font-size: 12px;
  border-bottom: 1px solid #f3f3f3; cursor: default; color: var(--gd-text);
}
.gd-file:hover { background: var(--gd-hover); }
.gd-file.is-selected { background: var(--gd-selected); }
.gd-changes__list:focus-within .gd-file.is-selected { background: var(--gd-blue); color: #fff; }
.gd-changes__list:focus-within .gd-file.is-selected .gd-dim,
.gd-changes__list:focus-within .gd-file.is-selected .gd-file__status { color: #fff; }
.gd-file__path { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.gd-dim { color: var(--gd-text-secondary); }
.gd-file__status { display: inline-flex; }
.is-new { color: var(--gd-green); }
.is-modified { color: var(--gd-modified); }
.is-deleted { color: var(--gd-red); }
.is-renamed { color: var(--gd-blue); }
.is-conflicted { color: var(--gd-conflicted); }
.gd-stashed {
  display: flex; align-items: center; gap: 8px; height: 29px; padding: 0 10px; flex: none; width: 100%;
  border: 0; border-top: 1px solid var(--gd-border); background: #fff; font-size: 12px; text-align: left;
  color: var(--gd-text); cursor: default;
}
.gd-stashed:hover { background: var(--gd-hover); }
.gd-stashed.is-selected { background: var(--gd-selected); }
.gd-undo {
  display: flex; align-items: center; gap: 8px; padding: 8px 10px; border-top: 1px solid var(--gd-border);
  background: #fafbfc; flex: none;
}
.gd-undo__text { flex: 1; min-width: 0; display: flex; flex-direction: column; font-size: 11px; }
.gd-undo__when { color: var(--gd-text-secondary); }
.gd-undo__summary { color: var(--gd-text); font-weight: 600; font-size: 12px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.gd-commit {
  flex: none; padding: 10px; border-top: 1px solid var(--gd-border); background: #fafbfc;
  display: flex; flex-direction: column; gap: 8px;
}
.gd-commit__summary { display: flex; align-items: center; gap: 6px; }
.gd-avatar {
  width: 22px; height: 22px; border-radius: 50%; background: #e1e4e8; color: #6a737d; flex: none;
  display: inline-grid; place-items: center;
}
.gd-input, .gd-textarea {
  width: 100%; min-width: 0; border: 1px solid #d1d5da; border-radius: 3px; padding: 4px 6px; font-size: 12px;
  background: #fff; color: var(--gd-text); line-height: 18px; outline: none;
}
.gd-input:focus { border-color: var(--gd-blue); box-shadow: 0 0 0 3px rgba(3, 102, 214, 0.3); }
.gd-commit__desc { border: 1px solid #d1d5da; border-radius: 3px; background: #fff; }
.gd-commit__desc:focus-within { border-color: var(--gd-blue); box-shadow: 0 0 0 3px rgba(3, 102, 214, 0.3); }
.gd-textarea { border: 0; height: 70px; resize: none; display: block; }
.gd-commit__tools { display: flex; justify-content: flex-end; padding: 2px 4px; border-top: 1px solid #eaecef; }
.gd-commit__coauthor { border: 0; background: none; color: var(--gd-text-secondary); padding: 2px; display: inline-flex; }
.gd-commit__go { width: 100%; justify-content: center; height: 28px; }
.gd-commit__go b { font-weight: 600; margin-left: 3px; }
@container sl-portal (max-width: 700px) {
  .gd-changes__list { flex: none; max-height: 204px; }
  .gd-file, .gd-stashed { height: 34px; }
  .gd-check { width: 16px; height: 16px; }
}
</style>
