/**
 * The Kubernetes Dashboard skin's plain half: which resource kinds exist, how
 * they are named in the Dashboard's navigation and URLs, how a row reads its
 * status, and the exact kubectl lines every action sends.
 *
 * Every command is built here with `cli()` so the Python check
 * (`selfstudyuserlab/_portal_k8s.py`) can mirror the same shapes, and so a
 * component never concatenates a typed value into a command line.
 */
import { cli, pick, rows, type PortalFlagValue } from '@/utils/portalKit';

export type Row = Record<string, any>;

/** One kind of resource as the Dashboard shows it. */
export interface KindDef {
    kind: string;            // API kind, e.g. Deployment
    route: string;           // URL segment, e.g. deployment
    title: string;           // nav / card title, e.g. Deployments
    singular: string;        // kubectl word, e.g. deployment
    namespaced: boolean;
    group: 'workloads' | 'service' | 'config' | 'cluster' | 'crd';
    scalable?: boolean;
    restartable?: boolean;
    triggerable?: boolean;   // a CronJob: "Trigger" runs its job template now
    source?: 'objects' | 'namespaces' | 'nodes' | 'pvs' | 'storageClasses'
        | 'clusterRoles' | 'events' | 'crds';
    readOnly?: boolean;      // nothing in the engine backs a write
}

export const KINDS: KindDef[] = [
    { kind: 'CronJob', route: 'cronjob', title: 'Cron Jobs', singular: 'cronjob', namespaced: true, group: 'workloads', triggerable: true },
    { kind: 'DaemonSet', route: 'daemonset', title: 'Daemon Sets', singular: 'daemonset', namespaced: true, group: 'workloads' },
    { kind: 'Deployment', route: 'deployment', title: 'Deployments', singular: 'deployment', namespaced: true, group: 'workloads', scalable: true, restartable: true },
    { kind: 'Job', route: 'job', title: 'Jobs', singular: 'job', namespaced: true, group: 'workloads' },
    { kind: 'Pod', route: 'pod', title: 'Pods', singular: 'pod', namespaced: true, group: 'workloads' },
    { kind: 'ReplicaSet', route: 'replicaset', title: 'Replica Sets', singular: 'replicaset', namespaced: true, group: 'workloads', scalable: true },
    { kind: 'ReplicationController', route: 'replicationcontroller', title: 'Replication Controllers', singular: 'replicationcontroller', namespaced: true, group: 'workloads', readOnly: true },
    { kind: 'StatefulSet', route: 'statefulset', title: 'Stateful Sets', singular: 'statefulset', namespaced: true, group: 'workloads', scalable: true },
    { kind: 'Ingress', route: 'ingress', title: 'Ingresses', singular: 'ingress', namespaced: true, group: 'service' },
    { kind: 'Service', route: 'service', title: 'Services', singular: 'service', namespaced: true, group: 'service' },
    { kind: 'ConfigMap', route: 'configmap', title: 'Config Maps', singular: 'configmap', namespaced: true, group: 'config' },
    { kind: 'PersistentVolumeClaim', route: 'persistentvolumeclaim', title: 'Persistent Volume Claims', singular: 'persistentvolumeclaim', namespaced: true, group: 'config' },
    { kind: 'Secret', route: 'secret', title: 'Secrets', singular: 'secret', namespaced: true, group: 'config' },
    { kind: 'StorageClass', route: 'storageclass', title: 'Storage Classes', singular: 'storageclass', namespaced: false, group: 'config', source: 'storageClasses', readOnly: true },
    { kind: 'ClusterRole', route: 'clusterrole', title: 'Cluster Roles', singular: 'clusterrole', namespaced: false, group: 'cluster', source: 'clusterRoles', readOnly: true },
    { kind: 'Event', route: 'event', title: 'Events', singular: 'event', namespaced: true, group: 'cluster', source: 'events', readOnly: true },
    { kind: 'Namespace', route: 'namespace', title: 'Namespaces', singular: 'namespace', namespaced: false, group: 'cluster', source: 'namespaces' },
    { kind: 'Node', route: 'node', title: 'Nodes', singular: 'node', namespaced: false, group: 'cluster', source: 'nodes', readOnly: true },
    { kind: 'PersistentVolume', route: 'persistentvolume', title: 'Persistent Volumes', singular: 'persistentvolume', namespaced: false, group: 'cluster', source: 'pvs', readOnly: true },
    { kind: 'CustomResourceDefinition', route: 'customresourcedefinition', title: 'Custom Resource Definitions', singular: 'customresourcedefinition', namespaced: false, group: 'crd', source: 'crds', readOnly: true },
];

