// Firebase Realtime Database signaling for 탁구왕 멀티플레이 (포켓몬 스플렌더의 fireroom.js 를 1:1 대전용으로 가져옴).
// 스플렌더와 같은 poke-splender 프로젝트를 쓰되, RTDB 규칙이 `pkmspl-rooms/$code` 만 열어 두므로 키 앞에 'tabgu-' 를 붙여 같은 규칙 안에 둔다(콘솔 변경 없음).
// Game data still goes peer-to-peer over WebRTC DataChannel; Firebase is
// only used to exchange SDP offers/answers and ICE candidates.
//
// Same room interface as PeerRoom so NetSession works unchanged:
//   hostCreate() -> code | guestJoin(code, onRetry) | cancelJoin()
//   send / sendTo / broadcast / onmessage / onjoin / onleave / close
//
// RTDB layout:
//   pkmspl-rooms/tabgu-{CODE}/
//     created: timestamp
//     handshakes/{guestId}/
//       offer: {type, sdp}            <- guest writes
//       answer: {type, sdp}           <- host writes
//       gc: {pushId: candidate}       <- guest ICE candidates
//       hc: {pushId: candidate}       <- host ICE candidates

import { parseMsg } from './protocol.js?v=1791531091';

const CODE_CHARS = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'; // no confusing 0/O/1/I
const ROOMS_PATH = 'pkmspl-rooms';
export const ROOM_KEY_PREFIX = 'tabgu-'; // 스플렌더 방과 섞이지 않게
export const roomPath = (code) => `${ROOMS_PATH}/${ROOM_KEY_PREFIX}${code}`;
const ICE_SERVERS = [{ urls: 'stun:stun.l.google.com:19302' }];
const JOIN_TIMEOUT_MS = 10000;

// 로비(방 목록): 규칙이 `pkmspl-rooms/$code` 만 열어 두므로 목록도 같은 규칙 안의 고정 키(tabgu-LOBBY — 실제 코드는 5/6자리라 겹치지 않음)에 둔다.
//   pkmspl-rooms/tabgu-LOBBY/rooms/{CODE}: {title, host(닉네임), created, hb}   ← 방장이 HEARTBEAT_MS 마다 hb 갱신
export const LOBBY_KEY = `${ROOM_KEY_PREFIX}LOBBY`;
export const HEARTBEAT_MS = 20000;
export const STALE_MS = 60000; // hb 가 이 시간 넘게 멈춘 방은 죽은 방 → 목록에서 빼고 지운다
export const TITLE_MAX = 20;
export const NICK_MAX = 12;
export const cleanNick = (t) => String(t ?? '').replace(/\s+/g, ' ').trim().slice(0, NICK_MAX);
export const cleanTitle = (t) => String(t ?? '').replace(/\s+/g, ' ').trim().slice(0, TITLE_MAX) || '탁구 한판';
const lobbyRoomPath = (code) => `${ROOMS_PATH}/${LOBBY_KEY}/rooms/${code}`;
/** 목록 가공(순수): 죽은 방은 stale 로 분리, 산 방은 최신순 */
export function pickLobby(rooms, now) {
  const live = []; const stale = [];
  for (const [code, r] of Object.entries(rooms || {})) {
    if (!r || typeof r !== 'object') { stale.push(code); continue; }
    if (now - (Number(r.hb) || Number(r.created) || 0) > STALE_MS) stale.push(code);
    else live.push({ code, title: cleanTitle(r.title), host: cleanNick(r.host) || '방장', created: Number(r.created) || 0 });
  }
  live.sort((a, b) => b.created - a.created);
  return { live, stale };
}

export function genCode(len = 6) {
  const buf = new Uint32Array(len);
  crypto.getRandomValues(buf);
  return Array.from(buf, (x) => CODE_CHARS[x % CODE_CHARS.length]).join('');
}

function genId(len = 12) {
  const buf = new Uint32Array(len);
  crypto.getRandomValues(buf);
  return Array.from(buf, (x) => CODE_CHARS[x % CODE_CHARS.length]).join('');
}

let _db = null;
let _sdkPromise = null;
let _mockDb = null;

/** For tests: inject a mock database. Pass null to reset. */
export function __setMockDb(db) {
  _mockDb = db;
  _db = db;
  if (!db) _sdkPromise = null;
}

