/**
 * pgAdmin 4's model of the ShopFlow PostgreSQL source, as plain functions.
 *
 * No Vue and no DOM: the view payload (`view.source`, SPEC section 2) goes in,
 * and out come the things pgAdmin draws - the object tree, the reconstructed
 * DDL of the SQL tab, the statistics of the Statistics tab, the statement each
 * dialog generates, and the plan tree of the graphical EXPLAIN.
 *
 * Every WRITE in this portal is a PostgreSQL statement run on the `pg_sql`
 * surface (the same one the Query Tool tool uses), so the SQL generated here is
 * the SQL a student would type - which is why the dialogs show it in their SQL
 * tab before it is run, exactly as pgAdmin does.
 *
 * Everything reads the view defensively: the lab service deploys separately, so
 * a field a replica does not send yet renders as empty, never throws.
 */
import { pick, rows } from '../../../../utils/portalKit';

/* ─────────────────────────── the view, typed ─────────────────────────── */

export interface PgColumn { name: string; type: string; nullable: boolean; pk: boolean; default?: string | null }
export interface PgIndex {
  schema: string; table: string; name: string; columns: string[]; unique: boolean;
  method: string; partial: string; include: string[]; primary: boolean; scans: number | null; definition: string;
}
export interface PgForeignKey { name: string; table: string; columns: string[]; refTable: string; refColumns: string[] }
export interface PgTable {
  schema: string; name: string; rows: number; columns: PgColumn[]; sizeKb: number;
  comment: string; owner: string; raw: Record<string, any>;
  uniques: { name: string; columns: string[] }[]; checks: { name: string; expr: string }[]; analyzed: boolean;
}
export interface PgView { schema: string; name: string; definition: string; owner: string; materialized: boolean; columns: string[] }
export interface PgSequence { schema: string; name: string; table: string; column: string; last: number | null }
export interface PgRole { name: string; login: boolean; superuser: boolean; replication: boolean; builtin: boolean }
export interface PgQuery { id: string; sql: string; ms: number | null; rows: number | null; planKind: string; at: string }
export interface Grid { columns: string[]; rows: unknown[][]; total: number; title?: string }

export interface PgModel {
  server: string; database: string; version: string;
  tables: PgTable[]; indexes: PgIndex[]; views: PgView[]; sequences: PgSequence[];
  roles: PgRole[]; queries: PgQuery[]; analyzed: string[]; foreignKeys: PgForeignKey[];
  cdc: { lsn: number; walLevel: string; slots: Record<string, any>[] };
  stats: Record<string, any>;
}

function str(value: unknown, fallback = ''): string {
  return value === null || value === undefined ? fallback : String(value);
}
function num(value: unknown): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}
function list(value: unknown): string[] {
  if (Array.isArray(value)) return value.map(v => String(v)).filter(Boolean);
  if (typeof value === 'string' && value.trim()) return value.split(',').map(v => v.trim()).filter(Boolean);
  return [];
}

/** PostgreSQL's own spelling of the engine's column types. */
export function pgTypeName(type: unknown): string {
  const t = str(type).trim();
  if (!t) return 'text';
  const lower = t.toLowerCase();
  if (lower === 'int' || lower === 'int4') return 'integer';
  if (lower === 'int8') return 'bigint';
  if (lower === 'float8' || lower === 'double') return 'double precision';
  if (lower === 'varchar') return 'character varying';
  if (lower === 'bool') return 'boolean';
  if (lower === 'timestamptz') return 'timestamp with time zone';
  if (lower === 'timestamp') return 'timestamp without time zone';
  return lower;
}

const BUILTIN_ROLES = ['pg_checkpoint', 'pg_create_subscription', 'pg_database_owner', 'pg_execute_server_program',
  'pg_monitor', 'pg_read_all_data', 'pg_read_all_settings', 'pg_read_all_stats', 'pg_read_server_files',
  'pg_signal_backend', 'pg_stat_scan_tables', 'pg_use_reserved_connections', 'pg_write_all_data',
  'pg_write_server_files'];

/** Read `view.source` into the model every screen draws from. */
export function readModel(view: unknown): PgModel {
  const src = pick<Record<string, any>>(view, 'source', {});
  // pg_stat_user_tables, keyed by table, folded into each table's raw record.
  const statRows = new Map(rows(src, 'stats.tables').map(r => [str(r.table ?? r.relname), r]));
  const tables: PgTable[] = rows(src, 'tables').map(t0 => {
    const t: Record<string, any> = { ...(statRows.get(str(t0.name)) || {}), ...t0 };
    return {
    schema: str(t.schema, 'public'),
    name: str(t.name),
    rows: num(t.rows ?? t.n_live_tup),
    sizeKb: num(t.size_kb),
    comment: str(t.comment),
    owner: str(t.owner, 'postgres'),
    raw: t,
    columns: rows(t, 'columns').map(c => ({
      name: str(c.name),
      type: pgTypeName(c.type),
      nullable: c.nullable !== false && !c.pk,
      pk: Boolean(c.pk),
      default: c.default === undefined || c.default === null ? null : String(c.default),
    })),
    uniques: rows(t, 'uniques').map(u => ({ name: str(u.name), columns: list(u.columns ?? u.column) })).filter(u => u.name),
    checks: rows(t, 'checks').map((c, i) => ({ name: str(c.name, `${str(t.name)}_check${i ? i : ''}`),
      expr: str(c.expression ?? c.expr ?? c.check ?? c.definition) })),
    analyzed: Boolean(t.analyzed),
  };
  }).filter(t => t.name);

  const seen = new Set<string>();
  const indexes: PgIndex[] = [];
  const addIndex = (ix: Record<string, any>, table?: string) => {
    const name = str(ix.name);
    const tbl = str(ix.table, table || '');
    if (!name || seen.has(tbl + '.' + name)) return;
    seen.add(tbl + '.' + name);
    indexes.push({
      schema: str(ix.schema, 'public'),
      table: tbl,
      name,
      columns: list(ix.columns),
      unique: Boolean(ix.unique),
      method: str(ix.method, 'btree') || 'btree',
      partial: typeof ix.partial === 'string' ? ix.partial : str(ix.where ?? ix.predicate),
      include: list(ix.include),
      primary: Boolean(ix.primary) || name === `${tbl}_pkey`,
      scans: ix.scans === undefined || ix.scans === null ? null : num(ix.scans),
      definition: str(ix.definition),
    });
  };
  for (const ix of rows(src, 'indexes')) addIndex(ix);
  for (const t of tables) for (const ix of rows(t.raw, 'indexes')) addIndex(ix, t.name);

  const foreignKeys: PgForeignKey[] = [];
  const declared = rows(src, 'foreign_keys').concat(...tables.map(t => rows(t.raw, 'foreign_keys')
    .map(fk => ({ table: t.name, ...fk }))));
  if (declared.length) {
    for (const fk of declared) {
      foreignKeys.push({
        name: str(fk.name, `${str(fk.table)}_${list(fk.columns ?? fk.column).join('_')}_fkey`),
        table: str(fk.table),
        columns: list(fk.columns ?? fk.column),
        refTable: str(fk.ref_table ?? fk.references ?? fk.referenced_table),
        refColumns: list(fk.ref_columns ?? fk.ref_column ?? fk.referenced_columns),
      });
    }
  } else {
    // The view does not carry foreign keys yet; ShopFlow names every reference
    // `<thing>_id` after the primary key it points at, so they are recovered by
    // that convention (and `manager_id`, the one self-reference, by name).
    const pkOwner = new Map<string, string>();
    for (const t of tables) {
      const pk = t.columns.find(c => c.pk);
      if (pk) pkOwner.set(pk.name, t.name);
    }
    for (const t of tables) {
      for (const c of t.columns) {
        if (c.pk) continue;
        let ref = pkOwner.get(c.name);
        let refCol = c.name;
        if (!ref && c.name === 'manager_id' && t.name === 'employees') { ref = 'employees'; refCol = 'employee_id'; }
        if (ref && ref !== t.name || (ref && c.name === 'manager_id')) {
          foreignKeys.push({ name: `${t.name}_${c.name}_fkey`, table: t.name, columns: [c.name],
            refTable: ref as string, refColumns: [refCol] });
        }
      }
    }
  }

  const views: PgView[] = rows(src, 'views').map(v => ({
    schema: str(v.schema, 'public'), name: str(v.name), definition: str(v.definition ?? v.sql ?? v.query),
    columns: list(v.columns),
    owner: str(v.owner, 'postgres'), materialized: Boolean(v.materialized),
  })).filter(v => v.name);
  const sequences: PgSequence[] = rows(src, 'sequences').map(s => ({
    schema: str(s.schema, 'public'), name: str(s.name), table: str(s.table), column: str(s.column),
    last: s.last_value === undefined || s.last_value === null ? null : num(s.last_value),
  })).filter(s => s.name);

  const roles: PgRole[] = rows(src, 'roles').map(r => ({
    name: str(r.name), login: Boolean(r.login), superuser: Boolean(r.superuser),
    replication: Boolean(r.replication), builtin: false,
  })).filter(r => r.name);
  for (const name of BUILTIN_ROLES) {
    if (!roles.some(r => r.name === name)) {
      roles.push({ name, login: false, superuser: false, replication: false, builtin: true });
    }
  }

  const queries: PgQuery[] = rows(src, 'queries').map((q, i) => ({
    id: str(q.id, String(i + 1)), sql: str(q.sql), ms: q.ms === undefined || q.ms === null ? null : num(q.ms),
    rows: q.rows === undefined || q.rows === null ? null : num(q.rows),
    planKind: str(q.plan_kind), at: str(q.time ?? q.at),
  }));

  return {
    server: str(src.server, 'shop-db'),
    database: str(src.database, 'shop'),
    version: str(src.version, 'PostgreSQL 16.4'),
    tables, indexes, views, sequences, roles, queries, foreignKeys,
    analyzed: list(pick(src, 'stats.analyzed', [])).concat(tables.filter(t => t.analyzed).map(t => t.name)),
    cdc: { lsn: num(pick(src, 'cdc.lsn', 0)), walLevel: str(pick(src, 'cdc.wal_level', 'logical')),
      slots: rows(src, 'cdc.slots') },
    stats: pick<Record<string, any>>(src, 'stats', {}),
  };
}

