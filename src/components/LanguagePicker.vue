<template>
  <!--
    The language picker.

    Rendered as a small popover rather than as the theme picker's full dialog,
    and the difference is the point: a galaxy is worth seeing at size because
    each card is a real preview, while a language is a word in that language and
    nothing else. Three rows need three rows, not a modal.

    Its own text is deliberately NOT translated — see the script.
  -->
  <div class="lp-root">
    <button
      class="lp-trigger"
      :class="{ 'lp-collapsed': collapsed }"
      type="button"
      :title="collapsed ? locale.nativeName : undefined"
      :aria-label="`Language — ${locale.name}`"
      :aria-expanded="open"
      aria-haspopup="true"
      @click="open = !open"
    >
      <span class="lp-badge" aria-hidden="true">{{ locale.badge }}</span>
      <span v-if="!collapsed" class="lp-trigger-text">
        <span class="lp-trigger-label">Language</span>
        <span class="lp-trigger-name">{{ locale.nativeName }}</span>
      </span>
    </button>

    <Teleport to="body">
      <div
        v-if="open"
        class="lp-overlay"
        role="dialog"
        aria-modal="true"
        aria-label="Choose a language"
        @click.self="open = false"
      >
        <div ref="panel" class="lp-panel" tabindex="-1" @keydown="onKeydown">
          <header class="lp-head">
            <h2 class="lp-title">Language · اللغة · 语言</h2>
            <button class="lp-close" type="button" aria-label="Close" @click="open = false">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
                <path d="M6 6l12 12M18 6L6 18" />
              </svg>
            </button>
          </header>

          <ul class="lp-list" role="listbox">
            <li v-for="(item, i) in locales" :key="item.id">
              <button
                class="lp-option"
                :class="{ 'lp-current': item.id === locale.id, 'lp-cursor': i === cursor }"
                type="button"
                role="option"
                :aria-selected="item.id === locale.id"
                :lang="item.tag"
                :dir="item.direction"
                @click="choose(item.id)"
                @mouseenter="cursor = i"
              >
                <span class="lp-option-badge" aria-hidden="true">{{ item.badge }}</span>
                <span class="lp-option-text">
                  <!--
                    Native name FIRST, and this is the one layout decision in
                    the file that matters. Somebody looking for their own
                    language is looking for their own word for it — a reader who
                    cannot read English cannot find "Arabic" in a list, and this
                    is the one list they have to be able to use. The English
                    name is the second line, for an operator and for anybody who
                    has landed here by accident.
                  -->
                  <span class="lp-option-native">{{ item.nativeName }}</span>
                  <span class="lp-option-english">{{ item.name }}</span>
                </span>
                <svg v-if="item.id === locale.id" class="lp-tick" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M20 6L9 17l-5-5" />
                </svg>
              </button>
            </li>
          </ul>

          <p class="lp-note" dir="ltr">
            Applies everywhere, including the AI interviewer and the speakers.
          </p>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<script setup lang="ts">
/**
 * The language picker.
 *
 * Sits in the sidebar footer above the account block and OUTSIDE the
 * authenticated branch, next to the theme picker and for a stronger version of
 * the same reason: choosing a language you can read is not something a visitor
 * should have to sign in for, and the login page is the one screen where being
 * unable to read the interface stops you doing anything at all.
 *
 * ============================================================
 * THIS COMPONENT'S OWN TEXT IS DELIBERATELY NOT TRANSLATED
 * ============================================================
 *
 * "Language", "Close", the note at the bottom — all English, on purpose, and it
 * is the one place in the app where that is the right answer.
 *
 * A language picker is the control somebody reaches for when the interface is
 * in a language they cannot read. Translating its label means that a reader who
 * has accidentally selected Chinese sees a Chinese word where the way out used
 * to be — so the control that exists to fix the problem is the one the problem
 * has hidden. The heading is written in all three scripts for the same reason
 * (`Language · اللغة · 语言`), and the option rows are each in their own
 * language rather than in the current one.
 *
 * `check:i18n` will report these strings as untranslated and they are in
 * `tools/i18n-check/untranslated.json` with this reason recorded against them.
 *
 * ============================================================
 * WHAT SWITCHING ACTUALLY DOES
 * ============================================================
 *
 * `setLocale` writes `lang` and `dir` onto `<html>` and moves one reactive ref.
 * Everything else follows from that: every `$t()` call re-renders because it
 * read the ref, the whole layout mirrors for Arabic because `dir` is the only
 * thing that mirrors anything, and the next AI call carries the new language
 * because `aiLanguage()` reads the same ref. There is no reload, no route key
 * and no async catalogue fetch — see `i18n/runtime.ts` for why the catalogues
 * are registered eagerly.
 */
