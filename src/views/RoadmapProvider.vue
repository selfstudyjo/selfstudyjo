<template>
  <!--
    THE ROADMAP PROVIDER (app 27, roadmaps.py).

    A learner asks for a roadmap - from the catalogue of specializations, or by
    typing a job role, optionally written by the AI - and gets it as a map they
    can walk in 2D or 3D, with every step leading to the course, lesson, lab or
    runbook on this site that teaches it. They can keep several.

    Free with an account: the route is `requiresAuth` and nothing else, the way
    Drawing Papers and Messages are. Record text (role titles, stage names) is
    English data and is rendered as-is with `{{ }}`. Nothing reaches v-html.
  -->
  <div class="rmp">
    <header class="rmp__head">
      <div class="rmp__headtext">
        <h1 class="rmp__title"><MapPinned class="rmp__ti" aria-hidden="true" /> {{ $t('Roadmap Provider') }}</h1>
        <p class="rmp__lead">
          {{ $t('Pick a field, a specialization or a job role, and get a step-by-step roadmap built from the courses, lessons, labs and runbooks on this site - drawn as a map you can walk in 2D or 3D.') }}
        </p>
      </div>
      <button v-if="signedIn && (doc || route.params.roadmapId)" type="button" class="rmp__btn rmp__btn--primary"
              @click="startNew">
        <Plus class="rmp__i" aria-hidden="true" /> {{ $t('New roadmap') }}
      </button>
    </header>

    <!-- Signed out. The guard normally sends them to sign in first; this is
         the page's own answer if a session ends while it is open. -->
    <section v-if="!signedIn" class="rmp__gate">
      <Compass class="rmp__gatei" aria-hidden="true" />
      <h2>{{ $t('Sign in or register to build your roadmaps') }}</h2>
      <p>{{ $t('Roadmaps are free with an account. Your maps and your progress on them are saved, so you can come back to them any time.') }}</p>
      <div class="rmp__gatebtns">
        <router-link :to="{ path: '/login', query: { redirect: route.fullPath } }" class="rmp__btn rmp__btn--primary">
          <LogIn class="rmp__i" aria-hidden="true" /> {{ $t('Sign in') }}
        </router-link>
        <router-link to="/register" class="rmp__btn">
          <UserPlus class="rmp__i" aria-hidden="true" /> {{ $t('Register') }}
        </router-link>
      </div>
    </section>

    <section v-else-if="serviceState" class="rmp__gate" role="status">
      <Compass class="rmp__gatei" aria-hidden="true" />
      <h2>{{ serviceState.title }}</h2>
      <p>{{ serviceState.text }}</p>
      <button type="button" class="rmp__btn" @click="boot">{{ $t('Try again') }}</button>
    </section>

    <div v-else class="rmp__layout">
      <!-- MY ROADMAPS -->
      <aside class="rmp__mine" :aria-label="$t('My roadmaps')">
        <div class="rmp__minehead">
          <h2>{{ $t('My roadmaps') }}</h2>
          <span v-if="mine.length" class="rmp__count">{{ $n(mine.length) }}</span>
        </div>
        <p v-if="loadingMine && !mine.length" class="rmp__muted"><LoaderCircle class="rmp__i rmp__spin" /> {{ $t('Loading your roadmaps…') }}</p>
        <p v-else-if="!mine.length" class="rmp__muted">{{ $t('You have not made a roadmap yet. Choose one from the catalogue to start.') }}</p>
        <ul v-else class="rmp__minelist">
          <li v-for="item in mine" :key="item.id" class="rmp__mineitem"
              :class="{ 'is-current': item.id === doc?.id }">
            <template v-if="renamingId === item.id">
              <form class="rmp__rename" @submit.prevent="saveRename(item.id)">
                <input ref="renameInput" v-model="renameText" class="rmp__input" maxlength="120"
                       :aria-label="$t('Roadmap name')" @keydown.esc="renamingId = ''" />
                <button type="submit" class="rmp__btn rmp__btn--sm rmp__btn--primary" :disabled="!renameText.trim()">{{ $t('Save') }}</button>
                <button type="button" class="rmp__btn rmp__btn--sm" @click="renamingId = ''">{{ $t('Cancel') }}</button>
              </form>
            </template>
            <template v-else>
              <router-link :to="`/roadmaps/${encodeURIComponent(item.id)}`" class="rmp__minelink">
                <span class="rmp__minetitle rmp__data">{{ item.title }}</span>
                <span class="rmp__minemeta">
                  {{ $t('{v0} of {v1} steps done', { v0: item.done_count, v1: item.node_count }) }}
                  <template v-if="item.source === 'ai'"> · <Sparkles class="rmp__i rmp__i--xs" aria-hidden="true" /> {{ $t('AI') }}</template>
                </span>
                <span class="rmp__meter" role="progressbar" :aria-valuenow="summaryPercent(item) ?? 0"
                      aria-valuemin="0" aria-valuemax="100" :aria-label="$t('Progress')">
                  <span :style="{ width: `${summaryPercent(item) ?? 0}%` }" />
                </span>
              </router-link>
              <div class="rmp__mineacts">
                <button type="button" class="rmp__icon" :aria-label="$t('Rename')" :title="$t('Rename')"
                        @click="beginRename(item)"><Pencil aria-hidden="true" /></button>
                <button v-if="confirmDelete !== item.id" type="button" class="rmp__icon is-danger"
                        :aria-label="$t('Delete')" :title="$t('Delete')" @click="confirmDelete = item.id">
                  <Trash2 aria-hidden="true" />
                </button>
              </div>
              <div v-if="confirmDelete === item.id" class="rmp__confirm" role="alert">
                <span>{{ $t('Delete this roadmap and your progress on it?') }}</span>
                <button type="button" class="rmp__btn rmp__btn--sm rmp__btn--danger" :disabled="busy" @click="remove(item.id)">{{ $t('Delete') }}</button>
                <button type="button" class="rmp__btn rmp__btn--sm" @click="confirmDelete = ''">{{ $t('Cancel') }}</button>
              </div>
            </template>
          </li>
        </ul>
      </aside>

      <main class="rmp__main">
        <p v-if="notice" class="rmp__notice" :class="`is-${notice.kind}`" role="status">
          {{ notice.text }}
          <button type="button" class="rmp__icon" :aria-label="$t('Close')" @click="notice = null"><X aria-hidden="true" /></button>
        </p>

        <!-- CREATING: AI generation can take ~25 seconds. -->
        <section v-if="creating" class="rmp__creating" role="status" aria-live="polite">
          <div class="rmp__orbit" aria-hidden="true"><span /><span /><span /></div>
          <h2>{{ creatingAi ? $t('The AI is writing your roadmap…') : $t('Building your roadmap…') }}</h2>
          <ol class="rmp__steps">
            <li v-for="(s, i) in creatingSteps" :key="i" :class="{ 'is-done': i < creatingStep, 'is-now': i === creatingStep }">{{ s }}</li>
          </ol>
          <p class="rmp__muted">{{ $t('{v0} s - this can take up to half a minute.', { v0: elapsed }) }}</p>
        </section>

        <!-- LOADING one roadmap -->
        <p v-else-if="loadingDoc" class="rmp__muted rmp__pad"><LoaderCircle class="rmp__i rmp__spin" /> {{ $t('Opening the roadmap…') }}</p>

        <section v-else-if="docMissing" class="rmp__gate">
          <h2>{{ $t('This roadmap could not be opened') }}</h2>
          <p>{{ $t('It may have been deleted, or it belongs to another account.') }}</p>
          <router-link to="/roadmaps" class="rmp__btn">{{ $t('Back to my roadmaps') }}</router-link>
        </section>

        <!-- THE MAP -->
        <section v-else-if="doc" class="rmp__view">
          <div v-if="preview" class="rmp__previewbar">
            <div class="rmp__previewtext">
              <span class="rmp__eyebrow">{{ $t('Preview') }}</span>
              <strong>{{ $t('This is the template. Make it yours to track your progress.') }}</strong>
            </div>
            <form class="rmp__makeit" @submit.prevent="createFromPreview">
              <label class="rmp__field">
                <span>{{ $t('Level') }}</span>
                <select v-model="form.level" class="rmp__input">
                  <option value="beginner">{{ $t('Beginner') }}</option>
                  <option value="intermediate">{{ $t('Intermediate') }}</option>
                  <option value="advanced">{{ $t('Advanced') }}</option>
                </select>
              </label>
              <label class="rmp__field rmp__field--narrow">
                <span>{{ $t('Hours a week') }}</span>
                <input v-model.number="form.hours" type="number" min="1" max="60" class="rmp__input" />
              </label>
              <label class="rmp__check">
                <input v-model="form.useAi" type="checkbox" /> <Sparkles class="rmp__i" aria-hidden="true" /> {{ $t('Personalise with AI') }}
              </label>
              <button type="submit" class="rmp__btn rmp__btn--primary" :disabled="busy">
                <Rocket class="rmp__i" aria-hidden="true" /> {{ $t('Create my roadmap') }}
              </button>
              <button type="button" class="rmp__btn" @click="closePreview">{{ $t('Back to the catalogue') }}</button>
            </form>
          </div>

          <div class="rmp__docinfo">
            <div class="rmp__docmain">
              <h2 class="rmp__doctitle rmp__data">{{ doc.title }}</h2>
              <ul class="rmp__chips">
                <li v-if="doc.level" class="rmp__chip">{{ levelLabel(doc.level) }}</li>
                <li v-if="doc.estimated_weeks" class="rmp__chip"><Clock class="rmp__i" aria-hidden="true" /> {{ $t('about {v0} weeks', { v0: doc.estimated_weeks }) }}</li>
                <li v-if="doc.hours_per_week" class="rmp__chip">{{ $t('{v0} hours a week', { v0: doc.hours_per_week }) }}</li>
                <li class="rmp__chip">{{ $t('{v0} stages', { v0: doc.stages.length }) }}</li>
                <li v-if="doc.source === 'ai'" class="rmp__chip is-ai"><Sparkles class="rmp__i" aria-hidden="true" /> {{ $t('Written with AI') }}</li>
              </ul>
            </div>
            <div v-if="!preview" class="rmp__progress">
              <div class="rmp__ring" :style="{ '--p': stats.percent ?? 0 }" role="img"
                   :aria-label="$t('{v0}% done', { v0: stats.percent ?? 0 })">
                <span>{{ stats.percent === null ? '—' : `${stats.percent}%` }}</span>
              </div>
              <div class="rmp__progtext">
                <strong>{{ $t('{v0} of {v1} steps done', { v0: stats.done, v1: stats.total }) }}</strong>
                <span v-if="stats.doing" class="rmp__muted">{{ $t('{v0} in progress', { v0: stats.doing }) }}</span>
              </div>
            </div>
          </div>

          <div v-if="!preview && next" class="rmp__next">
            <Target class="rmp__i" aria-hidden="true" />
            <span>{{ $t('Next up:') }} <strong class="rmp__data">{{ next.title }}</strong></span>
            <button type="button" class="rmp__btn rmp__btn--sm" @click="select(next.id)">{{ $t('Show me') }}</button>
          </div>

          <div class="rmp__toolbar">
            <div class="rmp__seg" role="group" :aria-label="$t('Map view')">
              <button type="button" :aria-pressed="mode === '2d'" @click="setMode('2d')">
                <Waypoints class="rmp__i" aria-hidden="true" /> 2D
              </button>
              <button type="button" :aria-pressed="mode === '3d'" :disabled="!webgl" @click="setMode('3d')">
                <Box class="rmp__i" aria-hidden="true" /> 3D
              </button>
            </div>
            <button type="button" class="rmp__btn rmp__btn--sm" @click="touring ? stopTour() : playTour()">
              <component :is="touring ? Pause : Play" class="rmp__i" aria-hidden="true" />
              {{ touring ? $t('Stop the tour') : $t('Play tour') }}
            </button>
            <ul class="rmp__legend" :aria-label="$t('Legend')">
              <li v-for="k in legendKinds" :key="k" :class="`is-${k}`">
                <svg viewBox="-14 -14 28 28" width="14" height="14" aria-hidden="true">
                  <polygon v-if="k === 'course'" points="0,-13 11.3,-6.5 11.3,6.5 0,13 -11.3,6.5 -11.3,-6.5" />
                  <circle v-else-if="k === 'lesson'" r="12" />
                  <rect v-else-if="k === 'lab'" x="-11" y="-11" width="22" height="22" rx="4" />
                  <path v-else-if="k === 'runbook'" d="M -10 -13 H 5 L 11 -7 V 13 H -10 Z" />
                  <polygon v-else points="0,-13 13,0 0,13 -13,0" />
                </svg>
                {{ kindLabel(k) }}
              </li>
            </ul>
          </div>
          <p v-if="!webgl" class="rmp__muted rmp__small">{{ $t('3D needs WebGL, which this browser does not offer, so the map is shown in 2D.') }}</p>
          <p v-else-if="fallbackNote" class="rmp__muted rmp__small">{{ fallbackNote }}</p>

          <div class="rmp__stagewrap">
            <div class="rmp__mapcol">
              <RoadmapMap3D v-if="mode === '3d'" ref="map3d" :doc="doc" :selected-id="selectedId"
                            :animate="motion" @select="onMapSelect" @focus="focusStageId = $event"
                            @tour-end="touring = false" @failed="on3dFailed" />
              <RoadmapMap2D v-else ref="map2d" class="rmp__map2d" :doc="doc" :selected-id="selectedId"
                            :focus-stage-id="focusStageId" :animate="motion" @select="select" />

              <RoadmapNodeCard v-if="selected" class="rmp__nodecard" :doc="doc" :node="selected.node"
                               :stage="selected.stage" :readonly="preview" :busy="saving"
                               @close="selectedId = null" @select="select" @status="setStatus" />
            </div>

            <div class="rmp__side">
              <!-- Every step, as a list: the keyboard and screen-reader way
                   through the same map, and the readable one on a phone. -->
              <section class="rmp__stages" :aria-label="$t('Stages')">
                <h3>{{ $t('Stages') }}</h3>
                <details v-for="(stage, si) in doc.stages" :key="stage.id" class="rmp__stage"
                         :open="focusStageId === stage.id || (selected?.stage.id === stage.id)">
                  <summary @click="focusStageId = stage.id">
                    <span class="rmp__stagenum">{{ si + 1 }}</span>
                    <span class="rmp__stagename rmp__data">{{ stage.title }}</span>
                    <span class="rmp__stagepct">{{ stagePct(stage.id) }}</span>
                  </summary>
                  <p v-if="stage.summary" class="rmp__stagesum rmp__data">{{ stage.summary }}</p>
                  <ul class="rmp__steplist">
                    <li v-for="node in stage.nodes" :key="node.id">
                      <button type="button" class="rmp__step" :class="[`is-${node.kind}`, `is-${statusOf(doc, node.id) || 'todo'}`]"
                              :aria-pressed="selectedId === node.id" @click="select(node.id)">
                        <CircleCheck v-if="statusOf(doc, node.id) === 'done'" class="rmp__i is-done" aria-hidden="true" />
                        <CircleDot v-else-if="statusOf(doc, node.id) === 'doing'" class="rmp__i is-doing" aria-hidden="true" />
                        <Circle v-else class="rmp__i" aria-hidden="true" />
                        <span class="rmp__steptitle rmp__data">{{ node.title }}</span>
                        <span class="rmp__stepkind">{{ kindLabel(node.kind) }}</span>
                      </button>
                    </li>
                  </ul>
                </details>
              </section>

              <RoadmapRolePanel :role="doc.role" :notes="doc.notes" />
            </div>
          </div>
        </section>

        <!-- THE BUILDER -->
        <section v-else class="rmp__builder">
          <div class="rmp__tabs" role="tablist">
            <button type="button" role="tab" :aria-selected="tab === 'catalogue'" @click="tab = 'catalogue'">
              <Layers class="rmp__i" aria-hidden="true" /> {{ $t('From the catalogue') }}
            </button>
            <button type="button" role="tab" :aria-selected="tab === 'custom'" @click="tab = 'custom'">
              <Sparkles class="rmp__i" aria-hidden="true" /> {{ $t('Describe your own role') }}
            </button>
          </div>

          <div v-if="tab === 'catalogue'" class="rmp__catalogue" role="tabpanel">
            <div class="rmp__filters">
              <label class="rmp__search">
                <Search class="rmp__i" aria-hidden="true" />
                <input v-model="query" type="search" :placeholder="$t('Search roles and fields…')"
                       :aria-label="$t('Search roles and fields…')" />
              </label>
              <div class="rmp__cats" role="group" :aria-label="$t('Category')">
                <button type="button" class="rmp__cat" :aria-pressed="!category" @click="category = ''">{{ $t('All') }}</button>
                <button v-for="c in categories" :key="c" type="button" class="rmp__cat" :aria-pressed="category === c"
                        @click="category = c"><span class="rmp__data">{{ c }}</span></button>
              </div>
            </div>
            <p v-if="loadingCatalogue" class="rmp__muted"><LoaderCircle class="rmp__i rmp__spin" /> {{ $t('Loading the catalogue…') }}</p>
            <p v-else-if="!filtered.length" class="rmp__muted">
              {{ $t('Nothing in the catalogue matches. Try "Describe your own role" instead.') }}
            </p>
            <ul v-else class="rmp__grid">
              <li v-for="(spec, i) in filtered" :key="spec.id" :style="{ '--i': i }">
                <button type="button" class="rmp__spec" :disabled="busy" @click="openPreview(spec.id)">
                  <span class="rmp__speccat rmp__data">{{ spec.category }}</span>
                  <span class="rmp__spectitle rmp__data">{{ spec.title }}</span>
                  <span class="rmp__specsum rmp__data">{{ spec.summary }}</span>
                  <span class="rmp__specnums">
                    <span>{{ $t('{v0} stages', { v0: spec.stage_count }) }}</span>
                    <span>{{ $t('{v0} courses', { v0: spec.course_count }) }}</span>
                    <span>{{ $t('{v0} labs', { v0: spec.lab_count }) }}</span>
                    <span v-if="spec.runbook_count">{{ $t('{v0} runbooks', { v0: spec.runbook_count }) }}</span>
                  </span>
                  <span class="rmp__specgo">{{ $t('Preview the roadmap') }} <ChevronRight class="rmp__i sfs-flip" aria-hidden="true" /></span>
                </button>
              </li>
            </ul>
          </div>

          <form v-else class="rmp__custom" role="tabpanel" @submit.prevent="createCustom">
            <label class="rmp__field rmp__field--wide">
              <span>{{ $t('Job role, field or specialization') }}</span>
              <input v-model="form.role" class="rmp__input" maxlength="120" required
                     :placeholder="$t('e.g. Cloud Security Engineer')" />
            </label>
            <label class="rmp__field">
              <span>{{ $t('Level') }}</span>
              <select v-model="form.level" class="rmp__input">
                <option value="beginner">{{ $t('Beginner') }}</option>
                <option value="intermediate">{{ $t('Intermediate') }}</option>
                <option value="advanced">{{ $t('Advanced') }}</option>
              </select>
            </label>
            <label class="rmp__field">
              <span>{{ $t('Hours a week') }}</span>
              <input v-model.number="form.hours" type="number" min="1" max="60" class="rmp__input" />
            </label>
            <label class="rmp__field rmp__field--wide">
              <span>{{ $t('Your goal (optional)') }}</span>
              <textarea v-model="form.goal" rows="3" maxlength="600" class="rmp__input"
                        :placeholder="$t('e.g. Move from IT support into cloud security within a year')" />
            </label>
            <label class="rmp__check rmp__field--wide">
              <input v-model="form.useAi" type="checkbox" />
              <Sparkles class="rmp__i" aria-hidden="true" /> {{ $t('Generate with AI') }}
              <span class="rmp__muted rmp__small">{{ $t('The AI researches the role and arranges the site\'s courses, labs and runbooks around it. Without it, the closest catalogue roadmap is used.') }}</span>
            </label>
            <div class="rmp__field--wide">
              <button type="submit" class="rmp__btn rmp__btn--primary" :disabled="busy || !form.role.trim()">
                <Rocket class="rmp__i" aria-hidden="true" /> {{ $t('Build my roadmap') }}
              </button>
            </div>
          </form>
        </section>
      </main>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, defineAsyncComponent, nextTick, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import {
  Box, ChevronRight, Circle, CircleCheck, CircleDot, Clock, Compass, Layers, LoaderCircle, LogIn,
  MapPinned, Pause, Pencil, Play, Plus, Rocket, Search, Sparkles, Target, Trash2, UserPlus, Waypoints, X,
} from 'lucide-vue-next';
import { useAuthStore } from '@/store/auth';
import { useI18n } from '@/i18n/runtime';
import { roadmapService, RoadmapError } from '@/services/roadmap.service';
import { hasWebGL } from '@/stage3d/loader';
import {
  KINDS, filterCatalogue, findNode, nextNode, progressStats, statusOf, summaryPercent, withStatus,
  type NodeKind, type NodeStatus, type RoadmapDoc, type RoadmapSummary, type Specialization,
} from '@/utils/roadmapLayout';
import RoadmapMap2D from '@/components/roadmap/RoadmapMap2D.vue';
import RoadmapNodeCard from '@/components/roadmap/RoadmapNodeCard.vue';
import RoadmapRolePanel from '@/components/roadmap/RoadmapRolePanel.vue';

