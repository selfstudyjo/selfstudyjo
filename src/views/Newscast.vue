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

import { localeId } from '@/i18n/runtime';
import { onBeforeRouteLeave } from 'vue-router';
import {
    Radio, Play, Pause, SkipForward, SkipBack, Square, Volume2, VolumeX,
    RefreshCw, AlertCircle, ExternalLink, Clock, Languages, Gauge, Mic,
} from 'lucide-vue-next';

import NewsStudio from '@/components/newscast/NewsStudio.vue';
import NewsTicker from '@/components/newscast/NewsTicker.vue';
import {
    OTHER_ANCHOR,
    buildScript, bedIndexFor, bedTrimFor, bedVolumeFor, castVoices, estimateScriptMs,
    hasGenderedPair, isRtl, storyOrder, utteranceLang, voicesFor,
    type AnchorId, type LanguageCode, type Segment, type VoiceLike,
} from '@/components/newscast/newscastEngine';
import {
    IDENTITY_RATIO,
    canShape, shapeRatio, timeScale,
} from '@/components/newscast/voiceShaper';
import { createVoiceChain, prepareVoice, type VoiceChain } from '@/utils/speechAudio';
import {
    ApiError,
} from '@/services/api';
import {
    newsService, splitCategoryPath,
    type NewsBulletin, type NewsCategory, type NewsHeadline, type NewsLanguageInfo,
    type SpeechCapabilities, type SpeechClip,
} from '@/services/news.service';

/**
 * Where the voice comes from.
 *
 * `device` is the Web Speech API — instant, free, no network, and only able to
 * speak languages the OS has a voice for. `server` is app 36 synthesising an
 * MP3 with a free neural voice, which works on every device and costs a round
 * trip on the first play of each line.
 *
 * `auto` picks `device` when the OS has a voice for the selected language and
 * `server` when it does not, which is the whole point: Arabic works everywhere
 * without the reader having to know why.
 */
type SpeechSource = 'auto' | 'device' | 'server';

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
        sharedVoice: 'only voice available',
        noVoice: 'no matching voice',
        voices: 'Voices',
        autoVoice: 'Automatic',
        noVoiceHelp: 'This device has no English voice installed, so the bulletin is being read '
            + 'by the Self Study voice service instead. Nothing to install.',
        speechFailed: 'Speech synthesis stopped responding. Try again, or switch the voice source.',
        source: 'Voice from', sourceAuto: 'Automatic', sourceDevice: 'This device',
        sourceServer: 'Self Study (any device)',
        buffering: 'Preparing audio…',
        serverVoice: 'Self Study voice service',
        maleVoice: 'male voice', femaleVoice: 'female voice',
        noPairHelp: 'This device only has voices of one gender for this language, so the two presenters are being read by the Self Study voice service instead.',
        soloHelp: 'The voice service on this replica can only produce one voice at the '
            + 'moment, so this bulletin is being read by a single presenter. Two presenters '
            + 'return automatically once the replica is fixed — one of them would otherwise '
            + 'be read in the wrong voice.',
        soloBadge: 'Single presenter',
        onAirVoices: 'On-air voices',
        shapedBadge: 'stand-in',
        shapedHelp: 'The voice service on this replica only has a female voice at the moment, '
            + 'so Adam is reading through a stand-in voice pitched into his own register. '
            + 'He keeps his slot; the real voice returns automatically once the replica is fixed.',
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
        sharedVoice: 'الصوت العربي الوحيد المتاح',
        noVoice: 'لا يوجد صوت عربي',
        voices: 'الأصوات',
        autoVoice: 'تلقائي',
        // No longer a dead end. A missing OS voice is now just a note about
        // which engine is doing the reading — the bulletin plays either way.
        noVoiceHelp: 'لا يوجد صوت عربي مثبّت على هذا الجهاز، لذلك تُقرأ النشرة بصوت خدمة '
            + '"سيلف ستدي" الصوتية. لا حاجة لتثبيت أي شيء.',
        speechFailed: 'توقف محرك الصوت عن الاستجابة. حاول مرة أخرى أو غيّر مصدر الصوت.',
        source: 'مصدر الصوت', sourceAuto: 'تلقائي', sourceDevice: 'هذا الجهاز',
        sourceServer: 'خدمة سيلف ستدي (يعمل على كل الأجهزة)',
        buffering: 'جارٍ تجهيز الصوت…',
        serverVoice: 'خدمة سيلف ستدي الصوتية',
        maleVoice: 'صوت رجل', femaleVoice: 'صوت امرأة',
        noPairHelp: 'لا يتوفر على هذا الجهاز سوى أصوات من جنس واحد لهذه اللغة، لذلك يقرأ المذيعان بصوت خدمة سيلف ستدي الصوتية (رجل وامرأة).',
        soloHelp: 'لا تستطيع خدمة الصوت على هذا الخادم توفير سوى صوت واحد حاليا، لذلك تُقرأ '
            + 'النشرة بمذيع واحد. سيعود المذيعان تلقائيا بعد إصلاح الخادم — وإلا لقرأ أحدهما '
            + 'بصوت لا يخصه.',
        soloBadge: 'مذيع واحد',
        onAirVoices: 'أصوات النشرة',
        shapedBadge: 'صوت بديل',
        shapedHelp: 'لا يتوفر على خدمة الصوت في هذا الخادم سوى صوت أنثوي حاليا، لذلك يقرأ آدم '
            + 'بصوت بديل مضبوط على طبقته الصوتية. يبقى آدم في مكانه، ويعود صوته الأصلي تلقائيا '
            + 'بعد إصلاح الخادم.',
        breaking: 'عاجل', fresh: 'جديد',
    },
    /*
     * Chinese — the page's own chrome only.
     *
     * There is no Chinese BULLETIN and this entry does not imply one: Airflow
     * scrapes RT and Al Jazeera in Arabic and English, so those are the two the
     * category picker offers. What this gives a Chinese reader is a Chinese
     * page around whichever bulletin they choose, which is the honest version
     * of "the Newscast supports Chinese" — the alternative was an English page
     * with an English bulletin, on the one screen that needs no account at all.
     */
    zh: {
        dir: 'ltr', title: '新闻播报', subtitle: '国际新闻，每小时为你播报',
        language: '语言', category: '分类', play: '开始播报',
        pause: '暂停', resume: '继续', stop: '结束', next: '下一条',
        previous: '上一条', refresh: '刷新', loading: '正在加载新闻……',
        noCategories: '还没有发布任何新闻。每小时的抓取任务可能没有运行。',
        empty: '此分类目前没有新闻。', onAir: '直播中', ready: '就绪',
        updated: '更新于', stories: '条', running: '播报时长',
        readDetail: '播报详细内容', headlinesOnly: '仅播报头条',
        speed: '速度', muted: '音乐已关闭', unmuted: '音乐已开启',
        openOriginal: '打开原文', rundown: '播报顺序',
        unsupported: '此浏览器无法朗读文字。下方的头条仍然是实时的。',
        sharedVoice: '唯一可用的语音',
        noVoice: '没有匹配的语音',
        voices: '语音',
        autoVoice: '自动',
        noVoiceHelp: '此设备没有安装相应语言的语音，因此新闻由 Self Study 语音服务朗读。'
            + '无需安装任何东西。',
        speechFailed: '语音合成停止响应。请重试，或更换语音来源。',
        source: '语音来自', sourceAuto: '自动', sourceDevice: '此设备',
        sourceServer: 'Self Study（任意设备可用）',
        buffering: '正在准备音频……',
        serverVoice: 'Self Study 语音服务',
        maleVoice: '男声', femaleVoice: '女声',
        noPairHelp: '此设备只有单一性别的语音，因此两位主播改由 Self Study 语音服务朗读。',
        soloHelp: '此副本上的语音服务目前只能生成一个声音，因此本次播报由一位主播完成。'
            + '副本修复后会自动恢复两位主播 —— 否则其中一位会被用错性别的声音朗读。',
        soloBadge: '单人播报',
        onAirVoices: '在播语音',
        shapedBadge: '替代声音',
        shapedHelp: '此副本上的语音服务目前只有女声，因此 Adam 使用一个调整到他音域的替代声音朗读。'
            + '他仍然保留自己的位置，副本修复后会自动恢复他本来的声音。',
        breaking: '突发', fresh: '最新',
    },
} as const;

