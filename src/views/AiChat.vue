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
        <div class="chat-header-actions">
          <button v-if="activeRoom" class="context-btn" @click="toggleContext"
                  :class="{ on: contextOpen }" :aria-expanded="contextOpen">
            {{ $t('Memory') }}
          </button>
        </div>
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
            <div v-else-if="msg.content" class="plain-text">{{ msg.content }}</div>
            <!--
              What was attached: a thumbnail the SERVER validated as an image
              data URL, or a file chip. Bound as an attribute / text, never as
              markup - a file name is whatever the sender called it.
            -->
            <ul v-if="msg.attachments?.length" class="msg-attachments" :aria-label="$t('Attachments')">
              <li v-for="(att, k) in msg.attachments" :key="att.id || k" class="msg-attachment">
                <img v-if="att.kind === 'image' && att.thumb" :src="att.thumb" :alt="att.name"
                     class="msg-attachment-thumb" loading="lazy" />
                <span v-else class="msg-attachment-icon" aria-hidden="true">{{ att.kind === 'image' ? '🖼️' : '📄' }}</span>
                <span class="msg-attachment-name" dir="auto">{{ att.name }}</span>
                <span class="msg-attachment-size">{{ formatBytes(att.size) }}</span>
                <span v-if="att.truncated" class="msg-attachment-note">{{ $t('only the start was read') }}</span>
              </li>
            </ul>

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

      <!-- What will go with the next message, each removable before sending. -->
      <ul v-if="pending.length" class="pending-attachments" :aria-label="$t('Attachments')">
        <li v-for="(att, k) in pending" :key="k" class="pending-attachment">
          <img v-if="att.thumb" :src="att.thumb" :alt="att.name" class="msg-attachment-thumb" />
          <span v-else class="msg-attachment-icon" aria-hidden="true">📄</span>
          <span class="msg-attachment-name" dir="auto">{{ att.name }}</span>
          <span class="msg-attachment-size">{{ formatBytes(att.size) }}</span>
          <button type="button" class="pending-remove" @click="removePending(k)"
                  :aria-label="$t('Remove {v0}', { v0: att.name })">×</button>
        </li>
      </ul>
      <p v-if="recording" class="recording-line" role="status">
        <span class="recording-dot" aria-hidden="true"></span>
        {{ $t('Listening… {v0}s. Press the microphone again to stop.', { v0: recordSeconds }) }}
      </p>
      <p v-else-if="transcribing" class="recording-line" role="status">{{ $t('Turning your voice into text…') }}</p>
      <p class="attach-hint">{{ $t('You can attach one image, text or code files, Word documents (.docx) and PDFs. Images up to 4 MB, files up to 1 MB.') }}</p>

      <div class="input-area">
        <input ref="fileInput" type="file" class="sr-file-input" :accept="ACCEPT" multiple
               tabindex="-1" aria-hidden="true" @change="onFilesChosen" />
        <button type="button" class="tool-btn" @click="fileInput?.click()"
                :disabled="isLoading || pending.length >= MAX_ATTACHMENTS"
                :aria-label="$t('Attach a file or image')" :title="$t('Attach a file or image')">📎</button>
        <button v-if="canRecord" type="button" class="tool-btn" :class="{ on: recording }"
                @click="toggleRecording" :disabled="isLoading || transcribing"
                :aria-pressed="recording"
                :aria-label="recording ? $t('Stop recording') : $t('Speak your message')"
                :title="recording ? $t('Stop recording') : $t('Speak your message')">🎤</button>
        <textarea
          v-model="userInput"
          @keydown="handleKeyDown"
          @input="adjustTextareaHeight"
          :placeholder="$t('Type your message… (Enter to send, Shift+Enter for a new line)')"
          rows="1"
          ref="textarea"
          :disabled="isLoading"
        ></textarea>
        <button @click="sendMessage" :disabled="(!userInput.trim() && !pending.length) || isLoading || preparing"
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
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';
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
import {
    ACCEPT,
    IMAGE_MAX_SIDE,
    MAX_ATTACHMENTS,
    MAX_AUDIO_BYTES,
    MAX_IMAGE_BYTES,
    MAX_RECORDING_SECONDS,
    THUMB_SIDE,
    fitWithin,
    formatBytes,
    insertDictation,
    isAcceptableThumb,
    kindOf,
    pickRecordingType,
    refusalFor,
    type ChatAttachment,
    type PendingAttachment,
} from '@/utils/aichatAttachments';
import { ApiError } from '@/services/api';
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
const fileInput = ref<HTMLInputElement | null>(null);

// Attachments waiting for the next send, and the payloads of failed sends so
// Retry can resend the same files under the same id.
const pending = ref<PendingAttachment[]>([]);
const preparing = ref(false);
const retryFiles = new Map<string, PendingAttachment[]>();

