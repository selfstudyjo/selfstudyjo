/**
 * src/utils/products.ts — the SelfStudy desktop apps, and which installer to
 * offer this visitor. A plain module (no Vue, no DOM) on the photoMask.ts /
 * dashboardProgress.ts precedent, so `npm run check:products` drives it in node.
 *
 * Every product's installers are GitHub Release assets of a PRIVATE repository.
 * App 27 lists the latest release of each (`GET /api/products/`) and hands out a
 * short-lived signed URL per asset (`POST /api/products/<id>/download`), both
 * behind a server-side ai_feature check, so the browser downloads straight from
 * GitHub's storage without the repos being public. Nothing here builds a GitHub
 * URL: a direct release link is a 404 for every visitor.
 *
 * Replaces utils/selfstudyCodeDownloads.ts (SelfStudyCode only) and
 * utils/interviewHelperDownloads.ts (which pointed at a public mirror repo).
 *
 * Things here that fail silently if wrong, which is why they are checked:
 *   - macOS reports "Intel" in its user agent even on Apple Silicon, so arch
 *     comes from User-Agent Client Hints when the browser has them, and a Mac
 *     with no hint is offered both builds rather than a guess;
 *   - "darwin" contains "win" - classification is the server's, and this
 *     module trusts the `os` it is handed rather than re-deriving it;
 *   - an OS with no build gets the full list, never an empty panel;
 *   - a ?tab= value that is not a product falls back to the first tab, so an
 *     old or mistyped link still lands somewhere useful.
 */

export const PRODUCT_IDS = ['selfstudycode', 'interview-helper', 'video-editor'] as const;
export type ProductId = typeof PRODUCT_IDS[number];

export type OsId = 'windows' | 'macos' | 'linux' | 'other';
export type Arch = 'x64' | 'arm64' | 'universal';

export interface DownloadAsset {
    id: number;
    name: string;
    size: number;
    kind: 'gui' | 'cli';
    os: string;
    arch: Arch;
}

/** One product as app 27 answers it. */
export interface ProductInfo {
    id: string;
    name: string;
    available: boolean;
    version?: string;
    published?: string;
    reason?: string;
    assets: DownloadAsset[];
}

export interface Detected {
    os: OsId;
    /** null when the browser cannot tell (a Mac with no client hints). */
    arch: Arch | null;
    /** A phone or tablet: there is no installer for it. */
    mobile: boolean;
}

/** The tab to open for a `?tab=` value. Unknown or missing is the first one. */
export function tabFromQuery(value: unknown): ProductId {
    const v = Array.isArray(value) ? value[0] : value;
    const s = typeof v === 'string' ? v.trim().toLowerCase() : '';
    return (PRODUCT_IDS as readonly string[]).includes(s) ? (s as ProductId) : PRODUCT_IDS[0];
}

export function isProductId(value: string): value is ProductId {
    return (PRODUCT_IDS as readonly string[]).includes(value);
}

export function detectOs(userAgent: string, platform = '', hintArch = '', maxTouchPoints = 0): Detected {
    const ua = `${userAgent} ${platform}`.toLowerCase();
    let os: OsId = 'other';
    let mobile = false;
    if (/android|iphone|ipad|ipod|mobile/.test(ua)) { os = 'other'; mobile = true; }
    else if (/windows|win32|win64/.test(ua)) os = 'windows';
    else if (/mac os|macintosh|macintel|darwin/.test(ua)) {
        // An iPad reports itself as a Mac; touch points tell them apart.
        if (maxTouchPoints > 1) { os = 'other'; mobile = true; } else os = 'macos';
    } else if (/cros/.test(ua)) os = 'other';
    else if (/linux|x11/.test(ua)) os = 'linux';
    const hint = hintArch.toLowerCase();
    let arch: Arch | null = null;
    if (hint) arch = /arm|aarch/.test(hint) ? 'arm64' : 'x64';
    else if (/arm64|aarch64/.test(ua)) arch = 'arm64';
    else if (os !== 'macos') arch = 'x64';
    return { os, arch, mobile };
}

/** Installer formats in order of preference, per OS. */
const GUI_EXT: Record<string, string[]> = {
    windows: ['.exe', '.msi', '.zip'],
    macos: ['.dmg', '.pkg', '.zip'],
    linux: ['.appimage', '.deb', '.rpm', '.snap', '.tar.gz'],
};

const lower = (s: string) => s.toLowerCase();
const extRank = (os: string, name: string) => {
    const i = (GUI_EXT[os] || []).findIndex((e) => lower(name).endsWith(e));
    return i < 0 ? 99 : i;
};
const archRank = (a: DownloadAsset, arch: Arch | null) =>
    !arch ? 0 : a.arch === arch ? 0 : a.arch === 'universal' ? 1 : 2;

