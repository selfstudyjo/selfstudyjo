// Verifies the SelfStudy Products page's decisions without a browser.
//
//   npm run check:products
//
// The asset names below are the ones the release workflows really produce
// (electron-builder artifactName in each desktop repo, and SelfStudyCode's
// scripts/build-cli.mjs). The classification of a NAME is app 27's
// (products.classify_asset); this module trusts the `os`/`arch` it is handed.
import fs from 'node:fs';
import path from 'node:path';
import {
    PRODUCT_IDS, assetDetail, cliInstallCommands, detectOs, formatSize, groupByOs, isProductId,
    pickAssets, releaseDate, tabFromQuery,
} from '@/utils/products';
import type { DownloadAsset } from '@/utils/products';

let passed = 0;
let failed = 0;
function check(name: string, cond: unknown, detail?: unknown) {
    if (cond) passed++;
    else { failed++; console.log('FAIL', name, detail === undefined ? '' : JSON.stringify(detail)); }
}

const names: Array<[string, 'gui' | 'cli', string, 'x64' | 'arm64' | 'universal']> = [
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
const CROS = 'Mozilla/5.0 (X11; CrOS x86_64 14541.0.0) AppleWebKit/537.36 Chrome/141.0 Safari/537.36';

console.log('1. Tabs');
check('three products, in catalogue order', PRODUCT_IDS.join(',') === 'selfstudycode,interview-helper,video-editor');
check('?tab=interview-helper opens that tab', tabFromQuery('interview-helper') === 'interview-helper');
check('case and spaces are forgiven', tabFromQuery(' Video-Editor ') === 'video-editor');
check('an unknown tab falls back to the first', tabFromQuery('nope') === 'selfstudycode');
check('a missing tab falls back to the first', tabFromQuery(undefined) === 'selfstudycode');
check('a repeated query parameter takes the first value', tabFromQuery(['video-editor', 'x']) === 'video-editor');
check('isProductId', isProductId('selfstudycode') && !isProductId('Selfstudycode'));

console.log('2. Detection');
check('windows detected', detectOs(WIN).os === 'windows' && detectOs(WIN).arch === 'x64');
check('mac without hint has NO arch guess', detectOs(MAC).os === 'macos' && detectOs(MAC).arch === null);
check('mac with arm hint', detectOs(MAC, 'MacIntel', 'arm').arch === 'arm64');
check('mac with x86 hint', detectOs(MAC, 'MacIntel', 'x86').arch === 'x64');
check('an iPad (a "Mac" with touch points) is mobile', detectOs(MAC, 'MacIntel', '', 5).mobile === true);
check('linux', detectOs(LIN).os === 'linux');
check('linux arm', detectOs(LINARM).arch === 'arm64');
check('phone is mobile, not macOS', detectOs(PHONE).os === 'other' && detectOs(PHONE).mobile);
check('ChromeOS is not offered a Linux build as if it were one', detectOs(CROS).os === 'other');

console.log('3. Picking');
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

const universal: DownloadAsset[] = [
    { id: 1, name: 'App-1.0-universal.dmg', size: 1, kind: 'gui', os: 'macos', arch: 'universal' },
    { id: 2, name: 'App-1.0-x64.dmg', size: 1, kind: 'gui', os: 'macos', arch: 'x64' },
];
check('an arm Mac prefers a universal build over an Intel one',
    pickAssets(universal, detectOs(MAC, 'MacIntel', 'arm')).gui?.id === 1);

check('no asset appears twice, none is lost', (() => {
    for (const ua of [WIN, MAC, LIN, PHONE, LINARM]) {
        const q = pickAssets(assets, detectOs(ua));
        const ids = [q.gui, q.cli, ...q.guiAlternates, ...q.cliAlternates, ...q.others].filter(Boolean).map((a) => a!.id);
        if (new Set(ids).size !== ids.length || ids.length !== assets.length) return false;
    }
    return true;
})());
check('the order is stable: the same input gives the same answer', (() => {
    const a = JSON.stringify(pickAssets(assets, detectOs(LIN)));
    const b = JSON.stringify(pickAssets([...assets].reverse(), detectOs(LIN)));
    return a === b;
})());
check('an empty release gives an empty, not a broken, pick',
    (() => { const q = pickAssets([], detectOs(WIN)); return !q.gui && !q.cli && q.others.length === 0; })());

console.log('4. Grouping and labels');
const groups = groupByOs(assets);
check('grouped Windows, macOS, Linux in that order', groups.map((g) => g.os).join(',') === 'windows,macos,linux');
check('every asset in exactly one group', groups.reduce((n, g) => n + g.assets.length, 0) === assets.length);
check('an unknown os lands in "other"',
    groupByOs([{ id: 9, name: 'x.bin', size: 1, kind: 'gui', os: 'beos', arch: 'x64' }])[0]?.os === 'other');
check('label mac arm', assetDetail(assets[2]) === 'Apple Silicon, .dmg');
check('label tar.gz', assetDetail(assets[6]).endsWith('.tar.gz'));
check('label AppImage is lower-cased', assetDetail(assets[3]) === 'x64, .appimage');
check('size MB', formatSize(115557376) === '110 MB');
check('size empty', formatSize(0) === '');
check('release date', releaseDate('2026-11-01T10:00:00Z') === '2026-11-01' && releaseDate('') === '' && releaseDate('junk') === '');
check('windows install puts it on PATH', cliInstallCommands('windows', 'x.exe').some((c) => c.includes("SetEnvironmentVariable('Path'")));
check('mac install clears quarantine', cliInstallCommands('macos', 'SelfStudyCode-CLI-1.0.0-mac-arm64.tar.gz').some((c) => c.includes('quarantine')));
check('linux install strips .tar.gz for the binary', cliInstallCommands('linux', 'a.tar.gz')[1].includes('Downloads/a '));

console.log('5. The page and its service');
// Comments stripped first: a header that says "never v-html" must not make the
// check fire, and a check whose input was emptied must not pass (rule 44).
const strip = (s: string) => s.replace(/<!--[\s\S]*?-->/g, '').replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
const read = (rel: string) => fs.readFileSync(path.resolve(process.cwd(), rel), 'utf8');
const vue = strip(read('src/views/Products.vue'));
const svc = strip(read('src/services/products.service.ts'));
check('the stripped page is not empty', vue.includes('productsService') && vue.includes('<template>'));
check('no v-html', !/v-html/.test(vue));
check('no direct github release link', !/github\.com\/[^'"]*\/releases/.test(vue + svc));
check('downloads through the signed-url service', /productsService\.downloadUrl/.test(vue));
check('a signed URL must be https', /\^https:/.test(svc));
check('commands are pinned ltr', /class="prod-cmd" dir="ltr"/.test(vue));
check('scoped styles', /<style scoped/.test(vue));
check('tabs are real tabs (role, aria-selected, aria-controls)',
    /role="tablist"/.test(vue) && /role="tab"/.test(vue) && /aria-selected/.test(vue) && /role="tabpanel"/.test(vue));
check('the tab is read from ?tab= through tabFromQuery', /tabFromQuery\(route\.query\.tab\)/.test(vue));
check('switching tabs replaces the URL rather than pushing history', /router\.replace\(/.test(vue) && !/router\.push\(/.test(svc + vue));
check('the 3D guide is mounted only once its tab has been opened', /opened\.has\('interview-helper'\)/.test(vue));
check('the service uses the pinned replica', /serviceRegistry\.getRandomAiReplica\(\)/.test(svc) && !/Math\.random/.test(svc));
check('the service never holds the auth token', !/VITE_AUTH_TOKEN/.test(svc));
check('the user is named in a header', /'X-User-ID'/.test(svc));

console.log('6. What was removed stays removed');
const gone = (rel: string) => !fs.existsSync(path.resolve(process.cwd(), rel));
check('the AI Chat download button component is deleted', gone('src/components/aichat/SelfStudyCodeDownload.vue'));
check('the SelfStudyCode-only picker is deleted', gone('src/utils/selfstudyCodeDownloads.ts'));
check('the public-mirror Interview Helper links are deleted', gone('src/utils/interviewHelperDownloads.ts'));
check('the standalone Interview Helper page is deleted', gone('src/views/InterviewHelper.vue'));
const chat = strip(read('src/views/AiChat.vue'));
check('the AI Chat page has no download button', !/SelfStudyCodeDownload|Download SelfStudyCode/.test(chat));
const pkg = read('package.json');
check('check:sscdownloads is gone from package.json', !/sscdownloads/.test(pkg));
check('check:products is part of npm run check', /"check":[^\n]*check:products/.test(pkg));

// The server half: app 27's products.py, read off disk (working rule 20).
let py = '';
try { py = fs.readFileSync(path.resolve(process.cwd(), '..', 'selfstudyai', 'products.py'), 'utf8'); }
catch { console.log('  skip  selfstudyai is not checked out beside this repo'); }
if (py) {
    for (const id of PRODUCT_IDS) check(`app 27 serves the ${id} product`, py.includes(`'id': '${id}'`));
    check('app 27 checks the subscription on both routes', (py.match(/denied = _gate\(\)/g) || []).length >= 2);
    check('app 27 asks GitHub for the asset with redirects off', /allow_redirects=False/.test(py));
}

console.log(`${passed} passed, ${failed} failed`);
if (failed) process.exit(1);
