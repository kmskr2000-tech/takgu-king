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

/** 실시간(초)을 받아 게임 시계(초)를 돌려주는 함수. 시작 시각 기준이라 경기마다 0 부터 */
export function createGameClock(nowFn, scale = 1) {
  const t0 = nowFn();
  return Object.assign(() => (nowFn() - t0) * scale, { scale });
}
