<!--
  SelfStudy Products: every SelfStudy desktop application, one tab each, with
  the installers of its LATEST release.

  Gated on ai_feature in the router (every one of these apps needs it), and
  gated again on app 27 for every request: the installers are release assets of
  PRIVATE repos, and app 27 hands out a short-lived signed GitHub link per click
  only to an AI subscriber. Nothing here links to a GitHub release directly -
  that would be a 404 for everybody.

  Tabs are deep-linkable (`?tab=interview-helper`), and the old /interview-helper
  page redirects to that tab. Which installer to offer first, and the tab
  parsing, live in `utils/products.ts` (npm run check:products). Nothing here is
  rendered with v-html. Lazy-loaded (working rule 47).
-->
<template>
  <div class="prod-page">
    <header class="prod-head">
      <h1>{{ $t('SelfStudy Products') }}</h1>
      <p class="prod-lead">{{ $t('Desktop apps for your own computer, included with your AI Features subscription. Download the latest version for Windows, macOS or Linux.') }}</p>
    </header>

    <div class="prod-tabs" role="tablist" :aria-label="$t('SelfStudy Products')" @keydown="onTabKey">
      <button
        v-for="p in catalogue"
        :id="'prod-tab-' + p.id"
        :key="p.id"
        type="button"
        role="tab"
        class="prod-tab"
        :class="{ 'is-active': p.id === tab }"
        :aria-selected="p.id === tab"
        :aria-controls="'prod-panel-' + p.id"
        :tabindex="p.id === tab ? 0 : -1"
        @click="selectTab(p.id)"
      >
        <span class="prod-tab__icon" aria-hidden="true">{{ p.icon }}</span>
        <span>{{ p.name }}</span>
      </button>
    </div>

    <p v-if="loadError" class="prod-banner prod-banner--warn" role="alert">
      {{ loadError }}
      <router-link v-if="loadErrorPlans" to="/plans">{{ $t('See plans') }}</router-link>
      <button v-else type="button" class="prod-linkbtn" @click="load">{{ $t('Try again') }}</button>
    </p>
    <p v-if="downloadError" class="prod-banner prod-banner--warn" role="alert">{{ downloadError }}</p>

    <section
      v-for="p in catalogue"
      v-show="p.id === tab"
      :id="'prod-panel-' + p.id"
      :key="p.id"
      class="prod-panel"
      role="tabpanel"
      :aria-labelledby="'prod-tab-' + p.id"
    >
      <!-- HERO -->
      <div class="prod-hero">
        <div class="prod-hero__text">
          <p class="prod-eyebrow">{{ p.eyebrow }}</p>
          <h2>{{ p.name }}</h2>
          <p class="prod-hero__lead">{{ p.lead }}</p>

          <p v-if="loading" class="prod-muted">{{ $t('Loading…') }}</p>
          <template v-else-if="infoOf(p.id)?.available">
            <p class="prod-version">
              {{ $t('Version {v0}', { v0: infoOf(p.id)?.version || '' }) }}
              <template v-if="dateOf(p.id)"> · <span dir="ltr">{{ dateOf(p.id) }}</span></template>
              · {{ $t('Detected: {v0}', { v0: osName(detected.os) }) }}
            </p>
            <div class="prod-actions">
              <button v-if="pickOf(p.id).gui" type="button" class="prod-btn prod-btn--primary"
                      :disabled="busy === pickOf(p.id).gui!.id" @click="download(p.id, pickOf(p.id).gui!)">
                <span class="prod-btn__title">{{ $t('Download for {v0}', { v0: osName(detected.os) }) }}</span>
                <span class="prod-btn__sub" dir="ltr">{{ assetDetail(pickOf(p.id).gui!) }} · {{ formatSize(pickOf(p.id).gui!.size) }}</span>
              </button>
              <button v-if="pickOf(p.id).cli" type="button" class="prod-btn"
                      :disabled="busy === pickOf(p.id).cli!.id" @click="download(p.id, pickOf(p.id).cli!)">
                <span class="prod-btn__title">{{ $t('Command line (CLI) for {v0}', { v0: osName(detected.os) }) }}</span>
                <span class="prod-btn__sub" dir="ltr">{{ assetDetail(pickOf(p.id).cli!) }} · {{ formatSize(pickOf(p.id).cli!.size) }}</span>
              </button>
            </div>
            <p v-if="detected.mobile" class="prod-muted">{{ $t('These apps run on a computer. Open this page on your Windows, Mac or Linux computer to download them.') }}</p>
            <p v-else-if="!pickOf(p.id).gui && !pickOf(p.id).cli" class="prod-muted">{{ $t('There is no build for this computer yet. Every available build is listed below.') }}</p>
            <ul v-if="pickOf(p.id).guiAlternates.length || pickOf(p.id).cliAlternates.length" class="prod-alts">
              <li v-for="a in [...pickOf(p.id).guiAlternates, ...pickOf(p.id).cliAlternates]" :key="a.id">
                <button type="button" class="prod-linkbtn" :disabled="busy === a.id" @click="download(p.id, a)">
                  {{ kindName(a) }} · <span dir="ltr">{{ assetDetail(a) }}</span>
                </button>
              </li>
            </ul>
          </template>
          <p v-else-if="!loadError" class="prod-muted">{{ $t('The installers are being built. Please check back in a few minutes.') }}</p>
        </div>

        <!-- An illustration of the app, drawn in CSS: no screenshot to go stale. -->
        <figure v-if="p.id === 'interview-helper'" class="prod-mock prod-mock--ih" aria-hidden="true">
          <div class="prod-mock__q">Interviewer: “Why do you want to work for our company?”</div>
          <div class="prod-mock__ar" dir="rtl" lang="ar">لماذا تريد العمل في شركتنا؟</div>
          <div class="prod-mock__a">
            <p>I want to grow in a strong team.</p>
            <p>Your company helps many customers.</p>
            <p>My two years in support fit this job well.</p>
          </div>
        </figure>
        <figure v-else-if="p.id === 'selfstudycode'" class="prod-mock prod-mock--term" aria-hidden="true">
          <div class="prod-term__bar"><span></span><span></span><span></span></div>
          <pre class="prod-term" dir="ltr">$ selfstudycode
