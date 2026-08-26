// Mounts the 3D cast with no backend and no account. See vite.config.ts.
import { createApp } from 'vue';
import App from './App.vue';
import '@/assets/css/theme.css';
import { THEMES, applyTheme } from '@/theme/apply';

// The figures are lit by the scene, not by the page, but the tokens are what the
// tile chrome spends — and a galaxy the reader might be in is the right backdrop
// to judge a silhouette against.
const wanted = new URLSearchParams(location.search).get('theme') || 'andromeda';
applyTheme(THEMES.find(t => t.id === wanted) ?? THEMES[0]);

document.documentElement.style.background = getComputedStyle(document.documentElement)
    .getPropertyValue('--sfs-space').trim() || '#04040f';

createApp(App).mount('#app');
