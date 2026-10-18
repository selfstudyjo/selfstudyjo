<template>
  <div ref="root" class="awsc" dir="ltr" :class="{ 'is-nav-open': navOpen, 'has-nav': !!service }">
    <TopNav
      :region="region" :regions="regions" :account="account" :user="user" :alias="alias"
      :recent="recent" :show-menu-button="!!service" :clock="clock" :global="isGlobal(route.svc)"
      @go="go" @region="changeRegion" @toggle-nav="navOpen = !navOpen"
    />
    <div class="awsc__body">
      <aside v-if="service && navOpen" class="awsc__nav">
        <SideNav :service="service" :route="route" @go="navGo" @close="navOpen = false" />
      </aside>
      <div v-if="service && navOpen" class="awsc__scrim" @click="navOpen = false" />
      <main ref="main" class="awsc__main">
        <div class="awsc__content" :class="{ 'awsc__content--home': route.svc === 'home' }">
          <nav v-if="crumbs.length" class="awsc__crumbs" aria-label="Breadcrumbs">
            <template v-for="(crumb, index) in crumbs" :key="index">
              <CsIcon v-if="index > 0" name="angle-right" size="small" class="awsc__crumb-sep" />
              <a v-if="crumb.route && index < crumbs.length - 1" href="#" class="awsc__crumb"
                 @click.prevent="go(crumb.route)">{{ crumb.text }}</a>
              <span v-else class="awsc__crumb awsc__crumb--current">{{ crumb.text }}</span>
            </template>
          </nav>
          <Flashbar :flashes="api.flashes.value" @dismiss="api.dismiss" />
          <div v-if="region !== home && !REGIONAL.includes(route.svc) && route.svc !== 'home'" class="cs-alert cs-alert--info">
            <CsIcon name="status-info" class="cs-alert__icon" />
            <div><strong>You are viewing {{ region }}</strong>The Acme Payments estate for this service runs in {{ home }}.
              <button type="button" class="cs-link" @click="region = home">Switch to {{ home }}</button></div>
          </div>
          <component :is="page" :key="pageKey" />
        </div>
      </main>
    </div>
    <SessionTerminal v-if="sessionOpen" />
  </div>
</template>

<script setup lang="ts">
/**
 * The AWS Management Console over the Cloud Operations estate, simulated.
 *
 * This file is the CHROME and the router: the dark top navigation bar, the
 * service's side navigation, breadcrumbs and the flashbar - the same Cloudscape
 * chrome as the resource-plane AWS console (`../aws/`), whose building blocks it
 * reuses. Each page is its own component under `pages/`, reading the engine's
 * `console` read model through `useOps()` and writing by running the `aws`
 * command line a student could have typed, through the Ops console's surface.
 *
 * The scenario clock is never moved from here: it moves only when `ops wait`
 * is run in the Ops console. A Session Manager session that is open takes
 * over the whole console (every line is the session's), so it is drawn as a
 * terminal over the page until it is exited.
 */
import { computed, nextTick, ref, watch } from 'vue';
import type { PortalApi } from '../usePortal';
import type { LabTool } from '@/utils/labCatalogue';
import { pick } from '@/utils/portalKit';
import CsIcon from '../aws/CsIcon.vue';
import Flashbar from '../aws/Flashbar.vue';
import SessionTerminal from './SessionTerminal.vue';
import SideNav from './SideNav.vue';
import TopNav from './TopNav.vue';
import { provideOps } from './ctx';
import { SERVICE_BY_ID, crumbsFor, isGlobal, urlFor, type Route, type ServiceId } from './nav';
import { pageFor } from './pages';

const props = defineProps<{ view: Record<string, any>; api: PortalApi; tool: LabTool; busy?: boolean }>();
const emit = defineEmits<{ (event: 'location', url: string): void; (event: 'refresh'): void }>();

/** Services whose pages read the region selector (resources outside the home region exist). */
const REGIONAL: ServiceId[] = ['ec2', 'backup'];

