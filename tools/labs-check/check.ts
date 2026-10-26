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

import { readFileSync, readdirSync } from 'node:fs';
import { inflateRawSync } from 'node:zlib';
import { resolve } from 'node:path';

import {
    DIFFICULTY_LABELS,
    FAMILY_LABEL_KEYS,
    GRADE_REPORT_KEYS,
    GUIDE_KEYS,
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
    guiToolsFor,
    guideFor,
    keepVerified,
    portalTools,
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
import * as portal from '../../src/utils/portalKit';

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
    // Dumped from app 11 after a real CS471 Lab 7 run (sim:webdev view()).
    webdev: {
        "kind": "webdev",
        "venvs": [
            {
                "path": "/home/student/djangoenv",
                "name": "djangoenv",
                "active": true,
                "packages": [
                    "asgiref",
                    "django",
                    "pip",
                    "sqlparse"
                ],
                "django": true
            }
        ],
        "active_venv": "djangoenv",
        "django_installed": true,
        "project": {
            "root": "/home/student/DjangoProjects/libraryproject",
            "settings": "libraryproject.settings"
        },
        "server": {
            "running": true,
            "port": 8000
        },
        "settings": {
            "module": "libraryproject.settings",
            "debug": true,
            "installed_apps": [
                "django.contrib.admin",
                "django.contrib.auth",
                "django.contrib.contenttypes",
                "django.contrib.sessions",
                "django.contrib.messages",
                "django.contrib.staticfiles",
                "apps.bookmodule",
                "apps.usermodule"
            ],
            "root_urlconf": "libraryproject.urls"
        },
        "installed_apps": [
            "django.contrib.admin",
            "django.contrib.auth",
            "django.contrib.contenttypes",
            "django.contrib.sessions",
            "django.contrib.messages",
            "django.contrib.staticfiles",
            "apps.bookmodule",
            "apps.usermodule"
        ],
        "apps": [
            {
                "label": "bookmodule",
                "name": "apps.bookmodule",
                "path": "/home/student/DjangoProjects/libraryproject/apps/bookmodule"
            },
            {
                "label": "usermodule",
                "name": "apps.usermodule",
                "path": "/home/student/DjangoProjects/libraryproject/apps/usermodule"
            }
        ],
        "models": [
            {
                "app": "bookmodule",
                "name": "Book",
                "table": "bookmodule_book",
                "proxy": false,
                "fields": [
                    "id",
                    "title",
                    "author",
                    "price",
                    "edition"
                ],
                "field_types": {
                    "id": "BigAutoField",
                    "title": "CharField",
                    "author": "CharField",
                    "price": "FloatField",
                    "edition": "SmallIntegerField"
                }
            }
        ],
        "urls": [
            {
                "route": "admin/",
                "name": "index",
                "view": "django.contrib.admin.index"
            },
            {
                "route": "admin/login/",
                "name": "login",
                "view": "django.contrib.admin.login"
            },
            {
                "route": "admin/logout/",
                "name": "logout",
                "view": "django.contrib.admin.logout"
            },
            {
                "route": "admin/<str:app_label>/<str:model_name>/",
                "name": "changelist",
                "view": "django.contrib.admin.changelist"
            },
            {
                "route": "books/",
                "name": "books.index",
                "view": "apps.bookmodule.views.index"
            },
            {
                "route": "books/list_books/",
                "name": "books.list_books",
                "view": "apps.bookmodule.views.list_books"
            },
            {
                "route": "books/<int:bookId>/",
                "name": "books.view_one_book",
                "view": "apps.bookmodule.views.viewbook"
            },
            {
                "route": "books/aboutus/",
                "name": "books.aboutus",
                "view": "apps.bookmodule.views.aboutus"
            },
            {
                "route": "books/html5/links/",
                "name": "books.html5_links",
                "view": "apps.bookmodule.views.links_view"
            },
            {
                "route": "books/html5/text/formatting/",
                "name": "books.html5_formatting",
                "view": "apps.bookmodule.views.text_formatting_view"
            },
            {
                "route": "books/html5/listing/",
                "name": "books.html5_listing",
                "view": "apps.bookmodule.views.listing_view"
            },
            {
                "route": "books/html5/tables/",
                "name": "books.html5_tables",
                "view": "apps.bookmodule.views.tables_view"
            },
            {
                "route": "books/search/",
                "name": "books.search",
                "view": "apps.bookmodule.views.search_view"
            },
            {
                "route": "books/simple/query",
                "name": "books.simple_query",
                "view": "apps.bookmodule.views.simple_query"
            },
            {
                "route": "books/complex/query",
                "name": "books.complex_query",
                "view": "apps.bookmodule.views.complex_query"
            },
            {
                "route": "books/preferences/",
                "name": "books.preferences",
                "view": "apps.bookmodule.views.preferences"
            }
        ],
        "migrations": [
            {
                "app": "bookmodule",
                "name": "0001_initial",
                "applied": true
            },
            {
                "app": "bookmodule",
                "name": "0001_initial",
                "applied": true
            }
        ],
        "tables": [
            "auth_group",
            "auth_group_permissions",
            "auth_permission",
            "auth_user"
        ],
        "table_rows": [
            {
                "table": "bookmodule_book",
                "rows": 0
            }
        ],
        "file_visits": [],
        "builtin_migrations_applied": 18,
        "pages": [
            {
                "method": "GET",
                "path": "/books/simple/query",
                "status": 200,
                "title": "Search Results",
                "text": "Search Results Home List Books About Search Results No books",
                "url_name": "books.simple_query",
                "view": "apps.bookmodule.views.simple_query",
                "exception": "",
                "queries": 1,
                "form_fields": [],
                "at": "2026-10-13T20:49:24Z"
            }
        ],
        "server_log": [
            "[2026-10-13 20:49:24] \"GET /books/simple/query HTTP/1.1\" 200 1020"
        ],
        "validations": [],
        "opened": [],
        "superusers": [],
        "files_count": 57,
        "root": "/home/student/DjangoProjects/libraryproject",
        "initialised": true,
        "identity": true,
        "user": {
            "name": "Student",
            "email": "student@example.com"
        },
        "branch": "main",
        "remotes": [
            {
                "name": "origin",
                "url": "https://github.com/student/cs471-labs.git"
            }
        ],
        "upstream": {
            "main": "origin/main"
        },
        "commits": [
            {
                "sha": "7cf6095",
                "message": "Lab 6 - forms",
                "author": "Student",
                "at": "2026-10-13T20:49:15Z",
                "files": [
                    "apps/bookmodule/__init__.py",
                    "apps/bookmodule/admin.py",
                    "apps/bookmodule/apps.py",
                    "apps/bookmodule/models.py",
                    "apps/bookmodule/tests.py",
                    "apps/bookmodule/urls.py",
                    "apps/bookmodule/views.py",
                    "apps/static/book1.jpg",
                    "apps/static/book2.jpg",
                    "apps/static/book3.jpg",
                    "apps/static/desert.jpg",
                    "apps/static/main.css",
                    "apps/static/qu-icon.png",
                    "apps/static/styles.css",
                    "apps/templates/bookmodule/aboutus.html",
                    "apps/templates/bookmodule/bookList.html",
                    "apps/templates/bookmodule/index.html",
                    "apps/templates/bookmodule/links.html",
                    "apps/templates/bookmodule/list_books.html",
                    "apps/templates/bookmodule/listing.html",
                    "apps/templates/bookmodule/one_book.html",
                    "apps/templates/bookmodule/search.html",
                    "apps/templates/bookmodule/tables.html",
                    "apps/templates/bookmodule/text_formatting.html",
                    "apps/templates/includes/footer.html",
                    "apps/templates/includes/header.html",
                    "apps/templates/layouts/base.html",
                    "apps/usermodule/__init__.py",
                    "apps/usermodule/admin.py",
                    "apps/usermodule/apps.py",
                    "apps/usermodule/models.py",
                    "apps/usermodule/tests.py",
                    "apps/usermodule/urls.py",
                    "apps/usermodule/views.py",
                    "libraryproject/__init__.py",
                    "libraryproject/asgi.py",
                    "libraryproject/settings.py",
                    "libraryproject/urls.py",
                    "libraryproject/wsgi.py",
                    "manage.py"
                ]
            }
        ],
        "commit_count": 1,
        "tracked": [
            "apps/bookmodule/__init__.py",
            "apps/bookmodule/admin.py",
            "apps/bookmodule/apps.py",
            "apps/bookmodule/models.py",
            "apps/bookmodule/tests.py",
            "apps/bookmodule/urls.py",
            "apps/bookmodule/views.py",
            "apps/static/book1.jpg",
            "apps/static/book2.jpg",
            "apps/static/book3.jpg",
            "apps/static/desert.jpg",
            "apps/static/main.css",
            "apps/static/qu-icon.png",
            "apps/static/styles.css",
            "apps/templates/bookmodule/aboutus.html",
            "apps/templates/bookmodule/bookList.html",
            "apps/templates/bookmodule/index.html",
            "apps/templates/bookmodule/links.html",
            "apps/templates/bookmodule/list_books.html",
            "apps/templates/bookmodule/listing.html",
            "apps/templates/bookmodule/one_book.html",
            "apps/templates/bookmodule/search.html",
            "apps/templates/bookmodule/tables.html",
            "apps/templates/bookmodule/text_formatting.html",
            "apps/templates/includes/footer.html",
            "apps/templates/includes/header.html",
            "apps/templates/layouts/base.html",
            "apps/usermodule/__init__.py",
            "apps/usermodule/admin.py",
            "apps/usermodule/apps.py",
            "apps/usermodule/models.py",
            "apps/usermodule/tests.py",
            "apps/usermodule/urls.py",
            "apps/usermodule/views.py",
            "libraryproject/__init__.py",
            "libraryproject/asgi.py",
            "libraryproject/settings.py",
            "libraryproject/urls.py",
            "libraryproject/wsgi.py",
            "manage.py"
        ],
        "github": {
            "user": "student",
            "authed": true,
            "ssh_keys": [],
            "repos": [
                {
                    "name": "cs471-labs",
                    "visibility": "public",
                    "commits": 1,
                    "files": [
                        "apps/bookmodule/__init__.py",
                        "apps/bookmodule/admin.py",
                        "apps/bookmodule/apps.py",
                        "apps/bookmodule/models.py",
                        "apps/bookmodule/tests.py",
                        "apps/bookmodule/urls.py",
                        "apps/bookmodule/views.py",
                        "apps/static/book1.jpg",
                        "apps/static/book2.jpg",
                        "apps/static/book3.jpg",
                        "apps/static/desert.jpg",
                        "apps/static/main.css",
                        "apps/static/qu-icon.png",
                        "apps/static/styles.css",
                        "apps/templates/bookmodule/aboutus.html",
                        "apps/templates/bookmodule/bookList.html",
                        "apps/templates/bookmodule/index.html",
                        "apps/templates/bookmodule/links.html",
                        "apps/templates/bookmodule/list_books.html",
                        "apps/templates/bookmodule/listing.html",
                        "apps/templates/bookmodule/one_book.html",
                        "apps/templates/bookmodule/search.html",
                        "apps/templates/bookmodule/tables.html",
                        "apps/templates/bookmodule/text_formatting.html",
                        "apps/templates/includes/footer.html",
                        "apps/templates/includes/header.html",
                        "apps/templates/layouts/base.html",
                        "apps/usermodule/__init__.py",
                        "apps/usermodule/admin.py",
                        "apps/usermodule/apps.py",
                        "apps/usermodule/models.py",
                        "apps/usermodule/tests.py",
                        "apps/usermodule/urls.py",
                        "apps/usermodule/views.py",
                        "libraryproject/__init__.py",
                        "libraryproject/asgi.py",
                        "libraryproject/settings.py",
                        "libraryproject/urls.py",
                        "libraryproject/wsgi.py",
                        "manage.py"
                    ],
                    "default_branch": "main",
                    "pushed": true
                }
            ]
        },
        "stats": {
            "venv": "djangoenv",
            "django": "installed",
            "server": "running",
            "apps": 2,
            "urls": 16,
            "models": 1,
            "commits": 1,
            "pushed": 1
        },
        "ssh": {
            "agent": false,
            "loaded": [],
            "keys": []
        }
    },
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

/*
 * The four newest families' payloads, DUMPED FROM THE REAL ENGINES by
 * `dump_views.py` rather than hand-written.
 *
 * The rest of this table is hand-written from the backend's `view()`
 * functions, and for those families that is the point. These four are the
 * `_dump_fixture.py` precedent instead: they carry 70-odd panels between them
 * over payloads with 34, 15, 17 and 9 keys, and a hand-typed copy of that
 * would be wrong in one column somewhere and nobody would ever find out which.
 * A dump is faithful by construction.
 *
 * RE-DUMP IT DELIBERATELY when a backend `view()` changes - never from the
 * check itself, because a fixture regenerated by the thing it is checking
 * agrees with it by definition and the comparison becomes vacuous.
 */
const AZURE_PLATFORM: Record<string, any> = {
  "alerts": [
    {
      "action": "ag-platform",
      "condition": "avg Percentage CPU > 80",
      "frequency": "1m",
      "name": "cpu-high",
      "severity": 3,
      "status": "wired",
      "window": "5m"
    }
  ],
  "budgets": [
    {
      "action": "ops@selfstudy.jo",
      "amount": 2000.0,
      "name": "platform",
      "run_rate": 942,
      "status": "within",
      "thresholds": "80, 100",
      "used": "47%"
    }
  ],
  "compliance": [
    {
      "assignment": "audit-untagged",
      "effect": "Audit",
      "kind": "vnet",
      "reason": "no owner tag",
      "resource": "vnet-hub",
      "scope": "mg:platform",
      "status": "non-compliant"
    },
    {
      "assignment": "deploy-diagnostics",
      "effect": "DeployIfNotExists",
      "kind": "vnet",
      "reason": "no diagnostic setting",
      "resource": "vnet-hub",
      "scope": "mg:platform",
      "status": "non-compliant"
    },
    {
      "assignment": "audit-untagged",
      "effect": "Audit",
      "kind": "vnet",
      "reason": "no owner tag",
      "resource": "vnet-payments",
      "scope": "mg:platform",
      "status": "non-compliant"
    },
    {
      "assignment": "deploy-diagnostics",
      "effect": "DeployIfNotExists",
      "kind": "vnet",
      "reason": "no diagnostic setting",
      "resource": "vnet-payments",
      "scope": "mg:platform",
      "status": "non-compliant"
    },
    {
      "assignment": "audit-untagged",
      "effect": "Audit",
      "kind": "nsg",
      "reason": "no owner tag",
      "resource": "nsg-app",
      "scope": "mg:platform",
      "status": "non-compliant"
    },
    {
      "assignment": "deploy-diagnostics",
      "effect": "DeployIfNotExists",
      "kind": "nsg",
      "reason": "no diagnostic setting",
      "resource": "nsg-app",
      "scope": "mg:platform",
      "status": "non-compliant"
    },
    {
      "assignment": "audit-untagged",
      "effect": "Audit",
      "kind": "firewall",
      "reason": "no owner tag",
      "resource": "fw-hub",
      "scope": "mg:platform",
      "status": "non-compliant"
    },
    {
      "assignment": "deploy-diagnostics",
      "effect": "DeployIfNotExists",
      "kind": "firewall",
      "reason": "no diagnostic setting",
      "resource": "fw-hub",
      "scope": "mg:platform",
      "status": "non-compliant"
    },
    {
      "assignment": "audit-untagged",
      "effect": "Audit",
      "kind": "routetable",
      "reason": "no owner tag",
      "resource": "rt-payments",
      "scope": "mg:platform",
      "status": "non-compliant"
    },
    {
      "assignment": "deploy-diagnostics",
      "effect": "DeployIfNotExists",
      "kind": "routetable",
      "reason": "no diagnostic setting",
      "resource": "rt-payments",
      "scope": "mg:platform",
      "status": "non-compliant"
    },
    {
      "assignment": "audit-untagged",
      "effect": "Audit",
      "kind": "storage",
      "reason": "no owner tag",
      "resource": "paystore001",
      "scope": "mg:platform",
      "status": "non-compliant"
    },
    {
      "assignment": "deploy-diagnostics",
      "effect": "DeployIfNotExists",
      "kind": "storage",
      "reason": "no diagnostic setting",
      "resource": "paystore001",
      "scope": "mg:platform",
      "status": "non-compliant"
    },
    {
      "assignment": "audit-untagged",
      "effect": "Audit",
      "kind": "privateendpoint",
      "reason": "no owner tag",
      "resource": "pe-paystore",
      "scope": "mg:platform",
      "status": "non-compliant"
    },
    {
      "assignment": "deploy-diagnostics",
      "effect": "DeployIfNotExists",
      "kind": "privateendpoint",
      "reason": "no diagnostic setting",
      "resource": "pe-paystore",
      "scope": "mg:platform",
      "status": "non-compliant"
    },
    {
      "assignment": "audit-untagged",
      "effect": "Audit",
      "kind": "privatednszone",
      "reason": "no owner tag",
      "resource": "privatelink.blob.core.windows.net",
      "scope": "mg:platform",
      "status": "non-compliant"
    },
    {
      "assignment": "deploy-diagnostics",
      "effect": "DeployIfNotExists",
      "kind": "privatednszone",
      "reason": "no diagnostic setting",
      "resource": "privatelink.blob.core.windows.net",
      "scope": "mg:platform",
      "status": "non-compliant"
    },
    {
      "assignment": "audit-untagged",
      "effect": "Audit",
      "kind": "identity",
      "reason": "no owner tag",
      "resource": "mi-pipeline",
      "scope": "mg:platform",
      "status": "non-compliant"
    },
    {
      "assignment": "deploy-diagnostics",
      "effect": "DeployIfNotExists",
      "kind": "identity",
      "reason": "no diagnostic setting",
      "resource": "mi-pipeline",
      "scope": "mg:platform",
      "status": "non-compliant"
    },
    {
      "assignment": "audit-untagged",
      "effect": "Audit",
      "kind": "workspace",
      "reason": "no owner tag",
      "resource": "law-platform",
      "scope": "mg:platform",
      "status": "non-compliant"
    },
    {
      "assignment": "deploy-diagnostics",
      "effect": "DeployIfNotExists",
      "kind": "workspace",
      "reason": "no diagnostic setting",
      "resource": "law-platform",
      "scope": "mg:platform",
      "status": "non-compliant"
    },
    {
      "assignment": "audit-untagged",
      "effect": "Audit",
      "kind": "group",
      "reason": "no owner tag",
      "resource": "rg-dev",
      "scope": "mg:platform",
      "status": "non-compliant"
    },
    {
      "assignment": "deploy-diagnostics",
      "effect": "DeployIfNotExists",
      "kind": "group",
      "reason": "no diagnostic setting",
      "resource": "rg-dev",
      "scope": "mg:platform",
      "status": "non-compliant"
    }
  ],
  "cost": [
    {
      "group": "rg-hub",
      "kind": "firewall",
      "monthly": 912,
      "owner": "",
      "resource": "fw-hub",
      "share": "97%",
      "sku": "Standard",
      "status": "untagged"
    },
    {
      "group": "rg-payments",
      "kind": "storage",
      "monthly": 21,
      "owner": "",
      "resource": "paystore001",
      "share": "2%",
      "sku": "Standard_LRS",
      "status": "untagged"
    },
    {
      "group": "rg-payments",
      "kind": "privateendpoint",
      "monthly": 8,
      "owner": "",
      "resource": "pe-paystore",
      "share": "1%",
      "sku": "",
      "status": "untagged"
    },
    {
      "group": "rg-hub",
      "kind": "privatednszone",
      "monthly": 1,
      "owner": "",
      "resource": "privatelink.blob.core.windows.net",
      "share": "0%",
      "sku": "",
      "status": "untagged"
    }
  ],
  "deployments": [
    {
      "created": 1,
      "group": "",
      "name": "main",
      "scope": "subscription",
      "status": "Succeeded",
      "template": "main.bicep",
      "updated": 0
    }
  ],
  "diagnostics": [
    {
      "by": "",
      "kind": "vnet",
      "resource": "vnet-hub",
      "status": "SILENT",
      "workspace": ""
    },
    {
      "by": "",
      "kind": "vnet",
      "resource": "vnet-payments",
      "status": "SILENT",
      "workspace": ""
    },
    {
      "by": "",
      "kind": "nsg",
      "resource": "nsg-app",
      "status": "SILENT",
      "workspace": ""
    },
    {
      "by": "",
      "kind": "firewall",
      "resource": "fw-hub",
      "status": "SILENT",
      "workspace": ""
    },
    {
      "by": "",
      "kind": "routetable",
      "resource": "rt-payments",
      "status": "SILENT",
      "workspace": ""
    },
    {
      "by": "operator",
      "kind": "storage",
      "resource": "paystore001",
      "status": "collecting",
      "workspace": "law-platform"
    },
    {
      "by": "",
      "kind": "privateendpoint",
      "resource": "pe-paystore",
      "status": "SILENT",
      "workspace": ""
    },
    {
      "by": "",
      "kind": "privatednszone",
      "resource": "privatelink.blob.core.windows.net",
      "status": "SILENT",
      "workspace": ""
    },
    {
      "by": "",
      "kind": "identity",
      "resource": "mi-pipeline",
      "status": "SILENT",
      "workspace": ""
    },
    {
      "by": "",
      "kind": "workspace",
      "resource": "law-platform",
      "status": "SILENT",
      "workspace": ""
    }
  ],
  "dns_zones": [
    {
      "group": "rg-hub",
      "links": "vnet-payments",
      "name": "privatelink.blob.core.windows.net",
      "records": 1,
      "status": "linked"
    }
  ],
  "firewall_rules": [
    {
      "action": "Allow",
      "collection": "base",
      "firewall": "fw-hub",
      "kind": "network",
      "name": "allow-dns",
      "ports": "53",
      "protocol": "UDP",
      "source": "10.1.0.0/16",
      "status": "allow",
      "target": "10.0.0.0/8"
    },
    {
      "action": "Allow",
      "collection": "web",
      "firewall": "fw-hub",
      "kind": "application",
      "name": "allow-updates",
      "ports": "80,443",
      "protocol": "http/https",
      "source": "10.1.0.0/16",
      "status": "allow",
      "target": "*.ubuntu.com"
    }
  ],
  "firewalls": [
    {
      "application_rules": 1,
      "name": "fw-hub",
      "network_rules": 1,
      "private_ip": "10.0.0.4",
      "sku": "Standard",
      "status": "running",
      "threat_intel": "Alert",
      "vnet": "vnet-hub"
    }
  ],
  "groups": [
    {
      "id": "/subscriptions/00000000-1111-2222-3333-444444444444/resourceGroups/rg-hub",
      "location": "uaenorth",
      "name": "rg-hub",
      "resources": 5,
      "state": "Succeeded"
    },
    {
      "id": "/subscriptions/00000000-1111-2222-3333-444444444444/resourceGroups/rg-payments",
      "location": "uaenorth",
      "name": "rg-payments",
      "resources": 5,
      "state": "Succeeded"
    },
    {
      "id": "/subscriptions/00000000-1111-2222-3333-444444444444/resourceGroups/rg-dev",
      "location": "uaenorth",
      "name": "rg-dev",
      "resources": 0,
      "state": "Succeeded"
    }
  ],
  "hierarchy": [
    {
      "depth": 1,
      "display": "Tenant Root Group",
      "name": "tenant-root",
      "parent": "",
      "policies": 0,
      "status": "root",
      "subscriptions": 0
    },
    {
      "depth": 2,
      "display": "platform",
      "name": "  platform",
      "parent": "tenant-root",
      "policies": 2,
      "status": "group",
      "subscriptions": 1
    },
    {
      "depth": 3,
      "display": "00000000-1111",
      "name": "    sub-platform-prod",
      "parent": "platform",
      "policies": "",
      "status": "Enabled",
      "subscriptions": ""
    }
  ],
  "kind": "azure",
  "location": "uaenorth",
  "locations": [
    "uaenorth",
    "westeurope",
    "northeurope",
    "eastus",
    "eastus2",
    "uksouth",
    "southeastasia",
    "qatarcentral"
  ],
  "nsg_rules": [
    {
      "access": "Allow",
      "destination": "10.1.1.0/24",
      "direction": "Inbound",
      "name": "allow-https",
      "nsg": "nsg-app",
      "ports": "443",
      "priority": 200,
      "protocol": "Tcp",
      "source": "10.0.0.0/16",
      "status": "allow"
    }
  ],
  "path_tests": [
    {
      "destination": "paystore001.blob.core.windows.net",
      "detail": "reachable",
      "hops": 6,
      "port": 443,
      "protocol": "Tcp",
      "source": "vnet-payments/snet-app",
      "status": "reachable"
    }
  ],
  "peerings": [
    {
      "forwarded": true,
      "gateway_transit": true,
      "name": "hub-to-payments",
      "remote": "vnet-payments",
      "remote_gateways": false,
      "state": "Connected",
      "status": "Connected",
      "vnet": "vnet-hub"
    },
    {
      "forwarded": false,
      "gateway_transit": false,
      "name": "payments-to-hub",
      "remote": "vnet-hub",
      "remote_gateways": true,
      "state": "Connected",
      "status": "Connected",
      "vnet": "vnet-payments"
    }
  ],
  "platform": {
    "connected_peerings": 2,
    "dns_zones": 1,
    "firewalls": 1,
    "management_groups": 2,
    "monthly_cost": 942,
    "path_tests": 1,
    "peerings": 2,
    "policy_assignments": 2,
    "private_endpoints": 1,
    "role_assignments": 1,
    "subnets": 3,
    "subscriptions": 1,
    "vnets": 2,
    "workspaces": 1
  },
  "policy_assignments": [
    {
      "compliance": "0%",
      "definition": "audit-untagged",
      "display": "Resources should carry an owner tag",
      "effect": "Audit",
      "evaluated": 11,
      "identity": false,
      "name": "audit-untagged",
      "non_compliant": 11,
      "scope": "mg:platform",
      "status": "non-compliant"
    },
    {
      "compliance": "0%",
      "definition": "deploy-diagnostics",
      "display": "Deploy diagnostic settings to Log Analytics",
      "effect": "DeployIfNotExists",
      "evaluated": 11,
      "identity": true,
      "name": "deploy-diagnostics",
      "non_compliant": 11,
      "scope": "mg:platform",
      "status": "non-compliant"
    }
  ],
  "principals": [
    {
      "assignments": 0,
      "id": "g-f662915a",
      "kind": "Group",
      "name": "platform-engineers",
      "status": "Group"
    },
    {
      "assignments": 0,
      "id": "g-6716371b",
      "kind": "Group",
      "name": "app-team-payments",
      "status": "Group"
    },
    {
      "assignments": 0,
      "id": "g-d500689c",
      "kind": "Group",
      "name": "cloud-ops",
      "status": "Group"
    },
    {
      "assignments": 0,
      "id": "s-c3885bbd",
      "kind": "ServicePrincipal",
      "name": "sp-platform-pipeline",
      "status": "ServicePrincipal"
    },
    {
      "assignments": 1,
      "id": "mi-42161154",
      "kind": "ManagedIdentity",
      "name": "mi-pipeline",
      "status": "ManagedIdentity"
    }
  ],
  "private_endpoints": [
    {
      "connection": "Approved",
      "fqdn": "paystore001.blob.core.windows.net",
      "group_id": "storage-blob",
      "ip": "10.1.2.5",
      "name": "pe-paystore",
      "status": "private",
      "subnet": "snet-pe",
      "target": "paystore001",
      "vnet": "vnet-payments",
      "zone": "privatelink.blob.core.windows.net",
      "zone_linked": true
    }
  ],
  "queries": [
    {
      "at": "2026-09-12T22:22:48Z",
      "query": "AzureActivity | count",
      "rows": 1,
      "status": "ran"
    }
  ],
  "resources": [
    {
      "detail": "10.0.0.0/16 subnets AzureFirewallSubnet",
      "group": "rg-hub",
      "id": "/subscriptions/00000000-1111-2222-3333-444444444444/resourceGroups/rg-hub/providers/Microsoft.Network/virtualNetworks/vnet-hub",
      "kind": "vnet",
      "location": "uaenorth",
      "name": "vnet-hub",
      "state": "Succeeded",
      "type": "Microsoft.Network/virtualNetworks"
    },
    {
      "detail": "10.1.0.0/16 subnets snet-app, snet-pe",
      "group": "rg-payments",
      "id": "/subscriptions/00000000-1111-2222-3333-444444444444/resourceGroups/rg-payments/providers/Microsoft.Network/virtualNetworks/vnet-payments",
      "kind": "vnet",
      "location": "uaenorth",
      "name": "vnet-payments",
      "state": "Succeeded",
      "type": "Microsoft.Network/virtualNetworks"
    },
    {
      "detail": "1 rule(s)",
      "group": "rg-payments",
      "id": "/subscriptions/00000000-1111-2222-3333-444444444444/resourceGroups/rg-payments/providers/Microsoft.Network/networkSecurityGroups/nsg-app",
      "kind": "nsg",
      "location": "uaenorth",
      "name": "nsg-app",
      "state": "Succeeded",
      "type": "Microsoft.Network/networkSecurityGroups"
    },
    {
      "detail": "",
      "group": "rg-hub",
      "id": "/subscriptions/00000000-1111-2222-3333-444444444444/resourceGroups/rg-hub/providers/Microsoft.Network/azureFirewalls/fw-hub",
      "kind": "firewall",
      "location": "uaenorth",
      "name": "fw-hub",
      "state": "Succeeded",
      "type": "Microsoft.Network/azureFirewalls"
    },
    {
      "detail": "",
      "group": "rg-payments",
      "id": "/subscriptions/00000000-1111-2222-3333-444444444444/resourceGroups/rg-payments/providers/Microsoft.Network/routeTables/rt-payments",
      "kind": "routetable",
      "location": "uaenorth",
      "name": "rt-payments",
      "state": "Succeeded",
      "type": "Microsoft.Network/routeTables"
    },
    {
      "detail": "Standard_LRS StorageV2",
      "group": "rg-payments",
      "id": "/subscriptions/00000000-1111-2222-3333-444444444444/resourceGroups/rg-payments/providers/Microsoft.Storage/storageAccounts/paystore001",
      "kind": "storage",
      "location": "uaenorth",
      "name": "paystore001",
      "state": "Succeeded",
      "type": "Microsoft.Storage/storageAccounts"
    },
    {
      "detail": "",
      "group": "rg-payments",
      "id": "/subscriptions/00000000-1111-2222-3333-444444444444/resourceGroups/rg-payments/providers/Microsoft.Network/privateEndpoints/pe-paystore",
      "kind": "privateendpoint",
      "location": "uaenorth",
      "name": "pe-paystore",
      "state": "Succeeded",
      "type": "Microsoft.Network/privateEndpoints"
    },
    {
      "detail": "",
      "group": "rg-hub",
      "id": "/subscriptions/00000000-1111-2222-3333-444444444444/resourceGroups/rg-hub/providers/Microsoft.Network/privateDnsZones/privatelink.blob.core.windows.net",
      "kind": "privatednszone",
      "location": "global",
      "name": "privatelink.blob.core.windows.net",
      "state": "Succeeded",
      "type": "Microsoft.Network/privateDnsZones"
    },
    {
      "detail": "",
      "group": "rg-hub",
      "id": "/subscriptions/00000000-1111-2222-3333-444444444444/resourceGroups/rg-hub/providers/Microsoft.ManagedIdentity/userAssignedIdentities/mi-pipeline",
      "kind": "identity",
      "location": "uaenorth",
      "name": "mi-pipeline",
      "state": "Succeeded",
      "type": "Microsoft.ManagedIdentity/userAssignedIdentities"
    },
    {
      "detail": "",
      "group": "rg-hub",
      "id": "/subscriptions/00000000-1111-2222-3333-444444444444/resourceGroups/rg-hub/providers/Microsoft.OperationalInsights/workspaces/law-platform",
      "kind": "workspace",
      "location": "uaenorth",
      "name": "law-platform",
      "state": "Succeeded",
      "type": "Microsoft.OperationalInsights/workspaces"
    }
  ],
  "role_assignments": [
    {
      "kind": "ManagedIdentity",
      "note": "The network, and nothing else.",
      "principal": "mi-pipeline",
      "role": "Network Contributor",
      "scope": "mg:platform",
      "status": "scoped"
    }
  ],
  "routes": [
    {
      "attached": "vnet-payments/snet-app",
      "name": "default",
      "next_hop": "VirtualAppliance",
      "next_hop_ip": "10.0.0.4",
      "prefix": "0.0.0.0/0",
      "status": "VirtualAppliance",
      "table": "rt-payments"
    }
  ],
  "stats": {
    "groups": 3,
    "resources": 10,
    "running": 0,
    "storage": 1,
    "vms": 0,
    "webapps": 0
  },
  "storage": {
    "accounts": [
      {
        "account_kind": "StorageV2",
        "containers": 0,
        "endpoint": "https://paystore001.blob.core.windows.net/",
        "group": "rg-payments",
        "name": "paystore001",
        "sku": "Standard_LRS"
      }
    ],
    "blobs": [],
    "containers": []
  },
  "subnets": [
    {
      "delegation": "",
      "endpoints": "Microsoft.Storage",
      "name": "snet-app",
      "nsg": "nsg-app",
      "prefix": "10.1.1.0/24",
      "route_table": "rt-payments",
      "status": "governed",
      "vnet": "vnet-payments"
    },
    {
      "delegation": "",
      "endpoints": "",
      "name": "snet-pe",
      "nsg": "",
      "prefix": "10.1.2.0/24",
      "route_table": "",
      "status": "no nsg",
      "vnet": "vnet-payments"
    },
    {
      "delegation": "",
      "endpoints": "",
      "name": "AzureFirewallSubnet",
      "nsg": "",
      "prefix": "10.0.0.0/26",
      "route_table": "",
      "status": "no nsg",
      "vnet": "vnet-hub"
    }
  ],
  "subscription": "00000000-1111-2222-3333-444444444444",
  "subscription_name": "Self Study Lab",
  "tenant": "55555555-6666-7777-8888-999999999999",
  "vnets": [
    {
      "cidr": "10.1.0.0/16",
      "dns": "Azure",
      "group": "rg-payments",
      "location": "uaenorth",
      "name": "vnet-payments",
      "peers": "vnet-hub",
      "status": "peered",
      "subnets": 2
    },
    {
      "cidr": "10.0.0.0/16",
      "dns": "Azure",
      "group": "rg-hub",
      "location": "uaenorth",
      "name": "vnet-hub",
      "peers": "vnet-payments",
      "status": "peered",
      "subnets": 1
    }
  ],
  "whatif": [
    {
      "change": "Modify",
      "detail": "tags.owner: (none) -> platform",
      "file": "main.bicep",
      "name": "rg-dev",
      "status": "modify",
      "type": "Microsoft.Resources/resourceGroups"
    }
  ],
  "workspaces": [
    {
      "group": "rg-hub",
      "name": "law-platform",
      "retention": 90,
      "sku": "PerGB2018",
      "status": "collecting",
      "tables": 4
    }
  ]
};

Object.assign(VIEWS.azure, AZURE_PLATFORM);

VIEWS.mlops = {
  "abtests": [
    {
      "ci": "[+0.142%, +2.603%]",
      "control": "mastery",
      "days": 17,
      "id": "AB-1",
      "lift": "+7.70%",
      "mde": "2.0%",
      "metric": "conversion",
      "n_a": 7650,
      "n_b": 7650,
      "needed": 5915,
      "p_value": 0.02886,
      "rate_a": "17.830%",
      "rate_b": "19.203%",
      "reported": "under-powered, ship",
      "status": "ship",
      "variant": "mastery-v2"
    }
  ],
  "curves": [
    {
      "epoch": 1,
      "run": "9f093301",
      "status": "ok",
      "train_loss": 0.956,
      "val_loss": 0.988,
      "val_metric": 0.5544
    },
    {
      "epoch": 2,
      "run": "9f093301",
      "status": "ok",
      "train_loss": 0.7383,
      "val_loss": 0.79,
      "val_metric": 0.6376
    },
    {
      "epoch": 3,
      "run": "9f093301",
      "status": "ok",
      "train_loss": 0.6058,
      "val_loss": 0.6792,
      "val_metric": 0.6841
    },
    {
      "epoch": 4,
      "run": "9f093301",
      "status": "ok",
      "train_loss": 0.5153,
      "val_loss": 0.5897,
      "val_metric": 0.7217
    },
    {
      "epoch": 5,
      "run": "9f093301",
      "status": "ok",
      "train_loss": 0.4564,
      "val_loss": 0.5476,
      "val_metric": 0.7394
    },
    {
      "epoch": 6,
      "run": "9f093301",
      "status": "ok",
      "train_loss": 0.4194,
      "val_loss": 0.4946,
      "val_metric": 0.7617
    },
    {
      "epoch": 7,
      "run": "9f093301",
      "status": "ok",
      "train_loss": 0.3803,
      "val_loss": 0.4635,
      "val_metric": 0.7747
    },
    {
      "epoch": 8,
      "run": "9f093301",
      "status": "ok",
      "train_loss": 0.3577,
      "val_loss": 0.4363,
      "val_metric": 0.7862
    }
  ],
  "datasets": [
    {
      "columns": 8,
      "features": "skill_id, item_id, response_ms, hint_used",
      "group": "student_id",
      "leaks": "",
      "method": "time",
      "name": "student-responses",
      "positive_rate": "62.0%",
      "rows": 48000,
      "status": "split",
      "target": "correct",
      "test": 7200,
      "tracked": true,
      "train": 33600,
      "val": 7200,
      "version": "9be1d25e"
    }
  ],
  "evals": [
    {
      "accuracy": 0.7702,
      "balanced": 0.7695,
      "f1": 0.8065,
      "fn": 677,
      "fp": 426,
      "id": "EVAL-1",
      "model": "mastery",
      "precision": 0.8437,
      "recall": 0.7725,
      "rows": 4800,
      "suite": "holdout",
      "threshold": 0.5,
      "tn": 1398,
      "tp": 2299
    },
    {
      "accuracy": 0.7777,
      "balanced": 0.7777,
      "f1": 0.8127,
      "fn": 661,
      "fp": 406,
      "id": "EVAL-2",
      "model": "mastery",
      "precision": 0.8508,
      "recall": 0.7779,
      "rows": 4800,
      "suite": "slices",
      "threshold": 0.5,
      "tn": 1418,
      "tp": 2315
    }
  ],
  "exports": [
    {
      "base": "distilbert-base-uncased",
      "created": "2026-09-12T22:22:48Z",
      "dynamic_axes": [
        "batch_size",
        "sequence"
      ],
      "format": "onnx",
      "model": "mastery",
      "opset": 17,
      "size_mb": 125,
      "status": "onnx"
    }
  ],
  "models": [
    {
      "context": 131072,
      "hidden": 8192,
      "kind": "decoder",
      "layers": 80,
      "local": false,
      "name": "Llama-3.1-70B-Instruct",
      "params": "70B"
    },
    {
      "context": 131072,
      "hidden": 4096,
      "kind": "decoder",
      "layers": 32,
      "local": false,
      "name": "Llama-3.1-8B-Instruct",
      "params": "8B"
    },
    {
      "context": 32768,
      "hidden": 4096,
      "kind": "decoder",
      "layers": 32,
      "local": false,
      "name": "Mistral-7B-Instruct-v0.3",
      "params": "7.2B"
    },
    {
      "context": 32768,
      "hidden": 1536,
      "kind": "decoder",
      "layers": 28,
      "local": false,
      "name": "Qwen2.5-1.5B-Instruct",
      "params": "1.5B"
    },
    {
      "context": 512,
      "hidden": 768,
      "kind": "encoder",
      "layers": 12,
      "local": false,
      "name": "bert-base-uncased",
      "params": "0.11B"
    },
    {
      "context": 512,
      "hidden": 768,
      "kind": "encoder",
      "layers": 6,
      "local": true,
      "name": "distilbert-base-uncased",
      "params": "0.066B"
    },
    {
      "context": 512,
      "hidden": 768,
      "kind": "encoder",
      "layers": 12,
      "local": false,
      "name": "roberta-base",
      "params": "0.125B"
    },
    {
      "context": 256,
      "hidden": 384,
      "kind": "embedding",
      "layers": 6,
      "local": false,
      "name": "sentence-transformers/all-MiniLM-L6-v2",
      "params": "0.022B"
    }
  ],
  "monitors": [
    {
      "baseline": 0.7862,
      "current": 0.6212,
      "feature": "response_ms",
      "model": "mastery",
      "psi": 1.0611,
      "status": "critical",
      "verdict": "significant drift",
      "window": "7d"
    }
  ],
  "pipeline": [
    {
      "cmd": "mlx data split --dataset student-responses --group-by student_id",
      "deps": "data/student-responses.csv",
      "outs": "data/splits",
      "runs": 1,
      "stage": "prepare",
      "status": "done"
    }
  ],
  "recsys": [
    {
      "catalogue_coverage": 0.58,
      "cold_start": "popularity fallback",
      "items": 120,
      "k": 10,
      "method": "mf",
      "ndcg_at_k": 0.5799,
      "precision_at_k": 0.302,
      "recall_at_k": 0.6208,
      "status": "ok",
      "users": 200
    }
  ],
  "registry": [
    {
      "base": "distilbert-base-uncased",
      "format": "pytorch",
      "name": "mastery",
      "run": "9f0933012b",
      "size_mb": 125,
      "stage": "Production",
      "status": "Production",
      "val_metric": 0.7862,
      "version": 1
    }
  ],
  "runs": [
    {
      "best_epoch": 8,
      "dataset": "student-responses",
      "epochs": 8,
      "experiment": "tutoring",
      "id": "9f0933012bb5",
      "leak": 0,
      "memory_gb": 2.43,
      "method": "full",
      "model": "distilbert-base-uncased",
      "status": "FINISHED",
      "val_loss": 0.4363,
      "val_metric": 0.7862
    }
  ],
  "serving": [
    {
      "base": "Mistral-7B-Instruct-v0.3",
      "batch": 16,
      "dtype": "int8",
      "kv_gb": 16.0,
      "max_len": 8192,
      "name": "Mistral-7B-Instruct-v0.3",
      "p50_ms": 176.4,
      "p95_ms": 299.8,
      "replicas": 1,
      "requests_per_s": 106.6,
      "runtime": "vllm",
      "status": "running",
      "tokens_per_s": 2279.8,
      "total_gb": 22.71,
      "weights_gb": 6.71
    }
  ],
  "slices": [
    {
      "accuracy": 0.7493,
      "f1": 0.7867,
      "model": "mastery",
      "precision": 0.831,
      "recall": 0.7468,
      "rows": 766,
      "slice": "plan=free",
      "status": "ok"
    },
    {
      "accuracy": 0.7677,
      "f1": 0.8043,
      "model": "mastery",
      "precision": 0.8409,
      "recall": 0.7708,
      "rows": 1085,
      "slice": "plan=paid",
      "status": "ok"
    },
    {
      "accuracy": 0.7752,
      "f1": 0.8102,
      "model": "mastery",
      "precision": 0.8462,
      "recall": 0.7772,
      "rows": 298,
      "slice": "locale=en",
      "status": "ok"
    },
    {
      "accuracy": 0.6345,
      "f1": 0.6817,
      "model": "mastery",
      "precision": 0.7391,
      "recall": 0.6326,
      "rows": 695,
      "slice": "locale=ar",
      "status": "weak"
    },
    {
      "accuracy": 0.6231,
      "f1": 0.6706,
      "model": "mastery",
      "precision": 0.7306,
      "recall": 0.6198,
      "rows": 735,
      "slice": "locale=zh",
      "status": "weak"
    },
    {
      "accuracy": 0.769,
      "f1": 0.805,
      "model": "mastery",
      "precision": 0.8435,
      "recall": 0.7698,
      "rows": 407,
      "slice": "device=mobile",
      "status": "ok"
    },
    {
      "accuracy": 0.7761,
      "f1": 0.8117,
      "model": "mastery",
      "precision": 0.8472,
      "recall": 0.7791,
      "rows": 402,
      "slice": "device=desktop",
      "status": "ok"
    }
  ],
  "stats": {
    "abtests": 1,
    "datasets": 1,
    "evals": 2,
    "experiments": 1,
    "gpu": "A100-40",
    "gpu_memory_gb": 40,
    "gpu_used_gb": 22.71,
    "gpu_util": 76,
    "monitors": 1,
    "pipeline_stages": 1,
    "registered": 1,
    "runs": 1,
    "serving": 1
  },
  "traces": [
    {
      "answer": "wrong",
      "mastery": 0.184,
      "n": 1,
      "posterior": 0.04,
      "predicted": 0.375,
      "prior": 0.25,
      "trace": "TRACE-1"
    },
    {
      "answer": "right",
      "mastery": 0.5781,
      "n": 2,
      "posterior": 0.5036,
      "predicted": 0.3288,
      "prior": 0.184,
      "trace": "TRACE-1"
    },
    {
      "answer": "right",
      "mastery": 0.8814,
      "n": 3,
      "posterior": 0.8605,
      "predicted": 0.6047,
      "prior": 0.5781,
      "trace": "TRACE-1"
    },
    {
      "answer": "wrong",
      "mastery": 0.5593,
      "n": 4,
      "posterior": 0.4816,
      "predicted": 0.817,
      "prior": 0.8814,
      "trace": "TRACE-1"
    },
    {
      "answer": "right",
      "mastery": 0.8734,
      "n": 5,
      "posterior": 0.851,
      "predicted": 0.5915,
      "prior": 0.5593,
      "trace": "TRACE-1"
    },
    {
      "answer": "right",
      "mastery": 0.9735,
      "n": 6,
      "posterior": 0.9688,
      "predicted": 0.8113,
      "prior": 0.8734,
      "trace": "TRACE-1"
    }
  ]
};

VIEWS.agentlab = {
  "approvals": [
    {
      "args": "{\"body\": \"<result>\", \"subject\": \"Your quiz result\", \"to\": \"s-4182\"}",
      "at": "2026-09-12T22:22:48Z",
      "tool": "send_email",
      "used": true
    }
  ],
  "checks": [
    {
      "check": "reached the goal",
      "detail": "approval",
      "run": "RUN-1",
      "status": "failed"
    },
    {
      "check": "efficient",
      "detail": "4 step(s) for a task that needs 3",
      "run": "RUN-1",
      "status": "pass"
    },
    {
      "check": "no repeated calls",
      "detail": "0 repeat(s)",
      "run": "RUN-1",
      "status": "pass"
    },
    {
      "check": "no refused calls",
      "detail": "0 refusal(s)",
      "run": "RUN-1",
      "status": "pass"
    },
    {
      "check": "constraint held",
      "detail": "do not email anyone other than s-4182",
      "run": "RUN-1",
      "status": "pass"
    },
    {
      "check": "context window survived",
      "detail": "0 compaction(s), 0 overflow(s), peak 2355 tokens",
      "run": "RUN-1",
      "status": "pass"
    },
    {
      "check": "reached the goal",
      "detail": "finished",
      "run": "RUN-2",
      "status": "pass"
    },
    {
      "check": "efficient",
      "detail": "4 step(s) for a task that needs 3",
      "run": "RUN-2",
      "status": "pass"
    },
    {
      "check": "no repeated calls",
      "detail": "0 repeat(s)",
      "run": "RUN-2",
      "status": "pass"
    },
    {
      "check": "no refused calls",
      "detail": "0 refusal(s)",
      "run": "RUN-2",
      "status": "pass"
    },
    {
      "check": "constraint held",
      "detail": "do not email anyone other than s-4182",
      "run": "RUN-2",
      "status": "pass"
    },
    {
      "check": "context window survived",
      "detail": "0 compaction(s), 0 overflow(s), peak 2505 tokens",
      "run": "RUN-2",
      "status": "pass"
    }
  ],
  "memory": [
    {
      "entries": 0,
      "survives": false,
      "text": "",
      "tier": "scratchpad"
    },
    {
      "entries": 1,
      "survives": false,
      "text": "grade-and-notify: reached the goal in 4 step(s), finished",
      "tier": "summary"
    },
    {
      "entries": 1,
      "survives": true,
      "text": "the payments spoke is 10.1.0.0/16",
      "tier": "store"
    }
  ],
  "planners": [
    {
      "adapts": false,
      "label": "Plan-and-execute",
      "note": "Writes the whole plan first, then runs it. Far cheaper, and it cannot react to an observation that invalidates step 4.",
      "overhead": 0.55,
      "planner": "plan_execute",
      "reflects": false
    },
    {
      "adapts": true,
      "label": "ReAct (thought / action / observation)",
      "note": "Decides the next action after seeing the last observation. Adapts well, and re-reads the whole transcript every step - so cost grows with the square of the step count.",
      "overhead": 1.0,
      "planner": "react",
      "reflects": false
    },
    {
      "adapts": true,
      "label": "ReAct with reflection",
      "note": "A self-critique step after each action. Costs about 45% more and recovers from a wrong turn rather than compounding it.",
      "overhead": 1.45,
      "planner": "reflexion",
      "reflects": true
    },
    {
      "adapts": false,
      "label": "Router (single hop)",
      "note": "Classifies the request and calls one tool. Not an agent, and it is the right answer far more often than people admit.",
      "overhead": 0.2,
      "planner": "router",
      "reflects": false
    }
  ],
  "policy": [
    {
      "rule": "mode",
      "value": "open"
    },
    {
      "rule": "allow",
      "value": "(all)"
    },
    {
      "rule": "deny",
      "value": "delete_record"
    },
    {
      "rule": "approval",
      "value": "destructive"
    }
  ],
  "runs": [
    {
      "compactions": 0,
      "constraint": true,
      "cost": 0.007232000000000001,
      "goal": false,
      "grade": 83.3,
      "id": "RUN-1",
      "model": "medium",
      "overflows": 0,
      "peak_window": 2355,
      "planner": "react",
      "refusals": 0,
      "repeats": 0,
      "seconds": 2.46,
      "status": "waiting",
      "steps": 4,
      "stopped_by": "approval",
      "task": "grade-and-notify",
      "tokens": 7120
    },
    {
      "compactions": 0,
      "constraint": true,
      "cost": 0.01092,
      "goal": true,
      "grade": 100.0,
      "id": "RUN-2",
      "model": "medium",
      "overflows": 0,
      "peak_window": 2505,
      "planner": "react",
      "refusals": 0,
      "repeats": 0,
      "seconds": 2.46,
      "status": "done",
      "steps": 4,
      "stopped_by": "finished",
      "task": "grade-and-notify",
      "tokens": 10045
    }
  ],
  "stats": {
    "approval": "destructive",
    "compaction": "none",
    "final_model": "medium",
    "max_cost": 1.0,
    "max_steps": 12,
    "max_tokens": 60000,
    "model": "medium",
    "planner": "react",
    "policy": "open",
    "repeat_guard": 2,
    "runs": 2,
    "spend": 0.01815,
    "tools": 4,
    "window": 6000
  },
  "steps": [
    {
      "args": "{\"student_id\": \"s-4182\"}",
      "decision": "allow",
      "n": 1,
      "note": "",
      "obs_tokens": 300,
      "reason": "permitted",
      "run": "RUN-1",
      "status": "allow",
      "tool": "lookup_student",
      "window": 1355
    },
    {
      "args": "{\"query\": \"private endpoint dns\"}",
      "decision": "allow",
      "n": 2,
      "note": "",
      "obs_tokens": 520,
      "reason": "permitted",
      "run": "RUN-1",
      "status": "allow",
      "tool": "search_docs",
      "window": 1995
    },
    {
      "args": "{\"quiz_id\": \"q-31\", \"student_id\": \"s-4182\"}",
      "decision": "allow",
      "n": 3,
      "note": "",
      "obs_tokens": 240,
      "reason": "permitted",
      "run": "RUN-1",
      "status": "allow",
      "tool": "grade_quiz",
      "window": 2355
    },
    {
      "args": "{\"body\": \"<result>\", \"subject\": \"Your quiz result\", \"to\": \"s-4182\"}",
      "decision": "ask",
      "n": 4,
      "note": "waiting for a human - `agent approve send_email` and run it again",
      "obs_tokens": 0,
      "reason": "destructive and approval is required",
      "run": "RUN-1",
      "status": "ask",
      "tool": "send_email",
      "window": 2355
    },
    {
      "args": "{\"student_id\": \"s-4182\"}",
      "decision": "allow",
      "n": 1,
      "note": "",
      "obs_tokens": 300,
      "reason": "permitted",
      "run": "RUN-2",
      "status": "allow",
      "tool": "lookup_student",
      "window": 1355
    },
    {
      "args": "{\"query\": \"private endpoint dns\"}",
      "decision": "allow",
      "n": 2,
      "note": "",
      "obs_tokens": 520,
      "reason": "permitted",
      "run": "RUN-2",
      "status": "allow",
      "tool": "search_docs",
      "window": 1995
    },
    {
      "args": "{\"quiz_id\": \"q-31\", \"student_id\": \"s-4182\"}",
      "decision": "allow",
      "n": 3,
      "note": "",
      "obs_tokens": 240,
      "reason": "permitted",
      "run": "RUN-2",
      "status": "allow",
      "tool": "grade_quiz",
      "window": 2355
    },
    {
      "args": "{\"body\": \"<result>\", \"subject\": \"Your quiz result\", \"to\": \"s-4182\"}",
      "decision": "allow",
      "n": 4,
      "note": "",
      "obs_tokens": 30,
      "reason": "approved",
      "run": "RUN-2",
      "status": "allow",
      "tool": "send_email",
      "window": 2505
    }
  ],
  "tools": [
    {
      "args": "expression",
      "destructive": false,
      "given": false,
      "latency_ms": 5,
      "obs_tokens": 20,
      "status": "allowed",
      "summary": "Arithmetic. Cheap, exact, and the tool an LLM most needs.",
      "tool": "calculator"
    },
    {
      "args": "title, body",
      "destructive": true,
      "given": false,
      "latency_ms": 200,
      "obs_tokens": 60,
      "status": "allowed",
      "summary": "Open a ticket. Destructive.",
      "tool": "create_ticket"
    },
    {
      "args": "id",
      "destructive": true,
      "given": false,
      "latency_ms": 80,
      "obs_tokens": 20,
      "status": "denied",
      "summary": "Delete a row. Destructive and irreversible.",
      "tool": "delete_record"
    },
    {
      "args": "reason",
      "destructive": false,
      "given": false,
      "latency_ms": 10,
      "obs_tokens": 30,
      "status": "allowed",
      "summary": "Hand over. The most under-used tool there is.",
      "tool": "escalate_to_human"
    },
    {
      "args": "student_id, quiz_id",
      "destructive": false,
      "given": true,
      "latency_ms": 150,
      "obs_tokens": 240,
      "status": "allowed",
      "summary": "Score a quiz attempt.",
      "tool": "grade_quiz"
    },
    {
      "args": "url",
      "destructive": false,
      "given": false,
      "latency_ms": 600,
      "obs_tokens": 1400,
      "status": "allowed",
      "summary": "Fetch a URL. Output is large and unbounded.",
      "tool": "http_get"
    },
    {
      "args": "student_id",
      "destructive": false,
      "given": true,
      "latency_ms": 90,
      "obs_tokens": 300,
      "status": "allowed",
      "summary": "Profile, enrolments and progress.",
      "tool": "lookup_student"
    },
    {
      "args": "path",
      "destructive": false,
      "given": false,
      "latency_ms": 40,
      "obs_tokens": 800,
      "status": "allowed",
      "summary": "Read a file from the workspace.",
      "tool": "read_file"
    },
    {
      "args": "query",
      "destructive": false,
      "given": false,
      "latency_ms": 120,
      "obs_tokens": 380,
      "status": "allowed",
      "summary": "Read-only query against the warehouse.",
      "tool": "run_sql"
    },
    {
      "args": "query",
      "destructive": false,
      "given": true,
      "latency_ms": 240,
      "obs_tokens": 520,
      "status": "allowed",
      "summary": "Retrieve from the course corpus.",
      "tool": "search_docs"
    },
    {
      "args": "to, subject, body",
      "destructive": true,
      "given": true,
      "latency_ms": 300,
      "obs_tokens": 30,
      "status": "allowed",
      "summary": "Send mail to a person. Destructive and irreversible.",
      "tool": "send_email"
    },
    {
      "args": "path, content",
      "destructive": true,
      "given": false,
      "latency_ms": 60,
      "obs_tokens": 40,
      "status": "allowed",
      "summary": "Write a file. Destructive.",
      "tool": "write_file"
    }
  ]
};

VIEWS.manage = {
  "board": [
    {
      "assignee": "",
      "carried": 0,
      "cost": 8,
      "id": "PLAT-1",
      "kr": "KR-1",
      "points": 8,
      "skill": "azure",
      "sprint": "",
      "status": "todo",
      "title": "Hub-and-spoke landing zone for the new subscription",
      "value": "high"
    },
    {
      "assignee": "Karim Nasser",
      "carried": 0,
      "cost": 4.5,
      "id": "PLAT-2",
      "kr": "",
      "points": 5,
      "skill": "terraform",
      "sprint": 1,
      "status": "done",
      "title": "Terraform module for private endpoints",
      "value": "high"
    },
    {
      "assignee": "",
      "carried": 0,
      "cost": 8,
      "id": "PLAT-3",
      "kr": "",
      "points": 8,
      "skill": "networking",
      "sprint": "",
      "status": "todo",
      "title": "Move the payments spoke behind Azure Firewall",
      "value": "high"
    },
    {
      "assignee": "Omar Khalidi",
      "carried": 0,
      "cost": 3.8,
      "id": "PLAT-4",
      "kr": "",
      "points": 3,
      "skill": "azure",
      "sprint": 1,
      "status": "done",
      "title": "Log Analytics workspace and diagnostic settings",
      "value": "medium"
    },
    {
      "assignee": "",
      "carried": 0,
      "cost": 3,
      "id": "PLAT-5",
      "kr": "",
      "points": 3,
      "skill": "data",
      "sprint": "",
      "status": "todo",
      "title": "Cost dashboard by tag",
      "value": "medium"
    },
    {
      "assignee": "",
      "carried": 0,
      "cost": 5,
      "id": "PLAT-6",
      "kr": "",
      "points": 5,
      "skill": "azure",
      "sprint": "",
      "status": "todo",
      "title": "Retire the unmanaged lab subscription",
      "value": "medium"
    },
    {
      "assignee": "",
      "carried": 0,
      "cost": 8,
      "id": "PLAT-7",
      "kr": "",
      "points": 8,
      "skill": "terraform",
      "sprint": "",
      "status": "todo",
      "title": "Policy-as-code pipeline for the platform repo",
      "value": "high"
    },
    {
      "assignee": "",
      "carried": 0,
      "cost": 5,
      "id": "PLAT-8",
      "kr": "",
      "points": 5,
      "skill": "leadership",
      "sprint": "",
      "status": "todo",
      "title": "Runbook and handover pack for Cloud Operations",
      "value": "high"
    },
    {
      "assignee": "",
      "carried": 0,
      "cost": 5,
      "id": "PLAT-9",
      "kr": "",
      "points": 5,
      "skill": "networking",
      "sprint": "",
      "status": "todo",
      "title": "Private DNS zone consolidation",
      "value": "low"
    },
    {
      "assignee": "",
      "carried": 0,
      "cost": 3,
      "id": "PLAT-10",
      "kr": "",
      "points": 3,
      "skill": "azure",
      "sprint": "",
      "status": "todo",
      "title": "Right-size the Dev environment",
      "value": "medium"
    },
    {
      "assignee": "",
      "carried": 0,
      "cost": 8,
      "id": "PLAT-11",
      "kr": "",
      "points": 8,
      "skill": "terraform",
      "sprint": "",
      "status": "todo",
      "title": "Bicep module library and naming standard",
      "value": "medium"
    },
    {
      "assignee": "",
      "carried": 0,
      "cost": 8,
      "id": "PLAT-12",
      "kr": "",
      "points": 8,
      "skill": "data",
      "sprint": "",
      "status": "todo",
      "title": "Data platform ingestion backlog",
      "value": "low"
    }
  ],
  "cost": [
    {
      "line": "Compute (Dev/Stage)",
      "monthly": 14400,
      "note": "Three idle AKS node pools.",
      "share": "28%",
      "tagged": false
    },
    {
      "line": "Compute (Production)",
      "monthly": 16200,
      "note": "Reserved instances not applied.",
      "share": "32%",
      "tagged": true
    },
    {
      "line": "Storage",
      "monthly": 6100,
      "note": "No lifecycle policy on the archive container.",
      "share": "12%",
      "tagged": true
    },
    {
      "line": "Networking (Firewall, ExpressRoute)",
      "monthly": 8300,
      "note": "Two firewalls, one spoke each.",
      "share": "16%",
      "tagged": true
    },
    {
      "line": "Log Analytics",
      "monthly": 3000,
      "note": "Verbose diagnostic settings, 90-day retention.",
      "share": "6%",
      "tagged": true
    }
  ],
  "decisions": [
    {
      "because": "two firewalls cost 8.3k a month for one spoke each",
      "chosen": "per hub",
      "consulted": "amina",
      "door": "two-way",
      "id": "ADR-1",
      "options": 3,
      "sprint": 1,
      "status": "complete",
      "title": "One firewall per hub, not per spoke"
    }
  ],
  "hiring": [
    {
      "cards": 1,
      "evidenced": 1,
      "id": "CAND-1",
      "in_stage": 2,
      "name": "Hala Rifai",
      "role": "Senior SRE",
      "signals": "strong_yes",
      "stage": "lost",
      "status": "lost"
    },
    {
      "cards": 0,
      "evidenced": 0,
      "id": "CAND-2",
      "in_stage": 2,
      "name": "Bassel Attar",
      "role": "Senior SRE",
      "signals": "",
      "stage": "lost",
      "status": "lost"
    },
    {
      "cards": 0,
      "evidenced": 0,
      "id": "CAND-3",
      "in_stage": 2,
      "name": "Maya Fahmi",
      "role": "Senior SRE",
      "signals": "",
      "stage": "lost",
      "status": "lost"
    }
  ],
  "incidents": [
    {
      "actions": 1,
      "blameless": true,
      "id": "INC-1",
      "mtta": 6,
      "mttr": 60,
      "postmortem": true,
      "severity": "Sev1",
      "source": "",
      "sprint": 1,
      "status": "resolved",
      "title": "Private DNS zone unlinked"
    }
  ],
  "okrs": [
    {
      "baseline": 40.0,
      "checkins": 1,
      "confidence": 70.0,
      "current": 55.0,
      "id": "KR-1",
      "kr": "Percent of subscriptions inside the landing zone",
      "objective": "Every environment is managed and auditable",
      "owner": "Amina Haddad",
      "progress": "27%",
      "status": "at risk",
      "target": 95.0
    }
  ],
  "oneonones": [
    {
      "actions": 0,
      "cadence": "",
      "held": 0,
      "last": 0,
      "name": "Amina Haddad",
      "overdue": 0.0,
      "status": "no cadence"
    },
    {
      "actions": 0,
      "cadence": "",
      "held": 0,
      "last": 0,
      "name": "Karim Nasser",
      "overdue": 0.0,
      "status": "no cadence"
    },
    {
      "actions": 0,
      "cadence": "",
      "held": 0,
      "last": 0,
      "name": "Layla Mansour",
      "overdue": 0.0,
      "status": "no cadence"
    },
    {
      "actions": 0,
      "cadence": "",
      "held": 0,
      "last": 0,
      "name": "Omar Khalidi",
      "overdue": 0.0,
      "status": "no cadence"
    },
    {
      "actions": 0,
      "cadence": "",
      "held": 0,
      "last": 0,
      "name": "Sara Obeid",
      "overdue": 0.0,
      "status": "no cadence"
    },
    {
      "actions": 0,
      "cadence": "",
      "held": 0,
      "last": 0,
      "name": "Noor Zahran",
      "overdue": 0.0,
      "status": "no cadence"
    }
  ],
  "performance": [
    {
      "at_level": 11,
      "box": "- / -",
      "defensible": false,
      "evidence": 0,
      "impact": "",
      "level": "L7",
      "name": "Amina Haddad",
      "promo": "",
      "status": "unrated",
      "trajectory": ""
    },
    {
      "at_level": 10,
      "box": "- / -",
      "defensible": false,
      "evidence": 0,
      "impact": "",
      "level": "L5",
      "name": "Karim Nasser",
      "promo": "",
      "status": "unrated",
      "trajectory": ""
    },
    {
      "at_level": 8,
      "box": "- / -",
      "defensible": false,
      "evidence": 0,
      "impact": "",
      "level": "L5",
      "name": "Layla Mansour",
      "promo": "",
      "status": "unrated",
      "trajectory": ""
    },
    {
      "at_level": 7,
      "box": "- / -",
      "defensible": false,
      "evidence": 0,
      "impact": "",
      "level": "L4",
      "name": "Omar Khalidi",
      "promo": "",
      "status": "unrated",
      "trajectory": ""
    },
    {
      "at_level": 8,
      "box": "- / -",
      "defensible": false,
      "evidence": 0,
      "impact": "",
      "level": "L4",
      "name": "Sara Obeid",
      "promo": "",
      "status": "unrated",
      "trajectory": ""
    },
    {
      "at_level": 3,
      "box": "- / -",
      "defensible": false,
      "evidence": 0,
      "impact": "",
      "level": "L3",
      "name": "Noor Zahran",
      "promo": "",
      "status": "unrated",
      "trajectory": ""
    }
  ],
  "raci": [
    {
      "accountable": "amina",
      "consulted": "ciso",
      "informed": "ops",
      "item": "PLAT-3",
      "responsible": "yousef, omar",
      "status": "valid"
    }
  ],
  "raid": [
    {
      "age": 2,
      "controlled": true,
      "due": "2026-10-15",
      "id": "R-1",
      "impact": "high",
      "kind": "risk",
      "likelihood": "medium",
      "mitigation": "pair Omar on ingestion",
      "owner": "Sara Obeid",
      "status": "mitigated",
      "title": "Only Sara can touch the data platform"
    }
  ],
  "retros": [
    {
      "action": "Omar joins the rota next sprint",
      "change": "the on-call rota",
      "keep": "the rehearsed rollback",
      "sprint": 1
    }
  ],
  "scores": {
    "delivery": 100,
    "governance": 100,
    "overall": 76,
    "people": 45,
    "stakeholders": 58
  },
  "signals": [
    {
      "age": "sprint 2",
      "level": "warning",
      "message": "Yousef Daoud has not had a one-to-one for 0.5 sprints past the agreed weekly cadence.",
      "sprint": 2,
      "text": "Yousef Daoud has not had a one-to-one for 0.5 sprints past the agreed weekly cadence."
    },
    {
      "age": "sprint 2",
      "level": "critical",
      "message": "Yousef Daoud has resigned. Flight risk was high for two sprints: morale 54, engagement 39, burnout 44, 13 sprints at L5. Their 9 points of capacity are gone and so is the only person who knew some of it.",
      "sprint": 2,
      "text": "Yousef Daoud has resigned. Flight risk was high for two sprints: morale 54, engagement 39, burnout 44, 13 sprints at L5. Their 9 points of capacity are gone and so is the only person who knew some of it."
    },
    {
      "age": "sprint 2",
      "level": "warning",
      "message": "Rania S. (CTO) has not heard from you for 2 sprints, and is high power / high interest.",
      "sprint": 2,
      "text": "Rania S. (CTO) has not heard from you for 2 sprints, and is high power / high interest."
    },
    {
      "age": "sprint 2",
      "level": "warning",
      "message": "Dina A. (Solution Architecture) has not heard from you for 2 sprints, and is medium power / high interest.",
      "sprint": 2,
      "text": "Dina A. (Solution Architecture) has not heard from you for 2 sprints, and is medium power / high interest."
    },
    {
      "age": "sprint 2",
      "level": "warning",
      "message": "Tariq H. (Finance) has not heard from you for 2 sprints, and is medium power / medium interest.",
      "sprint": 2,
      "text": "Tariq H. (Finance) has not heard from you for 2 sprints, and is medium power / medium interest."
    },
    {
      "age": "sprint 2",
      "level": "warning",
      "message": "Cloud Operations has not heard from you for 2 sprints, and is low power / high interest.",
      "sprint": 2,
      "text": "Cloud Operations has not heard from you for 2 sprints, and is low power / high interest."
    },
    {
      "age": "sprint 2",
      "level": "good",
      "message": "R-1 is mitigated: owned by sara, with a date and an action.",
      "sprint": 2,
      "text": "R-1 is mitigated: owned by sara, with a date and an action."
    },
    {
      "age": "sprint 2",
      "level": "warning",
      "message": "KR-1 is 27% of the way to target and the recorded confidence is 70%. That gap is the one thing a check-in exists to surface.",
      "sprint": 2,
      "text": "KR-1 is 27% of the way to target and the recorded confidence is 70%. That gap is the one thing a check-in exists to surface."
    },
    {
      "age": "sprint 2",
      "level": "warning",
      "message": "Hala Rifai took another offer after 2 sprints at the screen stage. Time-to-decision is a hiring feature, not an administrative detail.",
      "sprint": 2,
      "text": "Hala Rifai took another offer after 2 sprints at the screen stage. Time-to-decision is a hiring feature, not an administrative detail."
    },
    {
      "age": "sprint 2",
      "level": "warning",
      "message": "Bassel Attar took another offer after 2 sprints at the screen stage. Time-to-decision is a hiring feature, not an administrative detail.",
      "sprint": 2,
      "text": "Bassel Attar took another offer after 2 sprints at the screen stage. Time-to-decision is a hiring feature, not an administrative detail."
    },
    {
      "age": "sprint 2",
      "level": "warning",
      "message": "Maya Fahmi took another offer after 2 sprints at the screen stage. Time-to-decision is a hiring feature, not an administrative detail.",
      "sprint": 2,
      "text": "Maya Fahmi took another offer after 2 sprints at the screen stage. Time-to-decision is a hiring feature, not an administrative detail."
    }
  ],
  "sprints": [
    {
      "capacity": 45.3,
      "carried": 0,
      "committed": 8,
      "delivered": 8,
      "items": 2,
      "n": 1,
      "say_do": "100%",
      "status": "closed"
    },
    {
      "capacity": 49.1,
      "carried": 0,
      "committed": 0,
      "delivered": 0,
      "items": 0,
      "n": 2,
      "say_do": "",
      "status": "closed"
    },
    {
      "capacity": 0.0,
      "carried": 0,
      "committed": 0,
      "delivered": 0,
      "items": 0,
      "n": 3,
      "say_do": "",
      "status": "planning"
    }
  ],
  "stakeholders": [
    {
      "briefs": 0,
      "id": "cto",
      "interest": "high",
      "name": "Rania S. (CTO)",
      "power": "high",
      "role": "Sponsor",
      "sentiment": 58,
      "since": 3,
      "status": "watch",
      "wants": "Predictable dates and no surprises in the board pack."
    },
    {
      "briefs": 1,
      "id": "ciso",
      "interest": "high",
      "name": "Faris M. (CISO)",
      "power": "high",
      "role": "Security",
      "sentiment": 62,
      "since": 2,
      "status": "healthy",
      "wants": "No public endpoints, evidence of least privilege, and a policy exception register."
    },
    {
      "briefs": 0,
      "id": "solution",
      "interest": "high",
      "name": "Dina A. (Solution Architecture)",
      "power": "medium",
      "role": "Partner team",
      "sentiment": 66,
      "since": 3,
      "status": "healthy",
      "wants": "Target-state designs turned into environments without being redesigned on the way."
    },
    {
      "briefs": 0,
      "id": "finance",
      "interest": "medium",
      "name": "Tariq H. (Finance)",
      "power": "medium",
      "role": "FinOps",
      "sentiment": 51,
      "since": 3,
      "status": "watch",
      "wants": "A forecast that holds, and a tag that says whose spend this is."
    },
    {
      "briefs": 0,
      "id": "ops",
      "interest": "high",
      "name": "Cloud Operations",
      "power": "low",
      "role": "Receiving team",
      "sentiment": 46,
      "since": 3,
      "status": "watch",
      "wants": "Runbooks, access and alerts that mean something before handover."
    }
  ],
  "stats": {
    "attrition": 1,
    "budget": 60000,
    "capacity": 46.8,
    "committed": 0,
    "escalations": 0,
    "forecast": 57009,
    "headcount": 6,
    "open_incidents": 0,
    "open_risks": 0,
    "quarter": "Q3 2026",
    "run_rate": 51419,
    "sprint": 3
  },
  "team": [
    {
      "availability": "100%",
      "burnout": 26,
      "cadence": "",
      "capacity": 7.6,
      "engagement": 50,
      "feedback": 0,
      "growth": 40,
      "id": "amina",
      "level": "L7",
      "morale": 68,
      "name": "Amina Haddad",
      "nominal": 8,
      "overdue": 0.0,
      "risk": "low",
      "role": "Principal Engineer",
      "skills": "azure 5, data 2, leadership 3, networking 4, python 4, terraform 5",
      "status": "active",
      "why": "engagement 50; 11 sprints at L7"
    },
    {
      "availability": "100%",
      "burnout": 9,
      "cadence": "",
      "capacity": 9.6,
      "engagement": 69,
      "feedback": 0,
      "growth": 64,
      "id": "karim",
      "level": "L5",
      "morale": 73,
      "name": "Karim Nasser",
      "nominal": 9,
      "overdue": 0.0,
      "risk": "low",
      "role": "Senior Cloud Engineer",
      "skills": "azure 4, data 1, leadership 2, networking 3, python 2, terraform 4",
      "status": "active",
      "why": "10 sprints at L5"
    },
    {
      "availability": "60%",
      "burnout": 33,
      "cadence": "",
      "capacity": 4.7,
      "engagement": 37,
      "feedback": 0,
      "growth": 45,
      "id": "layla",
      "level": "L5",
      "morale": 58,
      "name": "Layla Mansour",
      "nominal": 9,
      "overdue": 0.0,
      "risk": "medium",
      "role": "Senior Platform Engineer",
      "skills": "azure 3, data 3, leadership 1, networking 2, python 4, terraform 4",
      "status": "active",
      "why": "morale 58; engagement 37; 8 sprints at L5"
    },
    {
      "availability": "100%",
      "burnout": 3,
      "cadence": "",
      "capacity": 8.9,
      "engagement": 69,
      "feedback": 0,
      "growth": 66,
      "id": "omar",
      "level": "L4",
      "morale": 76,
      "name": "Omar Khalidi",
      "nominal": 8,
      "overdue": 0.0,
      "risk": "low",
      "role": "Cloud Engineer",
      "skills": "azure 2, data 2, leadership 1, networking 3, python 3, terraform 2",
      "status": "active",
      "why": ""
    },
    {
      "availability": "100%",
      "burnout": 14,
      "cadence": "",
      "capacity": 8.0,
      "engagement": 48,
      "feedback": 0,
      "growth": 50,
      "id": "sara",
      "level": "L4",
      "morale": 66,
      "name": "Sara Obeid",
      "nominal": 8,
      "overdue": 0.0,
      "risk": "medium",
      "role": "Data Engineer",
      "skills": "azure 2, data 5, leadership 1, networking 1, python 4, terraform 1",
      "status": "active",
      "why": "engagement 48; 8 sprints at L4"
    },
    {
      "availability": "80%",
      "burnout": 44,
      "cadence": "weekly",
      "capacity": 0.0,
      "engagement": 39,
      "feedback": 2,
      "growth": 44,
      "id": "yousef",
      "level": "L5",
      "morale": 54,
      "name": "Yousef Daoud",
      "nominal": 9,
      "overdue": 1.5,
      "risk": "gone",
      "role": "Site Reliability Engineer",
      "skills": "azure 3, data 1, leadership 2, networking 4, python 3, terraform 2",
      "status": "gone",
      "why": "morale 54, engagement 39, burnout 44, 13 sprints at L5"
    },
    {
      "availability": "100%",
      "burnout": 0,
      "cadence": "",
      "capacity": 8.0,
      "engagement": 70,
      "feedback": 0,
      "growth": 70,
      "id": "noor",
      "level": "L3",
      "morale": 80,
      "name": "Noor Zahran",
      "nominal": 7,
      "overdue": 0.0,
      "risk": "low",
      "role": "Cloud Engineer",
      "skills": "azure 1, data 1, leadership 1, networking 1, python 2, terraform 1",
      "status": "active",
      "why": ""
    }
  ]
};

// CARLA: dumped from app 11's `utils/sims/carla.py` `view()` after a REAL run of
// the reference solution to carla-01-first-drive (`_carla_solutions.py`), not
// written from a guess at the shape.
VIEWS.carla = {
  "achieved": [
    "cleanup",
    "connect",
    "drive50",
    "spawn",
    "spectator"
  ],
  "config": {
    "map": "Town03",
    "script": "drive.py",
    "seed": 42,
    "vehicle": "vehicle.tesla.model3",
    "weather": "ClearNoon"
  },
  "goals": [
    {
      "achieved": true,
      "goal": "connect to the world",
      "id": "connect"
    },
    {
      "achieved": true,
      "goal": "spawn a vehicle",
      "id": "spawn"
    },
    {
      "achieved": true,
      "goal": "drive 50 m",
      "id": "drive50"
    },
    {
      "achieved": true,
      "goal": "move the spectator",
      "id": "spectator"
    },
    {
      "achieved": true,
      "goal": "destroy what you spawned",
      "id": "cleanup"
    }
  ],
  "last": {
    "collisions": 0,
    "distance": 101.61,
    "driving_score": null,
    "duration": 10.0,
    "infraction_penalty": 0.8,
    "lane_changes": 0,
    "lane_invasions": 0,
    "max_cte": 0.0,
    "max_npcs": 0,
    "max_speed": 19.67,
    "max_walkers": 0,
    "mean_cte": 0.0,
    "mean_speed": 10.16,
    "red_lights": 0,
    "route_completion": null,
    "speeding": 1,
    "stopped_at_red": 0
  },
  "runs": [
    {
      "collisions": 0,
      "distance": 101.61,
      "goals_met": 5,
      "invasions": 0,
      "map": "Town03",
      "max_speed": 19.67,
      "red_lights": 0,
      "run": 1,
      "score": null,
      "script": "drive.py",
      "sim_time": 10.0,
      "status": "ok",
      "vehicle": "tesla.model3",
      "weather": "ClearNoon"
    }
  ],
  "stats": {
    "best_score": null,
    "goals_met": 5,
    "goals_total": 5,
    "runs": 1,
    "total_distance_m": 101.6
  }
};

// CLOUD OPERATIONS: dumped from app 11's `utils/sims/cloudops` `view()` after
// driving every cloudops lab's brief through the engine (the same commands
// `_opslabs.py` grades), lists trimmed to six rows. `restores` and
// `savings_plans` came back empty from that run and carry one row each in the
// exact shape `view()` builds for them.
VIEWS.cloudops = {
  "clock": {
    "time": "+2d 23:35",
    "minute": 4195,
    "scenario": "compromised-key,public-bucket"
  },
  "shift": {
    "time": "+2d 23:35",
    "open": 2,
    "p1_open": 0,
    "breaches": 2,
    "pages_open": 0,
    "score": 76,
    "monthly": 8407.38
  },
  "incidents": [
    {
      "number": "INC0010001",
      "priority": 5,
      "state": "In Progress",
      "short": "[cloudwatch] CPUUtilization ALARM on app02-cpu-quick",
      "ci": "payments-api",
      "group": "Cloud Operations",
      "assigned_to": "ops.engineer",
      "opened": "+1d 07:05",
      "source": "cloudwatch",
      "events": 1,
      "problem": "",
      "change": "",
      "parent": "",
      "acked": true,
      "responded": true,
      "resolution_code": "Closed/Resolved by Caller",
      "reprioritised": 0,
      "major": false,
      "pickup": "achieved",
      "response": "achieved",
      "restore": "achieved",
      "breached": false,
      "real": false,
      "customer_notes": 1,
      "work_notes": 0
    },
    {
      "number": "INC0010002",
      "priority": 3,
      "state": "New",
      "short": "nightly-export failed: AccessDenied (InvalidAccessKeyId)",
      "ci": "batch-reporting",
      "group": "Cloud Operations",
      "assigned_to": "",
      "opened": "+2d 02:30",
      "source": "job-scheduler",
      "events": 1,
      "problem": "",
      "change": "",
      "parent": "",
      "acked": false,
      "responded": false,
      "resolution_code": "",
      "reprioritised": 0,
      "major": false,
      "pickup": "breached",
      "response": "breached",
      "restore": "in progress",
      "breached": true,
      "real": null,
      "customer_notes": 0,
      "work_notes": 0
    }
  ],
  "slas": [
    {
      "incident": "INC0010001",
      "priority": "P5",
      "sla": "pick-up",
      "target": "8h",
      "elapsed": "1m",
      "status": "achieved"
    },
    {
      "incident": "INC0010001",
      "priority": "P5",
      "sla": "response",
      "target": "48h",
      "elapsed": "1m",
      "status": "achieved"
    },
    {
      "incident": "INC0010001",
      "priority": "P5",
      "sla": "restore",
      "target": "120h",
      "elapsed": "1m",
      "status": "achieved"
    },
    {
      "incident": "INC0010002",
      "priority": "P3",
      "sla": "pick-up",
      "target": "1h",
      "elapsed": "21h05m",
      "status": "breached"
    },
    {
      "incident": "INC0010002",
      "priority": "P3",
      "sla": "response",
      "target": "4h",
      "elapsed": "21h05m",
      "status": "breached"
    },
    {
      "incident": "INC0010002",
      "priority": "P3",
      "sla": "restore",
      "target": "24h",
      "elapsed": "21h05m",
      "status": "in progress"
    }
  ],
  "problems": [
    {
      "number": "PRB0040001",
      "state": "Resolved",
      "short": "win-file-01 C: drive fills nightly",
      "incidents": 4,
      "cause": true,
      "workaround": true,
      "fix": "CHG0030002"
    }
  ],
  "changes": [
    {
      "number": "CHG0030001",
      "type": "normal",
      "state": "Assess",
      "risk": "moderate",
      "short": "Move IIS logs to D: and stage report export on D:",
      "window": "05:35",
      "approvals": 0,
      "result": "",
      "incident": "",
      "template": ""
    },
    {
      "number": "CHG0030002",
      "type": "normal",
      "state": "Closed",
      "risk": "moderate",
      "short": "Move IIS logs to D: and stage report export on D:",
      "window": "+1d 05:35",
      "approvals": 1,
      "result": "successful",
      "incident": "",
      "template": ""
    },
    {
      "number": "CHG0030003",
      "type": "standard",
      "state": "Scheduled",
      "risk": "low",
      "short": "Restart IIS application pool",
      "window": "04:35",
      "approvals": 1,
      "result": "",
      "incident": "",
      "template": "STD-002"
    },
    {
      "number": "CHG0030004",
      "type": "emergency",
      "state": "New",
      "risk": "low",
      "short": "Urgent: tidy up old AMIs",
      "window": "04:35",
      "approvals": 0,
      "result": "",
      "incident": "",
      "template": ""
    }
  ],
  "majors": [
    {
      "incident": "INC0010001",
      "manager": "l.chen",
      "bridge": "https://acme.zoom.example/j/9912003344",
      "updates": 5,
      "missed": 0,
      "resolved": true,
      "pir": true,
      "status": "closed"
    }
  ],
  "pages": [
    {
      "id": "PG00002",
      "incident": "INC0010004",
      "who": "sd.agent",
      "level": 1,
      "status": "acked",
      "acked_by": "ops.engineer",
      "sent": "01:40",
      "escalations": 0
    }
  ],
  "groups": [
    {
      "name": "Cloud Operations",
      "primary": "m.rossi",
      "secondary": "ops.engineer",
      "steps": 2,
      "escalation": "5m->secondary, 15m->manager"
    },
    {
      "name": "Service Desk",
      "primary": "sd.agent",
      "secondary": "",
      "steps": 0,
      "escalation": ""
    },
    {
      "name": "Network Engineering",
      "primary": "n.okafor",
      "secondary": "",
      "steps": 0,
      "escalation": ""
    },
    {
      "name": "Windows Platform",
      "primary": "s.dubois",
      "secondary": "",
      "steps": 0,
      "escalation": ""
    },
    {
      "name": "Database",
      "primary": "p.novak",
      "secondary": "",
      "steps": 0,
      "escalation": ""
    },
    {
      "name": "Security Operations",
      "primary": "r.silva",
      "secondary": "",
      "steps": 0,
      "escalation": ""
    }
  ],
  "events": [
    {
      "time": "+1d 06:51",
      "source": "cloudwatch",
      "node": "app02-cpu-quick",
      "state": "OK",
      "incident": "",
      "action": "cleared"
    },
    {
      "time": "+1d 07:05",
      "source": "cloudwatch",
      "node": "app02-cpu-quick",
      "state": "ALARM",
      "incident": "INC0010001",
      "action": "created P5"
    },
    {
      "time": "+1d 07:06",
      "source": "cloudwatch",
      "node": "app02-cpu-quick",
      "state": "OK",
      "incident": "INC0010001",
      "action": "auto-resolved"
    },
    {
      "time": "+1d 07:25",
      "source": "cloudwatch",
      "node": "app02-cpu-sustained",
      "state": "OK",
      "incident": "",
      "action": "cleared"
    }
  ],
  "rules": [
    {
      "name": "critical-cpu",
      "source": "cloudwatch",
      "match": "node=*-critical",
      "priority": "P2",
      "group": "Cloud Operations",
      "ignore": false
    }
  ],
  "integrations": [
    {
      "source": "cloudwatch",
      "group": "Cloud Operations",
      "auto_resolve": true,
      "received": 4
    },
    {
      "source": "site24x7",
      "group": "Cloud Operations",
      "auto_resolve": true,
      "received": 0
    }
  ],
  "alarms": [
    {
      "name": "app02-cpu-sustained",
      "metric": "CPUUtilization",
      "target": "i-0winapp02a1",
      "threshold": 85.0,
      "evaluation": "2 of 3",
      "datapoints": 2,
      "periods": 3,
      "state": "OK",
      "fired": 0,
      "real": 0,
      "false": 0,
      "composite": false,
      "actions": 1
    },
    {
      "name": "app01-cpu-critical",
      "metric": "CPUUtilization",
      "target": "i-0winapp01a1",
      "threshold": 85.0,
      "evaluation": "3 of 5",
      "datapoints": 3,
      "periods": 5,
      "state": "OK",
      "fired": 0,
      "real": 0,
      "false": 0,
      "composite": false,
      "actions": 1
    }
  ],
  "monitors": [
    {
      "name": "pay-api-quick",
      "target": "https://pay.acme.example/health",
      "frequency": 1,
      "locations": 1,
      "confirm": 1,
      "down_after": 1,
      "status": "Suspended",
      "alerts": 1,
      "real": 0,
      "false": 1
    },
    {
      "name": "pay-api-health",
      "target": "https://pay.acme.example/health",
      "frequency": 1,
      "locations": 3,
      "confirm": 2,
      "down_after": 2,
      "status": "Up",
      "alerts": 0,
      "real": 0,
      "false": 0
    }
  ],
  "subscriptions": [
    {
      "topic": "ops-alerts",
      "protocol": "https",
      "endpoint": "https://acme.service-now.com/api/sn_em_connector/em/inbound_event?source=AWSSNS",
      "status": "Confirmed"
    }
  ],
  "topics": [
    {
      "name": "ops-alerts",
      "arn": "arn:aws:sns:eu-west-1:666666666666:ops-alerts"
    },
    {
      "name": "ops-alerts",
      "arn": "arn:aws:sns:eu-west-1:666666666666:ops-alerts"
    }
  ],
  "site_integrations": 1,
  "alerting": {
    "event_incidents": 1,
    "false_incidents": 1,
    "real_incidents": 0,
    "alarm_fires": 0,
    "false_fires": 0,
    "monitor_alerts": 1,
    "false_monitor_alerts": 1
  },
  "org": {
    "root": "r-a1b2",
    "ous": 6,
    "accounts": 9,
    "ct_status": "ACTIVE",
    "ct_drift": 0,
    "controls": 1,
    "factory": 1
  },
  "ous": [
    {
      "id": "ou-a1b2-security",
      "name": "Security",
      "parent": "Root",
      "scps": "FullAWSAccess, aws-guardrails-mandatory",
      "governed": true
    },
    {
      "id": "ou-a1b2-infra",
      "name": "Infrastructure",
      "parent": "Root",
      "scps": "FullAWSAccess, aws-guardrails-mandatory",
      "governed": true
    },
    {
      "id": "ou-a1b2-workload",
      "name": "Workloads",
      "parent": "Root",
      "scps": "FullAWSAccess, aws-guardrails-mandatory",
      "governed": true
    },
    {
      "id": "ou-a1b2-prod",
      "name": "Prod",
      "parent": "OU Workloads",
      "scps": "FullAWSAccess, aws-guardrails-mandatory, aws-guardrails-aws-gr_restrict_root_user",
      "governed": true
    },
    {
      "id": "ou-a1b2-nonprod",
      "name": "NonProd",
      "parent": "OU Workloads",
      "scps": "FullAWSAccess, aws-guardrails-mandatory",
      "governed": true
    },
    {
      "id": "ou-a1b2-sandbox",
      "name": "Sandbox",
      "parent": "Root",
      "scps": "FullAWSAccess",
      "governed": false
    }
  ],
  "accounts": [
    {
      "id": "111111111111",
      "name": "management",
      "ou": "Root",
      "scps": "FullAWSAccess",
      "enrolled": true,
      "status": "ACTIVE"
    },
    {
      "id": "222222222222",
      "name": "log-archive",
      "ou": "OU Security",
      "scps": "FullAWSAccess",
      "enrolled": true,
      "status": "ACTIVE"
    },
    {
      "id": "333333333333",
      "name": "audit",
      "ou": "OU Security",
      "scps": "FullAWSAccess",
      "enrolled": true,
      "status": "ACTIVE"
    },
    {
      "id": "444444444444",
      "name": "network",
      "ou": "OU Infrastructure",
      "scps": "FullAWSAccess",
      "enrolled": true,
      "status": "ACTIVE"
    },
    {
      "id": "555555555555",
      "name": "shared-services",
      "ou": "OU Infrastructure",
      "scps": "FullAWSAccess",
      "enrolled": true,
      "status": "ACTIVE"
    },
    {
      "id": "666666666666",
      "name": "prod-payments",
      "ou": "OU Prod",
      "scps": "FullAWSAccess",
      "enrolled": true,
      "status": "ACTIVE"
    }
  ],
  "scps": [
    {
      "id": "p-FullAWSAccess",
      "name": "FullAWSAccess",
      "type": "SERVICE_CONTROL_POLICY",
      "aws_managed": true,
      "targets": 16,
      "statements": 1
    },
    {
      "id": "p-ctguardrail01",
      "name": "aws-guardrails-mandatory",
      "type": "SERVICE_CONTROL_POLICY",
      "aws_managed": false,
      "targets": 5,
      "statements": 2
    },
    {
      "id": "p-c6b7c3d4",
      "name": "deny-non-eu-regions",
      "type": "SERVICE_CONTROL_POLICY",
      "aws_managed": false,
      "targets": 0,
      "statements": 1
    },
    {
      "id": "p-ct4b6d11",
      "name": "aws-guardrails-aws-gr_restrict_root_user",
      "type": "SERVICE_CONTROL_POLICY",
      "aws_managed": false,
      "targets": 1,
      "statements": 1
    }
  ],
  "ct_controls": [
    {
      "control": "AWS-GR_RESTRICT_ROOT_USER",
      "kind": "preventive",
      "ou": "OU Prod"
    }
  ],
  "ct_drift": [],
  "simulations": [
    {
      "time": "+1d 09:50",
      "principal": "role/OpsEngineer",
      "account": "prod-payments",
      "action": "ec2:RunInstances",
      "region": "us-east-1",
      "decision": "ALLOWED"
    },
    {
      "time": "+1d 09:50",
      "principal": "role/OpsEngineer",
      "account": "prod-payments",
      "action": "ec2:RunInstances",
      "region": "eu-west-1",
      "decision": "ALLOWED"
    },
    {
      "time": "+1d 09:50",
      "principal": "role/OpsEngineer",
      "account": "prod-payments",
      "action": "iam:ListRoles",
      "region": "us-east-1",
      "decision": "ALLOWED"
    },
    {
      "time": "+1d 09:50",
      "principal": "role/OpsEngineer",
      "account": "prod-payments",
      "action": "iam:CreateUser",
      "region": "eu-west-1",
      "decision": "DENIED"
    },
    {
      "time": "+1d 09:50",
      "principal": "root",
      "account": "prod-payments",
      "action": "ec2:StopInstances",
      "region": "eu-west-1",
      "decision": "DENIED"
    },
    {
      "time": "+2d 10:50",
      "principal": "ci-deployer",
      "account": "",
      "action": "autoscaling:StartInstanceRefresh, iam:CreateUser",
      "region": "",
      "decision": "allowed, implicitDeny"
    }
  ],
  "users": [
    {
      "name": "svc-backup-legacy",
      "console": false,
      "mfa": false,
      "keys": 1,
      "active_keys": 1,
      "newest_key": "AKIAZ3OPS461AF727E57",
      "oldest_key_days": 0,
      "admin": false,
      "policies": "AmazonS3ReadOnlyAccess",
      "backdoor": false
    },
    {
      "name": "ci-deployer",
      "console": false,
      "mfa": false,
      "keys": 1,
      "active_keys": 0,
      "newest_key": "AKIAZ3OPS4CIDEPLOY77",
      "oldest_key_days": 0,
      "admin": false,
      "policies": "ci-deployer-scoped",
      "backdoor": false
    },
    {
      "name": "j.smith",
      "console": true,
      "mfa": false,
      "keys": 1,
      "active_keys": 1,
      "newest_key": "AKIAZ3OPS4JSMITH0042",
      "oldest_key_days": 96,
      "admin": false,
      "policies": "PowerUserAccess",
      "backdoor": false
    },
    {
      "name": "support-sync",
      "console": false,
      "mfa": false,
      "keys": 1,
      "active_keys": 1,
      "newest_key": "AKIAZ3OPS4BACKDOOR01",
      "oldest_key_days": 0,
      "admin": true,
      "policies": "AdministratorAccess",
      "backdoor": true
    }
  ],
  "roles": [
    {
      "name": "OpsEngineer",
      "policies": "PowerUserAccess",
      "inline": 0,
      "trust": "{\"Federated\": \"arn:aws:iam::666666666666:saml-provider/AWSSS",
      "oidc": false,
      "admin": false
    },
    {
      "name": "AWSReservedSSO_ReadOnly_8a1f",
      "policies": "ReadOnlyAccess",
      "inline": 0,
      "trust": "{\"Federated\": \"arn:aws:iam::666666666666:saml-provider/AWSSS",
      "oidc": false,
      "admin": false
    },
    {
      "name": "ssm-managed-instance",
      "policies": "AmazonSSMManagedInstanceCore, CloudWatchAgentServerPolicy",
      "inline": 0,
      "trust": "{\"Service\": \"ec2.amazonaws.com\"}",
      "oidc": false,
      "admin": false
    },
    {
      "name": "app-report-role",
      "policies": "CloudWatchAgentServerPolicy, AmazonSSMManagedInstanceCore",
      "inline": 0,
      "trust": "{\"Service\": \"ec2.amazonaws.com\"}",
      "oidc": false,
      "admin": false
    },
    {
      "name": "AWSBackupDefaultServiceRole",
      "policies": "AWSBackupServiceRolePolicyForBackup",
      "inline": 0,
      "trust": "{\"Service\": \"backup.amazonaws.com\"}",
      "oidc": false,
      "admin": false
    },
    {
      "name": "imagebuilder-instance-role",
      "policies": "AmazonSSMManagedInstanceCore, EC2InstanceProfileForImageBuilder",
      "inline": 0,
      "trust": "{\"Service\": \"ec2.amazonaws.com\"}",
      "oidc": false,
      "admin": false
    }
  ],
  "permission_sets": [
    {
      "name": "CloudOpsEngineer",
      "duration": "PT4H",
      "policies": "ReadOnlyAccess +inline",
      "version": 3,
      "accounts": 1,
      "stale": 0,
      "assignments": 1
    }
  ],
  "assignments": [
    {
      "account": "prod-payments",
      "permission_set": "CloudOpsEngineer",
      "type": "GROUP",
      "principal": "g-cloudops"
    }
  ],
  "oidc_providers": [
    {
      "url": "https://token.actions.githubusercontent.com",
      "audience": "sts.amazonaws.com"
    }
  ],
  "root": {
    "mfa": true,
    "access_keys": 0
  },
  "secrets": [
    {
      "name": "prod/nightly-export/aws-key",
      "consumer": "nightly-export",
      "versions": 1,
      "key": "AKIAZ3OPS4LEGACY0001"
    },
    {
      "name": "prod/payments/db",
      "consumer": "payments-api",
      "versions": 4,
      "key": ""
    }
  ],
  "jobs": [
    {
      "job": "nightly-export",
      "time": "02:30",
      "key": "AKIAZ3OPS4LEGACY0001",
      "ok": true
    },
    {
      "job": "nightly-export",
      "time": "+1d 02:30",
      "key": "AKIAZ3OPS4LEGACY0001",
      "ok": true
    },
    {
      "job": "nightly-export",
      "time": "+2d 02:30",
      "key": "AKIAZ3OPS4LEGACY0001",
      "ok": false
    }
  ],
  "buckets": [
    {
      "name": "acme-tfstate-prod",
      "public": false,
      "block_all": true,
      "policy": false,
      "versioning": "Enabled",
      "managed_by": "console"
    },
    {
      "name": "acme-cloudtrail-logs",
      "public": false,
      "block_all": true,
      "policy": false,
      "versioning": "Enabled",
      "managed_by": "console"
    },
    {
      "name": "acme-reports-export",
      "public": false,
      "block_all": false,
      "policy": true,
      "versioning": "Suspended",
      "managed_by": "terraform"
    },
    {
      "name": "acme-backups",
      "public": false,
      "block_all": true,
      "policy": false,
      "versioning": "Enabled",
      "managed_by": "console"
    },
    {
      "name": "acme-s3-access-logs",
      "public": false,
      "block_all": true,
      "policy": false,
      "versioning": "Enabled",
      "managed_by": "console"
    }
  ],
  "account_pab": true,
  "vpcs": [
    {
      "id": "vpc-0prod20a1b2c3d4e",
      "name": "vpc-prod-payments",
      "cidr": "10.20.0.0/16",
      "account": "666666666666"
    },
    {
      "id": "vpc-0shared30f6e5d4c",
      "name": "vpc-shared-services",
      "cidr": "10.30.0.0/16",
      "account": "555555555555"
    }
  ],
  "subnets": [
    {
      "id": "subnet-0pub-a",
      "name": "prod-public-a",
      "cidr": "10.20.0.0/24",
      "az": "eu-west-1a",
      "route_table": "rtb-0public",
      "acl": "acl-0default-prod",
      "public": true
    },
    {
      "id": "subnet-0pub-b",
      "name": "prod-public-b",
      "cidr": "10.20.1.0/24",
      "az": "eu-west-1b",
      "route_table": "rtb-0public",
      "acl": "acl-0default-prod",
      "public": true
    },
    {
      "id": "subnet-0app-a",
      "name": "prod-app-a",
      "cidr": "10.20.10.0/24",
      "az": "eu-west-1a",
      "route_table": "rtb-0app-a",
      "acl": "acl-0default-prod",
      "public": false
    },
    {
      "id": "subnet-0app-b",
      "name": "prod-app-b",
      "cidr": "10.20.11.0/24",
      "az": "eu-west-1b",
      "route_table": "rtb-0app-b",
      "acl": "acl-0default-prod",
      "public": false
    },
    {
      "id": "subnet-0data-a",
      "name": "prod-data-a",
      "cidr": "10.20.20.0/24",
      "az": "eu-west-1a",
      "route_table": "rtb-0data",
      "acl": "acl-0data",
      "public": false
    },
    {
      "id": "subnet-0data-b",
      "name": "prod-data-b",
      "cidr": "10.20.21.0/24",
      "az": "eu-west-1b",
      "route_table": "rtb-0data",
      "acl": "acl-0data",
      "public": false
    }
  ],
  "routes": [
    {
      "table": "rt-prod-public",
      "id": "rtb-0public",
      "destination": "10.20.0.0/16",
      "target": "local",
      "subnets": "prod-public-a, prod-public-b"
    },
    {
      "table": "rt-prod-public",
      "id": "rtb-0public",
      "destination": "0.0.0.0/0",
      "target": "igw-0prod1a2b3c",
      "subnets": "prod-public-a, prod-public-b"
    },
    {
      "table": "rt-prod-app-a",
      "id": "rtb-0app-a",
      "destination": "10.20.0.0/16",
      "target": "local",
      "subnets": "prod-app-a"
    },
    {
      "table": "rt-prod-app-a",
      "id": "rtb-0app-a",
      "destination": "0.0.0.0/0",
      "target": "nat-0prod-a",
      "subnets": "prod-app-a"
    },
    {
      "table": "rt-prod-app-a",
      "id": "rtb-0app-a",
      "destination": "10.30.0.0/16",
      "target": "tgw-0acme9f8e7d6c5b4a",
      "subnets": "prod-app-a"
    },
    {
      "table": "rt-prod-app-a",
      "id": "rtb-0app-a",
      "destination": "192.168.0.0/16",
      "target": "tgw-0acme9f8e7d6c5b4a",
      "subnets": "prod-app-a"
    }
  ],
  "tgw_routes": [
    {
      "table": "core",
      "destination": "10.20.0.0/16",
      "attachment": "tgw-attach-0prod",
      "type": "propagated",
      "blackhole": false
    },
    {
      "table": "core",
      "destination": "10.30.0.0/16",
      "attachment": "tgw-attach-0shared",
      "type": "propagated",
      "blackhole": false
    },
    {
      "table": "core",
      "destination": "192.168.0.0/16",
      "attachment": "tgw-attach-0vpn",
      "type": "propagated",
      "blackhole": false
    }
  ],
  "endpoints": [
    {
      "id": "vpce-0ssm3d4e",
      "service": "ssm",
      "type": "Interface",
      "vpc": "vpc-0prod20a1b2c3d4e",
      "private_dns": true,
      "route_tables": 0,
      "subnets": 2
    },
    {
      "id": "vpce-0ssmmes3d4e",
      "service": "ssmmessages",
      "type": "Interface",
      "vpc": "vpc-0prod20a1b2c3d4e",
      "private_dns": true,
      "route_tables": 0,
      "subnets": 2
    },
    {
      "id": "vpce-0ec2mes3d4e",
      "service": "ec2messages",
      "type": "Interface",
      "vpc": "vpc-0prod20a1b2c3d4e",
      "private_dns": true,
      "route_tables": 0,
      "subnets": 2
    },
    {
      "id": "vpce-0ssm5d4c",
      "service": "ssm",
      "type": "Interface",
      "vpc": "vpc-0shared30f6e5d4c",
      "private_dns": true,
      "route_tables": 0,
      "subnets": 2
    },
    {
      "id": "vpce-0ssmmes5d4c",
      "service": "ssmmessages",
      "type": "Interface",
      "vpc": "vpc-0shared30f6e5d4c",
      "private_dns": true,
      "route_tables": 0,
      "subnets": 2
    },
    {
      "id": "vpce-0ec2mes5d4c",
      "service": "ec2messages",
      "type": "Interface",
      "vpc": "vpc-0shared30f6e5d4c",
      "private_dns": true,
      "route_tables": 0,
      "subnets": 2
    }
  ],
  "security_groups": [
    {
      "id": "sg-0alb",
      "name": "sg-alb",
      "vpc": "vpc-0prod20a1b2c3d4e",
      "ingress": "tcp 443-443 0.0.0.0/0",
      "rules": 1,
      "open_admin": false,
      "managed_by": "console"
    },
    {
      "id": "sg-0web",
      "name": "sg-web",
      "vpc": "vpc-0prod20a1b2c3d4e",
      "ingress": "tcp 443-443 sg-0alb; tcp 3389-3389 sg-0bastion",
      "rules": 2,
      "open_admin": false,
      "managed_by": "console"
    },
    {
      "id": "sg-0app",
      "name": "sg-app",
      "vpc": "vpc-0prod20a1b2c3d4e",
      "ingress": "tcp 8443-8443 sg-0web; tcp 3389-3389 sg-0bastion",
      "rules": 2,
      "open_admin": false,
      "managed_by": "console"
    },
    {
      "id": "sg-0sql",
      "name": "sg-sql",
      "vpc": "vpc-0prod20a1b2c3d4e",
      "ingress": "tcp 1433-1433 sg-0app; tcp 5022-5022 sg-0sql",
      "rules": 2,
      "open_admin": false,
      "managed_by": "console"
    },
    {
      "id": "sg-0bastion",
      "name": "sg-bastion",
      "vpc": "vpc-0prod20a1b2c3d4e",
      "ingress": "(none)",
      "rules": 0,
      "open_admin": false,
      "managed_by": "console"
    },
    {
      "id": "sg-0api",
      "name": "sg-payments-api",
      "vpc": "vpc-0prod20a1b2c3d4e",
      "ingress": "tcp 8080-8080 sg-0alb",
      "rules": 1,
      "open_admin": false,
      "managed_by": "console"
    }
  ],
  "nacl_rules": [
    {
      "acl": "acl-0default-prod",
      "direction": "inbound",
      "rule": 100,
      "protocol": "-1",
      "ports": "0-65535",
      "cidr": "0.0.0.0/0",
      "action": "allow"
    },
    {
      "acl": "acl-0default-prod",
      "direction": "outbound",
      "rule": 100,
      "protocol": "-1",
      "ports": "0-65535",
      "cidr": "0.0.0.0/0",
      "action": "allow"
    },
    {
      "acl": "acl-0data",
      "direction": "inbound",
      "rule": 100,
      "protocol": "tcp",
      "ports": "1433-1433",
      "cidr": "10.20.10.0/23",
      "action": "allow"
    },
    {
      "acl": "acl-0data",
      "direction": "inbound",
      "rule": 110,
      "protocol": "tcp",
      "ports": "1024-65535",
      "cidr": "10.20.0.0/16",
      "action": "allow"
    },
    {
      "acl": "acl-0data",
      "direction": "inbound",
      "rule": 120,
      "protocol": "tcp",
      "ports": "5022-5022",
      "cidr": "10.20.20.0/23",
      "action": "allow"
    },
    {
      "acl": "acl-0data",
      "direction": "inbound",
      "rule": 130,
      "protocol": "-1",
      "ports": "0-65535",
      "cidr": "10.30.0.0/16",
      "action": "allow"
    }
  ],
  "analyses": [
    {
      "id": "nia-0925b49dbe066",
      "source": "win-app-01",
      "destination": "sql.acme.internal",
      "port": 1433,
      "found": true,
      "blocked_at": "",
      "reason": "",
      "time": "+2d 10:50"
    },
    {
      "id": "nia-0f85c5de0f42e",
      "source": "win-app-01",
      "destination": "10.30.1.10",
      "port": 389,
      "found": true,
      "blocked_at": "",
      "reason": "",
      "time": "+2d 10:50"
    },
    {
      "id": "nia-0f85c5de0f42e",
      "source": "win-app-01",
      "destination": "10.30.1.10",
      "port": 389,
      "found": true,
      "blocked_at": "",
      "reason": "",
      "time": "+2d 10:50"
    },
    {
      "id": "nia-0dbc964388d45",
      "source": "win-app-01",
      "destination": "192.168.10.25",
      "port": 445,
      "found": true,
      "blocked_at": "",
      "reason": "",
      "time": "+2d 10:50"
    },
    {
      "id": "nia-020a23d978e45",
      "source": "win-sql-01",
      "destination": "internet",
      "port": 443,
      "found": false,
      "blocked_at": "acl-0data outbound",
      "reason": "tcp/443 to 8.8.8.8: rule * (the implicit deny - no rule matched)",
      "time": "+2d 10:50"
    },
    {
      "id": "nia-024d68375b0c8",
      "source": "win-sql-01",
      "destination": "service:s3",
      "port": 443,
      "found": false,
      "blocked_at": "acl-0data outbound",
      "reason": "tcp/443 to 52.218.0.10: rule * (the implicit deny - no rule matched)",
      "time": "+2d 10:50"
    }
  ],
  "vpn": [
    {
      "id": "vpn-0onprem",
      "tunnels_up": 2,
      "routing": "bgp"
    }
  ],
  "dns": {
    "private_records": 5
  },
  "zones": [
    {
      "name": "acme.internal.",
      "private": true,
      "records": 5,
      "vpcs": 2
    },
    {
      "name": "acme.example.",
      "private": false,
      "records": 1,
      "vpcs": 0
    }
  ],
  "instances": [
    {
      "id": "i-0winweb01a1",
      "name": "win-web-01",
      "state": "running",
      "type": "m5.large",
      "os": "Windows Server 2022",
      "ip": "10.20.10.11",
      "subnet": "subnet-0app-a",
      "region": "eu-west-1",
      "patch_group": "prod-web",
      "ssm": "Online",
      "ssm_reason": "via interface endpoints",
      "baseline": "acme-windows-prod",
      "missing": 4,
      "compliance": "NON_COMPLIANT",
      "health": "Healthy",
      "asg": "",
      "ami": "ami-0win2022base2026",
      "tags": 6,
      "cost_center": "CC-PAY-001",
      "sgs": "sg-0web",
      "quarantined": false,
      "compromised": false,
      "evidence_lost": false,
      "snapshot": false,
      "c2_blocked": false,
      "protected": false
    },
    {
      "id": "i-0winweb02a1",
      "name": "win-web-02",
      "state": "running",
      "type": "m5.large",
      "os": "Windows Server 2022",
      "ip": "10.20.11.11",
      "subnet": "subnet-0app-b",
      "region": "eu-west-1",
      "patch_group": "prod-web",
      "ssm": "Online",
      "ssm_reason": "via interface endpoints",
      "baseline": "acme-windows-prod",
      "missing": 4,
      "compliance": "NON_COMPLIANT",
      "health": "Healthy",
      "asg": "",
      "ami": "ami-0win2022base2026",
      "tags": 5,
      "cost_center": "CC-PAY-001",
      "sgs": "sg-0web",
      "quarantined": false,
      "compromised": false,
      "evidence_lost": false,
      "snapshot": false,
      "c2_blocked": false,
      "protected": false
    },
    {
      "id": "i-0winweb03a1",
      "name": "win-web-03",
      "state": "running",
      "type": "m5.xlarge",
      "os": "Windows Server 2022",
      "ip": "10.20.10.12",
      "subnet": "subnet-0app-a",
      "region": "eu-west-1",
      "patch_group": "prod-web",
      "ssm": "Online",
      "ssm_reason": "via interface endpoints",
      "baseline": "acme-windows-prod",
      "missing": 4,
      "compliance": "NON_COMPLIANT",
      "health": "Healthy",
      "asg": "",
      "ami": "ami-0win2022base2026",
      "tags": 5,
      "cost_center": "CC-PAY-001",
      "sgs": "sg-0web",
      "quarantined": false,
      "compromised": false,
      "evidence_lost": false,
      "snapshot": false,
      "c2_blocked": false,
      "protected": false
    },
    {
      "id": "i-0winweb04a1",
      "name": "win-web-04",
      "state": "running",
      "type": "m5.xlarge",
      "os": "Windows Server 2022",
      "ip": "10.20.11.12",
      "subnet": "subnet-0app-b",
      "region": "eu-west-1",
      "patch_group": "prod-web",
      "ssm": "Online",
      "ssm_reason": "via interface endpoints",
      "baseline": "acme-windows-prod",
      "missing": 4,
      "compliance": "NON_COMPLIANT",
      "health": "Healthy",
      "asg": "",
      "ami": "ami-0win2022base2026",
      "tags": 5,
      "cost_center": "CC-PAY-001",
      "sgs": "sg-0web",
      "quarantined": false,
      "compromised": false,
      "evidence_lost": false,
      "snapshot": false,
      "c2_blocked": false,
      "protected": false
    },
    {
      "id": "i-0winapp01a1",
      "name": "win-app-01",
      "state": "running",
      "type": "m5.large",
      "os": "Windows Server 2022",
      "ip": "10.20.10.21",
      "subnet": "subnet-0app-a",
      "region": "eu-west-1",
      "patch_group": "prod-app",
      "ssm": "Online",
      "ssm_reason": "via interface endpoints",
      "baseline": "acme-windows-prod",
      "missing": 5,
      "compliance": "NON_COMPLIANT",
      "health": "Healthy",
      "asg": "",
      "ami": "ami-0win2022base2026",
      "tags": 6,
      "cost_center": "CC-PAY-001",
      "sgs": "sg-0app",
      "quarantined": false,
      "compromised": false,
      "evidence_lost": false,
      "snapshot": false,
      "c2_blocked": false,
      "protected": false
    },
    {
      "id": "i-0winapp02a1",
      "name": "win-app-02",
      "state": "running",
      "type": "m5.large",
      "os": "Windows Server 2022",
      "ip": "10.20.11.21",
      "subnet": "subnet-0app-b",
      "region": "eu-west-1",
      "patch_group": "prod-app",
      "ssm": "Online",
      "ssm_reason": "via interface endpoints",
      "baseline": "acme-windows-prod",
      "missing": 5,
      "compliance": "NON_COMPLIANT",
      "health": "Healthy",
      "asg": "",
      "ami": "ami-0win2022base2026",
      "tags": 5,
      "cost_center": "CC-PAY-001",
      "sgs": "sg-0app",
      "quarantined": false,
      "compromised": false,
      "evidence_lost": false,
      "snapshot": false,
      "c2_blocked": false,
      "protected": false
    }
  ],
  "asgs": [
    {
      "name": "asg-payments-api",
      "health_check": "ELB",
      "grace": 300,
      "desired": 3,
      "running": 3,
      "healthy": 3,
      "unhealthy": 0,
      "lt_version": "$Latest",
      "refresh": "Successful",
      "refresh_version": 2,
      "replaced": 4
    }
  ],
  "launch_templates": [
    {
      "name": "lt-payments-api",
      "default": 1,
      "latest": 2,
      "ami": "ami-0payapi20261010"
    }
  ],
  "snapshots": [
    {
      "id": "snap-0226311ef058ca058",
      "instance": "",
      "time": "01:40"
    },
    {
      "id": "snap-04087260f834b7917",
      "instance": "",
      "time": "01:40"
    },
    {
      "id": "snap-004dc22449af2305b",
      "instance": "",
      "time": "01:40"
    }
  ],
  "amis": [
    {
      "id": "ami-0win2022base2026",
      "name": "Windows_Server-2022-English-Full-Base-2026.07.10",
      "owner": "amazon",
      "patched_days_ago": 96
    },
    {
      "id": "ami-0win2019base2025",
      "name": "Windows_Server-2019-English-Full-Base-2025.11.12",
      "owner": "amazon",
      "patched_days_ago": 336
    },
    {
      "id": "ami-0payapi20260901",
      "name": "payments-api-golden-2026.09.01",
      "owner": "self",
      "patched_days_ago": 43
    },
    {
      "id": "ami-0payapi20261010",
      "name": "payments-api-golden-2026.10.10",
      "owner": "self",
      "patched_days_ago": 4
    },
    {
      "id": "ami-0bd4796a049e56177",
      "name": "payments-api-golden-+2d 1700",
      "owner": "self",
      "patched_days_ago": 0
    }
  ],
  "patch_baselines": [
    {
      "id": "pb-0b9d5d1b4f3e8a2c1",
      "name": "AWS-DefaultPatchBaseline",
      "os": "WINDOWS",
      "default": true,
      "rules": "CriticalUpdates/SecurityUpdates Critical/Important after 7d",
      "groups": ""
    },
    {
      "id": "pb-0e48d1447e8f0d67c",
      "name": "acme-windows-prod",
      "os": "WINDOWS",
      "default": false,
      "rules": "CriticalUpdates/SecurityUpdates Critical/Important after 7d",
      "groups": "prod-web, prod-app, prod-sql, prod-sql-b, shared-dc, shared-dc-b"
    }
  ],
  "maintenance_windows": [
    {
      "name": "patch-wave-a",
      "schedule": "cron(0 2 ? * MON *)",
      "duration": 4,
      "cutoff": 1,
      "targets": 1,
      "tasks": 1,
      "concurrency": "3",
      "executions": 0,
      "next": "+7d 02:00"
    },
    {
      "name": "patch-wave-b",
      "schedule": "cron(0 4 ? * MON *)",
      "duration": 2,
      "cutoff": 1,
      "targets": 1,
      "tasks": 1,
      "concurrency": "1",
      "executions": 0,
      "next": "+7d 04:00"
    }
  ],
  "commands": [
    {
      "id": "811b6e7b-8848",
      "document": "AWS-RunPatchBaseline",
      "operation": "Scan",
      "origin": "send-command",
      "status": "Success",
      "targets": 17,
      "succeeded": 17,
      "failed": 0,
      "concurrency": "50%"
    }
  ],
  "sessions": [
    {
      "id": "ops.engineer-9dda2d03bcdc83d5e",
      "instance": "win-file-01",
      "started": "03:35",
      "logged": false,
      "commands": 4,
      "status": "ended"
    },
    {
      "id": "ops.engineer-f5273acb9cdc22435",
      "instance": "win-file-01",
      "started": "+2d 11:55",
      "logged": true,
      "commands": 3,
      "status": "ended"
    }
  ],
  "session_logging": true,
  "patching": {
    "windows_servers": 16,
    "managed": 16,
    "compliant": 0,
    "outages_caused": 0
  },
  "image_builds": [
    {
      "pipeline": "payments-api-weekly",
      "status": "FAILED",
      "ami": "",
      "patched": true,
      "tests": true,
      "reason": "The build instance role lacks EC2InstanceProfileForImageBuilder",
      "started": "+2d 15:25"
    },
    {
      "pipeline": "payments-api-weekly",
      "status": "AVAILABLE",
      "ami": "ami-0bd4796a049e56177",
      "patched": true,
      "tests": true,
      "reason": "",
      "started": "+2d 16:15"
    }
  ],
  "image_pipelines": [
    {
      "name": "payments-api-weekly",
      "schedule": "cron(0 4 ? * SUN *)",
      "tests": true
    }
  ],
  "image_recipes": [
    {
      "name": "payments-api-golden",
      "platform": "Linux",
      "components": "update-linux, acme-cis-hardening, amazon-cloudwatch-agent-linux, simple-boot-test-linux"
    }
  ],
  "vaults": [
    {
      "name": "Default",
      "region": "eu-west-1",
      "locked": false,
      "min_days": "",
      "points": 0
    },
    {
      "name": "prod-vault",
      "region": "eu-west-1",
      "locked": true,
      "min_days": 30,
      "points": 5
    },
    {
      "name": "dr-vault",
      "region": "eu-central-1",
      "locked": false,
      "min_days": "",
      "points": 5
    }
  ],
  "backup_plans": [
    {
      "name": "acme-gold",
      "rules": 1,
      "schedule": "cron(0 */4 ? * * *)",
      "copy": "eu-central-1",
      "retention": "35"
    }
  ],
  "backup_jobs": [
    {
      "id": "9BF50B4B",
      "resource": "win-web-01",
      "vault": "prod-vault",
      "state": "COMPLETED",
      "origin": "plan acme-gold",
      "message": "",
      "time": "+2d 20:00"
    },
    {
      "id": "FE4FCA02",
      "resource": "win-app-01",
      "vault": "prod-vault",
      "state": "COMPLETED",
      "origin": "plan acme-gold",
      "message": "",
      "time": "+2d 20:00"
    },
    {
      "id": "A107B05E",
      "resource": "win-sql-01",
      "vault": "prod-vault",
      "state": "COMPLETED",
      "origin": "plan acme-gold",
      "message": "",
      "time": "+2d 20:00"
    },
    {
      "id": "1C72C7BE",
      "resource": "win-sql-02",
      "vault": "prod-vault",
      "state": "COMPLETED",
      "origin": "plan acme-gold",
      "message": "",
      "time": "+2d 20:00"
    },
    {
      "id": "F8F698D9",
      "resource": "win-file-01",
      "vault": "prod-vault",
      "state": "COMPLETED",
      "origin": "plan acme-gold",
      "message": "",
      "time": "+2d 20:00"
    }
  ],
  "restores": [
    {
      "id": "A3D8A446-9FAD",
      "resource": "win-sql-01",
      "status": "COMPLETED",
      "minutes": 68,
      "validation": "SUCCESSFUL",
      "region": "eu-west-1"
    }
  ],
  "workloads": [
    {
      "name": "payments",
      "strategy": "pilot-light",
      "rto_target": "2h",
      "rpo_target": "15m",
      "rto": "35m",
      "rpo": "1m",
      "meets": true
    },
    {
      "name": "file-services",
      "strategy": "backup-restore",
      "rto_target": "8h",
      "rpo_target": "4h",
      "rto": "unknown",
      "rpo": "4h",
      "meets": false
    },
    {
      "name": "reporting",
      "strategy": "backup-restore",
      "rto_target": "24h",
      "rpo_target": "24h",
      "rto": "unknown",
      "rpo": "none",
      "meets": false
    }
  ],
  "dr_tests": [
    {
      "workload": "payments",
      "strategy": "backup-restore",
      "rto": "1h53m",
      "rpo": "3h25m",
      "met": false,
      "reason": "RTO 1h53m vs target 2h, RPO 3h25m vs target 15m",
      "time": "+2d 23:25"
    },
    {
      "workload": "file-services",
      "strategy": "backup-restore",
      "rto": "1h16m",
      "rpo": "3h25m",
      "met": true,
      "reason": "",
      "time": "+2d 23:25"
    },
    {
      "workload": "payments",
      "strategy": "pilot-light",
      "rto": "35m",
      "rpo": "1m",
      "met": true,
      "reason": "",
      "time": "+2d 23:25"
    }
  ],
  "terraform": {
    "initialised": true,
    "backend": "s3",
    "bucket": "acme-tfstate-prod",
    "key": "ops/platform/terraform.tfstate",
    "locking": "dynamodb",
    "lock_table": "tf-locks",
    "locked_by": "",
    "lock_id": "",
    "serial": 8,
    "resources": 5,
    "orphans": 0,
    "unsafe": 0,
    "last_plan": "plan",
    "drift_detected": 0
  },
  "tf_resources": [
    {
      "address": "aws_s3_bucket.reports",
      "type": "aws_s3_bucket",
      "id": "acme-reports-export",
      "module": "",
      "drift": false
    },
    {
      "address": "aws_security_group.ops_tools",
      "type": "aws_security_group",
      "id": "sg-0361e27b9c32d",
      "module": "",
      "drift": false
    },
    {
      "address": "aws_ssm_parameter.release",
      "type": "aws_ssm_parameter",
      "id": "/platform/release",
      "module": "",
      "drift": false
    },
    {
      "address": "module.alerts.aws_sns_topic.this",
      "type": "aws_sns_topic",
      "id": "ops-alerts",
      "module": "alerts",
      "drift": false
    },
    {
      "address": "module.alerts.aws_ssm_parameter.topic_name",
      "type": "aws_ssm_parameter",
      "id": "/platform/alerts/topic",
      "module": "alerts",
      "drift": false
    }
  ],
  "tf_history": [
    {
      "at": 4185,
      "who": "ops.engineer",
      "what": "plan: 4 add",
      "time": "+2d 23:25"
    },
    {
      "at": 4195,
      "who": "a.khan",
      "what": "apply complete (teammate)",
      "time": "+2d 23:35"
    },
    {
      "at": 4195,
      "who": "ops.engineer",
      "what": "plan: 4 add",
      "time": "+2d 23:35"
    },
    {
      "at": 4195,
      "who": "ops.engineer",
      "what": "import aws_s3_bucket.reports acme-reports-export",
      "time": "+2d 23:35"
    },
    {
      "at": 4195,
      "who": "ops.engineer",
      "what": "plan: 3 add, 1 change",
      "time": "+2d 23:35"
    },
    {
      "at": 4195,
      "who": "ops.engineer",
      "what": "apply: 3 added, 1 changed, 0 destroyed",
      "time": "+2d 23:35"
    }
  ],
  "tf_orphans": [],
  "stacks": [
    {
      "name": "CDKToolkit",
      "status": "CREATE_COMPLETE",
      "resources": 0,
      "drift": "NOT_CHECKED",
      "protected": false,
      "exports": 0,
      "origin": "cdk",
      "ssm_params": 0,
      "retained": 0
    }
  ],
  "changesets": [
    {
      "name": "rename-bucket",
      "stack": "ops-baseline",
      "type": "UPDATE",
      "changes": 1,
      "replacements": 1,
      "executed": false
    },
    {
      "name": "add-https",
      "stack": "ops-baseline",
      "type": "UPDATE",
      "changes": 1,
      "replacements": 0,
      "executed": true
    }
  ],
  "runs": [
    {
      "id": 1,
      "event": "pull_request",
      "ref": "refs/pull/42/merge",
      "status": "failure",
      "role": "",
      "planned": false,
      "applied": false,
      "static_keys": true,
      "repo": "acme-pay/platform-infra"
    },
    {
      "id": 2,
      "event": "pull_request",
      "ref": "refs/pull/42/merge",
      "status": "failure",
      "role": "",
      "planned": false,
      "applied": false,
      "static_keys": true,
      "repo": "acme-pay/platform-infra"
    },
    {
      "id": 3,
      "event": "pull_request",
      "ref": "refs/pull/42/merge",
      "status": "failure",
      "role": "",
      "planned": false,
      "applied": false,
      "static_keys": true,
      "repo": "acme-pay/some-fork"
    },
    {
      "id": 4,
      "event": "push",
      "ref": "refs/heads/main",
      "status": "failure",
      "role": "",
      "planned": false,
      "applied": false,
      "static_keys": true,
      "repo": "acme-pay/platform-infra"
    }
  ],
  "ownership": [
    {
      "type": "aws_s3_bucket",
      "resource": "acme-tfstate-prod",
      "managed_by": "console",
      "conflict": false
    },
    {
      "type": "aws_s3_bucket",
      "resource": "acme-cloudtrail-logs",
      "managed_by": "console",
      "conflict": false
    },
    {
      "type": "aws_s3_bucket",
      "resource": "acme-reports-export",
      "managed_by": "terraform",
      "conflict": false
    },
    {
      "type": "aws_s3_bucket",
      "resource": "acme-backups",
      "managed_by": "console",
      "conflict": false
    },
    {
      "type": "aws_s3_bucket",
      "resource": "acme-s3-access-logs",
      "managed_by": "console",
      "conflict": false
    },
    {
      "type": "aws_security_group",
      "resource": "sg-0361e27b9c32d",
      "managed_by": "terraform",
      "conflict": false
    }
  ],
  "parameters": [
    {
      "name": "/platform/alerts/topic",
      "value": "ops-alerts",
      "managed_by": "terraform"
    },
    {
      "name": "/platform/release",
      "value": "2026.10.12",
      "managed_by": "terraform"
    }
  ],
  "dynamodb_tables": [
    {
      "name": "tf-locks",
      "hash_key": "LockID",
      "billing": "PAY_PER_REQUEST"
    }
  ],
  "security": {
    "hub": true,
    "standards": 1,
    "cis": true,
    "score": 76,
    "failed_controls": 4,
    "guardduty": true,
    "findings": 4,
    "config_recording": true,
    "ebs_encryption": true,
    "flow_logs": 1
  },
  "controls": [
    {
      "id": "IAM.4",
      "title": "IAM root user access key should not exist",
      "severity": "CRITICAL",
      "status": "PASSED",
      "failed": 0,
      "suppressed": 0
    },
    {
      "id": "IAM.9",
      "title": "MFA should be enabled for the root user",
      "severity": "CRITICAL",
      "status": "PASSED",
      "failed": 0,
      "suppressed": 0
    },
    {
      "id": "IAM.3",
      "title": "IAM users' access keys should be rotated every 90 days or less",
      "severity": "MEDIUM",
      "status": "FAILED",
      "failed": 1,
      "suppressed": 0
    },
    {
      "id": "IAM.5",
      "title": "MFA should be enabled for all IAM users that have a console password",
      "severity": "MEDIUM",
      "status": "FAILED",
      "failed": 1,
      "suppressed": 0
    },
    {
      "id": "IAM.15",
      "title": "Ensure IAM password policy requires minimum password length of 14 or greater",
      "severity": "MEDIUM",
      "status": "PASSED",
      "failed": 0,
      "suppressed": 0
    },
    {
      "id": "IAM.1",
      "title": "IAM policies should not allow full \"*\" administrative privileges (attached to users)",
      "severity": "HIGH",
      "status": "FAILED",
      "failed": 1,
      "suppressed": 0
    }
  ],
  "findings": [
    {
      "type": "UnauthorizedAccess:IAMUser/TorIPCaller",
      "severity": 5.0,
      "resource": "AKIAZ3OPS4CIDEPLOY77",
      "region": "eu-west-1",
      "archived": false,
      "time": "+2d 23:35"
    },
    {
      "type": "Impact:IAMUser/AnomalousBehavior",
      "severity": 8.0,
      "resource": "AKIAZ3OPS4CIDEPLOY77",
      "region": "eu-west-1",
      "archived": false,
      "time": "+2d 23:35"
    },
    {
      "type": "Policy:S3/BucketAnonymousAccessGranted",
      "severity": 7.0,
      "resource": "acme-reports-export",
      "region": "eu-west-1",
      "archived": false,
      "time": "+2d 23:35"
    },
    {
      "type": "Policy:S3/BucketBlockPublicAccessDisabled",
      "severity": 4.0,
      "resource": "acme-reports-export",
      "region": "eu-west-1",
      "archived": false,
      "time": "+2d 23:35"
    }
  ],
  "config_rules": [
    {
      "name": "restricted-common-ports",
      "source": "RESTRICTED_INCOMING_TRAFFIC",
      "non_compliant": 0,
      "evaluated": 10,
      "status": "COMPLIANT",
      "remediation": true
    }
  ],
  "trails": [
    {
      "name": "legacy-trail",
      "multi_region": false,
      "validation": true,
      "organization": false,
      "logging": true,
      "bucket": "acme-cloudtrail-logs"
    },
    {
      "name": "org-trail",
      "multi_region": true,
      "validation": true,
      "organization": true,
      "logging": true,
      "bucket": "acme-cloudtrail-logs"
    }
  ],
  "web_acls": [],
  "waf_replays": [],
  "playbook": [
    {
      "at": 1990,
      "step": "key-deactivated",
      "ref": "AKIAZ3OPS4LEGACY0001",
      "time": "+1d 10:50"
    },
    {
      "at": 3430,
      "step": "key-deleted",
      "ref": "AKIAZ3OPS4LEGACY0001",
      "time": "+2d 10:50"
    },
    {
      "at": 4195,
      "step": "key-deactivated",
      "ref": "AKIAZ3OPS4CIDEPLOY77",
      "time": "+2d 23:35"
    },
    {
      "at": 4195,
      "step": "account-pab",
      "ref": "666666666666",
      "time": "+2d 23:35"
    }
  ],
  "ir": {
    "contained_before_deleted": true,
    "evidence_lost": 0,
    "rogue_running": 3,
    "backdoor_users": 1
  },
  "grc_register": [
    {
      "incident": "INC0010001",
      "major": true,
      "personal_data": true,
      "notified": "regulator, dpa",
      "deadlines": "dora-initial 05:40, gdpr-dpa +3d 01:40"
    },
    {
      "incident": "INC0010002",
      "major": false,
      "personal_data": false,
      "notified": "",
      "deadlines": ""
    }
  ],
  "notifications": [
    {
      "incident": "INC0010001",
      "to": "regulator",
      "stage": "initial",
      "time": "01:40",
      "late": false
    },
    {
      "incident": "INC0010001",
      "to": "dpa",
      "stage": "initial",
      "time": "01:40",
      "late": false
    }
  ],
  "iso_controls": [
    {
      "control": "A.5.24",
      "title": "Information security incident management planning",
      "status": "evidence",
      "evidence": "on-call escalation policies defined"
    },
    {
      "control": "A.5.26",
      "title": "Response to information security incidents",
      "status": "evidence",
      "evidence": "incidents acknowledged and worked in ServiceNow"
    },
    {
      "control": "A.5.27",
      "title": "Learning from information security incidents",
      "status": "gap",
      "evidence": "PIRs and problem root causes recorded"
    },
    {
      "control": "A.5.28",
      "title": "Collection of evidence",
      "status": "gap",
      "evidence": "forensic snapshots taken before eradication"
    },
    {
      "control": "A.5.30",
      "title": "ICT readiness for business continuity",
      "status": "evidence",
      "evidence": "DR game day met its targets"
    },
    {
      "control": "A.8.8",
      "title": "Management of technical vulnerabilities",
      "status": "gap",
      "evidence": "0 of 16 Windows servers patch compliant"
    }
  ],
  "finops": {
    "monthly": 8407.38,
    "ec2_on_demand_equivalent": 3943.42,
    "ec2_billed": 3943.42,
    "sp_coverage": 0.0,
    "sp_utilization": 0.0,
    "sp_commitment": 0,
    "rds_reserved": 1,
    "untagged_pct": 8.0,
    "tags_active": "CostCenter",
    "rightsizing_open": 4,
    "rightsizing_savings": 639.19
  },
  "bill": [
    {
      "service": "Amazon Elastic Compute Cloud - Compute",
      "monthly": 3943.42
    },
    {
      "service": "Amazon Simple Storage Service",
      "monthly": 1840.0
    },
    {
      "service": "AWS Data Transfer",
      "monthly": 980.0
    },
    {
      "service": "AWS Backup",
      "monthly": 620.0
    },
    {
      "service": "Amazon CloudWatch",
      "monthly": 410.0
    },
    {
      "service": "Amazon GuardDuty",
      "monthly": 310.0
    }
  ],
  "rightsizing": [
    {
      "instance": "win-web-03",
      "id": "i-0winweb03a1",
      "type": "m5.xlarge",
      "action": "Modify",
      "target": "m5.large",
      "cpu_p95": 17.6,
      "saving": 145.27
    },
    {
      "instance": "win-web-04",
      "id": "i-0winweb04a1",
      "type": "m5.xlarge",
      "action": "Modify",
      "target": "m5.large",
      "cpu_p95": 19.2,
      "saving": 145.27
    },
    {
      "instance": "win-app-03",
      "id": "i-0winapp03a1",
      "type": "m5.xlarge",
      "action": "Modify",
      "target": "m5.large",
      "cpu_p95": 22.4,
      "saving": 145.27
    },
    {
      "instance": "win-batch-01",
      "id": "i-0winbatch01a1",
      "type": "m5.xlarge",
      "action": "STOP or schedule",
      "target": "-",
      "cpu_p95": 14.4,
      "saving": 203.38
    }
  ],
  "savings_plans": [
    {
      "id": "sp-0d1a2b3c4d",
      "type": "COMPUTE_SP",
      "term": "ONE_YEAR",
      "payment": "NO_UPFRONT",
      "commitment": 2.34
    }
  ],
  "signals": [
    {
      "at": 1930,
      "time": "+1d 09:50",
      "level": "warning",
      "source": "controltower",
      "message": "Control Tower drift: staging-payments moved to an ungoverned OU",
      "age": "+1d 09:50"
    },
    {
      "at": 2930,
      "time": "+2d 02:30",
      "level": "critical",
      "source": "jobs",
      "message": "nightly-export FAILED at +2d 02:30: its access key AKIAZ3OPS4LEGACY0001 is Inactive",
      "age": "+2d 02:30"
    },
    {
      "at": 2975,
      "time": "+2d 03:15",
      "level": "warning",
      "source": "sla",
      "message": "INC0010002 P3: pick-up SLA at 75% (45m of 1h)",
      "age": "+2d 03:15"
    },
    {
      "at": 2991,
      "time": "+2d 03:31",
      "level": "critical",
      "source": "sla",
      "message": "INC0010002 P3: pick-up SLA BREACHED at +2d 03:31",
      "age": "+2d 03:31"
    },
    {
      "at": 3110,
      "time": "+2d 05:30",
      "level": "warning",
      "source": "sla",
      "message": "INC0010002 P3: response SLA at 75% (3h of 4h)",
      "age": "+2d 05:30"
    },
    {
      "at": 3171,
      "time": "+2d 06:31",
      "level": "critical",
      "source": "sla",
      "message": "INC0010002 P3: response SLA BREACHED at +2d 06:31",
      "age": "+2d 06:31"
    }
  ]
};

// MICROSOFT FABRIC: dumped from app 11's `utils/sims/fabric` `view()` by
// `FABLABS_DUMP=... python _fablabs.py`, which drives and grades all twenty
// fabric labs; each key holds the first non-empty value any lab produced,
// lists trimmed to six rows. `bpa` came back empty (the labs fix every
// finding) and carries one row in the exact shape `model.analyze` builds.
VIEWS.fabric = {
  "probes": [
    {
      "name": "changes",
      "value": 4
    },
    {
      "name": "changes_minus_history",
      "value": 0
    },
    {
      "name": "ci_double_current",
      "value": 0
    },
    {
      "name": "ci_unknown",
      "value": 1
    },
    {
      "name": "fact_minus_silver",
      "value": 0
    },
    {
      "name": "fact_unknown_ci",
      "value": 120
    }
  ],
  "clock": {
    "time": "Mon 12 Oct 07:00",
    "minute": 0,
    "stage": "platform"
  },
  "capacities": [
    {
      "name": "cap-ops-f8",
      "sku": "F8",
      "state": "Active",
      "cu": 8,
      "utilization": 0.0,
      "carryforward_minutes": 0.0,
      "throttling": "none",
      "surge_limit": 0,
      "monthly_usd": 1051.0,
      "workspaces": "ws-ops-legacy, ws-ops-dev, ws-ops-prod"
    }
  ],
  "workspaces": [
    {
      "name": "ws-ops-legacy",
      "capacity": "cap-ops-f8",
      "items": 0,
      "roles": "data.engineer@acmepay.com=Admin",
      "identity": false,
      "git": "",
      "pool": "Starter Pool",
      "native_engine": false
    },
    {
      "name": "ws-ops-dev",
      "capacity": "cap-ops-f8",
      "items": 4,
      "roles": "data.engineer@acmepay.com=Admin, sg-data-engineers=Contributor",
      "identity": false,
      "git": "",
      "pool": "Starter Pool",
      "native_engine": false
    },
    {
      "name": "ws-ops-prod",
      "capacity": "cap-ops-f8",
      "items": 0,
      "roles": "data.engineer@acmepay.com=Admin, sg-fabric-admins=Admin, sg-ops-analysts=Viewer",
      "identity": true,
      "git": "",
      "pool": "Starter Pool",
      "native_engine": false
    }
  ],
  "workspace_roles": [
    {
      "workspace": "ws-ops-legacy",
      "principal": "data.engineer@acmepay.com",
      "kind": "User",
      "role": "Admin"
    },
    {
      "workspace": "ws-ops-dev",
      "principal": "data.engineer@acmepay.com",
      "kind": "User",
      "role": "Admin"
    },
    {
      "workspace": "ws-ops-dev",
      "principal": "sg-data-engineers",
      "kind": "Group",
      "role": "Contributor"
    },
    {
      "workspace": "ws-ops-prod",
      "principal": "data.engineer@acmepay.com",
      "kind": "User",
      "role": "Admin"
    },
    {
      "workspace": "ws-ops-prod",
      "principal": "sg-fabric-admins",
      "kind": "Group",
      "role": "Admin"
    },
    {
      "workspace": "ws-ops-prod",
      "principal": "sg-ops-analysts",
      "kind": "Group",
      "role": "Viewer"
    }
  ],
  "items": [
    {
      "name": "lh_bronze",
      "type": "Lakehouse",
      "workspace": "ws-ops-dev",
      "label": "",
      "label_inherited": false,
      "endorsement": "",
      "description": false,
      "onelake_security": false
    },
    {
      "name": "lh_silver",
      "type": "Lakehouse",
      "workspace": "ws-ops-dev",
      "label": "",
      "label_inherited": false,
      "endorsement": "",
      "description": false,
      "onelake_security": false
    },
    {
      "name": "lh_gold",
      "type": "Lakehouse",
      "workspace": "ws-ops-dev",
      "label": "",
      "label_inherited": false,
      "endorsement": "",
      "description": false,
      "onelake_security": false
    },
    {
      "name": "wh_gold",
      "type": "Warehouse",
      "workspace": "ws-ops-dev",
      "label": "",
      "label_inherited": false,
      "endorsement": "",
      "description": false,
      "onelake_security": false
    }
  ],
  "shares": [
    {
      "item": "lh_silver",
      "type": "Lakehouse",
      "principal": "sg-ops-analysts",
      "permissions": "Read+ReadAll"
    },
    {
      "item": "wh_gold",
      "type": "Warehouse",
      "principal": "sg-ops-analysts",
      "permissions": "Read"
    },
    {
      "item": "ServiceOps",
      "type": "SemanticModel",
      "principal": "sg-ops-analysts",
      "permissions": "Read+Build"
    }
  ],
  "connections": [
    {
      "name": "conn_servicenow",
      "type": "ServiceNow",
      "auth": "Basic",
      "secret": "inline",
      "key_vault": false,
      "expires": "Wed 11 Nov 07:00"
    },
    {
      "name": "conn_servicenow_oauth",
      "type": "ServiceNow",
      "auth": "OAuth2",
      "secret": "Key Vault",
      "key_vault": true,
      "expires": ""
    }
  ],
  "tables": [
    {
      "item": "lh_bronze",
      "workspace": "ws-ops-dev",
      "schema": "dbo",
      "name": "incident_raw",
      "label": "lh_bronze.dbo.incident_raw",
      "kind": "Lakehouse",
      "rows": 1449,
      "files": 4,
      "size_mb": 304.0,
      "version": 1,
      "vorder": false,
      "partitioned_by": "",
      "last_operation": "WRITE",
      "written_by": "pipeline:pl_ingest_incident",
      "columns": 29,
      "column_names": "sys_id, number, short_description, caller_id, opened_at, resolved_at, closed_at, state, priority, impact, urgency, category, assignment_group, assigned_to, cmdb_ci, business_service, problem_id, caused_by, reassignment_count, reopen_count, made_sla, close_code, close_notes, active, sys_mod_count, sys_created_on, sys_updated_on, _source_file, _ingested_at",
      "retained_versions": 2,
      "shortcut": "",
      "dup_sys_id": 24,
      "null_sys_id": 0,
      "dup_number": 24,
      "read_cost_ms": 133,
      "operations": "WRITE"
    }
  ],
  "files": [
    {
      "item": "lh_bronze",
      "path": "Files/servicenow/incident/2026/10/12/incident_0700.json",
      "rows": 1400,
      "format": "json",
      "written": "Mon 12 Oct 07:00"
    },
    {
      "item": "lh_bronze",
      "path": "Files/servicenow/incident/2026/10/13/incident_0704.json",
      "rows": 49,
      "format": "json",
      "written": "Tue 13 Oct 07:04"
    }
  ],
  "file_count": 2,
  "shortcuts": [
    {
      "item": "lh_gold",
      "name": "cmdb_ci",
      "target": "lh_silver.dbo.cmdb_ci",
      "type": "oneLake"
    }
  ],
  "notebooks": [
    {
      "name": "nb_load_bronze",
      "workspace": "ws-ops-dev",
      "lakehouse": "lh_bronze",
      "lakehouse_workspace": "ws-ops-dev",
      "cells": 2,
      "lint_errors": 0,
      "lint_warnings": 0
    }
  ],
  "pipelines": [
    {
      "name": "pl_ingest_incident",
      "workspace": "ws-ops-dev",
      "activities": 2,
      "types": "Copy, TridentNotebook",
      "retry_policy": true,
      "connections": "conn_servicenow_oauth",
      "last_status": "Succeeded",
      "scheduled": false
    }
  ],
  "runs": [
    {
      "id": "872d8ba3",
      "item": "pl_ingest_incident",
      "type": "DataPipeline",
      "status": "Succeeded",
      "trigger": "Manual",
      "start": "Mon 12 Oct 07:00",
      "minutes": 4,
      "error": "",
      "rerun_of": "",
      "cu_s": 0,
      "antipatterns": "",
      "duration_s": 240,
      "activities": 2,
      "retried": true,
      "parameters": "{\"watermark\": \"1970-01-01 00:00:00\"}"
    },
    {
      "id": "a234ce63",
      "item": "pl_ingest_incident",
      "type": "DataPipeline",
      "status": "Succeeded",
      "trigger": "Manual",
      "start": "Tue 13 Oct 07:04",
      "minutes": 4,
      "error": "",
      "rerun_of": "",
      "cu_s": 0,
      "antipatterns": "",
      "duration_s": 240,
      "activities": 2,
      "retried": true,
      "parameters": "{\"watermark\": \"2026-10-12 06:29:00\"}"
    }
  ],
  "activity_runs": [
    {
      "run": "872d8ba3",
      "pipeline": "pl_ingest_incident",
      "activity": "Copy incidents",
      "type": "Copy",
      "status": "Succeeded",
      "attempts": 2,
      "seconds": 60,
      "iteration": "",
      "error": ""
    },
    {
      "run": "872d8ba3",
      "pipeline": "pl_ingest_incident",
      "activity": "Load bronze",
      "type": "TridentNotebook",
      "status": "Succeeded",
      "attempts": 1,
      "seconds": 60,
      "iteration": "",
      "error": ""
    },
    {
      "run": "a234ce63",
      "pipeline": "pl_ingest_incident",
      "activity": "Copy incidents",
      "type": "Copy",
      "status": "Succeeded",
      "attempts": 2,
      "seconds": 60,
      "iteration": "",
      "error": ""
    },
    {
      "run": "a234ce63",
      "pipeline": "pl_ingest_incident",
      "activity": "Load bronze",
      "type": "TridentNotebook",
      "status": "Succeeded",
      "attempts": 1,
      "seconds": 60,
      "iteration": "",
      "error": ""
    }
  ],
  "schedules": [
    {
      "item": "pl_nightly_incident",
      "type": "daily",
      "every": "02:00",
      "enabled": true,
      "last_status": "Failed"
    }
  ],
  "alerts": [
    {
      "name": "alert-1",
      "item": "pl_publish_gold",
      "on": "failure",
      "to": "dataops@acmepay.com",
      "channel": "Teams",
      "enabled": true
    }
  ],
  "notifications": [
    {
      "at": "Mon 12 Oct 07:01",
      "channel": "Teams",
      "to": "dataops@acmepay.com",
      "subject": "DataPipeline Failed: pl_publish_gold",
      "body": "DQ gate: NotebookExecutionFailed: cell 1: AssertionError: DQ gate: 14 duplicate sys_id rows in lh_silver.incident",
      "pipeline": "pl_publish_gold",
      "rule": "alert-1"
    }
  ],
  "models": [
    {
      "name": "ServiceOps",
      "workspace": "ws-ops-dev",
      "source": "lh_gold",
      "tables": 5,
      "measures": 6,
      "relationships": 4,
      "roles": 0,
      "date_table": true,
      "modes": "directLake",
      "refreshed": null,
      "bpa_findings": 0,
      "label": "",
      "endorsement": ""
    }
  ],
  "measures": [
    {
      "name": "Incidents",
      "table": "fact_incident",
      "value": 1400,
      "error": "",
      "matches_reference": true,
      "format": "0",
      "expected": 1400,
      "model": "ServiceOps"
    },
    {
      "name": "Open Incidents",
      "table": "fact_incident",
      "value": 31,
      "error": "",
      "matches_reference": true,
      "format": "0",
      "expected": 31,
      "model": "ServiceOps"
    },
    {
      "name": "P1 Incidents",
      "table": "fact_incident",
      "value": 35,
      "error": "",
      "matches_reference": true,
      "format": "0",
      "expected": 35,
      "model": "ServiceOps"
    },
    {
      "name": "MTTR (hours)",
      "table": "fact_incident",
      "value": 45.0414,
      "error": "",
      "matches_reference": true,
      "format": "0.0",
      "expected": 45.0414,
      "model": "ServiceOps"
    },
    {
      "name": "Reassignment Rate",
      "table": "fact_incident",
      "value": 0.2679,
      "error": "",
      "matches_reference": true,
      "format": "0.0%",
      "expected": 0.2679,
      "model": "ServiceOps"
    },
    {
      "name": "SLA Breach %",
      "table": "fact_task_sla",
      "value": 0.2274,
      "error": "",
      "matches_reference": true,
      "format": "0.0%",
      "expected": 0.2274,
      "model": "ServiceOps"
    }
  ],
  "relationships": [
    {
      "model": "ServiceOps",
      "name": "incident_date",
      "from": "fact_incident.opened_date_key",
      "to": "dim_date.date_key",
      "both": false,
      "active": true
    },
    {
      "model": "ServiceOps",
      "name": "incident_group",
      "from": "fact_incident.group_key",
      "to": "dim_assignment_group.group_key",
      "both": false,
      "active": true
    },
    {
      "model": "ServiceOps",
      "name": "incident_ci",
      "from": "fact_incident.ci_key",
      "to": "dim_ci.ci_key",
      "both": false,
      "active": true
    },
    {
      "model": "ServiceOps",
      "name": "sla_incident",
      "from": "fact_task_sla.incident_key",
      "to": "fact_incident.incident_key",
      "both": false,
      "active": true
    }
  ],
  "model_roles": [
    {
      "model": "ServiceOps",
      "name": "Group scope",
      "filters": "dim_assignment_group: [owner_email] = USERPRINCIPALNAME()",
      "members": "sg-ops-analysts"
    }
  ],
  "bpa": [
    {
      "severity": "Warning",
      "rule": "Avoid bi-directional relationships",
      "object": "incident_group",
      "advice": "Use single direction and CROSSFILTER() in the one measure that needs it."
    }
  ],
  "role_tests": [
    {
      "at": 0,
      "model": "ServiceOps",
      "role": "Group scope",
      "user": "nadia.haddad@acmepay.com",
      "rls": true,
      "rows": 1,
      "value": 216
    }
  ],
  "dax_queries": [
    {
      "at": 0,
      "model": "ServiceOps",
      "user": "data.engineer@acmepay.com",
      "rls": false,
      "rows": 3,
      "duration_ms": 47,
      "modes": [
        "directLake"
      ],
      "fallback": false,
      "query": "EVALUATE SUMMARIZECOLUMNS(fact_task_sla[stage], \"SLAs\", COUNTROWS(fact_task_sla))"
    },
    {
      "at": 0,
      "model": "ServiceOps",
      "user": "data.engineer@acmepay.com",
      "rls": false,
      "rows": 8,
      "duration_ms": 765,
      "modes": [
        "directLake"
      ],
      "fallback": false,
      "query": "EVALUATE SUMMARIZECOLUMNS(dim_assignment_group[name],     \"Incidents\", [Incidents], \"Open\", [Open Incidents],     \"MTTR (h)\", [MTTR (hours)], \"SLA breach\", [SLA"
    },
    {
      "at": 0,
      "model": "ServiceOps",
      "user": "data.engineer@acmepay.com",
      "rls": false,
      "rows": 5,
      "duration_ms": 218,
      "modes": [
        "directLake"
      ],
      "fallback": false,
      "query": "EVALUATE SUMMARIZECOLUMNS(dim_date[year_month], \"Incidents\", [Incidents], \"P1\", [P1 Incidents]) ORDER BY [year_month]"
    },
    {
      "at": 0,
      "model": "ServiceOps",
      "user": "data.engineer@acmepay.com",
      "rls": false,
      "rows": 1,
      "duration_ms": 9,
      "modes": [
        "directLake"
      ],
      "fallback": false,
      "query": "EVALUATE ROW(\"Database Team P1\", CALCULATE([P1 Incidents], dim_assignment_group[name] = \"Database Team\"))"
    }
  ],
  "sql_security": {
    "grants": 0,
    "masks": 0,
    "policies": 0,
    "procedures": 0
  },
  "grants": [
    {
      "kind": "GRANT",
      "permission": "SELECT",
      "object": "schema::reporting",
      "principal": "sg-ops-analysts",
      "columns": ""
    }
  ],
  "masks": [
    {
      "table": "wh_gold.reporting.incident",
      "column": "caller_email",
      "function": "email()"
    }
  ],
  "rls_policies": [
    {
      "name": "reporting.group_filter",
      "table": "wh_gold.reporting.incident",
      "function": "reporting.fn_my_group",
      "on": true
    }
  ],
  "procedures": [
    "meta.usp_set_watermark"
  ],
  "onelake_roles": [
    {
      "item": "lh_silver",
      "role": "ops_readers",
      "paths": "Tables/dbo/incident, Tables/dbo/cmdb_ci",
      "members": "sg-ops-analysts"
    },
    {
      "item": "lh_silver",
      "role": "pii_readers",
      "paths": "Tables/dbo/sys_user",
      "members": "sg-data-engineers"
    }
  ],
  "access_checks": [
    {
      "at": 0,
      "item": "lh_silver",
      "user": "nadia.haddad@acmepay.com",
      "path": "Tables/dbo/incident",
      "allowed": true
    },
    {
      "at": 0,
      "item": "lh_silver",
      "user": "nadia.haddad@acmepay.com",
      "path": "Tables/dbo/sys_user",
      "allowed": false
    }
  ],
  "dq_runs": [
    {
      "at": "Mon 12 Oct 07:00",
      "table": "lh_silver.dbo.incident",
      "rules": 6,
      "failed_rules": 2,
      "critical_failed": 1,
      "quarantined": 10
    },
    {
      "at": "Mon 12 Oct 07:01",
      "table": "lh_silver.dbo.incident",
      "rules": 6,
      "failed_rules": 0,
      "critical_failed": 0,
      "quarantined": 0
    }
  ],
  "dq_results": [
    {
      "table": "lh_silver.dbo.incident",
      "rule": "sys_id is unique",
      "type": "unique",
      "severity": "critical",
      "failed": 14,
      "passed": false
    },
    {
      "table": "lh_silver.dbo.incident",
      "rule": "number is present",
      "type": "not_null",
      "severity": "critical",
      "failed": 0,
      "passed": true
    },
    {
      "table": "lh_silver.dbo.incident",
      "rule": "priority is 1 to 5",
      "type": "accepted_values",
      "severity": "critical",
      "failed": 0,
      "passed": true
    },
    {
      "table": "lh_silver.dbo.incident",
      "rule": "CI exists in the CMDB",
      "type": "relationship",
      "severity": "warning",
      "failed": 23,
      "passed": true
    },
    {
      "table": "lh_silver.dbo.incident",
      "rule": "resolved after opened",
      "type": "expression",
      "severity": "warning",
      "failed": 10,
      "passed": false
    },
    {
      "table": "lh_silver.dbo.incident",
      "rule": "data is fresh",
      "type": "freshness",
      "severity": "critical",
      "failed": 0,
      "passed": true
    }
  ],
  "lineage": [
    {
      "from": "ServiceNow/incident",
      "to": "lh_bronze/Files/servicenow/incident/2026/10/12",
      "via": "Copy activity"
    },
    {
      "from": "lh_bronze/Files/servicenow/incident/2026/10/12/incident_0700.json",
      "to": "lh_bronze.dbo.incident_raw",
      "via": "Notebook nb_load_bronze"
    },
    {
      "from": "ServiceNow/incident",
      "to": "lh_bronze/Files/servicenow/incident/2026/10/13",
      "via": "Copy activity"
    },
    {
      "from": "lh_bronze/Files/servicenow/incident/2026/10/13/incident_0704.json",
      "to": "lh_bronze.dbo.incident_raw",
      "via": "Notebook nb_load_bronze"
    }
  ],
  "classifications": [
    {
      "table": "incident_raw",
      "column": "close_notes",
      "classification": "Email Address",
      "sample_hits": 63,
      "item": "lh_bronze"
    },
    {
      "table": "sys_user_group_raw",
      "column": "email",
      "classification": "Email Address",
      "sample_hits": 12,
      "item": "lh_bronze"
    },
    {
      "table": "sys_user_raw",
      "column": "email",
      "classification": "Email Address",
      "sample_hits": 200,
      "item": "lh_bronze"
    },
    {
      "table": "cmdb_ci_raw",
      "column": "ip_address",
      "classification": "IP Address",
      "sample_hits": 200,
      "item": "lh_bronze"
    },
    {
      "table": "incident",
      "column": "caller_id",
      "classification": "Person's Name",
      "sample_hits": null,
      "item": "lh_silver"
    },
    {
      "table": "incident",
      "column": "assigned_to",
      "classification": "Person's Name",
      "sample_hits": null,
      "item": "lh_silver"
    }
  ],
  "gdpr": {
    "subject": "noor.mansour@acmepay.com",
    "at": 0,
    "current": 0,
    "history": 0,
    "files": 0,
    "erased": true,
    "namesakes": 1
  },
  "audit": [
    {
      "at": "Mon 12 Oct 07:00",
      "user": "data.engineer@acmepay.com",
      "operation": "CreateWorkspace",
      "target": "ws-ops-legacy",
      "detail": ""
    },
    {
      "at": "Mon 12 Oct 07:00",
      "user": "data.engineer@acmepay.com",
      "operation": "UpdateWorkspaceAccess",
      "target": "ws-ops-legacy",
      "detail": "Group sg-all-staff -> Member"
    },
    {
      "at": "Mon 12 Oct 07:00",
      "user": "data.engineer@acmepay.com",
      "operation": "CreateWorkspace",
      "target": "ws-ops-dev",
      "detail": ""
    },
    {
      "at": "Mon 12 Oct 07:00",
      "user": "data.engineer@acmepay.com",
      "operation": "CreateWorkspace",
      "target": "ws-ops-prod",
      "detail": ""
    },
    {
      "at": "Mon 12 Oct 07:00",
      "user": "data.engineer@acmepay.com",
      "operation": "CreateWorkspace",
      "target": "ws-sandbox",
      "detail": ""
    },
    {
      "at": "Mon 12 Oct 07:00",
      "user": "data.engineer@acmepay.com",
      "operation": "AssignWorkspaceToCapacity",
      "target": "ws-sandbox",
      "detail": "cap-ops-f8"
    }
  ],
  "git_branches": [
    {
      "repo": "acme-pay/fabric-serviceops",
      "branch": "main",
      "files": 5,
      "commits": 2,
      "last_commit": "Merge PR #1: SLA breach aggregate"
    },
    {
      "repo": "acme-pay/fabric-serviceops",
      "branch": "feature/sla-breach-agg",
      "files": 5,
      "commits": 1,
      "last_commit": "SLA breach aggregate, credential from Key Vault"
    }
  ],
  "pull_requests": [
    {
      "id": 1,
      "title": "SLA breach aggregate",
      "from": "feature/sla-breach-agg",
      "to": "main",
      "status": "merged",
      "approvals": 1,
      "checks_passed": true
    }
  ],
  "deployments": [
    {
      "pipeline": "dp-serviceops",
      "from": "Development",
      "to": "Production",
      "items": 1,
      "warnings": 1,
      "by": "data.engineer@acmepay.com"
    },
    {
      "pipeline": "dp-serviceops",
      "from": "Development",
      "to": "Production",
      "items": 1,
      "warnings": 0,
      "by": "data.engineer@acmepay.com"
    }
  ],
  "deploy_pipelines": [
    {
      "name": "dp-serviceops",
      "stages": "Development=ws-ops-dev -> Production=ws-ops-prod",
      "rules": 1
    }
  ],
  "test_runs": [
    {
      "workspace": "ws-ops-dev",
      "tests": 3,
      "passed": 3,
      "at": "Mon 12 Oct 07:00"
    }
  ],
  "lint": [
    {
      "at": 0,
      "errors": 3,
      "warnings": 2,
      "findings": 5,
      "notebook": "notebooks/nb_lina_ingest.py"
    },
    {
      "at": 0,
      "errors": 0,
      "warnings": 0,
      "findings": 0,
      "notebook": "notebooks/nb_incident_append.py"
    }
  ],
  "documents": [
    {
      "path": "docs/model-card.md",
      "kind": "modelcard",
      "ok": true,
      "at": 0,
      "words": 190,
      "problems": []
    }
  ],
  "ai_calls": [
    {
      "at": 0,
      "function": "classify",
      "rows": 8,
      "column": "notes_redacted"
    }
  ],
  "ai_blocked": 1,
  "ai_eval": {
    "at": 0,
    "rows": 1369,
    "accuracy": 0.0431,
    "per_class": [
      [
        "Access",
        243,
        0.0,
        0.0
      ],
      [
        "Database",
        218,
        0.0,
        0.0
      ],
      [
        "Hardware",
        217,
        0.166,
        0.267
      ],
      [
        "Network",
        209,
        0.0,
        0.0
      ],
      [
        "Security",
        254,
        0.0,
        0.0
      ],
      [
        "Software",
        228,
        0.111,
        0.004
      ]
    ]
  },
  "top_items": [
    {
      "capacity": "cap-ops-f8",
      "item": "pl_ingest_incident",
      "kind": "background",
      "cu_s": 270
    },
    {
      "capacity": "cap-ops-f8",
      "item": "wh_gold",
      "kind": "background",
      "cu_s": 5
    }
  ],
  "signals": [
    {
      "at": "Mon 12 Oct 07:00",
      "level": "info",
      "message": "Environment ready: ServiceNow instance acmepay.service-now.com, stage \"platform\"",
      "source": "lab"
    },
    {
      "at": "Mon 12 Oct 07:00",
      "level": "info",
      "message": "Capacity cap-ops-f8 is now: not throttled",
      "source": "capacity"
    },
    {
      "at": "Mon 12 Oct 07:00",
      "level": "info",
      "message": "Workspace identity created for ws-ops-prod (app id 39d9cdcc-ea50-25e9-bc3b-db6c41304310)",
      "source": "security"
    }
  ],
  "faults": {
    "incident_no_ci": 107,
    "incident_orphan_ci": 26,
    "incident_resolved_before_opened": 10,
    "duplicate_ci_names": 8,
    "orphan_relationships": 11,
    "duplicate_relationships": 6,
    "relationship_cycles": 1,
    "notes_with_email": 68,
    "duplicate_asset_tags": 3,
    "assets_in_use_out_of_warranty": 40,
    "server_ci_without_asset": 12
  }
};


// COWORK READS THE CLAUDE CODE PAYLOAD, because it is the same engine under a
// second family name - see `families_of_engine` in app 11's
// `utils/labtools.py`, which is what makes the backend key the payload under
// both. Aliased here rather than copied so the two cannot drift: a copy would
// let a `cowork` panel point at a key `claudecode` no longer sends and still
// pass.
// Dumped from app 11's sim:dataplat after a `lake` stage run with the small_files
// fault and one Spark SQL query (view()['lake'], trimmed).
VIEWS.dataplat = {
    "lake": {
        "tables": [
            {
                "name": "silver.web_events",
                "format": "delta",
                "kind": "managed",
                "location": "s3://shopflow-lake/silver/web_events/",
                "rows": 30000,
                "files": 400,
                "size_bytes": 927453,
                "storage_bytes": 927453,
                "partition_by": [],
                "spec_id": 0,
                "version": 7,
                "snapshots": [
                    {
                        "version": 0,
                        "snapshot_id": null,
                        "operation": "STREAMING UPDATE",
                        "at": -480,
                        "timestamp": "2026-11-01 22:00:00",
                        "rows_added": 3750,
                        "rows_removed": 0,
                        "files_added": 50,
                        "files_removed": 0
                    },
                    {
                        "version": 1,
                        "snapshot_id": null,
                        "operation": "STREAMING UPDATE",
                        "at": -420,
                        "timestamp": "2026-11-01 23:00:00",
                        "rows_added": 3750,
                        "rows_removed": 0,
                        "files_added": 50,
                        "files_removed": 0
                    }
                ],
                "schema": [
                    {
                        "name": "event_id",
                        "type": "string"
                    },
                    {
                        "name": "user_id",
                        "type": "bigint"
                    },
                    {
                        "name": "session_id",
                        "type": "string"
                    },
                    {
                        "name": "event_type",
                        "type": "string"
                    },
                    {
                        "name": "page",
                        "type": "string"
                    },
                    {
                        "name": "product_id",
                        "type": "bigint"
                    },
                    {
                        "name": "event_ts",
                        "type": "timestamp"
                    },
                    {
                        "name": "device",
                        "type": "string"
                    },
                    {
                        "name": "event_date",
                        "type": "date"
                    }
                ],
                "schema_version": 0,
                "properties": {
                    "delta.minReaderVersion": "1",
                    "delta.minWriterVersion": "2"
                },
                "small_files": 400,
                "zorder": [],
                "last_optimize": null,
                "last_vacuum": null
            }
        ],
        "files": [
            {
                "path": "s3://shopflow-lake/landing/customers/customers_2026-10-25.json",
                "format": "json",
                "rows": 134,
                "bytes": 25445,
                "row_groups": 0,
                "compression": "none",
                "columns": [
                    "customer_id",
                    "email",
                    "first_name",
                    "last_name",
                    "phone",
                    "country",
                    "city",
                    "segment",
                    "marketing_opt_in",
                    "created_at",
                    "updated_at"
                ],
                "partition": {},
                "created": -10365,
                "via": "nightly_export"
            },
            {
                "path": "s3://shopflow-lake/landing/customers/customers_2026-10-26.json",
                "format": "json",
                "rows": 134,
                "bytes": 25573,
                "row_groups": 0,
                "compression": "none",
                "columns": [
                    "customer_id",
                    "email",
                    "first_name",
                    "last_name",
                    "phone",
                    "country",
                    "city",
                    "segment",
                    "marketing_opt_in",
                    "created_at",
                    "updated_at"
                ],
                "partition": {},
                "created": -8925,
                "via": "nightly_export"
            },
            {
                "path": "s3://shopflow-lake/landing/customers/customers_2026-10-27.json",
                "format": "json",
                "rows": 149,
                "bytes": 28267,
                "row_groups": 0,
                "compression": "none",
                "columns": [
                    "customer_id",
                    "email",
                    "first_name",
                    "last_name",
                    "phone",
                    "country",
                    "city",
                    "segment",
                    "marketing_opt_in",
                    "created_at",
                    "updated_at"
                ],
                "partition": {},
                "created": -7485,
                "via": "nightly_export"
            }
        ],
        "queries": [
            {
                "id": "lakeq-000001",
                "sql": "SELECT COUNT(*) FROM silver.web_events",
                "rows": 1,
                "files_scanned": 400,
                "files_pruned": 0,
                "pruned_by_partition": 0,
                "skipped_by_stats": 0,
                "tables": [
                    "silver.web_events"
                ],
                "at": 0
            }
        ]
    }
};

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

    /* "I add a style and the output does not change". A full document with no
       closing </body> - every document while it is being typed - used to get
       neither the CSS pane nor the JS pane, because only `</body>` was looked
       for. */
    const open = buildPreview('<html><head><title>t</title></head><body><p>x</p>',
                              'p { color: red }', 'console.log(3)');
    check('A DOCUMENT WITH NO </body> STILL GETS THE CSS PANE',
          open.includes('p { color: red }'), open);
    check('...AND THE JS PANE, after the shim',
          open.includes('console.log(3)')
          && open.indexOf('sfsLab') < open.indexOf('console.log(3)'), open);
    check('the CSS pane lands in the head, after the student\'s own head content',
          open.indexOf('p { color: red }') < open.indexOf('</head>')
          && open.indexOf('<title>t</title>') < open.indexOf('p { color: red }'));
    const headless = buildPreview('<html><body><p>y</p></body></html>', 'b{}', 'var z=1');
    check('a document with NO <head> still gets the shim, the CSS and the JS',
          headless.includes('sfsLab') && headless.includes('b{}')
          && headless.includes('var z=1')
          && headless.indexOf('var z=1') < headless.indexOf('</body>'), headless);
    const bare = buildPreview('<html><p>z</p>', 'i{}', 'var w=2');
    check('a document with neither </body> nor </html> still gets everything',
          bare.includes('i{}') && bare.includes('var w=2') && bare.includes('sfsLab'));
    const dollars = buildPreview('<html><body></body></html>', "a::after{content:'$&'}",
                                 "var p = '$' + 1; var q = \"$'\"; var r = `$`;");
    check('$& and $\' in student code are kept verbatim, not expanded by replace()',
          dollars.includes("content:'$&'") && dollars.includes("var q = \"$'\"")
          && dollars.includes("var p = '$' + 1"), dollars);

    const web = stripComments(source('src/components/labs/LabWeb.vue'));
    check('the web frame is re-created on every render (:key), so it cannot stick',
          /<iframe[\s\S]{0,40}:key="runId"/.test(web) && /runId\.value \+= 1/.test(web));
    check('Live is ON by default and remembered',
          /localStorage\.getItem\(LIVE_KEY\) !== '0'/.test(web));
    check('the result has Reload and Full screen',
          /@click="render"/.test(web) && /requestFullscreen\(\)/.test(web));

    const prev = source('src/components/labs/LabPreview.vue');
    check('THE BROWSER STAGE HAS A DEFINITE, VIEWPORT-BASED HEIGHT',
          /\.sl-prev__stage \{[\s\S]{0,200}height: max\(22rem, calc\(100dvh - 15rem\)\)/.test(prev));
    check('...and the iframe fills it absolutely, never falling back to 150px',
          /\.sl-prev__frame \{[\s\S]{0,80}position: absolute; inset: 0/.test(prev));
    check('...and is re-created per response, so Reload really reloads',
          /<iframe :key="runId"/.test(prev));
    check('the browser can go full screen', /requestFullscreen\(\)/.test(prev));
    check('the phone pane has a definite height to fit the device into',
          /\.sl-mob \{[\s\S]{0,120}height: max\(30rem, calc\(100dvh - 13rem\)\)/
          .test(source('src/components/labs/LabMobile.vue')));
    check('the web result fills the screen rather than a fixed 24rem box',
          /\.sl-web__frame \{[\s\S]{0,250}height: max\(22rem, calc\(100dvh - 17rem\)\)/
          .test(source('src/assets/css/labs.css')));
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
    'src/components/labs/LabTaskGuide.vue',
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
               // `--sl-portal-*` is the browser frame around a product console:
               // a fixed Chromium grey in every galaxy, for the reason the
               // terminal's `--sl-code-*` is fixed - it is another program's
               // screen, not a page of this one.
               .filter(line => !/--sl-code|--sl-well|--sl-portal-[\w-]+:|background: #fff|#0b111f|#fcd34d/.test(line))
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

    /* ── IT IS A TERMINAL, NOT A TEXT FIELD WITH A LOG OVER IT ────────────
       The entry row used to be a `<form>` SIBLING of the transcript box, with
       its own background and its own rounded bottom corners. Every symptom
       reported about this console in 2026-09 is that one arrangement:

         * the prompt was "pinned/stuck at the bottom" because it was — a
           footer bar welded under a separately-scrolling box, at any content
           length;
         * Enter looked as though "nothing happens to the student@lab:~$
           line", because the echo was appended into the box ABOVE, at the TOP
           of 420px of empty space, while the prompt being typed at never
           moved;
         * and the whole thing read as an input box rather than a shell.

       So the assertion is STRUCTURAL: the entry row is inside the scroller.
       Nothing about the transcript, the echo or `scrollDown()` had to change
       for that to work — the prompt travels with the content because it IS
       the last line of the content. */
    /* The nesting is WALKED, not matched.
       The first version of this asserted on
       `/<div ref="scroller"[\s\S]*?\n {4}<\/div>/` — a `</div>` at four spaces
       of indentation — and `negative.mjs` moved the entry row back out of the
       scroller and the check still passed: the inserted `</div>` was indented
       six spaces, so the lazy match ran straight past it to the original one.
       An indentation-shaped test of a STRUCTURAL property is a test of the
       formatting. Counting depth is the property itself. */
    function insideScroller(markup: string, needle: string): boolean {
        const open = markup.indexOf('<div ref="scroller"');
        if (open < 0) return false;
        let depth = 0;
        for (const tag of markup.slice(open).matchAll(/<div\b|<\/div>/g)) {
            depth += tag[0] === '</div>' ? -1 : 1;
            if (depth === 0) {
                return markup.slice(open, open + tag.index! + tag[0].length)
                    .includes(needle);
            }
        }
        return false;   // never closed — malformed, and not a pass
    }
    check('the line being typed is INSIDE the transcript box',
          insideScroller(console_, 'class="sl-console__entry"'),
          'the entry row is not nested inside the scroller');
    check('...and there is no second, sibling prompt bar left behind',
          !/sl-console__form/.test(console_));
    /* Enter is the interface. The button is for a keyboard with no Enter
       within reach, so it must not be a primary action welded to the prompt —
       a filled button on that line is the single thing that most made this
       read as a form. */
    check('the Run affordance is a quiet control on the line, not a form button',
          /class="sl-console__go"/.test(console_)
          && !/sl-btn--primary[^>]*>\s*<CornerDownLeft/.test(console_));

    const labsCss = stripComments(source('src/assets/css/labs.css'));
    const bodyRule = labsCss.match(/\.sl-console__body\s*\{[^}]*\}/);
    /* A shell starts at the TOP and grows down. A fixed `height` puts the
       welcome and the first prompt at the top of a tall empty rectangle, which
       is the bottom-anchored look arriving from the other direction. */
    check('the terminal box grows from the top rather than being a fixed height',
          !!bodyRule && /min-height:/.test(bodyRule[0])
          && /max-height:/.test(bodyRule[0])
          && !/\n\s*height:/.test(bodyRule[0]), bodyRule?.[0]);
    const entryRule = labsCss.match(/\.sl-console__entry\s*\{[^}]*\}/);
    /* The row is a line of the transcript, so it carries none of the chrome a
       field would: no background, no padding, no border, no radius. It had all
       four. */
    check('the entry row carries no field chrome of its own',
          !!entryRule && /background:\s*none/.test(entryRule[0])
          && /padding:\s*0/.test(entryRule[0])
          && /border:\s*0/.test(entryRule[0]), entryRule?.[0]);
    const inputRule = labsCss.match(/\.sl-console__input\s*\{[^}]*\}/);
    check('...and the input inherits the terminal\'s own type',
          !!inputRule && /font:\s*inherit/.test(inputRule[0]), inputRule?.[0]);
    /* The reported green border. `.sl-console .sl-console__input` and not one
       class: ui.css's field contract is (0,1,1) and labs.css is emitted
       BEFORE it, so a tie loses. */
    check('the prompt line is never given a focus ring',
          /\.sl-console \.sl-console__input:focus[\s\S]{0,140}?box-shadow:\s*none/
          .test(labsCss));
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
       a lab is a shell. REFRESH RE-READS THE OPEN FILE, but only while it is
       CLEAN: skipping it entirely was the reported bug (`echo x >> f`, Refresh,
       and the old text stayed until the student opened another file), and
       overwriting a DIRTY buffer would throw away what they had typed. */
    check('refresh re-reads the open file',
          /const text = await props\.read\(target\)/.test(files));
    check('...but never over unsaved typing',
          /if \(!dirty\.value\) \{\s*content\.value = text;/.test(files));
    check('a manual refresh says what it did, and spins while it works',
          /refresh\(\{ manual: true \}\)/.test(files)
          && /role="progressbar"/.test(files) && /aria-busy="refreshing"/.test(files));
    check('an older refresh cannot land after a newer one',
          /if \(seq !== refreshSeq\) return;/.test(files));
    /* The Files pane sits inside the panes' v-for, where a string ref is an
       ARRAY - `filesPane.value?.refresh?.()` then found nothing and the
       explorer never followed a console command. */
    check('the workspace binds the Files pane with a function ref',
          /:ref="bindFilesPane"/.test(source('src/views/LabWorkspace.vue'))
          && !/\sref="filesPane"/.test(source('src/views/LabWorkspace.vue')));
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

/* ─────────────────── 15. downloads: the ZIP writer and the explorer ─────────────────── */

section('15. Downloads: a ZIP built in the browser, proved against zlib');
{
    const zip = await import('@/utils/zipArchive');
    const { buildZip, readZipDirectory, crc32, planArchive, safeEntryName,
            exportFromListing, safeDownloadName } = zip;
    const text = new TextEncoder();

    check('crc32 is the IEEE value ZIP expects ("123456789" -> cbf43926)',
          crc32(text.encode('123456789')) === 0xcbf43926);

    const exported = {
        root: '',
        files: [
            { path: 'main.tf', content: 'resource "x" "y" {}\n'.repeat(40), mode: '644' },
            { path: 'src/deploy.sh', content: '#!/bin/sh\necho hi\n', mode: '755' },
            { path: 'src/دليل.md', content: 'مرحبا\n', mode: '644' },
        ],
        dirs: ['src', 'tests'],
    };
    const plan = planArchive(exported, 'tf-01-lifecycle');
    check('the whole lab is named after the lab',
          plan.fileName === 'tf-01-lifecycle.zip', plan.fileName);
    const names = plan.entries.map(entry => entry.name);
    check('...and wrapped in ONE top folder, so it does not spill into Downloads',
          names.every(name => name.startsWith('tf-01-lifecycle/')), names);
    check('...holding every file and every folder, the EMPTY one included',
          names.includes('tf-01-lifecycle/main.tf')
          && names.includes('tf-01-lifecycle/src/deploy.sh')
          && names.includes('tf-01-lifecycle/tests/'), names);

    const folder = planArchive({ root: 'config/env', files: [
        { path: 'config/env/a.yaml', content: 'a: 1\n' }], dirs: ['config/env/empty'] }, 'lab');
    check('a FOLDER downloads as itself, relative to its parent',
          folder.fileName === 'env.zip'
          && folder.entries.map(e => e.name).join('|') === 'env/|env/empty/|env/a.yaml',
          folder.entries.map(e => e.name));

    check('a traversal or an absolute name never enters an archive',
          safeEntryName('../etc/passwd') === '' && safeEntryName('/etc/x') === ''
          && safeEntryName('C:/x') === '' && safeEntryName('a\\b') === 'a/b'
          && safeEntryName('a/./b//c') === 'a/b/c');
    check('a download name is file-system safe',
          safeDownloadName('My Lab: 1/2') === 'My-Lab-1-2' && safeDownloadName('') === 'lab-files');

    // STORED: byte-exact round trip through our own reader.
    const stored = await buildZip(plan.entries,
        { compress: false, date: new Date(2026, 9, 16, 12, 30, 10) });
    const storedDir = readZipDirectory(stored);
    check('a stored archive lists every entry', storedDir.length === plan.entries.length,
          storedDir.map(e => e.name));
    const sh = storedDir.find(e => e.name === 'tf-01-lifecycle/src/deploy.sh')!;
    check('...with the bytes, the size and the CRC intact',
          new TextDecoder().decode(sh.data) === exported.files[1].content
          && sh.size === sh.data.length && sh.crc === crc32(sh.data), sh);
    check('...and the Unix mode, so an executable stays executable',
          (sh.mode & 0o777) === 0o755 && (sh.mode & 0o170000) === 0o100000, sh.mode.toString(8));
    const dirEntry = storedDir.find(e => e.name === 'tf-01-lifecycle/tests/')!;
    check('a folder is a directory entry', (dirEntry.mode & 0o170000) === 0o040000
          && dirEntry.size === 0, dirEntry);
    check('a UTF-8 name round-trips', storedDir.some(e => e.name.endsWith('src/دليل.md')));
    const flags = new DataView(stored.buffer).getUint16(6, true);
    check('...because the UTF-8 flag (bit 11) is set', (flags & 0x0800) === 0x0800, flags);

    // DEFLATED: node's own zlib must be able to inflate what we wrote.
    const packed = await buildZip(plan.entries);
    const packedDir = readZipDirectory(packed);
    const tf = packedDir.find(e => e.name === 'tf-01-lifecycle/main.tf')!;
    check('a repetitive file is DEFLATED (method 8) and smaller',
          tf.method === 8 && tf.compressed < tf.size, tf);
    const inflated = new TextDecoder().decode(inflateRawSync(tf.data));
    check('...and zlib inflates it back to exactly the original',
          inflated === exported.files[0].content);
    check('...whose CRC matches the inflated bytes',
          crc32(text.encode(inflated)) === tf.crc);
    const tiny = packedDir.find(e => e.name === 'tf-01-lifecycle/src/deploy.sh')!;
    check('a tiny file that would GROW is stored instead',
          tiny.method === 0 || tiny.compressed < tiny.size, tiny);
    check('the deflated archive is smaller than the stored one',
          packed.length < stored.length, { packed: packed.length, stored: stored.length });

    // THE FALLBACK, for a replica that does not know `export`.
    const reads: string[] = [];
    const fallback = await exportFromListing('src',
        [{ path: 'main.tf' }, { path: 'src/a.py' }, { path: 'src/b/c.py' }],
        ['src', 'src/b', 'src/empty', 'other'],
        async (path: string) => { reads.push(path); return `# ${path}`; });
    check('the fallback reads only what is under the folder',
          reads.join('|') === 'src/a.py|src/b/c.py', reads);
    check('...and keeps the folder\'s own sub-folders, not itself or others',
          fallback.dirs.join('|') === 'src/b|src/empty' && fallback.root === 'src',
          fallback.dirs);
    const one = await exportFromListing('main.tf', [{ path: 'main.tf' }], [], async () => 'x');
    check('a FILE through the fallback is that file alone',
          one.files.length === 1 && one.dirs.length === 0);

    const filesPane = stripComments(source('src/components/labs/LabFiles.vue'));
    const service = source('src/services/labs.service.ts');
    check('the Explorer bar has Download all as ZIP',
          /class="sl-tree__icon sl-tree__icon--download"[\s\S]{0,300}@click="downloadZip\(''\)"/
          .test(filesPane));
    check('right-clicking a FILE offers Download',
          /menu\.row\.kind === 'file'[\s\S]{0,200}downloadFile\(row\.path\)/.test(filesPane));
    check('right-clicking a FOLDER offers Download as ZIP',
          /downloadZip\(row\.path\)[\s\S]{0,160}\$t\('Download as ZIP'\)/.test(filesPane));
    check('the top-level menu offers Download all as ZIP',
          /fromMenu\(\(\) => downloadZip\(''\)\)/.test(filesPane));
    check('the explorer falls back when the replica cannot export',
          /\?\? await exportFromListing\(/.test(filesPane));
    check('a single file is saved as octet-stream, never rendered from a blob: URL',
          /type: 'application\/octet-stream'/.test(filesPane)
          && /anchor\.download = name/.test(filesPane));
    check('the service asks for the export action and answers null when it cannot',
          /action: 'export'/.test(service) && /return null;/.test(service));
    check('both explorers are given the export',
          /:export-files="exportFiles"/.test(source('src/views/LabWorkspace.vue'))
          && /:export-files="exportFiles"/.test(source('src/views/SelfDrivingStudio.vue')));
}

/* ─────────────────── 16. the tutor: steps, code cards, copy ─────────────────── */

section('16. The tutor renders steps and copyable code, never markup');
{
    const { inlineSpans } = await import('@/utils/aichatMarkdown');
    const kinds = (value: string) => inlineSpans(value)
        .map(span => `${span.kind}:${span.text}`).join('|');
    check('inline code becomes a code span',
          kinds('run `docker ps` now') === 'text:run |code:docker ps|text: now',
          kinds('run `docker ps` now'));
    check('**bold** becomes strong',
          kinds('this is **key**.') === 'text:this is |strong:key|text:.');
    check('SELECT * and 2**10 are left alone',
          kinds('SELECT * FROM t; 2**10') === 'text:SELECT * FROM t; 2**10');
    check('nothing inside code is parsed again', kinds('`**kwargs**`') === 'code:**kwargs**');
    check('a double-backtick span may hold a backtick', kinds('``a ` b``') === 'code:a ` b');
    check('an unclosed backtick stays literal', kinds('a ` b') === 'text:a ` b');
    check('underscores are never emphasis',
          kinds('__init__ and user_id') === 'text:__init__ and user_id');

    const tutor = stripComments(source('src/components/labs/LabTutor.vue'));
    const inline = source('src/components/labs/TutorInline.vue');
    check('every code block is a card with a Copy button',
          /class="sl-codecard"[\s\S]{0,700}class="sl-codecard__copy"[\s\S]{0,200}copy\(block\.text/
          .test(tutor));
    check('...and the code itself is LTR', /<pre class="sl-turn__code" dir="ltr">/.test(tutor));
    check('a numbered list is drawn as STEPS, numbered from where it started',
          /class="sl-steps"[\s\S]{0,300}block\.start \+ at/.test(tutor));
    check('the whole answer can be copied', /copy\(turn\.content/.test(tutor));
    check('copying has a fallback for a refused clipboard',
          /execCommand\('copy'\)/.test(tutor));
    check('prose goes through TutorInline, which goes through RichText',
          /<TutorInline/.test(tutor) && /<RichText/.test(inline)
          && !/v-html/.test(stripComments(inline)));

    const prompt = tutorPrompt(null, '');
    check('the prompt asks for the shape the pane renders',
          /## Steps/.test(prompt) && /language tag/.test(prompt) && /inline code/.test(prompt));
}

/* ─────────────────── 17. Portals ─────────────────── */

section('17. Portals: the product consoles, and the command line they write');

{
    /*
     * A POSIX `shlex.split` in miniature, so the quoting is proved against the
     * reader that will actually consume it rather than against itself. The
     * engines split every portal line with Python's `shlex.split(posix=True)`;
     * a value that does not survive this round trip arrives at the engine as
     * several arguments, and the engine answers about the wrong resource at
     * exit code 0 - the failure `portalKit.ts` exists to make impossible.
     */
    function shlexSplit(line: string): string[] {
        const out: string[] = [];
        let word = '';
        let inWord = false;
        let quote: '' | "'" | '"' = '';
        for (let i = 0; i < line.length; i++) {
            const ch = line[i];
            if (quote === "'") {
                if (ch === "'") quote = ''; else word += ch;
                continue;
            }
            if (quote === '"') {
                if (ch === '"') quote = '';
                else if (ch === '\\' && i + 1 < line.length && '"\\$`'.includes(line[i + 1])) {
                    word += line[++i];
                } else word += ch;
                continue;
            }
            if (/\s/.test(ch)) {
                if (inWord) { out.push(word); word = ''; inWord = false; }
                continue;
            }
            inWord = true;
            if (ch === "'" || ch === '"') { quote = ch; continue; }
            if (ch === '\\' && i + 1 < line.length) { word += line[++i]; continue; }
            word += ch;
        }
        if (inWord) out.push(word);
        return out;
    }

    const tricky = ['plain', 'two words', "it's", 'a "quoted" word', '$HOME',
                    '`whoami`', 'back\\slash', 'semi;colon', 'pipe | x', '> f',
                    'tab\there', 'ünïcødé ✓', 'Key=Name,Value=web tier', '', '*.log',
                    "''", "'", 'trailing\\'];
    for (const value of tricky) {
        const line = portal.cli(['aws', 'x'], { '--value': value === '' ? 'kept' : value });
        const words = shlexSplit(line);
        check(`quote() survives shlex: ${JSON.stringify(value)}`,
              words.length === 4 && words[3] === (value === '' ? 'kept' : value),
              { line, words });
    }
    check('an empty positional survives as one empty argument',
          JSON.stringify(shlexSplit(portal.cli(['mgr', 'x', '']))) === JSON.stringify(['mgr', 'x', '']));
    check('a safe word is left unquoted, so the drawer reads like the docs',
          portal.cli(['aws', 'ec2', 'create-vpc'], { '--cidr-block': '10.0.0.0/16' })
              === 'aws ec2 create-vpc --cidr-block 10.0.0.0/16');

    const flags = portal.cli(['aws', 'rds', 'create-db-instance'], {
        '--db-instance-identifier': 'db1',
        '--multi-az': true,
        '--no-multi-az': false,
        '--description': '',
        '--nothing': null,
        '--tags': ['a=1', 'b two'],
        '--empty': [],
        '--port': 5432,
    });
    check('true is a BARE flag (the engines declare their booleans)',
          / --multi-az( |$)/.test(flags) && !/--multi-az true/.test(flags), flags);
    check('false, null and an empty string OMIT the flag',
          !/--no-multi-az|--description|--nothing/.test(flags), flags);
    check('an array is the flag then each value; an empty array is omitted',
          /--tags a=1 'b two'/.test(flags) && !/--empty/.test(flags), flags);
    check('numbers are written as numbers', / --port 5432$/.test(flags), flags);
    check('flags keep their insertion order',
          flags.indexOf('--db-instance-identifier') < flags.indexOf('--multi-az')
          && flags.indexOf('--multi-az') < flags.indexOf('--tags'), flags);

    check('parseJson reads a document', portal.parseJson('{"a":1}')?.a === 1);
    check('parseJson tolerates a note line before the JSON',
          portal.parseJson('note: done\n{"Vpc":{"VpcId":"vpc-1"}}')?.Vpc?.VpcId === 'vpc-1');
    check('parseJson answers null for text, never throws',
          portal.parseJson('make_bucket: x') === null && portal.parseJson('') === null);
    check('errorText prefers the error, then the output, and is never empty',
          portal.errorText({ ok: false, error: 'boom' }) === 'boom'
          && portal.errorText({ ok: false, output: 'out' }) === 'out'
          && portal.errorText({ ok: false }).length > 0
          && portal.errorText(null).length > 0);
    check('errorCode pulls the AWS-style code out of the message',
          portal.errorCode({ ok: false, error: 'An error occurred (DependencyViolation) when calling' })
              === 'DependencyViolation');
    check('pick answers the fallback for a missing or wrong-typed path',
          portal.pick({ a: { b: 1 } }, 'a.c', 'x') === 'x'
          && portal.pick({ a: 3 }, 'a.b', 7) === 7
          && Array.isArray(portal.pick({ a: { b: 'str' } }, 'a.b', [])));
    check('rows keeps only objects', portal.rows({ l: [1, null, { a: 1 }, 'x'] }, 'l').length === 1);
    check('matches is on the named fields, not on key names',
          portal.matches({ state: 'running', name: 'web' }, 'web', ['name'])
          && !portal.matches({ state: 'running', name: 'web' }, 'state', ['name', 'state'])
          && portal.matches({ tags: ['prod', 'eu'] }, 'EU', ['tags']));
    const ties = [{ k: 1, id: 'a' }, { k: 0, id: 'b' }, { k: 1, id: 'c' }, { k: 0, id: 'd' }];
    check('sortBy is stable on equal keys (a table must not reshuffle)',
          portal.sortBy(ties, 'k').map(r => r.id).join('') === 'bdac'
          && portal.sortBy(ties, 'k', 'desc').map(r => r.id).join('') === 'acbd');
    check('sortBy sorts numbers numerically and text naturally',
          portal.sortBy([{ v: 'i-10' }, { v: 'i-9' }], 'v').map(r => r.v).join() === 'i-9,i-10');
    check('the CIDR rule accepts a CIDR and refuses junk',
          portal.RULES.cidr()('10.0.0.0/16') === '' && portal.RULES.cidr()('') === ''
          && portal.RULES.cidr()('10.0.0/16') !== '' && portal.RULES.cidr()('300.0.0.0/8') !== ''
          && portal.RULES.cidr()('10.0.0.0/33') !== '');
    check('validate answers the first failing message',
          portal.validate('', [portal.RULES.required('Name')]) === 'Name is required.');
}

{
    const host = source('src/components/labs/portals/LabPortal.vue');
    const workspace = source('src/views/LabWorkspace.vue');
    const skins = [...host.matchAll(/(\w+): lazy\(\(\) => import\('\.\/([\w/]+\.vue)'\)\)/g)]
        .map(m => ({ skin: m[1], path: `src/components/labs/portals/${m[2]}` }));
    check('LabPortal knows all twenty-one skins',
          ['aws', 'awsops', 'azure', 'ambari', 'sparkui', 'fabric', 'jira', 'servicenow',
           'docker', 'k8s', 'jenkins', 'hcpterraform', 'githubdesktop', 'mlflow',
           'pgadmin', 'snowflake', 'airflow', 'dbt', 'confluent', 'flink', 'datahub']
              .every(s => skins.some(row => row.skin === s)), skins.map(s => s.skin));
    check('every skin is an ASYNC chunk with an error component (rule 47)',
          /defineAsyncComponent\(\{[\s\S]*?errorComponent/.test(host)
          && !/^import \w+ from '\.\/(aws|awsops|azure|ambari|spark|fabric|jira|servicenow|docker|k8s|jenkins|terraform|github|mlflow|pgadmin|snowflake|airflow|dbt|confluent|flink|datahub)\//m.test(host));
    check('the host declares the simulation in the frame (rule 21)',
          /sl-portal__sim/.test(host) && /tool\.fidelity/.test(host));
    check('the workspace renders a portal tool with LabPortal',
          /<LabPortal[\s\S]{0,200}tool\.kind === 'portal'/.test(workspace));
    check('a portal action AWAITS the fresh view before resolving',
          /async function runPortal[\s\S]{0,400}await refreshViews\(\)[\s\S]{0,40}return result/.test(workspace));

    const dir = resolve(process.cwd(), 'src/components/labs/portals');
    const files: string[] = [];
    const walk = (folder: string) => {
        for (const entry of readdirSync(folder, { withFileTypes: true })) {
            const full = resolve(folder, entry.name);
            if (entry.isDirectory()) walk(full);
            else if (/\.(vue|ts|css)$/.test(entry.name)) files.push(full);
        }
    };
    walk(dir);
    check('the portal directory has its files', files.length >= 9, files.length);
    for (const skin of skins) {
        check(`${skin.skin}: its entry component exists`,
              files.some(f => f.replace(/\\/g, '/').endsWith(skin.path.replace(/^src\/components\/labs\/portals\//, ''))));
    }
    for (const full of files) {
        const name = full.replace(/\\/g, '/').replace(/^.*\/portals\//, 'portals/');
        const raw = readFileSync(full, 'utf8');
        const text = stripComments(raw);
        check(`${name}: no v-html`, !/v-html/.test(text));
        check(`${name}: no innerHTML / outerHTML / insertAdjacentHTML`,
              !/innerHTML|outerHTML|insertAdjacentHTML/.test(text));
        check(`${name}: makes no network request of its own`,
              !/\bfetch\(|XMLHttpRequest|new\s+WebSocket|navigator\.sendBeacon|new\s+Image\(/.test(text));
        check(`${name}: loads nothing remote (no remote src, url() or @import)`,
              !/src=["']https?:|url\(\s*["']?https?:|@import\s+url/.test(text));
        /*
         * A SHELL command line is never a template or a concatenation: a typed
         * value spliced into one is how a name with a space becomes two
         * arguments. Scoped to lines that START with a CLI word - a HiveQL,
         * T-SQL or DAX statement is not a shell line, `cli()` does not apply
         * to it, and the engine reads it whole.
         */
        const CLI_HEAD = '(aws|az|hdfs|hadoop|yarn|spark-submit|spark-sql|kubectl|helm|docker|'
            + 'mgr|snow|fab|git|terraform|jenkins|mlflow|curl|ops|bicep|mlx|torchserve|vllm|'
            + 'psql|snowsql|dbt|airflow|kafka-[a-z-]+|connect|schema-registry|flink|gx|'
            + 'contract|monitor|datahub|feast|lake|platform)\\b';
        check(`${name}: never builds a shell command by concatenation or template (use cli())`,
              !new RegExp('\\.exec\\(\\s*`\\s*' + CLI_HEAD).test(text)
              && !new RegExp('\\.exec\\(\\s*[\'"]\\s*' + CLI_HEAD + '[^\'"]*[\'"]\\s*\\+').test(text));
        if (full.endsWith('.css')) {
            check(`${name}: a skin stylesheet declares nothing on :root, html or body`,
                  !/(^|[\s,}]):root|(^|[\s,}])(html|body)\s*[{,]|:global/m.test(text));
            const leaf = name.split('/').pop()!.replace(/\./g, '\\.');
            check(`${name}: is never imported from a script (that would make it global)`,
                  !files.some(other => /\.(ts|vue)$/.test(other)
                      && new RegExp('import\\s+[\'"][^\'"]*' + leaf + '[\'"]')
                          .test(readFileSync(other, 'utf8'))));
        }
        if (full.endsWith('.vue')) {
            const styles = [...raw.matchAll(/<style\b([^>]*)>/g)].map(m => m[1]);
            check(`${name}: every <style> block is scoped`,
                  styles.every(attrs => /\bscoped\b/.test(attrs)), styles);
            // In the STYLE blocks only: `arn:aws:iam::123:root` is an IAM
            // principal in a script, not a selector.
            const css = [...raw.matchAll(/<style\b[^>]*>([\s\S]*?)<\/style>/g)]
                .map(m => m[1]).join('\n');
            check(`${name}: declares nothing on :root`, !/:root\b/.test(css));
        }
    }
}

{
    /*
     * FULL SCREEN, for every portal and for the workbench (every other tool).
     *
     * Three ways out must exist - an exit button, an X, and Escape - because a
     * student who cannot leave a full-window console has a broken page; and
     * the overlay fallback must exist, because iPhone Safari has no element
     * full screen at all and a button that does nothing there is the failure.
     */
    const composable = stripComments(source('src/composables/useFullscreen.ts'));
    check('full screen: the native API is used where it exists',
          /requestFullscreen\(/.test(composable) && /exitFullscreen\(/.test(composable));
    check('full screen: a refused or missing API falls back to the overlay',
          /catch\s*\{[\s\S]{0,200}\}\s*\}\s*native\.value = false;\s*active\.value = true;/.test(composable));
    check('full screen: Escape leaves the overlay (the browser handles native)',
          /event\.key === 'Escape' && active\.value && !native\.value/.test(composable));
    check('full screen: the page behind the overlay is scroll-locked, and unlocked again',
          /setLock\(true\)/.test(composable) && /setLock\(false\)/.test(composable));
    check('full screen: leaving the page exits it',
          /onBeforeUnmount\([\s\S]{0,400}exit\(\)/.test(composable));

    const host = source('src/components/labs/portals/LabPortal.vue');
    const bench = source('src/views/LabWorkspace.vue');
    for (const [label, text, api] of [['portal', host, 'fs'], ['workbench', bench, 'benchFs']] as const) {
        check(`full screen (${label}): an enter button`,
              new RegExp(`v-if="!${api}\\.active\\.value"[\\s\\S]{0,200}@click="${api}\\.enter\\(\\)"`).test(text));
        check(`full screen (${label}): an explicit exit button AND an X once in`,
              (text.match(new RegExp(`@click="${api}\\.exit\\(\\)"`, 'g')) || []).length >= 2
              && /<X class=/.test(text));
        check(`full screen (${label}): both states are labelled`,
              /\$t\('Full screen'\)/.test(text) && /\$t\('Exit full screen'\)/.test(text));
    }
    const css = source('src/assets/css/labs.css');
    check('full screen: the overlay fallback is fixed over the whole viewport, for both',
          /\.sl-portal\.is-overlay\s*\{[^}]*position:\s*fixed;[^}]*inset:\s*0/.test(css)
          && /\.sl-bench\.is-overlay\s*\{[^}]*position:\s*fixed;[^}]*inset:\s*0/.test(css));
    check('full screen: the frame takes the whole height in either mechanism',
          /\.sl-portal\.is-full \.sl-portal__frame,\s*\.sl-portal:fullscreen \.sl-portal__frame/.test(css));
    check('the cascade guard reverts the galaxy\'s field ink inside a product',
          /\.sl-portal__frame :is\(input, textarea, select, button\)\s*\{[^}]*color:\s*revert/.test(css));
    check('...and the 44px touch minimum that breaks dense product tables',
          /@media \(pointer: coarse\)\s*\{[^}]*\.sl-portal__frame[\s\S]{0,200}min-height:\s*revert/.test(css));
}

/* ─────────────────── the GUI route and the lesson modal ─────────────────── */

section('18. Which tasks the GUI can do, and Review the lesson');
{
    const t = (id: string, kind: LabTool['kind']) => ({ id, kind, label: id } as LabTool);
    const tools = [t('terminal', 'console'), t('aws_console', 'portal'), t('azure_portal', 'portal')];
    check('portalTools keeps only the portals',
          portalTools(tools).map(x => x.id).join() === 'aws_console,azure_portal');
    check('guiToolsFor names only portals the lab actually has',
          guiToolsFor({ gui: ['aws_console', 'gone_portal', 'terminal'] }, tools)
              .map(x => x.id).join() === 'aws_console');
    check('a task from a replica a release behind (no `gui`) has no GUI route, never an error',
          guiToolsFor({}, tools).length === 0);
    const tasks = source('src/components/labs/LabTasks.vue');
    check('a task card offers its portal as a button that opens the tool',
          /@click="\$emit\('open-tool', tool\.id\)"/.test(tasks) && /guiFor\(task\)/.test(tasks));
    check('...and says nothing about a GUI in a lab that has none',
          /v-if="hasPortals && task\.gui/.test(tasks));
    const bench = source('src/views/LabWorkspace.vue');
    check('the brief names the portals and opens them',
          /v-if="labPortals\.length"/.test(bench) && /@click="openTool\(tool\.id\)"/.test(bench));
    check('the brief has a Review the lesson button wired to the modal',
          /@click="lessonOpen = true"/.test(bench) && /<LabLessonModal :open="lessonOpen"/.test(bench));
    const modal = source('src/components/labs/LabLessonModal.vue');
    check('the lesson modal renders with LabBrief (same parser) and never v-html',
          /<LabBrief v-if="content"/.test(modal) && !/v-html/.test(stripComments(modal)));
    check("the lesson modal is teleported out of the workbench's stacking context",
          /<Teleport to="body">/.test(modal));
    const svc = source('src/services/course.service.ts');
    check('the lesson lookup filters by lab_id client-side too (an old replica ignores ?lab_id=)',
          /lab_id=\$\{encodeURIComponent\(labId\)\}/.test(svc) && /row\.lab_id \|\| ''\) === labId/.test(svc));
}

/* ─────────────────── a verified task stays verified ─────────────────── */
{
    const task = (id: string, status: 'passed' | 'pending' | 'unavailable', points = 2) => ({
        id, title: id, detail: '', hint: '', points, status, note: '', requires: '', manual: false,
    });
    const grade = (tasks: any[]) => ({
        tasks, done: tasks.filter(t => t.status === 'passed').length, total: tasks.length,
        earned: tasks.filter(t => t.status === 'passed').reduce((n, t) => n + t.points, 0),
        possible: tasks.reduce((n, t) => n + t.points, 0), percent: 0,
        status: 'in_progress' as const, unavailable: [],
    });
    // The reported fault, in miniature: t2 passed, then t3 passed and the
    // grader (reading only the current state) answered t2 as pending.
    const before = grade([task('t1', 'passed'), task('t2', 'passed'), task('t3', 'pending')]);
    const after = grade([task('t1', 'passed'), task('t2', 'pending'), task('t3', 'passed')]);
    const kept = keepVerified(after as any, before as any);
    check('a task verified earlier stays done after a later task passes',
          kept.tasks.find(t => t.id === 't2')?.status === 'passed');
    check('...it is marked kept', kept.tasks.find(t => t.id === 't2')?.kept === true);
    check('...and the totals are recomputed from the rows',
          kept.done === 3 && kept.earned === 6 && kept.percent === 100 && kept.status === 'completed');
    check('the progress record counts as verified too (a reset, an old replica)',
          keepVerified(grade([task('t1', 'pending')]) as any, null, ['t1']).tasks[0].status === 'passed');
    check('an id the lab no longer has does not come back as a phantom row',
          keepVerified(grade([task('t1', 'pending')]) as any, null, ['gone']).tasks.length === 1);
    check('nothing to keep returns the grade unchanged',
          keepVerified(after as any) === (after as any));
    const ws = source('src/views/LabWorkspace.vue');
    check('the workspace keeps verified tasks on open and on Check my work',
          /keepVerified\(payload\.grade, null, payload\.progress\?\.tasks_done/.test(ws)
          && /keepVerified\(result\.grade, before\)/.test(ws));
    check('switching labs clears the grade, so ids like t1 do not leak between labs',
          /grade\.value = \{ tasks: \[\], done: 0/.test(ws));
}

/* ─────────────────── the task information window ─────────────────── */
{
    const tools = [
        { id: 'sql', label: 'SQL', kind: 'query', engine: 'sqlite', family: 'sql' },
        { id: 'editor', label: 'Files', kind: 'editor', engine: 'files', family: 'shell' },
    ] as any[];
    const base = { id: 't2', title: 'Count Jordan', detail: 'Count the orders from Jordan.',
                   hint: 'Use WHERE', points: 1, status: 'pending', note: '',
                   requires: '', manual: false } as any;
    const sql = guideFor({ ...base, guide: {
        kinds: ['sql_result'], combine: '', where: ['sql', 'gone'], files: [], parts: [],
        tables: ['orders'], families: [], commands: ["SELECT COUNT(*) FROM orders WHERE country = 'JO';"],
        hint_commands: [], negative: false, refusal: false, must_succeed: false,
        steps: ['the query SELECT ... answers at least 1'] } }, tools);
    check('the guide names only tools this lab has', sql.where.map(t => t.id).join() === 'sql');
    check('a SQL task names its table as a literal',
          sql.steps.some(step => (step.code || []).includes('orders')));
    check('every step is a catalogue key check:i18n can see',
          [...sql.steps, ...sql.tips, ...sql.mistakes].every(step => GUIDE_KEYS.includes(step.key)));
    check('the last step is Check my work',
          sql.steps[sql.steps.length - 1].key.startsWith('Press "Check my work"'));
    check('the grader\'s own sentences are kept for "How it is checked"', sql.checks.length === 1);
    const legacy = guideFor(base, tools);
    check('a task from a replica a release behind still gets a window, never an empty one',
          legacy.steps.length >= 2 && legacy.tips.length >= 2);
    const manual = guideFor({ ...base, manual: true }, tools);
    check('a self-marked task ends on "I have done this", not on Check my work',
          manual.steps.some(step => step.key.includes('"I have done this"'))
          && !manual.steps.some(step => step.key.startsWith('Press "Check my work"')));
    const already = guideFor({ ...base,
        note: 'already true when you started - it counts once you have done this step yourself' }, tools);
    check('a task withheld because it was true at the start says why',
          already.baseline && already.tips[0].key.startsWith('This was already true'));
    const file = guideFor({ ...base, guide: {
        kinds: ['file_contains'], combine: '', where: ['editor'], files: ['Dockerfile'], parts: [],
        tables: [], families: [], commands: [], hint_commands: [], negative: false,
        refusal: false, must_succeed: false, steps: [] } }, tools);
    check('a file task tells the student to save',
          file.steps.some(step => step.key.startsWith('Save the file')));
    const tasks = source('src/components/labs/LabTasks.vue');
    check('every task card has an "i" button that opens the guide',
          /class="sl-task__info"/.test(tasks) && /@click="infoAt = at"/.test(tasks)
          && /<LabTaskGuide :task="infoTask"/.test(tasks));
    const guide = source('src/components/labs/LabTaskGuide.vue');
    check('the guide is teleported out of the workbench', /<Teleport to="body">/.test(guide));
    check('the guide keeps the hint behind a press', /v-if="hintOpen" class="sltg-hint"/.test(guide));
    check('commands and paths in the guide are LTR literals', /class="sltg-code" dir="ltr"/.test(guide));
    check('Escape closes the guide', /@keydown\.esc="\$emit\('close'\)"/.test(guide));
}

/* ─────────────────── review the lesson: only a lesson that links here ─────────────────── */
{
    const ws = source('src/views/LabWorkspace.vue');
    check('the Review the lesson button is drawn only when a lesson links this lab',
          /<div v-if="lessonsForLab && lessonsForLab\.length" class="sl-brief-tools">/.test(ws));
    check('a remembered origin is trusted only when it is one of the linked lessons',
          /linked\.some\(row => row\.external_lesson_id === raw\.lessonId\)/.test(ws));
    const modal = source('src/components/labs/LabLessonModal.vue');
    check('the modal never fetches an unlinked origin lesson on its own',
          !/getLesson\(origin\.lessonId\)/.test(stripComments(modal))
          && /String\(row\.lab_id \|\| ''\) === props\.labId/.test(modal));
}

/* ─────────────────── report ─────────────────── */

console.log(`\n${passed} passed, ${failures.length} failed`);
for (const line of failures) console.log(`  FAIL  ${line}`);
if (failures.length) process.exit(1);
console.log('PASS');
