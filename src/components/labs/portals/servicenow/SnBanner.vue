<template>
  <header class="banner">
    <button type="button" class="banner__burger" aria-label="Open menu" @click="toggle('all')">
      <svg viewBox="0 0 16 16" aria-hidden="true"><path d="M2 4h12M2 8h12M2 12h12" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" /></svg>
    </button>
    <button type="button" class="banner__logo" aria-label="ServiceNow home" @click="go({ page: 'sow' })">
      <span>service</span><span>n</span><svg class="banner__o" viewBox="0 0 20 20" aria-hidden="true"><circle cx="10" cy="10.5" r="6.2" fill="none" stroke="#62d84e" stroke-width="3.2" /></svg><span>w</span>
    </button>

    <nav class="banner__menus" aria-label="Unified navigation">
      <button v-for="m in MENUS" :key="m.id" type="button" class="banner__menu"
              :class="{ 'is-open': open === m.id }" :aria-expanded="open === m.id" @click="toggle(m.id)">
        {{ m.label }}
        <svg viewBox="0 0 10 10" aria-hidden="true"><path d="M2 3.5l3 3 3-3" stroke="currentColor" stroke-width="1.4" fill="none" /></svg>
      </button>
    </nav>

    <div class="banner__context" :title="pageTitle">
      <span class="banner__page">{{ pageTitle }}</span>
      <button type="button" class="banner__star" :class="{ 'is-on': starred }" :aria-label="starred ? 'Remove from favorites' : 'Add to favorites'"
              @click="$emit('star')">
        <svg viewBox="0 0 16 16" aria-hidden="true"><path d="M8 1.8l1.9 3.9 4.3.6-3.1 3 .7 4.3L8 11.6l-3.8 2 .7-4.3-3.1-3 4.3-.6z" :fill="starred ? 'currentColor' : 'none'" stroke="currentColor" stroke-width="1.2" stroke-linejoin="round" /></svg>
      </button>
    </div>

    <form class="banner__search" role="search" @submit.prevent="search">
      <svg viewBox="0 0 16 16" aria-hidden="true"><circle cx="7" cy="7" r="4.6" stroke="currentColor" stroke-width="1.5" fill="none" /><path d="M10.5 10.5L14 14" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" /></svg>
      <input v-model="query" type="search" placeholder="Search" aria-label="Global search" />
    </form>

    <div class="banner__tools">
      <span class="banner__scope" title="Application scope: Global · Instance: acme">
        <svg viewBox="0 0 16 16" aria-hidden="true"><circle cx="8" cy="8" r="6" stroke="currentColor" stroke-width="1.3" fill="none" /><path d="M2 8h12M8 2c2 2 2 10 0 12M8 2c-2 2-2 10 0 12" stroke="currentColor" stroke-width="1.1" fill="none" /></svg>
        <span class="banner__instance">acme</span>
      </span>
      <span class="banner__time" title="Instance time (the scenario clock moves with `ops wait`)">{{ time }} UTC</span>
      <button type="button" class="banner__icon" aria-label="Help">
        <svg viewBox="0 0 16 16" aria-hidden="true"><circle cx="8" cy="8" r="6" stroke="currentColor" stroke-width="1.3" fill="none" /><path d="M6.3 6.3a1.8 1.8 0 113 1.4c-.8.5-1.3.9-1.3 1.8M8 11.4v.1" stroke="currentColor" stroke-width="1.3" fill="none" stroke-linecap="round" /></svg>
      </button>
      <button type="button" class="banner__icon" aria-label="Notifications" @click="go({ page: 'oncall' })">
        <svg viewBox="0 0 16 16" aria-hidden="true"><path d="M4 11V7a4 4 0 018 0v4l1.2 1.5H2.8zM6.5 14h3" stroke="currentColor" stroke-width="1.3" fill="none" stroke-linejoin="round" /></svg>
        <span v-if="pagesForMe" class="banner__badge">{{ pagesForMe }}</span>
      </button>
      <button type="button" class="banner__avatar" :title="userName + ' (' + user + ')'" aria-label="User menu" @click="toggle('user')">
        {{ initials }}<i class="banner__presence" aria-hidden="true"></i>
      </button>
    </div>

    <!-- Flyouts -->
    <div v-if="open === 'all'" class="flyout flyout--all">
      <div class="flyout__filter">
        <svg viewBox="0 0 16 16" aria-hidden="true"><path d="M2 3h12l-4.6 5.4V13l-2.8 1.2V8.4z" stroke="currentColor" stroke-width="1.2" fill="none" stroke-linejoin="round" /></svg>
        <input ref="filterBox" v-model="filter" type="text" placeholder="Filter" aria-label="Filter navigator" />
      </div>
      <div class="flyout__scroll">
        <section v-for="app in filteredNav" :key="app.label" class="flyout__app">
          <h3 class="flyout__app-title">{{ app.label }}</h3>
          <div v-for="m in app.modules" :key="m.key" class="flyout__row">
            <button type="button" class="flyout__module" @click="go(m.route)">{{ m.label }}</button>
            <button type="button" class="flyout__fav" :class="{ 'is-on': favorites.includes(m.key) }"
                    :aria-label="'Favorite ' + m.label" @click="$emit('favorite', m.key)">★</button>
          </div>
        </section>
        <section class="flyout__app">
          <h3 class="flyout__app-title">Workspaces</h3>
          <div class="flyout__row"><button type="button" class="flyout__module" @click="go({ page: 'sow' })">Service Operations Workspace</button></div>
        </section>
        <p v-if="!filteredNav.length" class="flyout__none">No modules match "{{ filter }}".</p>
      </div>
    </div>
    <div v-else-if="open === 'favorites'" class="flyout">
      <h3 class="flyout__head">Favorites</h3>
      <button v-for="f in favModules" :key="f.key" type="button" class="flyout__item" @click="go(f.route)">
        <span class="flyout__star">★</span>{{ f.label }}
      </button>
      <p v-if="!favModules.length" class="flyout__none">Star a module in the All menu to add it here.</p>
    </div>
    <div v-else-if="open === 'history'" class="flyout">
      <h3 class="flyout__head">History</h3>
      <button v-for="h in history" :key="h.label" type="button" class="flyout__item" @click="go(h.route)">
        <span class="flyout__hist">{{ h.kind }}</span>{{ h.label }}
      </button>
      <p v-if="!history.length" class="flyout__none">Records and lists you open appear here.</p>
    </div>
    <div v-else-if="open === 'workspaces'" class="flyout">
      <h3 class="flyout__head">Workspaces</h3>
      <button type="button" class="flyout__item flyout__item--ws" @click="go({ page: 'sow' })">
        <span class="flyout__ws-icon">SOW</span>
        <span><b>Service Operations Workspace</b><small>Incidents, problems, changes, on-call</small></span>
      </button>
      <button type="button" class="flyout__item flyout__item--ws" @click="go({ page: 'incident_list', filter: 'open' })">
        <span class="flyout__ws-icon flyout__ws-icon--ui">UI</span>
        <span><b>Core UI (classic lists and forms)</b><small>Incident, Problem, Change modules</small></span>
      </button>
    </div>
    <div v-else-if="open === 'user'" class="flyout flyout--user">
      <div class="flyout__user"><b>{{ userName }}</b><span>{{ user }} · Cloud Operations L2</span></div>
      <button type="button" class="flyout__item" @click="go({ page: 'incident_list', filter: 'mine' })">My incidents</button>
      <button type="button" class="flyout__item" @click="go({ page: 'oncall' })">My on-call schedule</button>
    </div>
    <div v-if="open" class="banner__scrim" @click="open = ''"></div>
  </header>
