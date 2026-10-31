// Verifies which SelfStudyCode installer the AI Chat page offers, without a browser.
//
//   npm run check:sscdownloads
//
// The asset names below are the ones the release workflow really produces
// (selfstudycode/package.json artifactName and scripts/build-cli.mjs).
import fs from 'node:fs';
import { detectOs, pickAssets, assetLabel, formatSize, cliInstallCommands } from '@/utils/selfstudyCodeDownloads';
import type { DownloadAsset } from '@/utils/selfstudyCodeDownloads';

let passed = 0;
let failed = 0;
function check(name: string, cond: unknown) {
    if (cond) passed++;
    else { failed++; console.log('FAIL', name); }
}

const names: Array<[string, 'gui' | 'cli', string, 'x64' | 'arm64']> = [
    ['SelfStudyCode-1.0.0-win-x64.exe', 'gui', 'windows', 'x64'],
    ['SelfStudyCode-1.0.0-mac-x64.dmg', 'gui', 'macos', 'x64'],
    ['SelfStudyCode-1.0.0-mac-arm64.dmg', 'gui', 'macos', 'arm64'],
    ['SelfStudyCode-1.0.0-linux-x86_64.AppImage', 'gui', 'linux', 'x64'],
    ['SelfStudyCode-1.0.0-linux-amd64.deb', 'gui', 'linux', 'x64'],
    ['SelfStudyCode-CLI-1.0.0-win-x64.exe', 'cli', 'windows', 'x64'],
    ['SelfStudyCode-CLI-1.0.0-mac-arm64.tar.gz', 'cli', 'macos', 'arm64'],
    ['SelfStudyCode-CLI-1.0.0-mac-x64.tar.gz', 'cli', 'macos', 'x64'],
    ['SelfStudyCode-CLI-1.0.0-linux-x64.tar.gz', 'cli', 'linux', 'x64'],
    ['SelfStudyCode-CLI-1.0.0-linux-arm64.tar.gz', 'cli', 'linux', 'arm64'],
];
const assets: DownloadAsset[] = names.map(([name, kind, os, arch], i) => ({ id: i + 1, name, size: 1e8, kind, os, arch }));

const WIN = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/141.0 Safari/537.36';
const MAC = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 Version/18.0 Safari/605.1.15';
const LIN = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/141.0 Safari/537.36';
const LINARM = 'Mozilla/5.0 (X11; Linux aarch64) AppleWebKit/537.36 Chrome/141.0 Safari/537.36';
const PHONE = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148';

check('windows detected', detectOs(WIN).os === 'windows' && detectOs(WIN).arch === 'x64');
check('mac without hint has NO arch guess', detectOs(MAC).os === 'macos' && detectOs(MAC).arch === null);
check('mac with arm hint', detectOs(MAC, 'MacIntel', 'arm').arch === 'arm64');
check('mac with x86 hint', detectOs(MAC, 'MacIntel', 'x86').arch === 'x64');
check('linux', detectOs(LIN).os === 'linux');
check('linux arm', detectOs(LINARM).arch === 'arm64');
check('phone is other (not macOS)', detectOs(PHONE).os === 'other');

let p = pickAssets(assets, detectOs(WIN));
check('windows gui exe', p.gui?.name === 'SelfStudyCode-1.0.0-win-x64.exe');
check('windows cli exe', p.cli?.name === 'SelfStudyCode-CLI-1.0.0-win-x64.exe');
check('windows others has the rest', p.others.length === assets.length - 2);

p = pickAssets(assets, detectOs(MAC, 'MacIntel', 'arm'));
check('apple silicon dmg first', p.gui?.name.includes('mac-arm64.dmg'));
check('intel dmg offered as alternate', p.guiAlternates.some((a) => a.name.includes('mac-x64.dmg')));
check('apple silicon cli', p.cli?.name.includes('mac-arm64'));

p = pickAssets(assets, detectOs(MAC));
check('mac with no hint still offers a dmg', !!p.gui && p.gui.name.endsWith('.dmg'));
check('and the other arch as alternate', p.guiAlternates.length === 1);

p = pickAssets(assets, detectOs(LIN));
check('linux AppImage first', p.gui?.name.endsWith('.AppImage'));
check('linux deb alternate', p.guiAlternates.some((a) => a.name.endsWith('.deb')));
check('linux x64 cli', p.cli?.name.includes('linux-x64'));

p = pickAssets(assets, detectOs(PHONE));
check('phone: no recommendation', !p.gui && !p.cli);
check('phone: every asset listed', p.others.length === assets.length);

check('no asset appears twice', (() => {
    for (const ua of [WIN, MAC, LIN, PHONE]) {
        const q = pickAssets(assets, detectOs(ua));
        const ids = [q.gui, q.cli, ...q.guiAlternates, ...q.cliAlternates, ...q.others].filter(Boolean).map((a) => a!.id);
        if (new Set(ids).size !== ids.length || ids.length !== assets.length) return false;
    }
    return true;
})());

check('label mac arm', assetLabel(assets[2]).detail === 'Apple Silicon, .dmg');
check('label tar.gz', assetLabel(assets[6]).detail.endsWith('.tar.gz'));
check('size MB', formatSize(115557376) === '110 MB');
check('size empty', formatSize(0) === '');
check('windows install puts it on PATH', cliInstallCommands('windows', 'x.exe').some((c) => c.includes("SetEnvironmentVariable('Path'")));
check('mac install clears quarantine', cliInstallCommands('macos', 'SelfStudyCode-CLI-1.0.0-mac-arm64.tar.gz').some((c) => c.includes('quarantine')));
check('linux install strips .tar.gz for the binary', cliInstallCommands('linux', 'a.tar.gz')[1].includes('Downloads/a '));

// The component must never render a URL or a name with v-html, and must not
// fetch a release URL directly (the repo is private: that is a 404 for everyone).
// Comments stripped first: the component's own header says it never uses v-html,
// and a check that fires on the comment explaining it cannot be documented.
const vue = fs.readFileSync('src/components/aichat/SelfStudyCodeDownload.vue', 'utf8')
    .replace(/<!--[\s\S]*?-->/g, '').replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
check('the stripped source is not empty (a vacuous check passes on nothing)', vue.includes('selfStudyCodeService') && vue.includes('<template>'));
check('no v-html', !/v-html/.test(vue));
check('no direct github release link', !/github\.com\/[^'"]*\/releases/.test(vue));
check('downloads through the signed-url service', /selfStudyCodeService\.downloadUrl/.test(vue));
check('commands are pinned ltr', /dir="ltr"/.test(vue));
check('scoped styles', /<style scoped/.test(vue));

console.log(`${passed} passed, ${failed} failed`);
if (failed) process.exit(1);
