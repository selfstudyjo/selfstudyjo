// Verifies src/components/draw/drawEngine.ts without a browser.
//
//   npm run check:drawengine
//
// The engine is a plain module for exactly this reason. What is checked here is the
// handful of properties that are invisible until they are wrong in front of a class
// of students:
//
// * a stroke simplified for the wire still looks like the stroke;
// * the eraser deletes what the user pointed at and not the whole diagonal stroke
//   whose bounding box happens to cover half the page;
// * two participants who drew at the same moment see the same stacking order;
// * a live delta folds in by id, so a re-delivered stroke does not double and an
//   erased one actually goes.

import {
    applyDelta, boundsOf, distanceToPolyline, elementsAt, hitTest, nextZ,
    simplify, sortScene, translateElement, zBetween,
    type SceneElement,
} from '../../src/components/draw/drawEngine';

let failures = 0;

function check(label: string, ok: boolean, detail: any = '') {
    console.log(`  ${ok ? 'ok  ' : 'FAIL'}  ${label}${ok ? '' : '  ' + JSON.stringify(detail)}`);
    if (!ok) failures++;
}

function pen(id: string, points: number[], z = 0): SceneElement {
    return { element_id: id, kind: 'pen', data: { points, width: 3 }, z };
}

function rect(id: string, x: number, y: number, w: number, h: number, z = 0): SceneElement {
    return { element_id: id, kind: 'rect', data: { x, y, w, h, width: 2 }, z };
}

console.log('\n1. Simplifying a stroke for the wire');
{
    // A straight line sampled densely: every interior point is redundant.
    const straight: number[] = [];
    for (let i = 0; i <= 200; i++) straight.push(i, i);
    const thin = simplify(straight);
    check('a dense straight line collapses to its endpoints', thin.length === 4, thin.length);
    check('and keeps the first point', thin[0] === 0 && thin[1] === 0, thin.slice(0, 2));
    check('and the last', thin[thin.length - 2] === 200 && thin[thin.length - 1] === 200,
          thin.slice(-2));

    // A zigzag: every vertex changes the shape, so none may be dropped.
    const zigzag: number[] = [];
    for (let i = 0; i < 40; i++) zigzag.push(i * 10, i % 2 === 0 ? 0 : 60);
    check('a zigzag keeps every vertex', simplify(zigzag).length === zigzag.length,
          [simplify(zigzag).length, zigzag.length]);

    // The property that matters: the simplified stroke still traces the original.
    const curve: number[] = [];
    for (let i = 0; i <= 300; i++) curve.push(i, Math.sin(i / 24) * 50);
    const simplified = simplify(curve, 0.6);
    let worst = 0;
    for (let i = 0; i + 1 < curve.length; i += 2) {
        worst = Math.max(worst, distanceToPolyline(simplified, curve[i], curve[i + 1]));
    }
    check('a simplified curve never strays past the tolerance', worst <= 0.8, worst);
    check('and it is much smaller', simplified.length < curve.length / 3,
          [simplified.length, curve.length]);

    check('a short stroke is left alone', simplify([0, 0, 1, 1]).length === 4);
    check('an empty stroke does not throw', simplify([]).length === 0);
    check('simplify does not mutate its input',
          (() => { const p = [0, 0, 5, 5, 10, 10]; simplify(p); return p.length === 6; })());
}

console.log('\n2. Bounds');
{
    check('a freehand stroke is bounded by its points',
          JSON.stringify(boundsOf(pen('a', [10, 20, 60, 90]))) ===
          JSON.stringify({ x: 10, y: 20, w: 50, h: 70 }));

    // Dragged right-to-left, so w and h are negative on the record.
    const backwards = boundsOf(rect('b', 100, 100, -60, -40));
    check('a shape dragged backwards still has positive bounds',
          backwards.x === 40 && backwards.y === 60 && backwards.w === 60 && backwards.h === 40,
          backwards);
}

console.log('\n3. The eraser');
{
    // The case a bounding-box test gets wrong: a long diagonal whose box covers a
    // huge empty area.
    const diagonal = pen('diag', [0, 0, 400, 400]);
    check('the eraser hits the stroke on its path', hitTest(diagonal, 200, 200, 8));
    check('and misses the empty corner of its bounding box',
          !hitTest(diagonal, 380, 20, 8),
          'a box test alone would delete the stroke from here');
    check('it hits just off the path, within the radius',
          hitTest(diagonal, 200, 206, 8));
    check('and misses well away from it', !hitTest(diagonal, 200, 260, 8));

    const filled = rect('r', 0, 0, 100, 100);
    check('a shape is hit anywhere inside it', hitTest(filled, 50, 50, 8));
    check('and not outside it', !hitTest(filled, 200, 200, 8));

    const tap = pen('tap', [50, 50]);
    check('a single-point tap can still be erased', hitTest(tap, 52, 52, 8));

    const scene = [pen('under', [0, 0, 100, 100], 1), rect('over', 0, 0, 100, 100, 5)];
    const found = elementsAt(scene, 50, 50);
    check('elementsAt returns the topmost first', found[0].element_id === 'over',
          found.map(e => e.element_id));
    check('and finds both', found.length === 2, found.length);
    check('a deleted element is never hit',
          elementsAt([{ ...filled, deleted: true }], 50, 50).length === 0);
}

