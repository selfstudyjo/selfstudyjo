// src/services/iptv.service.ts
//
// Client for Self Study IPTV (app 38) — free television: films, series with
// their episodes, and live channels.
//
// THREE THINGS MAKE THIS CLIENT DIFFERENT FROM THE OTHERS HERE
// ============================================================
//
// 1. **Nothing in the app writes to it.** The library is managed from
//    selfstudyadmin; this side is reads only. So there is no create, no update
//    and no delete here, and no `X-User-ID` either — a viewer is not the owner
//    of anything.
//
// 2. **Media arrives as a READY-TO-USE URL with a ticket in it.** A `<video>`
//    element cannot send an `Authorization` header, and the platform's usual
//    answer — fetch with the token and hand back an object URL, which
//    `attachmentUrl` does in the user-chat client — does not survive being
//    applied to a film: it means the whole file in the tab's memory before the
//    first frame, and no seeking. So app 38 mints a short-lived, asset-scoped
//    ticket and the record carries `video_url` / `poster_url` already signed.
//    **Nothing here builds a media URL**, and nothing should: the service token
//    must never appear in a URL.
//
// 3. **A ticket EXPIRES, so a page left open needs a fresh one.** `ticket()` is
//    what the player calls at the moment somebody presses play. A URL captured
//    when the grid was drawn is fine for a poster and wrong for a film somebody
//    starts watching two hours later — which would look like the video being
//    broken rather than like a credential having lapsed.
//
// THE REPLICA IS PINNED, THROUGH THE SHARED HELPER
// ================================================
//
// `serviceRegistry.getRandomIptvReplica()` — not a local `Math.random()` over
// the replica list. Working rule 31: nine services wrote their own wrapper and
// every one of them dropped the `appId` that applies the pin, and
// `runbook.service.ts` did worse and inlined the random pick under a name that
// looked like the shared helper. Here it matters twice over: a playback ticket
// is verified by whichever replica the `<video>` element talks to, and a
// mid-film hop to a replica whose clock or config differs is a video that stops.

import { ApiError, apiService, withReplicas } from './api';
import { serviceRegistry } from './config';

export const IPTV_APP_ID = parseInt(import.meta.env.VITE_IPTV_APP_ID || '38');

/** How a live channel is delivered. The player branches on this. */
export type StreamType = 'hls' | 'dash' | 'mp4' | 'webm';

/**
 * The per-language copies of a record's own text.
 *
 * English is the record's own `title` / `description` and is NOT in here — see
 * working rule 41. That is what makes this additive: a replica that has not
 * pulled the field omits the key, `$td` falls back to the English, and the page
 * renders exactly as it did before.
 */
export interface TranslationMap {
    [locale: string]: { [field: string]: string };
}

interface MediaRecord {
    id: string;
    title?: string;
    description?: string;
    translations?: TranslationMap;
    published?: boolean;
    featured?: boolean;
    created_at?: string;
    updated_at?: string;
}

export interface Movie extends MediaRecord {
    kind?: 'movie';
    year?: number;
    duration_seconds?: number;
    rating?: string;
    language?: string;
    country?: string;
    genres?: string[];
    cast?: string[];
    video_asset?: string;
    poster_asset?: string;
    backdrop_asset?: string;
    /** Signed and ready for a `<video src>`. Empty when there is no video yet. */
    video_url?: string;
    poster_url?: string;
    backdrop_url?: string;
}

export interface Season {
    season: number;
    episode_count: number;
    published_count?: number;
}

export interface Series extends MediaRecord {
    kind?: 'series';
    year?: number;
    rating?: string;
    language?: string;
    country?: string;
    genres?: string[];
    cast?: string[];
    poster_asset?: string;
    backdrop_asset?: string;
    poster_url?: string;
    backdrop_url?: string;
    /** Derived by the service from the episodes, so the tabs cannot disagree. */
    seasons?: Season[];
    /** Present only on `getSeries()`, which returns the series page in one call. */
    episodes?: Episode[];
}

export interface Episode extends MediaRecord {
    kind?: 'episode';
    series_id: string;
    season: number;
    episode: number;
    duration_seconds?: number;
    air_date?: string;
    video_asset?: string;
    thumb_asset?: string;
    video_url?: string;
    thumb_url?: string;
}

export interface Channel {
    id: string;
    kind?: 'channel';
    /**
     * A broadcaster's own name, and deliberately NOT translatable — Al Jazeera
     * is *the* name, not a label. `tagline` is ours to write and is.
     */
    name: string;
    tagline?: string;
    translations?: TranslationMap;
    category?: string;
    language?: string;
    country?: string;
    stream_url: string;
    stream_type: StreamType;
    /** A stored logo if there is one, else the linked one. Resolved by the API. */
    logo?: string;
    logo_url?: string;
    epg_url?: string;
    order?: number;
    published?: boolean;
    featured?: boolean;
}

export interface Library {
    movies: Movie[];
    series: Series[];
    channels: Channel[];
    counts: { movies?: number; series?: number; episodes?: number; channels?: number };
    episode_parts: Record<string, number>;
    generated_at?: string;
}

export interface PlaybackTicket {
    asset_id: string;
    ticket: string;
    url: string;
    expires_in: number;
    size: number;
    mime: string;
}

/**
 * An empty library, used whenever app 38 cannot be reached.
 *
 * Returned rather than thrown from `library()` on purpose: this is a free page
 * a signed-out visitor can land on, and the difference between "we could not
 * reach the service" and "there is nothing here yet" belongs to the VIEW, which
 * shows a retry for the first and an explanation for the second. A thrown error
 * inside a home screen that draws three rails takes all three down.
 */
