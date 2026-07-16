// src/services/roblox.service.ts
import { apiService } from './api';
import { serviceRegistry } from './config';

export interface PartData {
  name: string;
  partType: string;
  shape: string;
  size: { x: number; y: number; z: number };
  position: { x: number; y: number; z: number };
  rotation: { x: number; y: number; z: number };
  color: string;
  material: string;
  transparency: number;
  reflectance: number;
  anchored: boolean;
  canCollide: boolean;
  effects: Array<{ type: string; properties: Record<string, any> }>;
  animationScript: string;
  killOnTouch: boolean;
  children: PartData[];
  // UI-only fields
  _uid?: string;
  _expanded?: boolean;
}

export interface ThreeAnimParams {
  type: string;
  axis?: string;
  speed?: number;
  distance?: number;
  duration?: number;
  style?: string;
  reverses?: boolean;
  amplitude?: number;
  frequency?: number;
  offset?: number;
  height?: number;
  decay?: number;
  intensity?: number;
  expressions?: Record<string, string>;
}

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
  threeAnimParams: ThreeAnimParams | Record<string, string>;
  created_by: string;
  created_by_username?: string;
  created_at: string;
  updated_at?: string;
}

export interface UserAnimation {
  id: string;
  user_id: string;
  username: string;
  name: string;
  category: string;
  icon: string;
  color: string;
  description: string;
  bestFor: string;
  looping: boolean;
  duration: number;
  luaCode: string;
  threeAnimParams: ThreeAnimParams | Record<string, string>;
  created_at: string;
}

export interface RobloxDesign {
  id: string;
  user_id: string;
  username: string;
  name: string;
  description: string;
  parts: PartData[];
  luaCode: string;
  modelAnimationScript: string;
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
  threeAnimParams: ThreeAnimParams | Record<string, string>;
}

export interface GenerateDesignResult {
  name: string;
  description: string;
  parts: PartData[];
  luaCode: string;
  modelAnimationScript: string;
}

let _uidCounter = 0;
function genUid(): string {
  _uidCounter++;
  return `_uid_${Date.now()}_${_uidCounter}`;
}

export function makeDefaultPart(overrides?: Partial<PartData>): PartData {
  return {
    name: 'Part',
    partType: 'Part',
    shape: 'Block',
    size: { x: 4, y: 4, z: 4 },
    position: { x: 0, y: 2, z: 0 },
    rotation: { x: 0, y: 0, z: 0 },
    color: '#4488ff',
    material: 'SmoothPlastic',
    transparency: 0,
    reflectance: 0,
    anchored: true,
    canCollide: true,
    effects: [],
    animationScript: '',
    killOnTouch: false,
    children: [],
    _uid: genUid(),
    _expanded: true,
    ...overrides,
  };
}

/** Recursively assign _uid to all parts and children */
export function assignUids(parts: PartData[]): void {
  for (const p of parts) {
    if (!p._uid) p._uid = genUid();
    if (p._expanded === undefined) p._expanded = true;
    if (!p.children) p.children = [];
    if (!p.effects) p.effects = [];
    if (p.animationScript === undefined) p.animationScript = '';
    if (p.killOnTouch === undefined) p.killOnTouch = false;
    assignUids(p.children);
  }
}

/** Flatten tree into array of {part, depth, parentUid} for rendering */
export interface FlatPart {
  part: PartData;
  depth: number;
  parentUid: string | null;
  index: number; // index within parent's children array
}

export function flattenParts(parts: PartData[], depth = 0, parentUid: string | null = null): FlatPart[] {
  const result: FlatPart[] = [];
  for (let i = 0; i < parts.length; i++) {
    const p = parts[i];
    result.push({ part: p, depth, parentUid, index: i });
    if (p._expanded && p.children && p.children.length > 0) {
      result.push(...flattenParts(p.children, depth + 1, p._uid || null));
    }
  }
  return result;
}

/** Find a part by _uid in the tree */
export function findPartByUid(parts: PartData[], uid: string): PartData | null {
  for (const p of parts) {
    if (p._uid === uid) return p;
    if (p.children) {
      const found = findPartByUid(p.children, uid);
      if (found) return found;
    }
  }
  return null;
}

/** Remove a part by _uid from the tree. Returns true if removed. */
export function removePartByUid(parts: PartData[], uid: string): boolean {
  for (let i = 0; i < parts.length; i++) {
    if (parts[i]._uid === uid) {
      parts.splice(i, 1);
      return true;
    }
    if (parts[i].children && removePartByUid(parts[i].children, uid)) {
      return true;
    }
  }
  return false;
}

/** Collect all parts recursively into a flat list (for iteration) */
export function collectAllParts(parts: PartData[]): PartData[] {
  const result: PartData[] = [];
  for (const p of parts) {
    result.push(p);
    if (p.children) result.push(...collectAllParts(p.children));
  }
  return result;
}

