// Verifies src/utils/labCatalogue.ts and the lab UI's own invariants, without a
// browser.
//
//   npm run check:labs
//
// Six things in here fail SILENTLY — the page renders, nothing throws, and the
// only symptom is behaviour nobody would notice for weeks:
//
//   * A GUI PANEL POINTING AT A PATH THE BACKEND DOES NOT SEND. It renders
//     empty, which is indistinguishable from an environment with nothing in it.
//     Every panel's `path` is asserted against a payload shaped like the one
//     `utils/labenv.py` builds.
//   * AN UNSTABLE SORT. The catalogue is re-derived inside a computed that
//     re-evaluates on every keystroke in the filter box, so a comparator that is
//     not a total order is a list that visibly reorders itself as somebody
//     types. Same trap examShuffle.ts and leaderboardEngine.ts document.
//   * A TRACK CARD FOR A TRACK WITH NO LABS. A promise the page cannot keep.
//   * `percent: 0` INSTEAD OF `null`. Reporting 0% is not a softer version of
//     "no data" — it is a claim that they achieved nothing, drawn on their own
//     first day.
//   * A SEARCH THAT ONLY MATCHES THE RENDERED LANGUAGE. It would silently stop
//     finding things when a reader changes a setting, for exactly the readers the
//     translation work is for.
//   * AND THE WEB PLAYGROUND'S SANDBOX. `allow-same-origin` beside
//     `allow-scripts` is not a sandbox — it is a same-origin script tag with
//     extra steps, and the student's code would reach this page's DOM and the
//     session token in it. The component is read off disk to prove the attribute
//     never grows that flag, and that the console shim is installed BEFORE the
//     student's script.
//
// Plus working rule 13 over every lab component: nothing a model or an operator
// wrote may reach `v-html`.

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import {
    DIFFICULTY_LABELS,
    FAMILY_LABEL_KEYS,
    GRADE_REPORT_KEYS,
    GUI_PANELS,
    PANEL_TITLE_KEYS,
    STATUS_LABELS,
    TASK_STATUS_LABELS,
    buildPreview,
    canEmbed,
    defaultPane,
    difficultyRank,
    familyLabel,
    filterLabs,
    gradeReport,
    groupByTrack,
    humanKey,
    panelsFor,
    pick,
    progressFor,
    rowsAt,
    sortLabs,
    sortTracks,
    statsAt,
    summariseProgress,
    toolPanes,
    tutorPrompt,
    taskQuestion,
    type Lab,
    type LabGrade,
    type LabProgress,
    type LabSummary,
    type LabTool,
    type LabTrack,
    type LabTask,
} from '../../src/utils/labCatalogue';

import {
    ancestorsOf,
    basename,
    buildTree,
    deleteQuestion,
    dirname,
    exists,
    extensionOf,
    filesUnder,
    flatten,
    folderPaths,
    humanBytes,
    iconFor,
    isFolder,
    joinPath,
    matchTree,
    nameProblem,
    pathProblem,
    planDrop,
    planRename,
    remapExpanded,
    sortNodes,
    type FileEntry as TreeFileEntry,
} from '../../src/utils/fileTree';

import {
    applyReadline,
    atCommandWord,
    completeLine,
    editorHelp,
    editorKey,
    expandHistory,
    openEditor,
    searchHistory,
    wordAt,
    type CompletionSource,
    type EditorState,
} from '../../src/utils/labTerminal';

let passed = 0;
const failures: string[] = [];

function check(label: string, condition: unknown, detail?: unknown) {
    if (condition) {
        passed += 1;
    } else {
        failures.push(`${label}${detail === undefined ? '' : `  -- ${JSON.stringify(detail)}`}`);
    }
}

function section(title: string) {
    console.log(`\n${title}\n${'-'.repeat(title.length)}`);
}

// process.cwd(), not import.meta.dirname: the built bundle lives under
// tools/labs-check/dist, and npm always runs a script from the repo root. Same
// as tools/leaderboard-check.
function source(relative: string): string {
    return readFileSync(resolve(process.cwd(), relative), 'utf8');
}

/* ─────────────────── fixtures ─────────────────── */

function track(id: string, order: number, labs: number): LabTrack {
    return { id, title: id.toUpperCase(), order, labs };
}

function lab(id: string, trackId: string, order: number,
             extra: Partial<LabSummary> = {}): LabSummary {
    return {
        id, track: trackId, title: id, summary: `${id} summary`,
        difficulty: 'beginner', minutes: 20, order,
        topics: [], tools: [], tool_labels: [], task_count: 3, points: 3,
        datasets: [], simulated: false, source: 'builtin',
        ...extra,
    };
}

function tool(id: string, kind: LabTool['kind'], family: string, order: number,
              simulated = false): LabTool {
    return {
        id, label: id, kind, engine: simulated ? `sim:${family}` : family,
        icon: id, summary: `${id} summary`, simulated, prompt: '',
        fidelity: simulated ? 'Simulated' : 'Real', family, order,
    };
}

function progress(labId: string, status: LabProgress['status'],
                  extra: Partial<LabProgress> = {}): LabProgress {
    return {
        lab_id: labId, track: 'linux', status, tasks_done: [], score: 0,
        earned: 0, possible: 4, attempts: 1, completed_at: '', last_active: '',
        ...extra,
    };
}

/* ─────────────────── 1. ordering and grouping ─────────────────── */

section('1. Ordering, grouping and the empty track');

check('tracks come back in `order`',
      sortTracks([track('b', 2, 1), track('a', 1, 1)]).map(row => row.id)
        .join(',') === 'a,b');

check('A TRACK WITH NO LABS IS DROPPED',
      sortTracks([track('a', 1, 0), track('b', 2, 3)]).map(row => row.id)
        .join(',') === 'b',
      sortTracks([track('a', 1, 0), track('b', 2, 3)]));

check('the track order is TOTAL, so two with the same order do not swap',
      sortTracks([track('z', 1, 1), track('a', 1, 1)]).map(row => row.id)
        .join(',') === 'a,z');

check('labs come back in the author\'s sequence, not by difficulty',
      sortLabs([
        lab('third', 'linux', 3, { difficulty: 'beginner' }),
        lab('first', 'linux', 1, { difficulty: 'advanced' }),
        lab('second', 'linux', 2, { difficulty: 'intermediate' }),
      ]).map(row => row.id).join(',') === 'first,second,third');

check('difficulty is the TIE-BREAK when two labs share an order',
      sortLabs([
        lab('hard', 'linux', 1, { difficulty: 'advanced' }),
        lab('easy', 'linux', 1, { difficulty: 'beginner' }),
      ]).map(row => row.id).join(',') === 'easy,hard');

check('the lab order is total',
      sortLabs([lab('z', 'x', 0), lab('a', 'x', 0)]).map(r => r.id).join(',')
        === 'a,z');

{
    const tracks = [track('linux', 1, 2), track('empty', 2, 0),
                    track('docker', 3, 1)];
    const labs = [lab('linux-1', 'linux', 1), lab('linux-2', 'linux', 2),
                  lab('docker-1', 'docker', 1)];
    const groups = groupByTrack(tracks, labs, [
        progress('linux-1', 'completed', { earned: 4 }),
        progress('linux-2', 'in_progress', { earned: 1 }),
    ]);
    check('grouping drops the empty track', groups.length === 2,
          groups.map(g => g.track.id));
    check('and counts the reader\'s progress per track',
          groups[0].completed === 1 && groups[0].started === 2
          && groups[0].points === 5, groups[0]);
    check('a track with no progress reports zero, not undefined',
          groups[1].completed === 0 && groups[1].points === 0, groups[1]);
    check('the track\'s `labs` count is recomputed from what is in it',
          groups[0].track.labs === 2, groups[0].track.labs);
    check('and the minutes add up', groups[0].minutes === 40,
          groups[0].minutes);
}

/* ─────────────────── 2. the search ─────────────────── */

section('2. The search');

{
    const labs = [
        lab('a', 'docker', 1, {
            title: 'Volumes and data that survives',
            topics: ['volumes'], tools: ['docker'], tool_labels: ['Docker CLI'],
        }),
        lab('b', 'sql', 2, {
            title: 'Window functions', topics: ['window functions'],
            tools: ['sql'], tool_labels: ['SQL Editor'],
            translations: { ar: { title: 'دوال النوافذ' } },
        }),
    ];
    check('an empty query matches everything',
          filterLabs(labs, '').length === 2);
    check('a title term matches', filterLabs(labs, 'volumes')[0].id === 'a');
    check('A TOOL LABEL MATCHES, which is how somebody actually looks',
          filterLabs(labs, 'docker cli')[0].id === 'a',
          filterLabs(labs, 'docker cli').map(l => l.id));
    check('the track matches', filterLabs(labs, 'sql')[0].id === 'b');
    check('terms are ANDed, not ORed',
          filterLabs(labs, 'window docker').length === 0);
    check('EVERY LANGUAGE THE RECORD CARRIES IS SEARCHED',
          filterLabs(labs, 'النوافذ')[0].id === 'b',
          filterLabs(labs, 'النوافذ').map(l => l.id));
    check('case and whitespace are ignored',
          filterLabs(labs, '  VOLUMES ')[0].id === 'a');
}

/* ─────────────────── 3. progress ─────────────────── */

section('3. Progress: null is not zero');

{
    const empty = summariseProgress([]);
    check('NOTHING STARTED GIVES `percent: null`, NEVER 0',
          empty.percent === null, empty);
    check('and the counts are zero', empty.started === 0 && empty.completed === 0
          && empty.points === 0);

    const some = summariseProgress([
        progress('a', 'completed', { earned: 4, possible: 4,
                                     tasks_done: ['t1', 't2'] }),
        progress('b', 'in_progress', { earned: 1, possible: 6,
                                       tasks_done: ['t1'] }),
    ]);
    check('the percentage is earned over possible, both totalled',
          some.percent === 50, some);
    check('tasks are counted across labs', some.tasks === 3, some.tasks);
    check('completed is counted separately from started',
          some.started === 2 && some.completed === 1, some);

    check('progressFor finds a row by lab id',
          progressFor('b', [progress('a', 'completed'), progress('b', 'in_progress')])
            ?.status === 'in_progress');
    check('and answers null rather than undefined for a lab with none',
          progressFor('zzz', [progress('a', 'completed')]) === null);
}

/* ─────────────────── 4. the tool panes ─────────────────── */

section('4. Tool panes');

{
    const panes = toolPanes([
        tool('ambari_gui', 'gui', 'hadoop', 37, true),
        tool('hdfs', 'console', 'hadoop', 30, true),
        tool('editor', 'editor', 'shell', 4),
        tool('ai_tutor', 'ai', 'ai', 90),
        tool('hive', 'query', 'hadoop', 31, true),
    ]);
    check('one pane per family', panes.length === 3, panes.map(p => p.family));
    check('panes come back in the tools\' own reading order',
          panes.map(p => p.family).join(',') === 'shell,hadoop,ai',
          panes.map(p => p.family));
    check('NINE HADOOP TOOLS ARE ONE PANE, not nine tabs',
          panes[1].tools.length === 3, panes[1].tools.map(t => t.id));
    check('the pane\'s tools are ordered',
          panes[1].tools.map(t => t.id).join(',') === 'hdfs,hive,ambari_gui',
          panes[1].tools.map(t => t.id));
    check('the primary tool is the first one',
          panes[1].primary.id === 'hdfs');
    check('a pane with any simulated tool is marked simulated',
          panes[1].simulated === true && panes[0].simulated === false);
    check('every family has a label',
          FAMILY_LABEL_KEYS.length >= 12 && familyLabel('hadoop') === 'Big Data');
    check('an unknown family falls back to its id rather than blank',
          familyLabel('frobnicate') === 'frobnicate');

    /*
      WHICH PANE THE LAB OPENS ON.

      Not `panes[0]`, and that was a defect rather than a preference: the
      supporting tools sort ahead of every subject tool on the catalogue's own
      `order` - `editor` is 4 and `web` is 5 - so a web lab opened on an empty
      file browser and a networking lab opened on an empty file browser, with
      the thing the lab is named after one tab to the right. Both were reported.
    */
    check('a lab OPENS on its subject, not on the file browser',
          defaultPane(panes) === 'hadoop', defaultPane(panes));
}

