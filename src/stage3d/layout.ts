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
 *   fov               1.00 rad, HORIZONTAL-fixed  ->  tan(half) = 0.5463
 *   aspect            1428 / 788 = 1.812, so tan(halfV) = 0.5463 / 1.812 = 0.3015
 *   anchor plane      z = 0.5, so 2.85 m from the lens
 *   half-width there  2.85 * 0.5463 = 1.557 m
 *   half-height there 2.85 * 0.3015 = 0.859 m
 *
 * Which fixes the composition rather than leaving it to be nudged:
 *
 *   the desk edge    y = 1.06 at z = -0.15 lands 75% down the frame
 *   the heads        y ~ 1.68 at z = 0.5  lands 33% down, with 28% headroom
 *   the anchors      x = +-0.86 is 55% of half-width, so 22.4% and 77.6% across
 *   the video wall   1.9 m at z = 3.05 spans 36% to 64% — between them
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
export const ANCHOR_X = 0.86;

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
export const CAMERA_FOV = 1.00;

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
