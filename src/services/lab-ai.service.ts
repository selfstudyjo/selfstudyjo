/**
 * The AI tutor for the playground labs, served by Self Study AI (app 27).
 *
 * The same shape as `netsim-ai.service.ts` and for the same reasons: app 27's
 * `/v1/chat/completions` is OpenAI-shaped, its CORS is `CORS(app)` with no header
 * allow-list so `X-SFS-Language` is safe there, and the replica is resolved
 * through the registry rather than hardcoded.
 *
 * **The replica is pinned** (`getRandomAiReplica`), which the netsim tutor is
 * not: a lab conversation is several turns and re-picking per call under
 * push-then-repair is a coin flip on whether the reply saw the previous message.
 * Working rule 31.
 *
 * **The system prompt says which tools are SIMULATED, by name.** Without it the
 * model suggests `docker stats --format` options this engine does not implement
 * and `terraform import`, and the student is told to run something that cannot
 * work - which is worse than no tutor, because they will blame themselves.
 * `tutorPrompt` in `labCatalogue.ts` builds it, and the backend's `context`
 * endpoint supplies the live environment underneath.
 */
import { serviceRegistry } from './config';
import { aiLanguageHeaders } from '@/i18n/runtime';
import { tutorPrompt, type Lab } from '@/utils/labCatalogue';

export interface TutorMessage {
    role: 'system' | 'user' | 'assistant';
    content: string;
}

export interface TutorResult {
    ok: boolean;
    text?: string;
    error?: string;
}

const MODEL = 'llama-3.3-70b-versatile';
const TIMEOUT_MS = 90_000;

class LabAiService {
    private authToken = import.meta.env.VITE_AUTH_TOKEN || '';

    private async replica(): Promise<string | null> {
        return serviceRegistry.getRandomAiReplica();
    }

    /**
     * One turn of the tutor.
     *
     * `history` is the last few turns, `context` is what the lab service said
     * about the environment. Both are capped by the caller - a lab left open all
     * afternoon would otherwise send its whole transcript on every question, and
     * the provider refuses a body past its own size limit and then LEARNS that
     * limit for the model, which degrades every other AI feature on the replica.
     */
    async ask(question: string, lab: Lab | null, context: string,
              history: TutorMessage[] = []): Promise<TutorResult> {
        if (!this.authToken) {
            return { ok: false,
                     error: 'The AI tutor is not configured in this build.' };
        }
        const base = await this.replica();
        if (!base) {
            return { ok: false,
                     error: 'No Self Study AI replica could be reached right now.' };
        }

        const messages: TutorMessage[] = [
            { role: 'system', content: tutorPrompt(lab, context) },
            ...history.slice(-6),
            { role: 'user', content: String(question || '').slice(0, 4000) },
        ];

        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
        try {
            const response = await fetch(`${base}/v1/chat/completions`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Token ${this.authToken}`,
                    ...aiLanguageHeaders(),
                },
                body: JSON.stringify({
                    model: MODEL,
                    messages,
                    temperature: 0.4,
                    max_tokens: 1400,
                }),
                signal: controller.signal,
            });
            if (!response.ok) {
                return { ok: false,
                         error: `The AI backend answered ${response.status}.` };
            }
            const body = await response.json();
            const text = body?.choices?.[0]?.message?.content;
            if (!text) {
                return { ok: false, error: 'The AI backend answered with nothing.' };
            }
            return { ok: true, text: String(text) };
        } catch (error: any) {
            return {
                ok: false,
                error: error?.name === 'AbortError'
                    ? 'The AI tutor took too long to answer.'
                    : (error?.message || 'The AI tutor could not be reached.'),
            };
        } finally {
            clearTimeout(timer);
        }
    }

    /** A hint for one task, which is a narrower question than a free one. */
    async hint(lab: Lab | null, context: string, taskTitle: string,
               taskDetail: string): Promise<TutorResult> {
        return this.ask(
            `I am stuck on this task: "${taskTitle}". ${taskDetail}\n\n`
            + 'Give me one nudge - the idea I am missing and the shape of the '
            + 'command - without doing the whole task for me.',
            lab, context);
    }

    /** What is wrong with the environment right now. */
    async review(lab: Lab | null, context: string): Promise<TutorResult> {
        return this.ask(
            'Look at my environment below and tell me what is wrong or missing '
            + 'for this lab. Be specific about the resources by name, and put the '
            + 'most important thing first.',
            lab, context);
    }
}

export const labAiService = new LabAiService();
