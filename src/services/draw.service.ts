// src/services/draw.service.ts
//
// Client for the Self Study Draw backend (app 34).
//
// The backend replicates every paper across its replicas, so any replica can serve
// any request — but replication is push-then-repair rather than synchronous, so
// this service goes through `getRandomDrawReplica()`, which picks at random once
// per tab and then *pins* that choice. Re-picking on every call would give a coin
// flip on whether your own last stroke had reached the replica you are now reading
// from, which reads as "I drew it and it vanished".
//
// Three things here are worth knowing before changing them:
//
// 1. **Every call carries `X-User-ID`.** The service token says a Self Study client
//    is calling; the header says who for. Without it the backend answers 400, and
//    it is what every permission decision is made against.
// 2. **Element ids are minted here, in the browser.** The backend adopts the id as
//    the record's uid, which makes a re-POST an update rather than a second stroke.
//    That is what lets the canvas draw locally the instant the pointer lifts and
//    post afterwards, and retry a post it is not sure landed.
// 3. **`syncCursor` is the live cursor**, and it deliberately does not fail loudly.
//    A dropped poll is one late frame; throwing would tear down the canvas.

import { ApiError, apiService, withReplicas } from './api';
import { serviceRegistry } from './config';

export const DRAW_APP_ID = parseInt(import.meta.env.VITE_DRAW_APP_ID || '34');

export type DrawPermission = 'owner' | 'write' | 'read';
export type LinkAccess = 'none' | 'read' | 'write';

/** The tools the canvas ships. Mirrors ELEMENT_KINDS in utils/serializers.py — a
 *  kind the backend does not know is rejected, so the two lists have to agree. */
export type ElementKind =
    | 'pen' | 'highlighter' | 'marker' | 'line' | 'arrow' | 'rect' | 'ellipse'
    | 'triangle' | 'diamond' | 'star' | 'text' | 'image' | 'sticky' | 'polygon';

export type PaperBackground =
    'blank' | 'grid' | 'dots' | 'lined' | 'graph' | 'music' | 'isometric';

export interface ElementData {
    /** Flat [x, y, x, y, …]. Flat rather than [{x, y}] because a stroke is
     *  hundreds of points and the object form roughly triples the payload. */
    points?: number[];
    stroke?: string;
    fill?: string;
    width?: number;
    opacity?: number;
    x?: number;
    y?: number;
    w?: number;
    h?: number;
    rotation?: number;
    text?: string;
    fontSize?: number;
    fontFamily?: string;
    bold?: boolean;
    italic?: boolean;
    align?: 'left' | 'center' | 'right';
    src?: string;
    dash?: number[];
    arrowStart?: boolean;
    arrowEnd?: boolean;
    sides?: number;
}

export interface DrawElement {
    element_id: string;
    paper_id?: string;
    kind: ElementKind;
    data: ElementData;
    z: number;
    page?: number;
    author_id?: string;
    author_username?: string;
    created_at?: string;
    updated_at?: string;
    /** Present on an incremental read: this element was erased. */
    deleted?: boolean;
}

export interface DrawPaper {
    paper_id: string;
    title: string;
    description: string;
    owner_id: string;
    owner_username: string;
    background: PaperBackground;
    canvas_color: string;
    width: number;
    height: number;
    link_access: LinkAccess;
    /** Owner only — it is the credential the share link is made of. */
    link_token?: string;
    is_archived: boolean;
    thumbnail?: string;
    has_thumbnail?: boolean;
    created_at?: string;
    updated_at?: string;
    last_edited_at?: string;
    last_edited_by?: string;
    last_edited_by_username?: string;
    my_permission?: DrawPermission;
    element_count?: number;
    share_count?: number;
    participants?: Participant[];
    via_link?: boolean;
}

export interface DrawShare {
    paper_id: string;
    user_id: string;
    username: string;
    permission: 'read' | 'write';
    granted_by?: string;
    granted_by_username?: string;
    created_at?: string;
    updated_at?: string;
}

export interface Participant {
    user_id: string;
    username: string;
    colour: string;
    tool: string;
    selection: number;
    idle_seconds: number;
    cursor?: { x: number; y: number };
}

export interface LivePoll {
    paper_id: string;
    at: string;
    since: string;
    my_permission: DrawPermission;
    count: number;
    elements: DrawElement[];
    participants: Participant[];
    last_edited_at?: string;
    last_edited_by_username?: string;
}

export interface PaperList {
    count: number;
    results: DrawPaper[];
}

class DrawService {
    private readonly APP_ID = DRAW_APP_ID;

    /** The token of the share link this tab arrived by, if any.
     *
     *  Held in memory rather than in localStorage on purpose: it is a credential
     *  for one paper, and persisting it would keep granting access after the tab
     *  that was given the link had gone. */
    private linkTokens = new Map<string, string>();

