<template>
  <div class="card assist">
    <div class="card__head">
      <svg class="assist__icon" viewBox="0 0 16 16" aria-hidden="true"><path d="M8 1.5l1.6 4.2L14 7.3l-4.4 1.6L8 13.5 6.4 8.9 2 7.3l4.4-1.6z" fill="currentColor" /></svg>
      <h3 class="card__title">Agent Assist</h3>
    </div>
    <div class="card__body">
      <p v-if="!incident" class="muted">Open an incident to see suggestions.</p>
      <template v-else>
        <p class="assist__ctx">For <b>{{ incident.number }}</b> · {{ incident.ci || 'no CI' }}</p>
        <h4 class="assist__h">Next best action</h4>
        <ul class="assist__list">
          <li v-for="(tip, i) in tips" :key="i">{{ tip }}</li>
        </ul>
        <h4 class="assist__h">Known errors</h4>
        <ul class="assist__list">
          <li v-for="p in knownErrors" :key="p.number">
            <button type="button" class="link" @click="$emit('navigate', { page: 'problem', id: p.number })">{{ p.number }}</button> {{ p.short }}
            <div class="assist__wa">Workaround: {{ p.workaround }}</div>
          </li>
          <li v-if="!knownErrors.length" class="muted">No known error for this configuration item.</li>
        </ul>
        <h4 class="assist__h">Similar incidents</h4>
        <ul class="assist__list">
          <li v-for="s in similar" :key="s.number">
            <button type="button" class="link" @click="$emit('navigate', { page: 'incident', id: s.number })">{{ s.number }}</button>
            <span class="muted"> {{ s.state }}</span> — {{ s.short }}
            <div v-if="s.resolution_notes" class="assist__wa">{{ s.resolution_code }}: {{ s.resolution_notes }}</div>
          </li>
          <li v-if="!similar.length" class="muted">None.</li>
        </ul>
      </template>
    </div>
  </div>
</template>

<script setup lang="ts">
/** Agent Assist: known errors and similar incidents for the CI, plus the next SLA-driven action. */
import { computed } from 'vue';
import { worstSla, type Incident, type Model } from './snow';
import type { Route } from './route';

const props = defineProps<{ model: Model; incident?: Incident }>();
defineEmits<{ (event: 'navigate', route: Route): void }>();

const knownErrors = computed(() => props.model.problems.filter(p => p.known_error && props.incident && p.ci === props.incident.ci));
const similar = computed(() => props.model.incidents
  .filter(i => props.incident && i.number !== props.incident.number && i.ci && i.ci === props.incident.ci).slice(0, 4));
const tips = computed(() => {
  const i = props.incident;
  if (!i) return [];
  const out: string[] = [];
  if (!i.group) out.push('Set an assignment group — nobody is working an unassigned incident.');
  if (!i.acked && ['New', 'In Progress', 'On Hold'].includes(i.state)) out.push('Acknowledge it (Assign to me): only that stops the pick-up SLA.');
  if (!i.responded && ['New', 'In Progress', 'On Hold'].includes(i.state)) out.push('Post an Additional comment (Customer visible): a work note does not stop the response SLA.');
  const w = worstSla(i);
  if (w && w.stage === 'in progress') out.push(`${w.name} SLA at ${Math.round(w.percent)}% — ${w.left}m left.`);
  if (w && w.stage === 'breached') out.push(`${w.name} SLA is breached.`);
  if (i.priority === 1 && !i.major && ['New', 'In Progress'].includes(i.state)) out.push('P1: consider promoting to a major incident.');
  if (!out.length) out.push('No action pending.');
  return out;
});
</script>

<style scoped src="./sn.css"></style>
<style scoped>
.assist__icon { width: 1rem; height: 1rem; color: var(--sn-primary); }
.assist__ctx { margin: 0 0 0.5rem; font-size: 0.78rem; color: var(--sn-text-muted); }
.assist__h { margin: 0.7rem 0 0.3rem; font-size: 0.75rem; text-transform: uppercase; letter-spacing: 0.04em; color: var(--sn-text-muted); }
.assist__list { margin: 0; padding-left: 1rem; font-size: 0.8rem; }
.assist__list li { margin-bottom: 0.35rem; }
.assist__wa { margin-top: 0.15rem; color: var(--sn-text-muted); font-size: 0.75rem; }
</style>
