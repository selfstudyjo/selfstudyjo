<template>
  <div ref="root" class="tn">
    <header class="tn__bar">
      <button v-if="showMenuButton" type="button" class="tn__burger" aria-label="Open side navigation"
              @click="$emit('toggle-nav')"><CsIcon name="menu" /></button>
      <a class="tn__logo" href="#" aria-label="Console Home" @click.prevent="home">
        <svg viewBox="0 0 304 182" width="34" height="20" aria-hidden="true">
          <path fill="#fff" d="M86.4 66.4c0 3.7.4 6.7 1.1 8.9.8 2.2 1.8 4.6 3.2 7.2.5.8.7 1.6.7 2.3 0 1-.6 2-1.9 3l-6.3 4.2c-.9.6-1.8.9-2.6.9-1 0-2-.5-3-1.4-1.4-1.5-2.6-3.1-3.6-4.7-1-1.7-2-3.6-3.1-5.9-7.8 9.2-17.6 13.8-29.4 13.8-8.4 0-15.1-2.4-20-7.2-4.9-4.8-7.4-11.2-7.4-19.2 0-8.5 3-15.4 9.1-20.6 6.1-5.2 14.2-7.8 24.5-7.8 3.4 0 6.9.3 10.6.8 3.7.5 7.5 1.3 11.5 2.2v-7.3c0-7.6-1.6-12.9-4.7-16-3.2-3.1-8.6-4.6-16.3-4.6-3.5 0-7.1.4-10.8 1.3-3.7.9-7.3 2-10.8 3.4-1.6.7-2.8 1.1-3.5 1.3-.7.2-1.2.3-1.6.3-1.4 0-2.1-1-2.1-3.1v-4.9c0-1.6.2-2.8.7-3.5.5-.7 1.4-1.4 2.8-2.1 3.5-1.8 7.7-3.3 12.6-4.5C41 1.9 46.2 1.3 51.7 1.3c11.9 0 20.6 2.7 26.2 8.1 5.5 5.4 8.3 13.6 8.3 24.6v32.4zM45.8 81.6c3.3 0 6.7-.6 10.3-1.8 3.6-1.2 6.8-3.4 9.5-6.4 1.6-1.9 2.8-4 3.4-6.4.6-2.4 1-5.3 1-8.7v-4.2c-2.9-.7-6-1.3-9.2-1.7-3.2-.4-6.3-.6-9.4-.6-6.7 0-11.6 1.3-14.9 4-3.3 2.7-4.9 6.5-4.9 11.5 0 4.7 1.2 8.2 3.7 10.6 2.4 2.5 5.9 3.7 10.5 3.7zm80.3 10.8c-1.8 0-3-.3-3.8-1-.8-.6-1.5-2-2.1-3.9L96.7 10.2c-.6-2-.9-3.3-.9-4 0-1.6.8-2.5 2.4-2.5h9.8c1.9 0 3.2.3 3.9 1 .8.6 1.4 2 2 3.9l16.8 66.2 15.6-66.2c.5-2 1.1-3.3 1.9-3.9.8-.6 2.2-1 4-1h8c1.9 0 3.2.3 4 1 .8.6 1.5 2 1.9 3.9l15.8 67 17.3-67c.6-2 1.3-3.3 2-3.9.8-.6 2.1-1 3.9-1h9.3c1.6 0 2.5.8 2.5 2.5 0 .5-.1 1-.2 1.6-.1.6-.3 1.4-.7 2.5l-24.1 77.3c-.6 2-1.3 3.3-2.1 3.9-.8.6-2.1 1-3.8 1h-8.6c-1.9 0-3.2-.3-4-1-.8-.7-1.5-2-1.9-4L156 23l-15.4 64.4c-.5 2-1.1 3.3-1.9 4-.8.7-2.2 1-4 1h-8.6zm128.5 2.7c-5.2 0-10.4-.6-15.4-1.8-5-1.2-8.9-2.5-11.5-4-1.6-.9-2.7-1.9-3.1-2.8-.4-.9-.6-1.9-.6-2.8v-5.1c0-2.1.8-3.1 2.3-3.1.6 0 1.2.1 1.8.3.6.2 1.5.6 2.5 1 3.4 1.5 7.1 2.7 11 3.5 4 .8 7.9 1.2 11.9 1.2 6.3 0 11.2-1.1 14.6-3.3 3.4-2.2 5.2-5.4 5.2-9.5 0-2.8-.9-5.1-2.7-7-1.8-1.9-5.2-3.6-10.1-5.2L246 52c-7.3-2.3-12.7-5.7-16-10.2-3.3-4.4-5-9.3-5-14.5 0-4.2.9-7.9 2.7-11.1 1.8-3.2 4.2-6 7.2-8.2 3-2.3 6.4-4 10.4-5.2 4-1.2 8.2-1.7 12.6-1.7 2.2 0 4.5.1 6.7.4 2.3.3 4.4.7 6.5 1.1 2 .5 3.9 1 5.7 1.6 1.8.6 3.2 1.2 4.2 1.8 1.4.8 2.4 1.6 3 2.5.6.8.9 1.9.9 3.3v4.7c0 2.1-.8 3.2-2.3 3.2-.8 0-2.1-.4-3.8-1.2-5.7-2.6-12.1-3.9-19.2-3.9-5.7 0-10.2.9-13.3 2.8-3.1 1.9-4.7 4.8-4.7 8.9 0 2.8 1 5.2 3 7.1 2 1.9 5.7 3.8 11 5.5l14.2 4.5c7.2 2.3 12.4 5.5 15.5 9.6 3.1 4.1 4.6 8.8 4.6 14 0 4.3-.9 8.2-2.6 11.6-1.8 3.4-4.2 6.4-7.3 8.8-3.1 2.5-6.8 4.3-11.1 5.6-4.5 1.4-9.2 2.1-14.3 2.1z" />
          <path fill="#f90" d="M273.5 143.7c-32.9 24.3-80.7 37.2-121.8 37.2-57.6 0-109.5-21.3-148.7-56.7-3.1-2.8-.3-6.6 3.4-4.4 42.4 24.6 94.7 39.5 148.8 39.5 36.5 0 76.6-7.6 113.5-23.2 5.5-2.5 10.2 3.6 4.8 7.6z" />
          <path fill="#f90" d="M287.2 128.1c-4.2-5.4-27.8-2.6-38.5-1.3-3.2.4-3.7-2.4-.8-4.5 18.8-13.2 49.7-9.4 53.3-5 3.6 4.5-1 35.4-18.6 50.2-2.7 2.3-5.3 1.1-4.1-1.9 4-9.9 12.9-32.2 8.7-37.5z" />
        </svg>
      </a>
      <button type="button" class="tn__services" :class="{ 'is-open': menu === 'services' }"
              aria-label="Services" @click="toggle('services')">
        <CsIcon name="grid" />
        <span class="tn__services-label">Services</span>
      </button>
      <div class="tn__search" :class="{ 'is-focus': searchOpen }">
        <CsIcon name="search" class="tn__search-icon" />
        <input ref="searchInput" v-model="query" type="search" placeholder="Search" aria-label="Search"
               @focus="searchOpen = true" @keydown.enter="pickFirst" @keydown.esc="closeSearch" />
        <span class="tn__kbd">[Alt+S]</span>
        <div v-if="searchOpen && query.trim()" class="tn__results" role="listbox">
          <div class="tn__results-head">Services</div>
          <button v-for="svc in serviceHits" :key="svc.id" type="button" class="tn__hit" @mousedown.prevent="open(svc.home)">
            <ServiceIcon :id="svc.id" />
            <span><strong>{{ svc.name }}</strong><small>{{ svc.description }}</small></span>
          </button>
          <div v-if="!serviceHits.length" class="tn__nohit">No services match "{{ query }}"</div>
          <template v-if="featureHits.length">
            <div class="tn__results-head">Features</div>
            <button v-for="hit in featureHits" :key="hit.title + hit.svc" type="button" class="tn__hit tn__hit--feature"
                    @mousedown.prevent="open(hit.route)">
              <span><strong>{{ hit.title }}</strong><small>{{ hit.parent }} feature</small></span>
            </button>
          </template>
        </div>
      </div>
      <div class="tn__right">
        <button type="button" class="tn__icon tn__hide-sm" aria-label="AWS CloudShell" title="CloudShell"><CsIcon name="cloudshell" /></button>
        <button type="button" class="tn__icon tn__hide-sm" aria-label="Notifications" title="Notifications"><CsIcon name="notification" /></button>
        <button type="button" class="tn__icon tn__hide-sm" aria-label="Support" title="Support"><CsIcon name="support" /></button>
        <button type="button" class="tn__icon tn__hide-sm" aria-label="Settings" title="Settings"><CsIcon name="settings" /></button>
        <div class="tn__dd">
          <button type="button" class="tn__menu-btn" :aria-expanded="menu === 'region'" @click="toggle('region')">
            <CsIcon name="globe" class="tn__show-sm" />
            <span class="tn__hide-sm">{{ regionShort(region) }}</span>
            <CsIcon name="caret-down" size="small" />
          </button>
          <div v-if="menu === 'region'" class="tn__pop tn__pop--region" role="menu">
            <div class="tn__pop-group">Regions</div>
            <button v-for="code in regions" :key="code" type="button" class="tn__pop-item tn__region"
                    :class="{ 'is-current': code === region }" @click="chooseRegion(code)">
              <span>{{ regionName(code) }}</span><span class="tn__code">{{ code }}</span>
            </button>
            <div class="tn__pop-foot">Manage Regions</div>
          </div>
        </div>
        <div class="tn__dd">
          <button type="button" class="tn__menu-btn" :aria-expanded="menu === 'account'" @click="toggle('account')">
            <CsIcon name="user" class="tn__show-sm" />
            <span class="tn__hide-sm">{{ user }} @ {{ accountDashed(account) }}</span>
            <CsIcon name="caret-down" size="small" />
          </button>
          <div v-if="menu === 'account'" class="tn__pop tn__pop--account" role="menu">
            <div class="tn__acct">
              <div class="tn__acct-row"><span>Account ID:</span>
                <strong>{{ accountDashed(account) }}</strong>
                <button type="button" class="tn__copy" aria-label="Copy account ID" @click="copy(account)"><CsIcon name="copy" size="small" /></button>
              </div>
              <div class="tn__acct-row"><span>IAM user:</span> <strong>{{ user }}</strong></div>
              <div class="tn__acct-row"><span>Account alias:</span> <strong>{{ alias }}</strong></div>
            </div>
            <button v-for="item in accountItems" :key="item" type="button" class="tn__pop-item" disabled>{{ item }}</button>
            <div class="tn__pop-sep" />
            <div class="tn__signout"><button type="button" class="tn__switch" disabled>Switch role</button>
              <button type="button" class="tn__out" disabled>Sign out</button></div>
          </div>
        </div>
      </div>
    </header>
    <!-- The favorites / recently visited bar under the main bar -->
    <nav class="tn__favs" aria-label="Recently visited">
      <button v-for="id in recent" :key="id" type="button" class="tn__fav" @click="open(SERVICE_BY_ID[id].home)">
        <ServiceIcon :id="id" small /><span>{{ SERVICE_BY_ID[id].short }}</span>
      </button>
      <span v-if="!recent.length" class="tn__fav-hint">Visited services will appear here</span>
    </nav>
    <div v-if="menu === 'services'" class="tn__svc-menu" role="dialog" aria-label="Services">
      <aside class="tn__cats">
        <button v-for="cat in categories" :key="cat" type="button" class="tn__cat"
                :class="{ 'is-current': cat === category }" @click="category = cat">{{ cat }}</button>
      </aside>
      <section class="tn__svc-list">
        <h3>{{ category }}</h3>
        <button v-for="svc in categoryServices" :key="svc.id" type="button" class="tn__svc" @click="open(svc.home)">
          <ServiceIcon :id="svc.id" />
          <span class="tn__svc-text"><strong>{{ svc.name }}</strong><small>{{ svc.description }}</small></span>
          <CsIcon name="star" size="small" class="tn__star" />
        </button>
      </section>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue';
