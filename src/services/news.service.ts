// src/services/news.service.ts
//
// Client for Self Study News (app 36) — the hourly world-news bulletins.
//
// Three things make this service different from every other client here:
//
// 1. **Nothing in the app writes to it.** The records are produced by Airflow
//    (`selfstudy_news.py` in the `dags` repo), which scrapes RT and Al Jazeera
//    into the `selfstudyjo/selfstudy_news_data` repo once an hour and REPLACES
//    each category's file. There is no create, no update, no delete — the API
//    surface here is reads and one cache hint.
//
// 2. **There is no `X-User-ID`.** The Newscast page is public: no account, no
//    subscription. The service token still goes on every call, exactly as it
//    does for the anonymous support widget (app 9) — "public" describes the
//    user, not the caller.
//
// 3. **A bulletin is big and a headline is not.** A category with twelve full
//    articles is a few hundred kilobytes, so the ticker and the category picker
//    deliberately use `headlines()` and `catalogue()`, which never carry a body.
//    Fetching bulletins to build a ticker would download several megabytes to
//    show forty lines of text.

import { apiService, withReplicas } from './api';

export const NEWS_APP_ID = parseInt(import.meta.env.VITE_NEWS_APP_ID || '36');

export type NewsLanguage = 'ar' | 'en';

export interface NewsLanguageInfo {
    code: NewsLanguage;
    name: string;
    name_en: string;
    dir: 'rtl' | 'ltr';
    locale: string;
    categories: number;
    items: number;
    fresh: number;
    generated_at: string;
}

export interface NewsCategory {
    key: string;
    path: string;
    source: string;
    source_label: string;
    language: NewsLanguage;
    category: string;
    label: string;
    label_en: string;
    source_url: string;
    generated_at: string;
    count: number;
    fresh_count: number;
    top_titles: string[];
}

export interface NewsArticle {
    id: string;
    url: string;
    source: string;
    source_label: string;
    language: NewsLanguage;
    title: string;
    summary: string;
    body: string;
    paragraphs: string[];
    word_count: number;
    /** Set by the DAG. False for Al Jazeera's video and gallery sections, where
     *  the headline is the whole story — the anchor reads it and moves on. */
    has_detail: boolean;
    published_at: string;
    modified_at: string;
    image: string;
    author: string;
    section: string;
    fresh: boolean;
    rank: number;
}

export interface NewsBulletin {
    schema: number;
    key: string;
    source: string;
    source_label: string;
    language: NewsLanguage;
    category: string;
    label: string;
    label_en: string;
    source_url: string;
    generated_at: string;
    window_hours: number;
    count: number;
    fresh_count: number;
    items: NewsArticle[];
}

/** A ticker line — a story without its body. */
export interface NewsHeadline {
    id: string;
    title: string;
    summary: string;
    url: string;
    image: string;
    published_at: string;
    fresh: boolean;
    has_detail: boolean;
    word_count: number;
    source: string;
    source_label: string;
    language: NewsLanguage;
    category: string;
    category_label: string;
    key: string;
}

/** `news/<lang>/<source>/<category>.json` -> the three path segments. */
export function splitCategoryPath(path: string): { language: string; source: string; category: string } | null {
    const match = /^news\/([^/]+)\/([^/]+)\/([^/]+)\.json$/.exec(path || '');
    if (!match) return null;
    return { language: match[1], source: match[2], category: match[3] };
}

class NewsService {
    private call<T>(path: string): Promise<T> {
        return withReplicas(NEWS_APP_ID, 'news', (base) =>
            apiService.get<T>(base, path));
    }

    /** The languages on offer, with live counts so an empty one shows as empty. */
    async languages(): Promise<NewsLanguageInfo[]> {
        const data = await this.call<{ languages: NewsLanguageInfo[] }>(
            '/api/news/languages/');
        return data.languages || [];
    }

    /** Every category holding a bulletin, optionally in one language. */
    async catalogue(language?: NewsLanguage): Promise<NewsCategory[]> {
        const query = language ? `?language=${encodeURIComponent(language)}` : '';
        const data = await this.call<{ categories: NewsCategory[] }>(
            `/api/news/catalogue/${query}`);
        return data.categories || [];
    }

    /**
     * One category in full — the anchor's script.
     *
     * `source` here is the slug (`rt`, `aljazeera`), not the display label, and
     * it comes off the category's `path`. Passing "Al Jazeera" gives a 404.
     */
    bulletin(language: string, source: string, category: string): Promise<NewsBulletin> {
        return this.call<NewsBulletin>(
            `/api/news/bulletin/${encodeURIComponent(language)}`
            + `/${encodeURIComponent(source)}/${encodeURIComponent(category)}/`);
    }

    /** Ticker lines across every category in a language, newest first. */
    async headlines(language: NewsLanguage, limit = 40, category?: string): Promise<NewsHeadline[]> {
        const params = new URLSearchParams({ language, limit: String(limit) });
        if (category) params.set('category', category);
        const data = await this.call<{ headlines: NewsHeadline[] }>(
            `/api/news/headlines/?${params.toString()}`);
        return data.headlines || [];
    }

    /**
     * The top story from each category — the opening rundown.
     *
     * Not the same as `headlines()`: this one guarantees breadth, so a bulletin
     * that opens with it covers every section rather than five angles on
     * whatever broke in the last ten minutes.
     */
    async latest(language: NewsLanguage): Promise<NewsHeadline[]> {
        const data = await this.call<{ headlines: NewsHeadline[] }>(
            `/api/news/latest/?language=${encodeURIComponent(language)}`);
        return data.headlines || [];
    }
}

export const newsService = new NewsService();
