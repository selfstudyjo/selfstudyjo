/**
 * Where things are on the newscast set, as plain numbers.
 *
 * A module of its own, with NO imports at all, because three very different
 * things need these values and only one of them can afford to reach the
 * renderer:
 *
 *  * `setPieces.ts` builds the room around them;
 *  * `studioStage.ts` places the anchors and the camera with them;
 *  * `NewsStudio.vue` pins its DOM name plates over them — and that component
 *    renders on every visit to the Newscast, including the one where WebGL is
 *    unavailable and Babylon is never downloaded at all.
 *
 * The old studio had this pair of numbers written down twice: `12.33%` and
 * `87.67%` in the stylesheet, being the midpoints of two photographic plates,
 * and nothing anywhere connected them to the plates. They were correct for
 * exactly as long as nobody moved anything.
 *
 * ============================================================
 * THE FRAMING, WHICH EVERYTHING ELSE IS DERIVED FROM
 * ============================================================
 *
 *   camera            (0, 1.385, -2.35), looking level at (0, 1.385, 1.2)
 *   fov               0.86 rad, HORIZONTAL-fixed  ->  tan(half) = 0.4577
 *   aspect            1428 / 788 = 1.812, so tan(halfV) = 0.4577 / 1.812 = 0.2526
 *   anchor plane      z = 0.5, so 2.85 m from the lens
 *   half-width there  2.85 * 0.4577 = 1.305 m
 *   half-height there 2.85 * 0.2526 = 0.720 m
 *
 * Which fixes the composition rather than leaving it to be nudged:
 *
 *   the desk edge    y = 1.06 at z = -0.15 lands 80% down the frame
 *   the heads        y ~ 1.68 at z = 0.5  lands 29% down, at 16% of frame height
 *   the anchors      x = +-0.80 is 61% of half-width, so 19.3% and 80.7% across
 *   the video wall   2.13 m at z = 3.05 spans 28.5% to 71.5% — between them
 *
 * ...and the aspect ratio in that arithmetic is the thing this file did NOT
 * account for until 2026-08-29. It is not a constant: `.studio__stage` is
 * `width: 100%` with a `max-height`, and when the cap binds the box keeps its
 * width and loses height. Under a horizontal-fixed lens that costs VERTICAL
 * field, and a third of the video wall was above the top of the picture. See
 * {@link SAFE_ASPECT} — every dimension the frame must contain is now derived
 * from it rather than composed by eye at one ratio.
 *
 * ============================================================
 * THE LENS CAME IN FROM 1.00 TO 0.86, AND WHY
 * ============================================================
 *
 * 1.00 rad is a 55-degree horizontal field, which is a wide lens. On a set this
 * size it put the two presenters' heads at 13% of the frame height with a metre
 * and a half of cyclorama between them, and about a fifth of the picture was
 * floor. Nothing in it was WRONG — the numbers all landed where this file said
 * they would — and it read as a wide shot of a big empty room with two small
 * people in it, which is not how a bulletin is framed. A gallery cuts to a
 * two-shot at something nearer a 45-degree field.
 *
 * Everything else in the set followed on its own, which is the property this
 * file exists for: the desk moved down the frame, the floor strip halved, and
 * the DOM name plates re-derived their own positions from `plateFraction`.
 *
 * The camera looks LEVEL rather than tilted down. A tilt would be more
 * flattering and it costs the one property this file exists for: with any
 * pitch, a world Y no longer maps to a constant fraction of the picture, so
 * every number above becomes a function of depth and the DOM name plates can no
 * longer be pinned at all.
 *
 * Horizontal-fixed is what makes {@link plateFraction} a constant rather than a
 * function of the canvas shape: the stage is capped by `max-height` and is
 * routinely shorter than its own aspect ratio, and under the default
 * vertical-fixed fov the anchors would slide toward the centre as it got
 * squatter while the plates stayed where the CSS put them.
 */

/** Where the two anchors stand, either side of the centre line, in metres. */
export const ANCHOR_X = 0.80;

/** Their plane. The desk is in front of it and the video wall behind. */
export const ANCHOR_Z = 0.5;

/**
 * The desk surface, and the plane of its front panel.
 *
 * `DESK_TOP_Y` is chosen so the panel below it hides everything that is not
 * modelled: the figures stop at the hips (y ~ 0.95 on a 1.8 m anchor), so a
 * desk on legs would show two torsos hovering over a floor.
 */
export const DESK_TOP_Y = 1.06;
export const DESK_Z = -0.15;

/** The camera, spelled out so the set and the shot cannot disagree. */
export const CAMERA_Y = 1.385;
export const CAMERA_Z = -2.35;
export const CAMERA_FOV = 0.86;

/** Half the visible width at the anchor plane. See the header. */
export const HALF_WIDTH = (ANCHOR_Z - CAMERA_Z) * Math.tan(CAMERA_FOV / 2);

