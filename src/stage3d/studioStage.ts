/**
 * The newscast shot: the camera, the two anchors, and what is on the wall.
 *
 * ============================================================
 * WHAT THIS REPLACES
 * ============================================================
 *
 * Ten image and video files — two anchor stills, four anchor loops, and four
 * plates of a "set" that were three photographs of three different rooms. Most
 * of `NewsStudio.vue` used to be the arithmetic of making those three
 * photographs look like one place: a scale-and-offset search to match each
 * listening plate to its speaking plate, a 26-pixel vertical lift of the female
 * pair against the male, two masked `backdrop-filter` strips to dissolve the
 * column joins, and a separately-photographed desk front laid across the bottom
 * because that was the only way to hide the seam where the eye rests.
 *
 * All of it was solving, in image space, a problem that does not exist in a
 * scene. There is one room here, the anchors are in it, and the desk is one
 * object. The joins cannot be visible because there are no joins.
 *
 * The other half is what a photograph could never do: the anchors are animated
 * against the audio actually playing (see `speechAudio.ts`), so a mouth opens
 * on the words rather than on a loop that wraps when it feels like it, and the
 * presenter who is not reading LOOKS AT the one who is.
 *
 * ============================================================
 * THE LAYOUT, WHICH IS FIXED BY THE BRIEF
 * ============================================================
 *
 *      screen LEFT            centre              screen RIGHT
 *      ليلى / Layla        the video wall          آدم / Adam
 *      (female anchor)      (3D, in the set)       (male anchor)
 *
 * Babylon is LEFT-handed, so with the camera at negative Z looking toward
 * positive Z, world +X is on the RIGHT of the picture. That is the one
 * convention worth knowing before moving anything: {@link RIGHT_X} is positive
 * and the male anchor gets it.
 *
 * The room itself is in `setPieces.ts`, and every dimension in it is derived
 * from the camera set up below.
 */

import type { Scene } from '@babylonjs/core/scene';
import type { Engine } from '@babylonjs/core/Engines/engine';

import type * as BJS from './babylon';
import { buildFigure, type FigureRig } from './human';
import { ANCHOR_FIGURES, scriptGlance, type FigureSpec } from './figures';
import { buildSet } from './setPieces';
import {
    ANCHOR_X, ANCHOR_Z, CAMERA_FOV, CAMERA_Y, CAMERA_Z, PLATE_X,
    DESK_TOP_Y, SCRIPT_X, SCRIPT_Y, SCRIPT_Z,
} from './layout';
import { loadBabylon, pickQuality, pixelRatio, reducedMotion } from './loader';

/** Screen right, in world X. See the header — Babylon is left-handed. */
export const RIGHT_X = 1;

export type StudioAnchor = 'male' | 'female';

/** Re-exported so a caller needs one import for the stage and its geometry. */
export { PLATE_X };

export interface StudioStage {
    /** Who is reading, and how loudly. `energy` drives the mouth. */
    setSpeaking(anchor: StudioAnchor | null, energy: number): void;
    /**
     * What is on the video wall.
     *
     * An empty `image` puts the station ident up. A picture that cannot be
     * loaded — see {@link WallSurface}, most news photographs cannot — becomes
     * a title card rather than a black rectangle.
     */
    setScreen(options: { image?: string; title?: string; kicker?: string; rtl?: boolean }): void;
    /** On air. Lights the tally. */
    setLive(live: boolean): void;
    resize(): void;
    dispose(): void;
}

/* ------------------------------------------------------------------ *
 * The video wall's picture
 * ------------------------------------------------------------------ */

/**
 * The thing the wall is showing, drawn into one canvas.
 *
 * ============================================================
 * WHY A NEWS PHOTOGRAPH USUALLY CANNOT GO ON IT
 * ============================================================
 *
 * Putting an image on a mesh means `texImage2D`, and a browser refuses to
 * upload a cross-origin image that arrived WITHOUT `Access-Control-Allow-Origin`
 * — it throws a `SecurityError` rather than rendering it. That is not something
 * this code can work around: an `<img>` can DISPLAY such a picture (which is
 * what the old flat wall did) and WebGL cannot SAMPLE it.
 *
 * Most newsroom CDNs do not send the header. So the wall tries, and when the
 * load fails it draws a TITLE CARD instead — the headline and the source, set
 * as a broadcast graphic. That is a real thing a gallery does when a picture
 * has not cleared, and it is strictly better than the alternatives: a blank
 * wall reads as broken, and keeping a DOM `<img>` floating over the canvas
 * would put a flat rectangle back in the middle of a 3D set.
 *
 * The ident is what is up between stories, for the same reason.
 */
