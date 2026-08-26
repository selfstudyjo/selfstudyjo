/**
 * A grid of people, each in their own camera, on ONE canvas.
 *
 * Used by the Toastmasters meeting (six seats) and the Job Interview (one
 * interviewer). Both used to be `<video>` tiles; both are now this.
 *
 * ============================================================
 * WHY ONE CANVAS AND SIX VIEWPORTS, RATHER THAN SIX CANVASES
 * ============================================================
 *
 * A canvas per tile is the obvious shape and it is not survivable. A browser
 * caps live WebGL contexts at around sixteen and, past that, silently kills the
 * OLDEST one rather than refusing the new one — so a meeting of six plus a
 * theme background plus anything else on the platform is close enough to the
 * cap that the failure mode is a tile that goes black minutes into a session,
 * for reasons that look like nothing. Six contexts also means six copies of
 * every shader, six render loops and six sets of GPU state changes per frame.
 *
 * So there is one context, one scene, one render loop, and `scene.activeCameras`
 * holds one camera per tile with its `viewport` set to that tile's rectangle.
 * Babylon renders the frame once and each camera rasterises only inside its own
 * rectangle, which is exactly the thing a viewport is.
 *
 * ============================================================
 * WHY THE VIEWPORTS COME FROM THE DOM
 * ============================================================
 *
 * The alternative is for this module to own the layout — six equal cells in a
 * grid it computes. That works until the page is 380px wide and the meeting
 * grid reflows from six columns to two, which `toastmasters.css` already does
 * and which this module has no business knowing about.
 *
 * So the LAYOUT stays in CSS, where it is already responsive and already
 * translated, and {@link PortraitStage.layout} is handed the tiles' measured
 * rectangles. Anything the stylesheet can do — reflow, wrap, change the aspect
 * ratio, hide a tile — works with no change here.
 *
 * ============================================================
 * WHY THE PODS ARE A HUNDRED METRES APART
 * ============================================================
 *
 * Because that makes the frustum do the culling for free. Each camera sees one
 * figure; the other five are far outside its view and are never submitted. Six
 * figures at ~24 meshes each is 144 draw calls if they share a space, and ~24
 * if they do not.
 */

import type { Scene } from '@babylonjs/core/scene';
import type { Engine } from '@babylonjs/core/Engines/engine';
import type { UniversalCamera } from '@babylonjs/core/Cameras/universalCamera';

import type * as BJS from './babylon';
import { buildFigure, surface, type FigureRig } from './human';
import { figureById, type FigureSpec } from './figures';
import { loadBabylon, pickQuality, pixelRatio, reducedMotion } from './loader';

/** Metres between one person and the next. Anything over ~20 would do. */
const POD_SPACING = 100;

export interface PortraitTile {
    /** A figure id — see `figures.ts`. */
    id: string;
    /** The element whose rectangle this person is drawn into. */
    el: HTMLElement;
}

export interface PortraitStage {
    /** Point the cameras at the tiles. Call after any layout change. */
    layout(tiles: PortraitTile[]): void;
    /**
     * Who is talking, and how loudly.
     *
     * `energy` is 0…1 and is what drives the mouth. It is a live reading off
     * the audio when the line came from the server engine and a nominal 0.7
     * when it came from `speechSynthesis`, which exposes nothing.
     */
    setSpeaking(id: string | null, energy: number): void;
    /** The canvas has changed size. */
    resize(): void;
    dispose(): void;
}

/**
 * A gradient card behind one person.
 *
 * Not decoration: without something behind them a figure is cut out against the
 * page, which reads as a sticker. A soft pool of light behind the shoulders is
 * what a real studio flat does and it is what separates the head from the
 * background at the top of the silhouette, where the hair is darkest.
 *
 * Drawn into a canvas rather than assembled from meshes because a gradient is
 * one texture and would otherwise be a hundred triangles that still band.
 */
