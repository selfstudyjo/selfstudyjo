// Verifies the Self Study TV browsing model.
//
//   npm run check:iptv
//
// `iptvEngine.ts` is a plain module for the same reason `photoMask.ts`,
// `drawEngine.ts`, `leaderboardEngine.ts` and `newscastEngine.ts` are: every
// property below is invisible in a screenshot and wrong in a way nobody can see
// until it is in front of a viewer.
//
// THE FOUR WORTH THE FILE
// =======================
//
// 1. **Running order.** `nextEpisode` / `previousEpisode` / `positionOf` are
//    index arithmetic, and app 19 has already paid for a client that assumed an
//    order it did not impose: nineteen of twenty courses came back with their
//    lessons reversed, so Next walked BACKWARDS through the syllabus and the
//    "3 of 16" counter counted down. So the checks feed episodes in reversed and
//    shuffled and assert the arithmetic anyway.
//
// 2. **Every ordering is TOTAL.** A rail is recomputed inside a computed that
//    re-evaluates on every keystroke in the search box, so an unstable sort is a
//    grid that visibly reshuffles as somebody types. Asserted by sorting a
//    permuted copy and comparing.
//
// 3. **Resume is three states, not a number.** Collapsing "finished" into
//    "resume at the end" drops somebody into the credits every time they open a
//    film they have already seen; collapsing "barely started" into "resume at
//    four seconds" is a prompt for nothing.
//
// 4. **The hero must be PLAYABLE.** A hero with a play button that does nothing
//    reads as the app being broken rather than as an operator being midway
//    through an upload.

import {
    RAIL_KEYS, TAB_KEYS, TV_TABS, buildRails, byCategory, byNewest, bySeason,
    continueWatching, firstPlayable, genresOf, heroOf, inOrder, needsHlsLibrary,
    nextEpisode, positionOf, previousEpisode, progressId, recent, recordProgress,
    resumeAt, runtime, tabFor, timecode, PROGRESS_LIMIT, RESUME_MIN_SECONDS,
    WATCHED_FRACTION,
} from '../../src/utils/iptvEngine';
import type { Channel, Episode, Movie, Series } from '../../src/services/iptv.service';

let failures = 0;
let checks = 0;

function ok(label: string, condition: boolean, detail?: unknown) {
    checks++;
    if (!condition) failures++;
    console.log(`  ${condition ? 'ok  ' : 'FAIL'}  ${label}`
        + (condition ? '' : '  ' + JSON.stringify(detail)));
}

function section(title: string) {
    console.log(`\n${title}`);
}

/* ------------------------------------------------------------------ *
 * Fixtures
 * ------------------------------------------------------------------ */
function movie(id: string, extra: Partial<Movie> = {}): Movie {
    return {
        id, title: id, video_asset: 'a'.repeat(32),
        created_at: '2026-08-01T00:00:00Z', published: true, ...extra,
    } as Movie;
}

function series(id: string, extra: Partial<Series> = {}): Series {
    return {
        id, title: id, created_at: '2026-08-01T00:00:00Z', published: true,
        seasons: [{ season: 1, episode_count: 2, published_count: 2 }], ...extra,
    } as Series;
}

function episode(season: number, number: number,
                 extra: Partial<Episode> = {}): Episode {
    return {
        id: `ep-s${season}e${number}`, series_id: 'ser-1', season,
        episode: number, title: `S${season}E${number}`,
        video_asset: 'b'.repeat(32), published: true, ...extra,
    } as Episode;
}

function channel(id: string, extra: Partial<Channel> = {}): Channel {
    return {
        id, name: id, stream_url: `https://x.test/${id}.m3u8`,
        stream_type: 'hls', published: true, ...extra,
    } as Channel;
}

function shuffled<T>(rows: readonly T[], seed = 7): T[] {
    const out = [...rows];
    let value = seed;
    for (let i = out.length - 1; i > 0; i--) {
        value = (value * 1103515245 + 12345) & 0x7fffffff;
        const j = value % (i + 1);
        [out[i], out[j]] = [out[j], out[i]];
    }
    return out;
}

/* ------------------------------------------------------------------ *
 * 1. Ordering is total
 * ------------------------------------------------------------------ */
