// src/store/userchat.ts
//
// The room list, the unread badge, and the sound.
//
// Kept in a store rather than in the Messages page because two things have to
// outlive that page: the sidebar badge, which has to be right whichever screen
// the user is on, and the chime, which is the whole point of a notification —
// you are not looking at the chat when it matters.
//
// Three decisions worth knowing:
//
// 1. **One poll for every room.** `GET /api/userchat/unread/` answers for all of
//    them at once, so a user in twenty conversations costs one request per tick
//    rather than twenty. The tick slows down when the tab is hidden and stops
//    entirely when the user logs out.
// 2. **The chime is unlocked by a user gesture, once.** Browsers refuse
//    `audio.play()` that no interaction led to, and the refusal is a rejected
//    promise rather than an error anyone sees — so a chime that was never primed
//    simply never sounds, silently, and looks like a broken feature. `primeAudio`
//    is wired to the first click of the session.
// 3. **It does not ring for everything.** Not for your own messages, not for a
//    muted room, and not for the room you are currently reading with the window
//    focused. A notification for something already on screen is noise, and noise
//    is what makes people turn notifications off.

import { defineStore } from 'pinia';
import { computed, ref } from 'vue';

import { userChatService, type UnreadSummary } from '@/services/userchat.service';

const SOUND_KEY = 'selfstudy.userchat.sound';

/**
 * The chime, reusing the asset the support widget already ships.
 *
 * Deliberately the *same* file `ChatBox.vue` plays rather than a second sound of
 * its own. Two reasons, and the second is the one that decided it: "a message
 * arrived" should sound the same wherever it came from, and this file is already
 * in the bundle for the support chat, so reusing it costs nothing while a second
 * chime would add its own weight for a worse result.
 *
 * `new URL(..., import.meta.url)` rather than a path under `public/`: that is
 * what puts the asset through Vite's fingerprinting, so it is cached properly and
 * cannot 404 after a deploy under a different base path. Same call as ChatBox.
 */
const CHIME_URL = new URL('@/assets/audio/selfstudy_newmessage.mp3', import.meta.url).href;

/** How often the badge refreshes. Slower than the in-room live poll on purpose:
 *  this is "has anything happened anywhere", not "is somebody typing". */
const POLL_VISIBLE_MS = 12000;
/** A hidden tab still polls, because the chime is the reason it exists — just
 *  much less often, so twenty background tabs are not twenty pollers. */
const POLL_HIDDEN_MS = 45000;

