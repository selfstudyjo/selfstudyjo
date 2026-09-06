// A static server for the built preview, so a shooter can start its own.
//
// WHY THIS EXISTS
//
// `shoot.mjs` defaulted to `http://127.0.0.1:8791/index.html` and started
// nothing, so running it without a server already up reported **NO PROBE for
// every width in every galaxy** — which is the exact string it prints when the
// page fails to MOUNT. Those two need opposite reactions and were
// indistinguishable, which is the same class of failure as `EMPTY PAGE`
// counting as clean: a harness that cannot tell "nothing is serving this" from
// "the page threw" is a harness whose report has to be interpreted before it
// can be believed.
//
// `PREVIEW_URL` still wins, so a dev server on 3311 can be shot instead.
import { createServer } from 'node:http';
import { existsSync, readFileSync } from 'node:fs';
import { extname, join, resolve } from 'node:path';

const TYPES = {
    '.html': 'text/html; charset=utf-8',
    '.js': 'text/javascript; charset=utf-8',
    '.mjs': 'text/javascript; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.svg': 'image/svg+xml',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.webp': 'image/webp',
    '.woff2': 'font/woff2',
    '.woff': 'font/woff',
    '.mp3': 'audio/mpeg',
};

/**
 * Serve `dir` on `port`. Answers `{ close }`, or null when the port is already
 * in use — which is not an error: it means something is already serving, and
 * taking over would be worse than joining.
 */
export function serveDist(dir, port) {
    const root = resolve(dir);
    if (!existsSync(join(root, 'index.html'))) {
        throw new Error(`${root} has no index.html — run the preview build first`);
    }
    const server = createServer((request, response) => {
        const path = decodeURIComponent(String(request.url).split('?')[0]);
        const file = join(root, path === '/' ? 'index.html' : path);
        // Containment: a path that climbs out of the root is refused rather
        // than served. The same rule `utils/sims/shell.py` enforces
        // structurally, and this one is a local harness rather than a service —
        // but a static server that answers `../../.env` is a static server
        // somebody will point at a real directory one day.
        if (!file.startsWith(root) || !existsSync(file)) {
            response.writeHead(404);
            response.end('not found');
            return;
        }
        response.writeHead(200, {
            'Content-Type': TYPES[extname(file)] || 'application/octet-stream',
        });
        response.end(readFileSync(file));
    });
    return new Promise(resolve_ => {
        server.on('error', () => resolve_(null));
        server.listen(port, '127.0.0.1', () => resolve_({
            close: () => new Promise(done => server.close(done)),
        }));
    });
}