/**
 * ============================================================
 * THE SQUATTEST STAGE THE SET IS GUARANTEED TO SURVIVE
 * ============================================================
 *
 * This is the number the video wall was missing, and its absence is what
 * "the display screen does not appear completely" was.
 *
 * The camera is HORIZONTAL-fixed (see the header), which is what makes
 * {@link plateFraction} a constant — and it has a consequence nobody had
 * written down: the horizontal field is fixed, so the VERTICAL field shrinks as
 * the canvas gets wider relative to its height. `.studio__stage` is
 * `width: 100%` with `aspect-ratio: 1428/788` AND `max-height: min(68vh, 44rem)`,
 * and when the cap binds the box keeps its width and loses height — so its
 * actual aspect goes well past 1.812 and the top and bottom of the set leave the
 * picture.
 *
 * How far past depends on the browser window, so it is not a fixed crop that
 * could be composed for. Measured: a 1920x800 window gives a ~1400px stage
 * capped at 544px, i.e. an aspect of 2.6, at which the visible height at the
 * wall plane falls from 2.73 m to 1.92 m and a THIRD of the screen is above the
 * frame. At the design ratio it clipped too, by 6.5 cm, which is why it looked
 * like a rendering artefact rather than a layout one.
 *
 * Two things are done about it and both are needed:
 *
 *  1. `.studio__stage` now caps its WIDTH as well, so the box can never be
 *     squatter than its own ratio. That is the real fix — it also un-clips the
 *     lighting rig, and it will un-clip whatever is added next.
 *  2. Everything the frame must contain is placed from `SAFE_ASPECT` anyway.
 *     The stylesheet is in two files plus a preview harness, the failure is
 *     silent, and a set that only composes correctly when the CSS is right is a
 *     set that will be wrong again.
 *
 * 2.1 rather than 2.6: it is the aspect at which the wall can still hang ABOVE
 * the presenters' heads rather than level with them, and with the width cap in
 * place nothing should ever reach it. It is a backstop, not a target.
 */
export const SAFE_ASPECT = 2.1;

/** Half the vertical field, as a tangent, at the design and worst aspects. */
export const TAN_HALF_H = Math.tan(CAMERA_FOV / 2);
export const DESIGN_ASPECT = 1428 / 788;
export const TAN_HALF_V_DESIGN = TAN_HALF_H / DESIGN_ASPECT;
export const TAN_HALF_V_SAFE = TAN_HALF_H / SAFE_ASPECT;

/**
 * The highest world Y still inside the frame at depth `z`, at `SAFE_ASPECT`.
 *
 * The camera looks LEVEL, so the frame's top edge RISES with depth — which is
 * the fact behind both faults this function exists to prevent. A set piece at a
 * constant height is comfortably inside the picture far away and cut in half
 * near the camera, and that is not a shape anybody recognises: a lamp with its
 * bottom third showing along the top edge reads as a pale slab hanging into the
 * shot rather than as a lamp.
 */
export function frameTopAt(z: number, tanHalfV = TAN_HALF_V_SAFE): number {
    return CAMERA_Y + (z - CAMERA_Z) * tanHalfV;
}

/** Half the visible width at depth `z`. */
export function halfWidthAt(z: number): number {
    return (z - CAMERA_Z) * TAN_HALF_H;
}

/**
 * Where a world point lands across the picture. 0 the left edge, 1 the right.
 *
 * {@link plateFraction} answers this for the ANCHOR plane only, which is all the
 * DOM name plates need. The set needs it at other depths — to keep a lamp out of
 * a presenter's hair, for instance, which is a comparison between two things at
 * very different z.
 */
export function frameFractionAt(x: number, z: number): number {
    return 0.5 + (x / halfWidthAt(z)) * 0.5;
}

/**
 * ============================================================
 * THE VIDEO WALL, DERIVED
 * ============================================================
 *
 * It was `WALL_Y = 2.15` with `WALL_W = 1.9`, chosen so the composition read
 * well — and it did, at exactly one aspect ratio. Its top edge was at 2.684 and
 * the frame's top at the wall plane is 2.749 at the design ratio and 2.336 at
 * 2.6, so it clipped by 6 cm in the good case and by 35 cm in the ordinary one.
 *
 * Now the height is the largest that FITS, and the two things that bound it are
 * both stated rather than balanced by eye:
 *
 *  * the top edge must be inside the frame at {@link SAFE_ASPECT}, with a
 *    margin, or the fault comes straight back;
 *  * the wall must stay HORIZONTALLY BETWEEN the two anchors. That is what
 *    makes its lower half safe: their heads project to 80.6% across the frame
 *    and their shoulders begin at 71%, so a wall inside ±0.20 of the half-angle
 *    is never occluded by either — which is why it can hang low enough to be
 *    fully visible without a presenter standing in front of it.
 *
 * It comes out slightly WIDER than the hand-chosen version (2.16 m against 1.9)
 * as well as fully visible: 28% to 72% of the frame rather than 31% to 69%.
 */

