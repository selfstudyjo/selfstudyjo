<template>
  <div class="sl-gui">
    <div class="sl-console__head">
      <div class="sl-console__title">
        <Gauge class="sl-i" />
        <span>{{ $t(title) }}</span>
        <span class="sl-tag sl-tag--sim">{{ $t('Reads the live environment') }}</span>
      </div>
      <div class="sl-console__actions">
        <button type="button" class="sl-btn sl-btn--ghost sl-btn--sm"
                :disabled="busy" @click="$emit('refresh')">
          <RotateCw class="sl-i" /> {{ $t('Refresh') }}
        </button>
      </div>
    </div>

    <p v-if="panels.length === 0" class="sl-gui__empty">
      {{ $t('This lab has no dashboard for that tool.') }}
    </p>

    <div v-for="panel in panels" :key="panel.id" class="sl-panel">
      <h4 class="sl-panel__title">{{ $t(panel.title) }}</h4>

      <!-- stats: a flat object as a row of figures -->
      <div v-if="panel.kind === 'stats'" class="sl-stats">
        <p v-if="stats(panel).length === 0" class="sl-panel__empty">
          {{ $t(panel.empty || 'Nothing yet') }}
        </p>
        <div v-for="[key, value] in stats(panel)" :key="key" class="sl-stat">
          <span class="sl-stat__label">{{ humanKey(key) }}</span>
          <span class="sl-stat__value" dir="ltr">{{ show(value) }}</span>
        </div>
      </div>

      <!-- table: the commonest shape by a long way -->
      <div v-else-if="panel.kind === 'table'">
        <p v-if="rows(panel).length === 0" class="sl-panel__empty">
          {{ $t(panel.empty || 'Nothing yet') }}
        </p>
        <div v-else class="sl-scroll">
          <table class="sl-table">
            <thead>
              <tr>
                <th v-for="column in columnsOf(panel)" :key="column.key">
                  {{ $t(column.label) }}
                </th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="(row, index) in rows(panel)" :key="index">
                <td v-for="column in columnsOf(panel)" :key="column.key"
                    :class="cellClass(column)"
                    :dir="column.kind === 'code' ? 'ltr' : undefined">
                  <span v-if="column.kind === 'badge'" class="sl-badge"
                        :class="badgeClass(row[column.key])">{{ show(row[column.key]) }}</span>
                  <template v-else>{{ show(row[column.key]) }}</template>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <!-- cards: for a job or a commit, where the interesting part is nested -->
      <div v-else-if="panel.kind === 'cards'" class="sl-cards">
        <p v-if="rows(panel).length === 0" class="sl-panel__empty">
          {{ $t(panel.empty || 'Nothing yet') }}
        </p>
        <article v-for="(row, index) in rows(panel)" :key="index" class="sl-card">
          <header class="sl-card__head">
            <span class="sl-card__title" dir="ltr">
              {{ show(row.description || row.message || row.name || row.id) }}
            </span>
            <span v-if="row.status || row.sha" class="sl-badge"
                  :class="badgeClass(row.status)">
              {{ show(row.status || row.sha) }}
            </span>
          </header>
          <dl class="sl-card__facts">
            <template v-for="[key, value] in cardFacts(row)" :key="key">
              <dt>{{ humanKey(key) }}</dt>
              <dd dir="ltr">{{ show(value) }}</dd>
            </template>
          </dl>
          <ul v-if="Array.isArray(row.stages) && row.stages.length"
              class="sl-card__stages">
            <li v-for="(stage, position) in row.stages" :key="position" dir="ltr">
              {{ show((stage as any).name) }} —
              {{ show((stage as any).tasks) }} {{ $t('tasks') }},
              {{ show((stage as any).duration_ms) }} ms,
              {{ $t('shuffle') }} {{ show((stage as any).shuffle_write_h) }}
            </li>
          </ul>
        </article>
      </div>

      <!-- tree: the HDFS browser -->
      <div v-else-if="panel.kind === 'tree'" class="sl-scroll">
        <p v-if="rows(panel).length === 0" class="sl-panel__empty">
          {{ $t(panel.empty || 'Nothing yet') }}
        </p>
        <table v-else class="sl-table sl-table--tree">
          <thead>
            <tr>
              <th>{{ $t('Path') }}</th><th>{{ $t('Type') }}</th>
              <th>{{ $t('Size') }}</th><th>{{ $t('Blocks') }}</th>
              <th>{{ $t('Replication') }}</th><th>{{ $t('Owner') }}</th>
              <th>{{ $t('Permissions') }}</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="(row, index) in rows(panel)" :key="index">
              <td dir="ltr" class="sl-cell--code"
                  :style="{ paddingInlineStart: depth(row.path) + 'rem' }">
                {{ show(row.name) }}
              </td>
              <td><span class="sl-badge" :class="badgeClass(row.type)">{{ show(row.type) }}</span></td>
              <td dir="ltr">{{ show(row.size_h) }}</td>
              <td>{{ show(row.blocks) }}</td>
              <td>{{ show(row.replication) }}</td>
              <td>{{ show(row.owner) }}</td>
              <td dir="ltr" class="sl-cell--code">{{ show(row.perm) }}</td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- log: events and alerts -->
      <div v-else-if="panel.kind === 'log'" class="sl-log" dir="ltr">
        <p v-if="rows(panel).length === 0" class="sl-panel__empty">
          {{ $t(panel.empty || 'Nothing yet') }}
        </p>
        <div v-for="(row, index) in rows(panel)" :key="index" class="sl-log__line"
             :class="logClass(row)">
          <span v-if="row.age || row.at" class="sl-log__when">{{ show(row.age || row.at) }}</span>
          <span v-if="row.type || row.level" class="sl-log__kind">{{ show(row.type || row.level) }}</span>
          <span class="sl-log__text">{{ show(row.message || row.text || row.reason) }}</span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