    rememberLinkToken(paperId: string, token: string) {
        if (paperId && token) this.linkTokens.set(paperId, token);
    }

    forgetLinkToken(paperId: string) {
        this.linkTokens.delete(paperId);
    }

    private headers(userId: string, username = '', paperId = ''): Record<string, string> {
        const out: Record<string, string> = {};
        if (userId) out['X-User-ID'] = userId;
        if (username) out['X-User-Name'] = username;
        const link = paperId ? this.linkTokens.get(paperId) : '';
        if (link) out['X-Paper-Link'] = link;
        return out;
    }

    /** Run a call against this tab's replica, failing over only when one is
     *  genuinely down. A 404 here means "no such paper, or not shared with you" and
     *  every replica holds the same records, so asking another is a slower way to
     *  get the same answer — see `withReplicas` in api.ts. */
    private call<T>(fn: (base: string) => Promise<T>): Promise<T> {
        return withReplicas(this.APP_ID, 'draw', fn);
    }

    async getReplica(): Promise<string | null> {
        return serviceRegistry.getRandomDrawReplica();
    }

    // ---------------------------------------------------------------- papers

    async listPapers(userId: string, includeArchived = false): Promise<PaperList> {
        const query = includeArchived ? '?include_archived=1' : '';
        return this.call(base => apiService.get<PaperList>(
            base, `/api/draw/papers/${query}`, this.headers(userId)));
    }

    async listSharedWithMe(userId: string): Promise<PaperList> {
        return this.call(base => apiService.get<PaperList>(
            base, '/api/draw/shared-with-me/', this.headers(userId)));
    }

    async createPaper(userId: string, username: string, values: Partial<DrawPaper>): Promise<DrawPaper> {
        return this.call(base => apiService.post<DrawPaper>(
            base, '/api/draw/papers/', values, this.headers(userId, username)));
    }

    async getPaper(userId: string, paperId: string, username = ''): Promise<DrawPaper> {
        return this.call(base => apiService.get<DrawPaper>(
            base, `/api/draw/papers/${paperId}/`,
            this.headers(userId, username, paperId)));
    }

    async updatePaper(userId: string, paperId: string, values: Partial<DrawPaper>): Promise<DrawPaper> {
        return this.call(base => apiService.patch<DrawPaper>(
            base, `/api/draw/papers/${paperId}/`, values,
            this.headers(userId, '', paperId)));
    }

    async deletePaper(userId: string, paperId: string): Promise<void> {
        await this.call(base => apiService.delete(
            base, `/api/draw/papers/${paperId}/`, undefined,
            this.headers(userId, '', paperId)));
    }

    async duplicatePaper(userId: string, username: string, paperId: string, title?: string): Promise<DrawPaper> {
        return this.call(base => apiService.post<DrawPaper>(
            base, `/api/draw/papers/${paperId}/duplicate/`, title ? { title } : {},
            this.headers(userId, username, paperId)));
    }

    /** Save the canvas preview. Never throws: a failed thumbnail is a slightly
     *  stale card on the dashboard, and surfacing it as an error on every save
     *  would train people to ignore real ones. */
    async saveThumbnail(userId: string, paperId: string, dataUrl: string): Promise<boolean> {
        try {
            await this.call(base => apiService.post(
                base, `/api/draw/papers/${paperId}/thumbnail/`, { thumbnail: dataUrl },
                this.headers(userId, '', paperId)));
            return true;
        } catch {
            return false;
        }
    }

    // -------------------------------------------------------------- contents

    async getScene(userId: string, paperId: string, username = ''): Promise<{
        elements: DrawElement[]; at: string; my_permission: DrawPermission;
    }> {
        return this.call(base => apiService.get<any>(
            base, `/api/draw/papers/${paperId}/elements/`,
            this.headers(userId, username, paperId)));
    }

    async saveElements(userId: string, username: string, paperId: string,
                       elements: DrawElement[]): Promise<DrawElement[]> {
        if (!elements.length) return [];
        const response = await this.call(base => apiService.post<any>(
            base, `/api/draw/papers/${paperId}/elements/`, { elements },
            this.headers(userId, username, paperId)));
        return response.elements || [];
    }

    async eraseElements(userId: string, paperId: string, elementIds: string[]): Promise<number> {
        if (!elementIds.length) return 0;
        const response = await this.call(base => apiService.delete<any>(
            base, `/api/draw/papers/${paperId}/elements/`,
            { element_ids: elementIds }, this.headers(userId, '', paperId)));
        return response.erased || 0;
    }

