// Builds tools/practice-check/check.ts into something node can run, so the
// practice ledger can be verified without a browser — and so it can read app
// 20's own catalogue off disk and prove the two agree (working rule 20).
// Same shape as tools/leaderboard-check.
//
//   npm run check:practice
import { defineConfig } from 'vite';
import { fileURLToPath, URL } from 'node:url';

export default defineConfig({
  resolve: {
    // `@` is needed here and not in every check config, because
    // `practiceIntegrity.ts` imports `Params` from `@/i18n` — the placeholder
    // shape the strike messages are typed against. Without the alias the build
    // fails to resolve it, which reads as a missing module rather than as a
    // missing alias.
    alias: { '@': fileURLToPath(new URL('../../src', import.meta.url)) },
  },
  build: {
    lib: { entry: 'tools/practice-check/check.ts', formats: ['es'], fileName: () => 'check.mjs' },
    outDir: 'tools/practice-check/dist',
    emptyOutDir: true,
    minify: false,
    target: 'node20',
    rollupOptions: { external: [/^node:/] },
  },
});
