/**
 * npm run check:labsteps - the step parser over EVERY written task step.
 *
 * Reads selfstudyuserlab/utils/labinstructions/*.json off disk (skips, not
 * passes, when the sibling repo is absent) and asserts:
 *   - known step shapes yield exactly the command a student must copy;
 *   - a command is never cut into prose, and prose is never offered as a command;
 *   - coverage: the share of command-bearing steps that get a "why".
 */
import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { parseStep, explainCommand, explainGuiStep } from '@/utils/labSteps';
import { guiSections, type WalkthroughMap } from '@/utils/labDocs';

let passed = 0;
let failed = 0;
function check(label: string, ok: boolean, detail = '') {
    if (ok) { passed += 1; return; }
    failed += 1;
    console.log(`  FAIL ${label}${detail ? '  -- ' + detail : ''}`);
}

// 1. Known shapes ----------------------------------------------------------
const CASES: Array<[string, string[], boolean]> = [
    ['Run `ssh api-1` - logs you into api-1, one of the two servers.', ['ssh api-1'], false],
    ['Type: aws ec2 create-subnet --vpc-id <your-vpc-id> --cidr-block 10.20.2.0/24', ['aws ec2 create-subnet --vpc-id <your-vpc-id> --cidr-block 10.20.2.0/24'], true],
    ['Check with: aws s3 ls s3://selfstudy-app-assets-yourname', ['aws s3 ls s3://selfstudy-app-assets-yourname'], true],
    ['In the dbt CLI run: dbt run --vars "{load_dts: \'2026-11-02 00:00:00\'}"', ['dbt run --vars "{load_dts: \'2026-11-02 00:00:00\'}"'], true],
    ['Run: jenkins-cli build demo -v and check it ends Finished: SUCCESS.', ['jenkins-cli build demo -v'], true],
    ['Type: docker compose config', ['docker compose config'], true],
    ['Run: systemctl is-active nginx  (expect: active)', ['systemctl is-active nginx'], true],
    ['Type: mkdir docs logs', ['mkdir docs logs'], true],
    ['Run: spark-sql -e "SELECT c.segment, COUNT(*) AS events FROM web_events e JOIN customers c ON e.user_id = c.customer_id GROUP BY c.segment"',
        ['spark-sql -e "SELECT c.segment, COUNT(*) AS events FROM web_events e JOIN customers c ON e.user_id = c.customer_id GROUP BY c.segment"'], true],
    ['Press Check my work.', [], false],
    ['Open the SQL Editor.', [], true],
    ['Save the file and re-read it to check the indentation lines up.', [], false],
    ['In the Files tool, open inventory.ini.', [], true],
    ['Read the token count; try a longer sentence and compare.', [], false],
];
for (const [step, want, wantWhy] of CASES) {
    const got = parseStep(step);
    check(`commands of "${step.slice(0, 60)}"`, JSON.stringify(got.commands) === JSON.stringify(want),
        JSON.stringify(got.commands));
    check(`why present for "${step.slice(0, 60)}"`, Boolean(got.why) === wantWhy, got.why || '(none)');
    const joined = got.parts.map(p => p.text).join('');
    check(`nothing lost from "${step.slice(0, 40)}"`, joined.replace(/`/g, '') === step.replace(/`/g, ''), joined);
}
check('sudo is explained', /administrator/.test(explainCommand('sudo systemctl restart shopapi')));
check('a pipe is explained', /\|/.test(explainCommand("awk '{print $9}' x | sort")));
check('SELECT is read-only', /changes nothing/.test(explainCommand('SELECT * FROM users')));
check('Grafana step', /dashboards/.test(explainGuiStep('Open the Grafana tab to see the panels.')));
check('unknown command -> empty', explainCommand('frobnicate --x') === '');

