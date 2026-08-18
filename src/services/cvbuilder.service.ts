// src/services/cvbuilder.service.ts
//
// Client for the Self Study CV Builder backend (app 33).
//
// The backend stores everything in the selfstudyjo_cv_builder_data GitHub repo,
// so there is no local persistence here and no notion of a "current replica" -
// every call resolves a replica through the registry, and any replica can serve
// any user. See selfstudyjo_cv_builder/README.md.

import { apiService } from './api';
import { serviceRegistry } from './config';

// ============ RECORD SHAPES ============
// These mirror utils/cvmodel.py. The backend normalises whatever it is sent, so
// a partial object is always safe to PUT - fields left out keep their stored value.

export interface CvPersonal {
    full_name: string;
    headline: string;
    email: string;
    phone: string;
    location: string;
    website: string;
    linkedin: string;
    github: string;
    nationality: string;
    date_of_birth: string;
    summary: string;
}

export interface CvExperience {
    id: string;
    role: string;
    company: string;
    location: string;
    start: string;
    end: string;
    current: boolean;
    description: string;
    bullets: string[];
    tech: string[];
}

export interface CvEducation {
    id: string;
    degree: string;
    field: string;
    institution: string;
    location: string;
    start: string;
    end: string;
    grade: string;
    details: string;
}

export interface CvSkillGroup {
    category: string;
    items: string[];
}

export interface CvProject {
    id: string;
    name: string;
    description: string;
    link: string;
    role: string;
    start: string;
    end: string;
    bullets: string[];
    tech: string[];
}

export interface CvCertification {
    id: string;
    name: string;
    issuer: string;
    date: string;
    expires: string;
    credential_id: string;
    link: string;
}

export interface CvLanguage {
    name: string;
    level: string;
}

export interface CvAward {
    id: string;
    name: string;
    issuer: string;
    date: string;
    description: string;
}

export interface CvVolunteering {
    id: string;
    role: string;
    organisation: string;
    location: string;
    start: string;
    end: string;
    description: string;
    bullets: string[];
}

export interface CvPublication {
    id: string;
    title: string;
    publisher: string;
    date: string;
    link: string;
    description: string;
}

export interface CvReference {
    id: string;
    name: string;
    title: string;
    company: string;
    email: string;
    phone: string;
    relationship: string;
}

export type AvatarKind = 'male' | 'female' | 'neutral' | '';

export type BackgroundStyle = 'keep' | 'solid' | 'gradient';

/**
 * How the picture was framed and how its background was replaced.
 *
 * Persisted with the CV so the photo studio reopens an edit instead of making
 * the user redo it. Offsets are a fraction of the frame, not pixels, so they
 * stay correct whatever size the studio renders at.
 */
export interface CvPhotoEdit {
    zoom: number;
    offset_x: number;
    offset_y: number;
    rotation: number;
    mirrored: boolean;
    background: string;
    background_style: BackgroundStyle;
    tolerance: number;
    feather: number;
    protect: number;
    source: string;
}

export interface CvPhoto {
    /** A data URL. Empty when the CV falls back to `avatar`. */
    data_url: string;
    avatar: AvatarKind;
    shape: 'circle' | 'square' | 'rounded';
    show: boolean;
    filename: string;
    repo_path: string;
    /** Repo path of the untouched upload, so the original can be reframed. */
    source_path: string;
    edit: CvPhotoEdit;
}

/**
 * 'full' lets the tailor write the posting's required skills and tools into the
 * CV and report each addition; 'strict' rewords only what the CV already
 * evidences. Mirrors COVERAGE_MODES in the backend's utils/prompts.py.
 */
export type TailorCoverage = 'full' | 'strict';

export interface MatchReport {
    score: number | null;
    /** The original CV's score, so the panel can show what the pass bought. */
    baseline_score?: number | null;
    /**
     * What the backend actually altered ('headline', '3 skills', '1 role'), so the
     * UI reports the change rather than asserting one. It is never empty: /ai/tailor
     * falls back to a deterministic keyword pass rather than leaving a CV untouched.
     */
    changed?: string[];
    /** False when no provider answered and the deterministic pass produced this. */
    assisted?: boolean;
    coverage?: TailorCoverage;
    job_title?: string;
    seniority?: string;
    matched_keywords?: string[];
    /** Requirements the AI wrote into the CV — the user's review list. */
    added_keywords?: string[];
    added_items?: { section?: string; detail: string }[];
    /** Requirements it could not add without fabricating (credentials, degrees). */
    missing_keywords?: string[];
    strengths?: string[];
    gaps?: string[];
    actions?: string[];
    ats_notes?: string[];
    review_notes?: string[];
}

