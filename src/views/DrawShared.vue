<template>
  <div class="shared">
    <div v-if="loading" class="panel">
      <div class="spinner" />
      <h1>Opening the shared paper…</h1>
    </div>

    <div v-else class="panel error">
      <h1>{{ heading }}</h1>
      <p>{{ detail }}</p>
      <div class="actions">
        <button class="btn primary" @click="$router.push({ name: 'DrawPapers' })">
          My papers
        </button>
        <button class="btn ghost" @click="retry">Try again</button>
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

.panel {
  max-width: 46ch;
  padding: 34px 30px;
  border: 1px solid rgb(var(--sfs-shade-rgb, 15 23 42) / 0.08);
  border-radius: 15px;
  background: var(--sfs-paper, #fff);
  text-align: center;
  box-shadow: 0 14px 36px rgba(15, 23, 42, 0.09);
}

h1 { margin: 0 0 10px; font-size: 1.12rem; color: #0f172a; }
p { margin: 0; color: var(--sfs-accent-text, #64748b); font-size: 0.9rem; line-height: 1.6; }

.panel.error h1 { color: var(--sfs-danger-text, #b91c1c); }

.actions { display: flex; justify-content: center; gap: 9px; margin-top: 20px; }

.btn {
  padding: 9px 16px;
  border: none;
  border-radius: 9px;
  font-size: 0.86rem;
  font-weight: 600;
  cursor: pointer;
}
.btn.primary { background: var(--sfs-accent, #2563eb); color: var(--sfs-on-accent, #fff); }
.btn.ghost { background: var(--sfs-accent-soft, #f1f5f9); color: var(--sfs-accent-on-paper, #334155); }

.spinner {
  width: 34px;
  height: 34px;
  margin: 0 auto 16px;
  border: 3px solid rgb(var(--sfs-accent-rgb, 37 99 235) / 0.2);
  border-top-color: var(--sfs-accent, #2563eb);
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin { to { transform: rotate(360deg); } }
</style>
