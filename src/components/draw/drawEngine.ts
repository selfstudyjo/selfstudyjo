// src/components/draw/drawEngine.ts
//
// The geometry and rendering a drawing paper needs, as a plain module rather than
// as methods on a component.
//
// It is a module for the same reason `photoMask.ts` in the CV Builder is one: this
// is the part with maths in it, and maths that lives inside a `.vue` file can only
// be checked by driving a browser. Everything here is a pure function over plain
// data and a `CanvasRenderingContext2D`, so `npm run check:drawengine` can assert
// the properties that actually matter — that a stroke simplified for the wire still
// looks like the stroke, that hit-testing an eraser finds what the user pointed at,
// and that z-ordering is stable when two collaborators insert at once.
//
// Three decisions here are load-bearing.
//
// **Points are flat `[x, y, x, y, …]`.** A hand-drawn stroke is several hundred
// points; the `{x, y}` object form roughly triples the JSON and every stroke is
// replicated to every peer and mirrored to a git repo.
//
// **Strokes are simplified before they are sent, never before they are drawn.** The
// user sees every sample they made; the wire carries the ones that change the
// shape. Simplifying on the way in would make the ink feel lossy under the pointer,
// which is the one thing a drawing tool cannot afford.
//
// **z is a float and inserting averages two neighbours.** Renumbering a scene to
// make room is a write per element, and on this backend every write replicates —
// so a single "bring forward" would push the whole scene to every peer.

export type ElementKind =
    | 'pen' | 'highlighter' | 'marker' | 'line' | 'arrow' | 'rect' | 'ellipse'
    | 'triangle' | 'diamond' | 'star' | 'text' | 'image' | 'sticky' | 'polygon';

export interface ElementData {
    points?: number[];
    stroke?: string;
    fill?: string;
    width?: number;
    opacity?: number;
    x?: number;
    y?: number;
    w?: number;
    h?: number;
    rotation?: number;
    text?: string;
    fontSize?: number;
    fontFamily?: string;
    bold?: boolean;
    italic?: boolean;
    align?: 'left' | 'center' | 'right';
    src?: string;
    dash?: number[];
    arrowStart?: boolean;
    arrowEnd?: boolean;
    sides?: number;
}

export interface SceneElement {
    element_id: string;
    kind: ElementKind;
    data: ElementData;
    z: number;
    author_id?: string;
    author_username?: string;
    deleted?: boolean;
}

export interface Box {
    x: number;
    y: number;
    w: number;
    h: number;
}

/** Kinds drawn as a free path rather than from a bounding box. */
export const FREEHAND: ElementKind[] = ['pen', 'highlighter', 'marker'];

/** Kinds dragged out from a corner. */
export const DRAGGED: ElementKind[] = [
    'line', 'arrow', 'rect', 'ellipse', 'triangle', 'diamond', 'star', 'polygon',
];

export const HIGHLIGHTER_OPACITY = 0.32;

// ---------------------------------------------------------------------------
// Points
// ---------------------------------------------------------------------------

export function isFreehand(kind: ElementKind): boolean {
    return FREEHAND.includes(kind);
}

/**
 * Drop the points that do not change a stroke's shape (Ramer–Douglas–Peucker).
 *
 * Run once, on the way to the server. A pen sampled at pointer rate produces four
 * or five points per pixel of travel; keeping them all would triple the size of
 * every paper in the data repo for ink nobody can see.
 *
 * `tolerance` is in canvas units. 0.6 is under half a pixel at 100% zoom, so the
 * simplified stroke is visually identical and typically a fifth of the points.
 */
