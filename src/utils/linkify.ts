/**
 * Turn plain user-written text into safe HTML with real, clickable links.
 *
 * A PLAIN module — no Vue, no DOM — the same precedent as `photoMask.ts`,
 * `drawEngine.ts`, `chatMedia.ts` and `appNav.ts`, and for the same reason:
 * `npm run check:linkify` runs it in node in about a second, and the things
 * that need proving here are exactly the things that are invisible until
 * somebody exploits them.
 *
 * ---------------------------------------------------------------------------
 * WHY THIS EXISTS AT ALL
 * ---------------------------------------------------------------------------
 * Notifications, course comments and chat messages routinely contain a URL,
 * and the app rendered every one of them as dead text — a student was told
 * "see https://…" and had to select it and copy it by hand. That is
 * requirement 4.
 *
 * ---------------------------------------------------------------------------
 * THE PART THAT IS NOT ABOUT CONVENIENCE
 * ---------------------------------------------------------------------------
 * Making text clickable means rendering it as HTML, and the app was already
 * doing that in one place without escaping anything:
 *
 *     // CourseDetails.vue, before
 *     const parseMentions = (text) => text.replace(/@(\w+)/g, '<span…>@$1</span>')
 *     <p v-html="parseMentions(comment.content)"></p>
 *
 * A comment reading `<img src=x onerror=alert(1)>` executed. Every caller now
 * goes through `linkify()`, which escapes FIRST and only then inserts the tags
 * it generated itself, so the output can contain no markup the user wrote.
 *
 * Three further rules, each closing something the naive version gets wrong:
 *
 *  - **The scheme is allow-listed.** `javascript:`, `data:` and `vbscript:`
 *    URLs are never turned into an anchor. An escaped `href` is not enough:
 *    `javascript:alert(1)` contains no character escaping touches, and it runs
 *    on click.
 *  - **Every external link gets `rel="noopener noreferrer"`.** Without
 *    `noopener` the opened page can reach back through `window.opener` and
 *    navigate this tab somewhere else — a phishing route that needs no
 *    scripting on our side at all.
 *  - **Internal links stay internal.** A link to this app's own origin opens
 *    in the same tab and without `target`, because sending somebody to a new
 *    tab to read their own notification is a bug, not a safety measure.
 */

/* --------------------------------------------------------------------------
 * Escaping
 * -------------------------------------------------------------------------- */

const ESCAPES: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
};

/**
 * HTML-escape a string. `&` must be first or the other replacements are
 * double-escaped; using one pass with a character class avoids the ordering
 * question entirely.
 */