import CsIcon from './CsIcon.vue';
import ServiceIcon from './ServiceIcon.vue';
import {
  SERVICES, SERVICE_BY_ID, accountDashed, regionName, regionShort,
  type Route, type ServiceId,
} from './nav';

const props = defineProps<{
  region: string; regions: string[]; account: string; user: string; alias: string;
  recent: ServiceId[]; showMenuButton: boolean;
}>();
const emit = defineEmits<{
  (e: 'go', route: Route): void;
  (e: 'region', code: string): void;
  (e: 'toggle-nav'): void;
}>();

const root = ref<HTMLElement | null>(null);
const searchInput = ref<HTMLInputElement | null>(null);
const menu = ref<'' | 'services' | 'region' | 'account'>('');
const query = ref('');
const searchOpen = ref(false);
const category = ref('Recently visited');

const categories = computed(() => ['Recently visited', 'All services',
  ...Array.from(new Set(SERVICES.map(s => s.category))).sort()]);
const categoryServices = computed(() => {
  if (category.value === 'Recently visited') {
    const list = props.recent.map(id => SERVICE_BY_ID[id]).filter(Boolean);
    return list.length ? list : SERVICES.slice(0, 4);
  }
  if (category.value === 'All services') return [...SERVICES].sort((a, b) => a.name.localeCompare(b.name));
  return SERVICES.filter(s => s.category === category.value);
});

