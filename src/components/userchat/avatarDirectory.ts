// src/components/userchat/avatarDirectory.ts
//
// Turning a user id into a profile picture, once per person per tab.
//
// **Why this exists at all.** App 35 stores a user id and a display name against
// every message and membership, and nothing else — deliberately, because a copy
// of somebody's avatar URL on every record is a copy that goes stale the moment
// they change their picture, on records that then have to be rewritten to fix it.
// So the picture is resolved from app 13 at render time.
//
// Done naively that is a request per avatar: a room list of forty conversations,
// each drawing a face, is forty round trips to a service whose replicas may be
// cold. Two things stop that:
//
// * **Requests are batched.** A lookup asked for during the same tick as another
//   is folded into one `getAllProfiles()` call, which app 13 answers in one go.
//   The Vue app already does this server-side in selfstudyadmin (`enrich_rows`
//   over one cached read) — this is the same idea in the browser.
// * **Answers are cached for the life of the tab**, including the negative ones.
//   A person with no picture must not be looked up again every time they appear
//   in a list, or an avatar-less user costs more than one with a photo.
//
// The cache is deliberately *not* persisted to localStorage. An avatar URL that
// survives a reload survives the user changing their picture, and the whole
// reason the URL is not stored on the chat records is to avoid exactly that.

import { userService, type UserProfile } from '@/services/user.service';
import { getProxiedImageUrl } from '@/utils/imageUtils';

interface Entry {
    url: string;
    username: string;
    fullName: string;
}

class AvatarDirectory {
    private known = new Map<string, Entry>();
    /** Ids already looked up and found to have no usable picture. Held so a
     *  second render does not re-ask; the value is the empty string. */
    private missing = new Set<string>();
    private pending = new Set<string>();
    private inFlight: Promise<void> | null = null;
    private timer: number | null = null;
    /** Set once the full directory has been pulled, so later lookups for people
     *  who were not in it are answered from memory rather than re-fetched. */
    private loadedAll = false;

    private key(userId: string) {
        return String(userId || '').trim().toLowerCase();
    }

    /** The picture URL for a user, or '' when they have none. Never throws:
     *  an avatar is decoration, and a failed profile service must not stop a
     *  conversation rendering. */
    async urlFor(userId: string): Promise<string> {
        const key = this.key(userId);
        if (!key) return '';

        const known = this.known.get(key);
        if (known) return known.url;
        if (this.missing.has(key)) return '';
        if (this.loadedAll) return '';

        this.pending.add(key);
        try {
            await this.schedule();
        } catch {
            return '';
        }
        return this.known.get(key)?.url || '';
    }

    /** The display name app 13 has for somebody, when the chat record's own copy
     *  is empty — which happens for a member added by user id from the admin
     *  console, where nobody typed a name. */
    nameFor(userId: string): string {
        const entry = this.known.get(this.key(userId));
        return entry ? (entry.fullName || entry.username) : '';
    }

    /** Called by ChatAvatar when an image 404s, so it is not retried on every
     *  re-render for the rest of the session. */
    markBroken(userId: string) {
        const key = this.key(userId);
        this.known.delete(key);
        this.missing.add(key);
    }

    /**
     * Coalesce every lookup asked for in this tick into one fetch.
     *
     * A microtask delay rather than a timeout: everything rendering in the same
     * frame — a whole room list, a member panel — lands in one batch, and the
     * first paint is not held up by a timer.
     */
    private schedule(): Promise<void> {
        if (this.inFlight) return this.inFlight;

        this.inFlight = new Promise<void>((resolve) => {
            this.timer = window.setTimeout(async () => {
                this.timer = null;
                try {
                    await this.loadAll();
                } finally {
                    this.pending.clear();
                    this.inFlight = null;
                    resolve();
                }
            }, 0);
        });
        return this.inFlight;
    }

    /**
     * Pull the whole profile directory once.
     *
     * One request for everybody rather than one per id, because that is the shape
     * app 13 offers and because a chat surface asks about most of the platform's
     * users over a session anyway. `getAllProfiles` pages internally and caps
     * itself at 1000.
     *
     * Falls back to per-id lookups only for what is still missing afterwards, and
     * only up to a small bound — that path exists for an id the directory does
     * not contain, not as a way to fetch a crowd one at a time.
     */
    private async loadAll(): Promise<void> {
        const wanted = [...this.pending];
        if (!this.loadedAll) {
            try {
                const profiles = await userService.getAllProfiles();
                for (const profile of profiles) this.remember(profile);
                this.loadedAll = true;
            } catch {
                // App 13 is unreachable. Fall through to the per-id attempts
                // below, which may still work against a different replica, and
                // leave `loadedAll` false so a later render tries again.
            }
        }

        const stillUnknown = wanted.filter(
            key => !this.known.has(key) && !this.missing.has(key));
        for (const key of stillUnknown.slice(0, 8)) {
            try {
                this.remember(await userService.getUserProfile(key));
            } catch {
                this.missing.add(key);
            }
        }
        // Anything past that bound is recorded as having no picture rather than
        // left pending, so it resolves to initials now instead of re-queueing a
        // lookup on every re-render.
        for (const key of stillUnknown.slice(8)) this.missing.add(key);
    }

    private remember(profile: UserProfile | null | undefined) {
        if (!profile) return;
        const key = this.key(profile.user_id || '');
        if (!key) return;
        const raw = String(profile.image_url || '').trim();
        const url = raw ? getProxiedImageUrl(raw) : '';
        if (!url) {
            this.missing.add(key);
            return;
        }
        this.known.set(key, {
            url,
            username: profile.username || '',
            fullName: [profile.first_name, profile.last_name]
                .filter(Boolean).join(' ').trim(),
        });
    }

    /** Drop everything. Called on logout, with the rest of the chat state — the
     *  next person to sign in on this browser must not inherit a directory of
     *  faces. */
    clear() {
        this.known.clear();
        this.missing.clear();
        this.pending.clear();
        this.loadedAll = false;
        if (this.timer) window.clearTimeout(this.timer);
        this.timer = null;
        this.inFlight = null;
    }
}

export const avatarDirectory = new AvatarDirectory();
