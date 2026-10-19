<template>
  <div class="pg-obj">
    <div v-if="!node" class="pg-obj__empty">Please select an object in the tree view.</div>

    <!-- ===================== Properties ===================== -->
    <template v-else-if="tab === 'properties'">
      <div class="pg-obj__bar">
        <template v-if="isCollection">
          <button type="button" class="pg-btn pg-btn--sm" :disabled="!checked.length || !canDrop" title="Delete" @click="dropChecked(false)">
            <PgIcon name="trash" :size="14" />Delete</button>
          <button type="button" class="pg-btn pg-btn--sm" :disabled="!checked.length || !canDrop" title="Delete (Cascade)" @click="dropChecked(true)">
            <PgIcon name="trash" :size="14" />Delete (Cascade)</button>
          <input v-model="filter" class="pg-input pg-obj__filter" placeholder="Search" aria-label="Search" />
        </template>
        <template v-else>
          <button type="button" class="pg-btn pg-btn--sm" :disabled="!editable" title="Edit object..." @click="edit">
            <PgIcon name="format" :size="14" />Edit object...</button>
        </template>
      </div>

      <div v-if="isCollection" class="pg-obj__scroll">
        <table class="pg-table">
          <thead>
            <tr>
              <th class="pg-obj__chk"><input type="checkbox" :checked="allChecked" :disabled="!canDrop || !collRows.length" aria-label="Select all" @change="toggleAll" /></th>
              <th v-for="c in collColumns" :key="c">{{ c }}</th>
            </tr>
          </thead>
          <tbody>
            <tr v-if="!collRows.length"><td :colspan="collColumns.length + 1" class="pg-muted">No rows found</td></tr>
            <tr v-for="row in collRows" :key="row.key" @dblclick="$emit('open-node', row.key)">
              <td class="pg-obj__chk"><input type="checkbox" :checked="checked.includes(row.key)" :disabled="!canDrop"
                                             :aria-label="'Select ' + row.cells[0]" @change="toggle(row.key)" /></td>
              <td v-for="(cell, i) in row.cells" :key="i" :class="{ 'is-num': typeof cell === 'number' }">{{ cell }}</td>
            </tr>
          </tbody>
        </table>
      </div>

      <div v-else class="pg-obj__scroll pg-props">
        <section v-for="sec in sections" :key="sec.title" class="pg-props__sec">
          <h4 class="pg-props__title">{{ sec.title }}</h4>
          <dl v-if="sec.pairs" class="pg-props__grid">
            <template v-for="p in sec.pairs" :key="p[0]">
              <dt>{{ p[0] }}</dt>
              <dd>
                <span v-if="p[1] === true" class="pg-yes">Yes</span>
                <span v-else-if="p[1] === false" class="pg-no">No</span>
                <span v-else>{{ p[1] }}</span>
              </dd>
            </template>
          </dl>
          <table v-if="sec.table" class="pg-table pg-props__table">
            <thead><tr><th v-for="h in sec.table.head" :key="h">{{ h }}</th></tr></thead>
            <tbody>
              <tr v-if="!sec.table.rows.length"><td :colspan="sec.table.head.length" class="pg-muted">No rows found</td></tr>
              <tr v-for="(r, i) in sec.table.rows" :key="i"><td v-for="(c, j) in r" :key="j">{{ c }}</td></tr>
            </tbody>
          </table>
        </section>
      </div>
    </template>

    <!-- ===================== SQL ===================== -->
    <template v-else-if="tab === 'sql'">
      <div class="pg-obj__bar">
        <button type="button" class="pg-btn pg-btn--sm" :disabled="!sqlText" @click="copy(sqlText)"><PgIcon name="copy" :size="14" />Copy</button>
        <button type="button" class="pg-btn pg-btn--sm" :disabled="!sqlText" @click="ctx.openQueryTool(sqlText)"><PgIcon name="query-tool" :size="14" />Open in Query Tool</button>
      </div>
      <PgCode :sql="sqlText || '-- No SQL could be generated for the selected object.'" fill />
    </template>

    <!-- ===================== Statistics ===================== -->
    <template v-else-if="tab === 'statistics'">
      <div class="pg-obj__scroll">
        <table v-if="statTable" class="pg-table">
          <thead><tr><th v-for="h in statTable.head" :key="h">{{ h }}</th></tr></thead>
          <tbody>
            <tr v-for="(r, i) in statTable.rows" :key="i"><td v-for="(c, j) in r" :key="j" :class="{ 'is-num': j > 0 && /^[\d.,]+( ?[kMG]?B)?$/.test(String(c)) }">{{ c }}</td></tr>
          </tbody>
        </table>
        <div v-else class="pg-obj__empty">No statistics are available for the selected object.</div>
      </div>
    </template>

    <!-- ===================== Dependencies / Dependents ===================== -->
    <template v-else>
      <div class="pg-obj__scroll">
        <table class="pg-table">
          <thead><tr><th>Type</th><th>Name</th><th>Restriction</th></tr></thead>
          <tbody>
            <tr v-if="!deps.length"><td colspan="3" class="pg-muted">No rows found</td></tr>
            <tr v-for="(d, i) in deps" :key="i"><td><PgIcon :name="d.icon" :size="14" /> {{ d.type }}</td><td>{{ d.name }}</td><td>{{ d.restriction }}</td></tr>
          </tbody>
        </table>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
