<template>
  <Teleport to="body">
    <!--
      THE DEFINITIONS WINDOW. Teleported to <body> for the reason every lab
      dialog is: the workbench is a positioned box one z-index away from a
      stacking context that would paint this under the sidebar. Nothing in the
      lab is unmounted while it is open.
    -->
    <div v-if="open" class="sld-overlay" role="presentation" @click.self="$emit('close')">
      <div ref="dialog" class="sld" role="dialog" aria-modal="true" :aria-labelledby="titleId" tabindex="-1"
           @keydown.esc="$emit('close')">
        <header class="sld__head">
          <div class="sld__head-text">
            <p class="sld__kicker"><BookMarked class="sld__i" aria-hidden="true" /> {{ $t('Definitions and explanations') }}</p>
            <h2 :id="titleId" class="sld__title">{{ labTitle }}</h2>
          </div>
          <button type="button" class="sld__close" :aria-label="$t('Close')" @click="$emit('close')">
            <X class="sld__i" aria-hidden="true" />
          </button>
        </header>

        <div class="sld__body">
          <!-- Contents: sections, then every term. A select on a phone. -->
          <nav class="sld__nav" :aria-label="$t('Contents')">
            <label class="sld__search">
              <Search class="sld__i" aria-hidden="true" />
              <input v-model="query" type="search" :placeholder="$t('Search terms')" :aria-label="$t('Search terms')" />
            </label>
            <ul class="sld__toc">
              <li v-for="item in sections" :key="item.id">
                <button type="button" :class="{ 'is-active': current === item.id }" @click="select(item.id)">
                  <component :is="item.icon" class="sld__i" aria-hidden="true" /> {{ item.label }}
                </button>
              </li>
            </ul>
            <p class="sld__group">{{ $t('Key terms in this lab') }} <span>({{ primaryTerms.length }})</span></p>
            <ul class="sld__toc sld__toc--terms">
              <li v-for="term in visibleTerms" :key="term.id">
                <button type="button" :class="{ 'is-active': current === 'term:' + term.id, 'is-extra': !term.primary }"
                        @click="select('term:' + term.id)">
                  {{ term.term }}
                </button>
              </li>
            </ul>
            <p v-if="query && !visibleTerms.length" class="sld__none">{{ $t('No term in this lab matches.') }}</p>
            <template v-if="query">
              <button type="button" class="sl-btn sl-btn--ghost sl-btn--sm sld__all" @click="searchAll">
                {{ $t('Search the whole glossary') }}
              </button>
              <ul v-if="globalHits.length" class="sld__toc sld__toc--terms">
                <li v-for="row in globalHits" :key="row.id">
                  <button type="button" :class="{ 'is-active': current === 'term:' + row.id }" @click="openGlobal(row.id)">
                    {{ row.term }}
                  </button>
                </li>
              </ul>
            </template>
            <select class="sld__mobile" :value="current" :aria-label="$t('Contents')" @change="select(($event.target as HTMLSelectElement).value)">
              <option v-for="item in sections" :key="item.id" :value="item.id">{{ item.label }}</option>
              <option v-for="term in terms" :key="term.id" :value="'term:' + term.id">— {{ term.term }}</option>
            </select>
          </nav>

          <main ref="main" class="sld__main">
            <p v-if="loading" class="sld__state">{{ $t('Loading the definitions...') }}</p>
            <div v-else-if="failed" class="sld__state">
              <p>{{ $t('Could not load the definitions. Check your connection and try again.') }}</p>
              <button type="button" class="sl-btn sl-btn--primary sl-btn--sm" @click="load(true)">{{ $t('Try again') }}</button>
            </div>

            <!-- ABOUT THIS LAB -->
            <article v-else-if="current === 'about'" class="sld__article">
              <h3>{{ $t('About this lab') }}</h3>
              <p v-if="lab.summary" class="sld__lead">{{ $td(lab, 'summary') }}</p>
              <p v-for="(para, at) in prose" :key="at">{{ para }}</p>
              <div class="sld__facts">
                <span v-if="lab.difficulty"><Gauge class="sld__i" aria-hidden="true" /> {{ $t(cap(lab.difficulty)) }}</span>
                <span v-if="lab.minutes"><Clock class="sld__i" aria-hidden="true" /> {{ $t('About {v0} minutes', { v0: lab.minutes }) }}</span>
                <span><ListChecks class="sld__i" aria-hidden="true" /> {{ $t('{v0} tasks', { v0: taskList.length }) }}</span>
              </div>
              <h4 v-if="objectives.length">{{ $t('What you will learn') }}</h4>
              <ul v-if="objectives.length" class="sld__list">
                <li v-for="(item, at) in objectives" :key="at">{{ item }}</li>
              </ul>
              <h4>{{ $t('Before you start') }}</h4>
              <ul class="sld__list">
                <li v-for="(item, at) in defs?.track?.before || []" :key="'b' + at"><DocText :text="item" /></li>
                <li v-if="primaryTerms.length">
                  {{ $t('Read the key terms below if any of them is new to you:') }}
                  <span class="sld__chips">
                    <button v-for="term in primaryTerms.slice(0, 10)" :key="term.id" type="button" class="sld__chip"
                            @click="select('term:' + term.id)">{{ term.term }}</button>
                  </span>
                </li>
              </ul>
              <template v-if="defs?.previous?.length">
                <h4>{{ $t('Earlier labs in this track') }}</h4>
                <p class="sld__muted">{{ $t('You can do this lab first, but these build up to it:') }}</p>
                <ul class="sld__list">
                  <li v-for="row in defs.previous" :key="row.id">
                    <router-link :to="`/lab/${row.id}`" @click="$emit('close')">{{ row.title }}</router-link>
                  </li>
                </ul>
              </template>
              <p v-if="defs?.track?.simulated" class="sld__note">
                <Info class="sld__i" aria-hidden="true" /> <DocText :text="defs.track.simulated" />
              </p>
            </article>

            <!-- THE PLATFORM -->
            <article v-else-if="current === 'platform' && track" class="sld__article">
              <h3>{{ $t('What is {v0}?', { v0: track.product }) }}</h3>
              <DocText tag="p" class="sld__lead" :text="track.tagline" />
              <DocText v-for="(para, at) in track.what" :key="'w' + at" tag="p" :text="para" />
              <ConceptScene v-if="track.scene" :scene="track.scene" :caption="track.product" />
              <h4>{{ $t('How it works') }}</h4>
              <DocText v-for="(para, at) in track.how" :key="'h' + at" tag="p" :text="para" />
              <FlowDiagram v-if="track.diagram" :diagram="track.diagram" :caption="$t('How the parts fit together')" />
              <p v-if="track.who"><strong>{{ $t('Who uses it') }}:</strong> {{ track.who }}</p>
              <h4 v-if="track.learn.length">{{ $t('What this track teaches') }}</h4>
              <ul class="sld__list"><li v-for="(item, at) in track.learn" :key="at"><DocText :text="item" /></li></ul>
            </article>

            <!-- THE FLOW OF THE LAB -->
            <article v-else-if="current === 'flow'" class="sld__article">
              <h3>{{ $t('How this lab flows') }}</h3>
              <p class="sld__muted">{{ $t('Each task builds on the one before. Do them in order, and press Check my work whenever you like - finished tasks stay finished.') }}</p>
              <FlowDiagram :diagram="flow" :line-chars="30" />
              <ol class="sld__tasks">
                <li v-for="(task, at) in taskList" :key="task.id">
                  <strong>{{ task.title }}</strong>
                  <span>{{ task.instructions?.goal || task.detail }}</span>
                </li>
              </ol>
            </article>

            <!-- THE TOOLS -->
            <article v-else-if="current === 'tools'" class="sld__article">
              <h3>{{ $t('The tools in this lab') }}</h3>
              <p class="sld__muted">{{ $t('Every tool works on the same lab environment: a file written in one is seen by all the others.') }}</p>
              <div v-for="tool in toolList" :key="tool.id" class="sld__tool">
                <div class="sld__tool-head">
                  <strong>{{ tool.label }}</strong>
                  <span class="sld__badge" :class="tool.simulated ? 'is-sim' : 'is-real'">
                    {{ tool.simulated ? $t('Simulated') : $t('Real') }}
                  </span>
                  <button type="button" class="sl-btn sl-btn--ghost sl-btn--sm" @click="$emit('open-tool', tool.id); $emit('close')">
                    {{ $t('Open') }}
                  </button>
                </div>
                <p v-if="tool.summary">{{ tool.summary }}</p>
                <p v-if="tool.fidelity" class="sld__muted">{{ tool.fidelity }}</p>
              </div>
            </article>

            <!-- ONE TERM -->
            <article v-else-if="term" class="sld__article">
              <p class="sld__cat">{{ categoryLabel(term.category) }}</p>
              <h3>{{ term.term }}</h3>
              <p v-if="term.aka.length" class="sld__muted">{{ $t('Also called') }}: {{ term.aka.join(', ') }}</p>
              <DocText tag="p" class="sld__lead" :text="term.short" />
              <DocText v-for="(para, at) in term.explain" :key="at" tag="p" :text="para" />
              <FlowDiagram v-if="term.diagram" :diagram="term.diagram" />
              <div v-if="term.example" class="sld__box">
                <h4>{{ $t('Example') }}</h4>
                <DocText tag="p" :text="term.example" />
              </div>
              <div v-if="term.analogy" class="sld__box sld__box--soft">
                <h4>{{ $t('Think of it like this') }}</h4>
                <DocText tag="p" :text="term.analogy" />
              </div>
              <ConceptScene v-if="term.scene" :scene="term.scene" :caption="$t('{v0}, illustrated', { v0: term.term })" />
              <p v-if="term.why"><strong>{{ $t('Why it matters in this lab') }}:</strong> <DocText :text="term.why" /></p>
              <template v-if="term.related.length">
                <h4>{{ $t('Related terms') }}</h4>
                <span class="sld__chips">
                  <button v-for="rid in term.related" :key="rid" type="button" class="sld__chip" @click="openGlobal(rid)">
                    {{ nameFor(rid) }}
                  </button>
                </span>
              </template>
              <footer class="sld__pager">
                <button v-if="neighbour(-1)" type="button" class="sl-btn sl-btn--ghost sl-btn--sm"
                        @click="select('term:' + neighbour(-1)!.id)">← {{ neighbour(-1)!.term }}</button>
                <span />
                <button v-if="neighbour(1)" type="button" class="sl-btn sl-btn--ghost sl-btn--sm"
                        @click="select('term:' + neighbour(1)!.id)">{{ neighbour(1)!.term }} →</button>
              </footer>
            </article>
          </main>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