› fix the failing test in src/cart.js
  ✓ read src/cart.js, test/cart.test.js
  ✓ edit src/cart.js  (+3 −1)
  ✓ run npm test      14 passed
Done. The total now rounds to 2 decimals.</pre>
        </figure>
        <figure v-else class="prod-mock prod-mock--ve" aria-hidden="true">
          <div class="prod-ve__screen"><span>▶</span></div>
          <div class="prod-ve__ask" dir="ltr">“remove silences longer than 3 s and improve the audio”</div>
          <div class="prod-ve__track prod-ve__track--v"><i></i><i></i><i></i></div>
          <div class="prod-ve__track prod-ve__track--a"><i></i><i></i><i></i></div>
        </figure>
      </div>

      <!-- FEATURES -->
      <div class="prod-section">
        <h3>{{ $t('What it does') }}</h3>
        <div class="prod-grid">
          <article v-for="f in p.features" :key="f.title" class="prod-card">
            <h4>{{ f.title }}</h4>
            <p>{{ f.text }}</p>
          </article>
        </div>
      </div>

      <!-- THE 3D GUIDE: only once the tab has been opened, so its chunk is not fetched for nothing. -->
      <div v-if="p.id === 'interview-helper' && opened.has('interview-helper')" class="prod-section">
        <h3>{{ $t('How to use it') }}</h3>
        <HelperGuide />
      </div>

      <div v-if="p.id === 'selfstudycode' && pickOf(p.id).cli" class="prod-section">
        <details class="prod-details">
          <summary>{{ $t('How to install the command line tool') }}</summary>
          <pre class="prod-cmd" dir="ltr">{{ cliInstallCommands(detected.os, pickOf(p.id).cli!.name).join('\n') }}</pre>
          <p class="prod-muted">{{ $t('Then open a project folder in a terminal and run selfstudycode.') }}</p>
        </details>
      </div>

      <!-- REQUIREMENTS -->
      <div class="prod-section">
        <h3>{{ $t('System requirements') }}</h3>
        <ul class="prod-req">
          <li v-for="r in p.requirements" :key="r">{{ r }}</li>
        </ul>
      </div>

      <!-- EVERY BUILD -->
      <div v-if="infoOf(p.id)?.available" class="prod-section">
        <h3>{{ $t('All downloads') }}</h3>
        <div class="prod-grid prod-grid--os">
          <article v-for="g in groupByOs(infoOf(p.id)?.assets || [])" :key="g.os" class="prod-card"
                   :class="{ 'prod-card--mine': g.os === detected.os }">
            <h4>{{ osName(g.os) }}</h4>
            <ul class="prod-files">
              <li v-for="a in g.assets" :key="a.id">
                <button type="button" class="prod-linkbtn" :disabled="busy === a.id" @click="download(p.id, a)">
                  {{ kindName(a) }} · <span dir="ltr">{{ assetDetail(a) }}</span>
                </button>
                <span class="prod-file" dir="ltr">{{ a.name }} · {{ formatSize(a.size) }}</span>
              </li>
            </ul>
          </article>
        </div>
      </div>

      <p class="prod-muted prod-note">{{ $t('The installers are not code-signed yet: Windows may show "Windows protected your PC" (choose More info, then Run anyway), and macOS may ask you to open it from System Settings, Privacy & Security.') }}</p>
      <p v-if="p.privacy" class="prod-card prod-privacy">{{ p.privacy }}</p>
    </section>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useAuthStore } from '@/store/auth';
