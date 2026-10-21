/**
 * What a right-click on a task instance (a Grid square, a Graph node) or on a
 * DAG run (a Grid bar) offers. The same actions as the task-instance and run
 * panels - Clear, Mark state, Run, Delete - each a confirmation listing what it
 * will touch, then ONE `airflow ...` line, so the CLI drawer shows exactly what
 * a student would have typed.
 */
import { CMD, normState, relatives, stateLabel, taskRegex, type AfDag, type AfRun, type TiTarget } from './airflow';
import type { AfContext, CtxItem } from './afContext';

function tisFor(af: AfContext, dag: AfDag, run: AfRun, taskIds: string[], onlyFailed = false) {
    const ids = new Set(taskIds);
    return af.tisOf(dag.dag_id, run.run_id).filter(t => ids.has(t.task_id)
        && (!onlyFailed || ['failed', 'upstream_failed'].includes(normState(t.state))));
}

export async function clearTask(af: AfContext, dag: AfDag, run: AfRun, taskId: string,
                                opts: { downstream?: boolean; upstream?: boolean; onlyFailed?: boolean } = {}) {
    const ids = [taskId];
    if (opts.downstream) ids.push(...relatives(dag.tasks, taskId, 'downstream'));
    if (opts.upstream) ids.push(...relatives(dag.tasks, taskId, 'upstream'));
    const list = tisFor(af, dag, run, ids, opts.onlyFailed);
    const yes = await af.confirm({
        title: 'Clear task instances',
        message: `Here's the list of task instances you are about to clear (${list.length}):`,
        lines: list.map(t => `${t.task_id} - ${t.run_id} [${stateLabel(t.state)}]`),
        yes: 'Confirm',
    });
    if (!yes) return;
    await af.run(CMD.clear(dag.dag_id, {
        taskRegex: taskRegex(taskId), start: run.logical_date, end: run.logical_date,
        downstream: opts.downstream, upstream: opts.upstream, onlyFailed: opts.onlyFailed,
    }), { success: `${list.length} task instance${list.length === 1 ? '' : 's'} cleared` });
}

export async function markTask(af: AfContext, dag: AfDag, run: AfRun, taskId: string, target: TiTarget,
                               opts: { downstream?: boolean; upstream?: boolean } = {}) {
    const ids = [taskId];
    if (opts.downstream) ids.push(...relatives(dag.tasks, taskId, 'downstream'));
    if (opts.upstream) ids.push(...relatives(dag.tasks, taskId, 'upstream'));
    const list = tisFor(af, dag, run, ids).filter(t => normState(t.state) !== target);
    const label = target === 'up_for_retry' ? 'up for retry' : target;
    const yes = await af.confirm({
        title: `Mark task instances as ${label}`,
        message: list.length
            ? `Here's the list of task instances you are about to mark as ${label} (${list.length}):`
            : `${taskId} has no task instance in this run that is not already ${label}.`,
        lines: list.map(t => `${t.task_id} - ${t.run_id} [${stateLabel(t.state)}]`),
        yes: 'Confirm',
        danger: target === 'failed',
    });
    if (!yes) return;
    await af.run(CMD.markTask(dag.dag_id, taskId, run.run_id, target, opts),
        { success: `Marked ${taskId}${opts.downstream ? ' and downstream' : ''} as ${label}` });
}

export async function runTask(af: AfContext, dag: AfDag, run: AfRun, taskId: string) {
    await af.run(CMD.runTask(dag.dag_id, taskId, run.run_id, { ignoreTaskState: true }),
        { success: `Sent ${taskId} to the message queue, it should start any moment now.` });
}

export async function deleteRun(af: AfContext, dag: AfDag, run: AfRun): Promise<boolean> {
    const yes = await af.confirm({
        title: 'Delete DAG run',
        message: `Are you sure you want to delete the DAG run ${run.run_id}?\n\nIts task instances, logs and XComs are deleted with it. This cannot be undone.`,
        yes: 'Delete',
        danger: true,
    });
    if (!yes) return false;
    const result = await af.run(CMD.deleteRun(dag.dag_id, run.run_id), { success: `Deleted DAG run ${run.run_id}` });
    return result.ok;
}

export async function clearRun(af: AfContext, dag: AfDag, run: AfRun, onlyFailed = false) {
    const list = af.tisOf(dag.dag_id, run.run_id)
        .filter(t => !onlyFailed || ['failed', 'upstream_failed'].includes(normState(t.state)));
    const yes = await af.confirm({
        title: onlyFailed ? 'Clear only failed tasks' : 'Clear existing tasks',
        message: `Here's the list of task instances you are about to clear (${list.length}):`,
        lines: list.map(t => `${t.task_id} [${stateLabel(t.state)}]`),
        yes: 'Confirm',
    });
    if (!yes) return;
    await af.run(CMD.clear(dag.dag_id, { start: run.logical_date, end: run.logical_date, onlyFailed }),
        { success: `${list.length} task instance${list.length === 1 ? '' : 's'} cleared` });
}