{
    const web = toolPanes([
        tool('editor', 'editor', 'shell', 4),
        tool('web', 'web', 'web', 5),
        tool('ai_tutor', 'ai', 'ai', 90),
    ]);
    check('...so a web lab opens on the Web playground',
          defaultPane(web) === 'web', defaultPane(web));
    const net = toolPanes([
        tool('editor', 'editor', 'shell', 4),
        tool('netsim', 'external', 'netsim', 80),
        tool('ai_tutor', 'ai', 'ai', 90),
    ]);
    check('...and a networking lab on the Network Simulator',
          defaultPane(net) === 'netsim', defaultPane(net));
    const bare = toolPanes([tool('editor', 'editor', 'shell', 4)]);
    check('a lab whose ONLY tool is a supporting one still opens somewhere',
          defaultPane(bare) === 'shell', defaultPane(bare));
    check('and a lab with no tools at all falls back to the brief',
          defaultPane([]) === '__brief', defaultPane([]));
}

{
    /*
      An external tool is rendered IN PLACE where this build has a component for
      it. Keyed on the tool id here rather than on a flag from app 11, because
      whether the studio is in this bundle is a fact about the frontend.
    */
    check('the Network Simulator is embedded, not linked away to',
          canEmbed(tool('netsim', 'external', 'netsim', 80)));
    check('an external tool this build cannot draw still gets its link',
          !canEmbed(tool('somethingelse', 'external', 'other', 80)));
    check('and canEmbed is about EXTERNAL tools only',
          !canEmbed(tool('netsim', 'console', 'netsim', 80)));
    check('a missing tool is not embeddable', !canEmbed(null));
}

/* -------------------- 4b. what Check my work says -------------------- */

section('4b. Check my work is never silent');

/*
 * The button had no visible outcome in three of its four cases, which is the
 * whole of "I click Check my work and nothing happens":
 *
 *  * the grade did not move - the commonest outcome by far;
 *  * every task in the lab is self-marked, so it CANNOT move. The entire
 *    Networking track is like that and nothing on screen said so;
 *  * `labsService.gradeLab` swallows a transport failure on purpose, so a dead
 *    replica and a passing grade produced the identical nothing.
 */
{
    const grade = (over: Partial<LabGrade> = {}): LabGrade => ({
        tasks: [], done: 0, total: 4, earned: 0, possible: 8, percent: 0,
        status: 'in_progress', unavailable: [], ...over,
    });
    const row = (id: string, manual: boolean, status: any = 'pending') => ({
        id, title: id, detail: '', hint: '', points: 1, status, note: '',
        requires: '', manual,
    });

    check('a dead replica is NAMED rather than looking like a pass',
          gradeReport(grade(), null).tone === 'bad'
          && /did not answer/.test(gradeReport(grade(), null).key));

    const moved = gradeReport(grade({ done: 1 }), grade({ done: 3 }));
    check('progress says how much moved', moved.tone === 'good'
          && moved.params.v0 === 2 && moved.params.v1 === 3, moved);

    const finished = gradeReport(grade({ done: 3 }),
                                 grade({ done: 4, earned: 8 }));
    check('and finishing says so rather than "1 more done"',
          finished.tone === 'good' && /Every task is done/.test(finished.key),
          finished);

    const stuck = gradeReport(grade({ done: 2, tasks: [row('a', false)] }),
                              grade({ done: 2, tasks: [row('a', false)] }));
    check('NOTHING MOVING IS STILL AN ANSWER', stuck.tone === 'warn'
          && /Nothing new yet/.test(stuck.key), stuck);

    const manual = grade({ done: 0, tasks: [row('a', true), row('b', true)] });
    check('a lab that can only be self-marked says so',
          /marked by you/.test(gradeReport(manual, manual).key),
          gradeReport(manual, manual));

    const mixed = grade({ done: 0, tasks: [row('a', true), row('b', false)] });
    check('...and one with a single automatic task does not',
          /Nothing new yet/.test(gradeReport(mixed, mixed).key));

    const lost = gradeReport(grade({ done: 3 }), grade({ done: 1 }));
    check('work that has LEFT the environment is not reported as no change',
          lost.tone === 'warn' && /no longer in your environment/.test(lost.key),
          lost);

    const broken = grade({ done: 0, total: 2, unavailable: ['a', 'b'],
                           tasks: [row('a', false, 'unavailable'),
                                   row('b', false, 'unavailable')] });
    check('a lab nothing can check is a fault, not a to-do list',
          gradeReport(broken, broken).tone === 'bad', gradeReport(broken, broken));

    const first = gradeReport(null, grade({ done: 1 }));
    check('and the first press has no "before" to compare against',
          first.tone === 'good' && first.params.v0 === 1, first);

    /* Every sentence it can answer with is a catalogue key `check:i18n` can see.
       Reached through a variable, so a scan for $t('...') literals finds none of
       them - the same shape as the sidebar's labels and the badge names. */
    const produced = new Set<string>();
    for (const before of [null, grade({ done: 3 })]) {
        for (const after of [null, grade({ done: 1 }), grade({ done: 4, earned: 8 }),
                             grade({ done: 3 }), manual, broken]) {
            produced.add(gradeReport(before, after).key);
        }
    }
    const missing = [...produced].filter(key => GRADE_REPORT_KEYS.indexOf(key) < 0);
    check('EVERY sentence it can produce is in GRADE_REPORT_KEYS',
          missing.length === 0, missing);
    const orphan = GRADE_REPORT_KEYS.filter(key => !produced.has(key));
    check('and the list carries nothing it can never produce',
          orphan.length === 0, orphan);
}

/* ─────────────────── 5. the GUI spec ─────────────────── */

section('5. The GUI panel spec');

/**
 * A payload shaped like the one `utils/labenv.py` builds, for every family.
 *
 * Hand-written from the backend's own `view()` functions, and that is the point:
 * a panel whose `path` names a key the backend does not send renders EMPTY,
 * which is indistinguishable from an environment with nothing in it. This is the
 * only place the two shapes are compared.
 */
