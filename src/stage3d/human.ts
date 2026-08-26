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
    lipSpread, proportionsFor, smooth, sway,
    type FigureSpec, type Proportions,
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
    const noseWidth = (male ? 0.17 : 0.155) + 0.17 * smooth(0.26, -0.14, v);
    const noseProfile = (0.32 + 0.68 * ridge(v, -0.06, 0.26)) * noseSpan;
    const nose = noseProfile * ridge(u, 0, noseWidth) * smooth(0.34, 0.80, w);
    w += nose * (male ? 0.215 : 0.190);
    // The alae flare either side of the tip.
    for (const side of [-1, 1]) {
        const ala = blob(u - side * 0.105, v + 0.135, w - 0.86, 0.135);
        w += ala * 0.055;
        u += side * ala * 0.030;
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
    for (let i = 0; i < positions.length; i += 3) {
        // `getVerticesData` answers `number[] | Float32Array`, and an indexed
        // read of the former is `number | undefined` under this project's
        // strictness. The buffer is a multiple of three by construction.
        const [x, y, z] = sculptHeadVertex(
            positions[i] as number, positions[i + 1] as number, positions[i + 2] as number,
            radius, male, jawWidth);
        positions[i] = x;
        positions[i + 1] = y;
        positions[i + 2] = z;
    }
    mesh.updateVerticesData(B.VertexBuffer.PositionKind, positions, true, false);
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

export interface FigureRig {
    /** Everything, so the caller can place and rotate the whole person. */
    root: TransformNode;
    /** Head centre in LOCAL space, for aiming a camera at the eyes. */
    headHeight: number;
    /** Proportions, so a stage can put a desk at the right height. */
    proportions: Proportions;
    /** Every mesh, for a shadow generator's caster list. */
    meshes: Mesh[];
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
    */
    const hairMat = surface(B, scene, `${spec.id}-hair`, spec.hair, { roughness: 0.62 });
    hairMat.metallicF0Factor = 0.22;
    const jacketMat = surface(B, scene, `${spec.id}-jacket`, spec.outfit.jacket, { roughness: 0.84 });
    const shirtMat = surface(B, scene, `${spec.id}-shirt`, spec.outfit.shirt, { roughness: 0.72 });
    const accentMat = surface(B, scene, `${spec.id}-accent`, spec.outfit.accent, { roughness: 0.56 });
    /*
      Almost white, and glossy. The visible band of sclera is a few millimetres
      of a 200 mm head, so it is only ever going to read by CONTRAST against the
      skin around it — a mid-tone eyeball on a light-skinned face disappears
      entirely, which is what the first pass looked like.
    */
    const scleraMat = surface(B, scene, `${spec.id}-sclera`, '#f7f6f4', { roughness: 0.12, flat: true });
    const irisMat = surface(B, scene, `${spec.id}-iris`, spec.eye, { roughness: 0.10, flat: true });
    const pupilMat = surface(B, scene, `${spec.id}-pupil`, '#08060a', { roughness: 0.06, flat: true });
    const lipMat = surface(B, scene, `${spec.id}-lip`, male ? '#a3675a' : '#b8656a', { roughness: 0.40 });
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
    const shoulderTop = P.shoulderY + 0.055 * spec.height;
    const torsoShape = [
        profile(0.001, P.hipY - 0.02 * spec.height),
        profile(P.waistHalfWidth * 1.08, P.hipY),
        profile(P.waistHalfWidth * 0.95, P.waistY),
        profile(P.waistHalfWidth + (P.shoulderHalfWidth - P.waistHalfWidth) * 0.58,
            P.waistY + (P.shoulderY - P.waistY) * 0.48),
        /*
          The shoulder line is FLAT, then it turns up into the neck.

          Three points across the top rather than one, because a lathe whose
          profile runs straight from the widest point to the neck is a cone, and
          a cone is what made the first render read as a pot with a spout rather
          than as somebody in a jacket. Real shoulders are almost level from the
          deltoid to the base of the neck and then rise steeply.
        */
        profile(P.shoulderHalfWidth * 1.00, P.shoulderY - 0.030 * spec.height),
        profile(P.shoulderHalfWidth * 0.96, P.shoulderY + 0.004 * spec.height),
        profile(P.shoulderHalfWidth * 0.76, P.shoulderY + 0.022 * spec.height),
        profile(P.shoulderHalfWidth * 0.44, P.shoulderY + 0.040 * spec.height),
        profile(P.neckRadius * 1.34, shoulderTop),
        profile(P.neckRadius * 1.05, shoulderTop + 0.010 * spec.height),
    ];

    const torso = track(B.CreateLathe(`${spec.id}-torso`, {
        shape: torsoShape,
        tessellation: Math.round(30 * detail) + 8,
        closed: true,
        cap: 2, // CAP_END — the shoulders; the hip end is never seen.
    }, scene));
    torso.scaling.z = P.chestDepth / P.shoulderHalfWidth;
    torso.material = jacketMat;
    torso.parent = body;

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
      WHERE THE FRONT OF THE CHEST ACTUALLY IS, computed rather than guessed.

      The torso is a lathe whose radius varies with height and which is then
      SCALED on Z, so the depth of its front surface is neither `chestDepth` nor
      any fixed fraction of it. Placed at 0.66 of `chestDepth` — which looked
      like a sensible margin — the bib and both lapels ended up a centimetre and
      a half INSIDE the jacket and nothing on the chest was visible at all. The
      figure rendered as a plain coloured torso and it looked like the clothing
      code had not run.
    */
    const chestRadius = P.waistHalfWidth
        + (P.shoulderHalfWidth - P.waistHalfWidth) * 0.58;
    const chestFront = chestRadius * (P.chestDepth / P.shoulderHalfWidth);

    const bib = track(B.CreateSphere(`${spec.id}-bib`, {
        diameter: 1, segments: Math.round(16 * detail) + 6,
    }, scene));
    bib.scaling.set(P.shoulderHalfWidth * 0.56, (chestTop - chestY) * 0.82, chestFront * 0.5);
    bib.position.set(0, (chestTop + chestY) / 2, chestFront * 0.86);
    bib.material = shirtMat;
    bib.parent = body;

    /* A lighter shade of the jacket: a real lapel is the same cloth turned
       over, so it catches the light differently, and that difference is most of
       what makes it read as a lapel rather than as a stripe. */
    const lapelMat = surface(B, scene, `${spec.id}-lapel`, spec.outfit.jacket, { roughness: 0.66 });
    lapelMat.albedoColor = lapelMat.albedoColor.scale(1.30);
    for (const side of [-1, 1]) {
        const lapel = track(B.CreateBox(`${spec.id}-lapel${side}`, {
            width: 0.050 * spec.height,
            height: (chestTop - chestY) * 1.10,
            depth: 0.024 * spec.height,
        }, scene));
        lapel.material = lapelMat;
        lapel.rotation.z = -side * 0.30;
        lapel.position.set(
            side * 0.030 * spec.height,
            (chestTop + chestY) / 2,
            chestFront * 0.97,
        );
        lapel.parent = body;
    }

    // Collar: a short flared lathe around the neck, in shirt colour.
    const collar = track(B.CreateLathe(`${spec.id}-collar`, {
        /* Deliberately shallow. At 1.55x the neck radius over six centimetres
           it read as a white ring somebody had been fitted with rather than as a
           shirt collar, which was the most doll-like thing on the figure. */
        shape: [
            new B.Vector3(P.neckRadius * 1.10, P.neckY - 0.052 * spec.height, 0),
            new B.Vector3(P.neckRadius * 1.30, P.neckY - 0.030 * spec.height, 0),
            new B.Vector3(P.neckRadius * 1.05, P.neckY - 0.014 * spec.height, 0),
        ],
        tessellation: Math.round(18 * detail) + 6,
        closed: true,
    }, scene));
    collar.material = shirtMat;
    collar.parent = body;

    /*
      The one saturated thing a person carries, and it goes on the BIB.

      Both versions of this were buried. The tie was a lathe starting at
      `neckY - 0.055h`, which is below the shoulder line and therefore inside
      the torso; the scarf was a torus around the neck at a height where the
      trapezius has already reached full width, so it was inside that too. What
      renders in both cases is nothing at all, and the figure comes out in one
      flat colour with no accent anywhere — which reads as an unfinished model
      rather than as a placement mistake.

      Anchored to `chestFront`, the same computed depth the bib and the lapels
      use, so it cannot sink again.
    */
    if (male) {
        const tie = track(B.CreateLathe(`${spec.id}-tie`, {
            shape: [
                new B.Vector3(0.008 * spec.height, chestTop - 0.004 * spec.height, 0),
                new B.Vector3(0.017 * spec.height, chestTop - 0.028 * spec.height, 0),
                new B.Vector3(0.022 * spec.height, chestY + 0.030 * spec.height, 0),
                new B.Vector3(0.004 * spec.height, chestY, 0),
            ],
            tessellation: 10,
            closed: true,
        }, scene));
        tie.material = accentMat;
        tie.scaling.z = 0.40;
        tie.position.z = chestFront * 0.98;
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
        pendant.position.set(0, chestTop - 0.030 * spec.height, chestFront * 1.02);
        pendant.parent = body;

        for (const side of [-1, 1]) {
            const chain = track(B.CreateBox(`${spec.id}-chain${side}`, {
                width: 0.0035 * spec.height,
                height: 0.036 * spec.height,
                depth: 0.0035 * spec.height,
            }, scene));
            chain.material = accentMat;
            chain.rotation.z = side * 0.55;
            chain.position.set(
                side * 0.011 * spec.height,
                chestTop - 0.012 * spec.height,
                chestFront * 1.0,
            );
            chain.parent = body;
        }
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
        tessellation: Math.round(18 * detail) + 8,
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
    for (const side of [-1, 1]) {
        const socket = new B.TransformNode(`${spec.id}-eye${side}`, scene);
        socket.position.set(side * eyeX, eyeY, eyeZ);
        // Eyes converge very slightly, as they do on anything nearer than
        // infinity — parallel eyes are a thousand-yard stare.
        socket.rotation.y = -side * 0.055;
        socket.parent = headGroup;

        const ball = track(B.CreateSphere(`${spec.id}-ball${side}`, {
            diameter: eyeR * 2, segments: Math.round(16 * detail) + 6,
        }, scene));
        ball.material = scleraMat;
        ball.parent = socket;

        const iris = track(B.CreateSphere(`${spec.id}-iris${side}`, {
            diameter: eyeR * 1.16, segments: Math.round(16 * detail) + 6,
        }, scene));
        iris.material = irisMat;
        iris.scaling.z = 0.38;
        iris.position.z = eyeR * 0.82;
        iris.parent = socket;

        const pupil = track(B.CreateSphere(`${spec.id}-pupil${side}`, {
            diameter: eyeR * 0.56, segments: 10,
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
        const lash = track(B.CreateBox(`${spec.id}-lash${side}`, {
            width: eyeR * 1.95, height: eyeR * (male ? 0.17 : 0.28), depth: eyeR * 0.7,
        }, scene));
        lash.material = hairMat;
        lash.rotation.x = -0.30;
        lash.parent = socket;

        lids.push({ upper, lower, lash });
    }

    /* ---- brows ---------------------------------------------------------- */
    const brows: Mesh[] = [];
    for (const side of [-1, 1]) {
        const brow = track(B.CreateSphere(`${spec.id}-brow${side}`, {
            diameter: 1, segments: Math.round(12 * detail) + 4,
        }, scene));
        brow.scaling.set(R * 0.33, R * (male ? 0.062 : 0.048), R * 0.10);
        brow.material = hairMat;
        brow.position.set(side * eyeX * 1.05, eyeY + R * 0.190, eyeZ * 1.02);
        // Tilted outward and down, which is what stops two brows reading as a
        // pair of drawn-on lines.
        brow.rotation.z = -side * 0.16;
        brow.rotation.x = -0.20;
        brow.parent = headGroup;
        brows.push(brow);
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
        diameter: 1, segments: Math.round(14 * detail) + 4,
    }, scene));
    /* A mouth is about a THIRD of the width of a face. At 0.345 of the head
       radius each lip was 0.69 R across against a 1.4 R face, i.e. half of it,
       and a mouth that wide reads as a caricature however well it moves. */
    upperLip.scaling.set(R * 0.255, R * 0.062, R * 0.098);
    upperLip.material = lipMat;
    upperLip.position.set(0, mouthY + R * 0.052, mouthZ);
    upperLip.parent = headGroup;

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
    const hairShellSlice: Record<string, number> = {
        crop: 0.60, fade: 0.55, wave: 0.60, bob: 0.66, long: 0.64, bun: 0.60,
    };
    const hairThick: Record<string, number> = {
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
            for (let i = 0; i < positions.length; i += 3) {
                const ux = positions[i] as number;
                const uy = positions[i + 1] as number;
                const uz = positions[i + 2] as number;
                const [x, y, z] = sculptHeadVertex(ux, uy, uz, R, male, spec.build * 0.5 + 0.75);
                // The hairline: hair is pulled BACK over the forehead rather
                // than simply stopping, or the cap reads as a swimming hat.
                const front = smooth(0.30, 0.95, uz) * smooth(0.55, 0.08, uy);
                positions[i] = x * grow;
                positions[i + 1] = y * grow + R * 0.02 * (1 - front);
                positions[i + 2] = z * grow - R * 0.16 * front;
            }
            shell.updateVerticesData(B.VertexBuffer.PositionKind, positions, true, false);
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
        const quiff = track(B.CreateSphere(`${spec.id}-quiff`, {
            diameter: 1, segments: Math.round(14 * detail) + 4,
        }, scene));
        quiff.scaling.set(R * 0.62, R * 0.30, R * 0.46);
        quiff.material = hairMat;
        quiff.position.set(0, head.position.y + R * 0.72, R * 0.34);
        quiff.rotation.x = -0.35;
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
            diameter: P.armRadius * 1.9, segments: Math.round(14 * detail) + 4,
        }, scene));
        deltoid.material = jacketMat;
        deltoid.scaling.set(0.92, 0.66, 0.95);
        deltoid.position.set(-side * P.armRadius * 0.18, -P.armRadius * 0.22, 0);
        deltoid.parent = shoulder;

        const upper = track(B.CreateCapsule(`${spec.id}-uarm${side}`, {
            height: P.upperArm, radius: P.armRadius * 0.92,
            tessellation: Math.round(12 * detail) + 5, subdivisions: 2,
        }, scene));
        upper.material = jacketMat;
        upper.position.y = -P.upperArm / 2;
        upper.parent = shoulder;

        const elbow = new B.TransformNode(`${spec.id}-el${side}`, scene);
        elbow.position.y = -P.upperArm;
        elbow.parent = shoulder;

        const fore = track(B.CreateCapsule(`${spec.id}-farm${side}`, {
            height: P.foreArm, radius: P.armRadius * 0.76,
            tessellation: Math.round(12 * detail) + 5, subdivisions: 2,
        }, scene));
        fore.material = jacketMat;
        fore.position.y = -P.foreArm / 2;
        fore.parent = elbow;

        const cuff = track(B.CreateCylinder(`${spec.id}-cuff${side}`, {
            height: P.foreArm * 0.10,
            diameter: P.armRadius * 1.62,
            tessellation: Math.round(12 * detail) + 5,
        }, scene));
        cuff.material = shirtMat;
        cuff.position.y = -P.foreArm * 0.96;
        cuff.parent = elbow;

        const hand = track(B.CreateCapsule(`${spec.id}-hand${side}`, {
            height: P.handLength * 0.82, radius: P.armRadius * 0.66,
            tessellation: Math.round(10 * detail) + 5, subdivisions: 1,
        }, scene));
        hand.material = skin;
        hand.scaling.set(0.72, 1, 1.05);
        hand.position.y = -P.foreArm - P.handLength * 0.34;
        hand.rotation.x = 0.22;
        hand.parent = elbow;

        const thumb = track(B.CreateCapsule(`${spec.id}-thumb${side}`, {
            height: P.handLength * 0.36, radius: P.armRadius * 0.26,
            tessellation: 8, subdivisions: 1,
        }, scene));
        thumb.material = skin;
        thumb.position.set(-side * P.armRadius * 0.52, -P.foreArm - P.handLength * 0.26, P.armRadius * 0.20);
        thumb.rotation.z = side * 0.75;
        thumb.parent = elbow;

        arms.push({ shoulder, elbow, side });
    }

    /* ---- animation ------------------------------------------------------- */

    const restShoulder = 0.055;
    const restElbow = -0.30;
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

        if (state.lookAt) {
            // Aim, but only part of the way: a head that turns fully to a
            // target snaps, and nobody looks at anything that squarely.
            const here = headPivot.getAbsolutePosition();
            const dx = state.lookAt.x - here.x;
            const dz = state.lookAt.z - here.z;
            const dy = state.lookAt.y - here.y;
            const want = Math.atan2(dx, dz);
            const flat = Math.sqrt(dx * dx + dz * dz) || 1e-3;
            yaw += Math.max(-0.65, Math.min(0.65, want)) * 0.75;
            pitch += Math.max(-0.30, Math.min(0.30, -Math.atan2(dy, flat))) * 0.6;
        }

        headPivot.rotation.set(pitch, yaw, roll);

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
            const y = eyeR * (1.32 - shut * 2.54);
            lid.upper.position.y = y;
            lid.lower.position.y = eyeR * (-1.02 + shut * 0.20);
            // The lash rides the lid margin. It is a sibling, so it has to be
            // moved rather than carried — see where it is built.
            lid.lash.position.set(0, y - eyeR * 0.78, eyeR * 0.86);
        }

        // Brows.
        const lift = browRaise(t, spec.phase, energy);
        brows.forEach((brow, i) => {
            const side = i === 0 ? -1 : 1;
            brow.position.y = eyeY + R * (0.190 + 0.045 * lift * m);
            brow.rotation.z = -side * (0.16 - 0.06 * lift);
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
        for (const arm of arms) {
            const beat = Math.sin((t + spec.phase * 2.2) * 2.3 + (arm.side > 0 ? 0 : 0.9));
            arm.shoulder.rotation.z = -arm.side * (restShoulder + 0.30 * g);
            arm.shoulder.rotation.x = -0.05 - 0.42 * g + 0.10 * g * beat;
            arm.elbow.rotation.x = restElbow - 0.85 * g + 0.22 * g * beat;
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
        update,
        dispose() {
            for (const mesh of meshes) mesh.dispose(false, true);
            root.dispose();
        },
    };
}
