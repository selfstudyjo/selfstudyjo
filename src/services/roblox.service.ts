// src/services/roblox.service.ts
import { apiService } from './api';
import { serviceRegistry } from './config';

export interface RobloxAnimation {
  id: string;
  name: string;
  category: string;
  icon: string;
  color: string;
  description: string;
  bestFor: string;
  looping: boolean;
  duration: number;
  luaCode: string;
  threeAnimParams: Record<string, string>;
  created_by: string;
  created_by_username?: string;
  created_at: string;
  updated_at?: string;
}

export interface RobloxDesign {
  id: string;
  user_id: string;
  username: string;
  name: string;
  description: string;
  partType: string;
  size: { x: number; y: number; z: number };
  color: string;
  material: string;
  transparency: number;
  reflectance: number;
  shape: string;
  anchored: boolean;
  canCollide: boolean;
  children: Array<{ type: string; properties: Record<string, any> }>;
  luaCode: string;
  animations: string[];
  created_at: string;
  updated_at?: string;
}

export interface GenerateAnimationRequest {
  description: string;
  partType: string;
  looping: boolean;
  duration: number;
}

export interface GenerateAnimationResult {
  name: string;
  description: string;
  luaCode: string;
  threeAnimParams: Record<string, string>;
}

export interface GenerateDesignRequest {
  description: string;
}

class RobloxService {
  private async getBaseUrl(): Promise<string> {
    const url = await serviceRegistry.getRandomRobloxReplica();
    if (!url) throw new Error('No Roblox service replicas available');
    return url;
  }

  // ─── Animations ───
  async getAnimations(category?: string, search?: string): Promise<RobloxAnimation[]> {
    const baseUrl = await this.getBaseUrl();
    let endpoint = '/api/roblox/animations';
    const params: string[] = [];
    if (category) params.push(`category=${encodeURIComponent(category)}`);
    if (search) params.push(`search=${encodeURIComponent(search)}`);
    if (params.length) endpoint += '?' + params.join('&');
    return apiService.get<RobloxAnimation[]>(baseUrl, endpoint);
  }

  async getAnimation(id: string): Promise<RobloxAnimation> {
    const baseUrl = await this.getBaseUrl();
    return apiService.get<RobloxAnimation>(baseUrl, `/api/roblox/animations/${id}`);
  }

  async createAnimation(data: Partial<RobloxAnimation>): Promise<{ success: boolean; animation: RobloxAnimation }> {
    const baseUrl = await this.getBaseUrl();
    return apiService.post(baseUrl, '/api/roblox/animations', data);
  }

  async updateAnimation(id: string, data: Partial<RobloxAnimation>): Promise<{ success: boolean; animation: RobloxAnimation }> {
    const baseUrl = await this.getBaseUrl();
    return apiService.put(baseUrl, `/api/roblox/animations/${id}`, data);
  }

  async deleteAnimation(id: string): Promise<{ success: boolean }> {
    const baseUrl = await this.getBaseUrl();
    return apiService.delete(baseUrl, `/api/roblox/animations/${id}`);
  }

  async getCategories(): Promise<string[]> {
    const baseUrl = await this.getBaseUrl();
    return apiService.get<string[]>(baseUrl, '/api/roblox/animations/categories');
  }

  async generateAnimation(req: GenerateAnimationRequest): Promise<GenerateAnimationResult> {
    const baseUrl = await this.getBaseUrl();
    return apiService.post<GenerateAnimationResult>(baseUrl, '/api/roblox/generate-animation', req);
  }

  // ─── Designs ───
  async getDesigns(userId?: string): Promise<RobloxDesign[]> {
    const baseUrl = await this.getBaseUrl();
    let endpoint = '/api/roblox/designs';
    if (userId) endpoint += `?user_id=${encodeURIComponent(userId)}`;
    return apiService.get<RobloxDesign[]>(baseUrl, endpoint);
  }

  async getDesign(id: string): Promise<RobloxDesign> {
    const baseUrl = await this.getBaseUrl();
    return apiService.get<RobloxDesign>(baseUrl, `/api/roblox/designs/${id}`);
  }

  async saveDesign(data: Partial<RobloxDesign>): Promise<{ success: boolean; id: string; design: RobloxDesign }> {
    const baseUrl = await this.getBaseUrl();
    return apiService.post(baseUrl, '/api/roblox/designs', data);
  }

  async updateDesign(id: string, data: Partial<RobloxDesign>, userId?: string): Promise<{ success: boolean; design: RobloxDesign }> {
    const baseUrl = await this.getBaseUrl();
    let endpoint = `/api/roblox/designs/${id}`;
    if (userId) endpoint += `?user_id=${encodeURIComponent(userId)}`;
    return apiService.put(baseUrl, endpoint, data);
  }

  async deleteDesign(id: string, userId?: string): Promise<{ success: boolean }> {
    const baseUrl = await this.getBaseUrl();
    let endpoint = `/api/roblox/designs/${id}`;
    if (userId) endpoint += `?user_id=${encodeURIComponent(userId)}`;
    return apiService.delete(baseUrl, endpoint);
  }

  async generateDesign(req: GenerateDesignRequest): Promise<any> {
    const baseUrl = await this.getBaseUrl();
    return apiService.post(baseUrl, '/api/roblox/generate-design', req);
  }

  getDownloadUrl(designId: string): string {
    // This needs to be called differently since it returns a file
    return `/api/roblox/designs/${designId}/download`;
  }

  async downloadDesign(designId: string): Promise<void> {
    const baseUrl = await this.getBaseUrl();
    const authToken = import.meta.env.VITE_AUTH_TOKEN;
    const url = `${baseUrl}/api/roblox/designs/${designId}/download`;

    const response = await fetch(url, {
      headers: { Authorization: `Token ${authToken}` }
    });

    if (!response.ok) throw new Error('Download failed');

    const blob = await response.blob();
    const downloadUrl = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = downloadUrl;
    const disposition = response.headers.get('content-disposition');
    const filename = disposition?.match(/filename="?(.+)"?/)?.[1] || 'design.zip';
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(downloadUrl);
  }
}

export const robloxService = new RobloxService();