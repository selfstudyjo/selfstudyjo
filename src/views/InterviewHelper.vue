<template>
  <div class="ih-page">
    <header class="ih-hero">
      <div class="ih-hero__text">
        <p class="ih-eyebrow">{{ $t('Desktop app · Windows, macOS and Linux') }}</p>
        <h1>{{ $t('Interview Helper') }}</h1>
        <p class="ih-lead">
          {{ $t('Live help in real English job interviews. It listens to the interviewer on Zoom, Microsoft Teams or Google Meet and shows you a short answer in very simple English, with the question explained in Arabic.') }}
        </p>
        <div class="ih-actions">
          <!-- A direct link to the installer for THIS computer: the download starts at once. -->
          <a v-if="primary" class="ih-btn ih-btn--primary" :href="primary.url" download>
            {{ primaryLabel }}
          </a>
          <a v-else class="ih-btn ih-btn--primary" href="#ih-downloads" @click.prevent="scrollToDownloads">
            {{ $t('Download the Interview Helper') }}
          </a>
          <router-link v-if="!hasAi" class="ih-btn" to="/plans">{{ $t('Get AI Features') }}</router-link>
        </div>
        <p v-if="os === 'mac'" class="ih-alt">
          <a :href="altMac.url" download>{{ primaryId === 'mac-x64' ? $t('Apple Silicon Mac (M1 and later)? Download that version') : $t('Intel Mac? Download the Intel version') }}</a>
        </p>
        <p v-else-if="os === 'mobile'" class="ih-alt">{{ $t('The Interview Helper runs on a computer. Open this page on your Windows, Mac or Linux computer to download it.') }}</p>
        <p v-else-if="primary" class="ih-alt">
          <a href="#ih-downloads" @click.prevent="scrollToDownloads">{{ $t('Other systems and versions') }}</a>
        </p>
        <p class="ih-access" :class="{ 'ih-access--ok': hasAi }" role="status">
          <template v-if="hasAi">{{ $t('Your plan includes AI Features. Sign in to the app with your SelfStudyJo account.') }}</template>
          <template v-else-if="signedIn">{{ $t('Your plan does not include AI Features yet.') }}</template>
          <template v-else>{{ $t('You need a SelfStudyJo account with an active subscription that includes AI Features.') }}</template>
        </p>
      </div>
      <figure class="ih-mock" aria-hidden="true">
        <div class="ih-mock__q">{{ $t('Interviewer') }}: “Why do you want to work for our company?”</div>
        <div class="ih-mock__ar" dir="rtl" lang="ar">لماذا تريد العمل في شركتنا؟</div>
        <div class="ih-mock__a">
          <p>I want to grow in a strong team.</p>
          <p>Your company helps many customers.</p>
          <p>My two years in support fit this job well.</p>
        </div>
      </figure>
    </header>

    <section class="ih-section">
      <h2>{{ $t('How it helps you') }}</h2>
      <div class="ih-grid">
        <article v-for="f in features" :key="f.title" class="ih-card">
          <h3>{{ $t(f.title) }}</h3>
          <p>{{ $t(f.text) }}</p>
        </article>
      </div>
    </section>

    <section id="ih-downloads" ref="downloadsEl" class="ih-section">
      <h2>{{ $t('Download for your computer') }}</h2>
      <div class="ih-grid ih-grid--os">
        <article v-for="sys in systems" :key="sys.name" class="ih-card" :class="{ 'ih-card--mine': sys.mine }">
          <h3>{{ sys.name }}</h3>
          <p>{{ sys.note }}</p>
          <ul class="ih-files">
            <li v-for="f in sys.files" :key="f.id">
              <a :href="f.url" download>{{ f.label }}</a>
              <span class="ih-file">{{ f.file }}</span>
            </li>
          </ul>
        </article>
      </div>
      <p class="ih-muted">
        {{ $t('All installers are on the releases page. The first time you open it, Windows may ask you to confirm (More info, then Run anyway) and on macOS right-click the app and choose Open.') }}
        <a :href="RELEASES_PAGE" target="_blank" rel="noopener noreferrer">{{ $t('Open the releases page') }}</a>
      </p>
    </section>

    <section class="ih-section">
      <h2>{{ $t('How to use it') }}</h2>
      <HelperGuide />
    </section>

    <section class="ih-section ih-card">
      <h2>{{ $t('Your privacy') }}</h2>
      <p>{{ $t('Your profile, prepared answers and interview notes are saved only in a folder on your own computer. Audio is sent only while you are listening, as short speech segments, and is not stored on our servers.') }}</p>
    </section>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { useAuthStore } from '@/store/auth';