/**
 * The object tabs of pgAdmin's main panel for the node selected in the tree:
 * Properties (with the collection list and its Delete / Delete (Cascade)),
 * SQL (the reverse-engineered DDL), Statistics, Dependencies and Dependents.
 */
import { computed, inject, ref, watch } from 'vue';
import PgIcon from './PgIcon.vue';
import PgCode from './PgCode.vue';
import { PG } from './pgContext';
import {
  columnDdl, fqn, indexDdl, oidOf, qi, roleDdl, splitIndexColumn, tableDdl, tableStatistics, viewDdl, type PgTable, type TreeNode,
} from './pg';

const props = defineProps<{ node: TreeNode | null; tab: 'properties' | 'sql' | 'statistics' | 'dependencies' | 'dependents' }>();
defineEmits<{ (event: 'open-node', id: string): void }>();
const ctx = inject(PG)!;
const model = ctx.model;

const filter = ref('');
const checked = ref<string[]>([]);
watch(() => props.node?.id, () => { checked.value = []; filter.value = ''; });

const table = computed<PgTable | undefined>(() => (props.node?.table ? ctx.table(props.node.table) : undefined));
const COLLECTIONS = new Set(['coll', 'tables', 'columns', 'constraints', 'indexes', 'views', 'sequences', 'roles',
  'tablespaces', 'schemas', 'databases', 'servers']);
const isCollection = computed(() => Boolean(props.node && COLLECTIONS.has(props.node.kind)));
const canDrop = computed(() => ['tables', 'columns', 'indexes', 'views', 'constraints'].includes(props.node?.kind || '')
  || props.node?.id === 'public/mviews');
const editable = computed(() => ['table', 'column'].includes(props.node?.kind || ''));

/* ---------- collection lists ---------- */

const collColumns = computed(() => {
  switch (props.node?.kind) {
    case 'tables': return ['Name', 'Owner', 'Rows (estimated)', 'Comment'];
    case 'columns': return ['Name', 'Data type', 'Not NULL?', 'Primary key?', 'Default'];
    case 'indexes': return ['Name', 'Columns', 'Access method', 'Unique?', 'Constraint'];
    case 'constraints': return ['Name', 'Type', 'Columns', 'References'];
    case 'roles': return ['Name', 'Can login?', 'Superuser?', 'Comment'];
    default: return ['Name', 'Owner', 'Comment'];
  }
});

