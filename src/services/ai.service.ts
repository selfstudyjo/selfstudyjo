// src/services/ai.service.ts – uses VITE_AI_APP_ID for the Gemini AI service
interface Replica {
  replica_url: string;
}

interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

class AiService {
  private replicas: string[] = [];
  private currentIndex = 0;
  private authToken: string;
  private appId: string;
  private model: string;

  constructor() {
    this.authToken = import.meta.env.VITE_AUTH_TOKEN;
    // ✅ FIXED: Use VITE_AI_APP_ID (the Gemini AI app), not VITE_CHAT_APP_ID
    this.appId = import.meta.env.VITE_AI_APP_ID;
    this.model = import.meta.env.VITE_AI_MODEL || 'gemini-2.0-flash';

    if (!this.authToken || !this.appId) {
      console.error('Missing VITE_AUTH_TOKEN or VITE_AI_APP_ID');
    }
  }

  async initialize() {
    const primaryDomain = import.meta.env.VITE_API_BASE_REGISTRY;
    const altDomain = import.meta.env.VITE_REGISTRY_ALT;
    const domains = [primaryDomain, altDomain].filter(Boolean);

    for (const domain of domains) {
      try {
        const response = await fetch(`${domain}/apps/${this.appId}/`, {
          headers: { Authorization: `Token ${this.authToken}` },
        });
        if (response.ok) {
          const data = await response.json();
          this.replicas = data.replicas.map((r: Replica) =>
            r.replica_url.replace(/\/$/, '')
          );
          if (this.replicas.length > 0) {
            console.log(`AI replicas loaded (app ${this.appId}):`, this.replicas);
            return;
          }
        }
      } catch (error) {
        console.warn(`Failed to fetch from ${domain}:`, error);
      }
    }
    throw new Error('No AI replicas available');
  }

  private async tryReplica(url: string, messages: ChatMessage[]) {
    const response = await fetch(`${url}/v1/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Token ${this.authToken}`,
      },
      body: JSON.stringify({
        model: this.model,
        messages: messages,
        temperature: 0.7,
        max_tokens: 2048,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => '');
      throw new Error(`HTTP ${response.status}: ${errorText.slice(0, 200)}`);
    }

    const data = await response.json();

    if (data?.error) {
      throw new Error(`API error: ${JSON.stringify(data.error)}`);
    }

    if (!data?.choices?.[0]?.message?.content) {
      console.error('Unexpected AI response shape:', data);
      throw new Error('Invalid response from AI service');
    }

    return data.choices[0].message.content as string;
  }

  async sendConversation(messages: ChatMessage[]): Promise<string> {
    if (this.replicas.length === 0) {
      await this.initialize();
    }

    let lastError: unknown = null;
    for (let i = 0; i < this.replicas.length; i++) {
      const index = (this.currentIndex + i) % this.replicas.length;
      const url = this.replicas[index];
      try {
        const content = await this.tryReplica(url, messages);
        this.currentIndex = (index + 1) % this.replicas.length;
        return content;
      } catch (error) {
        lastError = error;
        console.warn(`Replica ${url} failed:`, error);
      }
    }

    throw new Error(
      `All replicas failed${lastError ? `: ${(lastError as Error).message}` : ''}`
    );
  }
}

let instance: AiService | null = null;
export function useAiService() {
  if (!instance) instance = new AiService();
  return instance;
}