/**
 * Definitions and explanations for one lab - a short lesson for somebody who
 * has jumped straight into it.
 *
 * Two sources, deliberately: the TRACK overview and the TERMS come from app
 * 11's glossary (fetched when the window first opens); everything about THIS
 * lab - its story, its tasks, its tools - is composed from the lab the page
 * already holds, so it can never disagree with the brief beside it. Content is
 * English for now; the chrome is translated. Nothing reaches `v-html`.
 */
import { computed, nextTick, ref, watch } from 'vue';
import {
  BookMarked, Boxes, Clock, Compass, Gauge, Info, Layers, ListChecks, Search, Workflow, Wrench, X,
} from 'lucide-vue-next';
import FlowDiagram from './FlowDiagram.vue';
import ConceptScene from './ConceptScene.vue';
import DocText from './DocText.vue';
import { t, td, tdl } from '@/i18n/runtime';
import { labsService } from '@/services/labs.service';
import type { Lab, LabTask, LabTool } from '@/utils/labCatalogue';
import {
  briefProse, labFlow, labToolsSummary, searchTerms,
  type GlossaryIndexRow, type GlossaryTerm, type LabDefinitions,
} from '@/utils/labDocs';

const props = defineProps<{
  open: boolean;
  lab: Lab;
  tasks: LabTask[];
  tools: LabTool[];
  /** `term:<id>` or a section id to land on. */
  start?: string;
}>();
defineEmits<{ (event: 'close'): void; (event: 'open-tool', toolId: string): void }>();

