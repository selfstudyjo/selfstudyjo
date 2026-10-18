<template>
  <div class="mf-art">
    <div class="mf-art__tree">
      <div class="mf-art__root mf-muted">{{ run.artifacts.length ? 'Artifacts' : 'No artifacts' }}</div>
      <ul>
        <li v-for="node in visibleNodes" :key="node.path">
          <button type="button" class="mf-art__node" :class="{ 'is-active': selected === node.path }"
                  :style="{ paddingLeft: 8 + node.depth * 16 + 'px' }" @click="select(node)">
            <MfIcon v-if="node.is_dir" name="chevron-right" class="mf-art__chev" :class="{ 'is-open': open.has(node.path) }" />
            <span v-else class="mf-art__chevpad"></span>
            <MfIcon :name="node.is_dir ? (node.path === 'model' ? 'model' : 'folder') : 'file'" />
            <span class="mf-art__label">{{ node.name }}</span>
          </button>
        </li>
      </ul>
    </div>
    <div class="mf-art__preview">
      <div v-if="!current" class="mf-empty">
        <MfIcon name="folder" />
        <h3>{{ run.artifacts.length ? 'Select a file to preview' : 'No Artifacts Recorded' }}</h3>
        <p v-if="!run.artifacts.length">Use the log artifact APIs to store file outputs from MLflow runs.</p>
      </div>
      <template v-else-if="current.path === 'model'">
        <div class="mf-art__phead">
          <div>
            <h3 class="mf-h3">MLflow Model</h3>
            <p class="mf-muted mf-art__p">The code snippets below demonstrate how to make predictions using the logged model.</p>
          </div>
          <span class="mf-spacer"></span>
          <button type="button" class="mf-btn mf-btn--primary" @click="$emit('register')">Register model</button>
        </div>
        <div class="mf-art__section">
          <h4 class="mf-art__h4">Model schema</h4>
          <p class="mf-muted mf-art__p">Input and output schema for your model. <span class="mf-muted">No schema. See MLflow docs for how to include
            input and output schema with your model.</span></p>
        </div>
        <div class="mf-art__section">
          <h4 class="mf-art__h4">Make Predictions</h4>
          <p class="mf-art__p">Predict on a Pandas DataFrame:</p>
          <pre class="mf-code">{{ snippet }}</pre>
        </div>
        <p class="mf-muted mf-art__p">Full path: <span class="mf-mono">{{ artifactRoot }}/model</span> · Size: {{ bytes(modelSize) }}</p>
      </template>
      <template v-else>
        <div class="mf-art__phead">
          <div>
            <h3 class="mf-h3 mf-art__fname">{{ current.path }}</h3>
            <p class="mf-muted mf-art__p">Full path: <span class="mf-mono">{{ artifactRoot }}/{{ current.path }}</span> · Size: {{ bytes(current.size) }}</p>
          </div>
        </div>
        <pre v-if="current.text !== null" class="mf-code mf-art__code">{{ current.text }}</pre>
        <div v-else-if="current.is_dir" class="mf-empty"><MfIcon name="folder" /><p>Select a file in this directory to preview it.</p></div>
        <div v-else class="mf-empty"><MfIcon name="file" /><h3>Select a file to preview</h3>
          <p>Supported formats: image, text, html, pdf, geojson, audio files. {{ current.path.split('/').pop() }} is a binary file
            ({{ bytes(current.size) }}) and cannot be previewed.</p></div>
      </template>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import MfIcon from './MfIcon.vue';
import { bytes, type MfArtifact, type MfRun } from './mlflow';

const props = defineProps<{ run: MfRun }>();
defineEmits<{ (event: 'register'): void }>();

interface Node extends MfArtifact { name: string; depth: number; parent: string }
const nodes = computed<Node[]>(() => props.run.artifacts.map(a => {
  const parts = a.path.split('/');
  return { ...a, name: parts[parts.length - 1], depth: parts.length - 1, parent: parts.slice(0, -1).join('/') };
}));
const open = ref(new Set<string>(['model']));
const selected = ref(props.run.logged_model ? 'model' : (props.run.artifacts[0]?.path || ''));
const visibleNodes = computed(() => nodes.value.filter(node => {
  let parent = node.parent;
  while (parent) {
    if (!open.value.has(parent)) return false;
    parent = parent.split('/').slice(0, -1).join('/');
  }
  return true;
}));
const current = computed(() => nodes.value.find(n => n.path === selected.value));
function select(node: Node) {
  selected.value = node.path;
  if (node.is_dir) {
    const next = new Set(open.value);
    if (next.has(node.path) && node.path !== 'model') next.delete(node.path); else next.add(node.path);
    open.value = next;
  }
}
const artifactRoot = computed(() => `mlflow-artifacts:/${props.run.experiment_id}/${props.run.run_id}/artifacts`);
const modelSize = computed(() => props.run.artifacts.filter(a => a.path.startsWith('model/')).reduce((sum, a) => sum + a.size, 0));
const snippet = computed(() => [
  'import mlflow',
  `logged_model = 'runs:/${props.run.run_id}/model'`,
  '',
  '# Load model as a PyFuncModel.',
  'loaded_model = mlflow.pyfunc.load_model(logged_model)',
  '',
  '# Predict on a Pandas DataFrame.',
  'import pandas as pd',
  'loaded_model.predict(pd.DataFrame(data))',
].join('\n'));
</script>

<style scoped src="./mf.css"></style>
<style scoped>
.mf-art { display: grid; grid-template-columns: minmax(200px, 280px) minmax(0, 1fr); border: 1px solid var(--mf-border-light); border-radius: var(--mf-radius); min-height: 360px; }
.mf-art__tree { border-right: 1px solid var(--mf-border-light); overflow: auto; padding: 8px 0; }
.mf-art__root { padding: 0 12px 6px; font-size: 12px; }
.mf-art__tree ul { list-style: none; margin: 0; padding: 0; }
.mf-art__node { width: 100%; display: flex; align-items: center; gap: 6px; border: 0; background: none; font: inherit; font-size: 13px; color: var(--mf-text); text-align: left; height: 28px; cursor: pointer; padding-right: 8px; }
.mf-art__node:hover { background: var(--mf-row-hover); }
.mf-art__node.is-active { background: var(--mf-row-selected); font-weight: 600; }
.mf-art__chev { transition: transform .12s; color: var(--mf-text-2); }
.mf-art__chev.is-open { transform: rotate(90deg); }
.mf-art__chevpad { width: 16px; flex: none; }
.mf-art__label { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.mf-art__preview { padding: 16px; overflow: auto; display: flex; flex-direction: column; gap: 14px; min-width: 0; }
.mf-art__phead { display: flex; gap: 12px; align-items: flex-start; flex-wrap: wrap; }
.mf-art__p { margin: 2px 0 0; overflow-wrap: anywhere; }
.mf-art__fname { overflow-wrap: anywhere; }
.mf-art__section { display: flex; flex-direction: column; gap: 4px; }
.mf-art__h4 { margin: 0; font-size: 13px; font-weight: 600; }
.mf-art__code { max-height: 420px; }
@container sl-portal (max-width: 640px) {
  .mf-art { grid-template-columns: minmax(0, 1fr); }
  .mf-art__tree { border-right: 0; border-bottom: 1px solid var(--mf-border-light); max-height: 220px; }
}
</style>