class WallSurface {
    readonly texture: BJS.DynamicTexture;
    private ctx: CanvasRenderingContext2D;
    private readonly w = 1024;
    private readonly h = 576;
    /**
     * Bumped by every draw, so a picture that finishes loading after the story
     * has moved on is discarded rather than painted over the current one.
     */
    private token = 0;

    /*
      The renderer is a CONSTRUCTOR ARGUMENT and is not kept.

      Everything this class needs from Babylon is the one `DynamicTexture` it
      makes here; the rest is a 2D canvas context and the standard library. A
      parameter property (`private B`) would have been the shorter spelling and
      it is not available — `erasableSyntaxOnly` is on in this project, and a
      parameter property is the one piece of TypeScript syntax that emits code
      rather than being erased.
    */
    constructor(B: typeof BJS, scene: Scene) {
        this.texture = new B.DynamicTexture('wall', { width: this.w, height: this.h }, scene, true);
        this.ctx = this.texture.getContext() as unknown as CanvasRenderingContext2D;
        this.ident();
    }

    /**
     * Upload the canvas.
     *
     * `update()` and NOT `update(false)`. The argument is `invertY` and it
     * defaults to true, which is what a 2D canvas needs: WebGL's texture rows
     * run bottom-up and a canvas's run top-down. Passing `false` skips the
     * correction, so everything drawn at the bottom of the canvas appears at the
     * top of the mesh — and a line of capitals upside down reads as a MIRRORED
     * line rather than as an inverted one, which sends you looking for a `uScale`
     * that was never wrong. It cost two rebuilds to find.
     */
    private commit() { this.texture.update(); }

    private frame(): void {
        const { ctx, w, h } = this;
        const bg = ctx.createLinearGradient(0, 0, 0, h);
        bg.addColorStop(0, '#0b1730');
        bg.addColorStop(1, '#050a16');
        ctx.fillStyle = bg;
        ctx.fillRect(0, 0, w, h);
    }

    /** The station graphic. A globe's graticule, because it is world news. */
    ident(): void {
        this.token++;
        const { ctx, w, h } = this;
        this.frame();

        ctx.save();
        ctx.translate(w * 0.5, h * 0.46);
        ctx.strokeStyle = 'rgba(120, 170, 255, 0.28)';
        ctx.lineWidth = 2;
        const r = h * 0.32;
        // Parallels: ellipses that flatten toward the poles.
        for (let i = -3; i <= 3; i++) {
            const t = (i / 4) * (Math.PI / 2);
            ctx.beginPath();
            ctx.ellipse(0, r * Math.sin(t), r * Math.cos(t), r * Math.cos(t) * 0.17, 0, 0, Math.PI * 2);
            ctx.stroke();
        }
        // Meridians: ellipses that narrow toward the edge of the disc.
        for (let i = 0; i < 8; i++) {
            ctx.beginPath();
            ctx.ellipse(0, 0, r * Math.abs(Math.cos((i / 8) * Math.PI)), r, 0, 0, Math.PI * 2);
            ctx.stroke();
        }
        ctx.beginPath();
        ctx.arc(0, 0, r, 0, Math.PI * 2);
        ctx.strokeStyle = 'rgba(150, 200, 255, 0.5)';
        ctx.lineWidth = 3;
        ctx.stroke();
        ctx.restore();

        ctx.fillStyle = 'rgba(232, 240, 255, 0.9)';
        ctx.font = `600 ${Math.round(h * 0.085)}px system-ui, sans-serif`;
        ctx.textAlign = 'center';
        ctx.fillText('SELF STUDY NEWS', w * 0.5, h * 0.93);
        this.commit();
    }

