<script setup lang="ts">
/**
 * The Newscast — a public, ungated page that reads the hour's news aloud.
 *
 * WHERE THE NEWS COMES FROM
 *
 * Airflow (`selfstudy_news.py` in the `dags` repo) scrapes RT and Al Jazeera
 * every hour into the `selfstudyjo/selfstudy_news_data` repo, REPLACING each
 * category's file rather than appending to it. Self Study News (app 36) reads
 * that repo and serves it here. The frontend never touches GitHub: the token
 * that reads the data repo cannot be a `VITE_*` variable, because Vite compiles
 * those into the published bundle (CLAUDE.md working rule 9).
 *
 * WHAT IS IN THIS FILE AND WHAT IS NOT
 *
 * Every decision about *what is said* — the running order, which anchor reads
 * what, whether the bed is playing, how a headline is turned into something a
 * synthesiser pronounces properly — lives in `newscastEngine.ts`, a plain
 * module with no Vue in it, verified by `npm run check:newscast`. This
 * component does playback and nothing else. That split is the only reason the
 * bed policy and the anchor rota are testable at all.
 *
 * THE FOUR BROWSER PROBLEMS, NONE OF WHICH THROW
 *
 * 1. **Chrome stops speaking after ~15 seconds.** A long paragraph is cut off
 *    mid-word and no error fires — `onend` simply never arrives and the
 *    bulletin hangs forever. The documented workaround is a `pause()` +
 *    `resume()` pair on a timer while speaking, and it is the only reason the
 *    detail segments finish.
 * 2. **`getVoices()` is empty on first call.** Voices load asynchronously, so
 *    casting the anchors at mount gives two nulls and one robotic default
 *    voice. `voiceschanged` is what fills it in, and it can fire more than once.
 * 3. **Autoplay is refused without a gesture**, for `speechSynthesis` and for
 *    the `<audio>` bed alike, and the refusal is a rejected promise nobody
 *    sees. Both are primed inside the click that starts the bulletin — the
 *    same trick `store/userchat.ts` and `store/notifications.ts` use for their
 *    chimes.
 * 4. **`speechSynthesis` survives navigation.** It is a property of the window,
 *    not of the component, so leaving the page mid-sentence leaves the anchor
 *    talking over whatever the user opened next. `onBeforeUnmount` has to
 *    cancel, and so does the route guard.
 */

