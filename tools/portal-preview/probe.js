// The portal style probe. Evaluated in the page by shoot.mjs's {"probe": "<label>"}
// step; returns a list of findings inside the product frame. Plain JS in its own
// file, read as text, for the reason tools/rtl-audit/probe.js gives: inside a
// template literal every backslash in a regex has to be written twice and a
// mistake is a SyntaxError thrown where nothing prints it.
//
// What it reports, each a fault a student SEES:
//   contrast   text whose colour against the background behind it is below 3:1
//              (white on white, grey on grey - "text not clear")
//   overflow   an element extending past the frame, or past a clipping parent
//              without being clipped by it
//   hscroll    the product's main page scrolls sideways
//   clipped    text cut off inside a box that hides overflow, with no ellipsis
//   overlap    two controls (buttons, fields, links) drawn on top of each other
//   tiny       a control under 16px in either dimension (unclickable)
(() => {
  const frame = document.querySelector('.sl-portal__frame');
  if (!frame) return [{ kind: 'error', text: 'no portal frame on the page' }];
  const fr = frame.getBoundingClientRect();
  const out = [];
  const seen = new Set();
  const MAX = 60;

  function path(el) {
    const parts = [];
    let node = el;
    for (let i = 0; node && node !== frame && i < 4; i++, node = node.parentElement) {
      let part = node.tagName.toLowerCase();
      const cls = [...node.classList].filter(c => !c.startsWith('data-v')).slice(0, 2);
      if (cls.length) part += '.' + cls.join('.');
      parts.unshift(part);
    }
    return parts.join(' > ');
  }
  function text(el) {
    return (el.innerText || el.value || el.getAttribute('aria-label') || '').trim()
      .replace(/\s+/g, ' ').slice(0, 50);
  }
  function add(kind, el, detail) {
    const key = kind + '|' + path(el) + '|' + text(el);
    if (seen.has(key) || out.length >= MAX) return;
    seen.add(key);
    out.push({ kind, at: path(el), text: text(el), detail });
  }
  function visible(el) {
    const style = getComputedStyle(el);
    if (style.visibility === 'hidden' || style.display === 'none' || Number(style.opacity) === 0) return false;
    const r = el.getBoundingClientRect();
    return r.width > 0 && r.height > 0;
  }
  function parse(color) {
    const m = color.match(/rgba?\(([^)]+)\)/);
    if (!m) return null;
    const p = m[1].split(/[\s,/]+/).filter(Boolean).map(Number);
    return { r: p[0], g: p[1], b: p[2], a: p.length > 3 ? p[3] : 1 };
  }
  function lum(c) {
    const f = v => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
    return 0.2126 * f(c.r) + 0.7152 * f(c.g) + 0.0722 * f(c.b);
  }
  function blend(top, under) {
    const a = top.a;
    return { r: top.r * a + under.r * (1 - a), g: top.g * a + under.g * (1 - a),
             b: top.b * a + under.b * (1 - a), a: 1 };
  }
  // The background actually behind an element: composite every ancestor's
  // background colour from the top down. A background IMAGE (gradient, picture)
  // makes the answer unknowable, so the element is skipped rather than guessed.
  function background(el) {
    const stack = [];
    for (let node = el; node; node = node.parentElement) {
      const style = getComputedStyle(node);
      if (style.backgroundImage && style.backgroundImage !== 'none') return null;
      const c = parse(style.backgroundColor);
      if (c && c.a > 0) {
        stack.push(c);
        if (c.a >= 1) break;
      }
      if (node === frame) break;
    }
    let colour = { r: 255, g: 255, b: 255, a: 1 };
    for (let i = stack.length - 1; i >= 0; i--) colour = blend(stack[i], colour);
    return colour;
  }
  function ratio(a, b) {
    const l1 = lum(a), l2 = lum(b);
    return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
  }
  // The visible part of a rect after every clipping ancestor inside the frame.
  function clipped(el) {
    let r = el.getBoundingClientRect();
    let box = { left: r.left, right: r.right, top: r.top, bottom: r.bottom };
    for (let node = el.parentElement; node && node !== frame.parentElement; node = node.parentElement) {
      const style = getComputedStyle(node);
      if (/(hidden|clip|auto|scroll)/.test(style.overflowX + style.overflowY)) {
        const p = node.getBoundingClientRect();
        box = { left: Math.max(box.left, p.left), right: Math.min(box.right, p.right),
                top: Math.max(box.top, p.top), bottom: Math.min(box.bottom, p.bottom) };
      }
    }
    return box;
  }

  const all = [...frame.querySelectorAll('*')].filter(visible);

  // contrast
  for (const el of all) {
    const own = [...el.childNodes].some(n => n.nodeType === 3 && n.textContent.trim());
    const isField = /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName) && (el.value || '').trim();
    if (!own && !isField) continue;
    if (el.closest('[disabled], [aria-disabled="true"], svg')) continue;
    const style = getComputedStyle(el);
    const fg = parse(style.color);
    const bg = background(el);
    if (!fg || !bg) continue;
    const effective = blend(fg, bg);
    const value = ratio(effective, bg);
    if (value < 3) add('contrast', el, `${value.toFixed(2)}:1 (${style.color} on rgb(${Math.round(bg.r)},${Math.round(bg.g)},${Math.round(bg.b)}))`);
  }

  // overflow past the frame, or past a clipping parent without being clipped
  for (const el of all) {
    const r = el.getBoundingClientRect();
    const box = clipped(el);
    if (box.right > fr.right + 1 || box.left < fr.left - 1) {
      add('overflow', el, `drawn ${Math.round(box.right - fr.right)}px past the frame's right edge`);
    }
  }

  // sideways scroll of the main page area
  const scrollers = all.filter(el => {
    const style = getComputedStyle(el);
    return /(auto|scroll)/.test(style.overflowX) && el.scrollWidth > el.clientWidth + 2
      && el.clientWidth > fr.width * 0.6 && !el.closest('table') && el.tagName !== 'PRE'
      && el.tagName !== 'TEXTAREA' && !el.querySelector(':scope > table');
  });
  for (const el of scrollers.slice(0, 3)) {
    add('hscroll', el, `scrolls sideways by ${el.scrollWidth - el.clientWidth}px`);
  }

  // clipped text
  for (const el of all) {
    const style = getComputedStyle(el);
    if (!/(hidden|clip)/.test(style.overflowX) || style.textOverflow === 'ellipsis') continue;
    const own = [...el.childNodes].some(n => n.nodeType === 3 && n.textContent.trim());
    if (own && el.scrollWidth > el.clientWidth + 2) {
      add('clipped', el, `text needs ${el.scrollWidth}px, box is ${el.clientWidth}px`);
    }
  }

  // overlapping controls
  const controls = all.filter(el => el.matches('button, a[href], input, select, textarea, [role="button"]'))
    .map(el => ({ el, r: el.getBoundingClientRect() }));
  for (let i = 0; i < controls.length; i++) {
    for (let j = i + 1; j < controls.length; j++) {
      const a = controls[i], b = controls[j];
      if (a.el.contains(b.el) || b.el.contains(a.el)) continue;
      const w = Math.min(a.r.right, b.r.right) - Math.max(a.r.left, b.r.left);
      const h = Math.min(a.r.bottom, b.r.bottom) - Math.max(a.r.top, b.r.top);
      if (w > 4 && h > 4) add('overlap', a.el, `overlaps ${path(b.el)} "${text(b.el)}" by ${Math.round(w)}x${Math.round(h)}px`);
    }
  }

  // tiny controls
  for (const { el, r } of controls) {
    if ((r.width < 16 || r.height < 16) && el.type !== 'checkbox' && el.type !== 'radio' && el.type !== 'hidden') {
      add('tiny', el, `${Math.round(r.width)}x${Math.round(r.height)}px`);
    }
  }
  return out;
})()
