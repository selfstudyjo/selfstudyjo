<template>
  <figure class="lb-chart">
    <figcaption class="lb-chart__head">
      <div class="lb-chart__titles">
        <h3 class="lb-chart__title">{{ title }}</h3>
        <p v-if="subtitle" class="lb-chart__subtitle">{{ subtitle }}</p>
      </div>
      <span v-if="badge" class="lb-chart__badge">{{ badge }}</span>
    </figcaption>

    <div v-if="!hasData" class="lb-chart__empty">
      <span class="lb-chart__emptyMark" aria-hidden="true"></span>
      <p>{{ emptyText }}</p>
    </div>

    <template v-else>
      <!--
        The wrapper carries the height, not the canvas, and it is sized to
        include the x-axis band. A container whose fixed height fits only the
        plot gives the card a tiny nested scrollbar for the axis labels.
      -->
      <div class="lb-chart__plot" :style="{ height: height + 'px' }">
        <canvas ref="canvas" role="img" :aria-label="ariaLabel"></canvas>
      </div>

      <!--
        Every chart's WCAG-clean twin, from the same array the chart is drawn
        from so the two cannot disagree. A tooltip enhances and never gates:
        this is where a screen reader, a printout and `forced-colors` read the
        values, and it is why no chart here needs a number on every mark.
      -->
      <details class="lb-chart__table">
        <summary>Show the numbers</summary>
        <table>
          <thead>
            <tr>
              <th scope="col">{{ categoryLabel }}</th>
              <th scope="col">{{ valueLabel }}</th>
              <th scope="col">Share</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="row in tableRows" :key="row.label">
              <th scope="row">{{ row.label }}</th>
              <td>{{ row.value.toLocaleString() }}</td>
              <td>{{ (row.share * 100).toFixed(1) }}%</td>
            </tr>
          </tbody>
        </table>
      </details>
    </template>
  </figure>
</template>

<script setup lang="ts">
/**
 * One chart card: the plot, its caption, and the table view underneath it.
 *
 * THE ONE THING TO UNDERSTAND BEFORE CHANGING ANYTHING HERE
 *
 * **Chart.js paints into a canvas, so it cannot read a CSS custom property.**
 * Every other component on this platform spends `var(--sfs-…)` and gets the
 * right colour in all ten galaxies for free; a canvas gets whatever hex it was
 * handed at construction. `UserResults.vue` is the cautionary case — it draws
 * its line in a literal `#42a5f5`, which is Andromeda-ish and simply wrong in
 * the other nine.
 *
 * So the tokens are *resolved* off the document with `getComputedStyle` and the
 * chart is rebuilt when they change. `apply.ts` sets `data-theme` on `<html>`,
 * which is the signal a `MutationObserver` watches; rebuilding rather than
 * recolouring is the same call `AnimatedBackground.vue` makes, and for the same
 * reason — a recolour path only runs on a theme change and is therefore the one
 * nobody notices is broken.
 *
 * WHY EVERY CHART ON THIS PAGE IS ONE HUE
 *
 * Measured, not assumed. A galaxy's three accents are chosen for *harmony*,
 * which is the opposite of what a categorical palette needs, and running the
 * ten trios through the OKLab/CVD checks says so plainly: no pair of accents
 * clears the normal-vision separation floor in every galaxy, and Triangulum's
 * accent and accent-2 are **ΔE 0.8 apart under deuteranopia** — the same colour
 * to a deuteranope. Two series in those two colours is one series with extra
 * steps.
 *
 * Every chart here therefore encodes magnitude or emphasis, never identity, and
 * spends exactly one hue: `--sfs-accent`, which the theme derivation guarantees
 * at 3.74:1 or better against the card in all ten (worst case Triangulum, best
 * Sunflower at 10.7:1) — clear of the 3:1 mark floor. Where an ordering has to
 * be read, the *axis* carries it. If a second series is ever genuinely needed
 * here, it is two charts or small multiples, not a second accent.
 *
 * The rest is the fixed mark spec: 2px lines, ≥8px end markers with a 2px
 * surface ring, bars capped at 24px with a 4px rounded data-end and a square
 * baseline, an area fill at 10%, and solid hairline gridlines one step off the
 * surface. Nothing is dashed and nothing is outlined — the gap and the ring do
 * the separating.
 */
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import Chart from 'chart.js/auto';
import { tableFor } from '@/utils/leaderboardEngine';

