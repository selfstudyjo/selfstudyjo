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
 *     old or mistyped link still lands somewhere useful;
 *   - from SelfStudyCode 2.0.0 the command line comes INSIDE the desktop
 *     installer, so the latest release has no `kind: 'cli'` asset: how the
 *     command reaches a terminal depends on the installer format and is listed
 *     with the visitor's own first (`cliRoutesFor`), while an older release
 *     still gets its separate-file steps (`cliInstallCommands`);
 *   - the SelfStudy LM table is the suite's own catalogue figures, checked
 *     against selfstudy-lm/suite.json rather than typed in and left to drift.
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
 *
 * For a release BEFORE 2.0.0 only, which shipped the command line as separate
 * `kind: 'cli'` files. From 2.0.0 the desktop installer carries the command
 * itself (see `cliRoutesFor` below), so the latest release has no cli asset and
 * the page shows these steps only when an older release is the one served.
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

/* ------------------------------------------------------------------ *
 * SelfStudyCode 2.0.0: one installer gives the app AND the command
 * ------------------------------------------------------------------ */

/**
 * From 2.0.0 ONE installer per OS gives SelfStudyCode's desktop app and its
 * `selfstudycode` command (short name `ssc`); the two share the sign-in,
 * settings, chats and local models. How the command reaches a terminal is
 * decided by the INSTALLER FORMAT, not by the OS alone, which is why Linux has
 * two routes (selfstudycode/src/gui/cli-command.js is the other side of this):
 *
 *   windows         the .exe installer adds its bin folder (selfstudycode.cmd,
 *                   ssc.cmd) to the user's PATH
 *   macos           a .dmg runs no installer: the app's Settings › About ›
 *                   Install the command links both into ~/.local/bin, or into
 *                   /usr/local/bin when that folder is writable
 *   linux-appimage  the same button writes ~/.local/bin/selfstudycode (and ssc),
 *                   scripts that start the AppImage
 *   linux-deb       the .deb installs /usr/bin/selfstudycode and /usr/bin/ssc
 *
 * `lines` are what the page prints in a left-to-right code box: commands and
 * paths, never translated - a translated path is a folder that does not exist,
 * and inside Arabic prose the bidi algorithm would move its slashes and dots.
 */
export type CliRoute = 'windows' | 'macos' | 'linux-appimage' | 'linux-deb';

/** The fixed order, used wherever the visitor's own route does not decide it. */
export const CLI_ROUTES: readonly CliRoute[] = ['windows', 'macos', 'linux-appimage', 'linux-deb'];

export interface CliRouteInfo {
    os: OsId;
    /** The installer format shown beside the OS name. Never translated. */
    format: string;
    /**
     * Where to click in the desktop app, when the installer does not do it: the
     * app's own English labels (selfstudycode/src/gui/renderer/app.js), shown
     * as they are so the student finds them, and in an element of their own so
     * the label is not wrapped and reordered inside an Arabic sentence.
     */
    menu?: string;
    lines: readonly string[];
}

/** The desktop app's menu path to its "Install the command" button. */
export const CLI_INSTALL_MENU = 'Settings › About › Install the command';

export const CLI_ROUTE_INFO: Readonly<Record<CliRoute, CliRouteInfo>> = {
    windows: { os: 'windows', format: '.exe', lines: ['selfstudycode', 'ssc'] },
    macos: { os: 'macos', format: '.dmg', menu: CLI_INSTALL_MENU, lines: ['~/.local/bin', '/usr/local/bin'] },
    'linux-appimage': { os: 'linux', format: 'AppImage', menu: CLI_INSTALL_MENU, lines: ['~/.local/bin/selfstudycode', '~/.local/bin/ssc'] },
    'linux-deb': { os: 'linux', format: '.deb', lines: ['/usr/bin/selfstudycode', '/usr/bin/ssc'] },
};

/** The route an installer belongs to, or null for a file that is none of the four. */
export function cliRouteOf(asset: Pick<DownloadAsset, 'name' | 'os'> | undefined): CliRoute | null {
    if (!asset) return null;
    const name = lower(asset.name);
    if (asset.os === 'windows' && name.endsWith('.exe')) return 'windows';
    if (asset.os === 'macos' && name.endsWith('.dmg')) return 'macos';
    if (asset.os === 'linux' && name.endsWith('.appimage')) return 'linux-appimage';
    if (asset.os === 'linux' && name.endsWith('.deb')) return 'linux-deb';
    return null;
}