    /** Headline and attribution, when there is no picture to be had. */
    titleCard(title: string, kicker: string, rtl: boolean): void {
        this.token++;
        const { ctx, w, h } = this;
        this.frame();

        ctx.save();
        // A canvas shapes and orders Arabic correctly on its own; what it does
        // not decide is the alignment, so the caller's `rtl` picks it.
        ctx.direction = rtl ? 'rtl' : 'ltr';
        ctx.textAlign = rtl ? 'right' : 'left';
        const x = rtl ? w * 0.92 : w * 0.08;

        ctx.fillStyle = 'rgba(120, 175, 255, 0.95)';
        ctx.font = `600 ${Math.round(h * 0.058)}px system-ui, sans-serif`;
        if (kicker) ctx.fillText(kicker, x, h * 0.22);

        ctx.fillStyle = '#f2f6ff';
        const size = Math.round(h * 0.088);
        ctx.font = `700 ${size}px system-ui, sans-serif`;
        /*
          Wrapped by MEASUREMENT, not by character count.

          An Arabic headline and an English one of the same length are nowhere
          near the same width, so a fixed count clips one and wastes half the
          wall on the other. Four lines is the cap; a headline longer than that
          is a headline the lower third is already carrying in full.
        */
        const words = (title || '').split(/\s+/).filter(Boolean);
        const max = w * 0.84;
        const lines: string[] = [];
        let line = '';
        for (const word of words) {
            const next = line ? `${line} ${word}` : word;
            if (ctx.measureText(next).width > max && line) {
                if (lines.length >= 3) break;
                lines.push(line);
                line = word;
            } else {
                line = next;
            }
        }
        if (line && lines.length < 4) lines.push(line);
        lines.forEach((text, i) => ctx.fillText(text, x, h * 0.42 + i * size * 1.26));
        ctx.restore();
        this.commit();
    }

    /**
     * A picture, contained and never cropped, over a blurred wash of itself.
     *
     * Contained, because the point of putting a photograph up is that the
     * viewer sees the photograph the newsroom filed. A 16:9 wall showing a 4:3
     * picture has slack either side whatever is done; the wash is what a real
     * video wall does with an off-shape source, and the alternative is two
     * black bars, which read as a fault.
     */
    async image(url: string, fallback: () => void): Promise<void> {
        const mine = ++this.token;
        const img = new Image();
        // Without this the upload throws `SecurityError` rather than failing to
        // load, and the wall would go black on a picture that is perfectly fine
        // — see the class comment.
        img.crossOrigin = 'anonymous';
        img.referrerPolicy = 'no-referrer';
        const ok = await new Promise<boolean>(resolve => {
            img.onload = () => resolve(true);
            img.onerror = () => resolve(false);
            img.src = url;
        });
        // The story moved on while this was loading.
        if (mine !== this.token) return;
        if (!ok || !img.naturalWidth) { fallback(); return; }

        const { ctx, w, h } = this;
        try {
            this.frame();
            const fill = Math.max(w / img.naturalWidth, h / img.naturalHeight);
            ctx.save();
            ctx.filter = 'blur(28px) brightness(0.5)';
            ctx.drawImage(img,
                (w - img.naturalWidth * fill) / 2, (h - img.naturalHeight * fill) / 2,
                img.naturalWidth * fill, img.naturalHeight * fill);
            ctx.restore();

            const fit = Math.min(w / img.naturalWidth, h / img.naturalHeight);
            const dw = img.naturalWidth * fit;
            const dh = img.naturalHeight * fit;
            ctx.drawImage(img, (w - dw) / 2, (h - dh) / 2, dw, dh);
            this.commit();
        } catch {
            // A tainted canvas throws on `update()`, not on `drawImage`, so the
            // texture is already unusable by the time we get here. Redraw from
            // clean rather than leaving whatever half-committed state exists.
            fallback();
        }
    }

    dispose() { this.texture.dispose(); }
}

/* ------------------------------------------------------------------ *
 * The stage
 * ------------------------------------------------------------------ */

