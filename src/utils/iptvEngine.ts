/**
 * The IPTV browsing model: rails, seasons, running order and watch progress.
 *
 * A PLAIN MODULE, for the reason `photoMask.ts`, `drawEngine.ts`,
 * `leaderboardEngine.ts`, `newscastEngine.ts` and `appNav.ts` are: no Vue, no
 * DOM, no network. Everything here is decidable without a browser, so
 * `npm run check:iptv` can assert the properties that are invisible until they
 * are wrong in front of somebody.
 *
 * THE THREE THAT ARE WORTH THE MODULE
 * ===================================
 *
 * 1. **Running order is not array order.** `nextEpisode` / `previousEpisode` are
 *    index arithmetic, and app 19 has already shown what happens when the array
 *    is not in the order the reader sees: nineteen of twenty courses came back
 *    with their lessons reversed, so Next walked *backwards* through the
 *    syllabus and the "3 of 16" counter counted down. The service sorts, and
 *    this sorts again rather than trusting it — one line, and it makes the
 *    arithmetic true whatever arrives.
 *
 * 2. **Every ordering is TOTAL.** A rail is recomputed inside a computed that
 *    re-evaluates on every keystroke in the search box, so an unstable sort is a
 *    grid that visibly reshuffles as somebody types. Same rule
 *    `leaderboardEngine.ts` follows for its table and `sortScene` for an equal
 *    `z`.
 *
 * 3. **Resume is a decision, not a number.** Two thirds of viewers who leave a
 *    film want to carry on and the rest have finished it, so a stored position
 *    near the end has to mean "watched" rather than "resume at 1:58:40" — which
 *    would drop somebody into the credits every time they opened it.
 */

import type { Channel, Episode, Movie, Series } from '@/services/iptv.service';

/* ------------------------------------------------------------------ *
 * Rails
 * ------------------------------------------------------------------ */

export interface Rail<T> {
    /** A translation KEY, not a sentence. The view passes it through `$t`. */
    key: string;
    items: T[];
}

/** Anything with a `title` and the timestamps the library carries. */
type Sortable = { id: string; title?: string; created_at?: string; featured?: boolean };

/**
 * Newest first, then by title, then by id.
 *
 * The id is never a meaningful tie-break and is not meant to be: it is there so
 * the comparator is a TOTAL order, which is what stops the grid reordering
 * itself under a reader who is typing.
 */
export function byNewest<T extends Sortable>(rows: readonly T[]): T[] {
    return [...rows].sort((a, b) => {
        const dateA = String(a.created_at || '');
        const dateB = String(b.created_at || '');
        if (dateA !== dateB) return dateB.localeCompare(dateA);
        const titleA = String(a.title || '').toLowerCase();
        const titleB = String(b.title || '').toLowerCase();
        if (titleA !== titleB) return titleA.localeCompare(titleB);
        return String(a.id).localeCompare(String(b.id));
    });
}

/**
 * The hero: the newest featured thing, else the newest thing at all.
 *
 * It has to prefer something that can actually be WATCHED — a film with no
 * video is a hero with a play button that does nothing, which reads as the app
 * being broken rather than as an operator being midway through an upload. A
 * series qualifies on having any published episode, because that is what its
 * play button leads to.
 */
export function heroOf(movies: readonly Movie[], series: readonly Series[]):
    { kind: 'movie'; record: Movie } | { kind: 'series'; record: Series } | null {
    const playableMovies = movies.filter(row => !!row.video_url || !!row.video_asset);
    const playableSeries = series.filter(row =>
        (row.seasons || []).some(season => (season.published_count ?? season.episode_count) > 0));

    const featured = [
        ...playableMovies.filter(row => row.featured).map(row => ({ kind: 'movie' as const, record: row })),
        ...playableSeries.filter(row => row.featured).map(row => ({ kind: 'series' as const, record: row })),
    ];
    const pool = featured.length ? featured : [
        ...playableMovies.map(row => ({ kind: 'movie' as const, record: row })),
        ...playableSeries.map(row => ({ kind: 'series' as const, record: row })),
    ];
    if (!pool.length) return null;
    const sorted = byNewest(pool.map(entry => entry.record) as Sortable[]);
    const first = sorted[0];
    return pool.find(entry => entry.record.id === first.id) || pool[0];
}

