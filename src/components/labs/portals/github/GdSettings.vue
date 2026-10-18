<template>
  <GdDialog title="Repository settings" width="lg" @close="$emit('close')">
    <div class="gd-set">
      <nav class="gd-set__tabs" aria-label="Repository settings">
        <button v-for="t in TABS" :key="t.id" type="button" class="gd-set__tab" :class="{ 'is-active': tab === t.id }"
                @click="tab = t.id"><GdIcon :name="t.icon" :size="14" /> {{ t.label }}</button>
      </nav>
      <section class="gd-set__pane">
        <template v-if="tab === 'remote'">
          <div class="gd-set__empty">
            <GdIcon name="mark" :size="28" />
            <p><b>Publish your repository to GitHub</b></p>
            <p class="gd-dim">This repository is currently only available on your local machine. By publishing it on GitHub you can share it, and collaborate with others.</p>
            <button type="button" class="gd-btn" @click="$emit('publish')">Publish repository</button>
          </div>
        </template>
        <template v-else-if="tab === 'ignored'">
          <p>Editing <code>.gitignore</code>. This file specifies intentionally untracked files that Git should ignore. Files already tracked by Git are not affected.</p>
          <textarea v-model="ignore" class="gd-set__ignore" spellcheck="false" aria-label=".gitignore"></textarea>
          <p v-if="v.ignored.length" class="gd-dim">Currently ignored: {{ v.ignored.join(', ') }}</p>
        </template>
        <template v-else>
          <label class="gd-radio"><input v-model="scope" type="radio" value="global" disabled /> Use my global Git config</label>
          <label class="gd-radio"><input v-model="scope" type="radio" value="local" /> Use a local Git config</label>
          <div class="gd-field"><label for="gd-cfg-name">Name</label>
            <input id="gd-cfg-name" v-model="name" class="gd-input" /></div>
          <div class="gd-field"><label for="gd-cfg-email">Email</label>
            <input id="gd-cfg-email" v-model="email" class="gd-input" type="email" /></div>
          <p v-if="emailError" class="gd-err">{{ emailError }}</p>
          <p class="gd-dim">Commits you make in this repository are attributed to this name and email.</p>
        </template>
      </section>
    </div>
    <template #footer>
      <button type="button" class="gd-btn gd-btn--primary" :disabled="busy || !dirty || Boolean(emailError) || !name.trim()" @click="save">Save</button>
      <button type="button" class="gd-btn" @click="$emit('close')">Cancel</button>
    </template>
  </GdDialog>
</template>

<script setup lang="ts">
/**
 * Repository → Repository settings: Remote, Ignored files (.gitignore), Git config.
 * Saving runs `git config user.name/user.email` and writes `.gitignore` with
 * `printf '%s' ... > .gitignore` (see gd.ts for why printf).
 */
import { computed, ref } from 'vue';
import GdDialog from './GdDialog.vue';
import GdIcon from './GdIcon.vue';
import { cmd, type GdView } from './gd';

const props = defineProps<{
  v: GdView;
  busy: boolean;
  initialTab?: string;
  run: (commands: string[], success: string) => Promise<boolean>;
}>();
const emit = defineEmits<{ (event: 'close'): void; (event: 'publish'): void }>();

const TABS = [
  { id: 'remote', label: 'Remote', icon: 'sync' },
  { id: 'ignored', label: 'Ignored files', icon: 'file' },
  { id: 'config', label: 'Git config', icon: 'gear' },
];
const tab = ref(props.initialTab || 'remote');
const ignore = ref(props.v.gitignore);
const scope = ref('local');
const name = ref(props.v.user.name || '');
const email = ref(props.v.user.email || '');

const emailError = computed(() => email.value && !/^[^\s@]+@[^\s@]+$/.test(email.value)
  ? 'This email address does not look valid.' : '');
const dirty = computed(() => ignore.value !== props.v.gitignore || name.value !== props.v.user.name
  || email.value !== props.v.user.email);

async function save() {
  const commands: string[] = [];
  if (name.value !== props.v.user.name) commands.push(cmd.config('user.name', name.value.trim()));
  if (email.value !== props.v.user.email) commands.push(cmd.config('user.email', email.value.trim()));
  if (ignore.value !== props.v.gitignore) commands.push(cmd.write('.gitignore', ignore.value));
  if (await props.run(commands, 'Repository settings saved')) emit('close');
}
</script>

<style scoped>
.gd-set { display: flex; gap: 16px; min-height: 260px; }
.gd-set__tabs { display: flex; flex-direction: column; width: 150px; flex: none; gap: 2px; }
.gd-set__tab {
  display: flex; align-items: center; gap: 6px; border: 0; background: none; text-align: left; padding: 6px 8px;
  border-radius: 3px; font-size: 12px; color: var(--gd-text); cursor: default;
}
.gd-set__tab:hover { background: var(--gd-hover); }
.gd-set__tab.is-active { background: var(--gd-blue); color: #fff; }
.gd-set__pane { flex: 1; min-width: 0; }
.gd-set__pane p { margin: 0 0 8px; }
.gd-set__ignore {
  width: 100%; min-height: 180px; font-family: var(--gd-mono); font-size: 12px; border: 1px solid #d1d5da; border-radius: 3px;
  padding: 6px 8px; resize: vertical; color: var(--gd-text); background: #fff; outline: none;
}
.gd-set__ignore:focus, .gd-input:focus { border-color: var(--gd-blue); box-shadow: 0 0 0 3px rgba(3, 102, 214, 0.3); }
.gd-set__empty { text-align: center; display: flex; flex-direction: column; align-items: center; gap: 4px; padding: 16px 0; }
.gd-dim { color: var(--gd-text-secondary); }
.gd-radio { display: flex; align-items: center; gap: 6px; margin-bottom: 8px; }
.gd-field { display: flex; flex-direction: column; gap: 4px; margin-bottom: 10px; }
.gd-field label { font-weight: 600; }
.gd-input {
  width: 100%; border: 1px solid #d1d5da; border-radius: 3px; padding: 4px 6px; font-size: 12px; height: 28px;
  background: #fff; color: var(--gd-text); outline: none;
}
.gd-err { color: var(--gd-red); }
.gd-set__pane code { font-family: var(--gd-mono); font-size: 11px; background: #f6f8fa; padding: 1px 4px; border-radius: 3px; }
@container sl-portal (max-width: 620px) {
  .gd-set { flex-direction: column; }
  .gd-set { gap: 12px; min-height: 0; }
  .gd-set__tabs { flex-direction: row; width: auto; overflow-x: auto; scrollbar-width: none;
    border-bottom: 1px solid var(--gd-border); padding-bottom: 6px; }
  .gd-set__tab { flex: none; white-space: nowrap; min-height: 32px; }
}
</style>
