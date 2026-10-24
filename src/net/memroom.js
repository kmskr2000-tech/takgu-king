// 메모리 방: 테스트·QA 용 전송 계층. FirebaseRoom 과 같은 인터페이스, 지연을 시뮬레이션한다.
import { nickKey, decideClaim } from './nicks.js?v=1792845966';
const registry = new Map();
const nickRegistry = new Map(); // 닉네임 선점 레코드 (FirebaseRoom 의 NICK 노드와 같은 규칙)
let seq = 0; let createdSeq = 0;
export function createMemoryNetwork({ oneWayMs = 20, schedule = (fn, ms) => setTimeout(fn, ms) } = {}) {
  const net = { rooms: registry, oneWayMs };
  net.room = () => {
    const r = { onmessage: () => {}, onjoin: () => {}, onleave: () => {}, isHost: false, code: null, peer: null, closed: false };
    const deliver = (to, fn) => schedule(() => { if (!to.closed) fn(); }, net.oneWayMs);
    r.send = (raw) => { const p = r.peer; if (!p) return; deliver(p, () => { try { p.onmessage(0, JSON.parse(raw)); } catch { /* 무시 */ } }); };
    r.hostCreate = async (title = '', nick = '', { password = '', quick = false, uid = '' } = {}) => { r.isHost = true; r.password = String(password || ''); r.quick = !!quick; r.uid = String(uid || ''); r.createdAt = ++createdSeq; r.nick = String(nick || '방장').slice(0, 12); r.title = String(title || '탁구 한판').slice(0, 20); r.code = `T${String(++seq).padStart(5, '0')}`.replace(/0/g, 'A').replace(/1/g, 'B'); registry.set(r.code, r); return r.code; };
    r.guestJoin = async (code, _onRetry, { password = '' } = {}) => {
      const h = registry.get(String(code).toUpperCase());
      if (!h || h.peer) throw new Error('room-not-found');
      if (h.password && h.password !== password) throw new Error('bad-password');
      r.peer = h; h.peer = r; r.code = h.code; schedule(() => h.onjoin(0), net.oneWayMs);
    };
    r.cancelJoin = () => {};
    r.listRooms = async () => [...registry.values()].filter((x) => x.isHost && !x.peer && !x.closed).map((x) => ({ code: x.code, title: x.title, host: x.nick, created: x.createdAt, lock: !!x.password, quick: !!x.quick, uid: x.uid })).reverse();
    r.claimNick = async (nick, uid) => {
      const key = nickKey(nick); const d = decideClaim(nickRegistry.get(key), { uid, nick, now: net.now() });
      if (!d.ok) return 'taken'; nickRegistry.set(key, d.value); return 'ok';
    };
    r.releaseNick = async (nick, uid) => { const key = nickKey(nick); if (nickRegistry.get(key)?.uid === uid) nickRegistry.delete(key); };
    r.close = async () => {
      if (r.closed) return; r.closed = true;
      if (r.isHost && r.code) registry.delete(r.code);
      const p = r.peer; r.peer = null; if (p && !p.closed) schedule(() => { if (!p.closed) p.onleave(0); }, net.oneWayMs);
    };
    return r;
  };
  net.now = () => Date.now();
  net.nicks = nickRegistry;
  net.reset = () => { registry.clear(); nickRegistry.clear(); };
  return net;
}