/* ------------------------------------------------------------------ *
 * State
 * ------------------------------------------------------------------ */

/**
 * The BULLETIN's language — which set of scraped stories to read.
 *
 * Opens on the site language when there are bulletins in it, and on English
 * otherwise: an Arabic reader arriving on this page wants Arabic news, and a
 * Chinese one has no Chinese news to want. Only the OPENING value, so the
 * category picker still switches it freely — somebody reading the site in
 * Arabic is perfectly entitled to listen to the English bulletin.
 */
const language = ref<LanguageCode>(
    (localeId.value === 'ar' || localeId.value === 'en') ? localeId.value : 'en',
);
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
/** Every installed voice for the selected language — drives the two pickers. */
const availableVoices = ref<VoiceLike[]>([]);
/** Operator overrides from those pickers, cleared when the language changes. */
const chosenVoice = reactive<{ female: string; male: string }>({ female: '', male: '' });
/** The server voice each anchor last spoke with — displayed, so it is checkable. */
const serverVoices = reactive<{ female: string; male: string }>({ female: '', male: '' });
/**
 * What the backend says it can voice, or null before it has been asked.
 *
 * `paired: false` means the replica is down to a provider with one voice per
 * language, and the bulletin has to be read by a single presenter. Null is
 * treated as paired: a replica running an older build has no such route, and
 * "assume two anchors" is exactly how the page behaved before this existed.
 */
const capabilities = ref<SpeechCapabilities | null>(null);
/** Consecutive synthesis failures, so a dead engine stops rather than silently skipping. */
let failures = 0;

const speechSource = ref<SpeechSource>('auto');
const serverSpeechError = ref('');
/** True while a line is being synthesised — the anchors should not mime through it. */
const buffering = ref(false);

let utterance: SpeechSynthesisUtterance | null = null;
let keepAlive: number | null = null;
let bedAudio: HTMLAudioElement | null = null;
/** The `<audio>` that plays server-synthesised speech. Separate from the bed. */
let voiceAudio: HTMLAudioElement | null = null;
let fadeTimer: number | null = null;
/** Guards the `onend` handler against a `cancel()` we issued ourselves. */
let generation = 0;

/* ---- reshaped speech, for the anchor the backend cannot voice --------- */

/**
 * Can this browser decode and play audio itself? Decided once; cannot change.
 *
 * Two jobs hang off it: reshaping the male anchor's voice, and setting the
 * LEVEL of every server clip — an `<audio>` element can only turn a quiet
 * provider down, never up. Without it the page falls back to the element,
 * which still plays, just at whatever level the provider chose.
 */
const webAudioReady = ref(canShape());

let audioContext: AudioContext | null = null;
let shapedSource: AudioBufferSourceNode | null = null;
/**
 * Where a voice clip is plugged in, and what it passes through on the way out.
 *
 * `source -> compressor -> makeup -> analyser -> destination`, and each stage
 * is there for a reason the page was reported for:
 *
 *  * **the compressor and the makeup gain** are the second half of "the Self
 *    Study voice is too quiet", and the half `normalizeLevel` cannot do.
 *    Levelling takes a clip to `TARGET_RMS` unless a peak would clip first, and
 *    for real speech the peak is what binds — a crest factor around four means
 *    one consonant decides the gain for the whole line and the average sits far
 *    below the ceiling. There is no more loudness available from a gain; there
 *    is a great deal available from reducing the crest, which is what every
 *    broadcaster does to a voice and why a radio announcer sounds present at a
 *    volume where a raw recording sounds distant. See `utils/speechAudio.ts`,
 *    which uses the same numbers for the two rooms.
 *
 *  * **the analyser** is what the 3D anchors' mouths move on. Without it they
 *    would be animated by a syllable model that has never heard the audio,
 *    which is the difference between good lip movement and a mouth that closes
 *    in the gaps between words because there genuinely is no audio in them.
 */
let voiceChain: VoiceChain | null = null;
let voiceProbe: Float32Array | null = null;
/**
 * Reshaped audio, keyed by clip and ratio.
 *
 * Worth keeping: the WSOLA pass is the one genuinely expensive thing on this
 * page, and a listener who skips back a story would otherwise pay for it twice.
 */
const shapedBuffers = new Map<string, AudioBuffer>();

/**
 * The page's own chrome, in the SITE's language — not the bulletin's.
 *
 * These are two different questions and they used to be one, which is why an
 * Arabic reader listening to the English bulletin got English buttons: `UI` was
 * indexed by `language`, the bulletin selector. Switching the story language
 * should change the stories, not the controls.
 *
 * Falls back to the bulletin language for a site language `UI` has no entry
 * for, which cannot happen today (all three are present) and is the right
 * behaviour if a fourth locale is added before its newscast strings are.
 */
