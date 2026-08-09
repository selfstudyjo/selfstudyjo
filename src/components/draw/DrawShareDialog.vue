<template>
  <div class="overlay" @click.self="$emit('close')">
    <div class="dialog" role="dialog" aria-label="Share this paper">
      <header>
        <div>
          <h2>Share “{{ paper.title }}”</h2>
          <p class="sub">Only people you add can open this paper.</p>
        </div>
        <button class="close" aria-label="Close" @click="$emit('close')">×</button>
      </header>

      <!-- Add someone -->
      <section class="block">
        <label class="label" for="draw-share-search">Add a person</label>
        <div class="search-row">
          <input
            id="draw-share-search"
            v-model="query"
            class="input"
            type="text"
            placeholder="Search by username, name or email"
            autocomplete="off"
            @input="onSearch"
          >
          <select v-model="permission" class="select" aria-label="Permission">
            <option value="read">Can view</option>
            <option value="write">Can edit</option>
          </select>
        </div>

        <p v-if="searching" class="hint">Searching…</p>
        <ul v-else-if="candidates.length" class="results">
          <li v-for="person in candidates" :key="person.user_id || person.username">
            <div class="who">
              <span class="avatar" :style="paint(tint(person.username))">
                {{ initial(person) }}
              </span>
              <div class="who-text">
                <strong>{{ person.username }}</strong>
                <small>{{ fullName(person) || person.email || '—' }}</small>
              </div>
            </div>
            <button class="btn small" :disabled="busy" @click="add(person)">
              Add as {{ permission === 'write' ? 'editor' : 'viewer' }}
            </button>
          </li>
        </ul>
        <p v-else-if="query.trim().length >= 2" class="hint">
          Nobody matches “{{ query.trim() }}”.
        </p>
      </section>

      <!-- Who has access -->
      <section class="block">
        <div class="block-head">
          <span class="label">Who has access</span>
          <span class="count">{{ shares.length + 1 }}</span>
        </div>

        <ul class="access">
          <li>
            <div class="who">
              <span class="avatar owner" :style="paint(tint(paper.owner_username))">
                {{ (paper.owner_username || '?').charAt(0).toUpperCase() }}
              </span>
              <div class="who-text">
                <strong>{{ paper.owner_username || 'Owner' }}</strong>
                <small>Owner — can edit, share and delete</small>
              </div>
            </div>
            <span class="pill owner">Owner</span>
          </li>

          <li v-for="row in shares" :key="row.user_id">
            <div class="who">
              <span class="avatar" :style="paint(tint(row.username))">
                {{ (row.username || '?').charAt(0).toUpperCase() }}
              </span>
              <div class="who-text">
                <strong>{{ row.username || row.user_id }}</strong>
                <small>{{ row.permission === 'write'
                  ? 'Can view and edit — cannot delete'
                  : 'Can view only' }}</small>
              </div>
            </div>
            <div class="row-actions">
              <select
                class="select tight"
                :value="row.permission"
                :disabled="busy"
                :aria-label="`Permission for ${row.username}`"
                @change="change(row, ($event.target as HTMLSelectElement).value as 'read' | 'write')"
              >
                <option value="read">Can view</option>
                <option value="write">Can edit</option>
              </select>
              <button class="btn ghost small" :disabled="busy" @click="revoke(row)">
                Remove
              </button>
            </div>
          </li>
        </ul>
      </section>

      <!-- Link access -->
      <section class="block">
        <div class="block-head">
          <span class="label">Anyone with the link</span>
        </div>
        <div class="link-row">
          <select v-model="linkAccess" class="select" :disabled="busy"
                  aria-label="Link access" @change="applyLink">
            <option value="none">No link — private</option>
            <option value="read">Anyone with the link can view</option>
            <option value="write">Anyone with the link can edit</option>
          </select>
        </div>

        <div v-if="linkAccess !== 'none' && linkToken" class="link-box">
          <input class="input mono" type="text" readonly :value="shareUrl"
                 aria-label="Share link" @focus="($event.target as HTMLInputElement).select()">
          <button class="btn small" @click="copy">{{ copied ? 'Copied' : 'Copy' }}</button>
          <button class="btn ghost small" :disabled="busy" title="Invalidate the old link and make a new one"
                  @click="rotate">New link</button>
        </div>
        <p v-if="linkAccess !== 'none'" class="warn">
          Anyone holding this link can open the paper without signing in.
          Turning the link off or making a new one stops the old one working
          immediately.
        </p>
      </section>

      <p v-if="error" class="error">{{ error }}</p>

      <footer>
        <button class="btn ghost" @click="$emit('close')">Done</button>
      </footer>
    </div>
  </div>