const VIEWS: Record<string, any> = {
    docker: {
        stats: { running: 1, total: 2, images: 3, volumes: 1, networks: 4 },
        containers: [{ id: 'abc', name: 'web', image: 'nginx:latest',
                       status: 'running', command: 'nginx', created: 'now',
                       uptime: 'Up 1 second', exit_code: 0, service: '',
                       ports: ['0.0.0.0:8080 -> 80/tcp'],
                       networks: [{ name: 'bridge', ip: '172.17.0.2' }],
                       mounts: [], env: [], logs: [] }],
        images: [{ repository: 'nginx', tag: 'latest', id: 'x', size: '142MB',
                   layers: 6, created: '7 days ago' }],
        volumes: [{ name: 'data', driver: 'local', anonymous: false,
                    mountpoint: '/var/lib', used_by: ['web'] }],
        networks: [{ name: 'bridge', id: 'x', driver: 'bridge',
                     subnet: '172.17.0.0/16', builtin: true, members: ['web'] }],
        compose: {},
    },
    kubernetes: {
        stats: { nodes: 3, namespaces: 4, pods: 3, running: 3,
                 deployments: 1, services: 1 },
        nodes: [{ name: 'lab-worker1', role: '<none>', status: 'Ready',
                  version: 'v1.30.2', cpu: '4', memory: '8Gi',
                  ip: '10.244.0.3', pods: ['web-x'] }],
        namespaces: [{ name: 'default', status: 'Active', objects: 5 }],
        deployments: [{ name: 'web', namespace: 'default', replicas: 3,
                        ready: 3, images: ['nginx:1.27'], revision: 1,
                        pods: ['web-x'] }],
        pods: [{ name: 'web-x', namespace: 'default', status: 'Running',
                 ready: '1/1', node: 'lab-worker1', ip: '10.244.1.5',
                 restarts: 0, owner: 'web-abc', reason: '', age: 'now',
                 labels: {}, containers: [], logs: [] }],
        services: [{ name: 'web-svc', namespace: 'default', type: 'ClusterIP',
                     cluster_ip: '10.96.0.5', node_port: '', selector: {},
                     ports: [] }],
        replicasets: [{ name: 'web-abc', namespace: 'default', owner: 'web',
                        desired: 3, revision: 1 }],
        configmaps: [{ name: 'app-config', namespace: 'default',
                       keys: ['GREETING'] }],
        secrets: [{ name: 'app-secret', namespace: 'default', keys: ['PASSWORD'] }],
        ingresses: [], pvcs: [], helm: [],
        events: [{ at: 'now', age: 'now', type: 'Normal', reason: 'Scheduled',
                   object: 'pod/web-x', message: 'Successfully assigned' }],
    },
    hadoop: {
        namenode: { safemode: false, capacity: 1, capacity_h: '180.0GB',
                    used: 1, used_h: '5.5MB', remaining_h: '180.0GB',
                    used_percent: 0.01, logical_bytes: 1, logical_h: '2.0MB',
                    replication: 3, block_size_h: '128.0MB', files: 6,
                    dirs: 10, blocks: 5, replicas: 14, live_nodes: 3 },
        datanodes: [{ host: 'dn-1', ip: '10.30.0.11', state: 'Live',
                      rack: '/default-rack', capacity_h: '60.0GB',
                      used_h: '1.9MB', used_percent: 0.01, blocks: 4,
                      version: '3.3.6' }],
        browser: [{ path: '/data', name: 'data', parent: '/', type: 'dir',
                    size: 0, size_h: '0B', replication: 0, blocks: 0,
                    owner: 'lab', group: 'supergroup', perm: 'drwxr-xr-x' }],
        yarn: { running: 0, finished: 3, failed: 0, nodes: 3,
                apps: [{ id: 'application_x_0001', name: 'hive: SELECT',
                         type: 'MAPREDUCE', user: 'lab', queue: 'default',
                         state: 'FINISHED', final: 'SUCCEEDED', progress: 100,
                         started: 'now', elapsed_ms: 280, containers: 6,
                         memory_mb: 430, vcores: 3 }],
                queue: { name: 'default', capacity: 100, used: 0 } },
        spark: { jobs: [{ app: 'application_x_0002', id: 1, engine: 'spark',
                          description: 'SELECT city', duration_ms: 472,
                          shuffle_read_h: '150.0KB', shuffle_write_h: '150.0KB',
                          rows_scanned: 6000, rows_returned: 5,
                          status: 'SUCCEEDED', submitted: 'now',
                          stages: [{ id: 0, name: 'Scan', tasks: 1,
                                     duration_ms: 127,
                                     shuffle_read_h: '0B',
                                     shuffle_write_h: '150.0KB' }] }] },
        hive: { databases: ['default'], current: 'default',
                tables: [{ db: 'default', name: 'orders', rows: 6000,
                           external: true, format: 'TEXTFILE',
                           location: '/data/orders.csv', columns: [],
                           partitioned_by: [], size_h: '570.0KB' }] },
        ambari: { services: [{ name: 'HDFS', state: 'STARTED',
                               health: 'HEALTHY',
                               components: ['NameNode'],
                               metric: 'DFS used 0.0%' }],
                  alerts: [{ service: 'HDFS', level: 'WARNING',
                             text: 'NameNode is in safe mode' }],
                  hosts: [] },
    },
    aws: {
        stats: { buckets: 1, objects: 1, instances: 1, vpcs: 2, functions: 1,
                 tables: 1, databases: 1 },
        s3: { buckets: [{ name: 'lab', region: 'me-central-1',
                          versioning: 'Disabled', website: false, objects: 1,
                          bytes_h: '6B', arn: 'arn:aws:s3:::lab' }],
              objects: [{ bucket: 'lab', key: 'notes.txt', size: 6,
                          size_h: '6B', storage: 'STANDARD', etag: 'x' }] },
        ec2: { instances: [{ id: 'i-x', type: 't3.micro', state: 'running',
                             image: 'ami-x', ami_name: 'Amazon Linux 2023',
                             az: 'me-central-1a', vpc: 'vpc-x',
                             subnet: 'subnet-x', private_ip: '10.0.1.10',
                             public_ip: '18.1.2.3', key: 'lab-key',
                             groups: ['sg-x'], cpus: 2, memory: 1,
                             name: 'web-1', launched: 'now' }],
               vpcs: [{ id: 'vpc-x', cidr: '10.20.0.0/16', default: false,
                        name: '', subnets: 1 }],
               subnets: [{ id: 'subnet-x', vpc: 'vpc-x', cidr: '10.20.1.0/24',
                           az: 'me-central-1a', public: false }],
               security_groups: [{ id: 'sg-x', name: 'web-sg', vpc: 'vpc-x',
                                   description: 'web tier',
                                   ingress: [{ protocol: 'tcp', port: '22',
                                               cidr: '0.0.0.0/0' }] }],
               key_pairs: [{ name: 'lab-key', id: 'key-x' }] },
        iam: { roles: [{ name: 'r', arn: 'arn:aws:iam::1:role/r',
                         policies: ['arn:policy'] }],
               users: [] },
        lambda: [{ name: 'f', runtime: 'python3.12', handler: 'app.handler',
                   role: 'arn:aws:iam::1:role/r', memory: 128, timeout: 3,
                   invocations: 1, arn: 'arn:lambda' }],
        dynamodb: [{ name: 'Notes', status: 'ACTIVE', items: 0,
                     billing: 'PAY_PER_REQUEST', arn: 'arn:ddb' }],
        rds: [{ id: 'labdb', engine: 'postgres', status: 'available',
                class: 'db.t3.micro', storage: 20, endpoint: 'labdb.rds',
                port: 5432, multi_az: false }],
        sqs: [], sns: [],
        logs: { groups: [{ name: '/aws/lambda/f', events: 2 }],
                events: [{ group: '/aws/lambda/f', at: 'now',
                           message: 'START RequestId: x' }] },
    },
    azure: {
        stats: { groups: 1, resources: 5, vms: 1, running: 1, storage: 1,
                 webapps: 0 },
        groups: [{ name: 'lab-rg', location: 'uaenorth',
                   id: '/subscriptions/x/resourceGroups/lab-rg',
                   state: 'Succeeded', resources: 5 }],
        resources: [{ kind: 'vm', name: 'web1', group: 'lab-rg',
                      location: 'uaenorth',
                      type: 'Microsoft.Compute/virtualMachines',
                      id: '/subscriptions/x/...', state: 'Succeeded',
                      detail: 'Standard_B1s Ubuntu2404 VM running' }],
        storage: { accounts: [{ name: 'labstore1', group: 'lab-rg',
                                sku: 'Standard_LRS', account_kind: 'StorageV2',
                                endpoint: 'https://labstore1.blob/',
                                containers: 1 }],
                   containers: [{ account: 'labstore1', name: 'uploads',
                                  public: false, blobs: 1 }],
                   blobs: [{ account: 'labstore1', container: 'uploads',
                             name: 'notes.txt', size: 6, size_h: '6B',
                             tier: 'Hot' }] },
        deployments: [],
    },
    terraform: {
        stats: { managed: 3, pending: 0, providers: 1 },
        state: { serial: 1, lineage: 'x',
                 resources: [{ address: 'aws_s3_bucket.data', type: 'aws_s3_bucket',
                               name: 'data', provider: 'aws', id: 'lab',
                               attributes: {}, computed: {}, created: 'now' }] },
        outputs: [{ name: 'arn', value: 'arn:aws:s3:::lab' }],
        plan: { at: 'now', destroy: false,
                actions: [{ action: 'create', address: 'aws_s3_bucket.data',
                            type: 'aws_s3_bucket', changes: [] }] },
        graph: [{ address: 'aws_subnet.app', type: 'aws_subnet',
                  depends_on: ['aws_vpc.main'] }],
        providers: [{ name: 'aws', version: '5.58.0' }],
        initialised: true, workspace: 'default', version: '1.9.3',
    },
    ansible: {
        kind: 'ansible', version: '2.16.3', inventory: 'inventory.ini',
        inventory_ok: true,
        stats: { hosts: 3, in_inventory: 3, groups: 2, runs: 2,
                 last_changed: 0, last_failed: 0, roles: 1 },
        hosts: [{ name: 'web1', address: '10.10.0.11', os: 'Ubuntu 22.04',
                  family: 'Debian', groups: 'webservers', in_inventory: true,
                  reachable: true, packages: 2, services_running: 1, files: 3,
                  status: 'managed' }],
        groups: [{ name: 'webservers', hosts: 'web1, web2', count: 2, vars: 1 }],
        packages: [{ host: 'web1', name: 'nginx', version: '1.0-lab' }],
        services: [{ host: 'web1', name: 'nginx', state: 'running',
                     enabled: true }],
        runs: [{ playbook: 'site.yml', at: 'now', mode: 'apply', ok: 4,
                 changed: 0, failed: 0, unreachable: 0, skipped: 0,
                 idempotent: true }],
        roles: [{ name: 'webserver', tasks: 3 }],
    },
    jenkins: {
        kind: 'jenkins', version: '2.440.1', url: 'http://jenkins.lab:8080/',
        branch: 'main',
        stats: { jobs: 1, builds: 2, nodes: 2, plugins: 5, credentials: 1,
                 last_result: 'SUCCESS' },
        jobs: [{ name: 'demo', source: 'SCM: Jenkinsfile', disabled: false,
                 next: 3, builds: 2, last_result: 'SUCCESS', last_at: 'now',
                 status: 'SUCCESS' }],
        builds: [{ job: 'demo', number: '#2', result: 'SUCCESS', at: 'now',
                   took: '9s', stages: 3, artifacts: 1, tests: '0 / 8 failed',
                   cause: 'started by user admin' }],
        last_build: { job: 'demo', number: 2 },
        stages: [{ stage: 'Build', status: 'SUCCESS', steps: 2, note: '' }],
        nodes: [{ name: 'linux-agent', labels: 'linux, docker', executors: 2,
                  status: 'online' }],
        plugins: [{ id: 'git', name: 'Git plugin', version: '5.2.1' }],
        credentials: [{ id: 'dockerhub', kind: 'username_password',
                        username: 'labuser', description: 'Registry' }],
    },
    puppet: {
        kind: 'puppet', version: '8.4.0',
        stats: { nodes: 3, certname: 'web1.lab', environment: 'production',
                 resources: 3, classes: 1, runs: 2, last_changed: 0,
                 last_failed: 0 },
        nodes: [{ name: 'web1.lab', address: '10.20.0.11', os: 'Ubuntu 22.04',
                  family: 'Debian', certificate: 'signed', primary: true,
                  packages: 1, services_running: 1, files: 2 }],
        catalog: [{ ref: 'package[nginx]', type: 'package', title: 'nginx',
                    scope: 'main', attributes: 1 }],
        edges: [{ from: 'package[nginx]', to: 'service[nginx]',
                  kind: 'notify' }],
        runs: [{ manifest: 'site.pp', node: 'web1.lab', at: 'now',
                 mode: 'enforce', total: 3, changed: 0, failed: 0,
                 idempotent: true }],
        packages: [{ node: 'web1.lab', name: 'nginx', version: '1.0-lab' }],
        services: [{ node: 'web1.lab', name: 'nginx', state: 'running',
                     enabled: true, restarts: 1, restarted: true }],
        files: [{ node: 'web1.lab', path: '/etc/motd', mode: '0644',
                  owner: 'root', bytes: 18 }],
        classes: [{ name: 'webserver' }],
    },
    chef: {
        kind: 'chef', version: '18.4.12',
        stats: { node: 'node1.lab', environment: '_default',
                 platform: 'ubuntu 22.04', runlist: 1, resources: 6, runs: 2,
                 last_updated: 0, last_failed: 0 },
        runlist: [{ position: 1, entry: 'recipe[webserver]' }],
        resources: [{ ref: 'package[nginx]', type: 'package', name: 'nginx',
                      cookbook: 'webserver', actions: 'install', guards: 0,
                      notifies: 0, guarded: false, notifying: false,
                      updated: false }],
        attributes: [{ attribute: 'webserver/port', level: 'default',
                       value: '8080', effective: '8080' }],
        compile_log: [{ line: 'written last, printed first' }],
        runs: [{ runlist: 'webserver', at: 'now', mode: 'converge', total: 6,
                 updated: 0, failed: 0, delayed: 0, idempotent: true }],
        packages: [{ name: 'nginx', version: '1.0-lab' }],
        services: [{ name: 'nginx', state: 'running', enabled: true,
                     restarts: 1, restarted: true }],
        files: [{ path: '/etc/motd', mode: '0644', owner: 'root', bytes: 18 }],
        running: ['nginx'],
    },
    // The two Claude engines. Shaped exactly as `view()` builds them in app
    // 11's `utils/sims/claude.py` and `utils/sims/claudecode.py` - which is
    // the only place the two shapes meet, and the reason this table exists: a
    // panel whose `path` names a key the backend does not send renders EMPTY,
    // and an empty panel is indistinguishable from an environment with nothing
    // in it.
    claudeapi: {
        kind: 'claude', platform: 'anthropic',
        stats: { platform: 'anthropic', model: 'claude-sonnet-4-5',
                 context: 200000, cutoff: '2025-01', temperature: 1.0,
                 max_tokens: 1024, requests: 2, in_tokens: 90,
                 out_tokens: 120, cache_read: 0, cost: 0.002, tools: 1,
                 chunks: 6, index: 'hybrid', mcp_servers: 1 },
        requests: [{ n: 1, label: 'messages.create', model: 'claude-sonnet-4-5',
                     platform: 'anthropic', system: '', has_system: false,
                     temperature: 0.0, max_tokens: 300, stream: false,
                     turns: 1, tools: 1, tool_used: '', thinking: false,
                     in_tokens: 40, out_tokens: 60, cache_write: 0,
                     cache_read: 0, cache_ignored: 0, stop_reason: 'end_turn',
                     words: 42, valid_json: false, xml_tags: '',
                     grounded: false, refused: false, prefilled: false,
                     cost: 0.001, text: '...' }],
        conversation: [{ role: 'user', text: 'hi', blocks: 'text',
                         tokens: 2 }],
        tools: [{ name: 'get_weather', description: 'Get the weather',
                  required: 'city', properties: 1 }],
        tool_calls: [{ name: 'get_weather', id: 'toolu_x', input: '{}',
                       answered: true }],
        documents: [{ name: 'faq.md', tokens: 380, words: 260 }],
        chunks: [{ id: 'faq.md#0', document: 'faq.md', tokens: 120,
                   words: 95, text: '...' }],
        searches: [{ query: 'cost', mode: 'hybrid', k: 3, reranked: false,
                     results: 3, top: 'plans.md#1', top_score: 0.12,
                     documents: 'plans.md' }],
        evals: [{ name: 'triage', grader: 'code', cases: 3, passed: 3,
                  failed: 0, pass_rate: 100.0, avg_score: 1.0 }],
        mcp: [{ name: 'docs', transport: 'stdio', command: 'python server.py',
                tools: 2, resources: 1, prompts: 1, status: 'connected' }],
        mcp_tools: [{ name: 'search_docs', description: 'Search',
                      params: 'query', documented: true, server: 'docs' }],
    },
    claudecode: {
        kind: 'claudecode', surface: 'code',
        stats: { surface: 'code', model: 'claude-sonnet-4-5', mode: 'default',
                 memory_files: 2, memory_tokens: 104, rules: 4, hooks: 2,
                 skills: 1, agents: 1, commands: 1, mcp: 0, plugins: 1,
                 sessions: 3, denied: 1 },
        memory: [{ order: 1, scope: 'user', path: '~/.claude/CLAUDE.md',
                   lines: 2, tokens: 9, imports: '' }],
        settings: [{ scope: 'project', path: '.claude/settings.json',
                     status: 'loaded', rules: 4, hooks: 2 }],
        permissions: [{ effect: 'deny', rule: 'Bash(rm:*)' }],
        hooks: [{ event: 'PreToolUse', matcher: 'Bash', command: 'grep -q',
                  source: '.claude/settings.json', fired: 1, blocked: 1 }],
        hook_log: [{ session: 'abc', event: 'PreToolUse', matcher: 'Bash',
                     command: 'grep -q', tool: 'Bash', exit: 2, blocked: true,
                     output: '' }],
        skills: [{ name: 'changelog', scope: 'project',
                   description: 'Write a changelog entry', words: 40,
                   files: 1, valid: true }],
        agents: [{ name: 'reviewer', scope: 'project',
                   description: 'Review a change', tools: 'Read, Grep',
                   model: 'sonnet', valid: true }],
        commands: [{ name: '/ship', description: 'Ship a release',
                     argument_hint: '', scope: 'project', words: 20 }],
        mcp: [{ name: 'docs', command: 'python server.py',
                transport: 'stdio', scope: 'local', status: 'connected' }],
        plugins: [{ name: 'release', marketplace: 'team', skills: 1,
                    agents: 1, commands: 0, hooks: 0, root: 'm/release' }],
        sessions: [{ id: 'abc', prompt: 'fix the bug', mode: 'acceptEdits',
                     tools: 3, allowed: 2, denied: 1, skill: '',
                     subagent: '', is_error: false, cost: 0.005 }],
        tool_log: [{ session: 'abc', tool: 'Edit', target: 'src/app.py',
                     decision: 'allow', reason: 'allow rule',
                     result: 'edited', hooked: false,
                     // ALWAYS PRESENT, empty for the caller's own calls and the
                     // subagent's name for its. A key on some rows and not
                     // others is a column that renders undefined.
                     agent: '' }],
        connectors: [],
    },
    // The MCP engine. Shaped exactly as `view()` builds it in app 11's
    // `utils/sims/mcp.py`, which is the only place the two shapes meet.
    mcp: {
        kind: 'mcp', transport: 'stdio',
        stats: { transport: 'stdio', stateful: true, connected: true,
                 protocol: '2025-06-18', session_id: '-', server: 'docs',
                 tools: 2, resources: 2, prompts: 1, requests: 6,
                 notifications: 4, sampled: 1 },
        messages: [{ n: 1, dir: 'client->server', type: 'request', id: 1,
                     method: 'initialize', params: '{}', result: '',
                     error: '' },
                   { n: 2, dir: 'server->client', type: 'notification', id: '',
                     method: 'notifications/progress', params: '{}',
                     result: '', error: '' }],
        tools: [{ name: 'search_docs', description: 'Search the docs',
                  schema: 'query:string', documented: true, samples: false,
                  logs: false, progress: false }],
        resources: [{ uri: 'docs://index', mime: 'text/plain', kind: 'fixed',
                      description: 'Every document' }],
        prompts: [{ name: 'review', description: 'Review one area',
                    arguments: 'area' }],
        capabilities: [{ side: 'client', capability: 'sampling',
                         declared: true }],
        client: [{ method: 'initialize', implemented: true }],
        calls: [{ tool: 'search_docs', arguments: '{}', ok: true,
                  sampled: false, text: '...', at: 'now' }],
        sampling: [{ tool: 'summarise', allowed: true, reason: 'client approved',
                     model: 'claude-sonnet-4-5', text: '...', at: 'now' }],
        notifications: [{ kind: 'progress', method: 'notifications/progress',
                          level: '', tool: 'summarise', text: 'step 1 of 3',
                          delivered: true, at: 'now' }],
        roots: [{ uri: 'file:///workspace', declared: true }],
        reads: [{ uri: 'docs://index', mime: 'text/plain', template: false,
                  ok: true, at: 'now' }],
        prompt_gets: [{ name: 'review', arguments: '{}', messages: 1,
                        at: 'now' }],
        sessions: [{ id: 'mcp-abc', transport: 'http', stateful: true,
                     at: 'now', requests: 0 }],
    },
    git: {
        initialised: true, branch: 'main', user: { name: 'x', email: 'y' },
        branches: [{ name: 'main', sha: 'abc1234', current: true,
                     message: 'first' }],
        commits: [{ sha: 'abc1234', full: 'abc', message: 'first',
                    author: 'x', at: 'now', parents: [], merge: false,
                    refs: ['main'], files: ['README.md'] }],
        status: { staged: [], modified: [], untracked: [], deleted: [],
                  conflicts: [] },
        stash: 0, tags: [],
    },
};

