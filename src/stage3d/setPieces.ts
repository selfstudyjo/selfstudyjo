/**
 * The furniture of the newscast set: the room, the rig, the desk and the wall.
 *
 * Split out of `studioStage.ts` because that file is about the SHOT — the
 * camera, the anchors, the render loop and the state the page drives — and this
 * one is about the room the shot is of. They change for different reasons and
 * at different times.
 *
 * ============================================================
 * EVERY NUMBER IN HERE IS DERIVED FROM THE FRAMING
 * ============================================================
 *
 * That is the whole discipline of the file, and the reason the old set had
 * seams to hide: it was three photographs whose sizes were whatever they were,
 * and the CSS then spent a hundred lines solving for a room that had never
 * existed. Here the camera is decided FIRST and the set is built to fit it.
 *
 * Every dimension comes out of `layout.ts`, which is where the camera is
 * decided and where the arithmetic that turns it into a composition is written
 * out. The visible box at the anchor plane is 3.39 m wide by 1.87 m tall,
 * centred at y = 1.385, and that is what fixes the desk height, the wall width
 * and how far apart the two presenters stand.
 *
 * Change the camera and these have to move with it. That is not a fragility;
 * it is the thing that guarantees the composition, and it is checkable, which a
 * photograph of a room is not.
 */

import type { Scene } from '@babylonjs/core/scene';
import type { Mesh } from '@babylonjs/core/Meshes/mesh';

import type * as BJS from './babylon';
import { surface } from './human';
import {
    CAMERA_Y, DESK_TOP_Y, DESK_Z,
    SCRIPT_X, SCRIPT_Y, SCRIPT_Z,
    WALL_H, WALL_W, WALL_Y, WALL_Z,
} from './layout';

export interface SetPieces {
    /** The tally lamp's material, switched red when the bulletin is live. */
    tally: BJS.PBRMaterial;
    /** The video wall's own material, so the stage can hand it a texture. */
    wallMaterial: BJS.PBRMaterial;
    /** Everything that should receive a shadow. */
    floors: Mesh[];
}

/**
 * Build the room.
 *
 * Returns only the handles that change over time. Everything else is set
 * dressing and is never touched again, which is why it is not returned — a set
 * that the render loop can reach into is a set that gets animated by accident.
 */
