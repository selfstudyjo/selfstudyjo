<template>
  <!--
    Live preview of a CV.

    It reads the same template spec the exporters read (fetched from
    /api/cv/templates), so the three layouts, heading styles, fonts and accent
    colours here are the ones that end up in the downloaded PDF or DOCX. When a
    template is added on the backend it appears here with no change to this file.
  -->
  <div class="cv-preview-shell">
    <div
      class="cv-page"
      :class="[`layout-${layout}`, `heading-${headingStyle}`, `density-${density}`]"
      :style="pageStyle"
    >
      <!-- Coloured banner header -->
      <header v-if="layout === 'banner'" class="cv-banner">
        <div class="cv-banner-text">
          <h1>{{ personal.full_name || 'Your Name' }}</h1>
          <p v-if="personal.headline" class="cv-headline">{{ personal.headline }}</p>
          <p v-if="contact.length" class="cv-contact">
            <span v-for="(item, i) in contact" :key="item.key">
              <span v-if="i" class="cv-sep">•</span>{{ item.value }}
            </span>
          </p>
        </div>
        <div v-if="photoSrc && spec?.photo === 'header'" class="cv-photo" :class="photoShapeClass">
          <img :src="photoSrc" alt="" />
        </div>
      </header>

      <!-- Two-column layout -->
      <div v-if="layout === 'sidebar'" class="cv-columns">
        <aside class="cv-sidebar" :style="sidebarStyle">
          <div v-if="photoSrc && spec?.photo === 'sidebar'" class="cv-photo cv-photo-side" :class="photoShapeClass">
            <img :src="photoSrc" alt="" />
          </div>
          <h1 class="cv-side-name">{{ personal.full_name || 'Your Name' }}</h1>
          <p v-if="personal.headline" class="cv-side-headline">{{ personal.headline }}</p>

          <template v-if="contact.length">
            <h3 class="cv-side-heading">{{ $t('Contact') }}</h3>
            <p v-for="item in contact" :key="item.key" class="cv-side-line">{{ item.value }}</p>
          </template>

          <template v-for="section in sidebarSections" :key="`side-${section.key}`">
            <h3 class="cv-side-heading">{{ titleFor(section.key) }}</h3>
            <!-- sideHtml() escapes every value it interpolates; the only markup
                 it emits is its own <strong> and <br>. -->
            <div class="cv-side-body" v-html="sideHtml(section)"></div>
          </template>
        </aside>

        <main class="cv-main">
          <section v-for="section in mainSections" :key="section.key" class="cv-section">
            <h2 class="cv-section-title">{{ titleFor(section.key) }}</h2>
            <div class="cv-section-body">
              <CvSectionBody :section="section" />
            </div>
          </section>
        </main>
      </div>

      <!-- Single column -->
      <template v-else>
        <header v-if="layout === 'single'" class="cv-plain-header" :class="{ centred: centred }">
          <div v-if="photoSrc && spec?.photo === 'header'" class="cv-photo" :class="photoShapeClass">
            <img :src="photoSrc" alt="" />
          </div>
          <h1>{{ personal.full_name || 'Your Name' }}</h1>
          <p v-if="personal.headline" class="cv-headline">{{ personal.headline }}</p>
          <p v-if="contact.length" class="cv-contact">
            <span v-for="(item, i) in contact" :key="item.key">
              <span v-if="i" class="cv-sep">•</span>{{ item.value }}
            </span>
          </p>
        </header>

        <main class="cv-main">
          <section v-for="section in mainSections" :key="section.key" class="cv-section">
            <h2 class="cv-section-title">{{ titleFor(section.key) }}</h2>
            <div class="cv-section-body">
              <CvSectionBody :section="section" />
            </div>
          </section>
        </main>
      </template>

      <p v-if="!mainSections.length && !sidebarSections.length" class="cv-empty">
        {{ $t('Nothing to show yet. Fill in the editor and this preview updates as you type.') }}
      </p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, defineComponent, h } from 'vue';
