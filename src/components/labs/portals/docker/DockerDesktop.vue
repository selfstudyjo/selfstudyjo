<template>
  <div ref="rootEl" class="dd" :class="{ 'is-nav-open': navOpen }" dir="ltr">
    <!-- Title bar: the whale, the global search, the help/settings/account icons -->
    <header class="dd-top">
      <button type="button" class="dd-top__burger" aria-label="Open navigation" @click="navOpen = !navOpen">
        <DdIcon name="menu" :size="20" />
      </button>
      <div class="dd-top__brand">
        <DdIcon name="whale" :size="26" class="dd-top__whale" />
        <span class="dd-top__word"><b>docker</b> desktop</span>
        <span class="dd-top__plan">PERSONAL</span>
      </div>
      <div class="dd-top__search" ref="searchBox">
        <DdIcon name="search" :size="16" />
        <input v-model="query" type="search" placeholder="Search: containers, images, volumes…"
               aria-label="Search" @focus="searchOpen = true" @keydown.esc="closeSearch" />
        <kbd>Ctrl+K</kbd>
        <SearchResults v-if="searchOpen && query.trim()" :view="view" :query="query"
                       @go="goFromSearch" @pull="pullFromSearch" />
      </div>
      <div class="dd-top__icons">
        <button type="button" class="dd-top__icon" title="Ask Gordon" aria-label="Ask Gordon" @click="panel = panel === 'gordon' ? '' : 'gordon'">
          <DdIcon name="sparkle" :size="18" />
        </button>
        <button type="button" class="dd-top__icon" title="Learning center" aria-label="Learning center" @click="panel = panel === 'learn' ? '' : 'learn'">
          <DdIcon name="cap" :size="18" />
        </button>
        <button type="button" class="dd-top__icon" title="Troubleshoot" aria-label="Troubleshoot" @click="panel = panel === 'bug' ? '' : 'bug'">
          <DdIcon name="bug" :size="18" />
        </button>
        <button type="button" class="dd-top__icon" title="Settings" aria-label="Settings" @click="panel = panel === 'settings' ? '' : 'settings'">
          <DdIcon name="gear" :size="18" />
        </button>
        <button type="button" class="dd-top__avatar" title="Sign in" aria-label="Account" @click="panel = panel === 'account' ? '' : 'account'">
          <DdIcon name="user" :size="16" />
          <span>Sign in</span>
        </button>
        <span class="dd-top__window" aria-hidden="true"><i>&#8211;</i><i>&#9633;</i><i>&#10005;</i></span>
      </div>
      <TopPanel v-if="panel" :kind="panel" :view="view" @close="panel = ''" @go="go" />
    </header>

    <div class="dd-body">
      <nav class="dd-nav" aria-label="Docker Desktop">
        <button v-for="item in NAV" :key="item.page" type="button" class="dd-nav__item"
                :class="{ 'is-active': route.page === item.page }" @click="go({ page: item.page })">
          <DdIcon :name="item.icon" :size="18" />
          <span>{{ item.label }}</span>
          <span v-if="item.count && counts[item.page]" class="dd-nav__count">{{ counts[item.page] }}</span>
        </button>
        <div class="dd-nav__ext">
          <span>Extensions</span>
          <button type="button" class="dd-nav__ext-add" @click="go({ page: 'extensions' })">
            <DdIcon name="plus" :size="14" /> Add Extensions
          </button>
        </div>
      </nav>
      <div v-if="navOpen" class="dd-nav-scrim" @click="navOpen = false"></div>

      <main class="dd-main" :class="{ 'has-terminal': terminalOpen }">
        <div class="dd-scroll">
          <component :is="pageComponent" :view="view" :api="api" :busy="busy" :route="route"
                     @go="go" @refresh="$emit('refresh')" />
        </div>
        <DdTerminal v-if="terminalOpen" :api="api" @close="terminalOpen = false" />
      </main>
    </div>

    <!-- Status bar -->
    <footer class="dd-foot">
      <span class="dd-foot__engine" title="Docker Engine">
        <DdIcon name="whale" :size="18" />
        <span class="dd-dot dd-dot--green"></span>
        Engine running
      </span>
      <span class="dd-foot__stats">
        <span>RAM {{ stats.ram_gb ?? '1.20' }} GB</span>
        <span>CPU {{ stats.cpu_pct ?? 0 }}%</span>
        <span>Disk: {{ stats.disk_gb ?? '1.00' }} GB used (limit {{ stats.disk_limit_gb ?? '1006.85' }} GB)</span>
      </span>
      <span class="dd-foot__right">
        <button type="button" class="dd-foot__btn" :class="{ 'is-on': terminalOpen }" @click="terminalOpen = !terminalOpen">
          <DdIcon name="terminal" :size="15" /> Terminal
        </button>
        <span class="dd-foot__ver"><DdIcon name="check" :size="14" /> v{{ stats.desktop_version || '4.37.1' }}</span>
      </span>
    </footer>

    <!-- Notifications, as Docker Desktop's snackbars -->
    <div class="dd-toasts" aria-live="polite">
      <div v-for="flash in api.flashes.value" :key="flash.id" class="dd-toast" :class="'is-' + flash.type">
        <DdIcon :name="flash.type === 'error' ? 'error' : flash.type === 'success' ? 'check' : 'info'" :size="18"
                class="dd-toast__icon" />
        <div class="dd-toast__text">
          <strong>{{ flash.title }}</strong>
          <span v-if="flash.detail">{{ flash.detail }}</span>
        </div>
        <button type="button" class="dd-toast__close" aria-label="Dismiss" @click="api.dismiss(flash.id)">
          <DdIcon name="close" :size="14" />
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
/**
 * Docker Desktop (4.x, light theme) for the Docker labs.
 *
 * The chrome lives here - title bar, sidebar, status bar, snackbars and the
 * built-in terminal - and every page is its own component. Every button runs
 * the `docker …` command a student could have typed, through `api.exec`, so the
 * CLI beside this window and this window can never disagree.
 */
