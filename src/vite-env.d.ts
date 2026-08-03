/// <reference types="vite/client" />

interface ImportMetaEnv {
    readonly VITE_AUTH_TOKEN: string
    readonly VITE_CHAT_APP_ID: string
    readonly VITE_API_BASE_REGISTRY: string
    readonly VITE_REGISTRY_ALT: string
    readonly VITE_PROCTOR_APP_ID: string
    readonly VITE_RUNBOOK_APP_ID: string
    readonly VITE_AUTH_APP_ID: string
    readonly VITE_USERPROFILE_APP_ID: string
    readonly VITE_OTP_APP_ID: string
    readonly VITE_CERTIFICATE_APP_ID: string
    readonly VITE_COURSE_APP_ID: string
    readonly VITE_MEDIA_APP_ID: string
    readonly VITE_NOTIFICATION_APP_ID: string
    readonly VITE_EXAM_APP_ID: string
    readonly VITE_SUBSCRIPTIONS_APP_ID: string
    readonly VITE_PAYMENT_APP_ID: string
    readonly VITE_LAB_APP_ID: string
    readonly VITE_AI_APP_ID: string
    readonly VITE_RESEARCH_FLOW_APP_ID: string
    readonly VITE_TOASTMASTERS_APP_ID: string
    readonly VITE_JOBINTERVIEW_APP_ID: string
    readonly VITE_ROBLOX_APP_ID: string
    readonly VITE_AI_MODEL: string

    /* ── Network Simulator ──────────────────────────────────────────────
       Note: these are declarations only. A type never changes what ships —
       every VITE_* value is inlined into the public bundle regardless, which
       is why none of these may hold a credential. `vite.config.ts` fails the
       build if one does.                                                   */

    /** Base URL of the backend that proxies the data repo. NEVER a token. */
    readonly VITE_NETSIM_STORAGE_PROXY: string
    readonly VITE_NETSIM_DATA_OWNER: string
    readonly VITE_NETSIM_DATA_REPO: string
    readonly VITE_NETSIM_DATA_BRANCH: string
    readonly VITE_NETSIM_AI_APP_ID: string
}

interface ImportMeta {
    readonly env: ImportMetaEnv
}