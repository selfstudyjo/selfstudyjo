// The registry, answered with the local app 11 (`?api=`, default :5311).
const api = (new URLSearchParams(location.search).get('api') || 'http://127.0.0.1:5311')
    .replace(/\/$/, '');

export const serviceRegistry = {
    getRandomLabReplica: async () => api,
    getLabReplicas: async () => [api],
    getRandomAiReplica: async () => api,
    getRandomReplica: async () => api,
};
