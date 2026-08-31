<template>
  <!--
    The galaxy picker.

    Rendered as a dialog rather than a dropdown because the choice is worth
    seeing at size: each card is a real preview built from that theme's own
    tokens, so what a galaxy looks like is visible before it is applied rather
    than after.
  -->
  <div class="tp-root">
    <button
      class="tp-trigger"
      :class="{ 'tp-collapsed': collapsed }"
      type="button"
      :title="collapsed ? $t('Theme: {v0}', { v0: themeStore.theme.name }) : undefined"
      :aria-label="$t('Change theme — currently {v0}', { v0: themeStore.theme.name })"
      @click="open = true"
    >
      <span class="tp-trigger-swatch" :style="swatchStyle(themeStore.theme)" aria-hidden="true"></span>
      <span v-if="!collapsed" class="tp-trigger-text">
        <span class="tp-trigger-label">{{ $t('Theme') }}</span>
        <span class="tp-trigger-name">{{ themeStore.theme.name }}</span>
      </span>
    </button>

    <Teleport to="body">
      <div
        v-if="open"
        class="tp-overlay"
        role="dialog"
        aria-modal="true"
        aria-labelledby="tp-title"
        @click.self="open = false"
        @keydown.esc="open = false"
      >
        <div class="tp-panel" ref="panel" tabindex="-1" @keydown="onKeydown">
          <header class="tp-head">
            <div>
              <h2 id="tp-title" class="tp-title">{{ $t('Choose your galaxy') }}</h2>
              <p class="tp-sub">
                {{ $t('Ten palettes. Text colour is worked out from whatever it sits on, so every one stays readable.') }}
              </p>
            </div>
            <button class="tp-close" type="button" :aria-label="$t('Close')" @click="open = false">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
                <path d="M6 6l12 12M18 6L6 18" />
              </svg>
            </button>
          </header>

          <!--
            A quick dark/light switch above the grid. Ten named galaxies with
            no obvious "make it light" among them is the one thing a list like
            this gets wrong, and it is the switch most people look for first.
          -->
          <div class="tp-modes" role="group" :aria-label="$t('Appearance')">
            <button
              v-for="m in (['dark', 'light'] as const)"
              :key="m"
              type="button"
              class="tp-mode"
              :class="{ 'is-on': themeStore.mode === m }"
              :aria-pressed="themeStore.mode === m"
              @click="themeStore.mode === m ? null : themeStore.toggleMode()"
            >
              <component :is="m === 'dark' ? MoonIcon : SunIcon" />
              {{ m === 'dark' ? $t('Dark') : $t('Light') }}
            </button>
          </div>

          <ul class="tp-grid" role="listbox" :aria-activedescendant="`tp-opt-${themeStore.themeId}`">
            <li v-for="(t, i) in themeStore.themes" :key="t.id">
              <button
                :id="`tp-opt-${t.id}`"
                ref="cards"
                type="button"
                role="option"
                class="tp-card"
                :class="{ 'is-active': t.id === themeStore.themeId }"
                :aria-selected="t.id === themeStore.themeId"
                :style="cardStyle(t)"
                @click="pick(t.id)"
                @focus="focusIndex = i"
              >
                <!--
                  The preview is the theme's own galaxy drawn in CSS — the same
                  five colours AnimatedBackground.vue feeds to three.js, as
                  layered radial gradients. It is not a stand-in for the real
                  thing, it is the real thing at rest.
                -->
                <span class="tp-sky" :style="skyStyle(t)" aria-hidden="true">
                  <span class="tp-core" :style="coreStyle(t)"></span>
                  <span class="tp-arm tp-arm-a" :style="armStyle(t, 1)"></span>
                  <span class="tp-arm tp-arm-b" :style="armStyle(t, -1)"></span>
                  <!-- A miniature of the app on top of it: a card, a line of
                       body text and a filled button, each using the tokens the
                       real page would use. If a theme is unreadable, it is
                       unreadable here. -->
                  <span class="tp-mini">
                    <span class="tp-mini-bar"></span>
                    <span class="tp-mini-line"></span>
                    <span class="tp-mini-btn">Aa</span>
                  </span>
                </span>

                <span class="tp-meta">
                  <span class="tp-name">
                    {{ t.name }}
                    <svg v-if="t.id === themeStore.themeId" class="tp-tick" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
                      <path d="M20 6L9 17l-5-5" />
                    </svg>
                  </span>
                  <span class="tp-tagline">{{ t.tagline }}</span>
                  <!-- The two branches spelled out rather than `$t(t.mode)`:
                       `check:i18n` scans for LITERAL keys, so a dynamic one is
                       reported as a catalogue entry nothing asks for. -->
                  <span class="tp-mode-tag">{{ t.mode === 'dark' ? $t('Dark') : $t('Light') }}</span>
                </span>
              </button>
            </li>
          </ul>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<script setup lang="ts">
