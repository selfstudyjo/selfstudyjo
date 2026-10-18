<template>
  <div class="gd-diff">
    <header class="gd-diff__head">
      <span class="gd-diff__path" :title="path"><span class="gd-dim">{{ dir }}</span>{{ name }}</span>
      <span v-if="conflicted" class="gd-diff__badge">Conflicted</span>
      <span class="gd-diff__count" :title="`${additions} additions, ${deletions} deletions`">
        <span class="gd-add">+{{ additions }}</span> <span class="gd-del">−{{ deletions }}</span>
      </span>
      <button type="button" class="gd-diff__gear" title="Diff settings" aria-label="Diff settings"
              @click="split = !split">
        <GdIcon name="gear" :size="14" />
      </button>
    </header>
    <div v-if="!hunks.length" class="gd-diff__empty">
      <template v-if="status === 'new' || status === 'deleted'">The file is empty.</template>
      <template v-else>No changes to display in this file.</template>
    </div>
    <div v-else class="gd-diff__scroll" :class="{ 'is-split': split }">
      <table v-if="!split" class="gd-diff__table">
        <tbody>
          <template v-for="(hunk, h) in hunks" :key="h">
            <tr class="gd-row gd-row--hunk">
              <td class="gd-gutter" colspan="2"></td>
              <td class="gd-code">{{ hunk.header }}</td>
            </tr>
            <tr v-for="(line, i) in hunk.lines" :key="`${h}-${i}`" class="gd-row" :class="rowClass(line)">
              <td class="gd-gutter gd-gutter--o">{{ line.o ?? '' }}</td>
              <td class="gd-gutter gd-gutter--n">{{ line.n ?? '' }}</td>
              <td class="gd-code"><span class="gd-marker" :class="markerClass(line.text)">{{ line.text || ' ' }}</span></td>
            </tr>
          </template>
        </tbody>
      </table>
      <table v-else class="gd-diff__table gd-diff__table--split">
        <tbody>
          <template v-for="(hunk, h) in hunks" :key="h">
            <tr class="gd-row gd-row--hunk">
              <td class="gd-gutter"></td><td class="gd-code">{{ hunk.header }}</td>
              <td class="gd-gutter"></td><td class="gd-code"></td>
            </tr>
            <tr v-for="(pair, i) in pairs(hunk)" :key="`${h}-s${i}`" class="gd-row">
              <td class="gd-gutter" :class="pair.left?.t === '-' ? 'gd-cell--del' : ''">{{ pair.left?.o ?? '' }}</td>
              <td class="gd-code" :class="pair.left ? (pair.left.t === '-' ? 'gd-cell--del' : '') : 'gd-cell--none'">{{ pair.left?.text ?? '' }}</td>
              <td class="gd-gutter" :class="pair.right?.t === '+' ? 'gd-cell--add' : ''">{{ pair.right?.n ?? '' }}</td>
              <td class="gd-code" :class="pair.right ? (pair.right.t === '+' ? 'gd-cell--add' : '') : 'gd-cell--none'">{{ pair.right?.text ?? '' }}</td>
            </tr>
          </template>
        </tbody>
      </table>
    </div>
  </div>
</template>

<script setup lang="ts">
/**
 * The diff viewer: two line-number gutters, green and red rows, blue hunk
 * headers — GitHub Desktop's unified view, with its split view behind the gear.
 * The hunks are computed by the engine (`view().changes[].hunks`), so what is
 * drawn here is exactly what `git diff` would print.
 */
import { computed, ref } from 'vue';
import GdIcon from './GdIcon.vue';
import { splitPath, type DiffRow, type FileStatus, type Hunk } from './gd';

const props = defineProps<{
  path: string; hunks: Hunk[]; status: FileStatus; additions: number; deletions: number;
}>();

const split = ref(false);
const dir = computed(() => splitPath(props.path)[0]);
const name = computed(() => splitPath(props.path)[1]);
const conflicted = computed(() => props.status === 'conflicted');

function rowClass(line: DiffRow) {
  return line.t === '+' ? 'gd-row--add' : line.t === '-' ? 'gd-row--del' : 'gd-row--ctx';
}

function markerClass(text: string) {
  return /^(<{7}|={7}|>{7})( |$)/.test(text) ? 'is-conflict-marker' : '';
}

function pairs(hunk: Hunk) {
  const out: { left: DiffRow | null; right: DiffRow | null }[] = [];
  let dels: DiffRow[] = [];
  let adds: DiffRow[] = [];
  const flush = () => {
    const n = Math.max(dels.length, adds.length);
    for (let i = 0; i < n; i++) out.push({ left: dels[i] || null, right: adds[i] || null });
    dels = []; adds = [];
  };
  for (const line of hunk.lines) {
    if (line.t === '-') dels.push(line);
    else if (line.t === '+') adds.push(line);
    else { flush(); out.push({ left: line, right: line }); }
  }
  flush();
  return out;
}
</script>

<style scoped>
.gd-diff { display: flex; flex-direction: column; min-height: 0; height: 100%; background: #fff; }
.gd-diff__head {
  display: flex; align-items: center; gap: 8px; height: 30px; padding: 0 10px; flex: none;
  border-bottom: 1px solid var(--gd-border); font-size: 12px;
}
.gd-diff__path { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.gd-dim { color: var(--gd-text-secondary); }
.gd-diff__badge { color: var(--gd-conflicted); font-weight: 600; }
.gd-diff__count { font-family: var(--gd-mono); font-size: 11px; white-space: nowrap; }
.gd-add { color: var(--gd-green); }
.gd-del { color: var(--gd-red); }
.gd-diff__gear {
  border: 0; background: none; color: var(--gd-text-secondary); padding: 3px; border-radius: 3px;
  display: inline-flex; cursor: pointer;
}
.gd-diff__gear:hover { background: var(--gd-hover); color: var(--gd-text); }
.gd-diff__empty {
  flex: 1; display: grid; place-items: center; color: var(--gd-text-secondary); font-size: 12px;
}
.gd-diff__scroll { flex: 1; overflow: auto; min-height: 0; }
.gd-diff__table {
  border-collapse: collapse; min-width: 100%; font-family: var(--gd-mono); font-size: 12px; line-height: 20px;
}
.gd-diff__table--split { table-layout: fixed; width: 100%; }
.gd-diff__table--split .gd-code { white-space: pre-wrap; word-break: break-all; }
.gd-gutter {
  width: 46px; min-width: 46px; padding: 0 8px 0 4px; text-align: right; color: #6a737d;
  border-right: 1px solid var(--gd-border); user-select: none; vertical-align: top; white-space: nowrap;
}
.gd-code { padding: 0 10px; white-space: pre; color: var(--gd-text); }
.gd-row--hunk .gd-gutter { background: #dbedff; border-color: #c1dcfc; }
.gd-row--hunk .gd-code { background: #f1f8ff; color: #586069; }
.gd-row--add .gd-gutter { background: #cdffd8; border-color: #bef5cb; color: #586069; }
.gd-row--add .gd-code { background: #e6ffed; }
.gd-row--del .gd-gutter { background: #ffdce0; border-color: #fdaeb7; color: #586069; }
.gd-row--del .gd-code { background: #ffeef0; }
.gd-cell--add { background: #e6ffed; }
.gd-gutter.gd-cell--add { background: #cdffd8; }
.gd-cell--del { background: #ffeef0; }
.gd-gutter.gd-cell--del { background: #ffdce0; }
.gd-cell--none { background: #fafbfc; }
.is-conflict-marker { color: var(--gd-conflicted); font-weight: 600; }
</style>
