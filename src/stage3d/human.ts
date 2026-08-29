/**
 * Building one person, in Babylon, from a {@link FigureSpec}.
 *
 * This is the browser half of the cast. `figures.ts` is the plain half — who
 * the people are and how they move — and it is the one `npm run check:actors`
 * drives in node. Nothing in here can be checked without a GPU, so nothing in
 * here decides anything: it is geometry and materials, and every number that
 * changes over time comes out of `figures.ts`.
 *
 * ============================================================
 * WHY THE HEAD IS SCULPTED AND NOT ASSEMBLED
 * ============================================================
 *
 * The obvious way to build a head out of primitives is to stack them — a
 * sphere for the cranium, a cone for the nose, a squashed sphere for the jaw —
 * and the result is unmistakably a snowman. Every join is a hard silhouette
 * edge, and a silhouette edge in the wrong place is the single strongest cue
 * that something is not a person; it survives any amount of good lighting.
 *
 * So there is ONE mesh for the head, and it is a unit sphere whose every vertex
 * is moved by {@link sculptHeadVertex} before its normals are computed. The
 * skull, the brow ridge, the eye sockets, the cheekbones, the nose, the lips
 * and the jaw are all displacements of one continuous surface, so the
 * silhouette is a head-shaped curve rather than a union of balls, and the
 * shading is continuous across all of it.
 *
 * The eyes, lids, brows, ears and hair are separate meshes because they are
 * separate things — an eyelid has to rotate and hair has to be a different
 * material — but each of them sits ON the sculpted surface rather than
 * replacing part of it.
 *
 * ============================================================
 * WHAT IS DELIBERATELY NOT ATTEMPTED
 * ============================================================
 *
 * Photographic realism is not reachable from procedural geometry with no
 * textures, no scanned displacement and no subsurface scattering, and pretending
 * otherwise produces the uncanny valley rather than a photograph. What this
 * aims at instead is the thing that actually makes a viewer accept a person:
 * correct proportion, a continuous silhouette, three-point lighting, eyes that
 * are wet and catch a highlight, and — above all — MOTION that belongs to the
 * moment. A well-lit stylised head that blinks at human intervals, breathes,
 * drifts, and opens its mouth on the actual waveform of the audio reads as a
 * person; a photoreal head that holds still does not.
 *
 * ============================================================
 * COST
 * ============================================================
 *
 * One figure is ~24 meshes and ~9 000 triangles. Six of them (the meeting) is
 * ~54 000, which is nothing for a GPU — but 144 draw calls would be something
 * for a phone, so the portrait stage puts each figure a hundred metres from the
 * next and lets the frustum cull all but one per viewport. See
 * `portraitStage.ts`.
 */

import type { Scene } from '@babylonjs/core/scene';
import type { Mesh } from '@babylonjs/core/Meshes/mesh';
import type { TransformNode } from '@babylonjs/core/Meshes/transformNode';
import type { PBRMaterial } from '@babylonjs/core/Materials/PBR/pbrMaterial';

import type * as BJS from './babylon';
import {
    FINGERS, blink, breath, browRaise, clamp01, fingerCurl, gesture,
    headEmphasis, headRollEmphasis, jawOpen, lipSpread, listenNod, mouthPress,
    proportionsFor, reachPitch, saccade, smooth, sway, torsoTwist,
    type FigureSpec, type FingerSpec, type HairStyle, type Proportions,
} from './figures';
import { applyNormal } from './textures';

/* ------------------------------------------------------------------ *
 * Materials
 * ------------------------------------------------------------------ */

/**
 * A little noise in the ROUGHNESS, and nothing in the colour.
 *
 * The tell of an untextured PBR surface is that it is uniformly glossy: every
 * pixel of a cheek reflects the key light by exactly the same amount, so the
 * highlight is a hard oval and the face reads as moulded plastic. Real skin and
 * real wool vary micro-metre to micro-metre, which breaks the highlight into
 * something soft-edged.
 *
 * That is a roughness map, not a colour map — which is why this is drawn into
 * the GREEN channel and fed to `metallicTexture` with
 * `useRoughnessFromMetallicTextureGreen`. Tinting the albedo instead would make
 * the skin look dirty, which is the mistake that looks like an improvement in a
 * screenshot and like a rash in motion.
 *
 * One 128×128 canvas, generated once per scene and shared by every material in
 * it. Deterministic, so two runs render the same frame.
 */
function microRoughness(B: typeof BJS, scene: Scene): BJS.DynamicTexture {
    const held = (scene as any).__sfsMicroRoughness;
    if (held) return held;

    const size = 128;
    /*
      MIPMAPS ON, which is the fourth argument and the one that matters.

      This texture is deliberately high-frequency and it is sampled over a whole
      head at a few hundred pixels. Without mipmaps every minified pixel is one
      arbitrary texel, so the noise beats against the pixel grid and the face
      renders as a moiré chequerboard rather than as skin — which is what the
      first render of this scene did, unmistakably and across the whole frame.
      Mipmapped, the same texture averages to flat mid-grey at distance and only
      shows its detail where the surface is close enough to want it.
    */
    const texture = new B.DynamicTexture('sfs-micro', { width: size, height: size }, scene, true);
    const ctx = texture.getContext() as unknown as CanvasRenderingContext2D;
    const image = ctx.createImageData(size, size);
    // A fixed 32-bit LCG rather than Math.random(): two loads of the same page
    // should not be two different surfaces, and a check that ever wants to
    // compare frames needs this to be reproducible.
    let seed = 0x2f6e2b1;
    for (let i = 0; i < size * size; i++) {
        seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
        const n = (seed >>> 8) & 0xff;
        // Roughness is centred, not full-range: ±12% around whatever the
        // material asks for. Full-range noise is a sandblasted surface.
        const g = 128 + ((n - 128) * 0.24);
        image.data[i * 4] = 255;      // unused by PBR
        image.data[i * 4 + 1] = g;    // roughness
        image.data[i * 4 + 2] = 0;    // metallic: nothing here is metal
        image.data[i * 4 + 3] = 255;
    }
    ctx.putImageData(image, 0, 0);
    texture.update(false);
    texture.wrapU = 1; // WRAP
    texture.wrapV = 1;
    // Skin at a grazing angle is where the noise is most visible and most
    // aliased; anisotropic filtering is the cheap half of fixing that.
    texture.anisotropicFilteringLevel = 4;
    (scene as any).__sfsMicroRoughness = texture;
    return texture;
}

interface SurfaceOptions {
    roughness?: number;
    metallic?: number;
    /** Emissive colour, for the LED strips and screens in the studio. */
    glow?: string;
    /** 0..1. Anything above 0 is treated as a transparency and sorted. */
    alpha?: number;
    /** Skip the micro-roughness noise — right for glass and screens. */
    flat?: boolean;
}

/**
 * One PBR surface.
 *
 * `PBRMaterial` rather than `StandardMaterial` throughout, and that is not a
 * preference: energy-conserving specular is most of what separates "a lit 3D
 * model" from "a photograph of an object", and `StandardMaterial`'s Phong
 * highlight is the other half of the plastic look that the roughness noise
 * above is fixing.
 */
export function surface(
    B: typeof BJS, scene: Scene, name: string, hex: string, options: SurfaceOptions = {},
): PBRMaterial {
    const material = new B.PBRMaterial(name, scene);
    material.albedoColor = B.Color3.FromHexString(hex);
    material.metallic = options.metallic ?? 0;
    material.roughness = options.roughness ?? 0.6;
    if (!options.flat) {
        material.metallicTexture = microRoughness(B, scene);
        material.useRoughnessFromMetallicTextureGreen = true;
        material.useMetallnessFromMetallicTextureBlue = true;
        material.useRoughnessFromMetallicTextureAlpha = false;
    }
    if (options.glow) {
        material.emissiveColor = B.Color3.FromHexString(options.glow);
    }
    if (options.alpha !== undefined && options.alpha < 1) {
        material.alpha = options.alpha;
        material.transparencyMode = 2; // ALPHABLEND
    }
    // Nothing here is ever seen from inside, and backface culling on is one
    // fewer triangle per pixel everywhere.
    material.backFaceCulling = true;
    return material;
}

/* ------------------------------------------------------------------ *
 * The head sculpt
 * ------------------------------------------------------------------ */

/** A 3D bump, falling off smoothly to nothing at `radius`. */
function blob(dx: number, dy: number, dz: number, radius: number): number {
    const d = Math.sqrt(dx * dx + dy * dy + dz * dz) / radius;
    return d >= 1 ? 0 : Math.pow(1 - d * d, 2);
}

/** A 1D bump. `width` is the half-width at which it has fallen to nothing. */
function ridge(x: number, centre: number, width: number): number {
    const d = Math.abs(x - centre) / width;
    return d >= 1 ? 0 : Math.pow(1 - d * d, 2);
}

/**
 * Where one vertex of the head sphere actually goes.
 *
 * `p` is a point on the UNIT sphere: +y up, +z toward the camera, +x to the
 * figure's left. The return is in metres.
 *
 * Everything is expressed as a displacement of that unit sphere rather than as
 * an absolute coordinate, so the whole face scales with `radius` and a 1.66 m
 * figure has a proportionally smaller nose rather than the same nose on a
 * smaller head — which is the thing that makes a scaled model read as a child.
 */
export function sculptHeadVertex(
    x: number, y: number, z: number, radius: number, male: boolean, jawWidth: number,
): [number, number, number] {
    // The three semi-axes of a human skull, as fractions of its half-height.
    // A head is markedly narrower than it is deep, and both are less than its
    // height; getting this wrong is what makes a rendered head look inflated.
    /*
      0.72 rather than the 0.65 a skull actually measures.

      This is the one deliberate departure from anatomy in the sculpt, and the
      reason is the silhouette rather than the cross-section: with no hair
      volume, no ears to speak of at this distance and a jaw that has to taper,
      a strictly correct width renders as an egg. Two hundredths back gives the
      cheekbones something to sit on.
    */
    const semiX = 0.720;
    const semiY = 1.0;
    const semiZ = 0.815;

    let u = x, v = y, w = z;

    /* -- the jaw and chin -------------------------------------------------
       Below the cheekbones the skull narrows sharply, and how sharply is most
       of the difference between a male and a female face at this distance. A
       male jaw keeps its width lower down (a squarer gonial angle); a female
       one tapers earlier and further. */
    const below = smooth(-0.05, -0.92, v);
    /*
      How hard the jaw narrows, and it is the number that decides whether a
      face reads as a face or as a wedge.

      The first pass used 0.30 / 0.42 and every head came out long and narrow —
      correct in cross-section and wrong in silhouette, because the taper starts
      at the cheekbone and a real mandible keeps most of its width down to the
      angle of the jaw. Male keeps more of it than female; that difference is
      most of what a viewer reads as gender at this distance, and it is doing
      more work than the hairstyle.
    */
    const taper = 1 - (male ? 0.18 : 0.28) * below * jawWidth;
    u *= taper;
    w *= 1 - 0.16 * below;

    // The chin itself projects forward and, on a male face, is squarer.
    const chin = smooth(-0.40, -0.86, v) * smooth(0.0, 0.55, w) * ridge(u, 0, 0.46);
    w += chin * (male ? 0.115 : 0.088);
    v += chin * 0.02;

    /* -- cheekbones -------------------------------------------------------
       The widest point of a face is the zygomatic arch, not the temples. */
    const cheek = ridge(v, 0.02, 0.30) * smooth(0.05, 0.62, w);
    u *= 1 + 0.075 * cheek;
    w += 0.030 * cheek * ridge(u, male ? 0.52 : 0.48, 0.42);

    /* -- temples ----------------------------------------------------------
       Narrower than the cheekbones and than the parietal above them. Without
       this the head is an egg from the front. */
    u *= 1 - 0.055 * ridge(v, 0.42, 0.34) * smooth(0.35, 0.95, Math.abs(u));

    /* -- the brow ridge ---------------------------------------------------
       The single most sexually dimorphic feature of a skull, and the one that
       gives a face somewhere for the eyes to sit UNDER rather than on. */
    const brow = ridge(v, 0.235, 0.155) * smooth(0.42, 0.95, w);
    w += brow * (male ? 0.075 : 0.048);

    /* -- eye sockets ------------------------------------------------------
       Pushed in along the surface normal, which is what makes an eyeball read
       as sitting in a socket rather than stuck on a wall.

       ============================================================
       0.16, AND THE NUMBER IS LOAD-BEARING
       ============================================================

       At 0.115 the socket floor came out at 0.669 of the head's depth and the
       eyeball's front surface at 0.667 — so every eye was two thousandths of a
       head-radius INSIDE the skull, and eight figures rendered with smooth
       blank masks for faces. It is not a subtle artefact and it is not
       obviously a depth problem either: what you see is a person with their
       eyes closed, which reads as a modelling choice.

       Deep enough that the eye protrudes through it, and the brow ridge above
       still stands in front of the eye — which is the relationship that makes a
       socket read as a socket. */
    for (const side of [-1, 1]) {
        const socket = blob(u - side * 0.345, v - 0.055, w - 0.80, 0.38);
        const k = 1 - 0.160 * socket;
        u *= k; v *= k; w *= k;
    }

    /* -- the nose ---------------------------------------------------------
       A profile down the midline: nothing at the glabella, rising over the
       bridge, peaking just below the eye line, and gone again at the top lip.

       ============================================================
       BOTH ENDS OF IT HAVE TO BE CLOSED, AND THE BOTTOM ONE WAS NOT
       ============================================================

       The first version's bridge term was `0.35 * smooth(0.34, 0.12, v)`, which
       is 0.35 for EVERY v below 0.12 — so the ridge did not stop at the top
       lip, it ran on down over the mouth and the chin. What that renders as is
       a narrow blade down the centre of the face with a hard shading edge along
       one side of it, and at any distance it reads as a crease or a crack
       rather than as a nose.

       It also has to be WIDE ENOUGH. At a half-width of 0.145 in unit-sphere
       terms the nose was about nine millimetres across on a real head, and a
       nose is nearer thirty-five at the alae. The width now grows downward,
       which is the actual shape: narrow at the bridge, wide at the base.
    */
    const noseSpan = smooth(0.40, 0.22, v)        // starts below the glabella
        * smooth(-0.34, -0.16, v);                // and STOPS above the lip
    /*
      NARROWER THAN IT WAS, BY A THIRD.

      At `0.17 + 0.17` the half-width reached 0.34 of a unit sphere, so the nose
      was 0.68 units across against a face 1.44 wide — 47% of the width of the
      whole face. A nose at the alae is nearer 25%. What that produced was a
      broad smooth mound down the middle of every face, and because it was also
      the most forward thing on the head it cast the largest shadow in the frame:
      the single biggest reason the heads read as potatoes.
    */
    const noseWidth = (male ? 0.125 : 0.112) + 0.105 * smooth(0.26, -0.14, v);
    const noseProfile = (0.32 + 0.68 * ridge(v, -0.06, 0.26)) * noseSpan;
    const nose = noseProfile * ridge(u, 0, noseWidth) * smooth(0.34, 0.80, w);
    w += nose * (male ? 0.185 : 0.165);
    // The alae flare either side of the tip.
    for (const side of [-1, 1]) {
        const ala = blob(u - side * 0.095, v + 0.135, w - 0.86, 0.115);
        w += ala * 0.048;
        u += side * ala * 0.024;
    }

    /* -- the mouth --------------------------------------------------------
       The lips are their own meshes so they can move, but the surface under
       them is not flat: there is a philtrum above and a mentolabial crease
       below, and both catch light in a way that reads as a mouth even before
       the lips are drawn. */
    w -= 0.028 * blob(u, v + 0.315, w - 0.84, 0.30);         // crease under the lip
    w += 0.020 * blob(u, v + 0.205, w - 0.86, 0.16);         // philtrum column

    /* -- the cranium ------------------------------------------------------
       Flatter at the very top than a sphere, fuller at the occiput. */
    v -= 0.070 * smooth(0.48, 1.0, v);
    w -= 0.045 * smooth(0.30, 0.95, -w) * smooth(-0.30, 0.60, v);

    /* -- the neck opening -------------------------------------------------
       The bottom of the sphere is inside the neck and never seen; pulling it in
       stops it poking through the collar on a figure with a slim neck. */
    const bottom = smooth(-0.75, -1.0, v);
    u *= 1 - 0.35 * bottom;
    w *= 1 - 0.35 * bottom;

    return [u * semiX * radius, v * semiY * radius, w * semiZ * radius];
}

/**
 * The colour of the skin AT one point of the head, as a multiplier.
 *
 * ============================================================
 * WHY THIS EXISTS, AND WHY IT IS NOT A TEXTURE
 * ============================================================
 *
 * The single strongest remaining tell that these were not people was that the
 * skin was ONE FLAT COLOUR. Reported as "not real persons, ugly": a real face is
 * never uniform — the sockets are darker than the brow, the cheeks and the nose
 * and the ears are redder than the forehead, a shaved jaw is cooler and darker
 * than the cheek above it, and the underside of the chin is in permanent shadow.
 * None of that is lighting. It is pigment and subsurface scattering, and with a
 * single albedo the renderer cannot invent any of it.
 *
 * The obvious way to add it is a texture, which means UV coordinates, which
 * means placing every feature by hand in a 2D space that has nothing to do with
 * the 3D one the sculpt was written in — and getting it wrong is invisible until
 * rendered. That is a whole second coordinate system to keep in step with
 * {@link sculptHeadVertex}, for the same features.
 *
 * So it is VERTEX COLOUR, evaluated in the same loop, at the same point, with
 * the same `blob` and `ridge` primitives the sculpt already uses. Aligned by
 * construction: the darkening of an eye socket cannot drift from the socket
 * because both are the same expression of the same coordinates. No texture
 * memory, no UV seam, no sampler, and it costs one multiply in the shader.
 *
 * `p` is on the UNIT sphere, in the same frame as the sculpt: +y up, +z toward
 * the camera, +x to the figure's left. The return is an RGB multiplier around
 * 1, and everything in it is deliberately subtle — the range is about 0.70 to
 * 1.08. Skin variation that reads as variation rather than as a rash lives in
 * the last quarter, and the first attempt at these numbers was half this
 * strong and simply did not show: at 180px, a 5% albedo change is nothing
 * against the 300% swing the lighting is already making across the same face.
 */
