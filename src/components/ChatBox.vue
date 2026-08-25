<template>
  <div class="chat-wrapper">
    <!-- Chat Toggle Button -->
    <button
      class="chat-toggle-btn"
      :class="{ 'has-unread': unreadCount > 0 }"
      @click="toggleChat"
      :disabled="isReconnecting"
      :aria-label="$t('Open chat')"
    >
      <svg v-if="!isOpen" class="chat-icon" viewBox="0 0 24 24">
        <path fill="currentColor" d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm0 14H5.17L4 17.17V4h16v12z"/>
      </svg>
      <svg v-else class="chat-icon" viewBox="0 0 24 24">
        <path fill="currentColor" d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
      </svg>

      <!-- Unread Badge -->
      <span v-if="unreadCount > 0" class="unread-badge">
        {{ unreadCount > 99 ? '99+' : unreadCount }}
      </span>
    </button>

    <!-- Chat Window -->
    <transition name="slide-up">
      <div v-if="isOpen" class="chat-window" :class="{ minimized: isMinimized }">
        <!-- Header -->
        <div class="chat-header" @click="isMinimized = false">
          <div class="header-left">
            <div class="status-indicator" :class="{ online: isConnected, offline: !isConnected, reconnecting: isReconnecting }"></div>
            <h3>{{ $t('SelfStudy Support') }}</h3>
            <span v-if="isConnected" class="status-text">{{ $t('Online') }}</span>
            <span v-else-if="isReconnecting" class="status-text reconnecting-text">{{ $t('Reconnecting...') }}</span>
            <span v-else class="status-text offline-text">{{ $t('Offline') }}</span>
          </div>
          <div class="header-right">
            <button class="header-btn" @click.stop="isMinimized = !isMinimized" :aria-label="$t('Minimize chat')">
              <svg viewBox="0 0 24 24" width="16" height="16">
                <path fill="currentColor" d="M19 13H5v-2h14v2z"/>
              </svg>
            </button>
            <button class="header-btn" @click.stop="closeChat" :aria-label="$t('Close chat')">
              <svg viewBox="0 0 24 24" width="16" height="16">
                <path fill="currentColor" d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
              </svg>
            </button>
          </div>
        </div>

        <!-- Chat Content (Only show when not minimized) -->
        <div v-if="!isMinimized" class="chat-content">
          <!-- Messages Container -->
          <div ref="messagesContainer" class="messages-container">
            <!-- Loading State -->
            <div v-if="isLoading" class="loading-messages">
              <div class="loading-spinner"></div>
              <p>{{ $t('Connecting to chat...') }}</p>
            </div>

            <!-- Error State -->
            <div v-if="error && !isReconnecting" class="error-state">
              <svg viewBox="0 0 24 24" width="48" height="48">
                <path fill="#f56565" d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/>
              </svg>
              <p>{{ error }}</p>
              <button @click="reconnect" class="retry-btn" :disabled="isReconnecting">
                {{ isReconnecting ? 'Reconnecting...' : 'Retry Connection' }}
              </button>
            </div>

            <!-- Welcome Message -->
            <div v-if="!isLoading && !error && messages.length === 0 && chatInitialized" class="welcome-message">
              <div class="welcome-icon">💬</div>
              <h4>{{ $t('Welcome to SelfStudy Support') }}</h4>
              <p>{{ $t('We\'re here to help! Ask us anything about courses, progress, or technical issues.') }}</p>
              <p class="response-time">{{ $t('Typical response time: 2-5 minutes') }}</p>
            </div>

            <!-- Messages List -->
            <div v-if="!isLoading && !error && chatInitialized && messages.length > 0" class="messages-list">
              <div
                v-for="message in messages"
                :key="message.id"
                class="message"
                :class="{
                  'message-incoming': message.sender !== 'anonymous',
                  'message-outgoing': message.sender === 'anonymous',
                  'unread': message.is_unread
                }"
              >
                <div class="message-bubble">
                  <div class="message-sender">
                    <span v-if="message.sender === 'system'" class="sender-system">{{ $t('🤖 System') }}</span>
                    <span v-else-if="message.sender === 'admin'" class="sender-admin">{{ $t('👨‍🏫 Support') }}</span>
                    <span v-else class="sender-user">{{ $t('You') }}</span>
                  </div>
                  <!--
                    Support replies are where a link matters most: an operator
                    answering a question almost always sends one. `on-fill`
                    because the visitor's own messages sit on the accent
                    gradient, where the surface-derived link ink would be
                    unreadable — the fill decides the ink, not the page.
                  -->
                  <RichText
                    tag="div"
                    class="message-text"
                    :text="message.message"
                    :on-fill="message.sender === 'anonymous'"
                    :mentions="false"
                  />
                  <div class="message-time">
                    {{ formatTime(message.timestamp) }}
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- Input Area -->
          <div v-if="chatInitialized && !error && isConnected" class="chat-input-area">
            <form @submit.prevent="sendMessage" class="input-form">
              <textarea
                ref="messageInput"
                v-model="newMessage"
                @keydown.enter.exact.prevent="sendMessage"
                @keydown.enter.shift.exact="newMessage += '\n'"
                :disabled="isLoading || !isConnected"
                placeholder="Type your message here..."
                rows="1"
                class="message-input"
                aria-label="Type your message"
              ></textarea>
              <button
                type="submit"
                :disabled="!newMessage.trim() || isLoading || !isConnected"
                class="send-btn"
                :aria-label="$t('Send message')"
              >
                <svg viewBox="0 0 24 24" width="20" height="20">
                  <path fill="currentColor" d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/>
                </svg>
              </button>
            </form>
            <p class="input-hint">{{ $t('Press Enter to send, Shift+Enter for new line') }}</p>
          </div>
        </div>

        <!-- Minimized State -->
        <div v-else class="chat-minimized">
          <div class="minimized-content">
            <div class="status-indicator" :class="{ online: isConnected, offline: !isConnected, reconnecting: isReconnecting }"></div>
            <span class="minimized-text">{{ $t('SelfStudy Support') }}</span>
            <span v-if="unreadCount > 0" class="minimized-badge">
              {{ unreadCount }}
            </span>
          </div>
        </div>
      </div>
    </transition>

    <!-- Audio element for notifications -->
    <audio ref="notificationAudio" preload="auto">
      <source :src="audioSrc" type="audio/mpeg">
    </audio>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch, nextTick } from 'vue';