export function buildSet(B: typeof BJS, scene: Scene, quality: 'high' | 'low'): SetPieces {
    const detail = quality === 'high' ? 1 : 0.55;
    const floors: Mesh[] = [];

    /* ---- the cyclorama -------------------------------------------------
       A drum with its faces flipped inward, and the camera inside it. A flat
       wall behind two people is a photograph of a flat wall; a curve has a
       continuous falloff across it, so the background is brighter behind the
       presenters and darker at the edges without anybody painting it that way,
       and there is no corner for the eye to find. One mesh, one draw call. */
    const drum = B.CreateCylinder('cyc', {
        diameter: 18, height: 9, tessellation: Math.round(48 * detail) + 16, cap: 0,
        sideOrientation: 1, // BACKSIDE
    }, scene);
    drum.position.set(0, 3.6, 1.2);
    const drumMat = surface(B, scene, 'cycmat', '#0e1730', { roughness: 0.94 });
    drumMat.emissiveColor = B.Color3.FromHexString('#050a16');
    drum.material = drumMat;

    const floor = B.CreateGround('floor', { width: 30, height: 30, subdivisions: 2 }, scene);
    floor.position.z = 1.2;
    /*
      Polished, and polish is roughness rather than a mirror. A real planar
      reflection means rendering the whole set again upside down every frame,
      for something at the very bottom of frame that the desk covers most of.

      0.42 rather than 0.22, and it matters more than it sounds: at 0.22 the
      specular lobe is narrow enough to pick up the eighteen emissive slats and
      the six lamps as one broad sheen across the whole visible floor strip,
      which rendered as a large flat pale-grey area between the desk and the
      presenters — the single biggest "the desk is enormous" contributor, and it
      is not the desk at all. Rougher, the same reflections spread out and the
      floor reads as a dark polished floor.
    */
    const floorMat = surface(B, scene, 'floormat', '#080d1a', { roughness: 0.42, metallic: 0.2 });
    floor.material = floorMat;
    floor.receiveShadows = true;
    floors.push(floor);

    /* ---- light columns on the cyc ---------------------------------------
       The cheapest thing in the file and the one that does most for "this is a
       television studio": emissive slats, mostly cool with a warm one every
       third. They cost no light — they are geometry that is simply bright — so
       eighteen of them is eighteen draw calls and nothing else. */
    const slatCool = surface(B, scene, 'slatc', '#0c1830', { glow: '#1d4fa8', flat: true });
    const slatWarm = surface(B, scene, 'slatw', '#141f38', { glow: '#3a74d8', flat: true });
    for (let i = 0; i < 18; i++) {
        const a = (i / 18) * Math.PI * 2;
        const slat = B.CreateBox(`slat${i}`, { width: 0.30, height: 6.0, depth: 0.10 }, scene);
        slat.position.set(Math.sin(a) * 8.4, 3.1, Math.cos(a) * 8.4 + 1.2);
        slat.rotation.y = a;
        slat.material = i % 3 === 0 ? slatWarm : slatCool;
    }

    /* A band low on the cyc. It is what puts a glow on the floor behind the
       desk and separates the presenters from the background at shoulder
       height, which is where a dark suit against a dark wall disappears. */
    const band = B.CreateCylinder('band', {
        diameter: 16.6, height: 0.14, tessellation: Math.round(48 * detail) + 16,
        cap: 0, sideOrientation: 1,
    }, scene);
    band.position.set(0, 0.62, 1.2);
    band.material = surface(B, scene, 'bandmat', '#0d1a34', { glow: '#3a7ad8', flat: true });

    /* ---- the lighting rig, in shot ---------------------------------------
       Deliberately LOW — 2.85 m rather than the five metres a real studio hangs
       at. The frame's top edge at the wall plane is y = 3.09 and at the desk
       only y = 2.12, so anything higher is simply not in the picture, and a rig
       nobody can see may as well not exist. It reads correctly because it is
       above and BEHIND the presenters, which is where an audience expects to
       catch a glimpse of one. */
    const truss = surface(B, scene, 'truss', '#242a38', { roughness: 0.45, metallic: 0.7 });
    /*
      ============================================================
      DIMMER, AND NEVER IN FRONT OF THE SCREEN
      ============================================================

      Two faults, and the second was reported: "we have a lamp cover the screen".

      1. THE LEVEL. `glow: '#ffdcae'` sets `emissiveColor` to (1.00, 0.86, 0.68),
         which is full scale before the `GlowLayer` bloom is added on top. Six of
         them across the top of the frame rendered as flat white slabs with no
         shape in them at all — the brightest thing in the picture by a wide
         margin, and the eye goes there instead of to the presenters. A real
         softbox in shot is a soft grey rectangle with a warm glow, not a hole in
         the image. A third of that level, with the bloom doing the rest.

      2. THE CENTRE LAMP WAS IN FRONT OF THE VIDEO WALL. The wall's top edge is
         at y = 2.68 and its plane is z = 3.05; the centre lamp sat at y = 2.72,
         z = 2.60, tilted 0.42 rad — so its lower front corner dipped to 2.57,
         eleven centimetres below the top of the screen, and 45 cm nearer the
         camera. It occluded the top of every headline.

         Neither number is wrong on its own, which is exactly why this is now
         DERIVED: a centre lamp is hung only on a truss BEHIND the wall plane,
         where it cannot occlude anything, and the condition is written in terms
         of `WALL_Z` so moving the wall carries it.
    */
    const softbox = surface(B, scene, 'softbox', '#1c2029', { glow: '#4c412f', flat: true });
    /* The lens of the lamp: brighter than its shell, and small. A lamp reads as
       a lamp because it has a bright PART, not because all of it is bright. */
    const lens = surface(B, scene, 'lampLens', '#2a2318', { glow: '#93794f', flat: true });
    /*
      3. AND THE FRONT TRUSS WAS CUT IN HALF BY THE TOP OF THE FRAME.

      The camera is level, so the frame's top edge RISES with depth: at the front
      truss (z = 2.6, i.e. 4.95 m out) it is at y = 2.64, and at the third
      (z = 5.8) it is at y = 3.44. A lamp at a constant 2.72 m is therefore
      *partly* in frame at the front and comfortably inside it further back — and
      a lamp with its bottom third showing along the top edge does not read as a
      lamp, it reads as a pale slab hanging into the picture. That is what the
      two peach shapes over the presenters' heads were.

      So the whole rig moved back behind the wall plane, where the frame is tall
      enough to contain a lamp whole. It also means the centre positions can be
      filled without any of them occluding the screen, because the screen is now
      in front of all of them.
    */
    const trussZ = [WALL_Z + 0.45, WALL_Z + 1.85, WALL_Z + 3.25];
    for (let i = 0; i < trussZ.length; i++) {
        const z = trussZ[i] as number;
        const bar = B.CreateBox(`truss${i}`, { width: 11, height: 0.08, depth: 0.08 }, scene);
        bar.position.set(0, 2.90, z);
        bar.material = truss;
        for (const side of [-2.5, 0, 2.5]) {
            // A centre lamp only where it is behind the wall — see above.
            if (side === 0 && z < WALL_Z + 0.4) continue;
            /*
              5. AND NOT ON THE FURTHEST TRUSS.

              The frame narrows toward the lens, so a lamp at a fixed x = 2.5
              lands further IN as it goes further back: at the third truss it
              projects to 0.82 across, which is exactly where the male anchor's
              head is. It read as a lamp growing out of his hair. The bar stays —
              a truss with nothing on it is what the back of a rig looks like.
            */
            if (i >= 2) continue;
            /*
              4. A BARREL, NOT A PLATE.

              A `CreateBox` 54 cm by 34 cm hung under a truss and tilted is, from
              a camera below it, a flat quad — and a flat pale quad in the top
              corner of a frame reads as a sheet of paper, which is what the
              first three attempts at these looked like however dim they were.

              A studio lamp is unmistakable because of its SHAPE: a short barrel
              pointing down at the set with a bright lens at the end of it. A
              cylinder plus a disc is that shape, it has a curved silhouette so
              it cannot read as paper, and only the small disc is bright — which
              is also what stops the pair of them being the brightest thing in
              the picture.
            */
            const barrel = B.CreateCylinder(`lamp${i}${side}`, {
                height: 0.40, diameterTop: 0.30, diameterBottom: 0.23,
                tessellation: Math.round(20 * detail) + 8,
            }, scene);
            barrel.position.set(side, 2.66, z);
            // Nose down and tipped toward the presenters.
            barrel.rotation.x = -0.85;
            barrel.material = softbox;

            const glass = B.CreateCylinder(`lampglass${i}${side}`, {
                height: 0.02, diameter: 0.29,
                tessellation: Math.round(20 * detail) + 8,
            }, scene);
            glass.position.set(
                side,
                2.66 - 0.20 * Math.cos(0.85),
                z - 0.20 * Math.sin(0.85),
            );
            glass.rotation.x = -0.85;
            glass.material = lens;

            /* The yoke it hangs on. Two centimetres of geometry, and without it
               the lamp is a barrel floating under a bar. */
            const stem = B.CreateCylinder(`lampstem${i}${side}`, {
                height: 0.22, diameter: 0.035, tessellation: 8,
            }, scene);
            stem.position.set(side, 2.83, z);
            stem.material = truss;
        }
    }

    /* ---- the video wall ---------------------------------------------------
       Centre of frame, between the anchors and behind them, on a mount rather
       than floating. The bezel is what makes it read as a physical panel: a
       plane with a picture on it reads as a picture, and a plane with a frame
       around it reads as a screen. */
    const bezel = B.CreateBox('bezel', {
        width: WALL_W + 0.14, height: WALL_H + 0.14, depth: 0.12,
    }, scene);
    bezel.position.set(0, WALL_Y, WALL_Z + 0.07);
    bezel.material = surface(B, scene, 'bezelmat', '#0a0e1c', { roughness: 0.32, metallic: 0.55 });

    const screen = B.CreatePlane('screen', { width: WALL_W, height: WALL_H }, scene);
    screen.position.set(0, WALL_Y, WALL_Z);
    /*
      NOT ROTATED, and that is worth a note because the first version was.

      A `CreatePlane` in Babylon's left-handed default already faces the -Z
      direction, which is where the camera is. Turning it by PI to "face the
      camera" points it into the cyclorama instead, and with backface culling on
      the wall then renders as a solid black rectangle — which looks exactly
      like a texture that failed to load rather than a mesh facing the wrong
      way. The bezel behind it is what you end up looking at.
    */
    const wallMaterial = surface(B, scene, 'screenmat', '#ffffff', { flat: true, roughness: 0.1 });
    wallMaterial.emissiveColor = new B.Color3(0.9, 0.9, 0.95);
    /*
      NOTHING IS MIRRORED HERE, AND THAT TOOK THREE GOES TO ESTABLISH.

      `CreatePlane` in Babylon's left-handed default faces -Z, which is where
      the camera is, so it needs no rotation and its `u` runs the right way. The
      first render came out with the ident apparently reversed, and the reflex
      is to mirror something — a `uScale` of -1, then the mesh's `scaling.x`.
      Neither changed anything, which was the clue: the fault was a 180 DEGREE
      ROTATION, not a mirror, and an upside-down line of capitals at a few
      hundred pixels is very easy to read as a mirrored one.

      A rotation is two flips, and only one of them was ours to make. See
      `WallSurface.commit()` for where the vertical one came from.
    */
    // A screen emits; it is not lit. Left lit, the key light puts a specular
    // hotspot across the picture and the whole panel goes grey in shadow.
    wallMaterial.disableLighting = true;
    screen.material = wallMaterial;

    for (const side of [-1, 1]) {
        const post = B.CreateBox(`post${side}`, { width: 0.07, height: WALL_Y, depth: 0.07 }, scene);
        post.position.set(side * WALL_W * 0.42, WALL_Y / 2, WALL_Z + 0.08);
        post.material = truss;
    }

    /*
      Two auxiliary panels, angled inward and further out. Depth cues: they are
      the reason the centre screen reads as an object standing in a room rather
      than a rectangle pasted onto the cyclorama.

      They get a BEZEL and a graticule now rather than being flat blue
      rectangles. Two plain rectangles either side of the shot read as coloured
      paper taped to the wall; the same two with a frame and something on them
      read as screens, and it costs one shared texture. Same reasoning as the
      bezel on the main wall.
    */
    const auxTexture = new B.DynamicTexture('auxtex', { width: 256, height: 148 }, scene, true);
    {
        const ctx = auxTexture.getContext() as unknown as CanvasRenderingContext2D;
        const grad = ctx.createLinearGradient(0, 0, 0, 148);
        grad.addColorStop(0, '#123a72');
        grad.addColorStop(1, '#081226');
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, 256, 148);
        ctx.strokeStyle = 'rgba(140, 190, 255, 0.30)';
        ctx.lineWidth = 1;
        for (let i = 1; i < 8; i++) {
            ctx.beginPath();
            ctx.moveTo((i / 8) * 256, 0);
            ctx.lineTo((i / 8) * 256, 148);
            ctx.stroke();
        }
        // A rising bar chart: the most recognisable thing on a studio side
        // screen, and four rectangles' worth of work.
        ctx.fillStyle = 'rgba(120, 200, 255, 0.55)';
        [0.28, 0.44, 0.62, 0.86].forEach((h, i) => {
            ctx.fillRect(36 + i * 52, 148 - h * 110, 30, h * 110);
        });
        // `update()` and not `update(false)`: the argument is `invertY`, and a
        // canvas's rows run the other way from a texture's. See `WallSurface`.
        auxTexture.update();
    }
    for (const side of [-1, 1]) {
        const auxFrame = B.CreateBox(`auxframe${side}`, {
            width: 1.44, height: 0.87, depth: 0.09,
        }, scene);
        auxFrame.position.set(side * 2.5, 1.85, WALL_Z - 0.50);
        auxFrame.rotation.y = -side * 0.5;
        auxFrame.material = surface(B, scene, `auxframemat${side}`, '#0a0e1c',
            { roughness: 0.32, metallic: 0.55 });

        const aux = B.CreatePlane(`aux${side}`, { width: 1.35, height: 0.78 }, scene);
        aux.position.set(side * 2.5, 1.85, WALL_Z - 0.55);
        // Angled inward, toward the camera. Not `PI - …`: see the screen above,
        // a plane already faces the camera and PI turns it away.
        aux.rotation.y = -side * 0.5;
        const auxMat = surface(B, scene, `auxmat${side}`, '#ffffff', { flat: true, roughness: 0.1 });
        auxMat.albedoTexture = auxTexture;
        auxMat.emissiveTexture = auxTexture;
        auxMat.emissiveColor = new B.Color3(0.85, 0.85, 0.95);
        auxMat.disableLighting = true;
        aux.material = auxMat;
    }

    /*
      A LIT BAND ACROSS THE CYC AT HEAD HEIGHT.

      The one piece of set dressing that does most for "this is a television
      studio and not a dark room": a horizontal strip of light behind the
      presenters, at about the height of their shoulders and heads, so a dark
      suit and dark hair have something bright to be a silhouette against. Every
      news set built in the last twenty years has one, and without it the top of
      each presenter's head dissolved into the cyclorama.

      Behind them, not level with them: z beyond the anchor plane, so it never
      lights their faces from the front and never appears between them and the
      desk.
    */
    const strip = B.CreateCylinder('headband', {
        diameter: 15.2, height: 0.10,
        tessellation: Math.round(48 * detail) + 16, cap: 0, sideOrientation: 1,
    }, scene);
    strip.position.set(0, 1.72, 1.2);
    strip.material = surface(B, scene, 'headbandmat', '#0e1c38',
        { glow: '#2c62b4', flat: true });

    /* And a second, dimmer one above it, so the wall has a rhythm rather than
       one bright line on a flat field. */
    const strip2 = B.CreateCylinder('headband2', {
        diameter: 15.6, height: 0.06,
        tessellation: Math.round(48 * detail) + 16, cap: 0, sideOrientation: 1,
    }, scene);
    strip2.position.set(0, 2.16, 1.2);
    strip2.material = surface(B, scene, 'headbandmat2', '#0b1730',
        { glow: '#17457f', flat: true });

    /* ---- the desk ---------------------------------------------------------
       A straight centre with two angled wings, rather than an arc.

       An arc-limited cylinder is the obvious way to make a curved desk and it
       is the wrong tool here: the builder's arc starts at an angle whose
       orientation is a convention rather than a documented direction, so
       placing it means guessing which way it opens and finding out on screen.
       Three boxes are exact, and at this framing the wings read as a curve
       anyway because they are foreshortened.

       The FRONT PANEL is the load-bearing part and it runs to the floor. The
       figures are modelled from the hips up, so a desk on legs would show two
       torsos hovering over a polished floor. A solid front is what makes them
       people sitting at a desk — and it is what a news desk actually looks
       like. It is 3.6 m wide against a 2.68 m frame at its own depth, so it
       reaches both edges with margin however the stage is cropped.

       The TOP stops just in front of the anchors. Run back under them and the
       slab intersects the torsos, which from this angle is a desk sawing two
       people in half. */
    /*
      Light enough to read as a surface.

      At #121a2e the desk rendered as a black void across the bottom third of
      the picture — the shape was right and there was nothing in it, which looks
      like a hole in the set rather than like furniture. A news desk is a dark
      object under bright light, and "dark under bright light" is not the same
      colour as "black".
    */
    const deskMat = surface(B, scene, 'deskmat', '#1c2740', { roughness: 0.44 });
    /* The front panel is VERTICAL and the key light is overhead, so it takes
       almost no direct light and renders as a black band across the bottom
       quarter of the picture — which reads as a hole in the set. A faint
       emissive floor stands in for the bounce off a lit floor, which is where a
       real desk front gets most of its light. */
    deskMat.emissiveColor = deskMat.albedoColor.scale(0.38);
    const deskTopMat = surface(B, scene, 'desktopmat', '#243052', { roughness: 0.24, metallic: 0.3 });
    /* Dimmer than it was: at `#2f6fd8` with the glow layer over it the lip was
       a bar of cyan light across the whole bottom of the picture, brighter than
       anything on the presenters. A lit lip is a detail, not a feature. */
    const deskGlow = surface(B, scene, 'deskglow', '#12203c', { glow: '#123566', flat: true });

    const front = B.CreateBox('deskfront', {
        width: 3.6, height: DESK_TOP_Y, depth: 0.14,
    }, scene);
    front.position.set(0, DESK_TOP_Y / 2, DESK_Z);
    front.material = deskMat;
    floors.push(front);

    for (const side of [-1, 1]) {
        const wing = B.CreateBox(`deskwing${side}`, {
            width: 1.9, height: DESK_TOP_Y, depth: 0.14,
        }, scene);
        wing.rotation.y = side * 0.42;
        wing.position.set(side * 2.55, DESK_TOP_Y / 2, DESK_Z + 0.36);
        wing.material = deskMat;
        floors.push(wing);
    }

    const top = B.CreateBox('desktop', { width: 6.2, height: 0.07, depth: 0.60 }, scene);
    top.position.set(0, DESK_TOP_Y + 0.035, DESK_Z + 0.24);
    top.material = deskTopMat;
    floors.push(top);

    /* The lit lip. Every news desk built since about 2005 has one, and it is
       what stops the front reading as a plain black wall across the bottom of
       the picture — which is exactly how it read without one. */
    /*
      0.10 below the top, not 0.22.

      With the lens at 0.86 rad the desk front runs off the bottom of the frame,
      and at 22 cm down the lit lip was at 99% of the picture height — a bright
      line one pixel from the edge, which is indistinguishable from not being
      there. The lip is the thing that stops the front reading as a plain dark
      wall, so it has to be somewhere the frame can see it.
    */
    const lipY = DESK_TOP_Y - 0.10;
    const lip = B.CreateBox('desklip', { width: 3.62, height: 0.028, depth: 0.15 }, scene);
    lip.position.set(0, lipY, DESK_Z - 0.005);
    lip.material = deskGlow;
    for (const side of [-1, 1]) {
        const wingLip = B.CreateBox(`desklip${side}`, { width: 1.9, height: 0.028, depth: 0.15 }, scene);
        wingLip.rotation.y = side * 0.42;
        wingLip.position.set(side * 2.55, lipY, DESK_Z + 0.355);
        wingLip.material = deskGlow;
    }

    /*
      A HORIZONTAL FASCIA, NOT VERTICAL SEAMS.

      The front is 3.6 m of one colour and at this lens only its top 20 cm is in
      frame, so one flat band spans the whole picture — which is what makes a set
      look like a backdrop. Vertical panel seams were the first answer and they
      are wrong at this crop: the frame is only 1.95 m wide at the desk plane, so
      of four seams two land outside it and the remaining pair read as two dark
      POSTS holding the desk up.

      A horizontal recess runs the full width by construction, so there is
      nothing to land outside anything, and it is what a news desk fascia
      actually is.
    */
    const fascia = B.CreateBox('deskfascia', {
        width: 3.62, height: 0.055, depth: 0.03,
    }, scene);
    fascia.position.set(0, DESK_TOP_Y - 0.185, DESK_Z - 0.072);
    fascia.material = surface(B, scene, 'deskfasciamat', '#0d1428', { roughness: 0.5 });
    for (const side of [-1, 1]) {
        const wingFascia = B.CreateBox(`deskfascia${side}`, {
            width: 1.9, height: 0.055, depth: 0.03,
        }, scene);
        wingFascia.rotation.y = side * 0.42;
        wingFascia.position.set(side * 2.55, DESK_TOP_Y - 0.185, DESK_Z + 0.288);
        wingFascia.material = fascia.material;
    }

    /* A darker inlay across the desk top, in front of the scripts. Without it
       the top is one flat slab spanning the whole frame, which is the last
       remaining "one big grey shape" in the picture. */
    const inlay = B.CreateBox('deskinlay', { width: 2.9, height: 0.008, depth: 0.20 }, scene);
    inlay.position.set(0, DESK_TOP_Y + 0.074, DESK_Z + 0.02);
    inlay.material = surface(B, scene, 'deskinlaymat', '#141d33', { roughness: 0.36, metallic: 0.35 });
    floors.push(inlay);

    /* ---- the scripts ------------------------------------------------------
       ============================================================
       WHAT THE ANCHORS ARE HOLDING
       ============================================================

       A sheet of paper under each anchor's hands, lying on the desk and tilted a
       few degrees up toward them — which is how anybody reads something on a
       desk, and it is also what makes the tilt visible from a camera in front.

       It is not decoration. The presenters GLANCE at it: `scriptGlance` in
       `figures.ts` sends their eyes down to this exact point at the top of every
       story and then back to the lens. That only works if the sheet and the
       look-at target are the same coordinates, which is why `SCRIPT_*` lives in
       `layout.ts` and both files read it from there rather than each having a
       number.

       Slightly off-white and quite rough: a sheet of paper at 0.95 albedo under
       a key light is a white rectangle with no shape in it, and there are two of
       them in the lower third of the frame.
    */
    const paperMat = surface(B, scene, 'papermat', '#cfd4dd', { roughness: 0.88 });
    for (const side of [-1, 1]) {
        /* Two sheets, slightly out of register, because one rectangle reads as a
           placemat and two read as a script somebody has been turning pages of. */
        for (const [index, offset] of [[0, 0], [1, 1]] as const) {
            const sheet = B.CreateBox(`script${side}${index}`, {
                width: 0.30, height: 0.004, depth: 0.21,
            }, scene);
            sheet.material = paperMat;
            sheet.rotation.x = -0.20;
            sheet.rotation.y = side * (0.14 + offset * 0.09);
            sheet.position.set(
                side * SCRIPT_X + offset * side * 0.018,
                SCRIPT_Y + offset * 0.004,
                SCRIPT_Z - offset * 0.012,
            );
            floors.push(sheet);
        }
    }

    /* ---- the studio camera, and its tally ---------------------------------
       Off to one side and BEHIND the desk line, because a camera in front of
       the presenters would be between them and the viewer. The red lamp is the
       single most recognisable object in a television studio and it costs one
       box. */
    const tally = surface(B, scene, 'tallymat', '#2a0d10', { glow: '#180608', flat: true });
    const body = B.CreateBox('cambody', { width: 0.42, height: 0.30, depth: 0.62 }, scene);
    body.position.set(-2.35, CAMERA_Y + 0.15, 1.35);
    body.rotation.y = 0.5;
    body.material = surface(B, scene, 'cambodymat', '#191d28', { roughness: 0.4, metallic: 0.6 });
    const lamp = B.CreateBox('tally', { width: 0.13, height: 0.07, depth: 0.05 }, scene);
    lamp.position.set(-2.35, CAMERA_Y + 0.34, 1.35);
    lamp.rotation.y = 0.5;
    lamp.material = tally;
    const stand = B.CreateCylinder('camstand', {
        height: 1.5, diameter: 0.10, tessellation: 10,
    }, scene);
    stand.position.set(-2.35, 0.78, 1.35);
    stand.material = body.material;

    return { tally, wallMaterial, floors };
}
