<!--
  "Download SelfStudyCode" on the AI Chat Assistant page.

  SelfStudyCode is the platform's AI coding agent for the student's own computer
  (a desktop app and a command-line tool, Windows/macOS/Linux), free with the
  same AI Features subscription this page needs. The visitor's OS is detected and
  the matching installer offered first; every other build stays one click away.

  Decisions live in utils/selfstudyCodeDownloads.ts (npm run check:sscdownloads).
  The link is requested per click: it is a signed GitHub URL valid for minutes.
  Nothing here is rendered with v-html.
-->
<template>
  <div class="sscd">
    <button type="button" class="sscd-toggle" :aria-expanded="open" :title="$t('Download SelfStudyCode')" @click="toggle">
      <span aria-hidden="true">⬇</span> <span class="sscd-label">{{ $t('Download SelfStudyCode') }}</span>
    </button>

    <div v-if="open" class="sscd-panel" role="dialog" :aria-label="$t('Download SelfStudyCode')">
      <div class="sscd-head">
        <strong>{{ $t('SelfStudyCode: your AI coding agent') }}</strong>
        <button type="button" class="sscd-close" :aria-label="$t('Close')" @click="open = false">✕</button>
      </div>
      <p class="sscd-intro">
        {{ $t('Writes and fixes code, runs your tests, reviews changes, and makes images, videos and documents - on your own computer. Free with your AI subscription; sign in with your SelfStudyJo account.') }}
      </p>

      <p v-if="loading" class="sscd-note">{{ $t('Loading…') }}</p>
      <p v-else-if="error" class="sscd-note sscd-error" role="alert">{{ error }}</p>
      <p v-else-if="!info?.available" class="sscd-note">{{ $t('The installers are being built. Please check back in a few minutes.') }}</p>

      <template v-else>
        <p class="sscd-meta">
          {{ $t('Version {v0}', { v0: info.version || '' }) }} ·
          {{ $t('Detected: {v0}', { v0: osLabel }) }}
        </p>

        <div v-if="picked.gui || picked.cli" class="sscd-primary">
          <button v-if="picked.gui" type="button" class="sscd-btn sscd-btn--main" :disabled="busy === picked.gui.id"
                  @click="download(picked.gui)">
            <span class="sscd-btn-title">{{ $t('Desktop app for {v0}', { v0: osLabel }) }}</span>
            <span class="sscd-btn-sub" dir="ltr">{{ assetLabel(picked.gui).detail }} · {{ formatSize(picked.gui.size) }}</span>
          </button>
          <button v-if="picked.cli" type="button" class="sscd-btn" :disabled="busy === picked.cli.id"
                  @click="download(picked.cli)">
            <span class="sscd-btn-title">{{ $t('Command line (CLI) for {v0}', { v0: osLabel }) }}</span>
            <span class="sscd-btn-sub" dir="ltr">{{ assetLabel(picked.cli).detail }} · {{ formatSize(picked.cli.size) }}</span>
          </button>
        </div>

        <ul v-if="alternates.length" class="sscd-list">
          <li v-for="a in alternates" :key="a.id">
            <button type="button" class="sscd-link" :disabled="busy === a.id" @click="download(a)">
              {{ kindName(a) }} · <span dir="ltr">{{ assetLabel(a).detail }}</span>
            </button>
          </li>
        </ul>

        <details v-if="picked.cli" class="sscd-details">
          <summary>{{ $t('How to install the command line tool') }}</summary>
          <pre class="sscd-cmd" dir="ltr">{{ cliInstallCommands(detected.os, picked.cli.name).join('\n') }}</pre>
          <p class="sscd-note">{{ $t('Then open a project folder in a terminal and run selfstudycode.') }}</p>
        </details>

        <details v-if="picked.others.length" class="sscd-details">
          <summary>{{ $t('Other platforms') }}</summary>
          <ul class="sscd-list">
            <li v-for="a in picked.others" :key="a.id">
              <button type="button" class="sscd-link" :disabled="busy === a.id" @click="download(a)">
                {{ $t(assetLabel(a).os) }} · {{ kindName(a) }} · <span dir="ltr">{{ assetLabel(a).detail }}</span>
              </button>
            </li>
          </ul>
        </details>
        <p class="sscd-note">{{ $t('The installers are not code-signed yet: Windows may show "Windows protected your PC" (choose More info, then Run anyway), and macOS may ask you to open it from System Settings, Privacy & Security.') }}</p>
      </template>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import { useAuthStore } from '@/store/auth';
import { useI18n } from '@/i18n/runtime';
import { selfStudyCodeService } from '@/services/selfstudycode.service';
import type { DownloadsInfo } from '@/services/selfstudycode.service';
import { assetLabel, cliInstallCommands, detectOs, formatSize, pickAssets } from '@/utils/selfstudyCodeDownloads';
import type { Detected, DownloadAsset } from '@/utils/selfstudyCodeDownloads';

const auth = useAuthStore();
const { t } = useI18n();
const open = ref(false);
const loading = ref(false);
const error = ref('');
const busy = ref<number | null>(null);
const info = ref<DownloadsInfo | null>(null);

