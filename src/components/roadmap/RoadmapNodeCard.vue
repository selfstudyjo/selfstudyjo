<template>
  <!--
    One step, opened: what it is, where it leads, what it needs first, and the
    learner's own mark on it. The destination is a router-link to an in-app
    route `routeFor` vetted - never a raw string from the backend, never
    v-html, never a new tab (an internal destination stays in the tab).
  -->
  <article class="rmnode" :class="`is-${node.kind}`" :aria-label="node.title">
    <header class="rmnode__head">
      <span class="rmnode__glyph" aria-hidden="true">
        <component :is="kindIcon" />
      </span>
      <span class="rmnode__meta">
        <span class="rmnode__kind">{{ kindLabel }}<template v-if="node.optional"> · {{ $t('optional') }}</template></span>
        <span class="rmnode__stage">{{ $t('Stage {v0}', { v0: stageIndex + 1 }) }} · <span class="rmnode__data">{{ stage.title }}</span></span>
      </span>
      <button type="button" class="rmnode__close" :aria-label="$t('Close')" @click="emit('close')">
        <X aria-hidden="true" />
      </button>
    </header>

    <h3 class="rmnode__title rmnode__data">{{ node.title }}</h3>
    <p v-if="node.summary" class="rmnode__sum rmnode__data">{{ node.summary }}</p>

    <div v-if="deps.length" class="rmnode__deps">
      <span class="rmnode__label">{{ $t('Do these first') }}</span>
      <ul>
        <li v-for="d in deps" :key="d.id">
          <button type="button" class="rmnode__dep" @click="emit('select', d.id)">
            <CircleCheck v-if="d.done" class="rmnode__i is-done" aria-hidden="true" />
            <Circle v-else class="rmnode__i" aria-hidden="true" />
            <span class="rmnode__data">{{ d.title }}</span>
          </button>
        </li>
      </ul>
    </div>

    <div class="rmnode__actions">
      <router-link v-if="route" :to="route" class="rmnode__open">
        <component :is="kindIcon" class="rmnode__i" aria-hidden="true" /> {{ openLabel }}
      </router-link>
      <p v-else class="rmnode__nolink">{{ $t('This topic has no page on the site yet - the role sources show where to learn it.') }}</p>

      <div v-if="!readonly" class="rmnode__status" role="group" :aria-label="$t('Your progress on this step')">
        <button type="button" class="rmnode__sbtn is-doing" :aria-pressed="status === 'doing'"
                :disabled="busy" @click="emit('status', status === 'doing' ? '' : 'doing')">
          <CircleDot class="rmnode__i" aria-hidden="true" /> {{ $t('Doing') }}
        </button>
        <button type="button" class="rmnode__sbtn is-done" :aria-pressed="status === 'done'"
                :disabled="busy" @click="emit('status', status === 'done' ? '' : 'done')">
          <CircleCheck class="rmnode__i" aria-hidden="true" /> {{ $t('Done') }}
        </button>
      </div>
    </div>
  </article>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { BookOpen, Circle, CircleCheck, CircleDot, FileText, FlaskConical, GraduationCap, Lightbulb, X } from 'lucide-vue-next';
import { useI18n } from '@/i18n/runtime';
import { routeFor, statusOf, type NodeStatus, type RoadmapDoc, type RoadmapNode, type RoadmapStage } from '@/utils/roadmapLayout';

const props = defineProps<{
  doc: RoadmapDoc;
  node: RoadmapNode;
  stage: RoadmapStage;
  readonly?: boolean;
  busy?: boolean;
}>();
const emit = defineEmits<{
  (e: 'close'): void;
  (e: 'select', id: string): void;
  (e: 'status', status: NodeStatus): void;
}>();
const { t } = useI18n();

const status = computed(() => statusOf(props.doc, props.node.id));
const route = computed(() => routeFor(props.node));
const stageIndex = computed(() => props.doc.stages.findIndex(s => s.id === props.stage.id));

const kindIcon = computed(() => ({
  course: GraduationCap, lesson: BookOpen, lab: FlaskConical, runbook: FileText, topic: Lightbulb,
}[props.node.kind]));

const kindLabel = computed(() => {
  switch (props.node.kind) {
    case 'course': return t('Course');
    case 'lesson': return t('Lesson');
    case 'lab': return t('Lab');
    case 'runbook': return t('Runbook');
    default: return t('Topic');
  }
});
const openLabel = computed(() => {
  switch (props.node.kind) {
    case 'course': return t('Open the course');
    case 'lesson': return t('Open the lesson');
    case 'lab': return t('Open the lab');
    default: return t('Open the runbook');
  }
});

const deps = computed(() => {
  const byId = new Map(props.doc.stages.flatMap(s => s.nodes).map(n => [n.id, n]));
  return props.node.depends_on
    .map(id => byId.get(id))
    .filter((n): n is RoadmapNode => !!n)
    .map(n => ({ id: n.id, title: n.title, done: statusOf(props.doc, n.id) === 'done' }));
});
</script>