/**
 * What `POST /api/cv/ai/from-job` produced.
 *
 * Not a MatchReport: there is nothing to score against, because the CV did not
 * exist before the call. What the user needs instead is the list of blanks they
 * have to fill in, which is why `placeholder_count` is computed by the backend
 * from the record rather than taken from the model's own account of itself.
 */
export interface BuildReport {
    job_title?: string;
    seniority?: string;
    required_keywords?: string[];
    covered_keywords?: string[];
    /** Certifications and licences the posting wants. Never written into the CV. */
    missing_credentials?: string[];
    placeholders?: string[];
    next_steps?: string[];
    /** Every `[bracketed]` gap actually left in the record. */
    placeholder_fields?: string[];
    placeholder_count?: number;
}

export interface JobTarget {
    job_description?: string;
    job_title?: string;
    /** 'from_job' marks a CV the AI drafted from the posting rather than tailored. */
    coverage?: TailorCoverage | 'from_job';
    tailored_at?: string;
    match_report?: MatchReport;
    build_report?: BuildReport;
}

export type CvSectionKey =
    | 'summary' | 'experience' | 'education' | 'skills' | 'projects'
    | 'certifications' | 'languages' | 'awards' | 'volunteering'
    | 'publications' | 'interests' | 'references';

export interface CvRecord {
    id: string;
    user_id: string;
    title: string;
    template: string;
    accent_color: string;
    font: string;
    language: string;
    photo: CvPhoto;
    personal: CvPersonal;
    experience: CvExperience[];
    education: CvEducation[];
    skills: CvSkillGroup[];
    projects: CvProject[];
    certifications: CvCertification[];
    languages: CvLanguage[];
    awards: CvAward[];
    volunteering: CvVolunteering[];
    publications: CvPublication[];
    interests: string[];
    references: CvReference[];
    sections_order: CvSectionKey[];
    hidden_sections: CvSectionKey[];
    source: 'manual' | 'upload' | 'voice' | 'paste' | 'job' | string;
    source_file: { filename?: string; path?: string; bytes?: number; kind?: string };
    job_target: JobTarget;
    ai_notes: string[];
    history: { at: string; action: string; note: string; by: string }[];
    created_at: string;
    updated_at: string;
    /** Derived server-side; present on single-record reads only. */
    _stats?: { words: number; completeness: number; sections_filled: number };
}

export interface CvSummary {
    id: string;
    user_id: string;
    title: string;
    full_name: string;
    headline: string;
    email: string;
    template: string;
    accent_color: string;
    language: string;
    source: string;
    has_photo: boolean;
    avatar: AvatarKind;
    experience_count: number;
    education_count: number;
    skill_count: number;
    words: number;
    completeness: number;
    tailored_to_job: boolean;
    match_score: number | null;
    created_at: string;
    updated_at: string;
}

export interface CvProfile {
    user_id: string;
    full_name: string;
    email: string;
    phone: string;
    location: string;
    headline: string;
    preferred_template: string;
    preferred_accent: string;
    default_avatar: AvatarKind;
    target_roles: string[];
    created_at: string;
    updated_at: string;
    last_active: string;
    cv_count: number;
}

export interface CvDashboard {
    profile: CvProfile;
    cvs: CvSummary[];
    stats: {
        total: number;
        tailored: number;
        from_upload: number;
        from_voice: number;
        with_photo: number;
        best_match_score: number | null;
        average_completeness: number;
        last_updated: string | null;
    };
}

export interface CvTemplate {
    key: string;
    name: string;
    description: string;
    layout: 'single' | 'banner' | 'sidebar';
    accent: string;
    heading: 'bar' | 'rule' | 'plain' | 'caps';
    font: 'sans' | 'serif';
    photo: 'header' | 'sidebar' | 'none';
    density: 'airy' | 'normal' | 'compact';
    sidebar_sections: CvSectionKey[];
    best_for: string;
    ats_safe: boolean;
}

export interface TemplateCatalog {
    templates: CvTemplate[];
    accents: { name: string; value: string }[];
    fonts: { key: string; name: string; docx: string; pdf: string; css: string }[];
    default: string;
    densities: string[];
    sections: { key: CvSectionKey; title: string }[];
    default_section_order: CvSectionKey[];
    photo_shapes: string[];
}

