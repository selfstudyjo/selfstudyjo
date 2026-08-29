#!/usr/bin/env python3
"""
Fetch the CC0 surface textures the 3D cast and the newscast set are built on.

    python tools/textures/fetch.py            # write src/assets/textures/
    python tools/textures/fetch.py --list     # say what it would fetch

CHECKED IN AND RE-RUNNABLE, on the precedent of `tools/tokenize-colors` and
`tools/i18n-wrap`: the outputs are committed binaries with no other record of
where they came from, and a texture nobody can re-derive is a texture nobody can
re-tune. Every downloaded source is from ambientCG and is CC0 / public domain --
verified per asset rather than assumed, and recorded in ATTRIBUTION.md beside
the output.

============================================================
WHY THE GARMENT MAPS ARE NORMAL-ONLY AND THE STUDIO'S ARE NOT
============================================================

A downloaded COLOUR map on a garment would replace the figure's own outfit
colour, and those colours are data (`FIGURES` in `figures.ts`): six people whose
jackets are deliberately different from each other, plus two anchors. So a
garment gets the photograph's NORMAL map, which is the weave, and keeps its own
albedo. That is also the half that actually reads as cloth -- what separates wool
from moulded plastic at this distance is how the highlight breaks up across the
surface, not the hue.

The studio's surfaces are nobody's palette -- a desk is walnut, a floor is studio
carpet, a cyclorama is painted plaster -- so those take the colour map as well,
which is where photographic colour buys the most.

============================================================
WHY NO SKIN OR FACE TEXTURE IS FETCHED
============================================================

Deliberate, and it is the one part of this file's brief that could not be
honoured as asked. Putting a photograph on a mesh means UV coordinates, and the
head is a sphere whose vertices are then moved into a face by
`sculptHeadVertex` -- the UVs it was created with are the SPHERE's, so after the
sculpt they correspond to no feature at all. A face photograph pasted on it
lands an eye on a cheek and a mouth on a jaw, at every scale, and no tuning
fixes it: it needs a feature-aligned unwrap, which is a modelling artefact
rather than a download.

`skinShadeAt` in `human.ts` already does the job a colour map would do -- darker
sockets, redder cheeks and nose, a cooler jaw -- by evaluating in the same loop,
at the same point, out of the same primitives as the sculpt, so it cannot drift
from the features. What it does not give is PORE-scale relief, and relief needs
no feature alignment at all, so that is generated here instead: fine, isotropic,
tiled. Same for hair, whose strands have to run with the head rather than with
whatever direction a photograph happened to be shot in.
"""

from __future__ import annotations

import argparse
import io
import math
import os
import sys
import urllib.request

try:
    from PIL import Image, ImageFilter, ImageStat
except ImportError:
    sys.exit('Pillow is required:  pip install pillow')

BASE = 'https://f003.backblazeb2.com/file/ambientCG-Web/media/surface-preview'
OUT = os.path.join('src', 'assets', 'textures')
UA = {'User-Agent': 'Mozilla/5.0 (selfstudyjo texture fetch)'}

# (asset id, output stem, want a colour map, normal size, colour size, note)
#
# THE SIZES ARE A BUDGET, NOT A DEFAULT. The first run of this script produced
# 1343 KB, which is most of Babylon's own chunk again for surface detail nobody
# is looking at directly, and a normal map is the expensive half: it is
# high-frequency by definition, so it resists JPEG in a way a colour map does
# not. A tiled weave repeats six to ten times across a torso, so 256 is already
# finer than the pixels it lands on; the ONE map worth 512 is the skin pore
# relief, because the face is what a viewer looks at first.
SOURCES = [
    # -- the people. Normal only; the albedo stays the figure's own outfit colour.
    ('Fabric032', 'cloth-wool', False, 256, 0,
     'suiting wool: jacket and blazer, and the tie at a lower roughness'),
    ('Fabric019', 'cloth-shirt', False, 256, 0,
     'shirt poplin: shirt, blouse, cuffs, collar'),
    # -- the studio. Colour AND normal; these surfaces are nobody's palette.
    ('PaintedPlaster017', 'studio-plaster', True, 256, 512, 'the cyclorama'),
    ('Wood058', 'studio-wood', True, 256, 512, 'the desk top'),
    ('Carpet012', 'studio-carpet', True, 256, 512, 'the studio floor'),
    ('Metal009', 'studio-metal', True, 256, 256, 'lighting rig, desk trim, bezels'),
]

