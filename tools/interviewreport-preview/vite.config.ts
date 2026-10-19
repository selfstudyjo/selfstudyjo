// The interview report rendered in a real browser -- see main.ts.
import { defineConfig } from 'vite';
import path from 'path';

export default defineConfig({
  root: __dirname,
  base: './',
  resolve: { alias: [{ find: '@', replacement: path.resolve(__dirname, '../../src') }] },
  build: { outDir: path.resolve(__dirname, 'dist'), emptyOutDir: true },
});
