/**
 * The plain half of the Roblox Studio portal: value formatting, the UI layout
 * maths and the isometric projection. No Vue, no DOM.
 *
 * The UI layout here is the SAME arithmetic as `ui_check` in app 11's
 * `utils/sims/roblox/__init__.py` (Scale times the parent plus Offset, minus
 * AnchorPoint times the size), so what the viewport draws is what the UI check
 * measures.
 */

export type Raw = any;

export interface RsNode {
    id: number;
    class: string;
    name: string;
    path: string;
    depth: number;
    parent: number | null;
    children: number[];
    props: Record<string, string>;
    raw: Record<string, Raw>;
    attributes: Record<string, unknown>;
    tags: string[];
    source_file?: string;
}

export const SERVICES = ['Workspace', 'Players', 'Lighting', 'ReplicatedFirst', 'ReplicatedStorage',
    'ServerScriptService', 'ServerStorage', 'StarterGui', 'StarterPack', 'StarterPlayer', 'Teams',
    'SoundService', 'TextChatService'];

export const PART_CLASSES = ['Part', 'SpawnLocation', 'MeshPart', 'WedgePart', 'CornerWedgePart', 'TrussPart'];
export const GUI_CLASSES = ['Frame', 'ScrollingFrame', 'TextLabel', 'TextButton', 'TextBox', 'ImageLabel',
    'ImageButton'];
export const SCRIPT_CLASSES = ['Script', 'LocalScript', 'ModuleScript'];

export function isPart(cls: string): boolean {
    return PART_CLASSES.includes(cls);
}

export function isGui(cls: string): boolean {
    return GUI_CLASSES.includes(cls);
}

/** A raw stored value as the text the Properties window edits. */
export function rawText(raw: Raw, refPath?: (id: number) => string): string {
    if (raw === null || raw === undefined) return '';
    if (typeof raw === 'boolean') return raw ? 'true' : 'false';
    if (typeof raw === 'number') return fmt(raw);
    if (typeof raw === 'string') return raw;
    if (typeof raw === 'object' && raw.t) {
        switch (raw.t) {
            case 'Vector3': case 'Vector2': case 'UDim2': case 'UDim': case 'NumberRange':
                return (raw.v as number[]).map(fmt).join(', ');
            case 'Color3': return (raw.v as number[]).join(', ');
            case 'Enum': case 'BrickColor': return String(raw.v);
            case 'Ref': return refPath ? refPath(raw.v) : '';
            default: return '';
        }
    }
    return String(raw);
}

export function fmt(n: number): string {
    if (!Number.isFinite(n)) return String(n);
    const r = Math.round(n * 1000) / 1000;
    return String(r);
}

export function color(raw: Raw, fallback = '#a3a2a5'): string {
    if (raw && raw.t === 'Color3' && Array.isArray(raw.v)) {
        return '#' + raw.v.map((x: number) => Math.max(0, Math.min(255, Math.round(x)))
            .toString(16).padStart(2, '0')).join('');
    }
    return fallback;
}

export function hexToRgb(hex: string): string {
    const h = hex.replace('#', '');
    return [0, 2, 4].map(i => parseInt(h.slice(i, i + 2), 16) || 0).join(',');
}

export function vec(raw: Raw, fallback: number[]): number[] {
    return raw && Array.isArray(raw.v) ? raw.v.map(Number) : fallback;
}

/** UTF-8 safe base64, for `studio edit PATH --b64 ...`. */
export function toBase64(text: string): string {
    const bytes = new TextEncoder().encode(text);
    let binary = '';
    for (let i = 0; i < bytes.length; i += 1) binary += String.fromCharCode(bytes[i]);
    return btoa(binary);
}

// ---------------------------------------------------------------------------
// The isometric viewport
// ---------------------------------------------------------------------------

export interface Face { points: string; fill: string; depth: number; id: number; selected: boolean;
    opacity: number; }

const SHADE: Record<string, number> = { top: 1, bottom: 0.45, n: 0.78, s: 0.62, e: 0.7, w: 0.55 };

function shade(hex: string, k: number): string {
    const h = hex.replace('#', '');
    const c = [0, 2, 4].map(i => Math.round((parseInt(h.slice(i, i + 2), 16) || 0) * k));
    return '#' + c.map(x => Math.max(0, Math.min(255, x)).toString(16).padStart(2, '0')).join('');
}

