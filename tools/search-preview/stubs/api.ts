/**
 * The HTTP client, answered from `fixture.json` (recorded from the live
 * services by make-fixture.mjs).
 *
 * Only the transport is fake: `siteSearch.service.ts`, `course.service.ts`,
 * the slimmers, the cache and the panel are the real ones.
 *
 *   ?delay=900           every request takes this long (default 250 ms)
 *   ?slow=lessons:4000   one endpoint family slower than the rest
 *   ?fail=runbooks,labs  these answer 503 - the "could not load" state
 */
import fixture from './fixture.json';

const params = new URLSearchParams(location.search);
const baseDelay = Number(params.get('delay') ?? 250);
const failing = new Set((params.get('fail') || '').split(',').filter(Boolean));
const slow: Record<string, number> = {};
for (const pair of (params.get('slow') || '').split(',').filter(Boolean)) {
    const [name, ms] = pair.split(':');
    slow[name] = Number(ms) || 3000;
}

export class ApiError extends Error {
    status: number;
    constructor(message: string, status = 0) {
        super(message);
        this.status = status;
    }
}

/** Which fixture answers which path, and the family name `?fail=` uses. */
function route(endpoint: string): { family: string; body: unknown } | null {
    const path = endpoint.split('?')[0];
    if (path === '/courses/') return { family: 'courses', body: fixture.courses };
    if (path === '/lessons/') return { family: 'lessons', body: fixture.lessons };
    if (path === '/api/labs/') return { family: 'labs', body: fixture.labs };
    if (path === '/api/labs/tracks/') return { family: 'labs', body: fixture.tracks };
    if (path === '/api/labs/playgrounds/') return { family: 'labs', body: fixture.playgrounds };
    if (path === '/assessment-titles/') return { family: 'assessments', body: fixture.assessments };
    if (path === '/runbooks/') return { family: 'runbooks', body: fixture.runbooks };
    return null;
}

export const requested: string[] = [];

async function get<T>(_base: string, endpoint: string): Promise<T> {
    requested.push(endpoint);
    const hit = route(endpoint);
    const wait = (hit && slow[hit.family]) ?? baseDelay;
    await new Promise(resolve => setTimeout(resolve, wait));
    if (!hit) throw new ApiError(`stub: no fixture for ${endpoint}`, 404);
    if (failing.has(hit.family)) throw new ApiError('stub: service unavailable', 503);
    return JSON.parse(JSON.stringify(hit.body)) as T;
}

const refuse = async () => { throw new ApiError('stub: writes are not modelled', 405); };

export const apiService = { get, post: refuse, put: refuse, patch: refuse, delete: refuse };

export async function withReplicas<T>(_appId: number, _name: string, call: (base: string) => Promise<T>): Promise<T> {
    return call('https://stub.invalid');
}

(window as any).__sfsRequested = requested;