export const WORKLOAD_KINDS = KINDS.filter(k => k.group === 'workloads');

export function kindByRoute(route: string): KindDef | undefined {
    return KINDS.find(k => k.route === route);
}

export function kindByKind(kind: string): KindDef | undefined {
    return KINDS.find(k => k.kind === kind);
}

export interface KdSettings { clusterName: string; itemsPerPage: number; labelsLimit: number; defaultNamespace: string }

export interface DialogState { type: string; def: KindDef; row: Row; revision?: number; namespace?: string }

export const ALL_NAMESPACES = '_all';

export const DASHBOARD_HOST = 'https://k8s-dashboard.lab.internal/#';

/** The Dashboard's own URL for a page. */
export function dashboardUrl(path: string, namespace: string, extra = ''): string {
    const ns = namespace === ALL_NAMESPACES ? '_all' : namespace;
    return `${DASHBOARD_HOST}/${path}?namespace=${encodeURIComponent(ns)}${extra}`;
}

// ---------------------------------------------------------------------------
// Reading the view
// ---------------------------------------------------------------------------

export function dash(view: unknown): Row {
    return pick<Row>(view, 'dashboard', {});
}

/** Every row of one kind, filtered to the selected namespace. */
export function listOf(view: unknown, def: KindDef, namespace: string): Row[] {
    const d = dash(view);
    let list: Row[];
    switch (def.source) {
        case 'namespaces': list = rows(d, 'namespaces').map(r => ({ ...r, kind: 'Namespace' })); break;
        case 'nodes': list = rows(d, 'nodes').map(r => ({ ...r, kind: 'Node' })); break;
        case 'pvs': list = rows(d, 'persistentVolumes').map(r => ({ ...r, kind: 'PersistentVolume' })); break;
        case 'storageClasses': list = rows(d, 'storageClasses').map(r => ({ ...r, kind: 'StorageClass' })); break;
        case 'clusterRoles': list = rows(d, 'clusterRoles').map(r => ({ ...r, kind: 'ClusterRole' })); break;
        case 'crds': list = rows(d, 'customResourceDefinitions'); break;
        case 'events': list = rows(d, 'events').slice().reverse().map((e, i) => ({
            ...e, kind: 'Event', name: `${e.object}.${i}`,
            namespace: namespaceOfEvent(view, e),
        })); break;
        default: list = rows(d, 'objects').filter(r => r.kind === def.kind);
    }
    if (def.namespaced && namespace !== ALL_NAMESPACES) {
        list = list.filter(r => (r.namespace || 'default') === namespace);
    }
    return list;
}

function namespaceOfEvent(view: unknown, event: Row): string {
    const [kindWord, name] = String(event.object || '').split('/');
    const match = rows(dash(view), 'objects').find(o =>
        o.name === name && String(o.kind).toLowerCase() === kindWord);
    return match?.namespace || 'default';
}

export function findObject(view: unknown, def: KindDef, namespace: string, name: string): Row | null {
    const list = listOf(view, def, def.namespaced ? namespace : ALL_NAMESPACES);
    return list.find(r => r.name === name && (!def.namespaced || r.namespace === namespace)) || null;
}

export function eventsFor(view: unknown, kind: string, name: string): Row[] {
    const key = `${kind.toLowerCase()}/${name}`;
    return rows(dash(view), 'events').filter(e => e.object === key).slice().reverse();
}

