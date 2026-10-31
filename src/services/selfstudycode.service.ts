/**
 * SelfStudyCode downloads, served by Self Study AI (app 27).
 *
 * The installers are GitHub Release assets of a PRIVATE repository, so a plain
 * link would be a 404 for every student. App 27 lists them and, per click, asks
 * GitHub for a short-lived signed URL; the browser then downloads straight from
 * GitHub's storage and no installer bytes pass through a PythonAnywhere replica.
 *
 * The replica is the pinned one (`getRandomAiReplica`, working rule 31).
 */
import { apiService } from './api';
import { serviceRegistry } from './config';
import type { DownloadAsset } from '@/utils/selfstudyCodeDownloads';

export interface DownloadsInfo {
    available: boolean;
    version?: string;
    published?: string;
    reason?: string;
    assets: DownloadAsset[];
}

class SelfStudyCodeService {
    private async base(): Promise<string> {
        const url = await serviceRegistry.getRandomAiReplica();
        if (!url) throw new Error('The AI service is unavailable');
        return url;
    }

    async downloads(userId: string): Promise<DownloadsInfo> {
        const base = await this.base();
        const r = await apiService.get<DownloadsInfo>(base, '/api/selfstudycode/downloads', { 'X-User-ID': userId });
        return { available: !!r?.available, version: r?.version, published: r?.published, reason: r?.reason, assets: r?.assets || [] };
    }

    /** A signed URL valid for a few minutes. Ask again on every click. */
    async downloadUrl(userId: string, assetId: number): Promise<string> {
        const base = await this.base();
        const r = await apiService.post<{ url: string }>(base, '/api/selfstudycode/download', { asset_id: assetId }, { 'X-User-ID': userId });
        if (!r?.url || !/^https:\/\//.test(r.url)) throw new Error('No download link was returned');
        return r.url;
    }
}

export const selfStudyCodeService = new SelfStudyCodeService();