    /** Clear the page. A DELETE with `all=1` on the query string rather than in a
     *  body: `apiService.delete` turns a data argument into query parameters, and an
     *  array of ids survives that while a boolean reads more clearly as a flag. */
    async clearPage(userId: string, paperId: string, page?: number): Promise<number> {
        const query = page ? `?all=1&page=${page}` : '?all=1';
        const response = await this.call(base => apiService.delete<any>(
            base, `/api/draw/papers/${paperId}/elements/${query}`, undefined,
            this.headers(userId, '', paperId)));
        return response.erased || 0;
    }

    // ------------------------------------------------------------------ live

    /**
     * One live tick: hand over this user's cursor, receive everyone else's strokes.
     *
     * `since` is the caller's high-water mark — the `at` from the previous tick.
     * The backend clamps it to its own window, so a tab that has been asleep gets a
     * bounded answer rather than an hour of history.
     *
     * Returns null instead of throwing when a tick fails. A live poll runs about
     * once a second; a rejection that propagated would tear the canvas down over a
     * single dropped request, and the next tick almost always succeeds.
     */
    async syncCursor(userId: string, username: string, paperId: string, payload: {
        since?: string;
        cursor?: { x: number; y: number } | null;
        tool?: string;
        selection?: number;
        leaving?: boolean;
    }): Promise<LivePoll | null> {
        try {
            const query = payload.since ? `?since=${encodeURIComponent(payload.since)}` : '';
            return await this.call(base => apiService.post<LivePoll>(
                base, `/api/draw/papers/${paperId}/live/${query}`, payload,
                this.headers(userId, username, paperId)));
        } catch (error) {
            // A 403/404 is not a transport hiccup — access was revoked while the
            // paper was open, and the caller has to be told so it can stop polling
            // and close the canvas rather than retrying forever.
            if (error instanceof ApiError && (error.status === 403 || error.status === 404)) {
                throw error;
            }
            return null;
        }
    }

    /** Tell the other participants this tab has gone, rather than leaving a frozen
     *  cursor on their canvas until the TTL expires. */
    async leave(userId: string, paperId: string): Promise<void> {
        try {
            await this.call(base => apiService.post(
                base, `/api/draw/papers/${paperId}/live/`, { leaving: true },
                this.headers(userId, '', paperId)));
        } catch {
            // Closing a tab is not a moment to raise anything; presence expires on
            // its own TTL either way.
        }
    }

    // --------------------------------------------------------------- sharing

    async listShares(userId: string, paperId: string): Promise<{
        results: DrawShare[]; link_access: LinkAccess; link_token: string;
    }> {
        return this.call(base => apiService.get<any>(
            base, `/api/draw/papers/${paperId}/shares/`, this.headers(userId)));
    }

    async sharePaper(userId: string, username: string, paperId: string,
                     target: { user_id: string; username?: string; permission: 'read' | 'write' }): Promise<DrawShare> {
        return this.call(base => apiService.post<DrawShare>(
            base, `/api/draw/papers/${paperId}/shares/`, target,
            this.headers(userId, username)));
    }

    async changeShare(userId: string, paperId: string, targetUserId: string,
                      permission: 'read' | 'write'): Promise<DrawShare> {
        return this.call(base => apiService.patch<DrawShare>(
            base, `/api/draw/papers/${paperId}/shares/${targetUserId}/`,
            { permission }, this.headers(userId)));
    }

    async revokeShare(userId: string, paperId: string, targetUserId: string): Promise<void> {
        await this.call(base => apiService.delete(
            base, `/api/draw/papers/${paperId}/shares/${targetUserId}/`, undefined,
            this.headers(userId)));
    }

    async setLink(userId: string, paperId: string, access: 'read' | 'write',
                  rotate = false): Promise<{ link_access: LinkAccess; link_token: string }> {
        return this.call(base => apiService.post<any>(
            base, `/api/draw/papers/${paperId}/link/`,
            { link_access: access, rotate }, this.headers(userId)));
    }

    async disableLink(userId: string, paperId: string): Promise<{ link_access: LinkAccess }> {
        return this.call(base => apiService.delete<any>(
            base, `/api/draw/papers/${paperId}/link/`, undefined,
            this.headers(userId)));
    }

    /** Turn a followed share link into a paper. The token is remembered for this
     *  paper so every later call on it carries the credential. */
    async resolveLink(userId: string, token: string): Promise<DrawPaper> {
        const paper = await this.call(base => apiService.get<DrawPaper>(
            base, `/api/draw/link/${encodeURIComponent(token)}/`,
            this.headers(userId)));
        if (paper?.paper_id) this.rememberLinkToken(paper.paper_id, token);
        return paper;
    }

    /** The URL to hand somebody. Built from the app's own origin and hash route, so
     *  it works on GitHub Pages and on a custom domain without configuration. */
    shareUrl(paperId: string, token: string): string {
        const base = `${window.location.origin}${window.location.pathname}`;
        return `${base}#/draw/shared/${encodeURIComponent(token)}`;
    }
}

export const drawService = new DrawService();
