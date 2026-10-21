/**
 * pgAdmin's background processes: Backup, Restore, Import/Export Data and
 * Maintenance each run as a job, show a "started" notification, and land in
 * the Processes tab with the command line and its output. This lab runs the
 * same command synchronously and records it the same way.
 */
import { errorText, type PortalResult } from '../../../../utils/portalKit';
import type { PgContext } from './pgContext';

export interface Job {
  /** "Backup Object", "Restore Object", "Import - Export Data", ... */
  type: string;
  object: string;
  /** The command line (or statement) that ran. */
  command: string;
}

export function stamp(): string {
  return new Date().toISOString().replace('T', ' ').slice(0, 19);
}

/** Run one job's command and record it; resolves with the result. */
export async function runJob(ctx: PgContext, job: Job, run: () => Promise<PortalResult>): Promise<PortalResult> {
  ctx.notify('info', `${job.type} - ${job.object}`, 'Process started.');
  const started = performance.now();
  const result = await run();
  const ms = Math.round(performance.now() - started);
  const output = String(result.output || '').trim();
  ctx.processes.value = [{
    id: Date.now(), type: job.type, server: `${ctx.model.value.server} (shop-db.shopflow.internal:5432)`, object: job.object,
    sql: job.command, ok: Boolean(result.ok), at: stamp(), ms,
    detail: result.ok ? (output || 'Process completed with exit code 0.') : errorText(result),
  }, ...ctx.processes.value].slice(0, 30);
  if (result.ok) ctx.notify('success', `${job.type} - ${job.object}`, 'Successfully completed.');
  else ctx.notify('error', `${job.type} - ${job.object}`, 'Failed (exit code: 1). Open the Processes tab for details.');
  return result;
}
