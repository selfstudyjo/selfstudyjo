/**
 * Confluent Control Center (7.x) over the lab's data-platform engine: the view
 * shapes the skin reads, its routes and their URLs, and the command builders.
 *
 * Every write the portal makes is a Kafka CLI line a student could type into the
 * Kafka CLI console beside it (`kafka-topics`, `kafka-configs`,
 * `kafka-console-producer`, `kafka-consumer-groups`, `schema-registry`,
 * `connect`, and `curl` against the Connect REST API). Everything here is plain:
 * no Vue, no DOM.
 */
import { cli, type PortalFlagValue, type PortalValue } from '@/utils/portalKit';

export const BOOTSTRAP = 'kafka-1.shopflow.internal:9092';
export const CONNECT_URL = 'http://connect.shopflow.internal:8083';
export const REGISTRY_URL = 'http://schema-registry.shopflow.internal:8081';
export const CLUSTER_NAME = 'controlcenter.cluster';
export const CONNECT_CLUSTER = 'connect-default';

export interface CcBroker { id: number; host: string; port?: number; status: string; controller: boolean }
export interface CcPartition { partition: number; leader: number; replicas: number[]; isr: number[]; end_offset: number; start_offset?: number }
export interface CcTopic {
    name: string; partitions: number; replication_factor: number; configs: Record<string, string>;
    messages: number; size_bytes: number; end_offsets?: number; under_replicated: number;
    offline_partitions: number; partitions_detail: CcPartition[]; compacted?: number; dlq?: boolean;
}
export interface CcLag { topic: string; partition: number; committed: number | null; end: number; lag: number | null }
export interface CcGroup { group: string; state: string; members: number; kind?: string; topics: string[]; lag: number; lag_detail: CcLag[] }
export interface CcSubject {
    subject: string; versions: number[]; latest_version: number; latest_id?: number;
    compatibility: string; schema_type: string; latest_schema: string;
}
export interface CcTask { id: number; state: string; trace: string | null }
export interface CcConnector {
    name: string; type: string; class: string; state: string; tasks: CcTask[]; healthy?: boolean;
    topics: string[]; config: Record<string, string>; records?: number; errors?: number; dlq_records?: number;
}

export type CcRoute =
    | { page: 'home' }
    | { page: 'overview' }
    | { page: 'brokers' }
    | { page: 'topics' }
    | { page: 'new-topic' }
    | { page: 'topic'; name: string; tab: 'overview' | 'messages' | 'schema' | 'configuration' }
    | { page: 'consumers' }
    | { page: 'group'; group: string }
    | { page: 'connect' }
    | { page: 'add-connector' }
    | { page: 'connector'; name: string; tab: 'overview' | 'settings' }
    | { page: 'registry' }
    | { page: 'subject'; subject: string };

const BASE = 'http://control-center.shopflow.internal:9021';
const CLUSTER_ID = 'Kx3pQ7y2TOm4bWv0sYw1Ag';

export function routeUrl(route: CcRoute, clusterId = CLUSTER_ID): string {
    const c = `${BASE}/clusters/${clusterId}`;
    const e = encodeURIComponent;
    switch (route.page) {
        case 'home': return `${BASE}/clusters`;
        case 'overview': return `${c}/overview`;
        case 'brokers': return `${c}/brokers`;
        case 'topics': return `${c}/management/topics`;
        case 'new-topic': return `${c}/management/topics/new`;
        case 'topic': {
            const tab = route.tab === 'configuration' ? 'configuration' : route.tab === 'overview' ? 'overview' : route.tab;
            return `${c}/management/topics/${e(route.name)}/${tab}`;
        }
        case 'consumers': return `${c}/clients/consumers`;
        case 'group': return `${c}/clients/consumers/${e(route.group)}`;
        case 'connect': return `${c}/connect/${CONNECT_CLUSTER}/connectors`;
        case 'add-connector': return `${c}/connect/${CONNECT_CLUSTER}/connectors/browse`;
        case 'connector': return `${c}/connect/${CONNECT_CLUSTER}/connectors/${e(route.name)}${route.tab === 'settings' ? '/settings' : ''}`;
        case 'registry': return `${c}/schema-registry/subjects`;
        case 'subject': return `${c}/schema-registry/subjects/${e(route.subject)}`;
    }
    return c;
}

/* ---------------------------------------------------------------- commands */

/** `kafka-topics --bootstrap-server ... <words>` with the flags after. */
export function kafkaTopics(words: PortalValue[], flags: Record<string, PortalFlagValue> = {}): string {
    return cli(['kafka-topics', '--bootstrap-server', BOOTSTRAP, ...words], flags);
}

