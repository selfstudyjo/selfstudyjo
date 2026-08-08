<template>
  <div class="backdrop" @click.self="$emit('close')">
    <div class="dialog" role="dialog" aria-modal="true" aria-labelledby="new-chat-title">
      <header>
        <h2 id="new-chat-title">{{ mode === 'direct' ? 'New message' : 'New group' }}</h2>
        <button type="button" class="icon-btn" aria-label="Close" @click="$emit('close')">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg>
        </button>
      </header>

      <div class="tabs">
        <button :class="{ on: mode === 'direct' }" type="button" @click="mode = 'direct'">
          One to one
        </button>
        <button :class="{ on: mode === 'group' }" type="button" @click="mode = 'group'">
          Group
        </button>
      </div>

      <div class="body">
        <label v-if="mode === 'group'" class="field">
          <span>Group name</span>
          <input v-model="groupName" type="text" maxlength="120" placeholder="e.g. Physics revision" />
        </label>

        <label class="field">
          <span>{{ mode === 'direct' ? 'Who do you want to message?' : 'Add people' }}</span>
          <div class="search">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="11" cy="11" r="7"/><path d="M20 20l-4.35-4.35"/></svg>
            <input
              ref="searchBox"
              v-model="query"
              type="text"
              placeholder="Search by name or username…"
              autocomplete="off"
              @input="onSearch"
            />
            <span v-if="searching" class="spinner" aria-label="Searching"></span>
          </div>
        </label>

        <ul v-if="chosen.length" class="chips">
          <li v-for="person in chosen" :key="person.id">
            {{ person.username }}
            <button type="button" :aria-label="`Remove ${person.username}`" @click="unpick(person.id)">
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg>
            </button>
          </li>
        </ul>

        <ul class="results">
          <li v-for="person in visibleResults" :key="person.id">
            <button type="button" class="person" @click="pick(person)">
              <ChatAvatar :user-id="person.id" :name="person.full_name || person.username" size="md" />
              <span class="who">
                <span class="name">{{ person.full_name || person.username }}</span>
                <span class="handle">@{{ person.username }}</span>
              </span>
              <svg v-if="isChosen(person.id)" class="ticked" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"><path d="M4 12.5l5 5L20 6.5"/></svg>
            </button>
          </li>
          <li v-if="!searching && query.trim().length >= 2 && !visibleResults.length" class="empty">
            Nobody matches “{{ query }}”.
          </li>
          <li v-else-if="!query.trim()" class="empty">
            Type at least two letters to find somebody.
          </li>
        </ul>
      </div>

      <footer>
        <p v-if="error" class="error">{{ error }}</p>
        <div class="actions">
          <button type="button" class="ghost" @click="$emit('close')">Cancel</button>
          <button type="button" class="primary" :disabled="!canSubmit || working" @click="submit">
            {{ working ? 'Opening…' : (mode === 'direct' ? 'Start chat' : 'Create group') }}
          </button>
        </div>
      </footer>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, onMounted, ref, watch } from 'vue';

import ChatAvatar from './ChatAvatar.vue';
import { userService } from '@/services/user.service';

interface Person { id: string; username: string; full_name: string }

const props = defineProps<{ currentUserId: string }>();
const emit = defineEmits<{
  (e: 'close'): void;
  (e: 'direct', person: Person): void;
  (e: 'group', payload: { name: string; members: Person[] }): void;
}>();

const mode = ref<'direct' | 'group'>('direct');
const query = ref('');
const results = ref<Person[]>([]);
const chosen = ref<Person[]>([]);
const groupName = ref('');
const searching = ref(false);
const working = ref(false);
const error = ref('');
const searchBox = ref<HTMLInputElement | null>(null);

/** Never offer to start a conversation with yourself — the backend refuses it,
 *  and being told so after clicking is a worse way to find out. */
const visibleResults = computed(() =>
  results.value.filter(person => person.id !== props.currentUserId));

const canSubmit = computed(() => {
  if (mode.value === 'direct') return chosen.value.length === 1;
  return chosen.value.length >= 1 && groupName.value.trim().length > 0;
});