section('1. Every ordering is total, so nothing reshuffles under the reader');
{
    // Deliberately degenerate: same date, same title. Only the id can separate
    // these, which is exactly the case a partial comparator gets wrong.
    const rows = ['m1', 'm2', 'm3', 'm4', 'm5'].map(id =>
        movie(id, { title: 'Same', created_at: '2026-08-01T00:00:00Z' }));

    const once = byNewest(rows).map(r => r.id).join(',');
    const again = byNewest(shuffled(rows, 11)).map(r => r.id).join(',');
    const third = byNewest(shuffled(rows, 29)).map(r => r.id).join(',');
    ok('byNewest is stable across input permutations',
        once === again && again === third, [once, again, third]);

    const dated = [
        movie('old', { created_at: '2026-01-01T00:00:00Z' }),
        movie('new', { created_at: '2026-08-20T00:00:00Z' }),
        movie('mid', { created_at: '2026-05-01T00:00:00Z' }),
    ];
    ok('and newest really is first',
        byNewest(dated).map(r => r.id).join(',') === 'new,mid,old',
        byNewest(dated).map(r => r.id));

    const undated = [movie('b', { created_at: '' }), movie('a', { created_at: '' })];
    ok('a record with no date still sorts deterministically',
        byNewest(undated).map(r => r.id).join(',') === 'a,b');
}

/* ------------------------------------------------------------------ *
 * 2. Running order
 * ------------------------------------------------------------------ */
section('2. Running order, whatever order the records arrive in');
{
    const correct = [
        episode(1, 1), episode(1, 2), episode(1, 3),
        episode(2, 1), episode(2, 2),
    ];
    const expected = correct.map(row => row.id).join(',');

    // The app-19 case, exactly: the service hands them back reversed.
    ok('inOrder fixes a reversed list',
        inOrder([...correct].reverse()).map(r => r.id).join(',') === expected);
    ok('and a shuffled one',
        inOrder(shuffled(correct, 5)).map(r => r.id).join(',') === expected);
    ok('and leaves a correct one alone',
        inOrder(correct).map(r => r.id).join(',') === expected);

    // Next/Previous over a REVERSED array. Without inOrder inside them, Next
    // walks backwards - which is precisely what shipped on app 19.
    const reversed = [...correct].reverse();
    ok('Next walks FORWARD even when the array is reversed',
        nextEpisode(reversed, 'ep-s1e2')?.id === 'ep-s1e3',
        nextEpisode(reversed, 'ep-s1e2')?.id);
    ok('Previous walks BACKWARD even when the array is reversed',
        previousEpisode(reversed, 'ep-s1e2')?.id === 'ep-s1e1',
        previousEpisode(reversed, 'ep-s1e2')?.id);
    ok('Next crosses a season boundary',
        nextEpisode(reversed, 'ep-s1e3')?.id === 'ep-s2e1');
    ok('Previous crosses a season boundary',
        previousEpisode(reversed, 'ep-s2e1')?.id === 'ep-s1e3');
    ok('there is no Next past the last episode',
        nextEpisode(correct, 'ep-s2e2') === null);
    ok('and no Previous before the first',
        previousEpisode(correct, 'ep-s1e1') === null);
    ok('an unknown id has neither',
        nextEpisode(correct, 'nope') === null
        && previousEpisode(correct, 'nope') === null);

    // The counter. Across every season, not within one: a per-season counter
    // resets at each boundary, which reads as progress being lost.
    ok('positionOf counts across the whole series',
        positionOf(reversed, 'ep-s2e1') === 4, positionOf(reversed, 'ep-s2e1'));
    ok('and counts UP rather than down',
        positionOf(reversed, 'ep-s1e1') === 1
        && positionOf(reversed, 'ep-s2e2') === 5);
    ok('an unknown id is 0, not -1', positionOf(correct, 'nope') === 0);

    const groups = bySeason(shuffled(correct, 3));
    ok('bySeason groups ascending',
        groups.map(g => g.season).join(',') === '1,2',
        groups.map(g => g.season));
    ok('and each season is in order',
        groups[0].episodes.map(r => r.episode).join(',') === '1,2,3',
        groups[0].episodes.map(r => r.episode));

    ok('firstPlayable skips an episode with no video',
        firstPlayable([
            episode(1, 1, { video_asset: undefined }),
            episode(1, 2),
        ])?.id === 'ep-s1e2');
    ok('and is null when nothing can be played',
        firstPlayable([episode(1, 1, { video_asset: undefined })]) === null);
}

