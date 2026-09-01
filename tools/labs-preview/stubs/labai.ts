// Stands in for `@/services/lab-ai.service`. The tutor is not what this preview
// is for, and a real call would reach app 27 with a published token.
export const labAiService = {
    ask: (_lab: unknown, _messages: unknown, _context: string) =>
        new Promise(resolve => setTimeout(() => resolve({
            ok: true,
            text: 'This is a stubbed tutor reply.\n\n```bash\ndocker ps -a\n```',
        }), 300)),
};
