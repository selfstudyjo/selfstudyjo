// Verifies the Roadmap Provider's model and the view's own invariants, without
// a browser.
//
//   npm run check:roadmap
//
// Everything worth checking here fails SILENTLY in front of a learner:
//
//   * A LAYOUT THAT IS NOT DETERMINISTIC is a map that rearranges itself on a
//     re-render, and a camera tour flying to where a stage used to be.
//   * TWO NODES ON TOP OF EACH OTHER are a step nobody can click. Real
//     templates carry ~64 steps (up to 12 per stage, up to 9 stages), so this
//     is checked against a synthetic worst case AND, when the sibling repo is
//     checked out, against all 40 of app 27's own built-in templates.
//   * A NODE THE LAYOUT FORGOT is a lesson on the roadmap and on no picture.
//   * `percent: 0` for an empty roadmap is a claim; it must be null.
//   * A `url` TAKEN ON TRUST is a string the backend wrote and router.push
//     follows. Only the four in-app shapes are allowed.
//   * `three` IN THE ENTRY CHUNK. The view and the 2D map must never import it;
//     only the scene module may, dynamically.
//   * v-html ANYWHERE on this route - record text is rendered with {{ }}.

import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { resolve, join } from 'node:path';

import {
    KINDS, KIND_META, cycleStatus, filterCatalogue, kindOfRoute, layout2D, layout3D, nextNode,
    normaliseRoadmap, progressStats, rectsOverlap, routeFor, safeExternal, sortRoadmaps,
    summaryPercent, truncate, withStatus, wrapLabel, distance,
    KIND_ICON, SPRING_PEAK, easeOutCubic, kindOutline, outlinePoints, ringDash, springOut,
    type RoadmapDoc, type Specialization,
} from '../../src/utils/roadmapLayout';

let failures = 0;
function check(label: string, ok: boolean, detail?: unknown) {
    if (!ok) failures++;
    console.log(`  ${ok ? 'ok  ' : 'FAIL'}  ${label}` + (ok ? '' : `  ${JSON.stringify(detail)?.slice(0, 400)}`));
}
const section = (s: string) => console.log(`\n${s}`);
const read = (rel: string) => readFileSync(resolve(process.cwd(), rel), 'utf8');

/**
 * Source without comments, so a rule never fires on the comment that explains
 * it (working rule 44). HTML comments everywhere; JS comments only inside
 * <script> blocks or a .ts file - a Vue TEMPLATE is not JavaScript, and lexing
 * it as such is how `check:i18n` once blanked 51 real calls.
 */
function stripJs(src: string): string {
    let out = '';
    let i = 0;
    while (i < src.length) {
        const ch = src[i], nx = src[i + 1];
        if (ch === '/' && nx === '/') { const e = src.indexOf('\n', i); i = e < 0 ? src.length : e; continue; }
        if (ch === '/' && nx === '*') { const e = src.indexOf('*/', i + 2); i = e < 0 ? src.length : e + 2; continue; }
        if (ch === "'" || ch === '"' || ch === '`') {
            out += ch; i++;
            while (i < src.length) {
                if (src[i] === '\\') { out += src.slice(i, i + 2); i += 2; continue; }
                out += src[i];
                if (src[i] === ch) { i++; break; }
                i++;
            }
            continue;
        }
        out += ch; i++;
    }
    return out;
}
function codeOf(rel: string): string {
    const src = read(rel);
    if (rel.endsWith('.ts')) return stripJs(src);
    const noHtml = src.replace(/<!--[\s\S]*?-->/g, '');
    return noHtml.replace(/(<script[^>]*>)([\s\S]*?)(<\/script>)/g, (_m, a, body, c) => a + stripJs(body) + c);
}

/* ------------------------------------------------------------------ *
 * Fixtures
 * ------------------------------------------------------------------ */

const KIND_CYCLE = ['course', 'lesson', 'lab', 'lesson', 'lab', 'runbook', 'topic'] as const;