</template>

<script setup lang="ts">
/** The Next Experience unified navigation: logo, All/Favorites/History/Workspaces, search, avatar. */
import { computed, nextTick, ref } from 'vue';
import type { Route } from './route';
import { NAV, moduleByKey, type NavModule } from './nav';

const props = defineProps<{
  pageTitle: string; starred: boolean; favorites: string[];
  history: { label: string; kind: string; route: Route }[];
  user: string; userName: string; time: string; pagesForMe: number;
}>();
const emit = defineEmits<{
  (event: 'navigate', route: Route): void; (event: 'favorite', key: string): void;
  (event: 'star'): void; (event: 'search', text: string): void;
}>();

const MENUS = [
  { id: 'all', label: 'All' }, { id: 'favorites', label: 'Favorites' },
  { id: 'history', label: 'History' }, { id: 'workspaces', label: 'Workspaces' },
];
const open = ref('');
const filter = ref('');
const query = ref('');
const filterBox = ref<HTMLInputElement | null>(null);

const initials = computed(() => props.user.split(/[._]/).map(p => p.charAt(0).toUpperCase()).join('').slice(0, 2));
const filteredNav = computed(() => {
  const text = filter.value.trim().toLowerCase();
  if (!text) return NAV;
  return NAV.map(app => ({
    ...app,
    modules: app.label.toLowerCase().includes(text) ? app.modules
      : app.modules.filter(m => m.label.toLowerCase().includes(text)),
  })).filter(app => app.modules.length);
});
const favModules = computed(() => props.favorites.map(moduleByKey).filter((m): m is NavModule => Boolean(m)));