</template>

<script setup lang="ts">
/**
 * Sharing a paper: named people, their permission, and the link.
 *
 * Everything here is owner-only, and the backend enforces that independently — a
 * collaborator with write access gets 403 on all of it. This dialog is simply never
 * opened for them.
 *
 * The wording is doing real work and is worth keeping. "Can view and edit — cannot
 * delete" is the actual rule and the thing people get wrong about a shared
 * whiteboard; the warning under the link says what a link *is*, because a link that
 * bypasses sign-in is the one control here with a consequence outside the app.
 */
import { computed, onMounted, ref } from 'vue';
import { paint } from '@/theme/contrast';
import { drawService, type DrawPaper, type DrawShare, type LinkAccess } from '@/services/draw.service';
import { userService } from '@/services/user.service';

const props = defineProps<{
    paper: DrawPaper;
    userId: string;
    username: string;
}>();

const emit = defineEmits<{
    (e: 'close'): void;
    (e: 'changed', paper: Partial<DrawPaper>): void;
}>();

const shares = ref<DrawShare[]>([]);
const linkAccess = ref<LinkAccess>(props.paper.link_access || 'none');
const linkToken = ref(props.paper.link_token || '');
const query = ref('');
const permission = ref<'read' | 'write'>('read');
const candidates = ref<any[]>([]);
const searching = ref(false);
const busy = ref(false);
const copied = ref(false);
const error = ref('');

let searchTimer: number | undefined;

const shareUrl = computed(() =>
    linkToken.value ? drawService.shareUrl(props.paper.paper_id, linkToken.value) : '');

onMounted(load);

async function load() {
    try {
        const data = await drawService.listShares(props.userId, props.paper.paper_id);
        shares.value = data.results || [];
        linkAccess.value = data.link_access || 'none';
        linkToken.value = data.link_token || '';
    } catch (err: any) {
        error.value = err?.message || 'Could not load who has access.';
    }
}

/** Debounced, because this hits the User Profile service and the input fires per
 *  keystroke. Two characters minimum: a single letter matches most of the platform
 *  and the result is useless. */
function onSearch() {
    window.clearTimeout(searchTimer);
    const term = query.value.trim();
    if (term.length < 2) {
        candidates.value = [];
        searching.value = false;
        return;
    }
    searching.value = true;
    searchTimer = window.setTimeout(async () => {
        try {
            const found = await userService.searchUsers(term, 8);
            const taken = new Set([
                String(props.paper.owner_id || '').toLowerCase(),
                ...shares.value.map(s => String(s.user_id || '').toLowerCase()),
            ]);
            // People who already have access are filtered out rather than shown as
            // disabled: offering to add somebody who is in the list directly below is
            // how an operator ends up thinking the add silently failed.
            candidates.value = found.filter(
                p => !taken.has(String((p as any).user_id || '').toLowerCase()));
        } catch {
            candidates.value = [];
        } finally {
            searching.value = false;
        }
    }, 260);
}

async function add(person: any) {
    busy.value = true;
    error.value = '';
    try {
        const row = await drawService.sharePaper(props.userId, props.username,
                                                props.paper.paper_id, {
            user_id: person.user_id,
            username: person.username,
            permission: permission.value,
        });
        shares.value = [...shares.value.filter(s => s.user_id !== row.user_id), row];
        candidates.value = candidates.value.filter(p => p.user_id !== person.user_id);
        query.value = '';
        emit('changed', { share_count: shares.value.length });
    } catch (err: any) {
        error.value = err?.message || 'Could not share the paper.';
    } finally {
        busy.value = false;
    }
}