interface Props {
    title: string;
    subtitle?: string;
    badge?: string;
    kind: 'bar' | 'column' | 'area';
    labels: string[];
    values: number[];
    /** Column header for the table twin. */
    categoryLabel?: string;
    valueLabel?: string;
    emptyText?: string;
    height?: number;
    /** Index to lift out of the set — the extreme, the one the story is about. */
    emphasis?: number | null;
}

const props = withDefaults(defineProps<Props>(), {
    subtitle: '',
    badge: '',
    categoryLabel: 'Category',
    valueLabel: 'Count',
    emptyText: 'Nothing to plot for this period yet.',
    height: 240,
    emphasis: null,
});

const canvas = ref<HTMLCanvasElement | null>(null);
let chart: Chart | null = null;
let themeWatcher: MutationObserver | null = null;

/*
  An all-zero series is not data.

  A distribution with nothing in it draws five bars of length zero along an
  axis that reads 0 to 1, which looks exactly like a chart that failed to load.
  Saying so in words is both more honest and less alarming.
*/
const hasData = computed(() =>
    props.values.length > 0 && props.values.some(value => Number(value) > 0));

const tableRows = computed(() =>
    tableFor(props.labels.map((label, index) => ({ label, value: Number(props.values[index]) || 0 }))));

const ariaLabel = computed(() => {
    const total = props.values.reduce((n, value) => n + (Number(value) || 0), 0);
    return `${props.title}. ${props.labels.length} categories, ${total.toLocaleString()} in total. `
        + 'The same figures are in the table below.';
});

/** A resolved token value, or the fallback if the theme has not applied yet. */
function token(name: string, fallback: string): string {
    if (typeof window === 'undefined') return fallback;
    const value = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
    return value || fallback;
}

/** `rgb(r g b / a)` from a `--sfs-*-rgb` channel triple. */
function channels(name: string, alpha: number, fallback: string): string {
    const triple = token(name, '');
    return triple ? `rgb(${triple} / ${alpha})` : fallback;
}

function palette() {
    return {
        // One hue. See the header — this is the only series colour on the page.
        accent: token('--sfs-accent', '#667eea'),
        wash: channels('--sfs-accent-rgb', 0.1, 'rgba(102, 126, 234, 0.1)'),
        /* Emphasis de-emphasis: the same hue at a fraction rather than a
           neutral grey. `--sfs-text-faint` is derived to clear 3:1 and in
           Andromeda measures 6.4:1 against the card while the accent measures
           3.9:1 — so a grey "context" mark would be LOUDER than the mark it is
           meant to recede behind, and the emphasis would read backwards. */
        muted: channels('--sfs-accent-rgb', 0.28, 'rgba(102, 126, 234, 0.28)'),
        ink: token('--sfs-text', '#e8ecff'),
        inkMuted: token('--sfs-text-muted', '#a9b1d6'),
        grid: channels('--sfs-line-rgb', 0.14, 'rgba(255, 255, 255, 0.14)'),
        // The 2px ring that keeps an end marker legible where it crosses the
        // line, and the tooltip's ground.
        surface: token('--sfs-surface-3', '#1b1e33'),
        border: token('--sfs-border', 'rgba(255, 255, 255, 0.14)'),
    };
}

const reducedMotion = () =>
    typeof window !== 'undefined'
    && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true;