import type { CvRecord, CvSectionKey, CvTemplate } from '@/services/cvbuilder.service';

const props = defineProps<{
  cv: CvRecord | null;
  spec: CvTemplate | null;
  /** Section titles from the API, so preview and export agree on wording. */
  sectionTitles?: Record<string, string>;
  avatars?: { key: string; data_url: string }[];
}>();

const FALLBACK_TITLES: Record<string, string> = {
  summary: 'Professional Summary',
  experience: 'Experience',
  education: 'Education',
  skills: 'Skills',
  projects: 'Projects',
  certifications: 'Certifications',
  languages: 'Languages',
  awards: 'Awards & Honours',
  volunteering: 'Volunteering',
  publications: 'Publications',
  interests: 'Interests',
  references: 'References',
};

const personal = computed(() => props.cv?.personal || ({} as any));
const layout = computed(() => props.spec?.layout || 'single');
const headingStyle = computed(() => props.spec?.heading || 'plain');
const density = computed(() => props.spec?.density || 'normal');
const centred = computed(() => props.spec?.key === 'classic');

const accent = computed(() =>
  (props.cv?.accent_color || props.spec?.accent || '#4F46E5'));

const fontFamily = computed(() => (props.cv?.font || props.spec?.font) === 'serif'
  ? "Georgia, 'Times New Roman', serif"
  : "'Inter', 'Segoe UI', system-ui, sans-serif");

const pageStyle = computed(() => ({
  '--cv-accent': accent.value,
  '--cv-accent-soft': tint(accent.value, 0.86),
  '--cv-accent-line': tint(accent.value, 0.45),
  fontFamily: fontFamily.value,
}));

const sidebarStyle = computed(() => ({
  background: accent.value,
  color: isLight(accent.value) ? '#111827' : '#ffffff',
}));

const photoShapeClass = computed(() => `shape-${props.cv?.photo?.shape || 'circle'}`);

/** The uploaded photo, or the chosen default avatar - matching the exporters' rule. */
const photoSrc = computed(() => {
  const photo = props.cv?.photo;
  if (!photo || photo.show === false) return '';
  if (photo.data_url) return photo.data_url;
  if (photo.avatar) {
    return props.avatars?.find(a => a.key === photo.avatar)?.data_url || '';
  }
  return '';
});

interface Section { key: CvSectionKey; value: any }

const visibleSections = computed<Section[]>(() => {
  const cv = props.cv;
  if (!cv) return [];
  const hidden = new Set(cv.hidden_sections || []);
  const out: Section[] = [];
  for (const key of (cv.sections_order || []) as CvSectionKey[]) {
    if (hidden.has(key)) continue;
    if (key === 'summary') {
      if (cv.personal?.summary?.trim()) out.push({ key, value: cv.personal.summary });
      continue;
    }
    const value = (cv as any)[key];
    if (Array.isArray(value) ? value.length : value) out.push({ key, value });
  }
  return out;
});

const sidebarSections = computed<Section[]>(() => {
  if (layout.value !== 'sidebar') return [];
  const wanted = new Set(props.spec?.sidebar_sections || []);
  return visibleSections.value.filter(s => wanted.has(s.key));
});

const mainSections = computed<Section[]>(() => {
  if (layout.value !== 'sidebar') return visibleSections.value;
  const wanted = new Set(props.spec?.sidebar_sections || []);
  return visibleSections.value.filter(s => !wanted.has(s.key));
});

const contact = computed(() => {
  const p = personal.value;
  return [
    { key: 'email', value: p.email },
    { key: 'phone', value: p.phone },
    { key: 'location', value: p.location },
    { key: 'website', value: p.website },
    { key: 'linkedin', value: p.linkedin },
    { key: 'github', value: p.github },
    { key: 'nationality', value: p.nationality },
  ].filter(item => !!(item.value || '').trim());
});