// 2. Every real step -------------------------------------------------------
const dir = join(process.cwd(), '..', 'selfstudyuserlab', 'utils', 'labinstructions');
if (!existsSync(dir)) {
    console.log('  skip  every-step pass (selfstudyuserlab is not checked out beside this repo)');
} else {
    let steps = 0, withCmd = 0, withWhy = 0, explainedSelf = 0, gui = 0;
    const unexplained = new Map<string, number>();
    for (const name of readdirSync(dir).filter(f => f.endsWith('.json'))) {
        const data = JSON.parse(readFileSync(join(dir, name), 'utf-8'));
        for (const tasks of Object.values<any>(data.labs || {})) {
            for (const row of Object.values<any>(tasks)) {
                for (const step of row.steps || []) {
                    steps += 1;
                    const got = parseStep(step);
                    if (got.commands.length) {
                        withCmd += 1;
                        if (got.why) withWhy += 1;
                        else if (/\s[—–-]\s+\S/.test(step)) explainedSelf += 1;
                        else {
                            const w = got.commands[0].replace(/^sudo\s+/, '').split(/\s+/)[0];
                            unexplained.set(w, (unexplained.get(w) || 0) + 1);
                        }
                        for (const c of got.commands) {
                            check(`command is not empty (${name})`, c.trim().length > 0);
                            check(`command does not end mid-word with a dash (${name}: ${c.slice(-30)})`, !/\s-$/.test(c));
                        }
                    } else if (got.why) gui += 1;
                }
            }
        }
    }
    const covered = withCmd ? Math.round(100 * (withWhy + explainedSelf) / withCmd) : 100;
    console.log(`  ${steps} steps; ${withCmd} with a copyable command; ${covered}% of those explained`
        + ` (${withWhy} derived, ${explainedSelf} self-explained); ${gui} GUI steps explained`);
    const top = [...unexplained.entries()].sort((a, b) => b[1] - a[1]).slice(0, 15);
    if (top.length) console.log('  most common unexplained programs: ' + top.map(([w, n]) => `${w}(${n})`).join(' '));
    check('at least 85% of command steps are explained', covered >= 85, `${covered}%`);
}

// 3. The SRE tasks have GUI walkthroughs ------------------------------------
// The reported fault: a PromQL task said "this task is done in the terminal"
// in its GUI tab. Every SRE portal now has a recipe map; check the tasks that
// a portal can do actually resolve to at least one walkthrough.
{
    const sreFile = join(dir, 'sre.json');
    if (existsSync(sreFile)) {
        const maps: Record<string, WalkthroughMap> = {};
        for (const skin of ['grafana', 'prometheus', 'grafanaslo', 'pagerduty', 'cockpit']) {
            maps[skin] = JSON.parse(readFileSync(join(process.cwd(), 'src/utils/labWalkthrough/maps', skin + '.json'), 'utf-8'));
        }
        const tools = [
            { id: 'sre_grafana', label: 'Grafana', kind: 'portal', skin: 'grafana' },
            { id: 'sre_alerts', label: 'Prometheus & Alertmanager', kind: 'portal', skin: 'prometheus' },
            { id: 'sre_slo', label: 'SLOs', kind: 'portal', skin: 'grafanaslo' },
            { id: 'sre_incidents', label: 'Incidents', kind: 'portal', skin: 'pagerduty' },
            { id: 'sre_fleet', label: 'Fleet & Hosts', kind: 'portal', skin: 'cockpit' },
        ];
        const data = JSON.parse(readFileSync(sreFile, 'utf-8'));
        let portalLabTasks = 0, withGui = 0;
        const portalLabs = Object.keys(data.labs).filter(id => !/sre-(02|08|09|10|11|12|13|14)-/.test(id));
        for (const labId of portalLabs) {
            for (const [taskId, row] of Object.entries<any>(data.labs[labId])) {
                portalLabTasks += 1;
                const sections = guiSections({ id: taskId, title: taskId, instructions: row }, tools, maps);
                if (sections.length) withGui += 1;
            }
        }
        const one = (lab: string, task: string, skin: string) => guiSections(
            { id: task, title: task, instructions: data.labs[lab][task] }, tools, maps).some(s => s.skin === skin);
        check('sre-01 t3 (rate query) has a Prometheus walkthrough', one('sre-01-estate', 't3', 'prometheus'));
        check('sre-15 t1 (error ratio) has a Prometheus walkthrough', one('sre-15-observability', 't1', 'prometheus'));
        check('sre-15 t2 (p99) has a Grafana walkthrough', one('sre-15-observability', 't2', 'grafana'));
        check('sre-17 t2 (declare) has a PagerDuty walkthrough', one('sre-17-incident', 't2', 'pagerduty'));
        check('sre-05 t4 (redis on cache-1) has a Cockpit walkthrough', one('sre-05-network', 't4', 'cockpit'));
        check('sre-16 t1 (slo apply) has an SLO walkthrough', one('sre-16-slo', 't1', 'grafanaslo'));
        console.log(`  SRE estate labs: ${withGui} of ${portalLabTasks} tasks have a GUI walkthrough`);
        check('most SRE estate tasks have a GUI walkthrough', withGui / Math.max(1, portalLabTasks) >= 0.8, `${withGui}/${portalLabTasks}`);
    }
}

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