import { h, nextTick, ref, watch } from 'vue';
import { useThemeStore } from '@/store/theme';
import type { Theme } from '@/theme/themes';

defineProps<{ collapsed?: boolean }>();

const themeStore = useThemeStore();
const open = ref(false);
const panel = ref<HTMLElement | null>(null);
const cards = ref<HTMLElement[]>([]);
const focusIndex = ref(0);

const SunIcon = {
  render: () => h('svg', { width: 16, height: 16, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', 'stroke-width': 2, 'stroke-linecap': 'round' }, [
    h('circle', { cx: 12, cy: 12, r: 4 }),
    h('path', { d: 'M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4' }),
  ]),
};
const MoonIcon = {
  render: () => h('svg', { width: 16, height: 16, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', 'stroke-width': 2, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }, [
    h('path', { d: 'M21 12.8A9 9 0 1111.2 3a7 7 0 009.8 9.8z' }),
  ]),
};

function pick(id: string) {
  themeStore.setTheme(id);
}

/**
 * Each card paints itself in ITS OWN theme's tokens, not the active one — so
 * the preview is honest. That means overriding the custom properties locally
 * rather than reading them from :root, which is exactly what a scoped style
 * block cannot do.
 */
function cardStyle(t: Theme): Record<string, string> {
  const v = t.vars;
  return {
    '--c-space': v['--sfs-space'],
    '--c-surface': v['--sfs-surface-2'],
    '--c-text': v['--sfs-text'],
    '--c-muted': v['--sfs-text-muted'],
    '--c-accent': v['--sfs-accent'],
    '--c-on-accent': v['--sfs-on-accent'],
    '--c-border': v['--sfs-border'],
  };
}

function skyStyle(t: Theme): Record<string, string> {
  return { background: t.galaxy.space };
}

function coreStyle(t: Theme): Record<string, string> {
  return {
    background: `radial-gradient(circle, ${t.galaxy.core} 0%, ${t.galaxy.inner} 35%, transparent 70%)`,
  };
}

function armStyle(t: Theme, dir: number): Record<string, string> {
  return {
    background: `conic-gradient(from ${dir > 0 ? 20 : 200}deg, transparent 0deg, ${t.galaxy.mid} 40deg, ${t.galaxy.outer} 90deg, transparent 150deg)`,
    transform: `rotate(${dir * 18}deg)`,
  };
}

function swatchStyle(t: Theme): Record<string, string> {
  return { background: `linear-gradient(135deg, ${t.accent} 0%, ${t.accent2} 60%, ${t.accent3} 100%)` };
}

/** Arrow keys walk the grid; Enter/Space is the button's own job. */
function onKeydown(e: KeyboardEvent) {
  const n = themeStore.themes.length;
  let next = focusIndex.value;
  if (e.key === 'ArrowRight' || e.key === 'ArrowDown') next = (focusIndex.value + 1) % n;
  else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') next = (focusIndex.value - 1 + n) % n;
  else if (e.key === 'Home') next = 0;
  else if (e.key === 'End') next = n - 1;
  else return;
  e.preventDefault();
  focusIndex.value = next;
  cards.value[next]?.focus();
}

watch(open, async isOpen => {
  if (!isOpen) return;
  focusIndex.value = Math.max(0, themeStore.themes.findIndex(t => t.id === themeStore.themeId));
  await nextTick();
  // Focus the card for the theme in use, so a keyboard user starts from where
  // they are rather than from the top of a list of ten.
  (cards.value[focusIndex.value] ?? panel.value)?.focus();
});
</script>

