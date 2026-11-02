/**
 * SelfStudy Products: the desktop apps' latest installers, served by app 27.
 *
 * The installers are GitHub Release assets of PRIVATE repositories, so a plain
 * link would be a 404 for every student. App 27 lists them and, per click, asks
 * GitHub for a short-lived signed URL; the browser then downloads straight from
 * GitHub's storage and no installer bytes pass through a PythonAnywhere replica.
 * Both calls check ai_feature on the SERVER - the router's gate is a
 * convenience, not the control.
 *
 * The replica is the pinned one (`getRandomAiReplica`, working rule 31).
 */
import { apiService } from './api';
import { serviceRegistry } from './config';
import type { ProductInfo } from '@/utils/products';

class ProductsService {
    private async base(): Promise<string> {
        const url = await serviceRegistry.getRandomAiReplica();
        if (!url) throw new Error('The AI service is unavailable');
        return url;
    }

    async list(userId: string): Promise<ProductInfo[]> {
        const base = await this.base();
        const r = await apiService.get<{ products?: ProductInfo[] }>(base, '/api/products/', { 'X-User-ID': userId });
        return (r?.products || []).map((p) => ({ ...p, assets: p.assets || [] }));
    }

    /** A signed URL valid for a few minutes. Ask again on every click. */
    async downloadUrl(userId: string, productId: string, assetId: number): Promise<string> {
        const base = await this.base();
        const r = await apiService.post<{ url: string }>(
            base, `/api/products/${encodeURIComponent(productId)}/download`, { asset: assetId },
            { 'X-User-ID': userId });
        if (!r?.url || !/^https:\/\//.test(r.url)) throw new Error('No download link was returned');
        return r.url;
    }
}

export const productsService = new ProductsService();
