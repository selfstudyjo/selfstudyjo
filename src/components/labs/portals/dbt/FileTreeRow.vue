<template>
  <li class="ft" role="treeitem" :aria-expanded="node.dir ? isOpen : undefined">
    <button type="button" class="ft__row" :class="{ 'is-active': !node.dir && node.path === active, 'is-generated': generated }"
            :style="{ paddingLeft: 10 + depth * 14 + 'px' }" :title="node.path"
            @click="node.dir ? $emit('toggle', node.path) : $emit('open', node.path)">
      <DbtIcon v-if="node.dir" :name="isOpen ? 'chevron-down' : 'chevron-right'" class="ft__chev" />
      <span v-else class="ft__chev"></span>
      <DbtIcon :name="node.dir ? (isOpen ? 'folder-open' : 'folder') : icon" class="ft__icon" :class="'ft__icon--' + icon" />
      <span class="ft__name">{{ node.name }}</span>
    </button>
    <ul v-if="node.dir && isOpen" class="ft__kids" role="group">
      <FileTreeRow v-for="child in node.children" :key="child.path" :node="child" :depth="depth + 1"
                   :open-dirs="openDirs" :active="active" @toggle="p => $emit('toggle', p)" @open="p => $emit('open', p)" />
    </ul>
  </li>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import DbtIcon from './DbtIcon.vue';
import type { TreeNode } from './dbt';

const props = defineProps<{ node: TreeNode; depth: number; openDirs: Set<string>; active: string }>();
defineEmits<{ (event: 'toggle', path: string): void; (event: 'open', path: string): void }>();

const isOpen = computed(() => props.openDirs.has(props.node.path));
const generated = computed(() => props.node.path === 'target' || props.node.path.startsWith('target/'));
const icon = computed(() => (/\.sql$/.test(props.node.name) ? 'sql' : /\.ya?ml$/.test(props.node.name) ? 'yaml'
  : /\.csv$/.test(props.node.name) ? 'seed' : 'file'));
</script>

<style scoped>
.ft { list-style: none; }
.ft__kids { list-style: none; margin: 0; padding: 0; }
.ft__row {
  width: 100%; display: flex; align-items: center; gap: 5px; height: 26px; border: 0; background: none; padding-right: 8px;
  font: 13px Inter, -apple-system, 'Segoe UI', sans-serif; color: #262A38; cursor: pointer; text-align: left;
}
.ft__row:hover { background: #ECEEF3; }
.ft__row.is-active { background: #DDEEF6; color: #0B4F6C; font-weight: 500; }
.ft__row.is-generated { color: #616A80; }
.ft__chev { width: 12px; height: 12px; color: #6B7285; flex: none; }
.ft__icon { width: 15px; height: 15px; color: #6B7285; }
.ft__icon--sql { color: #0B7EA3; }
.ft__icon--yaml { color: #A33B22; }
.ft__icon--seed { color: #7A5AA8; }
.ft__name { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; min-width: 0; }
</style>