export function simplify(points: number[], tolerance = 0.6): number[] {
    if (!points || points.length <= 6) return points ? [...points] : [];

    const count = points.length / 2;
    const keep = new Uint8Array(count);
    keep[0] = 1;
    keep[count - 1] = 1;
    const squared = tolerance * tolerance;

    // Iterative rather than recursive: a long stroke on a slow machine can be tens
    // of thousands of points, and recursion there is a stack overflow that presents
    // as the canvas silently dropping the stroke.
    const stack: [number, number][] = [[0, count - 1]];
    while (stack.length) {
        const [first, last] = stack.pop()!;
        if (last <= first + 1) continue;

        let worst = 0;
        let index = -1;
        for (let i = first + 1; i < last; i++) {
            const distance = squaredDistanceToSegment(
                points[i * 2], points[i * 2 + 1],
                points[first * 2], points[first * 2 + 1],
                points[last * 2], points[last * 2 + 1]);
            if (distance > worst) {
                worst = distance;
                index = i;
            }
        }
        if (index !== -1 && worst > squared) {
            keep[index] = 1;
            stack.push([first, index], [index, last]);
        }
    }

    const out: number[] = [];
    for (let i = 0; i < count; i++) {
        if (keep[i]) out.push(points[i * 2], points[i * 2 + 1]);
    }
    return out;
}

function squaredDistanceToSegment(px: number, py: number, ax: number, ay: number,
                                  bx: number, by: number): number {
    const dx = bx - ax;
    const dy = by - ay;
    if (dx === 0 && dy === 0) {
        return (px - ax) ** 2 + (py - ay) ** 2;
    }
    let t = ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy);
    t = Math.max(0, Math.min(1, t));
    const cx = ax + t * dx;
    const cy = ay + t * dy;
    return (px - cx) ** 2 + (py - cy) ** 2;
}

/** The distance from a point to a polyline. Used for eraser hit-testing. */
export function distanceToPolyline(points: number[], x: number, y: number): number {
    if (!points || points.length < 2) return Infinity;
    if (points.length === 2) {
        return Math.hypot(points[0] - x, points[1] - y);
    }
    let best = Infinity;
    for (let i = 0; i + 3 < points.length; i += 2) {
        const d = squaredDistanceToSegment(x, y, points[i], points[i + 1],
                                           points[i + 2], points[i + 3]);
        if (d < best) best = d;
    }
    return Math.sqrt(best);
}

// ---------------------------------------------------------------------------
// Bounds and hit-testing
// ---------------------------------------------------------------------------

export function boundsOf(element: SceneElement): Box {
    const data = element.data || {};
    if (isFreehand(element.kind) || (element.kind === 'polygon' && data.points)) {
        const points = data.points || [];
        if (points.length < 2) return { x: 0, y: 0, w: 0, h: 0 };
        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
        for (let i = 0; i + 1 < points.length; i += 2) {
            minX = Math.min(minX, points[i]);
            maxX = Math.max(maxX, points[i]);
            minY = Math.min(minY, points[i + 1]);
            maxY = Math.max(maxY, points[i + 1]);
        }
        return { x: minX, y: minY, w: maxX - minX, h: maxY - minY };
    }

    // A dragged shape can have negative width when it was drawn right-to-left.
    // Normalising here rather than at draw time keeps the stored geometry equal to
    // what the user's gesture was, which matters when two people drag the same
    // shape and the merge has to pick one.
    const x = data.x || 0;
    const y = data.y || 0;
    const w = data.w || 0;
    const h = data.h || 0;
    return {
        x: w < 0 ? x + w : x,
        y: h < 0 ? y + h : y,
        w: Math.abs(w),
        h: Math.abs(h),
    };
}

export function boxesOverlap(a: Box, b: Box): boolean {
    return !(a.x + a.w < b.x || b.x + b.w < a.x
             || a.y + a.h < b.y || b.y + b.h < a.y);
}

/**
 * Whether the eraser at (x, y) with a given radius is touching this element.
 *
 * A bounding-box test alone is wrong for the tool that matters most: a long
 * diagonal pen stroke has a huge box that is almost entirely empty, so erasing
 * anywhere near it would delete it. The box is used only as a cheap reject, and a
 * freehand stroke is then tested against its actual path.
 */