import { useI18n } from '@/i18n/runtime';
import { ApiError } from '@/services/api';
import { productsService } from '@/services/products.service';
import HelperGuide from '@/components/interviewhelper/HelperGuide.vue';
import {
  PRODUCT_IDS, assetDetail, cliInstallCommands, detectOs, formatSize, groupByOs, isProductId,
  pickAssets, releaseDate, tabFromQuery,
  type Detected, type DownloadAsset, type ProductId, type ProductInfo,
} from '@/utils/products';

const { t } = useI18n();
const route = useRoute();
const router = useRouter();
const auth = useAuthStore();

const tab = ref<ProductId>(tabFromQuery(route.query.tab));
const opened = reactive(new Set<ProductId>([tab.value]));
const infos = ref<Record<string, ProductInfo>>({});
const loading = ref(true);
const loadError = ref('');
const loadErrorPlans = ref(false);
const downloadError = ref('');
const busy = ref<number | null>(null);

interface UaData { platform?: string; mobile?: boolean; getHighEntropyValues?: (k: string[]) => Promise<{ architecture?: string }> }
const uaData = (navigator as unknown as { userAgentData?: UaData }).userAgentData;
const detected = ref<Detected>(detectOs(navigator.userAgent, uaData?.platform || navigator.platform || '', '',
                                         navigator.maxTouchPoints || 0));