const t = computed(() => UI[localeId.value as keyof typeof UI] ?? UI[language.value]);
const rtl = computed(() => isRtl(language.value));
const anchorNames = computed(() => ANCHOR_NAMES[language.value]);

const currentSegment = computed<Segment | null>(() =>
    cursor.value >= 0 ? script.value[cursor.value] ?? null : null);

// Not while buffering: an anchor whose mouth moves through two seconds of
// silence looks broken in a way that a still anchor does not.
const speakingAnchor = computed<AnchorId | null>(() =>
    status.value === 'playing' && !buffering.value
        ? currentSegment.value?.anchor ?? null
        : null);

/**
 * Who is at the desk — which shot the studio is cutting to.
 *
 * Not the same question as `speakingAnchor`, and the difference is what makes
 * the studio look alive rather than switched on and off. A presenter stays at
 * the desk while the bulletin is paused and while the next line is being
 * synthesised; they are only *speaking* in the second of those. Null means
 * nobody is on, and the camera is on the empty studio.
 */
const deskAnchor = computed<AnchorId | null>(() =>
    status.value === 'idle' ? null : (currentSegment.value?.anchor ?? null));

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
        // Overrides `firstAnchor` when set, which is what we want: one voice
        // reads the whole thing rather than the rota quietly casting the same
        // voice as both people.
        soloAnchor: soloAnchor.value,
    });
}

/**
 * Ask the backend whether it can field two anchors.
 *
 * Cheap on the backend (an import check plus whatever the last real synthesis
 * reported) and asked once per visit, before anything is spoken — the answer
 * changes the running order, so discovering it mid-bulletin means the listener
 * has already heard the wrong voice.
 */
async function loadCapabilities() {
    capabilities.value = await newsService.speechCapabilities();
}

/* ------------------------------------------------------------------ *
 * Voices
 * ------------------------------------------------------------------ */

function refreshVoices() {
    if (!speechSupported.value) return;
    const installed = window.speechSynthesis.getVoices() as unknown as VoiceLike[];
    if (!installed || !installed.length) return;      // fires again via voiceschanged

    availableVoices.value = voicesFor(installed, language.value);

    // An operator's pick wins, but only while it is still a voice for this
    // language — otherwise switching to Arabic would keep an English choice.
    const override = (anchor: AnchorId) =>
        availableVoices.value.find(v => v.name === chosenVoice[anchor]) ?? null;

    const cast = castVoices(installed, language.value);
    voices.female = override('female') ?? cast.female;
    voices.male = override('male') ?? cast.male;
}

/**
 * True when the browser has no voice at all for the selected language.
 *
 * This is a real, common state — a Windows install without the Arabic speech
 * pack has no `ar-*` voice — and it used to be *hidden* by casting an English
 * voice instead, which read Arabic text as gibberish. Saying so is the honest
 * answer; the bulletin still runs, because leaving `utterance.voice` unset lets
 * the platform try to match on `lang` alone and it sometimes succeeds.
 */
const missingVoice = computed(() =>
    speechSupported.value && availableVoices.value.length === 0);

/**
 * Which engine will actually speak.
 *
 * `auto` resolves to the server exactly when the device cannot speak the
 * selected language — including when the browser has no speech support at all,
 * which used to mean the page could not read anything.
 */
const activeSource = computed<'device' | 'server'>(() => {
    if (speechSource.value === 'server') return 'server';
    if (speechSource.value === 'device') return 'device';
    // The server failed and a device voice exists — keep the bulletin running
    // rather than stopping on principle.
    if (serverUnavailable.value && availableVoices.value.length) return 'device';
    if (!speechSupported.value || availableVoices.value.length === 0) return 'server';

    /*
      ARABIC GOES TO THE SERVER, unless the server cannot field a pair either.

      The first clause is the settled answer and it stays: several reports of
      the male anchor sounding female all came back to device Arabic voices, and
      each had a different cause — no Arabic voice at all, then two female
      voices and no male, then a male voice too light to read as one. The
      device's Arabic line-up is a lottery that varies by OS, browser and
      installed packs, and nothing here can measure it at runtime. The server
      pair is measured and fixed: Zariyah at 208 Hz and Hamed at 113 Hz, an
      octave apart, identical on every device.

      The exception is new, and it is the whole point of `capabilities`. That
      guarantee is what the rule was written for, and it does not hold when the
      replica has lost the provider that supplies it — the fallback has ONE
      voice per language and it is female, so "always the server" then means an
      Arabic bulletin read by two women, which is the report this rule exists to
      prevent. A device that has a genuinely gendered pair (`hasGenderedPair`,
      which is a measured question, not a hopeful one) is strictly better than
      that. When neither can pair, we stay on the server and read with one
      presenter — see `soloAnchor`.

      English device voices stay in use when the device can field a real pair —
      they are instant and they are usually right.
    */
    if (language.value === 'ar') {
        return (!serverPaired.value && devicePair.value) ? 'device' : 'server';
    }
    return devicePair.value ? 'device' : 'server';
});

/** Can the backend read a bulletin with two people? Unknown counts as yes. */
const serverPaired = computed(() => capabilities.value?.paired ?? true);

/** The gender the backend can actually voice when it cannot field a pair. */
const serverSoloGender = computed<AnchorId>(() =>
    capabilities.value?.languages?.[language.value]?.solo_gender === 'male'
        ? 'male' : 'female');

/**
 * The anchor whose audio has to be reshaped into their own register, or null.
 *
 * THE MAN IS NOT REMOVED. That was the first answer to a replica with only a
 * female voice on it, and it was the wrong one: a newsroom whose microphone
 * breaks does not delete a presenter. The backend renders his lines with the
 * only voice it has, says plainly that it is female (`X-Sfs-Voice-Gender`), and
 * the page drops it into a male register on the way to the speakers — see
 * `voiceShaper.ts`. He stays at the desk, he sounds like a different person,
 * and the name plate says the voice is a stand-in.
 *
 * It is a fallback, not the design. Install `edge-tts` on the replica and
 * `serverPaired` goes true, this returns null, and both anchors are back on
 * their own measured neural voices with nothing reshaped.
 */
const shapedAnchor = computed<AnchorId | null>(() => {
    if (!usingServer.value || serverPaired.value) return null;
    if (!webAudioReady.value) return null;      // then, and only then, solo
    return OTHER_ANCHOR[serverSoloGender.value];
});

