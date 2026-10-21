/**
 * The object explorer's right-click menus, in one place: the Databases page
 * tree, the worksheet's object explorer and the Warehouses list all ask here,
 * so a table offers the same actions wherever it is right-clicked.
 *
 * Every action runs the Snowflake SQL it stands for (through `sf.sql`, a
 * dialog, or a worksheet the student runs) - nothing is changed any other way.
 */
import type { SfContext, SfMenuItem } from './sfContext';
import { fqnSql, ident, leaf, list, splitFqn, str } from './snowflake';

export type SfTarget =
  | { kind: 'database'; name: string; dropped?: boolean }
  | { kind: 'schema'; db: string; name: string; dropped?: boolean }
  | { kind: 'table' | 'view'; fqn: string; dropped?: boolean }
  | { kind: 'stage' | 'pipe' | 'stream' | 'task' | 'file-format' | 'policy'; fqn: string }
  | { kind: 'column'; table: string; name: string }
  | { kind: 'warehouse'; name: string; state?: string };

export interface MenuHooks {
  /** The worksheet's "Place name in editor"; absent elsewhere. */
  place?: (text: string) => void;
  /** Show the result of a preview in place (the worksheet's result pane). */
  preview?: (sql: string) => void;
}

const up = (s: unknown) => String(s || '').toUpperCase();

async function copyName(sf: SfContext, text: string) {
  try { await navigator.clipboard.writeText(text); sf.notify('success', 'Copied to clipboard', text); } catch { sf.notify('info', 'Name', text); }
}

function placeOrOpen(sf: SfContext, hooks: MenuHooks, text: string, sheetName: string): SfMenuItem[] {
  return [
    hooks.place ? { label: 'Place name in editor', icon: 'edit', action: () => hooks.place!(text) }
      : { label: 'Open in new worksheet', icon: 'worksheet', action: () => sf.openWorksheet(`-- ${text}\n`, sheetName) },
    { label: 'Copy name', icon: 'copy', action: () => void copyName(sf, text) },
  ];
}

export function objectMenu(sf: SfContext, target: SfTarget, hooks: MenuHooks = {}): SfMenuItem[] {
  switch (target.kind) {
    case 'database': return databaseMenu(sf, target, hooks);
    case 'schema': return schemaMenu(sf, target, hooks);
    case 'table':
    case 'view': return tableMenu(sf, target, hooks);
    case 'column': return [
      ...(hooks.place ? [{ label: 'Place name in editor', icon: 'edit', action: () => hooks.place!(ident(target.name)) }] : []),
      { label: 'Copy name', icon: 'copy', action: () => void copyName(sf, target.name) },
    ];
    case 'warehouse': return warehouseMenu(sf, target);
    default: return otherMenu(sf, target, hooks);
  }
}

function databaseMenu(sf: SfContext, t: { name: string; dropped?: boolean }, hooks: MenuHooks): SfMenuItem[] {
  const db = t.name;
  if (t.dropped) return [{ label: 'Undrop', icon: 'undo', action: () => void sf.sql(`UNDROP DATABASE ${ident(db)}`, { success: `Database ${db} restored` }) }];
  return [
    { label: 'Set as worksheet context', icon: 'database', action: () => void sf.sql(`USE DATABASE ${ident(db)}`, { success: `Using database ${db}` }) },
    ...placeOrOpen(sf, hooks, ident(db), db),
    { label: 'View details', icon: 'external', action: () => sf.go({ page: 'databases', db }) },
    { sep: true },
    { label: 'Create schema', icon: 'schema', action: () => sf.create('schema', { database: db }) },
    { label: 'Clone', icon: 'clone', action: () => sf.dialog({ kind: 'prompt', title: 'Clone database', subtitle: db, okText: 'Clone',
      fields: [{ key: 'name', label: 'New database name', value: db + '_CLONE' }],
      build: v => (v.name.trim() ? `CREATE DATABASE ${ident(v.name.trim())} CLONE ${ident(db)}` : ''), success: 'Database cloned' }) },
    { label: 'Rename', icon: 'edit', action: () => sf.dialog({ kind: 'prompt', title: 'Rename database', subtitle: db, okText: 'Rename',
      message: 'Every schema and object moves with the database. SQL that names the old database (views, pipes, tasks) is not rewritten.',
      fields: [{ key: 'name', label: 'New name', value: db }],
      build: v => (v.name.trim() && up(v.name.trim()) !== up(db) ? `ALTER DATABASE ${ident(db)} RENAME TO ${ident(v.name.trim())}` : ''),
      success: 'Database renamed', then: v => sf.go({ page: 'databases', db: up(v.name.trim()) }) }) },
    { label: 'Grant privileges', icon: 'key', action: () => sf.dialog({ kind: 'grant', onKind: 'DATABASE', onName: db }) },
    { sep: true },
    { label: 'Drop', icon: 'trash', danger: true, action: async () => {
      const ok = await sf.confirm({ title: `Drop database ${db}?`, message: `Dropping ${db} drops every schema and table in it. UNDROP DATABASE restores it within its retention period.`, yes: 'Drop Database', danger: true, typeToConfirm: db });
      if (ok) await sf.sql(`DROP DATABASE ${ident(db)}`, { success: `Database ${db} dropped` });
    } },
  ];
}

