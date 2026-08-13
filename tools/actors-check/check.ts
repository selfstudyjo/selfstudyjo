// Verifies src/cast/actors.ts and the twelve files it names, without a browser.
//
//   npm run check:actors
//
// The Toastmasters room and the mock job interview both show filmed people now:
// a still while somebody is listening, a looping clip while they talk. Playback
// itself needs a `<video>` element and is not checkable here. What *is*
// checkable is everything that fails silently:
//
// * **The twelve assets are all the same square.** They were made from sources
//   that were nothing like each other -- 1950x1064 clips against stills from
//   586x293 to 865x517 -- and a tile grid only reads as a grid if the pictures
//   inside it are interchangeable. A file re-exported at another size looks
//   fine on its own and wrong beside the other five, which is exactly the kind
//   of thing nobody notices until a user says the room "looks off".
//
// * **A filename that does not exist.** The registry names files and the browser
//   half imports them; a drift between the two is a broken tile in a grid of
//   six, on a page nobody rebuilds often.
//
// * **A clip with an audio track.** These are silent by design: the words come
//   from speech synthesis. A stray track would talk over the anchor, and it
//   would do it in whatever language the source render happened to contain.
//
// * **Voice casting.** A man's face speaking in a woman's voice is the single
//   most-reported fault on the newscast -- four separate times -- and every one
//   of them was a silent substitution rather than an error.
//
// * **The interviewer picker.** It indexes an array from `Math.random()`, so the
//   top of the range is the interesting part: an off-by-one there is an
//   interview conducted by `undefined`, and it happens to one candidate in a
//   few thousand.

import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import {
    ACTORS, INTERVIEWER_TITLES, SEATS, TILE_PX,
    actorById, castVoice, interviewerLabel, isActorId, pickInterviewer,
    pitchFor, seatByKey, seatGenders, seatLabel,
    type ActorId, type Gender,
} from '../../src/cast/actors';

// Read as TEXT as well as imported, so the check can assert things about files
// it must not execute: the browser-only asset module, and the two views.
const ASSET_DIR = resolve('src/assets/actors');
const ASSETS_MODULE = resolve('src/cast/actorAssets.ts');
const VIEWS = [
    resolve('src/views/ToastmastersSession.vue'),
    resolve('src/views/JobInterviewSession.vue'),
];

let failures = 0;

function check(label: string, ok: boolean, detail: unknown = '') {
    console.log(`  ${ok ? 'ok  ' : 'FAIL'}  ${label}${ok ? '' : '  ' + JSON.stringify(detail)}`);
    if (!ok) failures++;
}

function voice(name: string, lang = 'en-US') {
    return { name, lang };
}

/* ── image and video headers, parsed here rather than shelled out to ffprobe ──
   The point of this check is that it runs anywhere `npm run check` does, in
   about a second, with no tools installed. Both formats put their dimensions
   near the front of the file, so this is a dozen lines rather than a dependency. */

/** Canvas size of a WebP, covering all three chunk types a re-export might use. */
function webpSize(file: string): { w: number; h: number } | null {
    const b = readFileSync(file);
    if (b.length < 30 || b.toString('ascii', 0, 4) !== 'RIFF'
        || b.toString('ascii', 8, 12) !== 'WEBP') return null;
    const kind = b.toString('ascii', 12, 16);
    if (kind === 'VP8 ') {
        // Lossy: 3-byte frame tag, then the 3-byte start code, then 14-bit dims.
        if (b[23] !== 0x9d || b[24] !== 0x01 || b[25] !== 0x2a) return null;
        return { w: b.readUInt16LE(26) & 0x3fff, h: b.readUInt16LE(28) & 0x3fff };
    }
    if (kind === 'VP8L') {
        const bits = b.readUInt32LE(21);            // after the 1-byte signature
        return { w: (bits & 0x3fff) + 1, h: ((bits >> 14) & 0x3fff) + 1 };
    }
    if (kind === 'VP8X') {
        return {
            w: (b[24] | (b[25] << 8) | (b[26] << 16)) + 1,
            h: (b[27] | (b[28] << 8) | (b[29] << 16)) + 1,
        };
    }
    return null;
}