// Every visible string is a literal t() call so `check:i18n` can see the key.
const catalogue = computed(() => [
  {
    id: 'selfstudycode' as ProductId,
    icon: '⌨️',
    name: 'SelfStudyCode',
    eyebrow: t('Desktop app and command line · Windows, macOS and Linux'),
    lead: t('Your AI coding agent. It writes and fixes code, runs your tests, reviews changes, and makes images, videos and documents - on your own computer. Sign in with your SelfStudyJo account.'),
    features: [
      { title: t('Works in your project'), text: t('It reads your files, edits them, runs commands and tests, and asks before it does anything risky.') },
      { title: t('Desktop app or terminal'), text: t('Use the desktop app, or the selfstudycode command in any terminal on Windows, macOS or Linux.') },
      { title: t('Explainer videos and documents'), text: t('It can turn a topic, a scanned page or a PDF into a narrated-style explainer video, diagrams and clean documents.') },
      { title: t('Works offline too'), text: t('No internet? It also works offline with a model running on your computer (Ollama, LM Studio or llama.cpp): run selfstudycode --offline.') },
    ],
    requirements: [
      t('Windows 10 or 11 (64-bit), macOS 12 or newer (Intel or Apple Silicon), or a 64-bit Linux such as Ubuntu 20.04 or newer.'),
      t('4 GB of memory; 8 GB or more to run a local model offline.'),
      t('About 500 MB of free disk space.'),
      t('An internet connection to use the SelfStudyJo AI models.'),
    ],
    privacy: '',
  },
  {
    id: 'interview-helper' as ProductId,
    icon: '🎧',
    name: t('Interview Helper'),
    eyebrow: t('Desktop app · Windows, macOS and Linux'),
    lead: t('Live help in real English job interviews. It listens to the interviewer on Zoom, Microsoft Teams or Google Meet and shows you a short answer in very simple English, with the question explained in Arabic.'),
    features: [
      { title: t('Hears the interviewer'), text: t('It listens to your computer audio during the call, and to your microphone, and writes down what is said.') },
      { title: t('Fixes what it heard'), text: t('Misheard words and broken grammar in the interviewer’s question are corrected automatically before an answer is written.') },
      { title: t('Very simple English'), text: t('Answers use short sentences and everyday words, written to be read and spoken easily by an Arabic speaker.') },
      { title: t('Answers in seconds'), text: t('Prepare answers to common HR questions before the interview. They appear instantly, then Self Study AI improves them for the exact question.') },
    ],
    requirements: [
      t('Windows 10 or 11. Computer audio works out of the box.'),
      t('macOS 13 or newer, Intel or Apple Silicon. Allow Screen Recording once so the app can hear the call.'),
      t('Choose the “Monitor of …” device if computer audio is not offered.'),
      t('4 GB of memory, a microphone, and an internet connection.'),
    ],
    privacy: t('Your profile, prepared answers and interview notes are saved only in a folder on your own computer. Audio is sent only while you are listening, as short speech segments, and is not stored on our servers.'),
  },
  {
    id: 'video-editor' as ProductId,
    icon: '🎬',
    name: t('Video Editor'),
    eyebrow: t('Desktop app · Windows, macOS and Linux'),
    lead: t('A full video editor whose edits you can also describe in plain words, or say out loud: "remove the parts with no audio longer than 3 seconds, improve the sound and add Arabic captions". The app does the work on your computer and one Undo takes it all back.'),
    features: [
      { title: t('A real timeline'), text: t('Several video and audio tracks, split, trim, move, speed, volume, fades, text and markers.') },
      { title: t('Edit by asking'), text: t('Type or speak what you want. The AI answers with a plan of steps, and you see every step before it is applied.') },
      { title: t('One-click clean-ups'), text: t('Improve the sound, fix a dark video, stabilise, denoise, crop for vertical video, and ready-made looks.') },
      { title: t('Captions and export'), text: t('Captions from the speech in your video, burned in or saved as .srt, and export to MP4, MOV, MKV, WebM, GIF or audio only.') },
    ],
    requirements: [
      t('Windows 10 or 11 (64-bit), macOS 12 or newer (Intel or Apple Silicon), or a 64-bit Linux such as Ubuntu 20.04 or newer.'),
      t('8 GB of memory recommended for HD video.'),
      t('Free disk space for your videos and exports.'),
      t('Your videos stay on your computer: only the spoken command and a short summary of the video are sent to the AI.'),
    ],
    privacy: '',
  },
]);

function osName(os: string): string {
  if (os === 'windows') return t('Windows');
  if (os === 'macos') return t('macOS');
  if (os === 'linux') return t('Linux');
  return t('your system');
}
function kindName(a: DownloadAsset): string {
  return a.kind === 'gui' ? t('Desktop app') : t('Command line (CLI)');
}

const infoOf = (id: string) => infos.value[id];
const dateOf = (id: string) => releaseDate(infos.value[id]?.published);
const picks = computed(() => {
  const out: Record<string, ReturnType<typeof pickAssets>> = {};
  for (const id of PRODUCT_IDS) out[id] = pickAssets(infos.value[id]?.assets || [], detected.value);
  return out;
});
const pickOf = (id: string) => picks.value[id];

