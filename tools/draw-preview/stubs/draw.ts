// Stands in for `@/services/draw.service` in the Drawing Papers preview.
//
// The shape is app 34's own: `{ count, results: [...] }` for a list, and every
// field `DrawPapers.vue` reads on a paper. A stub written from a guess at the
// payload proves nothing about the page that reads it — `tools/leaderboard-preview`
// paid for that once by handing its view finished records a service never
// sends, which hid the whole "Untitled" defect.
//
// The titles below are deliberately awkward, because a title is the ONE thing
// on a card that identifies a paper and it was the reported bug:
//
//   * a long one, to prove the two-line clamp lands rather than an ellipsis
//     that makes two papers indistinguishable;
//   * an Arabic one, because the card's own `unicode-bidi: plaintext` is what
//     lets an English and an Arabic title sit in the same grid correctly;
//   * one that is entirely digits and punctuation, which is the bidi hazard;
//   * and a blank one, because app 34 does not require a title.
export type PaperBackground = 'blank' | 'grid' | 'graph' | 'lined' | 'dots';
export type LinkAccess = 'none' | 'read' | 'write';
export type DrawPermission = 'owner' | 'write' | 'read';

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
    link_token?: string;
    is_archived: boolean;
    thumbnail?: string;
    has_thumbnail?: boolean;
    last_edited_at?: string;
    my_permission?: DrawPermission;
    element_count?: number;
    share_count?: number;
}

const hour = 3600_000;
const ago = (h: number) => new Date(Date.now() - h * hour).toISOString();

function paper(over: Partial<DrawPaper> & { paper_id: string; title: string }): DrawPaper {
    return {
        description: '',
        owner_id: 'u-preview',
        owner_username: 'Mahmoud',
        background: 'grid',
        canvas_color: '#ffffff',
        width: 1600,
        height: 1000,
        link_access: 'none',
        is_archived: false,
        element_count: 12,
        share_count: 0,
        last_edited_at: ago(3),
        my_permission: 'owner',
        ...over,
    };
}

const MINE: DrawPaper[] = [
    paper({
        paper_id: 'p-1',
        title: 'Normalisation worked examples — third normal form',
        background: 'grid',
        element_count: 48,
        share_count: 3,
        has_thumbnail: true,
        last_edited_at: ago(1),
    }),
    paper({ paper_id: 'p-2', title: 'ER diagram', background: 'graph',
        element_count: 1, link_access: 'read', last_edited_at: ago(26) }),
    paper({ paper_id: 'p-3', title: 'مخطط قاعدة البيانات', background: 'lined',
        element_count: 21, link_access: 'write', share_count: 1 }),
    paper({ paper_id: 'p-4', title: 'CS471 / lecture 4 (2026-09-02)',
        background: 'dots', element_count: 0, last_edited_at: ago(200) }),
    // NO TITLE. App 34 does not require one, so this is a real state - and on
    // a card whose only identifying mark is the title it is the state most
    // worth looking at.
    paper({ paper_id: 'p-5', title: '', background: 'blank', element_count: 4 }),
];

const SHARED: DrawPaper[] = [
    paper({
        paper_id: 'p-6',
        title: 'Group project — sprint board',
        owner_id: 'u-other',
        owner_username: 'layla',
        background: 'blank',
        element_count: 63,
        has_thumbnail: true,
        my_permission: 'write',
        last_edited_at: ago(0.2),
    }),
    paper({
        paper_id: 'p-7',
        title: 'Marking scheme (read only)',
        owner_id: 'u-teacher',
        owner_username: 'dr.hadad',
        background: 'lined',
        element_count: 9,
        my_permission: 'read',
        last_edited_at: ago(70),
    }),
];

const params = new URLSearchParams(location.search);
const empty = params.has('empty');

/** A 2x2 PNG. Enough to prove the thumbnail branch draws, and no bytes wasted. */
const THUMB = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAYAAABytg0kAAAAFElEQVR4nGP4z8DwHwMDAwMDAwMAHwsC/vB0AAAAAElFTkSuQmCC';

export const drawService = {
    // `{ count, results }` and NOT `{ count, papers }`, which is what this stub
    // said first - the view does `withMe.results.map(...)` and the whole page
    // came out as one error banner. The harness caught it on its first run,
    // which is the point: a stub written from a guess at the payload proves
    // nothing about the page that reads it (`tools/leaderboard-preview` and app
    // 23's identity e2e both paid for the same mistake).
    listPapers: async () => ({
        count: empty ? 0 : MINE.length, results: empty ? [] : MINE,
    }),
    listSharedWithMe: async () => ({
        count: empty ? 0 : SHARED.length, results: empty ? [] : SHARED,
    }),
    // The page fetches each paper again for its thumbnail. Only two of the
    // seven have one, so the "Blank" and "Loading…" branches are both on
    // screen — which is what the preview is for.
    getPaper: async (_u: string, id: string) => ({
        ...[...MINE, ...SHARED].find(p => p.paper_id === id)!,
        thumbnail: id === 'p-1' || id === 'p-6' ? THUMB : undefined,
    }),
    createPaper: async () => MINE[0],
    duplicatePaper: async () => MINE[0],
    deletePaper: async () => undefined,
};