function synthetic(stages: number, perStage: number): RoadmapDoc {
    const raw = {
        id: 'r1', title: 'Synthetic', role: { title: 'Role', sources: [{ title: 'x', url: 'https://example.com' }] },
        stages: Array.from({ length: stages }, (_, s) => ({
            id: `s${s}`, order: s + 1, title: `Stage ${s + 1} with a fairly long name`, weeks: 2,
            nodes: Array.from({ length: perStage }, (_, n) => ({
                id: `s${s}n${n}`, kind: KIND_CYCLE[(s + n) % KIND_CYCLE.length],
                ref_id: `ref${s}${n}`, course_id: 'c1',
                title: `Module ${n + 1}: Window functions II: frames, running totals and gaps`,
                depends_on: n ? [`s${s}n${n - 1}`] : s ? [`s${s - 1}n0`] : [],
                optional: n === perStage - 1,
            })),
        })),
        progress: { s0n0: 'done', s0n1: 'doing', nope: 'done', s1n0: 'weird' },
    };
    return normaliseRoadmap(raw);
}

/** Layout assertions shared by every fixture. */
function assertLayouts(name: string, doc: RoadmapDoc, quiet = false) {
    const nodeCount = doc.stages.reduce((n, s) => n + s.nodes.length, 0);
    const problems: string[] = [];
    for (const orientation of ['horizontal', 'vertical'] as const) {
        const a = layout2D(doc, orientation), b = layout2D(doc, orientation);
        if (JSON.stringify(a) !== JSON.stringify(b)) problems.push(`${orientation}: not deterministic`);
        if (a.nodes.length !== nodeCount) problems.push(`${orientation}: placed ${a.nodes.length}/${nodeCount}`);
        if (new Set(a.nodes.map(n => n.id)).size !== a.nodes.length) problems.push(`${orientation}: a node placed twice`);
        for (let i = 0; i < a.nodes.length; i++) {
            const p = a.nodes[i];
            if (p.x < 0 || p.y < 0 || p.x + p.w > a.width || p.y + p.h > a.height) problems.push(`${orientation}: ${p.id} outside the viewBox`);
            for (let j = i + 1; j < a.nodes.length; j++) {
                if (rectsOverlap(p, a.nodes[j], 2)) problems.push(`${orientation}: ${p.id} overlaps ${a.nodes[j].id}`);
            }
            for (const s of a.stages) if (rectsOverlap(p, s, 2)) problems.push(`${orientation}: ${p.id} overlaps stage ${s.id}`);
        }
        for (let i = 0; i < a.stages.length; i++) for (let j = i + 1; j < a.stages.length; j++) {
            if (rectsOverlap(a.stages[i], a.stages[j], 2)) problems.push(`${orientation}: stages ${i} and ${j} overlap`);
        }
        if (a.edges.some(e => /NaN|undefined/.test(e.d))) problems.push(`${orientation}: an edge path has NaN`);
        if (/NaN|undefined/.test(a.journey)) problems.push(`${orientation}: the journey has NaN`);
    }
    const t1 = layout3D(doc), t2 = layout3D(doc);
    if (JSON.stringify(t1) !== JSON.stringify(t2)) problems.push('3d: not deterministic');
    if (t1.nodes.length !== nodeCount) problems.push(`3d: placed ${t1.nodes.length}/${nodeCount}`);
    if (t1.tour.length !== doc.stages.length) problems.push('3d: a tour stop per stage');
    let minNodeGap = Infinity;
    for (let i = 0; i < t1.nodes.length; i++) {
        for (let j = i + 1; j < t1.nodes.length; j++) {
            minNodeGap = Math.min(minNodeGap, distance(t1.nodes[i], t1.nodes[j]));
        }
        for (const s of t1.stages) {
            // A node must float clear of every platform (radius + node size).
            const dxz = Math.hypot(t1.nodes[i].x - s.x, t1.nodes[i].z - s.z);
            const dy = Math.abs(t1.nodes[i].y - s.y);
            if (dxz < s.radius + 0.4 && dy < 0.9) problems.push(`3d: ${t1.nodes[i].id} inside platform ${s.id}`);
        }
    }
    if (t1.nodes.length > 1 && minNodeGap < 1.4) problems.push(`3d: two nodes ${minNodeGap.toFixed(2)} apart`);
    if (!Number.isFinite(t1.extent) || [t1.center.x, t1.center.y, t1.center.z].some(v => !Number.isFinite(v))) problems.push('3d: non-finite bounds');
    if (!quiet || problems.length) check(`${name}: layouts are deterministic, complete and overlap-free`, problems.length === 0, problems.slice(0, 6));
    return problems.length === 0;
}