/** Faces of every part, projected and sorted far-to-near (painter's algorithm). */
export function project(parts: RsNode[], yaw: number, scale: number, cx: number, cy: number,
    selected: number | null): Face[] {
    const a = (yaw * Math.PI) / 180;
    const ca = Math.cos(a), sa = Math.sin(a);
    const faces: Face[] = [];
    const proj = (x: number, y: number, z: number) => {
        const xr = x * ca - z * sa;
        const zr = x * sa + z * ca;
        return { sx: cx + (xr - zr) * 0.866 * scale, sy: cy + ((xr + zr) * 0.5 - y) * scale,
            depth: xr + zr + y * 0.5 };
    };
    for (const part of parts) {
        const [px, py, pz] = vec(part.raw.Position, [0, 0.5, 0]);
        const [w, h, d] = vec(part.raw.Size, [4, 1, 2]);
        const [, ry] = vec(part.raw.Orientation, [0, 0, 0]);
        const r = (ry * Math.PI) / 180;
        const cr = Math.cos(r), sr = Math.sin(r);
        const corner = (ix: number, iy: number, iz: number) => {
            const lx = (ix ? 0.5 : -0.5) * w, ly = (iy ? 0.5 : -0.5) * h, lz = (iz ? 0.5 : -0.5) * d;
            return proj(px + lx * cr + lz * sr, py + ly, pz - lx * sr + lz * cr);
        };
        const base = color(part.raw.Color);
        const transparency = typeof part.raw.Transparency === 'number' ? part.raw.Transparency : 0;
        const opacity = Math.max(0.12, 1 - transparency);
        const quads: [string, number[][]][] = [
            ['top', [[0, 1, 0], [1, 1, 0], [1, 1, 1], [0, 1, 1]]],
            ['bottom', [[0, 0, 0], [1, 0, 0], [1, 0, 1], [0, 0, 1]]],
            ['n', [[0, 0, 1], [1, 0, 1], [1, 1, 1], [0, 1, 1]]],
            ['s', [[0, 0, 0], [1, 0, 0], [1, 1, 0], [0, 1, 0]]],
            ['e', [[1, 0, 0], [1, 0, 1], [1, 1, 1], [1, 1, 0]]],
            ['w', [[0, 0, 0], [0, 0, 1], [0, 1, 1], [0, 1, 0]]],
        ];
        for (const [side, pts] of quads) {
            const projected = pts.map(([x, y, z]) => corner(x, y, z));
            const depth = projected.reduce((sum, p) => sum + p.depth, 0) / 4;
            faces.push({
                points: projected.map(p => `${p.sx.toFixed(1)},${p.sy.toFixed(1)}`).join(' '),
                fill: shade(base, SHADE[side]), depth, id: part.id,
                selected: part.id === selected, opacity,
            });
        }
    }
    return faces.sort((x, y) => x.depth - y.depth);
}

// ---------------------------------------------------------------------------
// UI layout
// ---------------------------------------------------------------------------

export interface UiBox { node: RsNode; x: number; y: number; w: number; h: number; }

export function layoutGui(nodes: Map<number, RsNode>, screen: RsNode, width: number, height: number,
    showHidden: boolean): UiBox[] {
    const out: UiBox[] = [];
    const visit = (parent: RsNode, rect: [number, number, number, number]) => {
        for (const id of parent.children) {
            const child = nodes.get(id);
            if (!child || !isGui(child.class)) continue;
            const hidden = child.raw.Visible === false;
            if (hidden && !showHidden) continue;
            const [xs, xo, ys, yo] = vec(child.raw.Size, [0, 100, 0, 100]);
            const [pxs, pxo, pys, pyo] = vec(child.raw.Position, [0, 0, 0, 0]);
            const [ax, ay] = vec(child.raw.AnchorPoint, [0, 0]);
            const [rx, ry, rw, rh] = rect;
            const w = xs * rw + xo;
            const h = ys * rh + yo;
            const x = rx + pxs * rw + pxo - ax * w;
            const y = ry + pys * rh + pyo - ay * h;
            out.push({ node: child, x, y, w, h });
            visit(child, [x, y, w, h]);
        }
    };
    visit(screen, [0, 0, width, height]);
    return out;
}
