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

  Below the tabs, SelfStudy LM - the local AI all three apps share - is a section
  of the page and deliberately NOT a fourth tab: it has no installer of its own
  (each app downloads its models on first launch) and app 27 lists exactly three
  products. Its table is `SELFSTUDY_LM` in utils/products.ts, checked against
  the suite's catalogue; every model name, size and path is drawn in a dir="ltr"
  element so Arabic does not reorder it.
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
        <img v-if="!brokenIcon[p.id]" class="prod-tab__icon" :src="iconSrc(p.id)" alt="" width="22" height="22" aria-hidden="true" @error="iconFailed(p.id)">
        <span v-else class="prod-tab__icon prod-icon--letter" aria-hidden="true">{{ p.name.charAt(0) }}</span>
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
          <div class="prod-hero__title">
            <img v-if="!brokenIcon[p.id]" class="prod-hero__icon" :src="iconSrc(p.id)" :alt="p.name" width="56" height="56" @error="iconFailed(p.id)">
            <span v-else class="prod-hero__icon prod-icon--letter" aria-hidden="true">{{ p.name.charAt(0) }}</span>
            <h2>{{ p.name }}</h2>
          </div>
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
            <!-- The app's own English option labels, each isolated left-to-right. -->
            <ul v-if="f.choices" class="prod-choices">
              <li v-for="c in f.choices" :key="c.label">
                <span class="prod-label" dir="ltr">{{ c.label }}</span>
                <span v-if="c.isDefault" class="prod-choices__note">{{ $t('Default') }}</span>
              </li>
            </ul>
          </article>
        </div>
      </div>

      <!-- THE 3D GUIDE: only once the tab has been opened, so its chunk is not fetched for nothing. -->
      <div v-if="p.id === 'interview-helper' && opened.has('interview-helper')" class="prod-section">
        <h3>{{ $t('How to use it') }}</h3>
        <HelperGuide />
      </div>

      <!--
        THE COMMAND LINE. From 2.0.0 the desktop installer carries the selfstudycode
        command, so this is shown for every release and worded "since version 2.0"
        to stay true when an older one is served. One card per installer format, the
        visitor's own first; the commands and paths are never translated.
      -->
      <div v-if="p.id === 'selfstudycode'" class="prod-section">
        <h3>{{ $t('The command line') }}</h3>
        <p class="prod-muted prod-cli__lead">{{ $t('Since version 2.0, the same installer also gives you the selfstudycode command (short name: ssc). How it reaches your terminal depends on the installer:') }}</p>
        <div class="prod-grid prod-cli">
          <article v-for="r in cliRoutes" :key="r" class="prod-card"
                   :class="{ 'prod-card--mine': CLI_ROUTE_INFO[r].os === detected.os }">
            <h4 class="prod-cli__title">
              <span>{{ osName(CLI_ROUTE_INFO[r].os) }}</span>
              <span class="prod-cli__fmt" dir="ltr">{{ CLI_ROUTE_INFO[r].format }}</span>
              <span v-if="CLI_ROUTE_INFO[r].os === detected.os" class="prod-cli__here">{{ $t('Your computer') }}</span>
            </h4>
            <p>{{ cliRouteText[r].lead }}</p>
            <p v-if="CLI_ROUTE_INFO[r].menu" class="prod-cli__menu"><span class="prod-label" dir="ltr">{{ CLI_ROUTE_INFO[r].menu }}</span></p>
            <p v-if="cliRouteText[r].rest">{{ cliRouteText[r].rest }}</p>
            <pre class="prod-cmd" dir="ltr">{{ CLI_ROUTE_INFO[r].lines.join('\n') }}</pre>
          </article>
        </div>
        <p class="prod-muted">{{ $t('Then open a new terminal in your project folder and type selfstudycode, or ssc.') }}</p>
      </div>

      <!-- A release before 2.0.0, with the command line as separate files. -->
      <div v-if="p.id === 'selfstudycode' && pickOf(p.id).cli" class="prod-section">
        <details class="prod-details">
          <summary>{{ $t('How to install the command line tool') }}</summary>
          <pre class="prod-cmd" dir="ltr">{{ cliInstallCommands(detected.os, pickOf(p.id).cli!.name).join('\n') }}</pre>
          <p class="prod-muted">{{ $t('Then open a project folder in a terminal and run selfstudycode.') }}</p>
        </details>
      </div>

      <!-- HOW TO INSTALL: Self-Study for Protection. Commands and file names are never translated. -->
      <div v-if="p.id === 'protection'" class="prod-section">
        <h3>{{ $t('How to install it') }}</h3>
        <div class="prod-grid prod-cli">
          <article v-for="s in protectionSteps" :key="s.os" class="prod-card" :class="{ 'prod-card--mine': s.os === detected.os }">
            <h4 class="prod-cli__title">
              <span>{{ osName(s.os) }}</span>
              <span class="prod-cli__fmt" dir="ltr">{{ s.format }}</span>
              <span v-if="s.os === detected.os" class="prod-cli__here">{{ $t('Your computer') }}</span>
            </h4>
            <ol class="prod-req">
              <li v-for="line in s.steps" :key="line">{{ line }}</li>
            </ol>
            <pre v-if="s.commands.length" class="prod-cmd" dir="ltr">{{ s.commands.join('\n') }}</pre>
          </article>
        </div>
      </div>

      <!-- HOW TO INSTALL: SelfStudy Browser. Commands and file names are never translated. -->
      <div v-if="p.id === 'browser'" class="prod-section">
        <h3>{{ $t('How to install it') }}</h3>
        <div class="prod-grid prod-cli">
          <article v-for="s in browserSteps" :key="s.os" class="prod-card" :class="{ 'prod-card--mine': s.os === detected.os }">
            <h4 class="prod-cli__title">
              <span>{{ osName(s.os) }}</span>
              <span class="prod-cli__fmt" dir="ltr">{{ s.format }}</span>
              <span v-if="s.os === detected.os" class="prod-cli__here">{{ $t('Your computer') }}</span>
            </h4>
            <ol class="prod-req">
              <li v-for="line in s.steps" :key="line">{{ line }}</li>
            </ol>
            <pre v-if="s.commands.length" class="prod-cmd" dir="ltr">{{ s.commands.join('\n') }}</pre>
          </article>
        </div>
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

    <!--
      SELFSTUDY LM: the local AI all three apps share. Part of the page, not a tab,
      and with no download button: each app offers its models on first launch.
      The table keeps its semantics when a narrow container stacks it into cards
      (explicit roles, because a `display` change drops a table's own roles in
      some browsers), and the visible per-cell labels are aria-hidden so a screen
      reader hears each column header once.
    -->
    <section class="prod-lm" aria-labelledby="prod-lm-title">
      <h2 id="prod-lm-title">{{ $t('SelfStudy LM — the local AI of the desktop apps') }}</h2>
      <p class="prod-lead">{{ $t('SelfStudy LM lets SelfStudyCode, Interview Helper and Video Editor work on your own computer, without the internet. It is not a new model trained from scratch: it is a packaged suite of open models, built on Qwen3.5 and Qwen3.6 (Qwen, Alibaba Cloud), Whisper (OpenAI) and FLUX.2 (Black Forest Labs).') }}</p>
      <div class="prod-grid prod-lm__facts">
        <article v-for="f in lmFacts" :key="f.title" class="prod-card">
          <h3 class="prod-lm__fact">{{ f.title }}</h3>
          <p>{{ f.text }}</p>
        </article>
      </div>

      <h3 id="prod-lm-models" class="prod-lm__h">{{ $t('The models') }}</h3>
      <div class="prod-lm__models">
        <table class="prod-lm__table" role="table" aria-labelledby="prod-lm-models">
          <thead role="rowgroup">
            <tr role="row">
              <th scope="col" role="columnheader">{{ $t('Model') }}</th>
              <th scope="col" role="columnheader">{{ $t('Built on') }}</th>
              <th scope="col" role="columnheader">{{ $t('Download size') }}</th>
              <th scope="col" role="columnheader">{{ $t('Memory (RAM)') }}</th>
              <th scope="col" role="columnheader">{{ $t('Licence') }}</th>
            </tr>
          </thead>
          <tbody role="rowgroup">
            <tr v-for="m in lmRows" :key="m.id" role="row">
              <th scope="row" role="rowheader">
                <span class="prod-lm__name" dir="ltr">{{ m.name }}</span>
                <span v-if="m.recommended" class="prod-lm__rec">{{ $t('Recommended') }}</span>
                <span class="prod-lm__use">{{ m.use }}</span>
              </th>
              <td role="cell">
                <span class="prod-lm__label" aria-hidden="true">{{ $t('Built on') }}</span>
                <span class="prod-lm__val">
                  <span class="prod-lm__fig" dir="ltr">{{ m.base }}</span>
                  <span v-if="m.smaller" class="prod-lm__note">{{ $t('With less memory:') }} <span class="prod-lm__fig" dir="ltr">{{ m.smaller }}</span></span>
                </span>
              </td>
              <td role="cell">
                <span class="prod-lm__label" aria-hidden="true">{{ $t('Download size') }}</span>
                <span class="prod-lm__val"><span class="prod-lm__fig" dir="ltr">{{ m.size }}</span></span>
              </td>
              <td role="cell">
                <span class="prod-lm__label" aria-hidden="true">{{ $t('Memory (RAM)') }}</span>
                <span class="prod-lm__val">
                  <span v-if="m.ram" class="prod-lm__fig" dir="ltr">{{ m.ram }}</span>
                  <template v-else>{{ $t('Any computer') }}</template>
                  <span v-if="m.gpuHelps" class="prod-lm__note">{{ $t('A graphics card helps.') }}</span>
                </span>
              </td>
              <td role="cell">
                <span class="prod-lm__label" aria-hidden="true">{{ $t('Licence') }}</span>
                <span class="prod-lm__val"><span class="prod-lm__fig" dir="ltr">{{ m.licence }}</span></span>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
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
  CLI_ROUTE_INFO, PRODUCT_IDS, SELFSTUDY_LM, assetDetail, cliInstallCommands, cliRoutesFor, detectOs,
  formatSize, groupByOs, isProductId, pickAssets, releaseDate, tabFromQuery,
  type CliRoute, type Detected, type DownloadAsset, type ProductId, type ProductInfo,
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