function schemaMenu(sf: SfContext, t: { db: string; name: string; dropped?: boolean }, hooks: MenuHooks): SfMenuItem[] {
  const full = `${ident(t.db)}.${ident(t.name)}`;
  if (t.dropped) return [{ label: 'Undrop', icon: 'undo', action: () => void sf.sql(`UNDROP SCHEMA ${full}`, { success: `Schema ${t.name} restored` }) }];
  return [
    { label: 'Set as worksheet context', icon: 'schema', action: () => void sf.sql(`USE SCHEMA ${full}`, { success: `Using ${t.db}.${t.name}` }) },
    ...placeOrOpen(sf, hooks, full, `${t.db}.${t.name}`),
    { label: 'View details', icon: 'external', action: () => sf.go({ page: 'databases', db: t.db, schema: t.name }) },
    { sep: true },
    { label: 'Create table', icon: 'table', action: () => sf.create('table', { database: t.db, schema: t.name }) },
    { label: 'Create view', icon: 'view', action: () => sf.create('view', { database: t.db, schema: t.name }) },
    { label: 'Create stage', icon: 'stage', action: () => sf.create('stage', { database: t.db, schema: t.name }) },
    { label: 'Clone', icon: 'clone', action: () => sf.dialog({ kind: 'prompt', title: 'Clone schema', subtitle: `${t.db}.${t.name}`, okText: 'Clone',
      fields: [{ key: 'name', label: 'New schema name', value: t.name + '_CLONE' }],
      build: v => (v.name.trim() ? `CREATE SCHEMA ${ident(t.db)}.${ident(v.name.trim())} CLONE ${full}` : ''), success: 'Schema cloned' }) },
    { label: 'Rename', icon: 'edit', action: () => sf.dialog({ kind: 'prompt', title: 'Rename schema', subtitle: `${t.db}.${t.name}`, okText: 'Rename',
      message: 'Every object in the schema moves with it. SQL that names the old schema (views, pipes, tasks) is not rewritten.',
      fields: [{ key: 'name', label: 'New name', value: t.name }],
      build: v => (v.name.trim() && up(v.name.trim()) !== up(t.name) ? `ALTER SCHEMA ${full} RENAME TO ${ident(t.db)}.${ident(v.name.trim())}` : ''),
      success: 'Schema renamed', then: v => sf.go({ page: 'databases', db: t.db, schema: up(v.name.trim()) }) }) },
    { label: 'Grant privileges', icon: 'key', action: () => sf.dialog({ kind: 'grant', onKind: 'SCHEMA', onName: `${t.db}.${t.name}` }) },
    { sep: true },
    { label: 'Drop', icon: 'trash', danger: true, action: async () => {
      const ok = await sf.confirm({ title: `Drop schema ${t.name}?`, message: `Every table and view in ${t.db}.${t.name} will be dropped. UNDROP SCHEMA restores it within its retention period.`, yes: 'Drop Schema', danger: true });
      if (ok) await sf.sql(`DROP SCHEMA ${full}`, { success: `Schema ${t.name} dropped` });
    } },
  ];
}

