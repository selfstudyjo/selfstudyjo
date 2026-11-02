// A browser preview of the Roadmap Provider with app 27 stubbed at the HTTP
// layer. See stubs/api.ts.
//
//   npm run preview:roadmap            (dev server on 3314)
//   npm run shoot:roadmap              (build, serve, drive, photograph)
//
// `/roadmaps` is `requiresAuth: true` and needs a deployed app 27, so this is
// the only way to LOOK at it: the view, its components, roadmapLayout.ts, the
// real roadmap.service.ts, the theme system and three.js are all the real ones.
//
//   ?path=/roadmaps/rm-ai   the route to open (default /roadmaps)
//   ?theme=<id> ?lang=ar    galaxy and language
//   ?state=unavailable|unconfigured  ?empty=1  ?signedout=1
import { defineConfig, type Plugin } from 'vite';
import vue from '@vitejs/plugin-vue';
import path from 'path';

const root = path.resolve(__dirname, '../..');
const stub = (f: string) => path.resolve(__dirname, 'stubs', f);

/*
  roadmap.service.ts imports `./api` and `./config` RELATIVELY, which an alias
  cannot catch (an alias matches the specifier, and `./api` is not `@/...`).
  This redirects exactly those two imports from exactly that file - every
  other importer of the real api/config is left alone and the preview reaches
  no network, because nothing else on this page calls a service.
*/
function stubTransport(): Plugin {
    return {
        name: 'roadmap-preview-stubs',
        enforce: 'pre',
        resolveId(source, importer) {
            if (!importer || !importer.replace(/\\/g, '/').endsWith('/services/roadmap.service.ts')) return null;
            if (source === './api') return stub('api.ts');
            if (source === './config') return stub('config.ts');
            return null;
        },
    };
}

export default defineConfig({
    root: __dirname,
    base: './',
    plugins: [stubTransport(), vue()],
    resolve: {
        alias: [
            { find: '@/store/auth', replacement: stub('auth.ts') },
            { find: '@', replacement: path.resolve(root, 'src') },
        ],
    },
    build: { outDir: path.resolve(__dirname, 'dist'), emptyOutDir: true },
    server: { port: 3314, host: true },
});
