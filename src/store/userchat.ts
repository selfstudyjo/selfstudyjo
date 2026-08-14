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
// 2. **The chime is unlocked by a user gesture, once, on a CLONE.** Browsers
//    refuse `audio.play()` that no interaction led to, and the refusal is a
//    rejected promise rather than an error anyone sees — so a chime that was never
//    primed simply never sounds, silently, and looks like a broken feature.
//    `primeAudio` is wired to the first click of the session. It warms a clone
//    rather than the element that later rings, because playing the real one muted
//    and then unmuting it races the browser's audio thread and plays an audible
//    fragment on the first click anywhere in the app — a sound with no message
//    behind it, which is the thing being fixed here.
// 3. **It does not ring for everything.** Not for your own messages, not for a
//    muted room, and not for the room you are currently reading with the window
//    focused. A notification for something already on screen is noise, and noise
//    is what makes people turn notifications off.
// 4. **A rise in the count is not enough on its own; the room's own timestamp has
//    to have moved too.** Replication is push-then-repair, so the count this tab
//    is shown can legitimately go backwards and forwards without a single message
//    being sent — and every one of those bounces used to ring:
//
//      - you open a room, `markLocallyRead` sets its count to 0 for a responsive
//        badge, and the next poll comes back from a replica that has not applied
//        the read mark yet. 3 > 0, so it rang — **every time you opened a chat**;
//      - the same thing with the tab hidden, where the "do not ring for the room
//        being read" clause does not apply at all;
//      - a failover between replicas, where the other one's copy is a moment
//        behind.
//
//    So each room remembers two things: the count at the last poll, which moves
//    both ways, and the newest `last_message_at` it has **ever** been told about,
//    which only moves forward. A ring needs both a higher count and a newer
//    message. A stale replica can satisfy the first and never the second.

import { defineStore } from 'pinia';
import { computed, ref } from 'vue';

import { avatarDirectory } from '@/components/userchat/avatarDirectory';
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
    /**
     * Per room, what we last saw. A rise is what "a new message" means —
     * comparing the total alone would miss one room clearing while another
     * gained, which is exactly what happens when somebody reads one chat while
     * another is active.
     *
     * `n` is the count at the last poll and moves both ways. `ts` is the newest
     * `last_message_at` ever seen for that room and only moves forward; it is what
     * makes a lower `n` safe to record, so a replica that is briefly behind cannot
     * be mistaken for an arrival. See note 4 in the header.
     */
    let seen = new Map<string, { n: number; ts: string }>();
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
        primed = true;
        try {
            if (!chime) {
                chime = new Audio(CHIME_URL);
                chime.preload = 'auto';
            }
            // A clone, silenced twice, and never the element that rings. The
            // autoplay policy is scoped to the document rather than to one media
            // element, so warming a throwaway buys the same permission — and it
            // cannot leave the real chime half-played, unmuted, or seeked into the
            // middle of the file. Muting the real one and unmuting it after the
            // promise resolves is a race with the audio thread that plays an
            // audible blip on the first click of the session, which is precisely
            // "a sound with no message behind it".
            const warm = chime.cloneNode(true) as HTMLAudioElement;
            warm.muted = true;
            warm.volume = 0;
            const drop = () => {
                try {
                    warm.pause();
                    warm.src = '';
                } catch {
                    // Nothing to do; the element is being discarded anyway.
                }
            };
            const attempt = warm.play();
            if (attempt && typeof attempt.then === 'function') {
                attempt.then(drop).catch(drop);
            } else {
                drop();
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
     * Pure and separated out because every clause is a complaint somebody would
     * otherwise make: do not ring on the first load of the session (everything
     * unread is "new" then), do not ring for a muted room, do not ring for the
     * room being read in a focused window, and only ring when a room's count has
     * risen **and** its newest message is newer than any this tab has been told
     * about. That last conjunction is the one that matters — see note 4 in the
     * header for the three ways the count alone rings at nothing.
     */
    function shouldRing(next: UnreadSummary): boolean {
        if (firstLoad) return false;
        const readingNow = activeRoomId.value && !document.hidden;
        for (const row of next.results || []) {
            if (row.muted) continue;
            if (readingNow && row.room_id === activeRoomId.value) continue;
            const was = seen.get(row.room_id);
            // A room this tab has never been told about: an unread message in it
            // is somebody starting a conversation, which is exactly a new
            // message. There is no earlier timestamp to compare against.
            if (!was) {
                if (row.unread > 0) return true;
                continue;
            }
            if (row.unread > was.n && String(row.last_message_at || '') > was.ts) {
                return true;
            }
        }
        return false;
    }

    /** Fold this answer into what each room is known to be at. */
    function record(next: UnreadSummary) {
        const fresh = new Map<string, { n: number; ts: string }>();
        for (const row of next.results || []) {
            const was = seen.get(row.room_id);
            const ts = String(row.last_message_at || '');
            fresh.set(row.room_id, {
                n: row.unread,
                // Forward only, so a replica that is behind lowers the count
                // without making the return to an up-to-date one look like an
                // arrival.
                ts: ts > (was?.ts || '') ? ts : (was?.ts || ''),
            });
        }
        seen = fresh;
    }

    async function refresh(userId?: string): Promise<void> {
        const target = userId || currentUserId;
        if (!target) return;
        currentUserId = target;
        loading.value = true;
        try {
            const next = await userChatService.unreadSummary(target);
            if (shouldRing(next)) ring();

            record(next);
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
        // The next person to sign in on this browser must not inherit a
        // directory of other people's faces.
        avatarDirectory.clear();
    }

    /** Called by the thread when a room is opened or closed, so the poller knows
     *  which room not to ring for and can clear its count locally without waiting
     *  for the next tick. */
    function setActiveRoom(roomId: string) {
        activeRoomId.value = roomId;
        if (roomId) markLocallyRead(roomId);
    }

    function markLocallyRead(roomId: string) {
        // The count drops to zero for a responsive badge; `ts` is deliberately
        // kept, and that is what stops the next poll from a replica that has not
        // applied the read mark yet - which is most of them, for the next twenty
        // seconds - from reading 3 > 0 and chiming at somebody for opening a chat.
        seen.set(roomId, { n: 0, ts: seen.get(roomId)?.ts || '' });
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
