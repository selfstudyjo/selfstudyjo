/**
 * Loading the GUI recipe maps. The Vite half of `labDocs.ts` (which stays plain
 * so a check can drive it in node): each portal's map is its own chunk, fetched
 * the first time a task window asks for that product - a student who never
 * presses the GUI tab downloads none of them.
 */
import type { WalkthroughMap } from '@/utils/labDocs';
import workspace from './workspace.json';

const LOADERS = import.meta.glob<{ default: WalkthroughMap }>('./maps/*.json');
const CACHE = new Map<string, Promise<WalkthroughMap | null>>();

export const workspaceMap = workspace as WalkthroughMap;

export function loadMap(skin: string): Promise<WalkthroughMap | null> {
    if (!CACHE.has(skin)) {
        const loader = LOADERS[`./maps/${skin}.json`];
        // A failed chunk is cached as null: retrying a 404 once per task window
        // for the life of the page buys nothing.
        CACHE.set(skin, loader ? loader().then(mod => mod.default).catch(() => null) : Promise.resolve(null));
    }
    return CACHE.get(skin)!;
}

export async function loadMaps(skins: string[]): Promise<Record<string, WalkthroughMap>> {
    const out: Record<string, WalkthroughMap> = {};
    await Promise.all(skins.map(async skin => {
        const map = await loadMap(skin);
        if (map) out[skin] = map;
    }));
    return out;
}
