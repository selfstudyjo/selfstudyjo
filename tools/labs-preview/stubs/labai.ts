// Stands in for `@/services/lab-ai.service`. A real call would reach app 27
// with a published token. The reply is shaped the way `tutorPrompt` asks the
// model to answer, so the preview shows the step cards, the code cards and
// their Copy buttons, inline code and a tip - the whole of what the pane draws.
const REPLY = [
    'Your `web` container is on the default bridge, so the name `db` does not resolve. Put both on one user-defined network.',
    '',
    '## Steps',
    '',
    '1. Create a network for the two containers.',
    '',
    '```bash',
    'docker network create appnet',
    '```',
    '',
    '2. Connect **both** containers to it.',
    '',
    '```bash',
    'docker network connect appnet web',
    'docker network connect appnet db',
    '```',
    '',
    '3. Check the name now resolves from `web`.',
    '',
    '## Why',
    '',
    'The default bridge has no embedded DNS; a user-defined network does, so containers find each other by name.',
    '',
    '> Run `docker network inspect appnet` to see both containers listed.',
].join('\n');

export const labAiService = {
    ask: (_question: unknown, _lab: unknown, _context: string) =>
        new Promise(resolve => setTimeout(() => resolve({ ok: true, text: REPLY }), 300)),
    review: (_lab: unknown, _context: string) =>
        new Promise(resolve => setTimeout(() => resolve({ ok: true, text: REPLY }), 300)),
};
