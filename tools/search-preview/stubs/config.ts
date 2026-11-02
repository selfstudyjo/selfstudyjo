/**
 * The service registry, answering one fake replica for every app, so nothing in
 * the preview can reach the real registry or a real replica.
 */
const BASE = 'https://stub.invalid';

const registry: Record<string, unknown> = {
    async getServiceReplicas() { return [BASE]; },
    async getReplicaOrder() { return [BASE]; },
    getRandomReplica() { return BASE; },
    dropReplica() { /* nothing to drop */ },
};

/** Every `getRandomXReplica()` the services call. */
export const serviceRegistry = new Proxy(registry, {
    get(target, name: string) {
        if (name in target) return target[name];
        if (/^getRandom\w*Replica$/.test(name)) return async () => BASE;
        return undefined;
    },
}) as any;
