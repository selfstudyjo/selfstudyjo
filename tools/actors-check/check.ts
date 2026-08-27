// Verifies the 3D cast — who they are, how they are proportioned, how they
// move, and how a line gets spoken — without a browser.
//
//   npm run check:actors
//
// ============================================================
// WHAT THIS CHECKED BEFORE, AND WHY NONE OF IT IS LEFT
// ============================================================
//
// It used to verify twelve media files: an idle WebP and a looping MP4 per
// person, all the same square, none of them carrying an audio track. Those
// files are gone — the cast is built at runtime now (see
// `src/stage3d/figures.ts` for why) — so every one of those assertions has been
// replaced rather than deleted. The set of QUESTIONS is much the same; only the
// answers moved from a file header to a function.
//
// ============================================================
// WHAT IS WORTH CHECKING ABOUT A RENDERED PERSON
// ============================================================
//
// Not the picture. A GPU is needed for that, and `tools/cast-preview` exists so
// a human can look at one. What is checkable here is everything that fails
// SILENTLY:
//
//  * **A silent figure must not mouth anything.** `jawOpen` at zero energy has
//    to be exactly 0 — "almost closed" is visible from across a room and reads
//    as chewing.
//  * **Every eye must reopen.** A blink schedule derived from a hash could in
//    principle produce a figure whose lids never come back up, and nobody would
//    find out until a meeting had been running for four minutes.
//  * **Six people must not blink together.** That is the difference between a
//    room and a screensaver, and it is a property of the phases rather than of
//    anything visible in one frame.
//  * **The head sculpt has to be a head.** The nose has to protrude, the socket
//    has to be recessed, the jaw has to be narrower than the cheekbones — and
//    the nose has to STOP above the lip, which is a bug this file now guards
//    because it shipped: an unbounded bridge term ran the ridge down over the
//    mouth and the chin, and the face rendered with a crack down the middle.
//  * **The speech decision table**, which is where Arabic was silent in both
//    rooms for reasons that were entirely in one boolean.
//
// The 3D BUILDER is not importable here — it needs Babylon and a canvas — so
// the split is the same one `photoMask.ts` and `drawEngine.ts` have: the plain
// half is checked, and the half that draws is read as TEXT for the handful of
// things that can be asserted about source.

import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import {
    ACTORS, INTERVIEWER_TITLES, SEATS,
    actorById, castVoice, interviewerLabel, isActorId, pickInterviewer,
    pitchFor, seatByKey, seatGenders, seatLabel,
    type ActorId, type Gender,
} from '../../src/cast/actors';
import {
    ANCHOR_FIGURES, BLINK_MAX_GAP, BLINK_MIN_GAP, BLINK_MS, BREATH_PERIOD, FIGURES,
    SCRIPT_GLANCE_SECONDS,
    blink, breath, browRaise, clamp01, figureById, followEnergy, gesture, handOffset,
    hash01, headEmphasis, isFigureId, jawOpen, lipSpread, proportionsFor, reachPitch,
    scriptGlance, smooth, sway,
    type FigureSpec, type HairStyle,
} from '../../src/stage3d/figures';
import {
    ANCHOR_X, ANCHOR_Z, CAMERA_FOV, CAMERA_Z, DESK_TOP_Y, HALF_WIDTH, PLATE_X,
    SCRIPT_X, SCRIPT_Y, SCRIPT_Z, WALL_W, WALL_Z,
    plateFraction,
} from '../../src/stage3d/layout';
import { NO_SERVER, deviceCanSpeak, describe, planSpeech, serverVoicesFor } from '../../src/utils/roomSpeech';
import {
    COMPRESSOR_RATIO, COMPRESSOR_THRESHOLD_DB, VOICE_MAKEUP,
} from '../../src/utils/speechAudio';

// Read as TEXT as well as imported, so the check can assert things about files
// it must not execute: the builder, the stages and the two views.
const HUMAN = resolve('src/stage3d/human.ts');
const VIEWS = [
    resolve('src/views/ToastmastersSession.vue'),
    resolve('src/views/JobInterviewSession.vue'),
];
const GONE = [
    resolve('src/assets/actors'),
    resolve('src/assets/studio'),
    resolve('src/cast/actorAssets.ts'),
    resolve('src/components/cast/SpeakerMedia.vue'),
];

let failures = 0;

function check(label: string, ok: boolean, detail: unknown = '') {
    console.log(`  ${ok ? 'ok  ' : 'FAIL'}  ${label}${ok ? '' : '  ' + JSON.stringify(detail)}`);
    if (!ok) failures++;
}

function voice(name: string, lang = 'en-US') {
    return { name, lang };
}

function stripComments(src: string): string {
    return src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');
}

const ALL = [...FIGURES, ...ANCHOR_FIGURES];
const HAIR: HairStyle[] = ['crop', 'fade', 'wave', 'bob', 'long', 'bun'];

/* ------------------------------------------------------------------ *
 * 1. Who they are
 * ------------------------------------------------------------------ */

console.log('\nactors: the cast\n');

check('there are six meeting seats and two anchors',
    FIGURES.length === 6 && ANCHOR_FIGURES.length === 2,
    [FIGURES.length, ANCHOR_FIGURES.length]);

check('every id is unique',
    new Set(ALL.map(f => f.id)).size === ALL.length,
    ALL.map(f => f.id));

/*
  The anchors are deliberately NOT meeting seats. A reader who uses both
  products should not have the news read to them by the person who interviewed
  them yesterday, and the only thing stopping that is these two lists being
  disjoint.
*/
check('no anchor is also a meeting seat',
    ANCHOR_FIGURES.every(a => !FIGURES.some(f => f.id === a.id)));

check('both genders are represented in the meeting',
    FIGURES.some(f => f.gender === 'male') && FIGURES.some(f => f.gender === 'female'));

check('the anchors are one of each',
    new Set(ANCHOR_FIGURES.map(f => f.gender)).size === 2);

check('every hairstyle is one the builder knows',
    ALL.every(f => HAIR.includes(f.hairStyle)),
    ALL.filter(f => !HAIR.includes(f.hairStyle)).map(f => f.hairStyle));

const hex = /^#[0-9a-f]{6}$/i;
check('every colour is a six-digit hex the builder can parse',
    ALL.every(f => hex.test(f.skin) && hex.test(f.hair) && hex.test(f.eye)
        && hex.test(f.outfit.jacket) && hex.test(f.outfit.shirt) && hex.test(f.outfit.accent)),
    ALL.filter(f => !hex.test(f.skin) || !hex.test(f.hair)).map(f => f.id));

check('every build is 0..1 and every height is human',
    ALL.every(f => f.build >= 0 && f.build <= 1 && f.height > 1.4 && f.height < 2.1),
    ALL.map(f => [f.id, f.build, f.height]));