/**
 * The one presenter this bulletin is read by, or null for the usual two.
 *
 * Now a genuine last resort — it needs the backend to be unable to pair AND the
 * browser to have no Web Audio, which is an unusual browser rather than an
 * unpatched replica. When there is honestly no way to give the man a voice of
 * his own, reading with one presenter still beats reading his lines as a woman.
 *
 * Only ever set under the server engine: the device path already refuses to
 * cast a mismatched pair (`hasGenderedPair` gates it, and `activeSource` sends
 * an unpairable device to the server), so a solo device bulletin is not a state
 * that can arise.
 */
const soloAnchor = computed<AnchorId | null>(() => {
    if (!usingServer.value || serverPaired.value) return null;
    if (webAudioReady.value) return null;
    return serverSoloGender.value;
});

/** Set after repeated server failures, so `auto` can fall back to the device. */
const serverUnavailable = ref(false);

/** Does the device have both a male and a female voice for this language? */
const devicePair = computed(() =>
    hasGenderedPair(availableVoices.value, language.value));

/** The reader is being read to by the backend rather than by their own device. */
const usingServer = computed(() => activeSource.value === 'server');

const sharingVoice = computed(() =>
    !!voices.female && voices.female.name === voices.male?.name);

function voiceLabel(anchor: AnchorId): string {
    // Under the server engine the device's voice list is irrelevant — saying
    // "no matching voice" there would be true and completely misleading. Name
    // the actual voice once one has spoken, so the reader can verify for
    // themselves that the male anchor is on a male voice.
    if (usingServer.value) {
        // A reshaped voice is named for what it IS — the fallback voice, moved
        // into this anchor's register — never for the voice it is standing in
        // for. Printing "male voice" over a pitched-down female one would be
        // the original bug, restated in the caption that exists to catch it.
        if (anchor === shapedAnchor.value) {
            return serverVoices[anchor]
                ? `${serverVoices[anchor]} → ${anchor === 'male' ? t.value.maleVoice : t.value.femaleVoice}`
                : t.value.serverVoice;
        }
        return serverVoices[anchor]
            ? `${serverVoices[anchor]} · ${anchor === 'male' ? t.value.maleVoice : t.value.femaleVoice}`
            : t.value.serverVoice;
    }
    const voice = voices[anchor];
    if (!voice) return t.value.noVoice;
    return sharingVoice.value ? `${voice.name} — ${t.value.sharedVoice}` : voice.name;
}

/**
 * The live `SpeechSynthesisVoice`, matched by name, or null.
 *
 * Null is a valid and useful answer — see `speakSegment`, which then leaves
 * `utterance.voice` alone rather than assigning a voice in the wrong language.
 */
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
    const opener = segment.kind === 'open' || segment.kind === 'close';
    const index = bedIndexFor(segment.itemIndex ?? 0);
    const wanted = opener ? bedOpen : BEDS[index];
    // The five tracks were mastered up to 5 dB apart, so one `volume` makes the
    // music jump between stories. The trim is measured, per track.
    const trim = bedTrimFor(opener ? 'open' : `bed${index}`);

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
        fadeBedTo(bedVolumeFor(segment) * trim);
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

/* ---- server speech ------------------------------------------------- */

function ensureVoiceAudio() {
    if (voiceAudio) return voiceAudio;
    voiceAudio = new Audio();
    voiceAudio.preload = 'auto';
    return voiceAudio;
}

/**
 * Warm the next line's audio while the current one plays.
 *
 * Synthesising a sentence takes a second or two on a cache miss. Without this,
 * every story would be followed by that much dead air, which on a newscast
 * reads as the thing having crashed. Fire and forget — a failed prefetch just
 * means the normal fetch happens when we get there.
 */
function prefetch(index: number) {
    if (!usingServer.value) return;
    const next = script.value[index];
    if (!next) return;
    newsService
        .speech(next.text, language.value, next.anchor, rate.value, '',
                shapedAnchor.value === next.anchor)
        .catch(() => undefined);
}

/* ---- reshaping ------------------------------------------------------- */

function ensureAudioContext(): AudioContext | null {
    if (audioContext) return audioContext;
    const Ctor = (window as any).AudioContext || (window as any).webkitAudioContext;
    if (!Ctor) return null;
    audioContext = new Ctor() as AudioContext;

    /*
      THE CHAIN IS `speechAudio.ts`'s, NOT A SECOND COPY OF IT.

      This function used to build its own compressor, its own makeup gain and its
      own analyser — the same nodes with the same numbers as `createSpeechAudio`,
      because the Newscast cannot use `SpeechAudio.play`: it suspends the context
      to pause, it prefetches the next line while this one is playing, and its
      `onended` advances the running order.

      Two copies of an audio graph is two places for the same defect, and that is
      exactly what happened: both were handing a 0.97-peak buffer to a 3.4x
      makeup gain across a compressor with a 4 ms attack, i.e. clipping the front
      of every stressed consonant. One was going to get fixed. Working rule 10 in
      a single repo — the same argument, one directory apart.
    */
    voiceChain = createVoiceChain(audioContext);
    voiceProbe = new Float32Array(voiceChain.analyser.fftSize);

    return audioContext;
}

/**
 * How loud the anchor is right now, 0…1. Drives the 3D mouths.
 *
 * Polled on an interval rather than read from the render loop, because the
 * renderer is inside the stage and this is a Vue prop. 40 ms is well under a
 * frame at 30 fps and the renderer smooths it anyway.
 */
const anchorEnergy = ref(0);
let energyTimer: number | null = null;

function trackEnergy(live: boolean) {
    if (energyTimer !== null) { window.clearInterval(energyTimer); energyTimer = null; }
    if (!live) { anchorEnergy.value = 0; return; }
    // `speechSynthesis` exposes no audio at all, and neither does the `<audio>`
    // fallback path, so both get a nominal figure and the syllable model in
    // `figures.ts` carries the movement.
    if (!webAudioReady.value) { anchorEnergy.value = 0.7; return; }
    energyTimer = window.setInterval(() => {
        if (!voiceChain || !voiceProbe || !shapedSource) { anchorEnergy.value = 0; return; }
        voiceChain.analyser.getFloatTimeDomainData(voiceProbe as Float32Array<ArrayBuffer>);
        let total = 0;
        for (let i = 0; i < voiceProbe.length; i++) total += voiceProbe[i] * voiceProbe[i];
        anchorEnergy.value = Math.max(0, Math.min(1, Math.sqrt(total / voiceProbe.length) / 0.34));
    }, 40);
}

function stopShaped() {
    trackEnergy(false);
    if (!shapedSource) return;
    shapedSource.onended = null;
    try { shapedSource.stop(); } catch { /* already finished */ }
    shapedSource = null;
}