function selectTab(id: ProductId) {
  tab.value = id;
  opened.add(id);
  downloadError.value = '';
  // replace, not push: flicking between tabs on one page is not navigation.
  if (route.query.tab !== id) router.replace({ query: { ...route.query, tab: id } });
}

function onTabKey(e: KeyboardEvent) {
  if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(e.key)) return;
  e.preventDefault();
  const rtl = document.documentElement.getAttribute('dir') === 'rtl';
  const i = PRODUCT_IDS.indexOf(tab.value);
  let next = i;
  if (e.key === 'Home') next = 0;
  else if (e.key === 'End') next = PRODUCT_IDS.length - 1;
  else {
    const forward = (e.key === 'ArrowRight') !== rtl;
    next = (i + (forward ? 1 : -1) + PRODUCT_IDS.length) % PRODUCT_IDS.length;
  }
  selectTab(PRODUCT_IDS[next]);
  document.getElementById('prod-tab-' + PRODUCT_IDS[next])?.focus();
}

watch(() => route.query.tab, (v) => {
  const next = tabFromQuery(v);
  if (next !== tab.value) { tab.value = next; opened.add(next); }
});

async function load() {
  loading.value = true;
  loadError.value = '';
  loadErrorPlans.value = false;
  try {
    const list = await productsService.list(auth.user?.id || '');
    const map: Record<string, ProductInfo> = {};
    for (const p of list) if (isProductId(p.id)) map[p.id] = p;
    infos.value = map;
  } catch (e) {
    const status = e instanceof ApiError ? (e.status || 0) : 0;
    if (status === 403 || status === 401) {
      loadError.value = t('Your plan does not include AI Features yet.');
      loadErrorPlans.value = true;
    } else if (status === 502) {
      loadError.value = t('Could not check your subscription right now. Please try again.');
    } else {
      loadError.value = t('Could not load the downloads right now. Please try again.');
    }
  } finally {
    loading.value = false;
  }
}

async function download(productId: ProductId, asset: DownloadAsset) {
  busy.value = asset.id;
  downloadError.value = '';
  try {
    const url = await productsService.downloadUrl(auth.user?.id || '', productId, asset.id);
    window.location.assign(url);
  } catch {
    downloadError.value = t('Could not start the download. Please try again.');
  } finally {
    busy.value = null;
  }
}

onMounted(async () => {
  if (uaData?.getHighEntropyValues) {
    try {
      const h = await uaData.getHighEntropyValues(['architecture']);
      detected.value = detectOs(navigator.userAgent, uaData.platform || '', h.architecture || '',
                                navigator.maxTouchPoints || 0);
    } catch { /* keep the user-agent guess */ }
  }
  await load();
});
</script>

