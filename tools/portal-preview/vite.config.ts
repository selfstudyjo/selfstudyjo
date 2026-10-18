// The PORTAL preview: one portal, mounted for real, against a REAL local app 11.
//
//   (in selfstudyuserlab)  python _portal_server.py --port 5311
//   npx vite --config tools/portal-preview/vite.config.ts --port 3330
//   open http://127.0.0.1:3330/?skin=aws&lab=aws-02-vpc&api=http://127.0.0.1:5311
//   node tools/portal-preview/shoot.mjs "<that url>" out.png [width] [height] [steps.json]
//
// WHY NOT tools/labs-preview. That harness stubs app 11 out, which is right
// for the workbench and useless for a portal: the one property a portal must
// have is that every command it sends is a command the engine ACCEPTS, and a
// stub that answers 200 to everything proves nothing about that. Here the
// engines are the real ones and the state is real JSON on disk.
import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import path from 'path';

const root = path.resolve(__dirname, '../..');

export default defineConfig({
  root: __dirname,
  base: './',
  plugins: [vue()],
  resolve: { alias: [{ find: '@', replacement: path.resolve(root, 'src') }] },
  build: { outDir: path.resolve(__dirname, 'dist'), emptyOutDir: true },
  server: { host: '127.0.0.1' },
});
