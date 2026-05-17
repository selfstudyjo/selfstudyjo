import { apiService } from './api';
import { serviceRegistry } from './config';

export interface ToastmastersSession {
    id: string;
    user_id: string;
    username: string;
    user_first_name?: string;
    user_last_name?: string;
    user_full_name?: string;
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
    body_language_data: any;
    body_language_advice: string;
    overall_score: number;
    created_at: string;
}

export interface BotCallBody {
    stage?: string;
    topic?: string;
    speech_type?: string;
    user_name?: string;
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
}

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
                body
            );
            return r.text;
        } catch (e) {
            console.error(`Bot ${endpoint} failed:`, e);
            return null;
        }
    }

    async saveSession(data: Partial<ToastmastersSession>): Promise<{ success: boolean; id: string }> {
        const baseUrl = await this.getBaseUrl();
        return await apiService.post(baseUrl, '/api/toastmasters/sessions', data);
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
}

export const toastmastersService = new ToastmastersService();