export type Health = 'success' | 'pending' | 'error' | 'none';

/** Which status icon a row gets, by the Dashboard's own rule. */
export function healthOf(row: Row): Health {
    switch (row.kind) {
        case 'Pod':
            if (row.status === 'Running' || row.status === 'Completed' || row.status === 'Succeeded') return 'success';
            if (row.status === 'Pending') return 'pending';
            return 'error';
        case 'Deployment': case 'ReplicaSet': case 'StatefulSet': case 'DaemonSet': {
            if (row.failed > 0) return 'error';
            if (row.pending > 0 || (row.running ?? 0) < (row.desired ?? 0)) return 'pending';
            return 'success';
        }
        case 'Job':
            return row.status === 'Complete' || row.running > 0 ? 'success' : 'pending';
        case 'Node':
            return row.status === 'Ready' ? 'success' : 'error';
        case 'Namespace':
            return row.status === 'Active' ? 'success' : 'pending';
        case 'PersistentVolumeClaim': case 'PersistentVolume':
            return row.status === 'Bound' ? 'success' : 'pending';
        default:
            return 'none';
    }
}

/** Running / Pending / Failed / Succeeded counts for one workload kind. */
export function statusCounts(list: Row[]): { running: number; pending: number; failed: number; succeeded: number } {
    const out = { running: 0, pending: 0, failed: 0, succeeded: 0 };
    for (const row of list) {
        if (row.kind === 'Pod' && (row.status === 'Completed' || row.status === 'Succeeded')) {
            out.succeeded++;
            continue;
        }
        if (row.kind === 'Job' && row.status === 'Complete') {
            out.succeeded++;
            continue;
        }
        const health = healthOf(row);
        if (health === 'error') out.failed++;
        else if (health === 'pending') out.pending++;
        else out.running++;
    }
    return out;
}

export function podsCell(row: Row): string {
    const desired = row.desired ?? row.pods?.length ?? 0;
    return `${row.running ?? 0} / ${desired}`;
}

export function labelPairs(labels: unknown): [string, string][] {
    if (!labels || typeof labels !== 'object') return [];
    return Object.entries(labels as Record<string, unknown>).map(([k, v]) => [k, String(v)]);
}

export function formatDate(iso: unknown): string {
    const date = new Date(String(iso || ''));
    if (Number.isNaN(date.getTime())) return '-';
    return date.toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric',
        hour: 'numeric', minute: '2-digit', second: '2-digit', hour12: true, timeZone: 'UTC' }) + ' UTC';
}

// ---------------------------------------------------------------------------
// Commands - the exact lines the Dashboard's actions are equivalent to
// ---------------------------------------------------------------------------

function nsFlag(def: KindDef, namespace: string): PortalValueList {
    return def.namespaced ? ['-n', namespace] : [];
}
type PortalValueList = string[];

/** `kubectl delete -n default deployment web` - the Dashboard's own wording. */
export function deleteCommand(def: KindDef, namespace: string, name: string): string {
    return cli(['kubectl', 'delete', ...nsFlag(def, namespace), def.singular, name]);
}

export function scaleCommand(def: KindDef, namespace: string, name: string, replicas: number): string {
    return cli(['kubectl', 'scale', '-n', namespace, def.singular, name], { '--replicas': replicas });
}

/**
 * The Dashboard's "Trigger" on a cron job: a one-off Job from its job template,
 * named `<cronjob>-manual-<suffix>` as the real Dashboard names it. kubectl
 * spells it `kubectl create job NAME --from=cronjob/CRONJOB`.
 */
export function triggerJobName(cronJob: string, now: number = Date.now()): string {
    const suffix = Math.floor(now / 1000).toString(36).slice(-5).toLowerCase();
    return `${cronJob}-manual-${suffix}`.slice(0, 63);
}