// Debounced, because this searches app 13 across the network on every keystroke
// otherwise. 260ms is below the point where typing feels laggy and above the
// point where each letter is its own request.
let debounce: number | null = null;
function onSearch() {
  if (debounce) window.clearTimeout(debounce);
  const term = query.value.trim();
  if (term.length < 2) {
    results.value = [];
    searching.value = false;
    return;
  }
  searching.value = true;
  debounce = window.setTimeout(runSearch, 260);
}

async function runSearch() {
  const term = query.value.trim();
  if (term.length < 2) return;
  try {
    const found = await userService.searchUsers(term, 12);
    // The term may have moved on while this was in flight; a slow response for
    // "ph" landing after "physics" would replace the right results with stale ones.
    if (term !== query.value.trim()) return;
    results.value = (found || []).map((profile: any) => ({
      id: String(profile.user_id || profile.id || ''),
      username: String(profile.username || ''),
      full_name: String(profile.full_name || profile.name || ''),
    })).filter(person => person.id && person.username);
    error.value = '';
  } catch {
    error.value = 'Could not search for people just now.';
  } finally {
    searching.value = false;
  }
}

function isChosen(id: string) {
  return chosen.value.some(person => person.id === id);
}

function pick(person: Person) {
  if (isChosen(person.id)) {
    unpick(person.id);
    return;
  }
  // A one-to-one conversation has exactly one other person in it, so picking a
  // second replaces the first rather than being silently ignored.
  chosen.value = mode.value === 'direct' ? [person] : [...chosen.value, person];
}

function unpick(id: string) {
  chosen.value = chosen.value.filter(person => person.id !== id);
}

// Switching to one-to-one with several people picked keeps the most recent
// rather than clearing the lot, which is what somebody who mis-clicked the tab
// would expect.
watch(mode, value => {
  if (value === 'direct' && chosen.value.length > 1) {
    chosen.value = [chosen.value[chosen.value.length - 1]];
  }
});

function submit() {
  if (!canSubmit.value) return;
  working.value = true;
  error.value = '';
  if (mode.value === 'direct') {
    emit('direct', chosen.value[0]);
  } else {
    emit('group', { name: groupName.value.trim(), members: chosen.value });
  }
  // The parent closes the dialog on success and calls `failed` on error; leaving
  // `working` set means a second click cannot fire a duplicate create.
}

function failed(message: string) {
  working.value = false;
  error.value = message;
}

defineExpose({ failed });

onMounted(() => nextTick(() => searchBox.value?.focus()));
</script>

<style scoped>
.backdrop {
  position: fixed; inset: 0; z-index: 60;
  display: grid; place-items: center;
  background: rgba(3, 4, 16, 0.72);
  backdrop-filter: blur(6px);
  -webkit-backdrop-filter: blur(6px);
  padding: 18px;
}
.dialog {
  width: min(480px, 100%);
  max-height: min(640px, 92dvh);
  display: flex; flex-direction: column;
  background: rgba(14, 16, 38, 0.96);
  backdrop-filter: var(--uc-blur-strong);
  -webkit-backdrop-filter: var(--uc-blur-strong);
  border: 1px solid var(--uc-border-strong);
  border-radius: var(--uc-r-lg);
  box-shadow: var(--uc-shadow-lg);
  color: var(--uc-text);
  overflow: hidden;
}

header { display: flex; align-items: center; justify-content: space-between; padding: 15px 16px 11px; }
h2 { margin: 0; font-size: var(--uc-fs-xl); font-weight: 650; color: var(--uc-text); }

.tabs { display: flex; gap: 5px; padding: 0 16px 12px; border-bottom: 1px solid var(--uc-border); }
.tabs button {
  flex: 1; padding: 8px 10px; border: 1px solid transparent; border-radius: var(--uc-r-xs);
  background: var(--uc-surface); color: var(--uc-text-muted);
  font: inherit; font-size: var(--uc-fs-sm); font-weight: 600; cursor: pointer;
  transition: background var(--uc-t-fast), color var(--uc-t-fast);
}
.tabs button:hover { background: var(--uc-surface-2); color: var(--uc-text-soft); }
.tabs button.on { background: var(--uc-brand-grad); color: #fff; border-color: transparent; }

.body { flex: 1; min-height: 0; overflow-y: auto; padding: 14px 16px; }

.field { display: block; margin-bottom: 14px; }
.field > span { display: block; margin-bottom: 6px; font-size: var(--uc-fs-sm); font-weight: 600; color: var(--uc-text-muted); }
.field input[type="text"] {
  width: 100%; padding: 9px 12px; font: inherit; font-size: var(--uc-fs-md);
  color: var(--uc-text); background: var(--uc-surface);
  border: 1px solid var(--uc-border); border-radius: var(--uc-r-xs); outline: none;
  transition: border-color var(--uc-t-fast), background var(--uc-t-fast);
}
.field input[type="text"]::placeholder { color: var(--uc-text-dim); }
.field input[type="text"]:focus {
  border-color: rgba(129, 140, 248, 0.5);
  background: var(--uc-surface-2);
  box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.16);
}