async function getDb() {
  if (_db) return _db;
  if (_mockDb) { _db = _mockDb; return _db; }
  if (!_sdkPromise) {
    _sdkPromise = (async () => {
      const appMod = await import('https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js');
      const dbMod = await import('https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js');
      const cfg = (typeof window !== 'undefined' && window.__FIREBASE_CONFIG) || null;
      if (!cfg || !cfg.apiKey) throw new Error('firebase-not-configured');
      const app = appMod.initializeApp(cfg);
      _db = dbMod.getDatabase(app);
      _db._mod = dbMod; // stash for reuse
      return _db;
    })();
  }
  return _sdkPromise;
}

function dbMod(db) { return db._mod; }

function makePC() {
  return new RTCPeerConnection({ iceServers: ICE_SERVERS });
}

export class FirebaseRoom {
  constructor({ onmessage = () => {}, onjoin = () => {}, onleave = () => {} } = {}) {
    this.onmessage = onmessage;
    this.onjoin = onjoin;
    this.onleave = onleave;
    this.isHost = false;
    this.closed = false;
    // host: [{pc, dc, guestId, listeners}]
    // guest: single pc/dc to host
    this.peers = [];
    this.code = null;
    this._joinToken = null;
    this._dbRefs = []; // {ref, cb} to detach on close
    this._hb = null; // 로비 heartbeat 타이머
  }

  async _removeLobby() {
    if (this._hb) { clearInterval(this._hb); this._hb = null; }
    if (!this.code || !this._db) return;
    try { const m = dbMod(this._db); await m.remove(m.ref(this._db, lobbyRoomPath(this.code))); } catch {}
  }

  /** 로비: 열려 있는 방 목록. 죽은 방(heartbeat 끊김)은 걸러내고 DB 에서도 지운다. */
  async listRooms() {
    this._db = await getDb();
    const m = dbMod(this._db);
    const snap = await m.get(m.ref(this._db, `${ROOMS_PATH}/${LOBBY_KEY}/rooms`));
    const { live, stale } = pickLobby(snap.exists() ? snap.val() : {}, Date.now());
    for (const code of stale) {
      m.remove(m.ref(this._db, lobbyRoomPath(code))).catch(() => {});
      m.remove(m.ref(this._db, roomPath(code))).catch(() => {});
    }
    return live;
  }

  _track(ref, cb) {
    const db = this._db;
    const m = dbMod(db);
    m.onValue(ref, cb);
    this._dbRefs.push({ ref, cb });
  }

  _untrackAll() {
    if (!this._db) return;
    const m = dbMod(this._db);
    for (const { ref, cb } of this._dbRefs) {
      try { m.off(ref, 'value', cb); } catch {}
    }
    this._dbRefs = [];
  }

  _wireDataChannel(dc, idx) {
    dc.onmessage = (e) => {
      const m = parseMsg(typeof e.data === 'string' ? e.data : '');
      if (m) this.onmessage(idx, m);
    };
    const gone = () => { if (!this.closed) this.onleave(idx); };
    dc.onclose = gone;
    dc.onerror = gone;
  }

  // ---------- host ----------

  /** Host: create a room, return the 6-char code. */
  async hostCreate(title = '', nick = '') {
    this.isHost = true;
    this._db = await getDb();
    const m = dbMod(this._db);
    for (let i = 0; i < 4; i++) {
      const code = genCode();
      const roomRef = m.ref(this._db, `${ROOMS_PATH}/${ROOM_KEY_PREFIX}${code}`);
      const snap = await m.get(roomRef);
      if (snap.exists()) continue; // collision, retry
      await m.set(roomRef, { created: Date.now() });
      this.code = code;
      // 로비에 등록 + heartbeat (방장이 죽으면 onDisconnect 가 지우고, 그것도 못 하면 STALE_MS 후 목록에서 빠진다)
      try {
        const lref = m.ref(this._db, lobbyRoomPath(code));
        const now = Date.now();
        await m.set(lref, { title: cleanTitle(title), host: cleanNick(nick), created: now, hb: now });
        try { m.onDisconnect?.(lref).remove(); m.onDisconnect?.(roomRef).remove(); } catch {}
        this._hb = setInterval(() => { m.set(m.ref(this._db, `${lobbyRoomPath(code)}/hb`), Date.now()).catch(() => {}); }, HEARTBEAT_MS);
      } catch {}
      // Listen for new guest handshakes.
      const hsRef = m.ref(this._db, `${ROOMS_PATH}/${ROOM_KEY_PREFIX}${code}/handshakes`);
      this._track(hsRef, (hsSnap) => this._onHandshakes(hsSnap));
      return code;
    }
    throw new Error('room-create-failed');
  }