/**
 * Play a server clip through Web Audio: levelled, and reshaped if it has to be.
 *
 * EVERY server clip comes through here, not just the reshaped ones, and that is
 * the fix for "the voice is too low". The provider hands back audio at a peak
 * of ~0.41 and a voiced RMS of ~0.10 — eight decibels of headroom left unused —
 * and an `<audio>` element has no way to take it back, because `volume` only
 * goes down. Against a music bed ducked to 0.12 that is not an anchor with a
 * bed under them, it is a duet. `normalizeLevel` sets it on the samples, where
 * it can be exact.
 *
 * The reshaping is two halves and only the first is ours: `timeScale` shortens
 * the audio to `ratio` of its length at unchanged pitch, then
 * `playbackRate = ratio` drops pitch and formants by that factor and puts the
 * length back. `ratio === 1` skips it entirely. See `voiceShaper.ts`.
 *
 * Web Audio costs the one thing the element gave us for free — `pause()` — so
 * pausing suspends the whole context instead.
 */
async function speakDecoded(clip: SpeechClip, ratio: number, mine: number) {
    const context = ensureAudioContext();
    if (!context) throw new Error('no audio context');
    if (context.state === 'suspended') await context.resume();

    const key = `${clip.url}|${ratio}`;
    let buffer = shapedBuffers.get(key);
    if (!buffer) {
        // Back through the object URL rather than holding the ArrayBuffer on
        // the clip: `decodeAudioData` DETACHES what it is given, so a shared
        // buffer would decode once and then be empty for every replay.
        const bytes = await (await fetch(clip.url)).arrayBuffer();
        const decoded = await context.decodeAudioData(bytes);
        const shaped = ratio === IDENTITY_RATIO
            ? Float32Array.from(decoded.getChannelData(0))
            : timeScale(decoded.getChannelData(0), ratio, decoded.sampleRate);
        /*
          Tilt, level, compress, limit — one function, shared with the two rooms.

          It used to be `normalizeLevel` here and a compressor plus a makeup gain
          on the graph, in two copies. See `prepareVoice`: the compression is on
          the samples now, because a `DynamicsCompressorNode` has an attack and
          no look-ahead, so the front of every plosive was reaching the speakers
          at the full makeup gain and clipping twelve decibels into the ceiling.
          That is the "a lot of noise" half of the Arabic male report.
        */
        prepareVoice(shaped, decoded.sampleRate, ratio);
        buffer = context.createBuffer(1, shaped.length, decoded.sampleRate);
        buffer.getChannelData(0).set(shaped);
        // Decoded PCM is ~25x the size of the MP3 it came from, and a bulletin
        // is forty lines. The cache is what stops a skip-back re-doing the
        // WSOLA pass; it does not need to hold the whole hour.
        if (shapedBuffers.size > 24) {
            const oldest = shapedBuffers.keys().next().value;
            if (oldest !== undefined) shapedBuffers.delete(oldest);
        }
        shapedBuffers.set(key, buffer);
    }
    if (mine !== generation) return;

    const source = context.createBufferSource();
    source.buffer = buffer;
    source.playbackRate.value = ratio;
    // Through the chain rather than straight at the destination: that is where
    // the analyser the 3D mouths move on lives. See `createVoiceChain`.
    source.connect(voiceChain?.input || context.destination);
    source.onended = () => {
        trackEnergy(false);
        if (mine !== generation || status.value !== 'playing') return;
        failures = 0;
        advance();
    };
    shapedSource = source;
    source.start();
    trackEnergy(true);
    buffering.value = false;
    prefetch(cursor.value + 1);
}

/**
 * Drop to a single presenter, mid-bulletin, and carry on from where we are.
 *
 * The backend refuses to voice an anchor it has no voice for (409
 * `no_gendered_voice`) rather than substituting the one voice it has. That
 * refusal is recoverable and this is the recovery: rebuild the running order
 * for one presenter and resume the story being read, so the listener hears a
 * handover line and then the same story continued, not an error.
 *
 * It duplicates what `loadCapabilities` normally settles before playback, and
 * it is not redundant — it is what covers a replica that loses the provider
 * mid-bulletin, a failover onto a differently-configured replica, and a page
 * that was open before the backend changed.
 */
function fallBackToSoloPresenter(gender: 'female' | 'male'): boolean {
    if (soloAnchor.value) return false;                 // already solo; not this
    const existing = capabilities.value;
    capabilities.value = {
        provider: 'google',
        edge: { ok: false },
        ...(existing || {}),
        paired: false,
        languages: {
            ...(existing?.languages || {}),
            [language.value]: {
                paired: false,
                genders: [gender],
                solo_gender: gender,
                voices: { female: null, male: null },
            },
        },
    };

    const itemId = currentSegment.value?.itemId;
    rebuildScript();
    failures = 0;
    serverSpeechError.value = '';
    if (status.value === 'playing') {
        // Resume the story, not the bulletin: restarting from the top would
        // make a provider hiccup sound like the page reloading itself.
        const index = itemId
            ? script.value.findIndex(s => s.itemId === itemId && s.kind === 'headline')
            : 0;
        speakSegment(index === -1 ? 0 : index);
    } else {
        cursor.value = -1;
    }
    return true;
}