export function kafkaConfigs(words: PortalValue[], flags: Record<string, PortalFlagValue> = {}): string {
    return cli(['kafka-configs', '--bootstrap-server', BOOTSTRAP, ...words], flags);
}

export function kafkaGroups(words: PortalValue[], flags: Record<string, PortalFlagValue> = {}): string {
    return cli(['kafka-consumer-groups', '--bootstrap-server', BOOTSTRAP, ...words], flags);
}

/** One `--config k=v` pair per setting, as the CLI expects them repeated. */
export function repeated(flag: string, pairs: Record<string, string>): string[] {
    const out: string[] = [];
    for (const [key, value] of Object.entries(pairs)) {
        if (String(value).trim() === '') continue;
        out.push(flag, `${key}=${value}`);
    }
    return out;
}

/** A heredoc delimiter none of the lines can close early. */
function delimiter(lines: string[]): string {
    let candidate = 'EOF';
    let n = 0;
    while (lines.some(line => line.trim() === candidate)) candidate = `EOF_${++n}`;
    return candidate;
}

/**
 * A producer line with its records on standard input, the way the console
 * producer is used: `kafka-console-producer ... <<'EOF'` then one record a line.
 * The command half is built with cli(); the body is literal (a quoted heredoc
 * expands nothing), and the delimiter is chosen so no record can end it.
 */
export function withStdin(command: string, lines: string[]): string {
    const end = delimiter(lines);
    return command + " <<'" + end + "'\n" + lines.join('\n') + '\n' + end;
}

/** A key separator that does not occur in the key. */
export function keySeparator(key: string): string {
    for (const sep of [':', '|', '#', '~', '^']) if (!key.includes(sep)) return sep;
    return '\u001f';
}

export function produceCommand(topic: string, key: string, value: string): string {
    if (key === '') {
        return withStdin(cli(['kafka-console-producer', '--bootstrap-server', BOOTSTRAP, '--topic', topic]), [value]);
    }
    const sep = keySeparator(key);
    return withStdin(cli(['kafka-console-producer', '--bootstrap-server', BOOTSTRAP, '--topic', topic,
        '--property', 'parse.key=true', '--property', `key.separator=${sep}`]), [key + sep + value]);
}

