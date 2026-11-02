/*
  Stands in for `services/api` when imported by roadmap.service.ts - the HTTP
  layer, not the service. The stub answers in the CONTRACT's payload shape and
  the real service (and its normaliseRoadmap) runs on top of it, because a
  stub that hands the view finished objects proves nothing about the code that
  builds them (the leaderboard preview's "Untitled" lesson). The templates are
  app 27's own built-in ones, copied into fixture.json.

    ?state=unavailable   every route 404s (app 27 not deployed)
    ?state=unconfigured  every route 503s
    ?empty=1             no roadmaps yet
*/
import fixture from './fixture.json';

export class ApiError extends Error {
    constructor(message: string, public status?: number, public data?: any) { super(message); this.name = 'ApiError'; }
}

const params = new URLSearchParams(location.search);
const state = params.get('state') || '';
const clone = <T>(v: T): T => JSON.parse(JSON.stringify(v));
const templates = (fixture as any).templates as Record<string, any>;

function summary(r: any) {
    const nodes = r.stages.flatMap((s: any) => s.nodes);
    return {
        id: r.id, title: r.title, specialization_id: r.specialization_id, level: r.level,
        created_at: r.created_at, updated_at: r.updated_at, stage_count: r.stages.length,
        node_count: nodes.length, done_count: nodes.filter((n: any) => r.progress[n.id] === 'done').length,
        source: r.source,
    };
}

function make(specId: string, id: string, title: string, when: string, progressN = 0, source = 'template') {
    const r = clone(templates[specId]);
    r.id = id; r.owner = 'u-preview'; r.title = title; r.source = source;
    r.created_at = when; r.updated_at = when; r.progress = {};
    r.stages.flatMap((s: any) => s.nodes).slice(0, progressN).forEach((n: any, i: number) => {
        r.progress[n.id] = i === progressN - 1 ? 'doing' : 'done';
    });
    return r;
}

const store = new Map<string, any>();
if (!params.has('empty')) {
    store.set('rm-ai', make('ai-application-developer', 'rm-ai', 'AI Application Developer', '2026-10-30T10:00:00Z', 9, 'ai'));
    store.set('rm-da', make('data-analyst', 'rm-da', 'Data Analyst - evenings', '2026-10-20T10:00:00Z', 3));
    store.set('rm-devops', make('devops-engineer', 'rm-devops', 'DevOps Engineer', '2026-09-01T10:00:00Z', 0));
}

const wait = (ms: number) => new Promise(r => setTimeout(r, ms));

async function handle(method: string, endpoint: string, body?: any): Promise<any> {
    await wait(120);
    if (state === 'unavailable') throw new ApiError('Not Found', 404, {});
    if (state === 'unconfigured') throw new ApiError('Roadmaps are not configured', 503, {});
    const path = endpoint.split('?')[0];
    let m: RegExpMatchArray | null;
    if (method === 'GET' && path === '/api/roadmaps/catalogue/') {
        return {
            specializations: (fixture as any).specializations, categories: (fixture as any).categories,
            source: 'builtin', generated_at: '2026-11-01T00:00:00Z',
        };
    }
    if (method === 'GET' && (m = path.match(/^\/api\/roadmaps\/catalogue\/([^/]+)\/$/))) {
        const spec = decodeURIComponent(m[1]);
        const t = templates[spec] || templates['data-analyst'];
        return { roadmap: { ...clone(t), id: spec, owner: null, progress: {} } };
    }
    if (method === 'GET' && path === '/api/roadmaps/mine/') return { roadmaps: [...store.values()].map(summary) };
    if (method === 'POST' && path === '/api/roadmaps/') {
        await wait(body?.use_ai ? 2600 : 700);
        const spec = templates[body?.specialization_id] ? body.specialization_id : 'devops-engineer';
        const id = `rm-new-${store.size + 1}`;
        const r = make(spec, id, body?.role || templates[spec].title, new Date().toISOString(), 0, body?.use_ai ? 'ai' : 'template');
        r.level = body?.level || r.level;
        store.set(id, r);
        return { roadmap: clone(r) };
    }
    if ((m = path.match(/^\/api\/roadmaps\/([^/]+)\/$/))) {
        const id = decodeURIComponent(m[1]);
        const r = store.get(id);
        if (!r) throw new ApiError('Not found', 404, {});
        if (method === 'GET') return { roadmap: clone(r) };
        if (method === 'PATCH') {
            if (typeof body?.title === 'string') r.title = body.title;
            for (const [k, v] of Object.entries(body?.progress || {})) {
                if (v) r.progress[k] = v; else delete r.progress[k];
            }
            r.updated_at = new Date().toISOString();
            return { roadmap: clone(r) };
        }
        if (method === 'DELETE') { store.delete(id); return { deleted: true }; }
    }
    throw new ApiError('Not Found', 404, {});
}

export const apiService = {
    get: <T>(_b: string, e: string, _h?: unknown) => handle('GET', e) as Promise<T>,
    post: <T>(_b: string, e: string, d: any, _h?: unknown) => handle('POST', e, d) as Promise<T>,
    patch: <T>(_b: string, e: string, d: any, _h?: unknown) => handle('PATCH', e, d) as Promise<T>,
    delete: <T>(_b: string, e: string, _d?: unknown, _h?: unknown) => handle('DELETE', e) as Promise<T>,
};
