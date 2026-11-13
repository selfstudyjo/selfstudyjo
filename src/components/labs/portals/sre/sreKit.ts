/**
 * Shared helpers for the five SRE portals (Grafana, Prometheus/Alertmanager,
 * Grafana SLO, PagerDuty, Cockpit). Plain module: formatting, the Grafana
 * classic palette and the series shape app 11's `sim:sre` view sends.
 *
 * A series in the view is `{metric: {label: value}, values: [[epochSeconds, v]]}`
 * (the Prometheus `query_range` matrix shape). Nothing here throws on a
 * missing or malformed field: a replica a release behind sends less.
 */

export interface RangeSeries {
    metric: Record<string, string>;
    values: [number, number][];
}

export interface PlotSeries {
    name: string;
    values: [number, number][];
    color?: string;
}

/** Grafana's classic palette, in the order Grafana assigns it. */
export const PALETTE = ['#73BF69', '#F2CC0C', '#8AB8FF', '#FF780A', '#F2495C', '#5794F2',
    '#B877D9', '#705DA0', '#37872D', '#FADE2A', '#447EBC', '#C15C17', '#890F02', '#0A437C'];

export function asSeries(value: unknown): RangeSeries[] {
    if (!Array.isArray(value)) return [];
    return value.filter((s): s is RangeSeries => !!s && typeof s === 'object'
        && Array.isArray((s as RangeSeries).values)).map(s => ({
        metric: (s.metric && typeof s.metric === 'object') ? s.metric : {},
        values: s.values.filter(p => Array.isArray(p) && Number.isFinite(Number(p[0]))
            && Number.isFinite(Number(p[1]))).map(p => [Number(p[0]), Number(p[1])] as [number, number]),
    }));
}

/** Grafana's default legend: `{instance="api-1:8080"}` style, or one label. */
export function legendOf(metric: Record<string, string>, format = ''): string {
    if (format) {
        return format.replace(/\{\{\s*(\w+)\s*\}\}/g, (_m, key) => metric[key] ?? '');
    }
    const keys = Object.keys(metric).filter(k => k !== '__name__');
    if (!keys.length) return metric.__name__ || 'Value';
    const name = metric.__name__ || '';
    return name + '{' + keys.sort().map(k => `${k}="${metric[k]}"`).join(', ') + '}';
}

export function toPlot(series: RangeSeries[], format = '', scale = 1): PlotSeries[] {
    return series.map((s, i) => ({
        name: legendOf(s.metric, format),
        values: s.values.map(([t, v]) => [t, v * scale] as [number, number]),
        color: PALETTE[i % PALETTE.length],
    }));
}

export function lastValue(series: RangeSeries[] | PlotSeries[], index = 0): number | null {
    const s = series[index];
    if (!s || !s.values.length) return null;
    return s.values[s.values.length - 1][1];
}

/** A value formatted the way Grafana's unit picker would. */
export function fmtUnit(v: number | null | undefined, unit: string, decimals?: number): string {
    if (v === null || v === undefined || !Number.isFinite(v)) return 'No data';
    const d = (n: number, def: number) => n.toFixed(decimals ?? def);
    switch (unit) {
        case 'percent': return d(v, Math.abs(v) < 10 ? 2 : 1) + '%';
        case 'percentunit': return d(v * 100, 2) + '%';
        case 'ms': return v >= 1000 ? d(v / 1000, 2) + ' s' : d(v, 0) + ' ms';
        case 's': return v < 1 ? d(v * 1000, 0) + ' ms' : d(v, 2) + ' s';
        case 'reqps': return d(v, v < 10 ? 2 : 1) + ' req/s';
        case 'bytes': return fmtBytes(v);
        case 'bool': return v >= 1 ? 'UP' : 'DOWN';
        default: return Math.abs(v) >= 1000 ? (v / 1000).toFixed(1) + ' K' : d(v, Math.abs(v) < 10 ? 2 : 1);
    }
}

export function fmtBytes(v: number): string {
    const units = ['B', 'KiB', 'MiB', 'GiB', 'TiB'];
    let i = 0;
    let n = Math.abs(v);
    while (n >= 1024 && i < units.length - 1) { n /= 1024; i++; }
    return (v < 0 ? '-' : '') + n.toFixed(n < 10 && i ? 2 : 1) + ' ' + units[i];
}

export function clockOf(epoch: number): string {
    const d = new Date(epoch * 1000);
    return String(d.getUTCHours()).padStart(2, '0') + ':' + String(d.getUTCMinutes()).padStart(2, '0');
}

export function dateTimeOf(epoch: number): string {
    const d = new Date(epoch * 1000);
    return d.toISOString().replace('T', ' ').slice(0, 19);
}

/** A threshold colour for a stat value, Grafana's green / orange / red. */
export function thresholdColor(v: number | null, warn: number, crit: number, higherIsBad = true): string {
    if (v === null || !Number.isFinite(v)) return '#8e8e8e';
    const bad = higherIsBad ? v >= crit : v <= crit;
    const meh = higherIsBad ? v >= warn : v <= warn;
    return bad ? '#F2495C' : meh ? '#FF9830' : '#73BF69';
}

/** Nice axis ticks between min and max. */
export function ticks(min: number, max: number, count = 4): number[] {
    if (!Number.isFinite(min) || !Number.isFinite(max)) return [0];
    if (max === min) { max = min + 1; }
    const span = max - min;
    const raw = span / count;
    const mag = Math.pow(10, Math.floor(Math.log10(raw)));
    const norm = raw / mag;
    const step = (norm < 1.5 ? 1 : norm < 3 ? 2 : norm < 7 ? 5 : 10) * mag;
    const out: number[] = [];
    for (let v = Math.ceil(min / step) * step; v <= max + step * 1e-9; v += step) {
        out.push(Number(v.toFixed(10)));
    }
    return out;
}

export function str(value: unknown, fallback = ''): string {
    return value === null || value === undefined ? fallback : String(value);
}

export function num(value: unknown): number | null {
    const n = Number(value);
    return value === null || value === undefined || value === '' || !Number.isFinite(n) ? null : n;
}