/**
 * A feature card. `choices` are a desktop app's own English option labels,
 * listed as the app shows them (never translated: the student has to find them
 * there) and drawn each in its own left-to-right element rather than quoted
 * inside a translated sentence, where Arabic would wrap and reorder them.
 */
interface Feature { title: string; text: string; choices?: Array<{ label: string; isDefault?: boolean }> }

// Every visible string is a literal t() call so `check:i18n` can see the key.
const catalogue = computed<Array<{
  id: ProductId; name: string; eyebrow: string; lead: string;
  features: Feature[]; requirements: string[]; privacy: string;
}>>(() => [
  {
    id: 'selfstudycode' as ProductId,
    name: 'SelfStudyCode',
    eyebrow: t('One installer: desktop app and command line · Windows, macOS and Linux'),
    lead: t('Your AI coding agent. It writes and fixes code, runs your tests, reviews changes, and makes images, videos and documents - on your own computer. Sign in with your SelfStudyJo account.'),
    features: [
      { title: t('Works in your project'), text: t('It reads your files, edits them, runs commands and tests, and asks before it does anything risky.') },
      { title: t('Desktop app and command line'), text: t('One installer gives you both the desktop app and the selfstudycode command (short name: ssc). They share your sign-in, settings, chats and local models.') },
      { title: t('Explainer videos and documents'), text: t('Give it a folder of exam files and it makes one silent explainer video per file: questions and answers side by side with arrows, code next to its real output, cleaned scans, Arabic labels. It also makes 3D animated scenes with free sound effects.') },
      { title: t('Made for everyday computers'), text: t('It watches memory and the processor and slows itself down when your computer is busy, so it keeps working on an 8 GB laptop without freezing it. Your chats are saved as you go, and a long task always ends with a report of what was done.') },
      { title: t('Apps that start working'), text: t('New desktop, web and mobile apps start from templates that already build and run (Electron, React, Vue, Flask, FastAPI, Express, Expo). It adds your features step by step and launches the app to check it after each one.') },
      { title: t('Works offline too'), text: t('On first launch, in the app or the terminal, it offers to download a SelfStudy LM model sized for your computer, to a folder you choose. Then it works without the internet or an account. Ollama, LM Studio and llama.cpp work too.') },
    ],
    requirements: [
      t('Windows 10 or 11 (64-bit), macOS 12 or newer (Intel or Apple Silicon), or a 64-bit Linux such as Ubuntu 20.04 or newer.'),
      t('4 GB of memory; 8 GB or more for SelfStudy LM, the recommended offline model.'),
      t('About 500 MB of free disk space, plus the offline model you choose.'),
      t('An internet connection to use the SelfStudyJo AI models.'),
    ],
    privacy: '',
  },
  {
    id: 'interview-helper' as ProductId,
    name: t('Interview Helper'),
    eyebrow: t('Desktop app · Windows, macOS and Linux'),
    lead: t('Live help in real English job interviews. It listens to the interviewer on Zoom, Microsoft Teams or Google Meet and shows you a short answer in very simple English, with the question explained in Arabic.'),
    features: [
      { title: t('Hears the interviewer'), text: t('It listens to your computer audio during the call, and to your microphone, and writes down what is said.') },
      { title: t('Fixes what it heard'), text: t('Misheard words and broken grammar in the interviewer’s question are corrected automatically before an answer is written.') },
      { title: t('Very simple English'), text: t('Answers use short sentences and everyday words, written to be read and spoken easily by an Arabic speaker.') },
      { title: t('Answers in seconds'), text: t('Prepare answers to common HR questions before the interview. They appear instantly, then Self Study AI improves them for the exact question.') },
      { title: t('Works offline with SelfStudy LM'), text: t('On first launch, choose a model and a folder and it is downloaded: SelfStudy LM Mini (1.3 GB, for 4 GB of memory) or SelfStudy LM (3.4 GB, for 8 GB), recommended on most laptops. Offline, its instant built-in answer appears first, then the full answer is written on your computer in about 10–20 seconds on a laptop.') },
      {
        title: t('Online, offline or private'),
        text: t('No account is needed offline: the sign-in screen has Continue offline. In Settings › Local AI, choose who writes the answers:'),
        choices: [
          { label: 'Self Study AI online, this computer when offline', isDefault: true },
          { label: 'Always this computer (private, no internet needed)' },
          { label: 'Only Self Study AI online' },
        ],
      },
    ],
    requirements: [
      t('Windows 10 or 11. Computer audio works out of the box.'),
      t('macOS 13 or newer, Intel or Apple Silicon. Allow Screen Recording once so the app can hear the call.'),
      t('Choose the “Monitor of …” device if computer audio is not offered.'),
      t('4 GB of memory and a microphone. An internet connection, or SelfStudy LM on your computer to work offline.'),
    ],
    privacy: t('Your profile, prepared answers and interview notes are saved only in a folder on your own computer. Audio is sent only while you are listening, as short speech segments, and is not stored on our servers. When you continue offline, your audio and answers never leave your computer.'),
  },
  {
    id: 'video-editor' as ProductId,
    name: t('Video Editor'),
    eyebrow: t('Desktop app · Windows, macOS and Linux'),
    lead: t('A full video editor and lecture recorder. Record your screen, camera and voice, get a transcript in any language and AI presentation graphics placed right on what you explain, then edit by describing it in plain words: "remove the parts with no audio longer than 3 seconds and add Arabic captions". The work happens on your computer and one Undo takes it all back.'),
    features: [
      { title: t('Record lectures'), text: t('Record your screen, camera and microphone. Show the camera as a circle or a square, in a corner, at the side or anywhere you drag it, on a choice of themes. Shortcuts start, pause and stop it from any app.') },
      { title: t('A transcript in any language'), text: t('While you speak, your words are transcribed in any language or dialect and saved as a structured transcript, captions and plain text.') },
      { title: t('AI presentation overlays'), text: t('Tick one box and the AI adds arrows, highlights, flowcharts and step lists exactly where your screen shows what you are explaining, at the moment you say it.') },
      { title: t('Highlighter'), text: t('A Highlighter draw tool marks text on the screen: press H, and hold Shift for a straight band.') },
      { title: t('Edit by asking'), text: t('Type or speak what you want. The AI answers with a plan of steps, and you see every step before it is applied.') },
      { title: t('Animate segments'), text: t('Press Animate where a part starts and End animate where it ends: the picture between them becomes an animation of what you are saying - titles, steps, flowcharts, numbers - while your original sound keeps playing.') },
      { title: t('Reader voices'), text: t('A library of voices on your computer, plus your own: record a sample, it is cleaned and matched, then replace the narrator’s voice in any language or dialect, translated and timed to the original.') },
      { title: t('AI Highlights'), text: t('Type “make a 1 minute highlight reel” and it finds the best moments in the transcript. Preview each one, then make a highlight reel or mark the highlights with title cards. One Undo takes it back.') },
      { title: t('Works offline'), text: t('With SelfStudy LM, the plan for an editing command is made on your computer, and Whisper turns voice commands and captions into text on your computer too.') },
      { title: t('A real timeline'), text: t('Several video and audio tracks, split, trim, move, speed, volume, fades, text and markers.') },
      { title: t('One-click clean-ups'), text: t('Improve the sound, fix a dark video, stabilise, denoise, crop for vertical video, and ready-made looks.') },
      { title: t('Captions and export'), text: t('Captions from the speech in your video, burned in or saved as .srt, and export to MP4, MOV, MKV, WebM, GIF or audio only.') },
    ],
    requirements: [
      t('Windows 10 or 11 (64-bit), macOS 12 or newer (Intel or Apple Silicon), or a 64-bit Linux such as Ubuntu 20.04 or newer.'),
      t('8 GB of memory recommended for HD video.'),
      t('Free disk space for your videos and exports.'),
      t('Your videos stay on your computer, and the text on your screen is read on your computer too. Online, only your speech, the text found on the screen and a short summary are sent to the AI; working offline with SelfStudy LM, nothing is sent.'),
    ],
    privacy: '',
  },
  {
    id: 'protection' as ProductId,
    name: 'Self-Study for Protection',
    eyebrow: t('Desktop app · Windows, macOS and Linux'),
    lead: t('Protects your computer. It watches every program, every device on your network, your disks, processor and memory, checks your antivirus, firewall and sign-ins, explains problems in plain words and gives you the button that fixes them.'),
    features: [
      { title: t('Every process, explained'), text: t('Each running program with its owner, start time, live uptime, CPU, memory and digital signature, marked System, User, Suspicious or Dangerous with the reasons. Stop any program that is not part of the operating system, in a table or a 3D view of the process tree.') },
      { title: t('Who is on your network'), text: t('Finds the devices on your Wi-Fi or cable network, with an icon for each type, its maker, address and first and last time seen. Devices that left stay listed as offline. Dangerous signs like ARP spoofing or a device scanning your computer are flagged.') },
      { title: t('What fills your disk'), text: t('The complete Disk Usage Analyzer: what uses the space on each drive and why, the largest files, a 3D map, files that look malicious, and safe cleanup that protects system files.') },
      { title: t('Viruses and break-ins'), text: t('Shows your antivirus and firewall status, runs quick, full, folder and file virus scans, removes threats, shows who is signed in (remote sessions are flagged) and lists programs that start automatically.') },
      { title: t('Charts for everything'), text: t('Live 2D and 3D charts of CPU per core, memory, network traffic and disk space, with how fast each drive is filling.') },
      { title: t('Alerts that do not bother you'), text: t('Problems appear in the app. Only urgent ones - a dangerous program, a virus, someone signed in remotely, a disk about to be full - also show a desktop notification, even when the window is closed.') },
    ],
    requirements: [
      t('Windows 10 or 11 (64-bit), macOS 12 or newer (Intel or Apple Silicon), or a 64-bit Linux such as Ubuntu 20.04 or newer.'),
      t('4 GB of memory and about 400 MB of free disk space.'),
      t('Virus scanning uses Microsoft Defender on Windows; on macOS and Linux install the free ClamAV.'),
    ],
    privacy: t('Nothing about your computer, programs or network leaves your computer: no account, no telemetry. History and alerts are stored only in a folder on your own computer. Only scan networks you own or are allowed to monitor.'),
  },  {
    id: 'browser' as ProductId,
    name: 'SelfStudy Browser',
    eyebrow: t('Desktop app · Windows, macOS and Linux'),
    lead: t('A fast, safe web browser for students. One click puts a tab on a private VPN through the Tor network, and adult and dangerous content is blocked everywhere by AI that runs on your own computer.'),
    features: [
      { title: t('VPN in one click'), text: t('The VPN button sends a tab through the Tor network: sites cannot see your IP address and nothing from that tab is kept after you quit. Normal tabs stay fast. Choose an exit country or a new identity at any time.') },
      { title: t('No adult websites'), text: t('Close to a million adult sites and over a hundred thousand phishing and scam sites are blocked. SafeSearch and YouTube Restricted Mode are always on.') },
      { title: t('AI hides explicit content'), text: t('On YouTube, Facebook, Instagram, X and every other site, explicit pictures, videos and posts are hidden behind a red warning box while you keep scrolling. The AI runs on your computer: nothing you see is uploaded.') },
      { title: t('Learns what you block'), text: t('Right-click a picture, or draw a box around anything, and it stays hidden on that site and everywhere the same picture appears. Signed in, what it learns is synced twice a week with your other computers.') },
      { title: t('Virus-checked downloads'), text: t('Every download is scanned with Microsoft Defender on Windows or ClamAV on macOS and Linux, and an infected file is deleted.') },
      { title: t('Light and up to date'), text: t('One shared AI worker that unloads itself when idle, idle tabs put to sleep, and automatic updates twice a week.') },
    ],
    requirements: [
      t('Windows 10 or 11 (64-bit), macOS 12 or newer (Intel or Apple Silicon), or a 64-bit Linux such as Ubuntu 20.04 or newer.'),
      t('4 GB of memory and about 600 MB of free disk space.'),
      t('An account is optional: it is only used for updates and sync.'),
    ],
    privacy: t('Pages, pictures and videos are checked on your own computer and never uploaded. Signed in, only the sites and areas you or the browser blocked are synced. VPN tabs keep nothing after you quit.'),
  },
]);