function backdropTexture(
    B: typeof BJS, scene: Scene, accent: string, name: string,
): BJS.DynamicTexture {
    const size = 256;
    const texture = new B.DynamicTexture(name, { width: size, height: size }, scene, true);
    const ctx = texture.getContext() as unknown as CanvasRenderingContext2D;
    const glow = ctx.createRadialGradient(
        size * 0.5, size * 0.42, size * 0.04,
        size * 0.5, size * 0.46, size * 0.62);
    glow.addColorStop(0, accent);
    glow.addColorStop(0.4, '#2b3554');
    glow.addColorStop(1, '#0b1020');
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, size, size);
    texture.update(false);
    return texture;
}

interface Pod {
    id: string;
    rig: FigureRig;
    camera: UniversalCamera;
    /** Seconds at which this person started speaking; ramps the gestures. */
    startedAt: number;
}

export async function createPortraitStage(
    canvas: HTMLCanvasElement,
    ids: string[],
    options: { hostEl: HTMLElement } ,
): Promise<PortraitStage> {
    const B = await loadBabylon();
    const quality = pickQuality();
    const motion = reducedMotion() ? 0.35 : 1;

    /*
      `alpha: true` and a fully transparent clear colour.

      The canvas sits UNDER the tile grid and the gaps between tiles have to
      show the page, not a black rectangle — the meeting grid has a 0.6rem
      gutter and rounded tiles, and an opaque canvas would square them all off.
      `premultipliedAlpha: false` because the page composites in straight alpha.
    */
    const engine: Engine = new B.Engine(canvas, quality === 'high', {
        alpha: true,
        premultipliedAlpha: false,
        antialias: quality === 'high',
        // The stage is redrawn every frame and never read back; keeping the
        // drawing buffer costs memory bandwidth for nothing.
        preserveDrawingBuffer: false,
        stencil: false,
        powerPreference: quality === 'high' ? 'high-performance' : 'low-power',
    }, false);
    engine.setHardwareScalingLevel(1 / pixelRatio(quality));

    const scene = new B.Scene(engine);
    scene.clearColor = new B.Color4(0, 0, 0, 0);
    // Nothing here is clickable and the pointer belongs to the page underneath.
    scene.detachControl();
    scene.skipPointerMovePicking = true;
    scene.blockMaterialDirtyMechanism = true;

    /*
      Tone mapping is what stops a lit sphere looking like a lit sphere.

      ACES compresses the highlights the way a camera does, so a specular
      hotspot on a forehead rolls off instead of clipping to flat white — and a
      clipped highlight is one of the two or three things that read instantly as
      "computer graphics". The contrast and the vignette are the other half of
      making it look photographed rather than rendered.
    */
    const ip = scene.imageProcessingConfiguration;
    ip.toneMappingEnabled = true;
    ip.toneMappingType = 1; // ACES
    ip.exposure = 1.28;
    ip.contrast = 1.35;
    ip.vignetteEnabled = true;
    ip.vignetteWeight = 2.2;
    ip.vignetteStretch = 0.4;
    ip.vignetteColor = new B.Color4(0, 0, 0, 0);

    /*
      Three lights for the whole scene, not three per pod.

      A directional light has no position, so one of them lights every pod
      identically however far apart they are — which is what makes six tiles
      look like six seats in one room rather than six separate renders. Per-pod
      spots would be twelve lights, and Babylon compiles every light into every
      material's shader up to `maxSimultaneousLights`; past four the cost is a
      recompile and a much heavier fragment shader for no visible gain at this
      framing.
    */
    const ambient = new B.HemisphericLight('fill', new B.Vector3(0, 1, 0), scene);
    ambient.intensity = 0.42;
    ambient.diffuse = B.Color3.FromHexString('#8fa4c8');
    ambient.groundColor = B.Color3.FromHexString('#241d2b');

    const key = new B.DirectionalLight('key', new B.Vector3(-0.55, -0.72, -0.42), scene);
    key.intensity = 2.6;
    key.diffuse = B.Color3.FromHexString('#fff1de');
    key.specular = B.Color3.FromHexString('#ffffff');

    /* The rim is what puts a bright edge along the jaw and the shoulder and
       lifts the figure off the backdrop. It is deliberately cool against a warm
       key: the colour contrast does as much separating as the brightness. */
    const rim = new B.DirectionalLight('rim', new B.Vector3(0.72, -0.30, 0.62), scene);
    rim.intensity = 1.9;
    rim.diffuse = B.Color3.FromHexString('#9dc4ff');
    rim.specular = B.Color3.FromHexString('#cfe3ff');

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
    const fill = new B.DirectionalLight('fill', new B.Vector3(0.62, -0.28, -0.55), scene);
    fill.intensity = 0.95;
    fill.diffuse = B.Color3.FromHexString('#bcd4ff');
    fill.specular = B.Color3.FromHexString('#4a5a72');

    const pods: Pod[] = [];
    let clock = 0;
    let speaking: string | null = null;
    let energy = 0;

    ids.forEach((id, index) => {
        let spec: FigureSpec;
        try {
            spec = figureById(id);
        } catch {
            return;
        }
        const x = index * POD_SPACING;

        const rig = buildFigure(B, scene, spec, quality);
        rig.root.position.x = x;
        // Turned a few degrees off square. A person photographed dead-on is a
        // passport photo; a three-quarter turn of even ten degrees reads as
        // somebody sitting at a table.
        rig.root.rotation.y = (index % 2 === 0 ? 1 : -1) * 0.16;

        const eyeY = rig.proportions.headY + rig.proportions.headRadius * 0.03;

        /* The flat behind them, and the pool of light on it. */
        const wall = B.CreatePlane(`wall-${id}`, { width: 3.4, height: 3.4 }, scene);
        wall.position.set(x, eyeY - 0.15, -1.55);
        const wallMat = surface(B, scene, `wallmat-${id}`, '#ffffff', { roughness: 0.95, flat: true });
        wallMat.albedoTexture = backdropTexture(B, scene, spec.outfit.accent, `bd-${id}`);
        // Emissive as well as lit: the backdrop is a lightbox, and a purely lit
        // flat goes muddy under the same exposure that makes the skin right.
        wallMat.emissiveTexture = wallMat.albedoTexture;
        /*
          The flat is a LIGHTBOX, and this number is why the tiles are legible.

          At 0.16 the backdrop rendered near-black and every tile was a face
          floating in a void — which is worse than a plain colour, because the
          silhouette then has nothing to read against and the hair disappears
          into the background entirely. A studio flat is lit; 0.40 is what makes
          it look lit rather than merely painted.
        */
        wallMat.emissiveColor = new B.Color3(0.40, 0.40, 0.44);
        wall.material = wallMat;

        /* A desk edge across the bottom. It is barely in frame and it is what
           stops the figure looking like a bust floating in a box. */
        const desk = B.CreateBox(`desk-${id}`, { width: 2.2, height: 0.5, depth: 0.7 }, scene);
        desk.position.set(x, rig.proportions.waistY - 0.22, 0.42);
        desk.material = surface(B, scene, `deskmat-${id}`, '#171d2c', { roughness: 0.42 });

        /*
          Head and shoulders on a long lens.

          The focal length is the realism decision here. A wide lens close to a
          face enlarges the nose and shrinks the ears — the "selfie" distortion
          — and it is instantly readable as wrong even by somebody who could not
          say why. 24° vertical is roughly an 85mm portrait lens, which is what a
          real camera would be doing this job on.

          The DISTANCE is a composition decision and separate from it. At 1.42 m
          the visible height is 0.60 m, so a 0.20 m head is a third of the frame
          and two thirds of every tile is jacket — which reads as a photograph of
          somebody's chest. At 1.08 m the head is nearer 45%, which is where a
          video call frames a person, and the body is cropped at the bottom as a
          video call crops it.
        */
        /*
          The camera sits BELOW the eye line and looks slightly up-ish at the
          head, which puts the subject high in the frame.

          Aimed level at the eyes, a third of every tile was empty sky above the
          hair: the visible box is 0.46 m tall and a head is 0.20 m of it, so
          wherever the frame is centred somebody gets the slack — and slack
          above a head reads as a badly framed photograph, where slack below is
          just a chest. Dropping the camera 6 cm moves the head up without
          changing the lens.
        */
        const camera = new B.UniversalCamera(`cam-${id}`, new B.Vector3(x, eyeY - 0.06, 0.98), scene);
        camera.setTarget(new B.Vector3(x, eyeY - 0.085, 0));
        camera.fov = 0.42;
        camera.minZ = 0.15;
        camera.maxZ = 12;
        // No input at all: this is a picture, not a viewer.
        camera.inputs.clear();

        pods.push({ id, rig, camera, startedAt: -999 });
        scene.activeCameras = [...(scene.activeCameras || []), camera];
        void wall; void desk;
    });

    /*
      A frame budget rather than "as fast as it can".

      Six portraits at 60 fps on a phone is a warm phone and a throttled tab,
      and the difference between 30 and 60 is invisible on a talking head — the
      motion here is a blink, a breath and a jaw, none of which is fast. On a
      desktop it runs at the display rate.
    */
    const minFrameMs = quality === 'high' ? 0 : 1000 / 30;
    let lastFrame = 0;
    let visible = true;

    engine.runRenderLoop(() => {
        const now = performance.now();
        if (!visible) return;
        if (minFrameMs && now - lastFrame < minFrameMs) return;
        const dt = lastFrame ? Math.min(0.1, (now - lastFrame) / 1000) : 0.016;
        lastFrame = now;
        clock += dt;

        for (const pod of pods) {
            const talking = pod.id === speaking;
            if (talking && pod.startedAt < 0) pod.startedAt = clock;
            if (!talking) pod.startedAt = -999;
            pod.rig.update({
                time: clock,
                energy: talking ? energy : 0,
                since: talking ? clock - pod.startedAt : 0,
                // Everybody looks down the barrel of their own camera. In a
                // grid of tiles that is what "making eye contact with the
                // viewer" means, and it is the difference between a room of
                // people and a room of mannequins.
                lookAt: pod.camera.position,
                motion,
            });
        }
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

      The meeting page scrolls, and a stage that keeps drawing while it is out
      of view is a phone getting hot for pixels nobody is looking at. The
      `document.hidden` half covers a backgrounded tab, which some browsers
      already throttle and some do not.
    */
    const io = typeof IntersectionObserver !== 'undefined'
        ? new IntersectionObserver(entries => {
            visible = entries.some(e => e.isIntersecting) && !document.hidden;
        }, { threshold: 0 })
        : null;
    io?.observe(options.hostEl);

    const onVisibility = () => {
        if (document.hidden) visible = false;
        else if (!io) visible = true;
    };
    document.addEventListener('visibilitychange', onVisibility);

    let tiles: PortraitTile[] = [];

    function applyViewports(): void {
        if (!tiles.length) return;
        const host = options.hostEl.getBoundingClientRect();
        if (!host.width || !host.height) return;
        for (const tile of tiles) {
            const pod = pods.find(p => p.id === tile.id);
            if (!pod || !tile.el) continue;
            const r = tile.el.getBoundingClientRect();
            // Babylon's viewport origin is the BOTTOM-left of the canvas and
            // the DOM's is the top-left, which is the one thing to get wrong
            // here: flipped, every tile shows the mirror row's person.
            pod.camera.viewport = new B.Viewport(
                (r.left - host.left) / host.width,
                1 - (r.top - host.top + r.height) / host.height,
                r.width / host.width,
                r.height / host.height,
            );
        }
    }

    return {
        layout(next) {
            tiles = next.filter(t => t.el);
            applyViewports();
        },
        setSpeaking(id, level) {
            speaking = id;
            energy = Math.max(0, Math.min(1, level));
        },
        resize() {
            engine.resize();
            applyViewports();
        },
        dispose() {
            document.removeEventListener('visibilitychange', onVisibility);
            io?.disconnect();
            engine.stopRenderLoop();
            for (const pod of pods) pod.rig.dispose();
            scene.dispose();
            // Without this the context stays live until the GC gets to it, and
            // a browser that is already near its context cap will kill somebody
            // else's canvas instead of reusing this one.
            engine.dispose();
        },
    };
}