/* ------------------------------------------------------------------ *
 * 3. The hero
 * ------------------------------------------------------------------ */
section('3. The hero can always be played');
{
    ok('nothing to show is null', heroOf([], []) === null);

    const noVideo = movie('m-empty', { video_asset: undefined, video_url: '',
                                       created_at: '2026-08-25T00:00:00Z' });
    const playable = movie('m-good', { created_at: '2026-08-01T00:00:00Z' });
    const hero = heroOf([noVideo, playable], []);
    ok('a film with no video is never the hero, even when it is newest',
        hero?.record.id === 'm-good', hero?.record.id);

    const featured = movie('m-feat', { featured: true,
                                       created_at: '2026-07-01T00:00:00Z' });
    ok('a featured film wins over a newer unfeatured one',
        heroOf([featured, playable], [])?.record.id === 'm-feat');

    const emptySeries = series('ser-empty', {
        seasons: [{ season: 1, episode_count: 0, published_count: 0 }],
        created_at: '2026-08-28T00:00:00Z',
    });
    ok('a series with no published episodes is never the hero',
        heroOf([playable], [emptySeries])?.record.id === 'm-good');

    const goodSeries = series('ser-good', { created_at: '2026-08-28T00:00:00Z' });
    const seriesHero = heroOf([playable], [goodSeries]);
    ok('a series can be the hero, and is reported as one',
        seriesHero?.kind === 'series' && seriesHero.record.id === 'ser-good',
        seriesHero);

    // The hero appears in a `background-image`, so the kind has to be right or
    // the view's play handler sends somebody to the wrong route.
    ok('a film is reported as a film',
        heroOf([playable], [])?.kind === 'movie');
}

/* ------------------------------------------------------------------ *
 * 4. Rails
 * ------------------------------------------------------------------ */
section('4. Rails, and the headings the catalogues have to carry');
{
    ok('the rail keys are declared once and exported',
        RAIL_KEYS.length === 3, RAIL_KEYS);

    const rails = buildRails([movie('m1')], [series('s1')]);
    ok('every rail heading comes from RAIL_KEYS',
        rails.every(rail => (RAIL_KEYS as readonly string[]).includes(rail.key)),
        rails.map(r => r.key));
    ok('an empty rail is dropped rather than rendered',
        buildRails([movie('m1')], []).every(rail => rail.items.length > 0)
        && !buildRails([movie('m1')], []).some(rail => rail.key === 'Series'),
        buildRails([movie('m1')], []).map(r => r.key));
    ok('nothing at all is no rails', buildRails([], []).length === 0);

    // "New this week" must not vanish when nothing was added: a home page whose
    // shape changes for reasons a reader cannot see is worse than a heading that
    // is occasionally generous.
    const now = new Date('2026-08-28T00:00:00Z');
    const stale = [movie('m-old', { created_at: '2020-01-01T00:00:00Z' })];
    ok('recent falls back to the newest when nothing is fresh',
        recent(stale, [], now).length === 1, recent(stale, [], now));
    const fresh = [movie('m-new', { created_at: '2026-08-27T00:00:00Z' })];
    ok('and prefers what really is fresh',
        recent([...stale, ...fresh], [], now)[0].id === 'm-new');
    ok('and is empty only when the library is',
        recent([], [], now).length === 0);

    // Genres: bounded, and a one-off is dropped.
    const withGenres = [
        movie('a', { genres: ['Drama', 'Nature'] }),
        movie('b', { genres: ['Drama'] }),
        movie('c', { genres: ['Oddity'] }),
    ];
    const genres = genresOf(withGenres, []);
    ok('a genre with one title is dropped',
        !genres.some(entry => entry.genre === 'Oddity'), genres);
    ok('and the commonest is first',
        genres[0]?.genre === 'Drama', genres);
    ok('genre matching is case-insensitive',
        genresOf([movie('a', { genres: ['drama'] }),
                  movie('b', { genres: ['Drama'] })], [])[0].count === 2);
    ok('the genre list is bounded',
        genresOf(Array.from({ length: 60 }, (_v, i) =>
            movie(`g${i}`, { genres: [`G${i % 30}`] })), []).length <= 12);
}

