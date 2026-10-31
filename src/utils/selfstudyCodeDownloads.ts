/**
 * Which SelfStudyCode installer to offer this visitor. A plain module (no Vue, no
 * DOM) on the photoMask.ts / dashboardProgress.ts precedent, so
 * `npm run check:sscdownloads` can drive it in node.
 *
 * The installers live in the PRIVATE repo mahmoudodoo/selfstudycode's GitHub
 * Releases. App 27 lists them (`GET /api/selfstudycode/downloads`) and hands out
 * a short-lived signed URL per asset (`POST /api/selfstudycode/download`), so the
 * browser downloads straight from GitHub's storage without the repo being public.
 *
 * Three things here fail silently if wrong, which is why they are checked:
 *   - macOS reports "Intel" in its user agent even on Apple Silicon, so arch comes
 *     from User-Agent Client Hints when the browser has them, and a Mac with no
 *     hint is offered BOTH builds rather than a guess presented as an answer;
 *   - a Linux visitor gets the AppImage first (runs anywhere) and the .deb second;
 *   - an OS with no build gets the full list, never an empty panel.
 */

export type OsId = 'windows' | 'macos' | 'linux' | 'other';
export type Arch = 'x64' | 'arm64';

export interface DownloadAsset {
    id: number;
    name: string;
    size: number;
    kind: 'gui' | 'cli';
    os: string;
    arch: Arch;
}

export interface Detected {
    os: OsId;
    /** null when the browser cannot tell (a Mac with no client hints). */
    arch: Arch | null;
}

export const OS_LABELS: Record<OsId, string> = {
    windows: 'Windows',
    macos: 'macOS',
    linux: 'Linux',
    other: 'your system',
};

export function detectOs(userAgent: string, platform = '', hintArch = ''): Detected {
    const ua = `${userAgent} ${platform}`.toLowerCase();
    let os: OsId = 'other';
    if (/android|iphone|ipad|ipod/.test(ua)) os = 'other';
    else if (/windows|win32|win64/.test(ua)) os = 'windows';
    else if (/mac os|macintosh|macintel|darwin/.test(ua)) os = 'macos';
    else if (/linux|x11|cros/.test(ua)) os = 'linux';
    const hint = hintArch.toLowerCase();
    let arch: Arch | null = null;
    if (hint) arch = /arm|aarch/.test(hint) ? 'arm64' : 'x64';
    else if (/arm64|aarch64/.test(ua)) arch = 'arm64';
    else if (os !== 'macos') arch = 'x64';
    return { os, arch };
}

const GUI_EXT: Record<string, string[]> = {
    windows: ['.exe'],
    macos: ['.dmg'],
    linux: ['.appimage', '.deb'],
};

const lower = (s: string) => s.toLowerCase();

function byArch(list: DownloadAsset[], arch: Arch | null): DownloadAsset[] {
    if (!arch) return list;
    return [...list].sort((a, b) => Number(b.arch === arch) - Number(a.arch === arch));
}

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

export function pickAssets(assets: DownloadAsset[], detected: Detected): Picked {
    const forOs = (kind: 'gui' | 'cli') => assets.filter((a) => a.kind === kind && a.os === detected.os);
    const exts = GUI_EXT[detected.os] || [];
    const gui = byArch(forOs('gui'), detected.arch)
        .sort((a, b) => {
            const ia = exts.findIndex((e) => lower(a.name).endsWith(e));
            const ib = exts.findIndex((e) => lower(b.name).endsWith(e));
            return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib) || (a.arch === b.arch ? 0 : 0) || a.name.localeCompare(b.name);
        });
    const guiSorted = detected.arch ? byArch(gui, detected.arch).sort((a, b) =>
        Number(b.arch === detected.arch) - Number(a.arch === detected.arch)
        || exts.findIndex((e) => lower(a.name).endsWith(e)) - exts.findIndex((e) => lower(b.name).endsWith(e))) : gui;
    const cli = byArch(forOs('cli'), detected.arch);
    const chosen = new Set<number>();
    const pickedGui = guiSorted[0];
    const pickedCli = cli[0];
    if (pickedGui) chosen.add(pickedGui.id);
    if (pickedCli) chosen.add(pickedCli.id);
    const guiAlternates = guiSorted.slice(1);
    const cliAlternates = cli.slice(1);
    guiAlternates.forEach((a) => chosen.add(a.id));
    cliAlternates.forEach((a) => chosen.add(a.id));
    const others = assets.filter((a) => !chosen.has(a.id))
        .sort((a, b) => a.os.localeCompare(b.os) || a.kind.localeCompare(b.kind) || a.name.localeCompare(b.name));
    return { gui: pickedGui, guiAlternates, cli: pickedCli, cliAlternates, others };
}

export function formatSize(bytes: number): string {
    if (!bytes || bytes < 0) return '';
    if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(bytes > 100 * 1024 * 1024 ? 0 : 1)} MB`;
}

/** A short human label for one asset: "macOS app (Apple Silicon, .dmg)". */
export function assetLabel(a: DownloadAsset): { os: string; kind: string; detail: string } {
    const os = OS_LABELS[(a.os as OsId)] || a.os;
    const ext = (a.name.match(/\.(tar\.gz|[a-z0-9]+)$/i) || ['', ''])[1];
    const arch = a.os === 'macos' ? (a.arch === 'arm64' ? 'Apple Silicon' : 'Intel') : a.arch;
    return { os, kind: a.kind === 'gui' ? 'Desktop app' : 'Command line (CLI)', detail: `${arch}, .${ext}` };
}

/**
 * How to put the CLI on the PATH once downloaded. Commands are left in English
 * and are never translated: a translated command is a command that does not run.
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
