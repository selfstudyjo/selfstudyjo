<!--
  src/views/AiChat.vue — the AI Chat Assistant.

  Rooms down the side, one conversation in the middle, and a memory per room so
  a project picked up next week does not have to be explained again. The model
  in `@/utils/aichatRooms` decides the ordering, the buckets and the search; this
  file draws and nothing else, which is what lets `npm run check:aichat` verify
  any of it.

  TWO THINGS HERE ARE SECURITY DECISIONS RATHER THAN STYLE
  ========================================================

  * NO MODEL OUTPUT EVER REACHES `v-html` UNESCAPED. The previous version was
    `v-html="marked(content)"`, and `marked` passes raw HTML through by design.
    A language model produces `<img src=x onerror=...>` whenever the
    conversation is about HTML — which on a platform that teaches web
    development is a Tuesday rather than an attack — and the user can simply ASK
    it to. The reply is turned into a list of TYPED BLOCKS by `renderMarkdown`,
    which cannot emit markup because it emits data, and every block is drawn as
    a real element. Prose goes through `RichText`, whose whole contract is that
    it escapes the input before inserting the anchors it built itself. Working
    rule 13.

  * THE MESSAGE ID IS MINTED HERE. The backend adopts it, so the Retry button on
    a failed send is idempotent rather than a way to say the same thing twice.