/** Strip _uid and _expanded before sending to backend */
function stripUiFields(parts: PartData[]): any[] {
  return parts.map(p => {
    const { _uid, _expanded, children, ...rest } = p;
    return {
      ...rest,
      children: children ? stripUiFields(children) : [],
    };
  });
}

class RobloxService {
  private async getBaseUrl(): Promise<string> {
    const url = await serviceRegistry.getRandomRobloxReplica();
    if (!url) throw new Error('No Roblox service replicas available');
    return url;
  }

  // ─── System Animations ───
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

  // ─── User Animations ───
  async getUserAnimations(userId: string): Promise<UserAnimation[]> {
    const baseUrl = await this.getBaseUrl();
    return apiService.get<UserAnimation[]>(baseUrl, `/api/roblox/user-animations?user_id=${encodeURIComponent(userId)}`);
  }

  async createUserAnimation(data: Partial<UserAnimation>): Promise<{ success: boolean; animation: UserAnimation }> {
    const baseUrl = await this.getBaseUrl();
    return apiService.post(baseUrl, '/api/roblox/user-animations', data);
  }

  async deleteUserAnimation(id: string, userId: string): Promise<{ success: boolean }> {
    const baseUrl = await this.getBaseUrl();
    return apiService.delete(baseUrl, `/api/roblox/user-animations/${id}`, { user_id: userId });
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
    const payload = {
      ...data,
      parts: data.parts ? stripUiFields(data.parts) : [],
    };
    const baseUrl = await this.getBaseUrl();
    return apiService.post(baseUrl, '/api/roblox/designs', payload);
  }

  async updateDesign(id: string, data: Partial<RobloxDesign>, userId?: string): Promise<{ success: boolean; design: RobloxDesign }> {
    const payload = {
      ...data,
      parts: data.parts ? stripUiFields(data.parts) : undefined,
    };
    const baseUrl = await this.getBaseUrl();
    let endpoint = `/api/roblox/designs/${id}`;
    if (userId) endpoint += `?user_id=${encodeURIComponent(userId)}`;
    return apiService.put(baseUrl, endpoint, payload);
  }

  async deleteDesign(id: string, userId?: string): Promise<{ success: boolean }> {
    const baseUrl = await this.getBaseUrl();
    return apiService.delete(baseUrl, `/api/roblox/designs/${id}`, userId ? { user_id: userId } : undefined);
  }

  async generateDesign(req: { description: string }): Promise<GenerateDesignResult> {
    const baseUrl = await this.getBaseUrl();
    const result = await apiService.post<any>(baseUrl, '/api/roblox/generate-design', req);

    function normPart(p: any): PartData {
      return makeDefaultPart({
        name: p.name || 'Part',
        partType: p.partType || 'Part',
        shape: p.shape || 'Block',
        size: p.size || { x: 2, y: 2, z: 2 },
        position: p.position || { x: 0, y: 1, z: 0 },
        rotation: p.rotation || { x: 0, y: 0, z: 0 },
        color: p.color || '#888888',
        material: p.material || 'SmoothPlastic',
        transparency: p.transparency ?? 0,
        reflectance: p.reflectance ?? 0,
        anchored: p.anchored !== false,
        canCollide: p.canCollide !== false,
        effects: Array.isArray(p.effects) ? p.effects : [],
        animationScript: p.animationScript || '',
        killOnTouch: !!p.killOnTouch,
        children: Array.isArray(p.children) ? p.children.map(normPart) : [],
      });
    }

    const parts: PartData[] = [];
    if (Array.isArray(result.parts)) {
      for (const p of result.parts) {
        parts.push(normPart(p));
      }
    }
    if (parts.length === 0) {
      parts.push(makeDefaultPart({ name: 'MainPart' }));
    }

    assignUids(parts);

    return {
      name: result.name || 'Custom Object',
      description: result.description || req.description,
      parts,
      luaCode: result.luaCode || '',
      modelAnimationScript: result.modelAnimationScript || '',
    };
  }

  async downloadDesign(designId: string, format: 'zip' | 'rbxm' | 'lua' = 'zip'): Promise<void> {
    const baseUrl = await this.getBaseUrl();
    const authToken = import.meta.env.VITE_AUTH_TOKEN;
    const url = `${baseUrl}/api/roblox/designs/${designId}/download?format=${format}`;

    const response = await fetch(url, {
      headers: { Authorization: `Token ${authToken}` },
    });

    if (!response.ok) {
      const text = await response.text().catch(() => '');
      throw new Error(`Download failed: ${response.status} ${text.slice(0, 200)}`);
    }

    const blob = await response.blob();
    const downloadUrl = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = downloadUrl;
    const disposition = response.headers.get('content-disposition');
    const filename = disposition?.match(/filename="?(.+?)"?$/)?.[1] || `design.${format}`;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(downloadUrl);
  }
}

export const robloxService = new RobloxService();