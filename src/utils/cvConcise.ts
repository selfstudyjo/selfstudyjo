/**
 * The concise (one-page) view of a CV, for the browser preview.
 *
 * A PORT of `concise_view` in app 33's utils/cvmodel.py - keep the two tables
 * equal, or the preview and the downloaded PDF disagree about what is on the
 * page. Level 0 is what the preview shows; the export may tighten further until
 * the PDF measures one page.
 *
 * NEVER applied to the stored record: switching a CV back to 'detailed' must
 * bring every bullet back. This returns a new object and mutates nothing.
 */
import type { CvRecord } from '@/services/cvbuilder.service';

export const CONCISE_LEVEL0 = {
  fullRoles: 3, bullets: 3, olderBullets: 1, maxRoles: 6, skills: 16,
  groups: 4, sentences: 3, projects: 2, certs: 4, education: 2,
} as const;

export const CONCISE_BULLET_CHARS = 170;

function clip(text: string | undefined, limit: number): string {
  const t = (text || '').trim();
  if (t.length <= limit) return t;
  const head = t.slice(0, limit);
  const cut = head.slice(0, Math.max(0, head.lastIndexOf(' '))).replace(/[,;:-]+$/, '');
  return (cut || head) + '…';
}

function sentences(text: string | undefined, count: number): string {
  return (text || '').trim().split(/(?<=[.!?؟。])\s+/).filter(Boolean).slice(0, count).join(' ');
}

export function conciseView<T extends Partial<CvRecord>>(cv: T): T {
  const L = CONCISE_LEVEL0;
  const view: any = { ...cv };
  view.personal = { ...(cv.personal || {}) };
  view.personal.summary = clip(sentences(view.personal.summary, L.sentences), 520);

  view.experience = (cv.experience || []).slice(0, L.maxRoles).map((role: any, i: number) => {
    const keep = i < L.fullRoles ? L.bullets : L.olderBullets;
    let bullets = (role.bullets || []).map((b: string) => clip(b, CONCISE_BULLET_CHARS)).slice(0, keep);
    if (!bullets.length && keep && role.description) {
      bullets = [clip(sentences(role.description, 1), CONCISE_BULLET_CHARS)];
    }
    // Tools are named in Skills only - that is the point of a concise CV.
    return { ...role, bullets, description: '', tech: [] };
  });

  const jd = ((cv as any).job_target?.job_description || '').toLowerCase();
  let budget: number = L.skills;
  view.skills = [];
  for (const group of (cv.skills || []).slice(0, L.groups) as any[]) {
    let items: string[] = [...(group.items || [])];
    if (jd) items.sort((a, b) => Number(!jd.includes(String(a).toLowerCase())) - Number(!jd.includes(String(b).toLowerCase())));
    items = items.slice(0, Math.max(0, budget));
    budget -= items.length;
    if (items.length) view.skills.push({ ...group, items });
  }
  view.projects = (cv.projects || []).slice(0, L.projects);
  view.certifications = (cv.certifications || []).slice(0, L.certs);
  view.education = (cv.education || []).slice(0, L.education);
  return view as T;
}