<style scoped>
.prod-page {
  max-width: 72rem;
  margin: 0 auto;
  padding: 1.5rem 1.25rem 3rem;
  color: var(--sfs-text, #f1f5f9);
  --prod-term-bg: #0f172a;
  --prod-term-ink: #e2e8f0;
}
.prod-head h1 { margin: 0 0 0.5rem; font-size: clamp(1.7rem, 4vw, 2.4rem); }
.prod-lead { margin: 0 0 1.25rem; color: var(--sfs-text-muted, #cbd5e1); line-height: 1.6; max-width: 48rem; }

.prod-tabs {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  margin-bottom: 1.5rem;
  border-bottom: 1px solid rgb(var(--sfs-line-rgb, 255 255 255) / 0.14);
  padding-bottom: 0.5rem;
}
.prod-tab {
  display: inline-flex;
  align-items: center;
  gap: 0.45rem;
  min-height: max(2.75rem, 44px);
  padding: 0.5rem 1rem;
  border-radius: 0.7rem;
  border: 1px solid rgb(var(--sfs-line-rgb, 255 255 255) / 0.16);
  background: rgb(var(--sfs-tint-rgb, 255 255 255) / 0.06);
  color: var(--sfs-text, #f1f5f9);
  font-weight: 600;
  cursor: pointer;
}
.prod-tab.is-active {
  background: var(--sfs-accent, #667eea);
  border-color: var(--sfs-accent, #667eea);
  color: var(--sfs-on-accent, #ffffff);
}
.prod-tab:focus-visible, .prod-btn:focus-visible, .prod-linkbtn:focus-visible {
  outline: 2px solid var(--sfs-accent, #667eea);
  outline-offset: 2px;
}

.prod-banner {
  margin: 0 0 1rem;
  padding: 0.65rem 0.9rem;
  border-radius: 0.6rem;
  display: flex;
  flex-wrap: wrap;
  gap: 0.75rem;
  align-items: center;
}
.prod-banner--warn {
  background: rgb(var(--sfs-warning-rgb, 251 191 36) / 0.15);
  color: var(--sfs-warning-text, #fde68a);
}
.prod-banner a { color: inherit; font-weight: 700; }

.prod-hero {
  display: grid;
  grid-template-columns: minmax(0, 1.25fr) minmax(0, 1fr);
  gap: 2rem;
  align-items: center;
  margin-bottom: 2rem;
}
.prod-eyebrow {
  margin: 0 0 0.25rem;
  font-size: 0.85rem;
  font-weight: 700;
  letter-spacing: 0.04em;
  color: var(--sfs-accent-text, #a5b4fc);
}
.prod-hero h2 { margin: 0 0 0.6rem; font-size: clamp(1.5rem, 3.5vw, 2.1rem); }
.prod-hero__lead { font-size: 1.05rem; line-height: 1.65; color: var(--sfs-text-muted, #cbd5e1); margin: 0 0 1rem; }
.prod-version { margin: 0 0 0.75rem; font-size: 0.9rem; color: var(--sfs-text-muted, #cbd5e1); }
.prod-actions { display: flex; flex-wrap: wrap; gap: 0.75rem; }
.prod-btn {
  display: grid;
  gap: 0.15rem;
  text-align: start;
  min-height: max(2.75rem, 44px);
  padding: 0.6rem 1.1rem;
  border-radius: 0.75rem;
  border: 1px solid rgb(var(--sfs-line-rgb, 255 255 255) / 0.2);
  background: rgb(var(--sfs-tint-rgb, 255 255 255) / 0.08);
  color: var(--sfs-text, #f1f5f9);
  cursor: pointer;
}
.prod-btn--primary {
  background: var(--sfs-accent, #667eea);
  border-color: var(--sfs-accent, #667eea);
  color: var(--sfs-on-accent, #ffffff);
}
.prod-btn:disabled, .prod-linkbtn:disabled { opacity: 0.6; cursor: progress; }
.prod-btn__title { font-weight: 700; }
.prod-btn__sub { font-size: 0.8rem; opacity: 0.9; }
.prod-linkbtn {
  background: none;
  border: 0;
  padding: 0.15rem 0;
  cursor: pointer;
  color: var(--sfs-accent-text, #a5b4fc);
  text-decoration: underline;
  text-align: start;
  font: inherit;
}
.prod-alts { list-style: none; margin: 0.6rem 0 0; padding: 0; display: grid; gap: 0.25rem; }
.prod-muted { color: var(--sfs-text-muted, #cbd5e1); line-height: 1.6; margin: 0.5rem 0 0; }
.prod-note { margin-top: 1.5rem; }

.prod-mock {
  margin: 0;
  padding: 1.25rem;
  border-radius: 1rem;
  box-shadow: 0 1rem 3rem rgb(var(--sfs-shade-rgb, 0 0 0) / 0.3);
  /* A sample of the app's own (English) screen: left-to-right on every page. */
  direction: ltr;
  text-align: left;
  min-width: 0;
}
.prod-mock--ih { background: var(--sfs-paper, #ffffff); color: var(--sfs-on-paper, #0f172a); }
.prod-mock__q { font-weight: 700; margin-bottom: 0.25rem; }
.prod-mock__ar { margin-bottom: 0.75rem; opacity: 0.85; direction: rtl; text-align: right; }
.prod-mock__a { font-size: 1.1rem; line-height: 1.5; }
.prod-mock__a p { margin: 0 0 0.3rem; }
.prod-mock--term { background: var(--prod-term-bg); color: var(--prod-term-ink); padding: 0; overflow: hidden; }
.prod-term__bar { display: flex; gap: 0.35rem; padding: 0.6rem 0.8rem; background: rgb(var(--sfs-tint-rgb, 255 255 255) / 0.08); }
.prod-term__bar span { width: 0.65rem; height: 0.65rem; border-radius: 50%; background: rgb(var(--sfs-tint-rgb, 255 255 255) / 0.35); }
.prod-term { margin: 0; padding: 0.9rem 1rem 1.1rem; font-size: 0.85rem; line-height: 1.55; white-space: pre-wrap; overflow-wrap: anywhere; }
.prod-mock--ve { background: var(--prod-term-bg); color: var(--prod-term-ink); display: grid; gap: 0.6rem; }
.prod-ve__screen {
  aspect-ratio: 16 / 9;
  border-radius: 0.5rem;
  display: grid;
  place-items: center;
  background: rgb(var(--sfs-tint-rgb, 255 255 255) / 0.1);
  font-size: 2rem;
}
.prod-ve__ask { font-size: 0.85rem; font-style: italic; opacity: 0.9; }
.prod-ve__track { display: flex; gap: 0.3rem; height: 1.2rem; }
.prod-ve__track i { flex: 1; border-radius: 0.25rem; background: var(--sfs-accent, #667eea); opacity: 0.85; }
.prod-ve__track--a i { background: var(--sfs-success, #34d399); }
.prod-ve__track i:nth-child(2) { flex: 0.5; }

.prod-section { margin-bottom: 2rem; }
.prod-section h3 { font-size: 1.25rem; margin: 0 0 0.9rem; }
.prod-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(min(100%, 15rem), 1fr));
  gap: 1rem;
}
.prod-card {
  padding: 1.05rem 1.2rem;
  border-radius: 0.9rem;
  border: 1px solid rgb(var(--sfs-line-rgb, 255 255 255) / 0.12);
  background: rgb(var(--sfs-tint-rgb, 255 255 255) / 0.06);
  min-width: 0;
}
.prod-card h4 { margin: 0 0 0.4rem; font-size: 1.02rem; }
.prod-card p { margin: 0; line-height: 1.6; color: var(--sfs-text-muted, #cbd5e1); overflow-wrap: anywhere; }
.prod-card--mine { border-color: var(--sfs-accent, #667eea); }
.prod-privacy { line-height: 1.6; color: var(--sfs-text-muted, #cbd5e1); }
.prod-req { margin: 0; padding-inline-start: 1.25rem; display: grid; gap: 0.4rem; line-height: 1.55; color: var(--sfs-text-muted, #cbd5e1); }
.prod-files { list-style: none; margin: 0.5rem 0 0; padding: 0; display: grid; gap: 0.55rem; }
.prod-files li { display: grid; gap: 0.1rem; min-width: 0; }
.prod-file {
  font-family: ui-monospace, monospace;
  font-size: 0.78rem;
  unicode-bidi: isolate;
  overflow-wrap: anywhere;
  color: var(--sfs-text-muted, #cbd5e1);
}
.prod-details summary { cursor: pointer; font-weight: 700; }
.prod-cmd {
  direction: ltr;
  text-align: left;
  white-space: pre-wrap;
  overflow-wrap: anywhere;
  margin: 0.6rem 0;
  padding: 0.7rem 0.85rem;
  border-radius: 0.5rem;
  font-size: 0.8rem;
  background: var(--prod-term-bg);
  color: var(--prod-term-ink);
}
@media (max-width: 760px) {
  .prod-hero { grid-template-columns: 1fr; }
  .prod-mock { order: -1; }
}
</style>