function toggle(id: string) {
  open.value = open.value === id ? '' : id;
  if (open.value === 'all') nextTick(() => filterBox.value?.focus());
}
function go(route: Route) {
  open.value = '';
  emit('navigate', route);
}
function search() {
  const text = query.value.trim();
  if (!text) return;
  open.value = '';
  emit('search', text);
  query.value = '';
}
</script>

<style scoped>
.banner { position: relative; z-index: 30; display: flex; align-items: center; gap: 0.25rem; height: 3rem; padding: 0 0.6rem;
  background: var(--sn-banner); color: var(--sn-banner-ink); flex: none; }
.banner button { font: inherit; color: inherit; }
.banner__burger { display: none; place-items: center; width: 2rem; height: 2rem; border: 0; border-radius: 0.3rem; background: transparent; cursor: pointer; }
.banner__burger svg { width: 1.1rem; height: 1.1rem; }
.banner__logo { display: inline-flex; align-items: baseline; margin-right: 0.6rem; padding: 0 0.3rem; border: 0; background: transparent;
  font-size: 1.15rem !important; font-weight: 700; letter-spacing: -0.02em; cursor: pointer; }
.banner__o { width: 0.95rem; height: 0.95rem; margin: 0 0.02rem; transform: translateY(0.12rem); }
.banner__menus { display: flex; align-items: stretch; height: 100%; }
.banner__menu { display: inline-flex; align-items: center; gap: 0.3rem; padding: 0 0.7rem; border: 0; border-bottom: 3px solid transparent;
  background: transparent; font-size: 0.8125rem !important; font-weight: 600; cursor: pointer; }
.banner__menu svg { width: 0.6rem; height: 0.6rem; }
.banner__menu:hover { background: rgba(255, 255, 255, 0.08); }
.banner__menu.is-open { border-bottom-color: var(--sn-brand-green); background: rgba(255, 255, 255, 0.08); }
.banner__context { display: flex; align-items: center; gap: 0.35rem; min-width: 0; margin: 0 auto; padding: 0.25rem 0.75rem; border-radius: 1rem;
  background: rgba(255, 255, 255, 0.08); }