import RichText from '@/components/RichText.vue';
import {
  getUserIP,
  getChatRoom,
  sendMessage as sendChatMessage,
  getMessages,
  startMessagePolling,
  calculateUnreadCount,
  markAdminMessagesAsSeen
} from '@/services/chat.service';

interface Props {
  autoOpen?: boolean;
  maxRetries?: number;
}

const props = withDefaults(defineProps<Props>(), {
  autoOpen: false,
  maxRetries: 3
});

// State
const isOpen = ref(false);
const isMinimized = ref(false);
const isLoading = ref(false);
const isConnected = ref(false);
const isReconnecting = ref(false);
const chatInitialized = ref(false);
const userIP = ref('');
const currentRoom = ref<any>(null);
const currentReplicaUrl = ref('');
const messages = ref<any[]>([]);
const newMessage = ref('');
const error = ref<string | null>(null);
const lastSeenMessageId = ref<number | null>(null);
/**
 * The newest operator message this widget has ever been shown, as a timestamp.
 * Forward only, and `null` until the first poll has seeded it.
 *
 * It is what makes the chime mean "a reply arrived" rather than "the set of ids
 * differs from the set I had a moment ago" — the second is also true when the
 * widget fails over to a replica that has not received the last reply, and again
 * when it fails back. See the polling callback.
 */
const heardUpTo = ref<string | null>(null);
const retryCount = ref(0);
const retryTimeout = ref<number | null>(null);

// Refs
const messagesContainer = ref<HTMLElement | null>(null);
const messageInput = ref<HTMLTextAreaElement | null>(null);
const notificationAudio = ref<HTMLAudioElement | null>(null);

// Audio
const audioSrc = new URL('@/assets/audio/selfstudy_newmessage.mp3', import.meta.url).href;

// Computed
const unreadCount = computed(() => {
  return messages.value.filter(msg => msg.is_unread).length;
});

// Methods
async function initChat(attempt = 0) {
  if (isLoading.value || isReconnecting.value) return;

  isLoading.value = true;
  error.value = null;

  try {
    userIP.value = await getUserIP();
    const { room, replicaUrl } = await getChatRoom(userIP.value);
    currentRoom.value = room;
    currentReplicaUrl.value = replicaUrl;
    isConnected.value = true;
    chatInitialized.value = true;
    retryCount.value = 0;

    const initialMessages = await getMessages(replicaUrl, room.id);
    messages.value = initialMessages;
    // Seed the chime's mark from the history, before polling starts. Everything
    // already in the conversation has been seen by definition; leaving it unset
    // makes the first poll read the whole transcript as newly arrived.
    heardUpTo.value = initialMessages.reduce(
      (high: string, msg: any) => (msg.sender !== 'anonymous'
        && String(msg.timestamp || '') > high ? String(msg.timestamp || '') : high), '');

    await markAdminMessagesAsSeen(replicaUrl, room.id);

    startPolling();

    if (props.autoOpen) {
      isOpen.value = true;
    }
  } catch (err: any) {
    console.error('Chat initialization error:', err);
    error.value = err.message || 'Failed to connect to chat service';
    chatInitialized.value = false;
    isConnected.value = false;

    if (attempt < props.maxRetries) {
      isReconnecting.value = true;
      const delay = Math.min(1000 * Math.pow(2, attempt), 10000);
      retryTimeout.value = window.setTimeout(() => {
        initChat(attempt + 1);
      }, delay);
    } else {
      error.value = 'Unable to connect after multiple attempts. Please refresh the page or try again later.';
      isReconnecting.value = false;
    }
  } finally {
    if (!isReconnecting.value) {
      isLoading.value = false;
    }
  }
}

function startPolling() {
  if (!currentRoom.value || !currentReplicaUrl.value) return;

  if ((window as any).chatPolling) {
    clearInterval((window as any).chatPolling);
  }

  const polling = startMessagePolling(
    currentReplicaUrl.value,
    currentRoom.value.id,
    async (newMessages) => {
      const previousMessages = [...messages.value];
      messages.value = newMessages;

      const previousIds = new Set(previousMessages.map(m => m.id));
      const incoming = newMessages.filter(
        msg => !previousIds.has(msg.id) && msg.sender !== 'anonymous'
      );

      // Two guards, and without them this rings at nothing rather regularly.
      //
      // `heardUpTo` is the newest operator message this widget has ever been
      // shown, and it only moves forward. "New to the previous poll's set" is not
      // the same as new: the widget pins one replica but fails over, and app 9
      // replicates push-then-repair — so a poll can legitimately come back missing
      // the last reply and the one after it re-offers it. Every one of those
      // bounces used to chime.
      //
      // And the first callback for a room seeds the mark **silently**, because at
      // that point the previous set is empty and the whole conversation reads as
      // having just arrived: a chime per historical reply, on opening the widget.
      const newestReply = newMessages.reduce(
        (high, msg) => (msg.sender !== 'anonymous' && String(msg.timestamp || '') > high
          ? String(msg.timestamp || '') : high), '');
      const seeded = heardUpTo.value !== null;
      const arrived = seeded && incoming.length > 0
        && newestReply > (heardUpTo.value as string);
      if (!seeded || newestReply > (heardUpTo.value as string)) {
        heardUpTo.value = newestReply;
      }

      if (arrived) playNotificationSound();
      if (incoming.length > 0 && isOpen.value && !isMinimized.value) {
        await markAdminMessagesAsSeen(currentReplicaUrl.value, currentRoom.value.id);
      }

      scrollToBottom();
    },
    5000
  );

  (window as any).chatPolling = polling;
}

