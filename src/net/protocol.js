// 탁구왕 멀티플레이 프로토콜: 메시지 모양, 샷 직렬화/미러링, 시계 동기화. 전송 계층(WebRTC DataChannel)과 무관한 순수 로직.
//
// 동기화 방식 (타이밍 게임이라 입력 락스텝은 쓰지 않는다):
//  - 각자 "자기 화면의 판정"은 자기 기기에서 내린다 (내가 친 시각 ↔ 내 화면의 띠). 네트워크 지연이 내 타격 판정에 끼지 않는다.
//  - 샷을 친 쪽이 샷의 초기 상태(공 위치·속도·스핀)와 판정 결과, "발사 시각(호스트 시계)" 을 보낸다. 받는 쪽은 좌표를 미러링(내 쪽/상대 쪽 뒤집기)해
//    같은 물리(simulateFlight)를 돌리므로 두 화면의 공이 같다. 득점·서브 교대는 양쪽이 같은 상태기계(createMatch)에 같은 순서로 먹여 같게 나온다.
//  - 공정성: 친 쪽은 공을 DELAY 만큼 늦게 발사(스윙·소리는 즉시)해, 받는 쪽이 공을 "미리" 볼 시간을 번다. DELAY ≈ 편도 지연 + 여유.
import { SIDES } from '../core/constants.js?v=1791434034';

export const MSG = {
  HELLO: 'hello',   // G→H {name}
  WELCOME: 'welcome', // H→G {name}
  START: 'start',   // H→G {firstServer: 'host'|'guest'}  (경기 시작)
  PING: 'ping',     // 양방향 {id, t}  t = 보낸 쪽 실시간 시계
  PONG: 'pong',     // 양방향 {id, t, r}  t = 원래 ping 의 t, r = 응답 쪽 실시간 시계
  SHOT: 'shot',     // 친 공: {serve, shot, launchAt, special?, judgement?}
  MISS: 'miss',     // 못 받음 {reason}
  REMATCH: 'rematch', // 다시 하기 요청
  BYE: 'bye',       // 나감
};

const r4 = (v) => Math.round(v * 1e4) / 1e4;

/** 샷 → 전송용 객체 (내 화면 기준 좌표) */
export function packShot(shot) {
  const b = shot.ball;
  return { power: r4(shot.power), spin: r4(shot.spin), dir: shot.dir, ball: { x: r4(b.x), y: r4(b.y), z: r4(b.z ?? 12), vx: r4(b.vx), vy: r4(b.vy), vz: r4(b.vz), spin: r4(b.spin) } };
}

/**
 * 상대 화면 기준 샷으로 뒤집는다: 마주 보고 있으므로 좌우(x)·앞뒤(y)가 모두 반대. 코트 좌표는 x 0..100, y 0..200 (네트 y=100).
 * 물리가 이 뒤집기에 대칭이라 두 화면에서 같은 비행(착지·네트·아웃)이 나온다 (test/net.test.js 가 검증).
 */
export function mirrorShot(packed, side = SIDES.OPP) {
  const b = packed.ball;
  return { side, dir: -packed.dir, power: packed.power, spin: packed.spin, ball: { x: 100 - b.x, y: 200 - b.y, z: b.z, vx: -b.vx, vy: -b.vy, vz: b.vz, spin: b.spin } };
}

export function makeMsg(t, body = {}) { return JSON.stringify({ t, ...body }); }
export function parseMsg(raw) {
  try { const o = JSON.parse(raw); return o && typeof o.t === 'string' ? o : null; } catch { return null; }
}

/**
 * 시계 동기화 (NTP 식): ping 을 여러 번 주고받아 왕복이 가장 짧은 표본의 오프셋을 쓴다.
 * offset = (호스트 실시간) - (내 실시간) 을 게스트가 구한다. 호스트는 항상 0.
 */
export function createClockSync() {
  const samples = [];
  return {
    /** 한 번의 ping/pong 결과: t0 = ping 보낸 내 시각, r = 상대가 pong 에 찍은 상대 시각, t1 = pong 받은 내 시각 */
    add(t0, r, t1) {
      const rtt = t1 - t0;
      if (rtt < 0) return;
      samples.push({ rtt, offset: r - (t0 + rtt / 2) });
    },
    get count() { return samples.length; },
    /** 가장 짧은 왕복 표본(들)의 평균 오프셋과 왕복 시간 */
    result() {
      if (!samples.length) return { offset: 0, rtt: 0.1 };
      const best = [...samples].sort((a, b) => a.rtt - b.rtt).slice(0, 3);
      return { offset: best.reduce((s, x) => s + x.offset, 0) / best.length, rtt: best[0].rtt };
    },
  };
}

/** 발사 지연(초): 편도 지연 + 여유. 너무 작으면 받는 쪽에서 공이 이미 날아간 뒤에 보이고, 너무 크면 내 공이 굼뜨다. */
export const launchDelay = (rtt) => Math.min(0.22, Math.max(0.07, rtt / 2 + 0.04));
