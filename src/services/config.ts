// src/services/config.ts
export interface ServiceConfig {
    name: string;
    appId: number;
    replicas: string[];
}

export interface AppReplica {
    replica_url: string;
    [key: string]: any;
}

export interface AppDetails {
    id: number;
    name: string;
    replicas: AppReplica[];
}

class ServiceRegistry {
    private AUTH_TOKEN = import.meta.env.VITE_AUTH_TOKEN || 'Token Not Found!';
    private registryDomains = [
        import.meta.env.VITE_API_BASE_REGISTRY,
        import.meta.env.VITE_REGISTRY_ALT,
    ].filter(Boolean);

    private cache = new Map<string, { data: string[]; timestamp: number }>();
    private CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

    private getHeaders() {
        const headers: Record<string, string> = {
            'Content-Type': 'application/json',
        };

        if (this.AUTH_TOKEN && this.AUTH_TOKEN !== 'Token Not Found!') {
            headers['Authorization'] = `Token ${this.AUTH_TOKEN}`;
        }

        return headers;
    }

    private ensureHttps(url: string): string {
        if (!url) return url;
        if (url.startsWith('https://')) return url;
        if (url.startsWith('http://')) {
            const httpsUrl = url.replace(/^http:/, 'https:');
            return httpsUrl;
        }
        return url;
    }

    async getServiceReplicas(appId: number, serviceName: string): Promise<string[]> {
        const cacheKey = `service_${appId}`;
        const cached = this.cache.get(cacheKey);

        if (cached && Date.now() - cached.timestamp < this.CACHE_DURATION) {
            return cached.data;
        }

        for (const registryDomain of this.registryDomains) {
            try {
                const secureRegistryDomain = this.ensureHttps(registryDomain);
                const url = `${secureRegistryDomain}/apps/${appId}/`;

                const controller = new AbortController();
                const timeoutId = setTimeout(() => controller.abort(), 10000);

                const response = await fetch(url, {
                    headers: this.getHeaders(),
                    mode: 'cors',
                    credentials: 'omit',
                    signal: controller.signal
                } as RequestInit);

                clearTimeout(timeoutId);

                if (response.ok) {
                    const data: AppDetails = await response.json();
                    const replicas = data.replicas
                        .map(replica => replica.replica_url?.trim().replace(/\/$/, '') || '')
                        .filter(url => url && url.startsWith('http'))
                        .map(url => this.ensureHttps(url));

                    this.cache.set(cacheKey, {
                        data: replicas,
                        timestamp: Date.now(),
                    });

                    return replicas;
                }
            } catch (error) {
                continue;
            }
        }

        return [];
    }

    /**
     * The replica this tab will use for a service, chosen once and then reused.
     *
     * It used to pick a fresh replica on every call. That was correct when each
     * replica of a service held different records — nothing better was possible —
     * and it became **wrong** on 2026-08-06, when the last of the backends moved
     * to the replicated store. Replication is push-then-repair, not synchronous:
     * a write reaches its peers a moment later. So picking again on the next call
     * gives you a coin flip on whether your own write is there yet, which reads
     * as "I saved it and it did not save".
     *
     * Sticky-per-tab fixes that without losing the load spreading: the *first*
     * choice is still random, so users are spread across replicas; it is only one
     * user's own subsequent calls that stay put, which is exactly the sequence
     * that has to be consistent. `chat.service.ts` has always done this
     * (`pinnedReplica`) and `lab.service.ts` does it with `home_replica`; this is
     * the same rule for everything else.
     *
     * `dropReplica` moves the pin when one stops answering — see
     * `withReplicas()` in api.ts, which is where failover belongs now that any
     * replica can answer for the whole service.
     */
    private pinned = new Map<number, string>();

    getRandomReplica(replicas: string[], appId?: number): string | null {
        if (!replicas || replicas.length === 0) return null;

        if (appId !== undefined) {
            const current = this.pinned.get(appId);
            // Only reuse a pin that is still in the registry's list: a retired
            // replica must not keep being chosen after the list has moved on.
            if (current && replicas.includes(current)) return current;
        }

        const chosen = replicas[Math.floor(Math.random() * replicas.length)];
        if (appId !== undefined) this.pinned.set(appId, chosen);
        return chosen;
    }