// How to install Self-Study for Protection, per OS. The commands use the release's
// real file names (artifactName in its package.json) and are not translated.
const protectionSteps = computed(() => [
  { os: 'windows', format: '.exe / .msi', commands: [] as string[], steps: [
    t('Download the .exe installer (or the .msi) and run it.'),
    t('If Windows says "Windows protected your PC", choose More info, then Run anyway.'),
    t('Choose the install folder and finish. Open the app from the Start menu or the desktop icon.'),
    t('For full detail on system processes, use Relaunch as administrator inside the app.'),
  ] },
  { os: 'macos', format: '.dmg', commands: ['brew install clamav'], steps: [
    t('Open the .dmg file and drag the app into Applications.'),
    t('The first time, right-click the app, choose Open, then Open again.'),
    t('Optional: in System Settings, Privacy & Security, give it Full Disk Access for complete disk scans.'),
    t('Optional: install ClamAV to scan files for viruses:'),
  ] },
  { os: 'linux', format: 'AppImage / .deb', commands: [
    'chmod +x SelfStudy-Protection-*-linux-x86_64.AppImage',
    './SelfStudy-Protection-*-linux-x86_64.AppImage',
    '# or, on Debian / Ubuntu:',
    'sudo apt install ./SelfStudy-Protection-*-linux-amd64.deb',
    'sudo apt install clamav   # optional virus scanning',
  ], steps: [
    t('Download the AppImage (any distribution) or the .deb (Debian, Ubuntu).'),
    t('Make the AppImage executable and run it, or install the .deb:'),
  ] },
]);