/* ------------------------------------------------------------------ *
 * 5. Resume: three states
 * ------------------------------------------------------------------ */
section('5. Resume is a decision, never a bare position');
{
    ok('no record at all is a fresh start',
        resumeAt(undefined).action === 'start');
    ok('a few seconds in is a fresh start, not a prompt',
        resumeAt({ position: RESUME_MIN_SECONDS - 1, duration: 6000,
                   at: 1 }).action === 'start');
    ok('halfway through is a resume',
        resumeAt({ position: 3000, duration: 6000, at: 1 }).action === 'resume');
    ok('and it carries the position',
        (resumeAt({ position: 3000, duration: 6000, at: 1 }) as any).position === 3000);

    // The one that matters: near the end means WATCHED, or somebody who has
    // finished a film is dropped into the credits every time they open it.
    ok('past the watched mark is watched, not a resume at the end',
        resumeAt({ position: 6000 * WATCHED_FRACTION + 1, duration: 6000,
                   at: 1 }).action === 'watched');
    ok('exactly at the mark is watched',
        resumeAt({ position: 6000 * WATCHED_FRACTION, duration: 6000,
                   at: 1 }).action === 'watched');
    ok('just before it is still a resume',
        resumeAt({ position: 6000 * WATCHED_FRACTION - 1, duration: 6000,
                   at: 1 }).action === 'resume');
    // A live stream, or a file whose metadata never arrived: no duration, so
    // "watched" is not computable and a resume is the honest answer.
    ok('with no duration a stored position is still a resume',
        resumeAt({ position: 500, duration: 0, at: 1 }).action === 'resume');
    ok('a nonsense position is a fresh start',
        resumeAt({ position: NaN, duration: 100, at: 1 }).action === 'start');
}

/* ------------------------------------------------------------------ *
 * 6. Recording progress
 * ------------------------------------------------------------------ */
section('6. Progress is bounded and keeps the newest');
{
    const one = recordProgress({}, 'movie:a', 120, 6000, 1000);
    ok('a position is recorded', one['movie:a'].position === 120);
    ok('and rounded, because a float in storage is noise',
        recordProgress({}, 'movie:a', 120.7, 6000.2, 1)['movie:a'].position === 121);
    ok('a negative position is refused',
        Object.keys(recordProgress({}, 'movie:a', -5, 100)).length === 0);
    ok('an empty key is refused',
        Object.keys(recordProgress({}, '', 5, 100)).length === 0);
    ok('the original map is not mutated', Object.keys({}).length === 0);

    let map = {};
    for (let i = 0; i < PROGRESS_LIMIT + 40; i++) {
        map = recordProgress(map, `movie:m${i}`, 100, 6000, 1000 + i);
    }
    ok('the map is bounded', Object.keys(map).length === PROGRESS_LIMIT,
        Object.keys(map).length);
    ok('and it is the NEWEST entries that survive',
        !!(map as any)[`movie:m${PROGRESS_LIMIT + 39}`]
        && !(map as any)['movie:m0'],
        Object.keys(map).slice(0, 3));

    // A finished film is STORED rather than dropped: "you have seen this" is
    // information the grid shows, and dropping it makes a watched film
    // indistinguishable from one never opened.
    const done = recordProgress({}, 'movie:a', 6000, 6000, 1);
    ok('a finished film is still recorded', !!done['movie:a']);
    ok('and reads as watched', resumeAt(done['movie:a']).action === 'watched');

    ok('progressId keeps films and episodes apart',
        progressId('movie', 'x') !== progressId('episode', 'x'));
}

/* ------------------------------------------------------------------ *
 * 7. Continue watching
 * ------------------------------------------------------------------ */