GENERATED = [
    ('skin-detail-normal.jpg', 'pore relief; isotropic, tiled -- see the header'),
    ('hair-strand-normal.jpg', 'strand relief along V, so it runs with the head'),
]


def fetch(url: str) -> Image.Image:
    request = urllib.request.Request(url, headers=UA)
    with urllib.request.urlopen(request, timeout=180) as response:
        return Image.open(io.BytesIO(response.read()))


def to_opengl_normal(image: Image.Image, size: int) -> Image.Image:
    """
    ambientCG's preview normal is DIRECTX convention; Babylon reads OPENGL.

    The two differ in the sign of the green channel and in nothing else, so the
    conversion is `g -> 255 - g`. Getting it wrong does not fail and does not
    look like an inverted map: every bump is lit as a dent, and what a viewer
    sees is a strangely grubby surface. Exactly the class of silent 3D fault
    `check:actors` exists for, so it happens here, once, at fetch time -- and the
    output is named `-normal` with no convention in the name, because there is
    only ever one convention downstream of this script.
    """
    image = image.convert('RGB').resize((size, size), Image.LANCZOS)
    red, green, blue = image.split()
    return Image.merge('RGB', (red, green.point(lambda v: 255 - v), blue))


def is_flat(image: Image.Image) -> bool:
    """
    Is this normal map blank?

    ambientCG's *preview* set does not always carry usable relief, in two
    different ways, and neither is an error or looks like one -- the surface
    simply renders perfectly smooth, so a brushed metal reads as chrome and a
    walnut desk as painted MDF, with nothing anywhere saying that a map was
    applied and did nothing:

     * `Metal009` arrives as an unbroken (128, 128, 255) field at full
       resolution. There was never any relief in it.
     * `Wood058` arrives with a red-channel stddev of 22.8 at 2048 -- real grain,
       and so FINE that LANCZOS down to the 256 this ships averages it to 2.2.
       The map is genuine and the map we would ship is blank.

    Which is why this measures the image that will actually be USED, after the
    resize, and at a threshold well above the second case. A map that survives
    measurement at full resolution and not at shipping size is a blank map as
    shipped, and shipping size is the only one a viewer ever sees.
    """
    return max(ImageStat.Stat(image.convert('RGB')).stddev) < 4.0


def normal_from_colour(image: Image.Image, size: int, strength: float = 3.2) -> Image.Image:
    """
    A normal map derived from a colour map's luminance.

    Legitimate rather than a workaround for exactly the two surfaces that need
    it: on wood grain and on brushed metal the dark streaks ARE the grooves, so
    luminance is a fair height field. It would be wrong on anything whose colour
    is pigment rather than relief -- a painted stripe would come out as a trench
    -- so it is applied only where {@link is_flat} says the real map is empty.
    """
    grey = image.convert('L').resize((size, size), Image.LANCZOS)
    pixels = grey.load()
    height = [[pixels[x, y] / 255 for x in range(size)] for y in range(size)]
    return height_to_normal(height, size, strength)


def height_to_normal(height: list[list[float]], size: int, strength: float) -> Image.Image:
    """A height field as an OpenGL-convention tangent-space normal map."""
    out = Image.new('RGB', (size, size))
    pixels = out.load()
    for y in range(size):
        above = height[(y - 1) % size]
        below = height[(y + 1) % size]
        row = height[y]
        for x in range(size):
            dx = (row[(x + 1) % size] - row[(x - 1) % size]) * strength
            dy = (below[x] - above[x]) * strength
            length = math.sqrt(dx * dx + dy * dy + 1)
            pixels[x, y] = (
                int((-dx / length * 0.5 + 0.5) * 255),
                int((dy / length * 0.5 + 0.5) * 255),
                int((1 / length * 0.5 + 0.5) * 255),
            )
    # Half a pixel of blur. Without it the finest octave is one texel wide, which
    # aliases into a moire chequerboard at tile framing -- the same fault the
    # first version of `microRoughness` shipped, for the same reason.
    return out.filter(ImageFilter.GaussianBlur(0.6))