export function skinShadeAt(
    x: number, y: number, z: number, male: boolean,
): [number, number, number] {
    let r = 1;
    let g = 1;
    let b = 1;

    /** Multiply all three. */
    const value = (k: number) => { r *= k; g *= k; b *= k; };
    /** Push toward red — blood under thin skin. */
    const warm = (k: number) => { r *= 1 + k; g *= 1 - k * 0.35; b *= 1 - k * 0.55; };
    /** Push toward blue-grey — stubble, and the shadow under a jaw. */
    const cool = (k: number) => { r *= 1 - k * 0.6; g *= 1 - k * 0.35; b *= 1 + k * 0.1; };

    /* -- the eye sockets -------------------------------------------------
       The darkest part of any face, and the thing that makes an eye read as
       set INTO a head. The sculpt already puts a hollow here; without a tone
       change the hollow is only as dark as the light happens to make it, and
       under the flat frontal key a portrait needs that is barely at all. */
    for (const side of [-1, 1]) {
        const socket = blob(x - side * 0.345, y - 0.02, z - 0.78, 0.46);
        value(1 - 0.26 * socket);
        // A touch of warmth in it as well: the skin there is thin and the
        // shadow of a real socket is reddish-brown, not grey.
        warm(0.07 * socket);
    }

    /* -- the crease above the lid ---------------------------------------- */
    for (const side of [-1, 1]) {
        value(1 - 0.11 * blob(x - side * 0.33, y - 0.16, z - 0.74, 0.24));
    }

    /* -- cheeks ----------------------------------------------------------
       The classic blush placement: over the zygomatic arch, out toward the
       ear. Warm rather than dark. */
    for (const side of [-1, 1]) {
        warm(0.115 * blob(x - side * 0.44, y + 0.10, z - 0.62, 0.52));
    }

    /* -- the nose --------------------------------------------------------
       The tip and the alae are the reddest part of a face after the lips. */
    warm(0.14 * blob(x, y + 0.06, z - 0.88, 0.26));

    /* -- the ears --------------------------------------------------------
       Redder still, and they are the one feature where getting it wrong is
       invisible, because at this framing they are half behind the hair. */
    for (const side of [-1, 1]) {
        warm(0.16 * blob(x - side * 0.86, y - 0.02, z + 0.02, 0.36));
    }

    /* -- the forehead ----------------------------------------------------
       Very slightly lighter and less saturated than the midface, which is
       what makes the T-zone read. */
    const forehead = smooth(0.22, 0.62, y) * smooth(0.1, 0.6, z);
    value(1 + 0.035 * forehead);
    cool(0.02 * forehead);

    /* -- the beard region ------------------------------------------------
       A shaved jaw is darker and COOLER than the cheek above it, and this is
       the largest single difference between a male face and a female one at a
       distance where no individual hair is resolvable. Females get a much
       weaker version of the same shading, because a jaw is still in shadow
       under a frontal key.

       Shaped rather than a band: it follows the jawline, covers the chin and
       the upper lip, and stops short of the cheekbone. */
    const jaw = smooth(-0.08, -0.52, y)              // below the mouth line
        * smooth(0.05, 0.55, z)                      // the front of the face
        * (1 - 0.55 * ridge(x, 0, 0.30) * smooth(-0.30, -0.02, y));
    const moustache = blob(x, y + 0.22, z - 0.86, 0.30) * smooth(0.3, 0.7, z);
    const beard = Math.min(1, jaw + moustache * 0.8);
    if (male) {
        value(1 - 0.17 * beard);
        cool(0.105 * beard);
    } else {
        value(1 - 0.055 * beard);
    }

    /* -- under the chin and the back of the head -------------------------
       Ambient occlusion, by hand. The underside of a jaw never receives a
       direct ray from a light above it, and the scalp under the hair never
       receives one at all — leaving both at full albedo is what made the
       hairline read as a hard painted edge rather than as hair. */
    value(1 - 0.30 * smooth(-0.55, -0.95, y));
    value(1 - 0.22 * smooth(0.25, 0.85, -z) * smooth(-0.4, 0.5, y));

    /* -- the lips' surround ----------------------------------------------
       The lips themselves are their own meshes. What this does is darken the
       vermilion border immediately around them, which is what stops the lip
       meshes reading as two pale objects placed on a face. */
    const around = blob(x, y + 0.30, z - 0.84, 0.34);
    value(1 - 0.09 * around);
    warm(0.07 * around);

    return [r, g, b];
}

/**
 * Apply the sculpt to a freshly built sphere, then recompute its normals.
 *
 * Recomputing is not optional. The sphere arrives with normals that are its own
 * radius vectors, which after this are wrong everywhere the surface moved — and
 * wrong normals on a PBR surface are not a subtle artefact: the nose lights as
 * though it were still a piece of a ball, so the face looks like it has been
 * printed onto a sphere. Which, before the recompute, it has.
 */
function sculptHead(
    B: typeof BJS, mesh: Mesh, radius: number, male: boolean, jawWidth: number,
): void {
    const positions = mesh.getVerticesData(B.VertexBuffer.PositionKind);
    const indices = mesh.getIndices();
    if (!positions || !indices) return;
    /*
      The colour is evaluated BEFORE the position is overwritten, from the same
      unit-sphere point. That is the whole reason this is vertex colour and not a
      texture: there is no second coordinate system to keep aligned, because the
      shading and the shape are two expressions of one point. See `skinShadeAt`.
    */
    const colours = new Float32Array((positions.length / 3) * 4);
    for (let i = 0; i < positions.length; i += 3) {
        // `getVerticesData` answers `number[] | Float32Array`, and an indexed
        // read of the former is `number | undefined` under this project's
        // strictness. The buffer is a multiple of three by construction.
        const ux = positions[i] as number;
        const uy = positions[i + 1] as number;
        const uz = positions[i + 2] as number;
        const [tr, tg, tb] = skinShadeAt(ux, uy, uz, male);
        const c = (i / 3) * 4;
        colours[c] = tr;
        colours[c + 1] = tg;
        colours[c + 2] = tb;
        colours[c + 3] = 1;
        const [x, y, z] = sculptHeadVertex(ux, uy, uz, radius, male, jawWidth);
        positions[i] = x;
        positions[i + 1] = y;
        positions[i + 2] = z;
    }
    mesh.updateVerticesData(B.VertexBuffer.PositionKind, positions, true, false);
    mesh.setVerticesData(B.VertexBuffer.ColorKind, colours, false, 4);
    /*
      Explicitly NOT a transparency.

      Babylon reads a four-component colour buffer and, if it believes there is
      alpha in it, moves the mesh into the transparent render list — where it is
      sorted against everything else and depth-written differently. A head is the
      one mesh on the figure that must be opaque, and the failure is not subtle:
      the eyes, the lids and the hair start showing through the skull.
    */
    mesh.hasVertexAlpha = false;
    const normals = mesh.getVerticesData(B.VertexBuffer.NormalKind) || new Float32Array(positions.length);
    B.VertexData.ComputeNormals(positions, indices, normals as number[]);
    mesh.updateVerticesData(B.VertexBuffer.NormalKind, normals as number[], true, false);
    mesh.refreshBoundingInfo();
}

/* ------------------------------------------------------------------ *
 * The rig
 * ------------------------------------------------------------------ */

/** What the caller tells a figure to do, once per frame. */
export interface FigureState {
    /** Seconds since the stage started. The only clock any of this reads. */
    time: number;
    /**
     * Loudness of this figure's own audio right now, 0…1, or 0 for silence.
     *
     * A real reading off an `AnalyserNode` when the line came from the server
     * engine, and a nominal value when it came from `speechSynthesis`, which
     * gives no access to its own output. Either way, 0 means the mouth is shut
     * — see `jawOpen`.
     */
    energy: number;
    /** Seconds since this figure started their current line. Ramps the gestures. */
    since: number;
    /**
     * Where to look, in world space. Anchors look at the camera, and at each
     * other on a handover; a meeting seat looks at whoever is speaking. Null
     * means straight ahead.
     */
    lookAt?: BJS.Vector3 | null;
    /** Scale every idle amplitude. 0.35 under `prefers-reduced-motion`. */
    motion: number;
    /**
     * How much this figure is listening to somebody ELSE, 0..1.
     *
     * 1 when another figure is speaking and this one is not; 0 otherwise. It is
     * what drives {@link listenNod}, and it is a separate number from `energy`
     * on purpose: passing the speaker's own energy here would have a figure
     * nodding along to its own sentence, which reads as agreeing with itself.
     *
     * Optional, and absent means 0. Two stages and a preview harness call this
     * every frame and a required field would have been a breaking change for all
     * three at once -- while a figure that never nods is exactly the behaviour
     * they had before.
     */
    attention?: number;
}

/**
 * How the arms rest when nobody is gesturing.
 *
 * `hang` is somebody standing or sitting back: arms down, a slight bend. `desk`
 * is somebody at a desk with their hands on it — the two newscast anchors, who
 * are asked to hold a script. It is a BUILD option and not a per-frame one
 * because it decides geometry (a paper mesh is parented between the hands), and
 * because nobody switches from one to the other mid-bulletin.
 */
export type ArmPose = 'hang' | 'desk';

export interface FigureBuildOptions {
    pose?: ArmPose;
    /**
     * Where the hands go, in the figure's OWN space, for the `desk` pose:
     * `y` the desk surface, `z` how far in front of the body.
     *
     * The caller owns this because the caller owns the desk. Passing the desk's
     * actual height is what makes the hands land ON it for an anchor of any
     * height rather than through it for one and above it for the other — see
     * `reachPitch`.
     */
    handY?: number;
    handZ?: number;
}

export interface FigureRig {
    /** Everything, so the caller can place and rotate the whole person. */
    root: TransformNode;
    /** Head centre in LOCAL space, for aiming a camera at the eyes. */
    headHeight: number;
    /** Proportions, so a stage can put a desk at the right height. */
    proportions: Proportions;
    /** Every mesh, for a shadow generator's caster list. */
    meshes: Mesh[];
    /**
     * Where the hands actually came to rest, in the figure's own space, or null
     * for the `hang` pose.
     *
     * The studio parents a script sheet to this rather than guessing a height:
     * the anchors are 1.70 m and 1.80 m, so their hands are not in the same
     * place and a sheet placed at one figure's would float at the other's.
     */
    handRest: { y: number; z: number } | null;
    update(state: FigureState): void;
    dispose(): void;
}

/**
 * Build one person and return the handles that move them.
 *
 * The hierarchy is a skeleton in all but name: `TransformNode`s at the joints
 * with geometry parented to them, so a shoulder rotation carries the forearm
 * and the hand with it. A real `Skeleton` with vertex weights would be the
 * right answer for a body that deforms; nothing here deforms, so this is the
 * same result without a skinning pass per frame.
 */