console.log('\n4. Ordering, and why two people see the same picture');
{
    check('nextZ goes above everything', nextZ([pen('a', [], 3), pen('b', [], 7)]) === 8);
    check('nextZ ignores erased elements',
          nextZ([pen('a', [], 3), { ...pen('b', [], 99), deleted: true }]) === 4);
    check('nextZ on an empty scene is 1', nextZ([]) === 1);

    check('zBetween lands between its neighbours', zBetween(1, 2) === 1.5);
    check('zBetween below everything', zBetween(null, 5) === 4);
    check('zBetween above everything', zBetween(5, null) === 6);
    check('zBetween on an empty scene', zBetween(null, null) === 0);

    // The collision two collaborators actually produce: each computed z from a scene
    // that did not yet contain the other's stroke, so both minted the same number.
    const drawnAtOnce = [pen('zebra', [], 4), pen('apple', [], 4), pen('mango', [], 4)];
    const mine = sortScene(drawnAtOnce).map(e => e.element_id);
    const theirs = sortScene([...drawnAtOnce].reverse()).map(e => e.element_id);
    check('an equal z is broken deterministically by id',
          JSON.stringify(mine) === JSON.stringify(theirs), [mine, theirs]);
    check('and that order is the same whatever the arrival order was',
          JSON.stringify(mine) === JSON.stringify(['apple', 'mango', 'zebra']), mine);
    check('sortScene does not mutate its input',
          drawnAtOnce[0].element_id === 'zebra');
}

console.log('\n5. Folding in a live delta');
{
    const scene = [pen('a', [0, 0, 10, 10], 1), pen('b', [0, 0, 20, 20], 2)];

    const added = applyDelta(scene, [pen('c', [5, 5, 6, 6], 3)]);
    check("a collaborator's new stroke is added", added.length === 3, added.length);

    const twice = applyDelta(added, [pen('c', [5, 5, 6, 6], 3)]);
    check('the same stroke delivered twice does not double', twice.length === 3,
          twice.length);

    const edited = applyDelta(added, [pen('a', [0, 0, 99, 99], 1)]);
    const a = edited.find(e => e.element_id === 'a')!;
    check('an edited stroke replaces rather than appends',
          edited.length === 3 && a.data.points![2] === 99, [edited.length, a.data.points]);

    const erased = applyDelta(added, [{ element_id: 'b', kind: 'pen', data: {}, z: 0, deleted: true }]);
    check('a tombstone removes the stroke',
          erased.length === 2 && !erased.some(e => e.element_id === 'b'),
          erased.map(e => e.element_id));
    check('erasing something already gone is harmless',
          applyDelta(erased, [{ element_id: 'b', kind: 'pen', data: {}, z: 0, deleted: true }])
              .length === 2);

    check('an empty delta returns the scene unchanged', applyDelta(scene, []) === scene);
    check('a malformed record is skipped, not stored',
          applyDelta(scene, [null as any, { kind: 'pen' } as any]).length === 2);
    check('applyDelta does not mutate the original scene', scene.length === 2);
    check('the result comes back in scene order',
          applyDelta(scene, [pen('z', [], 0.5)]).map(e => e.z)
              .every((z, i, all) => i === 0 || all[i - 1] <= z));
}

console.log('\n6. Moving an element');
{
    const moved = translateElement(pen('a', [10, 10, 20, 20]), 5, -5);
    check('every point of a freehand stroke moves',
          JSON.stringify(moved.data.points) === JSON.stringify([15, 5, 25, 15]),
          moved.data.points);

    const shape = translateElement(rect('b', 100, 100, 50, 50), -10, 20);
    check('a dragged shape moves by its origin',
          shape.data.x === 90 && shape.data.y === 120, shape.data);
    check('and keeps its size', shape.data.w === 50 && shape.data.h === 50, shape.data);

    const original = pen('c', [1, 2, 3, 4]);
    translateElement(original, 100, 100);
    check('translate does not mutate its input',
          JSON.stringify(original.data.points) === JSON.stringify([1, 2, 3, 4]),
          original.data.points);
}

console.log(failures ? `\n${failures} failed\n` : '\nAll checks passed.\n');
process.exit(failures ? 1 : 0);