export function hitTest(element: SceneElement, x: number, y: number,
                        radius = 8): boolean {
    const box = boundsOf(element);
    const padding = radius + (element.data?.width || 2);
    if (x < box.x - padding || x > box.x + box.w + padding
        || y < box.y - padding || y > box.y + box.h + padding) {
        return false;
    }
    if (isFreehand(element.kind) || element.kind === 'polygon') {
        return distanceToPolyline(element.data?.points || [], x, y)
            <= padding;
    }
    if (element.kind === 'line' || element.kind === 'arrow') {
        const data = element.data || {};
        return distanceToPolyline(
            [data.x || 0, data.y || 0,
             (data.x || 0) + (data.w || 0), (data.y || 0) + (data.h || 0)],
            x, y) <= padding;
    }
    return true;
}

export function elementsAt(elements: SceneElement[], x: number, y: number,
                           radius = 8): SceneElement[] {
    // Topmost first, so a click selects what the user can see rather than what is
    // buried under it.
    return elements.filter(e => !e.deleted && hitTest(e, x, y, radius))
        .sort((a, b) => b.z - a.z);
}

// ---------------------------------------------------------------------------
// Ordering
// ---------------------------------------------------------------------------

/**
 * A z that puts an element between two others without renumbering the scene.
 *
 * Every write on this backend replicates to every peer, so renumbering to make room
 * would turn one "bring forward" into a push of the entire scene. Averaging costs
 * one write. Floats do run out of precision after ~50 consecutive inserts in the
 * same gap, which is why `nextZ` is what a *new* element uses — this is only for a
 * deliberate reorder.
 */
export function zBetween(below: number | null, above: number | null): number {
    if (below === null && above === null) return 0;
    if (below === null) return (above as number) - 1;
    if (above === null) return below + 1;
    return (below + above) / 2;
}

export function nextZ(elements: SceneElement[]): number {
    let highest = 0;
    for (const element of elements) {
        if (!element.deleted && element.z > highest) highest = element.z;
    }
    return highest + 1;
}

/**
 * Scene order: by z, then by element id.
 *
 * The id tiebreak is what makes the order **identical on every participant's
 * screen**. Two people drawing at the same moment can mint the same z — they each
 * computed it from a scene that did not yet have the other's stroke — and without a
 * deterministic tiebreak the two browsers would stack that pair differently, so the
 * same paper would look different to each of them. Sorting on a string id is
 * arbitrary but it is the same arbitrary everywhere.
 */
export function sortScene(elements: SceneElement[]): SceneElement[] {
    return [...elements].sort((a, b) =>
        a.z - b.z || (a.element_id < b.element_id ? -1
                      : a.element_id > b.element_id ? 1 : 0));
}

/**
 * Fold an incremental live update into the scene held in the browser.
 *
 * Keyed on `element_id`, which is why the client mints it: an element that arrives
 * twice — a re-pushed peer window, a retried save — replaces itself instead of
 * appearing twice. A `deleted` record removes it, because that is how an eraser
 * travels; without honouring it a collaborator would keep a stroke somebody else
 * had rubbed out.
 *
 * Returns a new array; it never mutates the input, so Vue's reactivity sees the
 * change as one assignment rather than as N splices.
 */
export function applyDelta(scene: SceneElement[],
                           incoming: SceneElement[]): SceneElement[] {
    if (!incoming || !incoming.length) return scene;
    const byId = new Map(scene.map(e => [e.element_id, e]));
    for (const element of incoming) {
        if (!element || !element.element_id) continue;
        if (element.deleted) byId.delete(element.element_id);
        else byId.set(element.element_id, element);
    }
    return sortScene([...byId.values()]);
}

// ---------------------------------------------------------------------------
// Rendering
// ---------------------------------------------------------------------------

export interface BackgroundOptions {
    kind: string;
    width: number;
    height: number;
    colour: string;
}

const GRID = 40;