export interface AvatarOption {
    key: Exclude<AvatarKind, ''>;
    label: string;
    data_url: string;
    palette: Record<string, string>;
}

export interface CvReview {
    score: number | null;
    verdict: string;
    strengths: string[];
    issues: { section: string; problem: string; fix: string }[];
    missing_sections: string[];
    ats_notes: string[];
    quick_wins: string[];
}

/**
 * `available` is the honest capability, and the distinction from
 * `keys_configured` is load-bearing: on 2026-08-18 every model id the backend
 * named had been retired by its provider, and this object reported the service
 * as healthy for the whole outage because it only counted keys. `models` is what
 * lets a screen say which of the two problems it is.
 */
export interface AiProviderStatus {
    groq: number;
    openrouter: number;
    gemini: number;
    available: boolean;
    keys_configured?: boolean;
    transcription: boolean;
    models?: Record<string, { configured: string[]; live: string[]; retired: string[] }>;
    last_error?: Record<string, { model: string; status: number; reason: string; at: number }>;
    /** Only from `?probe=1`, which spends a real completion to find out. */
    ok?: boolean;
    error?: string;
    seconds?: number;
}

export interface UploadResult {
    cv: CvRecord | null;
    saved: boolean;
    /** The raw text read from the file - shown when the parse disappoints. */
    text: string;
    meta: { kind: string; filename: string; bytes: number; characters: number; words: number; lines: number };
    source_file: { path: string; name: string; size: number } | null;
    error?: string;
    stage?: 'extract' | 'ai';
}

export type ExportFormat = 'pdf' | 'docx';

class CvBuilderService {
    private baseUrlPromise: Promise<string> | null = null;

    /**
     * Resolve a replica once per page and reuse it.
     *
     * Not for performance: an upload followed by a save must hit the same replica
     * so the second call cannot read a cache the first has not invalidated yet.
     * A failure clears the memo so the next call picks a different replica.
     */
    private async getBaseUrl(): Promise<string> {
        if (!this.baseUrlPromise) {
            this.baseUrlPromise = serviceRegistry.getRandomCvBuilderReplica().then(url => {
                if (!url) throw new Error('The CV Builder service is unavailable right now.');
                return url;
            }).catch(err => {
                this.baseUrlPromise = null;
                throw err;
            });
        }
        return this.baseUrlPromise;
    }

    /** Force the next call to resolve a new replica. */
    resetReplica(): void {
        this.baseUrlPromise = null;
    }

    private headers(userId: string): Record<string, string> {
        if (!userId) throw new Error('You need to be signed in to use the CV Builder.');
        return { 'X-User-ID': String(userId) };
    }

    // ============ HEALTH ============

    async health(): Promise<{ ok: boolean; ai: AiProviderStatus; storage_configured: boolean }> {
        const baseUrl = await this.getBaseUrl();
        return apiService.get(baseUrl, '/health');
    }

    /**
     * `probe` spends one real completion to find out whether the AI actually
     * answers, instead of inferring it from the key count. Off by default: the
     * dashboard asks on load, and paying for a completion on every page view is
     * not worth it when the cheap answer is right almost always.
     */
    async aiStatus(probe = false): Promise<AiProviderStatus> {
        const baseUrl = await this.getBaseUrl();
        // The path is a plain literal and the query is appended separately, so
        // _contract.py can still read it off disk and check it against the real
        // URL map. Interpolating the whole thing hides the path from that check.
        const path = '/api/cv/ai/status';
        return apiService.get(baseUrl, probe ? path + '?probe=1' : path);
    }

    async exportFormats(): Promise<Record<ExportFormat, { available: boolean; error?: string }>> {
        const baseUrl = await this.getBaseUrl();
        const r = await apiService.get<{ formats: any }>(baseUrl, '/api/cv/export/formats');
        return r.formats;
    }

    // ============ PROFILE & DASHBOARD ============

    async getDashboard(userId: string): Promise<CvDashboard> {
        const baseUrl = await this.getBaseUrl();
        return apiService.get(baseUrl, '/api/cv/profile/summary', this.headers(userId));
    }

    async saveProfile(userId: string, profile: Partial<CvProfile>): Promise<CvProfile> {
        const baseUrl = await this.getBaseUrl();
        const r = await apiService.put<{ profile: CvProfile }>(
            baseUrl, '/api/cv/profile', profile, this.headers(userId));
        return r.profile;
    }

    // ============ CVs ============

