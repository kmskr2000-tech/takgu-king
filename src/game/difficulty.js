// 조작 난이도. 어려움 = 완화 없음(기존 동작 그대로). 완화는 '탭을 받아주는 범위'와 코스 보조에만 적용한다.
export const DIFFICULTY = Object.freeze({
  // tutorial: 설정 목록(DIFFICULTY_ORDER)에는 나오지 않는 튜토리얼 전용. 아주 넉넉한 판정 + 코스 보조 없음(코스를 배우는 단계가 있으므로)
  tutorial: { label: '튜토리얼', leniency: 1.8, assistCourse: false, desc: '튜토리얼 전용: 판정 범위 1.8배' },
  easy: { label: '쉬움', leniency: 1.6, assistCourse: true, desc: '판정 범위 1.6배 + 코스 자동 보정(상대가 먼 쪽으로 보냄)' },
  normal: { label: '보통', leniency: 1.3, assistCourse: false, desc: '판정 범위 1.3배' },
  hard: { label: '어려움', leniency: 1.0, assistCourse: false, desc: '기존 판정 그대로' },
});
export const DEFAULT_DIFFICULTY = 'normal';
export const DIFFICULTY_ORDER = Object.freeze(['easy', 'normal', 'hard']);
export const difficultyOf = (key) => DIFFICULTY[key] ?? DIFFICULTY[DEFAULT_DIFFICULTY];

/** 코스 보조: 상대(aiX)에게서 가장 먼 코스. 같은 거리면 탭한 쪽을 따른다 */
export function assistTargetX(aiX, tapTargetX, columns = [20, 50, 80]) {
  let best = columns[0]; let bestD = -1;
  for (const c of columns) {
    const d = Math.abs(c - aiX);
    if (d > bestD + 1e-9 || (Math.abs(d - bestD) <= 1e-9 && Math.abs(c - tapTargetX) < Math.abs(best - tapTargetX))) { best = c; bestD = d; }
  }
  return best;
}