import { computed, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue';
import { onBeforeRouteLeave } from 'vue-router';
import {
    Radio, Play, Pause, SkipForward, SkipBack, Square, Volume2, VolumeX,
    RefreshCw, AlertCircle, ExternalLink, Clock, Languages, Gauge,
} from 'lucide-vue-next';

import NewsAnchor from '@/components/newscast/NewsAnchor.vue';
import NewsTicker from '@/components/newscast/NewsTicker.vue';
import {
    buildScript, bedIndexFor, bedVolumeFor, castVoices, estimateScriptMs,
    isRtl, localeFor, storyOrder,
    type AnchorId, type LanguageCode, type Segment, type VoiceLike,
} from '@/components/newscast/newscastEngine';
import {
    newsService, splitCategoryPath,
    type NewsBulletin, type NewsCategory, type NewsHeadline, type NewsLanguageInfo,
} from '@/services/news.service';

import bedOpen from '@/assets/audio/selfstudy_newscast_open.mp3';
import bed1 from '@/assets/audio/selfstudy_newscast_bed1.mp3';
import bed2 from '@/assets/audio/selfstudy_newscast_bed2.mp3';
import bed3 from '@/assets/audio/selfstudy_newscast_bed3.mp3';
import bed4 from '@/assets/audio/selfstudy_newscast_bed4.mp3';

const BEDS: Record<number, string> = { 1: bed1, 2: bed2, 3: bed3, 4: bed4 };

const ANCHOR_NAMES: Record<LanguageCode, Record<AnchorId, string>> = {
    en: { female: 'Layla', male: 'Adam' },
    ar: { female: 'ليلى', male: 'آدم' },
};

const UI = {
    en: {
        dir: 'ltr', title: 'Newscast', subtitle: 'World news, read to you every hour',
        language: 'Language', category: 'Category', play: 'Start newscast',
        pause: 'Pause', resume: 'Resume', stop: 'Stop', next: 'Next story',
        previous: 'Previous story', refresh: 'Refresh', loading: 'Loading the bulletin…',
        noCategories: 'No news has been published yet. The hourly job may not have run.',
        empty: 'This category is empty right now.', onAir: 'On air', ready: 'Ready',
        updated: 'Updated', stories: 'stories', running: 'Running time',
        readDetail: 'Read full stories', headlinesOnly: 'Headlines only',
        speed: 'Speed', muted: 'Music off', unmuted: 'Music on',
        openOriginal: 'Open the original article', rundown: 'Rundown',
        unsupported: 'This browser cannot read text aloud. The headlines below are still live.',
        sharedVoice: 'one voice available',
        breaking: 'BREAKING', fresh: 'NEW',
    },
    ar: {
        dir: 'rtl', title: 'النشرة الإخبارية', subtitle: 'أخبار العالم تُقرأ عليك كل ساعة',
        language: 'اللغة', category: 'القسم', play: 'ابدأ النشرة',
        pause: 'إيقاف مؤقت', resume: 'متابعة', stop: 'إنهاء', next: 'الخبر التالي',
        previous: 'الخبر السابق', refresh: 'تحديث', loading: 'جارٍ تحميل النشرة…',
        noCategories: 'لم تُنشر أي أخبار بعد. قد لا تكون المهمة الساعية قد عملت.',
        empty: 'لا توجد أخبار في هذا القسم حاليا.', onAir: 'على الهواء', ready: 'جاهز',
        updated: 'آخر تحديث', stories: 'خبرا', running: 'مدة النشرة',
        readDetail: 'قراءة التفاصيل', headlinesOnly: 'العناوين فقط',
        speed: 'السرعة', muted: 'الموسيقى متوقفة', unmuted: 'الموسيقى تعمل',
        openOriginal: 'فتح الخبر الأصلي', rundown: 'ترتيب النشرة',
        unsupported: 'هذا المتصفح لا يدعم قراءة النص. العناوين أدناه محدّثة.',
        sharedVoice: 'صوت واحد متاح',
        breaking: 'عاجل', fresh: 'جديد',
    },
} as const;

/* ------------------------------------------------------------------ *
 * State
 * ------------------------------------------------------------------ */

const language = ref<LanguageCode>('en');
const languages = ref<NewsLanguageInfo[]>([]);
const categories = ref<NewsCategory[]>([]);
const activeKey = ref('');
const bulletin = ref<NewsBulletin | null>(null);
const tickerLines = ref<NewsHeadline[]>([]);

const loading = ref(false);
const error = ref('');
const status = ref<'idle' | 'playing' | 'paused'>('idle');

const script = ref<Segment[]>([]);
const cursor = ref(-1);
const withDetail = ref(true);
const rate = ref(1);
const musicOn = ref(true);

const speechSupported = ref(true);
const voices = reactive<{ female: VoiceLike | null; male: VoiceLike | null }>({
    female: null, male: null,
});

let utterance: SpeechSynthesisUtterance | null = null;
let keepAlive: number | null = null;
let bedAudio: HTMLAudioElement | null = null;
let fadeTimer: number | null = null;
/** Guards the `onend` handler against a `cancel()` we issued ourselves. */
let generation = 0;

const t = computed(() => UI[language.value]);
const rtl = computed(() => isRtl(language.value));
const anchorNames = computed(() => ANCHOR_NAMES[language.value]);

const currentSegment = computed<Segment | null>(() =>
    cursor.value >= 0 ? script.value[cursor.value] ?? null : null);

const speakingAnchor = computed<AnchorId | null>(() =>
    status.value === 'playing' ? currentSegment.value?.anchor ?? null : null);

const currentItem = computed(() => {
    const id = currentSegment.value?.itemId;
    if (!id || !bulletin.value) return null;
    return bulletin.value.items.find(item => item.id === id) ?? null;
});

const rundown = computed(() => {
    if (!bulletin.value) return [];
    const order = storyOrder(script.value);
    return order
        .map(id => bulletin.value!.items.find(item => item.id === id))
        .filter((item): item is NonNullable<typeof item> => Boolean(item));
});

const activeCategory = computed(() =>
    categories.value.find(category => category.key === activeKey.value) ?? null);

const runningTime = computed(() => {
    const ms = estimateScriptMs(script.value, language.value, rate.value);
    const minutes = Math.floor(ms / 60000);
    const seconds = Math.round((ms % 60000) / 1000);
    return `${minutes}:${String(seconds).padStart(2, '0')}`;
});

const progress = computed(() => {
    if (!script.value.length || cursor.value < 0) return 0;
    return Math.round(((cursor.value + 1) / script.value.length) * 100);
});

/* ------------------------------------------------------------------ *
 * Loading
 * ------------------------------------------------------------------ */

async function loadLanguages() {
    try {
        languages.value = await newsService.languages();
    } catch {
        // Not fatal: the picker falls back to the two languages we know exist.
        languages.value = [];
    }
}

async function loadCatalogue() {
    loading.value = true;
    error.value = '';
    try {
        const list = await newsService.catalogue(language.value);
        // Busiest first, so the default category is one with news in it rather
        // than whichever happens to sort first alphabetically.
        categories.value = [...list].sort((a, b) =>
            (b.fresh_count - a.fresh_count) || (b.count - a.count));
        if (!categories.value.some(category => category.key === activeKey.value)) {
            activeKey.value = categories.value[0]?.key ?? '';
        }
    } catch (err: any) {
        categories.value = [];
        error.value = err?.message || String(err);
    } finally {
        loading.value = false;
    }
}

async function loadBulletin() {
    const category = activeCategory.value;
    if (!category) {
        bulletin.value = null;
        script.value = [];
        return;
    }
    loading.value = true;
    error.value = '';
    try {
        const parts = splitCategoryPath(category.path);
        const payload = parts
            ? await newsService.bulletin(parts.language, parts.source, parts.category)
            : await newsService.bulletin(category.language,
                                         category.source.toLowerCase(), category.category);
        bulletin.value = payload;
        rebuildScript();
    } catch (err: any) {
        bulletin.value = null;
        script.value = [];
        error.value = err?.message || String(err);
    } finally {
        loading.value = false;
    }
}

async function loadTicker() {
    try {
        tickerLines.value = await newsService.headlines(language.value, 40);
    } catch {
        // The ticker is decoration; the bulletin is the page. A failure here
        // must not take the newscast down with it.
        tickerLines.value = [];
    }
}

function rebuildScript() {
    if (!bulletin.value) {
        script.value = [];
        return;
    }
    script.value = buildScript({
        language: language.value,
        items: bulletin.value.items,
        meta: bulletin.value,
        withDetail: withDetail.value,
        detailSentences: 3,
        // Alternate who opens between categories, so switching category does not
        // always start with the same voice saying the same sentence.
        firstAnchor: (rundown.value.length % 2 === 0 ? 'female' : 'male') as AnchorId,
        maxItems: 12,
    });
}

/* ------------------------------------------------------------------ *
 * Voices
 * ------------------------------------------------------------------ */

function refreshVoices() {
    if (!speechSupported.value) return;
    const available = window.speechSynthesis.getVoices() as unknown as VoiceLike[];
    if (!available || !available.length) return;      // fires again via voiceschanged
    const cast = castVoices(available, language.value);
    voices.female = cast.female;
    voices.male = cast.male;
}

function voiceLabel(anchor: AnchorId): string {
    const voice = voices[anchor];
    if (!voice) return '';
    const sharing = voices.female?.name === voices.male?.name;
    return sharing ? `${voice.name} — ${t.value.sharedVoice}` : voice.name;
}

function nativeVoice(anchor: AnchorId): SpeechSynthesisVoice | null {
    const wanted = voices[anchor];
    if (!wanted) return null;
    const all = window.speechSynthesis.getVoices();
    return all.find(voice => voice.name === wanted.name) ?? null;
}

/* ------------------------------------------------------------------ *
 * The music bed
 * ------------------------------------------------------------------ */

function ensureBed() {
    if (bedAudio) return bedAudio;
    bedAudio = new Audio();
    bedAudio.loop = true;
    bedAudio.volume = 0;
    bedAudio.preload = 'auto';
    return bedAudio;
}

function fadeBedTo(target: number, ms = 380) {
    const audio = ensureBed();
    if (fadeTimer !== null) {
        window.clearInterval(fadeTimer);
        fadeTimer = null;
    }
    const from = audio.volume;
    const goal = musicOn.value ? Math.max(0, Math.min(1, target)) : 0;
    if (Math.abs(goal - from) < 0.01) {
        audio.volume = goal;
        if (goal === 0) audio.pause();
        return;
    }
    const steps = Math.max(1, Math.round(ms / 40));
    let step = 0;
    fadeTimer = window.setInterval(() => {
        step += 1;
        const value = from + ((goal - from) * step) / steps;
        audio.volume = Math.max(0, Math.min(1, value));
        if (step >= steps) {
            window.clearInterval(fadeTimer!);
            fadeTimer = null;
            // Only pause once silent — pausing first makes the fade audible as
            // a click.
            if (goal === 0) audio.pause();
        }
    }, 40);
}

/** Point the bed at the right track and set its level for this segment. */
function applyBed(segment: Segment) {
    const audio = ensureBed();
    const wanted = segment.kind === 'open' || segment.kind === 'close'
        ? bedOpen
        : BEDS[bedIndexFor(segment.itemIndex ?? 0)];

    if (segment.bed && musicOn.value) {
        if (!audio.src.endsWith(wanted.split('/').pop() || wanted)) {
            audio.src = wanted;
            audio.currentTime = 0;
        }
        if (audio.paused) {
            // Rejected without a gesture. The bulletin is speech-led, so a
            // silent bed is a degradation and never a failure.
            audio.play().catch(() => undefined);
        }
        fadeBedTo(bedVolumeFor(segment));
    } else {
        // The brief: no music under the detail.
        fadeBedTo(0, 260);
    }
}

function stopBed() {
    if (fadeTimer !== null) {
        window.clearInterval(fadeTimer);
        fadeTimer = null;
    }
    if (bedAudio) {
        bedAudio.pause();
        bedAudio.currentTime = 0;
        bedAudio.volume = 0;
    }
}

/* ------------------------------------------------------------------ *
 * Playback
 * ------------------------------------------------------------------ */

function startKeepAlive() {
    stopKeepAlive();
    // Chrome silently stops speaking after ~15s. pause()+resume() resets its
    // internal timer; without it every detail segment dies mid-sentence and
    // `onend` never fires, so the bulletin hangs rather than skipping.
    keepAlive = window.setInterval(() => {
        if (status.value !== 'playing') return;
        const synth = window.speechSynthesis;
        if (synth.speaking && !synth.paused) {
            synth.pause();
            synth.resume();
        }
    }, 9000);
}

function stopKeepAlive() {
    if (keepAlive !== null) {
        window.clearInterval(keepAlive);
        keepAlive = null;
    }
}

function speakSegment(index: number) {
    const segment = script.value[index];
    if (!segment) {
        stop();
        return;
    }
    cursor.value = index;
    applyBed(segment);

    if (!speechSupported.value) return;

    const mine = ++generation;
    const synth = window.speechSynthesis;
    synth.cancel();

    utterance = new SpeechSynthesisUtterance(segment.text);
    utterance.lang = localeFor(language.value);
    utterance.rate = rate.value;
    utterance.pitch = segment.anchor === 'female' ? 1.08 : 0.92;
    const voice = nativeVoice(segment.anchor);
    if (voice) utterance.voice = voice;

    utterance.onend = () => {
        // A cancel() we issued ourselves also fires onend. Without the
        // generation guard, skipping a story starts the next segment twice and
        // the two anchors talk over each other.
        if (mine !== generation || status.value !== 'playing') return;
        advance();
    };
    utterance.onerror = (event: SpeechSynthesisErrorEvent) => {
        if (mine !== generation) return;
        // 'interrupted' and 'canceled' are us. Anything else is a real failure
        // of this one line, and skipping it is better than stopping the news.
        if (event.error === 'interrupted' || event.error === 'canceled') return;
        advance();
    };

    synth.speak(utterance);
}

function advance() {
    const next = cursor.value + 1;
    if (next >= script.value.length) {
        stop();
        return;
    }
    speakSegment(next);
}

function play() {
    if (!script.value.length) return;

    if (status.value === 'paused') {
        status.value = 'playing';
        if (speechSupported.value) window.speechSynthesis.resume();
        if (currentSegment.value) applyBed(currentSegment.value);
        startKeepAlive();
        return;
    }

    // Priming, inside the click. Both APIs refuse to start otherwise, and both
    // refuse silently — an empty utterance and a muted play() are the cheapest
    // way to spend the gesture.
    if (speechSupported.value) {
        const primer = new SpeechSynthesisUtterance('');
        primer.volume = 0;
        window.speechSynthesis.speak(primer);
    }
    const audio = ensureBed();
    audio.volume = 0;
    audio.play().then(() => audio.pause()).catch(() => undefined);

    status.value = 'playing';
    startKeepAlive();
    speakSegment(0);
}

function pause() {
    if (status.value !== 'playing') return;
    status.value = 'paused';
    if (speechSupported.value) window.speechSynthesis.pause();
    fadeBedTo(0, 220);
    stopKeepAlive();
}

function stop() {
    generation += 1;
    status.value = 'idle';
    cursor.value = -1;
    stopKeepAlive();
    if (speechSupported.value) window.speechSynthesis.cancel();
    stopBed();
}

/** Jump to the headline of the next (or previous) story. */
function skip(direction: 1 | -1) {
    if (!script.value.length) return;
    const order = storyOrder(script.value);
    const currentId = currentSegment.value?.itemId;
    const at = currentId ? order.indexOf(currentId) : -1;
    const target = Math.max(0, Math.min(order.length - 1, at + direction));
    const targetId = order[target];
    const index = script.value.findIndex(
        segment => segment.itemId === targetId && segment.kind === 'headline');
    if (index === -1) return;

    if (status.value === 'playing') {
        speakSegment(index);
    } else {
        cursor.value = index;
    }
}

function playFrom(itemId: string) {
    const index = script.value.findIndex(
        segment => segment.itemId === itemId && segment.kind === 'headline');
    if (index === -1) return;
    if (status.value !== 'playing') play();
    speakSegment(index);
}

function toggleMusic() {
    musicOn.value = !musicOn.value;
    if (!musicOn.value) {
        fadeBedTo(0, 200);
    } else if (currentSegment.value) {
        applyBed(currentSegment.value);
    }
}

/* ------------------------------------------------------------------ *
 * Reacting to the controls
 * ------------------------------------------------------------------ */

watch(language, async () => {
    stop();
    refreshVoices();
    await Promise.all([loadCatalogue(), loadTicker()]);
    await loadBulletin();
});

watch(activeKey, async (key) => {
    if (!key) return;
    stop();
    await loadBulletin();
});

watch(withDetail, () => {
    const wasPlaying = status.value === 'playing';
    const itemId = currentSegment.value?.itemId;
    stop();
    rebuildScript();
    if (wasPlaying && itemId) playFrom(itemId);
});

watch(rate, () => {
    // Rate cannot be changed on an utterance already speaking, so the current
    // line is restarted at the new speed. Restarting the whole bulletin would
    // lose the listener's place.
    if (status.value === 'playing' && cursor.value >= 0) speakSegment(cursor.value);
});

function relativeTime(iso: string): string {
    if (!iso) return '';
    const then = new Date(iso).getTime();
    if (Number.isNaN(then)) return '';
    const minutes = Math.max(0, Math.round((Date.now() - then) / 60000));
    if (minutes < 1) return language.value === 'ar' ? 'الآن' : 'just now';
    if (minutes < 60) return language.value === 'ar' ? `قبل ${minutes} د` : `${minutes}m ago`;
    const hours = Math.round(minutes / 60);
    if (hours < 24) return language.value === 'ar' ? `قبل ${hours} س` : `${hours}h ago`;
    const days = Math.round(hours / 24);
    return language.value === 'ar' ? `قبل ${days} ي` : `${days}d ago`;
}

function categoryLabel(category: NewsCategory): string {
    return language.value === 'ar'
        ? (category.label || category.label_en)
        : (category.label_en || category.label);
}

/* ------------------------------------------------------------------ *
 * Lifecycle
 * ------------------------------------------------------------------ */

onMounted(async () => {
    speechSupported.value = typeof window !== 'undefined' && 'speechSynthesis' in window;
    if (speechSupported.value) {
        refreshVoices();
        // Fires once the list is populated, and on some platforms again later.
        window.speechSynthesis.addEventListener('voiceschanged', refreshVoices);
    }
    await loadLanguages();
    await Promise.all([loadCatalogue(), loadTicker()]);
    await loadBulletin();
});

onBeforeUnmount(() => {
    stop();
    if (speechSupported.value) {
        window.speechSynthesis.removeEventListener('voiceschanged', refreshVoices);
    }
    bedAudio = null;
});

// `speechSynthesis` belongs to the window, not to this component: without this
// the anchor keeps reading over whatever page the user opens next.
onBeforeRouteLeave(() => {
    stop();
});
</script>

<template>
    <div class="newscast" :dir="t.dir" :lang="language">
        <!-- Header ---------------------------------------------------- -->
        <header class="newscast__header">
            <div class="newscast__brand">
                <span class="newscast__logo"><Radio :size="22" /></span>
                <div>
                    <h1 class="newscast__title">{{ t.title }}</h1>
                    <p class="newscast__subtitle">{{ t.subtitle }}</p>
                </div>
            </div>

            <div class="newscast__pickers">
                <label class="picker">
                    <span class="picker__label"><Languages :size="14" /> {{ t.language }}</span>
                    <select v-model="language" class="picker__select">
                        <option value="en">English</option>
                        <option value="ar">العربية</option>
                    </select>
                </label>

                <label class="picker picker--wide">
                    <span class="picker__label">{{ t.category }}</span>
                    <select v-model="activeKey" class="picker__select" :disabled="!categories.length">
                        <option v-for="category in categories" :key="category.key" :value="category.key">
                            {{ categoryLabel(category) }} — {{ category.source_label }} ({{ category.count }})
                        </option>
                    </select>
                </label>

                <button class="icon-btn" :title="t.refresh" :aria-label="t.refresh"
                        :disabled="loading" @click="loadCatalogue().then(loadBulletin).then(loadTicker)">
                    <RefreshCw :size="16" :class="{ spinning: loading }" />
                </button>
            </div>
        </header>

        <!-- Studio ---------------------------------------------------- -->
        <section class="studio" :class="{ 'studio--live': status === 'playing' }">
            <div class="studio__backdrop" aria-hidden="true">
                <span class="studio__glow"></span>
                <span class="studio__grid"></span>
            </div>

            <div class="studio__anchors">
                <NewsAnchor
                    anchor="female"
                    :name="anchorNames.female"
                    :voice-label="voiceLabel('female')"
                    :speaking="speakingAnchor === 'female'"
                    :active="speakingAnchor === 'female' || status !== 'playing'"
                />
                <NewsAnchor
                    anchor="male"
                    :name="anchorNames.male"
                    :voice-label="voiceLabel('male')"
                    :speaking="speakingAnchor === 'male'"
                    :active="speakingAnchor === 'male' || status !== 'playing'"
                />
            </div>

            <!-- Lower third: what is being said right now -->
            <div class="lower-third" :class="{ 'lower-third--on': !!currentSegment }">
                <div class="lower-third__kicker">
                    <span class="lower-third__live" :class="{ 'is-live': status === 'playing' }">
                        {{ status === 'playing' ? t.onAir : t.ready }}
                    </span>
                    <span v-if="activeCategory" class="lower-third__cat">
                        {{ categoryLabel(activeCategory) }} · {{ activeCategory.source_label }}
                    </span>
                    <span v-if="currentItem?.fresh" class="badge badge--fresh">{{ t.fresh }}</span>
                </div>
                <p class="lower-third__text">
                    {{ currentItem?.title || currentSegment?.text || t.ready }}
                </p>
                <div class="lower-third__bar" :style="{ width: progress + '%' }"></div>
            </div>
        </section>

        <!-- Ticker ---------------------------------------------------- -->
        <NewsTicker :headlines="tickerLines" :rtl="rtl" :label="t.breaking">
            <template #empty>{{ loading ? t.loading : t.empty }}</template>
        </NewsTicker>

        <!-- Transport ------------------------------------------------- -->
        <section class="transport">
            <div class="transport__buttons">
                <button class="ctrl" :title="t.previous" :aria-label="t.previous"
                        :disabled="!script.length" @click="skip(-1)">
                    <SkipBack :size="18" />
                </button>

                <button v-if="status !== 'playing'" class="ctrl ctrl--primary"
                        :disabled="!script.length || loading" @click="play">
                    <Play :size="18" />
                    <span>{{ status === 'paused' ? t.resume : t.play }}</span>
                </button>
                <button v-else class="ctrl ctrl--primary" @click="pause">
                    <Pause :size="18" />
                    <span>{{ t.pause }}</span>
                </button>

                <button class="ctrl" :title="t.next" :aria-label="t.next"
                        :disabled="!script.length" @click="skip(1)">
                    <SkipForward :size="18" />
                </button>

                <button class="ctrl" :title="t.stop" :aria-label="t.stop"
                        :disabled="status === 'idle'" @click="stop">
                    <Square :size="16" />
                </button>

                <button class="ctrl" :title="musicOn ? t.unmuted : t.muted"
                        :aria-label="musicOn ? t.unmuted : t.muted" @click="toggleMusic">
                    <Volume2 v-if="musicOn" :size="18" />
                    <VolumeX v-else :size="18" />
                </button>
            </div>

            <div class="transport__options">
                <label class="switch">
                    <input v-model="withDetail" type="checkbox" />
                    <span>{{ withDetail ? t.readDetail : t.headlinesOnly }}</span>
                </label>

                <label class="slider">
                    <span class="slider__label"><Gauge :size="14" /> {{ t.speed }}</span>
                    <input v-model.number="rate" type="range" min="0.7" max="1.4" step="0.1" />
                    <span class="slider__value">{{ rate.toFixed(1) }}×</span>
                </label>

                <span class="transport__meta">
                    <Clock :size="14" /> {{ t.running }} ≈ {{ runningTime }}
                </span>
            </div>
        </section>

        <!-- Errors / empty -------------------------------------------- -->
        <div v-if="!speechSupported" class="notice notice--warn">
            <AlertCircle :size="16" /> {{ t.unsupported }}
        </div>
        <div v-if="error" class="notice notice--error">
            <AlertCircle :size="16" /> {{ error }}
        </div>
        <div v-else-if="!loading && !categories.length" class="notice">
            <AlertCircle :size="16" /> {{ t.noCategories }}
        </div>

        <!-- Story + rundown -------------------------------------------- -->
        <section class="body">
            <article v-if="currentItem" class="story">
                <img v-if="currentItem.image" class="story__image" :src="currentItem.image"
                     :alt="currentItem.title" loading="lazy" referrerpolicy="no-referrer" />
                <div class="story__content">
                    <div class="story__meta">
                        <span class="badge">{{ currentItem.source_label }}</span>
                        <span v-if="currentItem.fresh" class="badge badge--fresh">{{ t.fresh }}</span>
                        <span class="story__time">{{ relativeTime(currentItem.published_at) }}</span>
                    </div>
                    <h2 class="story__title">{{ currentItem.title }}</h2>
                    <p v-if="currentItem.summary" class="story__summary">{{ currentItem.summary }}</p>
                    <p v-for="(paragraph, index) in currentItem.paragraphs.slice(0, 8)"
                       :key="index" class="story__para">{{ paragraph }}</p>
                    <a class="story__link" :href="currentItem.url" target="_blank"
                       rel="noopener noreferrer">
                        {{ t.openOriginal }} <ExternalLink :size="14" />
                    </a>
                </div>
            </article>

            <aside class="rundown">
                <h3 class="rundown__title">
                    {{ t.rundown }}
                    <span v-if="bulletin" class="rundown__count">
                        {{ bulletin.count }} {{ t.stories }}
                    </span>
                </h3>
                <p v-if="bulletin" class="rundown__updated">
                    {{ t.updated }} {{ relativeTime(bulletin.generated_at) }}
                </p>

                <ol class="rundown__list">
                    <li v-for="(item, index) in rundown" :key="item.id">
                        <button
                            class="rundown__item"
                            :class="{ 'is-current': currentItem?.id === item.id }"
                            @click="playFrom(item.id)"
                        >
                            <span class="rundown__index">{{ index + 1 }}</span>
                            <span class="rundown__text">
                                <span class="rundown__headline">{{ item.title }}</span>
                                <span class="rundown__sub">
                                    {{ item.source_label }} · {{ relativeTime(item.published_at) }}
                                    <template v-if="item.fresh"> · {{ t.fresh }}</template>
                                </span>
                            </span>
                        </button>
                    </li>
                </ol>

                <p v-if="!rundown.length && !loading" class="rundown__empty">{{ t.empty }}</p>
            </aside>
        </section>
    </div>
</template>

<style scoped>
.newscast {
    display: flex;
    flex-direction: column;
    gap: 1rem;
    padding: 1.25rem;
    max-width: 1400px;
    margin: 0 auto;
    color: var(--sfs-text, #eef1f8);
}

/* -- header ---------------------------------------------------------- */
.newscast__header {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: space-between;
    gap: 1rem;
}

.newscast__brand {
    display: flex;
    align-items: center;
    gap: 0.75rem;
}

.newscast__logo {
    display: grid;
    place-items: center;
    width: 2.6rem;
    height: 2.6rem;
    border-radius: 0.7rem;
    background: var(--sfs-danger, #d24b5a);
    color: var(--sfs-on-danger, #ffffff);
}

.newscast__title {
    margin: 0;
    font-size: 1.4rem;
    font-weight: 800;
    color: var(--sfs-text, #eef1f8);
}

.newscast__subtitle {
    margin: 0.1rem 0 0;
    font-size: 0.82rem;
    color: var(--sfs-text-muted, #a8b0c5);
}

.newscast__pickers {
    display: flex;
    flex-wrap: wrap;
    align-items: flex-end;
    gap: 0.6rem;
}

.picker {
    display: flex;
    flex-direction: column;
    gap: 0.2rem;
    min-width: 0;
}

.picker--wide .picker__select {
    min-width: 15rem;
    max-width: 22rem;
}

.picker__label {
    display: inline-flex;
    align-items: center;
    gap: 0.3rem;
    font-size: 0.7rem;
    font-weight: 600;
    letter-spacing: 0.03em;
    color: var(--sfs-text-muted, #a8b0c5);
}

.picker__select {
    padding: 0.45rem 0.6rem;
    border-radius: 0.5rem;
    border: 1px solid rgb(var(--sfs-line-rgb, 255 255 255) / 0.18);
    background: rgb(var(--sfs-tint-rgb, 255 255 255) / 0.08);
    color: var(--sfs-text, #eef1f8);
    font-size: 0.86rem;
    max-width: 100%;
}

.icon-btn {
    display: grid;
    place-items: center;
    width: 2.2rem;
    height: 2.2rem;
    border-radius: 0.5rem;
    border: 1px solid rgb(var(--sfs-line-rgb, 255 255 255) / 0.18);
    background: rgb(var(--sfs-tint-rgb, 255 255 255) / 0.08);
    color: var(--sfs-text, #eef1f8);
    cursor: pointer;
}

.icon-btn:disabled { opacity: 0.5; cursor: default; }

.spinning { animation: spin 1s linear infinite; }
@keyframes spin { to { transform: rotate(360deg); } }

/* -- studio ---------------------------------------------------------- */
.studio {
    position: relative;
    border-radius: 1rem;
    overflow: hidden;
    border: 1px solid rgb(var(--sfs-line-rgb, 255 255 255) / 0.14);
    background: rgb(var(--sfs-tint-rgb, 255 255 255) / 0.05);
    padding: 1rem 1rem 0;
    min-height: 260px;
}

.studio--live {
    border-color: rgb(var(--sfs-danger-rgb, 210 75 90) / 0.5);
}

.studio__backdrop { position: absolute; inset: 0; overflow: hidden; }

.studio__glow {
    position: absolute;
    inset-inline-start: 50%;
    top: -35%;
    width: 60%;
    aspect-ratio: 1;
    transform: translateX(-50%);
    border-radius: 50%;
    background: radial-gradient(circle,
        rgb(var(--sfs-accent-rgb, 102 126 234) / 0.28), transparent 68%);
}

.studio__grid {
    position: absolute;
    inset: 0;
    background-image:
        linear-gradient(rgb(var(--sfs-line-rgb, 255 255 255) / 0.05) 1px, transparent 1px),
        linear-gradient(90deg, rgb(var(--sfs-line-rgb, 255 255 255) / 0.05) 1px, transparent 1px);
    background-size: 42px 42px;
    mask-image: linear-gradient(to bottom, rgb(0 0 0 / 0.55), transparent 72%);
}

.studio__anchors {
    position: relative;
    display: flex;
    align-items: flex-end;
    justify-content: center;
    gap: 1.5rem;
    max-width: 620px;
    margin: 0 auto;
}

/* -- lower third ----------------------------------------------------- */
.lower-third {
    position: relative;
    margin: 0.6rem -1rem 0;
    padding: 0.6rem 1rem 0.85rem;
    background: rgb(var(--sfs-tint-rgb, 255 255 255) / 0.1);
    border-top: 1px solid rgb(var(--sfs-line-rgb, 255 255 255) / 0.14);
    opacity: 0.65;
    transition: opacity 0.3s ease;
}

.lower-third--on { opacity: 1; }

.lower-third__kicker {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 0.45rem;
    margin-bottom: 0.3rem;
}

.lower-third__live {
    font-size: 0.63rem;
    font-weight: 800;
    letter-spacing: 0.08em;
    padding: 0.12rem 0.42rem;
    border-radius: 0.25rem;
    background: rgb(var(--sfs-tint-rgb, 255 255 255) / 0.16);
    color: var(--sfs-text-muted, #a8b0c5);
}

.lower-third__live.is-live {
    background: var(--sfs-danger, #d24b5a);
    color: var(--sfs-on-danger, #ffffff);
}

.lower-third__cat {
    font-size: 0.72rem;
    color: var(--sfs-text-muted, #a8b0c5);
}

.lower-third__text {
    margin: 0;
    font-size: 1.05rem;
    font-weight: 700;
    line-height: 1.35;
    color: var(--sfs-text, #eef1f8);
}

.lower-third__bar {
    position: absolute;
    inset-inline-start: 0;
    bottom: 0;
    height: 3px;
    background: var(--sfs-accent, #667eea);
    transition: width 0.4s ease;
}

/* -- transport ------------------------------------------------------- */
.transport {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: space-between;
    gap: 0.8rem;
    padding: 0.7rem 0.85rem;
    border-radius: 0.75rem;
    background: rgb(var(--sfs-tint-rgb, 255 255 255) / 0.06);
    border: 1px solid rgb(var(--sfs-line-rgb, 255 255 255) / 0.14);
}

.transport__buttons { display: flex; align-items: center; gap: 0.4rem; }

.ctrl {
    display: inline-flex;
    align-items: center;
    gap: 0.4rem;
    padding: 0.5rem 0.7rem;
    border-radius: 0.55rem;
    border: 1px solid rgb(var(--sfs-line-rgb, 255 255 255) / 0.18);
    background: rgb(var(--sfs-tint-rgb, 255 255 255) / 0.08);
    color: var(--sfs-text, #eef1f8);
    font-size: 0.85rem;
    font-weight: 600;
    cursor: pointer;
}

.ctrl:hover:not(:disabled) { background: rgb(var(--sfs-tint-rgb, 255 255 255) / 0.14); }
.ctrl:disabled { opacity: 0.45; cursor: default; }

.ctrl--primary {
    background: var(--sfs-accent, #667eea);
    color: var(--sfs-on-accent, #ffffff);
    border-color: transparent;
}

.ctrl--primary:hover:not(:disabled) {
    background: var(--sfs-accent-strong, var(--sfs-accent, #5568d8));
}

.transport__options {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 1rem;
}

.switch, .slider {
    display: inline-flex;
    align-items: center;
    gap: 0.4rem;
    font-size: 0.8rem;
    color: var(--sfs-text-muted, #a8b0c5);
}

.slider__label { display: inline-flex; align-items: center; gap: 0.3rem; }
.slider__value { min-width: 2.2rem; font-variant-numeric: tabular-nums; }
.slider input { accent-color: var(--sfs-accent, #667eea); }

.transport__meta {
    display: inline-flex;
    align-items: center;
    gap: 0.35rem;
    font-size: 0.78rem;
    color: var(--sfs-text-muted, #a8b0c5);
}

/* -- notices --------------------------------------------------------- */
.notice {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.6rem 0.8rem;
    border-radius: 0.55rem;
    font-size: 0.85rem;
    background: rgb(var(--sfs-tint-rgb, 255 255 255) / 0.08);
    color: var(--sfs-text, #eef1f8);
}

.notice--warn {
    background: rgb(var(--sfs-warning-rgb, 232 196 92) / 0.16);
    color: var(--sfs-warning-text, #f0d590);
}

.notice--error {
    background: rgb(var(--sfs-danger-rgb, 210 75 90) / 0.16);
    color: var(--sfs-danger-text, #f3a3ad);
}

/* -- body ------------------------------------------------------------ */
.body {
    display: grid;
    grid-template-columns: minmax(0, 1.65fr) minmax(0, 1fr);
    gap: 1rem;
    align-items: start;
}

.story {
    border-radius: 0.85rem;
    overflow: hidden;
    background: rgb(var(--sfs-tint-rgb, 255 255 255) / 0.06);
    border: 1px solid rgb(var(--sfs-line-rgb, 255 255 255) / 0.14);
}

.story__image {
    width: 100%;
    max-height: 320px;
    object-fit: cover;
    display: block;
}

.story__content { padding: 1rem; }

.story__meta {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 0.4rem;
    margin-bottom: 0.5rem;
}

.badge {
    font-size: 0.66rem;
    font-weight: 700;
    padding: 0.12rem 0.42rem;
    border-radius: 0.25rem;
    background: rgb(var(--sfs-accent-rgb, 102 126 234) / 0.28);
    color: var(--sfs-accent-text, #cfd6ff);
}

.badge--fresh {
    background: rgb(var(--sfs-success-rgb, 74 190 130) / 0.3);
    color: var(--sfs-success-text, #9ce6c0);
}

.story__time { font-size: 0.74rem; color: var(--sfs-text-muted, #a8b0c5); }

.story__title {
    margin: 0 0 0.5rem;
    font-size: 1.3rem;
    line-height: 1.35;
    color: var(--sfs-text, #eef1f8);
}

.story__summary {
    margin: 0 0 0.7rem;
    font-size: 0.95rem;
    font-weight: 600;
    line-height: 1.6;
    color: var(--sfs-text, #eef1f8);
}

.story__para {
    margin: 0 0 0.6rem;
    font-size: 0.9rem;
    line-height: 1.75;
    color: var(--sfs-text-muted, #c2c9da);
}

.story__link {
    display: inline-flex;
    align-items: center;
    gap: 0.35rem;
    font-size: 0.83rem;
    font-weight: 600;
    color: var(--sfs-accent-text, #cfd6ff);
    text-decoration: none;
}

.story__link:hover { text-decoration: underline; }

/* -- rundown --------------------------------------------------------- */
.rundown {
    border-radius: 0.85rem;
    padding: 0.85rem;
    background: rgb(var(--sfs-tint-rgb, 255 255 255) / 0.06);
    border: 1px solid rgb(var(--sfs-line-rgb, 255 255 255) / 0.14);
    position: sticky;
    top: 1rem;
    max-height: calc(100vh - 2rem);
    overflow-y: auto;
}

.rundown__title {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    gap: 0.5rem;
    margin: 0 0 0.15rem;
    font-size: 0.95rem;
    color: var(--sfs-text, #eef1f8);
}

.rundown__count, .rundown__updated {
    font-size: 0.72rem;
    font-weight: 500;
    color: var(--sfs-text-muted, #a8b0c5);
}

.rundown__updated { margin: 0 0 0.6rem; }

.rundown__list {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 0.3rem;
}

.rundown__item {
    display: flex;
    align-items: flex-start;
    gap: 0.55rem;
    width: 100%;
    padding: 0.5rem;
    border-radius: 0.5rem;
    border: 1px solid transparent;
    background: transparent;
    color: inherit;
    cursor: pointer;
    text-align: start;
}

.rundown__item:hover { background: rgb(var(--sfs-tint-rgb, 255 255 255) / 0.09); }

.rundown__item.is-current {
    background: rgb(var(--sfs-accent-rgb, 102 126 234) / 0.2);
    border-color: rgb(var(--sfs-accent-rgb, 102 126 234) / 0.45);
}

.rundown__index {
    flex: 0 0 auto;
    display: grid;
    place-items: center;
    width: 1.4rem;
    height: 1.4rem;
    border-radius: 0.3rem;
    font-size: 0.7rem;
    font-weight: 700;
    background: rgb(var(--sfs-tint-rgb, 255 255 255) / 0.14);
    color: var(--sfs-text, #eef1f8);
}

.rundown__text { display: flex; flex-direction: column; gap: 0.12rem; min-width: 0; }

.rundown__headline {
    font-size: 0.84rem;
    font-weight: 600;
    line-height: 1.35;
    color: var(--sfs-text, #eef1f8);
}

.rundown__sub, .rundown__empty {
    font-size: 0.7rem;
    color: var(--sfs-text-muted, #a8b0c5);
}

@media (max-width: 900px) {
    .body { grid-template-columns: minmax(0, 1fr); }
    .rundown { position: static; max-height: none; }
    .studio__anchors { gap: 0.75rem; }
}
</style>
