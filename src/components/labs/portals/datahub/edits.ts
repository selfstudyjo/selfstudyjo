/**
 * The governance edits a dataset page offers, each one the `datahub` command it
 * stands for. Removals confirm the way DataHub does ("Do you want to remove
 * the PII tag?") before anything is sent.
 */
import { dh, type DhContext } from './dhContext';

export async function addTag(ctx: DhContext, urn: string, tag: string, column?: string) {
    return ctx.run(dh(['datahub', 'tag', 'add'], { '--urn': urn, '--tag': tag, '--column': column || null }),
                   { success: 'Added Tags!' });
}

export async function removeTag(ctx: DhContext, urn: string, tag: string, column?: string) {
    const ok = await ctx.confirm({
        title: `Do you want to remove ${tag} tag?`,
        message: `Are you sure you want to remove the ${tag} tag from ${column ? 'field ' + column : 'this dataset'}?`,
        yes: 'Yes',
    });
    if (!ok) return null;
    return ctx.run(dh(['datahub', 'tag', 'remove'], { '--urn': urn, '--tag': tag, '--column': column || null }),
                   { success: 'Removed Tag!' });
}

export async function addTerm(ctx: DhContext, urn: string, term: string, column?: string) {
    return ctx.run(dh(['datahub', 'term', 'add'], { '--urn': urn, '--term': term, '--column': column || null }),
                   { success: 'Added Terms!' });
}

export async function removeTerm(ctx: DhContext, urn: string, term: string, column?: string) {
    const ok = await ctx.confirm({
        title: `Do you want to remove ${term} term?`,
        message: `Are you sure you want to remove the ${term} term from ${column ? 'field ' + column : 'this dataset'}?`,
        yes: 'Yes',
    });
    if (!ok) return null;
    return ctx.run(dh(['datahub', 'term', 'remove'], { '--urn': urn, '--term': term, '--column': column || null }),
                   { success: 'Removed Term!' });
}

export async function addOwner(ctx: DhContext, urn: string, owner: string, type: string) {
    return ctx.run(dh(['datahub', 'owner', 'add'], { '--urn': urn, '--owner': owner, '--type': type }),
                   { success: 'Owners Added' });
}

export async function removeOwner(ctx: DhContext, urn: string, owner: string) {
    const ok = await ctx.confirm({
        title: `Do you want to remove ${owner}?`,
        message: `Are you sure you want to remove ${owner} as an owner of this dataset?`,
        yes: 'Yes',
    });
    if (!ok) return null;
    return ctx.run(dh(['datahub', 'owner', 'remove'], { '--urn': urn, '--owner': owner }),
                   { success: 'Owner Removed' });
}

export async function setDomain(ctx: DhContext, urn: string, domain: string) {
    return ctx.run(dh(['datahub', 'domain', 'set'], { '--urn': urn, '--domain': domain }),
                   { success: 'Domain Set' });
}

export async function setDocs(ctx: DhContext, urn: string, description: string, column?: string) {
    return ctx.run(dh(['datahub', 'docs', 'set'], { '--urn': urn, '--column': column || null },
                      { '--description': description }),
                   { success: 'Description Updated' });
}
