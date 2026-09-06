<template>
  <div class="shared">
    <div v-if="loading" class="panel">
      <div class="spinner" />
      <h1>{{ $t('Opening the shared paper…') }}</h1>
    </div>

    <div v-else class="panel error">
      <h1>{{ heading }}</h1>
      <p>{{ detail }}</p>
      <div class="actions">
        <button class="btn primary" @click="$router.push({ name: 'DrawPapers' })">
          {{ $t('My papers') }}
        </button>
        <button class="btn ghost" @click="retry">{{ $t('Try again') }}</button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
/**
 * The landing page for a share link.
 *
 * A link is a token, not a paper id — the person following it does not know which
 * paper they are about to open, and the token has to be resolved before anything can
 * be loaded. So this route exists purely to make that one call and then hand over to
 * `DrawBoard`, which is the same component whether the paper was reached by link or
 * from the dashboard.
 *
 * `replace` rather than `push` on the redirect: pressing Back from the board should
 * go wherever the person came from, not to this resolver, which would immediately
 * resolve again and bounce them forward.
 *
 * The token is remembered in memory by `drawService` so every later call on that
 * paper carries it. It is deliberately **not** persisted — it is a credential for one
 * paper, and keeping it in localStorage would go on granting access long after the
 * tab that was given the link had gone.
 */
import { onMounted, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useAuthStore } from '@/store/auth';
import { ApiError } from '@/services/api';
import { drawService } from '@/services/draw.service';

const route = useRoute();
const router = useRouter();
const authStore = useAuthStore();

const loading = ref(true);
const heading = ref('');
const detail = ref('');

onMounted(resolve);

async function resolve() {
    loading.value = true;
    const token = String(route.params.token || '');
    if (!token) {
        fail('That link is incomplete',
             'The address is missing its share code. Ask whoever sent it for the full link.');
        return;
    }

    try {
        const paper = await drawService.resolveLink(authStore.user?.id || '', token);
        drawService.rememberLinkToken(paper.paper_id, token);
        router.replace({ name: 'DrawBoard', params: { id: paper.paper_id } });
    } catch (err: any) {
        if (err instanceof ApiError && err.status === 404) {
            // 404 covers both "no such link" and "the owner switched it off", and
            // deliberately does not distinguish them: telling somebody a link *used
            // to* work confirms the paper exists.
            fail('This link no longer works',
                 'It may have been turned off or replaced by whoever owns the paper. '
                 + 'Ask them for a new link, or to share the paper with your account '
                 + 'directly.');
        } else {
            fail('Could not open the shared paper',
                 err?.message || 'The drawing service did not answer. Try again in a moment.');
        }
    }
}

function fail(title: string, message: string) {
    heading.value = title;
    detail.value = message;
    loading.value = false;
}

function retry() {
    resolve();
}
</script>

<style scoped>
.shared { display: grid; place-items: center; min-height: 60vh; padding: 40px 20px; }

/*
  A GLASS CARD, not a sheet of paper.

  This is the page a share link lands on, so for a great many visitors it is
  the FIRST thing they see of the platform - and `--sfs-paper` made it a white
  card in all ten galaxies with `--sfs-text` on it, which is white in the seven
  dark ones. Same fault as the paper cards and the board title.
*/
.panel {
  max-width: 46ch;
  padding: clamp(1.5rem, 4vw, 2.1rem) clamp(1.25rem, 3.5vw, 1.9rem);
  border: 1px solid var(--sfs-border, rgb(255 255 255 / 0.14));
  border-radius: var(--sfs-radius-lg, 18px);
  background: var(--sfs-glass-2, rgb(255 255 255 / 0.08));
  -webkit-backdrop-filter: var(--sfs-blur, blur(10px));
  backdrop-filter: var(--sfs-blur, blur(10px));
  text-align: center;
  box-shadow: var(--sfs-sheen, inset 0 1px 0 rgb(255 255 255 / 0.14)),
              var(--sfs-elev-2, 0 14px 36px rgb(0 0 0 / 0.2));
}

@supports not ((backdrop-filter: blur(1px)) or (-webkit-backdrop-filter: blur(1px))) {
  .panel { background: var(--sfs-glass-3, rgb(255 255 255 / 0.12)); }
}

h1 {
  margin: 0 0 0.6rem;
  font-size: 1.12rem;
  font-weight: var(--sfs-weight-semibold, 600);
  color: var(--sfs-text, #f8fafc);
}

p {
  margin: 0;
  color: var(--sfs-text-muted, #94a3b8);
  font-size: 0.9rem;
  line-height: var(--sfs-leading-relaxed, 1.6);
}

.panel.error h1 { color: var(--sfs-danger-text, #b91c1c); }

.actions { display: flex; justify-content: center; gap: 9px; margin-top: 20px; }

.btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 0.55rem 1rem;
  min-height: max(2.4rem, 40px);
  border: 1px solid transparent;
  border-radius: var(--sfs-radius, 14px);
  font-size: 0.86rem;
  font-weight: var(--sfs-weight-semibold, 600);
  cursor: pointer;
}

.btn.primary { background: var(--sfs-accent, #667eea); color: var(--sfs-on-accent, #fff); }

.btn.ghost {
  background: var(--sfs-glass-2, rgb(255 255 255 / 0.08));
  border-color: var(--sfs-border, rgb(255 255 255 / 0.14));
  color: var(--sfs-text, #f8fafc);
}

@media (pointer: coarse) {
  .btn { min-height: 44px; }
}

.spinner {
  width: 34px;
  height: 34px;
  margin: 0 auto 16px;
  border: 3px solid var(--sfs-accent-wash, rgb(102 126 234 / 0.2));
  border-top-color: var(--sfs-accent, #667eea);
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

/* A spinner that keeps spinning under `prefers-reduced-motion` is the one
   animation `responsive.css` cannot switch off for somebody, because at
   `0.01ms` it lands on its last keyframe - a full rotation, i.e. exactly where
   it started - and simply stops. So it is stated here rather than left to the
   global rule: it stops, and the panel's own text says what is happening. */
@media (prefers-reduced-motion: reduce) {
  .spinner { animation: none; opacity: 0.6; }
}

@keyframes spin { to { transform: rotate(360deg); } }
</style>