.banner__page { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 0.8125rem; font-weight: 600; }
.banner__star { display: grid; place-items: center; width: 1.4rem; height: 1.4rem; border: 0; background: transparent; cursor: pointer; opacity: 0.85; }
.banner__star svg { width: 0.9rem; height: 0.9rem; }
.banner__star.is-on { color: #f8d34a; opacity: 1; }
.banner__search { display: flex; align-items: center; gap: 0.4rem; width: 15rem; height: 2rem; padding: 0 0.6rem; border-radius: 1rem;
  background: rgba(255, 255, 255, 0.12); }
.banner__search svg { width: 0.9rem; height: 0.9rem; opacity: 0.8; flex: none; }
.banner__search input { flex: 1; min-width: 0; border: 0; background: transparent; color: inherit; font: inherit; font-size: 0.8125rem; outline: none; }
.banner__search input::placeholder { color: rgba(255, 255, 255, 0.65); }
.banner__tools { display: flex; align-items: center; gap: 0.15rem; margin-left: 0.4rem; }
.banner__scope { display: inline-flex; align-items: center; gap: 0.25rem; padding: 0 0.4rem; font-size: 0.75rem; opacity: 0.9; }
.banner__scope svg { width: 0.95rem; height: 0.95rem; }
.banner__instance { padding: 0.05rem 0.4rem; border-radius: 0.25rem; background: var(--sn-brand); font-weight: 700; }
.banner__time { padding: 0 0.4rem; font-size: 0.75rem; font-variant-numeric: tabular-nums; opacity: 0.85; white-space: nowrap; }
.banner__icon { position: relative; display: grid; place-items: center; width: 2rem; height: 2rem; border: 0; border-radius: 50%; background: transparent; cursor: pointer; }
.banner__icon:hover { background: rgba(255, 255, 255, 0.1); }
.banner__icon svg { width: 1.05rem; height: 1.05rem; }
.banner__badge { position: absolute; top: 0.1rem; right: 0.05rem; min-width: 1rem; height: 1rem; padding: 0 0.2rem; border-radius: 0.5rem;
  background: var(--sn-critical); color: #fff; font-size: 0.65rem; font-weight: 700; line-height: 1rem; text-align: center; }
.banner__avatar { position: relative; width: 2rem; height: 2rem; margin-left: 0.25rem; border: 0; border-radius: 50%; background: #8f8fd8;
  color: var(--sn-banner) !important; font-size: 0.75rem !important; font-weight: 700; cursor: pointer; }
.banner__presence { position: absolute; right: -0.05rem; bottom: -0.05rem; width: 0.6rem; height: 0.6rem; border: 2px solid var(--sn-banner); border-radius: 50%; background: var(--sn-brand-green); }
.banner__scrim { position: fixed; inset: 0; z-index: -1; }

.flyout { position: absolute; top: 3rem; left: 6.5rem; z-index: 2; display: flex; flex-direction: column; width: 18rem; max-height: min(32rem, calc(100cqh - 4rem));
  padding: 0.5rem 0; border-radius: 0 0 var(--sn-radius-lg) var(--sn-radius-lg); background: var(--sn-menu); color: var(--sn-banner-ink);
  box-shadow: 0 0.75rem 2rem rgba(0, 0, 0, 0.45); overflow: auto; }
.flyout--all { left: 0.6rem; width: 21rem; padding: 0; overflow: hidden; }
.flyout--user { left: auto; right: 0.6rem; }
.flyout__filter { display: flex; align-items: center; gap: 0.45rem; margin: 0.7rem; padding: 0 0.6rem; height: 2.1rem; border-radius: var(--sn-radius);
  background: rgba(255, 255, 255, 0.1); }
.flyout__filter svg { width: 0.9rem; height: 0.9rem; opacity: 0.8; }
.flyout__filter input { flex: 1; border: 0; background: transparent; color: inherit; font: inherit; font-size: 0.8125rem; outline: none; }
.flyout__filter input::placeholder { color: rgba(255, 255, 255, 0.6); }
.flyout__scroll { overflow: auto; padding-bottom: 0.6rem; }
.flyout__app { padding: 0.2rem 0; }
.flyout__app-title { margin: 0.5rem 1rem 0.15rem; color: #fff; font-size: 0.8125rem; font-weight: 700; }
.flyout__row { display: flex; align-items: center; }
.flyout__module, .flyout__item { flex: 1; display: flex; align-items: center; gap: 0.5rem; padding: 0.38rem 1rem 0.38rem 1.6rem; border: 0; background: transparent;
  text-align: left; font-size: 0.8125rem !important; cursor: pointer; color: rgba(255, 255, 255, 0.86) !important; }
.flyout__item { padding-left: 1rem; }
.flyout__module:hover, .flyout__item:hover { background: rgba(255, 255, 255, 0.08); color: #fff !important; }
.flyout__fav { width: 2rem; border: 0; background: transparent; color: rgba(255, 255, 255, 0.25) !important; cursor: pointer; }
.flyout__fav.is-on { color: #f8d34a !important; }
.flyout__head { margin: 0.3rem 1rem 0.4rem; font-size: 0.75rem; text-transform: uppercase; letter-spacing: 0.04em; color: rgba(255, 255, 255, 0.6); }
.flyout__star { color: #f8d34a; }
.flyout__hist { min-width: 4.2rem; font-size: 0.7rem; color: rgba(255, 255, 255, 0.55); }
.flyout__none { margin: 0.4rem 1rem; color: rgba(255, 255, 255, 0.6); font-size: 0.8rem; }
.flyout__item--ws { align-items: flex-start; }
.flyout__item--ws small { display: block; color: rgba(255, 255, 255, 0.6); font-size: 0.72rem; }
.flyout__ws-icon { display: grid; place-items: center; width: 2.2rem; height: 2.2rem; flex: none; border-radius: 0.4rem; background: var(--sn-brand-green); color: var(--sn-banner); font-size: 0.65rem; font-weight: 800; }
.flyout__ws-icon--ui { background: #8f8fd8; }
.flyout__user { display: flex; flex-direction: column; padding: 0.4rem 1rem 0.6rem; border-bottom: 1px solid rgba(255, 255, 255, 0.12); margin-bottom: 0.3rem; }
.flyout__user span { font-size: 0.72rem; color: rgba(255, 255, 255, 0.6); }

@container sl-portal (max-width: 1100px) {
  .banner__time, .banner__scope { display: none; }
  .banner__search { width: 10rem; }
}
@container sl-portal (max-width: 900px) {
  .banner__burger { display: grid; }
  .banner__menus, .banner__context { display: none; }
  .banner__logo { margin-right: auto; }
  .flyout, .flyout--all { left: 0; right: 0; width: auto; border-radius: 0; }
}
@container sl-portal (max-width: 520px) {
  .banner__search { width: 2.2rem; padding: 0 0.6rem; }
  .banner__search input { width: 0; }
  .banner__search:focus-within { position: absolute; left: 0.5rem; right: 0.5rem; width: auto; z-index: 3; background: var(--sn-brand); }
  .banner__search:focus-within input { width: auto; }
}
</style>
