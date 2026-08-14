// store/notifications.ts
//
// The bell: the badge, the list, the poller, and the sound.
//
// The poller and the chime live here rather than in `SideNav.vue` — where the
// `setInterval` used to be — for the same reason `store/userchat.ts` owns its
// own: **a notification only matters when you are not looking at it.** The
// sidebar is mounted on every authenticated screen, so it happened to work, but
// nothing said so and the chime had nowhere to live. Now the component asks the
// store to start and draws what it is given.
//
// Five decisions worth knowing:
//
// 1. **"Something new arrived" is not "the unread count went up."** Reading a
//    notification on a phone while another one arrives leaves the count exactly
//    where it was, and the bell would stay silent. So the poll compares
//    `latest_id` — the newest notification in the inbox — and rings when that
//    changes to something the tab has not seen.
//
//    **And a changed `latest_id` is not enough either.** `latest_at` is a
//    high-water mark that only ever moves forward, and a ring needs an id that is
//    new *and* a timestamp past that mark. Everything below is a way the id
//    changes with nothing having arrived, and every one of them used to ring:
//
//      - you delete the newest notification, so the next poll answers with the
//        one behind it: a different id, and an older `created_at`;
//      - the tab fails over to another replica whose tail is a moment behind, and
//        then back again, so the id it was already told about arrives as "new";
//      - a `dismiss` lands on the replica you are pinned to and not yet on its
//        peers, so a pull re-offers the record you just got rid of.
//
//    Recording `latest_at` monotonically makes all three silent while a genuinely
//    newer notification still rings, and it is persisted per user so a reload
//    cannot re-arm what a reload has no business re-arming.
// 2. **The chime is unlocked by a user gesture, once, on a CLONE.** Browsers
//    refuse `audio.play()` that no interaction led to, and the refusal is a
//    rejected promise rather than an error anyone sees — a chime that was never
//    primed simply never sounds and looks like a broken feature. `primeAudio()` is
//    wired to the first click of the session in `SideNav.vue`. It warms a clone
//    because muting the real element, playing it, and unmuting it after the promise
//    resolves is a race with the browser's audio thread: on several builds the
//    unmute lands first and the first click anywhere in the app plays an audible
//    fragment of the chime, which is itself a sound with no notification behind it.
// 3. **It does not ring on the first load of a session.** Everything unread is
//    "new" then, and a chime on sign-in is noise. Noise is what makes people
//    turn notifications off.
// 4. **Delete means delete.** `dismiss()` is the recipient's delete, and the
//    backend decides whether that is a tombstone (they own it) or a state row
//    (an announcement everybody else is still reading). The store does not try
//    to guess, and it no longer refuses to delete a non-personal notification —
//    that refusal was the reason the list filled up with announcements nobody
//    could get rid of.
// 5. **A deleted notification is remembered locally, so it cannot come back.**
//    Replication is push-then-repair: the delete reaches the replica this tab is
//    pinned to immediately and its peers a moment later, and a failover in between
//    reads the record as still there. That is what "I deleted it and it kept
//    reappearing until it was gone from all the replicas" was — nothing was
//    broken, the browser was just believing whichever replica answered. So a
//    dismissed id goes into a short-lived local tombstone set that filters every
//    subsequent answer and discounts the badge. Ten minutes, which is thirty times
//    the pull interval, after which convergence is not in question.

import { defineStore } from 'pinia';
import { computed, ref } from 'vue';
import { notificationService } from '@/services/notification.service';
import type {
    NotificationResponse, NotificationStats,
} from '@/services/notification.service';

/**
 * The chime, the same file `admin_alerts.js` rings in the operator console.
 *
 * Deliberately not `selfstudy_newmessage.mp3`, which the support widget and user
 * chat share: "a person is talking to you" and "the platform has something to
 * tell you" are different events, and a user who hears one sound for both cannot
 * tell from the next room whether it is worth getting up for.
 *
 * `new URL(..., import.meta.url)` rather than a path under `public/`: that is
 * what puts the asset through Vite's fingerprinting, so it is cached properly
 * and cannot 404 after a deploy under a different base path.
 */