/** Literal `t()` calls so the catalogue scan sees every label it has to cover. */
function categoryLabel(category: string): string {
  switch (category) {
    case 'platform': return t('Platform');
    case 'tool': return t('Tool');
    case 'language': return t('Language');
    case 'resource': return t('Resource');
    case 'practice': return t('Practice');
    case 'role': return t('Role');
    default: return t('Concept');
  }
}

const titleId = `sld-title-${Math.random().toString(36).slice(2, 8)}`;
const dialog = ref<HTMLElement | null>(null);
const main = ref<HTMLElement | null>(null);
const defs = ref<LabDefinitions | null>(null);
const loading = ref(false);
const failed = ref(false);
const current = ref('about');
const query = ref('');
const globalIndex = ref<GlossaryIndexRow[] | null>(null);
const globalHits = ref<GlossaryIndexRow[]>([]);
const extraTerms = ref<Record<string, GlossaryTerm>>({});
let loadedFor = '';

const labTitle = computed(() => td(props.lab, 'title') || props.lab.title);
const track = computed(() => defs.value?.track || null);
const terms = computed(() => defs.value?.terms || []);
const primaryTerms = computed(() => terms.value.filter(term => term.primary !== false));
const visibleTerms = computed(() => searchTerms(terms.value, query.value));
const objectives = computed(() => tdl(props.lab, 'objectives') || props.lab.objectives || []);
const prose = computed(() => briefProse(td(props.lab, 'brief') || props.lab.brief || '', 3));
const taskList = computed(() => props.tasks || []);
const toolList = computed(() => labToolsSummary(props.tools || []));
const flow = computed(() => labFlow(taskList.value, { start: t('Open the lab'), end: t('Check my work') }));

