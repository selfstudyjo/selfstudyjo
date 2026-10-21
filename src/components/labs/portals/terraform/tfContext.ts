/**
 * What every HCP Terraform page reads from the shell: the view, navigation,
 * running a command, notifications and the confirmation dialog.
 */
import { inject, type ComputedRef, type InjectionKey, type Ref } from 'vue';
import type { PortalResult } from '@/utils/portalKit';
import type { Route, TfRun, TfVariable, TfWorkspace } from './tfKit';

export interface RunOptions {
  success?: string;
  quiet?: boolean;
  failure?: string;
}

export interface ConfirmRequest {
  title: string;
  message: string;
  yes: string;
  /** When set, the user must type this text to enable the button. */
  typeToConfirm?: string;
  destructive?: boolean;
}

export interface TfShell {
  view: Ref<Record<string, any>>;
  org: ComputedRef<string>;
  route: Ref<Route>;
  now: Ref<number>;
  busy: ComputedRef<boolean>;
  workspaces: ComputedRef<TfWorkspace[]>;
  /** The workspace the route is on (may be null on org pages). */
  workspace: ComputedRef<TfWorkspace | null>;
  runs: ComputedRef<TfRun[]>;
  variables: ComputedRef<TfVariable[]>;
  go: (route: Route) => void;
  openWorkspace: (name: string, page?: Route['page']) => Promise<void>;
  run: (command: string, options?: RunOptions) => Promise<PortalResult>;
  ensureInit: () => Promise<boolean>;
  /** Confirms a fresh plan when the run's workspace has auto-apply on. */
  maybeAutoApply: (runId: string) => Promise<void>;
  notify: (type: 'success' | 'error' | 'info' | 'warning', title: string, detail?: string) => void;
  confirm: (request: ConfirmRequest) => Promise<boolean>;
}

export const TF: InjectionKey<TfShell> = Symbol('hcp-terraform');

export function useTf(): TfShell {
  const shell = inject(TF);
  if (!shell) throw new Error('HCP Terraform page rendered outside its shell');
  return shell;
}