/**
 * Every genre in the library, with how much is in it, commonest first.
 *
 * Bounded, because a scraped library can carry a hundred one-off genres and a
 * row of a hundred chips is not navigation. A genre with one title in it is
 * dropped for the same reason: a rail of one is a rail that looks broken.
 */
export function genresOf(movies: readonly Movie[], series: readonly Series[],
                         limit = 12): Array<{ genre: string; count: number }> {
    const counts = new Map<string, { genre: string; count: number }>();
    const add = (list?: string[]) => {
        (list || []).forEach(raw => {
            const genre = String(raw || '').trim();
            if (!genre) return;
            const key = genre.toLowerCase();
            const entry = counts.get(key);
            if (entry) entry.count += 1;
            else counts.set(key, { genre, count: 1 });
        });
    };
    movies.forEach(row => add(row.genres));
    series.forEach(row => add(row.genres));

    return [...counts.values()]
        .filter(entry => entry.count > 1)
        // Total: count, then the genre itself, so two equally common genres do
        // not swap places between renders.
        .sort((a, b) => b.count - a.count || a.genre.localeCompare(b.genre))
        .slice(0, limit);
}

/**
 * Every rail heading, in order.
 *
 * Exported and declared HERE rather than written out in the view, because these
 * are reached as `$t(rail.key)` - a dynamic key, so no source file contains the
 * literal `$t('New this week')` and the i18n orphan scan would report every one
 * of them as a catalogue entry nothing asks for. `check:i18n` imports this and
 * verifies them positively instead, which is the same arrangement `BUCKET_LABELS`
 * in `aichatRooms.ts` has. Written out twice, the copy goes stale the day
 * somebody rewords a heading and the string silently reverts to English in both
 * languages.
 */
export const RAIL_KEYS = ['New this week', 'Films', 'Series'] as const;

/* ------------------------------------------------------------------ *
 * The tabs
 * ------------------------------------------------------------------ */

/** Which of the four top-level pages of Self Study TV is open. */
export type TabId = 'home' | 'movies' | 'series' | 'live';

export interface TvTab {
    id: TabId;
    /** A translation key, spent by the tab strip as `$t(tab.label)`. */
    label: string;
    /** The route. Every one of these is a REAL path — see `tabFor` below. */
    to: string;
}

/**
 * The four tabs, in reading order.
 *
 * A TAB IS A ROUTE, NEVER A PIECE OF COMPONENT STATE
 * =================================================
 *
 * The Labs page has already paid for the other arrangement: its three sandboxes
 * were an `activeTab` ref, so a student two clicks into the Python compiler had
 * no way to see that a Linux terminal existed, could not link a classmate to it,
 * and lost their place on reload. The rule that came out of it — if it deserves
 * to be navigated to, it needs a route — is why `to` is a path here and why the
 * strip is `router-link`s rather than buttons. Middle-click works, the browser's
 * Back button works, and the sidebar can light the right row.
 *
 * `label` is a key rather than a sentence for the same reason `RAIL_KEYS` are:
 * the strip spends it as `$t(tab.label)`, which is a dynamic key no literal scan
 * can see, so `check:i18n` imports `TAB_KEYS` and verifies them positively
 * instead. Two of the four deliberately reuse a rail heading's key — `Films` and
 * `Series` are the same words in the same context, and a second entry for each
 * would be two chances for one of them to be translated differently from the
 * other on the same screen.
 */
export const TV_TABS: readonly TvTab[] = [
    { id: 'home', label: 'Browse', to: '/tv' },
    { id: 'movies', label: 'Films', to: '/tv/movies' },
    { id: 'series', label: 'Series', to: '/tv/series' },
    { id: 'live', label: 'Live TV', to: '/tv/live' },
];

/**
 * The tab labels, DERIVED rather than written out a second time.
 *
 * `check:i18n` imports this. A hand-written copy is what goes stale the day
 * somebody rewords a tab, and the symptom would be one tab silently reverting to
 * English in both languages while the other three translate.
 */
export const TAB_KEYS: readonly string[] = TV_TABS.map(tab => tab.label);