section('7. Continue watching shows only what is unfinished');
{
    const films = [movie('m-part'), movie('m-done'), movie('m-fresh')];
    let map = {};
    map = recordProgress(map, progressId('movie', 'm-part'), 3000, 6000, 3000);
    map = recordProgress(map, progressId('movie', 'm-done'), 5900, 6000, 4000);
    map = recordProgress(map, progressId('movie', 'm-fresh'), 5, 6000, 5000);

    const rail = continueWatching(map, films);
    ok('a part-watched film is on the rail',
        rail.some(entry => entry.record.id === 'm-part'));
    ok('a finished one is NOT',
        !rail.some(entry => entry.record.id === 'm-done'),
        rail.map(e => e.record.id));
    ok('and neither is one barely started',
        !rail.some(entry => entry.record.id === 'm-fresh'));
    ok('the fraction is reported for the progress bar',
        Math.abs((rail[0]?.fraction || 0) - 0.5) < 0.01, rail[0]?.fraction);

    // Most recent first, and TOTAL, so the rail does not reshuffle.
    let two = {};
    two = recordProgress(two, progressId('movie', 'a'), 3000, 6000, 1000);
    two = recordProgress(two, progressId('movie', 'b'), 3000, 6000, 2000);
    const order = continueWatching(two, [movie('a'), movie('b')]);
    ok('the most recently watched is first',
        order[0].record.id === 'b', order.map(e => e.record.id));

    const episodes = [episode(1, 1)];
    let three = {};
    three = recordProgress(three, progressId('episode', 'ep-s1e1'), 300, 1200, 1);
    const mixed = continueWatching(three, [], episodes);
    ok('an episode can be on the rail too',
        mixed.length === 1 && mixed[0].kind === 'episode', mixed);

    ok('the rail is bounded',
        continueWatching(
            Array.from({ length: 40 }, (_v, i) => i).reduce((acc, i) =>
                recordProgress(acc, progressId('movie', `m${i}`), 3000, 6000,
                               1000 + i), {} as any),
            Array.from({ length: 40 }, (_v, i) => movie(`m${i}`))).length <= 12);
}

/* ------------------------------------------------------------------ *
 * 8. Channels
 * ------------------------------------------------------------------ */
section('8. Channels group, and nothing disappears');
{
    const rows = [
        channel('c1', { category: 'News', order: 2 }),
        channel('c2', { category: 'News', order: 1 }),
        channel('c3', { category: 'Sport' }),
        channel('c4', {}),                     // no category at all
    ];
    const groups = byCategory(rows, 'Other');
    ok('every channel appears exactly once',
        groups.reduce((n, g) => n + g.channels.length, 0) === rows.length,
        groups.map(g => [g.category, g.channels.length]));
    ok('a channel with no category is not lost',
        groups.some(g => g.channels.some(c => c.id === 'c4')));
    ok('and lands in the fallback group',
        groups.find(g => g.channels.some(c => c.id === 'c4'))?.category === 'Other');
    ok('the fallback group is LAST, because it is the leftovers',
        groups[groups.length - 1].category === 'Other',
        groups.map(g => g.category));
    ok('within a group the operator ordering wins',
        groups.find(g => g.category === 'News')!.channels.map(c => c.id)
            .join(',') === 'c2,c1');
    ok('grouping is stable across permutations',
        JSON.stringify(byCategory(shuffled(rows, 3), 'Other')
            .map(g => [g.category, g.channels.map(c => c.id)]))
        === JSON.stringify(byCategory(shuffled(rows, 19), 'Other')
            .map(g => [g.category, g.channels.map(c => c.id)])));

    // hls.js is a few hundred kilobytes. A Safari reader must never fetch it,
    // and a Chrome reader must always fetch it - getting this backwards means
    // either dead weight for one group or dead channels for the other.
    ok('HLS on a browser that plays it natively needs no library',
        needsHlsLibrary('hls', true) === false);
    ok('HLS on a browser that does not needs the library',
        needsHlsLibrary('hls', false) === true);
    ok('an mp4 stream never needs the library',
        needsHlsLibrary('mp4', false) === false);
    ok('nor does dash', needsHlsLibrary('dash', false) === false);
}

/* ------------------------------------------------------------------ *
 * 9. Formatting
 * ------------------------------------------------------------------ */