export function drawBackground(ctx: CanvasRenderingContext2D,
                              options: BackgroundOptions): void {
    const { kind, width, height, colour } = options;
    ctx.save();
    ctx.fillStyle = colour || '#ffffff';
    ctx.fillRect(0, 0, width, height);

    ctx.strokeStyle = 'rgba(37, 99, 235, 0.14)';
    ctx.lineWidth = 1;

    if (kind === 'grid' || kind === 'graph') {
        const step = kind === 'graph' ? GRID / 4 : GRID;
        ctx.beginPath();
        for (let x = step; x < width; x += step) {
            ctx.moveTo(x, 0);
            ctx.lineTo(x, height);
        }
        for (let y = step; y < height; y += step) {
            ctx.moveTo(0, y);
            ctx.lineTo(width, y);
        }
        ctx.stroke();
        if (kind === 'graph') {
            // The heavier every-fifth line is what makes graph paper readable;
            // without it a 10px grid is a grey wash.
            ctx.strokeStyle = 'rgba(37, 99, 235, 0.26)';
            ctx.beginPath();
            for (let x = GRID; x < width; x += GRID) {
                ctx.moveTo(x, 0);
                ctx.lineTo(x, height);
            }
            for (let y = GRID; y < height; y += GRID) {
                ctx.moveTo(0, y);
                ctx.lineTo(width, y);
            }
            ctx.stroke();
        }
    } else if (kind === 'lined') {
        ctx.beginPath();
        for (let y = GRID; y < height; y += GRID) {
            ctx.moveTo(0, y);
            ctx.lineTo(width, y);
        }
        ctx.stroke();
        ctx.strokeStyle = 'rgba(220, 38, 38, 0.3)';
        ctx.beginPath();
        ctx.moveTo(GRID * 2, 0);
        ctx.lineTo(GRID * 2, height);
        ctx.stroke();
    } else if (kind === 'dots') {
        ctx.fillStyle = 'rgba(37, 99, 235, 0.3)';
        for (let x = GRID; x < width; x += GRID) {
            for (let y = GRID; y < height; y += GRID) {
                ctx.beginPath();
                ctx.arc(x, y, 1.6, 0, Math.PI * 2);
                ctx.fill();
            }
        }
    } else if (kind === 'music') {
        // Five-line staves, grouped, because a single repeating line is unusable
        // for the thing this background exists for.
        const gap = 12;
        const staveHeight = gap * 4;
        for (let top = GRID; top + staveHeight < height; top += staveHeight + GRID) {
            ctx.beginPath();
            for (let i = 0; i < 5; i++) {
                ctx.moveTo(GRID, top + i * gap);
                ctx.lineTo(width - GRID, top + i * gap);
            }
            ctx.stroke();
        }
    } else if (kind === 'isometric') {
        const step = GRID;
        ctx.beginPath();
        for (let x = -height; x < width + height; x += step) {
            ctx.moveTo(x, 0);
            ctx.lineTo(x + height * Math.tan(Math.PI / 6), height);
            ctx.moveTo(x, 0);
            ctx.lineTo(x - height * Math.tan(Math.PI / 6), height);
        }
        ctx.stroke();
    }
    ctx.restore();
}