export function escapeHtml(text: string): string {
  return String(text ?? '').replace(/[&<>"']/g, ch => ESCAPES[ch]);
}

/* --------------------------------------------------------------------------
 * Recognition
 * -------------------------------------------------------------------------- */

/**
 * One pass over the text, so the three kinds cannot overlap or nest — a
 * mention inside a URL's path is part of the URL, and an email inside a
 * `mailto:` link is the link.
 *
 * Alternation order is the precedence: absolute URL, then bare `www.`, then
 * email, then mention.
 */
const PATTERN = new RegExp(
  /*
    `pre` is the character before the candidate, and it is the security half of
    this pattern rather than a tidiness one.

    Without it, `blob:https://evil.example/x` matches from the `https` — the
    `blob:` is left as plain text and the REST becomes a working anchor. The
    same trick composes with anything: `javascript:https://…`. Requiring the
    preceding character to be one that cannot be part of a scheme (so: not a
    letter, digit, `+`, `.`, `-`, `/`, `_`, `@`, and above all not `:`) means a
    URL is only recognised where a URL can actually begin.

    It is a leading GROUP and not a lookbehind on purpose. A lookbehind is a
    parse-time syntax error on Safari before 16.4, and a regex literal that
    fails to parse takes the whole module — and therefore the whole app — down
    with it. Named groups have been safe since Safari 11.1; lookbehind has not.
    The captured character is re-emitted by the caller.
  */
  '(?<pre>^|[^A-Za-z0-9+.:\\/@_-])' +
  '(?:' +
    // A URL with a scheme. The scheme is captured loosely and vetted later by
    // isSafeScheme — matching only http/https here would leave `javascript:`
    // as plain text, which is right, but would also silently drop `mailto:`.
    '(?<url>[a-z][a-z0-9+.-]{1,31}:\\/\\/[^\\s<>"\'`]+|mailto:[^\\s<>"\'`]+)' +
    // A bare domain the writer clearly meant as a link.
    '|(?<www>www\\.[^\\s<>"\'`]+)' +
    // An email address written on its own.
    '|(?<email>[a-z0-9._%+-]+@[a-z0-9.-]+\\.[a-z]{2,63}\\b)' +
    // An @mention. Deliberately after email, so `a@b.com` is an address and
    // not a mention of `@b`.
    '|(?<mention>@[a-zA-Z0-9_.-]{2,40})' +
  ')',
  'gi'
);

/** Schemes that may become an anchor. Everything else stays as text. */
const SAFE_SCHEMES = new Set(['http:', 'https:', 'mailto:', 'tel:']);

function isSafeScheme(raw: string): boolean {
  const m = /^([a-z][a-z0-9+.-]*:)/i.exec(raw);
  return m ? SAFE_SCHEMES.has(m[1].toLowerCase()) : false;
}

/**
 * Trailing punctuation belongs to the sentence, not to the address.
 *
 * "see https://x.dev/a." — the full stop is not part of the path, and an
 * anchor that swallows it produces a 404 for anybody who clicks it. Closing
 * brackets are only trimmed when unbalanced, because a URL may legitimately
 * contain them: a Wikipedia article title is the everyday case.
 */
function trimTrailing(url: string): { url: string; tail: string } {
  let end = url.length;
  while (end > 0) {
    const ch = url[end - 1];
    if ('.,;:!?"\''.includes(ch)) { end--; continue; }
    if (ch === ')' || ch === ']' || ch === '}') {
      const open = ch === ')' ? '(' : ch === ']' ? '[' : '{';
      const slice = url.slice(0, end);
      const opens = slice.split(open).length - 1;
      const closes = slice.split(ch).length - 1;
      if (closes > opens) { end--; continue; }
    }
    break;
  }
  return { url: url.slice(0, end), tail: url.slice(end) };
}

/* --------------------------------------------------------------------------
 * Options
 * -------------------------------------------------------------------------- */

export interface LinkifyOptions {
  /**
   * Origins treated as this app. A link to one of these opens in the same tab
   * with no `target`. Defaults to the current origin at call time; pass it
   * explicitly from node, where there is no `location`.
   */
  internalOrigins?: string[];
  /** Render `@name` as a mention. On by default. */
  mentions?: boolean;
  /** Where a mention links to. Returning null renders it unlinked. */
  mentionHref?: (username: string) => string | null;
  /** Cap on the visible text of a link; the href is never shortened. */
  maxLabel?: number;
  /** Turn newlines into `<br>`. On by default — user text is written in lines. */
  breaks?: boolean;
}

const DEFAULT_MAX_LABEL = 60;

function currentOrigin(): string | null {
  try {
    return typeof location !== 'undefined' && location.origin ? location.origin : null;
  } catch {
    return null;
  }
}

/**
 * A long URL wrecks a narrow layout. The middle is elided rather than the end
 * so both the host and the last path segment survive — those are the two parts
 * that tell somebody where they are being sent.
 */
export function shortenLabel(url: string, max = DEFAULT_MAX_LABEL): string {
  const bare = url.replace(/^https?:\/\//i, '').replace(/\/$/, '');
  if (bare.length <= max) return bare;
  const head = Math.ceil((max - 1) * 0.62);
  const tail = Math.floor((max - 1) * 0.38);
  return `${bare.slice(0, head)}…${bare.slice(bare.length - tail)}`;
}

function isInternal(href: string, origins: string[]): boolean {
  if (!origins.length) return false;
  try {
    // A relative URL resolves against the first origin, so a bare `/courses`
    // is correctly internal.
    const u = new URL(href, origins[0]);
    return origins.includes(u.origin);
  } catch {
    return false;
  }
}

/* --------------------------------------------------------------------------
 * The main entry point
 * -------------------------------------------------------------------------- */

/**
 * Escape `text` and return HTML in which URLs, email addresses and @mentions
 * are real elements.
 *
 * The output is safe to hand to `v-html`: every character of the input has
 * been escaped, and the only tags present are the ones built here.
 */
export function linkify(text: string, options: LinkifyOptions = {}): string {
  const source = String(text ?? '');
  if (!source) return '';

  const origin = currentOrigin();
  const internalOrigins = options.internalOrigins ?? (origin ? [origin] : []);
  const allowMentions = options.mentions !== false;
  const maxLabel = options.maxLabel ?? DEFAULT_MAX_LABEL;

  let out = '';
  let last = 0;

  PATTERN.lastIndex = 0;
  for (let m = PATTERN.exec(source); m !== null; m = PATTERN.exec(source)) {
    const groups = m.groups ?? {};
    const pre = groups.pre ?? '';
    const bodyStart = m.index + pre.length;
    const body = m[0].slice(pre.length);
    let piece: string | null = null;
    let consumed = body.length;

    if (groups.url || groups.www) {
      const raw = groups.url ?? groups.www;
      const { url, tail } = trimTrailing(raw);
      // A bare `www.` host has no scheme, so it is given the safe one rather
      // than being left to resolve as a relative path.
      const href = groups.www ? `https://${url}` : url;
      piece = isSafeScheme(href)
        ? anchor(href, shortenLabel(url, maxLabel), internalOrigins)
        // An unsafe scheme is not an anchor — but it is still shown, escaped,
        // because silently deleting part of somebody's message is worse than
        // showing them a link they cannot click.
        : escapeHtml(url);
      piece += escapeHtml(tail);
    } else if (groups.email) {
      piece = anchor(`mailto:${groups.email}`, groups.email, internalOrigins, 'rt-link rt-email');
    } else if (groups.mention && allowMentions) {
      const username = groups.mention.slice(1).replace(/[.]+$/, '');
      // A full stop that ended the sentence rather than the username is put
      // back into the surrounding text instead of being swallowed.
      consumed = body.length - (groups.mention.length - 1 - username.length);
      const href = options.mentionHref ? options.mentionHref(username) : null;
      const label = escapeHtml(`@${username}`);
      piece = href
        ? `<a class="rt-mention" href="${escapeHtml(href)}">${label}</a>`
        : `<span class="rt-mention">${label}</span>`;
    }

    if (piece === null) {
      // Nothing was rendered (mentions turned off). Do not consume the
      // boundary character — the next candidate may need it.
      PATTERN.lastIndex = Math.max(bodyStart, m.index + 1);
      continue;
    }

    out += escapeHtml(source.slice(last, m.index));
    out += escapeHtml(pre);
    out += piece;
    last = bodyStart + consumed;
    PATTERN.lastIndex = last;
  }

  out += escapeHtml(source.slice(last));

  return options.breaks === false ? out : out.replace(/\r?\n/g, '<br>');
}

function anchor(href: string, label: string, internalOrigins: string[], cls = 'rt-link'): string {
  const internal = isInternal(href, internalOrigins);
  const safeHref = escapeHtml(href);
  const attrs = internal
    ? ''
    // noopener is the one that matters: without it the opened page can
    // navigate this tab through window.opener. noreferrer also keeps the
    // student's current page out of the destination's logs.
    : ' target="_blank" rel="noopener noreferrer"';
  return `<a class="${cls}" href="${safeHref}"${attrs}>${escapeHtml(label)}</a>`;
}

/**
 * Does this text contain anything worth rendering as HTML?
 *
 * Lets a caller skip `v-html` entirely for the common case of a message with
 * no link in it, so ordinary text stays an ordinary text node.
 */
export function hasLinkable(text: string, options: LinkifyOptions = {}): boolean {
  const source = String(text ?? '');
  if (!source) return false;
  PATTERN.lastIndex = 0;
  for (let m = PATTERN.exec(source); m !== null; m = PATTERN.exec(source)) {
    const g = m.groups ?? {};
    if (g.url && isSafeScheme(g.url)) return true;
    if (g.www || g.email) return true;
    if (g.mention && options.mentions !== false) return true;
  }
  return false;
}