/**
 * Every simulated family's dashboard, from one spec.
 *
 * **There is no component per family, and that is deliberate.** Seven families
 * with up to four dashboards each would be a dozen near-identical Vue files, and
 * the twelfth would drift from the first — a column renamed on the backend would
 * be fixed in three of them. `GUI_PANELS` in `labCatalogue.ts` says which panels
 * a family has, where each one's rows live in the backend's own `view` payload,
 * and which columns to draw; this renders that. Adding a family is a table entry
 * and `check:labs` proves every panel's path is one the payload can hold.
 *
 * Two rendering rules that are not cosmetic:
 *
 * **A missing path renders an EMPTY panel, never an error.** The lab service
 * deploys separately from this bundle, so a replica a release behind simply has
 * no `spark.jobs` yet. `pick` answers `undefined` and `rowsAt` answers `[]`.
 *
 * **Machine identifiers are `dir="ltr"`.** A container id, an ARN, an Azure
 * resource id and an HDFS path are all neutral-character strings, and inside
 * Arabic prose the bidi algorithm relocates their dots, slashes and hyphens.
 * Every column marked `code` gets the direction pinned, which is the same rule
 * `rtl.css` applies platform-wide.
 */
import { computed } from 'vue';
import { Gauge, RotateCw } from 'lucide-vue-next';
import {
  humanKey, panelsFor, rowsAt, statsAt,
  type GuiColumn, type GuiPanel,
} from '@/utils/labCatalogue';

const props = defineProps<{
  family: string;
  tools: string[];
  view: Record<string, unknown>;
  title?: string;
  busy?: boolean;
}>();

defineEmits<{ (event: 'refresh'): void }>();

const title = computed(() => props.title || 'Dashboard');
const panels = computed<GuiPanel[]>(() => panelsFor(props.family, props.tools));

function rows(panel: GuiPanel) {
  return rowsAt(props.view, panel.path);
}

function stats(panel: GuiPanel) {
  return statsAt(props.view, panel.path);
}

/**
 * The columns to draw.
 *
 * From the spec where there is one, and otherwise from the UNION of the rows'
 * keys — not the first row's, because a row whose optional field is absent would
 * drop that column for every row.
 */
function columnsOf(panel: GuiPanel): GuiColumn[] {
  if (panel.columns?.length) return panel.columns;
  const names: string[] = [];
  for (const row of rows(panel)) {
    for (const key of Object.keys(row)) {
      if (!names.includes(key)) names.push(key);
    }
  }
  return names.map(key => ({ key, label: humanKey(key), kind: 'text' as const }));
}

function show(value: unknown): string {
  if (value === null || value === undefined || value === '') return '—';
  if (value === true) return 'yes';
  if (value === false) return 'no';
  if (Array.isArray(value)) {
    return value.length ? value.map(item => show(item)).join(', ') : '—';
  }
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}

function cellClass(column: GuiColumn): string {
  if (column.kind === 'code') return 'sl-cell--code';
  if (column.kind === 'number') return 'sl-cell--num';
  return '';
}

/**
 * Which colour a state gets.
 *
 * By MEANING rather than by string, so `Running`, `running`, `Live`, `Ready`,
 * `SUCCEEDED` and `deployed` are all the same green — the seven engines each use
 * their own vocabulary and a per-engine table would be seven places to forget a
 * word.
 */
function badgeClass(value: unknown): string {
  const text = String(value ?? '').toLowerCase();
  if (!text) return 'sl-badge--quiet';
  if (/(running|ready|live|succeeded|active|deployed|healthy|available|complete|bound|yes|true)/.test(text)) {
    return 'sl-badge--good';
  }
  if (/(pending|creating|warning|paused|progress|waiting|accepted)/.test(text)) {
    return 'sl-badge--warn';
  }
  if (/(failed|error|exited|killed|critical|denied|dead|terminated|destroy)/.test(text)) {
    return 'sl-badge--bad';
  }
  return 'sl-badge--quiet';
}

function logClass(row: Record<string, unknown>): string {
  const level = String(row.type || row.level || '').toLowerCase();
  if (/(warning|warn)/.test(level)) return 'sl-log__line--warn';
  if (/(critical|error)/.test(level)) return 'sl-log__line--bad';
  return '';
}

/** An HDFS path indented by its depth, so the browser reads as a tree. */
function depth(path: unknown): number {
  const text = String(path ?? '/');
  const parts = text.split('/').filter(Boolean);
  return Math.min(6, parts.length) * 0.75 + 0.5;
}

const CARD_SKIP = new Set(['description', 'message', 'name', 'id', 'status',
                           'stages', 'sha', 'full', 'files', 'refs', 'parents']);

function cardFacts(row: Record<string, unknown>): Array<[string, unknown]> {
  return Object.entries(row)
    .filter(([key, value]) => !CARD_SKIP.has(key)
      && (value === null || typeof value !== 'object'))
    .slice(0, 8) as Array<[string, unknown]>;
}
</script>
