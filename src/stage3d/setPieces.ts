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
import { CAMERA_Y, DESK_TOP_Y, DESK_Z, WALL_H, WALL_W, WALL_Y, WALL_Z } from './layout';

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
    /* Polished, and polish is roughness rather than a mirror. A real planar
       reflection means rendering the whole set again upside down every frame,
       for something at the very bottom of frame that the desk covers most of. */
    const floorMat = surface(B, scene, 'floormat', '#0a0f1e', { roughness: 0.22, metallic: 0.2 });
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
    const softbox = surface(B, scene, 'softbox', '#1c2029', { glow: '#ffdcae', flat: true });
    for (let i = 0; i < 3; i++) {
        const z = 2.6 + i * 1.6;
        const bar = B.CreateBox(`truss${i}`, { width: 11, height: 0.08, depth: 0.08 }, scene);
        bar.position.set(0, 2.85, z);
        bar.material = truss;
        for (const side of [-2.3, 0, 2.3]) {
            if (side === 0 && i !== 0) continue;
            const lamp = B.CreateBox(`lamp${i}${side}`, {
                width: 0.70, height: 0.13, depth: 0.44,
            }, scene);
            lamp.position.set(side, 2.72, z);
            lamp.rotation.x = 0.42;
            lamp.material = softbox;
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

    /* Two auxiliary panels, angled inward and further out. Depth cues: they are
       the reason the centre screen reads as an object standing in a room rather
       than a rectangle pasted onto the cyclorama. */
    for (const side of [-1, 1]) {
        const aux = B.CreatePlane(`aux${side}`, { width: 1.35, height: 0.78 }, scene);
        aux.position.set(side * 2.5, 1.85, WALL_Z - 0.55);
        // Angled inward, toward the camera. Not `PI - …`: see the screen above,
        // a plane already faces the camera and PI turns it away.
        aux.rotation.y = -side * 0.5;
        aux.material = surface(B, scene, `auxmat${side}`, '#0a1224', {
            glow: '#15376e', flat: true,
        });
    }

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
    deskMat.emissiveColor = deskMat.albedoColor.scale(0.55);
    const deskTopMat = surface(B, scene, 'desktopmat', '#243052', { roughness: 0.24, metallic: 0.3 });
    const deskGlow = surface(B, scene, 'deskglow', '#12203c', { glow: '#2f6fd8', flat: true });

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
    const lip = B.CreateBox('desklip', { width: 3.62, height: 0.05, depth: 0.15 }, scene);
    lip.position.set(0, DESK_TOP_Y - 0.22, DESK_Z - 0.005);
    lip.material = deskGlow;
    for (const side of [-1, 1]) {
        const wingLip = B.CreateBox(`desklip${side}`, { width: 1.9, height: 0.05, depth: 0.15 }, scene);
        wingLip.rotation.y = side * 0.42;
        wingLip.position.set(side * 2.55, DESK_TOP_Y - 0.22, DESK_Z + 0.355);
        wingLip.material = deskGlow;
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
