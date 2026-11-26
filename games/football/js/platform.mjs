// Where the game is running, and what that place can do.
//
//   desktop  the Electron app: window.sfsFootball (preload) - LAN host, hotspot,
//            sign-in through the SelfStudyJo gateway, online signalling.
//   web      inside selfstudyjo.com (/football): the page above us is the same
//            origin and offers window.parent.sfsFootballBridge for online play.
//   lan      served by a desktop host over the LAN/hotspot: join that host.
//   plain    anything else (opened from disk): offline play only.

export const SITE = 'https://www.selfstudyjo.com';
const bridge = () => { try { return window.parent !== window && window.parent.sfsFootballBridge ? window.parent.sfsFootballBridge : null; } catch { return null; } };

export async function detect() {
  if (window.sfsFootball) return { kind: 'desktop', api: window.sfsFootball };
  const b = bridge();
  if (b) return { kind: 'web', api: b };
  if (/^https?:$/.test(location.protocol)) {
    try {
      const r = await fetch('/lan.json', { cache: 'no-store' });
      if (r.ok) { const j = await r.json(); if (j && j.sfsFootball) return { kind: 'lan', info: j }; }
    } catch { /* not a LAN host */ }
  }
  return { kind: 'plain' };
}

// The online mailbox: (method, path, body) -> JSON, throws { status, message }.
export function signaller(env) {
  if (env.kind === 'desktop' || env.kind === 'web') {
    return async (method, path, body) => {
      const r = await env.api.signal(method, path, body);
      if (r && r.error) { const e = new Error(r.error); e.status = r.status || 0; e.code = r.code || ''; throw e; }
      return r;
    };
  }
  return null;
}
export const inviteLink = (room, secret) => `${SITE}/football?join=${room}.${secret}`;