import { t } from '@/i18n/runtime';
import HelperGuide from '@/components/interviewhelper/HelperGuide.vue';
import {
  RELEASES_PAGE, installer, primaryInstaller, detectOs, macArchitecture,
  type DetectedOs, type InstallerId,
} from '@/utils/interviewHelperDownloads';

// The installers live in a PUBLIC repo under stable names: the source repo is
// private and its releases page is a 404 for every visitor.
const os = ref<DetectedOs>('unknown');
const macArch = ref<string | null>(null);
const primaryId = computed(() => primaryInstaller(os.value, macArch.value));
const primary = computed(() => (primaryId.value ? installer(primaryId.value) : null));
const altMac = computed(() => installer(primaryId.value === 'mac-x64' ? 'mac-arm64' : 'mac-x64'));

const labels = computed<Record<InstallerId, string>>(() => ({
  windows: t('Windows installer (64-bit)'),
  'mac-arm64': t('macOS, Apple Silicon (M1 and later)'),
  'mac-x64': t('macOS, Intel'),
  appimage: t('Linux AppImage (any distribution)'),
  deb: t('Debian / Ubuntu package'),
}));
const primaryLabels = computed<Record<InstallerId, string>>(() => ({
  windows: t('Download for Windows'),
  'mac-arm64': t('Download for Mac (Apple Silicon)'),
  'mac-x64': t('Download for Mac (Intel)'),
  appimage: t('Download for Linux'),
  deb: t('Download for Linux'),
}));
const primaryLabel = computed(() => (primaryId.value ? primaryLabels.value[primaryId.value] : ''));

