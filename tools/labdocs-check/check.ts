/**
 * npm run check:labdocs - the lab documentation model, the recipe maps and the
 * rules the documentation components must keep. No browser, no network.
 *
 * The maps are JSON written per product; they are compiled here with the
 * BROWSER's regex engine, because the authoring validator (_labdocs/validate.py)
 * runs Python's, and a pattern Python accepts and JavaScript refuses is a GUI
 * tab that silently matches nothing.
 */
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import {
  SCENE_KINDS, briefProse, fillCaptures, findRecipeHits, guiSections, labFlow, layoutDiagram,
  rankNodes, resolveRecipe, searchTerms, wrapLabel, type Diagram, type WalkthroughMap,
} from '@/utils/labDocs';

const ROOT = fileURLToPath(new URL('../../../', import.meta.url));
let passed = 0;
const failures: string[] = [];
function check(name: string, ok: unknown, detail = '') {
  if (ok) passed += 1; else failures.push(`${name}${detail ? ` - ${detail}` : ''}`);
}
const read = (p: string) => readFileSync(join(ROOT, p), 'utf8');

// --- wrapping and layout ----------------------------------------------------
const wrapped = wrapLabel('Create the lakehouse in the development workspace with a capacity', 22);
check('wrap: at most two lines', wrapped.length <= 2, JSON.stringify(wrapped));
check('wrap: a short label is one line', wrapLabel('API').length === 1);
check('wrap: no line much longer than the budget', wrapped.every(l => l.length <= 28));

const cyclic: Diagram = { dir: 'LR', nodes: [
  { id: 'a', label: 'Client', kind: 'actor' }, { id: 'b', label: 'API', kind: 'step' }, { id: 'c', label: 'Server', kind: 'data' },
], edges: [{ from: 'a', to: 'b' }, { from: 'b', to: 'c' }, { from: 'c', to: 'a', label: 'response' }] };
const ranks = rankNodes(cyclic);
check('rank: a cycle terminates and ranks forward', ranks.get('a') === 0 && ranks.get('b') === 1 && ranks.get('c') === 2);
for (const dir of ['LR', 'TB'] as const) {
  const lay = layoutDiagram({ ...cyclic, dir });
  check(`layout ${dir}: every node placed inside the canvas`, lay.nodes.every(n => n.x >= 0 && n.y >= 0
    && n.x + n.w <= lay.width + 0.5 && n.y + n.h <= lay.height + 0.5));
  const overlap = lay.nodes.some((a, i) => lay.nodes.some((b, j) => i < j
    && a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h));
  check(`layout ${dir}: no two nodes overlap`, !overlap);
  check(`layout ${dir}: the back edge is marked and drawn`, lay.edges.filter(e => e.back).length === 1 && lay.edges.length === 3);
  check(`layout ${dir}: paths are finite`, lay.edges.every(e => !/NaN|Infinity/.test(e.d)));
}
const branching = layoutDiagram({ dir: 'TB', nodes: [
  { id: 's', label: 'Start', kind: 'start' }, { id: 'd', label: 'OK?', kind: 'decision' },
  { id: 'y', label: 'Yes path', kind: 'step' }, { id: 'n', label: 'No path', kind: 'step' }, { id: 'e', label: 'End', kind: 'end' },
], edges: [{ from: 's', to: 'd' }, { from: 'd', to: 'y' }, { from: 'd', to: 'n' }, { from: 'y', to: 'e' }, { from: 'n', to: 'e' }] });
const yes = branching.nodes.find(n => n.id === 'y')!;
const no = branching.nodes.find(n => n.id === 'n')!;
check('layout: siblings share a rank side by side', Math.abs(yes.y - no.y) < 1 && yes.x !== no.x);

// --- the lab's own story ----------------------------------------------------
const brief = '## Goal\nBuild the platform for the **ops** team.\nIt spans two lines.\n\n```bash\nfab ls\n```\n- a list item\n\nSecond paragraph that is long enough to keep.\n| a | b |';
const prose = briefProse(brief);
check('brief: headings, code, lists and tables are skipped', prose.length === 2 && !prose.some(p => /fab ls|list item|\|/.test(p)), JSON.stringify(prose));
check('brief: soft-wrapped lines are joined', prose[0].includes('team. It spans'));
const flow = labFlow([{ id: 't1', title: 'One' }, { id: 't2', title: 'Two' }], { start: 'Open', end: 'Check' });
check('flow: start, every task, end, chained', flow.nodes.length === 4 && flow.edges.length === 3
  && flow.nodes[1].label === '1. One' && flow.nodes[3].kind === 'end');