/**
 * One colour per bar, on one hue.
 *
 * Emphasis is not a categorical palette: every bar is the same colour except the
 * one the story is about, so nothing is being told apart by hue. With no index
 * named, every bar is the accent — a nominal set gets one colour, never a
 * darker-where-bigger ramp, which would spend the only free channel re-encoding
 * what bar length already shows.
 */
function barPaint(colour: ReturnType<typeof palette>): string[] {
    return props.values.map((_, index) =>
        props.emphasis === null || props.emphasis === index ? colour.accent : colour.muted);
}

function build() {
    if (!canvas.value || !hasData.value) return;
    if (chart) { chart.destroy(); chart = null; }

    const ctx = canvas.value.getContext('2d');
    if (!ctx) return;

    const colour = palette();
    const horizontal = props.kind === 'bar';
    const area = props.kind === 'area';
    const barColours = barPaint(colour);

    chart = new Chart(ctx, {
        type: area ? 'line' : 'bar',
        data: {
            labels: props.labels,
            datasets: [{
                label: props.valueLabel,
                data: props.values,
                backgroundColor: area ? colour.wash : barColours,
                borderColor: colour.accent,
                borderWidth: area ? 2 : 0,
                fill: area,
                tension: area ? 0.32 : 0,
                // ≥8px marker (r 4) with a 2px surface ring, and only at the
                // hover point: a dot on all thirty days of a month is noise.
                pointRadius: 0,
                pointHoverRadius: 5,
                pointHoverBorderWidth: 2,
                pointHoverBorderColor: colour.surface,
                pointHoverBackgroundColor: colour.accent,
                pointBackgroundColor: colour.accent,
                // Cap the mark and let the band's leftover be air. 4px rounded
                // data-end, square where it meets the baseline.
                maxBarThickness: 24,
                borderRadius: area ? 0 : 4,
                borderSkipped: horizontal ? 'left' : 'bottom',
            }],
        },
        options: {
            indexAxis: horizontal ? 'y' : 'x',
            responsive: true,
            maintainAspectRatio: false,
            animation: reducedMotion() ? false : { duration: 420 },
            // The hit target is the whole band, not the painted pixels, so a
            // 3-high bar is as hoverable as a full one.
            interaction: { mode: 'index', intersect: false },
            layout: { padding: { top: 4, right: 8, bottom: 0, left: 0 } },
            plugins: {
                // One series: the caption already names what is plotted, so a
                // legend box with a single swatch restates the title and costs
                // space.
                legend: { display: false },
                tooltip: {
                    backgroundColor: colour.surface,
                    borderColor: colour.border,
                    borderWidth: 1,
                    // Value leads, label follows — the reader has the category
                    // and wants the number.
                    titleColor: colour.inkMuted,
                    titleFont: { size: 11, weight: 500 },
                    bodyColor: colour.ink,
                    bodyFont: { size: 14, weight: 600 },
                    padding: 10,
                    displayColors: false,
                    callbacks: {
                        label: item => ` ${Number(item.parsed[horizontal ? 'x' : 'y']).toLocaleString()}`
                            + ` ${props.valueLabel.toLowerCase()}`,
                    },
                },
            },
            scales: {
                x: {
                    // Solid hairline, one step off the surface, recessive. Never
                    // dashed: dashing reads as a projection or a threshold.
                    grid: {
                        display: horizontal,
                        color: colour.grid,
                        lineWidth: 1,
                        drawTicks: false,
                    },
                    border: { display: false },
                    ticks: {
                        color: colour.inkMuted,
                        font: { size: 11 },
                        maxRotation: 0,
                        autoSkipPadding: 12,
                        precision: horizontal ? 0 : undefined,
                    },
                    beginAtZero: horizontal,
                },
                y: {
                    grid: {
                        display: !horizontal,
                        color: colour.grid,
                        lineWidth: 1,
                        drawTicks: false,
                    },
                    border: { display: false },
                    ticks: {
                        color: colour.inkMuted,
                        font: { size: 11 },
                        precision: horizontal ? undefined : 0,
                        autoSkip: true,
                        maxTicksLimit: horizontal ? 12 : 5,
                        /*
                          A category label that will not fit is SHORTENED, never
                          clipped.

                          Chart.js draws a y-axis tick label at whatever length it
                          is and lets the canvas cut it off, so at 390px
                          "Information Security Fundamentals" rendered as
                          "ormation Security Fundamentals" — the first characters
                          gone, which is worse than no label because it reads as a
                          different course. An ellipsis at the end says "there is
                          more of this name" instead.

                          Nothing is lost: the full name is in the tooltip (whose
                          title comes from the raw label, not from this callback)
                          and in the table view underneath. The budget is capped as
                          well as floored, so one very long title cannot eat the
                          plot area on a wide screen either.
                        */
                        callback(this: any, value: any) {
                            const raw = String(this.getLabelForValue(value));
                            if (!horizontal) return raw;
                            const budget = Math.max(14, Math.min(34,
                                Math.floor((this.chart?.width ?? 320) / 11.5)));
                            return raw.length <= budget
                                ? raw
                                : `${raw.slice(0, budget - 1).trimEnd()}…`;
                        },
                    },
                    beginAtZero: !horizontal,
                },
            },
        },
    });
}

