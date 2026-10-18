<template>
  <!-- Create a new repository -->
  <GdDialog v-if="d.type === 'createRepo'" title="Create a new repository" @close="close">
    <div class="gd-field"><label>Name</label><input class="gd-input" :value="v.repository.name" disabled /></div>
    <div class="gd-field"><label>Description</label><input v-model="text" class="gd-input" /></div>
    <div class="gd-field"><label>Local path</label>
      <div class="gd-row"><input class="gd-input" value="/home/lab" disabled /><button type="button" class="gd-btn" disabled>Choose…</button></div>
    </div>
    <label class="gd-checkrow"><input type="checkbox" disabled /> Initialize this repository with a README</label>
    <p class="gd-help">The folder already has files in it. Git will start tracking them once you commit.</p>
    <div class="gd-field"><label>Git ignore</label><select class="gd-input" disabled><option>None</option></select></div>
    <div class="gd-field"><label>License</label><select class="gd-input" disabled><option>None</option></select></div>
    <template #footer>
      <button type="button" class="gd-btn gd-btn--primary" :disabled="busy" @click="go([cmd.init()], 'Created repository workspace')">Create repository</button>
      <button type="button" class="gd-btn" @click="close">Cancel</button>
    </template>
  </GdDialog>

  <!-- Create a branch -->
  <GdDialog v-else-if="d.type === 'newBranch'" :title="d.sha ? `Create a branch from commit ${d.sha.slice(0, 7)}` : 'Create a branch'" @close="close">
    <form @submit.prevent="createBranch">
      <div class="gd-field">
        <label for="gd-branch-name">Name</label>
        <input id="gd-branch-name" ref="focusEl" v-model="text" class="gd-input" autocomplete="off" />
      </div>
      <p v-if="text && clean !== text" class="gd-warn"><GdIcon name="alert" :size="14" /> Will be created as <b>{{ clean }}</b>.</p>
      <p v-if="nameError" class="gd-error-text">{{ nameError }}</p>
      <template v-if="!d.sha && !v.detached && v.branch !== 'main' && hasMain">
        <p class="gd-help">Create branch based on…</p>
        <label class="gd-radio"><input v-model="base" type="radio" value="main" /> <span><b>main</b><br /><span class="gd-dim">The default branch in your repository. Pick this to start on something new that's not dependent on your current branch.</span></span></label>
        <label class="gd-radio"><input v-model="base" type="radio" value="" /> <span><b>{{ v.branch }}</b><br /><span class="gd-dim">The currently checked out branch. Pick this if you need to build on work done on this branch.</span></span></label>
      </template>
      <p v-else-if="!d.sha" class="gd-help">Your new branch will be based on your currently checked out {{ v.detached ? 'commit' : 'branch' }} (<b>{{ v.detached ? v.detached.slice(0, 7) : v.branch }}</b>).</p>
    </form>
    <template #footer>
      <button type="button" class="gd-btn gd-btn--primary" :disabled="busy || !clean || Boolean(nameError)" @click="createBranch">Create branch</button>
      <button type="button" class="gd-btn" @click="close">Cancel</button>
    </template>
  </GdDialog>

  <!-- Rename branch -->
  <GdDialog v-else-if="d.type === 'rename'" title="Rename branch" @close="close">
    <form @submit.prevent="renameBranch">
      <div class="gd-field"><label for="gd-rename">Name</label>
        <input id="gd-rename" ref="focusEl" v-model="text" class="gd-input" autocomplete="off" /></div>
      <p v-if="text && clean !== text" class="gd-warn"><GdIcon name="alert" :size="14" /> Will be renamed to <b>{{ clean }}</b>.</p>
      <p v-if="renameError" class="gd-error-text">{{ renameError }}</p>
    </form>
    <template #footer>
      <button type="button" class="gd-btn gd-btn--primary" :disabled="busy || !clean || clean === d.branch || Boolean(renameError)" @click="renameBranch">Rename {{ d.branch }}</button>
      <button type="button" class="gd-btn" @click="close">Cancel</button>
    </template>
  </GdDialog>

  <!-- Delete branch -->
  <GdDialog v-else-if="d.type === 'deleteBranch'" title="Delete branch" type="warning" @close="close">
    <p>Are you sure you want to delete the branch <b>{{ d.branch }}</b>?</p>
    <p class="gd-dim">This action cannot be undone.</p>
    <template #footer>
      <button type="button" class="gd-btn gd-btn--danger" :disabled="busy" @click="go([cmd.deleteBranch(d.branch)], `Deleted branch ${d.branch}`)">Delete</button>
      <button type="button" class="gd-btn" @click="close">Cancel</button>
    </template>
  </GdDialog>

  <!-- Discard changes -->
  <GdDialog v-else-if="d.type === 'discard'" title="Confirm discard changes" type="warning" @close="close">
    <p>{{ d.files.length === 1 ? 'Are you sure you want to discard all changes to:' : `Are you sure you want to discard all changes to these ${d.files.length} files?` }}</p>
    <ul class="gd-filelist">
      <li v-for="f in d.files" :key="f.path">{{ f.path }}</li>
    </ul>
    <p class="gd-dim">Changes can be restored by retrieving them from the Recycle Bin.</p>
    <label class="gd-checkrow"><input type="checkbox" /> Do not show this message again</label>
    <template #footer>
      <button type="button" class="gd-btn gd-btn--danger" :disabled="busy" @click="discard">Discard changes</button>
      <button type="button" class="gd-btn" @click="close">Cancel</button>
    </template>
  </GdDialog>

  <!-- Discard all -->
  <GdDialog v-else-if="d.type === 'discardAll'" title="Confirm discard changes" type="warning" @close="close">
    <p>Are you sure you want to discard all changes?</p>
    <p class="gd-dim">Changes can be restored by retrieving them from the Recycle Bin.</p>
    <template #footer>
      <button type="button" class="gd-btn gd-btn--danger" :disabled="busy" @click="discardAll">Discard all changes</button>
      <button type="button" class="gd-btn" @click="close">Cancel</button>
    </template>
  </GdDialog>

  <!-- Switch branch with changes -->
  <GdDialog v-else-if="d.type === 'switch'" title="Switch branch" @close="close">
    <p>You have changes on this branch. What would you like to do with them?</p>
    <label class="gd-radio"><input v-model="choice" type="radio" value="leave" />
      <span>Leave my changes on <b>{{ v.branch }}</b><br /><span class="gd-dim">Your in-progress work will be stashed on this branch for you to return to later</span></span></label>
    <label class="gd-radio"><input v-model="choice" type="radio" value="bring" />
      <span>Bring my changes to <b>{{ d.target }}</b><br /><span class="gd-dim">Your in-progress work will follow you to the new branch</span></span></label>
    <p v-if="choice === 'leave' && existingStash" class="gd-warn"><GdIcon name="alert" :size="14" /> Your current stash will be overwritten by creating a new stash</p>
    <template #footer>
      <button type="button" class="gd-btn gd-btn--primary" :disabled="busy" @click="switchBranch">Switch branch</button>
      <button type="button" class="gd-btn" @click="close">Cancel</button>
    </template>
  </GdDialog>

  <!-- Reset to commit -->
  <GdDialog v-else-if="d.type === 'resetTo'" title="Reset to commit" type="warning" @close="close">
    <p>Are you sure you want to reset to commit <b>{{ d.commit.sha }}</b> “{{ d.commit.summary }}”?</p>
    <p class="gd-dim">The commits after it will be removed from <b>{{ v.branch }}</b>, and their changes will be kept as uncommitted changes in your working directory.</p>
    <template #footer>
      <button type="button" class="gd-btn gd-btn--primary" :disabled="busy" @click="go([cmd.resetTo(d.commit.full)], `Reset ${v.branch} to ${d.commit.sha}`)">Reset to commit</button>
      <button type="button" class="gd-btn" @click="close">Cancel</button>
    </template>
  </GdDialog>

  <!-- Checkout commit -->
  <GdDialog v-else-if="d.type === 'checkoutCommit'" title="Checkout commit" type="warning" @close="close">
    <p>Checking out a commit will create a detached HEAD, and you will no longer be on any branch.</p>
    <p class="gd-dim">Commits you make there are not on any branch until you create one. Are you sure you want to checkout commit <b>{{ d.commit.sha }}</b>?</p>
    <template #footer>
      <button type="button" class="gd-btn gd-btn--primary" :disabled="busy" @click="go([cmd.checkout(d.commit.full)], `Checked out commit ${d.commit.sha}`)">Checkout commit</button>
      <button type="button" class="gd-btn" @click="close">Cancel</button>
    </template>
  </GdDialog>

  <!-- Create a tag -->
  <GdDialog v-else-if="d.type === 'tag'" title="Create a tag" @close="close">
    <form @submit.prevent="createTag">
      <div class="gd-field"><label for="gd-tag">Name</label>
        <input id="gd-tag" ref="focusEl" v-model="text" class="gd-input" autocomplete="off" maxlength="245" /></div>
      <p v-if="tagError" class="gd-error-text">{{ tagError }}</p>
      <p class="gd-help">Tag commit <b>{{ d.commit.sha }}</b> “{{ d.commit.summary }}”.</p>
    </form>
    <template #footer>
      <button type="button" class="gd-btn gd-btn--primary" :disabled="busy || !text.trim() || Boolean(tagError)" @click="createTag">Create tag</button>
      <button type="button" class="gd-btn" @click="close">Cancel</button>
    </template>
  </GdDialog>

  <!-- Delete tag -->
  <GdDialog v-else-if="d.type === 'deleteTag'" title="Delete tag" type="warning" @close="close">
    <p>Are you sure you want to delete the tag <b>{{ d.tag }}</b>?</p>
    <template #footer>
      <button type="button" class="gd-btn gd-btn--danger" :disabled="busy" @click="go([cmd.tagDelete(d.tag)], `Deleted tag ${d.tag}`)">Delete</button>
      <button type="button" class="gd-btn" @click="close">Cancel</button>
    </template>
  </GdDialog>

  <!-- Cherry-pick to a branch -->
  <GdDialog v-else-if="d.type === 'cherryPick'" title="Cherry-pick 1 commit to a branch" @close="close">
    <p class="gd-help">Choose the branch to copy <b>{{ d.commit.sha }}</b> “{{ d.commit.summary }}” onto.</p>
    <ul class="gd-picklist">
      <li v-for="b in otherBranches" :key="b.name" :class="{ 'is-selected': text === b.name }" @click="text = b.name">
        <GdIcon name="branch" :size="14" /> {{ b.name }}
      </li>
      <li v-if="!otherBranches.length" class="gd-dim">There is no other branch to cherry-pick onto.</li>
    </ul>
    <template #footer>
      <button type="button" class="gd-btn gd-btn--primary" :disabled="busy || !text" @click="cherryPick">Cherry-pick commit to <b>&nbsp;{{ text || '…' }}</b></button>
      <button type="button" class="gd-btn" @click="close">Cancel</button>
    </template>
  </GdDialog>

  <!-- Publish -->
  <GdDialog v-else-if="d.type === 'publish'" title="Publish repository" @close="close">
    <div class="gd-tabs2"><span class="is-active">GitHub.com</span><span>GitHub Enterprise</span></div>
    <div class="gd-field"><label>Name</label><input class="gd-input" :value="v.repository.name" /></div>
    <div class="gd-field"><label>Description</label><input v-model="text" class="gd-input" /></div>
    <label class="gd-checkrow"><input type="checkbox" checked /> Keep this code private</label>
    <p class="gd-dim">This lab has no network and no remote: publishing runs <code>git push</code>, and git will tell you why there is nowhere to push to.</p>
    <template #footer>
      <button type="button" class="gd-btn gd-btn--primary" :disabled="busy" @click="go([cmd.push()], 'Published repository')">Publish repository</button>
      <button type="button" class="gd-btn" @click="close">Cancel</button>
    </template>
  </GdDialog>

  <!-- Discard stash -->
  <GdDialog v-else-if="d.type === 'stashDiscard'" title="Discard stash?" type="warning" @close="close">
    <p>Are you sure you want to discard these stashed changes?</p>
    <template #footer>
      <button type="button" class="gd-btn gd-btn--danger" :disabled="busy" @click="go([cmd.stashDrop(d.stash.ref)], 'Discarded stashed changes')">Discard</button>
      <button type="button" class="gd-btn" @click="close">Cancel</button>
    </template>
  </GdDialog>

  <!-- Error -->
  <GdDialog v-else-if="d.type === 'error'" title="Error" type="error" @close="close">
    <p class="gd-errmsg">{{ d.message }}</p>
    <p v-if="d.command" class="gd-dim gd-errcmd"><code>{{ d.command }}</code></p>
    <template #footer>
      <button type="button" class="gd-btn gd-btn--primary" @click="close">Close</button>
    </template>
  </GdDialog>