async function sendMessage() {
  if (!chatInitialized.value || !currentReplicaUrl.value || !userIP.value || !isConnected.value) {
    error.value = 'Chat not initialized. Please try reconnecting.';
    return;
  }

  const message = newMessage.value.trim();
  if (!message) return;

  const tempMessage = {
    id: Date.now(),
    sender: 'anonymous' as const,
    message,
    timestamp: new Date().toISOString(),
    is_seen: true,
    is_unread: false
  };

  messages.value.push(tempMessage);
  newMessage.value = '';

  if (messageInput.value) {
    messageInput.value.style.height = 'auto';
  }

  try {
    await sendChatMessage(currentReplicaUrl.value, userIP.value, message);
    messages.value = messages.value.filter(m => m.id !== tempMessage.id);
    const updatedMessages = await getMessages(currentReplicaUrl.value, currentRoom.value.id);
    messages.value = updatedMessages;
    scrollToBottom();
  } catch (err) {
    console.error('Failed to send message:', err);
    tempMessage.message = `${message} (Failed to send)`;
    error.value = 'Failed to send message. Please try again.';
  }
}

function toggleChat() {
  if (isOpen.value) {
    closeChat();
  } else {
    openChat();
  }
}

function openChat() {
  isOpen.value = true;
  isMinimized.value = false;

  if (messagesContainer.value) {
    setTimeout(() => {
      scrollToBottom();
    }, 100);
  }

  if (currentRoom.value && currentReplicaUrl.value) {
    markAdminMessagesAsSeen(currentReplicaUrl.value, currentRoom.value.id);
  }

  nextTick(() => {
    if (messageInput.value) {
      messageInput.value.focus();
    }
  });
}

function closeChat() {
  isOpen.value = false;
  isMinimized.value = false;
}

function scrollToBottom() {
  nextTick(() => {
    if (messagesContainer.value) {
      messagesContainer.value.scrollTop = messagesContainer.value.scrollHeight;
    }
  });
}