export function drawElement(ctx: CanvasRenderingContext2D, element: SceneElement,
                            images?: Map<string, HTMLImageElement>): void {
    const data = element.data || {};
    ctx.save();
    ctx.globalAlpha = data.opacity !== undefined ? data.opacity
        : element.kind === 'highlighter' ? HIGHLIGHTER_OPACITY : 1;
    ctx.strokeStyle = data.stroke || '#111827';
    ctx.fillStyle = data.fill || 'transparent';
    ctx.lineWidth = data.width || 3;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    if (data.dash && data.dash.length) ctx.setLineDash(data.dash);

    const box = boundsOf(element);
    if (data.rotation) {
        // Rotate about the centre, not the origin: rotating about (0, 0) moves the
        // shape across the page as well as turning it, which reads as a bug.
        ctx.translate(box.x + box.w / 2, box.y + box.h / 2);
        ctx.rotate(data.rotation);
        ctx.translate(-(box.x + box.w / 2), -(box.y + box.h / 2));
    }

    switch (element.kind) {
        case 'pen':
        case 'marker':
        case 'highlighter':
            strokePath(ctx, data.points || []);
            break;
        case 'polygon':
            strokePath(ctx, data.points || [], true);
            if (data.fill && data.fill !== 'transparent') ctx.fill();
            ctx.stroke();
            break;
        case 'line':
            ctx.beginPath();
            ctx.moveTo(data.x || 0, data.y || 0);
            ctx.lineTo((data.x || 0) + (data.w || 0), (data.y || 0) + (data.h || 0));
            ctx.stroke();
            break;
        case 'arrow':
            drawArrow(ctx, data);
            break;
        case 'rect':
            if (data.fill && data.fill !== 'transparent') {
                ctx.fillRect(box.x, box.y, box.w, box.h);
            }
            ctx.strokeRect(box.x, box.y, box.w, box.h);
            break;
        case 'ellipse':
            ctx.beginPath();
            ctx.ellipse(box.x + box.w / 2, box.y + box.h / 2,
                        Math.abs(box.w / 2), Math.abs(box.h / 2), 0, 0, Math.PI * 2);
            if (data.fill && data.fill !== 'transparent') ctx.fill();
            ctx.stroke();
            break;
        case 'triangle':
            polygonPath(ctx, [
                [box.x + box.w / 2, box.y],
                [box.x + box.w, box.y + box.h],
                [box.x, box.y + box.h],
            ]);
            if (data.fill && data.fill !== 'transparent') ctx.fill();
            ctx.stroke();
            break;
        case 'diamond':
            polygonPath(ctx, [
                [box.x + box.w / 2, box.y],
                [box.x + box.w, box.y + box.h / 2],
                [box.x + box.w / 2, box.y + box.h],
                [box.x, box.y + box.h / 2],
            ]);
            if (data.fill && data.fill !== 'transparent') ctx.fill();
            ctx.stroke();
            break;
        case 'star':
            polygonPath(ctx, starPoints(box, data.sides || 5));
            if (data.fill && data.fill !== 'transparent') ctx.fill();
            ctx.stroke();
            break;
        case 'sticky':
            drawSticky(ctx, box, data);
            break;
        case 'text':
            drawText(ctx, data);
            break;
        case 'image':
            drawImage(ctx, box, data, images);
            break;
    }
    ctx.restore();
}

function strokePath(ctx: CanvasRenderingContext2D, points: number[],
                    pathOnly = false): void {
    if (points.length < 2) return;
    ctx.beginPath();
    if (points.length === 2) {
        // A single tap. Drawn as a dot rather than skipped: tapping a pen on paper
        // leaves a mark, and a stroke that silently does nothing feels broken.
        ctx.arc(points[0], points[1], Math.max(ctx.lineWidth / 2, 0.75), 0,
                Math.PI * 2);
        if (!pathOnly) {
            ctx.fillStyle = ctx.strokeStyle;
            ctx.fill();
        }
        return;
    }
    ctx.moveTo(points[0], points[1]);
    // Quadratic through the midpoints: a polyline through raw pointer samples looks
    // faceted at any real stroke width, and this costs nothing per point.
    for (let i = 2; i + 3 < points.length; i += 2) {
        const midX = (points[i] + points[i + 2]) / 2;
        const midY = (points[i + 1] + points[i + 3]) / 2;
        ctx.quadraticCurveTo(points[i], points[i + 1], midX, midY);
    }
    ctx.lineTo(points[points.length - 2], points[points.length - 1]);
    if (!pathOnly) ctx.stroke();
}

