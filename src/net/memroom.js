// 메모리 방: 테스트·QA 용 전송 계층. FirebaseRoom 과 같은 인터페이스, 지연을 시뮬레이션한다.
const registry = new Map();
let seq = 0;
export function createMemoryNetwork({ oneWayMs = 20, schedule = (fn, ms) => setTimeout(fn, ms) } = {}) {
  const net = { rooms: registry, oneWayMs };
  net.room = () => {
    const r = { onmessage: () => {}, onjoin: () => {}, onleave: () => {}, isHost: false, code: null, peer: null, closed: false };
    const deliver = (to, fn) => schedule(() => { if (!to.closed) fn(); }, net.oneWayMs);
    r.send = (raw) => { const p = r.peer; if (!p) return; deliver(p, () => { try { p.onmessage(0, JSON.parse(raw)); } catch { /* 무시 */ } }); };
    r.hostCreate = async () => { r.isHost = true; r.code = `T${String(++seq).padStart(5, '0')}`.replace(/0/g, 'A').replace(/1/g, 'B'); registry.set(r.code, r); return r.code; };
    r.guestJoin = async (code) => {
      const h = registry.get(String(code).toUpperCase());
      if (!h || h.peer) throw new Error('room-not-found');
      r.peer = h; h.peer = r; r.code = h.code; schedule(() => h.onjoin(0), net.oneWayMs);
    };
    r.cancelJoin = () => {};
    r.close = async () => {
      if (r.closed) return; r.closed = true;
      if (r.isHost && r.code) registry.delete(r.code);
      const p = r.peer; r.peer = null; if (p && !p.closed) schedule(() => { if (!p.closed) p.onleave(0); }, net.oneWayMs);
    };
    return r;
  };
  net.reset = () => registry.clear();
  return net;
}
