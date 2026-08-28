/*
  A stand-in for `@/services/iptv.service`, aliased in by the preview's vite
  config. Nothing here talks to a network.

  IT FAKES THE PAYLOADS, NOT THE VIEW'S DECISIONS
  ===============================================

  The library, a series and the channel list come back in the shape app 38 really
  answers with — records that carry `poster_url`, `seasons`, `genres`, absent
  fields and all — and every line of the view's own resolution then runs for real:
  `heroOf` picking a featured record, `buildRails` dropping an empty shelf,
  `$td` falling back to English, `IptvCard` deciding what is playable.

  The leaderboard preview learned this the expensive way: its first version
  handed the view finished, already-titled rows, which is a shape no service
  sends, and it hid the defect the harness had been built to find. A stub kinder
  than production tests nothing.

  THE DATA IS DELIBERATELY AWKWARD
  ================================

  A 74-character title, a one-word title, an Arabic title with an English
  description, a record with no poster, a record with no video (so the card has
  to say "Coming soon" and the hero must refuse to feature it), a series with
  four seasons and one with a single episode, a channel with no logo, a channel
  with a very long name, a genre that appears once and one that appears eight
  times. Those are the cases that break a layout, and a tidy fixture never
  contains any of them.
*/
import type {
    Channel, Episode, Library, Movie, PlaybackTicket, Series,
} from '@/services/iptv.service';

/* Re-exported so the views' `import type` and `isUnreachable` keep working. */
export type {
    Channel, Episode, Library, Movie, PlaybackTicket, Season, Series,
    StreamType, TranslationMap,
} from '@/services/iptv.service';

export function isUnreachable(): boolean { return false; }
export async function iptvReplica(): Promise<string | null> { return 'preview'; }

/*
  A poster, drawn rather than fetched.

  An SVG data URL, so the harness needs no network and no checked-in binaries,
  and so a screenshot is byte-identical between runs — which is what makes two
  shots comparable at all. The hue is derived from the title, so every tile is a
  different colour without a palette being written down.
*/
function poster(title: string, ratio: '2/3' | '16/9' = '2/3'): string {
    let hash = 0;
    for (let i = 0; i < title.length; i++) hash = (hash * 31 + title.charCodeAt(i)) | 0;
    const hue = Math.abs(hash) % 360;
    const w = ratio === '2/3' ? 400 : 640;
    const h = ratio === '2/3' ? 600 : 360;
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}">`
        + `<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1">`
        + `<stop offset="0" stop-color="hsl(${hue} 55% 32%)"/>`
        + `<stop offset="1" stop-color="hsl(${(hue + 40) % 360} 60% 12%)"/>`
        + `</linearGradient></defs>`
        + `<rect width="${w}" height="${h}" fill="url(#g)"/>`
        + `<circle cx="${w * 0.7}" cy="${h * 0.3}" r="${w * 0.28}" `
        + `fill="hsl(${(hue + 90) % 360} 70% 55%)" opacity="0.28"/>`
        + `</svg>`;
    return dataUrl(svg);
}

