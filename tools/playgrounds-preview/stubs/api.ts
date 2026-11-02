// The HTTP client, with `_portal_server.py`'s token. Same signatures as
// src/services/api.ts for the four verbs labs.service.ts uses.
async function call<T>(method: string, base: string, endpoint: string, data?: unknown): Promise<T> {
    // labs.service upgrades every replica URL to https (rule 1 of the four
    // silent killers); the local backend is plain http, so undo it here.
    const local = base.replace(/^https:\/\/(127\.0\.0\.1|localhost)/, 'http://$1');
    const response = await fetch(local.replace(/\/$/, '') + endpoint, {
        method,
        headers: { Authorization: 'Token preview', 'Content-Type': 'application/json' },
        body: data === undefined ? undefined : JSON.stringify(data),
    });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) throw Object.assign(new Error(`HTTP ${response.status}`), { status: response.status, data: body });
    return body as T;
}

export const apiService = {
    get: <T>(base: string, endpoint: string) => call<T>('GET', base, endpoint),
    post: <T>(base: string, endpoint: string, data: unknown) => call<T>('POST', base, endpoint, data),
    put: <T>(base: string, endpoint: string, data: unknown) => call<T>('PUT', base, endpoint, data),
    delete: <T>(base: string, endpoint: string, data?: unknown) => call<T>('DELETE', base, endpoint, data),
};
export default apiService;
