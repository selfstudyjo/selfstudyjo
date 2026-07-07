// src/services/roblox.service.ts – Roblox Animation AI service
import { serviceRegistry } from './config';

interface CustomAnimationRequest {
  description: string;
  partType: string;
  looping: boolean;
  duration: number;
}

interface CustomAnimationResult {
  name: string;
  description: string;
  luaCode: string;
  animationParams: {
    posX?: string;
    posY?: string;
    posZ?: string;
    rotX?: string;
    rotY?: string;
    rotZ?: string;
    scaleX?: string;
    scaleY?: string;
    scaleZ?: string;
    colorHue?: string;
  };
}

class RobloxAIService {
  private replicas: string[] = [];
  private currentIndex = 0;
  private authToken: string;
  private appId: string;

  constructor() {
    this.authToken = import.meta.env.VITE_AUTH_TOKEN;
    this.appId = import.meta.env.VITE_AI_APP_ID;
  }

  async initialize() {
    if (this.replicas.length > 0) return;

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
          this.replicas = data.replicas.map((r: { replica_url: string }) =>
            r.replica_url.replace(/\/$/, '')
          );
          if (this.replicas.length > 0) return;
        }
      } catch (error) {
        console.warn(`Roblox AI: Failed to fetch from ${domain}:`, error);
      }
    }
  }

  private async callAI(systemPrompt: string, userPrompt: string, maxTokens: number = 2048): Promise<string | null> {
    await this.initialize();

    const messages = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt }
    ];

    for (let i = 0; i < this.replicas.length; i++) {
      const index = (this.currentIndex + i) % this.replicas.length;
      const url = this.replicas[index];

      try {
        const response = await fetch(`${url}/v1/chat/completions`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Token ${this.authToken}`,
          },
          body: JSON.stringify({
            model: 'multi-provider',
            messages,
            temperature: 0.5,
            max_tokens: maxTokens,
          }),
        });

        if (response.ok) {
          const data = await response.json();
          const content = data?.choices?.[0]?.message?.content;
          if (content) {
            this.currentIndex = (index + 1) % this.replicas.length;
            return content;
          }
        }
      } catch (error) {
        console.warn(`Roblox AI replica ${url} failed:`, error);
      }
    }

    return null;
  }

  async generateCustomAnimation(request: CustomAnimationRequest): Promise<CustomAnimationResult | null> {
    const systemPrompt = `You are a Roblox Lua scripting expert and Three.js animation specialist. You generate ONLY valid JSON responses.

When given an animation description, you must return a JSON object with:
1. "name": A short name for the animation
2. "description": Brief description of what it does
3. "luaCode": Complete Roblox Lua script that implements the animation. The script should:
   - Be placed inside a ${request.partType} as a child Script
   - Use script.Parent to reference the part
   - Use RunService.Heartbeat or TweenService
   - Include clear comments
   - Set Anchored = true at the start if needed
   - ${request.looping ? 'Loop infinitely' : 'Play once'}
4. "animationParams": An object with JavaScript math expressions (using variable 't' for time) that describe the motion for Three.js preview:
   - posX, posY, posZ: position formulas (e.g., "Math.sin(t) * 3")
   - rotX, rotY, rotZ: rotation formulas (e.g., "t * 2")
   - scaleX, scaleY, scaleZ: scale formulas (e.g., "1 + Math.sin(t) * 0.3")
   - colorHue: hue formula 0-1 (e.g., "(t * 0.2) % 1")
   Only include the params that are relevant to the animation.

Reply ONLY with valid JSON, no markdown fences, no extra text.`;

    const userPrompt = `Generate a Roblox animation for a ${request.partType}:

Description: ${request.description}
Looping: ${request.looping ? 'Yes' : 'No'}
Duration: ${request.duration} seconds

Generate the Lua code and Three.js preview parameters.`;

    const response = await this.callAI(systemPrompt, userPrompt, 2500);

    if (!response) return null;

    try {
      // Extract JSON from response
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        return {
          name: parsed.name || 'Custom Animation',
          description: parsed.description || request.description,
          luaCode: parsed.luaCode || '-- Failed to generate code',
          animationParams: parsed.animationParams || {}
        };
      }
    } catch (e) {
      console.error('Failed to parse AI response:', e);
    }

    // Fallback: try to extract Lua code from plain text
    const luaMatch = response.match(/```lua\n([\s\S]*?)```/);
    return {
      name: 'Custom Animation',
      description: request.description,
      luaCode: luaMatch ? luaMatch[1] : response,
      animationParams: {
        posY: 'Math.sin(t) * 1.5 + 1',
        rotY: 't'
      }
    };
  }
}

let instance: RobloxAIService | null = null;

export function useRobloxAI(): RobloxAIService {
  if (!instance) instance = new RobloxAIService();
  return instance;
}