-->
<template>
  <div class="ai-chat-container" :class="{ 'sidebar-open': sidebarOpen }">

    <!-- ROOMS -->
    <aside class="chat-rooms" :class="{ open: sidebarOpen }">
      <div class="rooms-head">
        <button class="new-chat-btn" @click="startRoom" :disabled="creating">
          <span aria-hidden="true">＋</span> {{ $t('New chat') }}
        </button>
        <button class="rooms-close" @click="sidebarOpen = false"
                :aria-label="$t('Close')">×</button>
      </div>

      <div class="rooms-search">
        <input v-model="query" type="search" :placeholder="$t('Search chats')"
               :aria-label="$t('Search chats')" />
      </div>

      <div class="rooms-list" role="navigation" :aria-label="$t('Your chats')">
        <p v-if="loadingRooms" class="rooms-note">{{ $t('Loading…') }}</p>
        <p v-else-if="!rooms.length" class="rooms-note">
          {{ $t('No chats yet. Start one and it will be saved here.') }}
        </p>
        <p v-else-if="!groups.length" class="rooms-note">
          {{ $t('No chats match that search.') }}
        </p>

        <template v-for="group in groups" :key="group.bucket">
          <h2 class="rooms-bucket">{{ $t(BUCKET_LABELS[group.bucket]) }}</h2>
          <div v-for="room in group.rooms" :key="room.id"
               class="room-row" :class="{ active: room.id === activeId }">
            <button class="room-open" @click="openRoom(room.id)">
              <span class="room-title">{{ titleOf(room, $t('New chat')) }}</span>
              <span class="room-meta">
                <!--
                  The mark that says "the assistant can pick this up where you
                  left it". Not "has messages" — a two-turn chat needs no memory
                  and marking it would make the mark mean nothing.
                -->
                <span v-if="isResumable(room)" class="room-brief-dot"
                      :title="$t('The assistant remembers this project')"
                      aria-hidden="true">◆</span>
                <span class="room-preview">{{ room.topic || room.last_message_preview }}</span>
              </span>
            </button>
            <div class="room-actions">
              <button @click="togglePin(room)"
                      :aria-label="room.pinned ? $t('Unpin') : $t('Pin')"
                      :title="room.pinned ? $t('Unpin') : $t('Pin')"
                      :class="{ on: room.pinned }">📌</button>
              <button @click="renameRoom(room)" :aria-label="$t('Rename')"
                      :title="$t('Rename')">✏️</button>
              <button @click="removeRoom(room)" :aria-label="$t('Delete')"
                      :title="$t('Delete')">🗑️</button>
            </div>
          </div>
        </template>
      </div>
    </aside>

    <!-- CONVERSATION -->
    <section class="chat-main">
      <div class="chat-header">
        <button class="rooms-toggle" @click="sidebarOpen = true"
                :aria-label="$t('Your chats')">☰</button>
        <div class="chat-heading">
          <h1>{{ activeRoom ? titleOf(activeRoom, $t('AI Chat Assistant'))
                            : $t('AI Chat Assistant') }}</h1>
          <p v-if="activeRoom?.topic">{{ activeRoom.topic }}</p>
          <p v-else>{{ $t('Ask me anything about your courses, labs, or general knowledge') }}</p>
        </div>
        <button v-if="activeRoom" class="context-btn" @click="toggleContext"
                :class="{ on: contextOpen }" :aria-expanded="contextOpen">
          {{ $t('Memory') }}
        </button>
      </div>

      <!--
        The memory, readable and editable.

        Visible on purpose: a memory the user cannot see is one they cannot
        correct, and "why does it keep thinking I use Postgres" has no answer
        anywhere else on the platform.
      -->
      <div v-if="contextOpen && activeRoom" class="context-panel">
        <p class="context-line">{{ contextLine }}</p>
        <!--
          The brief below is about to change. Said rather than hidden, and with
          no timer chasing it: a reader who has just corrected a brief and sees
          the old one still there needs to know which of the two is going to
          win. It clears on the next fetch of the panel.
        -->
        <p v-if="contextPending" class="context-line">
          {{ $t('The assistant is updating what it remembers from this chat.') }}
        </p>
        <label class="context-label" :for="'brief-' + activeRoom.id">
          {{ $t('What you are working on') }}
        </label>
        <textarea :id="'brief-' + activeRoom.id" v-model="briefDraft" rows="5"
                  :placeholder="$t('The assistant fills this in as you talk. Edit it to correct what it remembers.')"
        ></textarea>
        <div class="context-actions">
          <button @click="saveBrief" :disabled="savingBrief">
            {{ savingBrief ? $t('Saving…') : $t('Save') }}
          </button>
          <button class="ghost" @click="refreshContext" :disabled="rebuilding">
            {{ rebuilding ? $t('Updating…') : $t('Update from this chat') }}
          </button>
          <button class="ghost danger" @click="clearRoom">{{ $t('Clear chat') }}</button>
        </div>
        <p v-if="context?.summary" class="context-summary">
          <strong>{{ $t('Earlier in this chat') }}</strong><br />{{ context.summary }}
        </p>
        <p v-if="contextError" class="context-error" role="alert">{{ contextError }}</p>
      </div>

      <div class="messages-container" ref="messagesContainer">
        <div v-if="loadingRoom" class="chat-empty">{{ $t('Loading…') }}</div>

        <div v-else-if="!messages.length" class="chat-empty">
          <p class="chat-empty-title">{{ $t('What are you working on?') }}</p>
          <p>{{ $t('Everything you say here is saved, and the assistant will remember the project next time you open this chat.') }}</p>
        </div>

        <div v-for="msg in messages" :key="msg.id"
             :class="['message', msg.role === 'user' ? 'user-message' : 'assistant-message',
                      { failed: msg.failed }]">
          <div class="message-avatar" aria-hidden="true">
            <span v-if="msg.role === 'user'">👤</span><span v-else>🤖</span>
          </div>
          <div class="message-content">
            <!--
              Rendered as BLOCKS, never as HTML. See the header comment: this is
              text a language model wrote, on a page behind a session, and the
              user can ask it for anything at all.
            -->
            <template v-if="msg.role === 'assistant'">
              <div v-for="(block, i) in renderMarkdown(msg.content)" :key="i"
                   class="md-block">
                <pre v-if="block.kind === 'code'" class="md-code"><code
                  >{{ block.text }}</code><button class="copy-code-btn" type="button"
                    @click="copy(block.text, $event)"
                    :aria-label="$t('Copy code')">📋</button></pre>
                <h3 v-else-if="block.kind === 'heading'">{{ block.text }}</h3>
                <ul v-else-if="block.kind === 'list'">
                  <li v-for="(item, j) in block.items" :key="j">
                    <RichText :text="item" tag="span" :mentions="false" />
                  </li>
                </ul>
                <ol v-else-if="block.kind === 'ordered'" :start="block.start">
                  <li v-for="(item, j) in block.items" :key="j">
                    <RichText :text="item" tag="span" :mentions="false" />
                  </li>
                </ol>
                <blockquote v-else-if="block.kind === 'quote'">
                  <RichText :text="block.text" tag="span" :mentions="false" />
                </blockquote>
                <!--
                  RichText, not `{{ }}`: an answer routinely cites a URL and dead
                  text somebody has to select and copy is the exact complaint
                  `linkify.ts` was written for. It is NOT a way back to raw HTML
                  -- it escapes the whole string before inserting the anchors it
                  built itself, allow-lists the scheme, and adds
                  rel="noopener noreferrer". Mentions are off: `@something` in a
                  code-adjacent answer is a decorator or an email fragment, not a
                  person, and there is no profile route to point one at anyway.
                -->
                <RichText v-else :text="block.text" :mentions="false" />
              </div>
            </template>
            <div v-else class="plain-text">{{ msg.content }}</div>

            <button v-if="msg.failed" class="retry-btn" @click="retry(msg)">
              {{ $t('Retry') }}
            </button>
          </div>
        </div>

        <div v-if="isLoading" class="message assistant-message">
          <div class="message-avatar" aria-hidden="true">🤖</div>
          <div class="message-content">
            <div class="typing-indicator" :aria-label="$t('Thinking…')">
              <span></span><span></span><span></span>
            </div>
          </div>
        </div>
      </div>

      <p v-if="error" class="chat-error" role="alert">{{ error }}</p>

      <div class="input-area">
        <textarea
          v-model="userInput"
          @keydown="handleKeyDown"
          @input="adjustTextareaHeight"
          :placeholder="$t('Type your message… (Enter to send, Shift+Enter for a new line)')"
          rows="1"
          ref="textarea"
          :disabled="isLoading"
        ></textarea>
        <button @click="sendMessage" :disabled="!userInput.trim() || isLoading"
                :aria-label="$t('Send')">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none"
               stroke="currentColor" stroke-width="2" aria-hidden="true">
            <path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z" />
          </svg>
        </button>
      </div>
    </section>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, onMounted, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useAuthStore } from '@/store/auth';