// Its own chunk: three.js arrives only when somebody opens 3D (rule 47).
const RoadmapMap3D = defineAsyncComponent(() => import('@/components/roadmap/RoadmapMap3D.vue'));

const auth = useAuthStore();
const route = useRoute();
const router = useRouter();
const { t } = useI18n();

const signedIn = computed(() => !!auth.isAuthenticated && !!auth.user?.id);
const userId = computed(() => String(auth.user?.id || ''));

const motion = typeof matchMedia === 'undefined' || !matchMedia('(prefers-reduced-motion: reduce)').matches;
const webgl = hasWebGL();

/* ------------------------------------------------------------ state */

const mine = ref<RoadmapSummary[]>([]);
const loadingMine = ref(false);
const specs = ref<Specialization[]>([]);
const categoryList = ref<string[]>([]);
const loadingCatalogue = ref(false);
const serviceKind = ref<'' | 'unavailable' | 'unconfigured' | 'network'>('');

const doc = ref<RoadmapDoc | null>(null);
const preview = ref(false);
const loadingDoc = ref(false);
const docMissing = ref(false);

const selectedId = ref<string | null>(null);
const focusStageId = ref<string | null>(null);
const mode = ref<'2d' | '3d'>(webgl ? '3d' : '2d');
const fallbackNote = ref('');
const touring = ref(false);
const map3d = ref<any>(null);
const map2d = ref<any>(null);