import { computed, onBeforeUnmount, onMounted, provide, ref, watch, type Component } from 'vue';
import type { PortalApi } from '../usePortal';
import type { LabTool } from '@/utils/labCatalogue';
import DdIcon from './DdIcon.vue';
import DdTerminal from './DdTerminal.vue';
import SearchResults from './SearchResults.vue';
import TopPanel from './TopPanel.vue';
import ContainersView from './ContainersView.vue';
import ContainerDetail from './ContainerDetail.vue';
import ImagesView from './ImagesView.vue';
import ImageDetail from './ImageDetail.vue';
import VolumesView from './VolumesView.vue';
import VolumeDetail from './VolumeDetail.vue';
import NetworksView from './NetworksView.vue';
import NetworkDetail from './NetworkDetail.vue';
import BuildsView from './BuildsView.vue';
import BuildDetail from './BuildDetail.vue';
import ScoutView from './ScoutView.vue';
import ExtensionsView from './ExtensionsView.vue';
import { cmd, containers, desktop, images, locationFor, volumes, networks, builds,
         type DdPage, type DdRoute } from './dd';

const props = defineProps<{ view: Record<string, any>; api: PortalApi; tool: LabTool; busy?: boolean }>();
const emit = defineEmits<{ (event: 'location', url: string): void; (event: 'refresh'): void }>();

const rootEl = ref<HTMLElement | null>(null);
provide('ddRoot', rootEl);

const NAV: { page: DdPage; label: string; icon: string; count?: boolean }[] = [
  { page: 'containers', label: 'Containers', icon: 'containers' },
  { page: 'images', label: 'Images', icon: 'images' },
  { page: 'volumes', label: 'Volumes', icon: 'volumes' },
  { page: 'networks', label: 'Networks', icon: 'networks' },
  { page: 'builds', label: 'Builds', icon: 'builds' },
  { page: 'scout', label: 'Docker Scout', icon: 'scout' },
  { page: 'extensions', label: 'Extensions', icon: 'extensions' },
];

const route = ref<DdRoute>({ page: 'containers' });
const navOpen = ref(false);
const terminalOpen = ref(false);
const panel = ref('');
const query = ref('');
const searchOpen = ref(false);
const searchBox = ref<HTMLElement | null>(null);