export function buildFigure(
    B: typeof BJS, scene: Scene, spec: FigureSpec, quality: 'high' | 'low' = 'high',
    options: FigureBuildOptions = {},
): FigureRig {
    const P = proportionsFor(spec);
    const male = spec.gender === 'male';
    const meshes: Mesh[] = [];
    const detail = quality === 'high' ? 1 : 0.6;

    /*
      TWO nodes, and the split is a bug fix rather than tidiness.

      `root` belongs to the CALLER: it is where the person is standing, and the
      stage sets it once. `body` belongs to the rig, and is what the idle motion
      writes to.

      They were one node, and `update()` did `root.position.x = lean`, which
      overwrote the caller's placement on the very first frame. Both stages put
      their figures somewhere specific — the meeting spaces its six a hundred
      metres apart so the frustum culls five of them, and the studio seats its
      anchors either side of the desk — and both were silently collapsed to
      x ≈ 0: six portraits of the same overlapping pile, and two anchors
      standing inside each other in the middle of the set. It renders, nothing
      throws, and it looks like a modelling problem rather than a transform one.
    */
    const root = new B.TransformNode(`fig-${spec.id}`, scene);
    const body = new B.TransformNode(`fig-${spec.id}-body`, scene);
    body.parent = root;

    const skin = surface(B, scene, `${spec.id}-skin`, spec.skin, { roughness: 0.52 });
    // Skin is not a diffuse surface: it has a broad, weak specular that is what
    // makes a cheek look damp rather than chalky. `PBRMaterial` needs to be
    // told, because the default reflectance of 0.5 is glossier than skin.
    skin.metallicF0Factor = 0.28;
    /*
      ============================================================
      PORE RELIEF, WHICH IS THE HALF `skinShadeAt` CANNOT DO
      ============================================================

      `skinShadeAt` gives the face its PIGMENT variation -- darker sockets, redder
      cheeks and nose, a cooler jaw -- evaluated per vertex out of the same
      primitives as the sculpt, which is the one way that shading cannot drift
      from the features it is shading. What it cannot give is RELIEF, because a
      vertex colour does not tilt a normal -- and relief is what breaks the
      specular highlight up. Without it a cheek reflects the key light by exactly
      the same amount at every point and the highlight is a hard oval, which is
      most of what reads as moulded plastic.

      A pore map is the one texture on a figure that needs no feature alignment
      at all: a pore is the same wherever the map happens to land. So unlike a
      face photograph it can be put on a sphere whose UVs the sculpt has
      scrambled -- see `textures.ts` for why the photograph cannot.

      `0.34` rather than 1, because the map is generated at a strength meant to
      be visible at 512 px and at a 180 px meeting tile full strength reads as
      orange peel. The tiling size is the HEAD's own diameter, so a 1.66 m
      figure's pores are the same size as a 1.86 m figure's instead of scaling
      with them -- which is the same reason `proportionsFor` scales the frame and
      not the length.
    */
    applyNormal(B, scene, skin, 'skin-detail', P.headRadius * 2, 0.34);
    const skinDark = surface(B, scene, `${spec.id}-skin2`, spec.skin, { roughness: 0.6 });
    skinDark.albedoColor = skinDark.albedoColor.scale(0.86);
    applyNormal(B, scene, skinDark, 'skin-detail', P.headRadius * 2, 0.34);

    /*
      Hair is ROUGH. At 0.34 with a raised reflectance it came out as a lacquered
      helmet with a hard white streak across it, which is the single most
      plastic-looking thing a rendered person can wear. Real hair scatters: a
      broad, weak sheen rather than a mirror.

      0.62 was still not enough. A single continuous cap has ONE specular lobe
      over the whole crown, so at any roughness that lets a highlight form at all
      it forms as one stripe — which is the read of a plastic wig. Real hair's
      sheen is broken up by thousands of strand normals this geometry does not
      have, so the only honest approximation is to broaden the lobe until it
      stops being a stripe and becomes a sheen. 0.80 with the reflectance almost
      off is that.
    */
    const hairMat = surface(B, scene, `${spec.id}-hair`, spec.hair, { roughness: 0.80 });
    hairMat.metallicF0Factor = 0.10;
    /*
      And STRANDS -- which is the thing the paragraph above says this geometry
      does not have. It has them now, as a normal map rather than as geometry,
      which is the only affordable way to have thousands of them.

      It is the strongest of the four figure maps and deliberately so: hair is
      the one surface here whose relief is coarse enough to see at tile size, and
      broadening the specular lobe until a stripe became a sheen was only ever
      half a fix. A sheen with no strand structure in it is still a sheen on a
      solid object.

      The map runs along V, which on the hair shell is crown-to-nape -- the
      direction hair actually lies. That is why it is generated rather than
      downloaded: a photographed strand map runs whichever way the photograph was
      shot, and there is no way to rotate it into the scalp's frame per figure.
    */
    applyNormal(B, scene, hairMat, 'hair-strand', P.headRadius * 1.6, 0.62);
    /*
      Wool is MATTE. At 0.84 the specular lobe is still broad enough to lay a
      soft sheen across the whole chest, which reads as satin — and a satin suit
      on a news anchor is one of the small wrongnesses that adds up to "not a
      real person". Real worsted is nearer 0.94, and its reflectance is lower
      than the dielectric default too.
    */
    const jacketMat = surface(B, scene, `${spec.id}-jacket`, spec.outfit.jacket, { roughness: 0.94 });
    jacketMat.metallicF0Factor = 0.30;
    /*
      ============================================================
      THE WEAVE, AND WHY IT IS A NORMAL MAP AND NOT A COLOUR ONE
      ============================================================

      Roughness alone could not finish this job. A matte lobe stops a suit
      reading as satin and it still leaves every point of the chest reflecting
      the key light by the same amount -- so the jacket is a smooth solid in the
      right colour, and a smooth matte solid is moulded plastic. Which is
      precisely what was reported.

      What separates wool from plastic at three metres is that the surface has a
      STRUCTURE: a twill catches the light along one axis and not the other, so
      the highlight across a shoulder is broken into thousands of small ones.
      That is relief, and relief is a normal map.

      The albedo stays the figure's own `outfit.jacket`. A downloaded colour map
      here would put one photographed jacket on all eight of them and throw away
      a wardrobe that is deliberately eight different colours.

      The tiling size is the SHOULDER SPAN, so the weave is the same physical
      size on a 1.66 m figure and a 1.86 m one. Passing a constant instead is how
      a small figure ends up in unusually coarse tweed.
    */
    const clothSpan = P.shoulderHalfWidth * 2;
    applyNormal(B, scene, jacketMat, 'cloth-wool', clothSpan, 0.55);
    /*
      Every shirt in the cast is a near-white (#e8eef5 and friends), and at the
      exposure a face needs that renders as blown-out paper — which is why the
      collar read as the brightest object in the tile. A real white shirt under
      studio light measures well under 100% too; the eye reads it as white by
      CONTEXT, not by luminance.
    */
    const shirtMat = surface(B, scene, `${spec.id}-shirt`, spec.outfit.shirt, { roughness: 0.86 });
    /*
      0.66, down from 0.80, and the reason is the same one the original 0.80 was
      for -- it just was not far enough. Every shirt in the cast is a near-white,
      and at the exposure a FACE needs, a near-white panel the size of a chest is
      the brightest and largest object in the tile: three renders in a row it
      read as a white apron worn over the suit rather than as a shirt inside it.

      A real white shirt under studio light measures well under 100%, and a shirt
      inside a jacket is in the shadow of the lapels and the jaw on top of that.
      The eye reads a shirt as white by CONTEXT -- because it is the lightest
      thing on the figure -- not by luminance, so taking a third of it away costs
      nothing and buys the whole exposure back.
    */
    shirtMat.albedoColor = shirtMat.albedoColor.scale(0.66);
    // Poplin, not wool: a much finer and flatter weave, and weaker again,
    // because the shirt is the lightest thing in the tile and relief reads
    // strongest on a pale surface.
    applyNormal(B, scene, shirtMat, 'cloth-shirt', clothSpan * 0.5, 0.40);
    /* And the collar is in the shadow of the jaw, always. A collar at the same
       albedo as the chest is the one that looks like a neck brace. */
    /*
      A BUTTON IS THE DARKEST THING ON A JACKET, not a lighter one.

      Horn and corozo buttons are chosen to disappear into the cloth from a
      distance and to catch one small highlight up close, which is exactly the
      job here: at tile size two buttons must not read as two more beads on the
      chest, and at head size they are the detail that says the garment fastens.
      So the jacket's own colour at 0.55 with a tight lobe -- darker than the
      cloth and glossier than it.
    */
    const buttonMat = surface(B, scene, `${spec.id}-button`, spec.outfit.jacket, { roughness: 0.30 });
    buttonMat.albedoColor = buttonMat.albedoColor.scale(0.55);
    buttonMat.metallicF0Factor = 0.44;
    const collarMat = surface(B, scene, `${spec.id}-collar`, spec.outfit.shirt, { roughness: 0.8 });
    collarMat.albedoColor = collarMat.albedoColor.scale(0.62);
    applyNormal(B, scene, collarMat, 'cloth-shirt', clothSpan * 0.22, 0.45);
    /*
      A tie is SILK, and silk is the same weave as the wool at a fraction of the
      roughness -- which is physically what it is, and is why there is no third
      cloth texture. What reads as silk is a tight highlight running down the
      blade, so the reflectance goes up and the relief stays low: a strong normal
      map here would break exactly that highlight up.
    */
    const accentMat = surface(B, scene, `${spec.id}-accent`, spec.outfit.accent, { roughness: 0.38 });
    accentMat.metallicF0Factor = 0.52;
    applyNormal(B, scene, accentMat, 'cloth-wool', clothSpan * 0.28, 0.22);
    /*
      Almost white, and glossy. The visible band of sclera is a few millimetres
      of a 200 mm head, so it is only ever going to read by CONTRAST against the
      skin around it — a mid-tone eyeball on a light-skinned face disappears
      entirely, which is what the first pass looked like.
    */
    /*
      NOT WHITE. A sclera is not white and rendering it white is the single
      easiest way to make a face look like a doll: the visible band sits inside a
      socket, in shadow, and it measures around 70% of a white card even in a
      studio. At `#f7f6f4` under the exposure a face wants, it clipped — so what
      the eye read was two bright patches with a dot in each.
    */
    const scleraMat = surface(B, scene, `${spec.id}-sclera`, '#d9d3c9', { roughness: 0.18, flat: true });
    const irisMat = surface(B, scene, `${spec.id}-iris`, spec.eye, { roughness: 0.10, flat: true });
    /*
      The limbal ring: the dark band where the cornea meets the sclera.

      A few tenths of a millimetre of anatomy that does more for "this is a
      living eye" than anything else at this scale — it is what separates the
      iris from the white instead of letting the two meet at a soft edge, and
      its absence is most of why a rendered eye reads as a printed dot.
    */
    const limbalMat = surface(B, scene, `${spec.id}-limbal`, '#241a16', { roughness: 0.14, flat: true });
    const pupilMat = surface(B, scene, `${spec.id}-pupil`, '#08060a', { roughness: 0.06, flat: true });
    /*
      ============================================================
      THE LIPS ARE DERIVED FROM THE SKIN, NOT PICKED
      ============================================================

      They were two literals, `#a3675a` for men and `#b8656a` for women — and a
      literal cannot be right for six skin tones spanning `#6f4630` to `#f0cbaa`.
      On the darker three the "lip" colour was LIGHTER than the face around it,
      which reads as a pale smear stuck on the mouth rather than as lips. That is
      most of why the mouths looked wrong on Marcus and Sophia specifically.

      A real lip is the same pigment with more blood behind less keratin: a
      little redder, a little darker, a little less green. Derived, it is right
      at both ends of the range and it stays right if a seventh figure is added.
    */
    const lipBase = B.Color3.FromHexString(spec.skin);
    /*
      0.46, up from 0.34. The derived colour is right -- measured, the lips come
      out a sixth darker than the face on every skin tone in the cast -- and they
      still rendered LIGHTER than the surrounding skin, because at 0.34 the
      specular lobe is tight enough to lay a broad highlight across the whole
      lower lip. What a viewer reads from that is lipstick, on all eight figures.

      Real lips are glossier than cheeks and nowhere near that glossy. Rougher,
      the highlight spreads out and the albedo is what shows.
    */
    const lipMat = surface(B, scene, `${spec.id}-lip`, spec.skin, { roughness: 0.46 });
    lipMat.albedoColor = new B.Color3(
        Math.min(1, lipBase.r * 1.06),
        lipBase.g * 0.74,
        lipBase.b * 0.78,
    );
    const mouthMat = surface(B, scene, `${spec.id}-mouth`, '#2a1113', { roughness: 0.55, flat: true });
    const teethMat = surface(B, scene, `${spec.id}-teeth`, '#efeae2', { roughness: 0.24, flat: true });

    function track<T extends Mesh>(mesh: T): T {
        meshes.push(mesh);
        return mesh;
    }

    /* ---- torso ------------------------------------------------------- */

    /**
     * One lathe, not a stack of cylinders.
     *
     * The profile is measured off the proportions rather than written down, so
     * a broad figure's waist follows their shoulders. The cross-section is a
     * circle scaled on Z: a torso is wider than it is deep by about 4:3, and a
     * round one reads as a barrel.
     */
    const profile = (r: number, y: number) => new B.Vector3(r, y, 0);
    /*
      ============================================================
      TWELVE POINTS, NOT NINE, AND THE FOUR NEW ONES ARE THE SHOULDER
      ============================================================

      Reported as "a lot of squares … like not real persons", and the torso was
      half of it. A lathe interpolates NOTHING between profile points: each pair
      becomes a ring of quads, so a 3 cm gap in Y with a 6 cm change in radius is
      a visibly flat band all the way round the body. Nine points over 90 cm of
      torso is nine flat bands, and the four that crossed the shoulder were the
      widest of them — which is exactly where the silhouette is, and why the
      first renders read as a pot with a spout.

      The shoulder now turns over four intermediate radii instead of one step, so
      the trapezius is a curve; the chest and waist each gained a point for the
      same reason.
    */
    const torsoShape = [
        profile(0.001, P.hipY - 0.02 * spec.height),
        profile(P.waistHalfWidth * 1.08, P.hipY),
        profile(P.waistHalfWidth * 1.00, (P.hipY + P.waistY) / 2),
        profile(P.waistHalfWidth * 0.95, P.waistY),
        profile(P.waistHalfWidth + (P.shoulderHalfWidth - P.waistHalfWidth) * 0.34,
            P.waistY + (P.shoulderY - P.waistY) * 0.26),
        profile(P.waistHalfWidth + (P.shoulderHalfWidth - P.waistHalfWidth) * 0.58,
            P.waistY + (P.shoulderY - P.waistY) * 0.48),
        profile(P.waistHalfWidth + (P.shoulderHalfWidth - P.waistHalfWidth) * 0.84,
            P.waistY + (P.shoulderY - P.waistY) * 0.72),
        /*
          The shoulder line is FLAT, then it turns up into the neck.

          Several points across the top rather than one, because a lathe whose
          profile runs straight from the widest point to the neck is a cone, and
          a cone is what made the first render read as a pot with a spout rather
          than as somebody in a jacket. Real shoulders are almost level from the
          deltoid to the base of the neck and then rise steeply.
        */
        /*
          CONVEX, and that is the difference between shoulders and a funnel.

          The radius has to fall from the full shoulder span to under the neck's
          in about 16 cm of height — the figure's own proportions leave no choice
          about that. What IS a choice is the shape of the curve, and a straight
          line is a 45-degree cone, which is what the render looked like: a pot
          with a spout. A real trapezius stays nearly at full width to well past
          the shoulder line and then rises steeply into the neck, so the profile
          is convex: 99%, 95%, 88% over the first six centimetres, and only then
          the collapse.
        */
        profile(P.shoulderHalfWidth * 1.00, P.shoulderY - 0.030 * spec.height),
        profile(P.shoulderHalfWidth * 0.99, P.shoulderY),
        profile(P.shoulderHalfWidth * 0.955, P.shoulderY + 0.016 * spec.height),
        profile(P.shoulderHalfWidth * 0.880, P.shoulderY + 0.030 * spec.height),
        profile(P.shoulderHalfWidth * 0.720, P.shoulderY + 0.042 * spec.height),
        profile(P.shoulderHalfWidth * 0.500, P.shoulderY + 0.052 * spec.height),
        profile(P.shoulderHalfWidth * 0.330, P.shoulderY + 0.058 * spec.height),
        profile(P.neckRadius * 1.16, P.shoulderY + 0.062 * spec.height),
        profile(P.neckRadius * 1.02, P.shoulderY + 0.065 * spec.height),
    ];

    const torso = track(B.CreateLathe(`${spec.id}-torso`, {
        shape: torsoShape,
        /*
          Round the body as well as up it. At 38 segments a shoulder 40 cm across
          is faceted in ~3 cm steps, and the specular highlight then breaks into
          a row of separate bright quads — which is the other thing "squares"
          describes. 80 segments is ~1.5 cm and the highlight is continuous.
          It is 960 extra triangles on a figure that has nine thousand.
        */
        tessellation: Math.round(64 * detail) + 16,
        closed: true,
        cap: 2, // CAP_END — the shoulders; the hip end is never seen.
    }, scene));
    torso.scaling.z = P.chestDepth / P.shoulderHalfWidth;
    torso.material = jacketMat;
    torso.parent = body;

    /*
      ============================================================
      THE YOKE, WHICH IS WHAT MAKES A SHOULDER LINE POSSIBLE AT ALL
      ============================================================

      A lathe is a body of REVOLUTION: whatever its profile, every horizontal
      slice is a full ellipse, so the top of the torso is a dome. A dome is not
      what anybody's shoulders look like — reported as figures that "appear like
      not real persons", and at tile framing, where the crop is at the chest, the
      dome IS the whole silhouette. It reads as a skittle.

      A real jacket's shoulder is flat across the top for most of the span and
      then turns down sharply at the deltoid. That is exactly the silhouette of a
      CAPSULE lying on its side: a cylinder's worth of straight edge with a
      hemisphere at each end. One mesh, laid across the top of the torso and
      squashed on Z to the chest's depth.

      It cannot be done by changing the lathe's profile — no profile makes a
      revolution flat-topped — which is why this is a second mesh rather than
      four more points.
    */
    const yokeRadius = 0.030 * spec.height;
    const yoke = track(B.CreateCapsule(`${spec.id}-yoke`, {
        height: P.shoulderHalfWidth * 1.92,
        radius: yokeRadius,
        tessellation: Math.round(28 * detail) + 10,
        subdivisions: 3,
    }, scene));
    yoke.material = jacketMat;
    // Built along Y; a quarter turn lays it across the shoulders. Scaling is
    // applied before rotation, so `scaling.z` is still depth afterwards.
    yoke.rotation.z = Math.PI / 2;
    /*
      ============================================================
      0.42 OF THE CHEST DEPTH, NOT 0.94 -- THE YOKE WAS THE LOBES
      ============================================================

      This is where the two rounded masses on the chest were actually coming
      from, and it took a render to find because the arithmetic is invisible in
      the source. A capsule has a CONSTANT cross-section along its cylinder,
      so at 0.94 of the chest depth the yoke is a 14 cm-deep slab laid straight
      across the shoulders -- while the torso it lies on is an ELLIPSE whose front
      surface falls away toward the sides: at 0.83 of the half-width the front is
      only 8 cm forward, and at 0.94 only 5 cm.

      So the yoke's ends stood five centimetres in front of the chest, and being
      hemispherical caps they stood out as two smooth rounded lobes at chest
      height, inboard of the arms. On the female figures that reading was the
      worst one available, and it survived the removal of the deltoids because it
      was never the deltoids.

      At 0.42 the yoke is inside the torso's own front surface at every x --
      verified at the cap centres and at the arm line, which are the two places
      it can escape -- so all it can now contribute is the thing it exists for:
      height above the torso's dome, where the shoulder line is.

      A depth that FOLLOWED the ellipse would be better still and it cannot be a
      capsule; it would be a `garment()` saddle. It is not worth it: the only
      cameras that ever see this cast are in front of it, and from in front the
      shoulder line is the lathe's own convex profile.
    */
    yoke.scaling.z = (P.chestDepth * 0.42) / yokeRadius;
    yoke.position.set(0, P.shoulderY + 0.006 * spec.height, -P.chestDepth * 0.06);
    yoke.parent = body;

    /*
      A NOTE KEPT FROM THE VERSION BEFORE LAST, BECAUSE IT IS STILL THE TRAP.

      The shirt was once built as the same lathe as the jacket a few millimetres
      inside it, so that it would "show only where the jacket is cut away".
      Nothing was cut away -- the two surfaces are three millimetres apart over
      an area the size of a torso, so what showed was z-fighting: pale rectangles
      flickering across the chest wherever the depth buffer could not separate
      them, which reads as a texturing fault on a plain colour.

      That is why the offsets under `CLOTHING IS A SURFACE` below are ordered
      explicitly and why no two of them overlap over more than a strip. Two
      IDENTICALLY SHAPED surfaces a constant distance apart is the case the depth
      buffer cannot resolve; two differently curved panels meeting at an edge is
      not.
    */

    /*
      ============================================================
      WHERE THE FRONT OF THE JACKET IS, READ OFF THE JACKET
      ============================================================

      Twice now this has been a hand-computed number and twice it has been wrong,
      so it is a function of the actual profile instead.

      The torso is a lathe whose radius varies with height and which is then
      SCALED on Z, so the front surface is at neither `chestDepth` nor any fixed
      fraction of it — and it moves with X as well, because the cross-section is
      an ellipse. The first version placed the clothing at 0.66 of `chestDepth`
      and everything ended up a centimetre and a half inside the jacket; the
      second computed one radius at one height, which was right at that height
      and 12 mm short at the height the lapels actually sit at, so they came out
      as two faint bumps.

      `frontZAt(x, y)` answers exactly, from `torsoShape` and `torsoScaleZ`. Every
      piece of clothing is placed with it, so a change to the profile carries the
      clothing with it rather than orphaning it.
    */
    const torsoScaleZ = P.chestDepth / P.shoulderHalfWidth;

    /** The lathe's radius at height `y`, linearly interpolated as it is built. */
    function torsoRadiusAt(y: number): number {
        if (y <= (torsoShape[0] as BJS.Vector3).y) return (torsoShape[0] as BJS.Vector3).x;
        for (let i = 1; i < torsoShape.length; i++) {
            const a = torsoShape[i - 1] as BJS.Vector3;
            const b = torsoShape[i] as BJS.Vector3;
            if (y <= b.y) {
                const t = b.y === a.y ? 0 : (y - a.y) / (b.y - a.y);
                return a.x + (b.x - a.x) * t;
            }
        }
        return (torsoShape[torsoShape.length - 1] as BJS.Vector3).x;
    }

    /**
     * Where the outside of the jacket is at `(x, y)`, in the body's own space.
     *
     * The cross-section is a circle of radius `r` scaled by `torsoScaleZ` on Z,
     * so a point `x` off the centre line sits at
     * `r * scaleZ * sqrt(1 - (x / r)^2)` — which is why a piece placed by its
     * centre-line depth sinks in at the edges.
     */
    function frontZAt(x: number, y: number): number {
        const r = torsoRadiusAt(y);
        if (r <= 1e-6) return 0;
        const inside = 1 - (x / r) * (x / r);
        return inside <= 0 ? 0 : r * torsoScaleZ * Math.sqrt(inside);
    }

    /**
     * The lowest height at which a ring of `radius` is outside the jacket.
     *
     * The collar was invisible for the whole life of this file, and this is why:
     * it was placed at `neckY - 0.03h`, which is a height at which the trapezius
     * is three times the collar's own radius. There was geometry, it was
     * submitted, and it was inside a jacket. Scanning for the height rather than
     * naming one means it stays outside whatever the profile does next.
     */
    function clearsJacketAbove(radius: number): number {
        const top = (torsoShape[torsoShape.length - 1] as BJS.Vector3).y;
        const from = P.shoulderY;
        for (let i = 0; i <= 80; i++) {
            const y = from + ((top - from) * i) / 80;
            if (torsoRadiusAt(y) < radius) return y;
        }
        return top;
    }


    /*
      ============================================================
      CLOTHING IS A SURFACE ON THE BODY, NOT OBJECTS STUCK TO IT
      ============================================================

      Everything below used to be an ellipsoid placed in front of the chest: two
      for the lapels, one for the notch, one for the bib, one for the tie knot,
      one for the pendant, and a lathe for the tie. Each one was individually
      defensible and the sum of them was the report -- "clothes not good, remove
      ball objects on the shoulders, make clothes beautiful and good like real
      people". At tile framing what a viewer saw was a row of figures with two
      large rounded lobes on the chest, a coloured bead at the throat and a white
      ring around the neck. On the female figures the two lobes read as anatomy.

      The reason is structural rather than a matter of tuning, and it is worth
      stating once: A CONVEX BLOB PLACED IN FRONT OF A CONVEX TORSO CANNOT READ AS
      CLOTH, at any size or proportion. Cloth reads as cloth because it FOLLOWS
      the body -- it is a surface at the body's own curvature with an EDGE, and
      the edge is what the eye recognises. A blob has a silhouette of its own and
      no edge at all, so it reads as an object resting against a person. Three
      rounds of reshaping ellipsoids (box, then tube, then panel) each fixed a
      symptom and none could fix that.

      So the garments are built as surfaces PARAMETRISED ON THE TORSO ITSELF.
      `garment()` below walks the same ellipse `frontZAt` measures, at a given
      offset outward along its normal, and produces a real mesh grid with real
      UVs -- which is also what lets the cloth normal maps land at a sensible
      size. A lapel is then not a separate object: it is the inner strip of the
      jacket panel, lifted off the chest, so it has a fold and a free edge and it
      cannot come apart from the jacket it belongs to.

      What that buys, in order of how much it shows:

        * the two lobes are gone, because there are no blobs;
        * the V of a jacket is a real opening between two panels rather than a
          gap between two objects;
        * the tie is flat against the chest and its knot is a trapezoid;
        * the collar band is close to the neck and the JACKET eats its lower
          edge, instead of a bright ring standing clear of everything;
        * and every seam is where two panels meet, so nothing z-fights.
    */
    /**
     * A point on the torso's surface, pushed `out` metres along its own normal.
     *
     * `theta` is the angle around the body: 0 at the centre of the chest,
     * positive toward the figure's LEFT (+x), which is screen-right on a figure
     * facing the camera. `y` is a height in the body's own space.
     *
     * The cross-section is a circle of radius `r(y)` scaled by `torsoScaleZ` on
     * Z, so the outward normal in the XZ plane is `(scaleZ * sin, cos)`
     * normalised -- NOT `(sin, cos)`, which is the sphere's normal and is what
     * makes an offset piece sink in at the sides of a torso that is wider than
     * it is deep. Verified rather than asserted: the tangent is
     * `(r cos, -r scaleZ sin)` and the dot product of the two is exactly zero.
     */
    function onTorso(theta: number, y: number, out: number): {
        x: number; y: number; z: number;
    } {
        const r = Math.max(1e-4, torsoRadiusAt(y));
        const sin = Math.sin(theta);
        const cos = Math.cos(theta);
        const nx = torsoScaleZ * sin;
        const nz = cos;
        const len = Math.sqrt(nx * nx + nz * nz) || 1;
        return {
            x: r * sin + (nx / len) * out,
            y,
            z: r * torsoScaleZ * cos + (nz / len) * out,
        };
    }

    /**
     * Build one garment panel as an explicit mesh grid.
     *
     * `at(u, v)` answers a point for `u` and `v` in 0..1. The UVs handed to the
     * material are `u` and `v` directly, which is what makes the cloth weave
     * land at a predictable size: the caller tells `applyNormal` how many metres
     * across the panel is and the tiling follows from that.
     *
     * ============================================================
     * WHY THIS IS VERTEX DATA AND NOT A BUILDER
     * ============================================================
     *
     * `CreateLathe` with an `arc` is the obvious way to make a panel that
     * follows a body, and it was tried twice. The problem is recorded in this
     * file already: `arc` opens in a direction that is a convention rather than
     * a documented angle, so the two panels overlapped in the middle and
     * rendered as a pair of bright plates across the chest. `CreateRibbon` needs
     * the same information in a shape that is harder to reason about.
     *
     * A grid is fifteen lines and there is no convention to guess: the caller
     * says where every vertex goes. It is also the only option that can vary the
     * OFFSET across the panel, which is exactly what a rolled lapel is.
     */
    function garment(
        name: string, cols: number, rows: number,
        at: (u: number, v: number) => { x: number; y: number; z: number },
    ): Mesh {
        const nu = Math.max(2, Math.round(cols * detail) + 2);
        const nv = Math.max(2, Math.round(rows * detail) + 2);
        const positions: number[] = [];
        const uvs: number[] = [];
        const indices: number[] = [];
        for (let j = 0; j <= nv; j++) {
            const v = j / nv;
            for (let i = 0; i <= nu; i++) {
                const u = i / nu;
                const point = at(u, v);
                positions.push(point.x, point.y, point.z);
                uvs.push(u, v);
            }
        }
        const stride = nu + 1;
        for (let j = 0; j < nv; j++) {
            for (let i = 0; i < nu; i++) {
                const a = j * stride + i;
                const b = a + 1;
                const c = a + stride;
                const d = c + 1;
                /*
                  Wound so the OUTWARD face is the front one. Babylon culls back
                  faces (see `surface`), and a panel wound the other way is
                  invisible from in front and visible from behind -- which does
                  not look like a winding error, it looks like the garment is
                  missing and the inside of the torso has a hole in it.
                */
                indices.push(a, c, b, b, c, d);
            }
        }
        /*
          ============================================================
          THE WINDING IS CHECKED, NOT ASSUMED -- AND THE FIRST RENDER IS WHY
          ============================================================

          Babylon culls back faces (see `surface`), so a panel wound the wrong
          way is INVISIBLE. That is not a failure anybody can read: the first
          render of this code showed a plain jacket with no lapels, no shirt at
          the neckline and no tie, which looks exactly like the panels never
          having been built -- and sends you looking for a placement bug in code
          that is placing things perfectly.

          Which way is correct depends on how the CALLER parametrised its panel:
          a collar point that runs down-and-outward and a jacket front that runs
          inward-to-outward have opposite handedness through the same builder. So
          rather than each caller having to know, the winding is MEASURED once
          against the direction the panel is supposed to face and reversed if it
          is inward.

          The test is a dot product against the radial vector `(x, 0, z)`. Every
          panel here is a surface on a convex body of revolution about the Y
          axis, and for any convex cross-section the outward normal has a
          positive dot with the radius -- so it needs no per-caller hint and it
          cannot be tricked by a panel that is nearly edge-on.
        */
        const normals: number[] = [];
        B.VertexData.ComputeNormals(positions, indices, normals);
        const probe = (Math.floor(nv / 2) * stride + Math.floor(nu / 2)) * 3;
        const facing =
            (normals[probe] as number) * (positions[probe] as number)
            + (normals[probe + 2] as number) * (positions[probe + 2] as number);
        if (facing < 0) {
            for (let i = 0; i < indices.length; i += 3) {
                const swap = indices[i] as number;
                indices[i] = indices[i + 2] as number;
                indices[i + 2] = swap;
            }
            normals.length = 0;
            B.VertexData.ComputeNormals(positions, indices, normals);
        }
        const data = new B.VertexData();
        data.positions = positions;
        data.uvs = uvs;
        data.indices = indices;
        data.normals = normals;
        const mesh = track(new B.Mesh(name, scene));
        data.applyToMesh(mesh, false);
        mesh.parent = body;
        return mesh;
    }

    /*
      ============================================================
      THE FIVE OFFSETS, AND WHY THEY ARE ORDERED RATHER THAN CHOSEN
      ============================================================

      Every garment sits at a different distance out from the torso, and the
      ORDER is the whole design: a piece that is meant to be in front of another
      has to be further out at the point where they overlap. This file has
      already paid for getting that wrong twice -- the shirt three millimetres
      inside the jacket over the whole torso, which z-fought and rendered as pale
      rectangles flickering across the chest; and the tie measured at its own
      height rather than the bib's, which put the shirt through the middle of it.

      Fractions of standing height, so they scale with the figure:

        shirt     0.0028   the panel that fills the V
        collar    0.0046   the shirt collar's points, over the shirt
        jacket    0.0072   the two front panels
        lapel     0.0072 + 0.0060 rolled up along the panel's inner edge
        tie       0.0112   on the centre line, clear of everything
        knot      0.0150   the fattest thing on the chest, as it should be

      The gaps are at least 1.8 mm on a 1.66 m figure and the surfaces are
      CURVED rather than parallel, which is what makes them safe: the earlier
      z-fight was two identically-shaped lathes, where the depth difference is
      constant and the buffer has nothing to separate. Nothing here overlaps
      another piece over more than a strip.
    */
    const OUT_SHIRT = 0.0028 * spec.height;
    const OUT_COLLAR = 0.0046 * spec.height;
    const OUT_JACKET = 0.0072 * spec.height;
    const OUT_LAPEL_RISE = 0.0115 * spec.height;
    const OUT_TIE = 0.0112 * spec.height;
    const OUT_KNOT = 0.0150 * spec.height;

    /** Top of the opening, and the point where the jacket buttons. */
    const openTop = P.neckY - 0.026 * spec.height;
    const buttonY = P.waistY + (P.shoulderY - P.waistY) * 0.30;
    /** The panels run below the frame so no hem is ever visible. */
    const hemY = P.hipY - 0.01 * spec.height;
    /** How far round the body the front panels reach. */
    const WRAP = 1.16;

    /**
     * Half the angular width of the opening at height `y`.
     *
     * A jacket's V is widest at the collar and closes at the button, and it is
     * ANGULAR rather than a width in metres -- which is the thing an ellipsoid
     * could never express and is why the V used to read as a gap. Below the
     * button it does not close to zero: a real single-breasted jacket keeps a
     * seam, and two panels meeting at exactly 0 would share an edge and shimmer.
     */
    /*
      A BLAZER CLOSES NARROWER THAN A SUIT JACKET, and it has to, because there
      is no tie down the middle of it.

      On a man the tie covers the centre of the opening, so what shows either
      side is two strips of shirt and the eye reads a V. On a woman the same
      opening is one unbroken pale panel the width of the chest, and at head
      framing that reads as a bib worn over the jacket rather than as a blouse
      inside it -- which is the same fault the old ellipsoid bib had, arriving
      from the opposite direction.

      0.26 rather than 0.34: about 4.7 cm of arc each side of the centre line at
      chest radius, which is a blazer buttoned over a blouse.
    */
    const OPEN_TOP_ANGLE = male ? 0.34 : 0.26;

    function openAt(y: number): number {
        /*
          0.40 rad, NOT 0.66, and the first render is why: at 0.66 the opening
          was 76 degrees across, so the shirt panel filling it was a white
          butterfly covering most of the chest and the lapels were pushed round
          onto the sides of the body where nothing could see them. 0.40 puts the
          break beside the neck, which is where a jacket's is -- about 7 cm of arc
          from the centre line at chest radius.
        */
        if (y >= openTop) return OPEN_TOP_ANGLE;
        if (y <= buttonY) return 0.035;
        const k = smooth(buttonY, openTop, y);
        /*
          Curved rather than linear -- the lapel's edge is a curve on every real
          jacket and a straight V reads as a paper cut-out -- and CUBED rather
          than squared. Squared, the opening was still 60% of its full width
          halfway down, so the part of the V inside a head-and-shoulders crop was
          very nearly a rectangle. Cubed it is 22%, and the shape a viewer sees is
          a V rather than a panel.
        */
        return 0.035 + (OPEN_TOP_ANGLE - 0.035) * k * k * k;
    }

    /*
      THE SHIRT IS THE PANEL THAT FILLS THE V.

      Not a bib and not a second torso. It spans the whole opening at every
      height and runs a little UNDER the jacket panels on each side, so there can
      be no hairline gap at the seam and no overlap wide enough to fight. Both
      genders have one now: the old code gave the women none at all, on the
      reasoning that there is no tie for it to show either side of, and the
      consequence was a blazer with nothing under it at the neckline.
    */
    const shirtPanel = garment(`${spec.id}-shirtfront`, 14, 20, (u, v) => {
        const y = openTop - (openTop - buttonY - 0.004 * spec.height) * v;
        /*
          Just enough underlap to guarantee no hairline gap at the seam, and no
          more. At 0.10 rad the shirt ran a centimetre and a half UNDER each
          lapel, and since the lapel is a single-sided surface seen from slightly
          below at the free edge, that centimetre and a half was visible as a
          pale fringe outside the jacket -- which reads as the lining showing.
        */
        const half = openAt(y) + 0.045;
        return onTorso(-half + 2 * half * u, y, OUT_SHIRT);
    });
    shirtPanel.material = shirtMat;
    applyNormal(B, scene, shirtMat, 'cloth-shirt', P.shoulderHalfWidth * 0.9, 0.40);

    /*
      THE FRONT PANELS, AND THE LAPELS AS PANELS OF THEIR OWN.

      The first version rolled the lapel as a rise in the OFFSET along the front
      panel's inner edge, which is the right shape and rendered as nothing at
      all: the panel is the same material as the torso it lies on, so a surface
      1.3 cm off the chest with a correct normal is indistinguishable from the
      chest. What makes a lapel visible on a real jacket is not that it is
      raised, it is that it is FOLDED -- the cloth is turned over, so it faces a
      different way and catches a different amount of light. A rise of a
      centimetre over five centimetres of arc is an eleven-degree tilt, and
      eleven degrees of the same colour is invisible.

      So there are two panels a side:

        * `front`, from the lapel's roll line round to `WRAP`. Plain jacket.
        * `lapel`, a narrow strip from the opening out to the roll line, rising
          STEEPLY toward its free edge so the fold has a real angle in it, in a
          material a few per cent lighter -- which is what the same cloth turned
          over actually measures.

      The notch is a step in the strip's WIDTH rather than a separate mesh. As a
      third ellipsoid it read as a third bump; as a step in one silhouette it is
      what a notch lapel is.
    */
    const lapelMat = surface(B, scene, `${spec.id}-lapel`, spec.outfit.jacket, { roughness: 0.88 });
    /*
      1.10, and it is doing two jobs. A lapel is the same cloth turned over, so
      it genuinely catches a little more light -- and it has to be enough of a
      difference to SEPARATE the lapel from the panel behind it, because that
      separation is the entire reason a viewer reads the shape as a jacket. Much
      more than this and the pair read as two stripes painted on the chest, which
      is what 1.22 looked like in an earlier version of this file.
    */
    lapelMat.albedoColor = lapelMat.albedoColor.scale(1.10);
    lapelMat.metallicF0Factor = 0.36;
    applyNormal(B, scene, lapelMat, 'cloth-wool', clothSpan, 0.55);
    /*
      AND THE LAPEL IS VISIBLE FROM BOTH SIDES.

      It is a single-sided surface with a free edge that stands off the chest, so
      from any camera below the fold a culled panel shows nothing where the
      underside of the lapel should be -- and what fills that hole is the shirt,
      which reads as a tear in the jacket. It is one flat strip, so drawing its
      back face costs a few hundred pixels and cannot produce a wrong occlusion.
    */
    lapelMat.backFaceCulling = false;

    /** How wide the lapel's strip is at height `y`, in radians. */
    function lapelWidthAt(y: number): number {
        if (!male) {
            /*
              A SHAWL COLLAR is a continuous roll: constant width, narrower than
              a notch lapel, and running all the way to the collar with no step.
              That difference is the whole difference between the two garments,
              and having them share one shape is what made the pair read as two
              lobes on every female figure.
            */
            return 0.26;
        }
        /*
          A NOTCH LAPEL is widest a third of the way down from the collar and
          steps in sharply above that -- the step IS the notch. Measured off a
          jacket rather than chosen: the widest point is about a third of the way
          from the centre line to the shoulder seam.
        */
        const peak = openTop - 0.055 * spec.height;
        const above = smooth(openTop + 0.006 * spec.height, peak, y);
        const below = smooth(buttonY, peak, y);
        return 0.13 + 0.27 * above * (0.45 + 0.55 * below);
    }

    for (const side of [-1, 1]) {
        const front = garment(`${spec.id}-front${side}`, 16, 22, (u, v) => {
            const top = openTop + 0.016 * spec.height;
            const y = top - (top - hemY) * v;
            const roll = openAt(y) + lapelWidthAt(y);
            const theta = side * (roll + Math.max(0.04, WRAP - roll) * u);
            return onTorso(theta, y, OUT_JACKET);
        });
        front.material = jacketMat;

        /*
          ============================================================
          A LAPEL IS A PLATE WITH AN EDGE AND A FOLD, IN THAT ORDER
          ============================================================

          The version before this raised the offset smoothly from the roll line
          to the free edge, which is the right idea and rendered as nothing: a
          centimetre of rise over five centimetres of arc is an eleven-degree
          tilt, and eleven degrees of the same colour against the panel behind it
          is invisible. Three renders confirmed it -- the shirt, the tie, the
          collar and the buttons all read, and the lapels did not.

          What a lapel actually is, in three parts across its width, and all three
          are needed:

            u 0.00 .. 0.14   THE EDGE. A short wall from just above the shirt up
                             to the plate. This is what closes the gap you would
                             otherwise look into, and its shadow is the dark line
                             that makes the lapel a distinct object.
            u 0.14 .. 0.76   THE PLATE. Flat, standing 2 cm off the chest. Being
                             at a constant offset over a CURVED body means its
                             normal diverges from the chest's more and more toward
                             the sides -- which is exactly how a real lapel
                             catches a different amount of light along its length.
            u 0.76 .. 1.00   THE FOLD, down to flush at the roll line, so the
                             lapel and the jacket panel meet in a seam.

          Together they give a silhouette, an edge, a shadow and a shading
          difference, which is four cues where the smooth rise gave none.
        */
        const lapel = garment(`${spec.id}-lapel${side}`, 12, 20, (u, v) => {
            const top = openTop + 0.016 * spec.height;
            // The lapel stops at the button; below it the jacket is closed and
            // there is nothing to turn over.
            const bottom = buttonY - 0.004 * spec.height;
            const y = top - (top - bottom) * v;
            const inner = openAt(y);
            const width = lapelWidthAt(y);

            let out: number;
            let theta: number;
            if (u < 0.14) {
                // The edge wall: theta barely moves, the offset climbs.
                theta = side * (inner + width * 0.02 * (u / 0.14));
                out = OUT_SHIRT + (OUT_JACKET + OUT_LAPEL_RISE - OUT_SHIRT) * (u / 0.14);
            } else if (u < 0.76) {
                theta = side * (inner + width * (0.02 + 0.86 * ((u - 0.14) / 0.62)));
                out = OUT_JACKET + OUT_LAPEL_RISE;
            } else {
                theta = side * (inner + width * (0.88 + 0.12 * ((u - 0.76) / 0.24)));
                out = OUT_JACKET + OUT_LAPEL_RISE * (1 - smooth(0.76, 1, u));
            }
            return onTorso(theta, y, out);
        });
        lapel.material = lapelMat;
    }

    /*
      THE COLLAR: a band close to the neck, plus two points lying on the shirt.

      The band was a flared five-point lathe at 1.08 to 1.18 of the neck radius
      and it read as a neck brace -- against a dark jacket, a pale ring that size
      is the brightest and largest thing in the tile. What a collar band actually
      shows from in front is about two centimetres, and its lower half is behind
      the jaw from any camera the subject is facing.

      Its height is still FOUND rather than written down (`clearsJacketAbove`),
      because the number that was written down put it three centimetres inside
      the trapezius for the whole life of this file.
    */
    const collarRadius = P.neckRadius * 1.07;
    const collarBase = clearsJacketAbove(collarRadius) - 0.014 * spec.height;
    const collar = track(B.CreateLathe(`${spec.id}-collar`, {
        shape: [
            new B.Vector3(collarRadius, collarBase, 0),
            new B.Vector3(collarRadius * 1.02, collarBase + 0.008 * spec.height, 0),
            new B.Vector3(collarRadius * 1.045, collarBase + 0.016 * spec.height, 0),
            new B.Vector3(collarRadius * 0.99, collarBase + 0.021 * spec.height, 0),
        ],
        // Same reason as the torso: a lathe at 24 segments is a ring of visible
        // facets right under the chin, which is where the eye already is.
        tessellation: Math.round(40 * detail) + 12,
        closed: true,
    }, scene));
    collar.material = collarMat;
    collar.parent = body;

    /*
      The two points, and they are PANELS now rather than ellipsoids.

      A collar point is a flat triangle of cloth folded down over the chest, and
      that is exactly what a panel with a converging edge is. They sit at
      `OUT_COLLAR` -- outside the shirt, inside the jacket's lapel -- which is
      where a shirt collar is: the notch a viewer reads is the gap between this
      and the lapel edge above it.
    */
    /*
      MEN ONLY, and it is the same distinction as the lapel's.

      A collar point is the corner of a SHIRT collar folded down over the chest,
      and it exists to be seen either side of a tie knot. A blazer over a blouse
      has no such thing -- so on the female figures the pair were two grey tabs
      at the throat with nothing to explain them, which reads as a garment
      nobody could name. A blouse's neckline is the shirt panel and the shawl
      collar over it, and that is complete on its own.
    */
    for (const side of male ? [-1, 1] : []) {
        const point = garment(`${spec.id}-collarpt${side}`, 8, 8, (u, v) => {
            /*
              ============================================================
              SHORT AND WIDE, OR IT READS AS A BRACE
              ============================================================

              At 0.085 rad half-width over 4 cm of drop the pair rendered as two
              narrow pale straps running diagonally down the chest -- which a
              viewer reads unmistakably as SUSPENDERS, not as a collar. Length
              was the fault, not width: a strap is anything much longer than it is
              wide, whatever it is made of.

              A shirt collar point is roughly as wide as it is long and it sits
              immediately beside the neck. Two and a half centimetres of drop, a
              wide top tapering to a point, and it starts at the collar band
              rather than a centimetre below it -- so it reads as part of the
              collar, which is what it is.

              Most of it is then UNDER the lapel, which now stands 2 cm off the
              chest. That is correct and is why the pair no longer dominate: a
              shirt collar shows next to the throat and disappears behind the
              jacket's lapel, exactly as it does on a person.
            */
            const y = collarBase + 0.006 * spec.height
                - (0.025 * spec.height) * v;
            const half = 0.105 * (1 - v * 0.86);
            const centre = side * (0.075 + 0.075 * v);
            return onTorso(centre - half + 2 * half * u, y, OUT_COLLAR);
        });
        point.material = collarMat;
    }

    if (!male) {
        /*
          A PLACKET: the button strip down the front of a blouse.

          Three millimetres of relief and it does more than its size suggests.
          Without it the shirt panel is one smooth pale surface with nothing on
          it, and a surface with no feature has no scale -- which is what makes it
          read as a bib rather than as a garment. With a seam down the middle it
          is a blouse front, and the two halves either side of it are what a
          viewer recognises.

          It is the male figures' TIE that does this job for them, which is why
          this is the other branch of the same `if`.
        */
        const placket = garment(`${spec.id}-placket`, 6, 16, (u, v) => {
            const y = collarBase - 0.010 * spec.height
                - (collarBase - buttonY) * v;
            const half = 0.030;
            return onTorso(-half + 2 * half * u, y, OUT_SHIRT + 0.0016 * spec.height);
        });
        placket.material = shirtMat;
    }

    if (male) {
        /*
          A TIE IS A FLAT STRIP AND A TRAPEZOID KNOT, both on the torso.

          The knot was a sphere scaled to 2.1 x 1.9 x 0.85 cm and the report
          called the result a bead; at tile size, with a specular highlight on it,
          a saturated sphere under a collar is the single most doll-like thing a
          figure can wear -- it reads as a clown's nose, which is what the
          screenshot showed. A real knot is a four-sided wedge, wider at the
          bottom than the top, lying against the throat.

          Both are panels on the same surface as everything else, so the tie
          cannot come out shallower than the shirt behind it. That was a real bug
          here and it needed a paragraph of explanation; parametrised on the
          torso it is not expressible.
        */
        const knotTop = collarBase - 0.002 * spec.height;
        const knotBottom = knotTop - 0.030 * spec.height;
        const knot = garment(`${spec.id}-knot`, 10, 6, (u, v) => {
            const y = knotTop - (knotTop - knotBottom) * v;
            // Wider at the bottom, which is which way up a four-in-hand is.
            const half = 0.070 + 0.048 * v;
            // Bulged in the middle: a knot is the one garment piece that IS
            // three-dimensional, and a flat one reads as a painted stripe.
            const bulge = Math.sin(Math.PI * u) * Math.sin(Math.PI * v * 0.85);
            return onTorso(-half + 2 * half * u, y,
                OUT_KNOT * (0.55 + 0.45 * bulge));
        });
        knot.material = accentMat;

        const tie = garment(`${spec.id}-tie`, 10, 18, (u, v) => {
            const y = knotBottom + 0.004 * spec.height
                - (knotBottom - (buttonY + 0.010 * spec.height)) * v;
            /*
              Narrow under the knot, widest at two thirds down, then to a point.
              A tie with a constant width is a ribbon and one that tapers all the
              way is a wedge; the widening is what makes it read as a tie.
            */
            const taper = v < 0.72
                ? 0.062 + 0.060 * smooth(0, 0.72, v)
                : 0.122 * (1 - smooth(0.72, 1, v) ** 0.7);
            const half = Math.max(0.004, taper);
            return onTorso(-half + 2 * half * u, y, OUT_TIE);
        });
        tie.material = accentMat;
    } else {
        /*
          A PENDANT, and it stays a small sphere on purpose.

          Everything else on the chest stopped being a blob because a blob cannot
          read as cloth. A pendant is not cloth: it is a small hard object hanging
          in front of the sternum, so a sphere is the correct shape and the only
          question is whether it is the right size. It is the one accent a female
          figure carries -- there is deliberately no chain, because at this scale
          a chain never cleared the collar and rendered as nothing at all while
          costing a mesh.
        */
        const pendant = track(B.CreateSphere(`${spec.id}-pendant`, {
            /*
              1 cm, not 2.5. At `0.014h` it measured 2.5 cm across on the taller
              anchor and read as a bead rather than as jewellery -- the same fault
              the tie knot had, which is that a matte sphere at any size above
              about a centimetre reads as a bead.
            */
            diameter: 0.0092 * spec.height, segments: 14,
        }, scene));
        /*
          And it is METAL, not cloth. `accentMat` is now a silk: 0.38 roughness
          with a raised reflectance, which on a sphere gives one broad soft
          highlight -- a plastic bead. A pendant is the one hard object on the
          figure, so it gets a tight lobe and real metallness, which is what
          produces the small sharp glint that reads as jewellery.
        */
        /*
          0.55 METALLIC, NOT 0.85, AND BRIGHTER.

          In PBR a metal's ALBEDO is its F0 -- the colour of its reflection --
          rather than a diffuse colour, so at 0.85 a dark accent hue produces a
          dark mirror with almost nothing to reflect in this room, and the pendant
          rendered as a small dull dot. Half metallic keeps a diffuse component to
          catch the key light, and lifting the albedo puts it in the range a
          polished stone or a piece of costume jewellery actually sits in.
        */
        const pendantBase = B.Color3.FromHexString(spec.outfit.accent);
        const pendantMat = surface(B, scene, `${spec.id}-pend`, spec.outfit.accent,
            { roughness: 0.18, metallic: 0.55, flat: true });
        pendantMat.albedoColor = new B.Color3(
            Math.min(1, pendantBase.r * 1.35 + 0.10),
            Math.min(1, pendantBase.g * 1.35 + 0.10),
            Math.min(1, pendantBase.b * 1.35 + 0.10),
        );
        pendant.material = pendantMat;
        pendant.scaling.z = 0.62;
        const pendantY = collarBase - 0.040 * spec.height;
        pendant.position.set(0, pendantY,
            frontZAt(0, pendantY) + OUT_TIE);
        pendant.parent = body;
    }

    /*
      BUTTONS, which are three millimetres of geometry and read out of all
      proportion to that.

      They are the one detail that says a garment FASTENS, and a jacket with a
      lapel, a collar and no button reads as a wrap. Two of them, at and below
      the button point, on the panel that laps over -- the figure's own left,
      which is how a man's jacket is made and how a woman's is not, so the side
      follows the gender.
    */
    const buttonSide = male ? 1 : -1;
    for (const step of [0, 1]) {
        const buttonY2 = buttonY - step * 0.052 * spec.height;
        const buttonTheta = buttonSide * (openAt(buttonY2) + 0.052);
        const stud = track(B.CreateSphere(`${spec.id}-button${step}`, {
            diameter: 0.0092 * spec.height, segments: 10,
        }, scene));
        // Flattened: a button is a disc, and a sphere at equal proportions is a
        // pearl. Same mistake the tie knot was making one paragraph up.
        stud.scaling.set(1, 1, 0.34);
        const seat = onTorso(buttonTheta, buttonY2, OUT_JACKET + 0.0022 * spec.height);
        stud.position.set(seat.x, seat.y, seat.z);
        stud.material = buttonMat;
        stud.parent = body;
    }

    /* ---- neck and head ------------------------------------------------ */

    /*
      A neck is SHORT and it is thick. At 0.11 of standing height with a 1.9x top
      diameter the first version was a stalk, and a stalk is what makes a head
      read as balanced on a body rather than joined to it. Real neck length below
      the jaw is nearer 0.07, and it flares hard into the trapezius.
    */
    const neck = track(B.CreateCylinder(`${spec.id}-neck`, {
        height: 0.085 * spec.height,
        diameterTop: P.neckRadius * 1.90,
        diameterBottom: P.neckRadius * 2.20,
        // A twenty-six-sided neck under the chin is the most visible faceting
        // on the figure, because the light falls across it at a grazing angle.
        tessellation: Math.round(40 * detail) + 12,
    }, scene));
    neck.material = skinDark;
    neck.position.y = P.neckY - 0.030 * spec.height;
    neck.position.z = -P.chestDepth * 0.06;
    neck.parent = body;

    /**
     * The head pivots at the ATLAS, not at its own centre.
     *
     * A head rotated about its centre swings the chin backwards as it nods,
     * which is the single most robotic thing a rendered person can do. The
     * joint is at the top of the neck, where a real one is, so a nod moves the
     * chin down and the crown back, as a nod does.
     */
    const headPivot = new B.TransformNode(`${spec.id}-atlas`, scene);
    headPivot.position.set(0, P.neckY + 0.012 * spec.height, -P.chestDepth * 0.04);
    headPivot.parent = body;

    const headGroup = new B.TransformNode(`${spec.id}-head`, scene);
    headGroup.parent = headPivot;

    const R = P.headRadius;
    /*
      `updatable: true`, AND IT IS NOT OPTIONAL.

      Without it Babylon builds the vertex buffer with `STATIC_DRAW`, and the
      `updateVerticesData` in `sculptHead` then does nothing AT ALL — no error,
      no warning, no return value to check. What renders is the sphere as it was
      created: a two-metre ball where a head should be, filling the entire
      frame, which is exactly what the first render of this scene produced.

      The failure is worth recognising elsewhere: any mesh whose vertices are
      moved after `Create*` has to be created updatable, and the symptom is
      never an exception.
    */
    /*
      64 segments at high detail, 43 at low, and it is the sculpt that needs
      them rather than the silhouette.

      At 34 the brow ridge, the cheekbones and the eye sockets all landed
      between vertices, so each of them rendered as a flat plate with a hard
      edge — pale bands across the forehead and the cheek that read as a
      texturing fault or a shading seam rather than as anatomy. A displaced
      surface needs the resolution to carry its own smallest feature; an
      undisplaced sphere does not. It is ~4,200 vertices, which is nothing.
    */
    const head = track(B.CreateSphere(`${spec.id}-skull`, {
        diameter: 2,
        segments: Math.round(64 * detail) + 12,
        updatable: true,
    }, scene));
    sculptHead(B, head, R, male, spec.build * 0.5 + 0.75);
    head.material = skin;
    head.position.y = R * 0.92;
    head.parent = headGroup;

    /**
     * Where the sculpted surface actually is, for a direction on the unit sphere.
     *
     * ============================================================
     * THE BROWS HAVE NEVER BEEN VISIBLE, AND THIS IS WHY
     * ============================================================
     *
     * They were placed at `eyeZ * 1.02` — a depth derived from the EYEBALL,
     * which sits in a socket the sculpt pushes 16% INTO the skull. Above the
     * eye there is no socket: the brow ridge is one of the most forward points
     * on the whole head, at about 0.80 R. So each brow was ~0.14 R inside the
     * face, i.e. entirely swallowed.
     *
     * It is invisible as a bug because something else was in roughly the right
     * place: the eyelash, which rides the lid and therefore does clear the
     * surface. Every screenshot of this cast has had a dark bar above each eye
     * and it has always been the lashes. The brows — three meshes each, an arch,
     * a taper and an animation — have been rendering inside a skull the whole
     * time, which is also why `browRaise` has never been visible.
     *
     * Guessing a second depth would only move the guess. `sculptHeadVertex` is
     * the function that decides where the surface is, so it is the function that
     * gets asked. Same discipline as `frontZAt` for the clothing, and for the
     * same reason: the sculpt changes, and anything sitting on it has to follow.
     */
    function faceSurface(x: number, y: number): BJS.Vector3 {
        // Back onto the unit sphere: the sculpt's input is a unit direction.
        const z = Math.sqrt(Math.max(0.02, 1 - x * x - y * y));
        const [px, py, pz] = sculptHeadVertex(x, y, z, R, male, spec.build * 0.5 + 0.75);
        // Into `headGroup` space, where the head mesh is lifted by 0.92 R.
        return new B.Vector3(px, head.position.y + py, pz);
    }

    const eyeY = head.position.y + R * 0.045;
    const eyeX = R * 0.245;
    /*
      Far enough forward that the cornea is OUTSIDE the socket floor.

      The socket above pulls the surface in to about 0.635 of the head's depth;
      the eyeball's centre sits at 0.60 with a radius of 0.128, so its front is
      at 0.728 — seven millimetres of a real head in front of the socket floor,
      which is roughly where a cornea is. Behind it, the face is a mask.
    */
    const eyeZ = R * 0.600;
    const eyeR = R * 0.128;

    /* ---- eyes ----------------------------------------------------------
       Wet, and that is the whole trick: a specular highlight on the cornea is
       what a viewer reads as "alive", and it is why the sclera and the iris are
       the two glossiest materials on the figure. A matte eye is a doll's eye
       however good the rest is.

       ============================================================
       THE LIDS ARE ELLIPSOIDS THAT MOVE, NOT SHELLS THAT ROTATE
       ============================================================

       The first version made each lid a hemispherical shell a hair larger than
       the eyeball and blinked it by rotating it about X. That is the textbook
       construction and it does not survive contact: the two rotations needed
       (one for the resting angle, one to close) compose in Euler order, so an
       angle that looked right at the centre of the eye had the shell's rim
       across the pupil at the corners.

       A squashed ellipsoid sitting on the brow and TRANSLATED down to close has
       one degree of freedom and cannot be got wrong that way. It also gives the
       upper lid a fold, which a shell cannot. */
    const lids: { upper: Mesh; lower: Mesh; lash: Mesh }[] = [];
    /** The eyeball groups, so the eyes can aim as well as the head. */
    const sockets: { node: TransformNode; side: number }[] = [];
    for (const side of [-1, 1]) {
        const socket = new B.TransformNode(`${spec.id}-eye${side}`, scene);
        socket.position.set(side * eyeX, eyeY, eyeZ);
        // Eyes converge very slightly, as they do on anything nearer than
        // infinity — parallel eyes are a thousand-yard stare.
        socket.rotation.y = -side * 0.055;
        socket.parent = headGroup;
        sockets.push({ node: socket, side });

        const ball = track(B.CreateSphere(`${spec.id}-ball${side}`, {
            diameter: eyeR * 2, segments: Math.round(16 * detail) + 6,
        }, scene));
        ball.material = scleraMat;
        ball.parent = socket;

        /* The ring goes on FIRST and slightly larger, so the iris sits inside
           it and only its rim shows. */
        const limbal = track(B.CreateSphere(`${spec.id}-limbal${side}`, {
            diameter: eyeR * 1.10, segments: Math.round(16 * detail) + 6,
        }, scene));
        limbal.material = limbalMat;
        limbal.scaling.z = 0.36;
        limbal.position.z = eyeR * 0.80;
        limbal.parent = socket;

        const iris = track(B.CreateSphere(`${spec.id}-iris${side}`, {
            // An iris is about half the eyeball's diameter, so `eyeR` is right
            // and 1.16 was 16% too wide — enough that the eyes read as staring.
            diameter: eyeR * 0.98, segments: Math.round(16 * detail) + 6,
        }, scene));
        iris.material = irisMat;
        iris.scaling.z = 0.38;
        iris.position.z = eyeR * 0.84;
        iris.parent = socket;

        const pupil = track(B.CreateSphere(`${spec.id}-pupil${side}`, {
            diameter: eyeR * 0.44, segments: 12,
        }, scene));
        pupil.material = pupilMat;
        pupil.scaling.z = 0.30;
        pupil.position.z = eyeR * 0.96;
        pupil.parent = socket;

        const upper = track(B.CreateSphere(`${spec.id}-lidU${side}`, {
            diameter: 1, segments: Math.round(16 * detail) + 6,
        }, scene));
        upper.scaling.set(eyeR * 2.70, eyeR * 1.70, eyeR * 2.10);
        upper.material = skin;
        upper.parent = socket;

        const lower = track(B.CreateSphere(`${spec.id}-lidL${side}`, {
            diameter: 1, segments: Math.round(14 * detail) + 6,
        }, scene));
        /*
          ============================================================
          THE PALE CRESCENT UNDER EACH EYE WAS THIS
          ============================================================

          At 1.95 eye-radii of depth the lower lid bulged well forward of the
          eyeball, so the key light caught its upper edge as a bright rim -- and a
          bright rim immediately below an iris is read as SCLERA, i.e. as an eye
          rolled upward. Every render of this cast has had a pale crescent under
          each eye and it has been the lid, not the white of the eye. On the
          darker skin tones it was the most doll-like thing on the face, because
          the contrast against the surrounding skin is greatest there.

          A real lower lid is a thin ridge that follows the eyeball rather than
          standing off it. Shallower and flatter, its edge is nearly tangent to
          the ball and takes the light at a grazing angle instead of face-on.
        */
        lower.scaling.set(eyeR * 2.50, eyeR * 0.98, eyeR * 1.58);
        /*
          The SAME skin as the rest of the face, not the darker one.

          A darker albedo under the eye is a painted shadow, and a painted shadow
          does not move with the light — it read as a bruise under one eye and a
          smudge under the other, depending on which side the key was on. What a
          real lower lid has is a shadow cast into the crease, and the geometry
          already produces that.
        */
        lower.material = skin;
        lower.parent = socket;

        /* Lashes: a thin dark line along the lid margin, and no thicker. Two
           triangles' worth of darkness at the top of an eye is worth more than
           any amount of geometry anywhere else on the face.

           A SIBLING of the lid, not a child of it. The lid is a unit sphere
           scaled by ~0.03 in every axis, and a child inherits that scaling — so
           parented to it the lash came out as a microscopic speck at the eye's
           centre. Non-uniformly scaled parents are the standard way to lose a
           child mesh, and it fails silently: there is geometry, it is submitted,
           it is simply too small to see. */
        /*
          AN ELLIPSOID, NOT A BOX — this is one of the "squares".

          A `CreateBox` two millimetres tall is still a box: it has eight
          corners, six flat faces and a hard rectangular silhouette, and at head
          framing what sat above each eye was a small dark BAR. Two of them, one
          per eye, in the part of the face a viewer looks at first.

          A squashed sphere has a curved margin that follows the lid, tapers
          toward the corners, and cannot show an edge.
        */
        const lash = track(B.CreateSphere(`${spec.id}-lash${side}`, {
            diameter: 1, segments: Math.round(14 * detail) + 5,
        }, scene));
        lash.scaling.set(eyeR * 1.90, eyeR * (male ? 0.15 : 0.24), eyeR * 0.62);
        lash.material = hairMat;
        lash.rotation.x = -0.30;
        lash.parent = socket;

        lids.push({ upper, lower, lash });
    }

    /* ---- brows ----------------------------------------------------------
       ============================================================
       THREE VOLUMES PER BROW, ON AN UNSCALED PIVOT
       ============================================================

       A brow was one ellipsoid 0.33 R long and 0.06 R tall, tilted — which is a
       BAR. A bar above an eye is the drawn-on eyebrow of a cartoon, and with the
       lashes below it (also a bar, also fixed) the eye region was three parallel
       dark lines.

       A real brow has a thick, low, squared-off inner end, a peak about two
       thirds of the way out, and a thin tail that drops away. Three overlapping
       volumes give all of that and union into one continuous shape.

       THE PIVOT IS A `TransformNode` AND NOT ONE OF THE THREE MESHES, and that
       is the file's own warning being paid a second time: a child of a
       non-uniformly scaled node inherits that scaling, so parenting the inner
       end and the tail to the PEAK — which is a unit sphere scaled by ~0.02 in
       each axis — multiplied both their offsets and their sizes by that scale.
       They landed at the peak's centre, a fifth of a millimetre across. It fails
       exactly as the lashes did: there is geometry, it is submitted, and it is
       too small to see. The same trap is already documented for the lashes and
       `check:actors` asserts it there; it now asserts this too.
    */
    /*
      A BROW IS NOT SCALP HAIR, and sharing `hairMat` was making the pair read as
      two solid painted arcs.

      Two differences, both real. A brow is LIGHTER than the hair on the same
      head -- fewer, finer hairs over skin that shows between them, so what the
      eye averages is somewhere between the two. And it is ROUGHER: scalp hair is
      long enough to lie flat and produce a sheen, and a brow is not, so it has
      no highlight at all. At `hairMat`'s 0.80 roughness and full hair albedo the
      three volumes union into one glossy black bar, which with the lashes below
      it gave the eye region two parallel painted lines.

      The skin shows through, so the mix is toward the skin rather than simply
      darker -- which is also what keeps it right across a cast whose skin tones
      span `#6f4630` to `#f0cbaa`.
    */
    const browBase = B.Color3.FromHexString(spec.hair);
    const browSkin = B.Color3.FromHexString(spec.skin);
    const browMat = surface(B, scene, `${spec.id}-brow`, spec.hair, { roughness: 0.94 });
    browMat.albedoColor = new B.Color3(
        browBase.r * 0.72 + browSkin.r * 0.28,
        browBase.g * 0.72 + browSkin.g * 0.28,
        browBase.b * 0.72 + browSkin.b * 0.28,
    );
    browMat.metallicF0Factor = 0.06;
    applyNormal(B, scene, browMat, 'hair-strand', P.headRadius * 0.5, 0.5);

    const brows: TransformNode[] = [];
    const browRest: number[] = [];
    for (const side of [-1, 1]) {
        /* On the brow ridge, found rather than guessed — see `faceSurface`. */
        const at = faceSurface(side * 0.285, 0.205);
        const pivot = new B.TransformNode(`${spec.id}-brow${side}`, scene);
        pivot.position.set(at.x * 1.02, at.y, at.z * 0.97);
        pivot.rotation.x = -0.22;
        pivot.parent = headGroup;
        brows.push(pivot);
        browRest.push(at.y);

        /** One volume of the arch. `at` is in METRES, in the pivot's own space. */
        const part = (
            name: string, lx: number, ly: number, lz: number,
            sx: number, sy: number, sz: number, roll: number,
        ) => {
            const mesh = track(B.CreateSphere(`${spec.id}-${name}${side}`, {
                diameter: 1, segments: Math.round(12 * detail) + 5,
            }, scene));
            mesh.material = browMat;
            mesh.scaling.set(R * sx, R * sy, R * sz);
            mesh.position.set(R * lx, R * ly, R * lz);
            mesh.rotation.z = roll;
            mesh.parent = pivot;
            return mesh;
        };

        // The peak: thickest, two thirds of the way out.
        part('browpk', 0, 0, 0, 0.185, male ? 0.058 : 0.044, 0.088, -side * 0.16);
        /* The inner end: toward the nose, LOWER and blunter. The drop toward the
           centre line is what gives a face an expression at rest. */
        part('browin', -side * 0.135, -0.022, -0.012, 0.150, male ? 0.054 : 0.040,
             0.082, -side * 0.30);
        // The tail: thinner, further out, falling away.
        part('browtl', side * 0.140, -0.030, -0.030, 0.135, male ? 0.034 : 0.026,
             0.064, -side * 0.44);
    }

    /* ---- mouth ----------------------------------------------------------
       A jaw node with the lower lip, the chin surface highlight and the teeth
       parented to it, so opening the mouth rotates all of them together about
       the mandibular condyle — level with the ear, not at the lips. Rotating
       about the lips is what makes a mouth look like a letterbox flap. */
    const mouthY = head.position.y - R * 0.345;
    const mouthZ = R * 0.815 * 0.83;

    const mouthHole = track(B.CreateSphere(`${spec.id}-cavity`, {
        diameter: 1, segments: 12,
    }, scene));
    mouthHole.scaling.set(R * 0.22, R * 0.14, R * 0.20);
    mouthHole.material = mouthMat;
    mouthHole.position.set(0, mouthY, mouthZ - R * 0.12);
    mouthHole.parent = headGroup;

    const upperLip = track(B.CreateSphere(`${spec.id}-lipU`, {
        diameter: 1, segments: Math.round(18 * detail) + 6,
    }, scene));
    /* A mouth is about a THIRD of the width of a face. At 0.345 of the head
       radius each lip was 0.69 R across against a 1.4 R face, i.e. half of it,
       and a mouth that wide reads as a caricature however well it moves. */
    upperLip.scaling.set(R * 0.255, R * 0.058, R * 0.098);
    upperLip.material = lipMat;
    upperLip.position.set(0, mouthY + R * 0.050, mouthZ);
    upperLip.parent = headGroup;

    /*
      ============================================================
      THE CUPID'S BOW, AND THE CORNERS
      ============================================================

      The upper lip was one ellipsoid, so its top edge was a single smooth arc —
      and a smooth arc is exactly what a mouth does NOT have. What a viewer reads
      as "lips" rather than as "a shape on a face" is the double curve of the
      upper lip and the fact that the corners are lower, thinner and darker than
      the middle.

      Two small lobes riding on top of the upper lip give the double curve; two
      darkened tips at the ends give the corners. Both are parented to the upper
      lip, so `lipSpread` carries them without a second animation path.
    */
    for (const side of [-1, 1]) {
        const lobe = track(B.CreateSphere(`${spec.id}-bow${side}`, {
            diameter: 1, segments: Math.round(12 * detail) + 4,
        }, scene));
        lobe.material = lipMat;
        // In the lip's own space, so its scaling is a fraction of the lip's.
        lobe.scaling.set(0.34, 0.62, 0.66);
        lobe.position.set(side * 0.30, 0.24, 0.10);
        lobe.parent = upperLip;
    }

    /* The corners. Darker, because the two lips meet there and a seam in skin is
       always a shadow — and it is the cue that makes a closed mouth read as
       closed rather than as a stripe. */
    const cornerMat = surface(B, scene, `${spec.id}-corner`, spec.skin, { roughness: 0.42 });
    cornerMat.albedoColor = lipMat.albedoColor.scale(0.52);
    for (const side of [-1, 1]) {
        const corner = track(B.CreateSphere(`${spec.id}-corner${side}`, {
            diameter: 1, segments: Math.round(12 * detail) + 4,
        }, scene));
        corner.material = cornerMat;
        corner.scaling.set(R * 0.045, R * 0.038, R * 0.055);
        corner.position.set(side * R * 0.245, mouthY - R * 0.004, mouthZ - R * 0.030);
        corner.parent = headGroup;
    }

    const jaw = new B.TransformNode(`${spec.id}-jaw`, scene);
    // The hinge: just in front of the ear canal and a little below it.
    jaw.position.set(0, eyeY - R * 0.14, -R * 0.24);
    jaw.parent = headGroup;

    const lowerLip = track(B.CreateSphere(`${spec.id}-lipL`, {
        diameter: 1, segments: Math.round(14 * detail) + 4,
    }, scene));
    lowerLip.scaling.set(R * 0.245, R * 0.072, R * 0.104);
    lowerLip.material = lipMat;
    lowerLip.position.set(0, mouthY - R * 0.055 - jaw.position.y, mouthZ - jaw.position.z);
    lowerLip.parent = jaw;
    /*
      Its resting height, kept so `mouthPress` can move it and put it back.
      Reading `lowerLip.position.y` inside `update` would work on the first frame
      and accumulate on every one after it -- the classic animate-from-current
      bug, which drifts rather than failing and is therefore diagnosed as "the
      mouth slowly slides down the chin".
    */
    const lowerLipRestY = lowerLip.position.y;

    const teeth = track(B.CreateSphere(`${spec.id}-teeth`, {
        diameter: 1, segments: 10,
    }, scene));
    teeth.scaling.set(R * 0.180, R * 0.044, R * 0.066);
    teeth.material = teethMat;
    teeth.position.set(0, mouthY + R * 0.012 - jaw.position.y, mouthZ - R * 0.06 - jaw.position.z);
    teeth.parent = headGroup; // upper teeth do not move with the jaw

    /* ---- nostrils --------------------------------------------------------
       Two small dark volumes tucked under the alae, and they are worth more than
       their size suggests: the sculpt gives the nose a ridge, a tip and two
       flares, and without an opening under them the whole thing reads as a
       smooth lump rather than as a nose. They are set BACK and DOWN so only the
       shadow shows from any camera in front. */
    const nostrilMat = surface(B, scene, `${spec.id}-nostril`, '#2b1a14', { roughness: 0.6, flat: true });
    for (const side of [-1, 1]) {
        const nostril = track(B.CreateSphere(`${spec.id}-nostril${side}`, {
            diameter: 1, segments: Math.round(12 * detail) + 4,
        }, scene));
        nostril.material = nostrilMat;
        nostril.scaling.set(R * 0.048, R * 0.028, R * 0.044);
        nostril.rotation.x = 0.55;
        // Under the ala, on the surface, pushed back so only the shadow shows.
        const under = faceSurface(side * 0.115, -0.145);
        nostril.position.set(under.x, under.y, under.z * 0.90);
        nostril.parent = headGroup;
    }

    /* ---- ears ------------------------------------------------------------ */
    for (const side of [-1, 1]) {
        const ear = track(B.CreateSphere(`${spec.id}-ear${side}`, {
            diameter: 1, segments: Math.round(12 * detail) + 4,
        }, scene));
        ear.scaling.set(R * 0.085, R * 0.235, R * 0.155);
        ear.material = skinDark;
        ear.position.set(side * R * 0.645, head.position.y - R * 0.045, -R * 0.030);
        ear.rotation.z = side * 0.10;
        ear.rotation.x = 0.18;
        ear.parent = headGroup;
    }

    /* ---- hair ------------------------------------------------------------
       A cap built from the SAME sculpt as the skull, one step larger. That is
       what makes it sit on the head rather than hover over it, and it is why a
       hairstyle here is a slice height and a couple of extra volumes rather
       than a separate model. */
    const hairShellSlice: Record<HairStyle, number> = {
        crop: 0.60, fade: 0.55, wave: 0.60, bob: 0.66, long: 0.64, bun: 0.60,
    };
    const hairThick: Record<HairStyle, number> = {
        crop: 1.035, fade: 1.022, wave: 1.062, bob: 1.070, long: 1.062, bun: 1.040,
    };
    const shell = track(B.CreateSphere(`${spec.id}-hair`, {
        diameter: 2,
        segments: Math.round(48 * detail) + 10,
        slice: hairShellSlice[spec.hairStyle] ?? 0.6,
        // Sculpted below — see the note on the skull.
        updatable: true,
    }, scene));
    {
        const grow = hairThick[spec.hairStyle] ?? 1.04;
        const positions = shell.getVerticesData(B.VertexBuffer.PositionKind);
        const indices = shell.getIndices();
        if (positions && indices) {
            /*
              Vertex colour on the hair too, for the same reason as on the skin: a
              cap in one flat tone is a helmet. Real hair is darkest where it is
              deepest — the nape, the parting line, under the sweep — and
              catches light along the crown. It is a bigger swing than the skin's
              because hair genuinely varies that much.
            */
            const tint = new Float32Array((positions.length / 3) * 4);
            for (let i = 0; i < positions.length; i += 3) {
                const ux = positions[i] as number;
                const uy = positions[i + 1] as number;
                const uz = positions[i + 2] as number;
                const [x, y, z] = sculptHeadVertex(ux, uy, uz, R, male, spec.build * 0.5 + 0.75);
                // The hairline: hair is pulled BACK over the forehead rather
                // than simply stopping, or the cap reads as a swimming hat.
                const front = smooth(0.30, 0.95, uz) * smooth(0.55, 0.08, uy);
                /*
                  THE RIM TAPERS TO NOTHING.

                  The cap is the skull's own sculpt grown by 2-7%, which means a
                  uniform shell — so where it stops, it stops at full thickness,
                  and what that renders is a hard step all the way round the head
                  with a shadow under it. It reads as a helmet or a swimming cap,
                  and it survived every other improvement to the hair because it
                  is a silhouette fault rather than a shading one.

                  Bringing the growth back toward 1 at the lower edge makes the
                  shell meet the scalp instead of overhanging it, so the boundary
                  is where the two surfaces cross rather than a visible lip.
                */
                const rim = smooth(-0.02, -0.22, uy);
                const here = grow - (grow - 1) * rim * 0.88;
                positions[i] = x * here;
                positions[i + 1] = y * here + R * 0.02 * (1 - front);
                positions[i + 2] = z * here - R * 0.16 * front;

                // Bright along the crown, dark at the nape and behind the ears.
                const crown = smooth(0.35, 1.0, uy);
                const nape = smooth(0.2, 0.9, -uz) * smooth(0.6, -0.2, uy);
                const k = 0.76 + 0.42 * crown - 0.34 * nape;
                const c = (i / 3) * 4;
                tint[c] = k;
                tint[c + 1] = k;
                tint[c + 2] = k;
                tint[c + 3] = 1;
            }
            shell.updateVerticesData(B.VertexBuffer.PositionKind, positions, true, false);
            shell.setVerticesData(B.VertexBuffer.ColorKind, tint, false, 4);
            // Same reason as the skull: a four-component colour buffer must not
            // be read as a transparency, or the cap joins the sorted pass and
            // the skull starts showing through it.
            shell.hasVertexAlpha = false;
            const n = new Float32Array(positions.length);
            B.VertexData.ComputeNormals(positions, indices, n as unknown as number[]);
            shell.updateVerticesData(B.VertexBuffer.NormalKind, n as unknown as number[], true, false);
            shell.refreshBoundingInfo();
        }
    }
    shell.material = hairMat;
    shell.position.y = head.position.y;
    shell.parent = headGroup;

    if (spec.hairStyle === 'long' || spec.hairStyle === 'bob') {
        // A mass at the back, reaching the shoulders (long) or the jaw (bob).
        const drop = spec.hairStyle === 'long' ? 1.0 : 0.52;
        const mass = track(B.CreateSphere(`${spec.id}-hairback`, {
            diameter: 1, segments: Math.round(18 * detail) + 6,
        }, scene));
        mass.scaling.set(R * 1.30, R * (0.95 + 0.75 * drop), R * 1.05);
        mass.material = hairMat;
        mass.position.set(0, head.position.y - R * (0.30 + 0.55 * drop), -R * 0.22);
        mass.parent = headGroup;
        for (const side of [-1, 1]) {
            const strand = track(B.CreateSphere(`${spec.id}-strand${side}`, {
                diameter: 1, segments: Math.round(12 * detail) + 4,
            }, scene));
            strand.scaling.set(R * 0.24, R * (0.55 + 0.45 * drop), R * 0.34);
            strand.material = hairMat;
            strand.position.set(side * R * 0.60, head.position.y - R * (0.32 + 0.30 * drop), R * 0.14);
            strand.parent = headGroup;
        }
    }
    if (spec.hairStyle === 'bun') {
        const bun = track(B.CreateSphere(`${spec.id}-bun`, {
            diameter: R * 0.86, segments: Math.round(16 * detail) + 6,
        }, scene));
        bun.material = hairMat;
        bun.scaling.z = 0.86;
        bun.position.set(0, head.position.y + R * 0.42, -R * 0.92);
        bun.parent = headGroup;
    }
    if (spec.hairStyle === 'wave') {
        /*
          SWEPT UP AND FORWARD, and it has to clear the shell it grows out of.

          At `y = 0.72 R, z = 0.34 R` the quiff's centre was 0.80 R from the head
          centre and its own half-extent 0.15 R, so its outermost point reached
          0.95 R — and the 'wave' shell is grown to 1.062 R. It was entirely
          inside the hair, so James's hairstyle has been a plain cap. The same
          class of mistake as the brows and the collar: a plausible number, no
          error anywhere, and the feature simply is not in the picture.

          `hairThick` is the number it has to clear, so that is what it is
          derived from rather than a third guess.
        */
        const grow = hairThick.wave as number;
        const quiff = track(B.CreateSphere(`${spec.id}-quiff`, {
            diameter: 1, segments: Math.round(18 * detail) + 6,
        }, scene));
        /* Forward and only a little up: at 0.80 R of height it read as a
           topknot rather than as a sweep. A quiff is a fringe lifted at the
           hairline, so most of its offset belongs on Z. */
        /* Smaller and higher than the first attempt at clearing the shell: at
           0.60/0.60 with a 0.70 R width it came forward over the brow and read
           as a mushroom rather than as a sweep. */
        quiff.scaling.set(R * 0.54, R * 0.22, R * 0.42);
        quiff.material = hairMat;
        quiff.position.set(0, head.position.y + R * (grow * 0.72), R * (grow * 0.50));
        quiff.rotation.x = -0.55;
        quiff.parent = headGroup;
    }

    /* ---- arms and hands --------------------------------------------------
       Shoulder, elbow, wrist and one node per finger; the geometry hangs off
       them. That is what lets `gesture()` swing a whole arm with two numbers
       instead of solving for a hand position, and `fingerCurl()` flex four
       fingers without touching the arm. */
    interface Finger {
        node: TransformNode;
        spec: FingerSpec;
    }
    const arms: {
        shoulder: TransformNode;
        elbow: TransformNode;
        wrist: TransformNode;
        fingers: Finger[];
        side: number;
    }[] = [];
    for (const side of [-1, 1]) {
        const shoulder = new B.TransformNode(`${spec.id}-sh${side}`, scene);
        /*
          ============================================================
          THE ARMS HANG BEHIND THE CHEST, NOT THROUGH THE MIDDLE OF IT
          ============================================================

          `z = 0` put each arm's centre line at the middle of the torso's depth,
          and that is the real cause of the lobes on the shoulders. The torso's
          cross-section is an ellipse, so its front surface FALLS AWAY toward the
          sides: at `0.94` of the half-width the front is only 34% as far forward
          as it is on the centre line. Any arm-sized volume centred at z = 0 out
          there therefore protrudes about a centimetre in front of the chest, and
          a smooth convex volume protruding from a smooth convex body is read as a
          lobe however it is shaped. Three rounds of reshaping the deltoid could
          not fix that, because the deltoid was not what was wrong.

          A real shoulder joint sits well behind the front of the chest. Moved
          back by 16% of the chest depth the whole arm is inside the torso's own
          silhouette at the shoulder, and the lobes are structurally impossible
          rather than merely smaller.
        */
        shoulder.position.set(
            side * P.shoulderHalfWidth * 0.94,
            P.shoulderY - 0.012 * spec.height,
            -P.chestDepth * 0.16,
        );
        shoulder.parent = body;

        /*
          ============================================================
          THE BALLS ON THE SHOULDERS ARE GONE, AND WHAT REPLACES THEM
          ============================================================

          Reported exactly that way -- "remove ball objects on the shoulders" --
          and there was one on each side: a sphere of 1.9 arm-radii scaled to
          (0.82, 0.58, 0.86), a 9.6 x 6.8 x 10.1 cm ellipsoid on the widest point
          of the silhouette. Its own comments recorded two previous attempts to
          make it smaller and flatter; neither worked, because the size was never
          the problem. See the note on the shoulder node above for what was.

          There is no deltoid mass any more. What covers the top of the arm is a
          SLEEVE HEAD: a cap as wide as the sleeve it sits on and barely half as
          TALL, which is the proportion that decides how it reads. Wider than it
          is tall, its silhouette continues the shoulder line horizontally and
          then turns down -- which is a shoulder. Taller than it is wide, or
          equal, and the same object is a ball.

          It exists at all because a tapered cylinder has a FLAT top, and an
          uncovered disc edge at the shoulder is a hard rim across the top of
          each arm. This is the smallest thing that hides it.
        */
        const sleeveTop = P.armRadius * 2.06;
        const head = track(B.CreateSphere(`${spec.id}-shcap${side}`, {
            diameter: 1, segments: Math.round(18 * detail) + 6,
        }, scene));
        head.material = jacketMat;
        head.scaling.set(sleeveTop, sleeveTop * 0.50, sleeveTop * 0.86);
        head.position.set(-side * P.armRadius * 0.04, 0, 0);
        head.parent = shoulder;

        /*
          THE SLEEVE TAPERS, because an arm does.

          A capsule is a constant radius with a hemisphere at each end, so the
          old upper arm was a tube of one thickness from shoulder to elbow with a
          rounded cap at the top -- and that cap, poking out above the deltoid,
          was the second ball. A jacket sleeve is markedly wider at the bicep
          than at the elbow, and a truncated cone is exactly that shape with no
          cap at all. Its top ring is inside the deltoid, so there is no visible
          rim.
        */
        const upper = track(B.CreateCylinder(`${spec.id}-uarm${side}`, {
            height: P.upperArm * 1.06,
            diameterTop: sleeveTop * 0.98,
            diameterBottom: P.armRadius * 1.60,
            tessellation: Math.round(24 * detail) + 10,
        }, scene));
        upper.material = jacketMat;
        // Its top ring is inside the sleeve head, so the disc is never seen.
        upper.position.y = -P.upperArm * 0.50;
        upper.parent = shoulder;

        const elbow = new B.TransformNode(`${spec.id}-el${side}`, scene);
        elbow.position.y = -P.upperArm;
        elbow.parent = shoulder;

        /*
          The forearm keeps its capsule: its lower end IS rounded, because that
          is where the cuff and the wrist are, and there is nothing above it for
          a cap to poke out of.
        */
        const fore = track(B.CreateCapsule(`${spec.id}-farm${side}`, {
            height: P.foreArm, radius: P.armRadius * 0.74,
            tessellation: Math.round(22 * detail) + 8, subdivisions: 3,
        }, scene));
        fore.material = jacketMat;
        fore.position.y = -P.foreArm / 2;
        fore.parent = elbow;

        // A shirt cuff showing below the sleeve. Two centimetres of pale cloth
        // between a dark sleeve and a hand is what makes the hand read as
        // emerging from a garment rather than as growing out of a tube.
        const cuff = track(B.CreateCylinder(`${spec.id}-cuff${side}`, {
            height: P.foreArm * 0.11,
            diameterTop: P.armRadius * 1.52,
            diameterBottom: P.armRadius * 1.44,
            tessellation: Math.round(24 * detail) + 8,
        }, scene));
        cuff.material = shirtMat;
        cuff.position.y = -P.foreArm * 0.965;
        cuff.parent = elbow;

        /*
          ============================================================
          A HAND, WITH FINGERS ON IT
          ============================================================

          What was here was one capsule scaled (0.72, 1, 1.05) and one capsule
          for a thumb: a MITTEN with a spur. In the studio, which is the one shot
          where the hands are near the camera and unoccluded -- both anchors rest
          them on the desk holding a script -- that is the second thing a viewer
          looks at after the face, and the screenshot shows two pale flippers.

          A hand is a flattened palm and four fingers off an ARCED knuckle line,
          plus a thumb opposed to them. None of that is expensive; what it needs
          is the proportions to be irregular, which is why they are a table in
          `figures.ts` (`FINGERS`) rather than a loop with a formula: four equal
          capsules on an even pitch is a rake, and it is the same class of
          wrongness as six people blinking in unison.

          THE COST, stated rather than hidden: seven meshes per hand instead of
          two, so fourteen per figure. The meeting draws one figure per viewport
          (the pods are a hundred metres apart so the frustum culls the other
          five), which takes it from ~24 draw calls a frame to ~38. They all
          share one material and one vertex format, so there is no state change
          between them and the GPU cost is negligible; what it buys is a hand
          that reads as a hand at every framing, and per-finger movement, which
          is the only reason the anchors' hands are not two still objects under a
          moving face.
        */
        const wrist = new B.TransformNode(`${spec.id}-wr${side}`, scene);
        wrist.position.y = -P.foreArm - P.handLength * 0.10;
        wrist.parent = elbow;

        const palmLength = P.handLength * 0.56;
        const palm = track(B.CreateCapsule(`${spec.id}-palm${side}`, {
            height: palmLength, radius: P.palmWidth * 0.5,
            tessellation: Math.round(16 * detail) + 6, subdivisions: 2,
        }, scene));
        palm.material = skin;
        // Flattened front-to-back and a little narrower at the wrist end. A palm
        // is a slab, and a round one is a sausage.
        palm.scaling.set(0.94, 1, 0.44);
        palm.position.y = -palmLength * 0.5;
        palm.parent = wrist;

        const fingers: Finger[] = [];
        for (const finger of FINGERS) {
            /*
              One node per finger at its knuckle, so `fingerCurl` can flex it
              without moving the palm. The node carries the splay and the resting
              curl; the capsule hangs off it along -Y, which is the same
              convention the arm uses.
            */
            const knuckle = new B.TransformNode(`${spec.id}-kn${side}${finger.index}`, scene);
            knuckle.position.set(
                // `across` is measured toward the THUMB, and the thumb is on the
                // inside of each arm -- so which way that is depends on the side.
                -side * finger.across * P.palmWidth,
                -palmLength - finger.drop * P.fingerLength,
                P.palmWidth * 0.04,
            );
            knuckle.rotation.z = -side * finger.splay;
            knuckle.rotation.x = finger.curl;
            knuckle.parent = wrist;

            const length = P.fingerLength * finger.length;
            const bone = track(B.CreateCapsule(`${spec.id}-fg${side}${finger.index}`, {
                height: length,
                // Slim. A finger at a quarter of the palm's width is a banana;
                // real ones are nearer a fifth, and the taper toward the tip is
                // what stops four of them reading as a fork.
                radius: P.palmWidth * 0.105,
                tessellation: Math.round(9 * detail) + 5,
                subdivisions: 1,
            }, scene));
            bone.material = skin;
            bone.scaling.set(1, 1, 0.86);
            bone.position.y = -length * 0.5;
            bone.parent = knuckle;
            fingers.push({ node: knuckle, spec: finger });
        }

        /*
          THE THUMB IS TWO SEGMENTS AND IT IS OPPOSED.

          One capsule at 0.75 rad was the old thumb and it read as a spur off the
          side of the mitten. What makes a thumb a thumb is that it comes off the
          BASE of the palm, points across the other fingers rather than along
          them, and has a visible knuckle -- so it is a short thick metacarpal
          angled out and in, with a phalanx angled forward off it.
        */
        const thumbBase = new B.TransformNode(`${spec.id}-th${side}`, scene);
        thumbBase.position.set(-side * P.palmWidth * 0.42, -palmLength * 0.34, P.palmWidth * 0.10);
        thumbBase.rotation.z = -side * 0.92;
        thumbBase.rotation.x = 0.30;
        thumbBase.parent = wrist;

        const thumbMeta = track(B.CreateCapsule(`${spec.id}-thm${side}`, {
            height: P.fingerLength * 0.52, radius: P.palmWidth * 0.135,
            tessellation: Math.round(9 * detail) + 5, subdivisions: 1,
        }, scene));
        thumbMeta.material = skin;
        thumbMeta.position.y = -P.fingerLength * 0.26;
        thumbMeta.parent = thumbBase;

        const thumbTip = track(B.CreateCapsule(`${spec.id}-tht${side}`, {
            height: P.fingerLength * 0.44, radius: P.palmWidth * 0.115,
            tessellation: Math.round(9 * detail) + 5, subdivisions: 1,
        }, scene));
        thumbTip.material = skin;
        thumbTip.position.y = -P.fingerLength * 0.22;
        thumbTip.parent = new B.TransformNode(`${spec.id}-thj${side}`, scene);
        const thumbJoint = thumbTip.parent as TransformNode;
        thumbJoint.position.y = -P.fingerLength * 0.50;
        thumbJoint.rotation.x = 0.34;
        thumbJoint.parent = thumbBase;

        arms.push({ shoulder, elbow, wrist, fingers, side });
    }

    /* ---- animation ------------------------------------------------------- */

    /*
      THE DESK POSE IS SOLVED, NOT DIALLED IN.

      `reachPitch` is two-link IK in the sagittal plane (see `figures.ts`), and
      it is used here because the cast has eight different arm lengths. A pair of
      hand-tuned angles is correct for one figure and puts the next one's palms
      either through the desk or a hand's width above it, and both read as broken
      without a viewer being able to say why.

      The shoulder is at `shoulderY - 0.012h` in body space with z = 0, so the
      target is expressed relative to that. The rig's rotations are NEGATIVE
      forward, hence the signs below.
    */
    const pose = options.pose ?? 'hang';
    const handTargetY = options.handY ?? (P.waistY + 0.10 * spec.height);
    const handTargetZ = options.handZ ?? (P.chestDepth * 1.5);
    const shoulderPivotY = P.shoulderY - 0.012 * spec.height;
    const solved = reachPitch(
        handTargetY - shoulderPivotY,
        handTargetZ,
        P.upperArm,
        // The hand hangs off the end of the forearm, so the segment that has to
        // reach the desk is the forearm PLUS most of the hand.
        P.foreArm + P.handLength * 0.34,
    );
    const restShoulder = 0.055;
    const restElbow = pose === 'desk' ? -solved.elbow : -0.30;
    const restShoulderPitch = pose === 'desk' ? -solved.shoulder : -0.05;
    /*
      THE WRIST ANGLE IS SOLVED FROM THE ARM, NOT PICKED.

      The old hand carried a flat `rotation.x = 0.22`, which is a number that is
      correct for whatever arm angle happened to be in front of whoever chose it.
      Now that there are fingers, being wrong about it is much more visible: a
      hand at the wrong wrist angle on a desk either drives its fingertips
      through the surface or holds them a centimetre above it, and both read as
      the hand not being on the desk at all.

      The wrist inherits the shoulder's and the elbow's pitch, so laying the palm
      flat means cancelling their sum and adding a quarter turn. Less the small
      break a real wrist has when a hand rests on a surface -- fully flat reads
      as a hand pressed down rather than resting.
    */
    const restWrist = pose === 'desk'
        ? -(Math.PI / 2 - 0.20) - (restShoulderPitch + restElbow)
        : 0.12;
    /*
      AND THE FINGERS STRAIGHTEN ON A DESK.

      `FINGERS` carries the resting curl of a relaxed hand, which is what a hand
      hanging at somebody's side does -- a third of a radian at the knuckle. A
      hand resting ON something is nearly flat, and at full curl the fingertips
      would be driven through the desk. Scaling the table rather than holding two
      tables is what keeps one source for the proportions.
    */
    const deskCurl = pose === 'desk' ? 0.30 : 1;
    const forward = new B.Vector3(0, 0, 1);

    function update(state: FigureState): void {
        const t = state.time;
        const m = state.motion;
        const energy = state.energy;
        const s = sway(t, spec.phase);
        const br = breath(t, spec.phase);

        // Breathing lifts the chest and the shoulders — the shoulders matter
        // more, because they are on the silhouette and the chest is not.
        torso.scaling.x = 1 + 0.014 * br * m;
        torso.scaling.z = (P.chestDepth / P.shoulderHalfWidth) * (1 + 0.022 * br * m);
        // The rig's own node, never the caller's. See the note by `body`.
        body.position.x = s.lean * m;
        /*
          A twist as well as a drift. Nobody sits square to a camera for ninety
          seconds, and unlike the lateral drift this one turns the SILHOUETTE --
          the shoulder line, the lapels and the arms all move together, which is
          a great deal more legible at tile size than a centimetre of sideways
          shift. On the rig's node for the same reason the lean is: the caller
          owns `root.rotation.y` and the studio spends it turning each anchor to
          face the lens.
        */
        body.rotation.y = torsoTwist(t, spec.phase) * m;
        /*
          A speaker leans in. Two centimetres, on the rig's node for the same
          reason the lean is — and it is the only whole-body cue there is that
          somebody is addressing you rather than sitting in front of you.
        */
        body.position.z = 0.020 * gesture(t, spec.phase, energy, state.since) * m;

        // Head. Emphasis is ADDED to the drift rather than replacing it, so a
        // speaking figure still moves like a person between the nods.
        let yaw = s.headYaw * m;
        /*
          Three things land on the pitch and they are all additive: the idle
          drift, the nod on a stressed word while SPEAKING, and the
          acknowledgement nod while LISTENING. The last is the one that makes a
          room read as a conversation rather than as several figures each
          animating alone -- see `listenNod`, and note that it is driven by
          `attention` and not by `energy`, so it is silent for whoever is talking.
        */
        const attention = state.attention ?? 0;
        let pitch = s.headPitch * m
            + headEmphasis(t, spec.phase, energy) * m
            + listenNod(t, spec.phase, attention) * m;
        // And the roll gets the tilt that goes with emphasis. A head that only
        // pitches is a metronome; at tile framing the tilt is the more legible
        // of the two, because it moves the head against the shoulders rather
        // than along the line of sight.
        const roll = s.headRoll * m + headRollEmphasis(t, spec.phase, energy) * m;
        /** What the eyes have to make up after the head has turned. */
        let eyeYaw = 0;
        let eyePitch = 0;

        if (state.lookAt) {
            /*
              ============================================================
              THE TARGET IS BROUGHT INTO THE HEAD'S OWN SPACE FIRST, AND IT WAS
              NOT — WHICH IS WHY NOBODY LOOKED AT THE CAMERA
              ============================================================

              This used to take the target's WORLD direction, `atan2(dx, dz)`
              over world deltas, and write it straight into
              `headPivot.rotation.y`. Those are two different frames. Every
              caller turns the whole person: the meeting rotates each pod by
              +-0.16 rad so a seat reads as somebody at a table, and the studio
              rotates each anchor by `PI +- 0.19` because they face back down the
              lens. A local rotation applied as though it were a world one is
              off by exactly that parent rotation.

              What it looked like:

                * the MEETING — every camera sits dead in front of its own pod,
                  so the world angle to it is ~0. The head therefore added
                  nothing, and each figure was left facing 9 degrees off camera
                  for the whole session. Reported as "members in the meeting not
                  look to camera".
                * the STUDIO — worse, because the parent rotation is PI. The male
                  anchor's world angle to the camera is -2.85 rad, which the
                  clamp turned into -0.65 and the damping into -0.49; the correct
                  LOCAL yaw is about +0.11. So he was turned 34 degrees the wrong
                  way, and the female anchor symmetrically. Reported as "the 2
                  Anchors not looks to camera".

              Nothing throws, both heads move plausibly, and the error is
              invisible in the source unless you happen to be thinking about
              which frame `rotation` is in. The fix is one matrix inverse: bring
              the world target into the pivot's PARENT space, where the pivot's
              own `position` and `rotation` live, and measure the angle there.
            */
            const parent = headPivot.parent;
            let local = state.lookAt;
            if (parent) {
                // `computeWorldMatrix` rather than the cached one: the caller may
                // have moved the figure this same frame, and a stale matrix aims
                // the head at where the person used to be.
                const inverse = B.Matrix.Invert(parent.computeWorldMatrix(true));
                local = B.Vector3.TransformCoordinates(state.lookAt, inverse);
            }
            const dx = local.x - headPivot.position.x;
            const dy = local.y - headPivot.position.y;
            const dz = local.z - headPivot.position.z;
            const flat = Math.sqrt(dx * dx + dz * dz) || 1e-3;
            const want = Math.atan2(dx, dz);
            /*
              Aim MOST of the way, not part of it.

              0.9 rather than 0.75, and the clamp opens to +-0.9 rad. A person
              reading to camera looks AT it; the damping is there so the eyes are
              not welded to the lens, and at 0.75 of a clamped angle the residual
              was a permanent few degrees of aversion — which is precisely the
              thing "not looking at the camera" describes, arriving from a second
              direction. The idle sway is still added on top, so it never reads
              as a locked stare.
            */
            const headYaw = Math.max(-0.9, Math.min(0.9, want)) * 0.9;
            const headPitch = Math.max(-0.30, Math.min(0.30, -Math.atan2(dy, flat))) * 0.7;
            yaw += headYaw;
            pitch += headPitch;

            /*
              ============================================================
              THE EYES CARRY WHAT THE HEAD DOES NOT
              ============================================================

              The head aims 90% of the way and then stops, because a head that
              turns fully to a target snaps and nobody looks at anything that
              squarely. The residual few degrees are exactly what a real person
              covers with their EYES, and until now nothing did — so a figure
              looking "at the camera" was looking at a point a little to one side
              of it with a fixed stare, which is a very specific kind of wrong: it
              reads as somebody looking past you.

              It is the cheapest realism there is. Two rotations on two nodes,
              clamped hard, because an eye has about 35 degrees of travel before
              the sclera on the far side becomes visible and the figure looks
              deranged rather than attentive.
            */
            eyeYaw = Math.max(-0.30, Math.min(0.30, want - headYaw));
            eyePitch = Math.max(-0.16, Math.min(0.16,
                -Math.atan2(dy, flat) - headPitch));
        } else {
            eyeYaw = 0;
            eyePitch = 0;
        }

        headPivot.rotation.set(pitch, yaw, roll);

        /*
          ============================================================
          AND THE EYES NEVER HOLD STILL
          ============================================================

          The aim above is what stopped the cast looking past the viewer. What it
          does not do is anything at all when `lookAt` is null, and it holds a
          FIXED angle when it is not -- so a figure was either staring straight
          ahead or staring at the lens, for as long as the shot lasted. A gaze
          that does not move is read as dead or as hostile; it is the last thing
          on a face that gives away a rendering.

          `saccade` adds the ballistic drift of a real fixation: a jump of a
          degree or two every few hundred milliseconds. Both eyes get the SAME
          offset, because both eyes of one person move together -- a per-eye
          offset is a squint, and the amount of squint that reads as an eye
          condition is very small indeed.
        */
        const flick = saccade(t, spec.phase);
        for (const socket of sockets) {
            // The resting convergence stays: it is what stops two parallel eyes
            // reading as a thousand-yard stare, and it is additive to the aim.
            socket.node.rotation.set(
                eyePitch + flick.pitch * m,
                -socket.side * 0.055 + eyeYaw + flick.yaw * m,
                0,
            );
        }

        // Blinking. The lids rotate; nothing scales, because a scaled lid
        // slides off the curve of the eyeball and shows white at the corners.
        /*
          Blinking. The upper lid rides down over the eyeball and the lower one
          comes up about a seventh as far, which is the ratio a real blink has.

          The travel is what makes it close COMPLETELY: at rest the lid's lower
          edge is 0.40 eye-radii above centre and the lower lid's upper edge is
          0.45 below, so a full close has to cover 2.4 radii. Anything less
          leaves a sliver of white showing at the peak of every blink, which
          from a chair reads as somebody staring rather than blinking.
        */
        const shut = blink(t, spec.phase);
        for (const lid of lids) {
            const y = eyeR * (1.26 - shut * 2.44);
            lid.upper.position.y = y;
            lid.lower.position.y = eyeR * (-1.02 + shut * 0.18);
            // The lash rides the lid margin. It is a sibling, so it has to be
            // moved rather than carried — see where it is built.
            lid.lash.position.set(0, y - eyeR * 0.78, eyeR * 0.86);
        }

        // Brows.
        const lift = browRaise(t, spec.phase, energy);
        brows.forEach((pivot, i) => {
            const side = i === 0 ? -1 : 1;
            // From the brow's OWN resting height on the ridge, not from a
            // second guess at where that is.
            pivot.position.y = (browRest[i] as number) + R * 0.048 * lift * m;
            pivot.rotation.z = -side * (0.05 * lift);
        });

        // Mouth. The jaw hinges, the lips widen, and the cavity opens with it —
        // three things on one number, which is what stops it reading as a flap.
        const open = jawOpen(t, spec.phase, energy);
        const spread = lipSpread(t, spec.phase, energy);
        /*
          0.42 rad of travel, not 0.30 — twenty-four degrees at full open.

          The other half of "the mouth does not move". A jaw is the one part of
          this rig whose whole job is to be seen from across a room, and it was
          geared for a close-up: at the size these figures render, the difference
          between a shut mouth and a five-degree one is nothing.

          The cavity opens further with it, and the upper lip thins more — a
          mouth that opens without its top lip stretching reads as a hinge.
        */
        jaw.rotation.x = open * 0.42;
        /*
          A LISTENING MOUTH IS NOT A STILL MOUTH.

          `jawOpen` returns exactly 0 when silent -- deliberately, because
          "almost closed" reads as chewing -- and `lipSpread` returns a constant,
          so a figure who was not speaking held one fixed expression for the
          whole time somebody else was. That stillness is a good part of what a
          viewer reads as "that one is not really here", and it is most obvious
          in the meeting, where five of the six seats are silent at any moment.

          `mouthPress` is a slow lip-press with an occasional swallow in it, and
          it returns 0 while speaking so the speech shapes keep sole ownership of
          the mouth. Two things driving one lip is a flutter.
        */
        const press = mouthPress(t, spec.phase, energy) * m;
        lowerLip.scaling.x = R * (0.245 + 0.055 * spread);
        upperLip.scaling.x = R * (0.255 + 0.050 * spread);
        upperLip.scaling.y = R * (0.058 - 0.022 * open + 0.010 * press);
        // The press is almost entirely the LOWER lip rolling up and in, which is
        // what makes it read as a press rather than as a pout.
        lowerLip.scaling.y = R * (0.062 - 0.016 * press);
        lowerLip.position.y = lowerLipRestY + R * 0.014 * press;
        mouthHole.scaling.y = R * (0.045 + 0.42 * open);
        mouthHole.scaling.x = R * (0.195 + 0.065 * spread);
        mouthHole.position.y = mouthY - R * 0.13 * open;

        // Arms. At rest they hang with a slight bend; speaking lifts and opens
        // them, and `since` ramps that in so nobody snaps into a pose.
        const g = gesture(t, spec.phase, energy, state.since);
        /*
          A figure whose hands are on a desk does not wave them about.

          `gesture` swings the whole arm by up to a radian, which is right for
          somebody standing and talking and wrong for an anchor holding a script:
          it would lift both hands off the desk on every stressed word and put
          them back through it afterwards. What a presenter's hands actually do
          is move a few degrees, so the gesture is scaled right down and the rest
          pose carries.
        */
        const swing = pose === 'desk' ? g * 0.22 : g;
        for (const arm of arms) {
            const beat = Math.sin((t + spec.phase * 2.2) * 2.3 + (arm.side > 0 ? 0 : 0.9));
            arm.shoulder.rotation.z = -arm.side * (restShoulder + 0.30 * swing);
            arm.shoulder.rotation.x = restShoulderPitch - 0.42 * swing + 0.10 * swing * beat;
            arm.elbow.rotation.x = restElbow - 0.85 * swing + 0.22 * swing * beat;
            arm.shoulder.position.y = P.shoulderY - 0.012 * spec.height + 0.004 * br * m;
            /*
              The wrist follows the arm rather than being carried by it. Without
              this the hand keeps the angle solved for the REST pose while the
              forearm swings under it, so on a gesture the palm ends up facing
              the ceiling -- which is not a subtle fault, it is a hand rotating
              independently of the arm it is on.
            */
            arm.wrist.rotation.x = restWrist + 0.55 * swing * (0.5 + 0.5 * beat);
            /*
              And the fingers flex, one at a time and by under two degrees.

              This is why the hand is seven meshes rather than one merged mesh:
              the two anchors' hands are in shot, near the camera and perfectly
              lit, under a face that breathes and blinks. Still hands under a
              living face read as the hands being a separate object -- which,
              until they had knuckle nodes, they were.
            */
            for (const finger of arm.fingers) {
                finger.node.rotation.x = finger.spec.curl * deskCurl
                    + fingerCurl(t, spec.phase, finger.spec.index, energy) * m;
            }
        }

        // Silence must be silent. `jawOpen` already returns exactly 0, and this
        // is the belt to its braces: a mouth left a millimetre open reads as
        // chewing from any distance.
        if (!(energy > 0)) {
            jaw.rotation.x = 0;
            mouthHole.scaling.y = R * 0.040;
        }

        void forward;
        void clamp01;
    }

    // One pass so the first painted frame is a posed figure rather than a
    // T-pose with its eyes shut.
    update({ time: 0, energy: 0, since: 0, motion: 1, lookAt: null });

    return {
        root,
        headHeight: P.headY,
        proportions: P,
        meshes,
        handRest: pose === 'desk' ? { y: handTargetY, z: handTargetZ } : null,
        update,
        dispose() {
            for (const mesh of meshes) mesh.dispose(false, true);
            root.dispose();
        },
    };
}