const tab = ref<'catalogue' | 'custom'>('catalogue');
const query = ref('');
const category = ref('');
const form = reactive({ role: '', level: 'beginner' as 'beginner' | 'intermediate' | 'advanced', hours: 6, goal: '', useAi: true, specId: '' });

const busy = ref(false);
const saving = ref(false);
const creating = ref(false);
const creatingAi = ref(false);
const creatingStep = ref(0);
const elapsed = ref(0);
let creatingTimer: ReturnType<typeof setInterval> | null = null;

const renamingId = ref('');
const renameText = ref('');
const renameInput = ref<HTMLInputElement[] | HTMLInputElement | null>(null);
const confirmDelete = ref('');
const notice = ref<{ kind: 'ok' | 'error'; text: string } | null>(null);

/* ------------------------------------------------------------ derived */

const categories = computed(() => categoryList.value.length
  ? categoryList.value
  : [...new Set(specs.value.map(s => s.category).filter(Boolean))].sort());
const filtered = computed(() => filterCatalogue(specs.value, query.value, category.value));
const stats = computed(() => (doc.value ? progressStats(doc.value) : progressStats({ stages: [], progress: {} } as any)));
const next = computed(() => (doc.value ? nextNode(doc.value) : null));
const selected = computed(() => (doc.value && selectedId.value ? findNode(doc.value, selectedId.value) : null));
const legendKinds = computed<NodeKind[]>(() => KINDS.filter(k => stats.value.byKind[k] > 0));