async function speakViaServer(segment: Segment, mine: number) {
    const audio = ensureVoiceAudio();
    buffering.value = true;
    try {
        const clip = await newsService.speech(
            segment.text, language.value, segment.anchor, rate.value, '',
            shapedAnchor.value === segment.anchor);
        // The reader skipped, paused or stopped while this was synthesising.
        if (mine !== generation) return;

        /*
          THE LAST LINE OF DEFENCE, and the only one on this side of the wire.

          Every other guard against an anchor being read in the wrong voice
          lives in the backend, and the outage that prompted all of this got
          past all of them — the voice table was right, the pitch assertions
          passed, and the replica quietly fell through to a provider none of
          them described. So the page checks the audio it was actually given
          rather than the audio it asked for.

          What it does about a mismatch is the part that changed. It used to
          strike the anchor off the bulletin, which fixed the voice by removing
          the person. Now the audio is reshaped into his own register and he
          keeps reading; solo is only for a browser that cannot do that.
        */
        const rendered = clip.gender;
        // Branch on the MISMATCH, not on the ratio. `shapeRatio` answers 1 for
        // a direction it has no honest ratio for — a male-only provider asked
        // for the female anchor, which does not exist today and would need a
        // 1.65x up-shift that sounds like a cartoon. Keying off the ratio alone
        // would read that 1 as "nothing to do" and play the wrong voice, which
        // is the original bug arriving through the door built to stop it.
        const mismatched = !!rendered && rendered !== segment.anchor;
        const ratio = mismatched ? shapeRatio(rendered, segment.anchor) : IDENTITY_RATIO;

        if (mismatched && !(webAudioReady.value && ratio !== IDENTITY_RATIO)) {
            // Wrong voice and no way to put it right. Never play it.
            buffering.value = false;
            if (fallBackToSoloPresenter(rendered as 'female' | 'male')) return;
        }

        // Every clip, not only the reshaped ones: this is also where the level
        // is set, and both anchors were too quiet.
        if (webAudioReady.value) {
            await speakDecoded(clip, ratio, mine);
            return;
        }

        serverSpeechError.value = '';
        serverUnavailable.value = false;
        // Record what actually spoke. Shown under the anchor, because "is آدم
        // really a man?" was asked three times and the page could not answer
        // it — the reader had no way to see which voice they were hearing.
        serverVoices[segment.anchor] = clip.voice;

        audio.src = clip.url;
        audio.onended = () => {
            if (mine !== generation || status.value !== 'playing') return;
            failures = 0;
            advance();
        };
        audio.onerror = () => {
            if (mine !== generation) return;
            failures += 1;
            if (failures >= 3) {
                error.value = t.value.speechFailed;
                stop();
                return;
            }
            advance();
        };
        await audio.play();
        // Only once it is actually playing, so the next synthesis competes with
        // playback rather than with the one the listener is waiting on.
        prefetch(cursor.value + 1);
    } catch (err: any) {
        if (mine !== generation) return;

        // 409 `no_gendered_voice`: the replica has no voice for this anchor and
        // said so instead of substituting one. Not a failure to count — it is
        // an instruction, and the bulletin continues with one presenter.
        if (err instanceof ApiError && err.status === 409
            && err.data?.code === 'no_gendered_voice') {
            buffering.value = false;
            // The server names the gender it does have; with two of them,
            // "not the one we asked for" is the same answer, and is what a
            // body that did not survive a proxy falls back to.
            const gender = err.data?.available_gender === 'male' ? 'male'
                : err.data?.available_gender === 'female' ? 'female'
                : (segment.anchor === 'male' ? 'female' : 'male');
            if (fallBackToSoloPresenter(gender)) return;
        }

        serverSpeechError.value = err?.message || String(err);
        failures += 1;
        if (failures >= 3) {
            // Hand back to the device if it has anything at all, rather than
            // stopping. A wrong-sounding voice beats a silent newscast, and the
            // notice says which is happening.
            if (speechSource.value === 'auto' && availableVoices.value.length) {
                serverUnavailable.value = true;
                failures = 0;
                buffering.value = false;
                speakSegment(cursor.value);
                return;
            }
            error.value = serverSpeechError.value;
            stop();
            return;
        }
        advance();
    } finally {
        if (mine === generation) buffering.value = false;
    }
}

/* ---- the sequence -------------------------------------------------- */

function speakSegment(index: number) {
    const segment = script.value[index];
    if (!segment) {
        stop();
        return;
    }
    cursor.value = index;
    applyBed(segment);

    const mine = ++generation;
    // Silence whichever engine was last used — switching source mid-bulletin,
    // or skipping, must not leave two voices running. There are three of them
    // now, and the reshaped one is the easiest to forget: an
    // AudioBufferSourceNode keeps playing to the destination whatever the rest
    // of the page thinks, so a skip would leave the previous anchor talking
    // underneath the next one.
    if (speechSupported.value) window.speechSynthesis.cancel();
    stopShaped();
    if (voiceAudio) {
        voiceAudio.pause();
        voiceAudio.onended = null;
        voiceAudio.onerror = null;
    }

    if (usingServer.value) {
        void speakViaServer(segment, mine);
        return;
    }

    if (!speechSupported.value) return;

    const synth = window.speechSynthesis;

    utterance = new SpeechSynthesisUtterance(segment.text);
    const voice = nativeVoice(segment.anchor);

    // Assign the voice ONLY when it genuinely speaks the selected language.
    // `pickVoice` guarantees that or returns null, and the null case is the
    // important one: an explicitly assigned voice OVERRIDES `lang`, so putting
    // an English voice here and `ar-SA` below is what produced Arabic read with
    // English phonetics. Leaving it unset makes `lang` the only signal, which
    // the platform can still match against an OS voice it never listed.
    if (voice) utterance.voice = voice;
    utterance.lang = utteranceLang(language.value, voice);
    utterance.rate = rate.value;
    utterance.pitch = segment.anchor === 'female' ? 1.08 : 0.92;

    utterance.onend = () => {
        // A cancel() we issued ourselves also fires onend. Without the
        // generation guard, skipping a story starts the next segment twice and
        // the two anchors talk over each other.
        if (mine !== generation || status.value !== 'playing') return;
        failures = 0;
        advance();
    };
    utterance.onerror = (event: SpeechSynthesisErrorEvent) => {
        if (mine !== generation) return;
        // 'interrupted' and 'canceled' are us.
        if (event.error === 'interrupted' || event.error === 'canceled') return;

        // Anything else is a real failure of this one line, and skipping it is
        // better than stopping the news — unless the engine is failing on
        // everything, which is what a missing language pack or a dead network
        // voice looks like. Skipping silently through forty segments reads as
        // "the play button does nothing".
        failures += 1;
        if (failures >= 3) {
            error.value = missingVoice.value ? t.value.noVoiceHelp : t.value.speechFailed;
            stop();
            return;
        }
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
        // A buffer source cannot be paused, so pausing suspended the whole
        // context and resuming is the other half of that.
        void audioContext?.resume();
        if (voiceAudio && voiceAudio.src) voiceAudio.play().catch(() => undefined);
        if (currentSegment.value) applyBed(currentSegment.value);
        startKeepAlive();
        return;
    }

    // Priming, inside the click. Every one of these APIs refuses to start
    // without a gesture and refuses silently — an empty utterance and two muted
    // play() calls are the cheapest way to spend it. The voice element needs
    // priming just as much as the bed: it is created here but first used
    // seconds later, inside an async synthesis, by which time the gesture is
    // long gone and the play() would be blocked.
    if (speechSupported.value) {
        const primer = new SpeechSynthesisUtterance('');
        primer.volume = 0;
        window.speechSynthesis.speak(primer);
    }
    const audio = ensureBed();
    audio.volume = 0;
    audio.play().then(() => audio.pause()).catch(() => undefined);

    const voice = ensureVoiceAudio();
    voice.muted = true;
    voice.play().then(() => { voice.pause(); voice.muted = false; })
        .catch(() => { voice.muted = false; });

    // An AudioContext created outside a gesture starts `suspended` and every
    // buffer played through it is silent — with no error, and with `onended`
    // never arriving, so the bulletin would hang on the male anchor's first
    // line rather than fail. Created and resumed here, inside the click.
    if (webAudioReady.value) void ensureAudioContext()?.resume();

    status.value = 'playing';
    startKeepAlive();
    speakSegment(0);
}