// Voice input.
const canRecord = typeof window !== 'undefined' && !!navigator.mediaDevices?.getUserMedia
    && typeof (window as any).MediaRecorder !== 'undefined';
const recording = ref(false);
const transcribing = ref(false);
const recordSeconds = ref(0);
let recorder: MediaRecorder | null = null;
let recordStream: MediaStream | null = null;
let recordTimer: ReturnType<typeof setInterval> | null = null;
let recordChunks: Blob[] = [];

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
    const files = pending.value.slice();
    if ((!content && !files.length) || isLoading.value || preparing.value || !userId.value) return;

    // A first message with no room yet creates one, so the empty state is a
    // place you can type rather than a button you have to find first.
    if (!activeId.value) {
        await startRoom();
        if (!activeId.value) return;
    }

    const id = newMessageId();
    userInput.value = '';
    pending.value = [];
    adjustTextareaHeight();
    error.value = '';
    await deliver(id, content, files);
}

async function retry(failed: ChatMessage) {
    if (isLoading.value) return;
    // The SAME id. The backend adopts a client-minted id, so re-sending updates
    // the record rather than adding a second copy of the sentence — which is the
    // whole reason the id is minted here and not there.
    messages.value = messages.value.filter((m) => m.id !== failed.id);
    error.value = '';
    await deliver(failed.id, failed.content, retryFiles.get(failed.id) || []);
}

async function deliver(id: string, content: string, files: PendingAttachment[] = []) {
    const roomId = activeId.value;
    const shown: ChatAttachment[] = files.map(({ data: _data, ...meta }) => meta);
    messages.value.push({ id, role: 'user', content, created_at: new Date().toISOString(),
                          ...(shown.length ? { attachments: shown } : {}) });
    scrollToBottom();
    isLoading.value = true;
    try {
        const result = await aiChatService.send(userId.value, roomId, id, content, files);
        retryFiles.delete(id);
        // The room may have moved on while the model was thinking — a rename in
        // another tab, or the first reply naming the chat. Guard on it so a
        // reply never lands in the conversation the reader is now looking at.
        if (activeId.value !== roomId) {
            rooms.value = upsertRoom(rooms.value, result.room);
            return;
        }
        // The server's copy of the question carries the attachment ids and the
        // validated thumbnails, so it replaces the optimistic one.
        const at = messages.value.findIndex((m) => m.id === id);
        if (at >= 0 && result.user_message) messages.value[at] = result.user_message;
        messages.value.push(result.message);
        rooms.value = upsertRoom(rooms.value, result.room);
        contextPending.value = !!result.context_pending;
        if (contextOpen.value) loadContext();
    } catch (e) {
        const mine = messages.value.find((m) => m.id === id);
        const status = e instanceof ApiError ? (e.status || 0) : 0;
        if (status === 413 || status === 415 || (status === 400 && files.length)) {
            // The server refused a FILE; nothing was stored, so the message is
            // taken back out and its files returned to the composer.
            messages.value = messages.value.filter((m) => m.id !== id);
            userInput.value = content;
            pending.value = files;
            error.value = status === 413 ? t('That attachment is too large.')
                : status === 415 ? t('One of those files cannot be read here. Attach an image, a text or code file, a .docx or a PDF.')
                : t('That attachment could not be used.');
            return;
        }
        if (mine) mine.failed = true;
        if (files.length) retryFiles.set(id, files);
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
// Attachments
// ---------------------------------------------------------------------------

function readAsDataUrl(blob: Blob): Promise<string> {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result || ''));
        reader.onerror = () => reject(reader.error);
        reader.readAsDataURL(blob);
    });
}

function loadImage(url: string): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = () => reject(new Error('image'));
        img.src = url;
    });
}

function drawScaled(img: HTMLImageElement, max: number, type: string, quality: number): string {
    const size = fitWithin(img.naturalWidth, img.naturalHeight, max);
    const canvas = document.createElement('canvas');
    canvas.width = size.width;
    canvas.height = size.height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return '';
    if (type === 'image/jpeg') {
        // JPEG has no alpha: a transparent PNG would otherwise turn black.
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, size.width, size.height);
    }
    ctx.drawImage(img, 0, 0, size.width, size.height);
    return canvas.toDataURL(type, quality);
}

const base64Of = (dataUrl: string) => dataUrl.slice(dataUrl.indexOf(',') + 1);
const bytesOf = (b64: string) => Math.floor((b64.length * 3) / 4);