    /**
     * Stop using a replica for this service. The next call picks another.
     *
     * Called by `withReplicas()` after a transport failure or a 5xx — never
     * after a 404, which is the replica telling you the record does not exist.
     * Every replica holds the same records, so asking a different one would be a
     * slower way to get the same answer.
     */
    dropReplica(appId: number, replicaUrl: string) {
        if (this.pinned.get(appId) === replicaUrl) this.pinned.delete(appId);
    }

    /**
     * Every replica of a service, pinned one first.
     *
     * The order `withReplicas()` tries them in: the one this tab has been using,
     * then the rest, so a failover is a single extra round trip and the tab
     * settles on whichever replica is actually up.
     */
    async getReplicaOrder(appId: number, serviceName: string): Promise<string[]> {
        const replicas = await this.getServiceReplicas(appId, serviceName);
        const first = this.pinned.get(appId);
        if (!first || !replicas.includes(first)) return replicas;
        return [first, ...replicas.filter(url => url !== first)];
    }

    async getRandomAuthReplica(): Promise<string | null> {
        const appId = parseInt(import.meta.env.VITE_AUTH_APP_ID || '15');
        const replicas = await this.getServiceReplicas(appId, 'auth');
        return this.getRandomReplica(replicas, appId);
    }

    async getRandomUserProfileReplica(): Promise<string | null> {
        const appId = parseInt(import.meta.env.VITE_USERPROFILE_APP_ID || '13');
        const replicas = await this.getServiceReplicas(appId, 'userprofile');
        return this.getRandomReplica(replicas, appId);
    }

    async getRandomOtpReplica(): Promise<string | null> {
        const appId = parseInt(import.meta.env.VITE_OTP_APP_ID || '14');
        const replicas = await this.getServiceReplicas(appId, 'otp');
        return this.getRandomReplica(replicas, appId);
    }

    async getRandomCertificateReplica(): Promise<string | null> {
        const appId = parseInt(import.meta.env.VITE_CERTIFICATE_APP_ID || '24');
        const replicas = await this.getServiceReplicas(appId, 'certificate');
        return this.getRandomReplica(replicas, appId);
    }

    async getRandomCourseReplica(): Promise<string | null> {
        const appId = parseInt(import.meta.env.VITE_COURSE_APP_ID || '19');
        const replicas = await this.getServiceReplicas(appId, 'course');
        return this.getRandomReplica(replicas, appId);
    }

    async getRandomMediaReplica(): Promise<string | null> {
        const appId = parseInt(import.meta.env.VITE_MEDIA_APP_ID || '18');
        const replicas = await this.getServiceReplicas(appId, 'media');
        return this.getRandomReplica(replicas, appId);
    }

    async getRandomChatReplica(): Promise<string | null> {
        const appId = parseInt(import.meta.env.VITE_CHAT_APP_ID || '9');
        const replicas = await this.getServiceReplicas(appId, 'chat');
        return this.getRandomReplica(replicas, appId);
    }

    async getRandomNotificationReplica(): Promise<string | null> {
        const appId = parseInt(import.meta.env.VITE_NOTIFICATION_APP_ID || '16');
        const replicas = await this.getServiceReplicas(appId, 'notification');
        return this.getRandomReplica(replicas, appId);
    }

    async getRandomExamReplica(): Promise<string | null> {
        const appId = parseInt(import.meta.env.VITE_EXAM_APP_ID || '20');
        const replicas = await this.getServiceReplicas(appId, 'exam');
        return this.getRandomReplica(replicas, appId);
    }

    async getRandomProctorReplica(): Promise<string | null> {
        const appId = parseInt(import.meta.env.VITE_PROCTOR_APP_ID || '21');
        const replicas = await this.getServiceReplicas(appId, 'proctor');
        return this.getRandomReplica(replicas, appId);
    }

    async getRandomRunbookReplica(): Promise<string | null> {
        const appId = parseInt(import.meta.env.VITE_RUNBOOK_APP_ID || '17');
        const replicas = await this.getServiceReplicas(appId, 'runbook');
        return this.getRandomReplica(replicas, appId);
    }

