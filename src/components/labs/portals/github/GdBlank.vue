<template>
  <!-- Not a repository yet -->
  <div v-if="kind === 'norepo'" class="gd-blank gd-blank--norepo">
    <GdIcon name="repo" :size="48" class="gd-blank__art" />
    <h1 class="gd-blank__title">Can't find "{{ v.repository.name }}"</h1>
    <p>This directory does not appear to be a Git repository.<br />Would you like to
      <button type="button" class="gd-link" @click="$emit('create')">create a repository</button> here instead?</p>
    <p class="gd-dim gd-blank__path">{{ v.repository.path }}</p>
  </div>

  <!-- Stashed changes -->
  <div v-else-if="kind === 'stash' && stash" class="gd-blank gd-blank--stash">
    <header class="gd-stash__head">
      <h2>Stashed changes</h2>
      <div class="gd-stash__btns">
        <button type="button" class="gd-btn gd-btn--primary" :disabled="busy" @click="$emit('restore', stash)">Restore</button>
        <button type="button" class="gd-btn" :disabled="busy" @click="$emit('discard-stash', stash)">Discard</button>
      </div>
    </header>
    <p class="gd-dim gd-stash__note">Restore will move your stashed files to the Changes list.</p>
    <ul class="gd-stash__files">
      <li v-for="f in stash.files" :key="f"><GdIcon name="file" :size="14" /> {{ f }}</li>
    </ul>
  </div>

  <!-- No local changes -->
  <div v-else class="gd-blank gd-blank--clean">
    <div class="gd-blank__inner">
      <h1 class="gd-blank__title">No local changes</h1>
      <p class="gd-blank__lead">There are no uncommitted changes in this repository. Here are some friendly suggestions for what to do next.</p>
      <div class="gd-card">
        <div class="gd-card__text">
          <h3>Publish your repository to GitHub</h3>
          <p>This repository is currently only available on your local machine. By publishing it on GitHub you can share it, and collaborate with others.</p>
          <p class="gd-dim">Always available in the toolbar for local repositories or <kbd>Ctrl</kbd> <kbd>P</kbd></p>
        </div>
        <button type="button" class="gd-btn gd-btn--primary" @click="$emit('publish')">Publish repository</button>
      </div>
      <div class="gd-card">
        <div class="gd-card__text">
          <h3>Open the repository in your external editor</h3>
          <p class="gd-dim">Select your editor in Options. Repository menu or <kbd>Ctrl</kbd> <kbd>Shift</kbd> <kbd>A</kbd></p>
        </div>
        <button type="button" class="gd-btn" disabled>Open in Visual Studio Code</button>
      </div>
      <div class="gd-card">
        <div class="gd-card__text">
          <h3>View the files of your repository in Explorer</h3>
          <p class="gd-dim">Repository menu or <kbd>Ctrl</kbd> <kbd>Shift</kbd> <kbd>F</kbd></p>
        </div>
        <button type="button" class="gd-btn" disabled>Show in Explorer</button>
      </div>
      <div v-if="otherStashes" class="gd-card">
        <div class="gd-card__text">
          <h3>Stashed changes on other branches</h3>
          <p class="gd-dim">{{ otherStashes }} stash{{ otherStashes === 1 ? '' : 'es' }} saved with “Leave my changes”. Switch to that branch to restore.</p>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
/** The right-hand pane when there is nothing to diff: no repo, a stash, or a clean tree. */
import { computed } from 'vue';
import GdIcon from './GdIcon.vue';
import type { GdView, Stash } from './gd';

const props = defineProps<{ kind: 'norepo' | 'stash' | 'clean'; v: GdView; busy: boolean; stash?: Stash | null }>();
defineEmits<{
  (event: 'create'): void;
  (event: 'publish'): void;
  (event: 'restore', stash: Stash): void;
  (event: 'discard-stash', stash: Stash): void;
}>();

const otherStashes = computed(() => props.v.stashes.filter(s => s.desktop && s.branch !== props.v.branch).length);
</script>

<style scoped>
.gd-blank { height: 100%; overflow: auto; background: #fff; color: var(--gd-text); font-size: 12px; }
.gd-blank--norepo { display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center; padding: 24px; }
.gd-blank__art { color: #d1d5da; margin-bottom: 12px; }
.gd-blank__title { margin: 0 0 8px; font-size: 24px; font-weight: 400; line-height: 1.25; }
.gd-blank--norepo p { margin: 0 0 6px; font-size: 14px; line-height: 20px; }
.gd-blank__path { font-family: var(--gd-mono); font-size: 11px !important; }
.gd-blank--clean { display: flex; justify-content: center; }
.gd-blank__inner { width: 100%; max-width: 620px; padding: 40px 24px; }
.gd-blank__lead { font-size: 14px; line-height: 20px; margin: 0 0 20px; color: var(--gd-text-secondary); }
.gd-card {
  display: flex; align-items: center; gap: 16px; padding: 14px 16px; border: 1px solid var(--gd-border);
  border-radius: 6px; margin-bottom: 10px; background: #fff;
}
.gd-card__text { flex: 1; min-width: 0; }
.gd-card h3 { margin: 0 0 4px; font-size: 13px; font-weight: 600; }
.gd-card p { margin: 0 0 4px; line-height: 17px; }
.gd-card kbd {
  font-family: var(--gd-sans); font-size: 10px; padding: 1px 4px; border: 1px solid #d1d5da; border-bottom-width: 2px;
  border-radius: 3px; background: #fafbfc; color: var(--gd-text);
}
.gd-dim { color: var(--gd-text-secondary); }
.gd-link { border: 0; background: none; color: var(--gd-blue); padding: 0; font: inherit; cursor: pointer; }
.gd-link:hover { text-decoration: underline; }
.gd-stash__head { display: flex; align-items: center; justify-content: space-between; gap: 8px; padding: 12px 16px; border-bottom: 1px solid var(--gd-border); flex-wrap: wrap; }
.gd-stash__head h2 { margin: 0; font-size: 14px; font-weight: 600; }
.gd-stash__btns { display: flex; gap: 6px; }
.gd-stash__note { padding: 8px 16px 0; margin: 0; }
.gd-stash__files { list-style: none; padding: 8px 16px; margin: 0; font-family: var(--gd-mono); font-size: 11px; }
.gd-stash__files li { display: flex; align-items: center; gap: 6px; padding: 4px 0; }
@container sl-portal (max-width: 560px) {
  .gd-card { flex-direction: column; align-items: flex-start; }
  .gd-blank__inner { padding: 20px 14px; }
}
</style>