/* ------------------------------------------------------------------ */
section('1. Normalising what arrives over the network');
{
    const empty = normaliseRoadmap(null);
    check('a null payload is a valid, empty roadmap', empty.stages.length === 0 && empty.title === 'Untitled roadmap'
        && Array.isArray(empty.role.skills) && typeof empty.progress === 'object');
    const dup = normaliseRoadmap({ stages: [{ id: 's', nodes: [{ id: 'a', kind: 'video' }, { id: 'a', depends_on: ['a', 'zzz', 'a'] }] }] });
    const ids = dup.stages[0].nodes.map(n => n.id);
    check('duplicate node ids are made unique', new Set(ids).size === 2, ids);
    check('an unknown kind becomes a topic', dup.stages[0].nodes[0].kind === 'topic');
    check('a dependency on itself or on nothing is dropped', dup.stages[0].nodes[1].depends_on.join() === 'a', dup.stages[0].nodes[1].depends_on);
    const doc = synthetic(3, 4);
    check('progress for an unknown node or an unknown status is dropped',
        Object.keys(doc.progress).sort().join() === 's0n0,s0n1', doc.progress);
    const ordered = normaliseRoadmap({ stages: [{ id: 'b', order: 2 }, { id: 'a', order: 1 }, { id: 'c', order: 2 }] });
    check('stages are ordered by `order`, ties by payload position',
        ordered.stages.map(s => s.id).join() === 'a,b,c', ordered.stages.map(s => s.id));
    check('a stage keeps its level', normaliseRoadmap({ stages: [{ id: 's', level: 'core' }] }).stages[0].level === 'core');
}

section('2. Progress');
{
    const doc = synthetic(3, 4);
    const s = progressStats(doc);
    check('totals count every step', s.total === 12 && s.done === 1 && s.doing === 1 && s.todo === 10, s);
    check('percent is over REQUIRED steps', s.required === 9 && s.percent === 11, s);
    check('an empty roadmap has percent null, not 0', progressStats(normaliseRoadmap({})).percent === null);
    const allDone = { ...doc, progress: Object.fromEntries(doc.stages.flatMap(x => x.nodes).map(n => [n.id, 'done' as const])) };
    check('everything done is exactly 100', progressStats(allDone).percent === 100);
    check('stage stats line up', s.stages[0].done === 1 && s.stages[0].percent === 25, s.stages[0]);
    check('kind counts add up', Object.values(s.byKind).reduce((a, b) => a + b, 0) === 12);
    check('summary percent is null with no steps', summaryPercent({ node_count: 0, done_count: 0 }) === null
        && summaryPercent({ node_count: 8, done_count: 2 }) === 25);
    check('the status cycle is "" → doing → done → ""',
        cycleStatus('') === 'doing' && cycleStatus('doing') === 'done' && cycleStatus('done') === '');
    const cleared = withStatus({ a: 'done', b: 'doing' }, 'a', '');
    check('clearing a mark removes it locally', !('a' in cleared) && cleared.b === 'doing');
    const nx = nextNode(doc);
    check('next up is the first unfinished step whose dependencies are done (the one in progress)', nx?.id === 's0n1', nx?.id);
}

section('3. Where a node leads');
{
    check('a lesson url is kept', routeFor({ kind: 'lesson', ref_id: '', course_id: '', url: '/course/abc/lesson/x-1' }) === '/course/abc/lesson/x-1');
    check('course, lab and runbook urls are kept',
        kindOfRoute('/course/798445225f') === 'course' && kindOfRoute('/lab/desql-03-windows') === 'lab' && kindOfRoute('/runbooks/7') === 'runbook');
    for (const bad of ['javascript:alert(1)', '//evil.example/x', 'https://evil.example/course/1', '/course/1?x=1', '/course/../admin', '/profile']) {
        const r = routeFor({ kind: 'topic', ref_id: '', course_id: '', url: bad });
        check(`refused: ${bad}`, r === null, r);
    }
    check('a missing url is derived from kind + ref', routeFor({ kind: 'lab', ref_id: 'docker-01', course_id: '', url: '' }) === '/lab/docker-01');
    check('a lesson with no course has no route', routeFor({ kind: 'lesson', ref_id: 'x', course_id: '', url: '' }) === null);
    check('a topic has no route', routeFor({ kind: 'topic', ref_id: 'x', course_id: 'c', url: '' }) === null);
    check('only http(s) sources become links', safeExternal('https://a.b/c') === 'https://a.b/c'
        && safeExternal('javascript:x') === null && safeExternal('ftp://a') === null);
}

