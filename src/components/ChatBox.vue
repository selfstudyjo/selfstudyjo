<template>
  <div class="chat-wrapper">
    <!-- Chat Toggle Button -->
    <button
      class="chat-toggle-btn"
      :class="{ 'has-unread': unreadCount > 0 }"
      @click="toggleChat"
      :disabled="isReconnecting"
      aria-label="Open chat"
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
            <h3>SelfStudy Support</h3>
            <span v-if="isConnected" class="status-text">Online</span>
            <span v-else-if="isReconnecting" class="status-text reconnecting-text">Reconnecting...</span>
            <span v-else class="status-text offline-text">Offline</span>
          </div>
          <div class="header-right">
            <button class="header-btn" @click.stop="isMinimized = !isMinimized" aria-label="Minimize chat">
              <svg viewBox="0 0 24 24" width="16" height="16">
                <path fill="currentColor" d="M19 13H5v-2h14v2z"/>
              </svg>
            </button>
            <button class="header-btn" @click.stop="closeChat" aria-label="Close chat">
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
              <p>Connecting to chat...</p>
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
              <h4>Welcome to SelfStudy Support</h4>
              <p>We're here to help! Ask us anything about courses, progress, or technical issues.</p>
              <p class="response-time">Typical response time: 2-5 minutes</p>
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
                    <span v-if="message.sender === 'system'" class="sender-system">🤖 System</span>
                    <span v-else-if="message.sender === 'admin'" class="sender-admin">👨‍🏫 Support</span>
                    <span v-else class="sender-user">You</span>
                  </div>
                  <div class="message-text">{{ message.message }}</div>
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
                aria-label="Send message"
              >
                <svg viewBox="0 0 24 24" width="20" height="20">
                  <path fill="currentColor" d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/>
                </svg>
              </button>
            </form>
            <p class="input-hint">Press Enter to send, Shift+Enter for new line</p>
          </div>
        </div>

        <!-- Minimized State -->
        <div v-else class="chat-minimized">
          <div class="minimized-content">
            <div class="status-indicator" :class="{ online: isConnected, offline: !isConnected, reconnecting: isReconnecting }"></div>
            <span class="minimized-text">SelfStudy Support</span>
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
      const newIncomingMessages = newMessages.filter(
        msg => !previousIds.has(msg.id) && msg.sender !== 'anonymous'
      );

      if (newIncomingMessages.length > 0) {
        playNotificationSound();

        if (isOpen.value && !isMinimized.value) {
          await markAdminMessagesAsSeen(currentReplicaUrl.value, currentRoom.value.id);
        }
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
   ChatBox 2026 - Modern Professional Style
   CONSISTENT COLOR SCHEME ACROSS ALL DEVICES
   - No OS-based dark mode (prevents mobile inconsistency)
   - Single color palette enforced everywhere
   - WCAG AA contrast guaranteed
   ========================================================================== */

*,
*::before,
*::after {
  box-sizing: border-box;
}

/* ==========================================================================
   LOCKED DESIGN TOKENS — same on every device, every screen size
   Using a dark-navy chat surface with light text for premium 2026 feel.
   ========================================================================== */
.chat-wrapper {
  /* Brand gradient */
  --cb-primary: #667eea;
  --cb-primary-dark: #5a67d8;
  --cb-secondary: #764ba2;
  --cb-gradient: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  --cb-gradient-hover: linear-gradient(135deg, #5a67d8 0%, #6b46c1 100%);

  /* Chat window surfaces — LOCKED dark theme for consistency */
  --cb-surface: #1e2235;          /* main window background */
  --cb-surface-2: #262b42;        /* messages area background */
  --cb-surface-3: #2f3552;        /* input background */
  --cb-surface-input-focus: #353c5e;
  --cb-bubble-incoming: #2f3552;  /* incoming message bubble */
  --cb-border: rgba(255, 255, 255, 0.08);
  --cb-border-strong: rgba(255, 255, 255, 0.18);

  /* Text — always light on dark surfaces */
  --cb-text: #f1f3f9;             /* primary text */
  --cb-text-muted: #c4c9d9;       /* secondary */
  --cb-text-subtle: #8b93ab;      /* placeholder / hints */
  --cb-text-on-primary: #ffffff;  /* on gradient */

  /* Status */
  --cb-success: #48bb78;
  --cb-warning: #ed8936;
  --cb-danger: #f56565;
  --cb-danger-soft: #fed7d7;

  /* Shadows */
  --cb-shadow-sm: 0 2px 8px rgba(0, 0, 0, 0.2);
  --cb-shadow-md: 0 8px 24px rgba(0, 0, 0, 0.3);
  --cb-shadow-lg: 0 20px 50px rgba(0, 0, 0, 0.45);
  --cb-shadow-brand: 0 10px 30px rgba(102, 126, 234, 0.4);

  /* Radii */
  --cb-radius-sm: 0.5rem;
  --cb-radius-md: 0.875rem;
  --cb-radius-lg: 1.25rem;
  --cb-radius-xl: 1.5rem;
  --cb-radius-full: 999px;

  /* Layout */
  position: fixed;
  bottom: 1.5rem;
  right: 1.5rem;
  z-index: 9999;
  font-size: 16px;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Inter', Roboto, sans-serif;
  color: var(--cb-text);

  /* Prevent OS-level color-scheme override */
  color-scheme: only dark;
}

/* ==========================================================================
   Toggle Button
   ========================================================================== */
.chat-toggle-btn {
  position: relative;
  width: 3.75rem;
  height: 3.75rem;
  border-radius: var(--cb-radius-full);
  background: var(--cb-gradient);
  border: none;
  color: var(--cb-text-on-primary);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: var(--cb-shadow-brand);
  transition: transform 0.25s cubic-bezier(0.34, 1.56, 0.64, 1), box-shadow 0.25s ease;
  z-index: 10000;
}

.chat-toggle-btn:hover {
  transform: translateY(-3px) scale(1.05);
  box-shadow: 0 14px 35px rgba(102, 126, 234, 0.55);
}

.chat-toggle-btn:active { transform: scale(0.95); }

.chat-toggle-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.chat-toggle-btn.has-unread {
  animation: pulse-ring 2s infinite;
}

.chat-icon {
  width: 1.5rem;
  height: 1.5rem;
}

.unread-badge {
  position: absolute;
  top: -0.35rem;
  right: -0.35rem;
  background: var(--cb-danger);
  color: #fff;
  font-size: 0.7rem;
  font-weight: 700;
  min-width: 1.35rem;
  height: 1.35rem;
  border-radius: var(--cb-radius-full);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0 0.4rem;
  border: 0.15rem solid #fff;
  box-shadow: 0 2px 6px rgba(245, 101, 101, 0.5);
  animation: bounce-in 0.5s cubic-bezier(0.34, 1.56, 0.64, 1);
}

/* ==========================================================================
   Chat Window — LOCKED dark surface
   ========================================================================== */
.chat-window {
  position: absolute;
  bottom: 5rem;
  right: 0;
  width: 23.75rem;
  max-width: calc(100vw - 2rem);
  height: 34rem;
  max-height: 75vh;
  background: var(--cb-surface) !important;
  color: var(--cb-text) !important;
  border-radius: var(--cb-radius-xl);
  box-shadow: var(--cb-shadow-lg);
  display: flex;
  flex-direction: column;
  overflow: hidden;
  z-index: 9999;
  border: 1px solid var(--cb-border);
}

.chat-window.minimized {
  height: 3.75rem;
}

/* ==========================================================================
   Header
   ========================================================================== */
.chat-header {
  background: var(--cb-gradient);
  color: var(--cb-text-on-primary);
  padding: 0.9rem 1.1rem;
  display: flex;
  align-items: center;
  justify-content: space-between;
  cursor: pointer;
  user-select: none;
  flex-shrink: 0;
  position: relative;
  overflow: hidden;
}

.chat-header::before {
  content: '';
  position: absolute;
  inset: 0;
  background: radial-gradient(circle at 20% 50%, rgba(255, 255, 255, 0.14), transparent 50%);
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
  box-shadow: 0 0 0 3px rgba(72, 187, 120, 0.3);
}

.status-indicator.online {
  background: var(--cb-success);
  animation: pulse-dot 2s infinite;
}

.status-indicator.offline {
  background: #a0aec0;
  box-shadow: 0 0 0 3px rgba(160, 174, 192, 0.25);
}

.status-indicator.reconnecting {
  background: var(--cb-warning);
  animation: pulse-dot 1.2s infinite;
  box-shadow: 0 0 0 3px rgba(237, 137, 54, 0.3);
}

.chat-header h3 {
  margin: 0;
  font-size: 0.95rem;
  font-weight: 600;
  color: #fff;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  letter-spacing: 0.01em;
}

.status-text {
  font-size: 0.7rem;
  opacity: 0.95;
  color: #fff;
  white-space: nowrap;
}

.status-text.offline-text { color: var(--cb-danger-soft); }
.status-text.reconnecting-text { color: #ffe4c4; }

.header-right {
  display: flex;
  gap: 0.4rem;
  flex-shrink: 0;
}

.header-btn {
  background: rgba(255, 255, 255, 0.18);
  border: 1px solid rgba(255, 255, 255, 0.15);
  color: #fff;
  width: 2rem;
  height: 2rem;
  border-radius: var(--cb-radius-sm);
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: background 0.2s ease, transform 0.15s ease;
}

.header-btn:hover {
  background: rgba(255, 255, 255, 0.32);
  transform: translateY(-1px);
}

.header-btn svg { width: 1rem; height: 1rem; }

/* ==========================================================================
   Chat Content — ALWAYS dark surface
   ========================================================================== */
.chat-content {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  background: var(--cb-surface-2) !important;
}

.messages-container {
  flex: 1;
  overflow-y: auto;
  overflow-x: hidden;
  padding: 1.1rem;
  background: var(--cb-surface-2) !important;
  color: var(--cb-text);
  scroll-behavior: smooth;
}

.messages-container::-webkit-scrollbar { width: 6px; }
.messages-container::-webkit-scrollbar-track { background: transparent; }
.messages-container::-webkit-scrollbar-thumb {
  background: var(--cb-border-strong);
  border-radius: var(--cb-radius-full);
}
.messages-container::-webkit-scrollbar-thumb:hover {
  background: var(--cb-text-subtle);
}

/* ==========================================================================
   Loading
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
  border: 0.2rem solid var(--cb-border-strong);
  border-top-color: var(--cb-primary);
  border-radius: 50%;
  animation: spin 0.9s linear infinite;
}

/* ==========================================================================
   Error
   ========================================================================== */
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

.error-state svg { width: 3rem; height: 3rem; }

.error-state p {
  color: var(--cb-text-muted);
  line-height: 1.5;
  font-size: 0.875rem;
  margin: 0;
}

.retry-btn {
  background: var(--cb-gradient);
  color: #fff;
  border: none;
  padding: 0.65rem 1.35rem;
  border-radius: var(--cb-radius-md);
  cursor: pointer;
  font-weight: 600;
  font-size: 0.875rem;
  transition: transform 0.2s ease, box-shadow 0.2s ease;
  box-shadow: var(--cb-shadow-brand);
}

.retry-btn:hover:not(:disabled) {
  transform: translateY(-2px);
  background: var(--cb-gradient-hover);
}

.retry-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

/* ==========================================================================
   Welcome
   ========================================================================== */
.welcome-message {
  text-align: center;
  padding: 1.75rem 1.25rem;
  background: var(--cb-surface-3);
  color: var(--cb-text);
  border-radius: var(--cb-radius-lg);
  box-shadow: var(--cb-shadow-sm);
  border: 1px solid var(--cb-border);
}

.welcome-icon {
  font-size: 2.75rem;
  margin-bottom: 0.75rem;
  display: inline-block;
  animation: float 3s ease-in-out infinite;
}

.welcome-message h4 {
  margin: 0 0 0.5rem 0;
  color: var(--cb-text);
  font-size: 1.05rem;
  font-weight: 700;
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
   Messages
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
  box-shadow: 0 0 0 2px var(--cb-primary), var(--cb-shadow-sm);
}

.message-bubble {
  max-width: 82%;
  min-width: 0;
  background: var(--cb-bubble-incoming);
  color: var(--cb-text);
  border-radius: var(--cb-radius-lg);
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
  border-bottom-right-radius: 0.35rem;
  border-color: transparent;
}

.message-incoming .message-bubble {
  background: var(--cb-bubble-incoming);
  color: var(--cb-text);
  border-bottom-left-radius: 0.35rem;
}

.message-sender {
  font-size: 0.7rem;
  font-weight: 600;
  margin-bottom: 0.25rem;
  opacity: 0.9;
}

.message-outgoing .message-sender { color: rgba(255, 255, 255, 0.95); }
.message-incoming .message-sender { color: var(--cb-text-muted); }

.sender-system { color: #68d391 !important; }
.sender-admin  { color: #a3bffa !important; }
.message-outgoing .sender-user { color: rgba(255, 255, 255, 0.95); }

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
  text-align: right;
  color: inherit;
}

/* ==========================================================================
   Input Area — EXPLICIT COLORS, NO INHERITANCE PROBLEMS
   ========================================================================== */
.chat-input-area {
  border-top: 1px solid var(--cb-border);
  padding: 0.85rem 1rem;
  background: var(--cb-surface) !important;
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
  /* LOCKED colors — identical on all devices */
  background-color: var(--cb-surface-3) !important;
  background-image: none !important;
  color: var(--cb-text) !important;
  -webkit-text-fill-color: var(--cb-text) !important;
  caret-color: var(--cb-primary);
  border: 1.5px solid var(--cb-border-strong);
  border-radius: var(--cb-radius-md);
  padding: 0.7rem 0.9rem;
  font-size: 0.9rem;
  font-family: inherit;
  resize: none;
  max-height: 7.5rem;
  min-height: 2.75rem;
  line-height: 1.45;
  transition: border-color 0.2s ease, box-shadow 0.2s ease, background-color 0.2s ease;
  outline: none;
  /* Prevent iOS/Android user-agent overrides */
  -webkit-appearance: none;
  appearance: none;
}

.message-input::placeholder {
  color: var(--cb-text-subtle) !important;
  -webkit-text-fill-color: var(--cb-text-subtle) !important;
  opacity: 1;
}

.message-input:focus {
  border-color: var(--cb-primary);
  background-color: var(--cb-surface-input-focus) !important;
  color: var(--cb-text) !important;
  -webkit-text-fill-color: var(--cb-text) !important;
  box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.25);
}

.message-input:disabled {
  background-color: var(--cb-surface-2) !important;
  color: var(--cb-text-subtle) !important;
  -webkit-text-fill-color: var(--cb-text-subtle) !important;
  cursor: not-allowed;
  opacity: 0.7;
}

/* Prevent iOS autofill yellow / Chrome autofill white */
.message-input:-webkit-autofill,
.message-input:-webkit-autofill:hover,
.message-input:-webkit-autofill:focus {
  -webkit-box-shadow: 0 0 0 1000px var(--cb-surface-3) inset !important;
  -webkit-text-fill-color: var(--cb-text) !important;
  caret-color: var(--cb-primary);
  transition: background-color 5000s ease-in-out 0s;
}

.send-btn {
  width: 2.75rem;
  height: 2.75rem;
  min-width: 2.75rem;
  border-radius: var(--cb-radius-md);
  background: var(--cb-gradient);
  border: none;
  color: #fff;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  transition: transform 0.2s ease, box-shadow 0.2s ease, background 0.2s ease;
  box-shadow: var(--cb-shadow-brand);
}

.send-btn svg { width: 1.2rem; height: 1.2rem; }

.send-btn:hover:not(:disabled) {
  transform: translateY(-2px);
  background: var(--cb-gradient-hover);
  box-shadow: 0 8px 20px rgba(102, 126, 234, 0.5);
}

.send-btn:active:not(:disabled) { transform: translateY(0); }

.send-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
  box-shadow: none;
}

.input-hint {
  font-size: 0.68rem;
  color: var(--cb-text-subtle);
  margin: 0.5rem 0 0 0;
  text-align: center;
}

/* ==========================================================================
   Minimized
   ========================================================================== */
.chat-minimized {
  height: 100%;
  display: flex;
  align-items: center;
  padding: 0 1.1rem;
  background: var(--cb-gradient);
  color: #fff;
  cursor: pointer;
}

.minimized-content {
  display: flex;
  align-items: center;
  gap: 0.7rem;
  width: 100%;
}

.minimized-text {
  font-size: 0.88rem;
  font-weight: 600;
  flex: 1;
  color: #fff;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.minimized-badge {
  background: var(--cb-danger);
  color: #fff;
  font-size: 0.7rem;
  font-weight: 700;
  min-width: 1.3rem;
  height: 1.3rem;
  border-radius: var(--cb-radius-full);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0 0.4rem;
}

/* ==========================================================================
   Animations
   ========================================================================== */
.slide-up-enter-active,
.slide-up-leave-active {
  transition: all 0.35s cubic-bezier(0.34, 1.56, 0.64, 1);
}

.slide-up-enter-from,
.slide-up-leave-to {
  opacity: 0;
  transform: translateY(1.25rem) scale(0.95);
}

@keyframes pulse-dot {
  0%, 100% { opacity: 1; transform: scale(1); }
  50% { opacity: 0.7; transform: scale(1.15); }
}

@keyframes pulse-ring {
  0%, 100% { box-shadow: var(--cb-shadow-brand); }
  50% { box-shadow: 0 0 0 12px rgba(102, 126, 234, 0); }
}

@keyframes bounce-in {
  0% { transform: scale(0); }
  60% { transform: scale(1.2); }
  100% { transform: scale(1); }
}

@keyframes spin { to { transform: rotate(360deg); } }

@keyframes slideInMsg {
  from { opacity: 0; transform: translateY(8px); }
  to { opacity: 1; transform: translateY(0); }
}

@keyframes float {
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(-6px); }
}

/* ==========================================================================
   RESPONSIVE BREAKPOINTS (200px → 2560px+)
   Only font-size and layout adjust — COLORS REMAIN IDENTICAL.
   ========================================================================== */

/* ----- 200–250 | Micro ----- */
@media only screen and (min-width: 200px) and (max-width: 250px) {
  .chat-wrapper { font-size: 9px; bottom: 0.5rem; right: 0.5rem; }
  .chat-window {
    width: calc(100vw - 1rem);
    right: -0.25rem;
    bottom: 4rem;
    height: auto;
    max-height: 70vh;
    min-height: 20rem;
    border-radius: 0.9rem;
  }
  .chat-toggle-btn { width: 3rem; height: 3rem; }
  .chat-icon { width: 1.2rem; height: 1.2rem; }
  .chat-header { padding: 0.6rem 0.7rem; }
  .chat-header h3 { font-size: 0.85rem; }
  .status-text { display: none; }
  .messages-container { padding: 0.6rem; }
  .chat-input-area { padding: 0.55rem 0.6rem; }
  .message-input { font-size: 0.8rem; padding: 0.5rem 0.6rem; min-height: 2.2rem; }
  .send-btn { width: 2.2rem; height: 2.2rem; min-width: 2.2rem; }
  .send-btn svg { width: 1rem; height: 1rem; }
  .input-hint { display: none; }
  .message-bubble { max-width: 92%; padding: 0.5rem 0.65rem; }
  .welcome-message { padding: 1rem 0.75rem; }
  .welcome-icon { font-size: 2rem; }
}

/* ----- 250–300 | Tiny ----- */
@media only screen and (min-width: 250px) and (max-width: 300px) {
  .chat-wrapper { font-size: 10px; bottom: 0.6rem; right: 0.6rem; }
  .chat-window {
    width: calc(100vw - 1.2rem);
    right: -0.3rem;
    bottom: 4.2rem;
    height: auto;
    max-height: 72vh;
    min-height: 22rem;
  }
  .chat-toggle-btn { width: 3.2rem; height: 3.2rem; }
  .status-text { display: none; }
  .messages-container { padding: 0.7rem; }
  .chat-input-area { padding: 0.6rem 0.7rem; }
  .input-hint { display: none; }
  .message-bubble { max-width: 90%; }
}

/* ----- 300–350 | X-Small ----- */
@media only screen and (min-width: 300px) and (max-width: 350px) {
  .chat-wrapper { font-size: 11px; bottom: 0.75rem; right: 0.75rem; }
  .chat-window {
    width: calc(100vw - 1.5rem);
    right: -0.35rem;
    bottom: 4.5rem;
    max-height: 75vh;
  }
  .status-text { font-size: 0.65rem; }
  .input-hint { display: none; }
  .message-bubble { max-width: 88%; }
}

/* ----- 350–400 | Small- ----- */
@media only screen and (min-width: 350px) and (max-width: 400px) {
  .chat-wrapper { font-size: 12px; bottom: 0.85rem; right: 0.85rem; }
  .chat-window {
    width: calc(100vw - 1.7rem);
    right: -0.4rem;
    bottom: 4.75rem;
    max-height: 76vh;
  }
  .input-hint { font-size: 0.65rem; }
}

/* ----- 400–450 | Small ----- */
@media only screen and (min-width: 400px) and (max-width: 450px) {
  .chat-wrapper { font-size: 13px; }
  .chat-window {
    width: calc(100vw - 2rem);
    max-height: 78vh;
  }
}

/* ----- 450–500 | Small+ ----- */
@media only screen and (min-width: 450px) and (max-width: 500px) {
  .chat-wrapper { font-size: 13.5px; }
  .chat-window { width: calc(100vw - 2rem); }
}

/* ----- 500–550 | Medium- ----- */
@media only screen and (min-width: 500px) and (max-width: 550px) {
  .chat-wrapper { font-size: 14px; }
}

/* ----- 550–600 | Medium ----- */
@media only screen and (min-width: 550px) and (max-width: 600px) {
  .chat-wrapper { font-size: 14.5px; }
}

/* ----- 600–650 | Medium+ ----- */
@media only screen and (min-width: 600px) and (max-width: 650px) {
  .chat-wrapper { font-size: 15px; }
}

/* ----- 650–700 | Large- ----- */
@media only screen and (min-width: 650px) and (max-width: 700px) {
  .chat-wrapper { font-size: 15.5px; }
}

/* ----- 700–750 | Large ----- */
@media only screen and (min-width: 700px) and (max-width: 750px) {
  .chat-wrapper { font-size: 16px; }
}

/* ----- 750–800 | Large+ ----- */
@media only screen and (min-width: 750px) and (max-width: 800px) {
  .chat-wrapper { font-size: 16.25px; }
}

/* ----- 800–850 | XL- ----- */
@media only screen and (min-width: 800px) and (max-width: 850px) {
  .chat-wrapper { font-size: 16.5px; }
}

/* ----- 850–900 | XL ----- */
@media only screen and (min-width: 850px) and (max-width: 900px) {
  .chat-wrapper { font-size: 16.75px; }
}

/* ----- 900–950 | XL+ ----- */
@media only screen and (min-width: 900px) and (max-width: 950px) {
  .chat-wrapper { font-size: 17px; }
}

/* ----- 950–1000 | 2XL- ----- */
@media only screen and (min-width: 950px) and (max-width: 1000px) {
  .chat-wrapper { font-size: 17.25px; }
}

/* ----- 1000–1050 | 2XL ----- */
@media only screen and (min-width: 1000px) and (max-width: 1050px) {
  .chat-wrapper { font-size: 17.5px; }
}

/* ----- 1050–1100 | 2XL+ ----- */
@media only screen and (min-width: 1050px) and (max-width: 1100px) {
  .chat-wrapper { font-size: 17.75px; }
}

/* ----- 1100–1150 | 3XL- ----- */
@media only screen and (min-width: 1100px) and (max-width: 1150px) {
  .chat-wrapper { font-size: 18px; }
}

/* ----- 1150–1200 | 3XL ----- */
@media only screen and (min-width: 1150px) and (max-width: 1200px) {
  .chat-wrapper { font-size: 18.25px; }
}

/* ----- 1200–1920 | 4XL ----- */
@media only screen and (min-width: 1200px) and (max-width: 1920px) {
  .chat-wrapper { font-size: 18.5px; }
}

/* ----- 1920–2560 | Ultra ----- */
@media only screen and (min-width: 1920px) and (max-width: 2560px) {
  .chat-wrapper { font-size: 19.5px; bottom: 2rem; right: 2rem; }
}

/* ----- 2560+ | 4K+ ----- */
@media only screen and (min-width: 2560px) {
  .chat-wrapper { font-size: 21px; bottom: 2.5rem; right: 2.5rem; }
}

/* ==========================================================================
   Accessibility
   ========================================================================== */
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
</style>