interface CollRow { key: string; name: string; cells: (string | number)[] }
const collRows = computed<CollRow[]>(() => {
  const n = props.node;
  if (!n) return [];
  const kids = n.children || [];
  const t = table.value;
  const out: CollRow[] = kids.map(k => {
    if (n.kind === 'tables') {
      const tt = ctx.table(k.name || '');
      return { key: k.id, name: k.label, cells: [k.label, tt?.owner || 'postgres', tt?.rows ?? 0, tt?.comment || ''] };
    }
    if (n.kind === 'columns' && t) {
      const c = t.columns.find(col => col.name === k.name);
      return { key: k.id, name: k.label, cells: [k.label, c?.type || '', c && !c.nullable ? 'Yes' : 'No', c?.pk ? 'Yes' : 'No', c?.default || ''] };
    }
    if (n.kind === 'indexes') {
      const ix = model.value.indexes.find(i => i.table === n.table && i.name === k.name);
      return { key: k.id, name: k.label, cells: [k.label, (ix?.columns || []).join(', '), ix?.method || 'btree', ix?.unique ? 'Yes' : 'No', ix?.partial || ''] };
    }
    if (n.kind === 'constraints') {
      if (k.kind === 'pkey') {
        return { key: k.id, name: k.label, cells: [k.label, 'Primary Key', (t?.columns.filter(c => c.pk).map(c => c.name) || []).join(', '), ''] };
      }
      if (k.kind === 'ukey') {
        const u = t?.uniques.find(x => x.name === k.name);
        return { key: k.id, name: k.label, cells: [k.label, 'Unique', (u?.columns || []).join(', '), ''] };
      }
      if (k.kind === 'check') {
        const c = t?.checks.find(x => x.name === k.name);
        return { key: k.id, name: k.label, cells: [k.label, 'Check', '', c?.expr || ''] };
      }
      const fk = model.value.foreignKeys.find(f => f.name === k.name);
      return { key: k.id, name: k.label, cells: [k.label, 'Foreign Key', (fk?.columns || []).join(', '), fk ? `${fk.refTable} (${fk.refColumns.join(', ')})` : ''] };
    }
    if (n.kind === 'roles') {
      const r = model.value.roles.find(role => role.name === k.name);
      return { key: k.id, name: k.label, cells: [k.label, r?.login ? 'Yes' : 'No', r?.superuser ? 'Yes' : 'No', r?.builtin ? 'Predefined role' : ''] };
    }
    return { key: k.id, name: k.label, cells: [k.label, 'postgres', ''] };
  });
  const needle = filter.value.trim().toLowerCase();
  return out.filter(r => !needle || r.cells.some(c => String(c).toLowerCase().includes(needle)));
});

const allChecked = computed(() => collRows.value.length > 0 && collRows.value.every(r => checked.value.includes(r.key)));
function toggle(key: string) {
  checked.value = checked.value.includes(key) ? checked.value.filter(k => k !== key) : [...checked.value, key];
}
function toggleAll() {
  checked.value = allChecked.value ? [] : collRows.value.map(r => r.key);
}

function dropChecked(cascade: boolean) {
  const n = props.node;
  if (!n) return;
  const names = collRows.value.filter(r => checked.value.includes(r.key)).map(r => r.name);
  if (!names.length) return;
  const objType = n.kind === 'tables' ? 'TABLE' : n.kind === 'indexes' ? 'INDEX' : n.kind === 'columns' ? 'COLUMN'
    : n.kind === 'constraints' ? 'CONSTRAINT' : n.id === 'public/mviews' ? 'MATERIALIZED VIEW' : 'VIEW';
  ctx.openDialog({ kind: 'drop', objType, name: names[0] || '', names, table: n.table, cascade });
}

function edit() {
  const n = props.node;
  if (!n) return;
  if (n.kind === 'table' && n.table) ctx.openDialog({ kind: 'table-props', table: n.table });
  if (n.kind === 'column' && n.table && n.name) ctx.openDialog({ kind: 'column-props', table: n.table, column: n.name });
}

/* ---------- single-object properties ---------- */

