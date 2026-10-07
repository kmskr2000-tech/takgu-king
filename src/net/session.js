// 멀티플레이 세션: 방(FirebaseRoom 같은 전송 계층)을 감싸 로비 → 시계 동기화 → 경기 시작 → 경기 메시지 중계 → 종료/재대결을 다룬다.
// room 인터페이스(FirebaseRoom 과 메모리 방이 같다): hostCreate()→code · guestJoin(code) · send(문자열) · onmessage(idx,객체) · onjoin(idx) · onleave(idx) · close()
import { MSG, makeMsg, createClockSync, launchDelay } from './protocol.js?v=1791354624';

export const SYNC_ROUNDS = 8;
export const SYNC_GAP_MS = 60;
export const PING_EVERY_MS = 2000;
export const PEER_TIMEOUT_S = 12; // 이 시간 동안 아무 메시지도 없으면 연결이 죽은 것으로 본다

export function createNetSession({ room, role, name = '', nowFn, timers = { setTimeout, clearTimeout, setInterval, clearInterval }, onPhase = () => {}, onStart = () => {}, onGame = () => {}, onEnd = () => {}, onRematch = () => {} }) {
  const isHost = role === 'host';
  let phase = 'idle'; // idle → (host) waiting → connected → syncing → ready → playing → ended
  let closed = false;
  let peerName = '';
  let rtt = 0.1; // 왕복(초), 부드럽게 갱신
  let offset = 0; // 호스트 실시간 - 내 실시간 (호스트는 0)
  let pingId = 0; let pinger = null; const pendingPings = new Map();
  let lastHeard = nowFn();
  let rematchMine = false; let rematchTheirs = false;
  const api = {
    get phase() { return phase; }, get peerName() { return peerName; }, get role() { return role; }, code: null,
    get rtt() { return rtt; }, get offset() { return offset; }, get delay() { return launchDelay(rtt); },
  };
  const setPhase = (p) => { phase = p; onPhase(p, api); };
  const send = (obj) => { if (!closed) room.send(makeMsg(obj.t, (({ t, ...rest }) => rest)(obj))); };
  api.send = send;

  const startPinger = () => {
    if (pinger) return;
    pinger = timers.setInterval(() => {
      if (nowFn() - lastHeard > PEER_TIMEOUT_S) { finish('timeout'); return; }
      const id = ++pingId; pendingPings.set(id, nowFn()); send({ t: MSG.PING, id, at: nowFn() }); }, PING_EVERY_MS);
  };
  const finish = (reason) => {
    if (closed) return;
    closed = true; phase = 'ended';
    if (pinger) timers.clearInterval(pinger);
    try { room.close?.(); } catch { /* 무시 */ }
    onEnd(reason, api);
  };
  api.close = (reason = 'left') => { if (!closed) { try { room.send(makeMsg(MSG.BYE)); } catch { /* 무시 */ } } finish(reason); };

  // 게스트: 호스트 시계 맞추기 (왕복이 가장 짧은 표본)
  function runSync(done) {
    const sync = createClockSync(); let sent = 0;
    const one = () => {
      if (closed) return;
      const id = ++pingId; const t0 = nowFn(); pendingPings.set(id, { t0, sync });
      send({ t: MSG.PING, id, at: t0 });
      if (++sent < SYNC_ROUNDS) timers.setTimeout(one, SYNC_GAP_MS);
      else timers.setTimeout(() => { const r = sync.result(); offset = r.offset; rtt = Math.max(0.02, r.rtt); done(); }, SYNC_GAP_MS * 4);
    };
    one();
  }

  room.onmessage = (_idx, msg) => {
    if (closed) return;
    lastHeard = nowFn();
    switch (msg.t) {
      case MSG.HELLO: // 호스트: 게스트 입장
        if (!isHost || peerName) return;
        peerName = String(msg.name ?? '').slice(0, 12) || '상대'; setPhase('connected');
        send({ t: MSG.WELCOME, name });
        break;
      case MSG.WELCOME: // 게스트: 호스트가 받아줌 → 시계 동기화
        peerName = String(msg.name ?? '').slice(0, 12) || '상대'; setPhase('syncing');
        runSync(() => { setPhase('ready'); send({ t: 'ready', rtt }); startPinger(); });
        break;
      case 'ready': // 호스트: 게스트 동기화 끝 → 경기 시작 (선공은 무작위)
        if (!isHost) return;
        rtt = Math.max(0.02, Number(msg.rtt) || rtt); startPinger();
        { const first = Math.random() < 0.5 ? 'host' : 'guest'; send({ t: MSG.START, first, rtt }); setPhase('playing'); onStart({ first, rtt, offset: 0 }, api); }
        break;
      case MSG.START: // 게스트
        if (isHost) return;
        setPhase('playing'); onStart({ first: msg.first, rtt, offset }, api);
        break;
      case MSG.PING: send({ t: MSG.PONG, id: msg.id, at: msg.at, r: nowFn() }); break;
      case MSG.PONG: {
        const p = pendingPings.get(msg.id); pendingPings.delete(msg.id);
        if (p == null) break;
        const t1 = nowFn();
        if (typeof p === 'object') p.sync.add(p.t0, msg.r, t1); // 동기화 표본
        else rtt = rtt * 0.7 + Math.max(0.02, t1 - p) * 0.3; // 평소엔 왕복만 부드럽게 갱신
        break;
      }
      case MSG.SHOT: case MSG.MISS: onGame(msg, api); break;
      case MSG.REMATCH:
        rematchTheirs = true; onRematch(api);
        if (isHost && rematchMine) restart();
        break;
      case MSG.BYE: finish('peer-left'); break;
      default:
    }
  };
  room.onleave = () => finish('disconnected');
  room.onjoin = () => { if (isHost && phase === 'waiting') setPhase('waiting'); }; // 게스트 DataChannel 열림 (HELLO 를 기다린다)

  function restart() {
    rematchMine = false; rematchTheirs = false;
    const first = Math.random() < 0.5 ? 'host' : 'guest'; send({ t: MSG.START, first, rtt }); onStart({ first, rtt, offset: 0, again: true }, api);
  }
  /** 다시 하기 요청 (양쪽이 누르면 호스트가 새 경기를 시작) */
  api.rematch = () => {
    rematchMine = true; send({ t: MSG.REMATCH });
    if (isHost && rematchTheirs) restart();
  };

  api.host = async () => { setPhase('waiting'); api.code = await room.hostCreate(); onPhase('waiting', api); return api.code; };
  api.join = async (code, onRetry) => {
    setPhase('joining'); await room.guestJoin(code, onRetry); api.code = String(code).toUpperCase();
    setPhase('connected'); send({ t: MSG.HELLO, name });
  };
  api.cancelJoin = () => room.cancelJoin?.();
  return api;
}