  async _onHandshakes(hsSnap) {
    if (this.closed || !hsSnap.exists()) return;
    const m = dbMod(this._db);
    hsSnap.forEach((child) => {
      const guestId = child.key;
      const hs = child.val() || {};
      // Skip if we already handle this guest, or no offer yet, or already answered.
      if (this.peers.some((p) => p.guestId === guestId)) return;
      if (!hs.offer || hs.answer) return;
      this._acceptGuest(guestId, hs.offer).catch(() => {});
    });
  }

  async _acceptGuest(guestId, offer) {
    const m = dbMod(this._db);
    const base = `${ROOMS_PATH}/${ROOM_KEY_PREFIX}${this.code}/handshakes/${guestId}`;
    const pc = makePC();
    const idx = this.peers.length;
    const peer = { pc, dc: null, guestId };
    this.peers.push(peer);

    pc.onicecandidate = (e) => {
      if (e.candidate) {
        m.push(m.ref(this._db, `${base}/hc`), e.candidate.toJSON()).catch(() => {});
      }
    };
    pc.onconnectionstatechange = () => {
      if (pc.connectionState === 'failed' || pc.connectionState === 'closed') {
        if (!this.closed) this.onleave(idx);
      }
    };
    pc.ondatachannel = (e) => {
      peer.dc = e.channel;
      this._wireDataChannel(peer.dc, idx);
      peer.dc.onopen = () => { if (!this.closed) { this._removeLobby(); this.onjoin(idx); } }; // 1:1 이라 손님이 들어오면 목록에서 뺀다
    };

    await pc.setRemoteDescription(new RTCSessionDescription(offer));
    const answer = await pc.createAnswer();
    await pc.setLocalDescription(answer);
    await m.set(m.ref(this._db, `${base}/answer`), { type: answer.type, sdp: answer.sdp });

    // Listen for guest ICE candidates.
    const gcRef = m.ref(this._db, `${base}/gc`);
    const seen = new Set();
    this._track(gcRef, (snap) => {
      if (!snap.exists()) return;
      snap.forEach((c) => {
        if (seen.has(c.key)) return;
        seen.add(c.key);
        pc.addIceCandidate(new RTCIceCandidate(c.val())).catch(() => {});
      });
    });
  }

  // ---------- guest ----------