</template>

<script setup lang="ts">
/**
 * The small dialogs, each the one GitHub Desktop shows, each running the git
 * command(s) its button stands for through `run` (sequential; stops at the
 * first failure, which the shell then shows in its Error dialog).
 */
import { computed, nextTick, onMounted, ref } from 'vue';
import GdDialog from './GdDialog.vue';
import GdIcon from './GdIcon.vue';
import { branchNameError, cmd, sanitizeBranch, type GdView } from './gd';

const props = defineProps<{
  d: Record<string, any>;
  v: GdView;
  busy: boolean;
  run: (commands: string[], success: string) => Promise<boolean>;
}>();
const emit = defineEmits<{ (event: 'close'): void }>();

const text = ref(String(props.d.initial || ''));
const base = ref('');
const choice = ref<'leave' | 'bring'>('leave');
const focusEl = ref<HTMLInputElement | null>(null);

onMounted(() => nextTick(() => focusEl.value?.focus()));

const clean = computed(() => sanitizeBranch(text.value.trim()));
const hasMain = computed(() => props.v.branches.some(b => b.name === 'main'));
const nameError = computed(() => branchNameError(clean.value, props.v.branches));
const renameError = computed(() => branchNameError(clean.value, props.v.branches, props.d.branch));
const tagError = computed(() => {
  const name = text.value.trim();
  if (!name) return '';
  if (/\s/.test(name)) return 'A tag name cannot contain spaces.';
  if (props.v.tags.some(t => t.name === name)) return `A tag named ${name} already exists`;
  return '';
});
const otherBranches = computed(() => props.v.branches.filter(b => !b.current));
const existingStash = computed(() => props.v.stashes.find(s => s.desktop && s.branch === props.v.branch));

