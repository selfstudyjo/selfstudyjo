<template>
  <div class="pg-dlg-wrap" @mousedown.self="$emit('close')">
    <div class="pg-dlg" role="dialog" aria-modal="true" :aria-label="title" :style="{ width: width + 'px' }">
      <header class="pg-dlg__head">
        <PgIcon :name="icon" :size="16" />
        <h2 class="pg-dlg__title">{{ title }}</h2>
        <button type="button" class="pg-dlg__x" aria-label="Close" @click="$emit('close')"><PgIcon name="close" :size="14" /></button>
      </header>
      <nav v-if="tabs.length" class="pg-dlg__tabs" role="tablist">
        <button v-for="t in tabs" :key="t" type="button" role="tab" :aria-selected="modelValue === t"
                :class="{ 'is-active': modelValue === t }" @click="$emit('update:modelValue', t)">{{ t }}</button>
      </nav>
      <div class="pg-dlg__body"><slot /></div>
      <div v-if="error" class="pg-dlg__err" role="alert">
        <PgIcon name="error-circle" :size="16" />
        <span>{{ error }}</span>
        <button type="button" class="pg-dlg__errx" aria-label="Dismiss" @click="$emit('clear-error')"><PgIcon name="close" :size="12" /></button>
      </div>
      <footer class="pg-dlg__foot">
        <button type="button" class="pg-btn pg-btn--icon" title="Info" aria-label="Info" @click="$emit('info')"><PgIcon name="info" :size="15" /></button>
        <button type="button" class="pg-btn pg-btn--icon" title="Help" aria-label="Help" @click="$emit('help')"><PgIcon name="help" :size="15" /></button>
        <span class="pg-dlg__grow" />
        <slot name="footer">
          <button type="button" class="pg-btn" @click="$emit('close')"><PgIcon name="close" :size="13" />Close</button>
          <button type="button" class="pg-btn" :disabled="busy" @click="$emit('reset')"><PgIcon name="reset" :size="13" />Reset</button>
          <button type="button" class="pg-btn pg-btn--primary" :disabled="busy || saveDisabled" @click="$emit('save')">
            <PgIcon name="save" :size="13" />{{ busy ? 'Saving...' : saveLabel }}</button>
        </slot>
      </footer>
    </div>
  </div>
</template>

<script setup lang="ts">
/** pgAdmin's object dialog: title bar, tab strip (… SQL), red message bar, and Info / Help / Close / Reset / Save. */
import { onBeforeUnmount, onMounted } from 'vue';
import PgIcon from './PgIcon.vue';

withDefaults(defineProps<{
  title: string; icon?: string; tabs?: string[]; modelValue?: string; error?: string; busy?: boolean;
  saveDisabled?: boolean; saveLabel?: string; width?: number;
}>(), { icon: 'table', tabs: () => [], modelValue: '', error: '', busy: false, saveDisabled: false, saveLabel: 'Save', width: 760 });

const emit = defineEmits<{
  (event: 'close'): void; (event: 'save'): void; (event: 'reset'): void; (event: 'info'): void; (event: 'help'): void;
  (event: 'clear-error'): void; (event: 'update:modelValue', value: string): void;
}>();

function onKey(event: KeyboardEvent) {
  if (event.key === 'Escape') emit('close');
}
onMounted(() => window.addEventListener('keydown', onKey));
onBeforeUnmount(() => window.removeEventListener('keydown', onKey));
</script>

<style scoped src="./pg.css"></style>
<style scoped>
.pg-dlg-wrap { position: absolute; inset: 0; z-index: 70; background: rgba(0, 0, 0, .32); display: flex; align-items: flex-start; justify-content: center; padding: 40px 12px 12px; overflow: auto; }
.pg-dlg { max-width: 100%; max-height: calc(100% - 8px); display: flex; flex-direction: column; background: #fff; border-radius: 4px; box-shadow: 0 8px 28px rgba(0, 0, 0, .3); min-height: 0; }
.pg-dlg__head { flex: none; display: flex; align-items: center; gap: 8px; padding: 0 6px 0 12px; height: 36px; background: var(--pg-primary); color: #fff; border-radius: 4px 4px 0 0; }
.pg-dlg__title { flex: 1; margin: 0; font-size: 14px; font-weight: 500; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.pg-dlg__x { border: 0; background: none; color: #fff; width: 28px; height: 28px; border-radius: 3px; display: grid; place-items: center; cursor: pointer; }
.pg-dlg__x:hover { background: rgba(255, 255, 255, .15); }
.pg-dlg__tabs { flex: none; display: flex; border-bottom: 1px solid var(--pg-border); padding: 0 6px; overflow-x: auto; }
.pg-dlg__tabs button { border: 0; background: none; padding: 8px 14px; font: inherit; font-size: 13px; color: var(--pg-muted); cursor: pointer; border-bottom: 2px solid transparent; white-space: nowrap; }
.pg-dlg__tabs button.is-active { color: var(--pg-primary); border-bottom-color: var(--pg-primary); font-weight: 600; }
.pg-dlg__body { flex: 1; min-height: 220px; overflow: auto; padding: 12px 16px; display: flex; flex-direction: column; gap: 10px; font-size: 13px; color: var(--pg-text); }
.pg-dlg__err { flex: none; display: flex; align-items: flex-start; gap: 8px; margin: 0 10px 6px; padding: 7px 10px; background: var(--pg-error-light); color: var(--pg-error); border: 1px solid #f0b5b5; border-radius: var(--pg-radius); font-size: 13px; overflow-wrap: anywhere; }
.pg-dlg__err span { flex: 1; min-width: 0; }
.pg-dlg__errx { border: 0; background: none; color: inherit; cursor: pointer; padding: 2px; }
.pg-dlg__foot { flex: none; display: flex; align-items: center; gap: 6px; padding: 8px 10px; border-top: 1px solid var(--pg-border); background: var(--pg-grey-200); border-radius: 0 0 4px 4px; flex-wrap: wrap; }
.pg-dlg__grow { flex: 1; }
</style>