/* ─────────────────────────── the object tree ─────────────────────────── */

export type NodeKind =
  | 'servers' | 'server' | 'databases' | 'database' | 'coll' | 'schemas' | 'schema'
  | 'tables' | 'table' | 'columns' | 'column' | 'constraints' | 'pkey' | 'fkey' | 'ukey' | 'check' | 'indexes' | 'index'
  | 'views' | 'view' | 'sequences' | 'sequence' | 'roles' | 'role' | 'tablespaces' | 'tablespace'
  | 'extension' | 'language' | 'empty';

export interface TreeNode {
  id: string;
  kind: NodeKind;
  label: string;
  /** Object type for icons and menus (`table`, `index`, a collection's child type...). */
  icon: string;
  count?: number;
  children?: TreeNode[];
  table?: string;
  name?: string;
  schema?: string;
  detail?: string;
}

function coll(id: string, label: string, icon: string, children: TreeNode[], kind: NodeKind = 'coll'): TreeNode {
  return { id, kind, label, icon, count: children.length, children };
}

export function buildTree(m: PgModel): TreeNode {
  const db = m.database;
  const tableNode = (t: PgTable): TreeNode => {
    const base = `t:${t.schema}.${t.name}`;
    const cols = t.columns.map(c => ({
      id: `${base}/c:${c.name}`, kind: 'column' as NodeKind, label: c.name, icon: c.pk ? 'column-pk' : 'column',
      table: t.name, name: c.name, schema: t.schema, detail: c.type,
    }));
    const pk = t.columns.filter(c => c.pk);
    const cons: TreeNode[] = [];
    if (pk.length) {
      cons.push({ id: `${base}/k:${t.name}_pkey`, kind: 'pkey', label: `${t.name}_pkey`, icon: 'pkey',
        table: t.name, name: `${t.name}_pkey`, schema: t.schema });
    }
    for (const fk of m.foreignKeys.filter(f => f.table === t.name)) {
      cons.push({ id: `${base}/f:${fk.name}`, kind: 'fkey', label: fk.name, icon: 'fkey', table: t.name,
        name: fk.name, schema: t.schema });
    }
    for (const u of t.uniques) {
      cons.push({ id: `${base}/u:${u.name}`, kind: 'ukey', label: u.name, icon: 'ukey', table: t.name, name: u.name, schema: t.schema });
    }
    for (const c of t.checks) {
      cons.push({ id: `${base}/x:${c.name}`, kind: 'check', label: c.name, icon: 'check', table: t.name, name: c.name, schema: t.schema });
    }
    const hidden = new Set(t.uniques.map(u => u.name));
    const ixs = m.indexes.filter(ix => ix.table === t.name && !ix.primary && !hidden.has(ix.name)).map(ix => ({
      id: `${base}/i:${ix.name}`, kind: 'index' as NodeKind, label: ix.name, icon: 'index', table: t.name,
      name: ix.name, schema: t.schema,
    }));
    return {
      id: base, kind: 'table', label: t.name, icon: 'table', table: t.name, name: t.name, schema: t.schema,
      children: [
        coll(`${base}/columns`, 'Columns', 'column', cols, 'columns'),
        coll(`${base}/constraints`, 'Constraints', 'constraints', cons, 'constraints'),
        coll(`${base}/indexes`, 'Indexes', 'index', ixs, 'indexes'),
        coll(`${base}/policies`, 'RLS Policies', 'policy', []),
        coll(`${base}/rules`, 'Rules', 'rule', []),
        coll(`${base}/triggers`, 'Triggers', 'trigger', []),
      ].map(n => ({ ...n, table: t.name, schema: t.schema })),
    };
  };

  const tables = m.tables.map(tableNode);
  const viewNodes = m.views.filter(v => !v.materialized).map(v => ({
    id: `v:${v.schema}.${v.name}`, kind: 'view' as NodeKind, label: v.name, icon: 'view', name: v.name, schema: v.schema,
  }));
  const matviews = m.views.filter(v => v.materialized).map(v => ({
    id: `mv:${v.schema}.${v.name}`, kind: 'view' as NodeKind, label: v.name, icon: 'mview', name: v.name, schema: v.schema,
  }));
  const seqs = m.sequences.map(s => ({
    id: `s:${s.schema}.${s.name}`, kind: 'sequence' as NodeKind, label: s.name, icon: 'sequence', name: s.name, schema: s.schema,
  }));

  const schema: TreeNode = {
    id: 'schema:public', kind: 'schema', label: 'public', icon: 'schema', name: 'public', schema: 'public',
    children: [
      coll('public/aggregates', 'Aggregates', 'aggregate', []),
      coll('public/collations', 'Collations', 'collation', []),
      coll('public/domains', 'Domains', 'domain', []),
      coll('public/ftsconf', 'FTS Configurations', 'fts', []),
      coll('public/ftsdict', 'FTS Dictionaries', 'fts', []),
      coll('public/ftsparser', 'FTS Parsers', 'fts', []),
      coll('public/ftstemplate', 'FTS Templates', 'fts', []),
      coll('public/foreign', 'Foreign Tables', 'foreign-table', []),
      coll('public/functions', 'Functions', 'function', []),
      coll('public/mviews', 'Materialized Views', 'mview', matviews),
      coll('public/operators', 'Operators', 'operator', []),
      coll('public/procedures', 'Procedures', 'function', []),
      coll('public/sequences', 'Sequences', 'sequence', seqs, 'sequences'),
      coll('public/tables', 'Tables', 'table', tables, 'tables'),
      coll('public/trigfuncs', 'Trigger Functions', 'function', []),
      coll('public/types', 'Types', 'type', []),
      coll('public/views', 'Views', 'view', viewNodes, 'views'),
    ],
  };

  const dbNode: TreeNode = {
    id: `db:${db}`, kind: 'database', label: db, icon: 'database', name: db,
    children: [
      coll(`${db}/casts`, 'Casts', 'cast', []),
      coll(`${db}/catalogs`, 'Catalogs', 'catalog', [
        { id: `${db}/catalogs/ansi`, kind: 'empty', label: 'ANSI (information_schema)', icon: 'catalog' },
        { id: `${db}/catalogs/pg`, kind: 'empty', label: 'PostgreSQL Catalog (pg_catalog)', icon: 'catalog' },
      ]),
      coll(`${db}/evttrig`, 'Event Triggers', 'trigger', []),
      coll(`${db}/extensions`, 'Extensions', 'extension', [
        { id: `${db}/ext/plpgsql`, kind: 'extension', label: 'plpgsql', icon: 'extension', name: 'plpgsql' },
      ]),
      coll(`${db}/fdw`, 'Foreign Data Wrappers', 'fdw', []),
      coll(`${db}/languages`, 'Languages', 'language', [
        { id: `${db}/lang/plpgsql`, kind: 'language', label: 'plpgsql', icon: 'language', name: 'plpgsql' },
      ]),
      coll(`${db}/publications`, 'Publications', 'publication', []),
      coll(`${db}/schemas`, 'Schemas', 'schema', [schema], 'schemas'),
      coll(`${db}/subscriptions`, 'Subscriptions', 'subscription', []),
    ],
  };

  const roleNodes = m.roles.map(r => ({
    id: `role:${r.name}`, kind: 'role' as NodeKind, label: r.name, icon: r.login ? 'role-login' : 'role-group', name: r.name,
  }));
  const server: TreeNode = {
    id: 'server:1', kind: 'server', label: m.server, icon: 'server', name: m.server,
    children: [
      coll('server/databases', 'Databases', 'database', [dbNode], 'databases'),
      coll('server/roles', 'Login/Group Roles', 'role-group', roleNodes, 'roles'),
      coll('server/tablespaces', 'Tablespaces', 'tablespace', [
        { id: 'ts:pg_default', kind: 'tablespace', label: 'pg_default', icon: 'tablespace', name: 'pg_default' },
        { id: 'ts:pg_global', kind: 'tablespace', label: 'pg_global', icon: 'tablespace', name: 'pg_global' },
      ], 'tablespaces'),
    ],
  };
  return { id: 'servers', kind: 'servers', label: 'Servers', icon: 'servers', count: 1, children: [server] };
}