/**
 * Containers worth descending into, and how many bytes of their own they carry
 * before their children start.
 *
 * `stsd` is the one that matters and the one that caught this check out: it is a
 * FullBox with a 4-byte version/flags and a 4-byte entry count ahead of its
 * sample entries, so descending at the usual offset parses that count as a box
 * length and walks off into nonsense. Everything else here is a plain container.
 * A media data box is deliberately not on the list -- it is megabytes of samples
 * that would parse as garbage boxes.
 */
const CONTAINERS: Record<string, number> = {
    moov: 0, trak: 0, mdia: 0, minf: 0, stbl: 0, stsd: 8,
};

/** Walk an ISO-BMFF box tree, calling `visit` for every box found. */
function walkBoxes(b: Buffer, start: number, end: number,
                   visit: (type: string, from: number, to: number) => void) {
    let at = start;
    while (at + 8 <= end) {
        const size = b.readUInt32BE(at);
        const type = b.toString('ascii', at + 4, at + 8);
        const box = size === 0 ? end - at : size === 1 ? Number(b.readBigUInt64BE(at + 8)) : size;
        if (box < 8 || at + box > end) return;
        visit(type, at + 8, at + box);
        const skip = CONTAINERS[type];
        if (skip !== undefined) walkBoxes(b, at + 8 + skip, at + box, visit);
        at += box;
    }
}

/**
 * Source without its comments.
 *
 * Needed because the assertions below look for code, and this file's own
 * explanations name the things they forbid: the first version of the
 * `import.meta.glob` check failed on the sentence in actorAssets.ts that says
 * why a glob is not used.
 */
