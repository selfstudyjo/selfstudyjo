<template>
  <div class="fb-page">
    <header class="fb-head">
      <div>
        <h1>Self-Study Football</h1>
        <p>{{ $t('Leagues, champions cups and the World Nations Cup, on keyboards, gamepads or a phone. Offline play needs no account.') }}</p>
      </div>
      <div class="fb-actions">
        <button type="button" class="fb-btn" @click="fullscreen">{{ $t('Full screen') }}</button>
        <router-link class="fb-btn fb-btn--primary" :to="{ path: '/products', query: { tab: 'football' } }">{{ $t('Desktop app: LAN and hotspot games') }}</router-link>
      </div>
    </header>
    <div class="fb-frame">
      <iframe ref="frame" :src="src" title="Self-Study Football" allow="gamepad; fullscreen; autoplay" />
    </div>
    <p class="fb-note">{{ $t('Online play with a friend needs a free SelfStudyJo account: create an invite link in the game and send it.') }}</p>
  </div>
</template>

<script setup lang="ts">
/**
 * Self-Study Football on the website: the game itself is the static build in
 * public/games/football (copied from the desktop repo by its `npm run export:web`),
 * in a SAME-ORIGIN iframe. The only thing this page adds is the online-invite
 * mailbox: the game calls window.parent.sfsFootballBridge.signal(), which reaches
 * app 27's /api/football/* through the pinned AI replica with the signed-in
 * user's id. The game itself never goes through here; it is peer to peer.
 */
import { computed, onBeforeUnmount, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { apiService } from '@/services/api';
import { serviceRegistry } from '@/services/config';
import { useAuthStore } from '@/store/auth';

const route = useRoute();
const router = useRouter();
const auth = useAuthStore();
const frame = ref<HTMLIFrameElement | null>(null);

const src = computed(() => {
  const join = String(route.query.join || '');
  return '/games/football/index.html' + (/^[a-z0-9]+\.[a-z0-9]+$/i.test(join) ? `?join=${join}` : '');
});

const ALLOWED = /^\/rooms\/[a-z0-9/?=&._-]*$/i;
(window as any).sfsFootballBridge = {
  async signal(method: string, path: string, body?: unknown) {
    if (!ALLOWED.test(String(path))) return { error: 'Bad path', status: 400 };
    const userId = String(auth.user?.id || '');
    if (!auth.isAuthenticated || !userId) return { error: 'Sign in to play online.', status: 401, code: 'NO_TOKEN' };
    try {
      const base = await serviceRegistry.getRandomAiReplica();
      if (!base) return { error: 'The online service is unavailable.', status: 503 };
      const headers = { 'X-User-ID': userId };
      return method === 'GET'
        ? await apiService.get(base, '/api/football' + path, headers)
        : await apiService.post(base, '/api/football' + path, body || {}, headers);
    } catch (e: any) {
      return { error: e?.message || 'The request failed.', status: e?.status || 0 };
    }
  },
  async user() {
    return { signedIn: !!(auth.isAuthenticated && auth.user?.id), username: auth.user?.username || '' };
  },
  login() {
    router.push({ path: '/login', query: { redirect: route.fullPath } });
  },
};
onBeforeUnmount(() => { delete (window as any).sfsFootballBridge; });

function fullscreen() {
  const el = frame.value;
  if (el && el.requestFullscreen) el.requestFullscreen().catch(() => {});
}
</script>

<style scoped>
.fb-page { display: grid; gap: 12px; padding: clamp(8px, 2vw, 20px); min-width: 0; }
.fb-head { display: flex; flex-wrap: wrap; gap: 12px; align-items: center; justify-content: space-between; }
.fb-head h1 { margin: 0; font-size: clamp(1.4rem, 3vw, 2rem); }
.fb-head p { margin: 4px 0 0; color: var(--sfs-text-muted, #94a3b8); max-width: 70ch; }
.fb-actions { display: flex; flex-wrap: wrap; gap: 8px; }
.fb-btn { display: inline-flex; align-items: center; min-height: 44px; padding: 0 16px; border-radius: 10px; font-weight: 650; text-decoration: none;
  border: 1px solid rgb(var(--sfs-line-rgb, 255 255 255) / 0.2); background: rgb(var(--sfs-tint-rgb, 255 255 255) / 0.08); color: var(--sfs-text, #e2e8f0); cursor: pointer; }
.fb-btn--primary { background: var(--sfs-accent, #667eea); color: var(--sfs-on-accent, #fff); border-color: transparent; }
.fb-frame { position: relative; width: 100%; height: min(82dvh, 1100px); min-height: 360px; border-radius: 14px; overflow: hidden; background: #07111f; }
.fb-frame iframe { position: absolute; inset: 0; width: 100%; height: 100%; border: 0; }
.fb-note { margin: 0; text-align: center; font-size: 0.9rem; color: var(--sfs-text-muted, #94a3b8); }
</style>
