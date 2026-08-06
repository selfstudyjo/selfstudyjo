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

    getRandomReplica(replicas: string[]): string | null {
        if (!replicas || replicas.length === 0) return null;
        const randomIndex = Math.floor(Math.random() * replicas.length);
        return replicas[randomIndex];
    }

    async getRandomAuthReplica(): Promise<string | null> {
        const replicas = await this.getServiceReplicas(
            parseInt(import.meta.env.VITE_AUTH_APP_ID || '15'),
            'auth'
        );
        return this.getRandomReplica(replicas);
    }

    async getRandomUserProfileReplica(): Promise<string | null> {
        const replicas = await this.getServiceReplicas(
            parseInt(import.meta.env.VITE_USERPROFILE_APP_ID || '13'),
            'userprofile'
        );
        return this.getRandomReplica(replicas);
    }

    async getRandomOtpReplica(): Promise<string | null> {
        const replicas = await this.getServiceReplicas(
            parseInt(import.meta.env.VITE_OTP_APP_ID || '14'),
            'otp'
        );
        return this.getRandomReplica(replicas);
    }

    async getRandomCertificateReplica(): Promise<string | null> {
        const replicas = await this.getServiceReplicas(
            parseInt(import.meta.env.VITE_CERTIFICATE_APP_ID || '24'),
            'certificate'
        );
        return this.getRandomReplica(replicas);
    }

    async getRandomCourseReplica(): Promise<string | null> {
        const replicas = await this.getServiceReplicas(
            parseInt(import.meta.env.VITE_COURSE_APP_ID || '19'),
            'course'
        );
        return this.getRandomReplica(replicas);
    }

    async getRandomMediaReplica(): Promise<string | null> {
        const replicas = await this.getServiceReplicas(
            parseInt(import.meta.env.VITE_MEDIA_APP_ID || '18'),
            'media'
        );
        return this.getRandomReplica(replicas);
    }

    async getRandomChatReplica(): Promise<string | null> {
        const replicas = await this.getServiceReplicas(
            parseInt(import.meta.env.VITE_CHAT_APP_ID || '9'),
            'chat'
        );
        return this.getRandomReplica(replicas);
    }

    async getRandomNotificationReplica(): Promise<string | null> {
        const replicas = await this.getServiceReplicas(
            parseInt(import.meta.env.VITE_NOTIFICATION_APP_ID || '16'),
            'notification'
        );
        return this.getRandomReplica(replicas);
    }

    async getRandomExamReplica(): Promise<string | null> {
        const replicas = await this.getServiceReplicas(
            parseInt(import.meta.env.VITE_EXAM_APP_ID || '20'),
            'exam'
        );
        return this.getRandomReplica(replicas);
    }

    async getRandomProctorReplica(): Promise<string | null> {
        const replicas = await this.getServiceReplicas(
            parseInt(import.meta.env.VITE_PROCTOR_APP_ID || '21'),
            'proctor'
        );
        return this.getRandomReplica(replicas);
    }

    async getRandomRunbookReplica(): Promise<string | null> {
        const replicas = await this.getServiceReplicas(
            parseInt(import.meta.env.VITE_RUNBOOK_APP_ID || '17'),
            'runbook'
        );
        return this.getRandomReplica(replicas);
    }

    async getRandomSubscriptionReplica(): Promise<string | null> {
        const replicas = await this.getServiceReplicas(
            parseInt(import.meta.env.VITE_SUBSCRIPTIONS_APP_ID || '22'),
            'subscription'
        );
        return this.getRandomReplica(replicas);
    }

    async getRandomPaymentReplica(): Promise<string | null> {
        const replicas = await this.getServiceReplicas(
            parseInt(import.meta.env.VITE_PAYMENT_APP_ID || '23'),
            'payment'
        );
        return this.getRandomReplica(replicas);
    }

    async getRandomResearchFlowReplica(): Promise<string | null> {
        const replicas = await this.getServiceReplicas(
            parseInt(import.meta.env.VITE_RESEARCH_FLOW_APP_ID || '28'),
            'researchflow'
        );
        return this.getRandomReplica(replicas);
    }

    async getRandomToastmastersReplica(): Promise<string | null> {
        const replicas = await this.getServiceReplicas(
            parseInt(import.meta.env.VITE_TOASTMASTERS_APP_ID || '27'),
            'toastmasters'
        );
        return this.getRandomReplica(replicas);
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
        const replicas = await this.getServiceReplicas(
            parseInt(import.meta.env.VITE_LAB_APP_ID || '11'),
            'lab'
        );
        return this.getRandomReplica(replicas);
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
        const replicas = await this.getServiceReplicas(
            parseInt(import.meta.env.VITE_ROBLOX_APP_ID || '31'),
            'roblox'
        );
        return this.getRandomReplica(replicas);
    }

    /**
     * Self Study AI (app 27). Used by the Network Simulator's AI tutor and by
     * anything else that needs the OpenAI-compatible /v1/chat/completions API.
     */
    async getRandomAiReplica(): Promise<string | null> {
        const replicas = await this.getServiceReplicas(
            parseInt(import.meta.env.VITE_AI_APP_ID || '27'),
            'ai'
        );
        return this.getRandomReplica(replicas);
    }

    /**
     * Self Study CV Builder (app 33). Stores every CV in the
     * selfstudyjo_cv_builder_data repo, so any replica can serve any request.
     */
    async getRandomCvBuilderReplica(): Promise<string | null> {
        const replicas = await this.getServiceReplicas(
            parseInt(import.meta.env.VITE_CV_BUILDER_APP_ID || '33'),
            'cvbuilder'
        );
        return this.getRandomReplica(replicas);
    }

    /**
     * The Network Simulator's AI tutor. Defaults to the Self Study AI app but
     * can be pointed at a dedicated deployment with VITE_NETSIM_AI_APP_ID.
     */
    async getRandomNetSimAiReplica(): Promise<string | null> {
        const replicas = await this.getServiceReplicas(
            parseInt(import.meta.env.VITE_NETSIM_AI_APP_ID || import.meta.env.VITE_AI_APP_ID || '27'),
            'netsim-ai'
        );
        return this.getRandomReplica(replicas);
    }

    clearCache() {
        this.cache.clear();
    }
}

export const serviceRegistry = new ServiceRegistry();