<style scoped>
.rmnode {
  display: grid; gap: 0.7rem; min-width: 0;
  padding: 1rem 1.1rem;
  border-radius: var(--sfs-radius-lg, 16px);
  background: var(--sfs-surface, #161a2b);
  border: 1px solid var(--sfs-border-accent, rgba(102, 126, 234, 0.4));
  box-shadow: var(--sfs-elev-2, 0 8px 24px rgba(0, 0, 0, 0.25));
}
.rmnode__head { display: flex; align-items: center; gap: 0.7rem; min-width: 0; }
.rmnode__glyph {
  flex: none; display: grid; place-items: center;
  width: 2.4rem; height: 2.4rem; border-radius: 0.8rem;
  color: var(--sfs-on-accent, #fff);
  background: var(--sfs-accent, #667eea);
}
.rmnode.is-lesson .rmnode__glyph { background: var(--sfs-accent-2, #764ba2); color: var(--sfs-on-accent-2, #fff); border-radius: 50%; }
.rmnode.is-lab .rmnode__glyph { background: var(--sfs-accent-3, #f093fb); color: var(--sfs-on-accent-3, #1f1033); }
.rmnode.is-runbook .rmnode__glyph { background: var(--sfs-info, #38bdf8); color: var(--sfs-on-info, #082f49); }
.rmnode.is-topic .rmnode__glyph { background: rgb(var(--sfs-tint-rgb, 255 255 255) / 0.12); color: var(--sfs-text, #f1f5f9); }
.rmnode__glyph svg { width: 1.25rem; height: 1.25rem; }
.rmnode__meta { display: grid; min-width: 0; flex: 1; }
.rmnode__kind { font-size: 0.72rem; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; color: var(--sfs-accent-text, #a5b4fc); }
.rmnode__stage { font-size: 0.82rem; color: var(--sfs-text-muted, #94a3b8); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.rmnode__close {
  flex: none; display: grid; place-items: center; width: 2.25rem; height: 2.25rem;
  border-radius: 50%; border: 1px solid var(--sfs-border, rgba(255, 255, 255, 0.14));
  background: transparent; color: var(--sfs-text-muted, #94a3b8); cursor: pointer;
}
.rmnode__close svg { width: 1rem; height: 1rem; }
.rmnode__data { unicode-bidi: plaintext; overflow-wrap: anywhere; }
.rmnode__title { margin: 0; font-size: 1.1rem; color: var(--sfs-text, #f1f5f9); line-height: 1.3; }
.rmnode__sum { margin: 0; color: var(--sfs-text-muted, #cbd5e1); font-size: 0.9rem; line-height: 1.5; }
.rmnode__label { font-size: 0.75rem; color: var(--sfs-text-muted, #94a3b8); }
.rmnode__deps ul { list-style: none; margin: 0.3rem 0 0; padding: 0; display: grid; gap: 0.25rem; }
.rmnode__dep {
  display: flex; align-items: center; gap: 0.45rem; width: 100%; text-align: start;
  padding: 0.35rem 0.5rem; border-radius: 8px; border: 0; cursor: pointer;
  background: rgb(var(--sfs-tint-rgb, 255 255 255) / 0.05); color: var(--sfs-text, #f1f5f9);
  font: inherit; font-size: 0.85rem;
}
.rmnode__dep:hover { background: rgb(var(--sfs-tint-rgb, 255 255 255) / 0.1); }
.rmnode__i { width: 1rem; height: 1rem; flex: none; }
.rmnode__i.is-done { color: var(--sfs-success-text, #34d399); }
.rmnode__actions { display: flex; flex-wrap: wrap; gap: 0.6rem; align-items: center; justify-content: space-between; }
.rmnode__open {
  display: inline-flex; align-items: center; gap: 0.45rem;
  min-height: 2.6rem; padding: 0 1rem; border-radius: var(--sfs-radius-pill, 999px);
  background: var(--sfs-accent, #667eea); color: var(--sfs-on-accent, #fff);
  font-weight: 600; text-decoration: none;
}
.rmnode__open:hover { background: var(--sfs-accent-strong, #5a67d8); }
.rmnode__nolink { margin: 0; font-size: 0.82rem; color: var(--sfs-text-muted, #94a3b8); flex: 1 1 14rem; }
.rmnode__status { display: inline-flex; gap: 0.35rem; }
.rmnode__sbtn {
  display: inline-flex; align-items: center; gap: 0.35rem;
  min-height: 2.4rem; padding: 0 0.8rem; border-radius: var(--sfs-radius-pill, 999px);
  border: 1px solid var(--sfs-border, rgba(255, 255, 255, 0.18));
  background: transparent; color: var(--sfs-text, #f1f5f9);
  font: inherit; font-size: 0.85rem; cursor: pointer;
}
.rmnode__sbtn[aria-pressed='true'].is-doing { background: rgb(var(--sfs-warning-rgb, 251 191 36) / 0.22); border-color: var(--sfs-warning, #fbbf24); color: var(--sfs-warning-text, #fbbf24); }
.rmnode__sbtn[aria-pressed='true'].is-done { background: rgb(var(--sfs-success-rgb, 52 211 153) / 0.22); border-color: var(--sfs-success, #34d399); color: var(--sfs-success-text, #34d399); }
.rmnode__sbtn:disabled { opacity: 0.6; cursor: progress; }
.rmnode__sbtn:focus-visible, .rmnode__open:focus-visible, .rmnode__dep:focus-visible, .rmnode__close:focus-visible {
  outline: 2px solid var(--sfs-focus, #a5b4fc); outline-offset: 2px;
}
</style>