    async getRandomSubscriptionReplica(): Promise<string | null> {
        const appId = parseInt(import.meta.env.VITE_SUBSCRIPTIONS_APP_ID || '22');
        const replicas = await this.getServiceReplicas(appId, 'subscription');
        return this.getRandomReplica(replicas, appId);
    }

    async getRandomPaymentReplica(): Promise<string | null> {
        const appId = parseInt(import.meta.env.VITE_PAYMENT_APP_ID || '23');
        const replicas = await this.getServiceReplicas(appId, 'payment');
        return this.getRandomReplica(replicas, appId);
    }

    async getRandomResearchFlowReplica(): Promise<string | null> {
        const appId = parseInt(import.meta.env.VITE_RESEARCH_FLOW_APP_ID || '28');
        const replicas = await this.getServiceReplicas(appId, 'researchflow');
        return this.getRandomReplica(replicas, appId);
    }

    async getRandomToastmastersReplica(): Promise<string | null> {
        const appId = parseInt(import.meta.env.VITE_TOASTMASTERS_APP_ID || '27');
        const replicas = await this.getServiceReplicas(appId, 'toastmasters');
        return this.getRandomReplica(replicas, appId);
    }

    /**
     * Self Study User Lab (app 11) — the SQL, Linux and Python sandboxes.
     *
     * This did not exist until 2026-08-06, because the lab was the one backend the
     * app did *not* resolve: each replica had its own student table, so a user was
     * pinned to one of them by a `lab_url` on their profile. App 11 replicates its
     * records now and pins each student to the replica holding their files itself,
     * so the lab is resolved here like everything else.
     */
    async getRandomLabReplica(): Promise<string | null> {
        const appId = parseInt(import.meta.env.VITE_LAB_APP_ID || '11');
        const replicas = await this.getServiceReplicas(appId, 'lab');
        return this.getRandomReplica(replicas, appId);
    }

    /**
     * Every lab replica, for the rare case where one has to be tried after
     * another — `labService` falls back through them when the one it picked is
     * unreachable, because a student's alternative is a Labs page that does nothing.
     */
    async getLabReplicas(): Promise<string[]> {
        return this.getServiceReplicas(
            parseInt(import.meta.env.VITE_LAB_APP_ID || '11'),
            'lab'
        );
    }

    async getRandomRobloxReplica(): Promise<string | null> {
        const appId = parseInt(import.meta.env.VITE_ROBLOX_APP_ID || '31');
        const replicas = await this.getServiceReplicas(appId, 'roblox');
        return this.getRandomReplica(replicas, appId);
    }

    /**
     * Self Study AI (app 27). Used by the Network Simulator's AI tutor and by
     * anything else that needs the OpenAI-compatible /v1/chat/completions API.
     */
    async getRandomAiReplica(): Promise<string | null> {
        const appId = parseInt(import.meta.env.VITE_AI_APP_ID || '27');
        const replicas = await this.getServiceReplicas(appId, 'ai');
        return this.getRandomReplica(replicas, appId);
    }

    /**
     * Self Study CV Builder (app 33). Stores every CV in the
     * selfstudyjo_cv_builder_data repo, so any replica can serve any request.
     */
    async getRandomCvBuilderReplica(): Promise<string | null> {
        const appId = parseInt(import.meta.env.VITE_CV_BUILDER_APP_ID || '33');
        const replicas = await this.getServiceReplicas(appId, 'cvbuilder');
        return this.getRandomReplica(replicas, appId);
    }

    /**
     * The Network Simulator's AI tutor. Defaults to the Self Study AI app but
     * can be pointed at a dedicated deployment with VITE_NETSIM_AI_APP_ID.
     */
    async getRandomNetSimAiReplica(): Promise<string | null> {
        const appId = parseInt(import.meta.env.VITE_NETSIM_AI_APP_ID || import.meta.env.VITE_AI_APP_ID || '27');
        const replicas = await this.getServiceReplicas(appId, 'netsim-ai');
        return this.getRandomReplica(replicas, appId);
    }

    clearCache() {
        this.cache.clear();
    }
}

export const serviceRegistry = new ServiceRegistry();