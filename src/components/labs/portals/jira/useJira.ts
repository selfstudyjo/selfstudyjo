/**
 * The actions more than one page performs, each one an `mgr` command line.
 *
 * Board, backlog and the issue view all move cards, commit work, assign and
 * delete - so the command and its success message are built once, here, and
 * the three of them cannot drift into three spellings of the same thing.
 */
import { computed, inject } from 'vue';
import { cli } from '@/utils/portalKit';
import { currentSprint, issues, issueUrl, JIRA, people, sprintName, STATUS_LABEL, type DropMenuItem,
         type Issue } from './jiraKit';

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

    async function setFlag(issue: Issue, on: boolean, reason = '') {
        const result = on
            ? await ctx!.exec(cli(['mgr', 'backlog', 'flag', issue.id], { '--reason': reason }),
                              { success: `Flag added to ${issue.id}` })
            : await ctx!.exec(cli(['mgr', 'backlog', 'unflag', issue.id]),
                              { success: `Flag removed from ${issue.id}` });
        return result.ok;
    }

    async function labels(issue: Issue, add: string[], remove: string[]) {
        if (!add.length && !remove.length) return true;
        const result = await ctx!.exec(cli(['mgr', 'backlog', 'label', issue.id], {
            '--add': add.join(','), '--remove': remove.join(','),
        }), { success: `Labels updated on ${issue.id}` });
        return result.ok;
    }

    async function linkIssue(issue: Issue, other: string, type: string) {
        const result = await ctx!.exec(cli(['mgr', 'backlog', 'link', issue.id], { '--to': other, '--type': type }),
                                       { success: `${issue.id} linked to ${other}` });
        return result.ok;
    }

    async function unlinkIssue(issue: Issue, other: string) {
        const yes = await ctx!.confirm({
            title: 'Remove link?',
            body: `You're about to remove the link between ${issue.id} and ${other}. You can add it again later.`,
            confirm: 'Remove', danger: true,
        });
        if (!yes) return false;
        return (await ctx!.exec(cli(['mgr', 'backlog', 'unlink', issue.id], { '--from': other }),
                                { success: `Link to ${other} removed` })).ok;
    }

    async function rank(issue: Issue, where: { before?: string; after?: string; top?: boolean; bottom?: boolean }) {
        const result = await ctx!.exec(cli(['mgr', 'backlog', 'rank', issue.id], {
            '--before': where.before || '', '--after': where.after || '',
            '--top': Boolean(where.top), '--bottom': Boolean(where.bottom),
        }), { success: `${issue.id} ranked` });
        return result.ok;
    }

    async function watch(issue: Issue, on: boolean) {
        return (await ctx!.exec(cli(['mgr', 'backlog', on ? 'watch' : 'unwatch', issue.id]),
                                { success: on ? `You're watching ${issue.id}` : `You stopped watching ${issue.id}` })).ok;
    }

    async function copy(text: string, what: string) {
        try {
            await navigator.clipboard.writeText(text);
            ctx!.flag('success', `${what} copied to clipboard`);
        } catch {
            ctx!.flag('info', `Copy ${what.toLowerCase()}`, text);
        }
    }

    /** The card / row action menu, the same on the board, the backlog and the issue list. */
    function issueMenu(issue: Issue): DropMenuItem[] {
        const s = sprint.value;
        const order = ['todo', 'doing', 'done'] as const;
        const items: DropMenuItem[] = order.filter(id => id !== issue.status).map((id, index) => ({
            label: STATUS_LABEL[id], value: 'move:' + id, section: index === 0 ? 'Move work item' : undefined,
            disabled: issue.status === 'done' || (id === 'doing' && !issue.in_sprint)
                || (id === 'done' && issue.done_points + 0.01 < issue.points),
            hint: issue.status === 'done' ? 'Done is not reopened'
                : id === 'doing' ? `Commit it to ${sprintName(s.n)} first`
                : id === 'done' ? `Done follows delivery: ${issue.done_points} of ${issue.points} pts delivered` : '',
        }));
        items.push(issue.in_sprint
            ? { label: 'Move to Backlog', value: 'backlog', section: 'Sprint' }
            : { label: `Move to ${sprintName(s.n)}`, value: 'sprint', section: 'Sprint',
                disabled: issue.status === 'done', hint: 'Done work is not planned again' });
        items.push({ label: 'Rank to top', value: 'rank:top', section: 'Rank' },
                   { label: 'Rank to bottom', value: 'rank:bottom' });
        items.push({ label: 'Unassigned', value: 'assign:', section: 'Assignee', disabled: !issue.assignee_id },
                   ...team.value.map(person => ({ label: person.name, value: 'assign:' + person.id,
                                                   disabled: person.id === issue.assignee_id })));
        items.push(
            { label: issue.flagged ? 'Remove flag' : 'Add flag', value: issue.flagged ? 'unflag' : 'flag', section: 'Actions' },
            { label: 'Add label', value: 'labels' },
            { label: 'Link work item', value: 'link' },
            { label: 'Copy link', value: 'copy-link' },
            { label: 'Copy key', value: 'copy-key' },
            { label: 'Open issue', value: 'open' },
            { label: 'Delete', value: 'delete', danger: true },
        );
        return items;
    }

    async function onIssueMenu(issue: Issue, value: string) {
        if (value.startsWith('move:')) await move(issue, value.slice(5) as 'todo' | 'doing' | 'done');
        else if (value.startsWith('assign:')) await assign(issue, value.slice(7));
        else if (value === 'rank:top') await rank(issue, { top: true });
        else if (value === 'rank:bottom') await rank(issue, { bottom: true });
        else if (value === 'sprint') await addToSprint([issue.id]);
        else if (value === 'backlog') await moveToBacklog([issue.id]);
        else if (value === 'flag') ctx!.openDialog('flag', issue.id);
        else if (value === 'unflag') await setFlag(issue, false);
        else if (value === 'labels') ctx!.openDialog('labels', issue.id);
        else if (value === 'link') ctx!.openDialog('link', issue.id);
        else if (value === 'copy-link') await copy(issueUrl(issue.id), 'Link');
        else if (value === 'copy-key') await copy(issue.id, 'Key');
        else if (value === 'open') ctx!.openIssue(issue.id);
        else if (value === 'delete') await deleteIssue(issue);
    }

    /** Right-click on a card or a row opens the same menu at the pointer. */
    function contextMenu(event: MouseEvent, issue: Issue) {
        ctx!.openMenu(event, issueMenu(issue), value => { void onIssueMenu(issue, value); });
    }

    return { ctx, all, team, sprint, personName, move, addToSprint, moveToBacklog, assign,
             deleteIssue, startSprint, completeSprint, setFlag, labels, linkIssue, unlinkIssue,
             rank, watch, copy, issueMenu, onIssueMenu, contextMenu };

}