interface Section { title: string; pairs?: [string, string | number | boolean][]; table?: { head: string[]; rows: (string | number)[][] } }
const sections = computed<Section[]>(() => {
  const n = props.node;
  const m = model.value;
  if (!n) return [];
  if (n.kind === 'server') {
    return [
      { title: 'General', pairs: [['Name', m.server], ['Server group', 'Servers'], ['Connected?', true], ['Comments', 'ShopFlow OLTP source']] },
      { title: 'Connection', pairs: [['Host name/address', 'shop-db.shopflow.internal'], ['Port', 5432], ['Maintenance database', 'postgres'],
        ['Username', 'postgres'], ['Role', ''], ['Service', '']] },
      { title: 'Server', pairs: [['Version', m.version], ['Server type', 'PostgreSQL'], ['In recovery?', false]] },
    ];
  }
  if (n.kind === 'database') {
    return [
      { title: 'General', pairs: [['Database', m.database], ['OID', 16384], ['Owner', 'postgres'], ['Comment', 'ShopFlow online retail OLTP']] },
      { title: 'Definition', pairs: [['Encoding', 'UTF8'], ['Template', 'template1'], ['Tablespace', 'pg_default'],
        ['Collation', 'en_US.UTF-8'], ['Character type', 'en_US.UTF-8'], ['Connection limit', -1], ['Template?', false], ['Allow connections?', true]] },
      { title: 'Replication', pairs: [['wal_level', m.cdc.walLevel], ['Current LSN', m.cdc.lsn],
        ['Replication slots', m.cdc.slots.map(s => `${s.name} (${s.plugin || 'pgoutput'})`).join(', ') || 'None']] },
    ];
  }
  if (n.kind === 'schema') {
    return [{ title: 'General', pairs: [['Name', 'public'], ['OID', 2200], ['Owner', 'pg_database_owner'], ['System schema?', false],
      ['Comment', 'standard public schema']] }];
  }
  if (n.kind === 'table' && table.value) {
    const t = table.value;
    const pk = t.columns.filter(c => c.pk).map(c => c.name);
    return [
      { title: 'General', pairs: [['Name', t.name], ['OID', oidOf(t.name)], ['Owner', t.owner], ['Schema', t.schema],
        ['Tablespace', 'pg_default'], ['Partitioned table?', false], ['Comment', t.comment]] },
      { title: 'Columns', table: { head: ['Name', 'Data type', 'Not NULL?', 'Primary key?', 'Default'],
        rows: t.columns.map(c => [c.name, c.type, c.nullable ? 'No' : 'Yes', c.pk ? 'Yes' : 'No', c.default || '']) } },
      { title: 'Constraints', table: { head: ['Name', 'Type', 'Columns', 'References'],
        rows: [...(pk.length ? [[`${t.name}_pkey`, 'Primary Key', pk.join(', '), '']] : []),
          ...m.foreignKeys.filter(f => f.table === t.name).map(f => [f.name, 'Foreign Key', f.columns.join(', '), `${f.refTable} (${f.refColumns.join(', ')})`])] } },
      { title: 'Advanced', pairs: [['Rows (estimated)', t.rows], ['Rows (counted)', t.rows], ['Of type', ''], ['Fill factor', ''],
        ['Unlogged?', false], ['RLS Policy?', false], ['System table?', false]] },
    ];
  }
  if (n.kind === 'column' && table.value) {
    const c = table.value.columns.find(col => col.name === n.name);
    if (!c) return [];
    return [
      { title: 'General', pairs: [['Name', c.name], ['Position', table.value.columns.indexOf(c) + 1], ['Comment', '']] },
      { title: 'Definition', pairs: [['Data type', c.type], ['Not NULL?', !c.nullable], ['Default', c.default || ''],
        ['Primary key?', c.pk], ['Collation', c.type === 'text' ? 'pg_catalog."default"' : ''], ['Identity', '']] },
    ];
  }
  if (n.kind === 'index') {
    const ix = m.indexes.find(i => i.table === n.table && i.name === n.name);
    if (!ix) return [];
    return [
      { title: 'General', pairs: [['Name', ix.name], ['OID', oidOf(ix.name)], ['Tablespace', 'pg_default'], ['Comment', '']] },
      { title: 'Definition', pairs: [['Access Method', ix.method], ['Unique?', ix.unique], ['Clustered?', false], ['Valid?', true],
        ['Primary?', ix.primary], ['Constraint', ix.partial], ['Include columns', ix.include.join(', ')]] },
      { title: 'Columns', table: { head: ['Column', 'Sort order', 'NULLs'], rows: ix.columns.map(col => {
        const k = splitIndexColumn(col);
        return [k.name, k.order, k.nulls];
      }) } },
    ];
  }
  if ((n.kind === 'ukey' || n.kind === 'check') && table.value) {
    const u = table.value.uniques.find(x => x.name === n.name);
    const c = table.value.checks.find(x => x.name === n.name);
    return [{ title: 'General', pairs: [['Name', n.label], ['OID', oidOf(n.label)], ['Type', n.kind === 'ukey' ? 'Unique' : 'Check'],
      [n.kind === 'ukey' ? 'Columns' : 'Check', n.kind === 'ukey' ? (u?.columns.join(', ') || '') : (c?.expr || '')],
      ['Deferrable?', false], ['Validated?', true]] }];
  }
  if (n.kind === 'pkey' || n.kind === 'fkey') {
    const fk = m.foreignKeys.find(f => f.name === n.name);
    const t = table.value;
    return [{ title: 'General', pairs: [['Name', n.label], ['OID', oidOf(n.label)], ['Type', n.kind === 'pkey' ? 'Primary Key' : 'Foreign Key'],
      ['Columns', n.kind === 'pkey' ? (t?.columns.filter(c => c.pk).map(c => c.name).join(', ') || '') : (fk?.columns.join(', ') || '')],
      ['References', fk ? `public.${fk.refTable} (${fk.refColumns.join(', ')})` : ''], ['Deferrable?', false], ['Validated?', true]] }];
  }
  if (n.kind === 'role') {
    const r = m.roles.find(role => role.name === n.name);
    if (!r) return [];
    return [
      { title: 'General', pairs: [['Name', r.name], ['OID', r.builtin ? 4200 + r.name.length : oidOf(r.name)], ['Comments', r.builtin ? 'Predefined role' : '']] },
      { title: 'Privileges', pairs: [['Can login?', r.login], ['Superuser?', r.superuser], ['Create roles?', r.superuser], ['Create databases?', r.superuser],
        ['Inherit rights from the parent roles?', true], ['Can initiate streaming replication and backups?', r.replication || r.superuser], ['Bypass RLS?', r.superuser]] },
    ];
  }
  if (n.kind === 'view') {
    const v = m.views.find(view => view.name === n.name);
    return [{ title: 'General', pairs: [['Name', n.label], ['Owner', v?.owner || 'postgres'], ['Schema', 'public'],
      ['Materialized?', Boolean(v?.materialized)], ['Definition', v?.definition || '']] },
    { title: 'Columns', table: { head: ['Name'], rows: (v?.columns || []).map(c => [c]) } }];
  }
  if (n.kind === 'tablespace') {
    return [{ title: 'General', pairs: [['Name', n.label], ['Owner', 'postgres'], ['Location', '']] }];
  }
  return [{ title: 'General', pairs: [['Name', n.label]] }];
});

