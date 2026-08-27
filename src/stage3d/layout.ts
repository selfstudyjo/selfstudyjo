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
 *   the video wall   1.9 m at z = 3.05 spans 31% to 69% — between them
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

/** The video wall: its plane, its centre height, and its size. */
export const WALL_Z = 3.05;
export const WALL_Y = 2.15;
export const WALL_W = 1.9;
export const WALL_H = WALL_W * 9 / 16;

/** The camera, spelled out so the set and the shot cannot disagree. */
export const CAMERA_Y = 1.385;
export const CAMERA_Z = -2.35;
export const CAMERA_FOV = 0.86;

/** Half the visible width at the anchor plane. See the header. */
export const HALF_WIDTH = (ANCHOR_Z - CAMERA_Z) * Math.tan(CAMERA_FOV / 2);

/** A world X, as a fraction of the picture's width. 0 is the left edge. */
export function plateFraction(x: number, halfWidth = HALF_WIDTH): number {
    return 0.5 + (x / halfWidth) * 0.5;
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