// How to install SelfStudy Browser, per OS (artifactName in its package.json; not translated).
const browserSteps = computed(() => [
  { os: 'windows', format: '.exe / .msi', commands: [] as string[], steps: [
    t('Download the .exe installer (or the .msi) and run it.'),
    t('If Windows says "Windows protected your PC", choose More info, then Run anyway.'),
    t('Choose the install folder and finish. Open the app from the Start menu or the desktop icon.'),
  ] },
  { os: 'macos', format: '.dmg', commands: [] as string[], steps: [
    t('Download the .dmg for your Mac: arm64 for Apple Silicon, x64 for Intel.'),
    t('Open the .dmg file and drag the app into Applications.'),
    t('The first time, right-click the app, choose Open, then Open again.'),
  ] },
  { os: 'linux', format: 'AppImage / .deb', commands: [
    'chmod +x SelfStudy-Browser-*-linux-x86_64.AppImage',
    './SelfStudy-Browser-*-linux-x86_64.AppImage',
    '# or, on Debian / Ubuntu:',
    'sudo apt install ./SelfStudy-Browser-*-linux-amd64.deb',
  ], steps: [
    t('Download the AppImage (any distribution) or the .deb (Debian, Ubuntu).'),
    t('Make the AppImage executable and run it, or install the .deb:'),
  ] },
]);

