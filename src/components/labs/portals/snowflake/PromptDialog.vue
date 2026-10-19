<template>
  <SfModal :title="title" :subtitle="subtitle" :ok-text="okText" :busy="busy" :ok-disabled="!statement"
           :sql="statement" :error="error" :danger="danger" :width="520" @close="$emit('close')" @ok="submit">
    <p v-if="message" class="pd__msg">{{ message }}</p>
    <label v-for="field in fields" :key="field.key" class="sf-field">
      <template v-if="field.type === 'check'">
        <span class="sf-check"><input v-model="values[field.key]" type="checkbox" :true-value="'1'" :false-value="''" /> {{ field.label }}</span>
      </template>
      <template v-else>
        <span class="sf-label">{{ field.label }}</span>
        <select v-if="field.options" v-model="values[field.key]" class="sf-select">
          <option v-for="o in field.options" :key="o[0]" :value="o[0]">{{ o[1] }}</option>
        </select>
        <textarea v-else-if="field.type === 'textarea'" v-model="values[field.key]" class="sf-textarea" rows="3"></textarea>
        <input v-else v-model="values[field.key]" class="sf-input" :placeholder="field.placeholder || ''" :inputmode="field.numeric ? 'numeric' : undefined" />
        <span v-if="field.hint" class="sf-hint">{{ field.hint }}</span>
      </template>
    </label>
  </SfModal>
</template>

<script setup lang="ts">
/**
 * A small dialog over ONE statement: rename, clone, change retention, cluster
 * by, set a comment. The caller describes the fields and how they become SQL;
 * the dialog shows the statement and runs it.
 */
import { computed, reactive, ref } from 'vue';
import SfModal from './SfModal.vue';
import { useSf } from './sfContext';

export interface PromptField {
  key: string; label: string; value?: string; placeholder?: string; hint?: string;
  options?: [string, string][]; type?: 'text' | 'textarea' | 'check'; numeric?: boolean;
}

const props = defineProps<{
  title: string; subtitle?: string; message?: string; okText?: string; danger?: boolean;
  fields: PromptField[];
  build: (values: Record<string, string>) => string | string[];
  success?: string;
}>();
const emit = defineEmits<{ (event: 'close'): void; (event: 'done', values: Record<string, string>): void }>();
const sf = useSf();

const values = reactive<Record<string, string>>(Object.fromEntries(props.fields.map(f => [f.key, f.value ?? ''])));
const busy = ref(false);
const error = ref('');
const statements = computed(() => {
  const out = props.build(values);
  return (Array.isArray(out) ? out : [out]).filter(Boolean);
});
const statement = computed(() => statements.value.join(';\n'));

async function submit() {
  if (!statements.value.length) return;
  busy.value = true;
  error.value = '';
  try {
    for (let i = 0; i < statements.value.length; i++) {
      const last = i === statements.value.length - 1;
      const result = await sf.sql(statements.value[i], { quiet: true, success: last ? props.success : undefined });
      if (!result.ok) { error.value = String(result.error || result.output || 'The statement failed.').trim(); return; }
    }
    emit('done', { ...values });
    emit('close');
  } finally {
    busy.value = false;
  }
}
</script>

<style scoped src="./sf.css"></style>
<style scoped>
.pd__msg { margin: 0; overflow-wrap: anywhere; }
</style>