section('4. The catalogue and the list');
{
    const specs: Specialization[] = [
        { id: 'b', title: 'Backend Developer', category: 'Software', summary: 'APIs and databases', icon: '', stage_count: 7, course_count: 1, lab_count: 1, runbook_count: 1 },
        { id: 'a', title: 'AWS Cloud Engineer', category: 'Cloud', summary: 'EC2, S3, IAM', icon: '', stage_count: 6, course_count: 1, lab_count: 1, runbook_count: 1 },
        { id: 'f', title: 'Frontend Developer', category: 'Software', summary: 'HTML, CSS and JavaScript', icon: '', stage_count: 6, course_count: 1, lab_count: 1, runbook_count: 1 },
    ];
    check('sorted by category then title', filterCatalogue(specs, '').map(s => s.id).join() === 'a,b,f');
    check('every term must match', filterCatalogue(specs, 'developer css').map(s => s.id).join() === 'f');
    check('the category filter', filterCatalogue(specs, '', 'Cloud').map(s => s.id).join() === 'a');
    check('the input is not mutated', specs[0].id === 'b');
    const list = sortRoadmaps([
        { id: 'x', updated_at: '2026-10-01', created_at: '', title: '', specialization_id: '', level: '', stage_count: 0, node_count: 0, done_count: 0, source: '' },
        { id: 'y', updated_at: '2026-11-01', created_at: '', title: '', specialization_id: '', level: '', stage_count: 0, node_count: 0, done_count: 0, source: '' },
    ]);
    check('my roadmaps: newest first', list[0].id === 'y');
}

section('5. Labels');
{
    const lines = wrapLabel('Module 4: Window functions I: ranking, top-N and deduplication', 23, 2);
    check('a long title wraps to at most two lines that fit', lines.length === 2 && lines.every(l => l.length <= 23), lines);
    check('the second line is truncated with an ellipsis', lines[1].endsWith('…'), lines);
    check('a short title is one line', wrapLabel('Docker', 23).join('|') === 'Docker');
    check('a single overlong word is cut', wrapLabel('Supercalifragilisticexpialidocious', 10).every(l => l.length <= 10));
    check('truncate keeps short text', truncate('abc', 10) === 'abc' && truncate('a b c d e f g h i j', 8).length <= 8);
}

section('6. Layout: synthetic worst cases');
{
    assertLayouts('one stage, one node', synthetic(1, 1));
    assertLayouts('6 stages × 6', synthetic(6, 6));
    assertLayouts('9 stages × 12 (the largest real shape)', synthetic(9, 12));
    assertLayouts('4 stages × 20 (beyond any real stage)', synthetic(4, 20));
    assertLayouts('an empty stage among full ones', normaliseRoadmap({
        stages: [{ id: 'a', nodes: [{ id: '1' }] }, { id: 'b', nodes: [] }, { id: 'c', nodes: [{ id: '2' }, { id: '3' }] }],
    }));
    assertLayouts('no stages at all', normaliseRoadmap({}));
    const h = layout2D(synthetic(6, 6), 'horizontal');
    check('horizontal: stages left to right in order', h.stages.every((s, i) => i === 0 || s.x > h.stages[i - 1].x));
    const v = layout2D(synthetic(6, 6), 'vertical');
    check('vertical: fits a 360-unit-wide phone column', v.width === 360 && v.nodes.every(n => n.x + n.w <= 360));
    check('vertical: stages top to bottom in order', v.stages.every((s, i) => i === 0 || s.y > v.stages[i - 1].y));
    const t = layout3D(synthetic(6, 6));
    check('3d: the spiral rises stage by stage', t.stages.every((s, i) => i === 0 || s.y > t.stages[i - 1].y));
    check('3d: the overview camera stands outside everything', distance(t.overview.camera, t.center) > t.extent);
    check('3d: every kind has a distinct 2D and 3D shape',
        new Set(KINDS.map(k => KIND_META[k].shape2d)).size === KINDS.length
        && new Set(KINDS.map(k => KIND_META[k].shape3d)).size === KINDS.length);
}

