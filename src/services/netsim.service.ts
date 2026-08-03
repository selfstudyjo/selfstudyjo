/**
 * src/services/netsim.service.ts
 * Domain layer for the Network Simulator: projects, profiles, learning progress
 * and community sharing, all persisted as JSON in the
 * `selfstudynetworksimulator_data` repo through `netsimStorage`.
 *
 * Everything here is resilient by design: if the repo is unreachable (or no
 * token is configured) the same calls succeed against the localStorage mirror
 * and report `local: true`, so the studio never blocks on the network.
 */

import { netsimStorage, paths, safeUser } from './netsim-storage.service';
import type {
    NetSimProject, ProjectIndex, ProjectSummary, NetSimUserProfile,
    NetSimProgress, Topology, Difficulty,
} from '@/netsim/types';
import { createTopology, sanitizeForStorage, cloneTopology, topologyStats } from '@/netsim/topology';
import { BADGES } from '@/netsim/lessons';

function nowIso(): string {
    return new Date().toISOString();
}

function newId(prefix: string): string {
    return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

export interface SaveResult {
    ok: boolean;
    local?: boolean;
    error?: string;
    project?: NetSimProject;
}

class NetSimService {
    /* ══════════════ profile ══════════════ */

    defaultProfile(username: string, displayName?: string, email?: string): NetSimUserProfile {
        return {
            username: safeUser(username),
            displayName: displayName || username,
            email,
            createdAt: nowIso(),
            updatedAt: nowIso(),
            preferences: {
                theme: 'midnight',
                showGrid: true,
                snapToGrid: true,
                animationSpeed: 1,
                autoSave: true,
                cliFont: 13,
                defaultCable: 'straight-through',
            },
            stats: {
                projects: 0,
                simulationsRun: 0,
                packetsSent: 0,
                lessonsCompleted: 0,
                devicesPlaced: 0,
                minutesInStudio: 0,
            },
        };
    }

    async getProfile(username: string, seed?: { displayName?: string; email?: string }): Promise<NetSimUserProfile> {
        const file = await netsimStorage.getJson<NetSimUserProfile>(paths.profile(username));
        if (file?.data) {
            // Merge forward so new preference keys appear for existing users.
            const base = this.defaultProfile(username, seed?.displayName, seed?.email);
            return {
                ...base,
                ...file.data,
                preferences: { ...base.preferences, ...(file.data.preferences || {}) },
                stats: { ...base.stats, ...(file.data.stats || {}) },
            };
        }
        const fresh = this.defaultProfile(username, seed?.displayName, seed?.email);
        await netsimStorage.putJson(paths.profile(username), fresh, `netsim: create profile for ${safeUser(username)}`);
        return fresh;
    }

    async saveProfile(profile: NetSimUserProfile): Promise<{ ok: boolean; local?: boolean; error?: string }> {
        profile.updatedAt = nowIso();
        return netsimStorage.putJson(paths.profile(profile.username), profile, `netsim: update profile for ${profile.username}`);
    }

    async bumpStats(username: string, delta: Partial<NetSimUserProfile['stats']>): Promise<void> {
        const profile = await this.getProfile(username);
        for (const [k, v] of Object.entries(delta)) {
            (profile.stats as any)[k] = ((profile.stats as any)[k] || 0) + (v || 0);
        }
        await this.saveProfile(profile);
    }

    /* ══════════════ projects ══════════════ */

    async listProjects(username: string): Promise<{ projects: ProjectSummary[]; local: boolean }> {
        const file = await netsimStorage.getJson<ProjectIndex>(paths.projectIndex(username));
        if (file?.data?.projects) {
            return {
                projects: [...file.data.projects].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)),
                local: !!file.local,
            };
        }
        // Rebuild the index from whatever the local mirror knows about.
        const prefix = `${paths.projectsDir(username)}/`;
        const localProjects: ProjectSummary[] = [];
        for (const p of netsimStorage.localPaths(prefix)) {
            if (p.endsWith('/index.json')) continue;
            const cached = await netsimStorage.getJson<NetSimProject>(p);
            if (cached?.data) localProjects.push(this.summarize(cached.data));
        }
        return { projects: localProjects.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)), local: true };
    }

    private summarize(p: NetSimProject): ProjectSummary {
        const stats = topologyStats(p.topology);
        return {
            id: p.id,
            name: p.name,
            description: p.description,
            owner: p.owner,
            tags: p.tags || [],
            difficulty: p.difficulty || 'beginner',
            deviceCount: stats.devices,
            linkCount: stats.links,
            createdAt: p.createdAt,
            updatedAt: p.updatedAt,
            shared: !!p.shared,
            lessonId: p.lessonId,
            thumbnail: p.thumbnail,
        };
    }

    async getProject(username: string, projectId: string): Promise<NetSimProject | null> {
        const file = await netsimStorage.getJson<NetSimProject>(paths.project(username, projectId));
        if (!file?.data) return null;
        // Defensive: an old or hand-edited file might be missing the canvas block.
        const p = file.data;
        if (!p.topology) return null;
        const canvas = p.topology.canvas || ({} as Partial<Topology['canvas']>);
        p.topology.canvas = {
            zoom: canvas.zoom ?? 1,
            panX: canvas.panX ?? 0,
            panY: canvas.panY ?? 0,
            grid: canvas.grid ?? true,
            snap: canvas.snap ?? true,
        };
        p.topology.annotations = p.topology.annotations || [];
        return p;
    }

    createProject(o: {
        owner: string;
        name: string;
        description?: string;
        topology?: Topology;
        tags?: string[];
        difficulty?: Difficulty;
        lessonId?: string;
    }): NetSimProject {
        const topology = o.topology ? cloneTopology(o.topology) : createTopology(o.name, o.description || '');
        topology.name = o.name;
        topology.description = o.description || topology.description;
        const stats = topologyStats(topology);
        return {
            id: newId('proj'),
            name: o.name,
            description: o.description || '',
            owner: safeUser(o.owner),
            tags: o.tags || [],
            difficulty: o.difficulty || 'beginner',
            deviceCount: stats.devices,
            linkCount: stats.links,
            createdAt: nowIso(),
            updatedAt: nowIso(),
            shared: false,
            lessonId: o.lessonId,
            topology,
            aiHistory: [],
            checkpoints: [],
        };
    }

    async saveProject(username: string, project: NetSimProject): Promise<SaveResult> {
        const owner = safeUser(username);
        project.owner = owner;
        project.updatedAt = nowIso();
        const stats = topologyStats(project.topology);
        project.deviceCount = stats.devices;
        project.linkCount = stats.links;

        const payload: NetSimProject = {
            ...project,
            topology: sanitizeForStorage(project.topology),
            // Keep the conversation, but do not let it grow without bound.
            aiHistory: (project.aiHistory || []).slice(-60),
            checkpoints: (project.checkpoints || []).slice(-10).map(c => ({ ...c, topology: sanitizeForStorage(c.topology) })),
        };

        const write = await netsimStorage.putJson(
            paths.project(owner, project.id),
            payload,
            `netsim: save project "${project.name}" (${owner})`
        );

        await this.updateIndex(owner, this.summarize(project));

        return { ok: write.ok, local: write.local, error: write.error, project };
    }

    private async updateIndex(owner: string, summary: ProjectSummary): Promise<void> {
        const file = await netsimStorage.getJson<ProjectIndex>(paths.projectIndex(owner));
        const index: ProjectIndex = file?.data || { owner, updatedAt: nowIso(), projects: [] };
        index.owner = owner;
        index.updatedAt = nowIso();
        index.projects = [summary, ...(index.projects || []).filter(p => p.id !== summary.id)];
        await netsimStorage.putJson(paths.projectIndex(owner), index, `netsim: update project index (${owner})`);
    }

    async deleteProject(username: string, projectId: string): Promise<{ ok: boolean; error?: string }> {
        const owner = safeUser(username);
        const res = await netsimStorage.deletePath(paths.project(owner, projectId), `netsim: delete project ${projectId} (${owner})`);

        const file = await netsimStorage.getJson<ProjectIndex>(paths.projectIndex(owner));
        if (file?.data) {
            file.data.projects = (file.data.projects || []).filter(p => p.id !== projectId);
            file.data.updatedAt = nowIso();
            await netsimStorage.putJson(paths.projectIndex(owner), file.data, `netsim: update project index (${owner})`);
        }
        return res;
    }

    async duplicateProject(username: string, projectId: string, newName?: string): Promise<NetSimProject | null> {
        const original = await this.getProject(username, projectId);
        if (!original) return null;
        const copy = this.createProject({
            owner: username,
            name: newName || `${original.name} (copy)`,
            description: original.description,
            topology: original.topology,
            tags: original.tags,
            difficulty: original.difficulty,
            lessonId: original.lessonId,
        });
        await this.saveProject(username, copy);
        return copy;
    }

    async renameProject(username: string, projectId: string, name: string, description?: string): Promise<boolean> {
        const p = await this.getProject(username, projectId);
        if (!p) return false;
        p.name = name;
        if (description !== undefined) p.description = description;
        p.topology.name = name;
        const r = await this.saveProject(username, p);
        return r.ok;
    }

    /** Snapshot the current topology so a student can experiment safely. */
    async addCheckpoint(username: string, project: NetSimProject, label: string): Promise<NetSimProject> {
        project.checkpoints = [
            ...(project.checkpoints || []),
            { id: newId('cp'), label, at: nowIso(), topology: cloneTopology(project.topology) },
        ].slice(-10);
        await this.saveProject(username, project);
        return project;
    }

    /* ══════════════ learning progress ══════════════ */

    defaultProgress(username: string): NetSimProgress {
        return {
            username: safeUser(username),
            updatedAt: nowIso(),
            completedLessons: [],
            lessonScores: {},
            badges: [],
            xp: 0,
        };
    }

    async getProgress(username: string): Promise<NetSimProgress> {
        const file = await netsimStorage.getJson<NetSimProgress>(paths.progress(username));
        if (file?.data) {
            return { ...this.defaultProgress(username), ...file.data };
        }
        return this.defaultProgress(username);
    }

    async saveProgress(progress: NetSimProgress): Promise<{ ok: boolean; local?: boolean; error?: string }> {
        progress.updatedAt = nowIso();
        progress.badges = BADGES.filter(b => b.requires({ completedLessons: progress.completedLessons, xp: progress.xp })).map(b => b.id);
        return netsimStorage.putJson(paths.progress(progress.username), progress, `netsim: update progress (${progress.username})`);
    }

    async recordLessonAttempt(username: string, lessonId: string, score: number): Promise<NetSimProgress> {
        const progress = await this.getProgress(username);
        const prev = progress.lessonScores[lessonId];
        const attempts = (prev?.attempts || 0) + 1;
        const best = Math.max(prev?.score || 0, score);

        progress.lessonScores[lessonId] = {
            score: best,
            attempts,
            completedAt: score >= 100 ? nowIso() : (prev?.completedAt || ''),
        };

        if (score >= 100 && !progress.completedLessons.includes(lessonId)) {
            progress.completedLessons.push(lessonId);
            progress.xp += 100;
            await this.bumpStats(username, { lessonsCompleted: 1 });
        } else if (score > (prev?.score || 0)) {
            progress.xp += Math.max(0, Math.round((score - (prev?.score || 0)) / 4));
        }

        await this.saveProgress(progress);
        return progress;
    }

    /* ══════════════ sharing ══════════════ */

    async shareProject(username: string, project: NetSimProject): Promise<{ ok: boolean; error?: string }> {
        const payload: NetSimProject = {
            ...project,
            shared: true,
            owner: safeUser(username),
            topology: sanitizeForStorage(project.topology),
            aiHistory: [],
            checkpoints: [],
        };
        const write = await netsimStorage.putJson(paths.shared(project.id), payload, `netsim: share "${project.name}" by ${safeUser(username)}`);
        if (!write.ok) return { ok: false, error: write.error };

        const file = await netsimStorage.getJson<{ updatedAt: string; projects: ProjectSummary[] }>(paths.sharedIndex());
        const index = file?.data || { updatedAt: nowIso(), projects: [] };
        index.updatedAt = nowIso();
        index.projects = [this.summarize(payload), ...(index.projects || []).filter(p => p.id !== project.id)].slice(0, 400);
        await netsimStorage.putJson(paths.sharedIndex(), index, 'netsim: update shared index');

        project.shared = true;
        await this.saveProject(username, project);
        return { ok: true };
    }

    async unshareProject(username: string, projectId: string): Promise<{ ok: boolean; error?: string }> {
        const res = await netsimStorage.deletePath(paths.shared(projectId), `netsim: unshare ${projectId}`);
        const file = await netsimStorage.getJson<{ updatedAt: string; projects: ProjectSummary[] }>(paths.sharedIndex());
        if (file?.data) {
            file.data.projects = (file.data.projects || []).filter(p => p.id !== projectId);
            file.data.updatedAt = nowIso();
            await netsimStorage.putJson(paths.sharedIndex(), file.data, 'netsim: update shared index');
        }
        const p = await this.getProject(username, projectId);
        if (p) { p.shared = false; await this.saveProject(username, p); }
        return res;
    }

    async listSharedProjects(): Promise<ProjectSummary[]> {
        const file = await netsimStorage.getJson<{ projects: ProjectSummary[] }>(paths.sharedIndex());
        return (file?.data?.projects || []).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
    }

    async getSharedProject(projectId: string): Promise<NetSimProject | null> {
        const file = await netsimStorage.getJson<NetSimProject>(paths.shared(projectId));
        return file?.data || null;
    }

    /** Copy a community project into the current user's own space. */
    async cloneSharedProject(username: string, projectId: string): Promise<NetSimProject | null> {
        const shared = await this.getSharedProject(projectId);
        if (!shared) return null;
        const copy = this.createProject({
            owner: username,
            name: `${shared.name} (from ${shared.owner})`,
            description: shared.description,
            topology: shared.topology,
            tags: shared.tags,
            difficulty: shared.difficulty,
        });
        await this.saveProject(username, copy);
        return copy;
    }

    /* ══════════════ AI conversations ══════════════ */

    async saveAiSession(username: string, sessionId: string, payload: {
        title: string;
        messages: Array<{ role: string; content: string; at: string }>;
        projectId?: string;
    }): Promise<void> {
        await netsimStorage.putJson(paths.aiSession(username, sessionId), {
            id: sessionId, ...payload, updatedAt: nowIso(),
        }, `netsim: save AI session ${sessionId}`);
    }

    async getAiSession(username: string, sessionId: string): Promise<any | null> {
        const file = await netsimStorage.getJson<any>(paths.aiSession(username, sessionId));
        return file?.data || null;
    }

    /* ══════════════ storage status passthrough ══════════════ */

    storageStatus() {
        return netsimStorage.status();
    }

    testStorage() {
        return netsimStorage.testConnection();
    }
}

export const netsimService = new NetSimService();
