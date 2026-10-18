/**
 * The actions more than one page performs, each one an `mgr` command line.
 *
 * Board, backlog and the issue view all move cards, commit work, assign and
 * delete - so the command and its success message are built once, here, and
 * the three of them cannot drift into three spellings of the same thing.
 */
import { computed, inject } from 'vue';
import { cli } from '@/utils/portalKit';
import { currentSprint, issues, JIRA, people, sprintName, STATUS_LABEL, type Issue } from './jiraKit';

export function useJira() {
    const ctx = inject(JIRA);
    if (!ctx) throw new Error('useJira() outside the Jira skin');

    const all = computed(() => issues(ctx.view.value));
    const team = computed(() => people(ctx.view.value));
    const sprint = computed(() => currentSprint(ctx.view.value));

    function personName(id: string): string {
        return team.value.find(person => person.id === id)?.name
            || people(ctx!.view.value, true).find(person => person.id === id)?.name || '';
    }

    async function move(issue: Issue, to: 'todo' | 'doing' | 'done') {
        if (issue.status === to) return true;
        const result = await ctx!.exec(cli(['mgr', 'backlog', 'move', issue.id], { '--to': to }), {
            success: `${issue.id} moved to ${STATUS_LABEL[to]}`,
            failure: `We couldn't move ${issue.id} to ${STATUS_LABEL[to]}`,
        });
        return result.ok;
    }

    async function addToSprint(keys: string[]) {
        const list = [...sprint.value.committed];
        for (const key of keys) if (!list.includes(key)) list.push(key);
        const result = await ctx!.exec(cli(['mgr', 'sprint', 'commit'], { '--items': list.join(',') }), {
            success: keys.length === 1 ? `${keys[0]} moved to ${sprintName(sprint.value.n)}`
                : `${keys.length} issues moved to ${sprintName(sprint.value.n)}`,
        });
        return result.ok;
    }

    async function moveToBacklog(keys: string[]) {
        const result = await ctx!.exec(cli(['mgr', 'sprint', 'drop'], { '--items': keys.join(',') }), {
            success: keys.length === 1 ? `${keys[0]} moved to Backlog` : `${keys.length} issues moved to Backlog`,
        });
        return result.ok;
    }

    async function assign(issue: Issue, personId: string) {
        if (!personId) {
            return (await ctx!.exec(cli(['mgr', 'unassign', issue.id]), {
                success: `${issue.id} is now unassigned`,
            })).ok;
        }
        const result = await ctx!.exec(cli(['mgr', 'assign', issue.id], { '--to': personId }), {
            success: '',
        });
        if (result.ok) {
            // `mgr assign` explains the skill cost; that IS the lesson, so it is shown.
            const lines = String(result.output || '').split('\n').map(line => line.trim()).filter(Boolean);
            ctx!.flag('success', `${issue.id} assigned to ${personName(personId)}`, lines.slice(1).join(' '));
        }
        return result.ok;
    }

    async function deleteIssue(issue: Issue) {
        const yes = await ctx!.confirm({
            title: `Delete ${issue.id}?`,
            body: 'You\'re about to permanently delete this issue, its comments and all of its data.\n\n'
                + 'If you\'re not sure, you can resolve or close this issue instead.',
            confirm: 'Delete',
            danger: true,
        });
        if (!yes) return false;
        const result = await ctx!.exec(cli(['mgr', 'backlog', 'remove', issue.id]), {
            success: `${issue.id} has been deleted`,
        });
        return result.ok;
    }

    async function startSprint(goal = '') {
        const s = sprint.value;
        const yes = await ctx!.confirm({
            title: `Start ${sprintName(s.n)}`,
            body: `${s.committed.length} issues will be included in this sprint: `
                + `${s.committedPoints} story points against ${s.capacity} points of effective capacity.\n\n`
                + 'Starting the sprint records the commitment. It does not move the clock: the work is '
                + 'delivered when you complete the sprint (mgr advance).',
            confirm: 'Start',
        });
        if (!yes) return false;
        const result = await ctx!.exec(cli(['mgr', 'sprint', 'start'], { '--goal': goal }), {
            success: `${sprintName(s.n)} has started`,
        });
        return result.ok;
    }

    async function completeSprint() {
        const s = sprint.value;
        const open = all.value.filter(issue => s.committed.includes(issue.id) && issue.status !== 'done');
        const yes = await ctx!.confirm({
            title: `Complete ${sprintName(s.n)}`,
            body: `This sprint contains ${s.committed.length} issues (${s.committedPoints} points) `
                + `against ${s.capacity} points of capacity.\n\n`
                + 'Completing it runs the simulation forward one sprint (mgr advance). The team delivers '
                + 'what its capacity and skills allow, open issues carry over, and everything done or '
                + 'not done this sprint takes effect: morale, burnout, one-to-ones, stakeholder confidence, '
                + 'risks and incidents. This cannot be undone.'
                + (open.length ? `\n\n${open.length} issue(s) are not Done yet — delivery decides which finish.` : ''),
            confirm: 'Complete sprint',
            warning: true,
        });
        if (!yes) return false;
        const result = await ctx!.exec(cli(['mgr', 'advance']), { success: '' });
        if (result.ok) ctx!.showOutput(`${sprintName(s.n)} report`, String(result.output || ''));
        return result.ok;
    }

    return { ctx, all, team, sprint, personName, move, addToSprint, moveToBacklog, assign,
             deleteIssue, startSprint, completeSprint };
}
