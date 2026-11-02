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

    FULL SCREEN: the toolbar, the map and the step card live in ONE element
    (`mapShell`) and that element is what `useFullscreen` puts into full screen
    - native API first, a fixed overlay where the browser refuses. With the
    native API only the full-screen element's subtree is painted, so the step
    card is a CHILD of the shell rather than a sibling or a teleport to <body>;
    it floats over the map while full screen and sits under it otherwise.
  -->
  <div class="rmp">
    <header class="rmp__head">
      <div class="rmp__hero">
        <span class="rmp__badge" aria-hidden="true"><MapPinned /></span>
        <div class="rmp__headtext">
          <h1 class="rmp__title">{{ $t('Roadmap Provider') }}</h1>
          <p class="rmp__lead">
            {{ $t('Pick a field, a specialization or a job role, and get a step-by-step roadmap built from the courses, lessons, labs and runbooks on this site - drawn as a map you can walk in 2D or 3D.') }}
          </p>
        </div>
      </div>
      <button v-if="signedIn && (doc || route.params.roadmapId)" type="button" class="rmp__btn rmp__btn--primary rmp__btn--lg"
              @click="startNew">
        <Plus class="rmp__i" aria-hidden="true" /> {{ $t('New roadmap') }}
      </button>
    </header>

    <!-- Signed out. The guard normally sends them to sign in first; this is
         the page's own answer if a session ends while it is open. -->
    <section v-if="!signedIn" class="rmp__gate">
      <span class="rmp__gatei" aria-hidden="true"><Compass /></span>
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
      <span class="rmp__gatei" aria-hidden="true"><Compass /></span>
      <h2>{{ serviceState.title }}</h2>
      <p>{{ serviceState.text }}</p>
      <button type="button" class="rmp__btn" @click="boot">{{ $t('Try again') }}</button>
    </section>

    <div v-else class="rmp__layout">
      <!-- MY ROADMAPS -->
      <aside class="rmp__mine" :aria-label="$t('My roadmaps')">
        <div class="rmp__minehead">
          <Route class="rmp__i rmp__minei" aria-hidden="true" />
          <h2>{{ $t('My roadmaps') }}</h2>
          <span v-if="mine.length" class="rmp__count">{{ $n(mine.length) }}</span>
        </div>
        <div v-if="loadingMine && !mine.length" class="rmp__skeletons" aria-hidden="true">
          <span v-for="i in 3" :key="i" class="rmp__skel" />
        </div>
        <p v-if="loadingMine && !mine.length" class="rmp__muted rmp__small"><LoaderCircle class="rmp__i rmp__spin" /> {{ $t('Loading your roadmaps…') }}</p>
        <p v-else-if="!mine.length" class="rmp__muted rmp__empty">{{ $t('You have not made a roadmap yet. Choose one from the catalogue to start.') }}</p>
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
                <span class="rmp__minering" :style="{ '--p': summaryPercent(item) ?? 0 }" aria-hidden="true">
                  <span>{{ summaryPercent(item) ?? 0 }}</span>
                </span>
                <span class="rmp__minebody">
                  <span class="rmp__minetitle rmp__data">{{ item.title }}</span>
                  <span class="rmp__minemeta">
                    {{ $t('{v0} of {v1} steps done', { v0: item.done_count, v1: item.node_count }) }}
                    <template v-if="item.source === 'ai'"> · <Sparkles class="rmp__i rmp__i--xs" aria-hidden="true" /> {{ $t('AI') }}</template>
                  </span>
                  <span class="rmp__meter" role="progressbar" :aria-valuenow="summaryPercent(item) ?? 0"
                        aria-valuemin="0" aria-valuemax="100" :aria-label="$t('Progress')">
                    <span :style="{ width: `${summaryPercent(item) ?? 0}%` }" />
                  </span>
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
          <div class="rmp__orbit" aria-hidden="true"><span /><span /><span /><i /></div>
          <h2>{{ creatingAi ? $t('The AI is writing your roadmap…') : $t('Building your roadmap…') }}</h2>
          <ol class="rmp__steps">
            <li v-for="(s, i) in creatingSteps" :key="i" :class="{ 'is-done': i < creatingStep, 'is-now': i === creatingStep }">
              <CircleCheck v-if="i < creatingStep" class="rmp__i" aria-hidden="true" />
              <LoaderCircle v-else-if="i === creatingStep" class="rmp__i rmp__spin" aria-hidden="true" />
              <Circle v-else class="rmp__i" aria-hidden="true" />
              {{ s }}
            </li>
          </ol>
          <p class="rmp__muted rmp__small">{{ $t('{v0} s - this can take up to half a minute.', { v0: elapsed }) }}</p>
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
                <li class="rmp__chip"><Flag class="rmp__i" aria-hidden="true" /> {{ $t('{v0} stages', { v0: doc.stages.length }) }}</li>
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
            <span class="rmp__nexti" aria-hidden="true"><Target /></span>
            <span>{{ $t('Next up:') }} <strong class="rmp__data">{{ next.title }}</strong></span>
            <button type="button" class="rmp__btn rmp__btn--sm" @click="select(next.id)">{{ $t('Show me') }}</button>
          </div>

          <div class="rmp__stagewrap">
            <div ref="mapShell" class="rmp__shell"
                 :class="{ 'is-full': fsActive, 'is-overlay': fsActive && !fsNative, [`is-${mode}`]: true }">
              <div class="rmp__toolbar">
                <div class="rmp__seg" role="group" :aria-label="$t('Map view')">
                  <button type="button" :aria-pressed="mode === '2d'" @click="setMode('2d')">
                    <Waypoints class="rmp__i" aria-hidden="true" /> 2D
                  </button>
                  <button type="button" :aria-pressed="mode === '3d'" :disabled="!webgl" @click="setMode('3d')">
                    <Box class="rmp__i" aria-hidden="true" /> 3D
                  </button>
                </div>
                <button type="button" class="rmp__btn rmp__btn--sm rmp__tourbtn" :aria-pressed="touring"
                        @click="touring ? stopTour() : playTour()">
                  <component :is="touring ? Pause : Play" class="rmp__i" aria-hidden="true" />
                  {{ touring ? $t('Stop the tour') : $t('Play tour') }}
                </button>
                <strong v-if="fsActive" class="rmp__fstitle rmp__data">{{ doc.title }}</strong>
                <ul class="rmp__legend" :aria-label="$t('Legend')">
                  <li v-for="k in legendKinds" :key="k" :class="`is-${k}`">
                    <svg viewBox="-16 -16 32 32" width="18" height="18" aria-hidden="true">
                      <polygon :points="outlinePoints(k, 14)" class="rmp__lshape" />
                      <g transform="translate(-8 -8) scale(0.6667)" class="rmp__licon">
                        <path v-for="(d, di) in KIND_ICON[k]" :key="di" :d="d" />
                      </g>
                    </svg>
                    {{ kindLabel(k) }}
                  </li>
                </ul>
                <button type="button" class="rmp__btn rmp__btn--sm rmp__fsbtn" :aria-pressed="fsActive"
                        :title="fsActive ? $t('Exit full screen') : $t('Full screen')" @click="toggleFs">
                  <component :is="fsActive ? Minimize : Maximize" class="rmp__i" aria-hidden="true" />
                  <span class="rmp__fslabel">{{ fsActive ? $t('Exit full screen') : $t('Full screen') }}</span>
                </button>
                <button v-if="fsActive" type="button" class="rmp__icon rmp__fsexit"
                        :aria-label="$t('Exit full screen')" :title="$t('Exit full screen')" @click="exitFs">
                  <X aria-hidden="true" />
                </button>
              </div>
              <p v-if="!webgl" class="rmp__muted rmp__small rmp__mapnote">{{ $t('3D needs WebGL, which this browser does not offer, so the map is shown in 2D.') }}</p>
              <p v-else-if="fallbackNote" class="rmp__muted rmp__small rmp__mapnote">{{ fallbackNote }}</p>

              <div class="rmp__mapcol">
                <RoadmapMap3D v-if="mode === '3d'" ref="map3d" :doc="doc" :selected-id="selectedId"
                              :animate="motion" @select="onMapSelect" @focus="focusStageId = $event"
                              @tour-end="touring = false" @failed="on3dFailed" />
                <RoadmapMap2D v-else ref="map2d" class="rmp__map2d" :doc="doc" :selected-id="selectedId"
                              :focus-stage-id="focusStageId" :animate="motion" @select="select"
                              @focus="focusStageId = $event" />

                <Transition name="rmp-card">
                  <RoadmapNodeCard v-if="selected" :key="selected.node.id" class="rmp__nodecard" :doc="doc" :node="selected.node"
                                   :stage="selected.stage" :readonly="preview" :busy="saving"
                                   @close="selectedId = null" @select="select" @status="setStatus" />
                </Transition>
              </div>
            </div>

            <div class="rmp__side">
              <!-- Every step, as a list: the keyboard and screen-reader way
                   through the same map, and the readable one on a phone. -->
              <section class="rmp__stages" :aria-label="$t('Stages')">
                <h3>{{ $t('Stages') }}</h3>
                <details v-for="(stage, si) in doc.stages" :key="stage.id" class="rmp__stage"
                         :class="{ 'is-complete': stageDone(stage.id) }"
                         :open="focusStageId === stage.id || (selected?.stage.id === stage.id)">
                  <summary @click="focusStageId = stage.id">
                    <span class="rmp__stagenum" :style="{ '--p': stageRing(stage.id) }">{{ si + 1 }}</span>
                    <span class="rmp__stagename rmp__data">{{ stage.title }}</span>
                    <span class="rmp__stagepct">{{ stagePct(stage.id) }}</span>
                    <ChevronRight class="rmp__i rmp__chev sfs-flip" aria-hidden="true" />
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
                        @click="category = c"><component :is="categoryIcon(c)" class="rmp__i" aria-hidden="true" /><span class="rmp__data">{{ c }}</span></button>
              </div>
            </div>
            <div v-if="loadingCatalogue" class="rmp__grid rmp__grid--skel" aria-hidden="true">
              <span v-for="i in 6" :key="i" class="rmp__skel rmp__skel--card" />
            </div>
            <p v-if="loadingCatalogue" class="rmp__muted"><LoaderCircle class="rmp__i rmp__spin" /> {{ $t('Loading the catalogue…') }}</p>
            <p v-else-if="!filtered.length" class="rmp__muted">
              {{ $t('Nothing in the catalogue matches. Try "Describe your own role" instead.') }}
            </p>
            <ul v-else class="rmp__grid">
              <li v-for="(spec, i) in filtered" :key="spec.id" :style="{ '--i': i }">
                <button type="button" class="rmp__spec" :class="`is-hue${categoryHue(spec.category)}`" :disabled="busy" @click="openPreview(spec.id)">
                  <span class="rmp__spectop">
                    <span class="rmp__specicon" aria-hidden="true"><component :is="categoryIcon(spec.category)" /></span>
                    <span class="rmp__speccat rmp__data">{{ spec.category }}</span>
                  </span>
                  <span class="rmp__spectitle rmp__data">{{ spec.title }}</span>
                  <span class="rmp__specsum rmp__data">{{ spec.summary }}</span>
                  <span class="rmp__specnums">
                    <span><Flag class="rmp__i rmp__i--xs" aria-hidden="true" /> {{ $t('{v0} stages', { v0: spec.stage_count }) }}</span>
                    <span><GraduationCap class="rmp__i rmp__i--xs" aria-hidden="true" /> {{ $t('{v0} courses', { v0: spec.course_count }) }}</span>
                    <span><FlaskConical class="rmp__i rmp__i--xs" aria-hidden="true" /> {{ $t('{v0} labs', { v0: spec.lab_count }) }}</span>
                    <span v-if="spec.runbook_count"><FileText class="rmp__i rmp__i--xs" aria-hidden="true" /> {{ $t('{v0} runbooks', { v0: spec.runbook_count }) }}</span>
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
            <label class="rmp__check rmp__field--wide rmp__aibox">
              <input v-model="form.useAi" type="checkbox" />
              <Sparkles class="rmp__i" aria-hidden="true" /> {{ $t('Generate with AI') }}
              <span class="rmp__muted rmp__small">{{ $t('The AI researches the role and arranges the site\'s courses, labs and runbooks around it. Without it, the closest catalogue roadmap is used.') }}</span>
            </label>
            <div class="rmp__field--wide">
              <button type="submit" class="rmp__btn rmp__btn--primary rmp__btn--lg" :disabled="busy || !form.role.trim()">
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
  Box, BrainCircuit, Briefcase, ChevronRight, Circle, CircleCheck, CircleDot, Clock, Cloud, Code, Compass, Database,
  FileText, Flag, FlaskConical, GraduationCap, Layers, LoaderCircle, LogIn, MapPinned, Maximize, Minimize, Network,
  Palette, Pause, Pencil, Play, Plus, Rocket, Route, Search, ShieldCheck, Sparkles, Target, Trash2, UserPlus, Waypoints, X,
} from 'lucide-vue-next';
import { useFullscreen } from '@/composables/useFullscreen';
import { useAuthStore } from '@/store/auth';
import { useI18n } from '@/i18n/runtime';
import { roadmapService, RoadmapError } from '@/services/roadmap.service';
import { hasWebGL } from '@/stage3d/loader';
import {
  KINDS, KIND_ICON, filterCatalogue, outlinePoints, findNode, nextNode, progressStats, statusOf, summaryPercent, withStatus,
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

/*
  Full screen: the shell holding the toolbar, the map and the step card. See
  the template's header comment for why the card is a child of it. Entering
  and leaving changes the 3D host's size; the ResizeObserver inside the map
  catches it, and the renderer is resized here as well, twice - once after
  Vue has patched the class, once after the browser has laid it out - because
  the native API resolves before the first layout of the new size.
*/
const mapShell = ref<HTMLElement | null>(null);
const { active: fsActive, native: fsNative, toggle: toggleFs, exit: exitFs } = useFullscreen(mapShell);
watch(fsActive, async () => {
  await nextTick();
  map3d.value?.resize?.();
  requestAnimationFrame(() => map3d.value?.resize?.());
});

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
function stageDone(stageId: string): boolean {
  const s = stats.value.stages.find(x => x.id === stageId);
  return !!s && s.total > 0 && s.done === s.total;
}
function stageRing(stageId: string): number {
  return stats.value.stages.find(x => x.id === stageId)?.percent ?? 0;
}

/* A catalogue category's icon and hue. Categories are English record data;
   an unknown one gets the compass and the first hue. */
const CATEGORY_ICONS: [RegExp, unknown][] = [
  [/cloud|devops/i, Cloud], [/secur/i, ShieldCheck], [/data/i, Database], [/ai|machine|learning/i, BrainCircuit],
  [/network|infra/i, Network], [/manage|product/i, Briefcase], [/design|support/i, Palette], [/software|develop/i, Code],
];
function categoryIcon(category: string): any {
  return (CATEGORY_ICONS.find(([re]) => re.test(category))?.[1] as any) || Compass;
}
function categoryHue(category: string): number {
  const i = categories.value.indexOf(category);
  return (i < 0 ? 0 : i) % 4;
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
/*
  Every colour is a theme token with a fallback (working rule 12), every
  selector is `rmp__`-prefixed and scoped, and the layout is fluid from 320 px
  to 4K: grids are `minmax(min(100%, X), 1fr)`, never a bare `1fr` (rule 50).
*/
.rmp {
  --rmp-glass: rgb(var(--sfs-tint-rgb, 255 255 255) / 0.055);
  --rmp-glass-2: rgb(var(--sfs-tint-rgb, 255 255 255) / 0.09);
  --rmp-line: rgb(var(--sfs-line-rgb, 255 255 255) / 0.12);
  --rmp-line-2: rgb(var(--sfs-line-rgb, 255 255 255) / 0.22);
  --rmp-shadow: 0 18px 48px rgb(var(--sfs-shade-rgb, 0 0 0) / 0.22);
  --rmp-r: var(--sfs-radius-xl, 20px);
  display: grid; gap: clamp(1rem, 2vw, 1.5rem);
  padding: clamp(0.75rem, 2.5vw, 2rem);
  max-width: 132rem; margin-inline: auto;
  color: var(--sfs-text, #f1f5f9);
  min-width: 0;
}
.rmp__data { unicode-bidi: plaintext; overflow-wrap: anywhere; }
.rmp__muted { color: var(--sfs-text-muted, #94a3b8); margin: 0; display: flex; align-items: center; gap: 0.4rem; flex-wrap: wrap; }
.rmp__small { font-size: 0.82rem; }
.rmp__pad { padding: 2rem 0; }
.rmp__i { width: 1.05em; height: 1.05em; flex: none; vertical-align: -0.15em; }
.rmp__i--xs { width: 0.9em; height: 0.9em; }
@media (prefers-reduced-motion: no-preference) {
  .rmp__spin { animation: rmp-spin 1s linear infinite; }
}
@keyframes rmp-spin { to { transform: rotate(360deg); } }

/* ------------------------------------------------------------ the hero */
.rmp__head { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 1rem; }
.rmp__hero {
  position: relative; isolation: isolate; overflow: hidden;
  display: flex; align-items: center; gap: clamp(0.8rem, 2vw, 1.25rem);
  flex: 1 1 32rem; min-width: 0;
  padding: clamp(1rem, 2.4vw, 1.6rem) clamp(1rem, 2.6vw, 1.9rem);
  border-radius: var(--rmp-r);
  background:
    radial-gradient(70% 140% at 0% 0%, rgb(var(--sfs-accent-rgb, 102 126 234) / 0.22), transparent 60%),
    radial-gradient(60% 120% at 100% 100%, rgb(var(--sfs-accent-2-rgb, 118 75 162) / 0.18), transparent 60%),
    var(--rmp-glass);
  border: 1px solid var(--rmp-line);
  box-shadow: var(--rmp-shadow);
}
.rmp__badge {
  flex: none; display: grid; place-items: center;
  width: clamp(3rem, 6vw, 3.75rem); aspect-ratio: 1; border-radius: 1.1rem;
  background: linear-gradient(135deg, var(--sfs-accent, #667eea), var(--sfs-accent-2, #764ba2));
  color: var(--sfs-on-accent, #fff);
  box-shadow: 0 10px 30px rgb(var(--sfs-accent-rgb, 102 126 234) / 0.4), inset 0 1px 0 rgb(var(--sfs-tint-rgb, 255 255 255) / 0.35);
}
.rmp__badge svg { width: 55%; height: 55%; }
.rmp__headtext { min-width: 0; }
.rmp__title {
  margin: 0; font-size: clamp(1.6rem, 3.2vw, 2.5rem); letter-spacing: -0.02em; line-height: 1.1;
  text-shadow: var(--sfs-title-glow, none);
}
.rmp__lead { margin: 0.45rem 0 0; color: var(--sfs-text-muted, #cbd5e1); max-width: 64rem; line-height: 1.55; font-size: clamp(0.9rem, 1.2vw, 1rem); }

/* ------------------------------------------------------------ buttons */
.rmp__btn {
  display: inline-flex; align-items: center; justify-content: center; gap: 0.45rem;
  min-height: 2.6rem; padding: 0 1.05rem; border-radius: var(--sfs-radius-pill, 999px);
  border: 1px solid var(--rmp-line-2);
  background: var(--rmp-glass);
  color: var(--sfs-text, #f1f5f9); font: inherit; font-weight: 650; font-size: 0.92rem;
  text-decoration: none; cursor: pointer; white-space: nowrap;
  transition: border-color var(--sfs-dur-fast, 0.15s), background var(--sfs-dur-fast, 0.15s), transform var(--sfs-dur-fast, 0.15s), box-shadow var(--sfs-dur-fast, 0.15s);
}
.rmp__btn:hover { border-color: var(--sfs-accent, #667eea); background: rgb(var(--sfs-accent-rgb, 102 126 234) / 0.12); }
.rmp__btn:disabled { opacity: 0.55; cursor: not-allowed; }
.rmp__btn--primary {
  background: linear-gradient(135deg, var(--sfs-accent, #667eea), var(--sfs-accent-strong, #5a67d8));
  border-color: transparent; color: var(--sfs-on-accent, #fff);
  box-shadow: 0 8px 22px rgb(var(--sfs-accent-rgb, 102 126 234) / 0.35);
}
.rmp__btn--primary:hover { background: var(--sfs-accent-strong, #5a67d8); box-shadow: 0 10px 28px rgb(var(--sfs-accent-rgb, 102 126 234) / 0.45); }
.rmp__btn--danger { background: var(--sfs-danger, #f87171); border-color: transparent; color: var(--sfs-on-danger, #450a0a); }
.rmp__btn--sm { min-height: 2.25rem; padding: 0 0.8rem; font-size: 0.85rem; }
.rmp__btn--lg { min-height: 2.9rem; padding: 0 1.35rem; font-size: 0.98rem; }
@media (prefers-reduced-motion: no-preference) {
  .rmp__btn:not(:disabled):hover { transform: translateY(-1px); }
}
.rmp__btn:focus-visible, .rmp__icon:focus-visible, .rmp__spec:focus-visible, .rmp__cat:focus-visible,
.rmp__step:focus-visible, .rmp__seg button:focus-visible, .rmp__tabs button:focus-visible, .rmp__minelink:focus-visible,
.rmp__stage summary:focus-visible {
  outline: 2px solid var(--sfs-focus, #a5b4fc); outline-offset: 2px;
}
.rmp__icon {
  display: inline-grid; place-items: center; width: 2.25rem; height: 2.25rem; flex: none;
  border-radius: 50%; border: 1px solid transparent; background: transparent;
  color: var(--sfs-text-muted, #94a3b8); cursor: pointer;
}
.rmp__icon svg { width: 1rem; height: 1rem; }
.rmp__icon:hover { border-color: var(--rmp-line-2); color: var(--sfs-text, #f1f5f9); background: var(--rmp-glass); }
.rmp__icon.is-danger:hover { color: var(--sfs-danger-text, #f87171); }

/* ------------------------------------------------------------ gate / states */
.rmp__gate {
  position: relative; overflow: hidden; isolation: isolate;
  display: grid; justify-items: center; text-align: center; gap: 0.7rem;
  padding: clamp(2rem, 6vw, 4rem) 1.25rem;
  border-radius: var(--rmp-r);
  background: radial-gradient(60% 80% at 50% 0%, rgb(var(--sfs-accent-rgb, 102 126 234) / 0.18), transparent 70%), var(--rmp-glass);
  border: 1px solid var(--rmp-line);
}
.rmp__gate h2 { margin: 0; font-size: clamp(1.25rem, 2.6vw, 1.7rem); }
.rmp__gate p { margin: 0; max-width: 38rem; color: var(--sfs-text-muted, #cbd5e1); line-height: 1.55; }
.rmp__gatei {
  display: grid; place-items: center; width: 4.25rem; height: 4.25rem; border-radius: 50%;
  background: rgb(var(--sfs-accent-rgb, 102 126 234) / 0.16);
  border: 1px solid rgb(var(--sfs-accent-rgb, 102 126 234) / 0.4);
  color: var(--sfs-accent-text, #a5b4fc);
  box-shadow: 0 0 0 10px rgb(var(--sfs-accent-rgb, 102 126 234) / 0.06);
}
.rmp__gatei svg { width: 2rem; height: 2rem; }
.rmp__gatebtns { display: flex; flex-wrap: wrap; gap: 0.6rem; justify-content: center; margin-top: 0.4rem; }

/* ------------------------------------------------------------ layout */
.rmp__layout { display: grid; gap: clamp(1rem, 2vw, 1.5rem); grid-template-columns: minmax(0, 1fr); align-items: start; min-width: 0; }
@media (min-width: 1024px) {
  .rmp__layout { grid-template-columns: minmax(15rem, 19rem) minmax(0, 1fr); }
  .rmp__mine { position: sticky; top: 1rem; max-height: calc(100vh - 2rem); overflow-y: auto; }
}
.rmp__main { display: grid; gap: 1rem; min-width: 0; }

/* ------------------------------------------------------------ my roadmaps */
.rmp__mine {
  display: grid; gap: 0.7rem; align-content: start; min-width: 0;
  padding: 1rem; border-radius: var(--rmp-r);
  background: var(--rmp-glass);
  border: 1px solid var(--rmp-line);
  scrollbar-width: thin;
}
.rmp__minehead { display: flex; align-items: center; gap: 0.5rem; padding-inline: 0.2rem; }
.rmp__minehead h2 { margin: 0; font-size: 1rem; flex: 1; }
.rmp__minei { color: var(--sfs-accent-text, #a5b4fc); width: 1.2rem; height: 1.2rem; }
.rmp__count {
  min-width: 1.7rem; padding: 0.05rem 0.5rem; text-align: center; border-radius: 999px; font-size: 0.75rem; font-weight: 800;
  background: var(--sfs-accent, #667eea); color: var(--sfs-on-accent, #fff);
}
.rmp__empty { padding: 0.6rem 0.3rem; line-height: 1.5; }
.rmp__minelist { list-style: none; margin: 0; padding: 0; display: grid; gap: 0.4rem; }
.rmp__mineitem {
  display: flex; flex-wrap: wrap; align-items: center; gap: 0.2rem;
  padding: 0.4rem; border-radius: var(--sfs-radius-lg, 16px); border: 1px solid transparent;
  transition: background var(--sfs-dur-fast, 0.15s), border-color var(--sfs-dur-fast, 0.15s);
}
.rmp__mineitem:hover { background: var(--rmp-glass); border-color: var(--rmp-line); }
.rmp__mineitem.is-current {
  border-color: var(--sfs-border-accent, rgba(102, 126, 234, 0.45));
  background: linear-gradient(135deg, rgb(var(--sfs-accent-rgb, 102 126 234) / 0.16), rgb(var(--sfs-accent-2-rgb, 118 75 162) / 0.08));
}
.rmp__minelink { flex: 1 1 10rem; min-width: 0; display: flex; align-items: center; gap: 0.65rem; padding: 0.2rem; border-radius: 10px; color: inherit; text-decoration: none; }
/* A dial is a place: pinned LTR. The mask is on ::before so the number stays. */
.rmp__minering {
  --p: 0; position: relative; flex: none; width: 2.5rem; height: 2.5rem; direction: ltr;
  display: grid; place-items: center; font-size: 0.68rem; font-weight: 800; font-variant-numeric: tabular-nums;
}
.rmp__minering::before {
  content: ''; position: absolute; inset: 0; border-radius: 50%;
  background: conic-gradient(var(--sfs-success, #34d399) calc(var(--p) * 1%), rgb(var(--sfs-line-rgb, 255 255 255) / 0.16) 0);
  -webkit-mask: radial-gradient(circle, transparent 60%, #000 62%);
  mask: radial-gradient(circle, transparent 60%, #000 62%);
}
.rmp__minering span { position: relative; }
.rmp__minebody { display: grid; gap: 0.25rem; min-width: 0; flex: 1; }
.rmp__minetitle { font-weight: 700; font-size: 0.9rem; line-height: 1.3; }
.rmp__minemeta { font-size: 0.75rem; color: var(--sfs-text-muted, #94a3b8); display: flex; align-items: center; gap: 0.25rem; flex-wrap: wrap; }
.rmp__meter { display: block; height: 0.3rem; border-radius: 999px; background: rgb(var(--sfs-line-rgb, 255 255 255) / 0.12); overflow: hidden; }
.rmp__meter span { display: block; height: 100%; background: linear-gradient(90deg, var(--sfs-success, #34d399), var(--sfs-accent, #667eea)); border-radius: inherit; }
.rmp__mineacts { display: flex; }
.rmp__confirm { flex-basis: 100%; display: flex; flex-wrap: wrap; align-items: center; gap: 0.4rem; font-size: 0.82rem; padding: 0.3rem; }
.rmp__rename { flex-basis: 100%; display: flex; flex-wrap: wrap; gap: 0.35rem; }
.rmp__rename .rmp__input { flex: 1 1 100%; }

/* Skeletons: shimmer only with motion allowed. */
.rmp__skeletons { display: grid; gap: 0.5rem; }
.rmp__skel {
  display: block; height: 3.3rem; border-radius: var(--sfs-radius-lg, 16px);
  background: linear-gradient(90deg, var(--rmp-glass) 25%, var(--rmp-glass-2) 50%, var(--rmp-glass) 75%);
  background-size: 300% 100%;
}
.rmp__skel--card { height: 13rem; }
@media (prefers-reduced-motion: no-preference) {
  .rmp__skel { animation: rmp-shimmer 1.6s ease-in-out infinite; }
}
@keyframes rmp-shimmer { from { background-position: 100% 0; } to { background-position: 0 0; } }

.rmp__input {
  min-height: 2.65rem; padding: 0.45rem 0.8rem; border-radius: 12px; font: inherit; font-size: 0.95rem;
  border: 1px solid var(--sfs-field-border, rgba(255, 255, 255, 0.2));
  background: var(--sfs-field, rgba(255, 255, 255, 0.06)); color: var(--sfs-field-text, #f1f5f9);
  width: 100%; min-width: 0;
  transition: border-color var(--sfs-dur-fast, 0.15s), box-shadow var(--sfs-dur-fast, 0.15s);
}
.rmp__input:focus { outline: none; border-color: var(--sfs-focus, #a5b4fc); box-shadow: 0 0 0 3px rgb(var(--sfs-accent-rgb, 102 126 234) / 0.25); }
textarea.rmp__input { resize: vertical; }

.rmp__notice {
  display: flex; align-items: center; justify-content: space-between; gap: 0.6rem; margin: 0;
  padding: 0.5rem 0.6rem 0.5rem 1rem; border-radius: var(--sfs-radius-lg, 16px);
  background: rgb(var(--sfs-success-rgb, 52 211 153) / 0.14); color: var(--sfs-success-text, #34d399);
  border: 1px solid rgb(var(--sfs-success-rgb, 52 211 153) / 0.3);
}
.rmp__notice.is-error { background: rgb(var(--sfs-danger-rgb, 248 113 113) / 0.14); color: var(--sfs-danger-text, #f87171); border-color: rgb(var(--sfs-danger-rgb, 248 113 113) / 0.3); }

/* ------------------------------------------------------------ creating */
.rmp__creating {
  display: grid; justify-items: center; gap: 1rem; text-align: center;
  padding: clamp(2rem, 5vw, 3.5rem) 1rem; border-radius: var(--rmp-r);
  background: radial-gradient(50% 70% at 50% 0%, rgb(var(--sfs-accent-rgb, 102 126 234) / 0.2), transparent 70%), var(--rmp-glass);
  border: 1px solid var(--rmp-line);
}
.rmp__creating h2 { margin: 0; font-size: 1.3rem; }
.rmp__orbit { position: relative; width: 5.5rem; height: 5.5rem; }
.rmp__orbit span {
  position: absolute; inset: 0; border-radius: 50%;
  border: 3px solid transparent; border-top-color: var(--sfs-accent, #667eea);
}
.rmp__orbit span:nth-child(2) { inset: 0.7rem; border-top-color: var(--sfs-accent-2, #764ba2); }
.rmp__orbit span:nth-child(3) { inset: 1.4rem; border-top-color: var(--sfs-success, #34d399); }
.rmp__orbit i {
  position: absolute; inset: 2.15rem; border-radius: 50%;
  background: var(--sfs-accent, #667eea); box-shadow: 0 0 22px rgb(var(--sfs-accent-rgb, 102 126 234) / 0.8);
}
@media (prefers-reduced-motion: no-preference) {
  .rmp__orbit span { animation: rmp-spin 1.4s linear infinite; }
  .rmp__orbit span:nth-child(2) { animation-duration: 2s; animation-direction: reverse; }
  .rmp__orbit span:nth-child(3) { animation-duration: 1s; }
  .rmp__orbit i { animation: rmp-breathe 1.6s ease-in-out infinite; }
}
@keyframes rmp-breathe { 50% { transform: scale(0.7); opacity: 0.7; } }
.rmp__steps { list-style: none; margin: 0; padding: 0; display: grid; gap: 0.45rem; color: var(--sfs-text-faint, #64748b); text-align: start; }
.rmp__steps li { display: flex; align-items: center; gap: 0.5rem; }
.rmp__steps li.is-done { color: var(--sfs-success-text, #34d399); }
.rmp__steps li.is-now { color: var(--sfs-text, #f1f5f9); font-weight: 650; }

/* ------------------------------------------------------------ the viewer */
.rmp__view { display: grid; gap: 1rem; min-width: 0; }
.rmp__previewbar {
  display: grid; gap: 0.8rem; padding: 1rem 1.1rem; border-radius: var(--rmp-r);
  background: linear-gradient(135deg, rgb(var(--sfs-accent-rgb, 102 126 234) / 0.16), rgb(var(--sfs-accent-2-rgb, 118 75 162) / 0.1));
  border: 1px solid var(--sfs-border-accent, rgba(102, 126, 234, 0.45));
}
.rmp__previewtext { display: grid; gap: 0.15rem; }
.rmp__eyebrow { font-size: 0.72rem; font-weight: 800; letter-spacing: 0.08em; text-transform: uppercase; color: var(--sfs-accent-text, #a5b4fc); }
.rmp__makeit { display: flex; flex-wrap: wrap; align-items: flex-end; gap: 0.6rem; }
.rmp__field { display: grid; gap: 0.35rem; font-size: 0.82rem; font-weight: 600; color: var(--sfs-text-muted, #cbd5e1); min-width: 0; flex: 1 1 10rem; }
.rmp__field--narrow { flex: 0 1 8rem; }
.rmp__check { display: inline-flex; align-items: center; flex-wrap: wrap; gap: 0.4rem; font-size: 0.9rem; min-height: 2.6rem; cursor: pointer; }
.rmp__check input { width: 1.1rem; height: 1.1rem; accent-color: var(--sfs-accent, #667eea); }

.rmp__docinfo {
  display: flex; flex-wrap: wrap; gap: 1rem; align-items: center; justify-content: space-between;
  padding: 1rem 1.2rem; border-radius: var(--rmp-r);
  background: var(--rmp-glass); border: 1px solid var(--rmp-line);
}
.rmp__docmain { min-width: 0; flex: 1 1 20rem; display: grid; gap: 0.55rem; }
.rmp__doctitle { margin: 0; font-size: clamp(1.25rem, 2.4vw, 1.8rem); letter-spacing: -0.01em; }
.rmp__chips { list-style: none; margin: 0; padding: 0; display: flex; flex-wrap: wrap; gap: 0.4rem; }
.rmp__chip {
  display: inline-flex; align-items: center; gap: 0.3rem; padding: 0.22rem 0.7rem; border-radius: 999px;
  font-size: 0.8rem; font-weight: 600; background: var(--rmp-glass-2);
  border: 1px solid var(--rmp-line); color: var(--sfs-text, #f1f5f9);
}
.rmp__chip.is-ai { border-color: var(--sfs-border-accent, rgba(102, 126, 234, 0.45)); color: var(--sfs-accent-text, #a5b4fc); background: rgb(var(--sfs-accent-rgb, 102 126 234) / 0.12); }
.rmp__progress { display: flex; align-items: center; gap: 0.9rem; }
/* A conic ring, pinned LTR: a dial is a place and must not mirror. The mask is
   on ::before so the number in the middle is not cut out with it. */
.rmp__ring {
  --p: 0; position: relative; width: 4.4rem; height: 4.4rem; flex: none; direction: ltr;
  display: grid; place-items: center; font-weight: 800; font-size: 1rem; font-variant-numeric: tabular-nums;
}
.rmp__ring::before {
  content: ''; position: absolute; inset: 0; border-radius: 50%;
  background: conic-gradient(from -90deg, var(--sfs-success, #34d399) 0, var(--sfs-accent, #667eea) calc(var(--p) * 1%), rgb(var(--sfs-line-rgb, 255 255 255) / 0.14) 0);
  -webkit-mask: radial-gradient(circle, transparent 60%, #000 62%);
  mask: radial-gradient(circle, transparent 60%, #000 62%);
}
.rmp__ring span { position: relative; }
.rmp__progtext { display: grid; gap: 0.15rem; font-size: 0.9rem; }

.rmp__next {
  display: flex; flex-wrap: wrap; align-items: center; gap: 0.6rem; padding: 0.6rem 0.7rem 0.6rem 0.6rem;
  border-radius: var(--sfs-radius-lg, 16px);
  background: linear-gradient(90deg, rgb(var(--sfs-warning-rgb, 251 191 36) / 0.16), rgb(var(--sfs-warning-rgb, 251 191 36) / 0.05));
  border: 1px solid rgb(var(--sfs-warning-rgb, 251 191 36) / 0.35);
}
.rmp__nexti {
  display: grid; place-items: center; width: 2.1rem; height: 2.1rem; border-radius: 50%; flex: none;
  background: var(--sfs-warning, #fbbf24); color: var(--sfs-on-warning, #451a03);
}
.rmp__nexti svg { width: 1.1rem; height: 1.1rem; }
.rmp__next > span:nth-child(2) { flex: 1 1 12rem; min-width: 0; }

/* ------------------------------------------------------------ the map shell */
.rmp__stagewrap { display: grid; gap: 1rem; grid-template-columns: minmax(0, 1fr); min-width: 0; }
/* The side column joins the map only where the map can still be a wide one:
   below this the map takes the whole width and the stage list and the role
   follow it, so a 6-stage map is not squeezed into a 540 px column. */
@media (min-width: 1680px) { .rmp__stagewrap { grid-template-columns: minmax(0, 1fr) minmax(20rem, 26rem); } }
@media (min-width: 900px) and (max-width: 1679px) { .rmp__side { grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); align-items: start; } }

.rmp__shell { display: grid; gap: 0.75rem; min-width: 0; align-content: start; }
.rmp__toolbar {
  display: flex; flex-wrap: wrap; align-items: center; gap: 0.55rem;
  padding: 0.45rem; border-radius: 1.6rem;
  background: var(--rmp-glass); border: 1px solid var(--rmp-line);
}
.rmp__seg { display: inline-flex; padding: 0.2rem; border-radius: 999px; background: rgb(var(--sfs-sink-rgb, 0 0 0) / 0.25); border: 1px solid var(--rmp-line); }
.rmp__seg button {
  display: inline-flex; align-items: center; gap: 0.35rem; min-height: 2.15rem; padding: 0 0.95rem;
  border-radius: 999px; border: 0; background: transparent; color: var(--sfs-text-muted, #cbd5e1);
  font: inherit; font-weight: 800; cursor: pointer; transition: background var(--sfs-dur-fast, 0.15s), color var(--sfs-dur-fast, 0.15s);
}
.rmp__seg button[aria-pressed='true'] {
  background: linear-gradient(135deg, var(--sfs-accent, #667eea), var(--sfs-accent-strong, #5a67d8));
  color: var(--sfs-on-accent, #fff); box-shadow: 0 4px 14px rgb(var(--sfs-accent-rgb, 102 126 234) / 0.35);
}
.rmp__seg button:disabled { opacity: 0.45; cursor: not-allowed; }
.rmp__tourbtn[aria-pressed='true'] { border-color: var(--sfs-accent, #667eea); background: rgb(var(--sfs-accent-rgb, 102 126 234) / 0.18); }
.rmp__fstitle { font-size: 0.95rem; min-width: 0; max-width: 28rem; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.rmp__legend { list-style: none; margin: 0; padding: 0 0.3rem; display: flex; flex-wrap: wrap; gap: 0.25rem 0.85rem; font-size: 0.8rem; color: var(--sfs-text-muted, #cbd5e1); margin-inline-start: auto; }
.rmp__legend li { display: inline-flex; align-items: center; gap: 0.35rem; }
.rmp__lshape { stroke: var(--sfs-surface, #161a2b); stroke-width: 1.5; }
.rmp__licon path { fill: none; stroke-width: 2.4; stroke-linecap: round; stroke-linejoin: round; }
.rmp__legend li.is-course .rmp__lshape { fill: var(--sfs-accent, #667eea); }
.rmp__legend li.is-course .rmp__licon path { stroke: var(--sfs-on-accent, #fff); }
.rmp__legend li.is-lesson .rmp__lshape { fill: var(--sfs-accent-2, #764ba2); }
.rmp__legend li.is-lesson .rmp__licon path { stroke: var(--sfs-on-accent-2, #fff); }
.rmp__legend li.is-lab .rmp__lshape { fill: var(--sfs-accent-3, #f093fb); }
.rmp__legend li.is-lab .rmp__licon path { stroke: var(--sfs-on-accent-3, #1f1033); }
.rmp__legend li.is-runbook .rmp__lshape { fill: var(--sfs-info, #38bdf8); }
.rmp__legend li.is-runbook .rmp__licon path { stroke: var(--sfs-on-info, #082f49); }
.rmp__legend li.is-topic .rmp__lshape { fill: var(--sfs-text-muted, #94a3b8); }
.rmp__legend li.is-topic .rmp__licon path { stroke: var(--sfs-surface, #161a2b); }
.rmp__fsbtn { flex: none; }
.rmp__fsexit { flex: none; }
.rmp__mapnote { padding-inline: 0.6rem; }

.rmp__mapcol { position: relative; display: grid; gap: 0.9rem; min-width: 0; align-content: start; }
.rmp__map2d {
  border-radius: var(--rmp-r);
  background:
    radial-gradient(80% 60% at 0% 0%, rgb(var(--sfs-accent-rgb, 102 126 234) / 0.1), transparent 70%),
    var(--sfs-surface, #161a2b);
  border: 1px solid var(--rmp-line);
  box-shadow: var(--rmp-shadow);
  max-height: 80vh; overflow-y: auto;
}

/* The step card under the map; it arrives on a short rise. */
@media (prefers-reduced-motion: no-preference) {
  .rmp-card-enter-active { transition: opacity 0.28s var(--sfs-ease-out, ease-out), transform 0.28s var(--sfs-ease-out, ease-out); }
  .rmp-card-leave-active { transition: opacity 0.15s ease-in; }
  .rmp-card-enter-from { opacity: 0; transform: translateY(10px) scale(0.98); }
  .rmp-card-leave-to { opacity: 0; }
}

/* FULL SCREEN. Native (`:fullscreen`) and the overlay fallback share every
   rule below; the overlay adds the fixed positioning the native API gives for
   free. The 3D map takes its height from --rm3d-height; the 2D map scrolls. */
.rmp__shell.is-full {
  display: flex; flex-direction: column;
  gap: 0.6rem; width: 100%; height: 100vh; height: 100dvh;
  padding: clamp(0.5rem, 1.2vw, 0.9rem);
  padding-top: max(clamp(0.5rem, 1.2vw, 0.9rem), env(safe-area-inset-top));
  padding-bottom: max(clamp(0.5rem, 1.2vw, 0.9rem), env(safe-area-inset-bottom));
  background:
    radial-gradient(80% 60% at 80% 0%, rgb(var(--sfs-accent-rgb, 102 126 234) / 0.18), transparent 60%),
    var(--sfs-space, #0b1020);
  color: var(--sfs-text, #f1f5f9);
  overflow: hidden;
  --rm3d-height: 100%;
}
.rmp__shell.is-overlay { position: fixed; inset: 0; z-index: 2147483000; }
.rmp__shell.is-full > .rmp__toolbar, .rmp__shell.is-full > .rmp__mapnote { flex: none; }
/* The map area takes what is left, and the map fills it ABSOLUTELY: a
   percentage height inside a flex or grid track that is sized by its content
   resolves to 0, which is a full-screen canvas 1 pixel tall. */
.rmp__shell.is-full .rmp__mapcol { display: block; flex: 1 1 0; min-height: 0; }
.rmp__shell.is-full .rmp__mapcol > .rm3d,
.rmp__shell.is-full .rmp__mapcol > .rmp__map2d { position: absolute; inset: 0; height: auto; max-height: none; }
/* In full screen the step card floats over the map, inside the full-screen
   element (only its subtree is painted under the native API). */
.rmp__shell.is-full .rmp__nodecard {
  position: absolute; z-index: 5;
  inset-block-start: 1rem; inset-inline-end: 1rem;
  width: min(25rem, calc(100% - 2rem)); max-height: calc(100% - 2rem); overflow-y: auto;
  box-shadow: 0 24px 60px rgb(var(--sfs-shade-rgb, 0 0 0) / 0.45);
  align-content: start;
}
.rmp__shell.is-full.is-2d .rmp__nodecard { inset-block-start: 4.4rem; }
@media (max-width: 640px) {
  .rmp__shell.is-full .rmp__nodecard,
  .rmp__shell.is-full.is-2d .rmp__nodecard {
    inset-block-start: auto; inset-block-end: 0.6rem; inset-inline: 0.6rem;
    width: auto; max-height: 55%;
  }
  .rmp__fslabel { display: none; }
  .rmp__shell.is-full .rmp__legend { display: none; }
  .rmp__shell.is-full .rmp__fstitle { display: none; }
}

/* ------------------------------------------------------------ the stage list */
.rmp__side { display: grid; gap: 1rem; align-content: start; min-width: 0; }
.rmp__stages {
  display: grid; gap: 0.35rem; padding: 1rem; border-radius: var(--rmp-r);
  background: var(--rmp-glass); border: 1px solid var(--rmp-line);
}
.rmp__stages h3 { margin: 0 0 0.3rem; font-size: 1.05rem; }
.rmp__stage { border-radius: 12px; border: 1px solid transparent; transition: background var(--sfs-dur-fast, 0.15s), border-color var(--sfs-dur-fast, 0.15s); }
.rmp__stage[open] { background: rgb(var(--sfs-tint-rgb, 255 255 255) / 0.035); border-color: var(--rmp-line); }
.rmp__stage summary {
  display: flex; align-items: center; gap: 0.6rem; padding: 0.45rem 0.5rem; cursor: pointer;
  border-radius: 12px; list-style: none;
}
.rmp__stage summary::-webkit-details-marker { display: none; }
.rmp__stage summary:hover { background: rgb(var(--sfs-tint-rgb, 255 255 255) / 0.06); }
.rmp__stagenum {
  --p: 0; position: relative; flex: none; display: grid; place-items: center; width: 1.9rem; height: 1.9rem; border-radius: 50%;
  font-size: 0.78rem; font-weight: 800; direction: ltr; color: var(--sfs-text, #f1f5f9);
  background: rgb(var(--sfs-accent-rgb, 102 126 234) / 0.16);
}
.rmp__stagenum::before {
  content: ''; position: absolute; inset: 0; border-radius: 50%;
  background: conic-gradient(var(--sfs-success, #34d399) calc(var(--p) * 1%), rgb(var(--sfs-line-rgb, 255 255 255) / 0.2) 0);
  -webkit-mask: radial-gradient(circle, transparent 68%, #000 70%);
  mask: radial-gradient(circle, transparent 68%, #000 70%);
}
.rmp__stage.is-complete .rmp__stagenum { background: var(--sfs-success, #34d399); color: var(--sfs-on-success, #052e16); }
.rmp__stagename { flex: 1; min-width: 0; font-weight: 650; font-size: 0.92rem; }
.rmp__stagepct { font-size: 0.75rem; font-weight: 700; color: var(--sfs-text-muted, #94a3b8); direction: ltr; unicode-bidi: isolate; font-variant-numeric: tabular-nums; }
.rmp__chev { color: var(--sfs-text-faint, #94a3b8); transition: transform var(--sfs-dur-fast, 0.15s); }
.rmp__stage[open] .rmp__chev { transform: rotate(90deg); }
[dir='rtl'] .rmp__stage[open] .rmp__chev { transform: scaleX(-1) rotate(90deg); }
.rmp__stagesum { margin: 0.1rem 0.6rem 0.4rem; font-size: 0.82rem; color: var(--sfs-text-muted, #cbd5e1); line-height: 1.45; }
.rmp__steplist { list-style: none; margin: 0 0 0.45rem; padding: 0 0.35rem; display: grid; gap: 0.15rem; }
.rmp__step {
  display: flex; align-items: center; gap: 0.5rem; width: 100%; padding: 0.4rem 0.5rem;
  border-radius: 10px; border: 1px solid transparent; background: transparent; color: var(--sfs-text, #f1f5f9);
  font: inherit; font-size: 0.85rem; text-align: start; cursor: pointer;
}
.rmp__step:hover { background: rgb(var(--sfs-tint-rgb, 255 255 255) / 0.07); }
.rmp__step[aria-pressed='true'] { border-color: var(--sfs-focus, #a5b4fc); background: rgb(var(--sfs-accent-rgb, 102 126 234) / 0.12); }
.rmp__step .is-done { color: var(--sfs-success-text, #34d399); }
.rmp__step .is-doing { color: var(--sfs-warning-text, #fbbf24); }
.rmp__steptitle { flex: 1; min-width: 0; }
.rmp__stepkind {
  flex: none; font-size: 0.68rem; font-weight: 700; padding: 0.1rem 0.45rem; border-radius: 999px;
  color: var(--sfs-text-muted, #94a3b8); background: rgb(var(--sfs-tint-rgb, 255 255 255) / 0.06);
}

/* ------------------------------------------------------------ the builder */
.rmp__builder { display: grid; gap: 1.1rem; min-width: 0; }
.rmp__tabs {
  display: inline-flex; flex-wrap: wrap; gap: 0.25rem; justify-self: start; max-width: 100%;
  padding: 0.25rem; border-radius: 999px; background: var(--rmp-glass); border: 1px solid var(--rmp-line);
}
.rmp__tabs button {
  display: inline-flex; align-items: center; gap: 0.45rem; min-height: 2.5rem; padding: 0 1.1rem;
  border-radius: 999px; border: 0;
  background: transparent; color: var(--sfs-text-muted, #cbd5e1); font: inherit; font-weight: 700; cursor: pointer;
}
.rmp__tabs button[aria-selected='true'] {
  background: linear-gradient(135deg, var(--sfs-accent, #667eea), var(--sfs-accent-strong, #5a67d8));
  color: var(--sfs-on-accent, #fff); box-shadow: 0 6px 18px rgb(var(--sfs-accent-rgb, 102 126 234) / 0.35);
}
.rmp__catalogue { display: grid; gap: 1rem; min-width: 0; }
.rmp__filters { display: grid; gap: 0.7rem; }
.rmp__search {
  display: flex; align-items: center; gap: 0.55rem; padding: 0 1rem; min-height: 3rem; border-radius: 999px;
  border: 1px solid var(--sfs-field-border, rgba(255, 255, 255, 0.2)); background: var(--sfs-field, rgba(255, 255, 255, 0.06));
  max-width: 40rem; color: var(--sfs-text-muted, #94a3b8);
  transition: border-color var(--sfs-dur-fast, 0.15s), box-shadow var(--sfs-dur-fast, 0.15s);
}
.rmp__search input { flex: 1; min-width: 0; border: 0; background: transparent; color: var(--sfs-field-text, #f1f5f9); font: inherit; outline: none; }
.rmp__search:focus-within { border-color: var(--sfs-focus, #a5b4fc); box-shadow: 0 0 0 3px rgb(var(--sfs-accent-rgb, 102 126 234) / 0.22); }
.rmp__cats { display: flex; flex-wrap: wrap; gap: 0.4rem; }
.rmp__cat {
  display: inline-flex; align-items: center; gap: 0.35rem;
  min-height: 2.2rem; padding: 0 0.8rem; border-radius: 999px; font: inherit; font-size: 0.82rem; font-weight: 600; cursor: pointer;
  border: 1px solid var(--rmp-line-2); background: transparent; color: var(--sfs-text, #f1f5f9);
  transition: background var(--sfs-dur-fast, 0.15s), border-color var(--sfs-dur-fast, 0.15s);
}
.rmp__cat:hover { background: var(--rmp-glass); }
.rmp__cat[aria-pressed='true'] { background: rgb(var(--sfs-accent-rgb, 102 126 234) / 0.22); border-color: var(--sfs-accent, #667eea); }
.rmp__grid { list-style: none; margin: 0; padding: 0; display: grid; gap: 0.9rem; grid-template-columns: repeat(auto-fill, minmax(min(100%, 18rem), 1fr)); }
/* The card's border is a gradient on hover: two backgrounds, padding-box and
   border-box, with a transparent border between them. */
.rmp__spec {
  --hue: var(--sfs-accent, #667eea); --hue-rgb: var(--sfs-accent-rgb, 102 126 234); --hue-ink: var(--sfs-on-accent, #fff);
  position: relative; isolation: isolate; overflow: hidden;
  width: 100%; height: 100%; display: grid; align-content: start; gap: 0.5rem; text-align: start;
  padding: 1.05rem 1.1rem; border-radius: var(--rmp-r); cursor: pointer; font: inherit;
  background:
    linear-gradient(var(--sfs-surface, #161a2b), var(--sfs-surface, #161a2b)) padding-box,
    linear-gradient(135deg, var(--rmp-line-2), var(--rmp-line)) border-box;
  border: 1px solid transparent;
  color: var(--sfs-text, #f1f5f9);
  box-shadow: 0 6px 20px rgb(var(--sfs-shade-rgb, 0 0 0) / 0.14);
  transition: transform var(--sfs-dur, 0.25s) var(--sfs-ease-out, ease-out), box-shadow var(--sfs-dur, 0.25s);
}
.rmp__spec::before {
  content: ''; position: absolute; inset: 0; z-index: -1; pointer-events: none;
  background: radial-gradient(90% 60% at 100% 0%, rgb(var(--hue-rgb) / 0.14), transparent 70%);
}
.rmp__spec.is-hue1 { --hue: var(--sfs-accent-2, #764ba2); --hue-rgb: var(--sfs-accent-2-rgb, 118 75 162); --hue-ink: var(--sfs-on-accent-2, #fff); }
.rmp__spec.is-hue2 { --hue: var(--sfs-accent-3, #f093fb); --hue-rgb: var(--sfs-accent-3-rgb, 240 147 251); --hue-ink: var(--sfs-on-accent-3, #1f1033); }
.rmp__spec.is-hue3 { --hue: var(--sfs-info, #38bdf8); --hue-rgb: var(--sfs-info-rgb, 56 189 248); --hue-ink: var(--sfs-on-info, #082f49); }
.rmp__spec:hover {
  background:
    linear-gradient(var(--sfs-surface, #161a2b), var(--sfs-surface, #161a2b)) padding-box,
    linear-gradient(135deg, var(--hue), var(--sfs-accent-2, #764ba2)) border-box;
  box-shadow: 0 14px 36px rgb(var(--hue-rgb) / 0.22);
}
.rmp__spec:disabled { cursor: progress; opacity: 0.7; }
@media (prefers-reduced-motion: no-preference) {
  .rmp__spec:hover { transform: translateY(-3px); }
  .rmp__grid > li { animation: rmp-in 0.5s cubic-bezier(0.34, 1.3, 0.64, 1) both; animation-delay: calc(min(var(--i), 14) * 35ms); }
  .rmp__spec:hover .rmp__specgo .rmp__i { transform: translateX(3px); }
  [dir='rtl'] .rmp__spec:hover .rmp__specgo .rmp__i { transform: scaleX(-1) translateX(3px); }
}
@keyframes rmp-in { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: none; } }
.rmp__spectop { display: flex; align-items: center; gap: 0.6rem; min-width: 0; }
.rmp__specicon {
  flex: none; display: grid; place-items: center; width: 2.4rem; height: 2.4rem; border-radius: 0.8rem;
  background: var(--hue); color: var(--hue-ink);
  box-shadow: 0 6px 16px rgb(var(--hue-rgb) / 0.35);
}
.rmp__specicon svg { width: 1.2rem; height: 1.2rem; }
.rmp__speccat { font-size: 0.72rem; font-weight: 800; letter-spacing: 0.06em; text-transform: uppercase; color: var(--sfs-text-muted, #94a3b8); min-width: 0; }
.rmp__spectitle { font-size: 1.08rem; font-weight: 750; letter-spacing: -0.01em; }
.rmp__specsum {
  font-size: 0.85rem; color: var(--sfs-text-muted, #cbd5e1); line-height: 1.5;
  display: -webkit-box; -webkit-line-clamp: 3; line-clamp: 3; -webkit-box-orient: vertical; overflow: hidden;
}
.rmp__specnums { display: flex; flex-wrap: wrap; gap: 0.3rem 0.4rem; font-size: 0.74rem; color: var(--sfs-text-muted, #94a3b8); }
.rmp__specnums > span {
  display: inline-flex; align-items: center; gap: 0.25rem; padding: 0.15rem 0.5rem; border-radius: 999px;
  background: rgb(var(--sfs-tint-rgb, 255 255 255) / 0.06); border: 1px solid var(--rmp-line);
}
.rmp__specgo { display: inline-flex; align-items: center; gap: 0.25rem; font-size: 0.86rem; font-weight: 700; color: var(--sfs-accent-text, #a5b4fc); margin-top: 0.3rem; }
.rmp__specgo .rmp__i { transition: transform var(--sfs-dur-fast, 0.15s); }
.rmp__custom {
  display: flex; flex-wrap: wrap; gap: 1rem; align-items: flex-end;
  padding: clamp(1rem, 2.5vw, 1.6rem); border-radius: var(--rmp-r);
  background: radial-gradient(70% 90% at 100% 0%, rgb(var(--sfs-accent-rgb, 102 126 234) / 0.12), transparent 70%), var(--rmp-glass);
  border: 1px solid var(--rmp-line);
  max-width: 56rem;
}
.rmp__aibox {
  padding: 0.75rem 0.9rem; border-radius: var(--sfs-radius-lg, 16px);
  background: rgb(var(--sfs-accent-rgb, 102 126 234) / 0.08); border: 1px solid var(--sfs-border-accent, rgba(102, 126, 234, 0.4));
}
.rmp__field--wide { flex-basis: 100%; }
</style>