function emptyLibrary(): Library {
    return { movies: [], series: [], channels: [], counts: {}, episode_parts: {} };
}

class IptvService {
    /**
     * Everything a home screen needs, in one call.
     *
     * One request rather than three because the page draws films, series and
     * channels at once, and three round trips against a replica whose first
     * answer of the day is ~20 seconds is a page that looks broken for a minute.
     * Episodes are deliberately not in it: a library with 20,000 of them is
     * megabytes on every load and no screen shows more than one series' worth.
     */
    async library(): Promise<Library> {
        const payload = await withReplicas(IPTV_APP_ID, 'iptv', (base) =>
            apiService.get<Library>(base, '/api/iptv/library/'));
        return {
            ...emptyLibrary(),
            ...payload,
            movies: payload.movies || [],
            series: payload.series || [],
            channels: payload.channels || [],
        };
    }

    /** The same, but never throwing. For a public page that must still render. */
    async librarySafe(): Promise<{ library: Library; error: string | null }> {
        try {
            return { library: await this.library(), error: null };
        } catch (error) {
            return {
                library: emptyLibrary(),
                error: error instanceof Error ? error.message
                    : 'Self Study TV could not be reached.',
            };
        }
    }

    async movies(): Promise<Movie[]> {
        const payload = await withReplicas(IPTV_APP_ID, 'iptv', (base) =>
            apiService.get<{ results: Movie[] }>(base, '/api/iptv/movies/'));
        return payload.results || [];
    }

    async movie(movieId: string): Promise<Movie> {
        return withReplicas(IPTV_APP_ID, 'iptv', (base) =>
            apiService.get<Movie>(
                base, `/api/iptv/movies/${encodeURIComponent(movieId)}/`));
    }

    async seriesList(): Promise<Series[]> {
        const payload = await withReplicas(IPTV_APP_ID, 'iptv', (base) =>
            apiService.get<{ results: Series[] }>(base, '/api/iptv/series/'));
        return payload.results || [];
    }

    /**
     * One series with its episodes, in running order.
     *
     * The episodes come WITH the series here and only here, because the series
     * page draws both at once — it is the one place the second request would be
     * for something the reader is already looking at. The order is the
     * service's: app 19 taught this lesson expensively, where nineteen of twenty
     * courses came back with their lessons reversed and the *client* was doing
     * index arithmetic over that array, so Next walked backwards through the
     * syllabus.
     */
    async getSeries(seriesId: string): Promise<Series> {
        return withReplicas(IPTV_APP_ID, 'iptv', (base) =>
            apiService.get<Series>(
                base, `/api/iptv/series/${encodeURIComponent(seriesId)}/`));
    }

    async episodes(seriesId: string): Promise<Episode[]> {
        const payload = await withReplicas(IPTV_APP_ID, 'iptv', (base) =>
            apiService.get<{ results: Episode[] }>(
                base,
                `/api/iptv/series/${encodeURIComponent(seriesId)}/episodes/`));
        return payload.results || [];
    }

    async channels(category?: string): Promise<{ channels: Channel[]; categories: string[] }> {
        const query = category ? `?category=${encodeURIComponent(category)}` : '';
        const payload = await withReplicas(IPTV_APP_ID, 'iptv', (base) =>
            apiService.get<{ results: Channel[]; categories: string[] }>(
                base, `/api/iptv/channels/${query}`));
        return {
            channels: payload.results || [],
            categories: payload.categories || [],
        };
    }

    /**
     * A fresh playback URL for one asset.
     *
     * Called at the moment somebody presses play, not when the grid was drawn.
     * A ticket lasts hours rather than for ever, so a URL captured on page load
     * is dead by the evening — and the symptom is a player that spins, which
     * reads as the film being broken rather than as a credential having lapsed.
     */
    async ticket(assetId: string): Promise<PlaybackTicket> {
        return withReplicas(IPTV_APP_ID, 'iptv', (base) =>
            apiService.get<PlaybackTicket>(
                base, `/api/iptv/assets/${encodeURIComponent(assetId)}/ticket/`));
    }

    /**
     * Search across films, series and channels.
     *
     * Server-side rather than filtering the loaded library, because a reader who
     * searches expects to find something that is not on the rail in front of
     * them — and because app 38 matches EVERY language a record carries, not
     * only the one being rendered. A reader looking at an Arabic library types
     * Arabic; the same person coming back after switching the interface types
     * English, and a search that only matched the rendered language would
     * silently stop finding things when a setting changed.
     */
    async search(query: string): Promise<Array<{ kind: string; record: any }>> {
        const trimmed = (query || '').trim();
        if (!trimmed) return [];
        const payload = await withReplicas(IPTV_APP_ID, 'iptv', (base) =>
            apiService.get<{ results: Array<{ kind: string; record: any }> }>(
                base, `/api/iptv/search/?q=${encodeURIComponent(trimmed)}`));
        return payload.results || [];
    }
}

export const iptvService = new IptvService();

/**
 * Is this an "app 38 is unreachable" failure rather than a refusal?
 *
 * Worth telling apart on a public page: unreachable means "try again", and a
 * 404 means the film really is not there. Offering Retry on the second is a
 * button that cannot work, which is what `/exam-approval` used to do with a
 * missing id.
 */
export function isUnreachable(error: unknown): boolean {
    if (!(error instanceof ApiError)) return false;
    return !error.status || error.status >= 500 || error.status === 503;
}

/** The registry helper, re-exported so a view never reaches for it directly. */
export async function iptvReplica(): Promise<string | null> {
    return serviceRegistry.getRandomIptvReplica();
}
