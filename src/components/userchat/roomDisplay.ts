// src/components/userchat/roomDisplay.ts
//
// The four presentation rules that three components have to agree on: the room
// list row, the thread header and the details panel all name and colour a room
// the same way, and a row that says "Sara Odeh" over a header that says
// "Conversation" is the sort of thing that reads as two different pages.
//
// Pure functions on purpose — no store, no service, no network — so they can be
// called from a computed in any of them.

import type { ChatRoom } from '@/services/userchat.service';

/**
 * What to call a room.
 *
 * A direct room has no name of its own; it is rendered as the *other person*,
 * which is why the member list rides along on every room in the list payload.
 */
export function displayName(room: ChatRoom | null, userId: string): string {
  if (!room) return '';
  if (room.kind !== 'direct') return room.name || 'Group';
  const other = (room.members || []).find(m => m.user_id !== userId);
  return other?.username || other?.full_name || 'Conversation';
}

/**
 * Whose face to show on a room.
 *
 * A one-to-one conversation is the other person, so their id drives both the
 * avatar lookup and the fallback colour. A group has no single face, so it gets
 * the room id — which keeps its colour stable across renders — and the caller
 * passes `:lookup="false"`, because a room id is not a user and asking app 13
 * about it would cache a miss for ever.
 */
export function otherPartyId(room: ChatRoom | null, userId: string): string {
  if (!room) return '';
  if (room.kind !== 'direct') return room.room_id;
  const other = (room.members || []).find(m => m.user_id !== userId);
  return other?.user_id || room.room_id;
}

/** The room list's right-hand timestamp: a time today, a weekday this week, a
 *  date before that. Never a full timestamp — the column is 40px wide. */
export function shortWhen(value?: string): string {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const now = new Date();
  if (date.toDateString() === now.toDateString()) {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  if (date.toDateString() === yesterday.toDateString()) return 'Yesterday';
  if (now.getTime() - date.getTime() < 7 * 86400000) {
    return date.toLocaleDateString([], { weekday: 'short' });
  }
  return date.toLocaleDateString([], { day: 'numeric', month: 'short' });
}

/** The transcript's day divider. */
export function dayLabel(value?: string): string {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const now = new Date();
  if (date.toDateString() === now.toDateString()) return 'Today';
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  if (date.toDateString() === yesterday.toDateString()) return 'Yesterday';
  const sameYear = date.getFullYear() === now.getFullYear();
  return date.toLocaleDateString([], sameYear
    ? { weekday: 'long', day: 'numeric', month: 'long' }
    : { day: 'numeric', month: 'long', year: 'numeric' });
}