/*
  `encodeURIComponent` DOES NOT ESCAPE PARENTHESES, and the hero would not draw.

  `heroBackdrop` in `Iptv.vue` refuses a URL containing a quote or a paren rather
  than escaping one, because the value reaches a CSS `url()` inside an inline
  style attribute - and it is right to. But every SVG here contains `hsl(...)`
  and a `url(#g)`, and `encodeURIComponent` leaves `!'()*` alone, so the stub's
  own data URLs were being refused and the hero rendered as a flat black box.

  That is worth recording rather than just fixing: the picture looked exactly like
  a scrim too heavy to see through, and the next move would have been to weaken a
  gradient that was never the problem. A stub that produces a shape the real
  service cannot produce is a stub that invents bugs as readily as it hides them.
*/
function dataUrl(svg: string): string {
    return 'data:image/svg+xml;utf8,' + encodeURIComponent(svg)
        .replace(/\(/g, '%28').replace(/\)/g, '%29').replace(/'/g, '%27');
}

function logo(name: string): string {
    let hash = 0;
    for (let i = 0; i < name.length; i++) hash = (hash * 37 + name.charCodeAt(i)) | 0;
    const hue = Math.abs(hash) % 360;
    const initials = name.split(/\s+/).slice(0, 2).map(w => w[0]).join('');
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="200" height="120">`
        + `<rect width="200" height="120" rx="10" fill="hsl(${hue} 45% 22%)"/>`
        + `<text x="100" y="76" font-family="sans-serif" font-size="46" `
        + `font-weight="bold" text-anchor="middle" fill="hsl(${hue} 80% 72%)">`
        + `${initials}</text></svg>`;
    return dataUrl(svg);
}

const DAY = 24 * 3600 * 1000;
const ago = (days: number) => new Date(Date.now() - days * DAY).toISOString();

const GENRES = ['Documentary', 'Drama', 'Science', 'History', 'Comedy',
                'Technology', 'Nature'];

function movie(n: number, title: string, extra: Partial<Movie> = {}): Movie {
    return {
        id: `m${n}`,
        kind: 'movie',
        title,
        description: 'A description of roughly the length an operator actually '
            + 'types, which is long enough to need clamping on a phone and short '
            + 'enough to fit on a desktop hero without one.',
        year: 2014 + (n % 12),
        duration_seconds: 3600 + (n * 431) % 5400,
        rating: ['PG', 'PG-13', '12A', 'U'][n % 4],
        genres: [GENRES[n % GENRES.length], GENRES[(n + 3) % GENRES.length]],
        poster_url: poster(title),
        backdrop_url: poster(title, '16/9'),
        video_asset: `asset-m${n}`,
        published: true,
        created_at: ago(n * 2),
        ...extra,
    };
}

const MOVIES: Movie[] = [
    /* The hero: featured, playable, with a backdrop and a real synopsis. */
    movie(1, 'The Cartography of Small Rivers', {
        featured: true,
        created_at: ago(1),
        description: 'Four hydrologists spend a summer walking the length of a '
            + 'river nobody has mapped since 1908, and find that most of it is no '
            + 'longer where the map says it is.',
        genres: ['Documentary', 'Nature', 'Science'],
    }),
    movie(2, 'Signal'),
    movie(3, 'A Very Long Film Title That Has No Business Being This Long At All'),
    /* No poster: the card has to fall back to the initial. */
    movie(4, 'Quiet Hours', { poster_url: '', backdrop_url: '' }),
    /* No video: "Coming soon", and `heroOf` must refuse to feature it. */
    movie(5, 'Not Yet Uploaded', { video_asset: '', featured: true }),
    /* An Arabic title with an English description - the normal state of a
       partly-translated catalogue, and the case that puts an LTR paragraph
       inside an RTL card. */
    movie(6, 'The Bread Makers', {
        translations: { ar: { title: 'صانعو الخبز' }, zh: { title: '面包师' } },
    }),
    movie(7, 'Orbit'),
    movie(8, 'The Second Kitchen'),
    movie(9, 'Winter Count', { created_at: ago(3) }),
    movie(10, 'Thirty Two Bridges'),
    movie(11, 'The Glasshouse'),
    movie(12, 'Late Return', { created_at: ago(2) }),
];

function episode(seriesId: string, season: number, n: number,
                 extra: Partial<Episode> = {}): Episode {
    const title = ['The Arrival', 'Ground Truth', 'A Longer Episode Title Than Anybody Expected',
                   'Downstream', 'The Gauge', 'Silt'][n % 6];
    return {
        id: `${seriesId}-s${season}e${n}`,
        kind: 'episode',
        series_id: seriesId,
        season,
        episode: n,
        title,
        description: 'What happens in this episode, in about the number of words '
            + 'an operator types when they are being conscientious about it.',
        duration_seconds: 1500 + (n * 137) % 900,
        air_date: ago(60 - n * 3).slice(0, 10),
        thumb_url: poster(`${seriesId}${season}${n}`, '16/9'),
        video_asset: `asset-${seriesId}-${season}-${n}`,
        published: true,
        ...extra,
    };
}

const S1_EPISODES: Episode[] = [
    ...[1, 2, 3, 4, 5, 6].map(n => episode('s1', 1, n)),
    ...[1, 2, 3, 4].map(n => episode('s1', 2, n)),
    ...[1, 2, 3].map(n => episode('s1', 3, n)),
    /* The last season is still going out: two published, one not. */
    episode('s1', 4, 1),
    episode('s1', 4, 2),
    episode('s1', 4, 3, { video_asset: '' }),
];

function series(n: number, title: string, extra: Partial<Series> = {}): Series {
    return {
        id: `s${n}`,
        kind: 'series',
        title,
        description: 'A series description, which on the hero is clamped to three '
            + 'lines and on a card is not shown at all.',
        year: 2016 + (n % 9),
        rating: ['PG', '12A', 'U'][n % 3],
        genres: [GENRES[(n + 1) % GENRES.length], GENRES[(n + 4) % GENRES.length]],
        poster_url: poster(title),
        backdrop_url: poster(title, '16/9'),
        seasons: [{ season: 1, episode_count: 6, published_count: 6 }],
        published: true,
        created_at: ago(n * 4),
        ...extra,
    };
}

const SERIES: Series[] = [
    series(1, 'The River Survey', {
        created_at: ago(4),
        seasons: [
            { season: 1, episode_count: 6, published_count: 6 },
            { season: 2, episode_count: 4, published_count: 4 },
            { season: 3, episode_count: 3, published_count: 3 },
            { season: 4, episode_count: 3, published_count: 2 },
        ],
        description: 'Sixteen episodes across four seasons, following one survey '
            + 'team through four summers and two floods.',
    }),
    series(2, 'Kitchens'),
    series(3, 'A Series Whose Title Is Also Unreasonably Long For One Line'),
    /* Nothing published yet: the card says "Coming soon". */
    series(4, 'Announced Only', {
        seasons: [{ season: 1, episode_count: 8, published_count: 0 }],
    }),
    series(5, 'Signals and Noise', { poster_url: '' }),
    series(6, 'The Night Shift'),
    series(7, 'Fieldwork'),
];

const CHANNELS: Channel[] = [
    { id: 'c1', name: 'Self Study News', tagline: 'Hourly world news',
      category: 'News', country: 'JO', stream_url: 'about:blank',
      stream_type: 'hls', logo: logo('Self Study News'), published: true },
    { id: 'c2', name: 'RT Arabic', tagline: 'أخبار على مدار الساعة',
      category: 'News', country: 'RU', stream_url: 'about:blank',
      stream_type: 'hls', logo: logo('RT Arabic'), published: true },
    /* No logo: the initial has to carry the tile. */
    { id: 'c3', name: 'Al Jazeera Documentary', category: 'Documentary',
      country: 'QA', stream_url: 'about:blank', stream_type: 'hls',
      published: true },
    { id: 'c4', name: 'A Channel With A Name Far Too Long For Any Tile',
      tagline: 'It wraps, and it must not push the tile wider',
      category: 'Documentary', country: 'GB', stream_url: 'about:blank',
      stream_type: 'hls', logo: logo('Long Name'), published: true },
    { id: 'c5', name: 'Science Now', tagline: 'Research, explained',
      category: 'Science', country: 'US', stream_url: 'about:blank',
      stream_type: 'hls', logo: logo('Science Now'), published: true },
    { id: 'c6', name: 'Kids One', category: 'Kids', country: 'JO',
      stream_url: 'about:blank', stream_type: 'hls', logo: logo('Kids One'),
      published: true },
    { id: 'c7', name: 'Sport 1', category: 'Sport', country: 'FR',
      stream_url: 'about:blank', stream_type: 'hls', logo: logo('Sport 1'),
      published: true },
    { id: 'c8', name: 'Sport 2', category: 'Sport', country: 'FR',
      stream_url: 'about:blank', stream_type: 'hls', logo: logo('Sport 2'),
      published: true },
    /* No category at all, so `byCategory` has to bucket it under "Other". */
    { id: 'c9', name: 'Test Card', stream_url: 'about:blank',
      stream_type: 'hls', logo: logo('Test Card'), published: true },
    { id: 'c10', name: 'Cinema Classics', category: 'Films', country: 'IT',
      stream_url: 'about:blank', stream_type: 'hls',
      logo: logo('Cinema Classics'), published: true },
    { id: 'c11', name: 'History Hour', category: 'Documentary', country: 'DE',
      stream_url: 'about:blank', stream_type: 'hls', logo: logo('History Hour'),
      published: true },
    { id: 'c12', name: 'Music Box', category: 'Music', country: 'LB',
      stream_url: 'about:blank', stream_type: 'hls', logo: logo('Music Box'),
      published: true },
];

const LIBRARY: Library = {
    movies: MOVIES,
    series: SERIES,
    channels: CHANNELS,
    counts: {
        movies: MOVIES.length, series: SERIES.length,
        channels: CHANNELS.length, episodes: S1_EPISODES.length,
    },
    episode_parts: {},
    generated_at: new Date().toISOString(),
};

/*
  `?state=` puts the harness into the states that are otherwise only reachable by
  breaking production: `empty` is a fresh deployment, `down` is a cold or dead
  replica, `slow` holds the loading skeleton on screen. All three have their own
  layout and all three are the ones nobody ever looks at.
*/
const state = new URLSearchParams(location.search).get('state') || '';

function delay<T>(value: T): Promise<T> {
    if (state === 'slow') return new Promise(() => { /* never settles */ });
    return Promise.resolve(value);
}

const EMPTY: Library = {
    movies: [], series: [], channels: [], counts: {}, episode_parts: {},
};

export const iptvService = {
    async library(): Promise<Library> {
        return delay(state === 'empty' ? EMPTY : LIBRARY);
    },
    async librarySafe(): Promise<{ library: Library; error: string | null }> {
        if (state === 'down') {
            return delay({
                library: EMPTY,
                error: 'Self Study TV is not answering. Try again in a moment.',
            });
        }
        return delay({ library: state === 'empty' ? EMPTY : LIBRARY, error: null });
    },
    async movies(): Promise<Movie[]> { return delay(MOVIES); },
    async movie(id: string): Promise<Movie> {
        return delay(MOVIES.find(row => row.id === id) || MOVIES[0]);
    },
    async seriesList(): Promise<Series[]> { return delay(SERIES); },
    async getSeries(id: string): Promise<Series> {
        const found = SERIES.find(row => row.id === id) || SERIES[0];
        /* Handed back SHUFFLED, because app 38's order is not something a client
           may assume - and `inOrder()` is what the views run over it. */
        const episodes = found.id === 's1'
            ? [...S1_EPISODES].reverse()
            : [1, 2, 3, 4, 5, 6].map(n => episode(found.id, 1, n));
        return delay({ ...found, episodes });
    },
    async episodes(id: string): Promise<Episode[]> {
        return delay((await this.getSeries(id)).episodes || []);
    },
    async channels(): Promise<{ channels: Channel[]; categories: string[] }> {
        if (state === 'empty') return delay({ channels: [], categories: [] });
        return delay({
            channels: CHANNELS,
            categories: [...new Set(CHANNELS.map(c => c.category || 'Other'))],
        });
    },
    async ticket(assetId: string): Promise<PlaybackTicket> {
        /* No bytes anywhere: the point of the harness is the page around the
           player, and a real film would make every screenshot a different frame. */
        return delay({
            asset_id: assetId, ticket: 'preview', url: '', expires_in: 600,
            size: 0, mime: 'video/mp4',
        });
    },
    async search(query: string): Promise<Array<{ kind: string; record: any }>> {
        const text = query.trim().toLowerCase();
        const hit = (row: any) => String(row.title || row.name || '')
            .toLowerCase().includes(text);
        return delay([
            ...MOVIES.filter(hit).map(record => ({ kind: 'movie', record })),
            ...SERIES.filter(hit).map(record => ({ kind: 'series', record })),
            ...CHANNELS.filter(hit).map(record => ({ kind: 'channel', record })),
        ]);
    },
};
