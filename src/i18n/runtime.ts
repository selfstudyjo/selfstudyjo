/**
 * The reactive half of i18n, and the only file here that imports Vue.
 *
 * `locales.ts`, `index.ts` and `speech.ts` are plain so `npm run check:i18n`
 * can load them in node. This holds the one piece of state everything reads —
 * which language is on — and publishes it two ways:
 *
 *  - `useI18n()` for `<script setup>`;
 *  - `$t` / `$tc` / `$n` / `$d` / `$rtl` as global properties, so a template
 *    needs no import at all.
 *
 * ============================================================
 * WHY GLOBAL PROPERTIES, WHEN A COMPOSABLE IS THE MODERN ANSWER
 * ============================================================
 *
 * Because there are 62 views and ~40 components, and the difference between
 * `{{ $t('Save') }}` and `import { useI18n } from '@/i18n/runtime'` + a line in
 * every `<script setup>` is ~100 files' worth of edits that buy nothing. A
 * global is the right tool when the thing being reached for is genuinely global
 * and the alternative is boilerplate in every single consumer.
 *
 * The composable exists too, and is what `<script setup>` should use: a global
 * property is only visible to the template compiler, so `$t` in script is
 * `undefined`. That asymmetry is the one sharp edge here and `check:i18n`
 * fails on `$t(` appearing inside a `<script` block.
 *
 * ============================================================
 * HOW THE REACTIVITY WORKS, AND WHY `t` IS A PLAIN FUNCTION
 * ============================================================
 *
 * `t()` reads `current.value` on every call. Called during a component's
 * render, that read is tracked by the render effect, so changing the language
 * re-renders every component that translated anything — which is every
 * component. No `computed`, no key on `<router-view>`, no reload.
 *
 * The state is a module-level `ref` rather than a Pinia store on purpose. The
 * theme is a store because something *else* asks it questions (the picker, the
 * 3D background, the chart rebuild); the locale is asked by every render in the
 * app, and routing that through a store means every consumer needs a Pinia
 * instance — including the three places that translate outside a component
 * (`notificationEvents`, the `store/userchat` chime, `api.ts`'s error text),
 * where there may not be one yet.
 */

import { ref, computed, type App } from 'vue';

import {
    applyLocale, initialLocaleId, writeStoredLocale,
} from './apply';
import {
    formatCurrency, formatDate, formatNumber, formatRelative, register,
    translate, type Params,
} from './index';
import {
    DEFAULT_LOCALE_ID, LOCALES, getLocale, type Locale, type LocaleId,
} from './locales';

import ar from './messages/ar';
import zh from './messages/zh';

/* ------------------------------------------------------------------ *
 * The catalogues
 * ------------------------------------------------------------------ */

// Registered eagerly rather than lazily, and that is a considered trade.
//
// Lazy-loading a catalogue per language is the textbook answer and it is wrong
// here: switching language would then be an async operation that can fail, so
// the picker needs a spinner, an error state and a rollback — for two objects
// that gzip to a few tens of kilobytes on a bundle that already ships three.js.
// The cost of being wrong the other way is a reader who picks Arabic, sees
// English for 400ms, and reports it.
register('ar', ar);
register('zh', zh);

/* ------------------------------------------------------------------ *
 * The state
 * ------------------------------------------------------------------ */

const current = ref<LocaleId>(DEFAULT_LOCALE_ID);

/**
 * Resolve and apply the opening language.
 *
 * `main.ts` has already called `bootstrapLocale()` so the first paint is the
 * right way round before Vue exists; this brings the reactive state into line
 * with what is on the document rather than applying it a second time.
 */
export function initLocale(): void {
    current.value = initialLocaleId();
    applyLocale(getLocale(current.value));
}

/**
 * Switch language. Persisted, so the next visit opens in it.
 *
 * Also re-applies the document attributes, which is what mirrors the layout —
 * `dir` on `<html>` is the only thing that actually flips anything.
 */
export function setLocale(id: LocaleId): void {
    const locale = getLocale(id);
    current.value = locale.id;
    applyLocale(locale);
    writeStoredLocale(locale.id);
}

export const localeId = computed<LocaleId>(() => current.value);
export const locale = computed<Locale>(() => getLocale(current.value));
export const isRtl = computed<boolean>(() => locale.value.direction === 'rtl');
export const dir = computed<'ltr' | 'rtl'>(() => locale.value.direction);

/* ------------------------------------------------------------------ *
 * The functions everything calls
 * ------------------------------------------------------------------ */