def generate_skin_detail(size: int = 512) -> Image.Image:
    """
    Pore-scale relief for skin. Generated, not downloaded -- see the header.

    Two octaves of value noise as a height field, differenced into a normal.
    Isotropic on purpose: pores have no direction, and a directional map on a
    face reads as brushed metal. Deterministic (a fixed LCG), so two runs of this
    script produce the same bytes and the committed file does not churn.
    """
    state = 0x9E3779B9

    def rand() -> float:
        nonlocal state
        state = (state * 1664525 + 1013904223) & 0xFFFFFFFF
        return ((state >> 8) & 0xFFFF) / 0xFFFF

    height = [[0.0] * size for _ in range(size)]
    # Coarse cells interpolated, then a finer layer on top. One frequency alone
    # is either a smooth blur or salt-and-pepper, and skin is neither.
    for cells, weight in ((size // 8, 0.60), (size // 2, 0.40)):
        grid = [[rand() for _ in range(cells + 1)] for _ in range(cells + 1)]
        step = size / cells
        for y in range(size):
            gy = y / step
            y0 = int(gy)
            fy = gy - y0
            fy = fy * fy * (3 - 2 * fy)
            for x in range(size):
                gx = x / step
                x0 = int(gx)
                fx = gx - x0
                fx = fx * fx * (3 - 2 * fx)
                top = grid[y0][x0] * (1 - fx) + grid[y0][x0 + 1] * fx
                bottom = grid[y0 + 1][x0] * (1 - fx) + grid[y0 + 1][x0 + 1] * fx
                height[y][x] += (top * (1 - fy) + bottom * fy) * weight
    return height_to_normal(height, size, strength=1.6)


def generate_hair_strands(size: int = 512) -> Image.Image:
    """
    Strand relief for hair, running along V.

    Hair is the one surface on a figure whose relief has a DIRECTION, and that
    direction has to follow the head rather than whatever way a photograph was
    shot -- which is the whole reason this is generated. Strands are narrow ridges
    in U at irregular spacing, each drifting slightly across the patch, because
    perfectly parallel lines read as corduroy rather than as hair.
    """
    state = 0x1F123BB5

    def rand() -> float:
        nonlocal state
        state = (state * 1103515245 + 12345) & 0xFFFFFFFF
        return ((state >> 8) & 0xFFFF) / 0xFFFF

    height = [[0.0] * size for _ in range(size)]
    # Enough strands to OVERLAP, and widths varying by 3x. The first version drew
    # size/3 of them at an even-ish spacing with strength 2.4, and what came out
    # was corduroy: a regular ridge every three pixels at full contrast. Hair is
    # irregular at every scale, so the strands are dense enough to interfere with
    # each other and the relief is much shallower.
    for _ in range(int(size * 1.6)):
        centre = rand() * size
        width = 0.9 + rand() * 3.4
        gain = 0.22 + rand() * 0.78
        drift = (rand() - 0.5) * size * 0.16
        for y in range(size):
            cx = centre + drift * (y / size)
            for x in range(int(cx - width * 2), int(cx + width * 2) + 1):
                d = abs(x - cx) / width
                if d >= 1:
                    continue
                value = (1 - d * d) ** 2 * gain
                column = x % size
                if value > height[y][column]:
                    height[y][column] = value
    return height_to_normal(height, size, strength=1.4)


def write_attribution(out: str, total: int) -> None:
    lines = [
        '# Texture provenance',
        '',
        'Written by `python tools/textures/fetch.py`. Do not hand-edit the images or',
        'this file -- re-run the script.',
        '',
        'Every downloaded source is from **ambientCG** and is **CC0 / public domain**,',
        'so no attribution is legally required. It is recorded anyway: a committed',
        'binary with no record of where it came from is one nobody can re-derive or',
        're-tune, and the next person to change a surface needs to know which of these',
        'are photographs and which are generated.',
        '',
        '| File | Source | Licence |',
        '|---|---|---|',
    ]
    for asset, stem, want_colour, _ns, _cs, note in SOURCES:
        link = '[' + asset + '](https://ambientcg.com/a/' + asset + ')'
        lines.append('| `' + stem + '-normal.jpg` | ' + link + ' -- ' + note + ' | CC0 |')
        if want_colour:
            lines.append('| `' + stem + '-colour.jpg` | ' + link + ' | CC0 |')
    for name, note in GENERATED:
        lines.append('| `' + name + '` | **generated** by the script -- ' + note + ' | n/a |')
    lines += [
        '',
        'Total ' + str(total // 1024) + ' KB. Loaded by `await import()` on the three',
        'routes that render the 3D cast and by nothing else, so the other ~55 routes',
        'download none of it -- the same rule Babylon itself follows. See',
        '`src/stage3d/textures.ts`.',
        '',
        '## Three things that are deliberate',
        '',
        '**Normal maps are OpenGL convention.** ambientCG serves DirectX; the fetch',
        'flips the green channel. An unflipped map renders every bump as a dent, which',
        'neither fails nor looks inverted -- it looks like a dirty surface.',
        '',
        '**A garment has no colour map.** Its albedo is the figure\'s own outfit colour,',
        'which is data in `figures.ts`. A photograph would overwrite six people\'s',
        'wardrobes with one jacket.',
        '',
        '**No face or skin colour texture, on purpose.** The head is a sphere whose',
        'vertices are moved into a face by `sculptHeadVertex`, so its UVs are the',
        'sphere\'s and correspond to no feature. A photograph on it puts an eye on a',
        'cheek at every scale. `skinShadeAt` does that job per vertex instead, out of',
        'the same primitives as the sculpt, so it cannot drift from the features.',
    ]
    with open(os.path.join(out, 'ATTRIBUTION.md'), 'w', encoding='utf-8') as handle:
        handle.write('\n'.join(lines) + '\n')


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument('--list', action='store_true', help='say what it would fetch')
    parser.add_argument('--out', default=OUT)
    args = parser.parse_args()

    if args.list:
        for asset, stem, colour, _ns, _cs, note in SOURCES:
            maps = 'colour+normal' if colour else 'normal'
            print(f'{asset:20} -> {stem:16} {maps:14} {note}')
        for name, note in GENERATED:
            print(f'{"(generated)":20} -> {name:16} {"normal":14} {note}')
        return 0

    os.makedirs(args.out, exist_ok=True)
    written: list[tuple[str, int]] = []

    def save(image: Image.Image, name: str, quality: int) -> None:
        path = os.path.join(args.out, name)
        # No chroma subsampling on a normal map: its three channels are a vector,
        # not a colour, and averaging two of them tilts the vector.
        image.convert('RGB').save(
            path, 'JPEG', quality=quality, optimize=True,
            subsampling=0 if 'normal' in name else 2,
        )
        size = os.path.getsize(path)
        written.append((name, size))
        print(f'  {name:34} {size // 1024:4d} KB')

    for asset, stem, want_colour, normal_size, colour_size, _note in SOURCES:
        print(f'{asset} -> {stem}')
        colour = fetch(f'{BASE}/{asset}/{asset}_SQ_Color.jpg') if want_colour else None
        normal = to_opengl_normal(fetch(f'{BASE}/{asset}/{asset}_SQ_NormalDX.jpg'), normal_size)
        if is_flat(normal):
            if colour is None:
                sys.exit(f'{asset}: its normal map is blank and there is no colour map '
                         f'to derive one from. Pick another source.')
            print('    (its normal map is blank -- deriving one from the colour)')
            normal = normal_from_colour(colour, normal_size)
        save(normal, f'{stem}-normal.jpg', 82)
        if colour is not None:
            save(colour.convert('RGB').resize((colour_size, colour_size), Image.LANCZOS),
                 f'{stem}-colour.jpg', 82)

    print('generated')
    save(generate_skin_detail(), 'skin-detail-normal.jpg', 86)
    save(generate_hair_strands(256), 'hair-strand-normal.jpg', 86)

    total = sum(size for _, size in written)
    print(f'\n{len(written)} files, {total // 1024} KB total')
    write_attribution(args.out, total)
    return 0


if __name__ == '__main__':
    sys.exit(main())