/**
 * Which tab a path belongs to.
 *
 * The interesting cases are the ones that are NOT a tab's own path, because
 * those are where a tab strip normally goes blank and reads as broken:
 *
 *  * `/tv/series/<id>` — a series' own page keeps **Series** lit. It is reached
 *    from that tab and Back returns to it, so unlighting the strip there would
 *    tell the reader they had left the section they are plainly still in.
 *  * `/tv/watch/episode/<series>/<id>` — the player keeps **Browse** lit rather
 *    than guessing at Series: it is reachable from every tab (a film from the
 *    Films grid, an episode from a series page, a resume tile from Browse), so
 *    any more specific answer is wrong more often than it is right.
 *  * anything else under `/tv` — **Browse**, which is the section's home.
 *
 * Matching is SEGMENT-AWARE. A bare `startsWith` gets `/tv/series` and
 * `/tv/seriesfoo` wrong, which is the same trap `isUnder` in `appNav.ts` exists
 * for; the query string and the trailing slash are both stripped first, since
 * `/tv/live?channel=x` is the live tab and a strip that goes blank the moment
 * somebody picks a channel is worse than no strip.
 */
export function tabFor(path: string): TabId {
    const clean = String(path || '').split(/[?#]/)[0].replace(/\/+$/, '');
    const parts = clean.split('/').filter(Boolean);
    // ['tv', ...rest]
    if (parts[0] !== 'tv') return 'home';
    const head = parts[1] || '';
    if (head === 'live') return 'live';
    if (head === 'series') return 'series';
    if (head === 'movies') return 'movies';
    return 'home';
}

/**
 * The home rails.
 *
 * `key` is a translation key rather than a sentence, so the view spends it
 * through `$t` and the rails are translated like everything else. A rail with
 * nothing in it is dropped here rather than rendered empty: an empty shelf under
 * a heading reads as content having failed to load.
 */
export function buildRails(movies: readonly Movie[], series: readonly Series[]):
    Array<Rail<Movie | Series>> {
    const [fresh, films, shows] = RAIL_KEYS;
    const rails: Array<Rail<Movie | Series>> = [
        { key: fresh, items: recent(movies, series) },
        { key: films, items: byNewest(movies as Sortable[]) as Movie[] },
        { key: shows, items: byNewest(series as Sortable[]) as Series[] },
    ];
    return rails.filter(rail => rail.items.length > 0);
}

/**
 * Added in the last week, and never empty when the library is not.
 *
 * A "new this week" rail that disappears whenever nothing was added is a home
 * page whose shape changes for reasons a reader cannot see, so it falls back to
 * the newest few. That is a deliberate small lie in the heading, and the
 * alternative — a page that is sometimes three rails and sometimes two — is
 * worse.
 */
export function recent(movies: readonly Movie[], series: readonly Series[],
                       now: Date = new Date(), limit = 12): Array<Movie | Series> {
    const cutoff = now.getTime() - 7 * 24 * 3600 * 1000;
    const all = byNewest([...movies, ...series] as Sortable[]) as Array<Movie | Series>;
    const fresh = all.filter(row => {
        const at = Date.parse(String(row.created_at || ''));
        return Number.isFinite(at) && at >= cutoff;
    });
    return (fresh.length ? fresh : all).slice(0, limit);
}

/* ------------------------------------------------------------------ *
 * Seasons and running order
 * ------------------------------------------------------------------ */

/**
 * Episodes in running order.
 *
 * Sorted here as well as by the service, and that is not distrust — it is that
 * every piece of index arithmetic below is only correct if the array is in the
 * order the reader sees, and a client that assumes an order it did not impose is
 * one deploy away from the app-19 bug.
 */
export function inOrder(episodes: readonly Episode[]): Episode[] {
    return [...episodes].sort((a, b) =>
        (Number(a.season) || 0) - (Number(b.season) || 0)
        || (Number(a.episode) || 0) - (Number(b.episode) || 0)
        || String(a.title || '').localeCompare(String(b.title || ''))
        || String(a.id).localeCompare(String(b.id)));
}

export interface SeasonGroup {
    season: number;
    episodes: Episode[];
}

/** Episodes grouped by season, seasons ascending. */
export function bySeason(episodes: readonly Episode[]): SeasonGroup[] {
    const groups = new Map<number, Episode[]>();
    inOrder(episodes).forEach(row => {
        const season = Number(row.season) || 1;
        if (!groups.has(season)) groups.set(season, []);
        groups.get(season)!.push(row);
    });
    return [...groups.keys()].sort((a, b) => a - b)
        .map(season => ({ season, episodes: groups.get(season)! }));
}

/**
 * Where this episode sits in the whole series. 1-based, 0 when not found.
 *
 * Across every season, not within one, because that is what "episode 14 of 32"
 * means to somebody working through a series — and because a per-season counter
 * resets at each season boundary, which reads as progress being lost.
 */
export function positionOf(episodes: readonly Episode[], episodeId: string): number {
    return inOrder(episodes).findIndex(row => row.id === episodeId) + 1;
}

export function nextEpisode(episodes: readonly Episode[],
                            episodeId: string): Episode | null {
    const ordered = inOrder(episodes);
    const at = ordered.findIndex(row => row.id === episodeId);
    if (at < 0 || at + 1 >= ordered.length) return null;
    return ordered[at + 1];
}

export function previousEpisode(episodes: readonly Episode[],
                                episodeId: string): Episode | null {
    const ordered = inOrder(episodes);
    const at = ordered.findIndex(row => row.id === episodeId);
    if (at <= 0) return null;
    return ordered[at - 1];
}

/** The first thing to play when somebody presses Play on a series. */
export function firstPlayable(episodes: readonly Episode[]): Episode | null {
    const ordered = inOrder(episodes).filter(row => !!row.video_url || !!row.video_asset);
    return ordered[0] || null;
}

/* ------------------------------------------------------------------ *
 * Channels
 * ------------------------------------------------------------------ */

export interface ChannelGroup {
    category: string;
    channels: Channel[];
}

/**
 * Channels grouped by category, in the operator's `order` within each.
 *
 * A channel with no category goes into one named group rather than being hidden
 * or scattered: an imported playlist routinely has a few, and a channel that
 * appears nowhere is a channel somebody added and cannot find.
 */
export function byCategory(channels: readonly Channel[],
                           fallback = 'Other'): ChannelGroup[] {
    const groups = new Map<string, Channel[]>();
    channels.forEach(row => {
        const category = String(row.category || '').trim() || fallback;
        if (!groups.has(category)) groups.set(category, []);
        groups.get(category)!.push(row);
    });
    return [...groups.keys()]
        // The fallback group last, whatever it is called: it is the leftovers.
        .sort((a, b) => (a === fallback ? 1 : 0) - (b === fallback ? 1 : 0)
            || a.localeCompare(b))
        .map(category => ({
            category,
            channels: [...groups.get(category)!].sort((a, b) =>
                (Number(a.order) || 0) - (Number(b.order) || 0)
                || String(a.name || '').localeCompare(String(b.name || ''))
                || String(a.id).localeCompare(String(b.id))),
        }));
}

/**
 * Does this stream need hls.js, or will the element play it on its own?
 *
 * Safari and iOS play HLS natively and hls.js explicitly does not support being
 * used there; everything else needs the library. Asked as a capability rather
 * than by sniffing the browser, which is what `canPlayType` is for.
 */
export function needsHlsLibrary(streamType: string,
                                canPlayNatively: boolean): boolean {
    return streamType === 'hls' && !canPlayNatively;
}

/* ------------------------------------------------------------------ *
 * Watch progress
 * ------------------------------------------------------------------ */

export const PROGRESS_KEY = 'sfs-iptv-progress';

/** Below this, somebody has barely started; there is nothing to resume. */
export const RESUME_MIN_SECONDS = 30;

/**
 * Past this share of the running time, treat it as watched rather than resumed.
 *
 * The number is the whole point of storing a decision rather than a position:
 * somebody who reached 98% has finished, and resuming them into the credits
 * every time they open it is worse than starting again. 0.95 rather than 0.99
 * because a film's last minute is titles.
 */
export const WATCHED_FRACTION = 0.95;

export interface Progress {
    position: number;
    duration: number;
    at: number;
}

export type ProgressMap = Record<string, Progress>;

/** How many entries are kept. Bounded, or localStorage grows for ever. */
export const PROGRESS_LIMIT = 200;

export function progressId(kind: 'movie' | 'episode', id: string): string {
    return `${kind}:${id}`;
}

/**
 * What to do when somebody opens this again: resume, restart, or nothing.
 *
 * Three states rather than a number, for the same reason
 * `utils/identity.py` answers three verdicts: collapsing "finished" into
 * "resume at the end" and "barely started" into "resume at 4 seconds" both
 * produce a player that behaves oddly for reasons the viewer cannot see.
 */
export function resumeAt(progress: Progress | undefined | null):
    { action: 'start' } | { action: 'resume'; position: number } | { action: 'watched' } {
    if (!progress || !Number.isFinite(progress.position)) return { action: 'start' };
    const { position, duration } = progress;
    if (position < RESUME_MIN_SECONDS) return { action: 'start' };
    if (duration > 0 && position >= duration * WATCHED_FRACTION) {
        return { action: 'watched' };
    }
    return { action: 'resume', position };
}

/**
 * Record a position, keeping the map bounded and the newest entries.
 *
 * Pure, so it can be checked: the view owns `localStorage` and this owns the
 * decision about what is kept. A position at or past the watched mark is still
 * STORED rather than dropped, because "you have seen this" is information the
 * grid shows — dropping it would make a watched film indistinguishable from one
 * never opened.
 */
export function recordProgress(map: ProgressMap, key: string, position: number,
                               duration: number, now = Date.now()): ProgressMap {
    if (!key || !Number.isFinite(position) || position < 0) return map;
    const next: ProgressMap = { ...map, [key]: {
        position: Math.round(position),
        duration: Math.round(Number.isFinite(duration) ? duration : 0),
        at: now,
    } };
    const keys = Object.keys(next);
    if (keys.length <= PROGRESS_LIMIT) return next;
    keys.sort((a, b) => (next[b].at || 0) - (next[a].at || 0));
    const trimmed: ProgressMap = {};
    keys.slice(0, PROGRESS_LIMIT).forEach(entry => { trimmed[entry] = next[entry]; });
    return trimmed;
}

/**
 * The "Continue watching" rail: things started and not finished, newest first.
 *
 * Deliberately excludes what is finished — that is the whole reason `resumeAt`
 * answers three states. A rail that showed everything ever opened would put a
 * film somebody watched last month above the one they paused an hour ago.
 */
export function continueWatching(map: ProgressMap, movies: readonly Movie[],
                                 episodes: readonly Episode[] = [],
                                 limit = 12): Array<{
    kind: 'movie' | 'episode'; record: Movie | Episode; position: number;
    fraction: number;
}> {
    const out: Array<{ kind: 'movie' | 'episode'; record: Movie | Episode;
        position: number; fraction: number; at: number }> = [];

    const consider = (kind: 'movie' | 'episode', record: Movie | Episode) => {
        const entry = map[progressId(kind, record.id)];
        const verdict = resumeAt(entry);
        if (verdict.action !== 'resume' || !entry) return;
        out.push({
            kind, record, position: verdict.position,
            fraction: entry.duration > 0
                ? Math.min(1, entry.position / entry.duration) : 0,
            at: entry.at || 0,
        });
    };

    movies.forEach(row => consider('movie', row));
    episodes.forEach(row => consider('episode', row));

    return out
        // Total, so the rail does not reshuffle: most recent, then by id.
        .sort((a, b) => b.at - a.at || String(a.record.id).localeCompare(String(b.record.id)))
        .slice(0, limit)
        .map(({ kind, record, position, fraction }) => ({ kind, record, position, fraction }));
}

/* ------------------------------------------------------------------ *
 * Formatting
 * ------------------------------------------------------------------ */

/**
 * A running time as `1:42:07` or `7:03`.
 *
 * Not `Intl`, deliberately: a media timecode is the same in every language and
 * `Intl.NumberFormat` would render Arabic-Indic digits for one, putting them
 * next to a colon inside an LTR container — which is precisely the bidi hazard
 * `rtl.css` isolates machine values against. A timecode is a machine value.
 */
export function timecode(seconds: number): string {
    const total = Math.max(0, Math.floor(Number(seconds) || 0));
    const hours = Math.floor(total / 3600);
    const minutes = Math.floor((total % 3600) / 60);
    const secs = total % 60;
    const pad = (value: number) => String(value).padStart(2, '0');
    return hours ? `${hours}:${pad(minutes)}:${pad(secs)}`
        : `${minutes}:${pad(secs)}`;
}

/** A duration for a card: `1h 42m`, or `42m`. Empty when there is none. */
export function runtime(seconds: number | undefined): string {
    const total = Math.floor(Number(seconds) || 0);
    if (total <= 0) return '';
    const hours = Math.floor(total / 3600);
    const minutes = Math.round((total % 3600) / 60);
    if (!hours) return `${minutes}m`;
    return minutes ? `${hours}h ${minutes}m` : `${hours}h`;
}