const CHIME_URL = new URL('@/assets/audio/selfstudy_notification.mp3', import.meta.url).href;

const SOUND_KEY = 'selfstudy.notifications.sound';
/** Per user: the newest notification this browser has been told about. Persisted
 *  so a reload cannot re-arm the chime for something already seen. */
const HEARD_KEY = 'selfstudy.notifications.heard';
/** Per user: ids this browser has dismissed and may still be offered by a replica
 *  that has not applied the delete yet. */
const TOMB_KEY = 'selfstudy.notifications.removed';

/** How often the bell refreshes while the tab is in front. */
const POLL_VISIBLE_MS = 25000;
/** A hidden tab still polls — the chime is the reason it exists — but much less
 *  often, so twenty background tabs are not twenty pollers. */
const POLL_HIDDEN_MS = 90000;

/** How long a locally-deleted id is remembered. Thirty times the backend's pull
 *  interval, so if the record is still being offered after this the problem is
 *  replication and not this tab. */
const TOMB_TTL_MS = 10 * 60 * 1000;
/** Enough for a "clear all" on a large inbox; bounded so the entry cannot grow
 *  without limit in a browser nobody ever closes. */
const TOMB_MAX = 500;

export const useNotificationStore = defineStore('notifications', () => {
    // State
    const notifications = ref<NotificationResponse[]>([]);
    const unreadCount = ref(0);
    const totalCount = ref(0);
    const generalCount = ref(0);
    const groupCount = ref(0);
    const loading = ref(false);
    const error = ref<string | null>(null);
    const currentPage = ref(1);
    const pageSize = ref(20);
    const hasMore = ref(true);
    const currentUsername = ref<string>('');
    const soundEnabled = ref(readSoundPreference());
    /** The title of whatever arrived last, for a toast or a tooltip. */
    const latestTitle = ref('');

    let timer: number | null = null;
    let chime: HTMLAudioElement | null = null;
    let primed = false;
    let firstLoad = true;
    let lastSeenId = '';
    /** A high-water mark, never a "last value". It only moves forward — see note
     *  1 in the header for the three ways a backwards step rings at nothing. */
    let lastSeenAt = '';
    /** id -> when it was dismissed here. See note 5. */
    let removed = new Map<string, number>();

    // Local storage key
    const getStorageKey = (username: string) => `notifications_${username}`;

    // -- Locally deleted ids -------------------------------------------------

    function readRemoved(username: string) {
        removed = new Map();
        try {
            const raw = localStorage.getItem(`${TOMB_KEY}.${username}`);
            const parsed = raw ? JSON.parse(raw) : null;
            const cutoff = Date.now() - TOMB_TTL_MS;
            if (parsed && typeof parsed === 'object') {
                for (const [id, at] of Object.entries(parsed as Record<string, number>)) {
                    if (Number(at) > cutoff) removed.set(id, Number(at));
                }
            }
        } catch {
            // Private browsing, or a value some earlier version wrote. Starting
            // empty is safe: the worst case is the old behaviour for ten minutes.
        }
    }

    function writeRemoved(username: string) {
        if (!username) return;
        try {
            const cutoff = Date.now() - TOMB_TTL_MS;
            const kept = [...removed.entries()]
                .filter(([, at]) => at > cutoff)
                .sort((a, b) => b[1] - a[1])
                .slice(0, TOMB_MAX);
            removed = new Map(kept);
            localStorage.setItem(`${TOMB_KEY}.${username}`,
                                 JSON.stringify(Object.fromEntries(kept)));
        } catch {
            // The set still works for this tab; it just does not survive a reload.
        }
    }

    function forget(ids: string[]) {
        const at = Date.now();
        for (const id of ids) if (id) removed.set(String(id), at);
        writeRemoved(currentUsername.value);
    }

    function isRemoved(id: unknown): boolean {
        const at = removed.get(String(id ?? ''));
        if (at === undefined) return false;
        if (at > Date.now() - TOMB_TTL_MS) return true;
        removed.delete(String(id));
        return false;
    }

    /** Drop anything this browser has deleted out of a server answer. */
    function withoutRemoved(rows: NotificationResponse[]): NotificationResponse[] {
        if (!removed.size) return rows;
        return rows.filter(n => !isRemoved(n.notification_id));
    }

    /** How many live tombstones there are, for discounting a server count. */
    function removedCount(): number {
        const cutoff = Date.now() - TOMB_TTL_MS;
        let live = 0;
        for (const [id, at] of removed) {
            if (at > cutoff) live += 1;
            else removed.delete(id);
        }
        return live;
    }

    // -- What this browser has already been told about -----------------------

    function readHeard(username: string) {
        lastSeenId = '';
        lastSeenAt = '';
        try {
            const raw = localStorage.getItem(`${HEARD_KEY}.${username}`);
            const parsed = raw ? JSON.parse(raw) : null;
            if (parsed && typeof parsed === 'object') {
                lastSeenId = String(parsed.id || '');
                lastSeenAt = String(parsed.at || '');
            }
        } catch {
            // Nothing to recover; firstLoad already keeps the next poll silent.
        }
    }

    function writeHeard(username: string) {
        if (!username) return;
        try {
            localStorage.setItem(`${HEARD_KEY}.${username}`,
                                 JSON.stringify({ id: lastSeenId, at: lastSeenAt }));
        } catch {
            // Private browsing. The chime is simply re-armed on the next reload,
            // which `firstLoad` makes silent anyway.
        }
    }

    // Computed
    const personalNotifications = computed(() => {
        if (!currentUsername.value) return [];
        return notifications.value.filter(n =>
        n.notification_type === 'personal' && n.recipient === currentUsername.value
        );
    });

    const generalNotifications = computed(() => {
        return notifications.value.filter(n => n.notification_type === 'general');
    });

    const groupNotifications = computed(() => {
        if (!currentUsername.value) return [];
        return notifications.value.filter(n => {
            if (n.notification_type !== 'group') return false;
            // Parse recipient list for group notifications
            const recipients = n.recipient.split(',').map(r => r.trim());
            return recipients.includes(currentUsername.value);
        });
    });

    const unreadPersonalNotifications = computed(() => {
        return personalNotifications.value.filter(n => !n.read);
    });

    const allUserNotifications = computed(() => {
        if (!currentUsername.value) return [];

        // Combine all notification types for the current user
        const allNotifications = [
            ...personalNotifications.value,
            ...generalNotifications.value,
            ...groupNotifications.value
        ];

        // Sort by created_at descending
        return allNotifications.sort((a, b) =>
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        );
    });

    const unreadNotifications = computed(() =>
        allUserNotifications.value.filter(n => !n.read));

    /**
     * Everything in the list can now be deleted and marked read by its
     * recipient — that is what the state rows in app 16 are for. The computed
     * stays because callers use it; it just no longer says no.
     */
    const canModifyNotification = computed(() => (_notification: NotificationResponse) => true);

    const badge = computed(() =>
        unreadCount.value > 99 ? '99+' : String(unreadCount.value));

    // -- Sound ---------------------------------------------------------------

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
     * hearing anything: the element is then "activated" for the rest of the
     * page's life and later `play()` calls succeed.
     */
    function primeAudio() {
        if (primed) return;
        primed = true;
        try {
            if (!chime) {
                chime = new Audio(CHIME_URL);
                chime.preload = 'auto';
            }
            // A throwaway clone, silenced twice. The autoplay policy is scoped to
            // the document rather than to one media element, so warming a clone
            // buys the same permission — and it cannot leave the real chime
            // half-played or unmuted mid-file. See note 2 in the header.
            const warm = chime.cloneNode(true) as HTMLAudioElement;
            warm.muted = true;
            warm.volume = 0;
            const drop = () => {
                try {
                    warm.pause();
                    warm.src = '';
                } catch {
                    // The element is being discarded; nothing to do.
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
            if (!chime) chime = new Audio(CHIME_URL);
            chime.currentTime = 0;
            // A rejected play() is the normal outcome before the first gesture
            // and is not worth surfacing — the badge still updates either way.
            chime.play()?.catch(() => undefined);
        } catch {
            // No audio device, or the file is missing. Never fatal.
        }
    }

    // -- Polling -------------------------------------------------------------

    /**
     * Whether this refresh should make a sound. Pure, and separated out because
     * every clause is a complaint somebody would otherwise make.
     *
     * The last two are the ones that were wrong. `latest_at` is compared
     * **strictly greater than a high-water mark**, not merely "not older than the
     * last value we happened to see": an id can be new to this tab while its
     * record is older than something the tab has already been told about, which is
     * what deleting the newest notification produces, and what a bounce between
     * replicas produces. And an id this browser has itself deleted is never an
     * arrival, however new the replica offering it thinks it is.
     */
    function shouldRing(count: { latest_id: string; latest_at: string; unread_count: number }): boolean {
        if (firstLoad) return false;
        if (!count.unread_count) return false;
        if (!count.latest_id) return false;
        if (count.latest_id === lastSeenId) return false;
        if (isRemoved(count.latest_id)) return false;
        if (lastSeenAt && !(String(count.latest_at || '') > lastSeenAt)) return false;
        return true;
    }

    function start(username: string) {
        if (!username) return;
        currentUsername.value = username;
        firstLoad = true;
        stopPolling();
        readHeard(username);
        readRemoved(username);
        loadFromLocalStorage(username);
        fetchNotificationCount(username);
        schedule();
        document.addEventListener('visibilitychange', onVisibility);
    }

    function schedule() {
        if (timer) window.clearTimeout(timer);
        timer = window.setTimeout(async () => {
            if (currentUsername.value) await fetchNotificationCount(currentUsername.value);
            schedule();
        }, document.hidden ? POLL_HIDDEN_MS : POLL_VISIBLE_MS);
    }

    function onVisibility() {
        // Coming back to the tab should feel immediate rather than waiting out
        // whatever remains of a 90-second hidden interval.
        if (!document.hidden && currentUsername.value) fetchNotificationCount(currentUsername.value);
        schedule();
    }

    function stopPolling() {
        if (timer) window.clearTimeout(timer);
        timer = null;
        document.removeEventListener('visibilitychange', onVisibility);
    }

    // Actions
    async function fetchNotifications(username: string, refresh = false) {
        if (!username) {
            error.value = 'Username is required';
            return;
        }

        currentUsername.value = username;
        loading.value = true;
        error.value = null;

        try {
            if (refresh) {
                currentPage.value = 1;
                hasMore.value = true;
            }

            const response = await notificationService.getNotificationsForUser(
                username,
                currentPage.value,
                pageSize.value
            );

            // Anything this browser deleted is dropped before it reaches the
            // list. Without this the record comes back the moment a poll lands on
            // a replica the dismiss has not reached — which is the whole of "it
            // deleted but kept reappearing".
            const rows = withoutRemoved(response.results);

            if (currentPage.value === 1 || refresh) {
                // Clear all notifications
                notifications.value = rows;
            } else {
                // Append new notifications, avoiding duplicates
                const existingIds = new Set(notifications.value.map(n => n.notification_id));
                const newNotifications = rows.filter(
                    n => !existingIds.has(n.notification_id)
                );
                notifications.value.push(...newNotifications);
            }

            hasMore.value = !!response.next;
            currentPage.value++;

            // Update stats
            await fetchNotificationStats(username);

            // Save to localStorage
            saveToLocalStorage(username);
        } catch (err: any) {
            error.value = err.message || 'Failed to fetch notifications';
            console.error('Failed to fetch notifications:', err);
        } finally {
            loading.value = false;
        }
    }

    async function fetchNotificationCount(username: string) {
        if (!username) return;

        try {
            const count = await notificationService.getNotificationCount(username);

            // Only update if we got valid data
            if (count && typeof count.unread_count === 'number') {
                if (shouldRing(count)) ring();
                if (count.latest_id) {
                    lastSeenId = count.latest_id;
                    // Forward only. Taking the value as given lets a replica
                    // whose tail is a moment behind lower the mark, and the return
                    // to the up-to-date one then reads as an arrival.
                    const at = String(count.latest_at || '');
                    if (at > lastSeenAt) lastSeenAt = at;
                    if (!isRemoved(count.latest_id)) {
                        latestTitle.value = count.latest_title || '';
                    }
                    writeHeard(username);
                }
                firstLoad = false;

                // The service counts what it holds, and it still holds what this
                // browser deleted a moment ago on one replica out of three. Without
                // the discount the badge sits above the list it belongs to, which
                // reads as the delete not having worked.
                const stale = removedCount();
                unreadCount.value = Math.max(0, count.unread_count - stale);
                totalCount.value = Math.max(0, count.total_count - stale);
                currentUsername.value = username;

                // Save to localStorage
                saveToLocalStorage(username);
            }
        } catch (err) {
            console.error('Failed to fetch notification count:', err);
            // Try to load from localStorage
            loadFromLocalStorage(username);
        }
    }

    async function fetchNotificationStats(username: string) {
        if (!username) return;

        try {
            const stats: NotificationStats = await notificationService.getNotificationStats(username);

            // The bell counts everything the user can see, so it reads the
            // visible totals rather than the personal ones. Those two disagreeing
            // is why the badge used to sit at 3 over a list of eleven.
            const stale = removedCount();
            unreadCount.value = Math.max(0, stats.unread_visible - stale);
            totalCount.value = Math.max(0, stats.total_visible - stale);
            generalCount.value = stats.total_general;
            groupCount.value = stats.total_group;
            currentUsername.value = username;

            // Save to localStorage
            saveToLocalStorage(username);
        } catch (err) {
            console.error('Failed to fetch notification stats:', err);
            // Try to load from localStorage
            loadFromLocalStorage(username);
        }
    }

    function saveToLocalStorage(username: string) {
        if (!username) return;

        const data = {
            unreadCount: unreadCount.value,
            totalCount: totalCount.value,
            generalCount: generalCount.value,
            groupCount: groupCount.value,
            timestamp: Date.now()
        };

        try {
            localStorage.setItem(getStorageKey(username), JSON.stringify(data));
        } catch {
            // Private browsing, or a full quota. The badge is simply not cached.
        }
    }

    function loadFromLocalStorage(username: string) {
        if (!username) return;

        const saved = localStorage.getItem(getStorageKey(username));
        if (saved) {
            try {
                const data = JSON.parse(saved);
                unreadCount.value = data.unreadCount || 0;
                totalCount.value = data.totalCount || 0;
                generalCount.value = data.generalCount || 0;
                groupCount.value = data.groupCount || 0;
                currentUsername.value = username;
            } catch (e) {
                console.error('Failed to load from localStorage:', e);
            }
        }
    }

    /** Read, for this user. Works on an announcement too, which is the point. */
    async function markAsRead(notificationId: string) {
        const username = currentUsername.value;
        if (!username) return;

        const index = notifications.value.findIndex(n => n.notification_id === notificationId);
        const wasUnread = index !== -1 && !notifications.value[index].read;

        await notificationService.markNotificationAsRead(notificationId, username);

        if (index !== -1) {
            notifications.value[index] = { ...notifications.value[index], read: true };
        }
        if (wasUnread) {
            unreadCount.value = Math.max(0, unreadCount.value - 1);
            saveToLocalStorage(username);
        }
    }

    async function markAllAsRead(username: string) {
        if (!username) return;

        const result = await notificationService.markAllAsRead(username);

        // Everything visible, not just the personal ones — the endpoint changed
        // to match what the button says.
        notifications.value = notifications.value.map(n => ({ ...n, read: true }));

        if (username === currentUsername.value) {
            unreadCount.value = 0;
            saveToLocalStorage(username);
        }

        return result;
    }

    /**
     * The recipient's Delete. Gone from their list either way; the backend
     * decides whether the record itself goes with it.
     */
    async function deleteNotification(notificationId: string) {
        const username = currentUsername.value;
        if (!username) return;

        const notification = notifications.value.find(n => n.notification_id === notificationId);

        await notificationService.dismissNotification(notificationId, username);

        // Remembered before the list is touched, so a poll that lands between the
        // two - or on a replica that has not applied the dismiss - cannot put it
        // back. See note 5 in the header.
        forget([notificationId]);
        notifications.value = notifications.value.filter(n => n.notification_id !== notificationId);

        if (notification) {
            totalCount.value = Math.max(0, totalCount.value - 1);
            if (!notification.read) unreadCount.value = Math.max(0, unreadCount.value - 1);
            if (notification.notification_type === 'general') {
                generalCount.value = Math.max(0, generalCount.value - 1);
            } else if (notification.notification_type === 'group') {
                groupCount.value = Math.max(0, groupCount.value - 1);
            }
            saveToLocalStorage(username);
        }
    }

    /**
     * Empty the inbox. One request, not one per notification — see the note on
     * `clear-all` in the service.
     */
    async function clearAll(username?: string) {
        const target = username || currentUsername.value;
        if (!target) return;

        const result = await notificationService.clearAll(target);

        forget(notifications.value.map(n => n.notification_id));
        notifications.value = [];
        unreadCount.value = 0;
        totalCount.value = 0;
        generalCount.value = 0;
        groupCount.value = 0;
        resetPagination();
        saveToLocalStorage(target);
        return result;
    }

    /**
     * Delete ANY notification (personal/general/group) as an admin.
     * The backend syncs the deletion across replicas so a GROUP notification
     * disappears for every admin recipient.
     */
    async function deleteNotificationAsAdmin(notificationId: string) {
        const notification = notifications.value.find(n => n.notification_id === notificationId);

        await notificationService.deleteNotificationAsAdmin(notificationId);

        // Remove from local state for the current user immediately
        forget([notificationId]);
        notifications.value = notifications.value.filter(n => n.notification_id !== notificationId);

        if (notification) {
            totalCount.value = Math.max(0, totalCount.value - 1);
            if (!notification.read) unreadCount.value = Math.max(0, unreadCount.value - 1);
            if (notification.notification_type === 'group') {
                groupCount.value = Math.max(0, groupCount.value - 1);
            }
            saveToLocalStorage(currentUsername.value);
        }
    }

    function resetPagination() {
        currentPage.value = 1;
        hasMore.value = true;
    }

    function clearUserNotifications(username: string) {
        // Remove only this user's personal notifications
        notifications.value = notifications.value.filter(n =>
        !(n.notification_type === 'personal' && n.recipient === username)
        );

        if (username === currentUsername.value) {
            unreadCount.value = 0;
            totalCount.value = 0;
        }

        resetPagination();
    }

    /** Local teardown on sign-out. Deliberately touches no network — the name is
     *  unfortunate next to `clearAll`, and it is kept because SideNav, App.vue
     *  and the router all call it. */
    function clearAllNotifications() {
        stopPolling();
        notifications.value = [];
        unreadCount.value = 0;
        totalCount.value = 0;
        generalCount.value = 0;
        groupCount.value = 0;
        currentPage.value = 1;
        hasMore.value = true;
        error.value = null;
        currentUsername.value = '';
        latestTitle.value = '';
        lastSeenId = '';
        lastSeenAt = '';
        // The tombstones stay in localStorage, keyed by username: this is a
        // sign-out, and the next person to sign in on this browser reads their own
        // set. Clearing the in-memory copy is what stops one account's deletions
        // filtering another account's inbox.
        removed = new Map();
        firstLoad = true;
        resetPagination();
    }

    return {
        // State
        notifications,
        unreadCount,
        totalCount,
        generalCount,
        groupCount,
        loading,
        error,
        hasMore,
        currentUsername,
        soundEnabled,
        latestTitle,

        // Computed
        badge,
        personalNotifications,
        generalNotifications,
        groupNotifications,
        unreadNotifications,
        unreadPersonalNotifications,
        allUserNotifications,
        canModifyNotification,

        // Actions
        start,
        stopPolling,
        primeAudio,
        setSoundEnabled,
        ring,
        fetchNotifications,
        fetchNotificationCount,
        fetchNotificationStats,
        markAsRead,
        markAllAsRead,
        deleteNotification,
        clearAll,
        deleteNotificationAsAdmin,
        resetPagination,
        clearUserNotifications,
        clearAllNotifications,
        loadFromLocalStorage
    };
});