/* ---------- SQL ---------- */

const sqlText = computed(() => {
  const n = props.node;
  const m = model.value;
  if (!n) return '';
  if (n.kind === 'table' && table.value) return tableDdl(m, table.value);
  if (n.kind === 'column' && table.value) {
    const c = table.value.columns.find(col => col.name === n.name);
    if (!c) return '';
    const t = fqn(table.value.schema, table.value.name);
    return `-- Column: ${table.value.schema}.${table.value.name}.${c.name}\n\n-- ALTER TABLE IF EXISTS ${t} DROP COLUMN IF EXISTS ${qi(c.name)};\n\n`
      + `ALTER TABLE IF EXISTS ${t}\n    ADD COLUMN ${columnDdl(c)};\n`;
  }
  if (n.kind === 'index') {
    const ix = m.indexes.find(i => i.table === n.table && i.name === n.name);
    return ix ? indexDdl(ix) : '';
  }
  if (n.kind === 'pkey' && table.value) {
    const pk = table.value.columns.filter(c => c.pk).map(c => qi(c.name)).join(', ');
    return `-- Constraint: ${n.label}\n\n-- ALTER TABLE IF EXISTS ${fqn('public', table.value.name)} DROP CONSTRAINT IF EXISTS ${qi(n.label)};\n\n`
      + `ALTER TABLE IF EXISTS ${fqn('public', table.value.name)}\n    ADD CONSTRAINT ${qi(n.label)} PRIMARY KEY (${pk});\n`;
  }
  if ((n.kind === 'ukey' || n.kind === 'check') && table.value) {
    const t = fqn('public', table.value.name);
    const u = table.value.uniques.find(x => x.name === n.name);
    const c = table.value.checks.find(x => x.name === n.name);
    const body = n.kind === 'ukey' ? `UNIQUE (${(u?.columns || []).map(qi).join(', ')})` : `CHECK (${c?.expr || ''})`;
    return `-- Constraint: ${n.label}\n\n-- ALTER TABLE IF EXISTS ${t} DROP CONSTRAINT IF EXISTS ${qi(n.label)};\n\n`
      + `ALTER TABLE IF EXISTS ${t}\n    ADD CONSTRAINT ${qi(n.label)} ${body};\n`;
  }
  if (n.kind === 'fkey') {
    const fk = m.foreignKeys.find(f => f.name === n.name);
    if (!fk) return '';
    return `-- Constraint: ${fk.name}\n\n-- ALTER TABLE IF EXISTS ${fqn('public', fk.table)} DROP CONSTRAINT IF EXISTS ${qi(fk.name)};\n\n`
      + `ALTER TABLE IF EXISTS ${fqn('public', fk.table)}\n    ADD CONSTRAINT ${qi(fk.name)} FOREIGN KEY (${fk.columns.map(qi).join(', ')})\n`
      + `    REFERENCES ${fqn('public', fk.refTable)} (${fk.refColumns.map(qi).join(', ')}) MATCH SIMPLE\n    ON UPDATE NO ACTION\n    ON DELETE NO ACTION;\n`;
  }
  if (n.kind === 'view') {
    const v = m.views.find(view => view.name === n.name);
    return v ? viewDdl(v) : '';
  }
  if (n.kind === 'role') {
    const r = m.roles.find(role => role.name === n.name);
    return r ? roleDdl(r) : '';
  }
  if (n.kind === 'schema') {
    return '-- SCHEMA: public\n\n-- DROP SCHEMA IF EXISTS public ;\n\nCREATE SCHEMA IF NOT EXISTS public\n    AUTHORIZATION pg_database_owner;\n\n'
      + "COMMENT ON SCHEMA public\n    IS 'standard public schema';\n\nGRANT USAGE ON SCHEMA public TO PUBLIC;\n\nGRANT ALL ON SCHEMA public TO pg_database_owner;\n";
  }
  if (n.kind === 'database') {
    return `-- Database: ${m.database}\n\n-- DROP DATABASE IF EXISTS ${qi(m.database)};\n\nCREATE DATABASE ${qi(m.database)}\n    WITH\n    OWNER = postgres\n`
      + "    ENCODING = 'UTF8'\n    LC_COLLATE = 'en_US.UTF-8'\n    LC_CTYPE = 'en_US.UTF-8'\n    LOCALE_PROVIDER = 'libc'\n"
      + '    TABLESPACE = pg_default\n    CONNECTION LIMIT = -1\n    IS_TEMPLATE = False;\n';
  }
  if (n.kind === 'tablespace') {
    return `-- Tablespace: ${n.label}\n\n-- DROP TABLESPACE IF EXISTS ${n.label};\n\nALTER TABLESPACE ${n.label}\n  OWNER TO postgres;\n`;
  }
  if (n.kind === 'extension') return '-- Extension: plpgsql\n\n-- DROP EXTENSION plpgsql;\n\nCREATE EXTENSION IF NOT EXISTS plpgsql\n    SCHEMA pg_catalog\n    VERSION "1.0";\n';
  return '';
});

