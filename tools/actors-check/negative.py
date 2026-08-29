"""Break each of the cast's invariants on purpose, and prove the check catches it.

    python tools/actors-check/negative.py

============================================================
WHY THIS EXISTS
============================================================

`npm run check:actors` is 220-odd assertions and every one of them passed the
first time it was written. Five of them could not have failed:

  * three sampled `t` at four or five hand-picked values, and the movement they
    were guarding is a narrow pulse in a nine-second slot -- so the points landed
    between the pulses and the assertion passed with the guard deleted;
  * one measured a saccade's STEP SIZE to tell a jump from a drift, and the step
    it was measuring comes from the slot schedule rather than from the easing, so
    it is the same size either way;
  * one allowed 10% of slack in how far apart four fingers may be, and four sines
    on different rates are almost never that close, so it passed with one of the
    two phase offsets removed.

None of that is visible by reading the check. All five were found by breaking the
code and watching nothing happen -- which is the only way a check's teeth can be
established, and is why this is a file rather than an afternoon.

Two of the properties turned out to be guaranteed TWICE (a finger's curl by an
amplitude and a clamp; `listenNod`'s silence by an early return and a multiply),
so a case may carry SEVERAL edits: removing one of a redundant pair leaves the
property true, which is the redundancy working rather than the check failing.

It is not wired into `npm run check`. It rewrites source files and reverts them,
which is not a thing to do in a build -- run it after changing anything in
`figures.ts`, `layout.ts` or the geometry of `human.ts` / `setPieces.ts`.
"""

import io
import re
import shutil
import subprocess
import sys

# (label, file, [(find, replace), ...], the check that must fail)
#
# SEVERAL EDITS PER CASE, because two of these properties are guaranteed TWICE
# and a single edit therefore proves nothing. `listenNod` returns 0 at zero
# attention both from an early return and from its `Math.min(1, attention)`
# multiply; removing either leaves the property true, which is redundancy doing
# its job. The negative run has to remove both to show the check has teeth.
CASES = [
    ('wall hung too high', 'src/stage3d/layout.ts',
     [('export const WALL_Y = frameTopAt(WALL_Z) - 0.05 - WALL_H / 2;',
       'export const WALL_Y = frameTopAt(WALL_Z) + 0.45 - WALL_H / 2;')],
     'the video wall fits the frame at the SAFE aspect'),
    ('wall wider than the anchors', 'src/stage3d/layout.ts',
     [('export const WALL_EDGE_FRACTION = 0.715;',
       'export const WALL_EDGE_FRACTION = 0.795;')],
     'the video wall stays between the two anchors'),
    ('rig placed for the squattest frame', 'src/stage3d/layout.ts',
     [('export const RIG_ASPECT = DESIGN_ASPECT * 1.06;',
       'export const RIG_ASPECT = SAFE_ASPECT * 1.2;')],
     'the rig is placed for a taller frame than the wall is'),
    ('garment offsets out of order', 'src/stage3d/human.ts',
     [('const OUT_TIE = 0.0112 * spec.height;',
       'const OUT_TIE = 0.0012 * spec.height;')],
     'the garment offsets are declared in front-to-back order'),
    ('winding no longer verified', 'src/stage3d/human.ts',
     [('if (facing < 0) {',
       'if (facing < -1e9) {')],
     'the garment builder verifies its own winding'),
    ('a chest garment back to a blob', 'src/stage3d/human.ts',
     [('const tie = garment(`${spec.id}-tie`',
       'const tie = garment(`${spec.id}-necktie`')],
     '...and every chest garment is a surface ON the torso, not a blob near it'),
    ('the lamp height back to a literal', 'src/stage3d/setPieces.ts',
     [('barrel.position.set(side, lampY, z);',
       'barrel.position.set(side, 2.66, z);')],
     'the rig height is derived from the frame, not written down'),
    ('the finger clamp removed', 'src/stage3d/figures.ts',
     [('    const floor = -spec.curl * 0.5;\n    return value < floor ? floor : value;',
       '    void spec;\n    return value * 20;')],
     'a finger never curls backwards'),
    # BOTH offsets, because either one alone keeps them out of step.
    ('four fingers in step', 'src/stage3d/figures.ts',
     [('''    const u = t + phase * 2.7 + finger * 1.37;
    const drift = 0.5 + 0.5 * Math.sin(u * 0.41 + finger * 2.1);''',
       '''    const u = t + phase * 2.7;
    const drift = 0.5 + 0.5 * Math.sin(u * 0.41);''')],
     'the four fingers are almost never in step'),
    ('a saccade that drifts like a sine', 'src/stage3d/figures.ts',
     [('const k = smooth(at, at + SACCADE_MS / 1000, u);',
       'const k = 0.5 + 0.5 * Math.sin(u);')],
     'the eye holds still between jumps, rather than drifting'),
    ('a nod that ignores attention', 'src/stage3d/figures.ts',
     [('    if (!(attention > 0)) return 0;\n    const u = t + phase * 5.1;',
       '    const u = t + phase * 5.1;'),
      ('const nod = -NOD_RADIANS * shape * Math.min(1, attention);',
       'const nod = -NOD_RADIANS * shape;')],
     'nobody nods when nobody is speaking'),
    ('a nod that starts by lifting the chin', 'src/stage3d/figures.ts',
     [('const nod = -NOD_RADIANS * shape * Math.min(1, attention);',
       'const nod = NOD_RADIANS * shape * Math.min(1, attention);')],
     '...and it starts by dropping the chin'),
    ('a mouth that presses while speaking', 'src/stage3d/figures.ts',
     [('''    if (energy > 0) return 0;
    const u = t + phase * 8.3;''',
       '''    void energy;
    const u = t + phase * 8.3;''')],
     'the speech shapes keep sole ownership of a talking mouth'),
    ('a torso that never twists', 'src/stage3d/figures.ts',
     [('return 0.020 * Math.sin(u * 0.19 + 1.1) + 0.008 * Math.sin(u * 0.47);',
       'return 0;')],
     '...and is not a constant'),
]

FILES = sorted({c[1] for c in CASES})
for f in FILES:
    shutil.copy(f, f + '.orig')

bad = []
try:
    for label, path, edits, must_fail in CASES:
        for f in FILES:
            shutil.copy(f + '.orig', f)
        s = io.open(path, encoding='utf-8').read()
        missing = [find for find, _ in edits if find not in s]
        if missing:
            bad.append(f'{label}: the break could not be applied (pattern moved)')
            continue
        for find, repl in edits:
            s = s.replace(find, repl, 1)
        io.open(path, 'w', encoding='utf-8', newline='\n').write(s)
        run = subprocess.run(['npm', 'run', 'check:actors'], capture_output=True,
                             text=True, shell=True)
        out = run.stdout + run.stderr
        line = next((l for l in out.splitlines()
                     if must_fail in re.sub(r'\s+', ' ', l)), None)
        if line is None:
            bad.append(f'{label}: the check "{must_fail}" did not even RUN')
        elif 'FAIL' not in line:
            bad.append(f'{label}: "{must_fail}" still passed')
        else:
            print(f'  caught  {label}')
finally:
    for f in FILES:
        shutil.move(f + '.orig', f)

print()
if bad:
    for b in bad:
        print('  MISSED ', b)
    sys.exit(1)
print(f'all {len(CASES)} deliberate breaks were caught')