/** Every node in the tree by id, and each node's parent chain (for breadcrumbs). */
export function indexTree(root: TreeNode): { byId: Map<string, TreeNode>; parent: Map<string, string> } {
  const byId = new Map<string, TreeNode>();
  const parent = new Map<string, string>();
  const walk = (node: TreeNode, up?: string) => {
    byId.set(node.id, node);
    if (up) parent.set(node.id, up);
    for (const child of node.children || []) walk(child, node.id);
  };
  walk(root);
  return { byId, parent };
}

/* ─────────────────────────── SQL text ─────────────────────────── */

const RESERVED = new Set(['all', 'analyse', 'analyze', 'and', 'any', 'array', 'as', 'asc', 'asymmetric', 'both', 'case',
  'cast', 'check', 'collate', 'column', 'constraint', 'create', 'current_date', 'current_role', 'current_time',
  'current_timestamp', 'current_user', 'default', 'deferrable', 'desc', 'distinct', 'do', 'else', 'end', 'except',
  'false', 'fetch', 'for', 'foreign', 'from', 'grant', 'group', 'having', 'in', 'initially', 'intersect', 'into',
  'lateral', 'leading', 'limit', 'localtime', 'localtimestamp', 'not', 'null', 'offset', 'on', 'only', 'or', 'order',
  'placing', 'primary', 'references', 'returning', 'select', 'session_user', 'some', 'symmetric', 'table', 'then',
  'to', 'trailing', 'true', 'union', 'unique', 'user', 'using', 'variadic', 'when', 'where', 'window', 'with',
  'user', 'order', 'group']);