/** The video wall's plane. Behind the anchors, in front of the lighting rig. */
export const WALL_Z = 3.05;

/**
 * How far across the picture the wall's edge may reach.
 *
 * Expressed as a FRAME FRACTION rather than as a width in metres, because that
 * is what the constraint actually is: the wall must not be crossed by either
 * presenter, and where a presenter is depends on the projection rather than on
 * any distance in the room.
 *
 * Measured off `proportionsFor` for the taller anchor, at the anchor plane: the
 * inner edge of a shoulder lands at 73.0% across and the inner edge of a head
 * at 74.9%. 71.5% leaves a centimetre and a half of margin at the shoulder,
 * which is the tighter of the two. Wider is not a rendering error -- it is a
 * presenter standing in front of a headline.
 */
export const WALL_EDGE_FRACTION = 0.715;

export const WALL_W = 2 * (WALL_EDGE_FRACTION - 0.5) * 2 * halfWidthAt(WALL_Z);
export const WALL_H = WALL_W * 9 / 16;

/** Its centre, as high as it can hang and still be whole. See above. */
export const WALL_Y = frameTopAt(WALL_Z) - 0.05 - WALL_H / 2;

/** A world X, as a fraction of the picture's width. 0 is the left edge. */
export function plateFraction(x: number, halfWidth = HALF_WIDTH): number {
    return 0.5 + (x / halfWidth) * 0.5;
}

/**
 * The lighting rig, derived from the frame rather than hung at a fixed height.
 *
 * Reported as lamps cut in half along the top of the picture, and the cause is
 * `frameTopAt`: at a constant 2.66 m a lamp is 24 cm above the frame's edge at
 * the front truss and comfortably inside it at the back. Hung a fixed distance
 * BELOW the frame's own top edge, every lamp is whole and the row of them lands
 * on one horizontal line across the picture — which is what a rig looks like
 * through a level lens, and which no constant height can produce.
 *
 * `RIG_CLEARANCE` is the lamp's own half-extent plus a margin: a barrel 40 cm
 * long tilted 0.85 rad reaches about 25 cm above its centre.
 */
export const RIG_CLEARANCE = 0.34;

/**
 * The rig is placed for the DESIGN aspect, and the wall for `SAFE_ASPECT`.
 *
 * That difference is deliberate and it is the general rule for this set:
 * GUARANTEE WHAT CARRIES INFORMATION, AND LET DECORATION CROP.
 *
 * A headline that is 30% missing is a bulletin nobody can read, so the video
 * wall is placed for the squattest stage the set is meant to survive even though
 * that costs it 60 cm of height at the aspect it will actually be shown at. A
 * lighting rig carries nothing: on a stage squat enough to cut it, losing the
 * lamps entirely is a tighter crop, which is a thing a gallery does on purpose.
 *
 * Placed for `SAFE_ASPECT` the lamps came out 20 cm lower and read as six large
 * bright objects in the upper third of the picture rather than as a rig glimpsed
 * along the top of it -- brighter than the presenters, which is the fault the
 * comments in `setPieces.ts` spend three paragraphs on. The margin over the
 * design ratio is small (6%) and exists only to absorb a scrollbar or a
 * subpixel rounding, not a layout.
 */
export const RIG_ASPECT = DESIGN_ASPECT * 1.06;

export function rigHeightAt(z: number): number {
    return frameTopAt(z, TAN_HALF_H / RIG_ASPECT) - RIG_CLEARANCE;
}

export type StudioAnchorId = 'male' | 'female';

/**
 * Where each name plate belongs.
 *
 * Male screen-RIGHT and female screen-LEFT. Babylon is left-handed, so with the
 * camera at negative Z looking toward positive Z, world +X is on the right of
 * the picture — which is why the male anchor is the positive one.
 */
export const PLATE_X: Record<StudioAnchorId, number> = {
    female: plateFraction(-ANCHOR_X),
    male: plateFraction(ANCHOR_X),
};

/**
 * The script each anchor holds on the desk.
 *
 * `DESK_TOP_Y` plus the thickness of the desk slab is where a sheet of paper
 * lies, and the anchors' hands are solved to that height — see `reachPitch` in
 * `figures.ts`. The Z is in FRONT of the anchor plane, i.e. between them and the
 * camera, because that is where a desk is.
 *
 * Written down here rather than in `setPieces.ts` because two files need to
 * agree about it exactly: the set draws the sheet and the stage aims the
 * presenters' eyes at it. A second copy of this number is a presenter looking at
 * a point next to their script.
 */
export const SCRIPT_Y = DESK_TOP_Y + 0.075;
export const SCRIPT_Z = 0.16;
/** How far out from the centre line each anchor's script lies. */
export const SCRIPT_X = ANCHOR_X * 0.86;
