<template>
  <div class="gd-cd">
    <header class="gd-cd__head">
      <h2 class="gd-cd__summary">{{ commit.summary }}</h2>
      <p v-if="commit.body" class="gd-cd__body">{{ commit.body }}</p>
      <div class="gd-cd__meta">
        <span class="gd-cd__item">
          <span class="gd-avatar" aria-hidden="true"><GdIcon name="person" :size="11" /></span>
          <b>{{ commit.author }}</b>
          <span class="gd-dim">committed {{ relTime(commit.at) }}</span>
        </span>
        <span class="gd-cd__item gd-cd__sha" :title="commit.full">
          <GdIcon name="commit" :size="14" /> {{ commit.sha }}
          <button type="button" class="gd-cd__copy" title="Copy the full SHA" @click="$emit('copy', commit.full)">Copy</button>
        </span>
        <span class="gd-cd__item">
          <span class="gd-add">+{{ adds }}</span><span class="gd-del">−{{ dels }}</span>
        </span>
        <span class="gd-cd__item gd-dim">
          <GdIcon name="file" :size="14" /> {{ plural(commit.changes.length, 'changed file') }}
        </span>
        <span v-for="t in commit.tags" :key="t" class="gd-cd__tag"><GdIcon name="tag" :size="12" /> {{ t }}</span>
        <span v-if="commit.merge" class="gd-cd__item gd-dim">Merge of {{ commit.parents.join(' and ') }}</span>
      </div>
    </header>
    <div class="gd-cd__split">
      <ul class="gd-cd__files" role="listbox" aria-label="Changed files in this commit">
        <li v-for="file in commit.changes" :key="file.path" class="gd-cd__file" role="option"
            :aria-selected="file.path === current?.path" :class="{ 'is-selected': file.path === current?.path }"
            :title="file.path" @click="$emit('select-file', file.path)">
          <span class="gd-cd__path"><span class="gd-dim">{{ splitPath(file.path)[0] }}</span>{{ splitPath(file.path)[1] }}</span>
          <span :class="`is-${file.status}`"><GdIcon :name="ICON[file.status]" :size="16" /></span>
        </li>
        <li v-if="!commit.changes.length" class="gd-cd__none">This commit has no changes.</li>
      </ul>
      <div class="gd-cd__diff">
        <GdDiff v-if="current" :path="current.path" :hunks="current.hunks" :status="current.status"
                :additions="current.additions" :deletions="current.deletions" />
        <div v-else class="gd-cd__nodiff">No file selected</div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
/** A selected commit: header with author / SHA / +- counts, its files, the diff. */
import { computed } from 'vue';
import GdDiff from './GdDiff.vue';
import GdIcon from './GdIcon.vue';
import { plural, relTime, splitPath, type Commit } from './gd';

const props = defineProps<{ commit: Commit; file: string }>();
defineEmits<{ (event: 'select-file', path: string): void; (event: 'copy', sha: string): void }>();

const ICON: Record<string, string> = {
  new: 'diffAdded', modified: 'diffModified', deleted: 'diffRemoved', renamed: 'diffRenamed',
  conflicted: 'alert',
};

const current = computed(() => props.commit.changes.find(f => f.path === props.file)
  || props.commit.changes[0] || null);
const adds = computed(() => props.commit.changes.reduce((n, f) => n + (f.additions || 0), 0));
const dels = computed(() => props.commit.changes.reduce((n, f) => n + (f.deletions || 0), 0));
</script>

<style scoped>
.gd-cd { display: flex; flex-direction: column; height: 100%; min-height: 0; }
.gd-cd__head { padding: 10px 12px; border-bottom: 1px solid var(--gd-border); flex: none; background: #fff; }
.gd-cd__summary { margin: 0; font-size: 14px; font-weight: 600; line-height: 20px; color: var(--gd-text); word-break: break-word; }
.gd-cd__body { margin: 6px 0 0; white-space: pre-wrap; font-size: 12px; color: var(--gd-text); max-height: 90px; overflow: auto; }
.gd-cd__meta { display: flex; flex-wrap: wrap; gap: 4px 16px; margin-top: 8px; font-size: 12px; align-items: center; color: var(--gd-text); }
.gd-cd__item { display: inline-flex; align-items: center; gap: 5px; }
.gd-cd__sha { font-family: var(--gd-mono); font-size: 11px; color: var(--gd-text-secondary); }
.gd-cd__copy {
  border: 0; background: none; color: var(--gd-blue); font-size: 11px; padding: 0 2px; cursor: pointer;
}
.gd-cd__copy:hover { text-decoration: underline; }
.gd-cd__tag {
  display: inline-flex; align-items: center; gap: 3px; font-size: 11px; padding: 0 6px; border-radius: 9px;
  border: 1px solid #c8e1ff; background: #f1f8ff; color: var(--gd-blue);
}
.gd-avatar {
  width: 16px; height: 16px; border-radius: 50%; background: #e1e4e8; color: #6a737d;
  display: inline-grid; place-items: center;
}
.gd-dim { color: var(--gd-text-secondary); }
.gd-add { color: var(--gd-green); font-family: var(--gd-mono); font-size: 11px; margin-right: 4px; }
.gd-del { color: var(--gd-red); font-family: var(--gd-mono); font-size: 11px; }
.gd-cd__split { flex: 1; display: flex; min-height: 0; }
.gd-cd__files {
  list-style: none; margin: 0; padding: 0; width: 220px; flex: none; overflow: auto;
  border-right: 1px solid var(--gd-border); background: #fff;
}
.gd-cd__file {
  display: flex; align-items: center; gap: 6px; height: 29px; padding: 0 10px; font-size: 12px; cursor: default;
  color: var(--gd-text);
}
.gd-cd__file:hover { background: var(--gd-hover); }
.gd-cd__file.is-selected { background: var(--gd-selected); }
.gd-cd__path { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.gd-cd__none, .gd-cd__nodiff { padding: 12px; color: var(--gd-text-secondary); font-size: 12px; }
.gd-cd__diff { flex: 1; min-width: 0; display: flex; flex-direction: column; }
.is-new { color: var(--gd-green); display: inline-flex; }
.is-modified { color: var(--gd-modified); display: inline-flex; }
.is-deleted { color: var(--gd-red); display: inline-flex; }
@container sl-portal (max-width: 760px) {
  .gd-cd__split { flex-direction: column; }
  .gd-cd__files { width: auto; max-height: 120px; border-right: 0; border-bottom: 1px solid var(--gd-border); }
}
</style>
