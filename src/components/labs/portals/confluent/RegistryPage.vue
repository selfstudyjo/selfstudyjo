<template>
  <div class="cc-page">
    <nav class="cc-crumbs"><button type="button" @click="cc.go({ page: 'home' })">Home</button><span class="cc-sep">/</span>
      <button type="button" @click="cc.go({ page: 'overview' })">{{ CLUSTER_NAME }}</button><span class="cc-sep">/</span><span>Schema Registry</span></nav>
    <div class="cc-title-row">
      <h1 class="cc-title">Schema Registry</h1>
      <span class="cc-muted cc-small cc-mono">http://schema-registry.shopflow.internal:8081</span>
      <span class="cc-spacer"></span>
      <button type="button" class="cc-btn" @click="openGlobal"><CcIcon name="settings" />Global compatibility: {{ cc.registryCompat.value }}</button>
    </div>

    <div class="cc-toolbar">
      <label class="cc-search"><CcIcon name="search" />
        <input v-model="query" class="cc-input" type="search" placeholder="Search subjects" aria-label="Search subjects" /></label>
      <span class="cc-muted cc-small">{{ shown.length }} subjects</span>
    </div>
    <div class="cc-table-wrap">
      <table class="cc-table">
        <thead><tr><th>Subject</th><th>Topic</th><th>Schema type</th><th class="is-num">Latest version</th><th class="is-num">Schema ID</th><th>Compatibility</th><th><span class="sr-sr">Actions</span></th></tr></thead>
        <tbody>
          <tr v-if="!shown.length"><td colspan="7" class="cc-empty">No subjects registered.</td></tr>
          <tr v-for="s in shown" :key="s.subject" @contextmenu="cc.menu($event, actions(s))">
            <td><button type="button" class="cc-link sr-name" @click="cc.go({ page: 'subject', subject: s.subject })">{{ s.subject }}</button></td>
            <td><button v-if="topicOf(s.subject)" type="button" class="cc-link" @click="cc.go({ page: 'topic', name: topicOf(s.subject), tab: 'schema' })">{{ topicOf(s.subject) }}</button>
              <span v-else class="cc-muted">-</span></td>
            <td>{{ s.schema_type }}</td>
            <td class="is-num">{{ s.latest_version }}</td>
            <td class="is-num">{{ s.latest_id ?? '-' }}</td>
            <td><span class="cc-badge cc-badge--blue">{{ s.compatibility }}</span></td>
            <td class="cc-actions"><button type="button" class="cc-kebab" :aria-label="'Actions for ' + s.subject" @click="cc.menu($event, actions(s))"><CcIcon name="more" /></button></td>
          </tr>
        </tbody>
      </table>
    </div>

    <CcModal v-if="globalOpen" title="Global compatibility mode" ok-text="Save" :busy="cc.busy.value" :width="600"
             @close="globalOpen = false" @ok="saveGlobal">
      <p class="sr-p cc-muted">The default for every subject without its own compatibility mode.</p>
      <label v-for="row in COMPAT_LEVELS" :key="row[0]" class="sr-radio" :class="{ 'is-on': choice === row[0] }">
        <input v-model="choice" type="radio" name="gcompat" :value="row[0]" />
        <span><strong>{{ row[0] }}</strong><span class="cc-muted"> - {{ row[1] }}</span></span>
      </label>
      <div v-if="error" class="cc-alert cc-alert--error"><CcIcon name="x-circle" /><span>{{ error }}</span></div>
    </CcModal>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import { cli, errorText, matches } from '@/utils/portalKit';
import CcIcon from './CcIcon.vue';
import CcModal from './CcModal.vue';
import { useCc } from './ccContext';
import type { CcMenuItem } from './ccContext';
import { CLUSTER_NAME, COMPAT_LEVELS, type CcSubject } from './confluent';

const cc = useCc();
const query = ref('');
const shown = computed(() => cc.subjects.value.filter(s => matches(s as any, query.value, ['subject'])));
function topicOf(subject: string) {
  const t = subject.replace(/-(value|key)$/, '');
  return t !== subject && cc.topic(t) ? t : '';
}

function actions(s: CcSubject): CcMenuItem[] {
  const t = topicOf(s.subject);
  return [
    { label: 'View schema', icon: 'eye', run: () => cc.go({ page: 'subject', subject: s.subject }) },
    { label: 'Open topic', icon: 'topics', disabled: !t, run: () => cc.go({ page: 'topic', name: t, tab: 'schema' }) },
    { divider: true },
    { label: 'Delete subject', icon: 'trash', danger: true, run: () => removeSubject(s.subject) },
  ];
}
async function removeSubject(subject: string) {
  const ok = await cc.confirm({
    title: 'Delete subject',
    message: `Every version of ${subject} will be soft-deleted. Producers using it can no longer register or look up those schemas.`,
    yes: 'Delete', danger: true, typeToConfirm: subject,
  });
  if (ok) await cc.run(cli(['schema-registry', 'delete'], { '--subject': subject }), { success: `Subject ${subject} deleted` });
}

const globalOpen = ref(false);
const choice = ref('BACKWARD');
const error = ref('');
function openGlobal() { choice.value = cc.registryCompat.value; error.value = ''; globalOpen.value = true; }
async function saveGlobal() {
  const result = await cc.run(cli(['schema-registry', 'config'], { '--set': choice.value }),
    { success: `Global compatibility set to ${choice.value}`, quiet: true });
  if (!result.ok) { error.value = errorText(result); return; }
  globalOpen.value = false;
}
</script>

<style scoped src="./cc.css"></style>
<style scoped>
.sr-name { font-weight: 600; }
.sr-sr { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); }
.sr-p { margin: 0; }
.sr-radio { display: flex; gap: 10px; align-items: flex-start; padding: 8px 10px; border: 1px solid var(--cc-border); border-radius: 4px; cursor: pointer; }
.sr-radio.is-on { border-color: var(--cc-primary); background: var(--cc-blue-bg); }
.sr-radio input { margin-top: 3px; }
</style>
