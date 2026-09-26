// App 36, stubbed: it can speak nothing.
//
// `speechCapabilities()` answering `null` is what the real service answers when
// a replica has not pulled the route or cannot be reached, and `serverVoicesFor`
// reads that as `NO_SERVER` -- so `planSpeech` falls to the platform route and
// the preview exercises the `speechSynthesis` half of the composable, which is
// the half with the Chrome keepalive and the watchdog in it.
//
// `speech()` rejects rather than resolving with a silent clip. If it resolved,
// `audio.play()` would be handed a URL that decodes to nothing and the preview
// would show the bar sitting on passage one for ever -- which reads as the
// reader being broken rather than as the stub having nothing to hand over.
// Rejecting is also what a replica with no outbound access really does.
export const NEWS_APP_ID = 36;

export const newsService = {
    async speechCapabilities() {
        return null;
    },
    async speech() {
        throw new Error('no speech provider in the preview');
    },
    revokeSpeech() { /* nothing to revoke */ },
};

export type SpeechCapabilities = {
    paired: boolean;
    provider: 'edge' | 'google';
    edge: { ok: boolean; error?: string };
    languages: Record<string, {
        paired: boolean;
        genders: Array<'female' | 'male'>;
        solo_gender: 'female' | 'male' | '';
        voices: Record<'female' | 'male', string | null>;
    }>;
    reason?: string;
    fix?: string;
};

export type SpeechClip = {
    url: string;
    voice: string;
    provider: string;
    gender: 'female' | 'male' | '';
};