interface UaData { platform?: string; getHighEntropyValues?: (k: string[]) => Promise<{ architecture?: string }> }
const uaData = (navigator as unknown as { userAgentData?: UaData }).userAgentData;
const detected = ref<Detected>(detectOs(navigator.userAgent, uaData?.platform || navigator.platform || ''));

// Literal t() calls, not t(variable): the i18n check finds keys by scanning for them.
function osName(os: string): string {
    if (os === 'windows') return t('Windows');
    if (os === 'macos') return t('macOS');
    if (os === 'linux') return t('Linux');
    return t('your system');
}
function kindName(a: DownloadAsset): string {
    return a.kind === 'gui' ? t('Desktop app') : t('Command line (CLI)');
}
const osLabel = computed(() => osName(detected.value.os));
const picked = computed(() => pickAssets(info.value?.assets || [], detected.value));
const alternates = computed(() => [...picked.value.guiAlternates, ...picked.value.cliAlternates]);

async function toggle() {
    open.value = !open.value;
    if (!open.value || info.value || loading.value) return;
    loading.value = true;
    error.value = '';
    try {
        if (uaData?.getHighEntropyValues) {
            try {
                const h = await uaData.getHighEntropyValues(['architecture']);
                detected.value = detectOs(navigator.userAgent, uaData.platform || '', h.architecture || '');
            } catch { /* keep the user-agent guess */ }
        }
        info.value = await selfStudyCodeService.downloads(auth.user?.id || '');
    } catch {
        error.value = t('Could not load the downloads right now. Please try again.');
    } finally {
        loading.value = false;
    }
}

async function download(asset: DownloadAsset) {
    busy.value = asset.id;
    error.value = '';
    try {
        const url = await selfStudyCodeService.downloadUrl(auth.user?.id || '', asset.id);
        window.location.assign(url);
    } catch {
        error.value = t('Could not start the download. Please try again.');
    } finally {
        busy.value = null;
    }
}
</script>

<style scoped>
.sscd { position: relative; display: inline-block; align-self: center; height: fit-content; --sscd-code-bg: #0f172a; --sscd-code-ink: #e2e8f0; }
.sscd-toggle {
  display: inline-flex; align-items: center; gap: 0.4rem; cursor: pointer;
  padding: 0.5rem 0.9rem; border-radius: 0.6rem; font-weight: 600;
  background: var(--sfs-accent, #667eea); color: var(--sfs-on-accent, #ffffff);
  border: 1px solid transparent; min-height: max(2.5rem, 40px);
}
.sscd-toggle:hover { filter: brightness(1.08); }
@media (max-width: 560px) { .sscd-label { display: none; } .sscd-toggle { padding-inline: 0.8rem; } }
.sscd-panel {
  position: absolute; z-index: 30; inset-block-start: calc(100% + 0.5rem); inset-inline-end: 0;
  width: min(30rem, 92vw); max-height: 75vh; overflow: auto; text-align: start;
  padding: 1rem; border-radius: 0.8rem;
  background: var(--sfs-paper, #ffffff); color: var(--sfs-on-paper, #111827);
  border: 1px solid var(--sfs-paper-border, rgb(17 24 39 / 0.16));
  box-shadow: 0 1rem 2.5rem rgb(0 0 0 / 0.35);
}
.sscd-head { display: flex; justify-content: space-between; align-items: center; gap: 0.5rem; }
.sscd-close { background: none; border: 0; cursor: pointer; font-size: 1rem; color: inherit; padding: 0.25rem 0.5rem; }
.sscd-intro, .sscd-note, .sscd-meta { margin: 0.5rem 0; font-size: 0.875rem; line-height: 1.5; overflow-wrap: anywhere; }
.sscd-meta { opacity: 0.85; }
.sscd-error { color: var(--sfs-danger-on-paper, #b91c1c); }
.sscd-primary { display: grid; gap: 0.5rem; margin: 0.75rem 0; }
.sscd-btn {
  display: grid; gap: 0.15rem; text-align: start; cursor: pointer; padding: 0.65rem 0.9rem; border-radius: 0.6rem;
  background: transparent; color: inherit; border: 1px solid var(--sfs-paper-border, rgb(17 24 39 / 0.16));
}
.sscd-btn--main { background: var(--sfs-accent, #667eea); color: var(--sfs-on-accent, #ffffff); border-color: transparent; }
.sscd-btn:disabled, .sscd-link:disabled { opacity: 0.6; cursor: progress; }
.sscd-btn-title { font-weight: 600; }
.sscd-btn-sub { font-size: 0.8rem; opacity: 0.85; }
.sscd-list { list-style: none; margin: 0.25rem 0; padding: 0; display: grid; gap: 0.2rem; }
.sscd-link { background: none; border: 0; padding: 0.2rem 0; cursor: pointer; color: var(--sfs-accent-on-paper, #3730a3); text-decoration: underline; text-align: start; font-size: 0.875rem; }
.sscd-details { margin: 0.5rem 0; font-size: 0.875rem; }
.sscd-details summary { cursor: pointer; font-weight: 600; }
.sscd-cmd {
  direction: ltr; text-align: left; white-space: pre-wrap; overflow-wrap: anywhere; margin: 0.5rem 0;
  padding: 0.6rem 0.75rem; border-radius: 0.5rem; font-size: 0.78rem;
  background: var(--sscd-code-bg); color: var(--sscd-code-ink);
}
</style>