/** An identifier the way PostgreSQL (and pgAdmin's generated SQL) writes it. */
export function qi(name: string): string {
  const text = String(name ?? '');
  if (/^[a-z_][a-z0-9_$]*$/.test(text) && !RESERVED.has(text)) return text;
  return '"' + text.replace(/"/g, '""') + '"';
}

/** A string literal; numbers and booleans pass through when they look like one. */
export function sqlLiteral(value: unknown, type = ''): string {
  if (value === null || value === undefined) return 'NULL';
  const text = String(value);
  const t = type.toLowerCase();
  if (/int|numeric|real|double|serial|decimal/.test(t) && /^-?\d+(\.\d+)?$/.test(text.trim())) return text.trim();
  if (t === 'boolean' && /^(true|false)$/i.test(text.trim())) return text.trim().toLowerCase();
  return "'" + text.replace(/'/g, "''") + "'";
}

export function fqn(schema: string, name: string): string {
  return `${qi(schema || 'public')}.${qi(name)}`;
}

export function columnDdl(c: PgColumn): string {
  let line = `${qi(c.name)} ${c.type}`;
  if (!c.nullable || c.pk) line += ' NOT NULL';
  if (c.default) line += ` DEFAULT ${c.default}`;
  return line;
}

/** The SQL tab of a table: pgAdmin's reverse-engineered CREATE script. */
export function tableDdl(m: PgModel, t: PgTable): string {
  const name = fqn(t.schema, t.name);
  const lines = t.columns.map(c => '    ' + columnDdl(c));
  const pk = t.columns.filter(c => c.pk).map(c => qi(c.name));
  if (pk.length) lines.push(`    CONSTRAINT ${qi(t.name + '_pkey')} PRIMARY KEY (${pk.join(', ')})`);
  for (const u of t.uniques) {
    lines.push(`    CONSTRAINT ${qi(u.name)} UNIQUE (${u.columns.map(qi).join(', ')})`);
  }
  for (const fk of m.foreignKeys.filter(f => f.table === t.name)) {
    lines.push(`    CONSTRAINT ${qi(fk.name)} FOREIGN KEY (${fk.columns.map(qi).join(', ')})\n`
      + `        REFERENCES ${fqn('public', fk.refTable)} (${fk.refColumns.map(qi).join(', ')}) MATCH SIMPLE\n`
      + '        ON UPDATE NO ACTION\n        ON DELETE NO ACTION');
  }
  for (const c of t.checks.filter(x => x.expr)) {
    lines.push(`    CONSTRAINT ${qi(c.name)} CHECK (${c.expr})`);
  }
  let out = `-- Table: ${t.schema}.${t.name}\n\n-- DROP TABLE IF EXISTS ${name};\n\n`
    + `CREATE TABLE IF NOT EXISTS ${name}\n(\n${lines.join(',\n')}\n)\n\nTABLESPACE pg_default;\n\n`
    + `ALTER TABLE IF EXISTS ${name}\n    OWNER to ${qi(t.owner || 'postgres')};`;
  if (t.comment) out += `\n\nCOMMENT ON TABLE ${name}\n    IS ${sqlLiteral(t.comment)};`;
  const constraintIx = new Set(t.uniques.map(u => u.name));
  for (const ix of m.indexes.filter(i => i.table === t.name && !i.primary && !constraintIx.has(i.name))) {
    out += '\n' + indexDdl(ix, true);
  }
  return out + '\n';
}

/** One index key as the catalogue stores it ("order_ts DESC NULLS LAST"), split into its parts. */
export function splitIndexColumn(spec: string): { name: string; order: 'ASC' | 'DESC'; nulls: 'FIRST' | 'LAST' } {
  const m = String(spec).trim().match(/^(.*?)(?:\s+(ASC|DESC))?(?:\s+NULLS\s+(FIRST|LAST))?$/i);
  const order = ((m?.[2] || 'ASC').toUpperCase() as 'ASC' | 'DESC');
  const nulls = ((m?.[3] || (order === 'ASC' ? 'LAST' : 'FIRST')).toUpperCase() as 'FIRST' | 'LAST');
  return { name: (m?.[1] || spec).trim(), order, nulls };
}

export function indexDdl(ix: PgIndex, withHeader = true): string {
  const head = withHeader ? `-- Index: ${ix.name}\n\n-- DROP INDEX IF EXISTS ${fqn(ix.schema, ix.name)};\n\n` : '';
  let out = `${head}CREATE ${ix.unique ? 'UNIQUE ' : ''}INDEX IF NOT EXISTS ${qi(ix.name)}\n`
    + `    ON ${fqn(ix.schema, ix.table)} USING ${ix.method || 'btree'}\n`
    + `    (${ix.columns.map(c => {
      const k = splitIndexColumn(c);
      const key = /[()]/.test(k.name) ? k.name : qi(k.name);
      return ix.method === 'btree' || !ix.method ? `${key} ${k.order} NULLS ${k.nulls}` : key;
    }).join(', ')})\n`;
  if (ix.include.length) out += `    INCLUDE(${ix.include.map(qi).join(', ')})\n`;
  out += '    TABLESPACE pg_default';
  if (ix.partial) out += `\n    WHERE ${ix.partial}`;
  return out + ';\n';
}

export function viewDdl(v: PgView): string {
  const name = fqn(v.schema, v.name);
  const kind = v.materialized ? 'MATERIALIZED VIEW' : 'VIEW';
  return `-- ${v.materialized ? 'Materialized View' : 'View'}: ${v.schema}.${v.name}\n\n-- DROP ${kind} ${name};\n\n`
    + `CREATE OR REPLACE ${kind} ${name}\n AS\n${v.definition || ' SELECT 1'}${/;\s*$/.test(v.definition) ? '' : ';'}\n\n`
    + `ALTER TABLE ${name}\n    OWNER TO ${qi(v.owner || 'postgres')};\n`;
}

export function roleDdl(r: PgRole): string {
  const attrs = [
    r.login ? 'LOGIN' : 'NOLOGIN', r.superuser ? 'SUPERUSER' : 'NOSUPERUSER', 'INHERIT', 'NOCREATEDB',
    r.superuser ? 'CREATEROLE' : 'NOCREATEROLE', r.replication || r.superuser ? 'REPLICATION' : 'NOREPLICATION',
    r.superuser ? 'BYPASSRLS' : 'NOBYPASSRLS',
  ];
  return `-- Role: ${r.name}\n-- DROP ROLE IF EXISTS ${qi(r.name)};\n\nCREATE ROLE ${qi(r.name)} WITH\n  `
    + attrs.join('\n  ') + (r.login ? "\n  ENCRYPTED PASSWORD 'SCRAM-SHA-256$4096:********'" : '') + ';\n';
}

/* ───────────────────── the statements the dialogs generate ───────────────────── */

export interface ColumnSpec { name: string; type: string; length: string; scale: string; notNull: boolean; pk: boolean; def: string }
export interface FkSpec { column: string; refTable: string; refColumn: string; onDelete: string }
export interface TableSpec {
  name: string; schema: string; owner: string; comment: string; columns: ColumnSpec[];
  fks: FkSpec[]; uniques: string[]; checks: { name: string; expr: string }[];
}

export const DATA_TYPES = ['bigint', 'bigserial', 'boolean', 'bytea', 'character', 'character varying', 'date',
  'double precision', 'integer', 'json', 'jsonb', 'numeric', 'real', 'serial', 'smallint', 'text', 'time without time zone',
  'timestamp with time zone', 'timestamp without time zone', 'uuid'];
export const LENGTH_TYPES = new Set(['character', 'character varying', 'numeric']);

export function typeWithLength(c: { type: string; length: string; scale: string }): string {
  const length = String(c.length || '').trim();
  if (!LENGTH_TYPES.has(c.type) || !/^\d+$/.test(length)) return c.type;
  const scale = String(c.scale || '').trim();
  if (c.type === 'numeric' && /^\d+$/.test(scale)) return `numeric(${length}, ${scale})`;
  return `${c.type}(${length})`;
}

export function createTableSql(spec: TableSpec): string {
  const name = fqn(spec.schema, spec.name || '');
  const lines: string[] = [];
  for (const c of spec.columns.filter(col => col.name.trim())) {
    let line = `    ${qi(c.name.trim())} ${typeWithLength(c)}`;
    if (c.notNull || c.pk) line += ' NOT NULL';
    if (c.def.trim()) line += ` DEFAULT ${c.def.trim()}`;
    lines.push(line);
  }
  const pk = spec.columns.filter(c => c.pk && c.name.trim()).map(c => qi(c.name.trim()));
  if (pk.length) lines.push(`    PRIMARY KEY (${pk.join(', ')})`);
  for (const u of spec.uniques.filter(Boolean)) lines.push(`    UNIQUE (${qi(u)})`);
  for (const fk of spec.fks.filter(f => f.column && f.refTable && f.refColumn)) {
    lines.push(`    FOREIGN KEY (${qi(fk.column)})\n        REFERENCES ${fqn('public', fk.refTable)} (${qi(fk.refColumn)}) MATCH SIMPLE\n`
      + `        ON UPDATE NO ACTION\n        ON DELETE ${fk.onDelete || 'NO ACTION'}`);
  }
  for (const ch of spec.checks.filter(c => c.expr.trim())) {
    lines.push(`    ${ch.name.trim() ? `CONSTRAINT ${qi(ch.name.trim())} ` : ''}CHECK (${ch.expr.trim()})`);
  }
  let out = `CREATE TABLE ${name}\n(\n${lines.join(',\n')}\n);`;
  if (spec.owner && spec.owner !== 'postgres') out += `\n\nALTER TABLE IF EXISTS ${name}\n    OWNER to ${qi(spec.owner)};`;
  if (spec.comment.trim()) out += `\n\nCOMMENT ON TABLE ${name}\n    IS ${sqlLiteral(spec.comment.trim())};`;
  return out;
}

export interface IndexColSpec { column: string; order: 'ASC' | 'DESC'; nulls: 'FIRST' | 'LAST' }
export interface IndexSpec {
  name: string; schema: string; table: string; method: string; unique: boolean; concurrently: boolean;
  columns: IndexColSpec[]; include: string[]; where: string; fillfactor: string; comment: string;
}

export function createIndexSql(spec: IndexSpec): string {
  const cols = spec.columns.filter(c => c.column).map(c => {
    let text = `${qi(c.column)}`;
    if (spec.method === 'btree') {
      text += ` ${c.order}`;
      const defaultNulls = c.order === 'ASC' ? 'LAST' : 'FIRST';
      if (c.nulls !== defaultNulls) text += ` NULLS ${c.nulls}`;
    }
    return text;
  });
  let out = `CREATE ${spec.unique ? 'UNIQUE ' : ''}INDEX${spec.concurrently ? ' CONCURRENTLY' : ''} ${spec.name ? qi(spec.name) : ''}`
    .replace(/\s+$/, '')
    + `\n    ON ${fqn(spec.schema, spec.table)} USING ${spec.method || 'btree'}\n    (${cols.join(', ')})`;
  if (spec.include.length) out += `\n    INCLUDE(${spec.include.map(qi).join(', ')})`;
  if (/^\d+$/.test(spec.fillfactor.trim())) out += `\n    WITH (fillfactor=${spec.fillfactor.trim()})`;
  if (spec.where.trim()) out += `\n    WHERE ${spec.where.trim()}`;
  return out + ';';
}

export type DropKind = 'TABLE' | 'INDEX' | 'VIEW' | 'MATERIALIZED VIEW' | 'SEQUENCE';

export function dropSql(kind: DropKind, schema: string, name: string, cascade: boolean): string {
  return `DROP ${kind} IF EXISTS ${fqn(schema, name)}${cascade ? ' CASCADE' : ''};`;
}

export function dropColumnSql(schema: string, table: string, column: string, cascade = false): string {
  return `ALTER TABLE IF EXISTS ${fqn(schema, table)} DROP COLUMN IF EXISTS ${qi(column)}${cascade ? ' CASCADE' : ''};`;
}

export function dropConstraintSql(schema: string, table: string, name: string, cascade = false): string {
  return `ALTER TABLE IF EXISTS ${fqn(schema, table)} DROP CONSTRAINT IF EXISTS ${qi(name)}${cascade ? ' CASCADE' : ''};`;
}

export function truncateSql(schema: string, table: string, mode: 'plain' | 'cascade' | 'restart'): string {
  const tail = mode === 'cascade' ? ' CASCADE' : mode === 'restart' ? ' RESTART IDENTITY' : '';
  return `TRUNCATE TABLE ${fqn(schema, table)}${tail};`;
}

export function addColumnSql(schema: string, table: string, c: ColumnSpec): string {
  let out = `ALTER TABLE IF EXISTS ${fqn(schema, table)}\n    ADD COLUMN ${qi(c.name.trim())} ${typeWithLength(c)}`;
  if (c.notNull) out += ' NOT NULL';
  if (c.def.trim()) out += ` DEFAULT ${c.def.trim()}`;
  return out + ';';
}

export function alterColumnSql(schema: string, table: string, before: PgColumn,
  after: { name: string; notNull: boolean; def: string }): string {
  const t = fqn(schema, table);
  const out: string[] = [];
  let col = before.name;
  if (after.name.trim() && after.name.trim() !== before.name) {
    out.push(`ALTER TABLE IF EXISTS ${t}\n    RENAME ${qi(before.name)} TO ${qi(after.name.trim())};`);
    col = after.name.trim();
  }
  const wasNotNull = !before.nullable;
  if (after.notNull !== wasNotNull && !before.pk) {
    out.push(`ALTER TABLE IF EXISTS ${t}\n    ALTER COLUMN ${qi(col)} ${after.notNull ? 'SET' : 'DROP'} NOT NULL;`);
  }
  const oldDef = (before.default || '').trim();
  if (after.def.trim() !== oldDef) {
    out.push(after.def.trim()
      ? `ALTER TABLE IF EXISTS ${t}\n    ALTER COLUMN ${qi(col)} SET DEFAULT ${after.def.trim()};`
      : `ALTER TABLE IF EXISTS ${t}\n    ALTER COLUMN ${qi(col)} DROP DEFAULT;`);
  }
  return out.join('\n');
}

export function alterTableSql(t: PgTable, after: { name: string; comment: string }): string {
  const out: string[] = [];
  let name = t.name;
  if (after.name.trim() && after.name.trim() !== t.name) {
    out.push(`ALTER TABLE IF EXISTS ${fqn(t.schema, t.name)}\n    RENAME TO ${qi(after.name.trim())};`);
    name = after.name.trim();
  }
  if (after.comment.trim() !== (t.comment || '').trim()) {
    out.push(`COMMENT ON TABLE ${fqn(t.schema, name)}\n    IS ${after.comment.trim() ? sqlLiteral(after.comment.trim()) : 'NULL'};`);
  }
  return out.join('\n\n');
}

export function createViewSql(schema: string, name: string, definition: string, materialized: boolean): string {
  const body = definition.trim().replace(/;\s*$/, '');
  return `CREATE ${materialized ? 'MATERIALIZED VIEW' : 'VIEW'} ${fqn(schema, name || '')}\n AS\n${body};`;
}

export interface MaintenanceSpec {
  op: 'VACUUM' | 'ANALYZE' | 'REINDEX' | 'CLUSTER';
  full: boolean; freeze: boolean; analyze: boolean; disablePageSkipping: boolean; skipLocked: boolean;
  verbose: boolean;
}

/** What pgAdmin's Maintenance dialog runs for a table, an index or the whole database. */
export function maintenanceSql(spec: MaintenanceSpec, target: { kind: 'table' | 'index' | 'database'; schema?: string; name: string }): string {
  const object = target.kind === 'database' ? '' : ` ${fqn(target.schema || 'public', target.name)}`;
  if (spec.op === 'VACUUM') {
    const opts = [spec.full && 'FULL', spec.freeze && 'FREEZE', spec.analyze && 'ANALYZE',
      spec.disablePageSkipping && 'DISABLE_PAGE_SKIPPING', spec.skipLocked && 'SKIP_LOCKED', spec.verbose && 'VERBOSE']
      .filter(Boolean);
    return `VACUUM${opts.length ? ` (${opts.join(', ')})` : ''}${target.kind === 'index' ? '' : object};`;
  }
  if (spec.op === 'ANALYZE') {
    return `ANALYZE${spec.verbose ? ' VERBOSE' : ''}${target.kind === 'index' ? '' : object};`;
  }
  if (spec.op === 'REINDEX') {
    const what = target.kind === 'database' ? `DATABASE ${qi(target.name)}` : `${target.kind.toUpperCase()}${object}`;
    return `REINDEX${spec.verbose ? ' (VERBOSE)' : ''} ${what};`;
  }
  return `CLUSTER${spec.verbose ? ' VERBOSE' : ''}${target.kind === 'table' ? object : ''};`;
}

/** pgAdmin's Scripts menu for a table. */
export function tableScript(t: PgTable, kind: 'select' | 'insert' | 'update' | 'delete'): string {
  const name = fqn(t.schema, t.name);
  const cols = t.columns.map(c => qi(c.name));
  const pk = t.columns.find(c => c.pk) || t.columns[0];
  if (kind === 'select') return `SELECT ${cols.join(', ')}\n\tFROM ${name};`;
  if (kind === 'insert') {
    return `INSERT INTO ${name}(\n\t${cols.join(', ')})\n\tVALUES (${cols.map(() => '?').join(', ')});`;
  }
  if (kind === 'update') {
    return `UPDATE ${name}\n\tSET ${cols.map(c => `${c}=?`).join(', ')}\n\tWHERE ${pk ? `${qi(pk.name)} = ?` : '<condition>'};`;
  }
  return `DELETE FROM ${name}\n\tWHERE ${pk ? `${qi(pk.name)} = ?` : '<condition>'};`;
}

/* ───────────────────────── syntax colouring (no markup) ───────────────────────── */

const KEYWORDS = new Set(('select from where and or not in is null as on join left right inner outer full cross '
  + 'group by order having limit offset insert into values update set delete create table index unique view '
  + 'materialized drop alter add column constraint primary key foreign references match simple action no '
  + 'cascade restrict if exists tablespace owner to using with include concurrently analyze explain vacuum '
  + 'verbose buffers costs timing summary format json case when then else end distinct union all intersect '
  + 'except asc desc nulls first last returning begin commit rollback truncate restart identity comment rename '
  + 'default check grant revoke schema sequence over partition window rows range between preceding following '
  + 'current row unbounded filter lateral recursive true false interval like ilike similar coalesce count sum '
  + 'avg min max cast reindex cluster freeze full skip_locked disable_page_skipping database role replace').split(' '));
const TYPES = new Set(('integer int bigint smallint serial bigserial numeric decimal real double precision text '
  + 'varchar character char boolean bool date time timestamp timestamptz zone without uuid json jsonb bytea').split(' '));

export interface Token { text: string; cls: '' | 'kw' | 'ty' | 'st' | 'nu' | 'co' | 'op' | 'id' }

export function tokenize(sql: string): Token[] {
  const out: Token[] = [];
  const re = /(--[^\n]*)|(\/\*[\s\S]*?(?:\*\/|$))|('(?:[^']|'')*'?)|("(?:[^"]|"")*"?)|(\b\d+(?:\.\d+)?\b)|([A-Za-z_][A-Za-z0-9_$]*)|(\s+)|([^\sA-Za-z0-9_])/g;
  let match: RegExpExecArray | null;
  while ((match = re.exec(sql))) {
    const [text, line, block, s, quoted, n, word] = match;
    let cls: Token['cls'] = '';
    if (line || block) cls = 'co';
    else if (s) cls = 'st';
    else if (quoted) cls = 'id';
    else if (n) cls = 'nu';
    else if (word) cls = KEYWORDS.has(word.toLowerCase()) ? 'kw' : TYPES.has(word.toLowerCase()) ? 'ty' : '';
    else if (/^[^\s]$/.test(text) && /[=<>!+\-*/%|:;(),.]/.test(text)) cls = 'op';
    const last = out[out.length - 1];
    if (last && last.cls === cls && cls === '') last.text += text;
    else out.push({ text, cls });
  }
  return out;
}

/* ───────────────────────── result grids ───────────────────────── */

export interface DataChanges {
  updates: { pk: unknown; values: Record<string, unknown> }[];
  inserts: Record<string, unknown>[];
  deletes: unknown[];
}


export function gridsOf(result: any): Grid[] {
  const grids = pick<any[]>(result, 'data.grids', []);
  return grids.filter(g => g && Array.isArray(g.columns)).map(g => ({
    columns: g.columns.map((c: unknown) => String(c)),
    rows: Array.isArray(g.rows) ? g.rows : [],
    total: Number(g.total ?? (g.rows || []).length) || 0,
    title: g.title ? String(g.title) : undefined,
  }));
}

/** A column's PostgreSQL type: the table's own when the name is known, else inferred from the values. */
export function columnType(m: PgModel, column: string, values: unknown[], table?: string): string {
  const tables = table ? m.tables.filter(t => t.name === table) : m.tables;
  for (const t of tables.concat(m.tables)) {
    const c = t.columns.find(col => col.name === column);
    if (c) return c.type;
  }
  const sample = values.filter(v => v !== null && v !== undefined).slice(0, 50);
  if (!sample.length) return 'text';
  if (sample.every(v => typeof v === 'boolean')) return 'boolean';
  if (sample.every(v => typeof v === 'number' && Number.isInteger(v))) {
    return /count|sum/i.test(column) ? 'bigint' : 'integer';
  }
  if (sample.every(v => typeof v === 'number')) return 'numeric';
  if (sample.every(v => /^\d{4}-\d{2}-\d{2}T?[\d:. ]*$/.test(String(v)) && String(v).length > 10)) return 'timestamp without time zone';
  if (sample.every(v => /^\d{4}-\d{2}-\d{2}$/.test(String(v)))) return 'date';
  return 'text';
}

/** Text of a command result other than its grids: the Messages tab. */
export function messagesOf(result: any): string {
  const text = String(result?.ok ? result?.output || '' : result?.error || result?.output || '');
  // Drop the boxed grids the console prints; the Data Output shows those.
  const lines = text.split('\n');
  const keep: string[] = [];
  for (const line of lines) {
    if (/^\+[-+]+\+$/.test(line.trim()) || /^\|.*\|$/.test(line.trim())) continue;
    if (/^(\d+ rows?|only showing top \d+ rows \(of \d+\))$/.test(line.trim())) continue;
    keep.push(line);
  }
  return keep.join('\n').replace(/\n{3,}/g, '\n\n').trim();
}

/* ───────────────────────── EXPLAIN plans ───────────────────────── */

export interface PlanNode {
  id: number;
  type: string;
  relation: string;
  alias: string;
  index: string;
  joinType: string;
  startupCost: number | null;
  totalCost: number | null;
  planRows: number | null;
  width: number | null;
  actualStartup: number | null;
  actualTotal: number | null;
  actualRows: number | null;
  loops: number;
  details: [string, string][];
  children: PlanNode[];
}

export interface Plan {
  root: PlanNode | null;
  planningMs: number | null;
  executionMs: number | null;
  analyze: boolean;
  text: string;
}

function numOrNull(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

const KNOWN_KEYS = new Set(['node type', 'node_type', 'type', 'name', 'op', 'plans', 'children', 'relation name',
  'relation', 'table', 'alias', 'index name', 'index', 'join type', 'join_type', 'startup cost', 'startup_cost',
  'total cost', 'total_cost', 'cost', 'plan rows', 'plan_rows', 'rows', 'est_rows', 'plan width', 'width',
  'actual startup time', 'actual_startup_time', 'actual total time', 'actual_total_time', 'actual_time',
  'actual rows', 'actual_rows', 'actual loops', 'actual_loops', 'loops', 'actual', 'id']);

/** A plan from `result.data.plan` - Postgres's JSON format or a snake_case tree. */
const LABELS: Record<string, string> = {
  filter: 'Filter', index_cond: 'Index Cond', recheck_cond: 'Recheck Cond', hash_cond: 'Hash Cond',
  merge_cond: 'Merge Cond', join_filter: 'Join Filter', rows_removed: 'Rows Removed by Filter',
  rows_removed_by_filter: 'Rows Removed by Filter', group_key: 'Group Key', sort_key: 'Sort Key',
  sort_method: 'Sort Method', having: 'Filter (HAVING)', output: 'Output', strategy: 'Strategy',
  heap_fetches: 'Heap Fetches', loops_est: 'Estimated Loops', cte_name: 'CTE Name', parent: 'Parent Relationship',
};

function label(key: string): string {
  return LABELS[key] || key.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

/**
 * A plan from `result.data.plan`: the engine's snake_case tree (`node_type`,
 * `cost: [startup, total]`, `rows_est`, `rows_actual`, `time_ms`, `children`),
 * or Postgres's own JSON format. `meta` is `result.data.plan_meta`; its
 * `analyze` flag decides whether the actual rows/times are shown at all - the
 * engine measures them either way, but plain EXPLAIN does not report them.
 */
export function normalizePlan(raw: unknown, meta?: Record<string, any> | null): Plan | null {
  let top: any = raw;
  if (Array.isArray(top)) top = top[0];
  if (!top || typeof top !== 'object') return null;
  const planningMs = numOrNull(meta?.planning_ms ?? top['Planning Time'] ?? top.planning_time ?? top.planning_ms);
  const executionMs = numOrNull(meta?.execution_ms ?? top['Execution Time'] ?? top.execution_time ?? top.execution_ms);
  const body = top.Plan ?? top.plan ?? top.root ?? top;
  let seq = 0;
  let sawActual = false;
  const walk = (n: any): PlanNode => {
    const costArr = Array.isArray(n.cost) ? n.cost : null;
    const cost = n.cost && typeof n.cost === 'object' && !costArr ? n.cost : {};
    const actual = n.actual && typeof n.actual === 'object' ? n.actual : {};
    const actualTotal = numOrNull(n['Actual Total Time'] ?? n.actual_total_time ?? n.time_ms ?? actual.total ?? actual.time
      ?? (typeof n.actual_time === 'number' ? n.actual_time : undefined));
    const actualRows = numOrNull(n['Actual Rows'] ?? n.actual_rows ?? n.rows_actual ?? actual.rows);
    if (actualTotal !== null || actualRows !== null) sawActual = true;
    const details: [string, string][] = [];
    for (const [key, value] of Object.entries(n)) {
      if (KNOWN_KEYS.has(key.toLowerCase()) || ['rows_est', 'rows_actual', 'time_ms', 'time_start', 'buffers'].includes(key)) continue;
      if (value === null || value === undefined || value === '' || (typeof value === 'object' && !Array.isArray(value))) continue;
      details.push([label(key), Array.isArray(value) ? value.join(', ') : String(value)]);
    }
    if (n.buffers && typeof n.buffers === 'object') {
      const parts = Object.entries(n.buffers).filter(([, v]) => v !== null && v !== 0).map(([k, v]) => `${k}=${v}`);
      details.push(['Buffers', parts.length ? `shared ${parts.join(' ')}` : 'shared hit']);
    }
    const kids = n.Plans ?? n.plans ?? n.children ?? [];
    return {
      id: ++seq,
      type: String(n['Node Type'] ?? n.node_type ?? n.type ?? n.op ?? n.name ?? 'Result'),
      relation: String(n['Relation Name'] ?? n.relation ?? n.table ?? ''),
      alias: String(n.Alias ?? n.alias ?? ''),
      index: String(n['Index Name'] ?? n.index ?? ''),
      joinType: String(n['Join Type'] ?? n.join_type ?? ''),
      startupCost: numOrNull(n['Startup Cost'] ?? n.startup_cost ?? (costArr ? costArr[0] : cost.startup)),
      totalCost: numOrNull(n['Total Cost'] ?? n.total_cost ?? (costArr ? costArr[1] : cost.total)
        ?? (typeof n.cost === 'number' ? n.cost : undefined)),
      planRows: numOrNull(n['Plan Rows'] ?? n.plan_rows ?? n.rows_est ?? n.est_rows ?? n.rows),
      width: numOrNull(n['Plan Width'] ?? n.width),
      actualStartup: numOrNull(n['Actual Startup Time'] ?? n.actual_startup_time ?? n.time_start ?? actual.startup),
      actualTotal,
      actualRows,
      loops: numOrNull(n['Actual Loops'] ?? n.actual_loops ?? n.loops ?? actual.loops) ?? 1,
      details,
      children: Array.isArray(kids) ? kids.filter(k => k && typeof k === 'object').map(walk) : [],
    };
  };
  const root = walk(body);
  const analyze = meta && typeof meta.analyze === 'boolean' ? meta.analyze : sawActual;
  if (!analyze) {
    const strip = (n: PlanNode) => {
      n.actualTotal = null;
      n.actualStartup = null;
      n.actualRows = null;
      n.details = n.details.filter(d => !/^Rows Removed|^Buffers/.test(d[0]));
      n.children.forEach(strip);
    };
    strip(root);
  }
  return { root, planningMs, executionMs: analyze ? executionMs : null, analyze, text: '' };
}

/** A plan from EXPLAIN's TEXT output, for when no structured plan was attached. */
export function parsePlanText(text: string): Plan | null {
  const lines = String(text || '').split('\n').filter(l => l.trim() && !/^QUERY PLAN$|^-+$/.test(l.trim()))
    .map(l => l.replace(/^\s*\|\s?/, '').replace(/\s*\|\s*$/, ''));
  let seq = 0;
  let planningMs: number | null = null;
  let executionMs: number | null = null;
  let analyze = false;
  const stack: { indent: number; node: PlanNode }[] = [];
  let root: PlanNode | null = null;
  const head = /^(\s*)(?:->\s+)?(.+?)\s+\(cost=([\d.]+)\.\.([\d.]+) rows=(\d+) width=(\d+)\)(?:\s+\(actual time=([\d.]+)\.\.([\d.]+) rows=(\d+) loops=(\d+)\))?/;
  for (const line of lines) {
    const p = line.match(/Planning Time:\s*([\d.]+)/i);
    if (p) { planningMs = Number(p[1]); continue; }
    const e = line.match(/Execution Time:\s*([\d.]+)/i);
    if (e) { executionMs = Number(e[1]); continue; }
    const m = line.match(head);
    if (m) {
      const indent = line.indexOf('->') >= 0 ? line.indexOf('->') : (m[1] || '').length;
      const label = (m[2] || '').trim();
      let type = label;
      let relation = '';
      let index = '';
      let alias = '';
      const using = label.match(/^(.*?) using (\S+)(?: on (\S+)(?: (\S+))?)?$/);
      const on = label.match(/^(.*?) on (\S+)(?: (\S+))?$/);
      if (using) { type = using[1] || ''; index = using[2] || ''; relation = using[3] || ''; alias = using[4] || ''; }
      else if (on) { type = on[1] || ''; relation = on[2] || ''; alias = on[3] || ''; }
      if (m[7]) analyze = true;
      const node: PlanNode = {
        id: ++seq, type, relation, alias, index, joinType: '',
        startupCost: Number(m[3]), totalCost: Number(m[4]), planRows: Number(m[5]), width: Number(m[6]),
        actualStartup: m[7] ? Number(m[7]) : null, actualTotal: m[8] ? Number(m[8]) : null,
        actualRows: m[9] ? Number(m[9]) : null, loops: m[10] ? Number(m[10]) : 1, details: [], children: [],
      };
      const join = type.match(/^(Hash|Merge|Nested Loop)\s+(Left|Right|Full|Semi|Anti)\s*(Join)?/);
      if (join) node.joinType = join[2] || '';
      while (stack.length && stack[stack.length - 1]!.indent >= indent) stack.pop();
      if (stack.length) stack[stack.length - 1]!.node.children.push(node);
      else if (!root) root = node;
      stack.push({ indent, node });
      continue;
    }
    const detail = line.trim().match(/^([A-Z][A-Za-z ]+?):\s+(.*)$/);
    if (detail && stack.length) stack[stack.length - 1]!.node.details.push([detail[1] || '', detail[2] || '']);
  }
  if (!root) return null;
  return { root, planningMs, executionMs, analyze, text };
}

export function flattenPlan(root: PlanNode | null): { node: PlanNode; depth: number }[] {
  const out: { node: PlanNode; depth: number }[] = [];
  const walk = (n: PlanNode, depth: number) => {
    out.push({ node: n, depth });
    for (const child of n.children) walk(child, depth + 1);
  };
  if (root) walk(root, 0);
  return out;
}

/** Exclusive time of a node: its own total minus its children's, all times loops. */
export function exclusiveMs(n: PlanNode): number | null {
  if (n.actualTotal === null) return null;
  const own = n.actualTotal * (n.loops || 1);
  const kids = n.children.reduce((sum, c) => sum + (c.actualTotal ?? 0) * (c.loops || 1), 0);
  return Math.max(0, own - kids);
}

/** pgAdmin's "rows x": how far the estimate was off, and in which direction. */
export function misestimate(n: PlanNode): { factor: number; dir: 'up' | 'down' | '' } | null {
  if (n.actualRows === null || n.planRows === null) return null;
  const actual = n.actualRows * (n.loops || 1);
  const plan = n.planRows * (n.loops || 1);
  if (actual === plan) return { factor: 1, dir: '' };
  if (plan === 0 || actual === 0) return { factor: Math.max(plan, actual) || 1, dir: actual > plan ? 'down' : 'up' };
  return actual > plan ? { factor: actual / plan, dir: 'down' } : { factor: plan / actual, dir: 'up' };
}

/** The severity colour band pgAdmin uses in the Analysis table (0 none .. 3 worst). */
export function band(ratio: number | null, kind: 'time' | 'rows'): 0 | 1 | 2 | 3 {
  if (ratio === null) return 0;
  if (kind === 'time') return ratio > 90 ? 3 : ratio > 50 ? 2 : ratio > 10 ? 1 : 0;
  return ratio > 1000 ? 3 : ratio > 100 ? 2 : ratio > 10 ? 1 : 0;
}

export function nodeLabel(n: PlanNode): string {
  if (n.joinType && /Join|Nested Loop/.test(n.type) && !n.type.includes(n.joinType)) {
    return `${n.type.replace(' Join', '')} ${n.joinType} Join`.replace('Nested Loop Join', 'Nested Loop');
  }
  return n.type;
}

/** The icon each plan node gets, after pgAdmin's ex_*.svg images. */
export function planIcon(type: string): string {
  const t = type.toLowerCase();
  if (t.includes('index only')) return 'index-only';
  if (t.includes('bitmap heap')) return 'bitmap-heap';
  if (t.includes('bitmap index')) return 'bitmap-index';
  if (t.includes('index')) return 'index-scan';
  if (t.includes('seq scan')) return 'seq-scan';
  if (t.includes('hash join')) return 'hash-join';
  if (t.includes('merge join')) return 'merge-join';
  if (t.includes('nested loop')) return 'nested';
  if (t === 'hash') return 'hash';
  if (t.includes('sort')) return 'sort';
  if (t.includes('aggregate') || t.includes('group')) return 'aggregate';
  if (t.includes('limit')) return 'limit';
  if (t.includes('cte')) return 'cte';
  if (t.includes('materialize')) return 'materialize';
  if (t.includes('unique')) return 'unique';
  if (t.includes('append')) return 'append';
  if (t.includes('gather')) return 'gather';
  if (t.includes('window')) return 'window';
  if (t.includes('subquery')) return 'subquery';
  if (t.includes('modify') || /insert|update|delete/.test(t)) return 'modify';
  return 'result';
}

/** EXPLAIN with the options the Query Tool's Explain Settings menu has ticked. */
export interface ExplainOptions { verbose: boolean; costs: boolean; buffers: boolean; timing: boolean; summary: boolean }

export function explainSql(sql: string, analyze: boolean, o: ExplainOptions): string {
  const opts: string[] = [];
  if (analyze) opts.push('ANALYZE');
  if (o.verbose) opts.push('VERBOSE');
  if (!o.costs) opts.push('COSTS OFF');
  if (analyze && o.buffers) opts.push('BUFFERS');
  if (analyze && !o.timing) opts.push('TIMING OFF');
  if (o.summary) opts.push('SUMMARY');
  const body = sql.trim().replace(/;\s*$/, '');
  if (!opts.length) return `EXPLAIN ${body}`;
  if (opts.length === 1 && opts[0] === 'ANALYZE') return `EXPLAIN ANALYZE ${body}`;
  return `EXPLAIN (${opts.join(', ')}) ${body}`;
}

/* ───────────────────────── modelled server statistics ───────────────────────── */

function hash(text: string): number {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** A small deterministic wobble so two reads of one state draw the same chart. */
function wobble(seed: string, i: number, spread: number): number {
  return (hash(seed + ':' + i) % 1000) / 1000 * spread;
}

export interface Series { name: string; colour: string; points: number[] }
export interface DashboardData {
  sessions: Series[]; tps: Series[]; tuplesIn: Series[]; tuplesOut: Series[]; blockIo: Series[];
  totals: { sessions: number; active: number; commits: number; reads: number; hits: number };
}

const DML = /^\s*(insert|update|delete)/i;

/**
 * The Dashboard's five graphs, MODELLED from what the database really did.
 *
 * The engine records every statement (`source.queries`), so the shape of each
 * graph follows the real activity - a burst of INSERTs is a spike in "Tuples
 * in" - over a quiet deterministic baseline. Nothing here reads a clock.
 */
export function dashboardData(m: PgModel, points = 20): DashboardData {
  const qs = m.queries.slice(-points);
  const seed = `${m.server}:${m.cdc.lsn}:${m.queries.length}`;
  const at = (i: number) => qs[i - (points - qs.length)];
  const mk = (name: string, colour: string, fn: (i: number, q: PgQuery | undefined) => number): Series => ({
    name, colour, points: Array.from({ length: points }, (_, i) => Math.max(0, Math.round(fn(i, at(i)) * 10) / 10)),
  });
  const totalRows = m.tables.reduce((s, t) => s + t.rows, 0);
  const sessions = [
    mk('Total', '#326690', (i, q) => 6 + (q ? 1 : 0) + Math.round(wobble(seed + 's', i, 2))),
    mk('Active', '#e45d39', (i, q) => (q ? 1 : 0) + Math.round(wobble(seed + 'a', i, 1.2))),
    mk('Idle', '#2e9b5e', (i, q) => 4 + Math.round(wobble(seed + 'i', i, 1.5)) - (q ? 1 : 0)),
  ];
  const tps = [
    mk('Transactions', '#326690', (i, q) => 3 + wobble(seed + 't', i, 4) + (q ? 6 : 0)),
    mk('Commits', '#2e9b5e', (i, q) => 3 + wobble(seed + 't', i, 4) + (q ? 6 : 0) - (hash(seed + 'r' + i) % 9 === 0 ? 1 : 0) - 0.6),
    mk('Rollbacks', '#e45d39', i => (hash(seed + 'r' + i) % 9 === 0 ? 1 : 0)),
  ];
  const tuplesIn = [
    mk('Inserts', '#326690', (i, q) => (q && /^\s*insert/i.test(q.sql) ? (q.rows ?? 1) : wobble(seed + 'ins', i, 1.5))),
    mk('Updates', '#2e9b5e', (i, q) => (q && /^\s*update/i.test(q.sql) ? (q.rows ?? 1) : wobble(seed + 'up', i, 1))),
    mk('Deletes', '#e45d39', (_i, q) => (q && /^\s*delete/i.test(q.sql) ? (q.rows ?? 1) : 0)),
  ];
  const tuplesOut = [
    mk('Fetched', '#326690', (i, q) => (q && !DML.test(q.sql) ? (q.rows ?? 10) : wobble(seed + 'f', i, 12))),
    mk('Returned', '#2e9b5e', (i, q) => (q && /seq scan/i.test(q.planKind)
      ? Math.min(totalRows, 20000) : q ? (q.rows ?? 10) * 3 : wobble(seed + 'ret', i, 40))),
  ];
  const blockIo = [
    mk('Reads', '#e45d39', (i, q) => (q && /seq scan/i.test(q.planKind) ? 120 + wobble(seed + 'br', i, 60) : wobble(seed + 'br', i, 4))),
    mk('Hits', '#326690', (i, q) => (q ? 400 + wobble(seed + 'bh', i, 300) : 40 + wobble(seed + 'bh', i, 30))),
  ];
  const last = (s: Series[], k: number) => { const p = s[k]?.points || []; return p[p.length - 1] ?? 0; };
  return {
    sessions, tps, tuplesIn, tuplesOut, blockIo,
    totals: {
      sessions: last(sessions, 0), active: last(sessions, 1),
      commits: 5120 + m.queries.length * 3 + m.cdc.lsn,
      reads: 2048 + m.queries.filter(q => /seq scan/i.test(q.planKind)).length * 137,
      hits: 98000 + m.queries.length * 911,
    },
  };
}

export interface TableStats { label: string; value: string }

/**
 * The Statistics tab of a table, from the view where the engine sends a
 * counter and DERIVED from the query log where it does not (a Seq Scan on
 * orders in `source.queries` is one `seq_scan` on orders).
 */
export function tableStatistics(m: PgModel, t: PgTable): TableStats[] {
  const raw = t.raw || {};
  const mentions = m.queries.filter(q => new RegExp(`\\b${t.name}\\b`, 'i').test(q.sql));
  const reads = mentions.filter(q => !DML.test(q.sql));
  const seq = raw.seq_scan ?? reads.filter(q => /seq scan/i.test(q.planKind) || !q.planKind).length;
  const idx = raw.idx_scan ?? reads.filter(q => /index/i.test(q.planKind)).length;
  const ins = raw.n_tup_ins ?? mentions.filter(q => /^\s*insert/i.test(q.sql)).reduce((s, q) => s + (q.rows ?? 1), 0);
  const upd = raw.n_tup_upd ?? mentions.filter(q => /^\s*update/i.test(q.sql)).reduce((s, q) => s + (q.rows ?? 1), 0);
  const del = raw.n_tup_del ?? mentions.filter(q => /^\s*delete/i.test(q.sql)).reduce((s, q) => s + (q.rows ?? 1), 0);
  const analyzed = m.analyzed.includes(t.name) || m.analyzed.includes(`public.${t.name}`);
  const idxKb = m.indexes.filter(i => i.table === t.name).length * Math.max(16, Math.round(t.rows * 0.022)) + 16;
  const heapKb = t.sizeKb || Math.round(t.rows * 0.12) + 8;
  const fmt = (kb: number) => (kb >= 1024 ? `${(kb / 1024).toFixed(1).replace(/\.0$/, '')} MB` : `${kb} kB`);
  return [
    { label: 'Sequential scans', value: String(seq) },
    { label: 'Sequential tuples read', value: String(raw.seq_tup_read ?? Number(seq) * t.rows) },
    { label: 'Index scans', value: String(idx) },
    { label: 'Index tuples fetched', value: String(raw.idx_tup_fetch ?? Number(idx) * 3) },
    { label: 'Tuples inserted', value: String(t.rows + Number(ins)) },
    { label: 'Tuples updated', value: String(upd) },
    { label: 'Tuples deleted', value: String(del) },
    { label: 'Tuples HOT updated', value: String(raw.n_tup_hot_upd ?? Math.floor(Number(upd) / 2)) },
    { label: 'Live tuples', value: String(raw.n_live_tup ?? t.rows) },
    { label: 'Dead tuples', value: String(raw.n_dead_tup ?? Number(upd) + Number(del)) },
    { label: 'Heap blocks read', value: String(raw.heap_blks_read ?? Math.ceil(heapKb / 8)) },
    { label: 'Heap blocks hit', value: String(raw.heap_blks_hit ?? Math.ceil(heapKb / 8) * (Number(seq) + 1) * 4) },
    { label: 'Last vacuum', value: str(raw.last_vacuum) },
    { label: 'Last autovacuum', value: str(raw.last_autovacuum) },
    { label: 'Last analyze', value: str(raw.last_analyze, analyzed ? 'analyzed in this session' : '') },
    { label: 'Last autoanalyze', value: str(raw.last_autoanalyze) },
    { label: 'Vacuum counter', value: String(raw.vacuum_count ?? 0) },
    { label: 'Analyze counter', value: String(raw.analyze_count ?? (analyzed ? 1 : 0)) },
    { label: 'Table size', value: fmt(heapKb) },
    { label: 'Indexes size', value: fmt(idxKb) },
    { label: 'Total size', value: fmt(heapKb + idxKb) },
  ];
}

/* ───────────────────────── where pgAdmin's address bar is ───────────────────────── */

export const BASE_URL = 'http://pgadmin.shopflow.internal';

export function browserUrl(): string {
  return `${BASE_URL}/browser/`;
}

export function queryToolUrl(trans: number, db: string, objType = '', objName = ''): string {
  const extra = objType ? `&is_query_tool=false&obj_type=${objType}&object_name=${encodeURIComponent(objName)}`
    : '&is_query_tool=true';
  return `${BASE_URL}/sqleditor/panel/${trans}?sgid=1&sid=1&did=16384&database_name=${encodeURIComponent(db)}${extra}`;
}

/** The fake OIDs pgAdmin's Properties tab shows: stable per object name. */
export function oidOf(name: string): number {
  return 16384 + (hash(name) % 40000);
}