async function copy(text: string) {
  try {
    await navigator.clipboard.writeText(text);
    ctx.notify('success', 'SQL copied to the clipboard.');
  } catch { /* ignored */ }
}

/* ---------- Statistics ---------- */

const statTable = computed<{ head: string[]; rows: (string | number)[][] } | null>(() => {
  const n = props.node;
  const m = model.value;
  if (!n) return null;
  if (n.kind === 'table' && table.value) {
    return { head: ['Statistics', 'Value'], rows: tableStatistics(m, table.value).map(s => [s.label, s.value]) };
  }
  if (n.kind === 'tables') {
    return {
      head: ['Table name', 'Tuples inserted', 'Tuples updated', 'Tuples deleted', 'Live tuples', 'Sequential scans', 'Index scans', 'Total size'],
      rows: m.tables.map(t => {
        const s: Record<string, string> = Object.fromEntries(tableStatistics(m, t).map(x => [x.label, x.value]));
        const v = (k: string) => s[k] ?? '';
        return [t.name, v('Tuples inserted'), v('Tuples updated'), v('Tuples deleted'), v('Live tuples'), v('Sequential scans'), v('Index scans'), v('Total size')];
      }),
    };
  }
  if (n.kind === 'index') {
    const ix = m.indexes.find(i => i.table === n.table && i.name === n.name);
    if (!ix) return null;
    const uses = ix.scans ?? m.queries.filter(q => /index/i.test(q.planKind) && new RegExp(`\\b${ix.table}\\b`, 'i').test(q.sql)).length;
    const t = ctx.table(ix.table);
    return { head: ['Statistics', 'Value'], rows: [['Index scans', uses], ['Index tuples read', uses * 4], ['Index tuples fetched', uses * 3],
      ['Index blocks read', Math.ceil((t?.rows || 0) / 400) + 1], ['Index blocks hit', uses * 12], ['Index size', `${Math.max(16, Math.round((t?.rows || 0) * 0.022))} kB`]] };
  }
  if (n.kind === 'database' || n.kind === 'server' || n.kind === 'databases') {
    const total = m.tables.reduce((s, t) => s + (t.sizeKb || Math.round(t.rows * 0.12) + 8), 0);
    const commits = 5120 + m.queries.length * 3 + m.cdc.lsn;
    const row = [m.database, 6, commits, Math.floor(m.queries.length / 9), 2048 + m.queries.length * 31, 98000 + m.queries.length * 911,
      m.tables.reduce((s, t) => s + t.rows, 0), `${(total / 1024).toFixed(0)} MB`];
    return { head: ['Database', 'Backends', 'Xact committed', 'Xact rolled back', 'Blocks read', 'Blocks hit', 'Tuples returned', 'Size'], rows: [row] };
  }
  if (n.kind === 'column' && table.value) {
    const analyzed = m.analyzed.includes(table.value.name);
    if (!analyzed) return null;
    const c = table.value.columns.find(col => col.name === n.name);
    return { head: ['Statistics', 'Value'], rows: [['Null fraction', c?.pk ? '0' : '0.0102'], ['Average width', c?.type === 'integer' ? 4 : 11],
      ['Distinct values', c?.pk ? '-1' : '-0.42'], ['Correlation', c?.pk ? '1' : '0.0137']] };
  }
  return null;
});