export async function markRun(af: AfContext, dag: AfDag, run: AfRun, state: 'success' | 'failed' | 'queued') {
    const yes = await af.confirm({
        title: `Mark DAG run as ${state}`,
        message: `Are you sure you want to mark ${run.run_id} as ${state}?`
            + (state === 'success' ? '\n\nEvery unfinished task instance is marked success.' : state === 'failed'
                ? '\n\nRunning tasks are marked failed and the rest skipped.' : '\n\nThe scheduler picks the run up again.'),
        yes: 'Confirm',
        danger: state === 'failed',
    });
    if (!yes) return;
    await af.run(CMD.markRun(dag.dag_id, run.run_id, state), { success: `Marked DAG run ${run.run_id} as ${state}` });
}

/** The right-click menu of one task instance. `open` navigates to a tab of the DAG page. */
export function tiMenu(af: AfContext, dag: AfDag, run: AfRun | undefined, taskId: string): CtxItem[] {
    const go = (tab: 'details' | 'logs' | 'xcom' | 'rendered') =>
        af.go({ page: 'dag', dagId: dag.dag_id, tab, runId: run?.run_id, taskId });
    if (!run) {
        return [
            { label: 'No run selected - trigger the DAG first', disabled: true },
            { divider: true, label: '' },
            { label: 'Task details', action: () => go('details') },
        ];
    }
    const ti = af.tisOf(dag.dag_id, run.run_id).find(t => t.task_id === taskId);
    const st = normState(ti?.state);
    return [
        { header: true, label: `Run ${run.run_id}` },
        { label: 'Clear', hint: 'tasks clear', action: () => clearTask(af, dag, run, taskId) },
        { label: 'Clear with downstream', hint: '--downstream', action: () => clearTask(af, dag, run, taskId, { downstream: true }) },
        { label: 'Clear with upstream', hint: '--upstream', action: () => clearTask(af, dag, run, taskId, { upstream: true }) },
        { divider: true, label: '' },
        { label: 'Mark Success', disabled: st === 'success', action: () => markTask(af, dag, run, taskId, 'success') },
        { label: 'Mark Success with downstream', action: () => markTask(af, dag, run, taskId, 'success', { downstream: true }) },
        { label: 'Mark Failed', danger: true, disabled: st === 'failed', action: () => markTask(af, dag, run, taskId, 'failed') },
        { label: 'Mark Failed with downstream', danger: true, action: () => markTask(af, dag, run, taskId, 'failed', { downstream: true }) },
        { label: 'Mark Skipped', disabled: st === 'skipped', action: () => markTask(af, dag, run, taskId, 'skipped') },
        { label: 'Mark Up for retry', disabled: st === 'up_for_retry' || st === 'none', action: () => markTask(af, dag, run, taskId, 'up_for_retry') },
        { divider: true, label: '' },
        { label: 'Run (ignore task state)', hint: 'tasks run --force', action: () => runTask(af, dag, run, taskId) },
        { divider: true, label: '' },
        { label: 'Task details', action: () => go('details') },
        { label: 'Logs', disabled: !ti, action: () => go('logs') },
        { label: 'XCom', disabled: !ti, action: () => go('xcom') },
        { label: 'Rendered Template', action: () => go('rendered') },
    ];
}

/** The right-click menu of one DAG run (a Grid bar). */
export function runMenu(af: AfContext, dag: AfDag, run: AfRun): CtxItem[] {
    const st = normState(run.state);
    return [
        { label: 'Run details', action: () => af.go({ page: 'dag', dagId: dag.dag_id, tab: 'details', runId: run.run_id }) },
        { label: 'Graph', action: () => af.go({ page: 'dag', dagId: dag.dag_id, tab: 'graph', runId: run.run_id }) },
        { label: 'Gantt', action: () => af.go({ page: 'dag', dagId: dag.dag_id, tab: 'gantt', runId: run.run_id }) },
        { divider: true, label: '' },
        { label: 'Clear existing tasks', action: () => clearRun(af, dag, run) },
        { label: 'Clear only failed tasks', action: () => clearRun(af, dag, run, true) },
        { label: 'Queue up new tasks', disabled: st === 'running' || st === 'queued', action: () => markRun(af, dag, run, 'queued') },
        { divider: true, label: '' },
        { label: 'Mark Success', disabled: st === 'success', action: () => markRun(af, dag, run, 'success') },
        { label: 'Mark Failed', danger: true, disabled: st === 'failed', action: () => markRun(af, dag, run, 'failed') },
        { divider: true, label: '' },
        { label: 'Delete DAG run', danger: true, action: () => deleteRun(af, dag, run) },
    ];
}
