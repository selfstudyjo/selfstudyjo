# Texture provenance

Written by `python tools/textures/fetch.py`. Do not hand-edit the images or
this file -- re-run the script.

Every downloaded source is from **ambientCG** and is **CC0 / public domain**,
so no attribution is legally required. It is recorded anyway: a committed
binary with no record of where it came from is one nobody can re-derive or
re-tune, and the next person to change a surface needs to know which of these
are photographs and which are generated.

| File | Source | Licence |
|---|---|---|
| `cloth-wool-normal.jpg` | [Fabric032](https://ambientcg.com/a/Fabric032) -- suiting wool: jacket and blazer, and the tie at a lower roughness | CC0 |
| `cloth-shirt-normal.jpg` | [Fabric019](https://ambientcg.com/a/Fabric019) -- shirt poplin: shirt, blouse, cuffs, collar | CC0 |
| `studio-plaster-normal.jpg` | [PaintedPlaster017](https://ambientcg.com/a/PaintedPlaster017) -- the cyclorama | CC0 |
| `studio-plaster-colour.jpg` | [PaintedPlaster017](https://ambientcg.com/a/PaintedPlaster017) | CC0 |
| `studio-wood-normal.jpg` | [Wood058](https://ambientcg.com/a/Wood058) -- the desk top | CC0 |
| `studio-wood-colour.jpg` | [Wood058](https://ambientcg.com/a/Wood058) | CC0 |
| `studio-carpet-normal.jpg` | [Carpet012](https://ambientcg.com/a/Carpet012) -- the studio floor | CC0 |
| `studio-carpet-colour.jpg` | [Carpet012](https://ambientcg.com/a/Carpet012) | CC0 |
| `studio-metal-normal.jpg` | [Metal009](https://ambientcg.com/a/Metal009) -- lighting rig, desk trim, bezels | CC0 |
| `studio-metal-colour.jpg` | [Metal009](https://ambientcg.com/a/Metal009) | CC0 |
| `skin-detail-normal.jpg` | **generated** by the script -- pore relief; isotropic, tiled -- see the header | n/a |
| `hair-strand-normal.jpg` | **generated** by the script -- strand relief along V, so it runs with the head | n/a |

Total 426 KB. Loaded by `await import()` on the three
routes that render the 3D cast and by nothing else, so the other ~55 routes
download none of it -- the same rule Babylon itself follows. See
`src/stage3d/textures.ts`.

## Three things that are deliberate

**Normal maps are OpenGL convention.** ambientCG serves DirectX; the fetch
flips the green channel. An unflipped map renders every bump as a dent, which
neither fails nor looks inverted -- it looks like a dirty surface.

**A garment has no colour map.** Its albedo is the figure's own outfit colour,
which is data in `figures.ts`. A photograph would overwrite six people's
wardrobes with one jacket.

**No face or skin colour texture, on purpose.** The head is a sphere whose
vertices are moved into a face by `sculptHeadVertex`, so its UVs are the
sphere's and correspond to no feature. A photograph on it puts an eye on a
cheek at every scale. `skinShadeAt` does that job per vertex instead, out of
the same primitives as the sculpt, so it cannot drift from the features.
