// Stands in for `@/services/lab.service` — the workspace page only reaches it
// for the Python tool's Stop button.
export const labService = {
    killProcess: (_u: string) => Promise.resolve({ output: 'No process running.', error: '' }),
};