// COWORK READS THE CLAUDE CODE PAYLOAD, because it is the same engine under a
// second family name - see `families_of_engine` in app 11's
// `utils/labtools.py`, which is what makes the backend key the payload under
// both. Aliased here rather than copied so the two cannot drift: a copy would
// let a `cowork` panel point at a key `claudecode` no longer sends and still
// pass.
VIEWS.cowork = VIEWS.claudecode;

for (const [family, panels] of Object.entries(GUI_PANELS)) {
    const view = VIEWS[family];
    check(`${family}: the check has a payload for it`, Boolean(view));
    if (!view) continue;
    for (const panel of panels) {
        const value = pick(view, panel.path);
        check(`${family}.${panel.id}: \`${panel.path}\` EXISTS in the payload`,
              value !== undefined, { family, path: panel.path });
        if (panel.kind === 'stats') {
            check(`${family}.${panel.id}: it is an object with scalars in it`,
                  statsAt(view, panel.path).length > 0,
                  { family, path: panel.path });
        } else if (panel.kind !== 'json') {
            check(`${family}.${panel.id}: it reads as rows`,
                  Array.isArray(rowsAt(view, panel.path)),
                  { family, path: panel.path });
        }
        for (const column of panel.columns || []) {
            const rows = rowsAt(view, panel.path);
            if (rows.length === 0) continue;
            check(`${family}.${panel.id}: column \`${column.key}\` is a key the `
                  + 'backend sends',
                  column.key in rows[0], { family, panel: panel.id,
                                           column: column.key,
                                           keys: Object.keys(rows[0]) });
        }
    }
}

check('every panel id is unique within its family',
      Object.entries(GUI_PANELS).every(([, panels]) =>
        new Set(panels.map(p => p.id)).size === panels.length));

check('every panel title is a catalogue key',
      PANEL_TITLE_KEYS.length > 10 && PANEL_TITLE_KEYS.every(
        title => typeof title === 'string' && title.length > 0));

check('panelsFor gives a lab only the dashboards it lists',
      panelsFor('docker', ['docker']).length === 0
      && panelsFor('docker', ['docker', 'docker_gui']).length === 5,
      { none: panelsFor('docker', ['docker']).length,
        some: panelsFor('docker', ['docker', 'docker_gui']).length });

check('A LAB WITH SOME OF A FAMILY\'S GUIS GETS ONLY THOSE',
      panelsFor('hadoop', ['hdfs', 'namenode_gui']).length === 3,
      panelsFor('hadoop', ['hdfs', 'namenode_gui']).map(p => p.id));

check('an unknown family answers with no panels rather than throwing',
      panelsFor('frobnicate', ['x']).length === 0);

/* ─────────────────── 6. path picking degrades ─────────────────── */

section('6. A missing path is empty, never an exception');

check('a path that is absent answers undefined',
      pick({ a: 1 }, 'b.c.d') === undefined);
check('and rowsAt turns that into an empty array',
      rowsAt({ a: 1 }, 'b.c.d').length === 0);
check('statsAt too', statsAt({ a: 1 }, 'b.c.d').length === 0);
check('picking through a list flattens it',
      JSON.stringify(pick({ rows: [{ n: 1 }, { n: 2 }] }, 'rows.n'))
        === '[1,2]');
check('picking a nested list flattens one level',
      JSON.stringify(pick({ rows: [{ n: [1, 2] }, { n: [3] }] }, 'rows.n'))
        === '[1,2,3]');
check('an OBJECT where a table was expected becomes name/value rows',
      JSON.stringify(rowsAt({ out: { a: 1, b: 2 } }, 'out'))
        === '[{"name":"a","value":1},{"name":"b","value":2}]',
      rowsAt({ out: { a: 1, b: 2 } }, 'out'));
check('a scalar where a table was expected is no rows, not a crash',
      rowsAt({ out: 5 }, 'out').length === 0);
check('null does not throw', pick(null, 'a.b') === undefined);
check('humanKey turns a backend key into a label',
      humanKey('used_percent') === 'Used percent' && humanKey('') === '');

/* ─────────────────── 7. the web playground ─────────────────── */

section('7. The web playground');

{
    const document = buildPreview('<h1>Hi</h1>', 'h1 { color: red }',
                                  'console.log(1)');
    check('the document is a full HTML document',
          document.includes('<!DOCTYPE html>'));
    check('THE CONSOLE SHIM COMES BEFORE THE STUDENT\'S SCRIPT',
          document.indexOf('sfsLab') < document.indexOf('console.log(1)'),
          { shim: document.indexOf('sfsLab'),
            script: document.indexOf('console.log(1)') });
    check('the shim posts a message rather than touching window.parent',
          document.includes('postMessage'));
    check('an uncaught error is reported rather than swallowed',
          document.includes('window.onerror')
          && document.includes('unhandledrejection'));
    check('the CSS is in a style block', document.includes('h1 { color: red }'));
    check('the HTML is in the body', document.includes('<h1>Hi</h1>'));
    check('a viewport meta is set, so the result pane behaves on a phone',
          document.includes('name="viewport"'));

    const whole = buildPreview(
      '<html><head><title>x</title></head><body><p>own</p></body></html>',
      'p { margin: 0 }', 'console.log(2)');
    check('A FULL DOCUMENT THE STUDENT WROTE IS NOT REWRAPPED',
          whole.indexOf('<!DOCTYPE html>') === -1
          && whole.includes('<title>x</title>'), whole.slice(0, 80));
    check('but the shim is still injected into their head',
          whole.includes('sfsLab')
          && whole.indexOf('sfsLab') < whole.indexOf('console.log(2)'));
    check('and their styles and script are added before </body>',
          whole.includes('p { margin: 0 }') && whole.includes('console.log(2)'));

    const empty = buildPreview('', '', '');
    check('three empty panes still produce a valid document',
          empty.includes('<!DOCTYPE html>') && empty.includes('sfsLab'));
}

/* ─────────────────── 8. the tutor prompt ─────────────────── */

section('8. The tutor prompt');

{
    const labRecord = {
        ...lab('docker-01', 'docker', 1),
        brief: '## Where am I?\n\nSome text.',
        objectives: [], tasks: [], environment: {},
        tool_detail: [tool('docker', 'console', 'docker', 10, true),
                      tool('terminal', 'console', 'shell', 1, false)],
        families: ['docker', 'shell'], unknown_tools: [],
        unreachable_checks: [], resources: [],
    } as unknown as Lab;

    const prompt = tutorPrompt(labRecord, 'CURRENT ENVIRONMENT\nnothing yet');
    check('THE PROMPT NAMES THE SIMULATED TOOLS',
          prompt.includes('SIMULATED') && prompt.includes('docker'), prompt.slice(0, 200));
    check('and says there is no daemon behind them',
          prompt.toLowerCase().includes('no daemon'));
    check('the real tools are listed separately',
          prompt.includes('REAL tools'));
    check('the brief is included', prompt.includes('Where am I?'));
    check('the environment is included', prompt.includes('nothing yet'));
    check('it refuses to invent flags',
          prompt.toLowerCase().includes('never invent'));

    const bare = tutorPrompt(null, '');
    check('a prompt with no lab still has the instructions',
          bare.includes('lab instructor') && !bare.includes('SIMULATED'));
}

/* ─────────────────── 9. the labels ─────────────────── */

section('9. Labels are catalogue keys');

check('three difficulties', Object.keys(DIFFICULTY_LABELS).length === 3);
check('three lab statuses', Object.keys(STATUS_LABELS).length === 3);
check('three task statuses', Object.keys(TASK_STATUS_LABELS).length === 3);
check('difficultyRank is total and defaults to the middle',
      difficultyRank('beginner') === 0 && difficultyRank('advanced') === 2
      && difficultyRank('nonsense') === 1);

/* ─────────────────── 10. working rule 13, over the source ─────────────────── */

section('10. Nothing reaches v-html, and the sandbox stays narrow');

const COMPONENTS = [
    'src/components/labs/LabBrief.vue',
    'src/components/labs/LabConsole.vue',
    'src/components/labs/LabCode.vue',
    'src/components/labs/LabQuery.vue',
    'src/components/labs/LabFiles.vue',
    'src/components/labs/LabWeb.vue',
    'src/components/labs/LabGui.vue',
    'src/components/labs/LabPreview.vue',
    'src/components/labs/LabMobile.vue',
    'src/components/labs/LabTasks.vue',
    'src/components/labs/LabTutor.vue',
    'src/components/TopBar.vue',
    'src/views/Labs.vue',
    'src/views/LabWorkspace.vue',
];