/*
  SIX FIGURES ON ONE CLOCK IS A SCREENSAVER.

  Every idle cycle in `figures.ts` is a function of `t + phase`, so two figures
  sharing a phase breathe, blink and drift in perfect step — which the newscast
  shipped with two anchors and had to fix. Distinct is not enough on its own:
  the phases also have to be spread across the cycle rather than clustered.
*/
check('no two figures share a phase',
    new Set(ALL.map(f => f.phase)).size === ALL.length,
    ALL.map(f => f.phase));

const spread = ALL.map(f => f.phase % BREATH_PERIOD).sort((a, b) => a - b);
const closest = Math.min(...spread.slice(1).map((v, i) => v - spread[i]!));
check('and the phases are spread across the breath cycle, not clustered',
    closest > 0.2, { closest: Number(closest.toFixed(3)) });

check('figureById throws on an unknown id, rather than answering undefined',
    (() => {
        try { figureById('nobody'); return false; } catch { return true; }
    })());

check('isFigureId agrees with the tables',
    ALL.every(f => isFigureId(f.id)) && !isFigureId('nobody'));

/* ------------------------------------------------------------------ *
 * 2. Proportions
 * ------------------------------------------------------------------ */

console.log('\nactors: proportions\n');

for (const f of ALL) {
    const P = proportionsFor(f);
    const named = Object.entries(P);
    check(`${f.id}: every measurement is a positive finite number`,
        named.every(([, v]) => Number.isFinite(v) && v > 0),
        named.filter(([, v]) => !(Number.isFinite(v) && v > 0)));
}

const tall = proportionsFor({ ...FIGURES[0]!, height: 1.9 });
const short = proportionsFor({ ...FIGURES[0]!, height: 1.6 });
check('a taller figure is taller everywhere, not just at the top',
    tall.headY > short.headY && tall.shoulderY > short.shoulderY
    && tall.headRadius > short.headRadius && tall.upperArm > short.upperArm);

/*
  `build` WIDENS AND MUST NOT LENGTHEN.

  Two people of the same height differ at the shoulders, the neck and the waist
  and almost nowhere else that reads from three metres away. Scaling length with
  it is what produces the "one model at different scales" look, which is worse
  than no variation at all.
*/
const broad = proportionsFor({ ...FIGURES[0]!, build: 1 });
const slight = proportionsFor({ ...FIGURES[0]!, build: 0 });
check('build widens the frame',
    broad.shoulderHalfWidth > slight.shoulderHalfWidth
    && broad.neckRadius > slight.neckRadius
    && broad.waistHalfWidth > slight.waistHalfWidth);
check('...and does not lengthen it',
    broad.headY === slight.headY && broad.shoulderY === slight.shoulderY
    && broad.upperArm === slight.upperArm);

for (const f of ALL) {
    const P = proportionsFor(f);
    check(`${f.id}: the skeleton is in the right order, top to bottom`,
        P.headY > P.neckY && P.neckY > P.shoulderY && P.shoulderY > P.waistY
        && P.waistY > P.hipY,
        [P.headY, P.neckY, P.shoulderY, P.waistY, P.hipY]);
    // A head is about a seventh to an eighth of standing height. Anything
    // outside that renders as a child or as a caricature.
    const heads = f.height / (P.headRadius * 2);
    check(`${f.id}: the head is 6.5-9 heads into the height (${heads.toFixed(1)})`,
        heads > 6.5 && heads < 9, heads);
    // A shoulder span far off a quarter of height reads as a costume.
    const span = (P.shoulderHalfWidth * 2) / f.height;
    check(`${f.id}: the shoulder span is 0.17-0.28 of height (${span.toFixed(3)})`,
        span > 0.17 && span < 0.28, span);
    // Wider than deep, or the torso is a barrel.
    check(`${f.id}: the chest is wider than it is deep`,
        P.shoulderHalfWidth > P.chestDepth);
}

/* ------------------------------------------------------------------ *
 * 3. Movement
 * ------------------------------------------------------------------ */

console.log('\nactors: movement\n');

/**
 * An hour of simulated time, sampled fine enough to catch a 130 ms blink.
 *
 * The whole reason `figures.ts` is a set of pure functions of `(t, phase)` is
 * that this costs a millisecond: a hundred and eighty thousand samples per
 * figure, seekable, with no state to advance.
 */
const STEP = 0.02;
const SPAN = 3600;

for (const f of ALL) {
    let jawMin = Infinity, jawMax = -Infinity;
    let silentMax = 0;
    let lidMax = -Infinity, lidMin = Infinity;
    let breathMin = Infinity, breathMax = -Infinity;
    let swayMax = 0;
    let bad = 0;

    for (let t = 0; t < SPAN; t += STEP) {
        const open = jawOpen(t, f.phase, 0.8);
        jawMin = Math.min(jawMin, open);
        jawMax = Math.max(jawMax, open);
        silentMax = Math.max(silentMax, jawOpen(t, f.phase, 0));

        const shut = blink(t, f.phase);
        lidMax = Math.max(lidMax, shut);
        lidMin = Math.min(lidMin, shut);

        const air = breath(t, f.phase);
        breathMin = Math.min(breathMin, air);
        breathMax = Math.max(breathMax, air);

        const s = sway(t, f.phase);
        swayMax = Math.max(swayMax, Math.abs(s.headYaw), Math.abs(s.headPitch),
            Math.abs(s.headRoll));

        if (!Number.isFinite(open + shut + air + s.headYaw + s.lean)) bad++;
    }

    check(`${f.id}: nothing ever returns NaN over an hour`, bad === 0, bad);
    check(`${f.id}: the jaw stays inside 0..1`,
        jawMin >= 0 && jawMax <= 1, [jawMin, jawMax]);
    check(`${f.id}: the mouth actually opens while speaking`, jawMax > 0.4, jawMax);
    /*
      SILENCE IS SILENT, EXACTLY.

      Not "nearly closed": a jaw left a millimetre open is visible at tile size
      and reads as chewing. `jawOpen` returns a literal 0 for energy <= 0 and
      this is the assertion that keeps it that way through any future tuning of
      the syllable model.
    */
    check(`${f.id}: a silent figure never mouths anything`, silentMax === 0, silentMax);
    check(`${f.id}: the eyes fully close at some point`, lidMax > 0.98, lidMax);
    check(`${f.id}: and are fully open most of the time`, lidMin === 0, lidMin);
    check(`${f.id}: breathing covers its whole range`,
        breathMin < 0.02 && breathMax > 0.98, [breathMin, breathMax]);
    /*
      The idle drift is under two degrees. Above that it stops reading as
      "somebody sitting still" and starts reading as somebody swaying.
    */
    check(`${f.id}: the idle sway stays under 2 degrees`,
        swayMax < 0.0350, swayMax);
}