import { useI18n } from '@/i18n/runtime';
import { aiChatService, isServiceRefusal } from '@/services/aichat.service';
import type { ChatContext, ChatMessage, ChatRoomSummary } from '@/services/aichat.service';
import {
    BUCKET_LABELS,
    describeContext,
    groupRooms,
    isResumable,
    matchesQuery,
    newMessageId,
    sortRooms,
    titleOf,
    upsertRoom,
} from '@/utils/aichatRooms';
import { renderMarkdown } from '@/utils/aichatMarkdown';
import RichText from '@/components/RichText.vue';

const { t } = useI18n();
const route = useRoute();
const router = useRouter();
const auth = useAuthStore();

const rooms = ref<ChatRoomSummary[]>([]);
const messages = ref<ChatMessage[]>([]);
const activeId = ref<string>('');
const context = ref<ChatContext | null>(null);

const userInput = ref('');
const query = ref('');
const briefDraft = ref('');
const error = ref('');
const contextError = ref('');

const contextPending = ref(false);
const isLoading = ref(false);
const loadingRooms = ref(true);
const loadingRoom = ref(false);
const creating = ref(false);
const savingBrief = ref(false);
const rebuilding = ref(false);
const sidebarOpen = ref(false);
const contextOpen = ref(false);

const messagesContainer = ref<HTMLElement | null>(null);
const textarea = ref<HTMLTextAreaElement | null>(null);

const userId = computed(() => auth.user?.id || '');
const activeRoom = computed(() => rooms.value.find((r) => r.id === activeId.value) || null);
const groups = computed(() =>
    groupRooms(rooms.value.filter((r) => matchesQuery(r, query.value)), Date.now()));
const contextLine = computed(() => {
    const { key, params } = describeContext(context.value);
    return t(key, params);
});

// ---------------------------------------------------------------------------
// Rooms
// ---------------------------------------------------------------------------

async function loadRooms() {
    if (!userId.value) return;
    loadingRooms.value = true;
    try {
        rooms.value = sortRooms(await aiChatService.listRooms(userId.value));
    } catch (e) {
        error.value = t('Could not load your chats.');
    } finally {
        loadingRooms.value = false;
    }
}