function pause() {
    if (status.value !== 'playing') return;
    status.value = 'paused';
    if (speechSupported.value) window.speechSynthesis.pause();
    if (voiceAudio) voiceAudio.pause();
    void audioContext?.suspend();
    fadeBedTo(0, 220);
    stopKeepAlive();
}

function stop() {
    generation += 1;
    status.value = 'idle';
    cursor.value = -1;
    buffering.value = false;
    stopKeepAlive();
    if (speechSupported.value) window.speechSynthesis.cancel();
    stopShaped();
    // Back to running, so a Stop while paused does not leave the context
    // suspended and the next Play silent.
    void audioContext?.resume();
    if (voiceAudio) {
        voiceAudio.pause();
        voiceAudio.onended = null;
        voiceAudio.onerror = null;
    }
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
    // An Arabic bulletin must not inherit the English voice the reader picked,
    // which is the whole bug this page had. Clear first, then re-cast.
    chosenVoice.female = '';
    chosenVoice.male = '';
    serverVoices.female = '';
    serverVoices.male = '';
    serverUnavailable.value = false;
    error.value = '';
    failures = 0;
    refreshVoices();
    await Promise.all([loadCatalogue(), loadTicker()]);
    await loadBulletin();
});

watch(() => [chosenVoice.female, chosenVoice.male], () => {
    refreshVoices();
    // Take effect on the line being spoken rather than at the next story, so
    // choosing a voice is audibly a choice.
    if (status.value === 'playing' && cursor.value >= 0) speakSegment(cursor.value);
});

watch(speechSource, () => {
    serverSpeechError.value = '';
    serverUnavailable.value = false;
    error.value = '';
    failures = 0;
    if (status.value === 'playing' && cursor.value >= 0) speakSegment(cursor.value);
});

/*
  The running order depends on how many presenters there are, so it has to be
  rebuilt when that changes — switching the voice source, or the capabilities
  answer arriving after the first bulletin has already been built, both flip it.
  Rebuilding while idle only; a change during playback comes through
  `fallBackToSoloPresenter`, which also resumes the story being read.
*/
watch(soloAnchor, () => {
    if (status.value === 'playing') return;
    rebuildScript();
    cursor.value = -1;
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
    // Before the bulletin, not after: the answer decides whether the running
    // order has one presenter or two, and rebuilding it under a listener who
    // has already pressed play is the thing this is meant to avoid.
    await Promise.all([loadLanguages(), loadCapabilities()]);
    await Promise.all([loadCatalogue(), loadTicker()]);
    await loadBulletin();
});