export function triggerCommand(namespace: string, cronJob: string, jobName: string): string {
    return cli(['kubectl', 'create', 'job', jobName, '-n', namespace], { '--from': `cronjob/${cronJob}` });
}

export function restartCommand(namespace: string, name: string): string {
    return cli(['kubectl', 'rollout', 'restart', '-n', namespace, 'deployment', name]);
}

export function undoCommand(namespace: string, name: string, revision?: number): string {
    return cli(['kubectl', 'rollout', 'undo', '-n', namespace, `deployment/${name}`],
        { '--to-revision': revision ?? null });
}

export function setImageCommand(namespace: string, name: string, container: string, image: string): string {
    return cli(['kubectl', 'set', 'image', '-n', namespace, `deployment/${name}`, `${container}=${image}`]);
}

export function getYamlCommand(def: KindDef, namespace: string, name: string, format: 'yaml' | 'json'): string {
    return cli(['kubectl', 'get', def.singular, name, ...nsFlag(def, namespace)], { '-o': format });
}

/** The kinds the engine can list; the rest are drawn from the view alone. */
const READABLE = new Set(['CronJob', 'DaemonSet', 'Deployment', 'Job', 'Pod', 'ReplicaSet', 'StatefulSet', 'Ingress',
    'Service', 'ConfigMap', 'PersistentVolumeClaim', 'Secret', 'Event', 'Namespace', 'Node', 'PersistentVolume']);

/** What the Dashboard GETs when a list opens, as kubectl spells it. */
export function listReadCommand(def: KindDef, namespace: string): string | null {
    if (!READABLE.has(def.kind)) return null;
    const plural = def.title.toLowerCase().replace(/\s+/g, '');
    const scope = !def.namespaced ? [] : namespace === ALL_NAMESPACES ? ['-A'] : ['-n', namespace];
    return cli(['kubectl', 'get', plural, ...scope], { '-o': def.kind === 'Pod' ? 'wide' : null });
}

/** What a detail page reads: `kubectl describe`. */
export function describeCommand(def: KindDef, namespace: string, name: string): string | null {
    if (!READABLE.has(def.kind) || def.kind === 'Event' || def.kind === 'PersistentVolume') return null;
    return cli(['kubectl', 'describe', def.singular, name, ...(def.namespaced ? ['-n', namespace] : [])]);
}

export function historyCommand(namespace: string, name: string): string {
    return cli(['kubectl', 'rollout', 'history', `deployment/${name}`, '-n', namespace]);
}

export function logsCommand(namespace: string, pod: string, container?: string): string {
    return cli(['kubectl', 'logs', '-n', namespace, pod], { '-c': container || null });
}

export function execCommand(namespace: string, pod: string, container: string, words: string[]): string {
    return cli(['kubectl', 'exec', '-n', namespace, pod, '-c', container, '--', ...words]);
}

/**
 * A command that reads a manifest from STDIN, written as the heredoc every
 * tutorial pastes. The delimiter is quoted, so nothing in the body is expanded
 * by a shell, and it is chosen so that no line of the body can end it early.
 */
export function heredoc(command: string, body: string): string {
    const lines = String(body).replace(/\r\n?/g, '\n').replace(/\n+$/, '').split('\n');
    let marker = 'EOF';
    let n = 0;
    while (lines.some(line => line.trim() === marker)) marker = `EOF_${++n}`;
    return `${command} <<'${marker}'\n${lines.join('\n')}\n${marker}`;
}

export function createFromInputCommand(namespace: string, body: string): string {
    return heredoc(cli(['kubectl', 'create', '-n', namespace, '-f', '-']), body);
}

export function replaceCommand(def: KindDef, namespace: string, body: string): string {
    return heredoc(cli(['kubectl', 'replace', ...nsFlag(def, namespace), '-f', '-']), body);
}

export function createFromFileCommand(namespace: string, path: string): string {
    return cli(['kubectl', 'create', '-n', namespace, '-f', path]);
}