/** A value as one line: JSON is compacted, anything else must already be one line. */
export function oneLine(value: string): { text: string; error: string } {
    const trimmed = value.trim();
    if (!trimmed) return { text: '', error: 'Value is required.' };
    if (/^[[{]/.test(trimmed)) {
        try {
            return { text: JSON.stringify(JSON.parse(trimmed)), error: '' };
        } catch (problem: any) {
            return { text: '', error: 'Value is not valid JSON: ' + String(problem?.message || problem) };
        }
    }
    if (/[\r\n]/.test(trimmed)) return { text: '', error: 'A plain-text value must be on a single line.' };
    return { text: trimmed, error: '' };
}

export interface BrowseOptions { partition: number | null; offset: string; limit: number }

export function consumeCommand(topic: string, options: BrowseOptions): string {
    const words: PortalValue[] = ['kafka-console-consumer', '--bootstrap-server', BOOTSTRAP, '--topic', topic];
    if (options.partition !== null) {
        words.push('--partition', options.partition, '--offset', options.offset || 'earliest');
    } else {
        words.push('--from-beginning');
    }
    words.push('--max-messages', options.limit,
        '--property', 'print.timestamp=true', '--property', 'print.partition=true',
        '--property', 'print.offset=true', '--property', 'print.headers=true',
        '--property', 'print.key=true');
    return cli(words);
}

export interface CcMessage { timestamp: number; partition: number; offset: number; headers: Record<string, string>; key: string | null; value: string }

/** The console consumer's print.* output back into records. */
export function parseConsumed(output: string): CcMessage[] {
    const out: CcMessage[] = [];
    for (const line of String(output || '').split('\n')) {
        if (!line.startsWith('CreateTime:')) continue;
        const parts: string[] = [];
        let rest = line;
        for (let i = 0; i < 5; i++) {
            const at = rest.indexOf('\t');
            if (at < 0) break;
            parts.push(rest.slice(0, at));
            rest = rest.slice(at + 1);
        }
        parts.push(rest);
        if (parts.length < 6) continue;
        const [ts = '', part = '', off = '', head = '', key = '', value = ''] = parts;
        const headers: Record<string, string> = {};
        if (head !== 'NO_HEADERS') {
            for (const pair of head.split(',')) {
                const at = pair.indexOf(':');
                if (at > 0) headers[pair.slice(0, at)] = pair.slice(at + 1);
            }
        }
        out.push({
            timestamp: Number(ts.slice('CreateTime:'.length)) || 0,
            partition: Number(part.slice('Partition:'.length)) || 0,
            offset: Number(off.slice('Offset:'.length)) || 0,
            headers,
            key: key === 'null' ? null : key,
            value,
        });
    }
    return out;
}

export interface CcResetRow { group: string; topic: string; partition: number; offset: number }

export function parseResetTable(output: string): CcResetRow[] {
    const rows: CcResetRow[] = [];
    let seenHeader = false;
    for (const line of String(output || '').split('\n')) {
        const cells = line.trim().split(/\s+/);
        const [group = '', topic = '', part = '', off = ''] = cells;
        if (group === 'GROUP' && topic === 'TOPIC') { seenHeader = true; continue; }
        if (!seenHeader || cells.length < 4) continue;
        if (!/^\d+$/.test(part) || !/^-?\d+$/.test(off)) continue;
        rows.push({ group, topic, partition: Number(part), offset: Number(off) });
    }
    return rows;
}

/** A curl to the Connect REST API, as the Confluent docs write it. */
export function connectCurl(method: 'POST' | 'PUT', path: string, body: unknown): string {
    return cli(['curl', '-s', '-X', method, '-H', 'Content-Type: application/json',
        '--data', JSON.stringify(body), CONNECT_URL + path]);
}

/** A curl to the Schema Registry REST API (what Control Center calls). */
export function registryCurl(method: 'GET' | 'DELETE', path: string): string {
    return cli(['curl', '-s', ...(method === 'GET' ? [] : ['-X', method]), REGISTRY_URL + path]);
}

/** Connect's REST answer: an `error_code` body is a failure even at exit 0. */
export function restError(output: string | undefined): string {
    const text = String(output || '').trim();
    if (!text.startsWith('{')) return '';
    try {
        const body = JSON.parse(text);
        if (body && typeof body === 'object' && 'error_code' in body) return String(body.message || 'Request failed');
    } catch { /* not JSON */ }
    return '';
}

/* ---------------------------------------------------------------- catalogue */

export const TOPIC_DEFAULTS: Record<string, string> = {
    'cleanup.policy': 'delete', 'retention.ms': '604800000', 'retention.bytes': '-1',
    'min.insync.replicas': '1', 'segment.ms': '604800000', 'segment.bytes': '1073741824',
    'max.message.bytes': '1048588', 'compression.type': 'producer', 'min.compaction.lag.ms': '0',
    'delete.retention.ms': '86400000', 'message.timestamp.type': 'CreateTime',
    'unclean.leader.election.enable': 'false', 'min.cleanable.dirty.ratio': '0.5',
    'confluent.value.schema.validation': 'false',
};

export const COMPAT_LEVELS = [
    ['BACKWARD', 'Consumers using the new schema can read data produced with the last schema.'],
    ['BACKWARD_TRANSITIVE', 'Consumers using the new schema can read data produced with all previously registered schemas.'],
    ['FORWARD', 'Consumers using the last schema can read data produced with the new schema.'],
    ['FORWARD_TRANSITIVE', 'Consumers using any previously registered schema can read data produced with the new schema.'],
    ['FULL', 'The new schema is backward and forward compatible with the last schema.'],
    ['FULL_TRANSITIVE', 'The new schema is backward and forward compatible with all previously registered schemas.'],
    ['NONE', 'Schema compatibility checks are disabled.'],
] as const;

export interface PluginField { key: string; label: string; required?: boolean; value: string; help?: string; secret?: boolean; options?: string[] }
export interface PluginSpec { cls: string; name: string; type: 'source' | 'sink'; version: string; vendor: string; fields: PluginField[] }

export const PLUGINS: PluginSpec[] = [
    {
        cls: 'io.debezium.connector.postgresql.PostgresConnector', name: 'PostgresConnector', type: 'source',
        version: '2.6.1.Final', vendor: 'Debezium Community', fields: [
            { key: 'database.hostname', label: 'Hostname', required: true, value: 'shop-db.shopflow.internal' },
            { key: 'database.port', label: 'Port', required: true, value: '5432' },
            { key: 'database.user', label: 'User', required: true, value: 'debezium' },
            { key: 'database.password', label: 'Password', required: true, value: '', secret: true },
            { key: 'database.dbname', label: 'Database', required: true, value: 'shop' },
            { key: 'topic.prefix', label: 'Topic prefix', required: true, value: 'shop' },
            { key: 'plugin.name', label: 'Plugin name', value: 'pgoutput', options: ['pgoutput', 'decoderbufs'] },
            { key: 'slot.name', label: 'Replication slot name', value: '' },
            { key: 'table.include.list', label: 'Table include list', value: '', help: 'e.g. public.orders,public.customers' },
            { key: 'snapshot.mode', label: 'Snapshot mode', value: 'initial', options: ['initial', 'never', 'initial_only', 'no_data', 'always', 'when_needed'] },
            { key: 'transforms', label: 'Transforms', value: '', help: 'e.g. unwrap' },
            { key: 'transforms.unwrap.type', label: 'Transforms: unwrap type', value: '', help: 'io.debezium.transforms.ExtractNewRecordState' },
        ],
    },
    {
        cls: 'io.confluent.connect.s3.S3SinkConnector', name: 'S3SinkConnector', type: 'sink',
        version: '10.5.13', vendor: 'Confluent, Inc.', fields: [
            { key: 'topics', label: 'Topics', required: true, value: '' },
            { key: 's3.bucket.name', label: 'S3 bucket name', required: true, value: 'shopflow-lake' },
            { key: 's3.region', label: 'S3 region', value: 'eu-west-1' },
            { key: 'flush.size', label: 'Flush size', required: true, value: '1000' },
            { key: 'format.class', label: 'Format class', required: true, value: 'io.confluent.connect.s3.format.json.JsonFormat',
              options: ['io.confluent.connect.s3.format.json.JsonFormat', 'io.confluent.connect.s3.format.parquet.ParquetFormat', 'io.confluent.connect.s3.format.avro.AvroFormat'] },
            { key: 'storage.class', label: 'Storage class', value: 'io.confluent.connect.s3.storage.S3Storage' },
            { key: 'topics.dir', label: 'Topics directory', value: 'topics' },
            { key: 'errors.tolerance', label: 'Error tolerance', value: 'none', options: ['none', 'all'] },
            { key: 'errors.deadletterqueue.topic.name', label: 'Dead letter queue topic name', value: '' },
        ],
    },
    {
        cls: 'com.snowflake.kafka.connector.SnowflakeSinkConnector', name: 'SnowflakeSinkConnector', type: 'sink',
        version: '2.2.2', vendor: 'Snowflake, Inc.', fields: [
            { key: 'topics', label: 'Topics', required: true, value: '' },
            { key: 'snowflake.url.name', label: 'Snowflake URL', required: true, value: 'shopflow.snowflakecomputing.com:443' },
            { key: 'snowflake.user.name', label: 'User name', required: true, value: 'KAFKA_CONNECTOR' },
            { key: 'snowflake.private.key', label: 'Private key', required: true, value: '', secret: true },
            { key: 'snowflake.database.name', label: 'Database', required: true, value: 'RAW' },
            { key: 'snowflake.schema.name', label: 'Schema', required: true, value: 'KAFKA' },
            { key: 'snowflake.topic2table.map', label: 'Topic to table map', value: '' },
            { key: 'buffer.count.records', label: 'Buffer count records', value: '10000' },
            { key: 'errors.tolerance', label: 'Error tolerance', value: 'none', options: ['none', 'all'] },
            { key: 'errors.deadletterqueue.topic.name', label: 'Dead letter queue topic name', value: '' },
        ],
    },
    {
        cls: 'io.confluent.connect.jdbc.JdbcSinkConnector', name: 'JdbcSinkConnector', type: 'sink',
        version: '10.7.6', vendor: 'Confluent, Inc.', fields: [
            { key: 'topics', label: 'Topics', required: true, value: '' },
            { key: 'connection.url', label: 'JDBC URL', required: true, value: '' },
            { key: 'connection.user', label: 'JDBC User', value: '' },
            { key: 'connection.password', label: 'JDBC Password', value: '', secret: true },
            { key: 'insert.mode', label: 'Insert mode', value: 'insert', options: ['insert', 'upsert', 'update'] },
            { key: 'auto.create', label: 'Auto create', value: 'true', options: ['true', 'false'] },
            { key: 'table.name.format', label: 'Table name format', value: '${topic}' },
            { key: 'errors.tolerance', label: 'Error tolerance', value: 'none', options: ['none', 'all'] },
            { key: 'errors.deadletterqueue.topic.name', label: 'Dead letter queue topic name', value: '' },
        ],
    },
    {
        cls: 'org.apache.kafka.connect.mirror.MirrorSourceConnector', name: 'MirrorSourceConnector', type: 'source',
        version: '3.7.0', vendor: 'Apache Kafka', fields: [
            { key: 'source.cluster.alias', label: 'Source cluster alias', value: 'source' },
            { key: 'source.cluster.bootstrap.servers', label: 'Source bootstrap servers', value: '' },
            { key: 'topics', label: 'Topics', value: '' },
        ],
    },
];

export function pluginFor(cls: string): PluginSpec | undefined {
    return PLUGINS.find(p => p.cls === cls || p.name === cls || cls.endsWith('.' + p.name));
}

/* ---------------------------------------------------------------- formatting */

export function bytes(n: number | undefined | null): string {
    const v = Number(n || 0);
    if (v < 1024) return `${v} B`;
    const units = ['KB', 'MB', 'GB', 'TB'];
    let x = v;
    let i = -1;
    while (x >= 1024 && i < units.length - 1) { x /= 1024; i++; }
    return `${x.toFixed(x < 10 ? 2 : 1)} ${units[i]}`;
}

export function num(n: number | undefined | null): string {
    return Number(n || 0).toLocaleString('en-US');
}

export function msLabel(ms: string | undefined): string {
    const v = Number(ms);
    if (!Number.isFinite(v)) return String(ms ?? '');
    if (v < 0) return 'Infinite';
    const units: [number, string][] = [[604800000, 'week'], [86400000, 'day'], [3600000, 'hour'], [60000, 'minute'], [1000, 'second']];
    for (const [size, name] of units) {
        if (v >= size && v % size === 0) {
            const k = v / size;
            return `${k} ${name}${k === 1 ? '' : 's'}`;
        }
    }
    return `${v} ms`;
}

export function timeLabel(ms: number): string {
    if (!ms) return '';
    const d = new Date(ms);
    const p = (x: number) => String(x).padStart(2, '0');
    return `${d.getUTCFullYear()}-${p(d.getUTCMonth() + 1)}-${p(d.getUTCDate())} ${p(d.getUTCHours())}:${p(d.getUTCMinutes())}:${p(d.getUTCSeconds())} UTC`;
}

export function pretty(text: string): string {
    try {
        return JSON.stringify(JSON.parse(text), null, 2);
    } catch {
        return text;
    }
}

export type JsonTokenKind = 'key' | 'string' | 'number' | 'bool' | 'null' | 'punct' | 'text';
export interface JsonToken { kind: JsonTokenKind; text: string }

/** Tokens for the JSON viewer (rendered as text spans, never as markup). */
export function jsonTokens(text: string): JsonToken[] {
    const source = pretty(text);
    const out: JsonToken[] = [];
    const re = /("(?:\\.|[^"\\])*")(\s*:)?|(-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?)|\b(true|false)\b|\b(null)\b|([{}[\],:])|(\s+)|(.)/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(source))) {
        if (m[1] !== undefined) {
            out.push({ kind: m[2] ? 'key' : 'string', text: m[1] });
            if (m[2]) out.push({ kind: 'punct', text: m[2] });
        } else if (m[3] !== undefined) out.push({ kind: 'number', text: m[3] });
        else if (m[4] !== undefined) out.push({ kind: 'bool', text: m[4] });
        else if (m[5] !== undefined) out.push({ kind: 'null', text: m[5] });
        else if (m[6] !== undefined) out.push({ kind: 'punct', text: m[6] });
        else out.push({ kind: 'text', text: m[0] });
    }
    return out;
}

/** Fields of an Avro record schema, for the schema table. */
export function schemaFields(text: string): { name: string; type: string; def: string; doc: string }[] {
    try {
        const schema = JSON.parse(text);
        const fields = Array.isArray(schema?.fields) ? schema.fields : [];
        return fields.map((f: any) => ({
            name: String(f?.name ?? ''),
            type: typeLabel(f?.type),
            def: 'default' in (f || {}) ? JSON.stringify(f.default) : '',
            doc: String(f?.doc ?? ''),
        }));
    } catch {
        return [];
    }
}

function typeLabel(type: any): string {
    if (typeof type === 'string') return type;
    if (Array.isArray(type)) return type.map(typeLabel).join(' | ');
    if (type && typeof type === 'object') {
        if (type.type === 'enum') return `enum ${type.name || ''}`.trim();
        if (type.type === 'array') return `array<${typeLabel(type.items)}>`;
        if (type.type === 'map') return `map<${typeLabel(type.values)}>`;
        if (type.type === 'record') return `record ${type.name || ''}`.trim();
        if (type.logicalType) return `${type.type} (${type.logicalType})`;
        return String(type.type || 'object');
    }
    return String(type);
}
