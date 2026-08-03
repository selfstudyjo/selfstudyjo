<script lang="ts">
/**
 * src/components/netsim/DeviceIcon.vue
 * The Network Simulator icon set — one glyph per device class plus the UI icons
 * used by the palette, toolbar and learning tracks.
 *
 * Written as a render function so the glyph table stays a plain data structure:
 * every entry is a list of [tag, attributes] pairs on a 24×24 grid.
 */
import { defineComponent, h, computed } from 'vue';

type El = [string, Record<string, string | number>];

const S = { fill: 'none', stroke: 'currentColor', 'stroke-width': 1.6, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' } as const;
const F = { fill: 'currentColor' } as const;

/** Chassis with status lights — the visual base for most rack gear. */
function chassis(y: number, h: number, lights = 3): El[] {
    return [
        ['rect', { x: 2.5, y, width: 19, height: h, rx: 2, ...S }],
        ...Array.from({ length: lights }, (_, i) => (
            ['circle', { cx: 6 + i * 3, cy: y + h / 2, r: 0.9, ...F }] as El
        )),
    ];
}

const GLYPHS: Record<string, El[]> = {
    /* ── end devices ── */
    pc: [
        ['rect', { x: 2.5, y: 4, width: 19, height: 12, rx: 1.8, ...S }],
        ['path', { d: 'M8 20h8M12 16v4', ...S }],
    ],
    laptop: [
        ['path', { d: 'M5 5.5h14v9H5z', ...S }],
        ['path', { d: 'M2 17.5h20l-1.5 2.5H3.5z', ...S }],
    ],
    tablet: [
        ['rect', { x: 5.5, y: 2.5, width: 13, height: 19, rx: 2, ...S }],
        ['path', { d: 'M10.5 19.2h3', ...S }],
    ],
    phone: [
        ['rect', { x: 7, y: 2, width: 10, height: 20, rx: 2.2, ...S }],
        ['path', { d: 'M10.5 5h3', ...S }],
        ['circle', { cx: 12, cy: 19, r: 0.9, ...F }],
    ],
    watch: [
        ['circle', { cx: 12, cy: 12, r: 5.2, ...S }],
        ['path', { d: 'M12 9.8V12l1.7 1.2M9.6 6.6 9 3h6l-.6 3.6M9.6 17.4 9 21h6l-.6-3.6', ...S }],
    ],
    headset: [
        ['path', { d: 'M4 14v-2a8 8 0 0 1 16 0v2', ...S }],
        ['rect', { x: 2, y: 13, width: 4.5, height: 6, rx: 1.6, ...S }],
        ['rect', { x: 17.5, y: 13, width: 4.5, height: 6, rx: 1.6, ...S }],
    ],
    tv: [
        ['rect', { x: 2.5, y: 4, width: 19, height: 12.5, rx: 1.6, ...S }],
        ['path', { d: 'M8.5 20h7M12 16.5V20', ...S }],
        ['path', { d: 'M6 8.5h5', ...S }],
    ],
    printer: [
        ['path', { d: 'M7 8V3.5h10V8', ...S }],
        ['rect', { x: 3, y: 8, width: 18, height: 8, rx: 1.6, ...S }],
        ['path', { d: 'M7 16h10v4.5H7z', ...S }],
        ['circle', { cx: 17.6, cy: 11, r: 0.9, ...F }],
    ],
    'phone-voip': [
        ['path', { d: 'M4 18.5V9.5l6-5h10v14z', ...S }],
        ['path', { d: 'M13 8.5h4M13 12h4', ...S }],
        ['rect', { x: 5, y: 19, width: 8, height: 2.6, rx: 1.2, ...S }],
    ],
    camera: [
        ['path', { d: 'M3 8.5l13-3.5 1.6 5.8-13 3.5z', ...S }],
        ['path', { d: 'M17.6 9l3.4-1.2v6L17.6 12', ...S }],
        ['path', { d: 'M7 14v5.5M4.5 19.5h5', ...S }],
    ],
    'console-game': [
        ['rect', { x: 2, y: 7.5, width: 20, height: 10, rx: 4.6, ...S }],
        ['path', { d: 'M7 10.5v4M5 12.5h4', ...S }],
        ['circle', { cx: 16, cy: 11.4, r: 1.1, ...F }],
        ['circle', { cx: 18.4, cy: 13.6, r: 1.1, ...F }],
    ],

    /* ── switching ── */
    switch: [
        ...chassis(8, 8, 4),
        ['path', { d: 'M7 5.5l2-2 2 2M17 5.5l-2-2-2 2M7 3.5h4M13 3.5h4', ...S }],
        ['path', { d: 'M8 20l2-2M16 20l-2-2', ...S }],
    ],
    'switch-l3': [
        ...chassis(8.5, 8, 4),
        ['path', { d: 'M4.5 5.5h6l-1.6-2M19.5 5.5h-6l1.6-2M6 3.5h4M14 3.5h4', ...S }],
        ['text', { x: 12, y: 21.6, 'text-anchor': 'middle', 'font-size': 5.4, 'font-weight': '700', fill: 'currentColor' }],
    ],
    hub: [
        ['rect', { x: 2.5, y: 9, width: 19, height: 7, rx: 2, ...S }],
        ['path', { d: 'M6 9V4.5M10 9V4.5M14 9V4.5M18 9V4.5M6 16v3.5M10 16v3.5M14 16v3.5M18 16v3.5', ...S }],
    ],
    bridge: [
        ['path', { d: 'M3 16.5V13a9 9 0 0 1 18 0v3.5', ...S }],
        ['path', { d: 'M3 16.5h18M8 16.5v-3M12 16.5v-5M16 16.5v-3', ...S }],
    ],
    repeater: [
        ['circle', { cx: 12, cy: 12, r: 2.4, ...S }],
        ['path', { d: 'M7.4 7.4a6.5 6.5 0 0 0 0 9.2M16.6 16.6a6.5 6.5 0 0 0 0-9.2M4.6 4.6a10.5 10.5 0 0 0 0 14.8M19.4 19.4a10.5 10.5 0 0 0 0-14.8', ...S }],
    ],

    /* ── routing ── */
    router: [
        ['rect', { x: 2.5, y: 10, width: 19, height: 7.5, rx: 3.4, ...S }],
        ['path', { d: 'M8 7.5 5.5 5m0 0h3m-3 0v3M16 7.5 18.5 5m0 0h-3m3 0v3', ...S }],
        ['circle', { cx: 8, cy: 13.8, r: 0.9, ...F }],
        ['circle', { cx: 11.5, cy: 13.8, r: 0.9, ...F }],
        ['circle', { cx: 15, cy: 13.8, r: 0.9, ...F }],
    ],
    'router-core': [
        ['rect', { x: 2, y: 6.5, width: 20, height: 5, rx: 1.8, ...S }],
        ['rect', { x: 2, y: 13, width: 20, height: 5, rx: 1.8, ...S }],
        ['circle', { cx: 5.5, cy: 9, r: 0.85, ...F }],
        ['circle', { cx: 8.5, cy: 9, r: 0.85, ...F }],
        ['circle', { cx: 5.5, cy: 15.5, r: 0.85, ...F }],
        ['circle', { cx: 8.5, cy: 15.5, r: 0.85, ...F }],
        ['path', { d: 'M14 9h5M14 15.5h5', ...S }],
    ],
    'wifi-router': [
        ['rect', { x: 3, y: 13, width: 18, height: 6.5, rx: 2.4, ...S }],
        ['path', { d: 'M9 10.2a4.2 4.2 0 0 1 6 0M6.4 7.4a8 8 0 0 1 11.2 0', ...S }],
        ['circle', { cx: 12, cy: 12.6, r: 0.9, ...F }],
        ['circle', { cx: 7, cy: 16.3, r: 0.85, ...F }],
        ['circle', { cx: 10, cy: 16.3, r: 0.85, ...F }],
    ],
    sdwan: [
        ['rect', { x: 2.5, y: 12, width: 19, height: 6.5, rx: 2.4, ...S }],
        ['path', { d: 'M6 9V4.5M12 9V6.5M18 9V4.5', ...S }],
        ['path', { d: 'M4 6.5h4M10 4.5h4M16 6.5h4', ...S }],
        ['circle', { cx: 8, cy: 15.2, r: 0.85, ...F }],
        ['circle', { cx: 12, cy: 15.2, r: 0.85, ...F }],
        ['circle', { cx: 16, cy: 15.2, r: 0.85, ...F }],
    ],

    /* ── wireless ── */
    ap: [
        ['circle', { cx: 12, cy: 17, r: 3, ...S }],
        ['circle', { cx: 12, cy: 17, r: 0.9, ...F }],
        ['path', { d: 'M8.4 11.5a5.4 5.4 0 0 1 7.2 0M5.6 8.3a9.4 9.4 0 0 1 12.8 0', ...S }],
    ],
    mesh: [
        ['circle', { cx: 12, cy: 12, r: 2.2, ...S }],
        ['circle', { cx: 4.5, cy: 6, r: 1.8, ...S }],
        ['circle', { cx: 19.5, cy: 6, r: 1.8, ...S }],
        ['circle', { cx: 4.5, cy: 18, r: 1.8, ...S }],
        ['circle', { cx: 19.5, cy: 18, r: 1.8, ...S }],
        ['path', { d: 'M6 7.2l4.3 3.4M18 7.2l-4.3 3.4M6 16.8l4.3-3.4M18 16.8l-4.3-3.4', ...S }],
    ],
    wlc: [
        ...chassis(9.5, 8, 3),
        ['path', { d: 'M9.5 6.5a4 4 0 0 1 5 0M7 4a8 8 0 0 1 10 0', ...S }],
    ],

    /* ── security ── */
    firewall: [
        ['path', { d: 'M3 5.5h18v6H3zM3 12.5h18v6H3z', ...S }],
        ['path', { d: 'M8.5 5.5v6M15.5 5.5v6M12 12.5v6', ...S }],
        ['path', { d: 'M5 20.5c1.4-1.6 2.6-1.6 4 0s2.6 1.6 4 0 2.6-1.6 4 0', ...S }],
    ],
    ids: [
        ['circle', { cx: 11, cy: 11, r: 6.4, ...S }],
        ['path', { d: 'M15.8 15.8 21 21', ...S }],
        ['path', { d: 'M8 11h1.8l1.2-2.4L12.6 14l1.2-3h2', ...S }],
    ],
    vpn: [
        ['rect', { x: 4, y: 10.5, width: 16, height: 9, rx: 2, ...S }],
        ['path', { d: 'M8 10.5V8a4 4 0 0 1 8 0v2.5', ...S }],
        ['path', { d: 'M12 13.6v2.8', ...S }],
    ],
    proxy: [
        ['circle', { cx: 6, cy: 12, r: 2.4, ...S }],
        ['circle', { cx: 18, cy: 12, r: 2.4, ...S }],
        ['path', { d: 'M8.6 12h6.8M13.4 9.8l2 2.2-2 2.2', ...S }],
        ['path', { d: 'M12 4.5v3M12 16.5v3', ...S }],
    ],
    shield: [
        ['path', { d: 'M12 2.5l8 3v6.5c0 4.6-3.2 8.5-8 9.5-4.8-1-8-4.9-8-9.5V5.5z', ...S }],
        ['path', { d: 'M9 12.2l2.2 2.3L15.4 10', ...S }],
    ],

    /* ── WAN ── */
    modem: [
        ['rect', { x: 3, y: 11, width: 18, height: 7.5, rx: 2, ...S }],
        ['path', { d: 'M12 11V6M9 6h6', ...S }],
        ['circle', { cx: 7, cy: 14.8, r: 0.85, ...F }],
        ['circle', { cx: 10, cy: 14.8, r: 0.85, ...F }],
        ['path', { d: 'M15 14.8h3.5', ...S }],
    ],
    ont: [
        ['rect', { x: 4, y: 9, width: 16, height: 9, rx: 2, ...S }],
        ['path', { d: 'M12 9V4.5', ...S }],
        ['circle', { cx: 12, cy: 3.6, r: 1.4, ...S }],
        ['path', { d: 'M7.5 13.5h4M15 13.5h2', ...S }],
    ],
    tower: [
        ['path', { d: 'M12 21V9', ...S }],
        ['path', { d: 'M7.5 21l4.5-12 4.5 12', ...S }],
        ['path', { d: 'M9 16.5h6', ...S }],
        ['path', { d: 'M8.6 6.6a5 5 0 0 1 6.8 0M6 4a9 9 0 0 1 12 0', ...S }],
    ],
    satellite: [
        ['path', { d: 'M4 20a11 11 0 0 1 11-11', ...S }],
        ['circle', { cx: 6.5, cy: 17.5, r: 1.6, ...S }],
        ['path', { d: 'M13 4.5l6.5 6.5-3.5 3.5-6.5-6.5z', ...S }],
        ['path', { d: 'M18 3l3 3', ...S }],
    ],
    serial: [
        ['rect', { x: 3, y: 8.5, width: 18, height: 7, rx: 2.4, ...S }],
        ['circle', { cx: 7.5, cy: 12, r: 0.8, ...F }],
        ['circle', { cx: 10.5, cy: 12, r: 0.8, ...F }],
        ['circle', { cx: 13.5, cy: 12, r: 0.8, ...F }],
        ['circle', { cx: 16.5, cy: 12, r: 0.8, ...F }],
        ['path', { d: 'M12 15.5V20', ...S }],
    ],

    /* ── servers & services ── */
    server: [
        ['rect', { x: 4, y: 3, width: 16, height: 5.5, rx: 1.4, ...S }],
        ['rect', { x: 4, y: 9.5, width: 16, height: 5.5, rx: 1.4, ...S }],
        ['rect', { x: 4, y: 16, width: 16, height: 5.5, rx: 1.4, ...S }],
        ['circle', { cx: 7.2, cy: 5.75, r: 0.8, ...F }],
        ['circle', { cx: 7.2, cy: 12.25, r: 0.8, ...F }],
        ['circle', { cx: 7.2, cy: 18.75, r: 0.8, ...F }],
    ],
    globe: [
        ['circle', { cx: 12, cy: 12, r: 9, ...S }],
        ['path', { d: 'M3 12h18M12 3c2.6 2.6 2.6 15.4 0 18M12 3c-2.6 2.6-2.6 15.4 0 18', ...S }],
    ],
    mail: [
        ['rect', { x: 2.5, y: 5.5, width: 19, height: 13, rx: 2, ...S }],
        ['path', { d: 'M3.5 7l8.5 6 8.5-6', ...S }],
    ],
    nas: [
        ['rect', { x: 4.5, y: 3, width: 15, height: 18, rx: 2, ...S }],
        ['path', { d: 'M8 7h8M8 11h8M8 15h5', ...S }],
        ['circle', { cx: 16, cy: 15, r: 1, ...F }],
    ],
    database: [
        ['ellipse', { cx: 12, cy: 6, rx: 7.5, ry: 3, ...S }],
        ['path', { d: 'M4.5 6v12c0 1.7 3.4 3 7.5 3s7.5-1.3 7.5-3V6', ...S }],
        ['path', { d: 'M4.5 12c0 1.7 3.4 3 7.5 3s7.5-1.3 7.5-3', ...S }],
    ],
    clock: [
        ['circle', { cx: 12, cy: 12, r: 9, ...S }],
        ['path', { d: 'M12 7v5.4l3.6 2.2', ...S }],
    ],
    logs: [
        ['rect', { x: 4, y: 3, width: 16, height: 18, rx: 2, ...S }],
        ['path', { d: 'M8 8h8M8 12h8M8 16h5', ...S }],
    ],
    loadbalancer: [
        ['rect', { x: 8.5, y: 2.5, width: 7, height: 5, rx: 1.4, ...S }],
        ['rect', { x: 2, y: 16.5, width: 6, height: 5, rx: 1.4, ...S }],
        ['rect', { x: 9, y: 16.5, width: 6, height: 5, rx: 1.4, ...S }],
        ['rect', { x: 16, y: 16.5, width: 6, height: 5, rx: 1.4, ...S }],
        ['path', { d: 'M12 7.5v3.5M5 16.5V11h14v5.5M12 11v5.5', ...S }],
    ],
    gpu: [
        ['rect', { x: 2.5, y: 7, width: 19, height: 10, rx: 1.8, ...S }],
        ['circle', { cx: 8.5, cy: 12, r: 2.6, ...S }],
        ['circle', { cx: 15.5, cy: 12, r: 2.6, ...S }],
        ['path', { d: 'M6 17v3M18 17v3', ...S }],
    ],

    /* ── virtualisation ── */
    vm: [
        ['rect', { x: 2.5, y: 4, width: 19, height: 16, rx: 2, ...S }],
        ['rect', { x: 5.5, y: 7, width: 6, height: 4.5, rx: 1, ...S }],
        ['rect', { x: 12.5, y: 7, width: 6, height: 4.5, rx: 1, ...S }],
        ['rect', { x: 5.5, y: 12.5, width: 6, height: 4.5, rx: 1, ...S }],
        ['rect', { x: 12.5, y: 12.5, width: 6, height: 4.5, rx: 1, ...S }],
    ],
    container: [
        ['path', { d: 'M12 2.8 21 7.4v9.2L12 21.2 3 16.6V7.4z', ...S }],
        ['path', { d: 'M3 7.4l9 4.6 9-4.6M12 12v9.2', ...S }],
    ],

    /* ── IoT ── */
    sensor: [
        ['circle', { cx: 12, cy: 12, r: 3, ...S }],
        ['circle', { cx: 12, cy: 12, r: 0.9, ...F }],
        ['path', { d: 'M12 3v3M12 18v3M3 12h3M18 12h3M6 6l2 2M16 16l2 2M18 6l-2 2M8 16l-2 2', ...S }],
    ],
    thermostat: [
        ['circle', { cx: 12, cy: 12, r: 8.6, ...S }],
        ['path', { d: 'M12 7.4v5.2', ...S }],
        ['circle', { cx: 12, cy: 15, r: 1.8, ...S }],
    ],
    plug: [
        ['path', { d: 'M9 3v5M15 3v5', ...S }],
        ['path', { d: 'M6.5 8h11v3a5.5 5.5 0 0 1-11 0z', ...S }],
        ['path', { d: 'M12 16.5V21', ...S }],
    ],
    lock: [
        ['rect', { x: 4.5, y: 10.5, width: 15, height: 10, rx: 2, ...S }],
        ['path', { d: 'M8 10.5V7.6a4 4 0 0 1 8 0v2.9', ...S }],
        ['circle', { cx: 12, cy: 15.4, r: 1.2, ...F }],
    ],
    plc: [
        ['rect', { x: 3, y: 5, width: 18, height: 14, rx: 2, ...S }],
        ['path', { d: 'M7 5v14M7 9h14M7 14h14', ...S }],
        ['circle', { cx: 4.9, cy: 8, r: 0.7, ...F }],
        ['circle', { cx: 4.9, cy: 12, r: 0.7, ...F }],
        ['circle', { cx: 4.9, cy: 16, r: 0.7, ...F }],
    ],
    ev: [
        ['rect', { x: 5, y: 3, width: 11, height: 14, rx: 2, ...S }],
        ['path', { d: 'M11.4 6.5 9 10.8h2.6L10.6 14l3.4-4.4h-2.6z', ...F }],
        ['path', { d: 'M16 8h2.5a2 2 0 0 1 2 2v7a1.8 1.8 0 0 0 1.5 1.8', ...S }],
        ['path', { d: 'M8 17v4M13 17v4', ...S }],
    ],
    drone: [
        ['circle', { cx: 5, cy: 5.5, r: 2.2, ...S }],
        ['circle', { cx: 19, cy: 5.5, r: 2.2, ...S }],
        ['circle', { cx: 5, cy: 18.5, r: 2.2, ...S }],
        ['circle', { cx: 19, cy: 18.5, r: 2.2, ...S }],
        ['rect', { x: 8.6, y: 9.1, width: 6.8, height: 5.8, rx: 1.4, ...S }],
        ['path', { d: 'M6.6 7.1l2 2M17.4 7.1l-2 2M6.6 16.9l2-2M17.4 16.9l-2-2', ...S }],
    ],
    meter: [
        ['circle', { cx: 12, cy: 12, r: 8.6, ...S }],
        ['path', { d: 'M12 12l4-3', ...S }],
        ['path', { d: 'M6 15.5a7 7 0 0 1 12 0', ...S }],
        ['circle', { cx: 12, cy: 12, r: 1, ...F }],
    ],
    medical: [
        ['rect', { x: 3, y: 5, width: 18, height: 14, rx: 2.4, ...S }],
        ['path', { d: 'M3.5 13.5h4l1.6-3.4 2 6 1.8-4.2 1.4 1.6h6.2', ...S }],
    ],

    /* ── cloud ── */
    cloud: [
        ['path', { d: 'M7.2 18.5h9.6a4 4 0 0 0 .6-7.95A5.6 5.6 0 0 0 6.6 9.4a3.9 3.9 0 0 0 .6 9.1z', ...S }],
    ],

    /* ── UI icons ── */
    ip: [
        ['rect', { x: 2.5, y: 6.5, width: 19, height: 11, rx: 2, ...S }],
        ['path', { d: 'M7 10v4M11 14v-4l3 4v-4M18 14v-4', ...S }],
    ],
    vlan: [
        ['rect', { x: 2.5, y: 3.5, width: 19, height: 5, rx: 1.4, ...S }],
        ['rect', { x: 2.5, y: 10, width: 19, height: 5, rx: 1.4, ...S }],
        ['rect', { x: 2.5, y: 16.5, width: 19, height: 5, rx: 1.4, ...S }],
    ],
    wrench: [
        ['path', { d: 'M15.5 3.5a5.2 5.2 0 0 0-4.4 7.9L4 18.5 5.5 20l7.1-7.1a5.2 5.2 0 0 0 6.6-6.9l-2.8 2.8-2.4-2.4z', ...S }],
    ],
    zap: [['path', { d: 'M13 2 4 14h6l-1 8 9-12h-6z', ...S }]],
    award: [
        ['circle', { cx: 12, cy: 9, r: 6, ...S }],
        ['path', { d: 'M8.6 14 7 22l5-2.6L17 22l-1.6-8', ...S }],
    ],
    info: [
        ['circle', { cx: 12, cy: 12, r: 9, ...S }],
        ['path', { d: 'M12 11v5', ...S }],
        ['circle', { cx: 12, cy: 7.8, r: 0.95, ...F }],
    ],
    alert: [
        ['path', { d: 'M12 3 2.5 20h19z', ...S }],
        ['path', { d: 'M12 9v5', ...S }],
        ['circle', { cx: 12, cy: 17, r: 0.95, ...F }],
    ],
    check: [['path', { d: 'M4 12.5l5 5L20 6.5', ...S }]],
    plus: [['path', { d: 'M12 5v14M5 12h14', ...S }]],
    book: [
        ['path', { d: 'M4 4.5h6a2.5 2.5 0 0 1 2 2.2 2.5 2.5 0 0 1 2-2.2h6v13h-6a2.5 2.5 0 0 0-2 2.2 2.5 2.5 0 0 0-2-2.2H4z', ...S }],
        ['path', { d: 'M12 6.7v12', ...S }],
    ],
    play: [['path', { d: 'M7 4.5 19 12 7 19.5z', ...S }]],
    pause: [['path', { d: 'M8.5 5v14M15.5 5v14', ...S }]],
    trash: [
        ['path', { d: 'M4 7h16M9.5 7V4.5h5V7M6 7l1 14h10l1-14', ...S }],
    ],
    cable: [
        ['path', { d: 'M5 4.5v5a3 3 0 0 0 3 3h8a3 3 0 0 1 3 3v4', ...S }],
        ['rect', { x: 3, y: 2, width: 4, height: 3, rx: 1, ...S }],
        ['rect', { x: 17, y: 19, width: 4, height: 3, rx: 1, ...S }],
    ],
    cursor: [['path', { d: 'M5 3l14 8-6 1.6L10 20z', ...S }]],
    layers: [
        ['path', { d: 'M12 3 2.5 8 12 13l9.5-5z', ...S }],
        ['path', { d: 'M2.5 12.5 12 17.5l9.5-5M2.5 16.5 12 21.5l9.5-5', ...S }],
    ],
    save: [
        ['path', { d: 'M4 4.5h11l5 5V19.5H4z', ...S }],
        ['path', { d: 'M8 4.5v5h7M8 19.5v-5h8v5', ...S }],
    ],
    grid: [
        ['path', { d: 'M3 9h18M3 15h18M9 3v18M15 3v18', ...S }],
        ['rect', { x: 3, y: 3, width: 18, height: 18, rx: 2, ...S }],
    ],
    magic: [
        ['path', { d: 'M5 19 16 8M14.5 3.5l1 2.5 2.5 1-2.5 1-1 2.5-1-2.5-2.5-1 2.5-1zM19.5 13l.7 1.8 1.8.7-1.8.7-.7 1.8-.7-1.8-1.8-.7 1.8-.7z', ...S }],
    ],
    terminal: [
        ['rect', { x: 2.5, y: 4, width: 19, height: 16, rx: 2, ...S }],
        ['path', { d: 'M6.5 9.5 9 12l-2.5 2.5M12 15h5.5', ...S }],
    ],
    search: [
        ['circle', { cx: 10.5, cy: 10.5, r: 6.5, ...S }],
        ['path', { d: 'M15.4 15.4 21 21', ...S }],
    ],
    close: [['path', { d: 'M6 6l12 12M18 6 6 18', ...S }]],
    chevron: [['path', { d: 'M9 5l7 7-7 7', ...S }]],
    power: [
        ['path', { d: 'M12 3v8', ...S }],
        ['path', { d: 'M7.2 6.6a7.5 7.5 0 1 0 9.6 0', ...S }],
    ],
    download: [['path', { d: 'M12 3v11m0 0 4.5-4.5M12 14 7.5 9.5M4 19h16', ...S }]],
    upload: [['path', { d: 'M12 15V4m0 0L7.5 8.5M12 4l4.5 4.5M4 19h16', ...S }]],
    share: [
        ['circle', { cx: 6, cy: 12, r: 2.6, ...S }],
        ['circle', { cx: 18, cy: 6, r: 2.6, ...S }],
        ['circle', { cx: 18, cy: 18, r: 2.6, ...S }],
        ['path', { d: 'M8.3 10.8 15.7 7.2M8.3 13.2l7.4 3.6', ...S }],
    ],
    undo: [['path', { d: 'M4 9h11a5 5 0 0 1 0 10H8M4 9l4-4M4 9l4 4', ...S }]],
    redo: [['path', { d: 'M20 9H9a5 5 0 0 0 0 10h7M20 9l-4-4M20 9l-4 4', ...S }]],
    copy: [
        ['rect', { x: 8.5, y: 8.5, width: 12, height: 12, rx: 2, ...S }],
        ['path', { d: 'M15.5 5.5H5.5a2 2 0 0 0-2 2v10', ...S }],
    ],
    folder: [['path', { d: 'M3 6.5h6l2 2.5h10V19H3z', ...S }]],
    stats: [['path', { d: 'M4 20V11M10 20V4M16 20v-6M22 20H2', ...S }]],
    sparkles: [
        ['path', { d: 'M12 3l1.6 4.4L18 9l-4.4 1.6L12 15l-1.6-4.4L6 9l4.4-1.6z', ...S }],
        ['path', { d: 'M18.5 15.5l.8 2.2 2.2.8-2.2.8-.8 2.2-.8-2.2-2.2-.8 2.2-.8z', ...S }],
    ],
};

export default defineComponent({
    name: 'DeviceIcon',
    props: {
        name: { type: String, required: true },
        size: { type: [Number, String], default: 24 },
        strokeWidth: { type: Number, default: 0 },
    },
    setup(props) {
        const glyph = computed(() => GLYPHS[props.name] || GLYPHS.pc);
        return () => h(
            'svg',
            {
                width: props.size,
                height: props.size,
                viewBox: '0 0 24 24',
                xmlns: 'http://www.w3.org/2000/svg',
                class: 'netsim-icon',
                'aria-hidden': 'true',
                focusable: 'false',
            },
            glyph.value.map(([tag, attrs]) => {
                const merged: Record<string, any> = { ...attrs };
                if (props.strokeWidth && merged.stroke) merged['stroke-width'] = props.strokeWidth;
                // The L3 switch glyph carries a text label.
                if (tag === 'text') return h('text', merged, 'L3');
                return h(tag, merged);
            })
        );
    },
});

export { GLYPHS as NETSIM_GLYPHS };
</script>

<style scoped>
.netsim-icon {
    display: block;
    overflow: visible;
}
</style>
