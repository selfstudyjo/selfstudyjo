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
    CLI_INSTALL_MENU, CLI_ROUTES, CLI_ROUTE_INFO, PRODUCT_IDS, SELFSTUDY_LM, assetDetail, cliInstallCommands, cliRouteOf,
    cliRoutesFor, detectOs, formatSize, gbFigures, groupByOs, isProductId, pickAssets, releaseDate,
    tabFromQuery,
} from '@/utils/products';
import type { DownloadAsset, OsId } from '@/utils/products';

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
check('the command line section is shown for every SelfStudyCode release, not only with a CLI file',
    /v-if="p\.id === 'selfstudycode'" class="prod-section"/.test(vue) && /cliRoutesFor\(/.test(vue));
check('the separate-file steps of an older release are still shown with a CLI asset',
    /v-if="p\.id === 'selfstudycode' && pickOf\(p\.id\)\.cli"/.test(vue) && /cliInstallCommands\(detected\.os/.test(vue));
check('route commands and paths are drawn in a left-to-right box',
    /<pre class="prod-cmd" dir="ltr">\{\{ CLI_ROUTE_INFO\[r\]\.lines\.join/.test(vue));
check('the app\'s menu path and option labels are their own left-to-right elements, not inside a translation',
    /class="prod-label" dir="ltr">\{\{ CLI_ROUTE_INFO\[r\]\.menu \}\}/.test(vue) && /class="prod-label" dir="ltr">\{\{ c\.label \}\}/.test(vue)
        && !/t\('[^']*Settings › About/.test(vue) && !/t\('[^']*“Always this computer/.test(vue));
check('the visitor\'s own route is marked in words, not by the border colour alone',
    /class="prod-cli__here"/.test(vue));
check('SelfStudy LM is a section of the page, drawn from SELFSTUDY_LM',
    /<section class="prod-lm"/.test(vue) && /SELFSTUDY_LM\.map/.test(vue));
check('every SelfStudy LM model has its "what it is for" line',
    SELFSTUDY_LM.every((m) => vue.includes(`'${m.id}': t(`)), SELFSTUDY_LM.filter((m) => !vue.includes(`'${m.id}': t(`)).map((m) => m.id));
check('model names, bases, sizes, memory and licences are bidi-isolated',
    ['name', 'base', 'smaller', 'size', 'ram', 'licence'].every((f) => new RegExp(`dir="ltr">\\{\\{ m\\.${f} \\}\\}`).test(vue)),
    ['name', 'base', 'smaller', 'size', 'ram', 'licence'].filter((f) => !new RegExp(`dir="ltr">\\{\\{ m\\.${f} \\}\\}`).test(vue)));
// Every element, not merely one of each: a `display` change drops a table's own
// roles in some browsers, so a single cell without one is a cell a screen
// reader no longer ties to its column.
const lmTable = (/<table class="prod-lm__table"[\s\S]*?<\/table>/.exec(vue) || [''])[0];
check('the table keeps its roles when a narrow container stacks it - on every row, header and cell',
    lmTable.length > 0 && ['table', 'rowgroup', 'row', 'columnheader', 'rowheader', 'cell'].every((r) => lmTable.includes(`role="${r}"`))
        && (lmTable.match(/<(table|thead|tbody|tr|th|td)\b[^>]*>/g) || []).every((tag) => /\brole="/.test(tag)),
    (lmTable.match(/<(table|thead|tbody|tr|th|td)\b[^>]*>/g) || []).filter((tag) => !/\brole="/.test(tag)));
check('the stacked layout\'s per-cell labels are hidden from screen readers',
    (vue.match(/class="prod-lm__label" aria-hidden="true"/g) || []).length === 4);
check('the container, not the viewport, decides when the table stacks',
    /container: prodlm \/ inline-size/.test(vue) && /@container prodlm \(max-width:/.test(vue));

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

console.log('7. SelfStudyCode 2.0.0: the command line comes in the desktop installer');
// What the 2.0.0 release workflow produces: electron-builder's artifactName
// `SelfStudyCode-${version}-${os}-${arch}.${ext}`, and no separate CLI files.
const v2names: Array<[string, string, 'x64' | 'arm64']> = [
    ['SelfStudyCode-2.0.0-win-x64.exe', 'windows', 'x64'],
    ['SelfStudyCode-2.0.0-mac-x64.dmg', 'macos', 'x64'],
    ['SelfStudyCode-2.0.0-mac-arm64.dmg', 'macos', 'arm64'],
    ['SelfStudyCode-2.0.0-linux-x86_64.AppImage', 'linux', 'x64'],
    ['SelfStudyCode-2.0.0-linux-amd64.deb', 'linux', 'x64'],
];
const v2: DownloadAsset[] = v2names.map(([name, os, arch], i) => ({ id: 101 + i, name, size: 2e8, kind: 'gui', os, arch }));
const routeOrder = (os: OsId, ua?: string) => cliRoutesFor(os, ua ? pickAssets(v2, detectOs(ua)).gui : undefined).join(',');

check('a 2.0.0 release offers no CLI file, and a desktop installer on every OS',
    [WIN, MAC, LIN].every((ua) => { const q = pickAssets(v2, detectOs(ua)); return !q.cli && !!q.gui; }));
check('every route appears exactly once, whatever the input', (() => {
    for (const os of ['windows', 'macos', 'linux', 'other'] as OsId[]) {
        for (const rec of [undefined, ...v2, assets[8]]) {
            const r = cliRoutesFor(os, rec);
            if (r.length !== CLI_ROUTES.length || new Set(r).size !== r.length) return false;
        }
    }
    return true;
})());
check('a Windows visitor sees Windows first', routeOrder('windows', WIN).startsWith('windows,'), routeOrder('windows', WIN));
check('a Mac visitor sees macOS first', routeOrder('macos', MAC).startsWith('macos,'), routeOrder('macos', MAC));
check('a Linux visitor sees the AppImage their button offers, then the .deb',
    routeOrder('linux', LIN) === 'linux-appimage,linux-deb,windows,macos', routeOrder('linux', LIN));
check('a Linux release with only a .deb puts the .deb first',
    cliRoutesFor('linux', v2.find((a) => a.name.endsWith('.deb')))[0] === 'linux-deb');
check('a phone, or an unknown system, gets every route in the fixed order',
    routeOrder('other', PHONE) === CLI_ROUTES.join(',') && cliRoutesFor('other').join(',') === CLI_ROUTES.join(','));
check('ordering does not reorder the shared list', CLI_ROUTES.join(',') === 'windows,macos,linux-appimage,linux-deb');
check('each 2.0.0 installer belongs to its route',
    ['windows', 'macos', 'macos', 'linux-appimage', 'linux-deb'].every((r, i) => cliRouteOf(v2[i]) === r));
check('an old CLI tarball, an .rpm and nothing at all belong to no route',
    cliRouteOf(assets[8]) === null && cliRouteOf({ name: 'SelfStudyCode-2.0.0.rpm', os: 'linux' }) === null && cliRouteOf(undefined) === null);
check('the route trusts the os it is handed ("darwin" contains "win")',
    cliRouteOf({ name: 'SelfStudyCode-darwin-x64.dmg', os: 'macos' }) === 'macos');
check('Windows: both commands, on the PATH', CLI_ROUTE_INFO.windows.lines.join(',') === 'selfstudycode,ssc');
check('macOS: linked into ~/.local/bin or /usr/local/bin',
    CLI_ROUTE_INFO.macos.lines.join(',') === '~/.local/bin,/usr/local/bin');
check('AppImage: ~/.local/bin/selfstudycode, and ssc beside it',
    CLI_ROUTE_INFO['linux-appimage'].lines.join(',') === '~/.local/bin/selfstudycode,~/.local/bin/ssc');
check('.deb: /usr/bin/selfstudycode and /usr/bin/ssc',
    CLI_ROUTE_INFO['linux-deb'].lines.join(',') === '/usr/bin/selfstudycode,/usr/bin/ssc');
check('every route is for the OS its name says',
    CLI_ROUTES.every((r) => r.startsWith(CLI_ROUTE_INFO[r].os)));
check('commands and paths are plain ASCII, so none of it can have been translated',
    CLI_ROUTES.every((r) => [CLI_ROUTE_INFO[r].format, ...CLI_ROUTE_INFO[r].lines].every((l) => /^[\x21-\x7e]+$/.test(l))));
check('the .dmg and the AppImage need the app\'s button; the .exe and the .deb do it themselves',
    CLI_ROUTE_INFO.macos.menu === CLI_INSTALL_MENU && CLI_ROUTE_INFO['linux-appimage'].menu === CLI_INSTALL_MENU
        && !CLI_ROUTE_INFO.windows.menu && !CLI_ROUTE_INFO['linux-deb'].menu);

// The desktop apps' own labels, read off disk (working rule 20): a label the
// page names must be one the student will actually find in the app.
const sibling = (rel: string) => { try { return fs.readFileSync(path.resolve(process.cwd(), '..', rel), 'utf8'); } catch { return ''; } };
const sscUi = sibling('selfstudycode/src/gui/renderer/app.js');
if (!sscUi) console.log('  skip  selfstudycode is not checked out beside this repo');
else {
    const [, section, button] = CLI_INSTALL_MENU.split(' › ');
    check(`SelfStudyCode's ${section} settings has the "${button}" button`,
        sscUi.includes(`settingsSection === '${section}'`) && sscUi.includes(`'${button}'`));
}
const ihHtml = sibling('selfstudyjo-desktop-interview-helper/src/renderer/app.html');
const ihChoices = [...vue.matchAll(/\{ label: '([^']+)'/g)].map((m) => m[1]);
check('the Interview Helper card lists three choices', ihChoices.length === 3, ihChoices);
if (!ihHtml) console.log('  skip  the Interview Helper is not checked out beside this repo');
else {
    const options = [...ihHtml.matchAll(/<option value="(auto|local|online)">([^<]+)<\/option>/g)].map((m) => m[2].trim());
    check('each Interview Helper choice is how one of the app\'s Local AI options begins',
        options.length === 3 && ihChoices.every((c, i) => options[i].startsWith(c)), { options, ihChoices });
    check('and the one marked as the default is the app\'s "auto"',
        /\{ label: '[^']+', isDefault: true \}/.test(vue) && ihHtml.includes('<option value="auto">' + ihChoices[0]));
}
check('an older release still gets its separate-file steps',
    cliInstallCommands('linux', 'SelfStudyCode-CLI-1.0.0-linux-x64.tar.gz')[1].includes('Downloads/SelfStudyCode-CLI-1.0.0-linux-x64 '));

console.log('8. SelfStudy LM: the table is the suite\'s own figures');
const lmIds = SELFSTUDY_LM.map((m) => m.id);
check('six models: Mini, SelfStudy LM, Pro, Max, then speech and image',
    lmIds.join(',') === 'selfstudy-lm-mini,selfstudy-lm,selfstudy-lm-pro,selfstudy-lm-max,selfstudy-speech,selfstudy-image', lmIds);
check('exactly one is recommended, and it is SelfStudy LM',
    SELFSTUDY_LM.filter((m) => m.recommended).map((m) => m.id).join(',') === 'selfstudy-lm');
check('SelfStudy LM is not a product tab', !(PRODUCT_IDS as readonly string[]).some((id) => lmIds.includes(id)));
check('gbFigures reads a size, a range and a minimum, and nothing else',
    JSON.stringify([gbFigures('1.3 GB'), gbFigures('24–32 GB'), gbFigures('24-32 GB'), gbFigures('8 GB+'), gbFigures('Any'), gbFigures('')])
        === '[[1.3],[24,32],[24,32],[8],[],[]]');
check('every size and memory figure parses',
    SELFSTUDY_LM.every((m) => gbFigures(m.size).length === 1 && (m.ram === '' || gbFigures(m.ram).length > 0)),
    SELFSTUDY_LM.filter((m) => !(gbFigures(m.size).length === 1 && (m.ram === '' || gbFigures(m.ram).length > 0))).map((m) => m.id));
check('the language models grow in size and in memory, smallest first', (() => {
    const llm = SELFSTUDY_LM.filter((m) => m.kind === 'llm');
    return llm.every((m, i) => i === 0 || (gbFigures(m.size)[0] > gbFigures(llm[i - 1].size)[0]
        && gbFigures(m.ram)[0] > gbFigures(llm[i - 1].ram)[0]));
})());
check('every language model names the memory it is made for', SELFSTUDY_LM.filter((m) => m.kind === 'llm').every((m) => !!m.ram));
check('names, models, sizes and licences carry no Arabic or Chinese: they are never translated',
    SELFSTUDY_LM.every((m) => [m.name, m.base, m.size, m.ram, m.licence, m.smaller || '']
        .every((s) => !/[؀-ۿ㐀-鿿]/.test(s))));
check('ids are unique', new Set(lmIds).size === lmIds.length);

// The suite's own catalogue, read off disk (working rule 20). The table is
// that file's figures; this is what stops it drifting when the suite changes.
interface SuiteFile { size?: number; path?: string; hf?: { size?: number; path?: string } }
interface SuiteModel {
    id: string; name: string; tier: string; license: string; recommended?: boolean; description: string;
    base: { name: string }; variants: Array<{ label: string; files: SuiteFile[] }>;
}
let suite: { models: SuiteModel[] } | null = null;
try { suite = JSON.parse(fs.readFileSync(path.resolve(process.cwd(), '..', 'selfstudy-lm', 'suite.json'), 'utf8')); }
catch { console.log('  skip  selfstudy-lm is not checked out beside this repo'); }
if (suite) {
    const GB = 1e9;
    const bytesOf = (v: { files: SuiteFile[] }) => v.files.reduce((n, f) => n + (f.hf?.size ?? f.size ?? 0), 0);
    const near = (label: string, bytes: number) => Math.abs((gbFigures(label)[0] ?? -1) - bytes / GB) <= 0.05;
    // the search model is in the suite and no app runs it yet (each app's `uses` in its
    // LocalAI), so listing it would be a download that does nothing
    const listed = suite.models.filter((m) => m.tier !== 'extra' && m.id !== 'selfstudy-embed').map((m) => m.id).sort();
    check('the table lists every suite model an app runs, except the SelfStudyCode-only extras',
        JSON.stringify([...lmIds].sort()) === JSON.stringify(listed), listed);
    for (const m of SELFSTUDY_LM) {
        const s = suite.models.find((x) => x.id === m.id);
        if (!s) { check(`${m.id} is in the suite`, false); continue; }
        const largest = Math.max(...s.variants.map(bytesOf));
        check(`${m.id}: named as the suite names it`, s.name === m.name, s.name);
        check(`${m.id}: ${m.size} is its largest download`, near(m.size, largest), (largest / GB).toFixed(3));
        check(`${m.id}: the licence is the suite's`, s.license === m.licence, s.license);
        check(`${m.id}: recommended only if the suite says so`, !!s.recommended === !!m.recommended);
        if (m.kind === 'speech') {
            // "Whisper small / base": the suite's base, and its two variants by label.
            const labels = s.variants.map((v) => v.label);
            check(`${m.id}: built on ${s.base.name.split(' ')[0]}, in the sizes it ships`,
                s.base.name.startsWith(m.base.split(' ')[0]) && m.base.split(/[\s/]+/).slice(1).every((w) => labels.includes(w)),
                { base: s.base.name, labels });
        } else {
            check(`${m.id}: built on what the suite names`, s.base.name === m.base || s.base.name.startsWith(m.base), s.base.name);
        }
        if (m.kind === 'llm') {
            // The suite states the memory in each language model's description.
            const said = (/(\d+)(?:\s*-\s*(\d+))?\s*GB/.exec(s.description) || []).slice(1).filter(Boolean).map(Number);
            check(`${m.id}: ${m.ram} is the memory the suite gives`,
                said.length > 0 && JSON.stringify(said) === JSON.stringify(gbFigures(m.ram)), { said, table: m.ram });
        }
        if (m.smaller) {
            const [file, size] = m.smaller.split('·').map((x) => x.trim());
            const v = s.variants.find((x) => x.files.some((f) => (f.hf?.path ?? f.path ?? '').startsWith(file)));
            check(`${m.id}: the smaller file is one of its variants, at that size`,
                !!v && near(size, bytesOf(v)), v ? (bytesOf(v) / GB).toFixed(3) : 'no such variant');
        }
    }
}

console.log(`${passed} passed, ${failed} failed`);
if (failed) process.exit(1);