const stats = computed(() => desktop(props.view));
const counts = computed<Record<string, number>>(() => ({
  containers: containers(props.view).length, images: images(props.view).length,
  volumes: volumes(props.view).length, networks: networks(props.view).length,
  builds: builds(props.view).length,
}));

const pageComponent = computed<Component>(() => {
  const r = route.value;
  switch (r.page) {
    case 'containers': return r.id ? ContainerDetail : ContainersView;
    case 'images': return r.id ? ImageDetail : ImagesView;
    case 'volumes': return r.id ? VolumeDetail : VolumesView;
    case 'networks': return r.id ? NetworkDetail : NetworksView;
    case 'builds': return r.id ? BuildDetail : BuildsView;
    case 'scout': return ScoutView;
    default: return ExtensionsView;
  }
});

function go(next: DdRoute) {
  route.value = { ...next };
  navOpen.value = false;
  panel.value = '';
}

watch(route, value => emit('location', locationFor(value)), { immediate: true, deep: true });

function closeSearch() {
  searchOpen.value = false;
  query.value = '';
}

function goFromSearch(next: DdRoute) {
  closeSearch();
  go(next);
}

async function pullFromSearch(ref_: string) {
  closeSearch();
  await props.api.exec(cmd.pull(ref_), { success: `Pulled ${ref_}` });
  go({ page: 'images' });
}

function onDocClick(event: MouseEvent) {
  if (searchBox.value && !searchBox.value.contains(event.target as Node)) searchOpen.value = false;
}
function onKey(event: KeyboardEvent) {
  if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k' && rootEl.value) {
    const input = rootEl.value.querySelector<HTMLInputElement>('.dd-top__search input');
    if (input) { event.preventDefault(); input.focus(); }
  }
}
onMounted(() => {
  document.addEventListener('click', onDocClick);
  rootEl.value?.addEventListener('keydown', onKey);
});
onBeforeUnmount(() => {
  document.removeEventListener('click', onDocClick);
  rootEl.value?.removeEventListener('keydown', onKey);
});
</script>

<style scoped>
.dd {
  --dd-blue: #1D63ED;
  --dd-blue-hover: #1550C9;
  --dd-blue-tint: #E8EFFD;
  --dd-link: #086DD7;
  --dd-text: #17191E;
  --dd-text-2: #5C6370;
  --dd-border: #E1E2E6;
  --dd-border-strong: #C4C8D1;
  --dd-hover: #F4F4F6;
  --dd-hover-strong: #E9EAEE;
  --dd-nav-bg: #F4F4F6;
  --dd-green: #13A55B;
  --dd-amber: #E8A317;
  --dd-red: #D52536;
  --dd-red-hover: #B21E2D;
  --dd-grey-dot: #A6ACB8;
  --dd-mono: "Roboto Mono", "SFMono-Regular", Consolas, "Liberation Mono", Menlo, monospace;

  position: relative; display: grid; grid-template-rows: 48px minmax(0, 1fr) 30px;
  height: 100%; min-height: 0; overflow: hidden; background: #fff; color: var(--dd-text);
  font-family: Roboto, Inter, "Segoe UI", system-ui, -apple-system, "Helvetica Neue", Arial, sans-serif;
  font-size: 14px; line-height: 1.4;
}

