/*
  What the page says about itself, evaluated INSIDE the page.

  A file of its own, read as text and handed to `Runtime.evaluate`, rather than
  a template literal inside `audit.mjs`. That is not tidiness — it is the one
  arrangement with no escaping layer between what is written and what runs. As a
  template literal, every `\s` in a regex and every `\n` in a string has to be
  written `\\s` and `\\n`, and getting one wrong is a SyntaxError thrown inside
  the browser where nothing prints it: the audit reported "1 problem" on every
  route and looked exactly like a page with nothing wrong with it.

  (`audit.mjs` now surfaces `exceptionDetails` as well, so a throw is loud. This
  file is what stops there being one.)

  Four questions, in the order they matter:

    1. Does the DOCUMENT scroll sideways? One number, and the loudest symptom —
       it is what a reader feels as "the page is broken".
    2. Which elements stick out past the viewport, and on which side? In RTL the
       side is the useful half: over the RIGHT edge is usually a genuine width
       problem, and over the LEFT is almost always an overlay nobody mirrored.
    3. Which elements overflow their own box?
    4. Do any two FIXED overlays land on top of each other? That is the "the
       menu button is under the badge" family, which only happens once a corner
       is mirrored.
*/
(() => {
    const out = [];
    const dir = document.documentElement.getAttribute('dir') || '';
    const vw = document.documentElement.clientWidth;
    const scroll = document.documentElement.scrollWidth;
    if (scroll > vw + 1) {
        out.push('SIDEWAYS SCROLL: document is ' + scroll + 'px in a ' + vw + 'px viewport');
    }

    const name = (el) => {
        const id = el.id ? '#' + el.id : '';
        const cls = typeof el.className === 'string' && el.className
            ? '.' + el.className.trim().split(/\s+/).slice(0, 3).join('.')
            : '';
        return el.tagName.toLowerCase() + id + cls;
    };

    /*
      What an element ACTUALLY shows, after every ancestor has clipped it.

      Without this the report is nine tenths noise, and the noise looks exactly
      like the signal. Two things dominate it:

        * the mobile drawer, PARKED. It is a full viewport width off the edge
          because that is where a closed drawer belongs, and every one of its
          forty descendants is off the edge with it.
        * the ticker, which is a marquee: its track is deliberately 19,000px
          long inside a box with `overflow: hidden`.

      Neither is visible to a reader, and an element a reader cannot see is not
      a layout fault. So each rect is intersected with every clipping ancestor
      before it is judged, and anything left with no area is skipped.
    */
    const visibleRect = (el) => {
        const r = el.getBoundingClientRect();
        let left = r.left, right = r.right, top = r.top, bottom = r.bottom;
        for (let p = el.parentElement; p && p !== document.documentElement; p = p.parentElement) {
            const cs = getComputedStyle(p);
            if (cs.overflowX === 'visible' && cs.overflowY === 'visible') continue;
            const pr = p.getBoundingClientRect();
            if (cs.overflowX !== 'visible') {
                left = Math.max(left, pr.left);
                right = Math.min(right, pr.right);
            }
            if (cs.overflowY !== 'visible') {
                top = Math.max(top, pr.top);
                bottom = Math.min(bottom, pr.bottom);
            }
            if (right <= left || bottom <= top) return null;
        }
        return { left, right, top, bottom, width: right - left, height: bottom - top };
    };

    const fixed = [];
    for (const el of document.querySelectorAll('body *')) {
        const cs = getComputedStyle(el);
        if (cs.display === 'none' || cs.visibility === 'hidden' || cs.opacity === '0') continue;

        const r = visibleRect(el);
        // Entirely clipped away, entirely off the edge, or too small to matter.
        if (!r || r.width < 2 || r.height < 2) continue;
        if (r.right <= 1 || r.left >= vw - 1 || r.bottom <= 0) continue;

        if (r.right > vw + 1.5) {
            out.push('OVER RIGHT EDGE by ' + Math.round(r.right - vw) + 'px: ' + name(el));
        }
        if (r.left < -1.5) {
            out.push('OVER LEFT EDGE by ' + Math.round(-r.left) + 'px: ' + name(el));
        }

        /*
          Its own content, wider than itself. `hidden` is a deliberate crop and
          a scroller is a deliberate scroller; neither is a fault.

          The 80px floor is what keeps this readable. A decorative element
          routinely hangs a glow past its own edge — the Plans spinner is 64px
          wide with an `::after` at `inset: -10px`, which is a halo and not an
          overflow — and a report that names it on every run is a report nobody
          finishes reading. Anything wide enough to be a CONTENT box is still
          judged at 2px.
        */
        const slack = el.clientWidth >= 80 ? 2 : 16;
        if (cs.overflowX === 'visible' && el.scrollWidth > el.clientWidth + slack
            && el.clientWidth > 0) {
            out.push('OVERFLOWS ITSELF by ' + (el.scrollWidth - el.clientWidth) + 'px: ' + name(el));
        }

        // A full-viewport backdrop is SUPPOSED to be under everything, so it is
        // not counted as an overlap.
        if (cs.position === 'fixed' && r.width < vw * 0.9) fixed.push({ el, r });
    }

    for (let i = 0; i < fixed.length; i++) {
        for (let j = i + 1; j < fixed.length; j++) {
            const a = fixed[i], b = fixed[j];
            if (a.el.contains(b.el) || b.el.contains(a.el)) continue;
            const ox = Math.min(a.r.right, b.r.right) - Math.max(a.r.left, b.r.left);
            const oy = Math.min(a.r.bottom, b.r.bottom) - Math.max(a.r.top, b.r.top);
            if (ox > 6 && oy > 6) {
                out.push('FIXED OVERLAP ' + Math.round(ox) + 'x' + Math.round(oy)
                    + 'px: ' + name(a.el) + ' / ' + name(b.el));
            }
        }
    }

    return JSON.stringify({ dir: dir, problems: Array.from(new Set(out)) });
})()
