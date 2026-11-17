<template>
  <!--
    A file-type badge: the language's own colour and a 1-3 letter mark (TF, PY,
    JS, YML, DKR...), drawn as SVG so it is crisp at every size and needs no
    icon font or image request. The ink is chosen against the fill's luminance,
    so a pale badge (JSON, YAML on light) never carries white text.
  -->
  <svg v-if="kind !== 'folder'" class="sl-ficon" viewBox="0 0 24 24" role="img"
       :aria-label="language.name" :data-lang="language.id">
    <title>{{ language.name }}</title>
    <path d="M5 1.5h9.5L20 7v14.5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1v-19a1 1 0 0 1 1-1z"
          :fill="language.color" />
    <path d="M14.5 1.5V7H20" fill="rgba(255,255,255,0.35)" />
    <text x="12" y="17.2" text-anchor="middle" :fill="ink"
          :font-size="language.short.length > 2 ? 6.2 : 7.6"
          font-family="ui-monospace, Menlo, Consolas, monospace" font-weight="700">{{ language.short }}</text>
  </svg>
  <svg v-else class="sl-ficon" viewBox="0 0 24 24" role="img" :aria-label="open ? 'Open folder' : 'Folder'">
    <path v-if="!open" d="M2 5.5A1.5 1.5 0 0 1 3.5 4h5.2l2 2.2h9.8A1.5 1.5 0 0 1 22 7.7v11.8a1.5 1.5 0 0 1-1.5 1.5h-17A1.5 1.5 0 0 1 2 19.5z"
          :fill="folderColor" />
    <template v-else>
      <path d="M2 5.5A1.5 1.5 0 0 1 3.5 4h5.2l2 2.2h9.8A1.5 1.5 0 0 1 22 7.7V9H6.2a2 2 0 0 0-1.9 1.4L2 18z"
            :fill="folderColor" />
      <path d="M4.3 10.4A1.5 1.5 0 0 1 5.7 9.4h16.8a.8.8 0 0 1 .76 1.05l-2.8 9.2A1.5 1.5 0 0 1 19 20.7H3a1 1 0 0 1-.96-1.3z"
            :fill="folderColor" opacity="0.8" />
    </template>
  </svg>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { languageFor } from '@/utils/codeLanguages';

const props = defineProps<{ path: string; kind?: 'file' | 'folder'; open?: boolean }>();

const language = computed(() => languageFor(props.path));
const ink = computed(() => {
  const hex = language.value.color.replace('#', '');
  const [r, g, b] = [0, 2, 4].map(i => parseInt(hex.slice(i, i + 2), 16) / 255)
    .map(v => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  const lum = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  return lum > 0.4 ? '#1b1f23' : '#ffffff';
});
// Special folders read at a glance, as in an IDE.
const folderColor = computed(() => {
  const name = (props.path.split('/').pop() || '').toLowerCase();
  if (['src', 'lib', 'app', 'apps'].includes(name)) return '#42a5f5';
  if (['test', 'tests', 'spec', '__tests__'].includes(name)) return '#26a69a';
  if (['.github', '.git', '.terraform'].includes(name)) return '#8d6e63';
  if (['templates', 'views', 'static', 'public', 'assets'].includes(name)) return '#ab47bc';
  if (['modules', 'roles', 'charts', 'manifests', 'k8s'].includes(name)) return '#7e57c2';
  if (['config', 'conf', 'etc', 'settings'].includes(name)) return '#78909c';
  if (['docs', 'doc'].includes(name)) return '#5c6bc0';
  return '#e8a838';
});
</script>

<style scoped>
.sl-ficon { width: 1.15em; height: 1.15em; flex: none; vertical-align: -0.2em; }
</style>