// Each app's own icon (public/products/<id>.png, made from its build/icon.png), the
// same picture its installer and its desktop shortcut show.
// ICON_VERSION is bumped when an icon changes: a browser or the CDN that once cached a
// failed request (the first deploy did this to the Video Editor's) never reuses it, and an
// icon that still fails shows a letter badge instead of a broken-image box.
const ICON_VERSION = '2';
const iconSrc = (id: string) => import.meta.env.BASE_URL + 'products/' + id + '.png?v=' + ICON_VERSION;
const brokenIcon = reactive<Record<string, boolean>>({});
const iconFailed = (id: string) => { brokenIcon[id] = true; };

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

// SelfStudyCode's command line: one card per installer format, the one this
// visitor's download button offers first (utils/products.ts → cliRoutesFor).
const cliRoutes = computed(() => cliRoutesFor(detected.value.os, picks.value.selfstudycode?.gui));
// What each route asks of the student. The app's menu path, the commands and the
// paths are NOT in these sentences: each is drawn in a dir="ltr" element of its
// own, untranslated, between `lead` and `rest`.
const cliRouteText = computed<Record<CliRoute, { lead: string; rest?: string }>>(() => ({
  windows: { lead: t('The installer adds both commands to your PATH, so they work in any new terminal (PowerShell or cmd):') },
  macos: { lead: t('Open the app and choose:'), rest: t('It links both commands into one of these folders:') },
  'linux-appimage': { lead: t('Open the app and choose:'), rest: t('It writes these two files, which start the AppImage:') },
  'linux-deb': { lead: t('The installer adds both commands:') },
}));