function polygonPath(ctx: CanvasRenderingContext2D, points: number[][]): void {
    ctx.beginPath();
    points.forEach(([x, y], index) => {
        if (index === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
    });
    ctx.closePath();
}

function starPoints(box: Box, spikes: number): number[][] {
    const cx = box.x + box.w / 2;
    const cy = box.y + box.h / 2;
    const outerX = box.w / 2;
    const outerY = box.h / 2;
    const out: number[][] = [];
    for (let i = 0; i < spikes * 2; i++) {
        const ratio = i % 2 === 0 ? 1 : 0.42;
        const angle = (Math.PI / spikes) * i - Math.PI / 2;
        out.push([cx + Math.cos(angle) * outerX * ratio,
                  cy + Math.sin(angle) * outerY * ratio]);
    }
    return out;
}

function drawArrow(ctx: CanvasRenderingContext2D, data: ElementData): void {
    const x1 = data.x || 0;
    const y1 = data.y || 0;
    const x2 = x1 + (data.w || 0);
    const y2 = y1 + (data.h || 0);
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();

    const size = Math.max(10, (data.width || 3) * 3.2);
    const angle = Math.atan2(y2 - y1, x2 - x1);
    const headAt = (x: number, y: number, direction: number) => {
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x - size * Math.cos(angle - 0.4) * direction,
                   y - size * Math.sin(angle - 0.4) * direction);
        ctx.moveTo(x, y);
        ctx.lineTo(x - size * Math.cos(angle + 0.4) * direction,
                   y - size * Math.sin(angle + 0.4) * direction);
        ctx.stroke();
    };
    if (data.arrowEnd !== false) headAt(x2, y2, 1);
    if (data.arrowStart) headAt(x1, y1, -1);
}

function drawSticky(ctx: CanvasRenderingContext2D, box: Box,
                    data: ElementData): void {
    ctx.save();
    ctx.shadowColor = 'rgba(15, 23, 42, 0.18)';
    ctx.shadowBlur = 10;
    ctx.shadowOffsetY = 3;
    ctx.fillStyle = data.fill || '#fef08a';
    ctx.fillRect(box.x, box.y, box.w, box.h);
    ctx.restore();

    if (data.text) {
        const size = data.fontSize || 16;
        ctx.fillStyle = data.stroke || '#1f2937';
        ctx.font = `${size}px ${data.fontFamily || 'Inter, system-ui, sans-serif'}`;
        ctx.textBaseline = 'top';
        wrapText(ctx, data.text, box.x + 10, box.y + 10, box.w - 20, size * 1.35);
    }
}

function drawText(ctx: CanvasRenderingContext2D, data: ElementData): void {
    const size = data.fontSize || 22;
    const weight = data.bold ? '700 ' : '';
    const style = data.italic ? 'italic ' : '';
    ctx.font = `${style}${weight}${size}px ${data.fontFamily || 'Inter, system-ui, sans-serif'}`;
    ctx.fillStyle = data.stroke || '#111827';
    ctx.textBaseline = 'top';
    ctx.textAlign = data.align || 'left';
    const lineHeight = size * 1.3;
    const width = data.w && data.w > 20 ? data.w : Infinity;
    wrapText(ctx, data.text || '', data.x || 0, data.y || 0, width, lineHeight);
}

/** Word wrap, and the reason text elements carry a width at all. Without wrapping,
 *  a paragraph typed onto a paper runs off the edge and is unrecoverable — the user
 *  cannot see where to click to fix it. */
export function wrapText(ctx: CanvasRenderingContext2D, text: string, x: number,
                         y: number, maxWidth: number, lineHeight: number): void {
    const paragraphs = String(text || '').split('\n');
    let cursorY = y;
    for (const paragraph of paragraphs) {
        if (maxWidth === Infinity) {
            ctx.fillText(paragraph, x, cursorY);
            cursorY += lineHeight;
            continue;
        }
        let line = '';
        for (const word of paragraph.split(' ')) {
            const candidate = line ? `${line} ${word}` : word;
            if (ctx.measureText(candidate).width > maxWidth && line) {
                ctx.fillText(line, x, cursorY);
                cursorY += lineHeight;
                line = word;
            } else {
                line = candidate;
            }
        }
        if (line) {
            ctx.fillText(line, x, cursorY);
            cursorY += lineHeight;
        }
    }
}

