// 멀티플레이 시계 변환: 컨트롤러는 "게임 시계"(공 속도 배율이 곱해진 시간)로 돌고, 네트워크 시각은 실시간(초, 호스트 기준)이다.
//   host실시간 = 내 실시간 + offset      게임시간 = clock()  (clock = createGameClock(nowFn, scale))
export function createNetClock({ nowFn, clock, scale = 1, offset = 0 }) {
  const api = {
    scale,
    offset,
    setOffset(o) { api.offset = o; },
    /** 지금의 호스트 실시간 */
    hostNow: () => nowFn() + api.offset,
    /** 게임시간 g → 호스트 실시간 */
    gameToHost: (g) => nowFn() + api.offset + (g - clock()) / scale,
    /** 호스트 실시간 h → 게임시간 */
    hostToGame: (h) => clock() + (h - (nowFn() + api.offset)) * scale,
  };
  return api;
}
