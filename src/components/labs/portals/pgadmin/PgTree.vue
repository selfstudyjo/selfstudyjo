<template>
  <div ref="host" class="pg-tree" role="tree" aria-label="Object Explorer" tabindex="0" @keydown="onKey">
    <div v-for="row in visible" :key="row.node.id" class="pg-tree__row" role="treeitem"
         :aria-expanded="hasKids(row.node) ? expanded.has(row.node.id) : undefined"
         :aria-selected="row.node.id === selectedId" :data-node="row.node.id"
         :class="{ 'is-selected': row.node.id === selectedId, 'is-empty': row.node.kind === 'empty' }"
         :style="{ paddingLeft: 6 + row.depth * 16 + 'px' }"
         @click="$emit('select', row.node)" @dblclick="onDouble(row.node)"
         @contextmenu.prevent="$emit('menu', row.node, $event)">
      <button v-if="hasKids(row.node)" type="button" class="pg-tree__twisty" tabindex="-1"
              :aria-label="(expanded.has(row.node.id) ? 'Collapse ' : 'Expand ') + row.node.label"
              @click.stop="$emit('toggle', row.node)">
        <PgIcon :name="expanded.has(row.node.id) ? 'chev-down' : 'chev-right'" :size="12" />
      </button>
      <span v-else class="pg-tree__twisty is-leaf" />
      <PgIcon :name="row.node.icon" :size="16" class="pg-tree__icon" />
      <span class="pg-tree__label">{{ row.node.label }}</span>
      <span v-if="row.node.count !== undefined && row.node.kind !== 'database' && row.node.kind !== 'server'" class="pg-tree__count">({{ row.node.count }})</span>
    </div>
  </div>
</template>

<script setup lang="ts">
/** The Object Explorer: pgAdmin's browser tree, as a flat list of visible rows. */
import { computed, nextTick, ref, watch } from 'vue';
import PgIcon from './PgIcon.vue';
import type { TreeNode } from './pg';

const props = defineProps<{ root: TreeNode; expanded: Set<string>; selectedId: string; filter: string }>();
const emit = defineEmits<{
  (event: 'select', node: TreeNode): void;
  (event: 'toggle', node: TreeNode): void;
  (event: 'open', node: TreeNode): void;
  (event: 'menu', node: TreeNode, e: MouseEvent | KeyboardEvent): void;
}>();

const host = ref<HTMLElement | null>(null);

function hasKids(node: TreeNode) {
  return Boolean(node.children && node.children.length);
}

/** With a filter, every node whose label matches - and its ancestors - is shown expanded. */
const visible = computed(() => {
  const out: { node: TreeNode; depth: number }[] = [];
  const needle = props.filter.trim().toLowerCase();
  const matches = (n: TreeNode): boolean => n.label.toLowerCase().includes(needle)
    || (n.children || []).some(matches);
  const walk = (n: TreeNode, depth: number) => {
    if (needle && !matches(n)) return;
    out.push({ node: n, depth });
    const open = needle ? true : props.expanded.has(n.id);
    if (open) for (const child of n.children || []) walk(child, depth + 1);
  };
  walk(props.root, 0);
  return out;
});

function onDouble(node: TreeNode) {
  if (hasKids(node)) emit('toggle', node);
  else emit('open', node);
}

function onKey(event: KeyboardEvent) {
  const list = visible.value;
  const index = list.findIndex(r => r.node.id === props.selectedId);
  const current = list[index]?.node;
  if (event.key === 'ArrowDown') {
    event.preventDefault();
    const next = list[Math.min(list.length - 1, index + 1)];
    if (next) emit('select', next.node);
  } else if (event.key === 'ArrowUp') {
    event.preventDefault();
    const prev = list[Math.max(0, index - 1)];
    if (prev) emit('select', prev.node);
  } else if (event.key === 'ArrowRight' && current && hasKids(current) && !props.expanded.has(current.id)) {
    event.preventDefault();
    emit('toggle', current);
  } else if (event.key === 'ArrowLeft' && current && props.expanded.has(current.id)) {
    event.preventDefault();
    emit('toggle', current);
  } else if ((event.key === 'ContextMenu' || (event.shiftKey && event.key === 'F10')) && current) {
    event.preventDefault();
    emit('menu', current, event);
  } else if (event.key === 'Enter' && current) {
    onDouble(current);
  }
}

watch(() => props.selectedId, async id => {
  await nextTick();
  const el = host.value?.querySelector(`[data-node="${CSS.escape(id)}"]`) as HTMLElement | null;
  el?.scrollIntoView({ block: 'nearest' });
});
</script>

<style scoped>
.pg-tree { flex: 1; min-height: 0; overflow: auto; padding: 2px 0 8px; font-size: 13px; outline: none; }
.pg-tree__row {
  display: flex; align-items: center; gap: 4px; height: 24px; padding-right: 8px; cursor: default;
  white-space: nowrap; color: var(--pg-text); user-select: none;
}
.pg-tree__row:hover { background: var(--pg-grey-200); }
.pg-tree__row.is-selected { background: var(--pg-tree-selected); color: var(--pg-text); }
.pg-tree:focus-visible .pg-tree__row.is-selected { box-shadow: inset 0 0 0 1px var(--pg-primary); }
.pg-tree__row.is-empty { color: var(--pg-muted); }
.pg-tree__twisty {
  width: 16px; height: 16px; flex: none; display: inline-grid; place-items: center; border: 0; background: none; padding: 0;
  color: var(--pg-muted); cursor: pointer; border-radius: 2px;
}
.pg-tree__twisty:hover { color: var(--pg-text); background: var(--pg-grey-400); }
.pg-tree__twisty.is-leaf { cursor: default; background: none; }
.pg-tree__label { overflow: hidden; text-overflow: ellipsis; }
.pg-tree__count { color: var(--pg-muted); }
</style>