export async function createStudioStage(
    canvas: HTMLCanvasElement,
    options: { hostEl: HTMLElement },
): Promise<StudioStage> {
    const B = await loadBabylon();
    const quality = pickQuality();
    const motion = reducedMotion() ? 0.35 : 1;

    const engine: Engine = new B.Engine(canvas, quality === 'high', {
        alpha: false,
        antialias: quality === 'high',
        preserveDrawingBuffer: false,
        stencil: false,
        powerPreference: quality === 'high' ? 'high-performance' : 'low-power',
    }, false);
    engine.setHardwareScalingLevel(1 / pixelRatio(quality));

    const scene = new B.Scene(engine);
    scene.clearColor = new B.Color4(0.02, 0.03, 0.06, 1);
    scene.detachControl();
    scene.skipPointerMovePicking = true;

    /*
      Tone mapping is what stops a lit sphere looking like a lit sphere.

      ACES compresses the highlights the way a camera does, so a specular
      hotspot on a forehead rolls off instead of clipping to flat white — and a
      clipped highlight is one of the two or three things that read instantly as
      computer graphics. The contrast and the vignette are the other half of
      looking photographed rather than rendered.
    */
    const ip = scene.imageProcessingConfiguration;
    ip.toneMappingEnabled = true;
    ip.toneMappingType = 1; // ACES
    /*
      The same three-way over-correction the portrait stage had, and the same
      fix: exposure a stop under where a face wants to sit, a contrast that
      crushes the midtones a head is made of, and a vignette at 2.4 — which
      MULTIPLIES, so the two presenters, who are at 20% and 80% across the
      frame, were sitting in the darkest part of it.
    */
    ip.exposure = 1.16;
    ip.contrast = 1.12;
    ip.vignetteEnabled = true;
    ip.vignetteWeight = 0.9;
    ip.vignetteStretch = 0.8;
    ip.vignetteColor = new B.Color4(0, 0, 0, 0);

    /*
      Three lights on the people, and everything else in the room is emissive
      geometry — which costs nothing and is what the eye reads as "this place is
      lit". A warm key from camera left, a cool rim from behind camera right,
      and a soft ambient standing in for the bounce off a pale floor.
    */
    const ambient = new B.HemisphericLight('amb', new B.Vector3(0, 1, 0), scene);
    ambient.intensity = 0.46;
    ambient.diffuse = B.Color3.FromHexString('#93a9d0');
    ambient.groundColor = B.Color3.FromHexString('#3b3446');

    /* The direction is right and always was — it has a positive Z, and the
       anchors face -Z, so it reaches them. See the note in `portraitStage.ts`
       about the one time that was got wrong. */
    const key = new B.DirectionalLight('key', new B.Vector3(0.42, -0.80, 0.44), scene);
    key.position = new B.Vector3(-3.4, 5.0, -3.6);
    key.intensity = 1.85;
    key.diffuse = B.Color3.FromHexString('#fff0d9');

    const rim = new B.DirectionalLight('rim', new B.Vector3(-0.64, -0.36, -0.62), scene);
    rim.intensity = 1.35;
    rim.diffuse = B.Color3.FromHexString('#8fbcff');

    /*
      A FOURTH light, and it is the one that makes a face read as a face.

      Three-point lighting on paper is key, rim and ambient — and rendered, that
      leaves the shadow side of the head with nothing on it but a flat
      hemispheric term, so the terminator runs straight down the middle of the
      face and one half goes muddy. It reads as a blotch or a texture seam
      rather than as shading, which is exactly how it was first reported to
      itself in the preview.

      A gallery would put a soft fill opposite the key at about a third of its
      strength, and cooler, so the shadow side has colour in it as well as
      light. This is that. Four lights is also the most Babylon compiles into a
      material by default (`maxSimultaneousLights`), so it is the last one that
      is free.
    */
    const fill = new B.DirectionalLight('fill', new B.Vector3(-0.58, -0.30, 0.60), scene);
    fill.intensity = 0.95;
    fill.diffuse = B.Color3.FromHexString('#c3d8ff');
    fill.specular = B.Color3.FromHexString('#4a5a72');

    const shadows = quality === 'high' ? new B.ShadowGenerator(1024, key) : null;
    if (shadows) {
        /* Exponential and blurred rather than a hard map: a studio has big soft
           sources, and a crisp shadow edge under a presenter's chin is the
           clearest possible statement that this is a render. */
        shadows.useBlurExponentialShadowMap = true;
        shadows.blurKernel = 32;
        shadows.depthScale = 60;
        shadows.darkness = 0.45;
    }

    /* ---- the room --------------------------------------------------------
       Everything that never moves. See `setPieces.ts`; every dimension in it is
       derived from the camera below, which is why there is nothing to line up
       by hand. */
    const set = buildSet(B, scene, quality);
    for (const mesh of set.floors) mesh.receiveShadows = true;

    /* The emissive strips and the lit desk lip only read as LIGHT rather than
       as bright paint once they bloom. One layer for the whole scene. */
    const glow = new B.GlowLayer('glow', scene, { blurKernelSize: 32 });
    glow.intensity = quality === 'high' ? 0.65 : 0.4;

    const wall = new WallSurface(B, scene);
    set.wallMaterial.albedoTexture = wall.texture;
    set.wallMaterial.emissiveTexture = wall.texture;

    /* ---- the anchors ------------------------------------------------------ */
    const seats: Partial<Record<StudioAnchor, { rig: FigureRig; spec: FigureSpec }>> = {};

    for (const spec of ANCHOR_FIGURES) {
        const which: StudioAnchor = spec.gender === 'male' ? 'male' : 'female';
        /*
          HANDS ON THE DESK, HOLDING A SCRIPT.

          The pose is solved from the desk's own height and the figure's own arm
          lengths — see `reachPitch`. The two anchors are 1.70 m and 1.80 m, so a
          pair of hand-tuned angles would put one anchor's palms on the desk and
          the other's through it.

          `handZ` is expressed in the FIGURE's space, where +Z is the direction
          they face. The desk is in front of them, so the target's Z is the
          distance from the anchor plane to the script, and the sign works out
          because the whole figure is turned by PI.
        */
        const rig = buildFigure(B, scene, spec, quality, {
            pose: 'desk',
            // A little above the slab: hands rest ON paper, not inside it.
            handY: DESK_TOP_Y + 0.105,
            handZ: ANCHOR_Z - SCRIPT_Z,
        });
        // Male screen-right, female screen-left. See RIGHT_X.
        rig.root.position.set((which === 'male' ? RIGHT_X : -RIGHT_X) * ANCHOR_X, 0, ANCHOR_Z);
        // Facing the camera, and angled a few degrees inward so the two read as
        // sharing a desk rather than as two portraits side by side.
        rig.root.rotation.y = Math.PI + (which === 'male' ? 0.19 : -0.19);
        if (shadows) for (const mesh of rig.meshes) shadows.addShadowCaster(mesh, false);
        seats[which] = { rig, spec };
    }

    /* ---- camera ------------------------------------------------------------
       Eye height and a moderate lens, framed the way a gallery frames a
       two-shot. Two things about it are not cosmetic:

       * **`FOVMODE_HORIZONTAL_FIXED`.** The default is vertical-fixed, which
         means the HORIZONTAL extent changes with the canvas shape — and the
         stage is capped by `max-height`, so it is routinely shorter than its
         own aspect ratio. Vertical-fixed, the anchors would slide toward the
         centre as the stage got squatter, and the DOM name plates, pinned at
         percentages, would drift off the people they name. Fixed horizontally,
         the width is a constant and a short stage simply loses a strip of
         ceiling and floor — which is what `object-fit: cover` was doing for the
         photographs, arrived at properly.

       * **The fov and the distance live in `layout.ts`**, which is also where
         the set's dimensions are derived from them. Change either there and the
         room follows; change them here and the desk stops crossing the frame
         where it should. */
    const camera = new B.UniversalCamera('studio', new B.Vector3(0, CAMERA_Y, CAMERA_Z), scene);
    // LEVEL, not tilted down. With any pitch a world Y stops mapping to a fixed
    // fraction of the picture, which is exactly what the DOM plates depend on.
    camera.setTarget(new B.Vector3(0, CAMERA_Y, 1.2));
    camera.fovMode = 1; // FOVMODE_HORIZONTAL_FIXED
    camera.fov = CAMERA_FOV;
    camera.minZ = 0.15;
    camera.maxZ = 60;
    camera.inputs.clear();
    scene.activeCamera = camera;

    /* ---- state and loop --------------------------------------------------- */
    let clock = 0;
    let speaking: StudioAnchor | null = null;
    let energy = 0;
    let startedAt = -999;
    let live = false;
    let visible = true;

    const minFrameMs = quality === 'high' ? 0 : 1000 / 30;
    let lastFrame = 0;

    const tallyOff = B.Color3.FromHexString('#180608');
    const tallyOn = B.Color3.FromHexString('#ff2a33');

    engine.runRenderLoop(() => {
        const now = performance.now();
        if (!visible) return;
        if (minFrameMs && now - lastFrame < minFrameMs) return;
        const dt = lastFrame ? Math.min(0.1, (now - lastFrame) / 1000) : 0.016;
        lastFrame = now;
        clock += dt;

        for (const which of ['male', 'female'] as StudioAnchor[]) {
            const seat = seats[which];
            if (!seat) continue;
            const talking = speaking === which;
            /*
              WHO LOOKS WHERE, AND WHY IT IS NOT ALWAYS THE CAMERA.

              The one reading looks down the lens, because that is what reading
              the news is. The one who is NOT reading looks at their
              co-presenter — which is what a person at that desk actually does,
              and it is the single detail that stops the second anchor reading
              as a mannequin parked in shot. A handover then produces an
              exchanged glance for free: the moment `speaking` moves, the two
              targets swap.
            */
            const other = which === 'male' ? seats.female : seats.male;
            let target = talking || !speaking
                ? camera.position
                : (other
                    ? other.rig.root.position.add(new B.Vector3(0, 1.45, 0))
                    : camera.position);

            /*
              ============================================================
              DOWN TO THE PAGE, THEN UP TO THE LENS
              ============================================================

              A presenter reads the top of a story off the script in front of
              them and then delivers it to camera. They do not begin a sentence
              already staring down the barrel — that is the one thing that made
              the anchors read as animated mannequins even once they were looking
              at the camera at all.

              `scriptGlance` (in `figures.ts`, so it is checkable) is the weight:
              1 on the page at the start of a line, easing to 0 by
              `SCRIPT_GLANCE_SECONDS`, with an occasional shallow dip afterwards.
              The target is then LERPED between the script and the camera rather
              than switched, because a head that snaps between two points is
              worse than one that never moves.

              The script's coordinates come from `layout.ts` — the same constants
              the set uses to place the sheet, so the eyes cannot land next to
              the paper instead of on it.
            */
            if (talking) {
                const weight = scriptGlance(clock - startedAt, energy);
                if (weight > 0.001) {
                    const page = new B.Vector3(
                        (which === 'male' ? RIGHT_X : -RIGHT_X) * SCRIPT_X,
                        SCRIPT_Y,
                        SCRIPT_Z,
                    );
                    target = B.Vector3.Lerp(target, page, weight);
                }
            }

            seat.rig.update({
                time: clock,
                energy: talking ? energy : 0,
                since: talking ? clock - startedAt : 0,
                lookAt: target,
                /*
                  The anchor who is not reading is LISTENING to the one who is,
                  and already turns to look at them. `attention` is the other
                  half of that: an occasional short nod, which is what a
                  co-presenter does and is the cheapest thing on this set that
                  makes the two read as being in a conversation rather than as
                  two people who happen to be at one desk.

                  Zero between stories, when nobody is reading. Two anchors
                  nodding at each other in silence is a worse picture than two
                  anchors sitting still.
                */
                attention: speaking && !talking ? 1 : 0,
                motion,
            });
        }

        // The tally. It breathes rather than sitting flat, because a real one
        // is a filament and this is the object a viewer checks first.
        set.tally.emissiveColor = live
            ? tallyOn.scale(0.72 + 0.28 * Math.sin(clock * 3))
            : tallyOff;

        scene.render();
        /*
          A flag the screenshot harness waits on.

          `tools/rtl-audit` polls for it rather than sleeping a fixed time,
          because under software rendering the Babylon chunk, the scene build
          and the PBR shader compile take several seconds — and a capture taken
          before the first frame is a black rectangle that reads as a broken
          renderer. One property on the canvas is cheaper than any of the
          alternatives and is invisible to everything else.
        */
        if (!(canvas as any).__sfsPainted) (canvas as any).__sfsPainted = true;
    });

    /*
      Off-screen is not rendered.

      The Newscast page scrolls and the studio is at the top of it; a stage that
      keeps drawing while it is out of view is a phone getting hot for pixels
      nobody is looking at. The `document.hidden` half covers a backgrounded
      tab, which some browsers already throttle and some do not.
    */
    const io = typeof IntersectionObserver !== 'undefined'
        ? new IntersectionObserver(entries => {
            visible = entries.some(e => e.isIntersecting) && !document.hidden;
        }, { threshold: 0 })
        : null;
    io?.observe(options.hostEl);
    const onVisibility = () => { if (document.hidden) visible = false; else if (!io) visible = true; };
    document.addEventListener('visibilitychange', onVisibility);

    return {
        setSpeaking(anchor, level) {
            if (anchor !== speaking) startedAt = clock;
            speaking = anchor;
            energy = Math.max(0, Math.min(1, level));
        },
        setScreen({ image, title, kicker, rtl }) {
            const card = () => {
                if (title) wall.titleCard(title, kicker || '', !!rtl);
                else wall.ident();
            };
            if (image) void wall.image(image, card);
            else card();
        },
        setLive(next) { live = next; },
        resize() { engine.resize(); },
        dispose() {
            document.removeEventListener('visibilitychange', onVisibility);
            io?.disconnect();
            engine.stopRenderLoop();
            for (const seat of Object.values(seats)) seat?.rig.dispose();
            wall.dispose();
            glow.dispose();
            scene.dispose();
            // Without this the context stays live until the collector gets to
            // it, and a browser near its context cap will kill somebody else's
            // canvas rather than reuse this one.
            engine.dispose();
        },
    };
}