const terms = [{ term: 'Pod', short: 'x', aka: [] }, { term: 'Deployment', short: 'manages pods', aka: [] }, { term: 'Container', short: 'y', aka: ['pod-like'] }];
const hits = searchTerms(terms, 'pod');
check('search: the name match leads, a definition match follows', hits[0].term === 'Pod' && hits[hits.length - 1].term === 'Deployment');

// --- recipes ----------------------------------------------------------------
check('captures: filled', fillCaptures('Name {1} on {2}', ['', 'ws', 'cap']) === 'Name ws on cap');
check('captures: a missing group is null', fillCaptures('{2}', ['', 'ws']) === null);
const map: WalkthroughMap = { skin: 'demo', product: 'Demo', brand: '#123456', top: 'Demo', nav: ['Home', 'Things', 'Admin'], recipes: [
  { id: 'make-big', title: 'Make a big thing', match: 'demo\\s+make\\s+([\\w-]+)\\s+--big', steps: [
    { say: 'Open Things.', screen: 'Things', zone: 'nav', action: 'click', target: 'Things' },
    { say: 'Name it {1}.', screen: 'New', zone: 'dialog', action: 'type', target: 'Name', value: '{1}' }] },
  { id: 'make', title: 'Make a thing', match: 'demo\\s+make\\s+([\\w-]+)(?:\\s+--size\\s+(\\d+))?', steps: [
    { say: 'Open Things.', screen: 'Things', zone: 'nav', action: 'click', target: 'Things' },
    { say: 'Set size {2}.', screen: 'New', zone: 'dialog', action: 'type', target: 'Size', value: '{2}', optional: true },
    { say: 'Press Create.', screen: 'New', zone: 'dialog', action: 'click', target: 'Create' }] },
] };
const found = findRecipeHits(['First: demo make alpha --big, then demo make beta'], map);
check('hits: the more specific recipe wins its span, the other matches elsewhere',
  found.length === 2 && found[0].recipe.id === 'make-big' && found[1].recipe.id === 'make');
const resolved = resolveRecipe(map.recipes[1], ['demo make beta', 'beta', undefined])!;
check('resolve: an optional step with no value is dropped', resolved.length === 2 && resolved.every(s => s.target !== 'Size'));
const task = { id: 't', title: 'T', gui: ['demo_portal'], instructions: { steps: ['Run demo make alpha --big', 'Press Check my work.'] },
  guide: { kinds: ['file_contains', 'state'], files: ['main.tf'] } };
const tools = [{ id: 'demo_portal', label: 'Demo', kind: 'portal', skin: 'demo' }, { id: 'files', label: 'Files', kind: 'editor' }];
const ws = JSON.parse(read('src/utils/labWalkthrough/workspace.json')) as WalkthroughMap;
const sections = guiSections(task, tools, { demo: map }, ws);
check('gui: the portal recipe first, then the Files explorer for the file', sections.length === 2
  && sections[0].skin === 'demo' && sections[1].title.includes('Files') && sections[1].command === 'main.tf');
check('gui: the file path reaches the steps', sections[1].steps.some(s => s.value === 'main.tf' || s.say.includes('main.tf')));
check('gui: nothing for a task no tool can do', guiSections({ id: 'x', title: 'x' }, tools, { demo: map }, ws).length === 0);