/**
 * Every route, the visitor's own first: the route of the installer their
 * download button offers, then the rest of their OS (on Linux, the other
 * format), then everything else in the fixed order. Each route appears exactly
 * once whatever it is given, so an undetected OS or a phone still gets all four.
 */
export function cliRoutesFor(os: OsId, recommended?: Pick<DownloadAsset, 'name' | 'os'>): CliRoute[] {
    const mine = cliRouteOf(recommended);
    const rank = (r: CliRoute) => (r === mine ? 0 : CLI_ROUTE_INFO[r].os === os ? 1 : 2);
    return [...CLI_ROUTES].sort((a, b) => rank(a) - rank(b) || CLI_ROUTES.indexOf(a) - CLI_ROUTES.indexOf(b));
}

/* ------------------------------------------------------------------ *
 * SelfStudy LM: the local AI the three desktop apps share
 * ------------------------------------------------------------------ */

/**
 * The models of the SelfStudy LM suite, for the table on the Products page.
 *
 * Taken from the suite's own catalogue - `selfstudy-lm/suite.json`, the file
 * its release is built from, and the README beside it - and not invented here:
 * `npm run check:products` reads that file off disk when the sibling checkout
 * is present and fails on a size, a base model, a memory figure or a licence
 * that no longer agrees with it (working rule 20). It skips rather than passes
 * when the checkout is absent.
 *
 *   size     the download, in decimal GB as the apps themselves show it - the
 *            largest variant, since the apps pick the largest one that fits
 *   ram      the memory the model is made for; '' means any computer
 *   smaller  the smaller file the apps fall back to when memory is short
 *
 * Every string here is a product name, a model name, a figure or a licence id,
 * so none of it is translated, and the page draws each in a left-to-right
 * element so that Arabic does not reorder `Qwen3.5-4B` or `24–32 GB`. What each
 * model is FOR is page text, translated in Products.vue.
 *
 * These are open models, packaged rather than trained: the weights are the base
 * models' own (selfstudy-lm/MODEL_CARD.md), which the page says plainly. The
 * suite's extras (tier 'extra': Gemma 4 Vision, Qwen3.8 27B, Qwen3-Coder) are
 * SelfStudyCode-only add-ons and deliberately not listed.
 */
export type LmKind = 'llm' | 'speech' | 'image' | 'embed';

export interface LmModel {
    /** The model's id in the suite catalogue. */
    id: string;
    name: string;
    kind: LmKind;
    base: string;
    size: string;
    ram: string;
    licence: string;
    recommended?: boolean;
    smaller?: string;
    /** Best with a graphics card (the image model). */
    gpuHelps?: boolean;
}

export const SELFSTUDY_LM: readonly LmModel[] = [
    { id: 'selfstudy-lm-mini', name: 'SelfStudy LM Mini', kind: 'llm', base: 'Qwen3.5-2B', smaller: 'Qwen3.5-0.8B · 0.5 GB', size: '1.3 GB', ram: '4 GB', licence: 'Apache-2.0' },
    { id: 'selfstudy-lm', name: 'SelfStudy LM', kind: 'llm', base: 'Qwen3.5-4B', size: '3.4 GB', ram: '8 GB', licence: 'Apache-2.0', recommended: true },
    { id: 'selfstudy-lm-pro', name: 'SelfStudy LM Pro', kind: 'llm', base: 'Qwen3.5-9B', size: '6.6 GB', ram: '16 GB', licence: 'Apache-2.0' },
    { id: 'selfstudy-lm-max', name: 'SelfStudy LM Max', kind: 'llm', base: 'Qwen3.6-35B-A3B', size: '18.6 GB', ram: '24–32 GB', licence: 'Apache-2.0' },
    { id: 'selfstudy-speech', name: 'SelfStudy Speech', kind: 'speech', base: 'Whisper small / base', size: '0.25 GB', ram: '', licence: 'Apache-2.0' },
    { id: 'selfstudy-image', name: 'SelfStudy Image', kind: 'image', base: 'FLUX.2 [klein] 4B + Qwen3-4B', size: '5.3 GB', ram: '8 GB+', licence: 'Apache-2.0', gpuHelps: true },
];

/** A size or memory label ("1.3 GB", "24–32 GB", "8 GB+") as numbers, for the check. [] when it is not one. */
export function gbFigures(label: string): number[] {
    const m = /^(\d+(?:\.\d+)?)(?:\s*[–-]\s*(\d+(?:\.\d+)?))?\s*GB\+?$/.exec(label.trim());
    if (!m) return [];
    return m[2] === undefined ? [Number(m[1])] : [Number(m[1]), Number(m[2])];
}
