/** The actions more than one page offers: build, delete a job, delete a build. */
import { buildCommand, jcli, TYPE_LABEL, type Job } from './jenkinsKit';
import type { JkContext } from './jkContext';

export function hasParameters(job: Job | undefined): boolean {
    if (!job) return false;
    return job.param_defs.length > 0 || job.builds.some(build => Object.keys(build.params || {}).length > 0);
}

export function deleteLabel(job: Job | undefined): string {
    if (!job) return 'Delete';
    if (job.type === 'folder') return 'Delete Folder';
    if (job.type === 'freestyle') return 'Delete Project';
    if (job.type === 'multibranch') return 'Delete Multibranch Pipeline';
    return 'Delete Pipeline';
}

export function useActions(ctx: JkContext) {
    async function buildNow(name: string, params: Record<string, string> = {}): Promise<boolean> {
        const job = ctx.job(name);
        if (job && hasParameters(job) && !Object.keys(params).length) {
            ctx.go({ page: 'buildParams', job: name });
            return false;
        }
        const result = await ctx.run(buildCommand(name, params), { success: 'Build scheduled' });
        return result.ok;
    }

    async function deleteJob(name: string): Promise<boolean> {
        const job = ctx.job(name);
        const kind = TYPE_LABEL[job?.type || 'pipeline'] || 'item';
        const ok = await ctx.confirm({
            title: `Delete the ${kind} ‘${name}’?`,
            message: 'This permanently removes the job and every build it has. It cannot be undone.',
            yes: 'Yes', destructive: true,
        });
        if (!ok) return false;
        const result = await ctx.run(jcli(['delete-job', name]), { success: `Deleted ‘${name}’` });
        if (result.ok) ctx.go({ page: 'dashboard' });
        return result.ok;
    }

    async function deleteBuild(name: string, number: number): Promise<boolean> {
        const ok = await ctx.confirm({
            title: `Delete build ‘#${number}’?`,
            message: `Build #${number} of ‘${name}’ and its console output will be deleted.`,
            yes: 'Yes', destructive: true,
        });
        if (!ok) return false;
        const result = await ctx.run(jcli(['delete-builds', name, String(number)]),
                                     { success: `Build #${number} deleted` });
        if (result.ok) ctx.go({ page: 'job', job: name });
        return result.ok;
    }

    async function setEnabled(name: string, enabled: boolean): Promise<boolean> {
        const result = await ctx.run(jcli([enabled ? 'enable-job' : 'disable-job', name]),
                                     { success: enabled ? `Enabled ‘${name}’` : `Disabled ‘${name}’` });
        return result.ok;
    }

    async function deleteView(name: string): Promise<boolean> {
        const ok = await ctx.confirm({
            title: `Delete the view ‘${name}’?`,
            message: 'The jobs in it are not deleted; they stay in All.',
            yes: 'Yes', destructive: true,
        });
        if (!ok) return false;
        const result = await ctx.run(jcli(['delete-view', name]), { success: `Deleted the view ‘${name}’` });
        if (result.ok) ctx.go({ page: 'dashboard' });
        return result.ok;
    }

    async function wipeWorkspace(name: string): Promise<boolean> {
        const ok = await ctx.confirm({
            title: 'Wipe Out Current Workspace',
            message: `Are you sure about wiping out the workspace of ‘${name}’? The next build checks everything out again.`,
            yes: 'Yes', destructive: true,
        });
        if (!ok) return false;
        const result = await ctx.run(jcli(['wipe-workspace', name]), { success: 'Workspace wiped out' });
        return result.ok;
    }

    return { buildNow, deleteJob, deleteBuild, setEnabled, deleteView, wipeWorkspace };
}