export interface FormSpec {
    name: string;
    image: string;
    replicas: number;
    service: 'none' | 'internal' | 'external';
    ports: { port: string; targetPort: string; protocol: string }[];
    description: string;
    labels: { key: string; value: string }[];
    namespace: string;
    cpu: string;
    memory: string;
    env: { name: string; value: string }[];
}

/** The commands "Deploy" in Create from form runs, in order. */
export function formCommands(spec: FormSpec): string[] {
    const ns = spec.namespace;
    const out: string[] = [
        cli(['kubectl', 'create', 'deployment', spec.name], {
            '--image': spec.image, '--replicas': spec.replicas, '-n': ns,
        }),
    ];
    const extra = spec.labels.filter(l => l.key.trim() && l.key.trim() !== 'app');
    if (extra.length) {
        out.push(cli(['kubectl', 'label', 'deployment', spec.name,
            ...extra.map(l => `${l.key.trim()}=${l.value.trim()}`)], { '-n': ns }));
    }
    if (spec.description.trim()) {
        out.push(cli(['kubectl', 'annotate', 'deployment', spec.name,
            `description=${spec.description.trim()}`], { '-n': ns }));
    }
    const env = spec.env.filter(e => e.name.trim());
    if (env.length) {
        out.push(cli(['kubectl', 'set', 'env', `deployment/${spec.name}`,
            ...env.map(e => `${e.name.trim()}=${e.value}`)], { '-n': ns }));
    }
    const requests: string[] = [];
    if (spec.cpu.trim()) requests.push(`cpu=${spec.cpu.trim()}`);
    if (spec.memory.trim()) requests.push(`memory=${spec.memory.trim()}Mi`);
    if (requests.length) {
        out.push(cli(['kubectl', 'set', 'resources', `deployment/${spec.name}`],
            { '--requests': requests.join(','), '-n': ns }));
    }
    if (spec.service !== 'none') {
        const port = spec.ports.find(p => p.port.trim());
        if (port) {
            out.push(cli(['kubectl', 'expose', 'deployment', spec.name], {
                '--port': port.port.trim(),
                '--target-port': (port.targetPort || port.port).trim(),
                '--protocol': port.protocol || 'TCP',
                '--type': spec.service === 'external' ? 'LoadBalancer' : 'ClusterIP',
                '-n': ns,
            }));
        }
    }
    return out;
}

/** A preview manifest for Create from form's "Preview" button. */
export function formManifest(spec: FormSpec): string {
    const labels = [['app', spec.name], ...spec.labels
        .filter(l => l.key.trim() && l.key.trim() !== 'app').map(l => [l.key.trim(), l.value.trim()])];
    const lines = [
        'apiVersion: apps/v1', 'kind: Deployment', 'metadata:', `  name: ${spec.name}`,
        `  namespace: ${spec.namespace}`, '  labels:',
        ...labels.map(([k, v]) => `    ${k}: ${v}`),
    ];
    if (spec.description.trim()) lines.push('  annotations:', `    description: ${JSON.stringify(spec.description.trim())}`);
    lines.push('spec:', `  replicas: ${spec.replicas}`, '  selector:', '    matchLabels:', `      app: ${spec.name}`,
        '  template:', '    metadata:', '      labels:', `        app: ${spec.name}`, '    spec:', '      containers:',
        `        - name: ${spec.name}`, `          image: ${spec.image}`);
    const env = spec.env.filter(e => e.name.trim());
    if (env.length) {
        lines.push('          env:');
        for (const e of env) lines.push(`            - name: ${e.name.trim()}`, `              value: ${JSON.stringify(e.value)}`);
    }
    if (spec.cpu.trim() || spec.memory.trim()) {
        lines.push('          resources:', '            requests:');
        if (spec.cpu.trim()) lines.push(`              cpu: ${spec.cpu.trim()}`);
        if (spec.memory.trim()) lines.push(`              memory: ${spec.memory.trim()}Mi`);
    }
    if (spec.service !== 'none') {
        const port = spec.ports.find(p => p.port.trim());
        if (port) {
            lines.push('---', 'apiVersion: v1', 'kind: Service', 'metadata:', `  name: ${spec.name}`,
                `  namespace: ${spec.namespace}`, 'spec:',
                `  type: ${spec.service === 'external' ? 'LoadBalancer' : 'ClusterIP'}`, '  selector:',
                `    app: ${spec.name}`, '  ports:', `    - port: ${port.port.trim()}`,
                `      targetPort: ${(port.targetPort || port.port).trim()}`, `      protocol: ${port.protocol || 'TCP'}`);
        }
    }
    return lines.join('\n');
}