onBeforeUnmount(() => {
    stop();
    if (speechSupported.value) {
        window.speechSynthesis.removeEventListener('voiceschanged', refreshVoices);
    }
    // An object URL pins its blob until revoked, and a bulletin is forty of
    // them — a listener who browsed several categories would leave megabytes
    // behind on every visit.
    newsService.revokeSpeech();
    // Reshaped buffers are keyed on the object URLs that were just revoked, so
    // they can never be reused — and a bulletin's worth of decoded PCM is tens
    // of megabytes, which is far more than the clips themselves.
    shapedBuffers.clear();
    void audioContext?.close();
    audioContext = null;
    // Every node in it belongs to the context that has just closed; holding the
    // chain would keep the whole graph alive behind a context nothing can use.
    voiceChain = null;
    voiceProbe = null;
    bedAudio = null;
    voiceAudio = null;
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
                        <option value="en">{{ $t('English') }}</option>
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

        <!-- Studio ------------------------------------------------------
             One room, rendered, with BOTH presenters on camera for the whole
             bulletin. `anchor` says whose turn it is, `speaking` says whether
             they are actually talking, and `energy` is how loud they are right
             now — which is what opens the mouth, so it closes in the gaps
             between words because there genuinely is no audio in them. See
             NewsStudio.vue for what the ten image files used to be doing and
             why none of it is needed once there is a scene.
        -->
        <NewsStudio
            :anchor="deskAnchor"
            :speaking="speakingAnchor !== null"
            :energy="anchorEnergy"
            :live="status === 'playing'"
            :male="{
                name: anchorNames.male,
                voice: voiceLabel('male'),
                shaped: shapedAnchor === 'male',
            }"
            :female="{
                name: anchorNames.female,
                voice: voiceLabel('female'),
                shaped: shapedAnchor === 'female',
            }"
            :headline="currentItem?.title || currentSegment?.text || ''"
            :kicker="activeCategory
                ? `${categoryLabel(activeCategory)} · ${activeCategory.source_label}` : ''"
            :progress="progress"
            :live-label="t.onAir"
            :ready-label="t.ready"
            :fresh-label="t.fresh"
            :fresh="!!currentItem?.fresh"
            :rtl="rtl"
            :locale="language"
            :shaped-label="t.shapedBadge"
            :article-image="currentItem?.image || ''"
            :screen-source="currentItem?.source_label || activeCategory?.source_label || ''"
        >
            <template #ticker>
                <NewsTicker :headlines="tickerLines" :rtl="rtl" :label="t.breaking">
                    <template #empty>{{ loading ? t.loading : t.empty }}</template>
                </NewsTicker>
            </template>
        </NewsStudio>

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

            <!--
              The voice pickers.

              Rendered only when the selected language actually has voices, and
              they list ONLY that language's voices — offering an English voice
              while Arabic is selected is the bug this page shipped with. With a
              single Arabic voice installed both anchors share it, which the
              caption states rather than hiding.
            -->
            <div class="voices">
                <label class="voices__pick">
                    <span class="voices__label"><Mic :size="14" /> {{ t.source }}</span>
                    <select v-model="speechSource" class="picker__select picker__select--sm">
                        <option value="auto">{{ t.sourceAuto }}</option>
                        <option value="device" :disabled="!availableVoices.length">
                            {{ t.sourceDevice }}
                        </option>
                        <option value="server">{{ t.sourceServer }}</option>
                    </select>
                </label>

                <!--
                  The per-anchor pickers only apply to the device engine — the
                  server picks its own neural pair. Hiding them under the server
                  avoids offering a control that would silently do nothing.
                -->
                <template v-if="!usingServer && availableVoices.length">
                    <label v-for="anchor in (['female', 'male'] as const)" :key="anchor"
                           class="voices__pick">
                        <span class="voices__who">{{ anchorNames[anchor] }}</span>
                        <select v-model="chosenVoice[anchor]" class="picker__select picker__select--sm">
                            <option value="">{{ t.autoVoice }}</option>
                            <option v-for="voice in availableVoices" :key="voice.name" :value="voice.name">
                                {{ voice.name }} ({{ voice.lang }})
                            </option>
                        </select>
                    </label>
                </template>

                <span v-if="buffering" class="voices__busy">
                    <RefreshCw :size="13" class="spinning" /> {{ t.buffering }}
                </span>

                <!--
                  Where the voice IDs live now.

                  They used to be the second line of each anchor's name plate,
                  over the picture — which on a phone put "Microsoft Zira -
                  English (United States)" across the presenter's chin. This is
                  a diagnostic, not a caption: it exists so a reader can check
                  that the male anchor really is on a male voice, and it does
                  that just as well on its own line under the controls, where
                  there is room for it at any width.
                -->
                <span v-if="usingServer" class="voices__now">
                    <span class="voices__label">{{ t.onAirVoices }}</span>
                    <span v-for="anchor in (['female', 'male'] as const)" :key="anchor"
                          class="voices__chip"
                          :class="{ 'voices__chip--shaped': anchor === shapedAnchor }">
                        <strong>{{ anchorNames[anchor] }}</strong> {{ voiceLabel(anchor) }}
                    </span>
                </span>
            </div>
        </section>

        <!-- Errors / empty -------------------------------------------- -->
        <!--
          No voice on the device for this language. This used to be a dead end
          — the page said Arabic could not be read and stopped. It is now just
          a note about which engine is doing the reading, because the server
          fallback speaks every supported language on every device.
        -->
        <!--
          One presenter, because the backend has one voice.

          First, because it is the notice that explains what the reader can
          actually see — a studio with one person in it — and because the two
          below are about the device, which is not what is deciding anything
          here.
        -->
        <div v-if="soloAnchor" class="notice">
            <Radio :size="16" /> {{ t.soloHelp }}
        </div>
        <!--
          The man is still on air, on a reshaped voice. Said out loud rather
          than left to be noticed: a listener who can hear that a voice is
          processed should be told why, and an operator reading this knows
          exactly which replica to fix.
        -->
        <div v-else-if="shapedAnchor" class="notice">
            <Radio :size="16" /> {{ t.shapedHelp }}
        </div>
        <div v-else-if="missingVoice || (!speechSupported && usingServer)" class="notice">
            <Radio :size="16" /> {{ t.noVoiceHelp }}
        </div>
        <!--
          The device has voices for this language, but not one of each gender —
          Edge's two Arabic voices are both female. Rather than reading the
          bulletin with two women, `auto` uses the server pair and says why.
        -->
        <div v-else-if="speechSource === 'auto' && !devicePair && availableVoices.length
                        && usingServer"
             class="notice">
            <Radio :size="16" /> {{ t.noPairHelp }}
        </div>
        <div v-else-if="!speechSupported" class="notice notice--warn">
            <AlertCircle :size="16" /> {{ t.unsupported }}
        </div>
        <div v-if="serverSpeechError" class="notice notice--warn">
            <AlertCircle :size="16" /> {{ serverSpeechError }}
        </div>
        <div v-if="error" class="notice notice--error">
            <AlertCircle :size="16" /> {{ error }}
        </div>
        <div v-else-if="!loading && !categories.length" class="notice">
            <AlertCircle :size="16" /> {{ t.noCategories }}
        </div>

        <!-- Story + rundown -------------------------------------------- -->
        <!--
          Two columns only when there are two things to put in them. Before the
          bulletin starts there is no current story, and a fixed 1.65fr/1fr grid
          left the rundown squeezed into the left two thirds with a third of the
          page empty beside it — which reads as a panel that failed to load.
        -->
        <section class="body" :class="{ 'body--single': !currentItem }">
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

/* -- studio ----------------------------------------------------------
   The stage, the lower third and the on-air bug now live in
   NewsStudio.vue, scoped to it, because they are overlays ON the studio
   image rather than page furniture around it. Nothing here styles them.
-------------------------------------------------------------------- */

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

.voices {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 0.6rem;
    width: 100%;
    padding-top: 0.6rem;
    border-top: 1px solid rgb(var(--sfs-line-rgb, 255 255 255) / 0.12);
}

.voices__label {
    display: inline-flex;
    align-items: center;
    gap: 0.3rem;
    font-size: 0.7rem;
    font-weight: 600;
    letter-spacing: 0.03em;
    color: var(--sfs-text-muted, #a8b0c5);
}

.voices__pick {
    display: inline-flex;
    align-items: center;
    gap: 0.35rem;
    min-width: 0;
}

.voices__who {
    font-size: 0.76rem;
    color: var(--sfs-text, #eef1f8);
}

.voices__busy {
    display: inline-flex;
    align-items: center;
    gap: 0.35rem;
    font-size: 0.76rem;
    color: var(--sfs-accent-text, #cfd6ff);
}

.voices__now {
    display: inline-flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 0.35rem;
    min-width: 0;
}

.voices__chip {
    display: inline-flex;
    align-items: center;
    gap: 0.3rem;
    max-width: 100%;
    padding: 0.2rem 0.45rem;
    border-radius: 0.35rem;
    background: rgb(var(--sfs-tint-rgb, 255 255 255) / 0.08);
    border: 1px solid rgb(var(--sfs-line-rgb, 255 255 255) / 0.14);
    font-size: 0.72rem;
    color: var(--sfs-text-muted, #a8b0c5);
    /* The voice names are long and unbreakable; wrapping them would push the
       transport around every time an anchor changed. */
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}

.voices__chip strong { color: var(--sfs-text, #eef1f8); font-weight: 700; }

.voices__chip--shaped {
    border-color: rgb(var(--sfs-warning-rgb, 232 196 92) / 0.5);
    background: rgb(var(--sfs-warning-rgb, 232 196 92) / 0.12);
    color: var(--sfs-warning-text, #f0d590);
}

.picker__select--sm {
    padding: 0.3rem 0.45rem;
    font-size: 0.78rem;
    max-width: 14rem;
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

.body--single { grid-template-columns: minmax(0, 1fr); }

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