function drawImage(ctx: CanvasRenderingContext2D, box: Box, data: ElementData,
                   images?: Map<string, HTMLImageElement>): void {
    const src = data.src || '';
    const image = images?.get(src);
    if (image && image.complete && image.naturalWidth) {
        ctx.drawImage(image, box.x, box.y, box.w, box.h);
        return;
    }
    // A placeholder rather than nothing, so a slow-loading image does not look like
    // a stroke that failed to replicate.
    ctx.save();
    ctx.setLineDash([6, 4]);
    ctx.strokeStyle = 'rgba(100, 116, 139, 0.6)';
    ctx.strokeRect(box.x, box.y, box.w, box.h);
    ctx.restore();
}

/** The dashed outline and handles round a selected element. */
export function drawSelection(ctx: CanvasRenderingContext2D, box: Box,
                              scale = 1): void {
    const pad = 6 / scale;
    ctx.save();
    ctx.setLineDash([5 / scale, 4 / scale]);
    ctx.strokeStyle = '#2563eb';
    ctx.lineWidth = 1.5 / scale;
    ctx.strokeRect(box.x - pad, box.y - pad, box.w + pad * 2, box.h + pad * 2);
    ctx.setLineDash([]);
    ctx.fillStyle = '#2563eb';
    const size = 7 / scale;
    for (const [hx, hy] of [
        [box.x - pad, box.y - pad],
        [box.x + box.w + pad, box.y - pad],
        [box.x - pad, box.y + box.h + pad],
        [box.x + box.w + pad, box.y + box.h + pad],
    ]) {
        ctx.fillRect(hx - size / 2, hy - size / 2, size, size);
    }
    ctx.restore();
}

/** Another participant's pointer, with their name.
 *
 *  Drawn in canvas units and un-scaled by the caller's zoom, so a cursor stays the
 *  same size on screen however far the viewer has zoomed in — a cursor that grew
 *  with the zoom would cover the drawing at 400%. */
export function drawCursor(ctx: CanvasRenderingContext2D, x: number, y: number,
                          label: string, colour: string, scale = 1): void {
    const s = 1 / scale;
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(s, s);

    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(0, 17);
    ctx.lineTo(4.5, 12.5);
    ctx.lineTo(11, 11);
    ctx.closePath();
    ctx.fillStyle = colour;
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 1.4;
    ctx.fill();
    ctx.stroke();

    if (label) {
        ctx.font = '600 11px Inter, system-ui, sans-serif';
        const width = ctx.measureText(label).width + 12;
        ctx.fillStyle = colour;
        roundRect(ctx, 12, 12, width, 18, 5);
        ctx.fill();
        ctx.fillStyle = '#ffffff';
        ctx.textBaseline = 'middle';
        ctx.fillText(label, 18, 22);
    }
    ctx.restore();
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number,
                   w: number, h: number, r: number): void {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
}

/**
 * Render a whole scene. The one function the canvas component calls per frame.
 *
 * Sorted here rather than trusting the caller, because the order is what makes two
 * participants see the same picture — see `sortScene`.
 */
export function renderScene(ctx: CanvasRenderingContext2D, elements: SceneElement[],
                            options: BackgroundOptions,
                            images?: Map<string, HTMLImageElement>): void {
    drawBackground(ctx, options);
    for (const element of sortScene(elements)) {
        if (element.deleted) continue;
        drawElement(ctx, element, images);
    }
}

/** Move a whole element by a delta, whatever kind it is.
 *
 *  Freehand strokes have to have every point shifted; a dragged shape only its
 *  origin. Keeping that in one place is what stops "drag" working for rectangles
 *  and silently doing nothing for pen strokes. */
export function translateElement(element: SceneElement, dx: number,
                                 dy: number): SceneElement {
    const data: ElementData = { ...(element.data || {}) };
    if (data.points && data.points.length) {
        const points = [...data.points];
        for (let i = 0; i + 1 < points.length; i += 2) {
            points[i] += dx;
            points[i + 1] += dy;
        }
        data.points = points;
    } else {
        data.x = (data.x || 0) + dx;
        data.y = (data.y || 0) + dy;
    }
    return { ...element, data };
}
