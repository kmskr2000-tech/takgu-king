// 공 속도 = 게임 시계의 배율(시간 확대). 물리·AI·판정은 게임 시계로만 돌기 때문에
// 궤적 모양(네트/아웃 확률), AI 정확도, 리그별 난이도 곡선이 그대로 유지되고 실시간 길이만 1/scale 로 늘어난다.
export const BALL_SPEED = Object.freeze({
  slow: { scale: 0.65, label: '느리게', desc: '공이 천천히 날아와요 (처음이라면 추천)' },
  normal: { scale: 0.8, label: '보통', desc: '기존보다 20% 느리게' },
  original: { scale: 1, label: '원래 속도', desc: '처음 만든 빠르기 그대로' },
});
export const BALL_SPEED_ORDER = Object.freeze(['slow', 'normal', 'original']);
export const DEFAULT_BALL_SPEED = 'normal';
export const ballSpeedOf = (key) => BALL_SPEED[key] ?? BALL_SPEED[DEFAULT_BALL_SPEED];

/**
 * 실시간(초)을 받아 게임 시계(초)를 돌려주는 함수. 시작 시각 기준이라 경기마다 0 부터.
 * pause()/resume(): 시계를 멈췄다 이어간다 (첫 경기 안내 화면 동안 랠리가 그대로 멈춘다 — 물리·AI·판정이 전부 이 시계만 본다).
 * slow(m): 실시간 속도에 곱하는 추가 배율(첫 공 안내 뒤 슬로모션). slow(1) 로 원복. 멈춤·슬로를 안 쓰면 (실시간 - 시작) × scale 과 비트 동일.
 * pausedFor(): 지금까지 멈춰 있던 실시간 합(포기 판정 시간에서 빼기 위해).
 */
export function createGameClock(nowFn, scale = 1) {
  const t0 = nowFn();
  let pausedAt = null; let pausedTotal = 0; let mult = 1; let slowFrom = 0; let adj = 0;
  const elapsed = () => (pausedAt ?? nowFn()) - t0 - pausedTotal; // 멈춘 시간을 뺀 실시간
  const clock = () => { const e = elapsed(); return (e + adj + (mult !== 1 ? (mult - 1) * (e - slowFrom) : 0)) * scale; };
  return Object.defineProperties(clock, { // (Object.assign 은 getter 를 값으로 복사해 버리므로 defineProperties)
    scale: { value: scale },
    pause: { value() { if (pausedAt == null) pausedAt = nowFn(); } },
    resume: { value() { if (pausedAt != null) { pausedTotal += nowFn() - pausedAt; pausedAt = null; } } },
    paused: { get: () => pausedAt != null },
    slow: { value(m) { const e = elapsed(); if (mult !== 1) adj += (mult - 1) * (e - slowFrom); mult = m; slowFrom = e; } },
    pausedFor: { value: () => pausedTotal + (pausedAt != null ? nowFn() - pausedAt : 0) },
  });
}
