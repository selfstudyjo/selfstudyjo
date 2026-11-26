// Self-Study Football - networking. One protocol, two transports.
//
// The HOST runs the match engine; every guest sends its controllers' state and
// draws the snapshots the host broadcasts (20 a second). So a match cannot drift
// between machines, and a slow guest only ever looks behind - it never changes the
// result.
//
//   LAN / hotspot  a WebSocket relay run by the host's desktop app (src/main/lan.js).
//                  No internet needed: a hotspot made by this computer is enough.
//                  A browser on the same network (a phone) can open the host's
//                  address and play with no install.
//   Online         WebRTC data channels, peer to peer. The two sides find each other
//                  through a tiny mailbox on SelfStudyJo (app 27 /api/football/...),
//                  which only ever carries the connection offer and answer - never
//                  the game. The invite link carries the room id and its secret.
//
// Both expose the same shape:
//   host:  { send(peer, msg), broadcast(msg), onMessage(peer, msg), onPeer(peer, name, joined), close() }
//   guest: { send(msg), onMessage(msg), onClose(), close() }

const ICE = [{ urls: 'stun:stun.l.google.com:19302' }, { urls: 'stun:stun.cloudflare.com:3478' }];
export const newId = (n = 10) => Array.from(crypto.getRandomValues(new Uint8Array(n)), (b) => 'abcdefghijkmnpqrstuvwxyz23456789'[b % 32]).join('');

// ------------------------------------------------------------------ LAN
export function lanHost(url, key) {
  const ws = new WebSocket(`${url}?role=host&key=${encodeURIComponent(key)}`);
  const api = { peers: new Map(), onMessage: () => {}, onPeer: () => {}, onOpen: () => {}, onClose: () => {} };
  ws.onopen = () => api.onOpen();
  ws.onclose = () => api.onClose();
  ws.onmessage = (e) => {
    let d; try { d = JSON.parse(e.data); } catch { return; }
    if (d.t === 'peer+') { api.peers.set(d.id, d.name); api.onPeer(d.id, d.name, true); }
    else if (d.t === 'peer-') { api.peers.delete(d.id); api.onPeer(d.id, d.name, false); }
    else if (d.t === 'msg') api.onMessage(d.from, d.m);
  };
  api.send = (to, m) => { if (ws.readyState === 1) ws.send(JSON.stringify({ to, m })); };
  api.broadcast = (m) => api.send('*', m);
  api.close = () => { try { ws.close(); } catch { /* */ } };
  return api;
}
export function lanGuest(url, name, pass) {
  const ws = new WebSocket(`${url}?role=guest&name=${encodeURIComponent(name)}&pass=${encodeURIComponent(pass || '')}`);
  const api = { onMessage: () => {}, onClose: () => {}, onOpen: () => {}, onError: () => {} };
  ws.onopen = () => api.onOpen();
  ws.onclose = (e) => api.onClose(e.reason || (e.code === 4001 ? 'Wrong password.' : e.code === 4002 ? 'The host is not running a game.' : ''));
  ws.onerror = () => api.onError();
  ws.onmessage = (e) => { let d; try { d = JSON.parse(e.data); } catch { return; } if (d.t === 'msg') api.onMessage(d.m); };
  api.send = (m) => { if (ws.readyState === 1) ws.send(JSON.stringify({ m })); };
  api.close = () => { try { ws.close(); } catch { /* */ } };
  return api;
}

// ------------------------------------------------------------------ online (WebRTC)
// `sig(method, path, body)` reaches app 27's /api/football/... (see platform.mjs).
function waitIce(pc, ms = 3500) {
  return new Promise((resolve) => {
    if (pc.iceGatheringState === 'complete') return resolve();
    const t = setTimeout(resolve, ms);
    pc.addEventListener('icegatheringstatechange', () => { if (pc.iceGatheringState === 'complete') { clearTimeout(t); resolve(); } });
  });
}
function wire(pc, channels, onMessage, onOpen) {
  for (const ch of channels) {
    ch.onmessage = (e) => { try { onMessage(JSON.parse(e.data)); } catch { /* bad frame */ } };
    ch.onopen = () => { if (channels.every((c) => c.readyState === 'open')) onOpen(); };
  }
}
function sender(chans) {
  return (m) => {
    const ch = m.t === 's' ? chans.u : chans.r;
    if (ch && ch.readyState === 'open') { try { ch.send(JSON.stringify(m)); } catch { /* buffer full: drop a snapshot */ } }
  };
}