const FEATURES: { title: string; svc: ServiceId; page: string; words: string }[] = [
  { title: 'Buckets', svc: 's3', page: 'buckets', words: 'bucket storage object' },
  { title: 'Instances', svc: 'ec2', page: 'instances', words: 'instance server vm launch' },
  { title: 'Security groups', svc: 'ec2', page: 'sgs', words: 'security group firewall sg' },
  { title: 'Key pairs', svc: 'ec2', page: 'keys', words: 'key pair ssh' },
  { title: 'Volumes', svc: 'ec2', page: 'volumes', words: 'volume ebs disk' },
  { title: 'AMIs', svc: 'ec2', page: 'amis', words: 'ami image' },
  { title: 'Your VPCs', svc: 'vpc', page: 'vpcs', words: 'vpc network' },
  { title: 'Subnets', svc: 'vpc', page: 'subnets', words: 'subnet network' },
  { title: 'Users', svc: 'iam', page: 'users', words: 'user iam' },
  { title: 'Roles', svc: 'iam', page: 'roles', words: 'role iam' },
  { title: 'Policies', svc: 'iam', page: 'policies', words: 'policy iam permission' },
  { title: 'Functions', svc: 'lambda', page: 'functions', words: 'function lambda serverless' },
  { title: 'Tables', svc: 'dynamodb', page: 'tables', words: 'table dynamodb nosql' },
  { title: 'Explore items', svc: 'dynamodb', page: 'explore', words: 'item dynamodb' },
  { title: 'Databases', svc: 'rds', page: 'databases', words: 'database rds sql postgres mysql' },
  { title: 'Queues', svc: 'sqs', page: 'queues', words: 'queue sqs message' },
  { title: 'Topics', svc: 'sns', page: 'topics', words: 'topic sns notification' },
  { title: 'Log groups', svc: 'cloudwatch', page: 'groups', words: 'log logs cloudwatch' },
];

