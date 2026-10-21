/**
 * What every pgAdmin component shares, handed down with provide/inject.
 *
 * The root (`PgAdmin.vue`) owns the model, the selection, the open Query Tool
 * tabs and the dialogs; children read the model and ASK the root to run SQL,
 * open a tool or show a dialog, so there is exactly one path from a button to
 * `api.exec` and one place that knows how pgAdmin reports an outcome.
 */
import type { ComputedRef, InjectionKey, Ref } from 'vue';
import type { PortalResult } from '../../../../utils/portalKit';
import type { PgModel, PgTable, TreeNode } from './pg';

export interface RunSqlOptions {
  /** The notification on success; '' for none. */
  success?: string;
  /** The caller draws the error itself (a dialog's footer bar). */
  quiet?: boolean;
  /** Not worth a line in the equivalent-CLI strip. */
  unlogged?: boolean;
}

export interface QueryTab {
  id: number;
  kind: 'query' | 'data';
  title: string;
  /** For a View/Edit Data tab: which table, and how many rows. */
  table?: string;
  schema?: string;
  limit?: 'all' | 'first' | 'last';
  /** What to put in the editor when it opens. */
  sql: string;
  /** Run it as soon as it opens (View/Edit Data does). */
  autorun?: boolean;
  /** Open with the Sort/Filter row showing (View/Edit Data > Filtered Rows...). */
  filter?: boolean;
}

export type DialogRequest =
  | { kind: 'create-table' }
  | { kind: 'table-props'; table: string }
  | { kind: 'create-index'; table?: string }
  | { kind: 'create-column'; table: string }
  | { kind: 'column-props'; table: string; column: string }
  | { kind: 'create-view'; materialized?: boolean }
  | { kind: 'maintenance'; target: 'table' | 'index' | 'database'; name: string; table?: string }
  | { kind: 'drop'; objType: 'TABLE' | 'INDEX' | 'VIEW' | 'MATERIALIZED VIEW' | 'SEQUENCE' | 'COLUMN' | 'CONSTRAINT';
      name: string; names?: string[]; table?: string; cascade: boolean }
  | { kind: 'truncate'; table: string; mode: 'plain' | 'cascade' | 'restart' }
  | { kind: 'import-export'; table: string }
  | { kind: 'backup'; target: 'database' | 'schema' | 'table'; table?: string }
  | { kind: 'restore'; target: 'database' | 'schema' | 'table'; table?: string }
  | { kind: 'grant-wizard'; table?: string };

export interface MenuItem {
  label?: string;
  icon?: string;
  shortcut?: string;
  disabled?: boolean;
  sep?: boolean;
  action?: () => void;
  children?: MenuItem[];
}

export interface Process { id: number; type: string; server: string; object: string; sql: string; ok: boolean; at: string; ms: number; detail: string }

export interface PgContext {
  model: ComputedRef<PgModel>;
  busy: ComputedRef<boolean>;
  selected: Ref<TreeNode | null>;
  processes: Ref<Process[]>;
  runSql: (sql: string, options?: RunSqlOptions) => Promise<PortalResult>;
  /** A command line (pg_dump, pg_restore, psql) on the psql console's surface - built with cli(). */
  runCli: (line: string, options?: RunSqlOptions) => Promise<PortalResult>;
  openQueryTool: (sql?: string, autorun?: boolean) => void;
  openData: (table: string, limit: 'all' | 'first' | 'last', filter?: boolean) => void;
  openDialog: (request: DialogRequest) => void;
  table: (name: string) => PgTable | undefined;
  notify: (type: 'success' | 'error' | 'info' | 'warning', title: string, detail?: string) => void;
  refresh: () => void;
  location: (url: string) => void;
}

export const PG: InjectionKey<PgContext> = Symbol('pgadmin');