  /** Guest: join with the host's code. Resolves when the DataChannel opens. */
  async guestJoin(code, onRetry = null) {
    this.isHost = false;
    const clean = String(code || '').trim().toUpperCase();
    if (!/^[A-Z2-9]{4,8}$/.test(clean)) throw new Error('bad code');
    this._db = await getDb();
    const m = dbMod(this._db);

    let lastErr = null;
    for (let attempt = 1; attempt <= 2; attempt++) {
      const token = Symbol('join');
      this._joinToken = token;
      try {
        if (attempt > 1 && onRetry) onRetry(attempt);
        // Room must exist.
        const roomSnap = await m.get(m.ref(this._db, `${ROOMS_PATH}/${ROOM_KEY_PREFIX}${clean}`));
        if (!roomSnap.exists()) throw new Error('room-not-found');

        const guestId = genId();
        const base = `${ROOMS_PATH}/${ROOM_KEY_PREFIX}${clean}/handshakes/${guestId}`;
        const pc = makePC();
        const dc = pc.createDataChannel('game');
        const peer = { pc, dc, guestId };
        this.peers = [peer];

        const openPromise = new Promise((resolve, reject) => {
          const timer = setTimeout(() => reject(new Error('connect-timeout')), JOIN_TIMEOUT_MS);
          dc.onopen = () => {
            if (this._joinToken !== token) return;
            clearTimeout(timer);
            resolve();
          };
          dc.onerror = (e) => {
            if (this._joinToken !== token) return;
            clearTimeout(timer);
            reject(e);
          };
          pc.onconnectionstatechange = () => {
            if (this._joinToken !== token) return;
            if (pc.connectionState === 'failed') {
              clearTimeout(timer);
              reject(new Error('connect-timeout'));
            }
          };
        });

        this._wireDataChannel(dc, 0);

        pc.onicecandidate = (e) => {
          if (e.candidate && this._joinToken === token) {
            m.push(m.ref(this._db, `${base}/gc`), e.candidate.toJSON()).catch(() => {});
          }
        };

        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        await m.set(m.ref(this._db, `${base}/offer`), { type: offer.type, sdp: offer.sdp });

        // Wait for host's answer.
        const answerRef = m.ref(this._db, `${base}/answer`);
        const answerPromise = new Promise((resolve, reject) => {
          const timer = setTimeout(() => reject(new Error('connect-timeout')), JOIN_TIMEOUT_MS);
          const cb = async (snap) => {
            if (!snap.exists()) return;
            if (this._joinToken !== token) return;
            clearTimeout(timer);
            m.off(answerRef, 'value', cb);
            try {
              const a = snap.val();
              await pc.setRemoteDescription(new RTCSessionDescription(a));
              resolve();
            } catch (e) { reject(e); }
          };
          m.onValue(answerRef, cb);
          this._dbRefs.push({ ref: answerRef, cb });
        });

        // Listen for host ICE candidates.
        const hcRef = m.ref(this._db, `${base}/hc`);
        const seen = new Set();
        const hcCb = (snap) => {
          if (!snap.exists() || this._joinToken !== token) return;
          snap.forEach((c) => {
            if (seen.has(c.key)) return;
            seen.add(c.key);
            pc.addIceCandidate(new RTCIceCandidate(c.val())).catch(() => {});
          });
        };
        m.onValue(hcRef, hcCb);
        this._dbRefs.push({ ref: hcRef, cb: hcCb });

        await answerPromise;
        if (this._joinToken !== token) throw new Error('cancelled');
        await openPromise;
        if (this._joinToken !== token) throw new Error('cancelled');
        this._joinToken = null;
        this.code = clean;
        return;
      } catch (e) {
        if (e && (e.message === 'room-not-found' || e.message === 'cancelled')) {
          this._joinToken = null;
          throw e;
        }
        lastErr = e;
        // Clean up this attempt's handshake node.
        try {
          const p = this.peers[0];
          if (p && p.guestId) await m.remove(m.ref(this._db, `${ROOMS_PATH}/${ROOM_KEY_PREFIX}${clean}/handshakes/${p.guestId}`));
          if (p && p.pc) p.pc.close();
        } catch {}
        this.peers = [];
        await new Promise((r) => setTimeout(r, 800));
      }
    }
    this._joinToken = null;
    throw lastErr || new Error('connect-failed');
  }

  /** Cancel an in-progress guestJoin. */
  cancelJoin() {
    this._joinToken = Symbol('cancelled');
    for (const p of this.peers) { try { p.pc && p.pc.close(); } catch {} }
    this.peers = [];
  }

  // ---------- messaging (same as PeerRoom) ----------

  _dc(i) {
    const p = this.peers[i];
    return p && p.dc && p.dc.readyState === 'open' ? p.dc : null;
  }

  sendTo(i, msg) {
    const dc = this._dc(i);
    if (dc) { try { dc.send(msg); } catch {} }
  }

  broadcast(msg, except = -1) {
    this.peers.forEach((_, i) => { if (i !== except) this.sendTo(i, msg); });
  }

  send(msg) {
    this.sendTo(0, msg);
  }

  async close() {
    this.closed = true;
    this._joinToken = Symbol('closed');
    this._untrackAll();
    if (this.isHost) await this._removeLobby();
    for (const p of this.peers) { try { p.pc && p.pc.close(); } catch {} }
    this.peers = [];
    // Host removes the room so codes don't linger.
    if (this.isHost && this.code && this._db) {
      try {
        const m = dbMod(this._db);
        await m.remove(m.ref(this._db, `${ROOMS_PATH}/${ROOM_KEY_PREFIX}${this.code}`));
      } catch {}
    }
    this.code = null;
  }
}