export interface Picked {
    /** The recommended desktop app for this machine (may be undefined). */
    gui?: DownloadAsset;
    /** Further desktop builds for this OS (the other Mac arch, the .deb). */
    guiAlternates: DownloadAsset[];
    cli?: DownloadAsset;
    cliAlternates: DownloadAsset[];
    /** Everything else, for "other platforms". */
    others: DownloadAsset[];
}

/**
 * Split a release's assets into "for this computer" and "everything else".
 * Every asset appears exactly once, and the order is total (ties broken on the
 * name), so the list never reorders itself between two renders.
 */
export function pickAssets(assets: DownloadAsset[], detected: Detected): Picked {
    const forOs = (kind: 'gui' | 'cli') => assets
        .filter((a) => a.kind === kind && a.os === detected.os)
        .sort((a, b) => archRank(a, detected.arch) - archRank(b, detected.arch)
            || extRank(a.os, a.name) - extRank(b.os, b.name)
            || a.name.localeCompare(b.name));
    const gui = detected.mobile ? [] : forOs('gui');
    const cli = detected.mobile ? [] : forOs('cli');
    const chosen = new Set<number>([...gui, ...cli].map((a) => a.id));
    const others = assets.filter((a) => !chosen.has(a.id))
        .sort((a, b) => a.os.localeCompare(b.os) || a.kind.localeCompare(b.kind)
            || extRank(a.os, a.name) - extRank(b.os, b.name) || a.name.localeCompare(b.name));
    return { gui: gui[0], guiAlternates: gui.slice(1), cli: cli[0], cliAlternates: cli.slice(1), others };
}

/** Assets grouped by OS for the "all downloads" table, in a fixed OS order. */
export function groupByOs(assets: DownloadAsset[]): Array<{ os: string; assets: DownloadAsset[] }> {
    const order = ['windows', 'macos', 'linux', 'other'];
    const out: Array<{ os: string; assets: DownloadAsset[] }> = [];
    for (const os of order) {
        const list = assets.filter((a) => (order.includes(a.os) ? a.os : 'other') === os)
            .sort((a, b) => a.kind.localeCompare(b.kind) || extRank(a.os, a.name) - extRank(b.os, b.name)
                || a.name.localeCompare(b.name));
        if (list.length) out.push({ os, assets: list });
    }
    return out;
}

export function formatSize(bytes: number): string {
    if (!bytes || bytes < 0) return '';
    if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(bytes > 100 * 1024 * 1024 ? 0 : 1)} MB`;
}

/** The architecture and format, e.g. "Apple Silicon, .dmg". Never translated. */
export function assetDetail(a: DownloadAsset): string {
    const ext = (a.name.match(/\.(tar\.gz|[a-z0-9]+)$/i) || ['', ''])[1].toLowerCase();
    const arch = a.os === 'macos'
        ? (a.arch === 'arm64' ? 'Apple Silicon' : a.arch === 'universal' ? 'Universal' : 'Intel')
        : a.arch;
    return ext ? `${arch}, .${ext}` : arch;
}

/** The release date as YYYY-MM-DD, or '' when absent or unparseable. */
export function releaseDate(published: string | undefined): string {
    if (!published) return '';
    const m = /^(\d{4}-\d{2}-\d{2})/.exec(published);
    return m ? m[1] : '';
}

/**
 * How to put the SelfStudyCode CLI on the PATH once downloaded. Commands are
 * left in English and are never translated: a translated command is a command
 * that does not run.
 */
export function cliInstallCommands(os: OsId, fileName: string): string[] {
    if (os === 'windows') {
        return [
            `New-Item -ItemType Directory -Force "$env:LOCALAPPDATA\\SelfStudyCode" | Out-Null`,
            `Move-Item "$HOME\\Downloads\\${fileName}" "$env:LOCALAPPDATA\\SelfStudyCode\\selfstudycode.exe" -Force`,
            `[Environment]::SetEnvironmentVariable('Path', $env:Path + ";$env:LOCALAPPDATA\\SelfStudyCode", 'User')`,
            'selfstudycode login',
        ];
    }
    const bin = fileName.replace(/\.tar\.gz$/, '');
    return [
        `tar -xzf ~/Downloads/${fileName} -C ~/Downloads`,
        `mkdir -p ~/.local/bin && mv ~/Downloads/${bin} ~/.local/bin/selfstudycode && chmod +x ~/.local/bin/selfstudycode`,
        ...(os === 'macos' ? ['xattr -d com.apple.quarantine ~/.local/bin/selfstudycode 2>/dev/null || true'] : []),
        'selfstudycode login',
    ];
}
