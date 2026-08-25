<!-- src/views/AiChat.vue – updated for Gemini AI chat -->
<template>
  <div class="ai-chat-container">
    <div class="chat-header">
      <h1>{{ $t('AI Chat Assistant') }}</h1>
      <p>{{ $t('Ask me anything about your courses, labs, or general knowledge') }}</p>
    </div>

    <div class="messages-container" ref="messagesContainer">
      <div
        v-for="(msg, index) in messages"
        :key="index"
        :class="['message', msg.role === 'user' ? 'user-message' : 'assistant-message']"
      >
        <div class="message-avatar">
          <span v-if="msg.role === 'user'">👤</span>
          <span v-else>🤖</span>
        </div>
        <div class="message-content">
          <div
            v-if="msg.role === 'assistant'"
            v-html="renderMarkdown(msg.content)"
            class="markdown-body"
          ></div>
          <div v-else class="plain-text">{{ msg.content }}</div>
        </div>
      </div>

      <div v-if="isLoading" class="message assistant-message">
        <div class="message-avatar">🤖</div>
        <div class="message-content">
          <div class="typing-indicator">
            <span></span><span></span><span></span>
          </div>
        </div>
      </div>
    </div>

    <div class="input-area">
      <textarea
        v-model="userInput"
        @keydown="handleKeyDown"
        @input="adjustTextareaHeight"
        placeholder="Type your message... (Enter to send, Shift+Enter for new line)"
        rows="1"
        ref="textarea"
        :disabled="isLoading"
      ></textarea>
      <button @click="sendMessage" :disabled="!userInput.trim() || isLoading">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z" />
        </svg>
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, nextTick, onMounted } from 'vue';
import { marked } from 'marked';
import hljs from 'highlight.js';
import 'highlight.js/styles/github-dark.css';
import { useAiService } from '@/services/ai.service';

marked.setOptions({
  highlight: (code: string, lang: string) => {
    if (lang && hljs.getLanguage(lang)) {
      return hljs.highlight(code, { language: lang }).value;
    }
    return hljs.highlightAuto(code).value;
  },
  breaks: true,
});

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

const messages = ref<ChatMessage[]>([]);
const userInput = ref('');
const isLoading = ref(false);
const messagesContainer = ref<HTMLElement | null>(null);
const textarea = ref<HTMLTextAreaElement | null>(null);

const aiService = useAiService();

// Adjust textarea height based on content
const adjustTextareaHeight = () => {
  if (textarea.value) {
    textarea.value.style.height = 'auto';
    textarea.value.style.height = textarea.value.scrollHeight + 'px';
  }
};

// Scroll to bottom of messages
const scrollToBottom = () => {
  nextTick(() => {
    if (messagesContainer.value) {
      messagesContainer.value.scrollTop = messagesContainer.value.scrollHeight;
    }
  });
};

// Render markdown and attach copy buttons
const renderMarkdown = (content: string) => {
  const rawHtml = marked(content);
  nextTick(() => {
    document.querySelectorAll('.markdown-body pre').forEach((pre) => {
      if (pre.querySelector('.copy-code-btn')) return;
      const button = document.createElement('button');
      button.className = 'copy-code-btn';
      button.innerHTML = '📋';
      button.setAttribute('aria-label', 'Copy code');
      button.addEventListener('click', async () => {
        const code = (pre.querySelector('code') as HTMLElement)?.innerText || '';
        try {
          await navigator.clipboard.writeText(code);
          button.innerHTML = '✅';
          setTimeout(() => { button.innerHTML = '📋'; }, 2000);
        } catch {
          button.innerHTML = '❌';
          setTimeout(() => { button.innerHTML = '📋'; }, 2000);
        }
      });
      (pre as HTMLElement).style.position = 'relative';
      pre.appendChild(button);
    });
  });
  return rawHtml;
};

// Handle keydown: Enter sends, Shift+Enter adds new line
const handleKeyDown = (e: KeyboardEvent) => {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    sendMessage();
  }
};

// Send message
const sendMessage = async () => {
  const message = userInput.value.trim();
  if (!message || isLoading.value) return;

  messages.value.push({ role: 'user', content: message });
  userInput.value = '';
  adjustTextareaHeight();
  scrollToBottom();

  isLoading.value = true;

  try {
    // Send full conversation history to Gemini-backed proxy
    const response = await aiService.sendConversation(messages.value);
    messages.value.push({ role: 'assistant', content: response });
  } catch (error: any) {
    console.error('AI chat error:', error);
    messages.value.push({
      role: 'assistant',
      content: `Sorry, I encountered an error: ${error?.message || 'Unknown error'}. Please try again later.`,
    });
  } finally {
    isLoading.value = false;
    scrollToBottom();
    nextTick(() => textarea.value?.focus());
  }
};

onMounted(() => {
  // Welcome message
  messages.value.push({
    role: 'assistant',
    content: 'Hello! I\'m your AI assistant powered by Google Gemini. How can I help you today?'
  });
  nextTick(() => {
    adjustTextareaHeight();
    textarea.value?.focus();
  });
});
</script>

<style src="@/assets/css/ai-chat.css"></style>