// SelfStudy LM, the local AI of all three apps.
const lmFacts = computed(() => [
  { title: t('Downloaded once'), text: t('A model is downloaded once per computer: all three apps use the same models folder, so what one app downloads is there for the others.') },
  { title: t('Private and offline'), text: t('It runs on your own computer and works without the internet.') },
  { title: t('Processor or graphics card'), text: t('It runs on the computer’s processor (CPU), and faster with a graphics card.') },
  { title: t('Chosen in each app'), text: t('On first launch each app offers the model that fits your computer and asks where to keep it. There is no download button for the models on this website.') },
]);
// What each model is for; the names and figures beside it come from SELFSTUDY_LM.
const lmUse = computed<Record<string, string>>(() => ({
  'selfstudy-lm-mini': t('Quick answers on any laptop. Installed beside a bigger SelfStudy LM model, it also makes that one faster.'),
  'selfstudy-lm': t('The everyday model: lessons, code, video edit plans, interview answers, screenshots and scanned pages.'),
  'selfstudy-lm-pro': t('More knowledge and better reasoning: longer code, harder questions and careful writing.'),
  'selfstudy-lm-max': t('The strongest: agentic coding, long projects and data analysis. A mixture of experts, fast for its size.'),
  'selfstudy-speech': t('Speech to text in 99 languages, in the Video Editor: voice commands, captions and transcripts.'),
  'selfstudy-image': t('Pictures from a description, in SelfStudyCode: illustrations, backgrounds and thumbnails.'),
}));
const lmRows = computed(() => SELFSTUDY_LM.map((m) => ({ ...m, use: lmUse.value[m.id] || '' })));

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
.prod-hero__title { display: flex; align-items: center; gap: 0.8rem; margin: 0 0 0.6rem; }
.prod-hero__title h2 { margin: 0; }
.prod-hero__icon { width: 56px; height: 56px; border-radius: 12px; flex: none; }
.prod-icon--letter { display: inline-flex; align-items: center; justify-content: center; font-weight: 700; background: var(--sfs-accent, #667eea); color: var(--sfs-on-accent, #fff); }
.prod-hero__icon.prod-icon--letter { font-size: 1.6rem; }
.prod-tab__icon { width: 22px; height: 22px; border-radius: 5px; flex: none; object-fit: contain; }
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

/* SelfStudyCode's command line: one card per installer format. */
.prod-cli__lead { margin: 0 0 0.9rem; }
.prod-cli__title { display: flex; flex-wrap: wrap; align-items: center; gap: 0.35rem 0.5rem; }
.prod-cli__fmt {
  font-family: var(--sfs-font-mono, ui-monospace, monospace);
  font-size: 0.82rem;
  font-weight: 600;
  color: var(--sfs-text-muted, #cbd5e1);
}
/* A word as well as the accent border: the border alone is a colour-only cue. */
.prod-cli__here,
.prod-choices__note {
  font-size: 0.72rem;
  font-weight: 700;
  padding: 0.1rem 0.5rem;
  border-radius: 999px;
  border: 1px solid var(--sfs-accent, #667eea);
  color: var(--sfs-accent-text, #a5b4fc);
}
.prod-cli .prod-cmd { margin-bottom: 0; }
.prod-card .prod-cli__menu { margin: 0.45rem 0; }

/* A desktop app's own English label - a menu path, an option - as one block,
   so a long one wraps inside itself, left to right, and never between the
   words of an Arabic sentence. */
.prod-label {
  display: inline-block;
  max-width: 100%;
  padding: 0.1rem 0.45rem;
  border-radius: 0.4rem;
  border: 1px solid rgb(var(--sfs-line-rgb, 255 255 255) / 0.16);
  background: rgb(var(--sfs-tint-rgb, 255 255 255) / 0.06);
  color: var(--sfs-text, #f1f5f9);
  font-size: 0.86rem;
  font-weight: 600;
  line-height: 1.45;
}
.prod-choices { list-style: none; margin: 0.6rem 0 0; padding: 0; display: grid; gap: 0.4rem; }
.prod-choices li { display: flex; flex-wrap: wrap; align-items: center; gap: 0.35rem 0.5rem; min-width: 0; }

/* SelfStudy LM: the shared local AI, below the tabs. */
.prod-lm {
  margin-top: 2.5rem;
  padding-top: 2rem;
  border-top: 1px solid rgb(var(--sfs-line-rgb, 255 255 255) / 0.14);
}
.prod-lm h2 { margin: 0 0 0.6rem; font-size: clamp(1.4rem, 3.2vw, 1.9rem); }
.prod-lm__facts { margin-bottom: 1.75rem; }
.prod-lm__fact { margin: 0 0 0.4rem; font-size: 1.02rem; }
.prod-lm__h { font-size: 1.25rem; margin: 0 0 0.9rem; }
/* The container, not the viewport, decides when the table stacks: the page sits
   beside a sidebar on a laptop and alone on a phone. */
.prod-lm__models { position: relative; container: prodlm / inline-size; }
.prod-lm__table {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.92rem;
  line-height: 1.5;
}
.prod-lm__table th,
.prod-lm__table td {
  padding: 0.65rem 0.75rem;
  text-align: start;
  vertical-align: top;
  border-bottom: 1px solid rgb(var(--sfs-line-rgb, 255 255 255) / 0.12);
  overflow-wrap: break-word;
}
/* A model id, a size, a memory figure or a licence is one unit: "Apache-" on one
   line and "2.0" on the next reads as two things, and so does a model name split
   at its hyphen. The stacked layouts below always leave room for the longest. */
.prod-lm__fig { white-space: nowrap; }
.prod-lm__table thead th {
  font-size: 0.8rem;
  font-weight: 700;
  color: var(--sfs-text-muted, #cbd5e1);
  border-bottom-color: rgb(var(--sfs-line-rgb, 255 255 255) / 0.24);
}
.prod-lm__table tbody th { font-weight: 700; }
.prod-lm__rec {
  display: inline-block;
  margin-inline-start: 0.4rem;
  padding: 0.05rem 0.5rem;
  border-radius: 999px;
  font-size: 0.72rem;
  font-weight: 700;
  background: var(--sfs-accent, #667eea);
  color: var(--sfs-on-accent, #ffffff);
}
.prod-lm__use {
  display: block;
  margin-top: 0.2rem;
  font-size: 0.85rem;
  font-weight: 400;
  color: var(--sfs-text-muted, #cbd5e1);
}
.prod-lm__val { display: block; min-width: 0; }
.prod-lm__note { display: block; font-size: 0.8rem; color: var(--sfs-text-muted, #cbd5e1); }
/* The per-cell labels exist for the stacked layout only. */
.prod-lm__label { display: none; }

/* A narrow container: every row becomes a card of label / value pairs. The
   header row is hidden visually and kept for assistive technology. */
@container prodlm (max-width: 46rem) {
  .prod-lm__table thead {
    position: absolute;
    width: 1px;
    height: 1px;
    overflow: hidden;
    clip-path: inset(50%);
    white-space: nowrap;
  }
  .prod-lm__table,
  .prod-lm__table tbody,
  .prod-lm__table tr,
  .prod-lm__table th,
  .prod-lm__table td { display: block; }
  .prod-lm__table tbody tr {
    margin-bottom: 0.75rem;
    padding: 0.8rem 0.95rem;
    border: 1px solid rgb(var(--sfs-line-rgb, 255 255 255) / 0.12);
    border-radius: 0.9rem;
    background: rgb(var(--sfs-tint-rgb, 255 255 255) / 0.06);
  }
  .prod-lm__table tbody th,
  .prod-lm__table tbody td { padding: 0.25rem 0; border: 0; }
  .prod-lm__table tbody th { padding-bottom: 0.5rem; }
  .prod-lm__table tbody td {
    display: grid;
    grid-template-columns: minmax(0, 7.5rem) minmax(0, 1fr);
    gap: 0.75rem;
  }
  .prod-lm__label {
    display: block;
    font-size: 0.8rem;
    font-weight: 700;
    color: var(--sfs-text-muted, #cbd5e1);
  }
}
/* A phone at 320-360 px: the label above its value, so the value has the card's
   whole width and the longest model id still fits on one line. */
@container prodlm (max-width: 22rem) {
  .prod-lm__table tbody td { grid-template-columns: minmax(0, 1fr); gap: 0.1rem; }
}

@media (max-width: 760px) {
  .prod-hero { grid-template-columns: 1fr; }
  .prod-mock { order: -1; }
}
</style>