const downloadsEl = ref<HTMLElement | null>(null);
function scrollToDownloads() {
  downloadsEl.value?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

onMounted(async () => {
  os.value = detectOs(navigator as any);
  if (os.value === 'mac') macArch.value = await macArchitecture(navigator);
});

const auth = useAuthStore();
const signedIn = computed(() => !!auth.isAuthenticated);
const hasAi = computed(() => signedIn.value && !!auth.hasAiAccess);

// Computeds, so a language switch re-renders them and `check:i18n` sees each key.
const features = computed(() => [
  { title: t('Hears the interviewer'), text: t('It listens to your computer audio during the call, and to your microphone, and writes down what is said.') },
  { title: t('Fixes what it heard'), text: t('Misheard words and broken grammar in the interviewer’s question are corrected automatically before an answer is written.') },
  { title: t('Very simple English'), text: t('Answers use short sentences and everyday words, written to be read and spoken easily by an Arabic speaker.') },
  { title: t('Answers in seconds'), text: t('Prepare answers to common HR questions before the interview. They appear instantly, then Self Study AI improves them for the exact question.') },
]);

const files = (ids: InstallerId[]) => ids.map((id) => ({ ...installer(id), label: labels.value[id] }));
const systems = computed(() => [
  { name: 'Windows', mine: os.value === 'windows', files: files(['windows']), note: t('Windows 10 or 11. Computer audio works out of the box.') },
  { name: 'macOS', mine: os.value === 'mac', files: files(['mac-arm64', 'mac-x64']), note: t('macOS 13 or newer, Intel or Apple Silicon. Allow Screen Recording once so the app can hear the call.') },
  { name: 'Linux', mine: os.value === 'linux', files: files(['appimage', 'deb']), note: t('Choose the “Monitor of …” device if computer audio is not offered.') },
]);
</script>

<style scoped>
.ih-page {
  max-width: 72rem;
  margin: 0 auto;
  padding: 1.5rem 1.25rem 3rem;
  color: var(--sfs-text, #f1f5f9);
}
.ih-hero {
  display: grid;
  grid-template-columns: minmax(0, 1.25fr) minmax(0, 1fr);
  gap: 2rem;
  align-items: center;
  margin-bottom: 2.5rem;
}
.ih-eyebrow {
  margin: 0 0 0.25rem;
  font-size: 0.85rem;
  font-weight: 700;
  letter-spacing: 0.04em;
  color: var(--sfs-accent-text, #a5b4fc);
}
.ih-hero h1 { margin: 0 0 0.75rem; font-size: clamp(1.8rem, 4vw, 2.6rem); }
.ih-lead { font-size: 1.1rem; line-height: 1.65; color: var(--sfs-text-muted, #cbd5e1); margin: 0 0 1.25rem; }
.ih-actions { display: flex; flex-wrap: wrap; gap: 0.75rem; }
.ih-btn {
  display: inline-flex;
  align-items: center;
  min-height: max(2.75rem, 44px);
  padding: 0.6rem 1.25rem;
  border-radius: 0.75rem;
  border: 1px solid rgb(var(--sfs-line-rgb, 255 255 255) / 0.2);
  background: rgb(var(--sfs-tint-rgb, 255 255 255) / 0.08);
  color: var(--sfs-text, #f1f5f9);
  font-weight: 700;
  text-decoration: none;
}
.ih-btn--primary {
  background: var(--sfs-accent, #667eea);
  border-color: var(--sfs-accent, #667eea);
  color: var(--sfs-on-accent, #ffffff);
}
.ih-btn:focus-visible { outline: 2px solid var(--sfs-accent, #667eea); outline-offset: 2px; }
.ih-access {
  margin: 1rem 0 0;
  padding: 0.6rem 0.9rem;
  border-radius: 0.6rem;
  background: rgb(var(--sfs-warning-rgb, 251 191 36) / 0.15);
  color: var(--sfs-warning-text, #fde68a);
}
.ih-access--ok {
  background: rgb(var(--sfs-success-rgb, 52 211 153) / 0.15);
  color: var(--sfs-success-text, #a7f3d0);
}
.ih-mock {
  margin: 0;
  padding: 1.25rem;
  border-radius: 1rem;
  background: var(--sfs-paper, #ffffff);
  color: var(--sfs-on-paper, #0f172a);
  box-shadow: 0 1rem 3rem rgb(var(--sfs-shade-rgb, 0 0 0) / 0.3);
  /* A sample of an English answer: it reads left-to-right on every page. */
  direction: ltr;
}
.ih-mock__q { font-weight: 700; margin-bottom: 0.25rem; }
.ih-mock__ar { margin-bottom: 0.75rem; opacity: 0.85; }
.ih-mock__a { font-size: 1.15rem; line-height: 1.5; }
.ih-mock__a p { margin: 0 0 0.3rem; }
.ih-section { margin-bottom: 2.25rem; }
.ih-section h2 { font-size: 1.35rem; margin: 0 0 1rem; }
.ih-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(min(100%, 15rem), 1fr));
  gap: 1rem;
}
.ih-card {
  padding: 1.1rem 1.25rem;
  border-radius: 0.9rem;
  border: 1px solid rgb(var(--sfs-line-rgb, 255 255 255) / 0.12);
  background: rgb(var(--sfs-tint-rgb, 255 255 255) / 0.06);
  min-width: 0;
}
.ih-card h3 { margin: 0 0 0.4rem; font-size: 1.05rem; }
.ih-card p { margin: 0; line-height: 1.6; color: var(--sfs-text-muted, #cbd5e1); overflow-wrap: anywhere; }
.ih-file {
  font-family: ui-monospace, monospace;
  direction: ltr;
  unicode-bidi: isolate;
  margin-bottom: 0.4rem !important;
  color: var(--sfs-text, #f1f5f9) !important;
}
.ih-muted { color: var(--sfs-text-muted, #cbd5e1); line-height: 1.6; margin-top: 1rem; }
.ih-muted a, .ih-alt a, .ih-files a { color: var(--sfs-accent-text, #a5b4fc); }
.ih-alt { margin: 0.6rem 0 0; color: var(--sfs-text-muted, #cbd5e1); }
.ih-card--mine { border-color: var(--sfs-accent, #667eea); }
.ih-files { list-style: none; margin: 0.75rem 0 0; padding: 0; display: grid; gap: 0.55rem; }
.ih-files li { display: grid; gap: 0.1rem; min-width: 0; }
.ih-files a { font-weight: 700; }
.ih-files .ih-file { font-size: 0.8rem; margin: 0 !important; overflow-wrap: anywhere; color: var(--sfs-text-muted, #cbd5e1) !important; }
@media (max-width: 760px) {
  .ih-hero { grid-template-columns: 1fr; }
}
</style>