/* ---------- Dependencies / Dependents ---------- */

const deps = computed(() => {
  const n = props.node;
  const m = model.value;
  const out: { type: string; name: string; restriction: string; icon: string }[] = [];
  if (!n) return out;
  const dependents = props.tab === 'dependents';
  if (n.kind === 'table' && table.value) {
    const t = table.value;
    if (!dependents) {
      out.push({ type: 'Schema', name: 'public', restriction: 'normal', icon: 'schema' });
      for (const fk of m.foreignKeys.filter(f => f.table === t.name && f.refTable !== t.name)) {
        out.push({ type: 'Table', name: `public.${fk.refTable}`, restriction: 'normal', icon: 'table' });
      }
    } else {
      if (t.columns.some(c => c.pk)) out.push({ type: 'Index', name: `public.${t.name}_pkey`, restriction: 'internal', icon: 'index' });
      for (const ix of m.indexes.filter(i => i.table === t.name)) out.push({ type: 'Index', name: `public.${ix.name}`, restriction: 'auto', icon: 'index' });
      for (const fk of m.foreignKeys.filter(f => f.refTable === t.name)) {
        out.push({ type: 'Foreign Key', name: `${fk.table}.${fk.name}`, restriction: 'normal', icon: 'fkey' });
      }
      for (const v of m.views.filter(view => new RegExp(`\\b${t.name}\\b`, 'i').test(view.definition))) {
        out.push({ type: v.materialized ? 'Materialized View' : 'View', name: `public.${v.name}`, restriction: 'normal', icon: 'view' });
      }
      out.push({ type: 'Type', name: `public.${t.name}`, restriction: 'internal', icon: 'folder' });
    }
  } else if (n.kind === 'index') {
    if (!dependents) out.push({ type: 'Table', name: `public.${n.table}`, restriction: 'auto', icon: 'table' });
  } else if (n.kind === 'column' && table.value) {
    if (!dependents) out.push({ type: 'Table', name: `public.${table.value.name}`, restriction: 'internal', icon: 'table' });
    else {
      for (const ix of m.indexes.filter(i => i.table === n.table && i.columns.some(c => splitIndexColumn(c).name === n.name))) {
        out.push({ type: 'Index', name: `public.${ix.name}`, restriction: 'auto', icon: 'index' });
      }
      for (const fk of m.foreignKeys.filter(f => (f.table === n.table && f.columns.includes(n.name || '')) || (f.refTable === n.table && f.refColumns.includes(n.name || '')))) {
        out.push({ type: 'Foreign Key', name: fk.name, restriction: 'normal', icon: 'fkey' });
      }
    }
  } else if (n.kind === 'fkey' && !dependents) {
    const fk = m.foreignKeys.find(f => f.name === n.name);
    if (fk) out.push({ type: 'Table', name: `public.${fk.refTable}`, restriction: 'normal', icon: 'table' });
  } else if (n.kind === 'schema' && dependents) {
    for (const t of m.tables) out.push({ type: 'Table', name: `public.${t.name}`, restriction: 'normal', icon: 'table' });
  } else if (n.kind === 'role' && dependents && n.name === 'postgres') {
    out.push({ type: 'Database', name: m.database, restriction: 'Owner', icon: 'database' });
    for (const t of m.tables) out.push({ type: 'Table', name: `public.${t.name}`, restriction: 'Owner', icon: 'table' });
  }
  return out;
});
</script>