function close() { emit('close'); }

async function go(commands: string[], success: string) {
  if (await props.run(commands, success)) close();
}

function createBranch() {
  if (!clean.value || nameError.value) return;
  go([cmd.newBranch(clean.value, props.d.sha || base.value)], `Created branch ${clean.value}`);
}

function renameBranch() {
  if (!clean.value || clean.value === props.d.branch || renameError.value) return;
  go([cmd.rename(props.d.branch, clean.value)], `Renamed ${props.d.branch} to ${clean.value}`);
}

function createTag() {
  if (!text.value.trim() || tagError.value) return;
  go([cmd.tag(text.value.trim(), props.d.commit.full)], `Created tag ${text.value.trim()}`);
}

function discard() {
  const files = props.d.files as { path: string; untracked: boolean }[];
  go(files.map(f => cmd.discard(f.path, f.untracked)),
     files.length === 1 ? `Discarded changes to ${files[0].path}` : `Discarded changes to ${files.length} files`);
}

function discardAll() {
  const commands = [cmd.discardAll()];
  if (props.v.changes.some(c => c.untracked)) commands.push(cmd.cleanAll());
  go(commands, 'Discarded all changes');
}

function switchBranch() {
  const commands: string[] = [];
  if (choice.value === 'leave') {
    if (existingStash.value) commands.push(cmd.stashDrop(existingStash.value.ref));
    commands.push(cmd.stashLeave(props.v.branch));
  }
  commands.push(cmd.checkout(props.d.target));
  go(commands, `Switched to branch ${props.d.target}`);
}