const serviceState = computed(() => {
  switch (serviceKind.value) {
    case 'unavailable': return {
      title: t('The Roadmap Provider is not available yet'),
      text: t('It is being switched on. Please check back soon.'),
    };
    case 'unconfigured': return {
      title: t('The roadmap service is not set up yet'),
      text: t('The server is missing its configuration. Please try again later.'),
    };
    case 'network': return {
      title: t('The roadmap service could not be reached'),
      text: t('Check your connection and try again. The first visit of the day can take up to 20 seconds.'),
    };
    default: return null;
  }
});

const creatingSteps = computed(() => [
  t('Reading the role'),
  t('Matching courses, lessons and labs'),
  t('Arranging the stages'),
  t('Drawing your map'),
]);

function kindLabel(kind: NodeKind): string {
  switch (kind) {
    case 'course': return t('Course');
    case 'lesson': return t('Lesson');
    case 'lab': return t('Lab');
    case 'runbook': return t('Runbook');
    default: return t('Topic');
  }
}
function levelLabel(level: string): string {
  switch (level) {
    case 'beginner': return t('Beginner');
    case 'intermediate': return t('Intermediate');
    case 'advanced': return t('Advanced');
    default: return level;
  }
}
function stagePct(stageId: string): string {
  const s = stats.value.stages.find(x => x.id === stageId);
  return s && s.total ? `${s.done}/${s.total}` : '';
}

/* ------------------------------------------------------------ errors */

function explain(e: unknown): string {
  if (e instanceof RoadmapError) {
    if (e.kind === 'unconfigured') return t('The roadmap service is not set up yet');
    if (e.kind === 'network') return t('The roadmap service could not be reached');
    if (e.kind === 'unavailable') return t('The Roadmap Provider is not available yet');
    if (e.message) return e.message;
  }
  return t('Something went wrong. Please try again.');
}

function serviceFailure(e: unknown): boolean {
  if (e instanceof RoadmapError && (e.kind === 'unavailable' || e.kind === 'unconfigured' || e.kind === 'network')) {
    serviceKind.value = e.kind;
    return true;
  }
  return false;
}

/* ------------------------------------------------------------ loading */

async function loadMine() {
  if (!signedIn.value) return;
  loadingMine.value = true;
  try {
    mine.value = await roadmapService.mine(userId.value);
  } catch (e) {
    if (!serviceFailure(e)) notice.value = { kind: 'error', text: explain(e) };
  } finally {
    loadingMine.value = false;
  }
}

async function loadCatalogue() {
  if (!signedIn.value || specs.value.length) return;
  loadingCatalogue.value = true;
  try {
    const c = await roadmapService.catalogue(userId.value);
    specs.value = c.specializations;
    categoryList.value = c.categories;
  } catch (e) {
    if (!serviceFailure(e)) notice.value = { kind: 'error', text: explain(e) };
  } finally {
    loadingCatalogue.value = false;
  }
}

async function openRoadmap(id: string) {
  if (!signedIn.value) return;
  if (doc.value?.id === id && !preview.value) return;
  stopTour();
  loadingDoc.value = true;
  docMissing.value = false;
  preview.value = false;
  selectedId.value = null;
  focusStageId.value = null;
  try {
    doc.value = await roadmapService.get(userId.value, id);
  } catch (e) {
    doc.value = null;
    if (e instanceof RoadmapError && e.kind === 'not_found') docMissing.value = true;
    else if (!serviceFailure(e)) notice.value = { kind: 'error', text: explain(e) };
  } finally {
    loadingDoc.value = false;
  }
}

async function boot() {
  serviceKind.value = '';
  notice.value = null;
  await Promise.all([loadMine(), loadCatalogue()]);
  const id = route.params.roadmapId;
  if (typeof id === 'string' && id) await openRoadmap(id);
}

/* ------------------------------------------------------------ catalogue → preview */

async function openPreview(specId: string) {
  busy.value = true;
  stopTour();
  try {
    const template = await roadmapService.template(userId.value, specId);
    doc.value = template;
    preview.value = true;
    form.specId = specId;
    if (['beginner', 'intermediate', 'advanced'].includes(template.level)) form.level = template.level as any;
    if (template.hours_per_week) form.hours = template.hours_per_week;
    selectedId.value = null;
    focusStageId.value = null;
    await nextTick();
    window.scrollTo?.({ top: 0, behavior: motion ? 'smooth' : 'auto' });
  } catch (e) {
    if (!serviceFailure(e)) notice.value = { kind: 'error', text: explain(e) };
  } finally {
    busy.value = false;
  }
}
function closePreview() {
  stopTour();
  doc.value = null;
  preview.value = false;
  selectedId.value = null;
}
function startNew() {
  stopTour();
  doc.value = null;
  preview.value = false;
  docMissing.value = false;
  selectedId.value = null;
  if (route.params.roadmapId) router.push('/roadmaps');
}

/* ------------------------------------------------------------ create */

function beginCreating(ai: boolean) {
  creating.value = true;
  creatingAi.value = ai;
  creatingStep.value = 0;
  elapsed.value = 0;
  const started = Date.now();
  creatingTimer = setInterval(() => {
    elapsed.value = Math.round((Date.now() - started) / 1000);
    // The steps are paced, not reported - the server answers once. They stop
    // on the last one rather than pretending to finish before it has.
    creatingStep.value = Math.min(creatingSteps.value.length - 1, Math.floor(elapsed.value / (ai ? 6 : 1.5)));
  }, 500);
}
function endCreating() {
  creating.value = false;
  if (creatingTimer) clearInterval(creatingTimer);
  creatingTimer = null;
}