// --- every recipe map, compiled with the browser's regex engine ---------------
const ZONES = new Set(['top', 'nav', 'tab', 'toolbar', 'main', 'panel', 'dialog', 'editor']);
const ACTIONS = new Set(['click', 'type', 'select', 'check', 'drag', 'see']);
const mapDir = join(ROOT, 'src/utils/labWalkthrough/maps');
const mapFiles = existsSync(mapDir) ? readdirSync(mapDir).filter(f => f.endsWith('.json')) : [];
const skinsInLabPortal = [...read('src/components/labs/portals/LabPortal.vue').matchAll(/^\s+(\w+): lazy\(/gm)].map(m => m[1]);
let recipeCount = 0;
for (const file of [...mapFiles.map(f => `maps/${f}`), 'workspace.json']) {
  const data = JSON.parse(read(`src/utils/labWalkthrough/${file}`)) as WalkthroughMap;
  if (file.startsWith('maps/')) check(`${file}: names a real portal skin`, skinsInLabPortal.includes(data.skin), data.skin);
  check(`${file}: brand is a hex colour`, /^#[0-9a-f]{6}$/i.test(data.brand));
  for (const recipe of data.recipes) {
    recipeCount += 1;
    let groups = -1;
    try { groups = (new RegExp(`${recipe.match}|`).exec('') || []).length - 1; } catch { groups = -1; }
    check(`${file}:${recipe.id}: the regex compiles in JavaScript`, groups >= 0, recipe.match);
    for (const step of recipe.steps) {
      check(`${file}:${recipe.id}: zone and action are known`, ZONES.has(step.zone) && ACTIONS.has(step.action), `${step.zone}/${step.action}`);
      const refs = [...`${step.say} ${step.value || ''} ${step.screen} ${step.target}`.matchAll(/\{(\d)\}/g)].map(m => Number(m[1]));
      if (groups >= 0) check(`${file}:${recipe.id}: every {n} names a group`, refs.every(n => n <= groups), String(refs));
    }
  }
}
check('maps: at least the workspace recipes exist', recipeCount >= 4);

// --- glossary (sibling repo), drawable by the components here -----------------
const defsDir = join(ROOT, '../selfstudyuserlab/utils/labdefinitions');
if (existsSync(defsDir)) {
  let drawn = 0;
  for (const file of readdirSync(defsDir).filter(f => f.endsWith('.json'))) {
    const data = JSON.parse(readFileSync(join(defsDir, file), 'utf8'));
    const items = [...(data.terms || []), ...Object.values(data.tracks || {})] as Array<{ id?: string; scene?: { kind: string }; diagram?: Diagram }>;
    for (const item of items) {
      if (item.scene) check(`${file}:${item.id || ''}: scene kind is one the 3D layer draws`, SCENE_KINDS.includes(item.scene.kind as never), item.scene.kind);
      if (item.diagram) {
        try { layoutDiagram(item.diagram); drawn += 1; } catch (e) { check(`${file}:${item.id}: diagram lays out`, false, String(e)); }
      }
    }
  }
  check('glossary: diagrams were laid out', drawn > 0);
} else {
  console.log('skip: ../selfstudyuserlab not checked out, glossary not checked');
}
const builders = read('src/utils/labDocs3d/conceptScenes.ts');
check('3D: every scene kind has a builder', SCENE_KINDS.every(kind => builders.includes(`'${kind}': (`) || builders.includes(`\n    ${kind}: (`)));

// --- source rules ------------------------------------------------------------
const strip = (s: string) => s.replace(/<!--[\s\S]*?-->/g, '').replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
const docsDir = join(ROOT, 'src/components/labs/docs');
for (const file of readdirSync(docsDir)) {
  const src = strip(readFileSync(join(docsDir, file), 'utf8'));
  check(`${file}: nothing reaches v-html or innerHTML`, !/v-html|innerHTML/.test(src));
  check(`${file}: three.js is never imported statically`, !/from\s+['"]three['"]|from\s+['"]@\/utils\/labDocs3d\/(?!sceneKit['"])/.test(src.replace(/import type[^;]+;/g, '')));
  if (file.endsWith('.vue')) check(`${file}: styles are scoped`, !/<style(?![^>]*scoped)[^>]*>/.test(src));
}
check('labDocs.ts imports nothing (plain module)', !/^import\s/m.test(read('src/utils/labDocs.ts')));
const workspace = strip(read('src/views/LabWorkspace.vue'));
check('workspace: the Definitions window is async', /defineAsyncComponent\(\(\) => import\('@\/components\/labs\/docs\/LabDefinitions\.vue'\)\)/.test(workspace));
const guide = strip(read('src/components/labs/LabTaskGuide.vue'));
check('task window: the GUI tab is async', /defineAsyncComponent\(\(\) => import\('@\/components\/labs\/docs\/TaskGuiGuide\.vue'\)\)/.test(guide));
check('task window: offers Terminal and GUI', guide.includes("'Terminal'") && guide.includes("'Graphical interface (GUI)'"));

console.log(`check:labdocs  ${passed} passed, ${failures.length} failed  (${mapFiles.length} portal maps, ${recipeCount} recipes)`);
for (const f of failures.slice(0, 60)) console.log('  FAIL', f);
if (failures.length) process.exit(1);
