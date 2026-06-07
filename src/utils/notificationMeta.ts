// src/utils/notificationMeta.ts
// Helper to embed/extract structured "action" metadata inside a notification
// message, since the notification backend only stores plain text fields.

export interface NotificationAction {
  type: string; // 'approve_payment' | 'ignore_payment' | 'view_course' | 'view_appointment' | 'view_plans'
  label?: string;
  [key: string]: any;
}

export interface NotificationMeta {
  actions?: NotificationAction[];
  [key: string]: any;
}

const META_START = '<!--SSJO_META:';
const META_END = ':SSJO_META-->';

export function encodeNotificationMessage(message: string, meta?: NotificationMeta | null): string {
  if (!meta || Object.keys(meta).length === 0) return message;
  try {
    const json = JSON.stringify(meta);
    return `${message}\n${META_START}${json}${META_END}`;
  } catch {
    return message;
  }
}

export function decodeNotificationMessage(raw: string): { message: string; meta: NotificationMeta | null } {
  if (!raw) return { message: '', meta: null };
  const startIdx = raw.indexOf(META_START);
  const endIdx = raw.indexOf(META_END);
  if (startIdx !== -1 && endIdx !== -1 && endIdx > startIdx) {
    const jsonStr = raw.substring(startIdx + META_START.length, endIdx);
    const cleanMessage = raw.substring(0, startIdx).trim();
    try {
      const meta = JSON.parse(jsonStr) as NotificationMeta;
      return { message: cleanMessage || raw, meta };
    } catch {
      return { message: cleanMessage || raw, meta: null };
    }
  }
  return { message: raw, meta: null };
}