function formatTime(timestamp: string) {
  const date = new Date(timestamp);
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function playNotificationSound() {
  if (notificationAudio.value) {
    notificationAudio.value.currentTime = 0;
    notificationAudio.value.play().catch(e => console.warn('Audio play failed:', e));
  }
}

function reconnect() {
  if (isReconnecting.value) return;
  if (retryTimeout.value) {
    clearTimeout(retryTimeout.value);
    retryTimeout.value = null;
  }
  retryCount.value = 0;
  isReconnecting.value = false;
  error.value = null;
  initChat(0);
}

watch(newMessage, () => {
  nextTick(() => {
    if (messageInput.value) {
      messageInput.value.style.height = 'auto';
      messageInput.value.style.height = Math.min(messageInput.value.scrollHeight, 120) + 'px';
    }
  });
});

watch(isConnected, (connected) => {
  if (!connected && chatInitialized.value && !isReconnecting.value) {
    isReconnecting.value = true;
    retryCount.value = 0;
    reconnect();
  }
});

onMounted(() => {
  initChat();
});

onUnmounted(() => {
  if ((window as any).chatPolling) {
    clearInterval((window as any).chatPolling);
  }
  if (retryTimeout.value) {
    clearTimeout(retryTimeout.value);
  }
});
</script>


<style scoped>
/* ==========================================================================
   ChatBox — Galaxy Glassmorphism Edition
   - Coexists with: src/style.css + AnimatedBackground.vue + side-nav.css + default-layout.css
   - LOCKED dark-glass surface, brand gradient (#667eea → #764ba2)
   - Readable on top of the animated 3D galaxy
   - Mobile-first, fluid breakpoints: 480 / 768 / 1024 / 1440 / 1920 / 2560
   - No logic / template changes
   ========================================================================== */

*,
*::before,
*::after { box-sizing: border-box; }

/* ==========================================================================
   DESIGN TOKENS — locked, identical across every device
   ========================================================================== */
.chat-wrapper {
  /* brand (aligned with style.css :root --chat-primary) */
  --cb-primary:        var(--sfs-accent-text, #667eea);
  --cb-primary-dark:   var(--sfs-accent-text, #5a67d8);
  --cb-secondary:      var(--sfs-accent-2, #764ba2);
  --cb-accent:         var(--sfs-accent-text, #818cf8);
  --cb-gradient:       linear-gradient(135deg, var(--sfs-accent, #667eea) 0%, var(--sfs-accent-2, #764ba2) 100%);
  --cb-gradient-hover: linear-gradient(135deg, var(--sfs-accent, #5a67d8) 0%, var(--sfs-accent-2, #6b46c1) 100%);

  /* glass surfaces — translucent so galaxy bleeds through */
  --cb-glass-1:        rgb(var(--sfs-surface-rgb, 15 17 40) / 0.62);   /* window */
  --cb-glass-2:        rgb(var(--sfs-shade-rgb, 15 17 40) / 0.42);   /* messages area */
  --cb-glass-3:        rgb(var(--sfs-tint-rgb, 255 255 255) / 0.06); /* input field */
  --cb-glass-3-focus:  rgb(var(--sfs-tint-rgb, 255 255 255) / 0.1);
  --cb-bubble-in:      rgb(var(--sfs-tint-rgb, 255 255 255) / 0.07);
  --cb-border:         rgb(var(--sfs-line-rgb, 255 255 255) / 0.1);
  --cb-border-strong:  rgb(var(--sfs-line-rgb, 255 255 255) / 0.2);

  /* blurs */
  --cb-blur:           blur(22px) saturate(160%);
  --cb-blur-soft:      blur(14px) saturate(140%);

  /* text — light on dark glass */
  --cb-text:           var(--sfs-text, #f1f3f9);
  --cb-text-muted:     rgb(var(--sfs-text-rgb, 241 243 249) / 0.78);
  --cb-text-subtle:    rgb(var(--sfs-text-rgb, 241 243 249) / 0.55);
  --cb-text-on-primary:var(--sfs-text, #ffffff);

  /* status */
  --cb-success:        var(--sfs-success, #48bb78);
  --cb-warning:        var(--sfs-warning-text, #ed8936);
  --cb-danger:         var(--sfs-danger-text, #fc8181);
  --cb-danger-soft:    var(--sfs-danger-text, #fed7d7);

  /* shadows / glow */
  --cb-shadow-sm:      0 4px 14px rgba(0, 0, 0, 0.28);
  --cb-shadow-md:      0 10px 32px rgba(0, 0, 0, 0.4);
  --cb-shadow-lg:      0 24px 60px rgba(0, 0, 0, 0.55),
                        0 8px 32px rgb(var(--sfs-accent-rgb, 102 126 234) / 0.18);
  --cb-shadow-brand:   0 10px 30px rgb(var(--sfs-accent-rgb, 102 126 234) / 0.45);
  --cb-glow:           0 0 24px rgb(var(--sfs-accent-rgb, 129 140 248) / 0.35);

  /* radii */
  --cb-r-sm:           10px;
  --cb-r-md:           14px;
  --cb-r-lg:           20px;
  --cb-r-xl:           24px;
  --cb-r-full:         999px;

  /* layout */
  position: fixed;
  bottom: clamp(0.75rem, 1.6vw, 1.75rem);
  right:  clamp(0.75rem, 1.6vw, 1.75rem);
  z-index: 9999;
  font-size: clamp(13px, 0.78rem + 0.25vw, 16px);
  font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  color: var(--cb-text);
  color-scheme: only dark;
  pointer-events: auto;
}

/* ==========================================================================
   TOGGLE BUTTON (gradient FAB)
   ========================================================================== */
.chat-toggle-btn {
  position: relative;
  width: 3.75rem;
  height: 3.75rem;
  min-width: 44px;
  min-height: 44px;
  border-radius: var(--cb-r-full);
  background: var(--cb-gradient);
  border: 1px solid rgb(var(--sfs-line-rgb, 255 255 255) / 0.18);
  color: var(--cb-text-on-primary);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: var(--cb-shadow-brand),
              inset 0 1px 0 rgba(255, 255, 255, 0.25);
  transition: transform 0.25s cubic-bezier(0.34, 1.56, 0.64, 1),
              box-shadow 0.25s ease,
              background 0.25s ease;
  z-index: 10000;
}
.chat-toggle-btn:hover {
  transform: translateY(-3px) scale(1.05);
  background: var(--cb-gradient-hover);
  box-shadow: 0 14px 35px rgb(var(--sfs-accent-rgb, 102 126 234) / 0.6),
              inset 0 1px 0 rgba(255, 255, 255, 0.3);
}
.chat-toggle-btn:active { transform: scale(0.96); }
.chat-toggle-btn:disabled { opacity: 0.6; cursor: not-allowed; }
.chat-toggle-btn.has-unread { animation: pulse-ring 2s infinite; }

.chat-icon { width: 1.5rem; height: 1.5rem; }

.unread-badge {
  position: absolute;
  top: -0.35rem;
  right: -0.35rem;
  background: linear-gradient(135deg, var(--sfs-danger, #fc8181), var(--sfs-danger, #f56565));
  color: var(--sfs-on-danger, #fff);
  font-size: 0.7rem;
  font-weight: 700;
  min-width: 1.35rem;
  height: 1.35rem;
  border-radius: var(--cb-r-full);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0 0.4rem;
  border: 2px solid rgb(var(--sfs-line-rgb, 255 255 255) / 0.85);
  box-shadow: 0 2px 10px rgb(var(--sfs-danger-rgb, 245 101 101) / 0.6);
  animation: bounce-in 0.45s cubic-bezier(0.34, 1.56, 0.64, 1);
}

/* ==========================================================================
   CHAT WINDOW — glass panel
   ========================================================================== */
.chat-window {
  position: absolute;
  bottom: 5rem;
  right: 0;
  width: clamp(20rem, 28vw, 25rem);
  max-width: calc(100vw - 1.5rem);
  height: 34rem;
  max-height: min(75vh, 75dvh);
  background: var(--cb-glass-1);
  -webkit-backdrop-filter: var(--cb-blur);
  backdrop-filter: var(--cb-blur);
  color: var(--cb-text);
  border-radius: var(--cb-r-xl);
  border: 1px solid var(--cb-border);
  box-shadow: var(--cb-shadow-lg);
  display: flex;
  flex-direction: column;
  overflow: hidden;
  z-index: 9999;
  isolation: isolate;
}
.chat-window.minimized { height: 3.75rem; }

/* ==========================================================================
   HEADER (brand gradient bar)
   ========================================================================== */
.chat-header {
  background: var(--cb-gradient);
  color: var(--cb-text-on-primary);
  padding: 0.9rem 1.1rem;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
  cursor: pointer;
  user-select: none;
  flex-shrink: 0;
  position: relative;
  overflow: hidden;
  border-bottom: 1px solid rgb(var(--sfs-line-rgb, 255 255 255) / 0.18);
}
.chat-header::before {
  content: '';
  position: absolute; inset: 0;
  background:
    radial-gradient(circle at 20% 30%, rgb(var(--sfs-tint-rgb, 255 255 255) / 0.18), transparent 55%),
    radial-gradient(circle at 90% 90%, rgb(var(--sfs-tint-rgb, 255 255 255) / 0.08), transparent 50%);
  pointer-events: none;
}

.header-left {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  min-width: 0;
  flex: 1;
}

.status-indicator {
  width: 0.6rem;
  height: 0.6rem;
  border-radius: 50%;
  background: var(--cb-success);
  flex-shrink: 0;
  box-shadow: 0 0 0 3px rgb(var(--sfs-success-rgb, 72 187 120) / 0.3);
}
.status-indicator.online {
  background: var(--cb-success);
  animation: pulse-dot 2s infinite;
}
.status-indicator.offline {
  background: var(--sfs-accent, #a0aec0);
  box-shadow: 0 0 0 3px rgb(var(--sfs-accent-rgb, 160 174 192) / 0.25);
}
.status-indicator.reconnecting {
  background: var(--cb-warning);
  animation: pulse-dot 1.2s infinite;
  box-shadow: 0 0 0 3px rgb(var(--sfs-warning-rgb, 237 137 54) / 0.3);
}

.chat-header h3 {
  margin: 0;
  font-size: 0.95rem;
  font-weight: 600;
  color: var(--sfs-text, #fff);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  letter-spacing: 0.01em;
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.25);
}
.status-text {
  font-size: 0.72rem;
  opacity: 0.95;
  color: rgb(var(--sfs-text-rgb, 255 255 255) / 0.92);
  white-space: nowrap;
}
.status-text.offline-text     { color: var(--cb-danger-soft); }
.status-text.reconnecting-text{ color: var(--sfs-warning-text, #ffe4c4); }

.header-right { display: flex; gap: 0.4rem; flex-shrink: 0; }

.header-btn {
  background: rgb(var(--sfs-tint-rgb, 255 255 255) / 0.18);
  border: 1px solid rgb(var(--sfs-line-rgb, 255 255 255) / 0.22);
  color: var(--sfs-text, #fff);
  width: 2rem;
  height: 2rem;
  min-width: 32px;
  border-radius: var(--cb-r-sm);
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: background 0.2s ease, transform 0.15s ease, border-color 0.2s ease;
  -webkit-backdrop-filter: blur(6px);
  backdrop-filter: blur(6px);
}
.header-btn:hover {
  background: rgb(var(--sfs-tint-rgb, 255 255 255) / 0.32);
  border-color: rgb(var(--sfs-line-rgb, 255 255 255) / 0.4);
  transform: translateY(-1px);
}
.header-btn svg { width: 1rem; height: 1rem; }

/* ==========================================================================
   CONTENT — glass messages area
   ========================================================================== */
.chat-content {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  background: var(--cb-glass-2);
}

.messages-container {
  flex: 1;
  overflow-y: auto;
  overflow-x: hidden;
  padding: 1.1rem;
  background: transparent;
  color: var(--cb-text);
  scroll-behavior: smooth;
}
.messages-container::-webkit-scrollbar { width: 6px; }
.messages-container::-webkit-scrollbar-track { background: transparent; }
.messages-container::-webkit-scrollbar-thumb {
  background: linear-gradient(180deg, var(--sfs-accent, #667eea), var(--sfs-accent-2, #764ba2));
  border-radius: var(--cb-r-full);
}
.messages-container::-webkit-scrollbar-thumb:hover { background: var(--cb-accent); }

/* ==========================================================================
   LOADING / ERROR / WELCOME
   ========================================================================== */
.loading-messages {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100%;
  gap: 0.9rem;
}
.loading-messages p {
  color: var(--cb-text-muted);
  font-size: 0.875rem;
  margin: 0;
}
.loading-spinner {
  width: 2.5rem;
  height: 2.5rem;
  border: 3px solid var(--cb-border-strong);
  border-top-color: var(--cb-accent);
  border-radius: 50%;
  animation: spin 0.9s linear infinite;
  box-shadow: 0 0 18px rgb(var(--sfs-accent-rgb, 129 140 248) / 0.25);
}

.error-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100%;
  text-align: center;
  gap: 0.9rem;
  padding: 1.25rem;
}
.error-state svg { width: 3rem; height: 3rem; filter: drop-shadow(0 0 12px rgb(var(--sfs-danger-rgb, 245 101 101) / 0.5)); }
.error-state p { color: var(--cb-text-muted); line-height: 1.5; font-size: 0.875rem; margin: 0; }

.retry-btn {
  background: var(--cb-gradient);
  color: var(--sfs-on-accent, #fff);
  border: 1px solid rgb(var(--sfs-line-rgb, 255 255 255) / 0.18);
  padding: 0.65rem 1.35rem;
  border-radius: var(--cb-r-md);
  cursor: pointer;
  font-weight: 600;
  font-size: 0.875rem;
  transition: transform 0.2s ease, box-shadow 0.2s ease, background 0.2s ease;
  box-shadow: var(--cb-shadow-brand),
              inset 0 1px 0 rgba(255, 255, 255, 0.2);
  min-height: 44px;
}
.retry-btn:hover:not(:disabled) {
  transform: translateY(-2px);
  background: var(--cb-gradient-hover);
  box-shadow: 0 12px 32px rgb(var(--sfs-accent-rgb, 102 126 234) / 0.5),
              inset 0 1px 0 rgba(255, 255, 255, 0.25);
}
.retry-btn:disabled { opacity: 0.6; cursor: not-allowed; }

.welcome-message {
  text-align: center;
  padding: 1.75rem 1.25rem;
  background: rgb(var(--sfs-tint-rgb, 255 255 255) / 0.05);
  -webkit-backdrop-filter: blur(12px);
  backdrop-filter: blur(12px);
  color: var(--cb-text);
  border-radius: var(--cb-r-lg);
  box-shadow: var(--cb-shadow-sm), 0 0 24px rgb(var(--sfs-accent-rgb, 102 126 234) / 0.1);
  border: 1px solid var(--cb-border);
}
.welcome-icon {
  font-size: 2.75rem;
  margin-bottom: 0.75rem;
  display: inline-block;
  animation: float 3s ease-in-out infinite;
  filter: drop-shadow(0 4px 14px rgb(var(--sfs-accent-rgb, 129 140 248) / 0.35));
}
.welcome-message h4 {
  margin: 0 0 0.5rem 0;
  color: var(--cb-text);
  font-size: 1.05rem;
  font-weight: 700;
  background: linear-gradient(135deg, var(--sfs-text, #ffffff) 0%, var(--sfs-text-muted, #c7d2fe) 100%);
  -webkit-background-clip: text;
  background-clip: text;
  -webkit-text-fill-color: transparent;
}
.welcome-message p {
  margin: 0.4rem 0;
  color: var(--cb-text-muted);
  line-height: 1.5;
  font-size: 0.85rem;
}
.response-time {
  font-size: 0.78rem !important;
  color: var(--cb-text-subtle) !important;
  font-style: italic;
  margin-top: 0.75rem !important;
}

/* ==========================================================================
   MESSAGE LIST / BUBBLES
   ========================================================================== */
.messages-list {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}
.message {
  display: flex;
  animation: slideInMsg 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
}
.message-outgoing { justify-content: flex-end; }
.message-incoming { justify-content: flex-start; }

.message.unread .message-bubble {
  box-shadow: 0 0 0 2px var(--cb-accent),
              0 4px 14px rgba(0, 0, 0, 0.28),
              0 0 22px rgb(var(--sfs-accent-rgb, 129 140 248) / 0.35);
}

.message-bubble {
  max-width: 82%;
  min-width: 0;
  background: var(--cb-bubble-in);
  -webkit-backdrop-filter: blur(10px);
  backdrop-filter: blur(10px);
  color: var(--cb-text);
  border-radius: var(--cb-r-lg);
  padding: 0.65rem 0.9rem;
  box-shadow: var(--cb-shadow-sm);
  position: relative;
  word-wrap: break-word;
  overflow-wrap: anywhere;
  border: 1px solid var(--cb-border);
}

.message-outgoing .message-bubble {
  background: var(--cb-gradient);
  color: var(--cb-text-on-primary);
  border-end-end-radius: 0.35rem;
  border-color: rgb(var(--sfs-line-rgb, 255 255 255) / 0.2);
  box-shadow: 0 6px 22px rgb(var(--sfs-accent-rgb, 102 126 234) / 0.35),
              inset 0 1px 0 rgba(255, 255, 255, 0.18);
}
.message-incoming .message-bubble {
  border-end-start-radius: 0.35rem;
}

.message-sender {
  font-size: 0.7rem;
  font-weight: 600;
  margin-bottom: 0.25rem;
  opacity: 0.9;
}
.message-outgoing .message-sender { color: rgb(var(--sfs-text-rgb, 255 255 255) / 0.95); }
.message-incoming .message-sender { color: var(--cb-text-muted); }
.sender-system { color: var(--sfs-success-text, #68d391) !important; }
.sender-admin  { color: var(--sfs-text-muted, #a3bffa) !important; }
.message-outgoing .sender-user { color: rgb(var(--sfs-text-rgb, 255 255 255) / 0.95); }

.message-text {
  word-wrap: break-word;
  overflow-wrap: anywhere;
  line-height: 1.45;
  font-size: 0.88rem;
  color: inherit;
  white-space: pre-wrap;
}
.message-time {
  font-size: 0.65rem;
  margin-top: 0.25rem;
  opacity: 0.75;
  text-align: end;
  color: inherit;
}

/* ==========================================================================
   INPUT AREA — glass, locked colors (no UA overrides)
   ========================================================================== */
.chat-input-area {
  border-top: 1px solid var(--cb-border);
  padding: 0.85rem 1rem;
  background: var(--cb-glass-1);
  -webkit-backdrop-filter: var(--cb-blur-soft);
  backdrop-filter: var(--cb-blur-soft);
  flex-shrink: 0;
}
.input-form {
  display: flex;
  gap: 0.6rem;
  align-items: flex-end;
}

.message-input {
  flex: 1;
  min-width: 0;
  background-color: var(--cb-glass-3) !important;
  background-image: none !important;
  color: var(--cb-text) !important;
  -webkit-text-fill-color: var(--cb-text) !important;
  caret-color: var(--cb-accent);
  border: 1px solid var(--cb-border-strong);
  border-radius: var(--cb-r-md);
  padding: 0.7rem 0.9rem;
  font-size: 0.9rem;
  font-family: inherit;
  resize: none;
  max-height: 7.5rem;
  min-height: 2.75rem;
  line-height: 1.45;
  transition: border-color 0.2s ease,
              box-shadow 0.2s ease,
              background-color 0.2s ease;
  outline: none;
  -webkit-appearance: none;
  appearance: none;
  -webkit-backdrop-filter: blur(6px);
  backdrop-filter: blur(6px);
}
.message-input::placeholder {
  color: var(--cb-text-subtle) !important;
  -webkit-text-fill-color: var(--cb-text-subtle) !important;
  opacity: 1;
}
.message-input:focus {
  border-color: var(--cb-accent);
  background-color: var(--cb-glass-3-focus) !important;
  color: var(--cb-text) !important;
  -webkit-text-fill-color: var(--cb-text) !important;
  box-shadow: 0 0 0 3px rgb(var(--sfs-accent-rgb, 129 140 248) / 0.28),
              0 0 18px rgb(var(--sfs-accent-rgb, 102 126 234) / 0.2);
}
.message-input:disabled {
  background-color: rgb(var(--sfs-tint-rgb, 255 255 255) / 0.03) !important;
  color: var(--cb-text-subtle) !important;
  -webkit-text-fill-color: var(--cb-text-subtle) !important;
  cursor: not-allowed;
  opacity: 0.7;
}
.message-input:-webkit-autofill,
.message-input:-webkit-autofill:hover,
.message-input:-webkit-autofill:focus {
  -webkit-box-shadow: 0 0 0 1000px rgba(15, 17, 40, 0.85) inset !important;
  -webkit-text-fill-color: var(--cb-text) !important;
  caret-color: var(--cb-accent);
  transition: background-color 5000s ease-in-out 0s;
}

.send-btn {
  width: 2.75rem;
  height: 2.75rem;
  min-width: 2.75rem;
  border-radius: var(--cb-r-md);
  background: var(--cb-gradient);
  border: 1px solid rgb(var(--sfs-line-rgb, 255 255 255) / 0.18);
  color: var(--sfs-on-accent, #fff);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  transition: transform 0.2s ease, box-shadow 0.2s ease, background 0.2s ease;
  box-shadow: var(--cb-shadow-brand),
              inset 0 1px 0 rgba(255, 255, 255, 0.22);
}
.send-btn svg { width: 1.2rem; height: 1.2rem; }
.send-btn:hover:not(:disabled) {
  transform: translateY(-2px);
  background: var(--cb-gradient-hover);
  box-shadow: 0 10px 26px rgb(var(--sfs-accent-rgb, 102 126 234) / 0.55),
              inset 0 1px 0 rgba(255, 255, 255, 0.25);
}
.send-btn:active:not(:disabled) { transform: translateY(0); }
.send-btn:disabled { opacity: 0.5; cursor: not-allowed; box-shadow: none; }

.input-hint {
  font-size: 0.68rem;
  color: var(--cb-text-subtle);
  margin: 0.5rem 0 0 0;
  text-align: center;
}

/* ==========================================================================
   MINIMIZED BAR
   ========================================================================== */
.chat-minimized {
  height: 100%;
  display: flex;
  align-items: center;
  padding: 0 1.1rem;
  background: var(--cb-gradient);
  color: var(--sfs-on-accent, #fff);
  cursor: pointer;
  position: relative;
  overflow: hidden;
}
.chat-minimized::before {
  content: '';
  position: absolute; inset: 0;
  background: radial-gradient(circle at 20% 50%, rgb(var(--sfs-tint-rgb, 255 255 255) / 0.14), transparent 55%);
  pointer-events: none;
}
.minimized-content {
  display: flex;
  align-items: center;
  gap: 0.7rem;
  width: 100%;
  position: relative;
  z-index: 1;
}
.minimized-text {
  font-size: 0.88rem;
  font-weight: 600;
  flex: 1;
  color: var(--sfs-text, #fff);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.25);
}
.minimized-badge {
  background: linear-gradient(135deg, var(--sfs-danger, #fc8181), var(--sfs-danger, #f56565));
  color: var(--sfs-on-danger, #fff);
  font-size: 0.7rem;
  font-weight: 700;
  min-width: 1.3rem;
  height: 1.3rem;
  border-radius: var(--cb-r-full);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0 0.4rem;
  border: 1px solid rgb(var(--sfs-line-rgb, 255 255 255) / 0.4);
  box-shadow: 0 2px 8px rgb(var(--sfs-danger-rgb, 245 101 101) / 0.5);
}

/* ==========================================================================
   ANIMATIONS
   ========================================================================== */
.slide-up-enter-active,
.slide-up-leave-active {
  transition: transform 0.35s cubic-bezier(0.34, 1.56, 0.64, 1),
              opacity 0.3s ease;
}
.slide-up-enter-from,
.slide-up-leave-to {
  opacity: 0;
  transform: translateY(1.25rem) scale(0.95);
}

@keyframes pulse-dot {
  0%, 100% { opacity: 1; transform: scale(1); }
  50%      { opacity: 0.7; transform: scale(1.15); }
}
@keyframes pulse-ring {
  0%, 100% { box-shadow: var(--cb-shadow-brand), inset 0 1px 0 rgba(255, 255, 255, 0.25); }
  50%      { box-shadow: 0 0 0 14px rgb(var(--sfs-accent-rgb, 102 126 234) / 0),
                          inset 0 1px 0 rgba(255, 255, 255, 0.25); }
}
@keyframes bounce-in {
  0%   { transform: scale(0); }
  60%  { transform: scale(1.2); }
  100% { transform: scale(1); }
}
@keyframes spin { to { transform: rotate(360deg); } }
@keyframes slideInMsg {
  from { opacity: 0; transform: translateY(8px); }
  to   { opacity: 1; transform: translateY(0); }
}
@keyframes float {
  0%, 100% { transform: translateY(0); }
  50%      { transform: translateY(-6px); }
}

/* ==========================================================================
   RESPONSIVE — mobile-first, consolidated
   480 → 768 → 1024 → 1440 → 1920 → 2560
   ========================================================================== */

/* Base = micro phones (≤ 360px) is already covered by clamp() + max-width */

@media (max-width: 380px) {
  .chat-toggle-btn { width: 3.2rem; height: 3.2rem; }
  .chat-window {
    width: calc(100vw - 1rem);
    right: -0.25rem;
    bottom: 4.25rem;
    height: auto;
    min-height: 22rem;
    max-height: 78vh;
    max-height: 78dvh;
    border-radius: var(--cb-r-lg);
  }
  .status-text { display: none; }
  .input-hint  { display: none; }
  .messages-container { padding: 0.75rem; }
  .chat-input-area    { padding: 0.65rem 0.75rem; }
  .message-bubble     { max-width: 90%; }
}

@media (min-width: 380px) and (max-width: 480px) {
  .chat-window {
    width: calc(100vw - 1.25rem);
    right: -0.35rem;
    bottom: 4.5rem;
    height: auto;
    max-height: 78vh;
    max-height: 78dvh;
  }
  .input-hint { display: none; }
  .message-bubble { max-width: 88%; }
}

@media (min-width: 480px) and (max-width: 767.98px) {
  .chat-window {
    width: min(calc(100vw - 2rem), 22rem);
    right: 0;
    bottom: 4.75rem;
    max-height: 78vh;
    max-height: 78dvh;
  }
}

@media (min-width: 768px) {
  .chat-window {
    width: clamp(22rem, 26vw, 24rem);
    bottom: 5rem;
    height: 34rem;
    max-height: 75vh;
  }
}

@media (min-width: 1024px) {
  .chat-window { width: clamp(22rem, 22vw, 25rem); }
}

@media (min-width: 1440px) {
  .chat-window { width: clamp(24rem, 20vw, 26rem); height: 36rem; }
}

@media (min-width: 1920px) {
  .chat-wrapper { font-size: 16.5px; }
  .chat-toggle-btn { width: 4.25rem; height: 4.25rem; }
  .chat-icon       { width: 1.75rem; height: 1.75rem; }
  .chat-window     { width: clamp(26rem, 19vw, 28rem); height: 38rem; }
  .message-bubble  { max-width: 78%; }
}

@media (min-width: 2560px) {
  .chat-wrapper {
    font-size: 19px;
    bottom: clamp(1.5rem, 1vw, 2.5rem);
    right:  clamp(1.5rem, 1vw, 2.5rem);
  }
  .chat-toggle-btn { width: 5rem; height: 5rem; }
  .chat-icon       { width: 2rem; height: 2rem; }
  .chat-window     { width: clamp(28rem, 16vw, 32rem); height: 42rem; }
  .chat-header     { padding: 1.1rem 1.4rem; }
  .chat-header h3  { font-size: 1.1rem; }
  .messages-container { padding: 1.35rem; }
  .send-btn        { width: 3.25rem; height: 3.25rem; min-width: 3.25rem; }
  .send-btn svg    { width: 1.5rem; height: 1.5rem; }
}

/* Landscape phones — keep window readable */
@media (max-width: 900px) and (orientation: landscape) {
  .chat-window {
    height: auto;
    max-height: 85vh;
    max-height: 85dvh;
  }
}

/* ==========================================================================
   ACCESSIBILITY
   ========================================================================== */
.chat-toggle-btn:focus-visible,
.header-btn:focus-visible,
.retry-btn:focus-visible,
.send-btn:focus-visible,
.message-input:focus-visible {
  outline: 2px solid var(--cb-accent);
  outline-offset: 3px;
  box-shadow: 0 0 0 4px rgb(var(--sfs-accent-rgb, 129 140 248) / 0.25);
}

@media (prefers-reduced-motion: reduce) {
  .chat-toggle-btn,
  .message,
  .send-btn,
  .retry-btn,
  .header-btn,
  .welcome-icon,
  .status-indicator,
  .loading-spinner,
  .unread-badge,
  .slide-up-enter-active,
  .slide-up-leave-active {
    animation: none !important;
    transition: none !important;
  }
}

@media (prefers-contrast: high) {
  .chat-window      { background: rgb(var(--sfs-surface-rgb, 5 5 20) / 0.92); border-color: var(--sfs-border-strong, #fff); }
  .message-bubble   { border-color: rgb(var(--sfs-line-rgb, 255 255 255) / 0.4); }
  .message-input    { border-color: var(--sfs-border-strong, #fff) !important; }
}
</style>