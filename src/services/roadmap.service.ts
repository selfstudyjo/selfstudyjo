/**
 * src/services/roadmap.service.ts — the Roadmap Provider (app 27, `roadmaps.py`).
 *
 * The replica is PINNED through the shared `serviceRegistry.getRandomAiReplica()`
 * (working rule 31): creating a roadmap and then reading it back is a write
 * followed by a read, and under push-then-repair replication a re-pick per call
 * is a coin flip on whether the roadmap you just made exists yet.
 *
 * Every call carries `X-User-ID` — the owner. It is the platform convention
 * and is NOT an authenticated claim on its own; the gateway (app 37) is what
 * replaces it with one from a verified token.
 *
 * Errors are classified rather than passed through, because the page has three
 * genuinely different things to say: the feature is not deployed yet (a 404 on
 * the whole `/api/roadmaps/*` prefix), it is deployed and unconfigured (503),
 * or this one roadmap does not exist for you (404 on a detail route).
 */

import { apiService, ApiError } from './api';
import { serviceRegistry } from './config';
import { aiLanguageHeaders } from '@/i18n/runtime';
import {
    normaliseRoadmap, sortRoadmaps,
    type Level, type NodeStatus, type RoadmapDoc, type RoadmapSummary, type Specialization,
} from '@/utils/roadmapLayout';

export type { RoadmapDoc, RoadmapSummary, Specialization };

export type RoadmapErrorKind = 'unavailable' | 'unconfigured' | 'not_found' | 'network' | 'failed';

export class RoadmapError extends Error {
    constructor(message: string, public kind: RoadmapErrorKind, public status = 0) {
        super(message);
        this.name = 'RoadmapError';
    }
}

export interface CreateRoadmapBody {
    specialization_id?: string;
    role?: string;
    level?: Level;
    hours_per_week?: number;
    goal?: string;
    use_ai?: boolean;
    title?: string;
}

export interface Catalogue {
    specializations: Specialization[];
    categories: string[];
    source: string;
    generated_at: string;
}

/**
 * `collection` is true for the list routes, where a 404 can only mean the
 * prefix is not served yet; on a detail route a 404 is the backend saying "no
 * such roadmap for you", which is a different sentence.
 */
function classify(error: unknown, collection: boolean): RoadmapError {
    if (error instanceof RoadmapError) return error;
    if (error instanceof ApiError) {
        const status = error.status || 0;
        if (status === 404) {
            return collection
                ? new RoadmapError(error.message, 'unavailable', 404)
                : new RoadmapError(error.message, 'not_found', 404);
        }
        if (status === 503) return new RoadmapError(error.message, 'unconfigured', 503);
        if (status === 0) return new RoadmapError(error.message, 'network', 0);
        return new RoadmapError(error.message, 'failed', status);
    }
    return new RoadmapError(error instanceof Error ? error.message : String(error), 'network', 0);
}

class RoadmapService {
    private async base(): Promise<string> {
        const url = await serviceRegistry.getRandomAiReplica();
        if (!url) throw new RoadmapError('The AI service is unavailable', 'network');
        return url;
    }

    private headers(userId: string, extra: Record<string, string> = {}) {
        return { 'X-User-ID': userId, ...extra };
    }

    async catalogue(userId: string): Promise<Catalogue> {
        try {
            const base = await this.base();
            const r = await apiService.get<any>(base, '/api/roadmaps/catalogue/', this.headers(userId));
            const specs: Specialization[] = Array.isArray(r?.specializations) ? r.specializations : [];
            return {
                specializations: specs.filter(s => s && s.id).map(s => ({
                    id: String(s.id), title: String(s.title || s.id), category: String(s.category || ''),
                    summary: String(s.summary || ''), icon: String(s.icon || ''),
                    stage_count: Number(s.stage_count) || 0, course_count: Number(s.course_count) || 0,
                    lab_count: Number(s.lab_count) || 0, runbook_count: Number(s.runbook_count) || 0,
                })),
                categories: Array.isArray(r?.categories) ? r.categories.map(String) : [],
                source: String(r?.source || ''),
                generated_at: String(r?.generated_at || ''),
            };
        } catch (e) { throw classify(e, true); }
    }

    /** One specialization's TEMPLATE roadmap — a preview, nothing is created. */
    async template(userId: string, specId: string): Promise<RoadmapDoc> {
        try {
            const base = await this.base();
            const r = await apiService.get<any>(base,
                `/api/roadmaps/catalogue/${encodeURIComponent(specId)}/`, this.headers(userId));
            return normaliseRoadmap(r?.roadmap);
        } catch (e) { throw classify(e, false); }
    }

    async mine(userId: string): Promise<RoadmapSummary[]> {
        try {
            const base = await this.base();
            const r = await apiService.get<any>(base, '/api/roadmaps/mine/', this.headers(userId));
            const list: RoadmapSummary[] = Array.isArray(r?.roadmaps) ? r.roadmaps.filter((x: any) => x && x.id) : [];
            return sortRoadmaps(list);
        } catch (e) { throw classify(e, true); }
    }

    /** May take ~25 s when the AI writes it; the caller shows a progress state. */
    async create(userId: string, body: CreateRoadmapBody): Promise<RoadmapDoc> {
        try {
            const base = await this.base();
            // The language rides along so an AI-written roadmap's prose is in
            // the reader's language. Spent per service, never globally (rule 38).
            const r = await apiService.post<any>(base, '/api/roadmaps/', body,
                this.headers(userId, aiLanguageHeaders()));
            return normaliseRoadmap(r?.roadmap);
        } catch (e) { throw classify(e, true); }
    }

    async get(userId: string, id: string): Promise<RoadmapDoc> {
        try {
            const base = await this.base();
            const r = await apiService.get<any>(base,
                `/api/roadmaps/${encodeURIComponent(id)}/`, this.headers(userId));
            return normaliseRoadmap(r?.roadmap);
        } catch (e) { throw classify(e, false); }
    }

    /** PATCH, never PUT: an omitted field upstream means "leave it alone". */
    async update(userId: string, id: string,
                 patch: { title?: string; progress?: Record<string, NodeStatus> }): Promise<RoadmapDoc> {
        try {
            const base = await this.base();
            const r = await apiService.patch<any>(base,
                `/api/roadmaps/${encodeURIComponent(id)}/`, patch, this.headers(userId));
            return normaliseRoadmap(r?.roadmap);
        } catch (e) { throw classify(e, false); }
    }

    async remove(userId: string, id: string): Promise<void> {
        try {
            const base = await this.base();
            await apiService.delete(base, `/api/roadmaps/${encodeURIComponent(id)}/`, undefined,
                this.headers(userId));
        } catch (e) { throw classify(e, false); }
    }
}

export const roadmapService = new RoadmapService();