/** Translate. The key is the English text — see `index.ts`. */
export function t(key: string, params?: Params): string {
    return translate(current.value, key, params);
}

/**
 * Translate with a count.
 *
 * `tc('{n} unread', 3)` — the count is passed separately AND merged into the
 * params as `n`, so a message never has to name it twice. Arabic has six plural
 * forms and Chinese has one; both are handled by the catalogue's shape rather
 * than by anything the caller does.
 */
export function tc(key: string, count: number, params?: Params): string {
    return translate(current.value, key, { n: count, ...params }, count);
}

/** A number, in the reader's digits. See `formatNumber` for when NOT to use it. */
export function n(value: number, options?: Intl.NumberFormatOptions): string {
    return formatNumber(current.value, value, options);
}

export function d(value: Date | string | number, options?: Intl.DateTimeFormatOptions): string {
    return formatDate(current.value, value, options);
}

export function rel(value: Date | string | number): string {
    return formatRelative(current.value, value);
}

export function money(amount: number | string, currency = 'JOD'): string {
    return formatCurrency(current.value, amount, currency);
}

/**
 * The language to ask a backend to answer in.
 *
 * One name for it, used by every service call, so "which spelling does this
 * endpoint want" is answered once. Every AI-facing endpoint on apps 27, 33 and
 * 36 takes this exact set of three codes, and `language.py` on the backend
 * normalises anything else rather than refusing it — see the platform guide.
 */
export function aiLanguage(): LocaleId {
    return current.value;
}

/**
 * The header that tells a backend which language to answer in.
 *
 * ============================================================
 * SPENT PER SERVICE, NEVER IN `ApiService.getHeaders()`
 * ============================================================
 *
 * `X-SFS-Language` is a custom header, so it is never CORS-simple: it triggers
 * a preflight, and a browser fails THE WHOLE REQUEST — not just the header —
 * when the server's `Access-Control-Allow-Headers` does not list it. Twenty of
 * this platform's backends declare an explicit list. Set globally, every screen
 * would stop working against all twenty until all twenty had been deployed,
 * and the frontend deploys on its own schedule.
 *
 * So this is called by the three services that actually need it — the AI chat
 * and the network simulator's assistant (app 27), the job interview and
 * Toastmasters rooms (app 27), the CV Builder (app 33) and the newscast's
 * speech (app 36). Everything else on the platform stores and returns records,
 * and a record has no language.
 *
 * `language.py` on those services reads the request BODY first and this second,
 * so a call with a real reason to override — the newscast asking for an Arabic
 * bulletin while the interface is in Chinese — says so explicitly in the body
 * and everything else gets the reader's language for free.
 */
export function aiLanguageHeaders(): Record<string, string> {
    return { 'X-SFS-Language': current.value };
}

/** Everything a `<script setup>` block needs, in one call. */
export function useI18n() {
    return {
        t, tc, n, d, rel, money,
        locale, localeId, isRtl, dir,
        locales: LOCALES,
        setLocale,
        aiLanguage,
    };
}

/* ------------------------------------------------------------------ *
 * The plugin
 * ------------------------------------------------------------------ */

/**
 * Publish the globals a template uses.
 *
 * `app.use(i18n)` in `main.ts`. Installed after Pinia only for tidiness —
 * nothing here needs it.
 */
export const i18n = {
    install(app: App): void {
        const g = app.config.globalProperties;
        g.$t = t;
        g.$tc = tc;
        g.$n = n;
        g.$d = d;
        g.$rel = rel;
        g.$money = money;
        // Properties rather than functions, so a template reads `$rtl` and not
        // `$rtl()`. Defined as getters so they stay reactive.
        Object.defineProperty(g, '$rtl', { get: () => isRtl.value, configurable: true });
        Object.defineProperty(g, '$dir', { get: () => dir.value, configurable: true });
        Object.defineProperty(g, '$locale', { get: () => locale.value, configurable: true });
    },
};

// Ambient declarations, so `$t` in a template is type-checked rather than
// silently `any`. Without this `vue-tsc` reports every use as an error on a
// repo where it is already not clean, and the noise would bury the real ones.
declare module 'vue' {
    interface ComponentCustomProperties {
        $t: typeof t;
        $tc: typeof tc;
        $n: typeof n;
        $d: typeof d;
        $rel: typeof rel;
        $money: typeof money;
        $rtl: boolean;
        $dir: 'ltr' | 'rtl';
        $locale: Locale;
    }
}

export { LOCALES, getLocale, type Locale, type LocaleId };