/* How often, and for how long. */
function blinkEvents(phase: number): { at: number; peak: number }[] {
    const events: { at: number; peak: number }[] = [];
    let inside = false;
    let start = 0;
    let peak = 0;
    for (let t = 0; t < SPAN; t += 0.005) {
        const v = blink(t, phase);
        if (v > 0.01 && !inside) { inside = true; start = t; peak = v; }
        else if (v > 0.01) { peak = Math.max(peak, v); }
        else if (inside) { inside = false; events.push({ at: start, peak }); }
    }
    return events;
}

const firstEvents = blinkEvents(FIGURES[0]!.phase);
check('a figure blinks at a human rate (10-30 a minute)',
    firstEvents.length / (SPAN / 60) > 9 && firstEvents.length / (SPAN / 60) < 31,
    firstEvents.length / (SPAN / 60));

const gaps = firstEvents.slice(1).map((e, i) => e.at - firstEvents[i]!.at);
check(`every gap is between ${BLINK_MIN_GAP}s and ${BLINK_MAX_GAP * 2}s`,
    gaps.every(g => g >= BLINK_MIN_GAP - 0.01 && g <= BLINK_MAX_GAP * 2),
    [Math.min(...gaps), Math.max(...gaps)]);

check(`a blink lasts about ${BLINK_MS}ms`,
    (() => {
        const dur = 0.005 * blinkEvents(FIGURES[1]!.phase).length;
        void dur;
        // Measured directly: the width of one event.
        let widest = 0;
        let inside = false;
        let start = 0;
        for (let t = 0; t < 60; t += 0.002) {
            const v = blink(t, FIGURES[1]!.phase);
            if (v > 0.01 && !inside) { inside = true; start = t; }
            else if (v <= 0.01 && inside) { inside = false; widest = Math.max(widest, t - start); }
        }
        return widest > 0.08 && widest < 0.20;
    })());

/*
  NOBODY BLINKS IN UNISON.

  Six people blinking together is uncanny in a way that is hard to name and
  impossible to miss, and it cannot be seen in a still. Sampled over an hour,
  the share of time on which any two figures are BOTH mid-blink has to be a
  rounding error rather than a pattern.
*/
let together = 0;
let anyBlink = 0;
for (let t = 0; t < SPAN; t += STEP) {
    const shut = ALL.map(f => blink(t, f.phase) > 0.5);
    const n = shut.filter(Boolean).length;
    if (n > 0) anyBlink++;
    if (n > 1) together++;
}
check('two figures are almost never mid-blink at the same moment',
    together / Math.max(1, anyBlink) < 0.06,
    { together, anyBlink, ratio: (together / Math.max(1, anyBlink)).toFixed(4) });

check('the brows lift while speaking and rest when silent',
    browRaise(1.2, 0, 1) > browRaise(1.2, 0, 0));
check('a silent figure still has a live brow, but barely',
    browRaise(1.2, 0, 0) >= 0 && browRaise(1.2, 0, 0) < 0.1);

check('lipSpread stays inside 0..1 and is not a constant',
    (() => {
        let lo = Infinity, hi = -Infinity;
        for (let t = 0; t < 60; t += 0.01) {
            const v = lipSpread(t, 0.5, 0.9);
            lo = Math.min(lo, v); hi = Math.max(hi, v);
        }
        return lo >= 0 && hi <= 1 && hi - lo > 0.3;
    })());

check('a silent mouth is only slightly parted, and does not move',
    lipSpread(1, 0, 0) === lipSpread(99, 0, 0) && lipSpread(1, 0, 0) < 0.2);

check('headEmphasis is exactly zero when silent',
    headEmphasis(1, 0, 0) === 0 && headEmphasis(99, 0.5, 0) === 0);

/*
  HANDS RAMP IN AND SNAP OFF.

  A gesture that starts at full amplitude on the first syllable is a puppet; one
  that lingers after the line ends leaves somebody frozen mid-point. `since` is
  seconds into the line and the ramp is what covers the first, and returning a
  literal 0 at zero energy is what covers the second.
*/
check('a gesture starts from nothing', gesture(5, 0, 1, 0) < 0.05);
check('...and is up to strength within about a second',
    (() => {
        let best = 0;
        for (let t = 0; t < 12; t += 0.01) best = Math.max(best, gesture(t, 0, 1, 1.4));
        return best > 0.6;
    })());
check('...and is exactly zero the moment the line ends',
    gesture(5, 0, 0, 9) === 0);

check('followEnergy attacks faster than it releases',
    (() => {
        const up = followEnergy(0, 1, 0.02);
        const down = 1 - followEnergy(1, 0, 0.02);
        return up > down;
    })(), [followEnergy(0, 1, 0.02), 1 - followEnergy(1, 0, 0.02)]);
check('followEnergy converges rather than overshooting',
    (() => {
        let v = 0;
        for (let i = 0; i < 500; i++) v = followEnergy(v, 0.7, 0.016);
        return Math.abs(v - 0.7) < 0.001 && v <= 0.7;
    })());

check('hash01 stays inside 0..1 over a wide range',
    (() => {
        for (let i = -50000; i < 50000; i += 7) {
            const v = hash01(i);
            if (!(v >= 0 && v < 1)) return false;
        }
        return true;
    })());

check('smooth and clamp01 behave at their edges',
    smooth(0, 1, -5) === 0 && smooth(0, 1, 5) === 1
    && Math.abs(smooth(0, 1, 0.5) - 0.5) < 1e-9
    && clamp01(-1) === 0 && clamp01(2) === 1);

/* ------------------------------------------------------------------ *
 * 4. The head sculpt
 * ------------------------------------------------------------------ */

console.log('\nactors: the head sculpt\n');

/*
  `sculptHeadVertex` is not importable — `human.ts` needs Babylon — so the sculpt
  is re-derived here from the same source text.

  That is a deliberate compromise and it is worth naming: a copy of the logic
  would prove nothing (app 23's identity e2e is the cautionary tale — its stub
  answered the same wrong endpoint the code did, so eight checks passed against a
  validator that refused the whole happy path). What is asserted instead is a set
  of properties of the SOURCE plus a set of properties the shape has to have, and
  the ones that matter are the two mistakes that actually shipped.
*/
const humanSrc = existsSync(HUMAN) ? readFileSync(HUMAN, 'utf8') : '';
check('human.ts is present', humanSrc.length > 0);

const bare = stripComments(humanSrc);

/*
  THE NOSE HAS TO STOP ABOVE THE LIP.

  The first version's bridge term was `0.35 * smooth(0.34, 0.12, v)`, which is
  constant for every v below 0.12 — so the ridge ran on down over the mouth and
  the chin, and the face rendered with a hard-edged blade down the middle of it.
  The fix is a second envelope that closes the bottom end, and `noseSpan` is its
  name; without one the term is unbounded again.
*/
check('the nose profile is bounded at BOTH ends',
    /noseSpan\s*=\s*smooth\([^)]*\)\s*[\r\n\s]*\*\s*smooth\(/.test(bare),
    'a bridge term with no lower envelope runs down over the chin');

