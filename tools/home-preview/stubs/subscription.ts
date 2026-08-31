// Stands in for `@/services/subscription.service` in the dashboard preview.
export type { Feature, Subscription, SubscriptionType } from '../../../src/services/subscription.service';
import type { Subscription } from '../../../src/services/subscription.service';

const EMPTY = new URLSearchParams(location.search).has('empty');

const SUBS: Subscription[] = [
    {
        external_id: 's-1',
        title: 'Professional Annual',
        user_id: 'u-preview',
        is_active: true,
        created_date: '2026-01-15T10:00:00Z',
        expire_date: '2027-01-15T10:00:00Z',
        subscription_type: {
            external_id: 'sfs-pro-annual',
            title: 'Professional Annual',
            description: 'Everything in Starter, plus the labs, the runbooks and the AI tools.',
            price: '49.90',
            features: [
                { external_id: 'f-1', name: 'ai_feature', description: 'AI tools' },
                { external_id: 'f-2', name: 'lab_feature', description: 'SQL, Linux and Python labs' },
                { external_id: 'f-3', name: 'runbook_feature', description: 'Runbooks' },
                { external_id: 'f-4', name: 'exam_feature', description: 'Invigilated exams' },
            ],
            translations: { ar: { title: 'الاحترافية السنوية' } },
        },
    },
];

const delay = <T,>(v: T, ms = 100): Promise<T> => new Promise(r => setTimeout(() => r(v), ms));

export const subscriptionService = {
    getUsableSubscriptions: (_userId: string) => delay(EMPTY ? [] : SUBS),
};
