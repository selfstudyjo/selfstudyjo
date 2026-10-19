/**
 * The DAG-level actions both the DAGs list and the DAG page offer: pause /
 * unpause, trigger, delete. One implementation, so the two screens send the
 * same command and say the same thing about it.
 */
import { CMD, type AfDag } from './airflow';
import type { AfContext } from './afContext';

export async function togglePause(af: AfContext, dag: AfDag) {
    const pausing = !dag.paused;
    return af.run(CMD.pause(dag.dag_id, pausing), {
        success: pausing ? `DAG ${dag.dag_id} is paused` : `DAG ${dag.dag_id} is unpaused`,
    });
}

export async function triggerNow(af: AfContext, dagId: string, opts: { conf?: string; logicalDate?: string; runId?: string } = {}) {
    const result = await af.run(CMD.trigger(dagId, opts), { success: `Triggered ${dagId}, it should start any moment now.` });
    if (!result.ok && /DagRunAlreadyExists/.test(String(result.error || ''))) {
        af.notify('info', 'The simulated clock has not moved since that run',
            'A manual run takes the current time as its logical date. Advance the clock (the clock menu, top right) or use "Trigger DAG w/ config" with another logical date.');
    }
    const dag = af.dag(dagId);
    if (result.ok && dag?.paused) {
        af.notify('warning', `DAG ${dagId} is paused`,
            'The run is queued but will not start until the DAG is unpaused (toggle it on).');
    }
    return result;
}

export async function deleteDag(af: AfContext, dagId: string): Promise<boolean> {
    const yes = await af.confirm({
        title: 'Delete DAG',
        message: `Are you sure you want to delete '${dagId}' now?\n\nThis option will delete ALL metadata, DAG runs, etc.\nEXCEPT Log.\nThis cannot be undone.`,
        yes: 'Delete',
        danger: true,
    });
    if (!yes) return false;
    const result = await af.run(CMD.deleteDag(dagId), {
        success: `Deleting DAG with id ${dagId}. May take a couple minutes to fully disappear.`,
    });
    if (result.ok) {
        af.notify('info', 'The DAG file is still in dags/',
            'Airflow re-creates a deleted DAG the next time the file is parsed - delete or rename the file to remove it for good.');
    }
    return result.ok;
}