const needle = computed(() => query.value.trim().toLowerCase());
const serviceHits = computed(() => SERVICES.filter(s => [s.name, s.short, s.description, s.id]
  .some(text => text.toLowerCase().includes(needle.value))));
const featureHits = computed(() => FEATURES
  .filter(f => (f.title + ' ' + f.words).toLowerCase().includes(needle.value))
  .map(f => ({ ...f, parent: SERVICE_BY_ID[f.svc].short, route: { svc: f.svc, page: f.page } as Route }))
  .slice(0, 6));

function toggle(which: 'services' | 'region' | 'account') {
  menu.value = menu.value === which ? '' : which;
  searchOpen.value = false;
}
function open(route: Route) {
  menu.value = '';
  closeSearch();
  emit('go', route);
}
function home() {
  open({ svc: 'home', page: 'home' });
}
function closeSearch() {
  searchOpen.value = false;
  query.value = '';
  searchInput.value?.blur();
}
function pickFirst() {
  const svc = serviceHits.value[0];
  if (svc) open(svc.home);
  else if (featureHits.value[0]) open(featureHits.value[0].route);
}
function chooseRegion(code: string) {
  menu.value = '';
  if (code !== props.region) emit('region', code);
}
async function copy(text: string) {
  try { await navigator.clipboard.writeText(text); } catch { /* ignored */ }
}
const accountItems = ['Account', 'Organization', 'Service Quotas', 'Billing and Cost Management', 'Security credentials'];