<style scoped src="./pg.css"></style>
<style scoped>
.pg-obj { flex: 1; min-height: 0; display: flex; flex-direction: column; }
.pg-obj__empty { padding: 24px; color: var(--pg-muted); text-align: center; }
.pg-obj__bar { flex: none; display: flex; align-items: center; gap: 6px; padding: 6px 8px; border-bottom: 1px solid var(--pg-border); background: var(--pg-grey-200); flex-wrap: wrap; }
.pg-obj__filter { margin-left: auto; width: 200px; height: 24px; }
.pg-obj__scroll { flex: 1; min-height: 0; overflow: auto; }
.pg-obj__chk { width: 28px; }
.pg-props { padding: 10px 14px 20px; display: flex; flex-direction: column; gap: 14px; }
.pg-props__sec { flex: none; border: 1px solid var(--pg-border); border-radius: var(--pg-radius); overflow: hidden; }
.pg-props__title { margin: 0; padding: 6px 10px; font-size: 13px; font-weight: 600; background: var(--pg-grey-200); border-bottom: 1px solid var(--pg-border); }
.pg-props__grid { margin: 0; display: grid; grid-template-columns: minmax(140px, 32%) minmax(0, 1fr); }
.pg-props__grid dt, .pg-props__grid dd { margin: 0; padding: 6px 10px; border-bottom: 1px solid var(--pg-border); font-size: 13px; }
.pg-props__grid dt { color: var(--pg-muted); }
.pg-props__grid dd { overflow-wrap: anywhere; white-space: pre-wrap; }
.pg-props__table th { position: static; }
.pg-yes { color: #1b5e20; font-weight: 600; }
.pg-no { color: var(--pg-muted); }
</style>