function cherryPick() {
  if (!text.value) return;
  go([cmd.checkout(text.value), cmd.cherryPick(props.d.commit.full)],
     `Cherry-picked 1 commit to ${text.value}`);
}
</script>

<style scoped>
.gd-field { display: flex; flex-direction: column; gap: 4px; margin-bottom: 12px; }
.gd-field label { font-weight: 600; font-size: 12px; }
.gd-row { display: flex; gap: 6px; }
.gd-input {
  width: 100%; min-width: 0; border: 1px solid #d1d5da; border-radius: 3px; padding: 4px 6px; font-size: 12px;
  background: #fff; color: var(--gd-text); line-height: 18px; outline: none; height: 28px;
}
.gd-input:focus { border-color: var(--gd-blue); box-shadow: 0 0 0 3px rgba(3, 102, 214, 0.3); }
.gd-input:disabled { background: #f6f8fa; color: var(--gd-text-secondary); }
.gd-help { margin: 0 0 10px; color: var(--gd-text); }
.gd-dim { color: var(--gd-text-secondary); }
.gd-warn {
  display: flex; align-items: flex-start; gap: 6px; margin: 0 0 10px; padding: 6px 8px; border-radius: 3px;
  background: #fffbdd; border: 1px solid #f9c513; color: #735c0f;
}
.gd-error-text { margin: 0 0 10px; color: var(--gd-red); }
.gd-checkrow { display: flex; align-items: center; gap: 6px; margin: 8px 0; }
.gd-radio { display: flex; align-items: flex-start; gap: 8px; margin: 8px 0; line-height: 17px; }
.gd-radio input { margin-top: 2px; }
.gd-filelist {
  margin: 6px 0 10px; padding: 6px 10px 6px 24px; max-height: 140px; overflow: auto;
  background: #f6f8fa; border: 1px solid var(--gd-border); border-radius: 3px; font-family: var(--gd-mono); font-size: 11px;
}
.gd-picklist {
  list-style: none; margin: 0; padding: 0; border: 1px solid var(--gd-border); border-radius: 3px; max-height: 220px; overflow: auto;
}
.gd-picklist li { display: flex; align-items: center; gap: 6px; padding: 6px 10px; border-bottom: 1px solid #f3f3f3; cursor: default; }
.gd-picklist li:hover { background: var(--gd-hover); }
.gd-picklist li.is-selected { background: var(--gd-blue); color: #fff; }
.gd-tabs2 { display: flex; gap: 16px; border-bottom: 1px solid var(--gd-border); margin: -4px 0 14px; }
.gd-tabs2 span { padding: 6px 0; color: var(--gd-text-secondary); }
.gd-tabs2 .is-active { color: var(--gd-text); font-weight: 600; border-bottom: 2px solid var(--gd-blue); }
.gd-errmsg { white-space: pre-wrap; margin: 0; }
.gd-errcmd code, .gd-dim code { font-family: var(--gd-mono); font-size: 11px; }
p { margin: 0 0 8px; }
</style>