section('7. Layout: app 27\'s own templates (skipped without the sibling repo)');
{
    const dir = resolve(process.cwd(), '../selfstudyai/roadmaps_builtin/roadmaps');
    if (!existsSync(dir)) {
        console.log('  skip  ../selfstudyai is not checked out');
    } else {
        const files = readdirSync(dir).filter(f => f.endsWith('.json'));
        let good = 0;
        for (const f of files) {
            const raw = JSON.parse(readFileSync(join(dir, f), 'utf8'));
            const doc = normaliseRoadmap(raw.roadmap || raw);
            if (assertLayouts(f, doc, true)) good++;
            const bad = doc.stages.flatMap(s => s.nodes).filter(n => n.url && !kindOfRoute(n.url));
            if (bad.length) check(`${f}: every url is one of the four in-app shapes`, false, bad.slice(0, 3).map(n => n.url));
        }
        check(`all ${files.length} templates lay out cleanly`, good === files.length && files.length > 0, `${good}/${files.length}`);
    }
}

section('8. The route, the bundle and the markup');
{
    const files = [
        'src/views/RoadmapProvider.vue',
        'src/components/roadmap/RoadmapMap2D.vue',
        'src/components/roadmap/RoadmapMap3D.vue',
        'src/components/roadmap/RoadmapNodeCard.vue',
        'src/components/roadmap/RoadmapRolePanel.vue',
        'src/components/roadmap/roadmapScene.ts',
        'src/services/roadmap.service.ts',
        'src/utils/roadmapLayout.ts',
    ];
    for (const f of files) {
        const code = codeOf(f);
        check(`${f}: no v-html, no innerHTML`, !/v-html|innerHTML|outerHTML|insertAdjacentHTML/.test(code));
    }
    // A sentinel per file: a stripper that emptied the source would pass the
    // rule above for the wrong reason (working rule 44).
    check('sentinel: the view still renders the map components after stripping',
        codeOf('src/views/RoadmapProvider.vue').includes('RoadmapMap2D') && codeOf('src/views/RoadmapProvider.vue').includes('<RoadmapNodeCard'));
    check('sentinel: comments ARE stripped', !codeOf('src/views/RoadmapProvider.vue').includes('THE ROADMAP PROVIDER (app 27'));

    const staticThree = (f: string) => /^\s*import[^;]*from\s+['"]three['"/]/m.test(codeOf(f));
    for (const f of files.filter(f => !f.endsWith('roadmapScene.ts'))) {
        check(`${f}: does not import three`, !staticThree(f) && !/import\(\s*['"]three/.test(codeOf(f)));
    }
    const scene = codeOf('src/components/roadmap/roadmapScene.ts');
    check('the scene imports three only dynamically', !staticThree('src/components/roadmap/roadmapScene.ts')
        && /import\(\s*'three'\s*\)/.test(scene) && /OrbitControls/.test(scene));
    check('the scene disposes its renderer and its context', /renderer\.dispose\(\)/.test(scene) && /forceContextLoss/.test(scene));
    check('the scene sets labels with textContent', /textContent\s*=/.test(scene));
    const view = codeOf('src/views/RoadmapProvider.vue');
    check('the 3D map is an async component', /defineAsyncComponent\(\s*\(\)\s*=>\s*import\(\s*'@\/components\/roadmap\/RoadmapMap3D\.vue'/.test(view));
    check('the view probes WebGL without three', /hasWebGL/.test(view));
    check('the view honours prefers-reduced-motion', /prefers-reduced-motion: reduce/.test(view));
    const map3d = codeOf('src/components/roadmap/RoadmapMap3D.vue');
    check('3D rebuilds on a galaxy change', /MutationObserver/.test(map3d) && /data-theme/.test(map3d));
    check('3D pauses off screen and in a hidden tab', /IntersectionObserver/.test(map3d) && /visibilitychange/.test(map3d));
    check('3D disposes on unmount', /onBeforeUnmount[\s\S]*dispose\(\)/.test(map3d));
    for (const f of ['src/components/roadmap/RoadmapMap2D.vue', 'src/components/roadmap/RoadmapMap3D.vue']) {
        check(`${f}: the map is a place - pinned direction: ltr`, /direction:\s*ltr/.test(read(f)));
    }
    const node = codeOf('src/components/roadmap/RoadmapNodeCard.vue');
    check('a step opens through routeFor + router-link', /routeFor\(/.test(node) && /<router-link[^>]*:to="route"/.test(node));
    const role = codeOf('src/components/roadmap/RoadmapRolePanel.vue');
    check('external sources are noopener noreferrer', /rel="noopener noreferrer"/.test(role) && /safeExternal/.test(role));

    const svc = codeOf('src/services/roadmap.service.ts');
    check('the service pins app 27 through getRandomAiReplica (rule 31)', /getRandomAiReplica\(\)/.test(svc) && !/Math\.random/.test(svc));
    check('the service sends X-User-ID', /'X-User-ID'/.test(svc));
    check('progress and renames are PATCH, not PUT', /apiService\.patch/.test(svc) && !/apiService\.put/.test(svc));

    const router = read('src/router/index.ts');
    const at = router.indexOf("path: 'roadmaps'");
    const block = router.slice(at, router.indexOf('}', router.indexOf('meta:', at)) + 1);
    check('/roadmaps is lazy', /component:\s*\(\)\s*=>\s*import\('\.\.\/views\/RoadmapProvider\.vue'\)/.test(block), block);
    check('/roadmaps needs an account and nothing else',
        /requiresAuth:\s*true/.test(block) && !/requiresSubscription|requiredFeatures/.test(block), block);
    check('/roadmaps/:roadmapId exists', router.includes("path: 'roadmaps/:roadmapId'"));
    check('the router never imports RoadmapProvider statically', !/^import\s+\w+\s+from\s+'\.\.\/views\/RoadmapProvider/m.test(router));
}

section('9. The visual language: one shape per kind, springs that land');
{
    for (const k of KINDS) {
        const o = kindOutline(k);
        check(`${k}: an outline of at least 4 points inside the unit box`,
            o.length >= 4 && o.every(p => Math.abs(p.x) <= 1.06 && Math.abs(p.y) <= 1.06), o.length);
        check(`${k}: an icon to draw`, KIND_ICON[k].length > 0 && KIND_ICON[k].every(d => /^M[\d.\s-]/.test(d)));
    }
    check('every kind has a different silhouette', new Set(KINDS.map(k => JSON.stringify(kindOutline(k)))).size === KINDS.length);
    check('outlinePoints flips y for SVG and scales', outlinePoints('topic', 10).startsWith('0,-10.5'), outlinePoints('topic', 10));
    let peak = 0, monotoneEnd = true;
    for (let i = 0; i <= 2000; i++) peak = Math.max(peak, springOut(i / 2000));
    for (let i = 1900; i < 2000; i++) if (springOut(i / 2000) < 1 - 1e-9) monotoneEnd = false;
    check('the spring starts at exactly 0, lands on exactly 1', springOut(0) === 0 && springOut(1) === 1 && springOut(-3) === 0 && springOut(9) === 1);
    check(`the spring overshoots, but never past SPRING_PEAK (${peak.toFixed(3)})`, peak > 1.01 && peak <= SPRING_PEAK);
    check('the spring settles from above, never undershooting at the end', monotoneEnd);
    check('easeOutCubic is clamped', easeOutCubic(-1) === 0 && easeOutCubic(2) === 1);
    check('a progress ring is empty at null and full at 100',
        ringDash(null, 10).startsWith('0 ') && ringDash(100, 10).split(' ')[0] === ringDash(100, 10).split(' ')[1]);
}

section('10. Full screen, the 3D quality budget and the 2D map');
{
    const view = codeOf('src/views/RoadmapProvider.vue');
    check('the view uses the shared useFullscreen composable', /from '@\/composables\/useFullscreen'/.test(view) && /useFullscreen\(\s*mapShell\s*\)/.test(view));
    const shellAt = view.indexOf('ref="mapShell"');
    const sideAt = view.indexOf('class="rmp__side"');
    const shell = shellAt > 0 && sideAt > shellAt ? view.slice(shellAt, sideAt) : '';
    check('the full-screen shell holds the 2D/3D toggle, the tour, both maps and the step card',
        /rmp__seg/.test(shell) && /rmp__tourbtn/.test(shell) && /<RoadmapMap3D/.test(shell) && /<RoadmapMap2D/.test(shell) && /<RoadmapNodeCard/.test(shell),
        shell ? 'missing a piece' : 'no shell');
    check('the step card is not teleported out of the full-screen element', !/<Teleport[^>]*to="body"/.test(view));
    check('a Full screen toggle and an exit button that only shows in full screen',
        /class="[^"]*rmp__fsbtn[^"]*"[^>]*@click="toggleFs"/.test(view) && /v-if="fsActive"[^>]*class="[^"]*rmp__fsexit[^"]*"[^>]*@click="exitFs"/.test(view));
    check('entering or leaving full screen resizes the 3D renderer', /watch\(fsActive[\s\S]{0,200}map3d\.value\?\.resize/.test(view));
    check('the overlay fallback is fixed over everything', /\.rmp__shell\.is-overlay\s*\{[^}]*position:\s*fixed[^}]*z-index:\s*2147483000/.test(read('src/views/RoadmapProvider.vue')));
    check('full screen hands the 3D map the whole height', /\.rmp__shell\.is-full\s*\{[^}]*--rm3d-height:\s*100%/.test(read('src/views/RoadmapProvider.vue')));
    const map3d = codeOf('src/components/roadmap/RoadmapMap3D.vue');
    check('the 3D map exposes resize() and takes its height from --rm3d-height',
        /resize:\s*\(\)\s*=>\s*scene\?\.resize\(\)/.test(map3d) && /height:\s*var\(--rm3d-height/.test(read('src/components/roadmap/RoadmapMap3D.vue')));
    const fs = codeOf('src/composables/useFullscreen.ts');
    check('Escape leaves the overlay (the browser does it for native)', /event\.key === 'Escape'[\s\S]{0,700}exit\(\)/.test(fs));

    const scene = codeOf('src/components/roadmap/roadmapScene.ts');
    check('bloom is a second lazy import, only in the scene', /import\(\s*'three\/examples\/jsm\/postprocessing\/UnrealBloomPass\.js'\s*\)/.test(scene)
        && !/UnrealBloomPass/.test(view) && !/UnrealBloomPass/.test(map3d));
    check('bloom is off in a light galaxy and on a low budget', /quality === 'high' && !light/.test(scene));
    check('a quality governor drops bloom and the pixel ratio on slow frames', /function govern\(/.test(scene) && /disableBloom\(\)/.test(scene) && /setPixelRatio\(1\)/.test(scene));
    check('reduced motion freezes the shader clock and the flow', /if \(motion\) clock \+=/.test(scene) && /uFlow:\s*\{\s*value:\s*motion \?/.test(scene));
    check('the scene disposes the composer, the environment map and its textures',
        /composer\.dispose/.test(scene) && /envTex\.dispose\(\)/.test(scene) && /pmrem\.dispose\(\)/.test(scene) && /buildTextures\)\s*t\.dispose\(\)/.test(scene));
    check('the 3D tokens are plates in the kind outline, with the kind icon', /kindOutline\(kind\)/.test(scene) && /KIND_ICON\[kind\]/.test(scene) && /ExtrudeGeometry/.test(scene));
    check('3D labels build their icon with createElementNS, not markup', /createElementNS\(SVGNS/.test(scene));

    const map2d = codeOf('src/components/roadmap/RoadmapMap2D.vue');
    const map2dRaw = read('src/components/roadmap/RoadmapMap2D.vue');
    check('2D draws each kind in its outline with its icon', /outlinePoints\(p\.kind/.test(map2d) && /KIND_ICON\[p\.kind\]/.test(map2d));
    check('2D has a stage timeline that focuses a stage', /rm2d__timeline/.test(map2d) && /emit\('focus'/.test(map2d));
    check('2D motion (draw-on, flow, springs) only without reduced motion',
        /@media \(prefers-reduced-motion: no-preference\)\s*\{[\s\S]*rm2d-flow[\s\S]*\}/.test(map2dRaw) && !/^\.rm2d[^{]*\{[^}]*animation:/m.test(map2dRaw));
    check('2D gradient and filter ids are per instance', /useId\(\)/.test(map2d) && /url\(#\$\{uid\}/.test(map2d));
}

console.log(failures ? `\n${failures} FAILED` : '\nPASS');
if (failures) process.exit(1);