    async listCvs(userId: string, params: { q?: string; template?: string } = {}): Promise<CvSummary[]> {
        const baseUrl = await this.getBaseUrl();
        const query = new URLSearchParams();
        if (params.q) query.set('q', params.q);
        if (params.template) query.set('template', params.template);
        const suffix = query.toString() ? `?${query}` : '';
        const r = await apiService.get<{ results: CvSummary[] }>(
            baseUrl, `/api/cv/cvs${suffix}`, this.headers(userId));
        return r.results || [];
    }

    async getCv(userId: string, cvId: string): Promise<CvRecord> {
        const baseUrl = await this.getBaseUrl();
        return apiService.get(baseUrl, `/api/cv/cvs/${encodeURIComponent(cvId)}`,
                              this.headers(userId));
    }

    async createCv(userId: string, data: { title?: string; cv?: Partial<CvRecord> } = {}): Promise<CvRecord> {
        const baseUrl = await this.getBaseUrl();
        return apiService.post(baseUrl, '/api/cv/cvs', data, this.headers(userId));
    }

    async updateCv(userId: string, cvId: string, cv: Partial<CvRecord>, note?: string): Promise<CvRecord> {
        const baseUrl = await this.getBaseUrl();
        return apiService.put(baseUrl, `/api/cv/cvs/${encodeURIComponent(cvId)}`,
                              { cv, note }, this.headers(userId));
    }

    async duplicateCv(userId: string, cvId: string, title?: string): Promise<CvRecord> {
        const baseUrl = await this.getBaseUrl();
        return apiService.post(baseUrl, `/api/cv/cvs/${encodeURIComponent(cvId)}/duplicate`,
                               { title }, this.headers(userId));
    }

    async deleteCv(userId: string, cvId: string): Promise<{ success: boolean }> {
        const baseUrl = await this.getBaseUrl();
        return apiService.delete(baseUrl, `/api/cv/cvs/${encodeURIComponent(cvId)}`,
                                 undefined, this.headers(userId));
    }

    async setPhoto(userId: string, cvId: string, photo: Partial<CvPhoto>): Promise<{ photo: CvPhoto }> {
        const baseUrl = await this.getBaseUrl();
        return apiService.put(baseUrl, `/api/cv/cvs/${encodeURIComponent(cvId)}/photo`,
                              photo, this.headers(userId));
    }

    async setTemplate(
        userId: string,
        cvId: string,
        data: { template?: string; accent_color?: string; font?: string;
                sections_order?: CvSectionKey[]; hidden_sections?: CvSectionKey[] }
    ): Promise<any> {
        const baseUrl = await this.getBaseUrl();
        return apiService.put(baseUrl, `/api/cv/cvs/${encodeURIComponent(cvId)}/template`,
                              data, this.headers(userId));
    }

    // ============ CATALOGUE ============

    async getTemplates(userId: string): Promise<TemplateCatalog> {
        const baseUrl = await this.getBaseUrl();
        return apiService.get(baseUrl, '/api/cv/templates', this.headers(userId));
    }

    async getAvatars(userId: string): Promise<AvatarOption[]> {
        const baseUrl = await this.getBaseUrl();
        const r = await apiService.get<{ avatars: AvatarOption[] }>(
            baseUrl, '/api/cv/avatars', this.headers(userId));
        return r.avatars || [];
    }

    // ============ IMPORT ============

    /**
     * Upload a PDF/DOCX/TXT CV. The response carries the parsed record *and* the
     * raw text, so the editor can show what was read when the parse is poor.
     */
    async uploadCv(
        userId: string,
        file: File,
        options: { create?: boolean; title?: string; hint?: string } = {}
    ): Promise<UploadResult> {
        const baseUrl = await this.getBaseUrl();
        const form = new FormData();
        form.append('file', file, file.name);
        form.append('create', options.create === false ? '0' : '1');
        if (options.title) form.append('title', options.title);
        if (options.hint) form.append('hint', options.hint);
        return apiService.post(baseUrl, '/api/cv/upload', form, this.headers(userId));
    }

    async uploadPhoto(userId: string, file: File | Blob, filename = 'photo.png'): Promise<{
        data_url: string; repo_path: string; filename: string; bytes: number;
    }> {
        const baseUrl = await this.getBaseUrl();
        const form = new FormData();
        form.append('file', file, (file as File).name || filename);
        return apiService.post(baseUrl, '/api/cv/upload/photo', form, this.headers(userId));
    }

