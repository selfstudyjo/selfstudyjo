<template>
  <div class="gd-ed">
    <div class="gd-ed__bar">
      <span class="gd-ed__file"><GdIcon name="fileCode" :size="14" /> {{ path }}</span>
      <span class="gd-ed__count" :class="{ 'is-clean': !blocks.length }">
        {{ blocks.length ? `${blocks.length} conflict${blocks.length === 1 ? '' : 's'} left` : 'No conflict markers' }}
      </span>
    </div>
    <div v-for="(block, i) in blocks" :key="i" class="gd-ed__block">
      <div class="gd-ed__blockhead">
        Conflict {{ i + 1 }} — line {{ block.line }}
        <span class="gd-ed__actions">
          <button type="button" class="gd-link" @click="accept(i, 'ours')">Accept {{ oursLabel }}</button>
          <span>|</span>
          <button type="button" class="gd-link" @click="accept(i, 'theirs')">Accept {{ theirsLabel }}</button>
          <span>|</span>
          <button type="button" class="gd-link" @click="accept(i, 'both')">Accept both</button>
        </span>
      </div>
      <pre class="gd-ed__side gd-ed__side--ours">{{ block.ours || '(empty)' }}</pre>
      <pre class="gd-ed__side gd-ed__side--theirs">{{ block.theirs || '(empty)' }}</pre>
    </div>
    <textarea v-model="text" class="gd-ed__text" spellcheck="false" aria-label="File contents"
              wrap="off"></textarea>
  </div>
</template>

<script setup lang="ts">
/**
 * The small built-in conflict editor.
 *
 * GitHub Desktop hands a conflicted file to your external editor; this lab has
 * none, so the editor is here. It edits the text and offers the Accept
 * current / incoming / both actions every editor puts over a conflict block.
 * Saving is the shell's job: it writes the file with `printf '%s' ... > path`
 * (the command a student would type in the terminal) and then `git add`.
 */
import { computed, ref, watch } from 'vue';
import GdIcon from './GdIcon.vue';

const props = defineProps<{ path: string; content: string; oursLabel: string; theirsLabel: string }>();
const emit = defineEmits<{ (event: 'update', text: string): void }>();

const text = ref(props.content);
watch(() => props.content, value => { text.value = value; });
watch(text, value => emit('update', value), { immediate: true });

interface Block { start: number; mid: number; end: number; line: number; ours: string; theirs: string }

const blocks = computed<Block[]>(() => {
  const lines = text.value.split('\n');
  const out: Block[] = [];
  for (let i = 0; i < lines.length; i++) {
    if (!lines[i].startsWith('<<<<<<<')) continue;
    const mid = lines.findIndex((l, j) => j > i && l.startsWith('======='));
    if (mid < 0) break;
    const end = lines.findIndex((l, j) => j > mid && l.startsWith('>>>>>>>'));
    if (end < 0) break;
    out.push({ start: i, mid, end, line: i + 1,
               ours: lines.slice(i + 1, mid).join('\n'), theirs: lines.slice(mid + 1, end).join('\n') });
    i = end;
  }
  return out;
});

function accept(index: number, which: 'ours' | 'theirs' | 'both') {
  const block = blocks.value[index];
  if (!block) return;
  const lines = text.value.split('\n');
  const ours = lines.slice(block.start + 1, block.mid);
  const theirs = lines.slice(block.mid + 1, block.end);
  const keep = which === 'ours' ? ours : which === 'theirs' ? theirs : [...ours, ...theirs];
  lines.splice(block.start, block.end - block.start + 1, ...keep);
  text.value = lines.join('\n');
}
</script>

<style scoped>
.gd-ed { display: flex; flex-direction: column; gap: 8px; }
.gd-ed__bar { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
.gd-ed__file { display: inline-flex; align-items: center; gap: 4px; font-family: var(--gd-mono); font-size: 11px; }
.gd-ed__count { color: var(--gd-conflicted); font-weight: 600; font-size: 11px; }
.gd-ed__count.is-clean { color: var(--gd-green); }
.gd-ed__block { border: 1px solid var(--gd-border); border-radius: 3px; overflow: hidden; }
.gd-ed__blockhead {
  display: flex; flex-wrap: wrap; justify-content: space-between; gap: 6px; padding: 4px 8px;
  background: #f6f8fa; font-size: 11px; color: var(--gd-text-secondary); border-bottom: 1px solid var(--gd-border);
}
.gd-ed__actions { display: inline-flex; flex-wrap: wrap; gap: 2px 6px; }
.gd-ed__actions .gd-link { white-space: nowrap; }
@container sl-portal (max-width: 700px) { .gd-ed__actions .gd-link { min-height: 24px; font-size: 12px; } }
.gd-ed__side { margin: 0; color: var(--gd-text); padding: 4px 8px; font-family: var(--gd-mono); font-size: 11px; white-space: pre-wrap; word-break: break-word; }
.gd-ed__side--ours { background: #e6ffed; border-left: 3px solid #34d058; }
.gd-ed__side--theirs { background: #f1f8ff; border-left: 3px solid #2188ff; }
.gd-ed__text {
  width: 100%; min-height: 180px; resize: vertical; font-family: var(--gd-mono); font-size: 12px; line-height: 18px;
  border: 1px solid #d1d5da; border-radius: 3px; padding: 6px 8px; color: var(--gd-text); background: #fff; outline: none;
  white-space: pre; overflow: auto;
}
.gd-ed__text:focus { border-color: var(--gd-blue); box-shadow: 0 0 0 3px rgba(3, 102, 214, 0.3); }
.gd-link { border: 0; background: none; color: var(--gd-blue); padding: 0; font-size: 11px; cursor: pointer; }
.gd-link:hover { text-decoration: underline; }
</style>