export async function rtcHost(sig, hostName) {
  const room = await sig('POST', '/rooms/', { name: hostName });
  const api = { room: room.room, secret: room.secret, peers: new Map(), onMessage: () => {}, onPeer: () => {}, closed: false };
  const conns = new Map();
  let since = 0;
  const seen = new Set();
  const poll = async () => {
    if (api.closed) return;
    try {
      const r = await sig('GET', `/rooms/${api.room}/messages?secret=${api.secret}&to=host&since=${Math.max(0, since - 5000)}`);
      for (const m of r.messages || []) {
        if (seen.has(m.id)) continue;
        seen.add(m.id); since = Math.max(since, m.ts);
        if (m.kind === 'hello') offer(m.from, (m.data && m.data.name) || 'Guest');
        else if (m.kind === 'answer' && conns.has(m.from)) { try { await conns.get(m.from).pc.setRemoteDescription(m.data); } catch { /* stale */ } }
      }
    } catch { /* the mailbox is cold or unreachable: try again */ }
    setTimeout(poll, conns.size && [...conns.values()].every((c) => c.open) ? 3000 : 1200);
  };
  const offer = async (peer, name) => {
    if (conns.has(peer)) { try { conns.get(peer).pc.close(); } catch { /* */ } }
    const pc = new RTCPeerConnection({ iceServers: ICE });
    const chans = { r: pc.createDataChannel('r'), u: pc.createDataChannel('u', { ordered: false, maxRetransmits: 0 }) };
    const c = { pc, chans, send: sender(chans), open: false, name };
    conns.set(peer, c);
    wire(pc, [chans.r, chans.u], (m) => api.onMessage(peer, m), () => { c.open = true; api.peers.set(peer, name); api.onPeer(peer, name, true); });
    pc.onconnectionstatechange = () => {
      if (['failed', 'closed', 'disconnected'].includes(pc.connectionState) && c.open) { c.open = false; api.peers.delete(peer); api.onPeer(peer, name, false); }
    };
    await pc.setLocalDescription(await pc.createOffer());
    await waitIce(pc);
    await sig('POST', `/rooms/${api.room}/messages`, { secret: api.secret, from: 'host', to: peer, kind: 'offer', data: { type: 'offer', sdp: pc.localDescription.sdp } });
  };
  api.send = (peer, m) => { const c = conns.get(peer); if (c && c.open) c.send(m); };
  api.broadcast = (m) => { for (const c of conns.values()) if (c.open) c.send(m); };
  api.close = () => { api.closed = true; for (const c of conns.values()) { try { c.pc.close(); } catch { /* */ } } sig('POST', `/rooms/${api.room}/close`, { secret: api.secret }).catch(() => {}); };
  poll();
  return api;
}

export async function rtcGuest(sig, room, secret, name) {
  const me = newId(8);
  const api = { onMessage: () => {}, onClose: () => {}, onOpen: () => {}, closed: false };
  let pc = null, since = 0;
  const seen = new Set();
  await sig('POST', `/rooms/${room}/messages`, { secret, from: me, to: 'host', kind: 'hello', data: { name } });
  const poll = async () => {
    if (api.closed || (pc && pc.connectionState === 'connected')) return;
    try {
      const r = await sig('GET', `/rooms/${room}/messages?secret=${secret}&to=${me}&since=${Math.max(0, since - 5000)}`);
      for (const m of r.messages || []) {
        if (seen.has(m.id) || m.kind !== 'offer') continue;
        seen.add(m.id); since = Math.max(since, m.ts);
        if (pc) { try { pc.close(); } catch { /* */ } }
        pc = new RTCPeerConnection({ iceServers: ICE });
        const chans = {};
        pc.ondatachannel = (e) => {
          chans[e.channel.label] = e.channel;
          if (chans.r && chans.u) wire(pc, [chans.r, chans.u], (msg) => api.onMessage(msg), () => api.onOpen());
        };
        pc.onconnectionstatechange = () => { if (['failed', 'closed'].includes(pc.connectionState)) api.onClose('The connection to the host was lost.'); };
        api.send = sender(chans);
        await pc.setRemoteDescription(m.data);
        await pc.setLocalDescription(await pc.createAnswer());
        await waitIce(pc);
        await sig('POST', `/rooms/${room}/messages`, { secret, from: me, to: 'host', kind: 'answer', data: { type: 'answer', sdp: pc.localDescription.sdp } });
      }
    } catch (e) {
      if (e && e.status === 404) { api.onClose('This invite has expired or the host closed the game.'); return; }
    }
    setTimeout(poll, 1200);
  };
  api.send = () => {};
  api.close = () => { api.closed = true; try { pc && pc.close(); } catch { /* */ } };
  poll();
  return api;
}

// "https://.../football?join=ROOM.SECRET" or just "ROOM.SECRET"
export function parseInvite(text) {
  const s = String(text || '').trim();
  const m = s.match(/[?&#]join=([a-z0-9]+)\.([a-z0-9]+)/i) || s.match(/^([a-z0-9]{6,})\.([a-z0-9]{8,})$/i);
  return m ? { room: m[1].toLowerCase(), secret: m[2].toLowerCase() } : null;
}