async function create(body: Parameters<typeof roadmapService.create>[1]) {
  if (busy.value) return;
  busy.value = true;
  beginCreating(!!body.use_ai);
  try {
    const made = await roadmapService.create(userId.value, body);
    preview.value = false;
    doc.value = made;
    selectedId.value = null;
    notice.value = { kind: 'ok', text: t('Your roadmap is ready.') };
    await loadMine();
    if (made.id) router.push(`/roadmaps/${encodeURIComponent(made.id)}`);
  } catch (e) {
    if (!serviceFailure(e)) notice.value = { kind: 'error', text: explain(e) };
  } finally {
    endCreating();
    busy.value = false;
  }
}
function createFromPreview() {
  create({
    specialization_id: form.specId, level: form.level,
    hours_per_week: clampHours(form.hours), use_ai: form.useAi,
  });
}
function createCustom() {
  const role = form.role.trim();
  if (!role) return;
  create({
    role, level: form.level, hours_per_week: clampHours(form.hours),
    goal: form.goal.trim() || undefined, use_ai: form.useAi,
  });
}
const clampHours = (h: number) => Math.min(60, Math.max(1, Math.round(Number(h) || 6)));

/* ------------------------------------------------------------ edit */

function beginRename(item: RoadmapSummary) {
  confirmDelete.value = '';
  renamingId.value = item.id;
  renameText.value = item.title;
  nextTick(() => {
    const el = Array.isArray(renameInput.value) ? renameInput.value[0] : renameInput.value;
    el?.focus(); el?.select();
  });
}
async function saveRename(id: string) {
  const title = renameText.value.trim();
  if (!title) return;
  busy.value = true;
  try {
    const updated = await roadmapService.update(userId.value, id, { title });
    mine.value = mine.value.map(m => (m.id === id ? { ...m, title: updated.title || title } : m));
    if (doc.value?.id === id) doc.value = { ...doc.value, title: updated.title || title };
    renamingId.value = '';
  } catch (e) {
    notice.value = { kind: 'error', text: explain(e) };
  } finally {
    busy.value = false;
  }
}
async function remove(id: string) {
  busy.value = true;
  try {
    await roadmapService.remove(userId.value, id);
    mine.value = mine.value.filter(m => m.id !== id);
    confirmDelete.value = '';
    if (doc.value?.id === id) {
      doc.value = null;
      router.push('/roadmaps');
    }
    notice.value = { kind: 'ok', text: t('Roadmap deleted.') };
  } catch (e) {
    notice.value = { kind: 'error', text: explain(e) };
  } finally {
    busy.value = false;
  }
}

/**
 * One step's mark, optimistically. The PATCH names only THAT node, with ''
 * for a cleared mark - an omitted key upstream means "leave it alone".
 */
async function setStatus(status: NodeStatus) {
  const current = doc.value;
  const id = selectedId.value;
  if (!current || !id || preview.value) return;
  const before = current.progress;
  doc.value = { ...current, progress: withStatus(before, id, status) };
  saving.value = true;
  try {
    const updated = await roadmapService.update(userId.value, current.id, { progress: { [id]: status } });
    if (doc.value?.id === updated.id) doc.value = { ...doc.value, progress: updated.progress };
    const s = progressStats(doc.value!);
    mine.value = mine.value.map(m => (m.id === current.id ? { ...m, done_count: s.done, node_count: s.total } : m));
  } catch (e) {
    if (doc.value?.id === current.id) doc.value = { ...doc.value, progress: before };
    notice.value = { kind: 'error', text: explain(e) };
  } finally {
    saving.value = false;
  }
}

/* ------------------------------------------------------------ map */

function select(id: string) {
  selectedId.value = id;
  const found = doc.value ? findNode(doc.value, id) : null;
  if (found) focusStageId.value = found.stage.id;
  if (mode.value === '2d') nextTick(() => map2d.value?.reveal?.(id));
}
function onMapSelect(id: string | null) {
  if (id) select(id);
}
function setMode(m: '2d' | '3d') {
  stopTour();
  if (m === '3d' && !webgl) return;
  fallbackNote.value = '';
  mode.value = m;
}
function on3dFailed() {
  mode.value = '2d';
  fallbackNote.value = t('The 3D map could not start on this device, so it is shown in 2D.');
}

let tour2d: ReturnType<typeof setInterval> | null = null;
function playTour() {
  if (!doc.value?.stages.length) return;
  touring.value = true;
  selectedId.value = null;
  if (mode.value === '3d') {
    map3d.value?.playTour?.();
    return;
  }
  // In 2D the tour walks the stage highlight along the map.
  let i = 0;
  focusStageId.value = doc.value.stages[0].id;
  tour2d = setInterval(() => {
    i++;
    const stages = doc.value?.stages || [];
    if (i >= stages.length) { stopTour(); return; }
    focusStageId.value = stages[i].id;
  }, motion ? 2600 : 3600);
}
function stopTour() {
  if (tour2d) clearInterval(tour2d);
  tour2d = null;
  if (touring.value && mode.value === '3d') map3d.value?.stopTour?.();
  touring.value = false;
}

/* ------------------------------------------------------------ lifecycle */

watch(() => route.params.roadmapId, id => {
  if (typeof id === 'string' && id) openRoadmap(id);
  else if (!preview.value) { doc.value = null; docMissing.value = false; }
});
watch(signedIn, now => { if (now) boot(); });

onMounted(() => { if (signedIn.value) boot(); });
onBeforeUnmount(() => { stopTour(); endCreating(); });
</script>

