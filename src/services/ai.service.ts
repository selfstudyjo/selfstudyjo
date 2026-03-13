// src/services/ai.service.ts – updated (removed system message logic)
import { ref } from 'vue';

interface Replica {
  replica_url: string;
}

class AiService {
  private replicas: string[] = [];
  private currentIndex = 0;
  private authToken: string;
  private appId: string;

  constructor() {
    this.authToken = import.meta.env.VITE_AUTH_TOKEN;
    this.appId = import.meta.env.VITE_CHAT_APP_ID;
    if (!this.authToken || !this.appId) {
      console.error('Missing VITE_AUTH_TOKEN or VITE_CHAT_APP_ID');
    }
  }

  async initialize() {
    const primaryDomain = import.meta.env.VITE_API_BASE_REGISTRY;
    const altDomain = import.meta.env.VITE_REGISTRY_ALT;

    const domains = [primaryDomain, altDomain].filter(Boolean);

    for (const domain of domains) {
      try {
        const response = await fetch(`${domain}/apps/${this.appId}/`, {
          headers: {
            Authorization: `Token ${this.authToken}`,
          },
        });
        if (response.ok) {
          const data = await response.json();
          this.replicas = data.replicas.map((r: Replica) => r.replica_url.replace(/\/$/, ''));
          if (this.replicas.length > 0) {
            console.log('AI replicas loaded:', this.replicas);
            return;
          }
        }
      } catch (error) {
        console.warn(`Failed to fetch from ${domain}:`, error);
      }
    }
    throw new Error('No AI replicas available');
  }

  private async tryReplica(url: string, messages: any[]) {
    const response = await fetch(`${url}/v1/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Token ${this.authToken}`,
      },
      body: JSON.stringify({
        model: 'openai/gpt-3.5-turbo', // or any model you prefer
        messages: messages,
      }),
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const data = await response.json();
    return data.choices[0].message.content;
  }

  /**
   * Send the full conversation history to the AI.
   * @param messages - Array of message objects with role and content.
   * @returns The assistant's reply.
   */
  async sendConversation(messages: any[]): Promise<string> {
    if (this.replicas.length === 0) {
      await this.initialize();
    }

    // Try replicas in round-robin fashion
    for (let i = 0; i < this.replicas.length; i++) {
      const index = (this.currentIndex + i) % this.replicas.length;
      const url = this.replicas[index];
      try {
        const content = await this.tryReplica(url, messages);
        this.currentIndex = (index + 1) % this.replicas.length; // move to next for next time
        return content;
      } catch (error) {
        console.warn(`Replica ${url} failed:`, error);
      }
    }

    throw new Error('All replicas failed');
  }
}

// Export a singleton instance
let instance: AiService | null = null;

export function useAiService() {
  if (!instance) {
    instance = new AiService();
  }
  return instance;
}