async function change(row: DrawShare, next: 'read' | 'write') {
    if (next === row.permission) return;
    busy.value = true;
    error.value = '';
    try {
        const updated = await drawService.changeShare(props.userId, props.paper.paper_id,
                                                      row.user_id, next);
        shares.value = shares.value.map(s => s.user_id === row.user_id ? updated : s);
    } catch (err: any) {
        error.value = err?.message || 'Could not change their access.';
        await load();
    } finally {
        busy.value = false;
    }
}

async function revoke(row: DrawShare) {
    busy.value = true;
    error.value = '';
    try {
        await drawService.revokeShare(props.userId, props.paper.paper_id, row.user_id);
        shares.value = shares.value.filter(s => s.user_id !== row.user_id);
        emit('changed', { share_count: shares.value.length });
    } catch (err: any) {
        error.value = err?.message || 'Could not remove their access.';
    } finally {
        busy.value = false;
    }
}

async function applyLink() {
    busy.value = true;
    error.value = '';
    try {
        if (linkAccess.value === 'none') {
            await drawService.disableLink(props.userId, props.paper.paper_id);
            linkToken.value = '';
        } else {
            const data = await drawService.setLink(props.userId, props.paper.paper_id,
                                                   linkAccess.value as 'read' | 'write');
            linkToken.value = data.link_token;
        }
        emit('changed', { link_access: linkAccess.value, link_token: linkToken.value });
    } catch (err: any) {
        error.value = err?.message || 'Could not change the link.';
        linkAccess.value = props.paper.link_access || 'none';
    } finally {
        busy.value = false;
    }
}

async function rotate() {
    busy.value = true;
    error.value = '';
    try {
        const data = await drawService.setLink(props.userId, props.paper.paper_id,
                                               linkAccess.value as 'read' | 'write', true);
        linkToken.value = data.link_token;
        copied.value = false;
        emit('changed', { link_token: data.link_token });
    } catch (err: any) {
        error.value = err?.message || 'Could not make a new link.';
    } finally {
        busy.value = false;
    }
}

async function copy() {
    try {
        await navigator.clipboard.writeText(shareUrl.value);
        copied.value = true;
        window.setTimeout(() => { copied.value = false; }, 1800);
    } catch {
        error.value = 'Could not reach the clipboard — select the link and copy it.';
    }
}

function fullName(person: any): string {
    return [person.first_name, person.last_name].filter(Boolean).join(' ').trim();
}

function initial(person: any): string {
    return (person.username || person.first_name || '?').charAt(0).toUpperCase();
}

/** A stable colour per person, derived from their name rather than allocated, so the
 *  same person is the same colour every time the dialog opens. */
function tint(name?: string): string {
    const palette = ['#2563eb', '#dc2626', '#16a34a', '#d97706', '#7c3aed',
                     '#0891b2', '#db2777', '#65a30d'];
    const text = String(name || '?');
    let sum = 0;
    for (const char of text) sum += char.charCodeAt(0);
    return palette[sum % palette.length];
}
</script>

<style scoped>
.overlay {
  position: fixed;
  inset: 0;
  z-index: 1200;
  display: grid;
  place-items: center;
  padding: 20px;
  background: rgb(var(--sfs-shade-rgb, 15 23 42) / 0.55);
  backdrop-filter: blur(3px);
}