<style scoped>
/* ---------------------------------------------------------------- Trigger */
.tp-trigger {
  display: flex;
  align-items: center;
  gap: 10px;
  width: 100%;
  padding: 10px 12px;
  background: rgb(var(--sfs-tint-rgb, 255 255 255) / 0.06);
  border: 1px solid rgb(var(--sfs-tint-rgb, 255 255 255) / 0.14);
  border-radius: 12px;
  color: var(--sfs-text, #fff);
  cursor: pointer;
  transition: background 0.2s ease, border-color 0.2s ease;
}

.tp-trigger:hover {
  background: rgb(var(--sfs-tint-rgb, 255 255 255) / 0.12);
  border-color: rgb(var(--sfs-accent-rgb, 102 126 234) / 0.45);
}

.tp-trigger.tp-collapsed {
  justify-content: center;
  padding: 10px 0;
}

.tp-trigger-swatch {
  width: 22px;
  height: 22px;
  border-radius: 50%;
  flex-shrink: 0;
  border: 1px solid rgb(var(--sfs-tint-rgb, 255 255 255) / 0.35);
  box-shadow: 0 0 10px rgb(var(--sfs-accent-rgb, 102 126 234) / 0.4);
}

.tp-trigger-text {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  line-height: 1.2;
  min-width: 0;
}

.tp-trigger-label {
  font-size: 0.68rem;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--sfs-text-muted, rgb(255 255 255 / 0.7));
}