export function createNamespaceCommand(name: string): string {
    return cli(['kubectl', 'create', 'namespace', name]);
}

/**
 * `--from-literal K=V --from-literal K2=V2`: kubectl wants the flag REPEATED,
 * so these go in as positional words (each still quoted by `cli`), not as
 * portalKit's one-flag-many-values list form, which would leave every value
 * after the first as a stray argument.
 */
function literals(data: { key: string; value: string }[]): string[] {
    return data.filter(d => d.key.trim()).flatMap(d => ['--from-literal', `${d.key.trim()}=${d.value}`]);
}

export function createConfigMapCommand(namespace: string, name: string, data: { key: string; value: string }[]): string {
    return cli(['kubectl', 'create', 'configmap', name, ...literals(data)], { '-n': namespace });
}

export function createSecretCommand(namespace: string, name: string, data: { key: string; value: string }[]): string {
    return cli(['kubectl', 'create', 'secret', 'generic', name, ...literals(data)], { '-n': namespace });
}

export function createServiceCommand(namespace: string, type: string, name: string,
                                     port: string, target: string): string {
    return cli(['kubectl', 'create', 'service', type, name],
        { '--tcp': `${port}:${target || port}`, '-n': namespace });
}

export function createCronJobCommand(namespace: string, name: string, image: string, schedule: string): string {
    return cli(['kubectl', 'create', 'cronjob', name], { '--image': image, '--schedule': schedule, '-n': namespace });
}

export function helmRepoAddCommand(name: string, url: string): string {
    return cli(['helm', 'repo', 'add', name, url]);
}

export function helmInstallCommand(release: string, chart: string, namespace: string, createNs: boolean): string {
    return cli(['helm', 'install', release, chart], { '-n': namespace, '--create-namespace': createNs });
}

export function helmUninstallCommand(release: string, namespace: string): string {
    return cli(['helm', 'uninstall', release], { '-n': namespace });
}

export const HELM_REPOS: Record<string, string> = {
    bitnami: 'https://charts.bitnami.com/bitnami',
    'ingress-nginx': 'https://kubernetes.github.io/ingress-nginx',
    'prometheus-community': 'https://prometheus-community.github.io/helm-charts',
    grafana: 'https://grafana.github.io/helm-charts',
    jetstack: 'https://charts.jetstack.io',
};

/** Split what somebody typed in the exec terminal into argv, POSIX-quote aware. */
export function splitWords(line: string): string[] {
    const out: string[] = [];
    let current = '';
    let quote: string | null = null;
    let has = false;
    for (const ch of line) {
        if (quote) {
            if (ch === quote) quote = null;
            else current += ch;
        } else if (ch === '"' || ch === "'") {
            quote = ch; has = true;
        } else if (/\s/.test(ch)) {
            if (current || has) { out.push(current); current = ''; has = false; }
        } else {
            current += ch;
        }
    }
    if (current || has) out.push(current);
    return out;
}

export const NAME_RULE = /^[a-z0-9]([-a-z0-9]*[a-z0-9])?$/;

export function validateName(value: string, label: string, max = 63): string {
    const text = value.trim();
    if (!text) return `${label} is required`;
    if (text.length > max) return `${label} must be up to ${max} characters long`;
    if (!NAME_RULE.test(text)) return `${label} must be alphanumeric and may contain dashes`;
    return '';
}