function titleFor(key: string) {
  return props.sectionTitles?.[key] || FALLBACK_TITLES[key] || key;
}

function escapeHtml(value: any) {
  return String(value ?? '').replace(/[&<>"']/g, ch => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch] as string));
}

/** The sidebar variants: stacked and terse, matching the exporters. */
function sideHtml(section: Section) {
  const { key, value } = section;
  if (key === 'skills') {
    return (value as any[]).map(group => (group.category
      ? `<strong>${escapeHtml(group.category)}</strong><br>${escapeHtml((group.items || []).join(', '))}`
      : escapeHtml((group.items || []).join(', ')))).join('<br>');
  }
  if (key === 'languages') {
    return (value as any[]).map(l =>
      escapeHtml(l.level ? `${l.name} — ${l.level}` : l.name)).join('<br>');
  }
  if (key === 'certifications') {
    return (value as any[]).map(c =>
      escapeHtml([c.name, c.issuer, c.date].filter(Boolean).join(' — '))).join('<br>');
  }
  if (key === 'interests') {
    return escapeHtml((value as string[]).join(', '));
  }
  return escapeHtml(Array.isArray(value) ? value.length + ' items' : value);
}

function dateRange(start?: string, end?: string, current?: boolean) {
  const from = (start || '').trim();
  const to = current && !(end || '').trim() ? 'Present' : (end || '').trim();
  return from && to ? `${from} – ${to}` : (from || to);
}

function tint(hex: string, weight: number) {
  const { r, g, b } = parseHex(hex);
  const mix = (c: number) => Math.round(c * (1 - weight) + 255 * weight);
  return `rgb(${mix(r)}, ${mix(g)}, ${mix(b)})`;
}

function isLight(hex: string) {
  const { r, g, b } = parseHex(hex);
  return 0.299 * r + 0.587 * g + 0.114 * b > 150;
}

function parseHex(hex: string) {
  let value = (hex || '').replace('#', '');
  if (value.length === 3) value = value.split('').map(c => c + c).join('');
  const int = parseInt(value || '4F46E5', 16);
  return { r: (int >> 16) & 255, g: (int >> 8) & 255, b: int & 255 };
}

/**
 * One entry's heading line, matching cvdoc.py's `entry_title` / `entry_head`:
 * bold subject, then the organisation also bold but in the accent colour, and
 * the dates right-aligned. Both halves are bold so the job is what the eye lands
 * on when a recruiter skims the page.
 */
function entryHead(primary?: string, secondary?: string, dates?: string) {
  return h('div', { class: 'cv-entry-head' }, [
    h('span', { class: 'cv-entry-title' }, [
      h('span', { class: 'cv-entry-role' }, primary || ''),
      secondary ? h('span', { class: 'cv-entry-org' }, ` — ${secondary}` ) : null,
    ]),
    dates ? h('span', { class: 'cv-entry-dates' }, dates) : null,
  ]);
}

/**
 * Section bodies are rendered with a render function rather than a dozen
 * v-if blocks in the template: the shapes differ enough per section that the
 * template version was harder to read than this.
 */
const CvSectionBody = defineComponent({
  name: 'CvSectionBody',
  props: { section: { type: Object, required: true } },
  setup(bodyProps) {
    return () => {
      const { key, value } = bodyProps.section as Section;

      if (key === 'summary') return h('p', { class: 'cv-text' }, String(value));

      if (key === 'experience' || key === 'volunteering') {
        return (value as any[]).map(entry => h('div', { class: 'cv-entry' }, [
          entryHead(entry.role, entry.company || entry.organisation,
                    dateRange(entry.start, entry.end, entry.current)),
          h('div', { class: 'cv-entry-body' }, [
            entry.location ? h('p', { class: 'cv-entry-meta' }, entry.location) : null,
            entry.description ? h('p', { class: 'cv-text' }, entry.description) : null,
            (entry.bullets || []).length
              ? h('ul', { class: 'cv-bullets' },
                  (entry.bullets as string[]).filter(Boolean).map(b => h('li', b)))
              : null,
            (entry.tech || []).length
              ? h('p', { class: 'cv-tech' }, `Tech: ${(entry.tech as string[]).join(', ')}`)
              : null,
          ]),
        ]));
      }

      if (key === 'education') {
        return (value as any[]).map(entry => h('div', { class: 'cv-entry' }, [
          entryHead([entry.degree, entry.field].filter(Boolean).join(' in '),
                    entry.institution, dateRange(entry.start, entry.end)),
          h('div', { class: 'cv-entry-body' }, [
            entry.location ? h('p', { class: 'cv-entry-meta' }, entry.location) : null,
            entry.grade ? h('p', { class: 'cv-text' }, `Grade: ${entry.grade}`) : null,
            entry.details ? h('p', { class: 'cv-text' }, entry.details) : null,
          ]),
        ]));
      }

      if (key === 'skills') {
        return (value as any[]).map(group => h('p', { class: 'cv-text' }, [
          group.category ? h('strong', `${group.category}: `) : null,
          (group.items || []).join(', '),
        ]));
      }

      if (key === 'projects') {
        return (value as any[]).map(entry => h('div', { class: 'cv-entry' }, [
          entryHead(entry.name || 'Project', '', dateRange(entry.start, entry.end)),
          h('div', { class: 'cv-entry-body' }, [
            entry.description ? h('p', { class: 'cv-text' }, entry.description) : null,
            (entry.bullets || []).length
              ? h('ul', { class: 'cv-bullets' },
                  (entry.bullets as string[]).filter(Boolean).map(b => h('li', b)))
              : null,
            (entry.tech || []).length
              ? h('p', { class: 'cv-tech' }, `Tech: ${(entry.tech as string[]).join(', ')}`)
              : null,
            entry.link ? h('p', { class: 'cv-link' }, entry.link) : null,
          ]),
        ]));
      }

      if (key === 'certifications') {
        return h('ul', { class: 'cv-bullets' }, (value as any[]).map(entry =>
          h('li', [entry.name, entry.issuer, entry.date].filter(Boolean).join(' — '))));
      }

      if (key === 'languages') {
        return h('p', { class: 'cv-text' }, (value as any[]).map(l =>
          l.level ? `${l.name} (${l.level})` : l.name).join(', '));
      }

      if (key === 'awards' || key === 'publications') {
        return h('ul', { class: 'cv-bullets' }, (value as any[]).map(entry =>
          h('li', [entry.name || entry.title, entry.issuer || entry.publisher, entry.date]
            .filter(Boolean).join(' — '))));
      }

      if (key === 'interests') {
        return h('p', { class: 'cv-text' }, (value as string[]).join(', '));
      }

      if (key === 'references') {
        return (value as any[]).map(entry => h('div', { class: 'cv-entry' }, [
          entryHead(entry.name,
                    [entry.title, entry.company].filter(Boolean).join(' — '), ''),
          h('div', { class: 'cv-entry-body' }, [
            h('p', { class: 'cv-entry-meta' },
              [entry.email, entry.phone].filter(Boolean).join(' | ')),
          ]),
        ]));
      }

      return null;
    };
  },
});
</script>

<style scoped>
.cv-preview-shell {
  /* A4 aspect, scaled to fit its column. The preview is a document, so it keeps
     a white page on the dark app background rather than inheriting the theme. */
  width: 100%;
  display: flex;
  justify-content: center;
}

.cv-page {
  width: 100%;
  max-width: 780px;
  min-height: 500px;
  background: var(--sfs-paper, #ffffff);
  color: var(--sfs-on-paper, #1f2937);
  border-radius: 6px;
  box-shadow: 0 18px 50px rgba(0, 0, 0, 0.45);
  overflow: hidden;
  font-size: 12.5px;
  line-height: 1.5;
  /* A CV is read, not scanned as UI: turn on the typographic niceties and let
     dates line up in a column by using tabular figures. */
  -webkit-font-smoothing: antialiased;
  text-rendering: optimizeLegibility;
  font-kerning: normal;
  font-variant-numeric: tabular-nums;
  /* `entry` shifts an entry's body right of its bold title, `bullet` shifts the
     bullet text a further step. Both mirror entry_indent / bullet_hang in the
     backend's templates.DENSITY, converted from points to ems. */
  --cv-indent-entry: 0.9em;
  --cv-indent-bullet: 1.1em;
}

.density-airy {
  font-size: 13px; line-height: 1.62;
  --cv-indent-entry: 1em; --cv-indent-bullet: 1.2em;
}
.density-compact {
  font-size: 12px; line-height: 1.38;
  --cv-indent-entry: 0.75em; --cv-indent-bullet: 1em;
}

/* ── Banner header ─────────────────────────────────────────── */
.cv-banner {
  background: var(--cv-accent);
  color: var(--sfs-text, #fff);
  padding: 22px 26px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 18px;
}
.cv-banner h1 { font-size: 1.85rem; font-weight: 700; line-height: 1.15; margin-bottom: 3px; }
.cv-banner .cv-headline { font-size: 0.98rem; opacity: 0.94; margin-bottom: 6px; }
.cv-banner .cv-contact { font-size: 0.78rem; opacity: 0.92; }

/* ── Plain header ──────────────────────────────────────────── */
.cv-plain-header { padding: 26px 30px 10px; }
.cv-plain-header.centred { text-align: center; }
.cv-plain-header h1 { font-size: 1.8rem; font-weight: 700; color: var(--cv-accent); }
.cv-plain-header .cv-headline { font-size: 1rem; color: var(--sfs-accent-text, #374151); margin-top: 2px; }
.cv-plain-header .cv-contact { font-size: 0.78rem; color: var(--sfs-text-faint, #4b5563); margin-top: 6px; }
.cv-plain-header .cv-photo { margin-bottom: 10px; }
.cv-plain-header.centred .cv-photo { margin-inline-start: auto; margin-inline-end: auto; }

.cv-sep { margin: 0 7px; opacity: 0.6; }

/* ── Photo ─────────────────────────────────────────────────── */
.cv-photo {
  width: 84px; height: 84px; flex: 0 0 auto; overflow: hidden;
  background: var(--cv-accent-soft);
}
.cv-photo img { width: 100%; height: 100%; object-fit: cover; display: block; }
.cv-photo.shape-circle { border-radius: 50%; }
.cv-photo.shape-rounded { border-radius: 14px; }
.cv-photo.shape-square { border-radius: 2px; }
.cv-photo-side { width: 104px; height: 104px; margin: 0 auto 14px; }

/* ── Two-column ────────────────────────────────────────────── */
.cv-columns { display: grid; grid-template-columns: 33% 1fr; min-height: 500px; }
.cv-sidebar { padding: 24px 18px; }
.cv-side-name { font-size: 1.2rem; font-weight: 700; line-height: 1.2; }
.cv-side-headline { font-size: 0.85rem; opacity: 0.92; margin-bottom: 12px; }
.cv-side-heading {
  font-size: 0.76rem; font-weight: 700; letter-spacing: 0.08em;
  text-transform: uppercase; margin: 14px 0 5px; opacity: 0.95;
}
.cv-side-line, .cv-side-body { font-size: 0.79rem; line-height: 1.5; opacity: 0.95; }
.cv-side-body :deep(strong) { font-weight: 700; }

.cv-main { padding: 22px 26px 26px; }
.layout-sidebar .cv-main { padding: 24px 24px 26px; }

/* ── Sections ──────────────────────────────────────────────── */
.cv-section { margin-bottom: 14px; }
.density-airy .cv-section { margin-bottom: 18px; }
.density-compact .cv-section { margin-bottom: 10px; }

.cv-section-title {
  font-size: 0.86rem; font-weight: 800; letter-spacing: 0.09em;
  text-transform: uppercase; color: var(--cv-accent); margin-bottom: 8px;
}
.heading-bar .cv-section-title {
  background: var(--cv-accent-soft); padding: 4px 8px; border-radius: 3px;
}
.heading-rule .cv-section-title {
  border-bottom: 1.5px solid var(--cv-accent); padding-bottom: 3px;
}
.heading-caps .cv-section-title, .heading-plain .cv-section-title { color: #111827; }

/* ── Entry bodies ──────────────────────────────────────────────
   Everything below is produced by the CvSectionBody render function, not by this
   file's template. Vue stamps the scope attribute only on the node a child
   component returns as its root, so for a section that returns a *list* of
   entries the entries — and everything nested in them — carry no attribute at
   all. Reaching them needs :deep() from `.cv-section-body`, which is a template
   node and does carry it. Written as a plain `.cv-entry {}` these rules compile
   to `.cv-entry[data-v-…]` and silently match nothing. */
.cv-section-body :deep(.cv-entry) { margin-bottom: 11px; }
.cv-section-body :deep(.cv-entry:last-child) { margin-bottom: 0; }
.cv-section-body :deep(.cv-entry-head) {
  display: flex; justify-content: space-between; align-items: baseline; gap: 12px;
}
.cv-section-body :deep(.cv-entry-title) {
  font-size: 1.04em; font-weight: 700; color: #111827; letter-spacing: -0.005em;
}
/* Role and organisation are both bold — the job is what the eye should land on
   when skimming — and the accent colour is what keeps them readable as two
   things rather than one run-on phrase. Matches cvdoc.py's entry_title. */
.cv-section-body :deep(.cv-entry-role) { font-weight: 700; }
.cv-section-body :deep(.cv-entry-org) { font-weight: 700; color: var(--cv-accent); }
.cv-section-body :deep(.cv-entry-dates) {
  font-size: 0.76rem; color: var(--sfs-text-faint, #6b7280); font-style: italic; font-weight: 500;
  white-space: nowrap;
}

/* Everything under an entry's title is shifted right of it. */
.cv-section-body :deep(.cv-entry-body) { padding-inline-start: var(--cv-indent-entry); }
.cv-section-body :deep(.cv-entry-meta) {
  font-size: 0.79rem; color: var(--sfs-text-faint, #6b7280); font-style: italic;
}
.cv-section-body :deep(.cv-text) {
  margin: 3px 0; text-align: start; overflow-wrap: break-word;
}

.cv-section-body :deep(.cv-bullets) {
  margin: 4px 0 0;
  padding-inline-start: var(--cv-indent-bullet);
  list-style: disc outside;
}
.cv-section-body :deep(.cv-bullets li) { margin-bottom: 3px; padding-inline-start: 0.12em; }
.cv-section-body :deep(.cv-bullets li::marker) {
  color: var(--cv-accent); font-size: 0.92em;
}

.cv-section-body :deep(.cv-tech) {
  font-size: 0.78rem; color: var(--sfs-text-faint, #4b5563); font-style: italic; margin-top: 3px;
}
.cv-section-body :deep(.cv-link) {
  font-size: 0.78rem; color: var(--sfs-accent-text, #1d4ed8); word-break: break-all;
}

/* Sections whose whole body is one bare list (certifications, awards,
   publications) have no entry title to hang under, so the list carries the entry
   indent itself and lines up with the bullets in the sections that do. */
.cv-section-body > :deep(.cv-bullets) {
  padding-inline-start: calc(var(--cv-indent-entry) + var(--cv-indent-bullet));
}

.cv-empty { padding: 40px 26px; text-align: center; color: var(--sfs-text-muted, #9ca3af); font-size: 0.9rem; }

@media (max-width: 720px) {
  .cv-columns { grid-template-columns: 1fr; }
  .cv-banner { flex-direction: column; text-align: center; }
  .cv-page { font-size: 11.5px; }
}
</style>
