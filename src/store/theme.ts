// store/theme.ts
//
// The galaxy the user is looking at.
//
// Deliberately thin: the palette is derived in `theme/themes.ts` and written
// to the document by `theme/apply.ts`, so all this owns is *which* one and the
// fact that the choice outlives the tab. Keeping the decision-making out of
// the store is what lets `npm run check:theme` verify the whole palette in
// node without a Pinia instance.

import { defineStore } from 'pinia';
import { computed, ref } from 'vue';

import { applyTheme, initialThemeId, prefersLight, writeStoredTheme } from '@/theme/apply';
import { DEFAULT_THEME_ID, THEMES, getTheme, type Theme, type ThemeMode } from '@/theme/themes';

export const useThemeStore = defineStore('theme', () => {
    const themeId = ref<string>(DEFAULT_THEME_ID);

    const theme = computed<Theme>(() => getTheme(themeId.value));
    const mode = computed<ThemeMode>(() => theme.value.mode);
    const isDark = computed(() => theme.value.mode === 'dark');
    const themes = computed(() => THEMES);

    /**
     * Resolve and apply the opening theme.
     *
     * `main.ts` has already called `bootstrapTheme()` so the first paint is
     * correct before Vue exists; this brings the store into line with what is
     * on the document rather than applying it a second time.
     */
    function initTheme(): void {
        themeId.value = initialThemeId();
        applyTheme(theme.value);
    }

    /** Switch galaxy. Persisted, so the next visit opens the same one. */
    function setTheme(id: string): void {
        const next = getTheme(id);
        themeId.value = next.id;
        applyTheme(next);
        writeStoredTheme(next.id);
    }

    /**
     * Step to the next galaxy in the list — what the keyboard shortcut and the
     * picker's arrow keys use. Wraps, so it can never land nowhere.
     */
    function cycleTheme(step = 1): void {
        const i = THEMES.findIndex(t => t.id === themeId.value);
        const next = THEMES[(((i + step) % THEMES.length) + THEMES.length) % THEMES.length];
        setTheme(next.id);
    }

    /**
     * Jump to the nearest theme of the other mode.
     *
     * A single dark/light toggle is what most people reach for first, and
     * without this it does not exist: ten named galaxies with no obvious
     * "make it light" among them. It prefers to stay in the same hue family
     * where one exists, so the switch reads as the same app in daylight rather
     * than as a different product.
     */
    function toggleMode(): void {
        const want: ThemeMode = isDark.value ? 'light' : 'dark';
        const candidates = THEMES.filter(t => t.mode === want);
        if (!candidates.length) return;
        const current = theme.value;
        const nearest = candidates.reduce((best, t) =>
            hueDistance(t.accent, current.accent) < hueDistance(best.accent, current.accent) ? t : best
        );
        setTheme(nearest.id);
    }

    /**
     * Follow the operating system, for anyone who has not chosen for
     * themselves. A visitor who HAS chosen keeps their choice — an OS that
     * switches at sunset should not throw away a deliberate decision.
     */
    function followSystem(): void {
        setTheme(prefersLight() ? 'cartwheel' : DEFAULT_THEME_ID);
    }

    return {
        themeId,
        theme,
        themes,
        mode,
        isDark,
        initTheme,
        setTheme,
        cycleTheme,
        toggleMode,
        followSystem,
    };
});

/** Crude but adequate: how far apart two accents are on the colour wheel. */
function hueDistance(a: string, b: string): number {
    const h = (hex: string) => {
        const n = parseInt(hex.slice(1), 16);
        const r = ((n >> 16) & 255) / 255;
        const g = ((n >> 8) & 255) / 255;
        const bl = (n & 255) / 255;
        const max = Math.max(r, g, bl);
        const min = Math.min(r, g, bl);
        const d = max - min;
        if (d === 0) return 0;
        if (max === r) return (((g - bl) / d + 6) % 6) * 60;
        if (max === g) return ((bl - r) / d + 2) * 60;
        return ((r - g) / d + 4) * 60;
    };
    const diff = Math.abs(h(a) - h(b)) % 360;
    return diff > 180 ? 360 - diff : diff;
}