function tableMenu(sf: SfContext, t: { kind: 'table' | 'view'; fqn: string; dropped?: boolean }, hooks: MenuHooks): SfMenuItem[] {
  const q = fqnSql(t.fqn);
  const name = leaf(t.fqn);
  const [db, schema] = splitFqn(t.fqn);
  const word = t.kind === 'view' ? 'VIEW' : 'TABLE';
  if (t.dropped) return [{ label: 'Undrop', icon: 'undo', action: () => void sf.sql(`UNDROP ${word} ${q}`, { success: `${name} restored` }) }];
  const preview = `SELECT * FROM ${q} LIMIT 100`;
  const items: SfMenuItem[] = [
    { label: 'Open in worksheet', icon: 'worksheet', action: () => sf.openWorksheet(`SELECT *\nFROM ${q}\nLIMIT 100;\n`, name) },
    ...(hooks.place ? [{ label: 'Place name in editor', icon: 'edit', action: () => hooks.place!(q) }] : []),
    { label: 'Preview data', icon: 'table', action: () => (hooks.preview ? hooks.preview(preview)
      : sf.go({ page: 'databases', db, schema, kind: t.kind === 'view' ? 'views' : 'tables', object: t.fqn, tab: 'Data Preview' })) },
    { label: 'Copy name', icon: 'copy', action: () => void copyName(sf, q) },
    { label: 'View details', icon: 'external', action: () => sf.go({ page: 'databases', db, schema, kind: t.kind === 'view' ? 'views' : 'tables', object: t.fqn }) },
    { label: 'Show definition (DDL)', icon: 'format', action: () => sf.go({ page: 'databases', db, schema, kind: t.kind === 'view' ? 'views' : 'tables', object: t.fqn, tab: 'Definition' }) },
    { sep: true },
  ];
  if (t.kind === 'table') {
    items.push(
      { label: 'Load data', icon: 'upload', action: () => sf.dialog({ kind: 'load', table: t.fqn }) },
      { label: 'Unload data', icon: 'download', action: () => sf.dialog({ kind: 'unload', table: t.fqn }) },
      { label: 'Clone', icon: 'clone', action: () => sf.dialog({ kind: 'prompt', title: 'Clone table', subtitle: t.fqn, okText: 'Clone',
        message: 'A clone is zero-copy: it shares the source\'s micro-partitions until either table changes.',
        fields: [{ key: 'name', label: 'New table name', value: name + '_CLONE' }],
        build: v => (v.name.trim() ? `CREATE TABLE ${ident(db)}.${ident(schema)}.${ident(v.name.trim())} CLONE ${q}` : ''), success: 'Table cloned' }) },
    );
  }
  items.push(
    { label: 'Rename', icon: 'edit', action: () => sf.dialog({ kind: 'prompt', title: `Rename ${word.toLowerCase()}`, subtitle: t.fqn, okText: 'Rename',
      fields: [{ key: 'name', label: 'New name', value: name }],
      build: v => (v.name.trim() && up(v.name.trim()) !== up(name) ? `ALTER ${word} ${q} RENAME TO ${ident(db)}.${ident(schema)}.${ident(v.name.trim())}` : ''),
      success: `${word === 'VIEW' ? 'View' : 'Table'} renamed` }) },
    { label: 'Grant privileges', icon: 'key', action: () => sf.dialog({ kind: 'grant', onKind: word, onName: t.fqn }) },
    { sep: true },
  );
  if (t.kind === 'table') {
    items.push({ label: 'Truncate', icon: 'stop', danger: true, action: async () => {
      const ok = await sf.confirm({ title: `Truncate ${name}?`, message: `Every row of ${t.fqn} will be deleted. The previous rows stay reachable with Time Travel for the retention period.`, yes: 'Truncate', danger: true });
      if (ok) await sf.sql(`TRUNCATE TABLE ${q}`, { success: `${name} truncated` });
    } });
  }
  items.push({ label: 'Drop', icon: 'trash', danger: true, action: async () => {
    const note = t.kind === 'table' ? ' UNDROP TABLE restores it within its retention period.' : '';
    const ok = await sf.confirm({ title: `Drop ${word.toLowerCase()} ${name}?`, message: `${t.fqn} will be dropped.${note}`, yes: 'Drop', danger: true });
    if (ok) await sf.sql(`DROP ${word} ${q}`, { success: `${name} dropped` });
  } });
  return items;
}

const DROP_WORD: Record<string, string> = { stage: 'STAGE', pipe: 'PIPE', stream: 'STREAM', task: 'TASK', 'file-format': 'FILE FORMAT' };
const KIND_PAGE: Record<string, string> = { stage: 'stages', pipe: 'pipes', stream: 'streams', task: 'tasks', 'file-format': 'file-formats', policy: 'policies' };