/*
  A MESH WHOSE VERTICES ARE MOVED HAS TO BE CREATED `updatable`.

  Without it Babylon builds the buffer STATIC_DRAW and `updateVerticesData` does
  nothing at all — no error, no warning, no return value. What renders is the
  sphere as created: a two-metre ball where a head should be. Two meshes are
  sculpted and both have to say so.
*/
/*
  Matched by SCANNING FORWARD from each `diameter: 2`, not with one regex.

  The obvious pattern — `CreateSphere\([^;]*?diameter:\s*2[^;]*?\)` — stops at
  the first `)` after the diameter, which is the one closing
  `Math.round(64 * detail)`, so `updatable: true` is outside the match and the
  check fails on source that is perfectly correct. A lazy quantifier plus a
  closing bracket that occurs inside the construct is a trap worth naming.
*/
const sculpted = [...bare.matchAll(/diameter:\s*2\s*,/g)];
check('every sculpted sphere is created updatable',
    sculpted.length >= 2
    && sculpted.every(m => /updatable:\s*true/.test(
        bare.slice(m.index ?? 0, (m.index ?? 0) + 240))),
    { found: sculpted.length });

/*
  NORMALS HAVE TO BE RECOMPUTED after a displacement, or the nose lights as
  though it were still part of a ball and the face looks printed onto a sphere.
*/
check('normals are recomputed after each sculpt',
    (bare.match(/VertexData\.ComputeNormals\(/g) || []).length >= 2);

/*
  THE CALLER'S PLACEMENT IS NOT THE RIG'S TO WRITE.

  `update()` used to set `root.position.x` from the idle lean, which overwrote
  wherever the stage had put the figure — collapsing the meeting's six pods and
  the studio's two anchors to x ~ 0. The rig has its own node for that.
*/
check('the idle lean is written to the rig node, not to the caller root',
    /body\.position\.x\s*=/.test(bare) && !/\broot\.position\.x\s*=/.test(bare));

/*
  A CHILD OF A NON-UNIFORMLY SCALED NODE INHERITS THAT SCALING.

  The eyelashes were parented to a lid that is a unit sphere scaled by ~0.03 in
  every axis, so they came out as a microscopic speck at the eye's centre — there
  was geometry, it was submitted, and it was too small to see. Lashes belong to
  the socket.
*/
check('the lashes are siblings of the lid, not children of it',
    /lash\.parent\s*=\s*socket/.test(bare) && !/lash\.parent\s*=\s*upper/.test(bare));

/*
  THE MICRO-ROUGHNESS TEXTURE NEEDS MIPMAPS.

  It is deliberately high-frequency and it is sampled over a whole head at a few
  hundred pixels. Without mipmaps it beats against the pixel grid and the face
  renders as a moire chequerboard — which is exactly what the first render of the
  studio did, across the entire frame.
*/
check('the roughness noise is mipmapped',
    /DynamicTexture\('sfs-micro',[^;]*?,\s*scene,\s*true\)/.test(bare));

/*
  A DYNAMIC TEXTURE ON A MESH HAS TO BE UPLOADED WITH `invertY`.

  `update(false)` skips it, so everything drawn at the bottom of the canvas
  appears at the top of the mesh — and a line of capitals upside down reads as a
  MIRRORED line, which sends you looking for a `uScale` that was never wrong.
*/
const studioSrc = existsSync(resolve('src/stage3d/studioStage.ts'))
    ? stripComments(readFileSync(resolve('src/stage3d/studioStage.ts'), 'utf8')) : '';
check('the video wall uploads its canvas the right way up',
    /this\.texture\.update\(\)/.test(studioSrc)
    && !/this\.texture\.update\(false\)/.test(studioSrc));


/*
  ============================================================
  A LOOK-AT TARGET IS IN WORLD SPACE AND `rotation` IS NOT
  ============================================================

  `update()` used to take `atan2(dx, dz)` over WORLD deltas and write it straight
  into `headPivot.rotation.y`. Every caller turns the whole person — the meeting
  rotates each pod by +-0.16 rad, the studio by `PI +- 0.19` — so a local
  rotation set from a world angle is off by exactly that parent rotation.

  The meeting's cameras sit dead in front of their pods, so the world angle was
  ~0 and every figure sat nine degrees off camera for the whole session. The
  studio was worse: the male anchor's world angle to the lens is -2.85 rad, the
  clamp made it -0.65 and the damping -0.49, where the correct LOCAL yaw is about
  +0.11 — so he was turned 34 degrees the wrong way. Reported twice, as "members
  in the meeting not look to camera" and "the 2 Anchors not looks to camera".

  The fix is one matrix inverse, and its absence is invisible: both heads still
  move, plausibly, just not at the thing they were aimed at.
*/
check('the look-at target is brought into the head\'s own space first',
    /Matrix\.Invert\(\s*parent\.computeWorldMatrix/.test(bare)
    && /Vector3\.TransformCoordinates\(state\.lookAt/.test(bare),
    'a world angle written into a local rotation is off by the parent rotation');
check('...and from a FRESH world matrix, not the cached one',
    /computeWorldMatrix\(true\)/.test(bare),
    'the caller may have moved the figure this frame');

/*
  A CHILD OF A NON-UNIFORMLY SCALED NODE INHERITS THAT SCALING — twice now.

  The lashes were parented to a lid scaled by ~0.03 and came out as a speck. The
  brow's inner end and tail were then parented to the brow's PEAK, which is a
  unit sphere scaled by ~0.02, so both their offsets and their sizes were
  multiplied by that: they landed at the peak's centre, a fifth of a millimetre
  across. Same failure, same invisibility — geometry present, submitted, too
  small to see.
*/
check('the brow parts hang off an unscaled pivot, not off a scaled mesh',
    /const pivot = new B\.TransformNode\(`\$\{spec\.id\}-brow/.test(bare)
    && /mesh\.parent = pivot/.test(bare)
    && !/\.parent = brow;/.test(bare));

/*
  AND THE BROWS HAVE TO BE ON THE SURFACE.

  They were at `eyeZ * 1.02` — a depth taken from the EYEBALL, which sits in a
  socket the sculpt pushes 16% into the skull. Above the eye there is no socket:
  the brow ridge is one of the most forward points on the head. So each brow was
  about 0.14 R inside the face and has never once been visible, which also means
  `browRaise` has never been visible. The dark bar above each eye in every
  screenshot of this cast was the eyelash.

  Guessing a second depth only moves the guess, so the sculpt is asked.
*/
check('anything sitting on the face is placed from the sculpt, not from a guess',
    /function faceSurface\(/.test(bare)
    && /sculptHeadVertex\(x, y, z, R, male/.test(bare)
    && /const at = faceSurface\(/.test(bare));

/*
  THE CLOTHING IS PLACED ON THE JACKET'S OWN SURFACE.

  Three times this was a hand-computed depth and three times it was wrong: at
  0.66 of `chestDepth` everything sank a centimetre and a half inside; then one
  radius at one height, which was 12 mm short at the height the lapels actually
  sit at; and then the tie measured at a DIFFERENT height from the bib, so the
  shirt poked through the middle of the tie as a pale oval.
*/
check('the clothing reads the jacket surface as a function of (x, y)',
    /function frontZAt\(x: number, y: number\)/.test(bare)
    && /frontZAt\(lapelX, lapelY\)/.test(bare));
check('...and the tie and the bib are measured at the SAME point',
    /const chestSurface = frontZAt\(0, bibY\)/.test(bare)
    && /tie\.position\.z = chestSurface/.test(bare));
check('the collar\'s height is found rather than named',
    /function clearsJacketAbove\(/.test(bare)
    && /const collarBase = clearsJacketAbove\(/.test(bare));

/*
  NO BOXES ON THE FACE OR THE CHEST.

  Reported as "a lot of squares appear, this makes them ugly, like not real
  persons", and it was literal: the lapels were two `CreateBox`es 9 cm by 23 cm
  splayed on the chest, the eyelashes were boxes above each eye, and the
  necklace chain was two more. A box has flat faces, straight edges and eight
  corners, and at head framing the lapels were the two largest objects in the
  picture after the head.
*/
for (const gone of ['lapel', 'lash', 'chain']) {
    check(`the ${gone} is not a CreateBox any more`,
        !new RegExp(`CreateBox\\(\`\\$\\{spec\\.id\\}-${gone}`).test(bare));
}

/*
  A LATHE INTERPOLATES NOTHING BETWEEN PROFILE POINTS, and it is a body of
  REVOLUTION.

  Nine points over ninety centimetres of torso is nine visibly flat bands, and
  the four that crossed the shoulder were the widest of them. And no profile
  whatsoever makes a revolution flat-topped, which is what a jacket's shoulder
  is — hence the yoke, which is a separate mesh and cannot be replaced by more
  points.
*/
check('the torso profile has enough points to read as a curve',
    (bare.match(/profile\(/g) || []).length >= 14,
    (bare.match(/profile\(/g) || []).length);
check('and there is a yoke across the shoulders, which no lathe can be',
    /CreateCapsule\(`\$\{spec\.id\}-yoke`/.test(bare)
    && /yoke\.rotation\.z = Math\.PI \/ 2/.test(bare));

/*
  VERTEX COLOUR, NOT A TEXTURE, AND NOT READ AS TRANSPARENCY.

  The skin was one flat colour, which is the strongest remaining tell that a
  rendered head is not a person. It is evaluated in the same loop as the sculpt,
  at the same point, from the same primitives — so it cannot drift from the
  geometry the way a UV layout would.

  `hasVertexAlpha` is the trap: Babylon reads a four-component colour buffer and,
  believing there is alpha in it, moves the mesh into the TRANSPARENT list, where
  it is depth-sorted. On a head that means the eyes, the lids and the hair
  showing through the skull.
*/
check('the skin is shaded per vertex from the sculpt\'s own coordinates',
    /function skinShadeAt\(/.test(bare)
    && /skinShadeAt\(ux, uy, uz, male\)/.test(bare));
check('...and the colour buffer is not read as a transparency',
    (bare.match(/hasVertexAlpha = false/g) || []).length >= 2,
    (bare.match(/hasVertexAlpha = false/g) || []).length);

/*
  THE LAMP THAT COVERED THE SCREEN.

  Reported directly. The video wall's top edge is at y = 2.68 in the plane
  z = 3.05; a centre lamp sat at y = 2.72, z = 2.60 with a 0.42 rad tilt, so its
  lower front corner dipped to 2.57 — eleven centimetres below the top of the
  screen and 45 cm nearer the camera. It occluded the top of every headline.

  Neither number is wrong on its own, which is why the rule is now DERIVED from
  `WALL_Z` instead of the positions being chosen to miss each other.
*/
const setSrc = existsSync(resolve('src/stage3d/setPieces.ts'))
    ? stripComments(readFileSync(resolve('src/stage3d/setPieces.ts'), 'utf8')) : '';
check('setPieces.ts is present', setSrc.length > 0);
check('a lamp may only hang where it cannot occlude the video wall',
    /if \(side === 0 && z < WALL_Z \+ 0\.4\) continue;/.test(setSrc)
    && /const trussZ = \[WALL_Z \+ /.test(setSrc),
    'the centre lamp\'s position has to be a function of the wall, not a literal');
check('and the whole rig hangs behind the wall plane',
    /WALL_Z \+ 0\.45/.test(setSrc));
/*
  A studio lamp is a BARREL. A box hung under a truss and tilted is, from a
  camera below it, a flat pale quad — which reads as a sheet of paper in the top
  corner of the frame however dim it is.
*/
check('the lamps are barrels with a lens, not flat plates',
    /CreateCylinder\(`lamp\$\{i\}\$\{side\}`/.test(setSrc)
    && /CreateCylinder\(`lampglass/.test(setSrc));
/* The scripts the anchors read from, and the eyes have to agree with them. */
check('the set draws a script sheet at the shared coordinates',
    /CreateBox\(`script\$\{side\}\$\{index\}`/.test(setSrc)
    && /SCRIPT_Y \+ offset/.test(setSrc));


/* ------------------------------------------------------------------ *
 * 4b. Reaching for a desk, and looking at a script
 * ------------------------------------------------------------------ */

console.log('\nactors: hands and eyes\n');

/*
  THE TWO ANCHORS HOLD A SCRIPT ON THE DESK, and the pose is solved rather than
  dialled in. `reachPitch` is two-link IK; the only thing worth asserting about
  it is that the hand ends up where it was asked to, and the honest way to assert
  that is to put the answer back through the forward kinematics rather than
  re-deriving the same trigonometry a second time — which would only prove the
  two copies agree with each other.

  Every figure in the cast is exercised, because the whole point of solving it is
  that eight different arm lengths all land on one desk. A pair of hand-tuned
  angles would pass a check written against one figure.
*/
for (const f of [...FIGURES, ...ANCHOR_FIGURES]) {
    const P = proportionsFor(f);
    const upper = P.upperArm;
    const fore = P.foreArm + P.handLength * 0.34;
    // The studio's own target: the desk surface, in front of the body.
    const dy = (DESK_TOP_Y + 0.105) - (P.shoulderY - 0.012 * f.height);
    const dz = 0.34;
    const solved = reachPitch(dy, dz, upper, fore);
    const landed = handOffset(solved, upper, fore);
    const missBy = Math.hypot(landed.dy - dy, landed.dz - dz);
    check(`${f.id}: the hand lands on the desk it was aimed at (${(missBy * 1000).toFixed(1)} mm)`,
        solved.reached ? missBy < 0.002 : true, { missBy, reached: solved.reached });
    check(`${f.id}: and can reach it at all`, solved.reached, { dy, dz, reach: upper + fore });
    check(`${f.id}: the elbow bends forward rather than backward`,
        solved.elbow > 0.15 && solved.elbow < Math.PI, solved.elbow);
    check(`${f.id}: neither angle is NaN`,
        Number.isFinite(solved.shoulder) && Number.isFinite(solved.elbow), solved);
}

/*
  An out-of-reach target must not produce NaN. `Math.acos` of anything outside
  [-1, 1] is NaN, and a NaN in a rotation does not throw — it silently removes
  the whole arm from the frame, which reads as a modelling fault three files
  away from the cause.
*/
{
    const far = reachPitch(-0.2, 5, 0.3, 0.3);
    check('a target out of reach answers a straight arm, not NaN',
        Number.isFinite(far.shoulder) && Number.isFinite(far.elbow) && !far.reached, far);
    const inside = reachPitch(0, 0, 0.3, 0.1);
    check('a target inside the shortest fold is finite too',
        Number.isFinite(inside.shoulder) && Number.isFinite(inside.elbow), inside);
}

/*
  DOWN TO THE PAGE, THEN UP TO THE LENS.

  Both halves matter and only one of them is obvious. A presenter who never
  glances at their script reads as an animated mannequin; one who never looks up
  from it is worse, because the viewer is being addressed by the top of somebody's
  head.
*/
check('a line STARTS with the anchor looking at the script',
    scriptGlance(0, 1) > 0.9, scriptGlance(0, 1));
check('...and they are on the lens by the time the glance is over',
    scriptGlance(SCRIPT_GLANCE_SECONDS, 1) < 0.02,
    scriptGlance(SCRIPT_GLANCE_SECONDS, 1));
check('...and stay there for most of the story',
    scriptGlance(SCRIPT_GLANCE_SECONDS + 3, 1) === 0);
check('the lift is eased rather than a step',
    (() => {
        let previous = scriptGlance(0, 1);
        let biggestJump = 0;
        for (let t = 0; t <= SCRIPT_GLANCE_SECONDS; t += 1 / 60) {
            const now = scriptGlance(t, 1);
            biggestJump = Math.max(biggestJump, Math.abs(now - previous));
            previous = now;
        }
        return biggestJump < 0.09;
    })());
check('the weight never leaves 0..1 over a long story',
    (() => {
        for (let t = 0; t < 300; t += 1 / 30) {
            const w = scriptGlance(t, 1);
            if (!(w >= 0 && w <= 1) || !Number.isFinite(w)) return false;
        }
        return true;
    })());
/*
  The mid-story dip is SHALLOW on purpose: a presenter checking their place
  flicks down and back, they do not take their attention off the camera. At full
  weight it reads as losing their place mid-sentence.
*/
check('a mid-story glance is a flick, not a stare',
    (() => {
        let deepest = 0;
        for (let t = SCRIPT_GLANCE_SECONDS + 0.01; t < 120; t += 1 / 120) {
            deepest = Math.max(deepest, scriptGlance(t, 1));
        }
        return deepest > 0.05 && deepest < 0.6;
    })());
check('a silent anchor is not reading anything',
    scriptGlance(0, 0) === 0 && scriptGlance(5, 0) === 0);
check('and a negative time does not look down',
    scriptGlance(-1, 1) === 0);

/*
  THE SCRIPT AND THE EYES READ THE SAME COORDINATES.

  The set draws the sheet and the stage aims the presenters at it. Two copies of
  the number is a presenter looking at a point next to their paper, which reads
  as being distracted by something off-set — so both come out of `layout.ts`, and
  the sheet has to be somewhere a person at that desk could actually be looking.
*/
check('the script lies ON the desk, not through it or above it',
    SCRIPT_Y > DESK_TOP_Y && SCRIPT_Y < DESK_TOP_Y + 0.16,
    { SCRIPT_Y, DESK_TOP_Y });
check('and in front of the anchors, between them and the camera',
    SCRIPT_Z < ANCHOR_Z && SCRIPT_Z > CAMERA_Z,
    { SCRIPT_Z, ANCHOR_Z, CAMERA_Z });
check('each script is under its own anchor rather than in the middle',
    SCRIPT_X > ANCHOR_X * 0.5 && SCRIPT_X <= ANCHOR_X,
    { SCRIPT_X, ANCHOR_X });

/* ------------------------------------------------------------------ *
 * 5. The studio's geometry
 * ------------------------------------------------------------------ */

console.log('\nactors: the studio\n');

/*
  MALE SCREEN-RIGHT, FEMALE SCREEN-LEFT. That is the brief, it is decided once in
  `layout.ts`, and both the renderer and the DOM name plates read it from there.
  A stylesheet with its own copy of those percentages is what the photographed
  set had, and they were true only until something moved.
*/
check('the female anchor is on the left of the picture and the male on the right',
    PLATE_X.female < 0.5 && PLATE_X.male > 0.5, PLATE_X);
check('the two plates are symmetric about the centre line',
    Math.abs((PLATE_X.female + PLATE_X.male) / 2 - 0.5) < 1e-9);
check('both plates are inside the picture with room for a caption',
    PLATE_X.female > 0.1 && PLATE_X.male < 0.9, PLATE_X);
check('plateFraction maps the centre line to the centre',
    plateFraction(0) === 0.5 && plateFraction(HALF_WIDTH) === 1
    && plateFraction(-HALF_WIDTH) === 0);

/*
  The video wall has to fit BETWEEN the anchors in the PICTURE, which is not the
  same as fitting between them in metres — and comparing the metres is the
  mistake this check made first. The wall is 1.9 m wide and the anchors are 1.72
  m apart, so in the room the wall is wider; it sits two and a half metres
  further from the lens, so on screen it is narrower. Perspective is the whole
  point of putting it back there.
*/
const wallHalf = (WALL_Z - CAMERA_Z) * Math.tan(CAMERA_FOV / 2);
const wallEdge = plateFraction(WALL_W / 2, wallHalf);
check('the video wall projects INSIDE the two anchors',
    wallEdge < PLATE_X.male && 1 - wallEdge > PLATE_X.female,
    { wallEdge, plates: PLATE_X });

/*
  The desk has to hide the hips. Every figure is modelled from the hips up, so a
  desk below the lowest hip in the cast shows a torso hovering over a floor.
*/
const lowestHip = Math.min(...ANCHOR_FIGURES.map(f => proportionsFor(f).hipY));
check('the desk top is above every anchor hip, so nothing hovers',
    DESK_TOP_Y > lowestHip, { DESK_TOP_Y, lowestHip });

/*
  ...and BELOW every anchor shoulder, or the desk crosses the chest and the
  presenters read as standing behind a wall.
*/
const lowestShoulder = Math.min(...ANCHOR_FIGURES.map(f => proportionsFor(f).shoulderY));
check('and below every anchor shoulder, so nobody is buried in it',
    DESK_TOP_Y < lowestShoulder, { DESK_TOP_Y, lowestShoulder });

/* ------------------------------------------------------------------ *
 * 6. Voice casting
 * ------------------------------------------------------------------ */

console.log('\nactors: voice casting\n');

check('a male seat gets a male voice when one exists',
    castVoice([voice('Microsoft David'), voice('Microsoft Zira')], 'male').voice?.name
        === 'Microsoft David');
check('a female seat gets a female voice when one exists',
    castVoice([voice('Microsoft David'), voice('Microsoft Zira')], 'female').voice?.name
        === 'Microsoft Zira');
check('a mismatch is reported rather than hidden',
    castVoice([voice('Microsoft Zira')], 'male').matched === false
    && castVoice([voice('Microsoft Zira')], 'male').voice !== null);
check('and the pitch compensates for it',
    pitchFor('male', false) < pitchFor('male', true)
    && pitchFor('female', false) > pitchFor('female', true));

/*
  A WRONG-LANGUAGE VOICE IS NEVER CAST, and this is the rule that must not be
  relaxed for "some sound is better than none". An explicitly assigned
  `utterance.voice` OVERRIDES `utterance.lang`, so an English engine handed
  Arabic characters reads them with English phonetics — which is noise, not an
  accent, and was reported on the newscast as "it reads mixed words".
*/
check('a non-English voice is never cast for English',
    castVoice([voice('Microsoft Hoda - Arabic (Egypt)', 'ar-EG'),
               voice('Microsoft Naayf', 'ar-SA')], 'male').voice === null);
check('...and the caller is told it was the LANGUAGE that was missing',
    castVoice([voice('Microsoft Hoda', 'ar-EG')], 'male', 0, 'en').languageAvailable === false);
check('an unknown voice name is still usable when it is all there is',
    castVoice([voice('Custom Voice 1')], 'female').voice !== null
    && castVoice([voice('Custom Voice 1')], 'female').matched === false);
check('seats spread across the voices available',
    (() => {
        const pool = [voice('Microsoft David'), voice('Microsoft Mark'), voice('Microsoft Guy')];
        const names = [0, 1, 2].map(i => castVoice(pool, 'male', i).voice?.name);
        return new Set(names).size === 3;
    })());

check('deviceCanSpeak answers on the LANGUAGE, not the gender',
    deviceCanSpeak([voice('Microsoft Hoda', 'ar-EG')], 'ar')
    && !deviceCanSpeak([voice('Microsoft Hoda', 'ar-EG')], 'zh'));

/* ------------------------------------------------------------------ *
 * 7. The speech decision table — where Arabic was silent
 * ------------------------------------------------------------------ */

console.log('\nactors: how a line gets spoken\n');

const arabicVoices = [voice('Microsoft Hoda', 'ar-EG'), voice('Microsoft Naayf', 'ar-SA')];
const englishOnly = [voice('Microsoft David'), voice('Microsoft Zira')];

check('a device voice in the right language wins',
    planSpeech(arabicVoices, 'ar', 'male', 0, NO_SERVER).route === 'device');
check('and the utterance takes that VOICE\'s own lang, not the locale\'s',
    planSpeech([voice('Microsoft Hoda', 'ar-EG')], 'ar', 'female', 0, NO_SERVER).lang === 'ar-EG');

/*
  THE BUG, STATED AS A CHECK.

  The rooms gated the server route on `capabilities.languages[locale].paired` —
  "does app 36 have a male AND a female voice". App 36's replica has been missing
  `edge-tts` for some time, so the single-voice fallback provider is in charge and
  `paired` is false for every language. Read as "the server cannot help", that
  turns down a working Arabic voice and goes silent instead.

  `available` is the question that matters. Gender is a separate and lesser
  problem with its own answer: reshape the audio.
*/
const soloFemale = { available: true, paired: false, soloGender: 'female' as Gender };

check('an UNPAIRED server is still used when the device has no voice at all',
    planSpeech(englishOnly, 'ar', 'female', 0, soloFemale).route === 'server');
check('...for a male seat too, rather than leaving him silent',
    planSpeech(englishOnly, 'ar', 'male', 0, soloFemale).route === 'server');
check('...and the room undertakes to reshape what it asked for',
    (() => {
        const plan = planSpeech(englishOnly, 'ar', 'male', 0, soloFemale);
        return plan.allowAnyVoice === true && plan.shapeTo === 'male';
    })());
check('a female seat on a female-only server needs no reshaping',
    (() => {
        const plan = planSpeech(englishOnly, 'ar', 'female', 0, soloFemale);
        return plan.allowAnyVoice === false && plan.shapeTo === null && plan.matched;
    })());
check('a PAIRED server never asks for the wrong gender',
    (() => {
        const plan = planSpeech(englishOnly, 'ar', 'male', 0,
            { available: true, paired: true, soloGender: '' });
        return plan.allowAnyVoice === false && plan.shapeTo === null && plan.matched;
    })());
/*
  A browser with no Web Audio cannot reshape, and the room must not pretend it
  did: the substitution still happens (a silent seat is worse than a wrong-gender
  one in a meeting) and `matched` goes false, so `describe` says so on screen.
  That is working rule 21 — substitute only when it is declared.
*/
check('without Web Audio the substitution is declared rather than hidden',
    (() => {
        const plan = planSpeech(englishOnly, 'ar', 'male', 0, soloFemale, false);
        return plan.route === 'server' && plan.allowAnyVoice === true
            && plan.shapeTo === null && plan.matched === false;
    })());
check('no device voice and no server falls through to the platform route',
    planSpeech(englishOnly, 'ar', 'male', 0, NO_SERVER).route === 'platform');
check('the platform route still sets lang, which is the only clue it has',
    planSpeech(englishOnly, 'zh', 'male', 0, NO_SERVER).lang === 'zh');
check('the platform route assigns no voice, so lang can be matched',
    planSpeech(englishOnly, 'zh', 'male', 0, NO_SERVER).voice === null);

check('serverVoicesFor reads a paired language',
    (() => {
        const v = serverVoicesFor({ languages: { ar: { paired: true, genders: ['female', 'male'] } } }, 'ar');
        return v.available && v.paired;
    })());
check('...a single-gender one',
    (() => {
        const v = serverVoicesFor({
            languages: { ar: { paired: false, genders: ['female'], solo_gender: 'female' } },
        }, 'ar');
        return v.available && !v.paired && v.soloGender === 'female';
    })());
check('...and treats a language it does not list as unavailable',
    serverVoicesFor({ languages: { ar: { paired: true } } }, 'zh').available === false);
check('a null capability answer is unavailable rather than a crash',
    serverVoicesFor(null, 'ar').available === false
    && serverVoicesFor(undefined, 'ar').available === false);

check('describe names the reshaping, so a stand-in is never silent about itself',
    describe(planSpeech(englishOnly, 'ar', 'male', 0, soloFemale), 'العربية', 'ar-XA-Wavenet')
        .includes('reshaped'));
check('describe names an unreshaped stand-in too',
    describe(planSpeech(englishOnly, 'ar', 'male', 0, soloFemale, false), 'العربية', 'x')
        .includes('stand-in'));
check('describe names the device voice when there is one',
    describe(planSpeech(arabicVoices, 'ar', 'female', 0, NO_SERVER), 'العربية')
        .includes('Hoda'));

/* ------------------------------------------------------------------ *
 * 8. Level
 * ------------------------------------------------------------------ */

console.log('\nactors: level\n');

/*
  THE COMPRESSOR IS THE ONLY PLACE LEFT WITH LOUDNESS IN IT.

  `normalizeLevel` takes a clip to `TARGET_RMS` unless a peak would clip first,
  and for real speech the peak binds — `check:newscast` asserts exactly that at
  the measured crest factor. So raising the target buys nothing and the reported
  "the Self Study voice is too quiet" can only be answered by reducing the crest,
  which is what a broadcast compressor does.
*/
check('the compressor threshold is below full scale and above room tone',
    COMPRESSOR_THRESHOLD_DB < 0 && COMPRESSOR_THRESHOLD_DB > -30, COMPRESSOR_THRESHOLD_DB);
check('the ratio is broadcast rather than mastering',
    COMPRESSOR_RATIO > 1.5 && COMPRESSOR_RATIO <= 5, COMPRESSOR_RATIO);
check('there IS makeup gain, or the compressor only makes it quieter',
    VOICE_MAKEUP > 1, VOICE_MAKEUP);
/*
  And it cannot be so much that the compressor's own output clips. At this
  threshold and ratio a line peaking at -0.3 dBFS comes out around -12.2 dBFS,
  so the most that fits under 0 dBFS is about 4.1x.
*/
const headroomDb = -COMPRESSOR_THRESHOLD_DB - (-COMPRESSOR_THRESHOLD_DB) / COMPRESSOR_RATIO;
const ceiling = Math.pow(10, headroomDb / 20);
check('...and not so much that the output clips',
    VOICE_MAKEUP <= ceiling, { VOICE_MAKEUP, ceiling: Number(ceiling.toFixed(2)) });

/* ------------------------------------------------------------------ *
 * 9. The seats, the interviewer, and the two views
 * ------------------------------------------------------------------ */

console.log('\nactors: seats and views\n');

check('every seat names a figure that exists',
    SEATS.every(s => isFigureId(s.actor)),
    SEATS.filter(s => !isFigureId(s.actor)).map(s => s.actor));
check('every seat key is unique',
    new Set(SEATS.map(s => s.key)).size === SEATS.length);
check('ACTORS is derived from FIGURES rather than restated',
    ACTORS.every(a => {
        const f = FIGURES.find(x => x.id === a.id);
        return !!f && f.name === a.name && f.gender === a.gender;
    }));
check('seatGenders agrees with the cast',
    (() => {
        const map = seatGenders();
        return SEATS.every(s => map[s.key] === actorById(s.actor).gender);
    })());
check('seatLabel carries the emoji, the name and the role',
    SEATS.every(s => {
        const label = seatLabel(s);
        return label.includes(s.emoji) && label.includes(actorById(s.actor).name)
            && label.includes(s.role);
    }));
check('seatByKey answers null rather than throwing on an unknown key',
    seatByKey('nobody') === null && seatByKey('timer') !== null);
check('isActorId agrees with ACTORS',
    ACTORS.every(a => isActorId(a.id)) && !isActorId('nobody'));

/*
  The interviewer picker indexes an array from `Math.random()`, so the top of the
  range is the interesting part: an off-by-one there is an interview conducted by
  `undefined`, and it happens to one candidate in a few thousand.
*/
check('the interviewer picker never returns undefined, at either end',
    (() => {
        for (const r of [0, 0.0001, 0.5, 0.999999, 1]) {
            const actor = pickInterviewer(() => r);
            if (!actor || !isActorId(actor.id as ActorId)) return false;
        }
        return true;
    })());
check('every interview type has a title',
    (Object.keys(INTERVIEWER_TITLES) as (keyof typeof INTERVIEWER_TITLES)[])
        .every(k => !!INTERVIEWER_TITLES[k].title && !!INTERVIEWER_TITLES[k].emoji));
check('interviewerLabel names the person and the role',
    interviewerLabel(ACTORS[0]!, 'HR').includes(ACTORS[0]!.name));

for (const view of VIEWS) {
    const name = view.split(/[\\/]/).pop();
    const src = existsSync(view) ? stripComments(readFileSync(view, 'utf8')) : '';
    check(`${name} draws the cast through PersonStage`, src.includes('PersonStage'));
    check(`${name} no longer imports the deleted media component`,
        !src.includes('SpeakerMedia'));
    // The faces used to be SVG markup pushed through `v-html`, which is the one
    // habit working rule 13 is about.
    check(`${name} has no v-html left`, !src.includes('v-html'));
    /*
      Both rooms reach the server engine, and the meeting is the one that did
      not: it passed a hardcoded `false` for "can app 36 speak this language",
      so six seats fell straight through to a platform route that says nothing
      on a machine with no Arabic voice.
    */
    check(`${name} asks app 36 what it can voice`,
        src.includes('serverVoicesFor'));
    check(`${name} levels its clips through speechAudio`,
        src.includes('speechAudio'));
    check(`${name} never plays a server clip through a bare <audio> element`,
        !/new Audio\(/.test(src));
}

/*
  An orphan is the residue of a rename: the old file stays, the page still works,
  and hundreds of kilobytes ship to every visitor for ever. These are the twelve
  actor files, the ten studio plates, and the two modules that named them.
*/
for (const path of GONE) {
    check(`${path.split(/[\\/]/).slice(-2).join('/')} is gone, not orphaned`,
        !existsSync(path));
}

console.log(failures === 0
    ? '\nactors: all checks passed\n'
    : `\nactors: ${failures} check(s) FAILED\n`);
process.exit(failures === 0 ? 0 : 1);