.tp-trigger-name {
  font-size: 0.84rem;
  font-weight: 600;
  color: var(--sfs-text, #fff);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 100%;
}

/* ---------------------------------------------------------------- Dialog */
.tp-overlay {
  position: fixed;
  inset: 0;
  z-index: 10000;
  /* --sfs-overlay, not a surface tint: a scrim has to stay DARK under a light
     galaxy too, or the dialog and the page behind it are the same brightness
     and the dialog stops reading as being in front. */
  background: var(--sfs-overlay, rgb(1 1 10 / 0.72));
  backdrop-filter: blur(6px);
  display: grid;
  place-items: center;
  /* Notches: on a landscape phone the dialog would otherwise start under the
     camera cutout. */
  padding: max(16px, var(--sfs-safe-top, 0px)) max(16px, var(--sfs-safe-right, 0px))
           max(16px, var(--sfs-safe-bottom, 0px)) max(16px, var(--sfs-safe-left, 0px));
  animation: tp-fade 0.18s ease;
}

@keyframes tp-fade {
  from { opacity: 0; }
}

.tp-panel {
  width: min(1100px, 100%);
  max-height: min(86dvh, 900px);
  overflow-y: auto;
  background: var(--sfs-surface-2, #14141f);
  border: 1px solid rgb(var(--sfs-tint-rgb, 255 255 255) / 0.14);
  border-radius: 20px;
  padding: clamp(16px, 2.4vw, 28px);
  box-shadow: 0 30px 80px rgb(0 0 0 / 0.65);
  color: var(--sfs-text, #fff);
}

.tp-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
  margin-bottom: 18px;
}

.tp-title {
  font-size: clamp(1.15rem, 1rem + 0.6vw, 1.5rem);
  font-weight: 700;
  color: var(--sfs-text, #fff);
}

.tp-sub {
  margin-top: 4px;
  font-size: 0.86rem;
  color: var(--sfs-text-muted, rgb(255 255 255 / 0.7));
  max-width: 60ch;
}

.tp-close {
  flex-shrink: 0;
  display: grid;
  place-items: center;
  width: 36px;
  height: 36px;
  border-radius: 10px;
  border: 1px solid rgb(var(--sfs-tint-rgb, 255 255 255) / 0.14);
  background: rgb(var(--sfs-tint-rgb, 255 255 255) / 0.06);
  color: var(--sfs-text, #fff);
  cursor: pointer;
}

.tp-close:hover {
  background: rgb(var(--sfs-danger-rgb, 248 113 113) / 0.2);
}

/* ------------------------------------------------------------- Mode pair */
.tp-modes {
  display: inline-flex;
  gap: 4px;
  padding: 4px;
  margin-bottom: 18px;
  border-radius: 12px;
  background: rgb(var(--sfs-tint-rgb, 255 255 255) / 0.06);
  border: 1px solid rgb(var(--sfs-tint-rgb, 255 255 255) / 0.14);
}

.tp-mode {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 7px 14px;
  border: 0;
  border-radius: 9px;
  background: transparent;
  color: var(--sfs-text-muted, rgb(255 255 255 / 0.7));
  font-size: 0.85rem;
  font-weight: 600;
  cursor: pointer;
}

.tp-mode.is-on {
  background: var(--sfs-accent, #667eea);
  color: var(--sfs-on-accent, #fff);
}

/* --------------------------------------------------------------- The grid
   auto-fit with a floor, so it is four across on a desktop, two on a tablet
   and one on a phone without a single media query — and never narrower than
   a card can legibly be. */
.tp-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(min(240px, 100%), 1fr));
  gap: clamp(10px, 1.2vw, 16px);
  list-style: none;
  padding: 0;
  margin: 0;
}

.tp-card {
  display: flex;
  flex-direction: column;
  width: 100%;
  padding: 0;
  overflow: hidden;
  border-radius: 14px;
  border: 2px solid var(--c-border);
  background: var(--c-surface);
  color: var(--c-text);
  cursor: pointer;
  text-align: start;
  transition: transform 0.18s ease, border-color 0.18s ease, box-shadow 0.18s ease;
}

.tp-card:hover {
  transform: translateY(-3px);
  box-shadow: 0 14px 34px rgb(0 0 0 / 0.45);
}

.tp-card.is-active {
  border-color: var(--c-accent);
  box-shadow: 0 0 0 3px rgb(var(--sfs-accent-rgb, 102 126 234) / 0.28);
}

/* ------------------------------------------------------------ The preview */
.tp-sky {
  position: relative;
  display: block;
  aspect-ratio: 16 / 9;
  overflow: hidden;
  isolation: isolate;
}

.tp-core {
  position: absolute;
  left: 50%;
  top: 50%;
  width: 62%;
  height: 62%;
  transform: translate(-50%, -50%);
  border-radius: 50%;
  filter: blur(6px);
}

.tp-arm {
  position: absolute;
  left: 50%;
  top: 50%;
  width: 150%;
  height: 150%;
  margin: -75% 0 0 -75%;
  border-radius: 50%;
  opacity: 0.55;
  filter: blur(9px);
  mask-image: radial-gradient(circle, transparent 12%, #000 30%, transparent 68%);
  -webkit-mask-image: radial-gradient(circle, transparent 12%, #000 30%, transparent 68%);
}

.tp-arm-b { opacity: 0.4; }

/* The app-in-miniature. Three real tokens, so the card is a contrast test as
   well as a colour swatch. */
.tp-mini {
  position: absolute;
  inset: auto 8% 8% 8%;
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 7px 9px;
  border-radius: 9px;
  background: var(--c-surface);
  border: 1px solid var(--c-border);
  backdrop-filter: blur(4px);
}

.tp-mini-bar {
  width: 24%;
  height: 6px;
  border-radius: 3px;
  background: var(--c-text);
}

.tp-mini-line {
  flex: 1;
  height: 5px;
  border-radius: 3px;
  background: var(--c-muted);
}

.tp-mini-btn {
  padding: 2px 8px;
  border-radius: 6px;
  font-size: 0.62rem;
  font-weight: 800;
  background: var(--c-accent);
  color: var(--c-on-accent);
}

/* ----------------------------------------------------------------- Meta */
.tp-meta {
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding: 10px 12px 12px;
}

.tp-name {
  display: flex;
  align-items: center;
  gap: 6px;
  font-weight: 700;
  font-size: 0.95rem;
  color: var(--c-text);
}

.tp-tick { color: var(--c-accent); }

.tp-tagline {
  font-size: 0.76rem;
  line-height: 1.35;
  color: var(--c-muted);
}

.tp-mode-tag {
  margin-top: 5px;
  align-self: flex-start;
  font-size: 0.62rem;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  padding: 2px 7px;
  border-radius: 999px;
  border: 1px solid var(--c-border);
  color: var(--c-muted);
}

@media (max-width: 640px) {
  .tp-panel {
    max-height: 92dvh;
    border-radius: 16px;
  }

  .tp-sub { display: none; }
}

@media (prefers-reduced-motion: reduce) {
  .tp-overlay { animation: none; }
  .tp-card:hover { transform: none; }
}
</style>