function otherMenu(sf: SfContext, t: { kind: string; fqn: string }, hooks: MenuHooks): SfMenuItem[] {
  const q = fqnSql(t.fqn);
  const name = leaf(t.fqn);
  const [db, schema] = splitFqn(t.fqn);
  const items: SfMenuItem[] = [
    ...placeOrOpen(sf, hooks, t.kind === 'stage' ? '@' + q : q, name),
    { label: 'View details', icon: 'external', action: () => sf.go({ page: 'databases', db, schema, kind: KIND_PAGE[t.kind], object: t.fqn }) },
  ];
  if (t.kind === 'stage') {
    items.push({ sep: true },
      { label: 'List files', icon: 'refresh', action: () => (hooks.preview ? hooks.preview(`LIST @${q}`) : sf.openWorksheet(`LIST @${q};\n`, `Files on ${name}`)) },
      { label: 'Load into table', icon: 'upload', action: () => sf.dialog({ kind: 'load', stage: t.fqn }) },
      { label: 'Query staged files', icon: 'worksheet', action: () => sf.openWorksheet(`-- Query files on the stage without loading them\nSELECT $1, $2, $3, METADATA$FILENAME\nFROM @${q}\n  (FILE_FORMAT => 'RAW.SHOP.CSV_FMT')\nLIMIT 20;\n`, `Query ${name}`) });
  }
  if (t.kind === 'task') {
    const task = list.tasks(sf.view.value).find(x => up(x.fqn) === up(t.fqn));
    const started = up(task?.state) === 'STARTED';
    items.push({ sep: true },
      { label: started ? 'Suspend' : 'Resume', icon: started ? 'pause' : 'play', action: () => void sf.sql(`ALTER TASK ${q} ${started ? 'SUSPEND' : 'RESUME'}`, { success: `Task ${started ? 'suspended' : 'resumed'}` }) },
      { label: 'Execute', icon: 'power', action: () => void sf.sql(`EXECUTE TASK ${q}`, { success: 'Task run started' }) });
  }
  if (t.kind === 'pipe') items.push({ sep: true }, { label: 'Refresh pipe', icon: 'refresh', action: () => void sf.sql(`ALTER PIPE ${q} REFRESH`, { success: 'Pipe refreshed' }) });
  if (DROP_WORD[t.kind]) {
    items.push({ sep: true }, { label: 'Drop', icon: 'trash', danger: true, action: async () => {
      const ok = await sf.confirm({ title: `Drop ${DROP_WORD[t.kind].toLowerCase()} ${name}?`, message: `${t.fqn} will be dropped. This cannot be undone.`, yes: 'Drop', danger: true });
      if (ok) await sf.sql(`DROP ${DROP_WORD[t.kind]} ${q}`, { success: `${name} dropped` });
    } });
  }
  return items;
}

function warehouseMenu(sf: SfContext, t: { name: string; state?: string }): SfMenuItem[] {
  const w = ident(t.name);
  const started = up(t.state) === 'STARTED';
  const sizes: [string, string][] = [['XSMALL', 'X-Small'], ['SMALL', 'Small'], ['MEDIUM', 'Medium'], ['LARGE', 'Large'], ['XLARGE', 'X-Large']];
  return [
    { label: 'Use in worksheets', icon: 'warehouse', action: () => void sf.useWarehouse(t.name) },
    started ? { label: 'Suspend', icon: 'pause', action: () => void sf.sql(`ALTER WAREHOUSE ${w} SUSPEND`, { success: `Warehouse ${t.name} suspended` }) }
      : { label: 'Resume', icon: 'play', action: () => void sf.sql(`ALTER WAREHOUSE ${w} RESUME`, { success: `Warehouse ${t.name} resumed` }) },
    { label: 'Resize', icon: 'sort', action: () => sf.dialog({ kind: 'prompt', title: 'Resize warehouse', subtitle: t.name, okText: 'Resize',
      message: 'A running warehouse finishes its current queries on the old size; new queries use the new size.',
      fields: [{ key: 'size', label: 'Size', value: String(list.warehouses(sf.view.value).find(x => up(x.name) === up(t.name))?.size || 'XSMALL').toUpperCase().replace('-', ''), options: sizes }],
      build: v => `ALTER WAREHOUSE ${w} SET WAREHOUSE_SIZE = ${str(v.size)}`, success: 'Warehouse resized' }) },
    { label: 'Rename', icon: 'edit', action: () => sf.dialog({ kind: 'prompt', title: 'Rename warehouse', subtitle: t.name, okText: 'Rename',
      fields: [{ key: 'name', label: 'New name', value: t.name }],
      build: v => (v.name.trim() && up(v.name.trim()) !== up(t.name) ? `ALTER WAREHOUSE ${w} RENAME TO ${ident(v.name.trim())}` : ''), success: 'Warehouse renamed' }) },
    { label: 'Grant privileges', icon: 'key', action: () => sf.dialog({ kind: 'grant', onKind: 'WAREHOUSE', onName: t.name }) },
    { sep: true },
    { label: 'Drop', icon: 'trash', danger: true, action: async () => {
      const ok = await sf.confirm({ title: `Drop warehouse ${t.name}?`, message: 'Queries can no longer run on it. This cannot be undone.', yes: 'Drop Warehouse', danger: true, typeToConfirm: t.name });
      if (ok) await sf.sql(`DROP WAREHOUSE ${w}`, { success: `Warehouse ${t.name} dropped` });
    } },
  ];
}
