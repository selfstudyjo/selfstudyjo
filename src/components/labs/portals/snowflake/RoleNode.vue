<template>
  <div class="rn">
    <div class="rn__row">
      <button type="button" class="rn__box" :class="{ 'is-system': SYSTEM.includes(name) }" @click="$emit('open', name)">
        <SfIcon name="role" /><b>{{ name }}</b>
        <span v-if="users.length" class="rn__users" :title="users.join(', ')"><SfIcon name="user" />{{ users.length }}</span>
      </button>
    </div>
    <div v-if="kids.length && depth < 8" class="rn__kids">
      <RoleNode v-for="kid in kids" :key="kid" :name="kid" :children-of="childrenOf" :users-of="usersOf" :depth="depth + 1"
                @open="n => $emit('open', n)" />
    </div>
  </div>
</template>

<script setup lang="ts">
/** One role in the role hierarchy graph, with the roles it inherits below it. */
import { computed } from 'vue';
import SfIcon from './SfIcon.vue';

const props = defineProps<{ name: string; childrenOf: (name: string) => string[]; usersOf: (name: string) => string[]; depth: number }>();
defineEmits<{ (event: 'open', name: string): void }>();
const SYSTEM = ['ACCOUNTADMIN', 'SECURITYADMIN', 'USERADMIN', 'SYSADMIN', 'ORGADMIN', 'PUBLIC'];
const kids = computed(() => props.childrenOf(props.name));
const users = computed(() => props.usersOf(props.name));
</script>

<style scoped>
.rn { display: flex; flex-direction: column; }
.rn__row { display: flex; }
.rn__box {
  display: inline-flex; align-items: center; gap: 8px; height: 34px; padding: 0 12px; border-radius: 8px; cursor: pointer;
  border: 1px solid var(--sf-border-strong); background: var(--sf-bg); font: inherit; font-size: 13px; color: var(--sf-text);
  box-shadow: 0 1px 2px rgba(30, 37, 47, .08);
}
.rn__box:hover { border-color: var(--sf-primary); }
.rn__box.is-system { background: #EEF4FE; border-color: #B8CEF5; }
.rn__box b { font-weight: 600; }
.rn__box .sf-ico { width: 14px; height: 14px; color: var(--sf-primary-text); }
.rn__users { display: inline-flex; align-items: center; gap: 3px; font-size: 11px; color: var(--sf-text-2); padding-left: 6px; border-left: 1px solid var(--sf-border); }
.rn__users .sf-ico { color: var(--sf-text-2); width: 12px; height: 12px; }
.rn__kids { display: flex; flex-direction: column; gap: 6px; margin: 6px 0 0 18px; padding-left: 18px; border-left: 2px solid #B6C1D1; }
.rn__kids > .rn { position: relative; }
.rn__kids > .rn::before { content: ''; position: absolute; left: -18px; top: 17px; width: 16px; border-top: 2px solid #B6C1D1; }
</style>