const root = ref<HTMLElement | null>(null);
const main = ref<HTMLElement | null>(null);
const route = ref<Route>({ svc: 'home', page: 'home' });
const recent = ref<ServiceId[]>([]);
const navOpen = ref(true);

const view = computed(() => props.view || {});
const c = computed<Record<string, any>>(() => pick(view.value, 'console', {}));
const home = computed(() => String(pick(c.value, 'region', 'eu-west-1')));
const region = ref(String(pick(props.view, 'console.region', 'eu-west-1')));
const regions = computed(() => pick<string[]>(c.value, 'regions', [home.value]));
const account = computed(() => String(pick(c.value, 'account', '666666666666')));
const user = 'OpsEngineer/ops.engineer';
const alias = 'acme-prod-payments';
const clock = computed(() => String(pick(view.value, 'clock.time', '')));
const sessionOpen = computed(() => Boolean(pick(c.value, 'ssm.session_open', false)));
const service = computed(() => (route.value.svc === 'home' ? null : SERVICE_BY_ID[route.value.svc] || null));
const crumbs = computed(() => crumbsFor(route.value));
const page = computed(() => pageFor(route.value));
const pageKey = computed(() => `${route.value.svc}/${route.value.page}/${JSON.stringify(route.value.params || {})}`);

function narrow(): boolean {
  const width = root.value?.clientWidth || 1200;
  return width < 900;
}

function go(next: Route) {
  route.value = { svc: next.svc, page: next.page, params: { ...(next.params || {}) } };
  if (next.svc !== 'home') {
    recent.value = [next.svc, ...recent.value.filter(id => id !== next.svc)].slice(0, 8);
  }
  nextTick(() => main.value?.scrollTo?.({ top: 0 }));
}
function navGo(next: Route) {
  go(next);
  if (narrow()) navOpen.value = false;
}

function changeRegion(code: string) {
  region.value = code;
  props.api.notify('info', `You are now working in ${code}.`);
}

watch([route, region], () => emit('location', urlFor(route.value, region.value)), { immediate: true, deep: true });
watch(root, el => { if (el && el.clientWidth < 900) navOpen.value = false; });
watch(() => route.value.svc, () => { if (narrow()) navOpen.value = false; });

provideOps({
  view,
  c,
  api: props.api,
  region,
  home,
  account,
  busy: computed(() => Boolean(props.busy) || props.api.busy.value),
  route: computed(() => route.value),
  go,
  to: (svc, pageName, params) => go({ svc, page: pageName, params }),
  run: (command, success, options = {}) => props.api.exec(command, {
    surface: 'ops_console', success: success || '', quiet: options.quiet,
    unlogged: options.unlogged, failure: options.failure,
  }),
});
</script>