    /**
     * An archived image back as a data URL.
     *
     * Lets the photo studio reframe the original upload on a later visit instead
     * of re-cropping the already-cropped picture, which loses quality each time.
     */
    async getImageDataUrl(userId: string, path: string): Promise<string> {
        const baseUrl = await this.getBaseUrl();
        const r = await apiService.get<{ data_url: string }>(
            baseUrl, `/api/cv/files/content?path=${encodeURIComponent(path)}`,
            this.headers(userId));
        if (!r.data_url) throw new Error('That image is no longer stored.');
        return r.data_url;
    }

    async parseText(userId: string, text: string, options: { title?: string; hint?: string; save?: boolean } = {}) {
        const baseUrl = await this.getBaseUrl();
        return apiService.post<{ cv: CvRecord; saved: boolean }>(
            baseUrl, '/api/cv/ai/parse', { text, ...options }, this.headers(userId));
    }

    // ============ AI ============

    async enhance(userId: string, payload: {
        cv_id?: string; cv?: Partial<CvRecord>; instructions?: string;
        tone?: string; target_role?: string; save?: boolean; as_copy?: boolean;
    }): Promise<{ cv: CvRecord; saved: boolean; summary: CvSummary }> {
        const baseUrl = await this.getBaseUrl();
        return apiService.post(baseUrl, '/api/cv/ai/enhance', payload, this.headers(userId));
    }

    async tailorToJob(userId: string, payload: {
        cv_id?: string; cv?: Partial<CvRecord>; job_description: string;
        /** Defaults to 'full' on the backend — it closes the gaps rather than listing them. */
        coverage?: TailorCoverage;
        save?: boolean; as_copy?: boolean; title?: string;
    }): Promise<{ cv: CvRecord; saved: boolean; match_report: MatchReport; summary: CvSummary }> {
        const baseUrl = await this.getBaseUrl();
        return apiService.post(baseUrl, '/api/cv/ai/tailor', payload, this.headers(userId));
    }

    /**
     * Draft a whole CV from a job advert - the "I have no CV yet" path.
     *
     * Distinct from `tailorToJob`, which reworks a CV that already exists. Here
     * there is nothing to rework, so every fact about the user that `background`
     * does not supply comes back as a `[bracketed]` placeholder for them to fill
     * in. `build_report.placeholder_count` is how many.
     */
    async buildFromJob(userId: string, payload: {
        job_description: string;
        /** Free text about the candidate. Optional - without it the draft is a scaffold. */
        background?: string;
        title?: string; save?: boolean;
    }): Promise<{ cv: CvRecord; saved: boolean; build_report: BuildReport; summary: CvSummary }> {
        const baseUrl = await this.getBaseUrl();
        return apiService.post(baseUrl, '/api/cv/ai/from-job', payload, this.headers(userId));
    }

    async buildFromVoice(userId: string, payload: {
        transcript: string; notes?: string; title?: string;
        avatar?: AvatarKind; save?: boolean;
    }): Promise<{ cv: CvRecord; saved: boolean; transcript_words: number }> {
        const baseUrl = await this.getBaseUrl();
        return apiService.post(baseUrl, '/api/cv/ai/voice', payload, this.headers(userId));
    }

    async rewriteSection(userId: string, payload: {
        cv_id?: string; cv?: Partial<CvRecord>; section: CvSectionKey;
        instruction?: string; save?: boolean;
    }): Promise<{ section: CvSectionKey; value: any; notes: string[]; cv: CvRecord; saved: boolean }> {
        const baseUrl = await this.getBaseUrl();
        return apiService.post(baseUrl, '/api/cv/ai/section', payload, this.headers(userId));
    }

    async review(userId: string, payload: { cv_id?: string; cv?: Partial<CvRecord>; target_role?: string }) {
        const baseUrl = await this.getBaseUrl();
        return apiService.post<{ review: CvReview; reviewed_at: string }>(
            baseUrl, '/api/cv/ai/review', payload, this.headers(userId));
    }

    /**
     * Transcribe one recorded chunk.
     *
     * The view records in short chunks and posts each one, so a long dictation
     * never becomes a single request that outlives the backend's timeout.
     */
    async transcribe(userId: string, audio: Blob, language = 'en'): Promise<string> {
        const baseUrl = await this.getBaseUrl();
        const form = new FormData();
        form.append('audio', audio, 'audio.webm');
        form.append('language', language);
        const r = await apiService.post<{ text: string }>(
            baseUrl, '/api/cv/transcribe', form, this.headers(userId));
        return r.text || '';
    }