/* ---- title bar ---- */
.dd-top { position: relative; display: flex; align-items: center; gap: 12px; padding: 0 0 0 14px; background: #fff; border-bottom: 1px solid var(--dd-border); min-width: 0; }
.dd-top__burger { display: none; flex: none; width: 34px; height: 34px; border: 0; background: none; color: var(--dd-text-2); cursor: pointer; padding: 4px; border-radius: 4px; }
.dd-top__brand { display: flex; align-items: center; gap: 8px; flex: none; }
.dd-top__whale { color: var(--dd-blue); }
.dd-top__word { font-size: 16px; color: var(--dd-text); letter-spacing: -0.01em; }
.dd-top__word b { font-weight: 700; }
.dd-top__plan { font-size: 12px; font-weight: 700; letter-spacing: .06em; color: var(--dd-text-2); border: 1px solid var(--dd-border-strong); border-radius: 3px; padding: 1px 5px; }
.dd-top__search { position: relative; flex: 1 1 380px; max-width: 520px; margin: 0 auto; display: flex; align-items: center; min-width: 120px; }
.dd-top__search > svg { position: absolute; left: 10px; color: var(--dd-text-2); pointer-events: none; }
.dd-top__search input {
  width: 100%; height: 32px; padding: 0 70px 0 34px; border: 1px solid var(--dd-border); border-radius: 6px;
  background: var(--dd-hover); font: inherit; font-size: 13px; color: var(--dd-text);
}
.dd-top__search input:focus { outline: none; background: #fff; border-color: var(--dd-blue); box-shadow: 0 0 0 1px var(--dd-blue); }
.dd-top__search input::placeholder { color: #7D8594; opacity: 1; }
.dd-top__search kbd { position: absolute; right: 8px; font: 12px var(--dd-mono); color: var(--dd-text-2); border: 1px solid var(--dd-border-strong); border-radius: 3px; padding: 0 4px; background: #fff; }
.dd-top__icons { display: flex; align-items: center; gap: 2px; flex: none; }
.dd-top__icon { display: grid; place-items: center; width: 34px; height: 34px; border: 0; border-radius: 50%; background: none; color: var(--dd-text-2); cursor: pointer; }
.dd-top__icon:hover { background: var(--dd-hover-strong); color: var(--dd-text); }
.dd-top__avatar { display: inline-flex; align-items: center; gap: 6px; margin-left: 4px; padding: 4px 10px 4px 4px; border: 1px solid var(--dd-border); border-radius: 16px; background: #fff; font: inherit; font-size: 13px; color: var(--dd-text); cursor: pointer; }
.dd-top__avatar svg { width: 22px; height: 22px; padding: 3px; border-radius: 50%; background: var(--dd-hover-strong); }
.dd-top__window { display: flex; margin-left: 10px; align-self: stretch; }
.dd-top__window i { display: grid; place-items: center; width: 42px; font-style: normal; color: var(--dd-text-2); font-size: 13px; }

/* ---- body ---- */
.dd-body { position: relative; display: grid; grid-template-columns: 220px minmax(0, 1fr); min-height: 0; }
.dd-nav { display: flex; flex-direction: column; gap: 2px; padding: 12px 10px; background: var(--dd-nav-bg); border-right: 1px solid var(--dd-border); overflow-y: auto; }
.dd-nav__item { display: flex; align-items: center; gap: 12px; padding: 8px 12px; border: 0; border-radius: 6px; background: none; font: inherit; font-size: 14px; color: var(--dd-text); cursor: pointer; text-align: left; }
.dd-nav__item svg { color: var(--dd-text-2); }
.dd-nav__item:hover { background: var(--dd-hover-strong); }
.dd-nav__item.is-active { background: var(--dd-blue-tint); color: var(--dd-blue); font-weight: 500; }
.dd-nav__item.is-active svg { color: var(--dd-blue); }
.dd-nav__count { margin-left: auto; font-size: 12px; color: var(--dd-text-2); }
.dd-nav__ext { display: flex; flex-direction: column; gap: 6px; margin-top: 18px; padding: 12px 12px 0; border-top: 1px solid var(--dd-border); font-size: 12px; font-weight: 500; color: var(--dd-text-2); text-transform: uppercase; letter-spacing: .04em; }
.dd-nav__ext-add { display: inline-flex; align-items: center; gap: 6px; padding: 6px 0; border: 0; background: none; color: var(--dd-link); font: inherit; font-size: 13px; text-transform: none; letter-spacing: 0; cursor: pointer; }
.dd-nav-scrim { display: none; }
.dd-main { position: relative; display: grid; grid-template-rows: minmax(0, 1fr); min-height: 0; min-width: 0; }
.dd-main.has-terminal { grid-template-rows: minmax(0, 1fr) minmax(160px, 38%); }
.dd-scroll { overflow: auto; min-height: 0; }

/* ---- status bar ---- */
.dd-foot { display: flex; align-items: center; gap: 18px; padding: 0 12px; background: var(--dd-nav-bg); border-top: 1px solid var(--dd-border); font-size: 12px; color: var(--dd-text-2); white-space: nowrap; overflow: hidden; }
.dd-foot__engine { display: inline-flex; align-items: center; gap: 6px; color: var(--dd-text); }
.dd-foot__engine > svg { color: var(--dd-blue); }
.dd-foot__stats { display: inline-flex; gap: 14px; overflow: hidden; text-overflow: ellipsis; }
.dd-foot__right { margin-left: auto; display: inline-flex; align-items: center; gap: 12px; }
.dd-foot__btn { display: inline-flex; align-items: center; gap: 5px; border: 0; background: none; color: var(--dd-text-2); font: inherit; cursor: pointer; padding: 3px 6px; border-radius: 4px; }
.dd-foot__btn:hover, .dd-foot__btn.is-on { background: var(--dd-hover-strong); color: var(--dd-text); }
.dd-foot__ver { display: inline-flex; align-items: center; gap: 4px; }
.dd-foot__ver svg { color: var(--dd-green); }
.dd-dot { display: inline-block; width: 7px; height: 7px; border-radius: 50%; }
.dd-dot--green { background: var(--dd-green); }

/* ---- snackbars ---- */
.dd-toasts { position: absolute; left: 236px; bottom: 42px; z-index: 50; display: flex; flex-direction: column-reverse; gap: 8px; width: min(420px, calc(100% - 252px)); pointer-events: none; }
.dd-toast { pointer-events: auto; display: flex; align-items: flex-start; gap: 10px; padding: 12px 12px 12px 14px; background: #fff; border-radius: 6px; box-shadow: 0 4px 18px rgb(0 0 0 / .18), 0 0 0 1px rgb(0 0 0 / .04); border-left: 4px solid var(--dd-blue); font-size: 13px; }
.dd-toast.is-success { border-left-color: var(--dd-green); }
.dd-toast.is-error { border-left-color: var(--dd-red); }
.dd-toast.is-warning { border-left-color: var(--dd-amber); }
.dd-toast__icon { color: var(--dd-blue); margin-top: 1px; }
.is-success .dd-toast__icon { color: var(--dd-green); }
.is-error .dd-toast__icon { color: var(--dd-red); }
.dd-toast__text { display: flex; flex-direction: column; gap: 2px; flex: 1; min-width: 0; word-break: break-word; }
.dd-toast__text strong { font-weight: 500; color: var(--dd-text); }
.dd-toast__text span { color: var(--dd-text-2); }
.dd-toast__close { border: 0; background: none; color: var(--dd-text-2); cursor: pointer; padding: 2px; }

/* ---- narrow frames ---- */
@container sl-portal (max-width: 900px) {
  .dd-top__burger { display: inline-grid; place-items: center; }
    .dd-top__plan, .dd-top__window, .dd-top__avatar span, .dd-top__search kbd { display: none; }
  .dd-top__avatar { padding: 4px; border: 0; }
  .dd-body { grid-template-columns: minmax(0, 1fr); }
  .dd-nav { position: absolute; top: 0; bottom: 0; left: 0; z-index: 35; width: 230px; transform: translateX(-105%); transition: transform .18s; box-shadow: 4px 0 18px rgb(0 0 0 / .15); }
  .is-nav-open .dd-nav { transform: none; }
  .is-nav-open .dd-nav-scrim { display: block; position: absolute; inset: 0; z-index: 34; background: rgb(0 0 0 / .25); }
  .dd-toasts { left: 12px; width: calc(100% - 24px); }
  .dd-foot__stats span:nth-child(3) { display: none; }
}
@container sl-portal (max-width: 560px) {
  .dd-top { gap: 6px; padding-left: 6px; }
  .dd-top__word { display: none; }
  .dd-top__icon:nth-child(2), .dd-top__icon:nth-child(3) { display: none; }
  .dd-top__search input { padding-right: 8px; }
  .dd-top__search { position: static; }
  .dd-top__search :deep(.dd-sr) { top: calc(100% + 2px); left: 6px; right: 6px; }
  .dd-foot__stats { display: none; }
}
</style>