onMounted(() => {
    build();
    /*
      Rebuild when the galaxy changes.

      `data-theme` on <html> is what `apply.ts` writes, so it is the one signal
      that is true for every route into a theme change — the picker, the initial
      bootstrap, and a second tab writing localStorage. Watching the picker
      component instead would miss the last two.
    */
    if (typeof MutationObserver !== 'undefined') {
        themeWatcher = new MutationObserver(() => build());
        themeWatcher.observe(document.documentElement, {
            attributes: true, attributeFilter: ['data-theme', 'data-mode'],
        });
    }
});

// A Chart holds a canvas context and a resize listener. Ten navigations without
// this is ten live charts against detached canvases — the same class of leak
// `AnimatedBackground.vue`'s `teardown()` exists for.
onBeforeUnmount(() => {
    themeWatcher?.disconnect();
    themeWatcher = null;
    chart?.destroy();
    chart = null;
});

/*
  New data updates the chart; a new SHAPE rebuilds it.

  `watch` on a getter that returns a fresh array fires on every re-evaluation,
  because Vue compares the watched value by reference — `deep` changes what is
  tracked, not how it is compared. So the first version destroyed and
  reconstructed all three charts whenever any computed on the page was touched,
  which restarts the entry animation each time: on a page whose filter row
  re-derives everything on every keystroke, the charts visibly replayed their
  animation as the reader typed. Comparing a cheap signature makes a no-op change
  genuinely free.

  A changed `kind` or emphasis index is a different chart *configuration*, so
  that one really does need `build()`.
*/
const signature = computed(() => JSON.stringify([props.labels, props.values]));
const shape = computed(() => `${props.kind}|${props.emphasis}`);

watch(shape, () => build());

watch(signature, () => {
    if (!chart) { build(); return; }
    chart.data.labels = props.labels;
    chart.data.datasets[0].data = props.values;
    // The bar count can change with the data, so the per-bar colour array has to
    // be rebuilt rather than left at its old length — a shorter array leaves
    // Chart.js cycling it, which would put the emphasis on the wrong bar.
    if (props.kind !== 'area') {
        chart.data.datasets[0].backgroundColor = barPaint(palette());
    }
    chart.update();
});

/*
  `v-if="hasData"` means the canvas comes and goes.

  Building on mount alone leaves a chart that never appears when the first load
  arrives empty and a later window has data — the canvas did not exist when
  `build()` ran. And going the other way, a Chart left alive against a canvas Vue
  has just removed keeps its resize listener and repaints into nothing.
*/
watch(hasData, async present => {
    if (present) {
        await nextTick();
        build();
    } else {
        chart?.destroy();
        chart = null;
    }
});
</script>
