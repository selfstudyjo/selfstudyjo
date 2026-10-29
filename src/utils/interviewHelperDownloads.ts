/*
  Where the desktop Interview Helper is downloaded from, and which installer
  this visitor wants. A plain module: no Vue, no DOM beyond the navigator object
  it is handed.

  THE SOURCE REPO IS PRIVATE, so its releases/latest is a GitHub 404 for every
  visitor. Its release workflow copies the installers to a PUBLIC repo under
  STABLE names (scripts/publish-downloads.sh in
  selfstudyjo-desktop-interview-helper), so these URLs never change between
  versions: /releases/latest/download/<name> always serves the newest one.
  Rename an asset here and there together, or every button 404s.
*/

export const DOWNLOAD_REPO = 'selfstudyjo/selfstudy-interview-helper-downloads';
export const RELEASES_PAGE = `https://github.com/${DOWNLOAD_REPO}/releases/latest`;

export type InstallerId = 'windows' | 'mac-arm64' | 'mac-x64' | 'appimage' | 'deb';

export interface Installer {
  id: InstallerId;
  file: string;
  url: string;
}

const asset = (file: string) => `https://github.com/${DOWNLOAD_REPO}/releases/latest/download/${file}`;

export const INSTALLERS: Installer[] = [
  { id: 'windows', file: 'SelfStudy-Interview-Helper-Windows.exe' },
  { id: 'mac-arm64', file: 'SelfStudy-Interview-Helper-macOS-arm64.dmg' },
  { id: 'mac-x64', file: 'SelfStudy-Interview-Helper-macOS-x64.dmg' },
  { id: 'appimage', file: 'SelfStudy-Interview-Helper-Linux.AppImage' },
  { id: 'deb', file: 'SelfStudy-Interview-Helper-Linux.deb' },
].map((i) => ({ ...i, id: i.id as InstallerId, url: asset(i.file) }));

export function installer(id: InstallerId): Installer {
  return INSTALLERS.find((i) => i.id === id) as Installer;
}

export type DetectedOs = 'windows' | 'mac' | 'linux' | 'mobile' | 'unknown';

interface NavLike {
  userAgent?: string;
  platform?: string;
  maxTouchPoints?: number;
  userAgentData?: { platform?: string; mobile?: boolean } | null;
}

/**
 * The visitor's OS, from the client hint when the browser sends one and the
 * user agent otherwise. A phone or tablet is `mobile` - there is no installer
 * for it, so the page says "open this on your computer" rather than guessing.
 * An iPad reports itself as a Mac; touch points tell them apart.
 */
export function detectOs(nav: NavLike | undefined): DetectedOs {
  if (!nav) return 'unknown';
  const hint = (nav.userAgentData?.platform || '').toLowerCase();
  const ua = (nav.userAgent || '').toLowerCase();
  const plat = (nav.platform || '').toLowerCase();
  if (nav.userAgentData?.mobile) return 'mobile';
  if (/android|iphone|ipad|ipod|mobile/.test(ua)) return 'mobile';
  if (hint.includes('android') || hint.includes('ios')) return 'mobile';
  const isMac = hint.includes('mac') || plat.startsWith('mac') || ua.includes('mac os x') || ua.includes('macintosh');
  if (isMac) return (nav.maxTouchPoints || 0) > 1 ? 'mobile' : 'mac';
  if (hint.includes('windows') || plat.startsWith('win') || ua.includes('windows')) return 'windows';
  if (hint.includes('linux') || hint.includes('chrome os') || plat.includes('linux') || ua.includes('linux') || ua.includes('x11')) {
    return ua.includes('cros') || hint.includes('chrome os') ? 'unknown' : 'linux';
  }
  return 'unknown';
}

/**
 * The installer to offer first. macOS defaults to Apple Silicon: every Mac sold
 * since 2021 is one and a browser on a Mac reports "Intel" either way. `macArch`
 * is the client-hint answer when the browser gives one ('arm' or 'x86').
 * Linux defaults to the AppImage, which runs on every distribution.
 */
export function primaryInstaller(os: DetectedOs, macArch?: string | null): InstallerId | null {
  if (os === 'windows') return 'windows';
  if (os === 'mac') return macArch === 'x86' ? 'mac-x64' : 'mac-arm64';
  if (os === 'linux') return 'appimage';
  return null;
}

/** The CPU architecture of a Mac, where the browser will say (Chromium only). */
export async function macArchitecture(nav: any): Promise<string | null> {
  try {
    const data = nav?.userAgentData;
    if (!data?.getHighEntropyValues) return null;
    const v = await data.getHighEntropyValues(['architecture']);
    return typeof v?.architecture === 'string' ? v.architecture : null;
  } catch {
    return null;
  }
}
