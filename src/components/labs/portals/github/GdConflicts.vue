<template>
  <GdDialog :title="title" :width="editing ? 'xl' : 'lg'" @close="$emit('close')">
    <template v-if="!editing">
      <p class="gd-cf__lead">
        <template v-if="op === 'merge'">Resolve the following conflicts before merging <b>{{ theirsLabel }}</b> into <b>{{ oursLabel }}</b>.</template>
        <template v-else-if="op === 'stash'">Restoring your stash conflicted with changes on <b>{{ v.branch }}</b>. Resolve the files, then mark them resolved.</template>
        <template v-else>Resolve the following conflicts before continuing the {{ op }} of <b>{{ v.sequencer?.commit }}</b>.</template>
      </p>
      <div class="gd-cf__count">{{ unresolved ? `${unresolved} conflicted file${unresolved === 1 ? '' : 's'}` : 'All conflicts resolved' }}</div>
      <ul class="gd-cf__list">
        <li v-for="row in rowsView" :key="row.path" class="gd-cf__row">
          <GdIcon name="file" :size="16" class="gd-cf__fileicon" />
          <span class="gd-cf__text">
            <span class="gd-cf__path">{{ row.path }}</span>
            <span v-if="row.state === 'conflicted'" class="gd-cf__state is-bad">{{ row.markers }} conflict{{ row.markers === 1 ? '' : 's' }}</span>
            <span v-else class="gd-cf__state is-ok"><GdIcon name="check" :size="12" /> {{ row.state === 'clean' ? 'No conflicts remaining' : 'Resolved' }}</span>
          </span>
          <span v-if="row.state !== 'resolved'" class="gd-cf__actions">
            <button type="button" class="gd-btn gd-cf__open" :disabled="busy" @click="openEditor(row.path)">Open in editor</button>
            <button type="button" class="gd-btn gd-cf__more" :aria-label="`More options for ${row.path}`"
                    :disabled="busy" @click="menuFor = menuFor === row.path ? '' : row.path">
              <GdIcon name="triangleDown" :size="14" />
            </button>

          </span>
          <ul v-if="menuFor === row.path" class="gd-cf__menu">
              <li><button type="button" @click="useSide(row.path, 'ours')">Use the modified file from <b>{{ oursLabel }}</b></button></li>
              <li><button type="button" @click="useSide(row.path, 'theirs')">Use the modified file from <b>{{ theirsLabel }}</b></button></li>
            </ul>
        </li>
      </ul>
    </template>
    <GdEditor v-else :path="editing" :content="editingContent" :ours-label="`current (${oursLabel})`"
              :theirs-label="`incoming (${theirsLabel})`" @update="draft = $event" />

    <template #footer>
      <template v-if="!editing">
        <button type="button" class="gd-btn gd-btn--primary" :disabled="busy || unresolved > 0" @click="finish">
          {{ op === 'stash' ? 'Mark as resolved' : `Continue ${opWord}` }}
        </button>
        <button type="button" class="gd-btn" :disabled="busy" @click="abort">Abort {{ opWord }}</button>
      </template>
      <template v-else>
        <button type="button" class="gd-btn gd-btn--primary" :disabled="busy || hasMarkers" @click="save(true)">Save and mark resolved</button>
        <button type="button" class="gd-btn" :disabled="busy" @click="save(false)">Save</button>
        <button type="button" class="gd-btn" :disabled="busy" @click="editing = ''">Back</button>
      </template>
    </template>
  </GdDialog>
</template>

<script setup lang="ts">
/**
 * "Resolve conflicts before merging" - the list of conflicted files, each with
 * Open in editor and "Use the modified file from <branch>", and Continue /
 * Abort at the bottom. Every choice is a git command:
 *
 *   use a side      git checkout --ours|--theirs -- <path>  then  git add <path>
 *   editor, save    printf '%s' <text> > <path>             (then git add)
 *   continue        git add <each clean file>  then  git merge --continue
 *   abort           git merge --abort
 *
 * The same dialog serves a conflicted revert / cherry-pick (`--continue` /
 * `--abort` of that operation) and a conflicted stash restore.
 */
import { computed, ref } from 'vue';
import GdDialog from './GdDialog.vue';
import GdEditor from './GdEditor.vue';
import GdIcon from './GdIcon.vue';
import { cmd, type GdView } from './gd';

const props = defineProps<{
  v: GdView;
  busy: boolean;
  run: (commands: string[], success: string) => Promise<boolean>;
}>();
const emit = defineEmits<{ (event: 'close'): void; (event: 'done'): void }>();

const op = computed(() => props.v.merging ? 'merge' : props.v.sequencer ? props.v.sequencer.op : 'stash');
const opWord = computed(() => op.value === 'stash' ? '' : op.value);
const title = computed(() => ({
  merge: 'Resolve conflicts before merging',
  revert: 'Resolve conflicts before reverting',
  'cherry-pick': 'Resolve conflicts before cherry-picking',
} as Record<string, string>)[op.value] || 'Resolve conflicts');
const oursLabel = computed(() => op.value === 'stash' ? 'Updated upstream'
  : props.v.detached ? 'HEAD' : props.v.branch);