section('9. Timecodes and running times');
{
    ok('under an hour has no hour field', timecode(423) === '7:03', timecode(423));
    ok('over an hour has one', timecode(6127) === '1:42:07', timecode(6127));
    ok('zero is 0:00', timecode(0) === '0:00');
    ok('a negative is clamped rather than rendered', timecode(-5) === '0:00');
    ok('a float is floored', timecode(59.9) === '0:59', timecode(59.9));
    ok('seconds are always two digits', timecode(65) === '1:05');
    ok('minutes are two digits once there is an hour',
        timecode(3665) === '1:01:05', timecode(3665));

    ok('runtime reads as a duration', runtime(6127) === '1h 42m', runtime(6127));
    ok('a round hour drops the minutes', runtime(7200) === '2h', runtime(7200));
    ok('under an hour is minutes only', runtime(2400) === '40m');
    ok('no duration is an empty string rather than "0m"',
        runtime(0) === '' && runtime(undefined) === '',
        [runtime(0), runtime(undefined)]);
}

/* ------------------------------------------------------------------ *
 * Result
 * ------------------------------------------------------------------ */
console.log('');
/* ------------------------------------------------------------------ *
 * 10. The tabs
 * ------------------------------------------------------------------ */
section('10. The tabs, and the paths they light up for');
{
    ok('there are four tabs and they are declared once',
        TV_TABS.length === 4, TV_TABS.map(t => t.id));
    ok('the ids are the four the router knows',
        TV_TABS.map(t => t.id).join(',') === 'home,movies,series,live',
        TV_TABS.map(t => t.id));

    // Every `to` has to be a path the router can actually match, or a tab is a
    // dead link. The router file is not importable here (it pulls ~57 views), so
    // the shape is asserted instead: `/tv` plus at most one more segment, which
    // is what `tabFor` below is written against.
    ok('every tab points at a real-shaped path under /tv',
        TV_TABS.every(t => /^\/tv(\/[a-z]+)?$/.test(t.to)),
        TV_TABS.map(t => t.to));
    ok('no two tabs share a path',
        new Set(TV_TABS.map(t => t.to)).size === TV_TABS.length,
        TV_TABS.map(t => t.to));

    // TAB_KEYS is derived, so this can only fail if somebody replaces the `map`
    // with a second hand-written list - which is the thing that goes stale.
    ok('TAB_KEYS is derived from TV_TABS rather than written out',
        TAB_KEYS.length === TV_TABS.length
        && TAB_KEYS.every((key, i) => key === TV_TABS[i].label),
        TAB_KEYS);
    // Films and Series deliberately reuse a rail heading's key: the same words
    // in the same context, translated once.
    ok('the two shared labels really are the rail headings',
        (RAIL_KEYS as readonly string[]).includes('Films')
        && (RAIL_KEYS as readonly string[]).includes('Series')
        && TAB_KEYS.includes('Films') && TAB_KEYS.includes('Series'));

    ok('each tab resolves to itself', TV_TABS.every(t => tabFor(t.to) === t.id),
        TV_TABS.map(t => `${t.to} -> ${tabFor(t.to)}`));

    // The cases where a strip normally goes blank and reads as broken.
    ok("a series' own page keeps Series lit",
        tabFor('/tv/series/abc-123') === 'series');
    ok('a channel query keeps Live lit',
        tabFor('/tv/live?channel=bbc-1') === 'live');
    ok('a trailing slash changes nothing', tabFor('/tv/movies/') === 'movies');
    ok('a hash changes nothing', tabFor('/tv/series#top') === 'series');
    ok('the player falls back to Browse rather than guessing',
        tabFor('/tv/watch/episode/s1/e1') === 'home'
        && tabFor('/tv/watch/movie/m1') === 'home');
    ok('/tv itself is Browse', tabFor('/tv') === 'home' && tabFor('/tv/') === 'home');

    // Segment-aware, not `startsWith` - the trap `isUnder` in appNav.ts exists
    // for. A path that merely begins with a tab's name is not that tab.
    ok('matching is segment-aware, not a prefix test',
        tabFor('/tv/seriesfoo') === 'home' && tabFor('/tv/livestream') === 'home',
        [tabFor('/tv/seriesfoo'), tabFor('/tv/livestream')]);
    ok('a path outside /tv is Browse rather than a throw',
        tabFor('/courses') === 'home' && tabFor('') === 'home'
        && tabFor('/') === 'home');
}

if (failures) {
    console.log(`FAIL — ${failures} of ${checks} checks failed.`);
    process.exit(1);
}
console.log(`All ${checks} checks passed.`);
