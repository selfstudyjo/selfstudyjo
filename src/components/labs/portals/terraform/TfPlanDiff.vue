<template>
  <div class="pd">
    <div class="pd__bar">
      <span class="pd__summary">
        <span class="pd__n pd__n--add">+{{ counts.add }}</span> to add,
        <span class="pd__n pd__n--change">~{{ counts.change }}</span> to change,
        <span class="pd__n pd__n--destroy">-{{ counts.destroy }}</span> to destroy
      </span>
      <span class="pd__tools">
        <button type="button" class="tf-link-btn" @click="setAll(true)">Expand all</button>
        <button type="button" class="tf-link-btn" @click="setAll(false)">Collapse all</button>
      </span>
    </div>
    <div v-for="action in actions" :key="action.address" class="pd__res">
      <button type="button" class="pd__head" :aria-expanded="open.has(action.address)" @click="toggle(action.address)">
        <TfIcon :name="open.has(action.address) ? 'chevron-down' : 'chevron-right'" :size="14" class="pd__chev" />
        <span class="pd__sym" :class="'pd__sym--' + action.action">{{ SYMBOL[action.action] }}</span>
        <span class="pd__addr">{{ action.address }}</span>
        <span class="pd__verb">{{ verb(action) }}</span>
      </button>
      <div v-if="open.has(action.address)" class="pd__body">
        <div class="pd__line pd__line--head">
          <span class="pd__mk" :class="'pd__mk--' + action.action">{{ SYMBOL[action.action] }}</span>
          resource "{{ action.type }}" "{{ action.name }}" {
        </div>
        <template v-if="action.action === 'update'">
          <div v-for="change in action.changes" :key="change.key" class="pd__line pd__line--attr">
            <span class="pd__mk pd__mk--update">~</span>
            <span class="pd__key">{{ change.key }}</span> = <span class="pd__old">{{ fmtValue(change.before) }}</span>
            <span class="pd__arrow">-&gt;</span> <span class="pd__new">{{ fmtValue(change.after) }}</span>
          </div>
        </template>
        <template v-else>
          <div v-for="(value, key) in action.attributes" :key="key" class="pd__line pd__line--attr">
            <span class="pd__mk" :class="action.action === 'destroy' ? 'pd__mk--destroy' : 'pd__mk--create'">{{ action.action === 'destroy' ? '-' : '+' }}</span>
            <span class="pd__key">{{ key }}</span> = <span>{{ fmtValue(value) }}</span>
            <span v-if="forces(action, String(key))" class="pd__forces"># forces replacement</span>
          </div>
          <div v-if="action.action !== 'destroy'" class="pd__line pd__line--attr pd__faint">
            <span class="pd__mk pd__mk--create">+</span><span class="pd__key">id</span> = (known after apply)
          </div>
        </template>
        <div class="pd__line pd__line--close">}</div>
      </div>
    </div>
    <p v-if="!actions.length" class="pd__none">No changes. Your infrastructure matches the configuration.</p>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import TfIcon from './TfIcon.vue';
import { fmtValue, type TfAction, type TfRun } from './tfKit';

const props = defineProps<{ actions: TfAction[]; counts: TfRun['counts'] }>();
const SYMBOL: Record<string, string> = { create: '+', update: '~', replace: '-/+', destroy: '-' };
const open = ref<Set<string>>(new Set(props.actions.length <= 3 ? props.actions.map(a => a.address) : []));

function toggle(address: string) {
  const next = new Set(open.value);
  if (next.has(address)) next.delete(address); else next.add(address);
  open.value = next;
}
function setAll(value: boolean) {
  open.value = new Set(value ? props.actions.map(a => a.address) : []);
}
function verb(action: TfAction) {
  if (action.reason === 'tainted') return 'is tainted, so must be replaced';
  if (action.reason === 'requested') return 'will be replaced, as requested';
  return { create: 'will be created', update: 'will be updated in-place', replace: 'must be replaced', destroy: 'will be destroyed' }[action.action];
}
function forces(action: TfAction, key: string) {
  return action.changes?.some(change => change.key === key && change.forces);
}
</script>

<style scoped src="./tfBase.css"></style>
<style scoped>
.pd { border: 1px solid var(--tf-border); border-radius: 6px; overflow: hidden; }
.pd__bar { display: flex; justify-content: space-between; gap: 12px; flex-wrap: wrap; padding: 10px 14px; background: var(--tf-surface-faint); border-bottom: 1px solid var(--tf-border); font-size: 13px; }
.pd__n { font-family: var(--tf-mono); font-weight: 600; }
.pd__n--add { color: var(--tf-fg-success); }
.pd__n--change { color: var(--tf-fg-warning); }
.pd__n--destroy { color: var(--tf-fg-critical); }
.pd__tools { display: flex; gap: 12px; }
.pd__res + .pd__res { border-top: 1px solid var(--tf-border); }
.pd__head { display: flex; align-items: center; gap: 8px; width: 100%; padding: 10px 14px; text-align: left; flex-wrap: wrap; }
.pd__head:hover { background: var(--tf-surface-faint); }
.pd__chev { color: var(--tf-fg-faint); }
.pd__sym { display: inline-grid; place-items: center; min-width: 26px; height: 20px; padding: 0 4px; border-radius: 4px; font-family: var(--tf-mono); font-weight: 700; font-size: 13px; }
.pd__sym--create { background: #d5f4e0; color: #00781e; }
.pd__sym--update { background: #fbeabf; color: #803d00; }
.pd__sym--replace { background: #ead2fe; color: #911ced; }
.pd__sym--destroy { background: #fbd4d4; color: #c00005; }
.pd__addr { font-family: var(--tf-mono); font-weight: 600; color: var(--tf-fg-strong); overflow-wrap: anywhere; }
.pd__verb { color: var(--tf-fg-faint); font-size: 13px; }
.pd__body { padding: 8px 14px 12px 40px; font-family: var(--tf-mono); font-size: 13px; line-height: 21px; background: var(--tf-surface-faint); overflow-x: auto; }
.pd__line { white-space: pre; }
.pd__line--head { color: var(--tf-fg-strong); }
.pd__line--attr { padding-left: 24px; }
.pd__line--close { padding-left: 30px; }
.pd__mk { display: inline-block; width: 30px; font-weight: 700; }
.pd__line--head .pd__mk { width: 30px; }
.pd__mk--create { color: var(--tf-fg-success); }
.pd__mk--update { color: var(--tf-fg-warning); }
.pd__mk--replace { color: #911ced; }
.pd__mk--destroy { color: var(--tf-fg-critical); }
.pd__key { color: #0046d1; }
.pd__old { color: var(--tf-fg-critical); text-decoration: line-through; }
.pd__new { color: var(--tf-fg-success); }
.pd__arrow { color: var(--tf-fg-faint); }
.pd__forces { color: var(--tf-fg-critical); margin-left: 8px; }
.pd__faint { color: var(--tf-fg-faint); }
.pd__none { padding: 14px; color: var(--tf-fg-faint); }
</style>