const sections = computed(() => [
  { id: 'about', label: t('About this lab'), icon: Compass },
  ...(track.value ? [{ id: 'platform', label: t('What is {v0}?', { v0: track.value.product }), icon: Layers }] : []),
  { id: 'flow', label: t('How this lab flows'), icon: Workflow },
  { id: 'tools', label: t('The tools in this lab'), icon: Wrench },
]);

const term = computed<GlossaryTerm | null>(() => {
  if (!current.value.startsWith('term:')) return null;
  const id = current.value.slice(5);
  return terms.value.find(row => row.id === id) || extraTerms.value[id] || null;
});

function cap(s: string) { return s ? s[0].toUpperCase() + s.slice(1) : s; }

function nameFor(id: string) {
  return terms.value.find(row => row.id === id)?.term || extraTerms.value[id]?.term
    || globalIndex.value?.find(row => row.id === id)?.term || id.replace(/-/g, ' ');
}

function neighbour(step: number): GlossaryTerm | null {
  const list = terms.value;
  const at = list.findIndex(row => 'term:' + row.id === current.value);
  if (at < 0) return null;
  return list[at + step] || null;
}

async function select(id: string) {
  current.value = id;
  await nextTick();
  main.value?.scrollTo?.({ top: 0 });
}

async function openGlobal(id: string) {
  if (!terms.value.some(row => row.id === id) && !extraTerms.value[id]) {
    const row = await labsService.getGlossaryTerm(id);
    if (!row) return;
    extraTerms.value = { ...extraTerms.value, [id]: { ...row, primary: false } };
  }
  select('term:' + id);
}

async function searchAll() {
  if (!globalIndex.value) globalIndex.value = await labsService.getGlossaryIndex();
  const local = new Set(terms.value.map(row => row.id));
  globalHits.value = searchTerms(globalIndex.value.map(row => ({ ...row, aka: [] as string[] })), query.value)
    .filter(row => !local.has(row.id)).slice(0, 20);
}

async function load(force = false) {
  if (!force && loadedFor === props.lab.id && defs.value) return;
  loading.value = true;
  failed.value = false;
  const payload = await labsService.getDefinitions(props.lab.id);
  loading.value = false;
  if (!payload) { failed.value = true; return; }
  defs.value = payload;
  loadedFor = props.lab.id;
}

watch(() => props.open, async (isOpen) => {
  if (!isOpen) return;
  current.value = props.start || 'about';
  query.value = '';
  globalHits.value = [];
  await nextTick();
  dialog.value?.focus();
  await load();
}, { immediate: true });
watch(() => props.start, (value) => { if (props.open && value) select(value); });
watch(() => props.lab.id, () => { loadedFor = ''; defs.value = null; extraTerms.value = {}; });
watch(query, () => { globalHits.value = []; });

defineExpose({ select });
</script>