<style scoped>
.rmp {
  display: grid; gap: 1.25rem;
  padding: clamp(0.75rem, 2.5vw, 2rem);
  max-width: 120rem; margin-inline: auto;
  color: var(--sfs-text, #f1f5f9);
  min-width: 0;
}
.rmp__data { unicode-bidi: plaintext; overflow-wrap: anywhere; }
.rmp__head { display: flex; flex-wrap: wrap; align-items: flex-end; justify-content: space-between; gap: 1rem; }
.rmp__headtext { min-width: 0; flex: 1 1 28rem; }
.rmp__title {
  margin: 0; display: flex; align-items: center; gap: 0.6rem;
  font-size: clamp(1.6rem, 3vw, 2.3rem); text-shadow: var(--sfs-title-glow, none);
}
.rmp__ti { width: 1.1em; height: 1.1em; color: var(--sfs-accent-text, #a5b4fc); flex: none; }
.rmp__lead { margin: 0.4rem 0 0; color: var(--sfs-text-muted, #cbd5e1); max-width: 62rem; line-height: 1.55; }
.rmp__muted { color: var(--sfs-text-muted, #94a3b8); margin: 0; display: flex; align-items: center; gap: 0.4rem; flex-wrap: wrap; }
.rmp__small { font-size: 0.82rem; }
.rmp__pad { padding: 2rem 0; }
.rmp__i { width: 1.05em; height: 1.05em; flex: none; vertical-align: -0.15em; }
.rmp__i--xs { width: 0.85em; height: 0.85em; }
@media (prefers-reduced-motion: no-preference) {
  .rmp__spin { animation: rmp-spin 1s linear infinite; }
}
@keyframes rmp-spin { to { transform: rotate(360deg); } }

/* Buttons */
.rmp__btn {
  display: inline-flex; align-items: center; justify-content: center; gap: 0.45rem;
  min-height: 2.6rem; padding: 0 1rem; border-radius: var(--sfs-radius-pill, 999px);
  border: 1px solid var(--sfs-border-strong, rgba(255, 255, 255, 0.24));
  background: rgb(var(--sfs-tint-rgb, 255 255 255) / 0.06);
  color: var(--sfs-text, #f1f5f9); font: inherit; font-weight: 600; font-size: 0.92rem;
  text-decoration: none; cursor: pointer; white-space: nowrap;
}
.rmp__btn:hover { border-color: var(--sfs-accent, #667eea); }
.rmp__btn:disabled { opacity: 0.55; cursor: not-allowed; }
.rmp__btn--primary { background: var(--sfs-accent, #667eea); border-color: transparent; color: var(--sfs-on-accent, #fff); }
.rmp__btn--primary:hover { background: var(--sfs-accent-strong, #5a67d8); }
.rmp__btn--danger { background: var(--sfs-danger, #f87171); border-color: transparent; color: var(--sfs-on-danger, #450a0a); }
.rmp__btn--sm { min-height: 2.2rem; padding: 0 0.75rem; font-size: 0.85rem; }
.rmp__btn:focus-visible, .rmp__icon:focus-visible, .rmp__spec:focus-visible, .rmp__cat:focus-visible,
.rmp__step:focus-visible, .rmp__seg button:focus-visible, .rmp__tabs button:focus-visible, .rmp__minelink:focus-visible {
  outline: 2px solid var(--sfs-focus, #a5b4fc); outline-offset: 2px;
}
.rmp__icon {
  display: inline-grid; place-items: center; width: 2.2rem; height: 2.2rem; flex: none;
  border-radius: 50%; border: 1px solid transparent; background: transparent;
  color: var(--sfs-text-muted, #94a3b8); cursor: pointer;
}
.rmp__icon svg { width: 1rem; height: 1rem; }
.rmp__icon:hover { border-color: var(--sfs-border, rgba(255, 255, 255, 0.18)); color: var(--sfs-text, #f1f5f9); }
.rmp__icon.is-danger:hover { color: var(--sfs-danger-text, #f87171); }

/* Gate / states */
.rmp__gate {
  display: grid; justify-items: center; text-align: center; gap: 0.6rem;
  padding: clamp(1.5rem, 5vw, 3.5rem) 1.25rem;
  border-radius: var(--sfs-radius-xl, 20px);
  background: rgb(var(--sfs-tint-rgb, 255 255 255) / 0.06);
  border: 1px solid var(--sfs-border, rgba(255, 255, 255, 0.14));
}
.rmp__gate h2 { margin: 0; font-size: clamp(1.2rem, 2.5vw, 1.6rem); }
.rmp__gate p { margin: 0; max-width: 36rem; color: var(--sfs-text-muted, #cbd5e1); line-height: 1.55; }
.rmp__gatei { width: 3rem; height: 3rem; color: var(--sfs-accent-text, #a5b4fc); }
.rmp__gatebtns { display: flex; flex-wrap: wrap; gap: 0.6rem; justify-content: center; margin-top: 0.4rem; }

/* Layout: the list beside the main area on a wide screen, above it on a phone. */
.rmp__layout { display: grid; gap: 1.25rem; grid-template-columns: minmax(0, 1fr); align-items: start; min-width: 0; }
@media (min-width: 1024px) {
  .rmp__layout { grid-template-columns: minmax(15rem, 19rem) minmax(0, 1fr); }
  .rmp__mine { position: sticky; top: 1rem; max-height: calc(100vh - 2rem); overflow-y: auto; }
}
.rmp__main { display: grid; gap: 1rem; min-width: 0; }

.rmp__mine {
  display: grid; gap: 0.6rem; align-content: start; min-width: 0;
  padding: 1rem; border-radius: var(--sfs-radius-lg, 16px);
  background: rgb(var(--sfs-tint-rgb, 255 255 255) / 0.06);
  border: 1px solid var(--sfs-border, rgba(255, 255, 255, 0.14));
}
.rmp__minehead { display: flex; align-items: center; gap: 0.5rem; }
.rmp__minehead h2 { margin: 0; font-size: 1rem; }
.rmp__count {
  min-width: 1.6rem; padding: 0 0.45rem; text-align: center; border-radius: 999px; font-size: 0.75rem; font-weight: 700;
  background: var(--sfs-accent, #667eea); color: var(--sfs-on-accent, #fff);
}
.rmp__minelist { list-style: none; margin: 0; padding: 0; display: grid; gap: 0.45rem; }
.rmp__mineitem {
  display: flex; flex-wrap: wrap; align-items: flex-start; gap: 0.25rem;
  padding: 0.45rem; border-radius: var(--sfs-radius, 12px); border: 1px solid transparent;
}
.rmp__mineitem.is-current { border-color: var(--sfs-border-accent, rgba(102, 126, 234, 0.45)); background: rgb(var(--sfs-accent-rgb, 102 126 234) / 0.1); }
.rmp__minelink { flex: 1 1 10rem; min-width: 0; display: grid; gap: 0.25rem; padding: 0.25rem; border-radius: 8px; color: inherit; text-decoration: none; }
.rmp__minetitle { font-weight: 600; font-size: 0.92rem; }
.rmp__minemeta { font-size: 0.78rem; color: var(--sfs-text-muted, #94a3b8); display: flex; align-items: center; gap: 0.25rem; flex-wrap: wrap; }
.rmp__meter { display: block; height: 0.35rem; border-radius: 999px; background: rgb(var(--sfs-line-rgb, 255 255 255) / 0.12); overflow: hidden; }
.rmp__meter span { display: block; height: 100%; background: var(--sfs-success, #34d399); border-radius: inherit; }
.rmp__mineacts { display: flex; }
.rmp__confirm { flex-basis: 100%; display: flex; flex-wrap: wrap; align-items: center; gap: 0.4rem; font-size: 0.82rem; padding: 0.3rem; }
.rmp__rename { flex-basis: 100%; display: flex; flex-wrap: wrap; gap: 0.35rem; }
.rmp__rename .rmp__input { flex: 1 1 100%; }

.rmp__input {
  min-height: 2.6rem; padding: 0.45rem 0.75rem; border-radius: 10px; font: inherit; font-size: 0.95rem;
  border: 1px solid var(--sfs-field-border, rgba(255, 255, 255, 0.2));
  background: var(--sfs-field, rgba(255, 255, 255, 0.06)); color: var(--sfs-field-text, #f1f5f9);
  width: 100%; min-width: 0;
}
textarea.rmp__input { resize: vertical; }

.rmp__notice {
  display: flex; align-items: center; justify-content: space-between; gap: 0.6rem; margin: 0;
  padding: 0.5rem 0.6rem 0.5rem 1rem; border-radius: var(--sfs-radius, 12px);
  background: rgb(var(--sfs-success-rgb, 52 211 153) / 0.14); color: var(--sfs-success-text, #34d399);
}
.rmp__notice.is-error { background: rgb(var(--sfs-danger-rgb, 248 113 113) / 0.14); color: var(--sfs-danger-text, #f87171); }

/* Creating */
.rmp__creating {
  display: grid; justify-items: center; gap: 0.8rem; text-align: center;
  padding: 2.5rem 1rem; border-radius: var(--sfs-radius-xl, 20px);
  background: rgb(var(--sfs-tint-rgb, 255 255 255) / 0.06); border: 1px solid var(--sfs-border, rgba(255, 255, 255, 0.14));
}
.rmp__creating h2 { margin: 0; font-size: 1.25rem; }
.rmp__orbit { position: relative; width: 4.5rem; height: 4.5rem; }
.rmp__orbit span {
  position: absolute; inset: 0; border-radius: 50%;
  border: 3px solid transparent; border-top-color: var(--sfs-accent, #667eea);
}
.rmp__orbit span:nth-child(2) { inset: 0.6rem; border-top-color: var(--sfs-accent-2, #764ba2); }
.rmp__orbit span:nth-child(3) { inset: 1.2rem; border-top-color: var(--sfs-success, #34d399); }
@media (prefers-reduced-motion: no-preference) {
  .rmp__orbit span { animation: rmp-spin 1.4s linear infinite; }
  .rmp__orbit span:nth-child(2) { animation-duration: 2s; animation-direction: reverse; }
  .rmp__orbit span:nth-child(3) { animation-duration: 1s; }
}
.rmp__steps { list-style: none; margin: 0; padding: 0; display: grid; gap: 0.3rem; color: var(--sfs-text-faint, #64748b); }
.rmp__steps li.is-done { color: var(--sfs-success-text, #34d399); }
.rmp__steps li.is-now { color: var(--sfs-text, #f1f5f9); font-weight: 600; }

/* The viewer */
.rmp__view { display: grid; gap: 0.9rem; min-width: 0; }
.rmp__previewbar {
  display: grid; gap: 0.7rem; padding: 0.9rem 1rem; border-radius: var(--sfs-radius-lg, 16px);
  background: rgb(var(--sfs-accent-rgb, 102 126 234) / 0.12); border: 1px solid var(--sfs-border-accent, rgba(102, 126, 234, 0.45));
}
.rmp__previewtext { display: grid; gap: 0.15rem; }
.rmp__eyebrow { font-size: 0.72rem; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; color: var(--sfs-accent-text, #a5b4fc); }
.rmp__makeit { display: flex; flex-wrap: wrap; align-items: flex-end; gap: 0.6rem; }
.rmp__field { display: grid; gap: 0.3rem; font-size: 0.82rem; color: var(--sfs-text-muted, #cbd5e1); min-width: 0; flex: 1 1 10rem; }
.rmp__field--narrow { flex: 0 1 8rem; }
.rmp__check { display: inline-flex; align-items: center; flex-wrap: wrap; gap: 0.4rem; font-size: 0.9rem; min-height: 2.6rem; cursor: pointer; }
.rmp__check input { width: 1.1rem; height: 1.1rem; accent-color: var(--sfs-accent, #667eea); }

.rmp__docinfo { display: flex; flex-wrap: wrap; gap: 1rem; align-items: center; justify-content: space-between; }
.rmp__docmain { min-width: 0; flex: 1 1 20rem; display: grid; gap: 0.5rem; }
.rmp__doctitle { margin: 0; font-size: clamp(1.25rem, 2.4vw, 1.75rem); }
.rmp__chips { list-style: none; margin: 0; padding: 0; display: flex; flex-wrap: wrap; gap: 0.4rem; }
.rmp__chip {
  display: inline-flex; align-items: center; gap: 0.3rem; padding: 0.2rem 0.65rem; border-radius: 999px;
  font-size: 0.8rem; background: rgb(var(--sfs-tint-rgb, 255 255 255) / 0.08);
  border: 1px solid var(--sfs-border, rgba(255, 255, 255, 0.14)); color: var(--sfs-text, #f1f5f9);
}
.rmp__chip.is-ai { border-color: var(--sfs-border-accent, rgba(102, 126, 234, 0.45)); color: var(--sfs-accent-text, #a5b4fc); }
.rmp__progress { display: flex; align-items: center; gap: 0.8rem; }
/* A conic ring, pinned LTR: a dial is a place and must not mirror. The mask is
   on ::before so the number in the middle is not cut out with it. */
.rmp__ring {
  --p: 0; position: relative; width: 4rem; height: 4rem; flex: none; direction: ltr;
  display: grid; place-items: center; font-weight: 700; font-size: 0.95rem;
}
.rmp__ring::before {
  content: ''; position: absolute; inset: 0; border-radius: 50%;
  background: conic-gradient(var(--sfs-success, #34d399) calc(var(--p) * 1%), rgb(var(--sfs-line-rgb, 255 255 255) / 0.14) 0);
  -webkit-mask: radial-gradient(circle, transparent 58%, #000 60%);
  mask: radial-gradient(circle, transparent 58%, #000 60%);
}
.rmp__ring span { position: relative; }
.rmp__progtext { display: grid; gap: 0.15rem; font-size: 0.9rem; }

.rmp__next {
  display: flex; flex-wrap: wrap; align-items: center; gap: 0.5rem; padding: 0.6rem 0.9rem;
  border-radius: var(--sfs-radius, 12px); background: rgb(var(--sfs-warning-rgb, 251 191 36) / 0.12);
  border: 1px solid rgb(var(--sfs-warning-rgb, 251 191 36) / 0.35);
}
.rmp__next > span { flex: 1 1 12rem; min-width: 0; }

.rmp__toolbar { display: flex; flex-wrap: wrap; align-items: center; gap: 0.6rem; }
.rmp__seg { display: inline-flex; padding: 0.2rem; border-radius: 999px; background: rgb(var(--sfs-tint-rgb, 255 255 255) / 0.08); border: 1px solid var(--sfs-border, rgba(255, 255, 255, 0.14)); }
.rmp__seg button {
  display: inline-flex; align-items: center; gap: 0.35rem; min-height: 2.2rem; padding: 0 0.9rem;
  border-radius: 999px; border: 0; background: transparent; color: var(--sfs-text-muted, #cbd5e1);
  font: inherit; font-weight: 700; cursor: pointer;
}
.rmp__seg button[aria-pressed='true'] { background: var(--sfs-accent, #667eea); color: var(--sfs-on-accent, #fff); }
.rmp__seg button:disabled { opacity: 0.45; cursor: not-allowed; }
.rmp__legend { list-style: none; margin: 0; padding: 0; display: flex; flex-wrap: wrap; gap: 0.25rem 0.8rem; font-size: 0.8rem; color: var(--sfs-text-muted, #cbd5e1); margin-inline-start: auto; }
.rmp__legend li { display: inline-flex; align-items: center; gap: 0.3rem; }
.rmp__legend li.is-course svg { fill: var(--sfs-accent, #667eea); }
.rmp__legend li.is-lesson svg { fill: var(--sfs-accent-2, #764ba2); }
.rmp__legend li.is-lab svg { fill: var(--sfs-accent-3, #f093fb); }
.rmp__legend li.is-runbook svg { fill: var(--sfs-info, #38bdf8); }
.rmp__legend li.is-topic svg { fill: var(--sfs-text-muted, #94a3b8); }

.rmp__stagewrap { display: grid; gap: 1rem; grid-template-columns: minmax(0, 1fr); min-width: 0; }
/* The side column joins the map only where the map can still be a wide one:
   below this the map takes the whole width and the stage list and the role
   follow it, so a 6-stage map is not squeezed into a 540 px column. */
@media (min-width: 1680px) { .rmp__stagewrap { grid-template-columns: minmax(0, 1fr) minmax(20rem, 26rem); } }
@media (min-width: 900px) and (max-width: 1679px) { .rmp__side { grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); align-items: start; } }
.rmp__mapcol { display: grid; gap: 0.9rem; min-width: 0; align-content: start; }
.rmp__map2d {
  border-radius: var(--sfs-radius-lg, 16px);
  background: rgb(var(--sfs-sink-rgb, 0 0 0) / 0.22);
  border: 1px solid var(--sfs-border, rgba(255, 255, 255, 0.14));
  max-height: 78vh; overflow-y: auto;
}
.rmp__side { display: grid; gap: 1rem; align-content: start; min-width: 0; }

.rmp__stages {
  display: grid; gap: 0.4rem; padding: 1rem; border-radius: var(--sfs-radius-lg, 16px);
  background: rgb(var(--sfs-tint-rgb, 255 255 255) / 0.06); border: 1px solid var(--sfs-border, rgba(255, 255, 255, 0.14));
}
.rmp__stages h3 { margin: 0 0 0.2rem; font-size: 1.05rem; }
.rmp__stage { border-radius: 10px; }
.rmp__stage summary {
  display: flex; align-items: center; gap: 0.5rem; padding: 0.45rem 0.4rem; cursor: pointer;
  border-radius: 10px; list-style: none;
}
.rmp__stage summary::-webkit-details-marker { display: none; }
.rmp__stage summary:hover { background: rgb(var(--sfs-tint-rgb, 255 255 255) / 0.06); }
.rmp__stagenum {
  flex: none; display: grid; place-items: center; width: 1.6rem; height: 1.6rem; border-radius: 50%;
  font-size: 0.78rem; font-weight: 700; background: var(--sfs-accent, #667eea); color: var(--sfs-on-accent, #fff);
}
.rmp__stagename { flex: 1; min-width: 0; font-weight: 600; font-size: 0.92rem; }
.rmp__stagepct { font-size: 0.75rem; color: var(--sfs-text-muted, #94a3b8); direction: ltr; unicode-bidi: isolate; }
.rmp__stagesum { margin: 0.1rem 0.4rem 0.4rem; font-size: 0.82rem; color: var(--sfs-text-muted, #cbd5e1); }
.rmp__steplist { list-style: none; margin: 0 0 0.4rem; padding: 0 0 0 0.4rem; display: grid; gap: 0.15rem; }
.rmp__step {
  display: flex; align-items: center; gap: 0.45rem; width: 100%; padding: 0.35rem 0.45rem;
  border-radius: 8px; border: 1px solid transparent; background: transparent; color: var(--sfs-text, #f1f5f9);
  font: inherit; font-size: 0.85rem; text-align: start; cursor: pointer;
}
.rmp__step:hover { background: rgb(var(--sfs-tint-rgb, 255 255 255) / 0.06); }
.rmp__step[aria-pressed='true'] { border-color: var(--sfs-focus, #a5b4fc); }
.rmp__step .is-done { color: var(--sfs-success-text, #34d399); }
.rmp__step .is-doing { color: var(--sfs-warning-text, #fbbf24); }
.rmp__steptitle { flex: 1; min-width: 0; }
.rmp__stepkind { flex: none; font-size: 0.7rem; color: var(--sfs-text-faint, #94a3b8); }

/* The builder */
.rmp__builder { display: grid; gap: 1rem; min-width: 0; }
.rmp__tabs { display: flex; flex-wrap: wrap; gap: 0.4rem; }
.rmp__tabs button {
  display: inline-flex; align-items: center; gap: 0.4rem; min-height: 2.6rem; padding: 0 1rem;
  border-radius: 999px; border: 1px solid var(--sfs-border, rgba(255, 255, 255, 0.18));
  background: transparent; color: var(--sfs-text-muted, #cbd5e1); font: inherit; font-weight: 600; cursor: pointer;
}
.rmp__tabs button[aria-selected='true'] { background: var(--sfs-accent, #667eea); border-color: transparent; color: var(--sfs-on-accent, #fff); }
.rmp__catalogue { display: grid; gap: 0.9rem; min-width: 0; }
.rmp__filters { display: grid; gap: 0.6rem; }
.rmp__search {
  display: flex; align-items: center; gap: 0.5rem; padding: 0 0.8rem; min-height: 2.75rem; border-radius: 999px;
  border: 1px solid var(--sfs-field-border, rgba(255, 255, 255, 0.2)); background: var(--sfs-field, rgba(255, 255, 255, 0.06));
  max-width: 36rem;
}
.rmp__search input { flex: 1; min-width: 0; border: 0; background: transparent; color: var(--sfs-field-text, #f1f5f9); font: inherit; outline: none; }
.rmp__search:focus-within { border-color: var(--sfs-focus, #a5b4fc); }
.rmp__cats { display: flex; flex-wrap: wrap; gap: 0.35rem; }
.rmp__cat {
  min-height: 2.1rem; padding: 0 0.75rem; border-radius: 999px; font: inherit; font-size: 0.82rem; cursor: pointer;
  border: 1px solid var(--sfs-border, rgba(255, 255, 255, 0.18)); background: transparent; color: var(--sfs-text, #f1f5f9);
}
.rmp__cat[aria-pressed='true'] { background: rgb(var(--sfs-accent-rgb, 102 126 234) / 0.25); border-color: var(--sfs-accent, #667eea); }
.rmp__grid { list-style: none; margin: 0; padding: 0; display: grid; gap: 0.8rem; grid-template-columns: repeat(auto-fill, minmax(min(100%, 17rem), 1fr)); }
.rmp__spec {
  width: 100%; height: 100%; display: grid; align-content: start; gap: 0.4rem; text-align: start;
  padding: 1rem; border-radius: var(--sfs-radius-lg, 16px); cursor: pointer; font: inherit;
  background: rgb(var(--sfs-tint-rgb, 255 255 255) / 0.06); border: 1px solid var(--sfs-border, rgba(255, 255, 255, 0.14));
  color: var(--sfs-text, #f1f5f9);
  transition: border-color var(--sfs-dur-fast, 0.15s), transform var(--sfs-dur-fast, 0.15s);
}
.rmp__spec:hover { border-color: var(--sfs-accent, #667eea); }
.rmp__spec:disabled { cursor: progress; opacity: 0.7; }
@media (prefers-reduced-motion: no-preference) {
  .rmp__spec:hover { transform: translateY(-2px); }
  .rmp__grid > li { animation: rmp-in 0.4s var(--sfs-ease-out, ease-out) both; animation-delay: calc(min(var(--i), 12) * 35ms); }
}
@keyframes rmp-in { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: none; } }
.rmp__speccat { font-size: 0.72rem; font-weight: 700; letter-spacing: 0.06em; text-transform: uppercase; color: var(--sfs-accent-text, #a5b4fc); }
.rmp__spectitle { font-size: 1.05rem; font-weight: 700; }
.rmp__specsum {
  font-size: 0.85rem; color: var(--sfs-text-muted, #cbd5e1); line-height: 1.45;
  display: -webkit-box; -webkit-line-clamp: 3; line-clamp: 3; -webkit-box-orient: vertical; overflow: hidden;
}
.rmp__specnums { display: flex; flex-wrap: wrap; gap: 0.25rem 0.7rem; font-size: 0.76rem; color: var(--sfs-text-faint, #94a3b8); }
.rmp__specgo { display: inline-flex; align-items: center; gap: 0.25rem; font-size: 0.85rem; font-weight: 600; color: var(--sfs-accent-text, #a5b4fc); margin-top: 0.2rem; }
.rmp__custom {
  display: flex; flex-wrap: wrap; gap: 0.9rem; align-items: flex-end;
  padding: 1.1rem; border-radius: var(--sfs-radius-lg, 16px);
  background: rgb(var(--sfs-tint-rgb, 255 255 255) / 0.06); border: 1px solid var(--sfs-border, rgba(255, 255, 255, 0.14));
  max-width: 52rem;
}
.rmp__field--wide { flex-basis: 100%; }
</style>