/** A photo is scaled to IMAGE_MAX_SIDE before it is sent; a GIF is left alone. */
async function prepareImage(file: File): Promise<PendingAttachment | null> {
    const url = await readAsDataUrl(file);
    let data = base64Of(url);
    let type = file.type === 'image/jpg' ? 'image/jpeg' : file.type;
    let thumb = '';
    try {
        const img = await loadImage(url);
        const big = Math.max(img.naturalWidth, img.naturalHeight) > IMAGE_MAX_SIDE;
        if (type !== 'image/gif' && (big || file.size > MAX_IMAGE_BYTES / 2)) {
            const scaled = drawScaled(img, IMAGE_MAX_SIDE, 'image/jpeg', 0.85);
            if (scaled) { data = base64Of(scaled); type = 'image/jpeg'; }
        }
        const small = drawScaled(img, THUMB_SIDE, 'image/jpeg', 0.7);
        if (isAcceptableThumb(small)) thumb = small;
    } catch { /* an image the browser cannot decode is sent as it is */ }
    const size = bytesOf(data);
    if (size > MAX_IMAGE_BYTES) return null;
    return { name: file.name, type, size, kind: 'image', data, ...(thumb ? { thumb } : {}) };
}

async function onFilesChosen(event: Event) {
    const input = event.target as HTMLInputElement;
    const files = Array.from(input.files || []);
    input.value = '';
    if (!files.length) return;
    error.value = '';
    preparing.value = true;
    try {
        for (const file of files) {
            const refusal = refusalFor(
                { name: file.name, type: file.type, size: kindOf(file.name, file.type) === 'image' ? 0 : file.size },
                pending.value);
            if (refusal) {
                error.value = refusal.reason === 'type'
                    ? t('"{v0}" cannot be read here. Attach an image, a text or code file, a .docx or a PDF.', { v0: refusal.name })
                    : refusal.reason === 'too_many' ? t('You can attach up to {v0} files to one message.', { v0: MAX_ATTACHMENTS })
                    : refusal.reason === 'one_image' ? t('Attach one image per message.')
                    : t('"{v0}" is too large.', { v0: refusal.name });
                continue;
            }
            if (kindOf(file.name, file.type) === 'image') {
                const img = await prepareImage(file);
                if (img) pending.value.push(img);
                else error.value = t('"{v0}" is too large.', { v0: file.name });
            } else {
                const data = base64Of(await readAsDataUrl(file));
                pending.value.push({ name: file.name, type: file.type, size: file.size, kind: 'file', data });
            }
        }
    } catch {
        error.value = t('That file could not be read.');
    } finally {
        preparing.value = false;
    }
}

function removePending(index: number) {
    pending.value.splice(index, 1);
}

// ---------------------------------------------------------------------------
// Voice input
// ---------------------------------------------------------------------------

function stopTracks() {
    recordStream?.getTracks().forEach((track) => track.stop());
    recordStream = null;
    if (recordTimer) { clearInterval(recordTimer); recordTimer = null; }
}

async function toggleRecording() {
    if (recording.value) {
        recorder?.stop();
        return;
    }
    error.value = '';
    try {
        recordStream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch {
        error.value = t('The microphone could not be used. Allow microphone access in your browser and try again.');
        return;
    }
    const MR = (window as any).MediaRecorder as typeof MediaRecorder;
    const type = pickRecordingType((x) => MR.isTypeSupported(x));
    recorder = type ? new MR(recordStream, { mimeType: type }) : new MR(recordStream);
    recordChunks = [];
    recorder.ondataavailable = (e: BlobEvent) => { if (e.data && e.data.size) recordChunks.push(e.data); };
    recorder.onstop = () => {
        recording.value = false;
        stopTracks();
        const blob = new Blob(recordChunks, { type: recorder?.mimeType || type || 'audio/webm' });
        recordChunks = [];
        recorder = null;
        transcribeRecording(blob);
    };
    recorder.start();
    recording.value = true;
    recordSeconds.value = 0;
    recordTimer = setInterval(() => {
        recordSeconds.value += 1;
        if (recordSeconds.value >= MAX_RECORDING_SECONDS) recorder?.stop();
    }, 1000);
}

async function transcribeRecording(blob: Blob) {
    if (!blob.size) return;
    if (blob.size > MAX_AUDIO_BYTES) {
        error.value = t('That recording is too long. Keep it under two minutes.');
        return;
    }
    transcribing.value = true;
    try {
        const ext = blob.type.includes('ogg') ? 'ogg' : blob.type.includes('mp4') ? 'm4a' : 'webm';
        const text = await aiChatService.transcribe(userId.value, blob, 'voice.' + ext);
        if (text) {
            // Into the box, never straight out: the reader corrects it first.
            userInput.value = insertDictation(userInput.value, text);
            nextTick(() => { adjustTextareaHeight(); textarea.value?.focus(); });
        } else {
            error.value = t('No speech was heard. Try again a little closer to the microphone.');
        }
    } catch {
        error.value = t('Your voice could not be turned into text. Please try again.');
    } finally {
        transcribing.value = false;
    }
}

onBeforeUnmount(() => {
    if (recorder && recorder.state !== 'inactive') {
        recorder.onstop = null;
        recorder.stop();
    }
    stopTracks();
});

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
