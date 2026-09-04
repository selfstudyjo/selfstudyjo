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
    const web = source('src/components/labs/LabWeb.vue');
    const attribute = web.match(/sandbox="([^"]*)"/);
    check('the web playground has a sandbox attribute', Boolean(attribute),
          attribute);
    check('IT DOES NOT CARRY allow-same-origin, which would undo the sandbox',
          Boolean(attribute) && !attribute![1].includes('allow-same-origin'),
          attribute?.[1]);
    check('it does allow scripts, or nothing runs',
          Boolean(attribute) && attribute![1].includes('allow-scripts'));
    check('the frame is srcdoc, not a blob URL that would inherit our origin',
          /:srcdoc="/.test(web) && !/URL\.createObjectURL/.test(web));
    check('and messages are filtered on our own marker',
          /payload\.sfsLab !== true/.test(web));
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

/* ─────────────────── report ─────────────────── */

console.log(`\n${passed} passed, ${failures.length} failed`);
for (const line of failures) console.log(`  FAIL  ${line}`);
if (failures.length) process.exit(1);
console.log('PASS');
