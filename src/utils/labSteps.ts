/**
 * A lab task's written step, made actionable: which part is a COMMAND (so it
 * gets a Copy button) and WHY that command - or that graphical tool - is used.
 *
 * Plain module (no Vue, no DOM), checked by `npm run check:labs`. It serves
 * every track at once: ~9,400 steps written in a handful of styles over the
 * years ("Type: ls -la", "Run: kubectl get pods", "In the dbt CLI run: dbt
 * run", "Check with: aws s3 ls ...", and the explained form "Run `ssh api-1`
 * - logs you into api-1 ..."). Rewriting all of them by hand to carry an
 * explanation would take weeks and drift; deriving the explanation from the
 * command itself (and from the product named in a GUI step) gives every step
 * one now, while a step that already explains itself is left exactly as
 * written.
 */

export interface StepPart { kind: 'text' | 'code'; text: string }
export interface ParsedStep {
    parts: StepPart[];
    /** The commands in the step, in order - each one gets a Copy button. */
    commands: string[];
    /** An explanation derived from the command or the tool, when the step has none. */
    why: string;
}

const TICK = /`([^`\n]{1,600})`/g;
// "Type: cmd", "Run: cmd", "In the X console run: cmd", "Check with: cmd" ...
// The command runs to the end, or to the first explanation / expected result.
const LEAD = /^((?:[^:`]{0,60}?\s)?(?:type|run|runs?|execute|check(?: it)?(?: with)?|confirm(?: with)?|look|test|compare|describe it|inspect|try|query|ask|see who gets paged|read the init output|then|again|add|create|write|paste)\s*:\s*)(.+)$/i;
const SPLITS = [/\s+[—–]\s+/, /\s+-\s+(?=[a-zA-Z(])/, /\s{2,}\(/, /\s+\((?:expect|or |should|answers|times out|still|three|see|it )/i,
    /\.\s+(?:Press|Then|Read|Check|Note|Find|Look|Compare)\b/, /,\s+then\s+/i, /\s+and press\b/i, /\s+and check\b/i,
    /\s+and read\b/i, /\s+to (?:see|list|check|confirm|find|show|read|watch)\b/i,
    /\s+and (?:enter|remember|re-read|note|confirm|compare|look|see|watch|find|copy|keep|wait|make sure|answer)\b/i,
    /;?\s+and print\(/i];
// English words a step can start a sentence with - never a program.
const STOP = new Set(['the', 'a', 'an', 'and', 'or', 'every', 'each', 'use', 'report', 'if', 'it', 'its',
    'that', 'this', 'these', 'your', 'all', 'both', 'which', 'what', 'there', 'when', 'only', 'no', 'not']);
// "Check: rows = 20001" - an expected RESULT after a check verb, not something to type.
const EXPECTED = /^[a-z_]\w*\s*=\s*[^()'"`]+$/i;
const CHECK_VERB = /\b(?:check|confirm|compare|look)\b[^:]*:\s*$/i;
const ALREADY_EXPLAINED = /\s[—–-]\s+\S|\b(?:because|so that|so you|to see|to check|to list|which|that shows|so the)\b/i;
const COMMAND_START = /^(?:sudo\s+)?[a-z][\w.-]*(?:\s|$)|^\.?\/|^(?:SELECT|WITH|INSERT|UPDATE|DELETE|CREATE|DROP|ALTER|MERGE|EXPLAIN|SHOW|DESCRIBE|USE|GRANT|REVOKE|COPY|CALL|TRUNCATE|SET|BEGIN|COMMIT|PRAGMA|%%sql)\b/i;

function cleanCommand(text: string): string {
    let cmd = text.trim();
    for (const rx of SPLITS) {
        const m = rx.exec(cmd);
        if (m && m.index > 1) cmd = cmd.slice(0, m.index);
    }
    // A sentence full stop after a command is punctuation, not part of it
    // (a path or a version ending in "." keeps it: `docker build -t x .`).
    if (/[a-z0-9)'"\]]\.$/i.test(cmd) && !/\s\.$/.test(cmd)) cmd = cmd.slice(0, -1);
    return cmd.trim();
}

function looksLikeCommand(text: string): boolean {
    if (!text || text.length > 600) return false;
    if (!COMMAND_START.test(text)) return false;
    // Prose that merely starts with a verb ("the file is listed"): a command
    // has a flag, a path, a quote, an operator, or a known program name.
    const first = text.replace(/^sudo\s+/, '').split(/\s+/)[0].toLowerCase();
    if (STOP.has(first)) return false;
    return KNOWN.has(first) || /[-/=.'"|>{}()[\]*$:]/.test(text) || /^[A-Z]{3,}\b/.test(text);
}

/** Split one written step into prose and commands, and find (or make) its why. */
export function parseStep(step: string): ParsedStep {
    const text = String(step || '');
    const parts: StepPart[] = [];
    const commands: string[] = [];
    TICK.lastIndex = 0;
    if (TICK.test(text)) {
        // Explained form: backticks mark exactly what to run.
        TICK.lastIndex = 0;
        let last = 0;
        let m: RegExpExecArray | null;
        while ((m = TICK.exec(text))) {
            if (m.index > last) parts.push({ kind: 'text', text: text.slice(last, m.index) });
            const inner = m[1].trim();
            if (looksLikeCommand(inner) && !/^[\w./-]+\.\w{1,5}$/.test(inner)) {
                parts.push({ kind: 'code', text: inner });
                commands.push(inner);
            } else {
                parts.push({ kind: 'text', text: inner });
            }
            last = m.index + m[0].length;
        }
        if (last < text.length) parts.push({ kind: 'text', text: text.slice(last) });
    } else {
        const lead = LEAD.exec(text);
        const cmd = lead ? cleanCommand(lead[2]) : '';
        const expected = lead && CHECK_VERB.test(lead[1]) && EXPECTED.test(cmd);
        if (lead && cmd && !expected && looksLikeCommand(cmd)) {
            // "du -sh logs and ls -l logs": two commands, two Copy buttons.
            const pieces = splitJoined(cmd);
            let at = text.indexOf(pieces[0], lead[1].length - 1);
            parts.push({ kind: 'text', text: text.slice(0, at) });
            for (const piece of pieces) {
                const found = text.indexOf(piece, at);
                if (found > at) parts.push({ kind: 'text', text: text.slice(at, found) });
                parts.push({ kind: 'code', text: piece });
                commands.push(piece);
                at = found + piece.length;
            }
            if (at < text.length) parts.push({ kind: 'text', text: text.slice(at) });
        } else {
            parts.push({ kind: 'text', text });
        }
    }
    const explained = commands.length
        ? ALREADY_EXPLAINED.test(text.slice(text.indexOf(commands[commands.length - 1]) + commands[commands.length - 1].length))
        : false;
    let why = '';
    if (commands.length && !explained) why = explainCommand(commands[0]);
    else if (!commands.length) why = explainGuiStep(text);
    return { parts: mergeText(parts), commands, why };
}

/** Split "cmd1 and cmd2" (or "and then cmd2") where the second half is a program. */
function splitJoined(cmd: string): string[] {
    const out: string[] = [];
    let rest = cmd;
    for (let guard = 0; guard < 4; guard += 1) {
        const m = /\s+and\s+(?:then\s+)?(?=(\S+))/i.exec(rest);
        if (!m) break;
        const next = rest.slice(m.index + m[0].length);
        const word = (m[1] || '').replace(/^sudo$/, '').toLowerCase();
        // Inside quotes "and" is data (a commit message, a SQL string).
        const before = rest.slice(0, m.index);
        const quotes = (before.match(/["']/g) || []).length;
        if (quotes % 2 === 1 || !(KNOWN.has(word) || /^sudo\s/.test(next)) || !looksLikeCommand(next)) break;
        out.push(before.trim());
        rest = next;
    }
    out.push(rest.trim());
    return out.filter(Boolean);
}

function mergeText(parts: StepPart[]): StepPart[] {
    const out: StepPart[] = [];
    for (const part of parts) {
        if (!part.text) continue;
        const prev = out[out.length - 1];
        if (prev && prev.kind === 'text' && part.kind === 'text') prev.text += part.text;
        else out.push({ ...part });
    }
    return out;
}

// ---------------------------------------------------------------------------
// Why a command is run
// ---------------------------------------------------------------------------

type Table = Record<string, string>;

/** `program` -> purpose; `program sub` -> purpose of the subcommand. */
const COMMANDS: Table = {
    ls: 'lists the files and folders here so you can see what exists before you work on it',
    cd: 'moves into that folder so the next commands run there',
    pwd: 'prints the folder you are in, so you know where relative paths point',
    cat: 'prints the whole file so you can read or verify its content',
    less: 'opens the file in a pager you can scroll (q to quit)',
    more: 'shows the file one screen at a time',
    head: 'shows only the first lines - a quick look at a file\'s format',
    tail: 'shows the last lines - where the newest log entries are',
    wc: 'counts lines, words or bytes (in a log, one line is usually one event)',
    grep: 'searches for lines matching a pattern, so you see only what matters',
    find: 'searches the folder tree for files by name or type',
    tree: 'draws the folder structure so you can see the project layout',
    mkdir: 'creates the folder the next steps write into',
    touch: 'creates an empty file (or updates its timestamp)',
    cp: 'copies a file - keeps the original as it was',
    mv: 'moves or renames a file',
    rm: 'deletes the file - there is no recycle bin, so check the name first',
    chmod: 'changes the file\'s permissions (for example +x makes a script executable)',
    chown: 'changes who owns the file, so the right user or service can use it',
    echo: 'prints text - with > or >> it writes that text into a file',
    printf: 'prints formatted text, often into a file',
    nano: 'opens the file in a simple terminal editor (Ctrl+O saves, Ctrl+X exits)',
    vi: 'opens the file in vi (i to type, Esc then :wq to save and quit)',
    vim: 'opens the file in vim (i to type, Esc then :wq to save and quit)',
    sed: 'edits text in place with a find-and-replace rule, without opening an editor',
    awk: 'picks columns out of each line - the quick way to summarise logs and CSVs',
    sort: 'orders the lines so equal values sit together or the biggest come first',
    uniq: 'collapses repeated lines; with -c it counts them',
    cut: 'keeps only some columns of each line',
    tr: 'translates or deletes characters',
    tee: 'writes the output to a file and still shows it on screen',
    xargs: 'turns the incoming lines into arguments for another command',
    jq: 'pulls fields out of JSON so it is readable',
    diff: 'shows exactly what differs between two files',
    curl: 'sends an HTTP request and shows the reply - tests a website or API the way a client does',
    wget: 'downloads a file over HTTP',
    ping: 'checks whether a host answers on the network and how long a round trip takes',
    ssh: 'opens a shell on that server, so the next commands run ON it (type exit to come back)',
    scp: 'copies a file to or from another server over SSH',
    exit: 'closes the current session and returns you to where you were before',
    hostname: 'prints which machine you are on',
    whoami: 'prints which user you are acting as',
    id: 'shows your user and groups - what you are allowed to do',
    uname: 'shows the operating system and kernel',
    uptime: 'shows how long the machine has run and its load average (busy-ness)',
    nproc: 'shows how many CPUs there are - compare it with the load average',
    free: 'shows how much memory is used and available',
    df: 'shows how full each filesystem is',
    du: 'adds up how much space files and folders use, to find what fills a disk',
    ps: 'lists running processes so you can find the one using CPU or memory',
    top: 'shows the busiest processes live (CPU, memory)',
    htop: 'shows the busiest processes live, interactively',
    kill: 'stops a process by its PID',
    lsof: 'lists open files and sockets per process (+L1: deleted files still held open)',
    ss: 'lists network sockets - which process listens on which port',
    netstat: 'lists network connections and listening ports',
    ip: 'shows network interfaces, addresses and routes',
    dig: 'asks DNS for a name\'s address, to test name resolution',
    nslookup: 'asks DNS for a name\'s address, to test name resolution',
    nc: 'tries to open a TCP connection to a port: succeeded, refused or timed out tells you where the problem is',
    tcpdump: 'captures the packets on the wire, to see what really arrives and what gets no reply',
    ufw: 'manages the host firewall rules',
    openssl: 'inspects TLS certificates and connections (subject, expiry date, verification)',
    certbot: 'requests or renews a TLS certificate from Let\'s Encrypt',
    systemctl: 'controls system services (systemd)',
    journalctl: 'reads the system and service logs collected by systemd',
    crontab: 'edits or lists scheduled jobs',
    tar: 'packs or unpacks an archive',
    sudo: 'runs the command as the administrator (root), which changing the system needs',
    apt: 'installs or updates software packages',
    pip: 'installs Python packages',
    python: 'runs the Python program and shows its output',
    python3: 'runs the Python program and shows its output',
    pytest: 'runs the automated tests and reports which pass or fail',
    node: 'runs the JavaScript program',
    npm: 'installs packages or runs the project\'s scripts',
    npx: 'runs a package\'s command without installing it globally',
    bash: 'runs the shell script',
    sh: 'runs the shell script',
    export: 'sets an environment variable for the commands that follow',
    env: 'lists the environment variables',
    history: 'lists the commands you typed earlier',
    clear: 'clears the screen',
    git: 'works with the Git repository (version history)',
    'git init': 'turns the folder into a Git repository so changes can be tracked',
    'git status': 'shows which files are changed, staged or untracked - check it before committing',
    'git add': 'stages the changes so the next commit includes them',
    'git commit': 'records the staged changes as a commit, with a message saying why',
    'git log': 'lists the commits so you can see the history',
    'git diff': 'shows exactly which lines changed',
    'git branch': 'lists or creates branches',
    'git checkout': 'switches branch (with -b it creates the branch first)',
    'git switch': 'switches branch',
    'git merge': 'brings another branch\'s commits into the current branch',
    'git rebase': 'replays your commits on top of another branch for a straight history',
    'git tag': 'names this exact commit (a release) so it can be found and deployed by name',
    'git revert': 'undoes a commit by adding a new one - safe on a shared branch',
    'git reset': 'moves the branch back (and can unstage or discard changes - be careful)',
    'git push': 'sends your commits to the remote repository',
    'git pull': 'fetches and merges the remote\'s new commits',
    'git clone': 'copies a repository to your machine',
    'git stash': 'puts uncommitted changes aside so you can switch work',
    'git remote': 'lists or adds remote repositories',
    'git show': 'shows one commit and its changes',
    'git restore': 'discards changes in a file or unstages it',
    'git cherry-pick': 'copies one commit onto the current branch',
    docker: 'works with containers',
    'docker build': 'builds an image from the Dockerfile',
    'docker run': 'starts a new container from an image',
    'docker ps': 'lists running containers and their ports',
    'docker images': 'lists the images on this machine',
    'docker logs': 'shows what the container printed - the first stop when it misbehaves',
    'docker exec': 'runs a command inside a running container',
    'docker stop': 'stops a running container',
    'docker rm': 'removes a container',
    'docker rmi': 'removes an image',
    'docker inspect': 'shows a container\'s full configuration as JSON',
    'docker stats': 'shows each container\'s CPU and memory use',
    'docker compose': 'manages the multi-container app described in compose.yaml',
    'docker network': 'manages the networks containers talk over',
    'docker volume': 'manages persistent storage for containers',
    'docker pull': 'downloads an image from a registry',
    'docker push': 'uploads an image to a registry',
    'docker tag': 'gives an image another name or version',
    kubectl: 'talks to the Kubernetes cluster',
    'kubectl apply': 'creates or updates the resources described in the file',
    'kubectl get': 'lists resources and their status',
    'kubectl describe': 'shows one resource in detail, including recent events (why something failed)',
    'kubectl delete': 'removes resources',
    'kubectl scale': 'changes how many replicas run',
    'kubectl logs': 'shows a pod\'s output',
    'kubectl exec': 'runs a command inside a pod',
    'kubectl rollout': 'follows, lists or undoes a deployment\'s rollout',
    'kubectl set': 'changes a field of a resource (for example the image), starting a rollout',
    'kubectl create': 'creates a resource',
    'kubectl expose': 'creates a Service in front of pods',
    'kubectl top': 'shows CPU and memory use',
    'kubectl port-forward': 'makes a pod\'s port reachable from your machine',
    'kubectl config': 'shows or switches the cluster context',
    'kubectl label': 'adds labels used to select resources',
    helm: 'installs and manages packaged Kubernetes apps (charts)',
    terraform: 'manages infrastructure as code',
    'terraform init': 'downloads the providers and modules the configuration needs',
    'terraform validate': 'checks the configuration is valid before planning',
    'terraform fmt': 'formats the files in the standard style',
    'terraform plan': 'shows what WOULD change, without changing anything - review it first',
    'terraform apply': 'makes the changes so reality matches the code',
    'terraform destroy': 'deletes everything this configuration manages',
    'terraform state': 'lists or shows what Terraform is tracking',
    'terraform output': 'prints the values the configuration exports',
    'terraform workspace': 'switches between separate states (environments)',
    'terraform import': 'brings an existing resource under Terraform\'s management',
    ansible: 'runs a module on the hosts in the inventory',
    'ansible-playbook': 'runs the playbook against the inventory\'s hosts',
    'ansible-inventory': 'shows the hosts and groups Ansible knows',
    'ansible-galaxy': 'creates or installs roles and collections',
    'ansible-vault': 'encrypts secrets used by playbooks',
    puppet: 'applies Puppet manifests to make the machine match them',
    'chef-client': 'runs the Chef recipes so the node matches them',
    knife: 'manages Chef nodes, cookbooks and roles',
    'jenkins-cli': 'drives the Jenkins server from the command line (jobs, builds, logs)',
    aws: 'works with Amazon Web Services',
    'aws sts': 'shows which AWS account and identity your commands run as',
    'aws ec2': 'manages virtual servers, networks and security groups',
    'aws s3': 'manages storage buckets and objects',
    'aws s3api': 'manages bucket settings such as versioning and policies',
    'aws iam': 'manages users, roles and permissions',
    'aws lambda': 'manages serverless functions',
    'aws dynamodb': 'manages DynamoDB tables',
    'aws cloudformation': 'deploys infrastructure from templates',
    'aws cloudwatch': 'reads metrics and manages alarms',
    'aws logs': 'reads CloudWatch log groups',
    'aws sns': 'manages notification topics (who gets alerted)',
    'aws rds': 'manages relational databases',
    az: 'works with Microsoft Azure',
    'az group': 'manages resource groups - containers for everything in one project',
    'az vm': 'manages virtual machines',
    'az storage': 'manages storage accounts and containers',
    'az network': 'manages networks, subnets and security rules',
    'az monitor': 'manages metrics, alerts and diagnostics',
    'az webapp': 'manages App Service web apps',
    'az appservice': 'manages App Service plans',
    'az resource': 'lists or manages resources of any type',
    'az account': 'shows which subscription you are using',
    'az deployment': 'deploys an ARM/Bicep template',
    'az role': 'manages access (RBAC) assignments',
    'az keyvault': 'manages secrets and keys',
    fab: 'works with Microsoft Fabric items from the command line',
    hdfs: 'works with files in the Hadoop distributed filesystem',
    hive: 'runs SQL on data stored in Hadoop',
    beeline: 'runs SQL against HiveServer2',
    'spark-sql': 'runs SQL with the Spark engine',
    'spark-submit': 'runs a Spark job on the cluster',
    yarn: 'shows and manages cluster applications',
    psql: 'runs SQL against PostgreSQL',
    snowsql: 'runs SQL against Snowflake',
    dbt: 'builds and tests the data models',
    'dbt run': 'builds the models into tables and views in the warehouse',
    'dbt test': 'runs the data tests so bad data is caught before anyone uses it',
    'dbt build': 'runs models, tests, seeds and snapshots in dependency order',
    'dbt seed': 'loads the CSV seed files as tables',
    'dbt compile': 'shows the SQL dbt would run, without running it',
    'dbt ls': 'lists the models and other resources dbt can see',
    'dbt debug': 'checks the connection and project setup',
    'dbt docs': 'generates the documentation and lineage graph',
    'dbt snapshot': 'records how rows change over time',
    airflow: 'manages the Airflow scheduler\'s pipelines (DAGs)',
    'kafka-topics': 'creates, lists or describes Kafka topics',
    'kafka-console-producer': 'writes messages to a topic by hand',
    'kafka-console-consumer': 'reads the messages on a topic',
    'kafka-consumer-groups': 'shows how far each consumer group has read (its lag)',
    flink: 'runs and manages Flink streaming jobs',
    mlflow: 'tracks ML experiments, runs and registered models',
    mlx: 'drives the ML platform (train, evaluate, deploy models)',
    datahub: 'manages the data catalog, lineage and governance',
    lake: 'works with files in the data lake',
    claude: 'runs Claude Code, the coding agent, on your request',
    anthropic: 'calls the Claude API (or changes its settings)',
    agent: 'runs the agent on a task',
    mcp: 'inspects or calls an MCP server',
    ionic: 'builds or serves the Ionic mobile app',
    flask: 'runs Flask commands (the app, routes, database)',
    promql: 'asks Prometheus for a metric - the numbers behind every dashboard',
    promtool: 'checks Prometheus rule and config files before they are loaded',
    amtool: 'talks to Alertmanager (alerts, silences, routing)',
    prom: 'controls Prometheus (reload, list rules)',
    sre: 'shows the estate\'s health and moves the scenario clock',
    'sre status': 'prints the golden signals (traffic, errors, latency, saturation) and the outside probe - how users are doing',
    'sre wait': 'lets simulated time pass so rates and alerts reflect the latest state',
    slo: 'defines and reports Service Level Objectives and error budgets',
    oncall: 'shows and acknowledges pages',
    incident: 'runs the incident process (declare, roles, updates, resolve, postmortem)',
    deploy: 'rolls out, analyses, promotes or rolls back a release',
    logcli: 'searches the logs in Loki',
    traces: 'shows request traces, span by span',
    grafana: 'manages Grafana dashboards',
    loadtest: 'sends simulated traffic to see what breaks',
    capacity: 'works out how many instances a load needs',
    scale: 'changes how many instances run',
    chaos: 'runs a controlled failure experiment',
    toil: 'records and reports manual, repetitive work',
    mgr: 'performs a management action in the simulated team',
    snow: 'works with ServiceNow records',
    'manage.py': 'runs a Django management command',
    ops: 'drives the operations tooling for this environment (checks, runbooks, reports)',
    feast: 'manages the feature store (feature definitions and materialisation)',
    evidently: 'computes data and model drift reports',
    contract: 'checks data against its agreed contract (schema and rules)',
    'chef-apply': 'applies a single Chef recipe file to this machine',
    connect: 'manages Kafka Connect connectors (data in and out of Kafka)',
    'schema-registry': 'manages message schemas so producers and consumers agree',
    vllm: 'serves a language model behind an API',
    bicep: 'builds Bicep files into ARM templates for Azure',
    hadoop: 'runs Hadoop jobs and filesystem commands',
    optimum: 'optimises and exports a model for faster inference',
    vnu: 'validates the HTML against the standard',
    redis: 'talks to the Redis server',
    'redis-cli': 'talks to the Redis server (ping answers PONG when it is reachable)',
    mysql: 'runs SQL against MySQL',
    sqlite3: 'opens the SQLite database to run SQL',
    flake8: 'checks the Python code style',
    black: 'formats the Python code',
    mypy: 'checks the Python type hints',
    gcloud: 'works with Google Cloud',
    gsutil: 'manages Google Cloud Storage',
    bq: 'runs BigQuery queries and manages datasets',
};

const SQL: Array<[RegExp, string]> = [
    [/^\s*(?:with\b[\s\S]*?\)\s*)?select\b[\s\S]*\bgroup\s+by\b/i, 'reads rows and summarises them per group (counts, sums, averages)'],
    [/^\s*(?:with\b[\s\S]*?\)\s*)?select\b[\s\S]*\bjoin\b/i, 'reads rows that combine two tables matched on a key'],
    [/^\s*(?:with\b|select\b)/i, 'reads data from the table(s) - it changes nothing, so it is safe to run'],
    [/^\s*insert\b/i, 'adds new rows to the table'],
    [/^\s*update\b/i, 'changes existing rows - the WHERE clause decides which'],
    [/^\s*delete\b/i, 'removes rows - the WHERE clause decides which'],
    [/^\s*merge\b/i, 'inserts new rows and updates or deletes matching ones in one statement (an upsert)'],
    [/^\s*create\s+(?:or\s+replace\s+)?(?:table|.*\btable\b)/i, 'creates a table to hold the result'],
    [/^\s*create\s+(?:or\s+replace\s+)?(?:materialized\s+)?view\b/i, 'creates a view - a saved query others can select from'],
    [/^\s*create\s+(?:unique\s+)?index\b/i, 'creates an index so lookups on that column are fast'],
    [/^\s*create\b/i, 'creates the database object'],
    [/^\s*drop\b/i, 'deletes the object - its data is gone'],
    [/^\s*alter\b/i, 'changes the structure of an existing object'],
    [/^\s*explain\b/i, 'shows how the database will run the query, to find what makes it slow'],
    [/^\s*(?:show|describe|desc)\b/i, 'lists objects or describes their columns'],
    [/^\s*use\b/i, 'switches the database, schema, role or warehouse the next statements use'],
    [/^\s*(?:grant|revoke)\b/i, 'gives or takes away permissions'],
    [/^\s*copy\b/i, 'bulk-loads or unloads data'],
    [/^\s*(?:begin|commit|rollback)\b/i, 'controls the transaction (all of it happens, or none)'],
    [/^\s*(?:pragma|\.tables|\.schema)/i, 'inspects the database structure'],
];

function words(command: string): string[] {
    return command.trim().replace(/^sudo\s+/, '').split(/\s+/);
}

/** Why somebody runs this command, in one sentence. Empty when unknown. */
export function explainCommand(command: string): string {
    const cmd = String(command || '').trim();
    if (!cmd) return '';
    for (const [rx, why] of SQL) if (rx.test(cmd.replace(/^%%sql\s*/, ''))) return cap(withExtras(why, cmd));
    const w = words(cmd);
    let first = (w[0] || '').replace(/^\.\//, '');
    if (first === 'python' || first === 'python3') {
        if (w[1] === 'manage.py' && w[2]) return cap(withExtras('runs Django\'s "' + w[2] + '" command' + (DJANGO[w[2]] ? ': ' + DJANGO[w[2]] : ''), cmd));
        if (w[1] === '-m' && w[2] === 'pytest') first = 'pytest';
    }
    const sub = w[1] && !w[1].startsWith('-') ? `${first} ${w[1]}` : '';
    let why = (sub && COMMANDS[sub]) || COMMANDS[first] || '';
    if (first === 'systemctl' && w[1]) why = SYSTEMCTL[w[1]] || why;
    if (!why && /\.sh$/.test(first)) why = 'runs the script';
    if (!why) return '';
    return cap(withExtras(why, cmd));
}

const SYSTEMCTL: Table = {
    status: 'shows whether the service is running, its PID and its last log lines',
    restart: 'stops and starts the service so it picks up changes (or recovers)',
    start: 'starts the service',
    stop: 'stops the service',
    reload: 'makes the service re-read its configuration without dropping connections',
    enable: 'makes the service start automatically at boot',
    disable: 'stops the service starting at boot',
    'is-active': 'answers active or inactive - a quick health check',
    'daemon-reload': 'makes systemd re-read unit files after you edited one',
    'list-units': 'lists the services systemd knows and their state',
};

const DJANGO: Table = {
    makemigrations: 'writes a migration file describing your model changes',
    migrate: 'applies the migrations, creating or altering the database tables',
    runserver: 'starts the development web server',
    shell: 'opens a Python shell with your project loaded, to try the ORM',
    createsuperuser: 'creates an admin account for the admin site',
    startapp: 'creates a new app folder with its files',
    dbshell: 'opens the database\'s own SQL shell',
    test: 'runs the project\'s tests',
    showmigrations: 'lists migrations and which are applied',
};

function withExtras(why: string, cmd: string): string {
    const bits = [why];
    if (/^sudo\s/.test(cmd)) bits.push('(sudo: needs administrator rights)');
    if (/\s\|\s/.test(cmd)) bits.push('- each | passes the output on to the next command');
    if (/\s>>\s/.test(cmd)) bits.push('- >> appends the output to the file');
    else if (/\s>\s/.test(cmd)) bits.push('- > saves the output to the file');
    return bits.join(' ');
}

function cap(text: string): string {
    return text ? text.charAt(0).toUpperCase() + text.slice(1) + (/[.)]$/.test(text) ? '' : '.') : '';
}

// ---------------------------------------------------------------------------
// Why a graphical tool is opened
// ---------------------------------------------------------------------------

const TOOLS: Array<[RegExp, string]> = [
    [/grafana/i, 'Grafana draws the metrics as dashboards, so trends and spikes are visible at a glance.'],
    [/prometheus|alertmanager/i, 'Prometheus stores the metrics and evaluates alert rules; Alertmanager decides who is notified.'],
    [/pagerduty|incidents? tab|on-call/i, 'The incident tool is where pages are acknowledged and the response is coordinated and recorded.'],
    [/cockpit|fleet/i, 'Cockpit shows each server\'s services, logs, disks and network without typing commands.'],
    [/\bslos?\b/i, 'The SLO page shows how much error budget is left and how fast it is burning.'],
    [/jira/i, 'Jira holds the team\'s work items, so you can see, plan and assign the work.'],
    [/servicenow|\bsnow\b/i, 'ServiceNow is the system of record for incidents, changes and requests.'],
    [/jenkins/i, 'Jenkins shows the pipeline\'s stages, builds and console output.'],
    [/docker (?:desktop|dashboard)/i, 'The Docker dashboard shows containers, images and their logs.'],
    [/kubernetes dashboard|k8s/i, 'The Kubernetes dashboard shows workloads, pods and their events.'],
    [/aws (?:console|management)/i, 'The AWS console shows the resources you created, with their settings.'],
    [/azure portal/i, 'The Azure portal shows the resources you created, with their settings.'],
    [/fabric/i, 'The Fabric portal shows workspaces, lakehouses, notebooks and pipelines.'],
    [/ambari/i, 'Ambari shows the Hadoop cluster\'s services and their health.'],
    [/spark ui/i, 'The Spark UI shows jobs, stages and tasks - where time goes.'],
    [/terraform/i, 'HCP Terraform shows runs, plans and state for each workspace.'],
    [/github desktop/i, 'GitHub Desktop shows changes, commits and branches visually.'],
    [/mlflow/i, 'MLflow shows experiments, runs and registered models.'],
    [/snowsight|snowflake/i, 'Snowsight runs SQL against the warehouse and shows the results.'],
    [/pgadmin/i, 'pgAdmin browses the PostgreSQL database and runs queries.'],
    [/airflow/i, 'The Airflow UI shows DAGs, their runs and each task\'s logs.'],
    [/dbt cloud/i, 'dbt Cloud shows the models, runs and lineage.'],
    [/control center|kafka/i, 'Control Center shows topics, messages and consumer lag.'],
    [/flink/i, 'The Flink dashboard shows running jobs and their throughput.'],
    [/datahub/i, 'DataHub shows datasets, owners and lineage.'],
    [/files? tool|explorer/i, 'The Files tool is where the lab\'s files are created and edited.'],
    [/sql editor|query editor|worksheet/i, 'The query editor runs SQL against the lab\'s database and shows the rows.'],
    [/web playground|preview|browser/i, 'The preview shows the page exactly as a visitor would see it.'],
    [/network simulator|netsim/i, 'The simulator lets you build and test the network topology.'],
];

const GUI_STEP = /^(?:open|go to|in the|choose|select|click|press|switch to|use the)\b/i;

/** Why a GUI step opens a tool - empty for a step that is not about a tool. */
export function explainGuiStep(step: string): string {
    const text = String(step || '');
    if (!GUI_STEP.test(text) || /check my work/i.test(text)) return '';
    for (const [rx, why] of TOOLS) if (rx.test(text)) return why;
    return '';
}

const KNOWN = new Set(Object.keys(COMMANDS).filter(k => !k.includes(' ')));