.dialog {
  width: min(620px, 100%);
  max-height: 90vh;
  overflow-y: auto;
  padding: 22px 24px 18px;
  border-radius: 16px;
  background: var(--sfs-paper, #fff);
  box-shadow: 0 28px 70px rgba(15, 23, 42, 0.35);
}

header { display: flex; justify-content: space-between; align-items: flex-start; gap: 12px; }
h2 { margin: 0; font-size: 1.12rem; color: #0f172a; }
.sub { margin: 4px 0 0; font-size: 0.82rem; color: var(--sfs-accent-text, #64748b); }

.close {
  border: none;
  background: transparent;
  font-size: 1.6rem;
  line-height: 1;
  color: var(--sfs-accent-text, #94a3b8);
  cursor: pointer;
}
.close:hover { color: var(--sfs-accent-text, #334155); }

.block { margin-top: 20px; }

.block-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 8px;
}

.label {
  font-size: 0.72rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--sfs-accent-text, #64748b);
}

.count {
  padding: 1px 8px;
  border-radius: 999px;
  background: var(--sfs-accent-soft, #f1f5f9);
  font-size: 0.74rem;
  font-weight: 700;
  color: var(--sfs-accent-on-paper, #475569);
}

.search-row { display: flex; gap: 8px; }

.input, .select {
  padding: 9px 11px;
  border: 1px solid var(--sfs-accent-soft, #cbd5e1);
  border-radius: 9px;
  font-size: 0.88rem;
  color: var(--sfs-on-paper, #0f172a);
  background: var(--sfs-paper, #fff);
}

.input { flex: 1; min-width: 0; }
.input:focus, .select:focus { outline: 2px solid rgb(var(--sfs-accent-rgb, 37 99 235) / 0.35); border-color: var(--sfs-accent, #2563eb); }
.input.mono { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 0.78rem; }
.select.tight { padding: 6px 8px; font-size: 0.8rem; }

.results, .access { list-style: none; margin: 10px 0 0; padding: 0; }

.results li, .access li {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  padding: 9px 0;
  border-bottom: 1px solid var(--sfs-accent-soft, #f1f5f9);
}

.results li:last-child, .access li:last-child { border-bottom: none; }

.who { display: flex; align-items: center; gap: 10px; min-width: 0; }

.avatar {
  display: grid;
  place-items: center;
  width: 32px;
  height: 32px;
  flex: 0 0 32px;
  border-radius: 50%;
  color: var(--sfs-text, #fff);
  font-weight: 700;
  font-size: 0.82rem;
}

.avatar.owner { box-shadow: 0 0 0 2px #fff, 0 0 0 4px rgb(var(--sfs-accent-rgb, 37 99 235) / 0.3); }

.who-text { display: flex; flex-direction: column; min-width: 0; }
.who-text strong { font-size: 0.88rem; color: #0f172a; }
.who-text small { font-size: 0.74rem; color: var(--sfs-accent-text, #64748b); }

.row-actions { display: flex; align-items: center; gap: 6px; flex-shrink: 0; }

.pill {
  padding: 3px 10px;
  border-radius: 999px;
  font-size: 0.72rem;
  font-weight: 700;
}
.pill.owner { background: rgb(var(--sfs-accent-rgb, 37 99 235) / 0.12); color: var(--sfs-accent-text, #1d4ed8); }

.btn {
  padding: 8px 14px;
  border: none;
  border-radius: 9px;
  background: var(--sfs-accent, #2563eb);
  color: var(--sfs-on-accent, #fff);
  font-size: 0.84rem;
  font-weight: 600;
  cursor: pointer;
}
.btn:hover:not(:disabled) { background: var(--sfs-accent, #1d4ed8); }
.btn:disabled { opacity: 0.55; cursor: not-allowed; }
.btn.small { padding: 6px 11px; font-size: 0.78rem; }
.btn.ghost { background: var(--sfs-accent-soft, #f1f5f9); color: var(--sfs-accent-on-paper, #334155); }
.btn.ghost:hover:not(:disabled) { background: var(--sfs-accent-soft, #e2e8f0); }

.link-row { display: flex; gap: 8px; }
.link-row .select { flex: 1; }

.link-box { display: flex; gap: 8px; margin-top: 9px; }

.hint { margin: 9px 0 0; font-size: 0.8rem; color: var(--sfs-accent-text, #64748b); }

.warn {
  margin: 9px 0 0;
  padding: 8px 11px;
  border-radius: 8px;
  background: var(--sfs-warning, #fffbeb);
  border: 1px solid var(--sfs-warning, #fde68a);
  font-size: 0.78rem;
  color: var(--sfs-warning-on-paper, #92400e);
}

.error {
  margin: 14px 0 0;
  padding: 9px 12px;
  border-radius: 8px;
  background: var(--sfs-danger, #fef2f2);
  border: 1px solid var(--sfs-danger, #fecaca);
  font-size: 0.82rem;
  color: var(--sfs-danger-on-paper, #b91c1c);
}

footer { display: flex; justify-content: flex-end; margin-top: 18px; }

@media (max-width: 560px) {
  .search-row, .link-box { flex-wrap: wrap; }
  .results li, .access li { flex-wrap: wrap; }
}
</style>