export const useUserChatStore = defineStore('userchat', () => {
    const summary = ref<UnreadSummary | null>(null);
    const totalUnread = ref(0);
    const loading = ref(false);
    const lastError = ref('');

    /** The room whose thread is open, so the poller knows not to ring for it. */
    const activeRoomId = ref('');

    const soundEnabled = ref(readSoundPreference());
    let chime: HTMLAudioElement | null = null;
    let primed = false;

    let timer: number | null = null;
    let currentUserId = '';
    /** Per room, what we last saw. A rise here is what "a new message" means —
     *  comparing the total alone would miss one room clearing while another
     *  gained, which is exactly what happens when somebody reads one chat while
     *  another is active. */
    let seen = new Map<string, number>();
    let firstLoad = true;

    function readSoundPreference(): boolean {
        try {
            return localStorage.getItem(SOUND_KEY) !== 'off';
        } catch {
            return true;
        }
    }

    function setSoundEnabled(value: boolean) {
        soundEnabled.value = value;
        try {
            localStorage.setItem(SOUND_KEY, value ? 'on' : 'off');
        } catch {
            // Private browsing. The preference simply does not persist.
        }
        if (value) primeAudio();
    }

    /**
     * Make the chime playable.
     *
     * Must be called from a real user gesture. Playing it muted and immediately
     * pausing is the standard way to satisfy an autoplay policy without the user
     * hearing anything: the element is then "activated" for the rest of the page's
     * life and later `play()` calls succeed.
     */
    function primeAudio() {
        if (primed) return;
        try {
            if (!chime) {
                chime = new Audio(CHIME_URL);
                chime.preload = 'auto';
            }
            chime.muted = true;
            const attempt = chime.play();
            if (attempt && typeof attempt.then === 'function') {
                attempt.then(() => {
                    chime!.pause();
                    chime!.currentTime = 0;
                    chime!.muted = false;
                    primed = true;
                }).catch(() => {
                    chime!.muted = false;
                });
            } else {
                chime.pause();
                chime.muted = false;
                primed = true;
            }
        } catch {
            chime = null;
        }
    }

    function ring() {
        if (!soundEnabled.value) return;
        try {
            if (!chime) {
                chime = new Audio(CHIME_URL);
            }
            chime.currentTime = 0;
            // A rejected play() is the normal outcome before the first gesture and
            // is not worth surfacing — the badge still updates either way.
            chime.play()?.catch(() => undefined);
        } catch {
            // No audio device, or the file is missing. Never fatal.
        }
    }

    /**
     * Whether this refresh should make a sound.
     *
     * Pure and separated out because the rule has four clauses and every one of
     * them is a complaint somebody would otherwise make: do not ring on the first
     * load of the session (everything unread is "new" then), do not ring for a
     * muted room, do not ring for the room being read in a focused window, and
     * only ring when a room's count has actually *risen*.
     */
    function shouldRing(next: UnreadSummary): boolean {
        if (firstLoad) return false;
        const readingNow = activeRoomId.value && !document.hidden;
        for (const row of next.results || []) {
            if (row.muted) continue;
            if (readingNow && row.room_id === activeRoomId.value) continue;
            if (row.unread > (seen.get(row.room_id) ?? 0)) return true;
        }
        return false;
    }

    async function refresh(userId?: string): Promise<void> {
        const target = userId || currentUserId;
        if (!target) return;
        currentUserId = target;
        loading.value = true;
        try {
            const next = await userChatService.unreadSummary(target);
            if (shouldRing(next)) ring();

            seen = new Map((next.results || []).map(r => [r.room_id, r.unread]));
            summary.value = next;
            totalUnread.value = (next.results || [])
                .filter(r => !r.muted)
                .reduce((sum, r) => sum + r.unread, 0);
            lastError.value = '';
            firstLoad = false;
        } catch (error: any) {
            // A failed badge refresh is not worth a visible error: the next tick
            // almost always works, and a toast every twelve seconds on a flaky
            // connection would be worse than a stale number.
            lastError.value = error?.message || 'Could not refresh messages';
        } finally {
            loading.value = false;
        }
    }

    function start(userId: string) {
        if (!userId) return;
        currentUserId = userId;
        firstLoad = true;
        stop();
        refresh(userId);
        schedule();
        document.addEventListener('visibilitychange', onVisibility);
    }

    function schedule() {
        if (timer) window.clearTimeout(timer);
        timer = window.setTimeout(async () => {
            await refresh();
            schedule();
        }, document.hidden ? POLL_HIDDEN_MS : POLL_VISIBLE_MS);
    }

    function onVisibility() {
        // Coming back to the tab should feel immediate rather than waiting out
        // whatever remains of a 45-second hidden interval.
        if (!document.hidden) refresh();
        schedule();
    }

    function stop() {
        if (timer) window.clearTimeout(timer);
        timer = null;
        document.removeEventListener('visibilitychange', onVisibility);
    }

    function reset() {
        stop();
        summary.value = null;
        totalUnread.value = 0;
        activeRoomId.value = '';
        currentUserId = '';
        seen = new Map();
        firstLoad = true;
        // Object URLs pin their blobs in memory until revoked, and a long session
        // that scrolled through a lot of pictures will be holding all of them.
        userChatService.revokeAttachments();
    }

    /** Called by the thread when a room is opened or closed, so the poller knows
     *  which room not to ring for and can clear its count locally without waiting
     *  for the next tick. */
    function setActiveRoom(roomId: string) {
        activeRoomId.value = roomId;
        if (roomId) markLocallyRead(roomId);
    }

    function markLocallyRead(roomId: string) {
        seen.set(roomId, 0);
        if (summary.value) {
            const row = summary.value.results?.find(r => r.room_id === roomId);
            if (row) row.unread = 0;
            totalUnread.value = (summary.value.results || [])
                .filter(r => !r.muted)
                .reduce((sum, r) => sum + r.unread, 0);
        }
    }

    const badge = computed(() =>
        totalUnread.value > 99 ? '99+' : String(totalUnread.value));

    return {
        summary,
        totalUnread,
        badge,
        loading,
        lastError,
        activeRoomId,
        soundEnabled,

        start,
        stop,
        reset,
        refresh,
        setActiveRoom,
        markLocallyRead,
        setSoundEnabled,
        primeAudio,
        ring,
    };
});