const theirsLabel = computed(() => op.value === 'merge' ? (props.v.merging?.branch || 'MERGE_HEAD')
  : op.value === 'stash' ? 'Stashed changes' : props.v.sequencer?.commit || 'the commit');

// GitHub Desktop keeps showing a file it has resolved, ticked, until you continue.
const seen = ref<string[]>([...props.v.conflicts]);
const rowsView = computed(() => {
  for (const path of props.v.conflicts) if (!seen.value.includes(path)) seen.value.push(path);
  return seen.value.map(path => {
    const change = props.v.changes.find(c => c.path === path);
    const conflicted = props.v.conflicts.includes(path);
    const markers = change?.markers ?? 0;
    return { path, markers, change,
             state: !conflicted ? 'resolved' : markers > 0 ? 'conflicted' : 'clean' };
  });
});
const unresolved = computed(() => rowsView.value.filter(r => r.state === 'conflicted').length);

const menuFor = ref('');
const editing = ref('');
const editingContent = ref('');
const draft = ref('');
const hasMarkers = computed(() => /^(<{7}|>{7})( |$)/m.test(draft.value));

function openEditor(path: string) {
  const change = props.v.changes.find(c => c.path === path);
  editingContent.value = change?.content ?? '';
  draft.value = editingContent.value;
  editing.value = path;
}

async function useSide(path: string, side: 'ours' | 'theirs') {
  menuFor.value = '';
  const change = props.v.changes.find(c => c.path === path);
  const missing = side === 'ours' ? change?.ours === null : change?.theirs === null;
  const label = side === 'ours' ? oursLabel.value : theirsLabel.value;
  await props.run(missing ? [cmd.rm(path)] : [cmd.useSide(side, path), cmd.markResolved(path)],
                  `Used ${path} from ${label}`);
}

async function save(resolve: boolean) {
  const path = editing.value;
  const commands = [cmd.write(path, draft.value)];
  if (resolve) commands.push(cmd.markResolved(path));
  if (await props.run(commands, resolve ? `Resolved ${path}` : `Saved ${path}`) && resolve) editing.value = '';
}

async function finish() {
  const commands = rowsView.value.filter(r => r.state === 'clean').map(r => cmd.markResolved(r.path));
  if (op.value === 'merge') commands.push(cmd.mergeContinue());
  else if (op.value !== 'stash') commands.push(cmd.seqContinue(op.value));
  const message = op.value === 'merge' ? `Successfully merged ${theirsLabel.value} into ${oursLabel.value}`
    : op.value === 'stash' ? 'Conflicts resolved' : `Finished the ${op.value}`;
  if (await props.run(commands, message)) emit('done');
}

async function abort() {
  const commands = op.value === 'merge' ? [cmd.mergeAbort()]
    : op.value === 'stash' ? [cmd.discardAll()] : [cmd.seqAbort(op.value)];
  if (await props.run(commands, `Aborted the ${opWord.value || 'restore'}`)) emit('done');
}
</script>

<style scoped>
.gd-cf__lead { margin: 0 0 10px; }
.gd-cf__count { font-weight: 600; margin-bottom: 6px; }
.gd-cf__list { list-style: none; margin: 0; padding: 0; border: 1px solid var(--gd-border); border-radius: 3px; }
.gd-cf__row { display: flex; align-items: center; gap: 8px; padding: 8px 10px; border-bottom: 1px solid var(--gd-border); flex-wrap: wrap; }
.gd-cf__row:last-child { border-bottom: 0; }
.gd-cf__fileicon { color: var(--gd-text-secondary); }
.gd-cf__text { flex: 1; min-width: 140px; display: flex; flex-direction: column; }
.gd-cf__path { font-weight: 600; word-break: break-all; }
.gd-cf__state { font-size: 11px; display: inline-flex; align-items: center; gap: 3px; }
.gd-cf__state.is-bad { color: var(--gd-conflicted); }
.gd-cf__state.is-ok { color: var(--gd-green); }
.gd-cf__actions { display: flex; }
.gd-cf__open { border-top-right-radius: 0 !important; border-bottom-right-radius: 0 !important; }
.gd-cf__more { border-top-left-radius: 0 !important; border-bottom-left-radius: 0 !important; border-left: 0 !important; padding: 0 5px !important; }
.gd-cf__menu {
  flex-basis: 100%; list-style: none; margin: 6px 0 0; padding: 4px 0;
  background: #fff; border: 1px solid rgba(27, 31, 35, 0.15); border-radius: 4px; box-shadow: 0 3px 12px rgba(27, 31, 35, 0.15);
}
.gd-cf__menu button {
  display: block; width: 100%; text-align: left; border: 0; background: none; padding: 5px 14px; font-size: 12px;
  color: var(--gd-text); cursor: default;
}
.gd-cf__menu button:hover { background: var(--gd-blue); color: #fff; }
</style>
