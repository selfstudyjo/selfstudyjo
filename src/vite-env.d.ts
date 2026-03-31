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
    readonly VITE_RESEARCH_FLOW_APP_ID: string
    // add any other VITE_ variables you use
}

interface ImportMeta {
    readonly env: ImportMetaEnv
}
