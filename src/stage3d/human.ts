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
    blink, breath, browRaise, clamp01, gesture, headEmphasis, jawOpen,
    lipSpread, proportionsFor, reachPitch, smooth, sway,
    type FigureSpec, type HairStyle, type Proportions,
} from './figures';

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
    const skinDark = surface(B, scene, `${spec.id}-skin2`, spec.skin, { roughness: 0.6 });
    skinDark.albedoColor = skinDark.albedoColor.scale(0.86);

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
      Wool is MATTE. At 0.84 the specular lobe is still broad enough to lay a
      soft sheen across the whole chest, which reads as satin — and a satin suit
      on a news anchor is one of the small wrongnesses that adds up to "not a
      real person". Real worsted is nearer 0.94, and its reflectance is lower
      than the dielectric default too.
    */
    const jacketMat = surface(B, scene, `${spec.id}-jacket`, spec.outfit.jacket, { roughness: 0.94 });
    jacketMat.metallicF0Factor = 0.30;
    /*
      Every shirt in the cast is a near-white (#e8eef5 and friends), and at the
      exposure a face needs that renders as blown-out paper — which is why the
      collar read as the brightest object in the tile. A real white shirt under
      studio light measures well under 100% too; the eye reads it as white by
      CONTEXT, not by luminance.
    */
    const shirtMat = surface(B, scene, `${spec.id}-shirt`, spec.outfit.shirt, { roughness: 0.86 });
    shirtMat.albedoColor = shirtMat.albedoColor.scale(0.80);
    /* And the collar is in the shadow of the jaw, always. A collar at the same
       albedo as the chest is the one that looks like a neck brace. */
    const collarMat = surface(B, scene, `${spec.id}-collar`, spec.outfit.shirt, { roughness: 0.8 });
    collarMat.albedoColor = collarMat.albedoColor.scale(0.62);
    const accentMat = surface(B, scene, `${spec.id}-accent`, spec.outfit.accent, { roughness: 0.56 });
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
    const lipMat = surface(B, scene, `${spec.id}-lip`, spec.skin, { roughness: 0.34 });
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
    yoke.scaling.z = (P.chestDepth * 0.94) / yokeRadius;
    yoke.position.set(0, P.shoulderY + 0.006 * spec.height, -P.chestDepth * 0.02);
    yoke.parent = body;

    /*
      THE SHIRT IS A BIB, NOT A SECOND TORSO.

      The first version built the shirt as the same lathe a few millimetres
      inside the jacket, so that it would "show only where the jacket is cut
      away". Nothing was cut away — the two surfaces are three millimetres apart
      over an area the size of a torso, so what showed was z-fighting: pale
      rectangles flickering across the chest wherever the depth buffer could not
      separate them. It read as a texturing fault on a plain colour.

      One flattened ellipsoid on the chest, entirely in front of the jacket, is
      all that is ever visible of a shirt worn under one.

      The V is then two LAPELS over it, and the V is what says "jacket". The
      first attempt made them arc-limited lathes, on the reasoning that the gap
      between two arcs is angular and therefore widens with the radius, like a
      real opening. It does — and placing them means knowing which direction the
      builder's `arc` opens in, which is a convention rather than a documented
      angle, so the two panels overlapped in the middle and rendered as a pair
      of bright plates across the chest. Two boxes splayed into a V are exact.
    */
    const chestTop = P.neckY - 0.030 * spec.height;
    const chestY = P.waistY + (P.shoulderY - P.waistY) * 0.52;

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
      ONE SURFACE REFERENCE FOR EVERYTHING ON THE CHEST
      ============================================================

      The tie was placed at `frontZAt(0, (tieTop + chestY) / 2)` and the bib at
      `frontZAt(0, bibY)` — two different heights on a torso whose radius varies
      with height, so two different depths. The tie's reference is the HIGHER of
      the two, where the trapezius has already begun to narrow, so it came out
      about a centimetre SHALLOWER than the bib: the shirt poked through the
      middle of the tie and rendered as a pale oval on it.

      It is a nice illustration of why `frontZAt` is a function and not a
      constant — and of the trap that goes with that: two pieces of clothing that
      have to be in front of each other must be measured at the SAME point, not
      each at its own.
    */
    const bibY = (chestTop + chestY) / 2;
    const chestSurface = frontZAt(0, bibY);
    /*
      THE BIB IS WHAT SHOWS EITHER SIDE OF A TIE, so it is a male garment.

      On a female figure there is no tie to show either side of, and every shape
      tried for it was wrong in the same way: a tall narrow patch was a pale
      stripe down the middle of the blazer, and a short wide one — the correction
      — rendered as a light SPHERE under the pendant, i.e. a second piece of
      jewellery. A closed blazer with a collar and a pendant is an ordinary look
      and needs no third element, so the women simply do not have one.
    */
    const bib = track(B.CreateSphere(`${spec.id}-bib`, {
        diameter: 1, segments: Math.round(24 * detail) + 8,
    }, scene));
    bib.isVisible = male;
    /* Narrower still on a female figure: with no tie down the middle, a wide
       bib is a pale vertical stripe on the chest. Narrow, it is a neckline. */
    /*
      A NECKLINE FOR THE WOMEN, NOT A STRIPE.

      Narrow and tall is right under a tie and wrong without one: at 0.26 of the
      shoulder width and 70% of the chest height it rendered as a pale vertical
      bar down the middle of the jacket. What shows at a blouse neckline is a
      short, comparatively WIDE patch — wider than it is tall — so the two axes
      swap round rather than both shrinking.
    */
    bib.scaling.set(P.shoulderHalfWidth * 0.32,
        (chestTop - chestY) * 0.92, 0.075 * spec.height);
    // Its front on the jacket's surface plus 6 mm, so a strip of shirt shows
    // between the lapels at every height rather than only at the middle.
    bib.position.set(0, bibY, chestSurface + 0.006 * spec.height
        - bib.scaling.z / 2);
    bib.material = shirtMat;
    bib.parent = body;

    /* A lighter shade of the jacket: a real lapel is the same cloth turned
       over, so it catches the light differently, and that difference is most of
       what makes it read as a lapel rather than as a stripe. */
    const lapelMat = surface(B, scene, `${spec.id}-lapel`, spec.outfit.jacket, { roughness: 0.66 });
    /* 1.12, not 1.22. A lapel is the same cloth turned over, so it catches a
       little more light — not a different colour. At 1.22 against the round
       torso the pair read as two raised lobes rather than as an edge, which on
       the female figures was actively unfortunate. */
    lapelMat.albedoColor = lapelMat.albedoColor.scale(1.07);
    lapelMat.metallicF0Factor = 0.34;
    /*
      ============================================================
      A LAPEL IS AN ELLIPSOID, NOT A BOX, AND THIS IS THE "SQUARES"
      ============================================================

      These were two `CreateBox`es 9 cm wide and 23 cm tall, splayed into a V and
      laid on the chest. At head-and-shoulders framing they are the two largest
      objects in the picture after the head, and a box has flat faces, straight
      edges and four hard corners each — so what the viewer got was two grey
      rectangles stuck to a person. It is the single most literal reading of "a
      lot of squares appear, this makes them ugly, like not real".

      A tapered ellipsoid has no edge anywhere: the silhouette is a curve, the
      shading rolls off, and the narrow end reads as the lapel notch closing
      toward the collar. Two of them, splayed and tilted forward, plus a small
      one at the top for the notch itself. Nothing here is a new mesh count
      problem — an ellipsoid at 18 segments is cheaper than the box's own bevel
      would have been.
    */
    for (const side of [-1, 1]) {
        const lapel = track(B.CreateSphere(`${spec.id}-lapel${side}`, {
            diameter: 1, segments: Math.round(18 * detail) + 6,
        }, scene));
        lapel.material = lapelMat;
        /*
          WIDE, LONG, AND THIN — a panel, not a tube.

          Three shapes have been tried here and the axis that matters is DEPTH. A
          box was two flat plates with corners on them. A narrow deep ellipsoid
          was a tube, and read as a blue tongue lying on the chest. What a lapel
          actually is, is a broad piece of cloth lying almost flat on the body
          with one raised edge — so it wants to be wide across, long down, and
          only a few millimetres proud of the surface.
        */
        /*
          A MAN'S NOTCH LAPEL AND A WOMAN'S SHAWL COLLAR ARE DIFFERENT SHAPES.

          They were the same object, and at 3.4 cm wide on a round torso the pair
          read as two lobes on the chest — which on the female figures was the
          worst reading available. A shawl collar is narrower, longer, set closer
          to the centre line and has no notch; a notch lapel is wider, stops
          higher, and steps outward where the collar meets it.
        */
        lapel.scaling.set(
            (male ? 0.026 : 0.019) * spec.height,
            (chestTop - chestY) * (male ? 1.04 : 1.18),
            0.008 * spec.height,
        );
        // Splayed away from the centre line and tipped forward, so the inner
        // edge lifts off the shirt the way a rolled lapel does.
        lapel.rotation.z = -side * (male ? 0.20 : 0.13);
        lapel.rotation.x = -0.06;
        const lapelX = side * (male ? 0.034 : 0.024) * spec.height;
        const lapelY = (chestTop + chestY) / 2 + 0.006 * spec.height;
        lapel.position.set(
            lapelX,
            lapelY,
            // On the surface at its OWN x, not at the centre line — the
            // cross-section is an ellipse and the difference is a centimetre.
            frontZAt(lapelX, lapelY) + 0.0015 * spec.height,
        );
        lapel.parent = body;

        /*
          The notch, and it has to OVERLAP the lapel rather than sit above it.

          As a separate ellipsoid clear of the lapel's top it read as a third
          bump — four nubs on a chest instead of two lapels. Overlapping and
          angled the other way, the two volumes union into one shape with a step
          in its outer edge, which is what a notch lapel is.

          Men only: a shawl collar is a continuous roll with no step in it, which
          is the whole difference between the two garments.
        */
        if (male) {
            const notch = track(B.CreateSphere(`${spec.id}-notch${side}`, {
                diameter: 1, segments: Math.round(14 * detail) + 5,
            }, scene));
            notch.material = lapelMat;
            notch.scaling.set(0.028 * spec.height, 0.012 * spec.height, 0.008 * spec.height);
            notch.rotation.z = side * 0.42;
            const notchX = side * 0.035 * spec.height;
            const notchY = chestTop - 0.026 * spec.height;
            notch.position.set(notchX, notchY,
                frontZAt(notchX, notchY) + 0.001 * spec.height);
            notch.parent = body;
        }
    }

    /*
      Collar: a short flared band around the neck, in shirt colour.

      Its HEIGHT is found rather than written down — see `clearsJacketAbove`. The
      old numbers put it at `neckY - 0.03h`, three centimetres below the top of
      the trapezius, so it has never once been visible: the figures have been
      wearing a jacket with no shirt showing at the throat, which is most of why
      they read as dressed in one piece of cloth.
    */
    /*
      A BAND, not a ruff.

      The first version that was actually visible went the other way and looked
      like a neck brace: 1.26x the neck radius, flared to 1.16x of that again,
      and 5.3 cm tall — all of it in the clear, because `clearsJacketAbove`
      places it above the trapezius and nothing was then covering its bottom
      edge. Against a dark jacket a white band that size is the brightest and
      largest thing in the tile.

      A real collar is close to the neck (a finger's width of ease), about 3 cm
      of visible band, and the lower half of it is behind the jaw from any camera
      in front of the subject. Hence: 1.12x, 2.0 cm, and started BELOW the
      clearance height so the jacket eats its bottom edge.
    */
    const collarRadius = P.neckRadius * 1.08;
    const collarBase = clearsJacketAbove(collarRadius) - 0.012 * spec.height;
    const collar = track(B.CreateLathe(`${spec.id}-collar`, {
        shape: [
            new B.Vector3(collarRadius, collarBase, 0),
            new B.Vector3(collarRadius * 1.05, collarBase + 0.007 * spec.height, 0),
            new B.Vector3(collarRadius * 1.09, collarBase + 0.014 * spec.height, 0),
            new B.Vector3(collarRadius * 1.00, collarBase + 0.019 * spec.height, 0),
            new B.Vector3(collarRadius * 0.93, collarBase + 0.021 * spec.height, 0),
        ],
        // Same reason as the torso: a five-point lathe at 24 segments is a ring
        // of visible facets right under the chin, where the eye already is.
        tessellation: Math.round(40 * detail) + 12,
        closed: true,
    }, scene));
    collar.material = collarMat;
    collar.parent = body;

    /*
      Two collar points, lying on the lapels.

      A collar with no points is a tube, and a tube around a neck is a cast. The
      points are what say "shirt" — and they are the reason the V between the
      lapels reads as an opening rather than as a gap between two objects.
    */
    for (const side of [-1, 1]) {
        const point = track(B.CreateSphere(`${spec.id}-collarpt${side}`, {
            diameter: 1, segments: Math.round(14 * detail) + 5,
        }, scene));
        point.material = collarMat;
        point.scaling.set(0.010 * spec.height, 0.019 * spec.height, 0.006 * spec.height);
        point.rotation.z = -side * 0.34;
        point.rotation.x = -0.26;
        const pointX = side * 0.017 * spec.height;
        const pointY = collarBase - 0.004 * spec.height;
        point.position.set(pointX, pointY,
            frontZAt(pointX, pointY) + 0.004 * spec.height);
        point.parent = body;
    }

    /*
      The one saturated thing a person carries, and it goes on the BIB.

      Both versions of this were buried. The tie was a lathe starting at
      `neckY - 0.055h`, which is below the shoulder line and therefore inside
      the torso; the scarf was a torus around the neck at a height where the
      trapezius has already reached full width, so it was inside that too. What
      renders in both cases is nothing at all, and the figure comes out in one
      flat colour with no accent anywhere — which reads as an unfinished model
      rather than as a placement mistake.

      Anchored to `chestSurface`, the same measured depth the bib uses, so it
      cannot sink again — and measured at the same HEIGHT, so it cannot come out
      behind the shirt either.
    */
    if (male) {
        /*
          A KNOT AND A BLADE, and the knot is what was missing.

          The old tie was one lathe from 0.8 cm at the throat to 2.2 cm at the
          chest and back to a point — a thin dark wedge, which at tile size is a
          smear and at head size reads as a crack in the shirt. A real tie is a
          fat trapezoid knot with a much narrower blade hanging out of it, and
          the knot is most of what the eye recognises, because it is the part
          with a specular highlight on it.
        */
        const knot = track(B.CreateSphere(`${spec.id}-knot`, {
            diameter: 1, segments: Math.round(16 * detail) + 6,
        }, scene));
        knot.material = accentMat;
        /* Flat, not round. A sphere at equal proportions is a bead, and a bead
           under a collar is the single most doll-like thing a figure can wear. */
        knot.scaling.set(0.021 * spec.height, 0.019 * spec.height, 0.0085 * spec.height);
        const knotY = collarBase - 0.012 * spec.height;
        knot.position.set(0, knotY, frontZAt(0, knotY) + 0.010 * spec.height);
        knot.parent = body;

        const tieTop = knotY - 0.014 * spec.height;
        const tie = track(B.CreateLathe(`${spec.id}-tie`, {
            shape: [
                new B.Vector3(0.009 * spec.height, tieTop, 0),
                new B.Vector3(0.013 * spec.height, tieTop - 0.024 * spec.height, 0),
                new B.Vector3(0.015 * spec.height, chestY + 0.022 * spec.height, 0),
                new B.Vector3(0.011 * spec.height, chestY - 0.006 * spec.height, 0),
                new B.Vector3(0.002 * spec.height, chestY - 0.024 * spec.height, 0),
            ],
            tessellation: Math.round(20 * detail) + 8,
            closed: true,
        }, scene));
        tie.material = accentMat;
        tie.scaling.z = 0.42;
        // The SAME reference the bib uses, plus enough to clear it — see the
        // note on `chestSurface`.
        tie.position.z = chestSurface + 0.014 * spec.height;
        tie.parent = body;
    } else {
        /* A pendant on a chain, rather than a scarf. A scarf has to wrap the
           neck, and the neck is where the trapezius is — anything there is
           swallowed. A pendant sits on the bib, where there is nothing to be
           swallowed by. */
        const pendant = track(B.CreateSphere(`${spec.id}-pendant`, {
            diameter: 0.016 * spec.height, segments: 12,
        }, scene));
        pendant.material = accentMat;
        pendant.scaling.z = 0.6;
        const pendantY = collarBase - 0.036 * spec.height;
        pendant.position.set(0, pendantY,
            frontZAt(0, pendantY) + 0.008 * spec.height);
        pendant.parent = body;

        /*
          NO CHAIN AT ALL, in the end, and it is the third attempt.

          Two straight capsules drew a large bright lambda across the chest. A
          torus is the right SHAPE for a necklace — it goes around a neck, which
          is what a necklace does — and at this scale it never cleared the collar
          band and the shawl collar in front of it, so it rendered as nothing at
          all while costing a mesh.

          What reads at 180 px is the pendant: one small saturated object at the
          neckline, which is the one accent a female figure carries. A chain that
          is invisible is not a chain, it is a draw call.
        */
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
        lower.scaling.set(eyeR * 2.55, eyeR * 1.20, eyeR * 1.95);
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
            mesh.material = hairMat;
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

    /* ---- arms ------------------------------------------------------------
       Shoulder and elbow are nodes; the geometry hangs off them. That is what
       lets `gesture()` swing a whole arm with two numbers instead of solving
       for a hand position. */
    const arms: { shoulder: TransformNode; elbow: TransformNode; side: number }[] = [];
    for (const side of [-1, 1]) {
        const shoulder = new B.TransformNode(`${spec.id}-sh${side}`, scene);
        shoulder.position.set(side * P.shoulderHalfWidth * 0.94, P.shoulderY - 0.012 * spec.height, 0);
        shoulder.parent = body;

        /*
          The deltoid rounds the corner between the shoulder line and the arm.
          It is deliberately smaller than it was: at 2.5x the arm radius it was
          a ball stuck on each side, which is the single thing that made the
          silhouette read as a toy. Flattened on Y as well, because the muscle
          is wider than it is tall.
        */
        /*
          The deltoid rounds the corner between the shoulder line and the arm,
          and it is easy to make it the thing that ruins the silhouette. At 2.5x
          the arm radius it was a ball stuck on each side and the figure read as
          a snowman; flattened and pulled inward it is a shoulder.
        */
        const deltoid = track(B.CreateSphere(`${spec.id}-delt${side}`, {
            diameter: P.armRadius * 1.9, segments: Math.round(20 * detail) + 6,
        }, scene));
        deltoid.material = jacketMat;
        /* Smaller and pulled further in than it was, because the yoke now
           carries the shoulder line. Two volumes both trying to be the shoulder
           is what put a visible bulge at each bottom corner of the tile. */
        deltoid.scaling.set(0.82, 0.58, 0.86);
        deltoid.position.set(-side * P.armRadius * 0.30, -P.armRadius * 0.26, 0);
        deltoid.parent = shoulder;

        const upper = track(B.CreateCapsule(`${spec.id}-uarm${side}`, {
            height: P.upperArm, radius: P.armRadius * 0.92,
            tessellation: Math.round(22 * detail) + 8, subdivisions: 3,
        }, scene));
        upper.material = jacketMat;
        upper.position.y = -P.upperArm / 2;
        upper.parent = shoulder;

        const elbow = new B.TransformNode(`${spec.id}-el${side}`, scene);
        elbow.position.y = -P.upperArm;
        elbow.parent = shoulder;

        const fore = track(B.CreateCapsule(`${spec.id}-farm${side}`, {
            height: P.foreArm, radius: P.armRadius * 0.76,
            tessellation: Math.round(22 * detail) + 8, subdivisions: 3,
        }, scene));
        fore.material = jacketMat;
        fore.position.y = -P.foreArm / 2;
        fore.parent = elbow;

        const cuff = track(B.CreateCylinder(`${spec.id}-cuff${side}`, {
            height: P.foreArm * 0.10,
            diameter: P.armRadius * 1.62,
            tessellation: Math.round(24 * detail) + 8,
        }, scene));
        cuff.material = shirtMat;
        cuff.position.y = -P.foreArm * 0.96;
        cuff.parent = elbow;

        const hand = track(B.CreateCapsule(`${spec.id}-hand${side}`, {
            height: P.handLength * 0.82, radius: P.armRadius * 0.66,
            tessellation: Math.round(18 * detail) + 7, subdivisions: 2,
        }, scene));
        hand.material = skin;
        hand.scaling.set(0.72, 1, 1.05);
        hand.position.y = -P.foreArm - P.handLength * 0.34;
        hand.rotation.x = 0.22;
        hand.parent = elbow;

        const thumb = track(B.CreateCapsule(`${spec.id}-thumb${side}`, {
            height: P.handLength * 0.36, radius: P.armRadius * 0.26,
            tessellation: 12, subdivisions: 1,
        }, scene));
        thumb.material = skin;
        thumb.position.set(-side * P.armRadius * 0.52, -P.foreArm - P.handLength * 0.26, P.armRadius * 0.20);
        thumb.rotation.z = side * 0.75;
        thumb.parent = elbow;

        arms.push({ shoulder, elbow, side });
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

        // Head. Emphasis is ADDED to the drift rather than replacing it, so a
        // speaking figure still moves like a person between the nods.
        let yaw = s.headYaw * m;
        let pitch = s.headPitch * m + headEmphasis(t, spec.phase, energy) * m;
        const roll = s.headRoll * m;
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

        for (const socket of sockets) {
            // The resting convergence stays: it is what stops two parallel eyes
            // reading as a thousand-yard stare, and it is additive to the aim.
            socket.node.rotation.set(eyePitch, -socket.side * 0.055 + eyeYaw, 0);
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
            lid.lower.position.y = eyeR * (-0.94 + shut * 0.18);
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
        jaw.rotation.x = open * 0.30;
        lowerLip.scaling.x = R * (0.245 + 0.045 * spread);
        upperLip.scaling.x = R * (0.255 + 0.042 * spread);
        upperLip.scaling.y = R * (0.062 - 0.014 * open);
        mouthHole.scaling.y = R * (0.045 + 0.30 * open);
        mouthHole.scaling.x = R * (0.195 + 0.055 * spread);
        mouthHole.position.y = mouthY - R * 0.10 * open;

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
        const swing = pose === 'desk' ? g * 0.12 : g;
        for (const arm of arms) {
            const beat = Math.sin((t + spec.phase * 2.2) * 2.3 + (arm.side > 0 ? 0 : 0.9));
            arm.shoulder.rotation.z = -arm.side * (restShoulder + 0.30 * swing);
            arm.shoulder.rotation.x = restShoulderPitch - 0.42 * swing + 0.10 * swing * beat;
            arm.elbow.rotation.x = restElbow - 0.85 * swing + 0.22 * swing * beat;
            arm.shoulder.position.y = P.shoulderY - 0.012 * spec.height + 0.004 * br * m;
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
