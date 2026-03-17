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
    // Get user IP
    userIP.value = await getUserIP();

    // Get or create chat room
    const { room, replicaUrl } = await getChatRoom(userIP.value);
    currentRoom.value = room;
    currentReplicaUrl.value = replicaUrl;
    isConnected.value = true;
    chatInitialized.value = true;
    retryCount.value = 0; // Reset retry count on success

    // Load existing messages
    const initialMessages = await getMessages(replicaUrl, room.id);
    messages.value = initialMessages;

    // Mark admin messages as seen when chat opens
    await markAdminMessagesAsSeen(replicaUrl, room.id);

    // Start polling for new messages
    startPolling();

    // Auto-open if prop is set
    if (props.autoOpen) {
      isOpen.value = true;
    }
  } catch (err: any) {
    console.error('Chat initialization error:', err);
    error.value = err.message || 'Failed to connect to chat service';
    chatInitialized.value = false;
    isConnected.value = false;

    // Implement retry with exponential backoff
    if (attempt < props.maxRetries) {
      isReconnecting.value = true;
      const delay = Math.min(1000 * Math.pow(2, attempt), 10000); // 1s, 2s, 4s, max 10s
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

  // Clear any existing polling
  if ((window as any).chatPolling) {
    clearInterval((window as any).chatPolling);
  }

  const polling = startMessagePolling(
    currentReplicaUrl.value,
    currentRoom.value.id,
    async (newMessages) => {
      const previousMessages = [...messages.value];
      messages.value = newMessages;

      // Check for new incoming messages
      const previousIds = new Set(previousMessages.map(m => m.id));
      const newIncomingMessages = newMessages.filter(
        msg => !previousIds.has(msg.id) && msg.sender !== 'anonymous'
      );

      // Play notification sound for new incoming messages
      if (newIncomingMessages.length > 0) {
        playNotificationSound();

        // If chat is open, mark as seen
        if (isOpen.value && !isMinimized.value) {
          await markAdminMessagesAsSeen(currentReplicaUrl.value, currentRoom.value.id);
        }
      }

      // Scroll to bottom on new message
      scrollToBottom();
    },
    5000 // Poll every 5 seconds
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

  // Add message optimistically
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

  // Clear input and resize
  if (messageInput.value) {
    messageInput.value.style.height = 'auto';
  }

  try {
    // Send to server
    await sendChatMessage(currentReplicaUrl.value, userIP.value, message);

    // Remove temp message (will be replaced by server response)
    messages.value = messages.value.filter(m => m.id !== tempMessage.id);

    // Refresh messages to get server response
    const updatedMessages = await getMessages(currentReplicaUrl.value, currentRoom.value.id);
    messages.value = updatedMessages;

    scrollToBottom();
  } catch (err) {
    console.error('Failed to send message:', err);
    // Show error but keep optimistic message
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

  // Mark admin messages as seen when opening
  if (currentRoom.value && currentReplicaUrl.value) {
    markAdminMessagesAsSeen(currentReplicaUrl.value, currentRoom.value.id);
  }

  // Focus input
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
  // Clear any pending retry
  if (retryTimeout.value) {
    clearTimeout(retryTimeout.value);
    retryTimeout.value = null;
  }
  retryCount.value = 0;
  isReconnecting.value = false;
  error.value = null;
  initChat(0);
}

// Auto-resize textarea
watch(newMessage, () => {
  nextTick(() => {
    if (messageInput.value) {
      messageInput.value.style.height = 'auto';
      messageInput.value.style.height = Math.min(messageInput.value.scrollHeight, 120) + 'px';
    }
  });
});

// Watch for connection status changes
watch(isConnected, (connected) => {
  if (!connected && chatInitialized.value && !isReconnecting.value) {
    // Connection lost, attempt reconnect
    isReconnecting.value = true;
    retryCount.value = 0;
    reconnect();
  }
});

// Initialize chat on mount
onMounted(() => {
  initChat();
});

// Cleanup polling and timeouts on unmount
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
.chat-wrapper {
  position: fixed;
  bottom: 24px;
  right: 24px;
  z-index: 9999;
}

/* Toggle Button */
.chat-toggle-btn {
  position: relative;
  width: 60px;
  height: 60px;
  border-radius: 50%;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  border: none;
  color: white;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 4px 20px rgba(102, 126, 234, 0.4);
  transition: all 0.3s ease;
  z-index: 10000;
}

.chat-toggle-btn:hover {
  transform: scale(1.1);
  box-shadow: 0 6px 25px rgba(102, 126, 234, 0.6);
}

.chat-toggle-btn:active {
  transform: scale(0.95);
}

.chat-toggle-btn.has-unread {
  animation: pulse 2s infinite;
}

.chat-icon {
  width: 24px;
  height: 24px;
}

.unread-badge {
  position: absolute;
  top: -5px;
  right: -5px;
  background: #fc8181;
  color: white;
  font-size: 12px;
  font-weight: 600;
  min-width: 20px;
  height: 20px;
  border-radius: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0 6px;
  border: 2px solid white;
  animation: bounce 0.5s ease;
}

/* Chat Window */
.chat-window {
  position: absolute;
  bottom: 80px;
  right: 0;
  width: 380px;
  max-width: calc(100vw - 48px);
  height: 500px;
  max-height: 70vh;
  background: white;
  border-radius: 16px;
  box-shadow: 0 10px 40px rgba(0, 0, 0, 0.15);
  display: flex;
  flex-direction: column;
  overflow: hidden;
  z-index: 9999;
}

.chat-window.minimized {
  height: 60px;
}

/* Header */
.chat-header {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  padding: 16px 20px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  cursor: pointer;
  user-select: none;
}

.header-left {
  display: flex;
  align-items: center;
  gap: 12px;
}

.status-indicator {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #48bb78;
}

.status-indicator.online {
  background: #48bb78;
  animation: pulse 2s infinite;
}

.status-indicator.offline {
  background: #a0aec0;
}

.chat-header h3 {
  margin: 0;
  font-size: 16px;
  font-weight: 600;
}

.status-text {
  font-size: 12px;
  opacity: 0.9;
}

.status-text.offline-text {
  color: #fed7d7;
}

.header-right {
  display: flex;
  gap: 8px;
}

.header-btn {
  background: rgba(255, 255, 255, 0.2);
  border: none;
  color: white;
  width: 32px;
  height: 32px;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: background 0.2s ease;
}

.header-btn:hover {
  background: rgba(255, 255, 255, 0.3);
}

/* Chat Content */
.chat-content {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.messages-container {
  flex: 1;
  overflow-y: auto;
  padding: 20px;
  background: #f7fafc;
}

/* Loading State */
.loading-messages {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100%;
  gap: 16px;
}

.loading-spinner {
  width: 40px;
  height: 40px;
  border: 3px solid #e2e8f0;
  border-top-color: #667eea;
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

/* Error State */
.error-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100%;
  text-align: center;
  gap: 16px;
  padding: 20px;
}

.error-state p {
  color: #4a5568;
  line-height: 1.5;
}

.retry-btn {
  background: #667eea;
  color: white;
  border: none;
  padding: 10px 20px;
  border-radius: 8px;
  cursor: pointer;
  font-weight: 500;
  transition: background 0.2s ease;
}

.retry-btn:hover {
  background: #5a67d8;
}

/* Welcome Message */
.welcome-message {
  text-align: center;
  padding: 30px 20px;
  background: white;
  border-radius: 12px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.05);
}

.welcome-icon {
  font-size: 48px;
  margin-bottom: 16px;
}

.welcome-message h4 {
  margin: 0 0 8px 0;
  color: #2d3748;
  font-size: 18px;
}

.welcome-message p {
  margin: 8px 0;
  color: #718096;
  line-height: 1.5;
}

.response-time {
  font-size: 14px;
  color: #a0aec0;
  font-style: italic;
}

/* Messages List */
.messages-list {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.message {
  display: flex;
}

.message-outgoing {
  justify-content: flex-end;
}

.message-incoming {
  justify-content: flex-start;
}

.message.unread .message-bubble {
  border-left: 3px solid #667eea;
}

.message-bubble {
  max-width: 80%;
  background: white;
  border-radius: 18px;
  padding: 12px 16px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
  position: relative;
}

.message-outgoing .message-bubble {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  border-bottom-right-radius: 4px;
}

.message-incoming .message-bubble {
  background: white;
  color: #2d3748;
  border-bottom-left-radius: 4px;
}

.message-sender {
  font-size: 12px;
  font-weight: 600;
  margin-bottom: 4px;
  opacity: 0.8;
}

.message-outgoing .message-sender {
  color: rgba(255, 255, 255, 0.9);
}

.message-incoming .message-sender {
  color: #718096;
}

.sender-system {
  color: #38a169 !important;
}

.sender-admin {
  color: #667eea !important;
}

.message-text {
  word-wrap: break-word;
  line-height: 1.4;
}

.message-time {
  font-size: 11px;
  margin-top: 4px;
  opacity: 0.7;
  text-align: right;
}

/* Input Area */
.chat-input-area {
  border-top: 1px solid #e2e8f0;
  padding: 16px 20px;
  background: white;
}

.input-form {
  display: flex;
  gap: 12px;
  align-items: flex-end;
}

.message-input {
  flex: 1;
  border: 1px solid #e2e8f0;
  border-radius: 12px;
  padding: 12px 16px;
  font-size: 14px;
  resize: none;
  max-height: 120px;
  min-height: 44px;
  line-height: 1.4;
  transition: border-color 0.2s ease;
}

.message-input:focus {
  outline: none;
  border-color: #667eea;
  box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.1);
}

.message-input:disabled {
  background: #f7fafc;
  cursor: not-allowed;
}

.send-btn {
  width: 44px;
  height: 44px;
  border-radius: 12px;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  border: none;
  color: white;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  transition: all 0.2s ease;
}

.send-btn:hover:not(:disabled) {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(102, 126, 234, 0.3);
}

.send-btn:active:not(:disabled) {
  transform: translateY(0);
}

.send-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.input-hint {
  font-size: 11px;
  color: #a0aec0;
  margin-top: 8px;
  text-align: center;
}

/* Minimized State */
.chat-minimized {
  height: 100%;
  display: flex;
  align-items: center;
  padding: 0 20px;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  cursor: pointer;
}

.minimized-content {
  display: flex;
  align-items: center;
  gap: 12px;
  width: 100%;
}

.minimized-text {
  font-size: 14px;
  font-weight: 500;
  flex: 1;
}

.minimized-badge {
  background: #fc8181;
  color: white;
  font-size: 12px;
  font-weight: 600;
  min-width: 20px;
  height: 20px;
  border-radius: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0 6px;
}

/* Animations */
.slide-up-enter-active,
.slide-up-leave-active {
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

.slide-up-enter-from,
.slide-up-leave-to {
  opacity: 0;
  transform: translateY(20px);
}

@keyframes pulse {
  0%, 100% {
    opacity: 1;
  }
  50% {
    opacity: 0.7;
  }
}

@keyframes bounce {
  0%, 100% {
    transform: scale(1);
  }
  50% {
    transform: scale(1.2);
  }
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

/* Responsive Design */
@media (max-width: 640px) {
  .chat-wrapper {
    bottom: 16px;
    right: 16px;
  }

  .chat-toggle-btn {
    width: 56px;
    height: 56px;
  }

  .chat-window {
    width: calc(100vw - 32px);
    right: -8px;
    bottom: 72px;
  }

  .chat-header h3 {
    font-size: 15px;
  }
}

@media (max-width: 480px) {
  .chat-window {
    height: 400px;
    max-height: 60vh;
  }

  .messages-container {
    padding: 16px;
  }

  .chat-input-area {
    padding: 12px 16px;
  }
}

/* Dark mode support */
@media (prefers-color-scheme: dark) {
  .chat-window {
    background: #1a202c;
  }

  .chat-header {
    background: linear-gradient(135deg, #4c51bf 0%, #6b46c1 100%);
  }

  .messages-container {
    background: #2d3748;
  }

  .message-incoming .message-bubble {
    background: #2d3748;
    color: #e2e8f0;
  }

  .message-sender {
    color: #a0aec0;
  }

  .welcome-message {
    background: #2d3748;
    color: #e2e8f0;
  }

  .welcome-message h4 {
    color: #e2e8f0;
  }

  .welcome-message p {
    color: #a0aec0;
  }

  .chat-input-area {
    background: #2d3748;
    border-top-color: #4a5568;
  }

  .message-input {
    background: #1a202c;
    border-color: #4a5568;
    color: #e2e8f0;
  }

  .message-input:focus {
    border-color: #667eea;
    box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.2);
  }

  .input-hint {
    color: #718096;
  }
}

/* (Keep existing styles, add new status indicator for reconnecting) */
.status-indicator.reconnecting {
  background: #ed8936;
  animation: pulse 1.5s infinite;
}

.reconnecting-text {
  color: #ed8936;
}

/* Add disabled state for toggle button */
.chat-toggle-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

</style>