import { nextTick, ref, watch } from 'vue';

import { LOCALES, useI18n, type LocaleId } from '@/i18n/runtime';

const props = withDefaults(defineProps<{ collapsed?: boolean }>(), { collapsed: false });

const { locale, setLocale } = useI18n();
const locales = LOCALES;

const open = ref(false);
const cursor = ref(0);
const panel = ref<HTMLElement | null>(null);

watch(open, async isOpen => {
  if (!isOpen) return;
  cursor.value = Math.max(0, locales.findIndex(l => l.id === locale.value.id));
  // Focus the panel so Escape and the arrow keys reach `onKeydown` — without
  // it the keyboard is still on the trigger and the dialog is unreachable
  // without a mouse.
  await nextTick();
  panel.value?.focus();
});

function choose(id: LocaleId): void {
  setLocale(id);
  open.value = false;
}

function onKeydown(event: KeyboardEvent): void {
  if (event.key === 'Escape') { open.value = false; return; }
  if (event.key === 'Enter' || event.key === ' ') {
    event.preventDefault();
    choose(locales[cursor.value].id);
    return;
  }
  // Up/Down rather than Left/Right, deliberately: the list is vertical, and
  // horizontal arrows swap meaning under `dir="rtl"` — which is the one
  // direction this component is guaranteed to be used in.
  const step = event.key === 'ArrowDown' ? 1 : event.key === 'ArrowUp' ? -1 : 0;
  if (!step) return;
  event.preventDefault();
  cursor.value = (cursor.value + step + locales.length) % locales.length;
}

// Referenced so the prop is not reported unused by the template-only read.
void props;
</script>

<style scoped>
/*
 * No colour literal anywhere in here — every value is a `--sfs-*` token with
 * its pre-theme fallback, so the picker is right in all ten galaxies (working
 * rule 12). And no physical margin: `margin-inline-*` throughout, because this
 * component is on screen in a mirrored layout by definition.
 */
.lp-root {
  width: 100%;
}