async function openRoom(id: string) {
    if (!id || !userId.value) return;
    sidebarOpen.value = false;
    if (id !== activeId.value) {
        // The room id is in the URL, so a chat is a place: it survives a reload,
        // it can be bookmarked, and Back goes to the chat you came from rather
        // than out of the feature. `push`, not `replace` — moving between two
        // conversations IS navigation, unlike flicking between tabs on one page.
        if (route.params.roomId !== id) router.push(`/ai-chat/${id}`);
    }
    activeId.value = id;
    loadingRoom.value = true;
    messages.value = [];
    context.value = null;
    try {
        const got = await aiChatService.getRoom(userId.value, id);
        messages.value = got.messages || [];
        rooms.value = upsertRoom(rooms.value, got.room);
        briefDraft.value = '';
        scrollToBottom();
    } catch (e) {
        error.value = t('Could not open that chat.');
    } finally {
        loadingRoom.value = false;
        nextTick(() => textarea.value?.focus());
    }
}

async function startRoom() {
    if (!userId.value || creating.value) return;
    creating.value = true;
    error.value = '';
    try {
        const room = await aiChatService.createRoom(userId.value, {
            username: auth.user?.username || '',
        });
        rooms.value = upsertRoom(rooms.value, room);
        await openRoom(room.id);
    } catch (e) {
        error.value = t('Could not start a new chat.');
    } finally {
        creating.value = false;
    }
}

async function togglePin(room: ChatRoomSummary) {
    try {
        rooms.value = upsertRoom(rooms.value,
            await aiChatService.updateRoom(userId.value, room.id, { pinned: !room.pinned }));
    } catch { /* a pin that did not save is not worth an alert */ }
}

async function renameRoom(room: ChatRoomSummary) {
    const next = window.prompt(t('Name this chat'), room.title || '');
    if (next === null) return;
    const title = next.trim();
    if (!title) return;
    try {
        rooms.value = upsertRoom(rooms.value,
            await aiChatService.updateRoom(userId.value, room.id, { title }));
    } catch {
        error.value = t('Could not rename that chat.');
    }
}

async function removeRoom(room: ChatRoomSummary) {
    if (!window.confirm(t('Delete this chat and everything in it?'))) return;
    try {
        await aiChatService.deleteRoom(userId.value, room.id);
        rooms.value = rooms.value.filter((r) => r.id !== room.id);
        if (activeId.value === room.id) {
            activeId.value = '';
            messages.value = [];
            context.value = null;
            router.replace('/ai-chat');
        }
    } catch {
        error.value = t('Could not delete that chat.');
    }
}

// ---------------------------------------------------------------------------
// Sending
// ---------------------------------------------------------------------------

async function sendMessage() {
    const content = userInput.value.trim();
    if (!content || isLoading.value || !userId.value) return;

    // A first message with no room yet creates one, so the empty state is a
    // place you can type rather than a button you have to find first.
    if (!activeId.value) {
        await startRoom();
        if (!activeId.value) return;
    }

    const id = newMessageId();
    userInput.value = '';
    adjustTextareaHeight();
    error.value = '';
    await deliver(id, content);
}

async function retry(failed: ChatMessage) {
    if (isLoading.value) return;
    // The SAME id. The backend adopts a client-minted id, so re-sending updates
    // the record rather than adding a second copy of the sentence — which is the
    // whole reason the id is minted here and not there.
    messages.value = messages.value.filter((m) => m.id !== failed.id);
    error.value = '';
    await deliver(failed.id, failed.content);
}

async function deliver(id: string, content: string) {
    const roomId = activeId.value;
    messages.value.push({ id, role: 'user', content, created_at: new Date().toISOString() });
    scrollToBottom();
    isLoading.value = true;
    try {
        const result = await aiChatService.send(userId.value, roomId, id, content);
        // The room may have moved on while the model was thinking — a rename in
        // another tab, or the first reply naming the chat. Guard on it so a
        // reply never lands in the conversation the reader is now looking at.
        if (activeId.value !== roomId) {
            rooms.value = upsertRoom(rooms.value, result.room);
            return;
        }
        messages.value.push(result.message);
        rooms.value = upsertRoom(rooms.value, result.room);
        contextPending.value = !!result.context_pending;
        if (contextOpen.value) loadContext();
    } catch (e) {
        const mine = messages.value.find((m) => m.id === id);
        if (mine) mine.failed = true;
        error.value = isServiceRefusal(e)
            // The backend stored the question before asking the providers, so
            // this is recoverable and the retry cannot duplicate anything.
            ? t('The assistant could not be reached. Your message was saved — try again.')
            : t('Could not send that message.');
    } finally {
        isLoading.value = false;
        scrollToBottom();
        nextTick(() => textarea.value?.focus());
    }
}