function stripComments(src: string): string {
    return src
        .replace(/<!--[\s\S]*?-->/g, '')
        .replace(/\/\*[\s\S]*?\*\//g, '')
        .replace(/^[ \t]*\/\/.*$/gm, '');
}

/**
 * Frame size and whether there is an audio track.
 *
 * Size comes off the `avc1` sample entry, where it is two plain 16-bit integers
 * -- `tkhd` carries it as 16.16 fixed point plus a transform matrix, which is
 * more ways to be wrong for no gain here. Audio is any `soun` handler.
 */
function mp4Info(file: string): { w: number; h: number; audio: boolean } | null {
    const b = readFileSync(file);
    let w = 0, h = 0, audio = false;
    walkBoxes(b, 0, b.length, (type, from) => {
        if (type === 'avc1') {
            w = b.readUInt16BE(from + 24);
            h = b.readUInt16BE(from + 26);
        } else if (type === 'hdlr' && b.toString('ascii', from + 8, from + 12) === 'soun') {
            audio = true;
        }
    });
    return w && h ? { w, h, audio } : null;
}

console.log('\nactors: the cast registry\n');

check('six actors', ACTORS.length === 6, ACTORS.length);
check('ids are unique', new Set(ACTORS.map(a => a.id)).size === ACTORS.length);
check('names are unique', new Set(ACTORS.map(a => a.name)).size === ACTORS.length);
check('both genders are represented',
    new Set(ACTORS.map(a => a.gender)).size === 2,
    ACTORS.map(a => `${a.id}:${a.gender}`));
check('every actor names two files',
    ACTORS.every(a => a.idleFile.endsWith('.webp') && a.speakFile.endsWith('.mp4')));
check('isActorId accepts every id and rejects a stranger',
    ACTORS.every(a => isActorId(a.id)) && !isActorId('rachel') && !isActorId(''));
check('actorById throws rather than returning undefined', (() => {
    try { actorById('nobody' as ActorId); return false; } catch { return true; }
})());

console.log('\nactors: the Toastmasters seats\n');

check('six seats', SEATS.length === 6, SEATS.length);
check('seat keys are unique', new Set(SEATS.map(s => s.key)).size === SEATS.length);
check('each seat has a different actor',
    new Set(SEATS.map(s => s.actor)).size === SEATS.length);
check('every actor holds a seat',
    new Set(SEATS.map(s => s.actor)).size === ACTORS.length);
check('every seat points at a real actor', SEATS.every(s => isActorId(s.actor)));
// The backend addresses each role by these exact keys, so a rename here is a
// request app 27 answers with an empty string and a silent bot.
check('the keys are the ones app 27 answers to',
    SEATS.map(s => s.key).join(',')
        === 'toastmaster,timer,ah,grammarian,speechEval,generalEval',
    SEATS.map(s => s.key));
check('seatByKey finds every seat and nothing else',
    SEATS.every(s => seatByKey(s.key) === s) && seatByKey('speaker') === null);
check('seatLabel names the actor and the role',
    seatLabel(SEATS[0]) === `${SEATS[0].emoji} ${actorById(SEATS[0].actor).name} — ${SEATS[0].role}`,
    seatLabel(SEATS[0]));
const genders = seatGenders();
check('seatGenders agrees with the cast, seat for seat',
    SEATS.every(s => genders[s.key] === actorById(s.actor).gender), genders);
check('seatGenders covers every seat and invents none',
    Object.keys(genders).length === SEATS.length);

console.log('\nactors: casting the interviewer\n');

// The whole range, plus both ends exactly, plus the values that break a naive
// `Math.floor(rand() * n)`.
const probes = [0, 0.0001, 0.16, 0.17, 0.33, 0.5, 0.83, 0.999, 0.9999999, 1];
check('every probe returns a real actor',
    probes.every(p => isActorId(pickInterviewer(() => p).id)),
    probes.map(p => pickInterviewer(() => p)?.id));
check('rand() = 1 does not fall off the end',
    pickInterviewer(() => 1).id === ACTORS[ACTORS.length - 1].id);
check('rand() = 0 is the first',
    pickInterviewer(() => 0).id === ACTORS[0].id);
const seen = new Set<ActorId>();
for (let i = 0; i < 600; i++) seen.add(pickInterviewer().id);
check('600 casts reach all six', seen.size === 6, [...seen]);
check('both titles exist and read as jobs',
    INTERVIEWER_TITLES.HR.title === 'HR Manager'
    && INTERVIEWER_TITLES.Technical.title === 'Technical Interviewer');
check('interviewerLabel carries the actor name, not the old fixed persona',
    interviewerLabel(actorById('sophia'), 'HR') === '🤝 Sophia — HR Manager'
    && !interviewerLabel(actorById('marcus'), 'Technical').includes('Alex'),
    interviewerLabel(actorById('sophia'), 'HR'));
// Any of the six may draw either interview, which is the point of casting at
// random; a title that only fits one gender would put the stereotype back.
check('either title works for either gender',
    ACTORS.every(a => (['HR', 'Technical'] as const)
        .every(t => interviewerLabel(a, t).includes(a.name))));

console.log('\nactors: voices\n');

const MIXED = [voice('Microsoft David - English (United States)'),
               voice('Microsoft Zira - English (United States)'),
               voice('Microsoft Mark - English (United States)'),
               voice('Google UK English Female', 'en-GB')];

check('a male seat gets a male voice',
    castVoice(MIXED, 'male').voice?.name.includes('David') === true,
    castVoice(MIXED, 'male').voice?.name);
check('a female seat gets a female voice',
    castVoice(MIXED, 'female').voice?.name.includes('Zira') === true,
    castVoice(MIXED, 'female').voice?.name);
check('a matched cast says so', castVoice(MIXED, 'male').matched);
check('two male seats do not share one voice',
    castVoice(MIXED, 'male', 0).voice?.name !== castVoice(MIXED, 'male', 1).voice?.name);
check('a third male seat wraps round rather than falling off the end',
    castVoice(MIXED, 'male', 2).voice !== null
    && castVoice(MIXED, 'male', 99).voice !== null);
check('a negative seat index still lands on a voice',
    castVoice(MIXED, 'male', -1).voice !== null);

// The case that actually happens: a stock Windows install has one male and one
// female English voice, and plenty have only Zira.
const FEMALE_ONLY = [voice('Microsoft Zira - English (United States)')];
const maleOnFemaleOnly = castVoice(FEMALE_ONLY, 'male');
check('with no male voice installed, one is still returned',
    maleOnFemaleOnly.voice !== null);
check('...and it is declared as a mismatch rather than passed off',
    maleOnFemaleOnly.matched === false);
check('a mismatch is compensated in the pitch, not ignored',
    pitchFor('male', false) < pitchFor('male', true)
    && pitchFor('female', false) > pitchFor('female', true),
    [pitchFor('male', false), pitchFor('male', true),
     pitchFor('female', false), pitchFor('female', true)]);
check('a matched man and a matched woman are still told apart',
    pitchFor('male', true) < pitchFor('female', true));

check('no voices at all is null, not a crash',
    castVoice([], 'male').voice === null && castVoice([], 'female').matched === false);
// An `utterance.voice` that is set overrides `utterance.lang`, so a non-English
// voice cast here would read English text with foreign phonetics -- the newscast
// shipped that bug and it was reported as "it reads in English and mixes words".
check('a non-English voice is never cast',
    castVoice([voice('Microsoft Hoda - Arabic (Egypt)', 'ar-EG'),
               voice('Microsoft Naayf', 'ar-SA')], 'male').voice === null);
check('an unknown voice name is still usable when it is all there is',
    castVoice([voice('Custom Voice 1')], 'female').voice !== null
    && castVoice([voice('Custom Voice 1')], 'female').matched === false);

console.log('\nactors: the twelve files\n');

const files: { label: string; path: string; kind: 'webp' | 'mp4' }[] = [];
for (const a of ACTORS) {
    files.push({ label: `${a.id} idle`, path: resolve(ASSET_DIR, a.idleFile), kind: 'webp' });
    files.push({ label: `${a.id} speak`, path: resolve(ASSET_DIR, a.speakFile), kind: 'mp4' });
}

check('all twelve exist', files.every(f => existsSync(f.path)),
    files.filter(f => !existsSync(f.path)).map(f => f.label));

const sizes: string[] = [];
for (const f of files) {
    if (!existsSync(f.path)) continue;
    const info = f.kind === 'webp' ? webpSize(f.path) : mp4Info(f.path);
    if (!info) { check(`${f.label}: header is readable`, false); continue; }
    sizes.push(`${f.label}=${info.w}x${info.h}`);
    check(`${f.label} is ${TILE_PX}x${TILE_PX}`,
        info.w === TILE_PX && info.h === TILE_PX, `${info.w}x${info.h}`);
    if (f.kind === 'mp4') {
        check(`${f.label} carries no audio track`, (info as { audio: boolean }).audio === false);
    }
}
check('every asset is the same square as every other',
    new Set(sizes.map(s => s.split('=')[1])).size === 1, sizes);

// An orphan is the residue of a rename: the old file stays, the page still
// works, and 300 KB ships to every visitor for ever.
const named = new Set(ACTORS.flatMap(a => [a.idleFile, a.speakFile]));
const onDisk = existsSync(ASSET_DIR)
    ? readdirSync(ASSET_DIR).filter(f => !f.startsWith('.'))
    : [];
check('nothing in the asset folder is unreferenced',
    onDisk.every(f => named.has(f)), onDisk.filter(f => !named.has(f)));

console.log('\nactors: the browser half, and the two views\n');

const assetsSrc = existsSync(ASSETS_MODULE)
    ? stripComments(readFileSync(ASSETS_MODULE, 'utf8')) : '';
check('actorAssets.ts is present', assetsSrc.length > 0);
check('every actor has a media entry there',
    ACTORS.every(a => new RegExp(`\\b${a.id}\\s*:\\s*\\{`).test(assetsSrc)),
    ACTORS.filter(a => !new RegExp(`\\b${a.id}\\s*:\\s*\\{`).test(assetsSrc)).map(a => a.id));
check('it imports exactly the filenames the registry names',
    [...named].every(f => assetsSrc.includes(f)),
    [...named].filter(f => !assetsSrc.includes(f)));
// A glob would resolve a missing file to `undefined` and reach the page as
// `src="undefined"`; a static import fails the build instead.
check('the assets are static imports, not a glob',
    !assetsSrc.includes('import.meta.glob'));

for (const view of VIEWS) {
    const name = view.split(/[\\/]/).pop();
    const src = existsSync(view) ? stripComments(readFileSync(view, 'utf8')) : '';
    check(`${name} draws the cast through SpeakerMedia`,
        src.includes('SpeakerMedia'));
    // The faces used to be SVG markup pushed through `v-html`, which is the one
    // habit working rule 13 is about; there is no reason for either view to
    // regrow it now that the people are photographs.
    check(`${name} has no v-html left`, !src.includes('v-html'));
    check(`${name} no longer carries an inline face`,
        !src.includes('<svg viewBox="0 0 200 200"'));
}

console.log(failures === 0
    ? '\nactors: all checks passed\n'
    : `\nactors: ${failures} check(s) FAILED\n`);
process.exit(failures === 0 ? 0 : 1);