.lp-trigger {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  width: 100%;
  padding: 0.55rem 0.7rem;
  border: 1px solid rgb(var(--sfs-line-rgb, 255 255 255) / 0.14);
  border-radius: 10px;
  background: rgb(var(--sfs-tint-rgb, 255 255 255) / 0.06);
  color: var(--sfs-text, #e8eaf6);
  cursor: pointer;
  text-align: start;
  transition: background 0.18s ease, border-color 0.18s ease;
  /* A touch target below 44px is the one thing that must not scale with the
   * fluid root size — see `exam-system.css`, where `2.75rem` measured 41.5px
   * on a 390px phone. */
  min-height: max(2.4rem, 40px);
}

.lp-trigger:hover {
  background: rgb(var(--sfs-tint-rgb, 255 255 255) / 0.11);
  border-color: rgb(var(--sfs-line-rgb, 255 255 255) / 0.24);
}

.lp-trigger.lp-collapsed {
  justify-content: center;
  padding-inline: 0.4rem;
}

.lp-badge,
.lp-option-badge {
  display: grid;
  place-items: center;
  flex: 0 0 auto;
  width: 1.6rem;
  height: 1.6rem;
  border-radius: 7px;
  background: rgb(var(--sfs-accent-rgb, 102 126 234) / 0.22);
  color: var(--sfs-accent-text, #c7d2fe);
  font-size: 0.78rem;
  font-weight: 700;
  /* The badge is a glyph from the language's own script, so it must be laid
   * out on its own terms and merely placed by the surrounding text. */
  unicode-bidi: isolate;
}

.lp-trigger-text {
  display: flex;
  flex-direction: column;
  min-width: 0;
  line-height: 1.2;
}

.lp-trigger-label {
  font-size: 0.66rem;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--sfs-text-faint, #9aa4c4);
}

.lp-trigger-name {
  font-size: 0.86rem;
  font-weight: 600;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.lp-overlay {
  position: fixed;
  inset: 0;
  z-index: 2000;
  display: grid;
  place-items: center;
  padding: max(16px, var(--sfs-safe-top, 0px)) 16px;
  background: var(--sfs-overlay, rgb(4 6 20 / 0.62));
  backdrop-filter: blur(3px);
}

.lp-panel {
  width: min(22rem, 100%);
  max-height: min(80vh, 32rem);
  overflow: auto;
  padding: 1rem;
  border: 1px solid rgb(var(--sfs-line-rgb, 255 255 255) / 0.16);
  border-radius: 16px;
  background: var(--sfs-surface, #0f1128);
  color: var(--sfs-text, #e8eaf6);
  box-shadow: 0 24px 60px rgb(0 0 0 / 0.45);
}

.lp-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  margin-bottom: 0.85rem;
}

.lp-title {
  margin: 0;
  font-size: 0.95rem;
  font-weight: 700;
  /* Three scripts in one string: isolate it so the bidi algorithm cannot
   * reorder the separators between them. */
  unicode-bidi: isolate;
}

.lp-close {
  display: grid;
  place-items: center;
  width: 2rem;
  height: 2rem;
  border: 0;
  border-radius: 8px;
  background: transparent;
  color: var(--sfs-text-faint, #9aa4c4);
  cursor: pointer;
}

.lp-close:hover {
  background: rgb(var(--sfs-tint-rgb, 255 255 255) / 0.1);
  color: var(--sfs-text, #e8eaf6);
}

.lp-list {
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
  margin: 0;
  padding: 0;
  list-style: none;
}

.lp-option {
  display: flex;
  align-items: center;
  gap: 0.7rem;
  width: 100%;
  padding: 0.6rem 0.7rem;
  border: 1px solid transparent;
  border-radius: 11px;
  background: rgb(var(--sfs-tint-rgb, 255 255 255) / 0.05);
  color: inherit;
  cursor: pointer;
  text-align: start;
  min-height: max(2.75rem, 44px);
}

.lp-option:hover,
.lp-option.lp-cursor {
  background: rgb(var(--sfs-tint-rgb, 255 255 255) / 0.12);
  border-color: rgb(var(--sfs-line-rgb, 255 255 255) / 0.2);
}

.lp-option.lp-current {
  background: rgb(var(--sfs-accent-rgb, 102 126 234) / 0.18);
  border-color: rgb(var(--sfs-accent-rgb, 102 126 234) / 0.45);
}

.lp-option-text {
  display: flex;
  flex-direction: column;
  min-width: 0;
  line-height: 1.25;
}

.lp-option-native {
  font-size: 0.95rem;
  font-weight: 600;
}

.lp-option-english {
  font-size: 0.72rem;
  color: var(--sfs-text-faint, #9aa4c4);
  /* The English name under a native one: pinned LTR so `Chinese (Simplified)`
   * keeps its brackets where they belong inside an Arabic panel. */
  direction: ltr;
  unicode-bidi: isolate;
}

.lp-tick {
  margin-inline-start: auto;
  flex: 0 0 auto;
  color: var(--sfs-accent-text, #c7d2fe);
}

.lp-note {
  margin: 0.9rem 0 0;
  font-size: 0.72rem;
  line-height: 1.5;
  color: var(--sfs-text-faint, #9aa4c4);
}
</style>