function outside(event: MouseEvent) {
  if (root.value && !root.value.contains(event.target as Node)) {
    menu.value = '';
    searchOpen.value = false;
  }
}
function hotkey(event: KeyboardEvent) {
  if (event.altKey && (event.key === 's' || event.key === 'S')) {
    event.preventDefault();
    searchInput.value?.focus();
  }
}
onMounted(() => {
  document.addEventListener('mousedown', outside);
  document.addEventListener('keydown', hotkey);
});
onBeforeUnmount(() => {
  document.removeEventListener('mousedown', outside);
  document.removeEventListener('keydown', hotkey);
});
</script>

<style scoped>
.tn { position: relative; z-index: 50; flex: none; }
.tn__bar { display: flex; align-items: center; gap: 4px; height: 40px; padding: 0 12px 0 16px; background: #161d26; color: #fff; }
.tn__burger { border: 0; background: none; color: #fff; padding: 6px; margin-right: 2px; cursor: pointer; display: inline-flex; border-radius: 4px; }
.tn__logo { display: inline-flex; align-items: center; padding: 4px 8px 0 0; margin-right: 6px; }
.tn__services { display: inline-flex; align-items: center; gap: 6px; border: 0; background: none; color: #fff; padding: 6px 8px; border-radius: 4px; font: inherit; font-weight: 700; cursor: pointer; }
.tn__services:hover, .tn__services.is-open, .tn__icon:hover, .tn__menu-btn:hover, .tn__burger:hover { background: #232b37; }
.tn__search { position: relative; flex: 1 1 auto; max-width: 600px; margin: 0 12px; display: flex; align-items: center; }
.tn__search input { width: 100%; height: 28px; border: 1px solid #8c8c94; border-radius: 8px; background: #0f141a; color: #fff; font: inherit; font-size: 14px; padding: 2px 76px 2px 32px; }
.tn__search input::placeholder { color: #b4b4bb; }
.tn__search input::-webkit-search-cancel-button { display: none; }
.tn__search input:focus { outline: none; border-color: #42b4ff; background: #fff; color: #0f141a; }
.tn__search-icon { position: absolute; left: 10px; color: #b4b4bb; pointer-events: none; }
.tn__kbd { position: absolute; right: 10px; color: #b4b4bb; font-size: 12px; pointer-events: none; }
.tn__results { position: absolute; top: 34px; left: 0; right: 0; background: #fff; color: #0f141a; border-radius: 12px; box-shadow: 0 4px 20px rgba(0, 7, 22, .3); padding: 8px 0; max-height: 420px; overflow: auto; }
.tn__results-head { padding: 6px 16px; font-size: 12px; font-weight: 700; color: #656871; text-transform: uppercase; letter-spacing: .02em; }
.tn__hit { display: flex; width: 100%; align-items: center; gap: 12px; border: 0; background: none; text-align: left; padding: 6px 16px; font: inherit; cursor: pointer; }
.tn__hit:hover { background: #f0fbff; }
.tn__hit strong, .tn__svc strong { display: block; color: #006ce0; font-size: 14px; }
.tn__hit small, .tn__svc small { display: block; color: #656871; font-size: 12px; }
.tn__nohit { padding: 6px 16px; color: #656871; font-size: 14px; }
.tn__right { display: flex; align-items: center; gap: 2px; margin-left: auto; }
.tn__icon { border: 0; background: none; color: #fff; padding: 6px; border-radius: 4px; cursor: pointer; display: inline-flex; }
.tn__dd { position: relative; }
.tn__menu-btn { display: inline-flex; align-items: center; gap: 6px; border: 0; background: none; color: #fff; font: inherit; font-size: 14px; font-weight: 700; padding: 6px 8px; border-radius: 4px; cursor: pointer; white-space: nowrap; }
.tn__pop { position: absolute; right: 0; top: 36px; background: #fff; color: #0f141a; border-radius: 12px; box-shadow: 0 4px 20px rgba(0, 7, 22, .3); padding: 8px 0; min-width: 280px; z-index: 60; }
.tn__pop--region { width: 340px; max-height: 420px; overflow: auto; }
.tn__pop-group { padding: 6px 16px; font-weight: 700; font-size: 14px; color: #424650; }
.tn__pop-item { display: flex; width: 100%; justify-content: space-between; gap: 12px; border: 0; background: none; padding: 6px 16px; font: inherit; font-size: 14px; text-align: left; color: #0f141a; cursor: pointer; }
.tn__pop-item:hover:not(:disabled) { background: #f0fbff; }
.tn__pop-item:disabled { cursor: default; color: #0f141a; }
.tn__region.is-current { font-weight: 700; background: #f0fbff; box-shadow: inset 2px 0 0 #006ce0; }
.tn__code { color: #656871; }
.tn__pop-foot { border-top: 1px solid #ebebf0; margin-top: 6px; padding: 8px 16px 2px; color: #006ce0; font-size: 14px; font-weight: 700; }
.tn__pop--account { width: 320px; }
.tn__acct { padding: 4px 16px 10px; border-bottom: 1px solid #ebebf0; margin-bottom: 4px; font-size: 14px; }
.tn__acct-row { display: flex; align-items: center; gap: 6px; padding: 3px 0; }
.tn__acct-row span { color: #424650; }
.tn__copy { border: 0; background: none; color: #424650; cursor: pointer; padding: 2px; }
.tn__pop-sep { border-top: 1px solid #ebebf0; margin: 4px 0; }
.tn__signout { display: flex; justify-content: flex-end; gap: 8px; padding: 6px 16px 4px; }
.tn__switch, .tn__out { border-radius: 20px; font: inherit; font-size: 14px; font-weight: 700; padding: 4px 16px; cursor: default; }
.tn__switch { border: 2px solid #006ce0; color: #006ce0; background: #fff; }
.tn__out { border: 2px solid #ff9900; background: #ff9900; color: #0f141a; }
.tn__favs { display: flex; align-items: center; gap: 2px; height: 32px; padding: 0 12px; background: #232b37; color: #fff; overflow-x: auto; scrollbar-width: none; }
.tn__fav { display: inline-flex; align-items: center; gap: 6px; border: 0; background: none; color: #fff; font: inherit; font-size: 13px; padding: 4px 8px; border-radius: 4px; cursor: pointer; white-space: nowrap; }
.tn__fav:hover { background: #333d4a; }
.tn__fav-hint { color: #b4b4bb; font-size: 12px; padding-left: 4px; }
.tn__svc-menu { position: absolute; top: 40px; left: 0; display: flex; width: min(760px, 100%); max-height: 480px; background: #fff; color: #0f141a; border-radius: 0 0 16px 16px; box-shadow: 0 8px 24px rgba(0, 7, 22, .3); overflow: hidden; }
.tn__cats { width: 240px; flex: none; border-right: 1px solid #ebebf0; overflow: auto; padding: 8px 0; }
.tn__cat { display: block; width: 100%; text-align: left; border: 0; background: none; padding: 6px 20px; font: inherit; font-size: 14px; color: #424650; cursor: pointer; }
.tn__cat:hover { color: #006ce0; }
.tn__cat.is-current { font-weight: 700; color: #006ce0; background: #f0fbff; }
.tn__svc-list { flex: 1; overflow: auto; padding: 12px 20px; }
.tn__svc-list h3 { margin: 0 0 8px; font-size: 18px; }
.tn__svc { display: flex; width: 100%; align-items: center; gap: 12px; border: 0; background: none; text-align: left; padding: 8px 6px; font: inherit; cursor: pointer; border-radius: 8px; }
.tn__svc:hover { background: #f3f3f7; }
.tn__svc-text { flex: 1; }
.tn__star { color: #8c8c94; }
.tn__show-sm { display: none; }
@container sl-portal (max-width: 900px) {
  .tn__hide-sm { display: none; }
  .tn__show-sm { display: inline-block; }
  .tn__kbd { display: none; }
  .tn__search input { padding-right: 8px; }
}
@container sl-portal (max-width: 560px) {
  .tn__services-label { display: none; }
  .tn__search { margin: 0 6px; min-width: 0; }
  .tn__cats { width: 150px; }
  .tn__bar { padding: 0 6px; }
}
</style>