// ---------------------------------------------------------------------------
// The memory
// ---------------------------------------------------------------------------

function toggleContext() {
    contextOpen.value = !contextOpen.value;
    if (contextOpen.value) loadContext();
}

async function loadContext() {
    if (!activeId.value) return;
    contextError.value = '';
    try {
        const got = await aiChatService.getContext(userId.value, activeId.value);
        context.value = got;
        // `stale` is the backend's own derivation off the record, so it is right
        // even when the rebuild thread died with its worker — unlike the flag
        // the send response carried, which only says one was started.
        contextPending.value = !!got.stale;
        // Only seeded when the box is untouched, so a reload of the panel does
        // not discard an edit somebody is halfway through typing.
        if (!briefDraft.value) briefDraft.value = got.brief || '';
    } catch {
        contextError.value = t('Could not read what the assistant remembers.');
    }
}

async function saveBrief() {
    if (!activeId.value) return;
    savingBrief.value = true;
    contextError.value = '';
    try {
        rooms.value = upsertRoom(rooms.value, await aiChatService.updateRoom(
            userId.value, activeId.value, { brief: briefDraft.value }));
        await loadContext();
    } catch {
        contextError.value = t('Could not save that.');
    } finally {
        savingBrief.value = false;
    }
}

async function refreshContext() {
    if (!activeId.value) return;
    rebuilding.value = true;
    contextError.value = '';
    try {
        rooms.value = upsertRoom(rooms.value,
            await aiChatService.rebuildContext(userId.value, activeId.value));
        briefDraft.value = '';
        await loadContext();
    } catch {
        contextError.value = t('The assistant could not be reached. Nothing was changed.');
    } finally {
        rebuilding.value = false;
    }
}

async function clearRoom() {
    if (!activeId.value) return;
    if (!window.confirm(t('Clear every message here, and what the assistant remembers?'))) return;
    try {
        rooms.value = upsertRoom(rooms.value,
            await aiChatService.clearRoom(userId.value, activeId.value));
        messages.value = [];
        context.value = null;
        briefDraft.value = '';
    } catch {
        contextError.value = t('Could not clear that chat.');
    }
}

// ---------------------------------------------------------------------------
// Chrome
// ---------------------------------------------------------------------------

function adjustTextareaHeight() {
    const el = textarea.value;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = Math.min(el.scrollHeight, 200) + 'px';
}

function scrollToBottom() {
    nextTick(() => {
        const el = messagesContainer.value;
        if (el) el.scrollTop = el.scrollHeight;
    });
}

function handleKeyDown(e: KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendMessage();
    }
}

async function copy(text: string, event: MouseEvent) {
    const btn = event.currentTarget as HTMLButtonElement | null;
    try {
        await navigator.clipboard.writeText(text);
        if (btn) { btn.textContent = '✅'; setTimeout(() => { btn.textContent = '📋'; }, 2000); }
    } catch {
        if (btn) { btn.textContent = '❌'; setTimeout(() => { btn.textContent = '📋'; }, 2000); }
    }
}

// A room opened from the URL, including on a reload and on Back.
watch(() => route.params.roomId, (id) => {
    const next = typeof id === 'string' ? id : '';
    if (next && next !== activeId.value) openRoom(next);
});

onMounted(async () => {
    await loadRooms();
    const fromUrl = typeof route.params.roomId === 'string' ? route.params.roomId : '';
    if (fromUrl) await openRoom(fromUrl);
    // Deliberately does NOT auto-open the most recent chat. Landing inside last
    // week's conversation and typing into it by accident is worse than one
    // extra click, and the empty state is where a new chat starts anyway.
    nextTick(() => { adjustTextareaHeight(); textarea.value?.focus(); });
});
</script>

<style src="@/assets/css/ai-chat.css"></style>