/**
 * Comments are stripped before the scan, in BOTH directions.
 *
 * A rule that fires on the paragraph explaining it is a rule nobody can
 * document, and every one of these files explains why it does not use `v-html`.
 * `check:aichat` and `check:leaderboard` both had exactly this and both had to
 * learn it (working rule 44).
 */
function stripComments(text: string): string {
    return text
        .replace(/<!--[\s\S]*?-->/g, ' ')
        .replace(/\/\*[\s\S]*?\*\//g, ' ')
        .replace(/(^|[^:])\/\/[^\n]*/g, '$1 ');
}

for (const path of COMPONENTS) {
    const text = stripComments(source(path));
    check(`${path}: no v-html`, !/v-html/.test(text));
    check(`${path}: no innerHTML`, !/innerHTML/.test(text));
    check(`${path}: does not import marked`, !/from\s+['"]marked['"]/.test(text));
}

{
    /*
     * EVERY FRAME IN THE LAB UI, not just the web playground.
     *
     * This block named `LabWeb.vue` and nothing else, which was right when it
     * was the only component with an iframe in it. Two more now render a
     * document a student's own source produced - the backend Browser and the
     * mobile Phone - and a rule that names one file cannot notice the third.
     * So the list is DERIVED from which components actually contain a frame,
     * and a component that grows one is covered the day it does.
     */
    const framed = COMPONENTS.filter(path => /<iframe/.test(source(path)));
    check('every rendered-document pane is accounted for here',
          framed.length === 3, framed);
    for (const path of framed) {
        const text = source(path);
        const attribute = text.match(/sandbox="([^"]*)"/);
        check(`${path}: has a sandbox attribute`, Boolean(attribute), attribute);
        check(`${path}: NO allow-same-origin, which would undo the sandbox`,
              Boolean(attribute) && !attribute![1].includes('allow-same-origin'),
              attribute?.[1]);
        check(`${path}: srcdoc, not a blob URL that would inherit our origin`,
              /:srcdoc="/.test(text) && !/URL\.createObjectURL/.test(text)
              && !/window\.open/.test(text));
    }
    const web = source('src/components/labs/LabWeb.vue');
    check('the web playground allows scripts, or nothing runs',
          /sandbox="[^"]*allow-scripts/.test(web));
    check('and messages are filtered on our own marker',
          /payload\.sfsLab !== true/.test(web));

    /*
     * The backend Browser takes the same care with ITS shim. It cannot filter
     * on an origin - `allow-same-origin` is absent, so the frame's origin is
     * opaque and there is no origin to name - so the marker is the only thing
     * that can be checked, and it has to be checked.
     */
    const preview = source('src/components/labs/LabPreview.vue');
    check('the Browser pane filters postMessage on its own marker',
          /data\.sfsPreview !== 1/.test(preview));
    check('the Browser pane follows only ONE redirect, so a loop cannot hang it',
          /location !== next/.test(preview));

    /*
     * THE PHONE RENDERS AT THE DEVICE'S OWN PIXEL SIZE.
     *
     * This is the one property the pane exists for. Scaling the frame's
     * contents instead would report the PANE's width to the page, so a
     * `@media (max-width: 480px)` rule would fire on a desktop and not fire on
     * a phone - the preview would be confidently wrong about exactly the thing
     * it was added to answer, and it would look completely fine.
     */
    const mobile = source('src/components/labs/LabMobile.vue');
    /*
     * Anchored on `innerStyle` SPECIFICALLY, which is the iframe's own style.
     *
     * The first version of this looked for the width expression anywhere in
     * the file - and it appears twice, on the screen cutout and on the frame,
     * so breaking either one left the other matching and the check passed.
     * Caught by mutating it (working rule 44). The frame is the binding that
     * decides what `window.innerWidth` reports to the student's page; the
     * cutout is decoration.
     */
    const innerStyle = (mobile.match(
        /const innerStyle = computed\(\(\) => \(\{([\s\S]*?)\}\)\);/) || [])[1] || '';
    check('THE IFRAME is sized from the device, not from the pane',
          /width:\s*`\$\{meta\.value\.width\}px`/.test(innerStyle)
          && /height:\s*`\$\{meta\.value\.height\}px`/.test(innerStyle),
          innerStyle.trim());
    check('and the DEVICE is what gets scaled, not the page inside it',
          /transform:\s*`scale\(\$\{scale\.value\}\)`/.test(mobile));
    check('it never scales UP, which would be the same lie enlarged',
          /Math\.min\(1,/.test(mobile));
}

/*
 * The three faults reported on this page on 2026-09-01, each pinned to the line
 * that fixes it. None of them is a property of this module, so none of them was
 * visible to the 341 assertions above — they were found by BUILDING
 * `tools/labs-preview` and driving the page (working rule 42).
 */
{
    const workspace = stripComments(source('src/views/LabWorkspace.vue'));

    /* 1. A pane kept its state only while it was the visible one.
          `v-if` alone on the active pane DESTROYS the others, so reading the
          brief and coming back re-created the web playground from the last
          SAVED source — the student's unsaved markup gone, along with every
          console transcript. `v-if` on "has been opened" plus `v-show` on
          "is active" is lazy first mount AND alive from then on. */
    check('A PANE IS NOT DESTROYED WHEN THE STUDENT LEAVES IT',
          /v-if="opened\.has\(pane\.family\)"[\s\S]{0,80}v-show="activePane === pane\.family"/
              .test(workspace));
    check('and the tool inside a pane is hidden rather than unmounted',
          /v-show="activeTool\(pane\.family\) === tool\.id"/.test(workspace)
          && !/v-if="activeTool\(pane\.family\) === tool\.id"/.test(workspace));

    /* 2. `refreshViews` re-seeded `webSource` from the views payload, which
          carries the last SAVED html/css/js — so running ANY command replaced
          whatever the student had typed with the lab's starter file. */
    const refresh = workspace.slice(workspace.indexOf('async function refreshViews'),
                                    workspace.indexOf('async function grade0'));
    check('REFRESHING THE DASHBOARDS DOES NOT OVERWRITE THE STUDENT\'S SOURCE',
          refresh.length > 0 && !/webSource\.value\s*=/.test(refresh), refresh.length);
    check('...and only opening the lab seeds it',
          (workspace.match(/webSource\.value\s*=/g) || []).length === 1);

    /* 3. Check my work said nothing in three of its four outcomes. */
    check('grading reports what it did', /gradeReport\(/.test(workspace)
          && /report\.value = gradeReport/.test(workspace));
    check('and the report reaches the task list',
          /:report="report"/.test(workspace));

    /* The Network Simulator is a pane, not a link out of the lab — and it is
       async, or every lab in the catalogue downloads app 27's studio. */
    check('THE NETWORK SIMULATOR IS RENDERED IN PLACE',
          /<NetworkStudio\b[^>]*\bembedded\b/.test(workspace));
    check('and it is loaded lazily, not into this route\'s chunk',
          /defineAsyncComponent\(/.test(workspace)
          && /import\('@\/views\/NetworkSimulatorStudio\.vue'\)/.test(workspace)
          && !/^import NetworkSimulatorStudio/m.test(workspace));
    check('a chunk that will not load says so rather than leaving a blank pane',
          /errorComponent/.test(workspace));
}

{
    const web = stripComments(source('src/components/labs/LabWeb.vue'));

    /* The source in these three boxes belongs to the BROWSER once the lab is
       open. Adopting an incoming one unconditionally is what threw the
       student's markup away on every command they ran. */
    check('the playground ignores a server source once the student has typed',
          /if \(touched\.value\) return;/.test(web));
    /* The BODY of `run`, not a window around it. The first spelling of this
       allowed 60 characters between `render()` and `queueSave()` and matched
       straight across the closing brace into the declaration of `queueSave`
       itself — so it passed with the call removed, which
       `tools/labs-check/negative.py` is what found. */
    const runBody = (web.match(/function run\(\)\s*\{([^}]*)\}/) || [])[1] || '';
    check('and Run PERSISTS as well as rendering, so grading sees it',
          /render\(\)/.test(runBody) && /queueSave\(\)/.test(runBody), runBody);

    /* `document` as a local binding shadows the global one in every function in
       this file. It worked, and it is a trap nobody should have to notice. */
    check('nothing in the playground shadows a browser global',
          !/^\s*(const|let|var)\s+(document|window|location|history)\b/m.test(web));

    /* "Open in a new tab" is the obvious way to give a bigger preview and it
       cannot be done safely: the only URL that can carry a document assembled
       here is `blob:`, which inherits THIS origin — so the student's own script
       would run on the platform with the session token in reach. */
    check('THERE IS NO WAY OUT OF THE SANDBOX INTO A TAB OF OUR OWN',
          !/createObjectURL|window\.open|blob:/.test(web));
    check('a bigger preview widens the frame instead', /sl-web--wide/.test(web));
}

{
    const tasks = stripComments(source('src/components/labs/LabTasks.vue'));
    check('the task list draws the grading report',
          /report\.key/.test(tasks) && /sl-tasks__feedback/.test(tasks));
    check('and says so when a lab can ONLY be self-marked',
          /allManual/.test(tasks));
    /* A checkbox reads as reversible and this is not: `tasks_done` is joined by
       union at both ends, so an untick is discarded in silence. */
    check('the self-mark control is one-way and disappears once done',
          /task\.manual && task\.status !== 'passed'/.test(tasks)
          && !/<input type="checkbox"[^>]*self-mark/.test(tasks));
}

{
    const studio = stripComments(source('src/views/NetworkSimulatorStudio.vue'));
    check('the studio knows it can be one pane of a lab',
          /defineProps<\{ embedded\?: boolean \}>/.test(studio));
    check('embedded, it does not claim beforeunload — the lab owns the tab',
          /if \(!props\.embedded\) window\.addEventListener\('beforeunload'/.test(studio));
    check('embedded, it does not draw a link that navigates out of the lab',
          /v-if="!embedded"[\s\S]{0,120}to="\/network-simulator"/.test(studio));
    check('and it does not read a route that belongs to the lab',
          /props\.embedded \? undefined : route\.params\.id/.test(studio));
    const css = source('src/assets/css/netsim.css');
    check('the embedded studio is bounded by the PANE, not by the viewport',
          /\.ns-studio--embedded \{[^}]*height:[^}]*\}/.test(css)
          && !/\.ns-studio--embedded \{[^}]*height: calc\(100vh/.test(css));
}

{
    const brief = source('src/components/labs/LabBrief.vue');
    check('the brief uses the LESSON parser, not a second one',
          /from '@\/utils\/lessonContent'/.test(brief));
    const tutor = source('src/components/labs/LabTutor.vue');
    check('the tutor uses the AI Chat parser, not a second one',
          /from '@\/utils\/aichatMarkdown'/.test(tutor));
}

{
    const service = source('src/services/labs.service.ts');
    check('the lab service never reaches the registry itself',
          !/getServiceReplicas\(/.test(service));
    check('and never holds the auth token',
          !/VITE_AUTH_TOKEN/.test(service));
    const ai = source('src/services/lab-ai.service.ts');
    check('the tutor service PINS its replica rather than round-robining',
          /getRandomAiReplica/.test(ai) && !/currentIndex|cursor/.test(ai));
}

{
    const css = source('src/assets/css/labs.css');
    const selectors = [...css.matchAll(/^([.#][\w-][^{,\n]*)(,|\s*\{)/gm)]
        .map(match => match[1].trim());
    const bad = selectors.filter(selector => {
        const first = selector.match(/^\.([\w-]+)/);
        return first ? !/^(sl-|sfs-topbar|sfs-dock)/.test(first[1]) : true;
    });
    check('EVERY SELECTOR IN THE GLOBAL SHEET IS `sl-`/`sfs-topbar` PREFIXED',
          bad.length === 0, bad.slice(0, 5));
    check('and it declares no colour literal outside a var() fallback',
          !/(^|[^(\w])#[0-9a-fA-F]{3,8}\b(?![^()]*\))/m.test(
            css.replace(/\/\*[\s\S]*?\*\//g, ' ')
               .split('\n')
               .filter(line => !/--sl-code|--sl-well|background: #fff|#0b111f|#fcd34d/.test(line))
               .join('\n')),
          'a colour literal outside a fallback');
}


/* =====================================================================
   11. The terminal: completion, reverse search, readline and the editors

   Every lab console has a POSIX shell behind it as of 2026-09-04, and a shell
   reached through a text box with an up-arrow is not a shell. Nobody types a
   whole path - they type three letters and press Tab; nobody scrolls to find
   yesterday's command - they press Ctrl+R. So these keys are the feature, and
   every decision about them is here rather than as a branch in a component,
   because not one of them is visible in a screenshot.
   ===================================================================== */

section('11. The terminal');

const SOURCE: CompletionSource = {
    commands: ['ls', 'cat', 'cd', 'clear', 'terraform', 'nano'],
    dirs: ['modules', 'envs'],
    files: ['main.tf', 'main.tfvars', 'notes.txt'],
    paths: ['main.tf', 'modules/vpc/main.tf', 'modules/vpc/outputs.tf'],
};

check('the FIRST word completes against commands',
      atCommandWord('te', 2) && completeLine('te', 2, SOURCE).line === 'terraform ');
check('and a later word does not - it completes against files',
      !atCommandWord('cat mai', 7)
      && completeLine('cat not', 7, SOURCE).line === 'cat notes.txt ');
/* `docker ps | gre<Tab>` has to offer grep: a pipe starts a new command, and a
   rule that only looked at the start of the LINE would offer filenames there. */
check('a word after a pipe is a command word too',
      atCommandWord('cat x | c', 9));

/* A single match inserts a trailing SPACE, which is the whole ergonomic
   difference: with it, completing and then typing is one motion. */
check('one match completes and adds a space',
      completeLine('cle', 3, SOURCE).line === 'clear '
      && completeLine('cle', 3, SOURCE).listing.length === 0);
/* A directory gets a SLASH instead, so `cd mod<Tab>vpc` keeps going. */
check('a directory completes with a slash rather than a space',
      completeLine('cd mod', 6, SOURCE).line === 'cd modules/');
/* A prefix that is ALREADY complete inserts nothing and lists - which is what
   `main.tf`, `main.tfvars` and a `main/` directory in one place look like, and
   inserting anything there would silently pick one of the three. */
check('a common prefix already typed in full lists without inserting',
      completeLine('cat main', 8,
                   { ...SOURCE, dirs: ['main'] }).line === 'cat main'
      && completeLine('cat main', 8,
                      { ...SOURCE, dirs: ['main'] }).listing.length === 3);

/* SEVERAL matches insert the common prefix and then LIST. Inserting the first
   match would silently pick one of three files, and listing without inserting
   the prefix makes Tab feel like it did nothing. */
{
    const many = completeLine('cat main', 8, SOURCE);
    check('several matches insert the COMMON PREFIX, not the first match',
          many.line === 'cat main.tf', many);
    check('and list every candidate',
          many.listing.length === 2
          && many.listing.every(name => name.startsWith('main.tf')), many);
    check('the caret lands after what was inserted',
          many.caret === many.line.length, many);
}

check('a path with a directory in it completes against the whole workspace',
      completeLine('cat modules/vpc/m', 17, SOURCE).line
      === 'cat modules/vpc/main.tf ');
check('nothing matching leaves the line exactly as it was',
      completeLine('cat zzz', 7, SOURCE).line === 'cat zzz'
      && completeLine('cat zzz', 7, SOURCE).listing.length === 0);
check('no completion source at all is not a crash',
      completeLine('l', 1, { commands: [], dirs: [], files: [] }).line === 'l');
check('wordAt finds the word the caret is inside, not the last one',
      wordAt('cat main.tf note', 8).word === 'main'
      && wordAt('cat main.tf note', 8).start === 4);

/* -- Ctrl+R --------------------------------------------------------------- */
const HISTORY = ['ls -la', 'terraform init', 'ls', 'terraform plan',
                 'terraform init'];

check('reverse search finds the most recent match first',
      searchHistory(HISTORY, { query: 'terra', offset: 0 }).match
      === 'terraform init');
/* KEEPING THE POSITION is what makes it a search rather than a filter:
   pressing Ctrl+R twice has to reach the second match, not re-find the first. */
check('pressing it again walks back to the next match',
      searchHistory(HISTORY, { query: 'terra', offset: 1 }).match
      === 'terraform plan');
/* De-duplicated, because a shell history is the same command six times over
   and a search that walked all six needs six presses to reach the previous one. */
check('duplicates are collapsed, so every press moves',
      searchHistory(HISTORY, { query: 'terra', offset: 0 }).total === 2,
      searchHistory(HISTORY, { query: 'terra', offset: 0 }));
check('it is case-insensitive, as bash is',
      searchHistory(HISTORY, { query: 'TERRA', offset: 0 }).match !== '');
check('no match is an empty string, never the whole history',
      searchHistory(HISTORY, { query: 'zzz', offset: 0 }).match === ''
      && searchHistory(HISTORY, { query: 'zzz', offset: 0 }).total === 0);
check('an offset past the end clamps rather than throwing',
      searchHistory(HISTORY, { query: 'terra', offset: 99 }).match !== '');
check('an empty history is empty, not an exception',
      searchHistory([], { query: 'x', offset: 0 }).total === 0);

/* -- readline ------------------------------------------------------------- */
{
    const line = 'terraform plan -out tf.plan';
    const at = (caret: number) => ({ line, caret, yank: '' });
    check('Ctrl+A goes to the start and Ctrl+E to the end',
          applyReadline('home', at(9)).caret === 0
          && applyReadline('end', at(3)).caret === line.length);
    check('Ctrl+U cuts to the start and keeps it for Ctrl+Y',
          applyReadline('kill-to-start', at(10)).line === 'plan -out tf.plan'
          && applyReadline('kill-to-start', at(10)).yank === 'terraform ');
    check('Ctrl+K cuts to the end',
          applyReadline('kill-to-end', at(9)).line === 'terraform');
    check('Ctrl+W cuts the word behind the caret',
          applyReadline('kill-word', at(14)).line === 'terraform  -out tf.plan',
          applyReadline('kill-word', at(14)));
    check('Ctrl+Y pastes the kill ring back',
          applyReadline('yank', { line: 'ab', caret: 2, yank: 'XY' }).line === 'abXY');
    check('Alt+B and Alt+F move a word at a time',
          applyReadline('word-left', at(14)).caret === 10
          && applyReadline('word-right', at(0)).caret === 9);
    check('a readline key on an EMPTY line does nothing rather than throwing',
          applyReadline('kill-word', { line: '', caret: 0, yank: '' }).line === '');
    check('a caret past the end is clamped',
          applyReadline('end', { line: 'ab', caret: 99, yank: '' }).caret === 2);
}

/* -- !! ------------------------------------------------------------------- */
check('!! is the previous command',
      expandHistory('!!', HISTORY) === 'terraform init');
check('!n is the nth', expandHistory('!2', HISTORY) === 'terraform init');
check('!prefix is the most recent starting with it',
      expandHistory('!ls', HISTORY) === 'ls');
/* A shell reports `event not found`; running NOTHING reads as the console
   having swallowed the line, which is strictly worse than leaving it alone. */
check('!! with no history is left alone, never turned into an empty command',
      expandHistory('!!', []) === '!!');
check('an ordinary line is untouched',
      expandHistory('ls -la', HISTORY) === 'ls -la');

/* -- nano and vi ---------------------------------------------------------- */
const REQUEST = { program: 'nano' as const, path: 'notes.txt',
                  name: 'notes.txt', content: 'one\ntwo', existing: true };

check('nano has no modes, which is the whole reason people reach for it',
      openEditor(REQUEST).mode === 'insert');
/* vi opens in NORMAL mode. A vi that let you type straight into the buffer
   teaches a student the opposite of the one thing vi is famous for. */
check('VI OPENS IN NORMAL MODE',
      openEditor({ ...REQUEST, program: 'vi' }).mode === 'normal');
check('a file that does not exist yet says so',
      openEditor({ ...REQUEST, existing: false }).status.includes('New File'));

{
    const nano = openEditor(REQUEST);
    check('^O writes', editorKey(nano, 'o', { ctrl: true }).kind === 'save');
    check('^X on a clean buffer leaves',
          editorKey(nano, 'x', { ctrl: true }).kind === 'close');
    /* ASKING on a dirty buffer is the honest thing: the alternative is a
       shortcut that silently discards an afternoon of typing. */
    const dirty: EditorState = { ...nano, dirty: true };
    check('^X ON A DIRTY BUFFER ASKS RATHER THAN DISCARDING',
          editorKey(dirty, 'x', { ctrl: true }).kind === 'none'
          && editorKey(dirty, 'x', { ctrl: true }).state.status.includes('Ctrl+O'),
          editorKey(dirty, 'x', { ctrl: true }));
    check('^Q discards deliberately',
          editorKey(dirty, 'q', { ctrl: true }).kind === 'discard');
    check('an ordinary letter in nano is just typing',
          editorKey(nano, 'a').kind === 'none'
          && editorKey(nano, 'a').state.mode === 'insert');
}

{
    const vi = openEditor({ ...REQUEST, program: 'vi' });
    check('i enters insert mode', editorKey(vi, 'i').state.mode === 'insert');
    check('Esc goes back to normal',
          editorKey({ ...vi, mode: 'insert' }, 'Escape').state.mode === 'normal');
    check(': opens the command line',
          editorKey(vi, ':').state.mode === 'command'
          && editorKey(vi, ':').state.pending === ':');
    const typed = { ...vi, mode: 'command' as const, pending: ':wq' };
    check(':wq writes and closes',
          editorKey(typed, 'Enter').kind === 'save-and-close');
    check(':w writes and stays',
          editorKey({ ...typed, pending: ':w' }, 'Enter').kind === 'save');
    /* `:q` on a dirty buffer is E37 in every vi ever shipped, and quietly
       closing would throw the buffer away. */
    check(':q ON A DIRTY BUFFER IS REFUSED WITH THE REAL ERROR',
          editorKey({ ...typed, pending: ':q', dirty: true }, 'Enter').kind === 'none'
          && editorKey({ ...typed, pending: ':q', dirty: true }, 'Enter')
             .state.status.includes('E37'));
    check(':q! discards',
          editorKey({ ...typed, pending: ':q!', dirty: true }, 'Enter').kind
          === 'discard');
    check('an unknown : command reports E492 rather than doing nothing',
          editorKey({ ...typed, pending: ':frobnicate' }, 'Enter')
          .state.status.includes('E492'));
    check('Backspace on the : line rubs out, and empties back to normal',
          editorKey({ ...typed, pending: ':w' }, 'Backspace').state.pending === ':'
          && editorKey({ ...typed, pending: ':' }, 'Backspace').state.mode
             === 'normal');
}

/* The help line has to carry the REAL shortcuts: a student who learns ^O and
   ^X here can use nano on a real machine, and one who learns a Save button
   cannot. */
check('the help line names the real shortcuts',
      editorHelp('nano').includes('^O') && editorHelp('nano').includes('^X')
      && editorHelp('vi').includes(':wq') && editorHelp('vi').includes('Esc'));

/* =====================================================================
   12. Ask the tutor
   ===================================================================== */

section('12. Ask the tutor');

const TASK: LabTask = {
    id: 't3', title: 'Add a locals block that combines them', points: 2,
    detail: 'local.full_name = "${var.a}-${var.b}"',
    hint: 'locals go in their own block', requires: 'file_contains main.tf',
    status: 'pending', note: 'main.tf does not contain it yet', manual: false,
};
const LAB_FOR_QUESTION = lab('tf-02-variables', 'terraform', 2);
LAB_FOR_QUESTION.title = 'Variables and locals';

{
    const question = taskQuestion(LAB_FOR_QUESTION as unknown as Lab, TASK, 3, 6);
    check('the question names the lab and the track',
          question.includes('Variables and locals')
          && question.includes('terraform'), question);
    check('and which task, out of how many',
          question.includes('task 3 of 6'), question);
    check('it quotes the task TITLE', question.includes(TASK.title));
    /* The DETAIL is where the requirement is; the title is only a label. A
       question built from the title alone gets a generic answer about locals. */
    check('AND THE DETAIL, which is where the requirement actually is',
          question.includes('local.full_name'), question);
    /* The checker's own note is the single most useful line available: it turns
       a general question about locals into a specific one about this file. */
    check("AND WHAT THE CHECKER JUST SAID",
          question.includes('main.tf does not contain it yet'), question);
    /* Without this the model writes the answer out, the student pastes it, the
       task goes green and they have learned nothing. */
    check('IT ASKS FOR A NUDGE RATHER THAN THE ANSWER',
          /nudge/i.test(question) && !/give me the answer/i.test(question),
          question);
    /* The hint is one click away behind its own button already; putting it in
       the prompt asks a model to paraphrase something the student can read. */
    check('the hint is NOT sent - it is already a button',
          !question.includes('locals go in their own block'), question);
}

check('a task already passed asks WHY it works, not how to do it',
      /why it works|understand/i.test(
          taskQuestion(LAB_FOR_QUESTION as unknown as Lab,
                       { ...TASK, status: 'passed' }, 1, 4)));
/* `unavailable` is the third state, and a question that treated it as to-do
   would ask a student to satisfy a check the lab cannot run. */
check('a task the lab CANNOT CHECK says so instead of pretending',
      /cannot check/i.test(
          taskQuestion(LAB_FOR_QUESTION as unknown as Lab,
                       { ...TASK, status: 'unavailable' }, 1, 4)));
check('a self-marked task says nothing will confirm it',
      /mark this one myself/i.test(
          taskQuestion(LAB_FOR_QUESTION as unknown as Lab,
                       { ...TASK, manual: true }, 1, 4)));
check('no lab record at all still produces a usable question',
      taskQuestion(null, TASK).includes(TASK.title));
/* The lab's detail and the checker's note are both written as FRAGMENTS, and
   joining them with a space produced one run-on sentence - which a model
   resolves by ignoring half of it. */
check('a fragment is punctuated into a sentence',
      taskQuestion(LAB_FOR_QUESTION as unknown as Lab, TASK, 1, 4)
      .includes('does not contain it yet. What should'),
      taskQuestion(LAB_FOR_QUESTION as unknown as Lab, TASK, 1, 4));
check('and one that already ends in punctuation is not double-stopped',
      !/\.\./.test(taskQuestion(LAB_FOR_QUESTION as unknown as Lab,
                                { ...TASK, note: 'not run yet.' }, 1, 4)));
check('a task with no detail and no note does not leave dangling wording',
      !/: \s*$|undefined|null/.test(
          taskQuestion(null, { ...TASK, detail: '', note: '' })));

/* =====================================================================
   13. The wiring nothing else can see
   ===================================================================== */

section('13. The console and tutor wiring');

{
    const workspace = stripComments(source('src/views/LabWorkspace.vue'));
    /* THE REF WAS AN ARRAY. `LabTutor` sits inside two nested `v-for`s, and Vue
       collects a template ref inside a `v-for` into an array - so
       `tutor.value?.askAboutTask?.()` read a method off an array, found
       undefined, and the optional call swallowed it. That is the whole of
       "Ask the tutor does nothing". */
    check('THE TUTOR IS REACHED BY A FUNCTION REF, NOT ref="tutor"',
          /:ref="el => \{ if \(el\) tutor = el \}"/.test(workspace)
          && !/ref="tutor"/.test(workspace), 'tutor ref');
    /* Filled and not sent: a question the student can see is one they can
       correct before it costs a model call. */
    check('and it FILLS the question rather than sending it',
          /fillQuestion\?\.\(question\)/.test(workspace)
          && !/askAboutTask/.test(workspace), 'fill not send');
    check('the question comes from the checked module, not the call site',
          /taskQuestion\(lab\.value, task, position, tasks\.length\)/
          .test(workspace));
    check('the console is given a completion source and a save path',
          /:complete="completeIn"/.test(workspace)
          && /:save="writeFile"/.test(workspace));
    /* Any console can write a file now, so the file tree has to follow ALL of
       them - keyed on the tool kind rather than on two hardcoded ids. */
    check('a write from ANY console refreshes the file tree',
          /tool\.kind === 'console'/.test(workspace)
          && !/toolId === 'editor' \|\| toolId === 'terminal'/.test(workspace));
}

{
    const console_ = stripComments(source('src/components/labs/LabConsole.vue'));
    /* `clear` is a control signal, and it has to be read BEFORE anything is
       printed or `clear` leaves its own command line on screen. */
    check('clear empties the transcript rather than printing nothing',
          /result\?\.clear/.test(console_)
          && /lines\.value = \[\]/.test(console_));
    /* Asserted as the CALL, not as the two names: `openBuffer` is also its
       own declaration and `result?.editor` is also in the (no output)
       guard, so a check for either passed with the call commented out.
       `negative.py` found that, which is what it is for. */
    /* The status and the help are two different things. Falling back from one
       to the other printed the shortcuts twice, side by side. */
    check('the editor footer does not print its help line twice',
          !/editor\.status \|\| editorHelpLine/.test(console_));
    check('nano and vi open a buffer from the response',
          /if \(result\?\.editor\) openBuffer\(result\.editor\);/
          .test(console_), 'openBuffer call');
    /* Every one of these is claimed from the browser: Ctrl+W closes the tab and
       Ctrl+L focuses the address bar, so a handler that forgets
       preventDefault is worse than no handler at all. */
    check('EVERY CLAIMED KEY CALLS preventDefault',
          (console_.match(/event\.preventDefault\(\)/g) || []).length >= 12,
          (console_.match(/event\.preventDefault\(\)/g) || []).length);
    check('Tab, Ctrl+R and Ctrl+L are all handled',
          /key === 'Tab'/.test(console_)
          && /letter === 'r'/.test(console_)
          && /letter === 'l'/.test(console_));
    check('the decisions live in the checked module, not in branches here',
          /from '@\/utils\/labTerminal'/.test(console_));
    /* A transcript is command output, which includes an access-log line a
       stranger chose and a filename a student typed. */
    check('nothing in the console reaches v-html',
          !/v-html/.test(console_));
    /* A shell prompt that did not move after `cd` makes the one thing `cd`
       does invisible, and rewriting every PAST prompt would misreport where
       each command ran. */
    check('the prompt follows cd, and each past line keeps its own',
          /student@lab:\$\{cwd\.value\}/.test(console_)
          && /push\('cmd', line, prompt\.value\)/.test(console_));
}

{
    const tutor = stripComments(source('src/components/labs/LabTutor.vue'));
    check('the tutor exposes fillQuestion and nothing that sends for you',
          /defineExpose\(\{ fillQuestion \}\)/.test(tutor));
    /* A filled-in question is two or three lines. In a single-line input the
       student sees the last six words of a sentence they are being asked to
       check, which is worse than not showing it. */
    check('the box is a TEXTAREA, so a filled question is readable',
          /<textarea/.test(tutor) && !/class="sl-tutor__input"\s+type="text"/
          .test(tutor));
    check('the caret lands at the END, so the first keypress does not delete it',
          /setSelectionRange\(question\.value\.length, question\.value\.length\)/
          .test(tutor));
    check('Enter still sends and Shift+Enter still adds a line',
          /@keydown\.enter\.exact\.prevent="send"/.test(tutor));
    check('the tutor still reaches no v-html', !/v-html/.test(tutor));
}

{
    const service = source('src/services/labs.service.ts');
    /* Tab quietly doing nothing is a missing convenience; an error toast over a
       console because a completion could not be fetched is a bug in the way of
       the work. */
    check('the completion call never throws',
          /async completions\(/.test(service)
          && /catch \{\s*return empty;\s*\}/.test(service), 'completions');
}

/* ─────────────────── 14. the file explorer ─────────────────── */

section('14. The file explorer: the tree, the names and the moves');

{
    /*
     * `dirs` is the half the browser must NOT derive.
     *
     * The implied folders could be worked out from the file paths; an EMPTY one
     * is implied by nothing, and it is exactly the folder a student has just
     * made with New Folder and is waiting to see. So the backend sends both and
     * `buildTree` believes it.
     */
    const files: TreeFileEntry[] = [
        { path: 'main.tf', bytes: 120 },
        { path: 'src/app.py', bytes: 40 },
        { path: 'src/deep/keep.txt', bytes: 3 },
        { path: 'README.md', bytes: 900 },
    ];
    const dirs = ['empty', 'src', 'src/blank', 'src/deep'];

    const tree = buildTree(files, dirs);
    const top = tree.map(node => `${node.kind}:${node.name}`);
    check('folders sort before files, each alphabetically',
          top.join(' ') === 'folder:empty folder:src file:main.tf file:README.md',
          top);
    check('an EMPTY folder appears, which no file implies',
          tree.some(node => node.path === 'empty' && node.kind === 'folder'));

    const src = tree.find(node => node.path === 'src')!;
    check('a nested folder holds its own children',
          src.children.map(node => node.path).join(',')
          === 'src/blank,src/deep,src/app.py',
          src.children.map(node => node.path));

    /*
     * A TOTAL ORDER, and this is not tidiness: the rows are re-derived inside a
     * computed that re-evaluates on every keystroke in the filter box, so a
     * comparator that can call two nodes equal is a tree that visibly reorders
     * itself as somebody types — moving the row they are aiming at. Same trap
     * `sortLabs`, `examShuffle` and `sortScene` document.
     */
    const clash = [
        { path: 'b/x.py', name: 'x.py', kind: 'file' as const, bytes: 0, children: [] },
        { path: 'a/x.py', name: 'X.PY', kind: 'file' as const, bytes: 0, children: [] },
    ];
    const once = sortNodes(clash).map(node => node.path).join(',');
    const twice = sortNodes(sortNodes(clash).reverse()).map(node => node.path).join(',');
    check('two nodes whose names differ only in case still have ONE order',
          once === twice && once === 'a/x.py,b/x.py', [once, twice]);

    /* Only what is expanded is drawn, so a lab with a deep project opens
       readable rather than as forty rows. */
    const shut = flatten(tree, new Set()).map(row => row.path);
    check('a collapsed folder hides its children',
          !shut.includes('src/app.py') && shut.includes('src'), shut);
    const open = flatten(tree, new Set(['src'])).map(row => `${row.path}@${row.depth}`);
    check('an expanded folder draws its children one level in',
          open.includes('src/app.py@1') && open.includes('main.tf@0'), open);
    const shutRows = flatten(tree, new Set());
    const rowFor = (path: string) => shutRows.find(row => row.path === path);
    check('a chevron is drawn only for a folder with something in it',
          rowFor('empty')?.hasChildren === false
          && rowFor('src')?.hasChildren === true,
          [rowFor('empty'), rowFor('src')]);

    /* Filtering keeps the folders that lead to a hit, or the row is drawn at
       depth 0 with nothing saying which project it is in. */
    const hits = flatten(matchTree(tree, 'keep'), new Set(['src', 'src/deep']))
        .map(row => row.path);
    check('a filter keeps the folders that lead to the hit',
          hits.join(',') === 'src,src/deep,src/deep/keep.txt', hits);
    check('a folder whose OWN name matches keeps everything under it',
          flatten(matchTree(tree, 'src'), new Set(['src'])).length > 1);
    check('a filter that matches nothing is empty, not everything',
          matchTree(tree, 'zzz').length === 0);

    check('folderPaths lists every folder, including the empty ones',
          folderPaths(files, dirs).join(',') === 'empty,src,src/blank,src/deep',
          folderPaths(files, dirs));
    check('isFolder is true for a path only files imply',
          isFolder('src', files, []) && isFolder('src/deep', files, []));
    check('...and false for a file', !isFolder('main.tf', files, dirs));
    check('the root is always a folder — it is the drop target for "out of here"',
          isFolder('', files, dirs));
    check('filesUnder names what a folder delete is about to remove',
          filesUnder('src', files).join(',') === 'src/app.py,src/deep/keep.txt');
    check('exists sees both kinds',
          exists('main.tf', files, dirs) && exists('empty', files, dirs)
          && !exists('nope', files, dirs));
}

{
    /* A PATH IS NOT A NAME, and the two rules are deliberately different: a
       slash typed into Rename would move the file somewhere else without
       saying so, which is not the operation the student asked for. */
    check('a slash is refused in a NAME, and says so',
          nameProblem('a/b') === 'A name cannot contain a slash',
          nameProblem('a/b'));
    check('...and allowed in a PATH', pathProblem('src/main.tf') === null);
    check('a leading dot is legal — .gitignore is a file a lab ships',
          nameProblem('.gitignore') === null
          && pathProblem('.claude/settings.json') === null);
    check('".." is refused in both', nameProblem('..') !== null
          && pathProblem('../etc/passwd') !== null);
    check('a bare dot segment is refused', pathProblem('a/./b') !== null);
    check('an empty segment is refused', pathProblem('a//b') !== null);
    check('a leading slash is refused', pathProblem('/etc/passwd') !== null);
    check('a trailing slash is refused on a file name',
          pathProblem('src/') !== null);
    check('a backslash is refused', pathProblem('src\\main.tf') !== null);
    check('an empty name is refused, and says so',
          nameProblem('  ') !== null && pathProblem('') !== null);
    check('a space in the middle is refused, matching the backend',
          nameProblem('my file.txt') !== null);
    check('a very long path is refused before the round trip',
          pathProblem('a'.repeat(200)) !== null);
}

{
    const files: TreeFileEntry[] = [
        { path: 'main.tf', bytes: 1 },
        { path: 'src/app.py', bytes: 1 },
        { path: 'modules/net/main.tf', bytes: 1 },
    ];
    const dirs = ['empty', 'modules', 'modules/net', 'src'];

    /* THE ONE REFUSAL THAT IS NOT MERELY TIDY. Re-prefixing `modules` to
       `modules/net` rewrites every key to a path still under `modules`, so the
       loop's own output feeds it — the tree eats itself. Dragging a folder onto
       its own child is an ordinary mis-drop. */
    check('a folder cannot be dropped inside itself',
          planDrop('modules', 'modules/net', files, dirs).problem !== null);
    check('...nor onto its own row',
          planDrop('modules', 'modules', files, dirs).problem !== null
          || planDrop('modules', 'modules', files, dirs).noop);

    /* A DROP ON ITS OWN PARENT IS A NO-OP, NOT AN ERROR. It is the commonest
       mis-drop there is, and "src/app.py already exists" for it reads as the
       explorer being broken. */
    const same = planDrop('src/app.py', 'src', files, dirs);
    check('a drop on the row\'s own parent is a quiet no-op',
          same.noop === true && same.problem === null, same);
    const renamed = planRename('main.tf', 'main.tf', files, dirs);
    check('a rename to the name it already has is a quiet no-op',
          renamed.noop === true && renamed.problem === null, renamed);

    check('a drop onto an occupied path is refused BY NAME',
          (planDrop('src/app.py', 'modules/net', files, dirs).problem === null)
          && planDrop('main.tf', 'modules/net', files, dirs).problem !== null,
          planDrop('main.tf', 'modules/net', files, dirs));
    check('a legal drop answers the path it lands at',
          planDrop('main.tf', 'src', files, dirs).to === 'src/main.tf');
    check('the ROOT is a legal target — dragging out of a folder needs one',
          planDrop('src/app.py', '', files, dirs).to === 'app.py'
          && planDrop('src/app.py', '', files, dirs).problem === null);
    check('a rename lands in the same folder',
          planRename('src/app.py', 'main.py', files, dirs).to === 'src/main.py');
    check('a rename to an occupied name is refused',
          planRename('src/app.py', 'app.py', files, dirs).noop === true);
    check('an illegal new name is refused before anything is sent',
          planRename('main.tf', 'a b', files, dirs).problem !== null);
    check('a folder rename is a move like any other',
          planRename('modules', 'infra', files, dirs).to === 'infra'
          && planRename('modules', 'infra', files, dirs).problem === null);

    /* EXPANSION IS KEYED ON THE PATH, so a move has to carry it. Without this,
       renaming an open folder collapses it and everything under it — which
       reads as the rename having emptied the folder. */
    const carried = remapExpanded(['modules', 'modules/net', 'src'],
                                  'modules', 'infra');
    check('an expanded folder stays expanded through a rename',
          carried.has('infra') && carried.has('infra/net')
          && !carried.has('modules'), [...carried]);
    check('...and an unrelated folder is untouched', carried.has('src'));
    check('the destination\'s parents are opened, or a dropped file looks deleted',
          remapExpanded([], 'main.tf', 'modules/net/main.tf').has('modules/net'));
}

{
    check('basename and dirname agree about a nested path',
          basename('a/b/c.py') === 'c.py' && dirname('a/b/c.py') === 'a/b');
    check('...and about a top-level one',
          basename('c.py') === 'c.py' && dirname('c.py') === '');
    check('joinPath does not put a slash in front of a root-level name',
          joinPath('', 'c.py') === 'c.py' && joinPath('a', 'c.py') === 'a/c.py');
    check('ancestorsOf is what "reveal this file" opens',
          ancestorsOf('a/b/c.py').join(',') === 'a,a/b');
    check('a top-level file has no ancestors', ancestorsOf('c.py').length === 0);

    /* A LEADING DOT IS THE WHOLE NAME, not an extension: reading one gives
       every dotfile in the lab whatever icon `gitignore` maps to. */
    check('a dotfile has no extension', extensionOf('.gitignore') === '');
    check('an extension is lower-cased', extensionOf('Main.TF') === 'tf');

    /* Matched on the whole NAME first, because the files this is most often
       about have no extension at all. */
    check('Dockerfile gets an icon from its name, not its extension',
          iconFor('Dockerfile') === 'config'
          && iconFor('app/Dockerfile') === 'config');
    check('a .tf file gets the terraform icon', iconFor('main.tf') === 'terraform');
    check('an unknown extension falls back rather than throwing',
          iconFor('thing.qqq') === 'file');
    check('every icon name is one the component maps',
          ['file', 'code', 'markup', 'style', 'data', 'config', 'shell',
           'database', 'image', 'doc', 'lock', 'terraform']
              .includes(iconFor('a.py')));

    check('a byte count reads as an explorer prints it',
          humanBytes(12) === '12 B' && humanBytes(2048) === '2.0 KB'
          && humanBytes(3 * 1024 * 1024) === '3.0 MB',
          [humanBytes(12), humanBytes(2048), humanBytes(3 * 1024 * 1024)]);

    /* THE DELETE QUESTION NAMES THE COUNT. "delete src?" and "delete src and
       the 2 files in it?" are different questions, and only one of them is the
       one being asked. */
    const files: TreeFileEntry[] = [
        { path: 'src/app.py', bytes: 1 },
        { path: 'src/deep/keep.txt', bytes: 1 },
    ];
    check('deleting a folder asks about what is inside it',
          /2 file/.test(deleteQuestion('src', 'folder', files)),
          deleteQuestion('src', 'folder', files));
    check('deleting an empty folder does not claim a count',
          !/file\(s\)/.test(deleteQuestion('empty', 'folder', files)));
    check('deleting a file names the file',
          deleteQuestion('src/app.py', 'file', files) === 'Delete src/app.py?');
}

{
    const files = source('src/components/labs/LabFiles.vue');

    /* A DROP IS REFUSED WHILE HOVERING, not on release: a student who can drop
       something has been told the drop is allowed. */
    check('the hover handler asks planDrop before highlighting a target',
          /function hoverRow[\s\S]{0,320}planDrop\([\s\S]{0,200}dropTarget\.value = plan\.problem/
          .test(files));
    check('the root is a drop target too, so a file can be dragged OUT',
          /@drop\.prevent="dropOn\(''\)"/.test(files)
          && /function hoverRoot/.test(files));
    check('a row is draggable', /:draggable="renaming !== row\.path"/.test(files));
    /* A CHEVRON ON AN EMPTY FOLDER is a promise the row cannot keep, and reads
       as contents that failed to load. `hasChildren` was computed and never
       used, which is how that got past 913 assertions. */
    check('the chevron is drawn from hasChildren, not from the kind',
          /v-if="row\.hasChildren && !row\.expanded"/.test(files)
          && /v-else-if="row\.hasChildren"/.test(files));

    /* The console can write a file underneath us at any time — every console in
       a lab is a shell — and `refresh` runs after every command. Re-reading the
       open buffer there is the bug `refreshViews` on the workspace already had
       to be taught. */
    check('refresh does NOT re-read the open buffer',
          /if \(!files\.value\.some\(entry => entry\.path === path\.value\)\)/
          .test(files));
    check('a dirty buffer is never discarded silently',
          /if \(dirty\.value && !window\.confirm\(/.test(files));
    check('Ctrl+S saves, because this is an editor',
          /@keydown\.ctrl\.s\.prevent="save"/.test(files)
          && /@keydown\.meta\.s\.prevent="save"/.test(files));
    check('F2 renames and Delete deletes, from the row',
          /@keydown\.f2\.prevent="startRename\(row\)"/.test(files)
          && /@keydown\.delete\.prevent="confirmDelete\(row\)"/.test(files));

    /* A NEW FILE IS WRITTEN, not held in the browser: a file that exists only
       in this tab is one the console cannot see, and the first thing anybody
       does with a new `main.tf` is run something against it. */
    check('a new file is written to the backend immediately',
          /kind === 'folder'[\s\S]{0,700}await props\.write\(target, ''\)/
          .test(files));
    check('a folder delete passes recursive, which the backend requires',
          /const recursive = row\.kind === 'folder';[\s\S]{0,120}props\.remove\(row\.path, recursive\)/
          .test(files));
    check('the open buffer follows its own file through a move',
          /if \(path\.value === from\) path\.value = to;/.test(files));

    /* The menu is positioned in the PANE, not the document: `position: fixed`
       would put it above the sidebar in every galaxy and leave it behind when
       the pane scrolls. */
    /*
     * COMMENTS STRIPPED, in both directions.
     *
     * The rule below is that no `.is-depth-N` ladder exists - and the paragraph
     * in `labs.css` explaining why there is not one NAMES that class, so an
     * unstripped scan fails on its own documentation. A rule that fires on the
     * comment explaining it is a rule nobody can document; `check:aichat` and
     * `check:leaderboard` both had to learn this (working rule 44). Stripping
     * also takes the prose out of the distance the two `direction: ltr` rules
     * are measured over, which is what those windows are for.
     */
    const css = stripComments(source('src/assets/css/labs.css'));
    check('the context menu is absolute inside the pane',
          /\.sl-menu \{[^}]*position: absolute/.test(css));
    check('...and the pane is the containing block, WITHOUT a z-index',
          /\.sl-files \{ position: relative; \}/.test(css));
    check('the tree and the menu are pinned LTR — a path is an identifier',
          /\.sl-tree \{[\s\S]{0,600}direction: ltr;/.test(css)
          && /\.sl-menu \{[\s\S]{0,600}direction: ltr;/.test(css));
    check('the indent is a custom property, not a class per depth',
          /var\(--sl-depth, 0\)/.test(css) && !/is-depth-/.test(css));
    check('the tree track is minmax(0, ...), so a long path cannot widen it',
          /\.sl-files__body \{ grid-template-columns: minmax\(0, 16rem\) minmax\(0, 1fr\); \}/
          .test(css));
    check('the unsaved marker is a dot AND a title, never colour alone',
          /class="sl-files__dot" :title="\$t\('Unsaved changes'\)"/.test(files));

    /* Every string a reader sees goes through $t: this pane is one of the few
       screens with an Arabic and a Chinese reader and a machine identifier in
       the same row. */
    for (const label of ['Explorer', 'New File', 'New Folder', 'Collapse All',
                         'Rename', 'Delete', 'Duplicate', 'Cut', 'Paste here',
                         'Top level', 'Filter files']) {
        check(`"${label}" is translated`,
              files.includes(`$t('${label}')`), label);
    }
}

/* ─────────────────── report ─────────────────── */

console.log(`\n${passed} passed, ${failures.length} failed`);
for (const line of failures) console.log(`  FAIL  ${line}`);
if (failures.length) process.exit(1);
console.log('PASS');