.search { position: relative; display: flex; align-items: center; }
.search svg { position: absolute; left: 11px; color: var(--uc-text-dim); pointer-events: none; }
.search input { padding-left: 34px; padding-right: 34px; }
.spinner {
  position: absolute; right: 11px;
  width: 13px; height: 13px;
  border: 2px solid var(--uc-border-strong); border-top-color: var(--uc-brand-soft);
  border-radius: 50%; animation: spin 0.7s linear infinite;
}
@keyframes spin { to { transform: rotate(360deg); } }

.chips { display: flex; flex-wrap: wrap; gap: 6px; list-style: none; margin: 0 0 12px; padding: 0; }
.chips li {
  display: inline-flex; align-items: center; gap: 5px;
  padding: 4px 7px 4px 11px; border-radius: var(--uc-r-full);
  background: rgba(129, 140, 248, 0.2); color: #c7d2fe;
  border: 1px solid rgba(129, 140, 248, 0.3);
  font-size: var(--uc-fs-sm); font-weight: 600;
}
.chips button { display: grid; place-items: center; border: 0; background: none; color: inherit; cursor: pointer; padding: 2px; }
.chips button:hover { color: #fff; }

.results { list-style: none; margin: 0; padding: 0; }
.person {
  display: flex; align-items: center; gap: 11px; width: 100%;
  padding: 8px; border: 0; border-radius: var(--uc-r-xs);
  background: none; color: inherit; font: inherit; cursor: pointer; text-align: left;
  transition: background var(--uc-t-fast);
}
.person:hover { background: var(--uc-surface); }
.who { flex: 1; min-width: 0; }
.name {
  display: block; font-size: var(--uc-fs-md); color: var(--uc-text-soft);
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
}
.handle { display: block; font-size: var(--uc-fs-xs); color: var(--uc-text-dim); }
.ticked { color: var(--uc-brand-soft); flex: 0 0 auto; }
.empty { padding: 18px 8px; font-size: var(--uc-fs-sm); color: var(--uc-text-dim); text-align: center; }

footer {
  border-top: 1px solid var(--uc-border);
  padding: 12px 16px calc(13px + env(safe-area-inset-bottom, 0px));
}
.error { margin: 0 0 8px; font-size: var(--uc-fs-sm); color: var(--uc-danger); }
.actions { display: flex; justify-content: flex-end; gap: 8px; }
.ghost, .primary {
  border: 1px solid transparent; border-radius: var(--uc-r-xs); padding: 9px 16px;
  font: inherit; font-size: var(--uc-fs-md); font-weight: 600; cursor: pointer;
}
.ghost { background: var(--uc-surface); color: var(--uc-text-muted); border-color: var(--uc-border); }
.ghost:hover { background: var(--uc-surface-2); color: var(--uc-text); }
.primary { background: var(--uc-brand-grad); color: #fff; box-shadow: 0 4px 14px rgba(102, 126, 234, 0.38); }
.primary:hover:not(:disabled) { box-shadow: 0 8px 22px rgba(102, 126, 234, 0.5); }
.primary:disabled { opacity: 0.4; box-shadow: none; cursor: not-allowed; }

.icon-btn {
  display: grid; place-items: center; width: 30px; height: 30px;
  border: 0; border-radius: 50%; background: none;
  color: var(--uc-text-muted); cursor: pointer;
  transition: background var(--uc-t-fast), color var(--uc-t-fast);
}
.icon-btn:hover { background: var(--uc-surface-2); color: var(--uc-text); }
</style>
