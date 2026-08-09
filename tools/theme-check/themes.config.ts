// Bundles just the theme table for tools/theme-check/audit-contrast.mjs, so the
// audit resolves stylesheets against exactly the values the app ships rather
// than against a second copy of them.
import { defineConfig } from 'vite';

export default defineConfig({
  build: {
    lib: { entry: 'tools/theme-check/themes-entry.ts', formats: ['es'], fileName: () => 'check-themes.mjs' },
    outDir: 'tools/theme-check/dist',
    emptyOutDir: false,
    minify: false,
    target: 'node20',
    rollupOptions: { external: [/^node:/] },
  },
});