    // ============ EXPORT ============

    /**
     * Download a CV. Renders server-side so the file matches the chosen template
     * exactly, then hands the browser a blob - which also keeps the service token
     * out of the URL bar and out of the browser's history.
     *
     * `filename` is the user's own name for the file. It is sanitised on the
     * backend rather than here, because this client is not the only caller and a
     * check that lives in one client is a check the next one does not have.
     */
    async download(
        userId: string,
        cvId: string,
        format: ExportFormat,
        options: { cv?: Partial<CvRecord>; template?: string; accent_color?: string;
                   font?: string; filename?: string } = {}
    ): Promise<{ blob: Blob; filename: string }> {
        const baseUrl = await this.getBaseUrl();
        const endpoint = cvId
            ? `/api/cv/cvs/${encodeURIComponent(cvId)}/export/${format}`
            : `/api/cv/export/${format}`;

        const response = await fetch(`${baseUrl}${endpoint}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Token ${import.meta.env.VITE_AUTH_TOKEN}`,
                'X-User-ID': String(userId),
            },
            body: JSON.stringify(options),
            mode: 'cors',
            credentials: 'omit',
        });

        if (!response.ok) {
            let message = `Download failed (HTTP ${response.status})`;
            try {
                const data = await response.json();
                if (data?.error) message = data.error;
            } catch { /* a non-JSON error body is not worth reporting verbatim */ }
            throw new Error(message);
        }

        const disposition = response.headers.get('Content-Disposition') || '';
        const match = /filename="?([^"]+)"?/.exec(disposition);
        return { blob: await response.blob(), filename: match?.[1] || `cv.${format}` };
    }

    /** Trigger the browser's save dialog for a blob returned by `download`. */
    saveBlob(blob: Blob, filename: string): void {
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        link.remove();
        // Revoking immediately can cancel the download in Safari.
        setTimeout(() => URL.revokeObjectURL(url), 4000);
    }
}

export const cvBuilderService = new CvBuilderService();

// ============ BROWSER-SIDE HELPERS ============

/**
 * Downscale an image in the browser before it is uploaded.
 *
 * A modern phone photo is 4-8 MB; embedded in the CV record as a data URL that
 * would make every read of that CV slow and could push the record past the
 * backend's size cap. 640px on the long edge is more than a CV print needs.
 */
export async function downscaleImage(file: File, maxEdge = 640, quality = 0.86): Promise<Blob> {
    const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result));
        reader.onerror = () => reject(new Error('That image could not be read.'));
        reader.readAsDataURL(file);
    });

    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = () => reject(new Error('That file is not an image the browser can read.'));
        img.src = dataUrl;
    });

    const scale = Math.min(1, maxEdge / Math.max(image.width, image.height));
    const width = Math.max(1, Math.round(image.width * scale));
    const height = Math.max(1, Math.round(image.height * scale));

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return file;                       // no canvas: send the original
    ctx.drawImage(image, 0, 0, width, height);

    // JPEG unless the source is a PNG with transparency worth keeping.
    const type = file.type === 'image/png' ? 'image/png' : 'image/jpeg';
    return new Promise<Blob>(resolve => {
        canvas.toBlob(blob => resolve(blob || file), type, quality);
    });
}

/** An empty entry for each repeatable section, so the editor's "Add" buttons agree with the API. */
export function blankEntry(section: CvSectionKey): any {
    const id = `tmp_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    switch (section) {
        case 'experience':
            return { id, role: '', company: '', location: '', start: '', end: '',
                     current: false, description: '', bullets: [''], tech: [] };
        case 'education':
            return { id, degree: '', field: '', institution: '', location: '',
                     start: '', end: '', grade: '', details: '' };
        case 'skills':
            return { category: '', items: [] };
        case 'projects':
            return { id, name: '', description: '', link: '', role: '', start: '', end: '',
                     bullets: [], tech: [] };
        case 'certifications':
            return { id, name: '', issuer: '', date: '', expires: '', credential_id: '', link: '' };
        case 'languages':
            return { name: '', level: '' };
        case 'awards':
            return { id, name: '', issuer: '', date: '', description: '' };
        case 'volunteering':
            return { id, role: '', organisation: '', location: '', start: '', end: '',
                     description: '', bullets: [] };
        case 'publications':
            return { id, title: '', publisher: '', date: '', link: '', description: '' };
        case 'references':
            return { id, name: '', title: '', company: '', email: '', phone: '', relationship: '' };
        default:
            return '';
    }
}