<style scoped>
.awsc {
  --aws-text: #0f141a;
  --aws-text-2: #424650;
  --aws-text-3: #656871;
  --aws-link: #006ce0;
  --aws-border: #c6c6cd;
  --aws-divider: #ebebf0;
  --aws-input: #8c8c94;
  --aws-primary: #ff9900;
  --aws-primary-hover: #ec7211;
  --aws-blue: #006ce0;
  color-scheme: light;
  position: relative;
  height: 100%;
  min-height: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  background: #fff;
  color: var(--aws-text);
  font-family: 'Amazon Ember', 'Open Sans', 'Helvetica Neue', Roboto, Arial, sans-serif;
  font-size: 14px;
  line-height: 20px;
  text-align: left;
}
.awsc__body { position: relative; flex: 1; min-height: 0; display: flex; }
.awsc__nav { flex: none; width: 280px; border-right: 1px solid var(--aws-border); overflow: hidden; background: #fff; z-index: 20; }
.awsc__scrim { display: none; }
.awsc__main { flex: 1; min-width: 0; overflow: auto; background: #fff; }
.awsc__content { padding: 16px 40px 40px; max-width: 1640px; }
.awsc__content--home { padding: 0; max-width: none; }
.awsc__crumbs { display: flex; flex-wrap: wrap; align-items: center; gap: 4px 8px; margin: 4px 0 12px; font-size: 14px; }
.awsc__crumb { color: var(--aws-link); text-decoration: none; }
a.awsc__crumb:hover { text-decoration: underline; }
.awsc__crumb--current { color: var(--aws-text-3); }
.awsc__crumb-sep { color: var(--aws-text-3); }

@container sl-portal (max-width: 900px) {
  .awsc__nav { position: absolute; top: 0; bottom: 0; left: 0; box-shadow: 4px 0 16px rgba(0, 7, 22, .2); max-width: 86%; }
  .awsc__scrim { display: block; position: absolute; inset: 0; background: rgba(35, 43, 55, .4); z-index: 15; }
  .awsc__content { padding: 12px 16px 32px; }
  .awsc__content--home { padding: 0; }
}

/* ---- Cloudscape building blocks shared by every page -------------------- */
.awsc, .awsc :deep(*), .awsc :deep(*::before), .awsc :deep(*::after) { box-sizing: border-box; }
.awsc :deep(.cs-btn) {
  display: inline-flex; align-items: center; justify-content: center; gap: 6px;
  min-height: 32px; padding: 4px 20px; border: 2px solid var(--aws-blue); border-radius: 20px;
  background: #fff; color: var(--aws-blue); font: inherit; font-size: 14px; font-weight: 700; line-height: 20px;
  cursor: pointer; white-space: nowrap; text-decoration: none;
}
.awsc :deep(.cs-btn:hover:not(:disabled)) { background: #f0fbff; border-color: #002b66; color: #002b66; }
.awsc :deep(.cs-btn:disabled) { border-color: #b4b4bb; color: #8c8c94; background: #fff; cursor: default; }
.awsc :deep(.cs-btn--primary) { background: var(--aws-primary); border-color: var(--aws-primary); color: var(--aws-text); }
.awsc :deep(.cs-btn--primary:hover:not(:disabled)) { background: var(--aws-primary-hover); border-color: var(--aws-primary-hover); color: var(--aws-text); }
.awsc :deep(.cs-btn--primary:disabled) { background: #ebebf0; border-color: #ebebf0; color: #74747c; }
.awsc :deep(.cs-btn--link) { border-color: transparent; background: none; }
.awsc :deep(.cs-btn--link:hover:not(:disabled)) { background: #f0fbff; border-color: transparent; }
.awsc :deep(.cs-btn--icon) { padding: 4px 8px; min-width: 32px; }
.awsc :deep(.cs-btn--inline) { min-height: 0; padding: 0; border: 0; background: none; color: var(--aws-link); font-weight: 400; }
.awsc :deep(.cs-btn--inline:hover:not(:disabled)) { background: none; text-decoration: underline; }
.awsc :deep(.cs-btn__spinner) { width: 12px; height: 12px; border: 2px solid currentColor; border-right-color: transparent; border-radius: 50%; animation: awsc-spin .8s linear infinite; }
@keyframes awsc-spin { to { transform: rotate(360deg); } }

.awsc :deep(.cs-link) { color: var(--aws-link); text-decoration: none; cursor: pointer; background: none; border: 0; padding: 0; font: inherit; }
.awsc :deep(.cs-link:hover) { text-decoration: underline; }
/* Cloudscape's "Info" link is 12px bold text; give it a hit area a finger can find. */
.awsc :deep(:is(a, button):is([class*='__info'], .cs-info)) { display: inline-block; padding: 2px 2px; line-height: 16px; }

.awsc :deep(.cs-mono) { font-family: Monaco, Menlo, Consolas, 'Courier Prime', Courier, 'Courier New', monospace; font-size: 13px; }
.awsc :deep(.cs-muted) { color: var(--aws-text-3); }

.awsc :deep(.cs-container) { background: #fff; border: 1px solid var(--aws-border); border-radius: 16px; box-shadow: 0 1px 2px rgba(0, 7, 22, .06); margin-bottom: 20px; }
.awsc :deep(.cs-container__head) { padding: 12px 20px; }
.awsc :deep(.cs-container__head + .cs-container__body) { border-top: 1px solid var(--aws-divider); }
.awsc :deep(.cs-container__body) { padding: 16px 20px 20px; }
.awsc :deep(.cs-container__foot) { padding: 12px 20px; border-top: 1px solid var(--aws-divider); }
.awsc :deep(.cs-stack) { display: flex; flex-direction: column; gap: 16px; }
.awsc :deep(.cs-row) { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; }
.awsc :deep(.cs-form-actions) { display: flex; flex-wrap: wrap; justify-content: flex-end; gap: 8px; margin: 8px 0 24px; }

.awsc :deep(.cs-field) { display: flex; flex-direction: column; gap: 4px; max-width: 720px; }
.awsc :deep(.cs-label) { font-weight: 700; color: var(--aws-text); font-size: 14px; }
.awsc :deep(.cs-label em) { font-style: italic; font-weight: 700; }
.awsc :deep(.cs-label small) { font-weight: 400; font-style: italic; color: var(--aws-text-3); }
.awsc :deep(.cs-desc) { color: var(--aws-text-3); font-size: 12px; line-height: 16px; margin: -2px 0 2px; }
.awsc :deep(.cs-constraint) { color: var(--aws-text-3); font-size: 12px; line-height: 16px; }
.awsc :deep(.cs-error-text) { color: #db0000; font-size: 12px; line-height: 16px; display: flex; gap: 4px; align-items: center; }
.awsc :deep(.cs-input), .awsc :deep(.cs-select), .awsc :deep(.cs-textarea) {
  min-height: 32px; padding: 4px 12px; border: 1px solid var(--aws-input); border-radius: 8px;
  background: #fff; color: var(--aws-text); font: inherit; font-size: 14px;
}
/*
  The platform's global ui.css/theme.css style bare elements for its galaxy
  themes (white button ink, rounded buttons, tight heading tracking, faded
  disabled controls). Inside the console the product decides, so undo them -
  at (0,1,1) - one class above an element rule and below any component's
  own class rule (0,2,0) - so every class rule here still wins.
*/
:where(.awsc) :deep(button:not(.sfs-never)) {
  color: inherit; font-weight: inherit; line-height: inherit; border-radius: 0; letter-spacing: normal;
}
:where(.awsc) :deep(:is(h1, h2, h3, h4, h5, h6):not(.sfs-never)) { letter-spacing: normal; text-wrap: wrap; }
:where(.awsc) :deep(small:not(.sfs-never)) { color: inherit; }
:where(.awsc) :deep(:is(code, pre, kbd):not(.sfs-never)) { font-size: inherit; }
.awsc :deep(button:disabled), .awsc :deep([aria-disabled='true']) { opacity: 1; cursor: default; }
/* Width at the lowest specificity, so a page's own `width: 130px` on a narrow field wins. */
:where(.awsc) :deep(:where(.cs-input, .cs-select, .cs-textarea)) { width: 100%; }
.awsc :deep(.cs-textarea) { min-height: 96px; resize: vertical; padding: 6px 12px; }
.awsc :deep(.cs-select) { appearance: none; padding-right: 32px; background-image: linear-gradient(45deg, transparent 50%, #424650 50%), linear-gradient(135deg, #424650 50%, transparent 50%); background-position: calc(100% - 17px) 14px, calc(100% - 12px) 14px; background-size: 5px 5px; background-repeat: no-repeat; }
.awsc :deep(.cs-input:focus), .awsc :deep(.cs-select:focus), .awsc :deep(.cs-textarea:focus) { outline: none; box-shadow: inset 0 0 0 1px var(--aws-blue); border-color: var(--aws-blue); }
.awsc :deep(.cs-input.is-invalid), .awsc :deep(.cs-select.is-invalid), .awsc :deep(.cs-textarea.is-invalid) { border-color: #db0000; border-left-width: 4px; }
.awsc :deep(.cs-input:disabled) { background: #ebebf0; color: #656871; border-color: #ebebf0; }
.awsc :deep(.cs-input::placeholder), .awsc :deep(.cs-textarea::placeholder) { color: var(--aws-text-3); font-style: italic; }
.awsc :deep(.cs-check), .awsc :deep(.cs-radio) { display: flex; gap: 8px; align-items: flex-start; cursor: pointer; }
.awsc :deep(.cs-check input), .awsc :deep(.cs-radio input) { accent-color: var(--aws-blue); width: 14px; height: 14px; margin-top: 3px; flex: none; }
.awsc :deep(.cs-check small), .awsc :deep(.cs-radio small) { display: block; color: var(--aws-text-3); font-size: 12px; line-height: 16px; }

.awsc :deep(.cs-tiles) { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 220px), 1fr)); gap: 12px; }
.awsc :deep(.cs-tile) { display: flex; gap: 8px; align-items: flex-start; border: 1px solid var(--aws-input); border-radius: 8px; padding: 10px 14px; cursor: pointer; }
.awsc :deep(.cs-tile.is-checked) { border: 2px solid var(--aws-blue); background: #f0fbff; padding: 9px 13px; }
.awsc :deep(.cs-tile input) { accent-color: var(--aws-blue); margin-top: 3px; }
.awsc :deep(.cs-tile strong) { display: block; }
.awsc :deep(.cs-tile small) { display: block; color: var(--aws-text-3); font-size: 12px; line-height: 16px; }

.awsc :deep(.cs-toggle) { display: inline-flex; align-items: center; gap: 8px; cursor: pointer; }
.awsc :deep(.cs-toggle input) { appearance: none; width: 24px; height: 16px; border-radius: 8px; background: #8c8c94; position: relative; cursor: pointer; margin: 0; }
.awsc :deep(.cs-toggle input::after) { content: ''; position: absolute; top: 2px; left: 2px; width: 12px; height: 12px; border-radius: 50%; background: #fff; transition: left .1s; }
.awsc :deep(.cs-toggle input:checked) { background: var(--aws-blue); }
.awsc :deep(.cs-toggle input:checked::after) { left: 10px; }

.awsc :deep(.cs-alert) { display: flex; gap: 10px; align-items: flex-start; border: 2px solid; border-radius: 12px; padding: 10px 16px; font-size: 14px; margin-bottom: 16px; }
.awsc :deep(.cs-alert__icon) { margin-top: 2px; flex: none; }
.awsc :deep(.cs-alert strong) { display: block; }
.awsc :deep(.cs-alert ul), .awsc :deep(.cs-alert ol) { margin: 0; padding-left: 18px; }
.awsc :deep(.cs-alert > div) { min-width: 0; }
.awsc :deep(.cs-alert--info) { border-color: #006ce0; background: #f0fbff; }
.awsc :deep(.cs-alert--info .cs-alert__icon) { color: #006ce0; }
.awsc :deep(.cs-alert--warning) { border-color: #855900; background: #fffef0; }
.awsc :deep(.cs-alert--warning .cs-alert__icon) { color: #855900; }
.awsc :deep(.cs-alert--error) { border-color: #db0000; background: #fff5f5; }
.awsc :deep(.cs-alert--error .cs-alert__icon) { color: #db0000; }
.awsc :deep(.cs-alert--success) { border-color: #00802f; background: #effff1; }
.awsc :deep(.cs-alert--success .cs-alert__icon) { color: #00802f; }

.awsc :deep(.cs-kv) { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 220px), 1fr)); gap: 16px 32px; }
.awsc :deep(.cs-kv > div) { min-width: 0; }
.awsc :deep(.cs-kv dt), .awsc :deep(.cs-kv__label) { font-weight: 700; color: var(--aws-text-2); margin-bottom: 2px; font-size: 14px; }
.awsc :deep(.cs-kv dd) { margin: 0; word-break: break-word; }
.awsc :deep(.cs-kv dl) { margin: 0; }

.awsc :deep(.cs-tabs) { display: flex; gap: 0; border-bottom: 1px solid var(--aws-border); margin-bottom: 16px; overflow-x: auto; scrollbar-width: thin; }
.awsc :deep(.cs-tab) { border: 0; background: none; padding: 8px 16px 9px; font: inherit; font-weight: 700; color: var(--aws-text-2); cursor: pointer; white-space: nowrap; border-bottom: 4px solid transparent; position: relative; }
.awsc :deep(.cs-tab + .cs-tab::before) { content: ''; position: absolute; left: 0; top: 10px; bottom: 12px; border-left: 1px solid var(--aws-border); }
.awsc :deep(.cs-tab:hover) { color: var(--aws-link); }
.awsc :deep(.cs-tab:disabled) { color: #8c8c94; cursor: default; }
.awsc :deep(.cs-tab.is-active) { color: var(--aws-link); border-bottom-color: var(--aws-link); }

.awsc :deep(.cs-badge) { display: inline-block; padding: 0 8px; border-radius: 4px; background: #424650; color: #fff; font-size: 12px; line-height: 20px; font-weight: 700; }
.awsc :deep(.cs-badge--blue) { background: #006ce0; }
.awsc :deep(.cs-badge--grey) { background: #ebebf0; color: #424650; font-weight: 400; }
.awsc :deep(.cs-code) { color: #0f141a; background: #f8f8f8; border: 1px solid var(--aws-divider); border-radius: 8px; padding: 12px 14px; font-family: Monaco, Menlo, Consolas, 'Courier New', monospace; font-size: 13px; line-height: 18px; white-space: pre-wrap; word-break: break-word; margin: 0; max-height: 420px; overflow: auto; }
.awsc :deep(.cs-split) { display: grid; grid-template-columns: minmax(0, 1fr) 320px; gap: 20px; align-items: start; }
.awsc :deep(.cs-grid-2) { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 16px 20px; }
.awsc :deep(.cs-grid-3) { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 16px 20px; }
.awsc :deep(.cs-wizard) { display: grid; grid-template-columns: 200px minmax(0, 1fr); gap: 32px; }
.awsc :deep(.cs-steps) { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 18px; }
.awsc :deep(.cs-steps li) { color: var(--aws-text-3); font-size: 12px; }
.awsc :deep(.cs-steps li strong) { display: block; font-size: 14px; color: var(--aws-text-3); font-weight: 400; }
.awsc :deep(.cs-steps li.is-current strong) { color: var(--aws-text); font-weight: 700; }
.awsc :deep(.cs-steps li.is-done strong) { color: var(--aws-link); }
.awsc :deep(.cs-table-mini) { width: 100%; border-collapse: collapse; font-size: 14px; }
.awsc :deep(.cs-table-mini th) { text-align: left; font-weight: 700; color: var(--aws-text-2); padding: 6px 10px; border-bottom: 1px solid var(--aws-border); white-space: nowrap; }
.awsc :deep(.cs-table-mini td) { padding: 8px 10px; border-bottom: 1px solid var(--aws-divider); vertical-align: top; }
.awsc :deep(.cs-scroll-x) { overflow-x: auto; }
.awsc :deep(.cs-empty) { text-align: center; color: var(--aws-text-3); padding: 20px 8px; }
.awsc :deep(.cs-empty strong) { display: block; color: var(--aws-text-2); }

@container sl-portal (max-width: 900px) {
  .awsc :deep(.cs-split), .awsc :deep(.cs-wizard), .awsc :deep(.cs-grid-2), .awsc :deep(.cs-grid-3) { grid-template-columns: minmax(0, 1fr); }
  .awsc :deep(.cs-steps) { flex-direction: row; flex-wrap: wrap; gap: 10px 18px; }
}
@container sl-portal (max-width: 640px) {
  /* A mini table wider than a phone scrolls inside itself, never the page. */
  /* (the table keeps display: table so it still fills its container; its parent does the scrolling) */
  .awsc :deep(:has(> .cs-table-mini):not(:has(.cs-dd))) { overflow-x: auto; }
  .awsc :deep(.cs-table-mini) { min-width: 100%; }
}
@container sl-portal (max-width: 560px) {
  .awsc :deep(.cs-container__head), .awsc :deep(.cs-container__body) { padding-left: 14px; padding-right: 14px; }
  .awsc :deep(.cs-btn) { padding: 4px 14px; }
  .awsc :deep(.cs-form-actions) { justify-content: stretch; }
}
</style>