<style scoped>
.sld-overlay {
  /* The lab's tokens: teleported outside `.sl-workspace`, so `.sl-btn` needs them here too. */
  --sl-radius: 12px; --sl-radius-sm: 8px;
  --sl-line: 1px solid rgb(var(--sfs-line-rgb, 255 255 255) / 0.14);
  --sl-surface: rgb(var(--sfs-tint-rgb, 255 255 255) / 0.06);
  --sl-surface-2: rgb(var(--sfs-tint-rgb, 255 255 255) / 0.1);
  position: fixed; inset: 0; z-index: 2400; display: flex; background: var(--sfs-overlay, rgba(6, 8, 20, 0.62));
  padding: clamp(0rem, 2vw, 1.5rem); }
.sld { margin: auto; width: min(1180px, 100%); height: min(92vh, 100%); display: flex; flex-direction: column;
  background: var(--sfs-space, #0b0e1a); color: var(--sfs-text, #e5e7eb); border-radius: 16px; overflow: hidden;
  border: 1px solid rgb(var(--sfs-line-rgb, 148 163 184) / 0.25); box-shadow: 0 24px 64px rgb(0 0 0 / 0.45); outline: none; }
.sld__head { display: flex; align-items: flex-start; gap: 1rem; padding: 1rem 1.25rem; border-bottom: 1px solid rgb(var(--sfs-line-rgb, 148 163 184) / 0.2); }
.sld__head-text { flex: 1; min-width: 0; }
.sld__kicker { margin: 0; font-size: 0.8rem; color: var(--sfs-accent-text, #a5b4fc); font-weight: 700; display: flex; gap: 0.35rem; align-items: center; }
.sld__title { margin: 0.2rem 0 0; font-size: 1.25rem; }
.sld__close { background: transparent; border: 0; color: inherit; cursor: pointer; padding: 0.4rem; border-radius: 8px; }
.sld__close:hover { background: rgb(var(--sfs-tint-rgb, 255 255 255) / 0.1); }
.sld__i { width: 1em; height: 1em; flex: none; }
.sld__body { flex: 1; min-height: 0; display: grid; grid-template-columns: 270px minmax(0, 1fr); }
.sld__nav { border-inline-end: 1px solid rgb(var(--sfs-line-rgb, 148 163 184) / 0.2); overflow-y: auto; padding: 0.9rem 0.6rem; }
.sld__search { display: flex; align-items: center; gap: 0.4rem; padding: 0.4rem 0.6rem; border-radius: 8px;
  background: rgb(var(--sfs-sink-rgb, 0 0 0) / 0.25); margin-bottom: 0.6rem; }
.sld__search input { flex: 1; min-width: 0; background: transparent; border: 0; color: inherit; font: inherit; outline: none; }
.sld__toc { list-style: none; margin: 0 0 0.6rem; padding: 0; display: grid; gap: 2px; }
.sld__toc button { width: 100%; display: flex; gap: 0.45rem; align-items: center; text-align: start; padding: 0.45rem 0.6rem;
  background: transparent; border: 0; border-radius: 8px; color: inherit; font: inherit; font-size: 0.9rem; cursor: pointer; }
.sld__toc button:hover { background: rgb(var(--sfs-tint-rgb, 255 255 255) / 0.07); }
.sld__toc button.is-active { background: rgb(var(--sfs-accent-rgb, 102 126 234) / 0.2); color: var(--sfs-accent-text, #c7d2fe); font-weight: 600; }
.sld__toc--terms button { font-size: 0.86rem; padding: 0.32rem 0.6rem; }
.sld__toc--terms button.is-extra { color: var(--sfs-text-muted, #94a3b8); }
.sld__group { margin: 0.6rem 0.6rem 0.3rem; font-size: 0.72rem; text-transform: uppercase; letter-spacing: 0.06em;
  color: var(--sfs-text-muted, #94a3b8); font-weight: 700; }
.sld__none { font-size: 0.85rem; color: var(--sfs-text-muted, #94a3b8); padding: 0 0.6rem; }
.sld__all { margin: 0 0.6rem 0.5rem; }
.sld__mobile { display: none; }
.sld__main { overflow-y: auto; padding: 1.25rem clamp(1rem, 3vw, 2.25rem) 2rem; }
.sld__article { max-width: 760px; margin: 0 auto; line-height: 1.65; }
.sld__article p { margin: 0 0 0.85rem; }
.sld__article h3 { font-size: 1.45rem; margin: 0 0 0.5rem; }
.sld__article h4 { margin: 1.4rem 0 0.4rem; font-size: 1.02rem; }
.sld__lead { font-size: 1.08rem; color: var(--sfs-text, #e5e7eb); font-weight: 500; }
.sld__muted { color: var(--sfs-text-muted, #94a3b8); font-size: 0.92rem; }
.sld__cat { margin: 0; font-size: 0.75rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.06em; color: var(--sfs-accent-text, #a5b4fc); }
.sld__list { padding-inline-start: 1.2rem; display: grid; gap: 0.3rem; }
.sld__facts { display: flex; flex-wrap: wrap; gap: 0.5rem; margin: 0.75rem 0; }
.sld__facts span { display: inline-flex; gap: 0.35rem; align-items: center; font-size: 0.85rem; padding: 0.3rem 0.65rem;
  border-radius: 999px; background: rgb(var(--sfs-tint-rgb, 255 255 255) / 0.08); }
.sld__chips { display: flex; flex-wrap: wrap; gap: 0.35rem; margin-top: 0.4rem; }
.sld__chip { font: inherit; font-size: 0.82rem; padding: 0.25rem 0.65rem; border-radius: 999px; cursor: pointer; color: inherit;
  border: 1px solid rgb(var(--sfs-accent-rgb, 102 126 234) / 0.45); background: rgb(var(--sfs-accent-rgb, 102 126 234) / 0.1); }
.sld__chip:hover { background: rgb(var(--sfs-accent-rgb, 102 126 234) / 0.22); }
.sld__note { display: flex; gap: 0.5rem; align-items: flex-start; margin-top: 1.25rem; padding: 0.75rem 0.9rem; border-radius: 10px;
  background: rgb(var(--sfs-accent-rgb, 102 126 234) / 0.1); font-size: 0.9rem; }
.sld__box { margin: 1rem 0; padding: 0.75rem 1rem; border-radius: 10px; border-inline-start: 4px solid var(--sfs-accent, #667eea);
  background: rgb(var(--sfs-tint-rgb, 255 255 255) / 0.05); }
.sld__box h4 { margin: 0 0 0.25rem; }
.sld__box p { margin: 0; }
.sld__box--soft { border-inline-start-color: var(--sfs-accent-2, #f472b6); }
.sld__tasks { padding-inline-start: 1.3rem; display: grid; gap: 0.6rem; }
.sld__tasks li span { display: block; color: var(--sfs-text-muted, #94a3b8); font-size: 0.92rem; }
.sld__tool { padding: 0.75rem 0; border-bottom: 1px solid rgb(var(--sfs-line-rgb, 148 163 184) / 0.15); }
.sld__tool p { margin: 0.3rem 0 0; }
.sld__tool-head { display: flex; align-items: center; gap: 0.5rem; flex-wrap: wrap; }
.sld__tool-head .sl-btn { margin-inline-start: auto; }
.sld__badge { font-size: 0.7rem; font-weight: 700; padding: 0.1rem 0.5rem; border-radius: 999px; }
.sld__badge.is-sim { background: rgb(var(--sfs-warning-rgb, 245 158 11) / 0.2); color: var(--sfs-warning-text, #fbbf24); }
.sld__badge.is-real { background: rgb(var(--sfs-success-rgb, 34 197 94) / 0.2); color: var(--sfs-success-text, #4ade80); }
.sld__pager { display: flex; justify-content: space-between; gap: 0.5rem; margin-top: 2rem; padding-top: 1rem;
  border-top: 1px solid rgb(var(--sfs-line-rgb, 148 163 184) / 0.15); }
.sld__state { text-align: center; padding: 3rem 1rem; color: var(--sfs-text-muted, #94a3b8); }
.sld__state button { margin-top: 0.75rem; }
@media (max-width: 820px) {
  .sld { height: 100%; border-radius: 0; }
  .sld__body { grid-template-columns: minmax(0, 1fr); grid-template-rows: auto minmax(0, 1fr); }
  .sld__nav { border-inline-end: 0; border-bottom: 1px solid rgb(var(--sfs-line-rgb, 148 163 184) / 0.2); overflow: visible;
    padding: 0.6rem 0.9rem; }
  .sld__toc, .sld__group, .sld__none, .sld__all { display: none; }
  .sld__mobile { display: block; width: 100%; padding: 0.45rem; border-radius: 8px; font: inherit; }
}
</style>
