import { apiService } from './api';
import { runBulkDelete, type BulkDeleteResult, type BulkResponse } from '@/utils/bulkDelete';
import type { EnhanceResult } from './jobinterview.service';
import { serviceRegistry } from './config';
import { aiLanguageHeaders } from '@/i18n/runtime';

export interface ToastmastersSession {
    id: string;
    user_id: string;
    username: string;
    user_first_name?: string;
    user_last_name?: string;
    user_full_name?: string;
    user_role?: string;
    topic: string;
    speech_type: string;
    min_time: number;
    max_time: number;
    duration_seconds: number;
    transcript: string;
    sample_speech_text?: string;
    filler_counts: Record<string, number>;
    total_fillers: number;
    word_of_the_day: string;
    grammarian_report: string;
    ah_counter_report: string;
    timer_report: string;
    speech_evaluator_report: string;
    general_evaluator_report: string;
    role_evaluation_report?: string;
    body_language_data: any;
    body_language_advice: string;
    overall_score: number;
    /** A live meeting (turns by voice), and how often the member talked over a bot. */
    live_mode?: boolean;
    interruptions?: { at: string; role?: string; ms_into_utterance: number }[];
    interruption_count?: number;
    created_at: string;
}

export interface BotCallBody {
    stage?: string;
    topic?: string;
    speech_type?: string;
    user_name?: string;
    user_role?: string;
    transcript?: string;
    sample_speech?: string;
    duration?: number;
    min_time?: number;
    max_time?: number;
    counts?: Record<string, number>;
    total?: number;
    body_language?: any;
    on_time?: boolean;
    total_fillers?: number;
    engagement_score?: number;
    purpose?: string;
    actual_fillers_in_sample?: Record<string, number>;
    user_reported_fillers?: Record<string, number>;
    user_timer_report?: string;
    user_wod?: string;
    sample_duration?: number;
    /** Live meeting: times the member talked over a bot. Only sent when > 0. */
    interruption_count?: number;
}

export type { EnhanceResult };

class ToastmastersService {
    private async getBaseUrl(): Promise<string> {
        const url = await serviceRegistry.getRandomToastmastersReplica();
        if (!url) throw new Error('Toastmasters service is unavailable');
        return url;
    }

    async callBot(endpoint: string, body: BotCallBody): Promise<string | null> {
        try {
            const baseUrl = await this.getBaseUrl();
            const r = await apiService.post<{ text: string }>(
                baseUrl,
                `/api/toastmasters/bot/${endpoint}`,
                body, aiLanguageHeaders());
            return r.text;
        } catch (e) {
            console.error(`Bot ${endpoint} failed:`, e);
            return null;
        }
    }

    /**
     * Fix the words speech recognition misheard in a speech -- and nothing else.
     *
     * App 27 keeps every filler word (the Ah-Counter counts them) and refuses
     * any suggestion that adds, removes or rewrites content, returning the
     * speech untouched with `refused` set. Null only when unreachable.
     */
    async enhanceSpeech(body: { text: string; topic?: string; speech_type?: string }): Promise<EnhanceResult | null> {
        try {
            const baseUrl = await this.getBaseUrl();
            return await apiService.post<EnhanceResult>(baseUrl, `/api/toastmasters/enhance-speech`, body);
        } catch (e) {
            console.error('Enhance speech failed:', e);
            return null;
        }
    }

    async evaluateRole(body: BotCallBody): Promise<string | null> {
        try {
            const baseUrl = await this.getBaseUrl();
            const r = await apiService.post<{ text: string }>(
                baseUrl,
                `/api/toastmasters/bot/evaluate-role`,
                body, aiLanguageHeaders());
            return r.text;
        } catch (e) {
            console.error('Role evaluation failed:', e);
            return null;
        }
    }

    async generateRoleTask(body: BotCallBody): Promise<string | null> {
        try {
            const baseUrl = await this.getBaseUrl();
            const r = await apiService.post<{ text: string }>(
                baseUrl,
                `/api/toastmasters/bot/generate-role-task`,
                body, aiLanguageHeaders());
            return r.text;
        } catch (e) {
            console.error('Role task generation failed:', e);
            return null;
        }
    }

    async saveSession(data: Partial<ToastmastersSession>): Promise<{ success: boolean; id: string }> {
        const baseUrl = await this.getBaseUrl();
        return await apiService.post(baseUrl, '/api/toastmasters/sessions', data, aiLanguageHeaders());
    }

    async getUserSessions(userId: string): Promise<ToastmastersSession[]> {
        const baseUrl = await this.getBaseUrl();
        return await apiService.get(baseUrl, `/api/toastmasters/sessions?user_id=${encodeURIComponent(userId)}`);
    }

    async getSession(id: string): Promise<ToastmastersSession> {
        const baseUrl = await this.getBaseUrl();
        return await apiService.get(baseUrl, `/api/toastmasters/sessions/${id}`);
    }

    async deleteSession(id: string, userId: string): Promise<{ success: boolean }> {
        const baseUrl = await this.getBaseUrl();
        return await apiService.delete(baseUrl, `/api/toastmasters/sessions/${id}?user_id=${encodeURIComponent(userId)}`);
    }

    /**
     * Delete several (or all) of the user's own sessions in one request. Falls
     * back to one DELETE per id on a replica that has not got the bulk route.
     */
    async bulkDeleteSessions(ids: string[], userId: string): Promise<BulkDeleteResult> {
        const baseUrl = await this.getBaseUrl();
        return runBulkDelete(
            ids,
            chunk => apiService.post<BulkResponse>(baseUrl, `/api/toastmasters/sessions/bulk-delete`,
                                                  { ids: chunk, user_id: userId }),
            id => this.deleteSession(id, userId),
        );
    }
}

export const toastmastersService = new ToastmastersService();