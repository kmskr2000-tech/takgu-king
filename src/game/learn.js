// 상성 학습 진행도 (게임성 리뷰 #2·#16): 이기는 샷(카운터)을 누적해서 쌓은 횟수가 LEARN_COUNTERS 에 닿으면 "이기는 구질" 글자 힌트를 거둔다.
// 경기 수가 아니라 실제로 카운터를 해 본 횟수 기준 — 안내를 건너뛰어도, 일부러 한 가지 샷만 써도 학습이 안 되었으면 힌트가 남는다. 시즌 저장과 별도 키(새로 시작하면 초기화).
export const LEARN_KEY = 'tabgu-king-learn-v1';
export const LEARN_COUNTERS = 15;

export function createLearnStore(storage = globalThis.localStorage) {
  let n = 0;
  try { n = Math.max(0, Math.floor(Number(JSON.parse(storage?.getItem(LEARN_KEY) ?? '{}').counters) || 0)); } catch { n = 0; }
  const save = () => { try { storage?.setItem(LEARN_KEY, JSON.stringify({ counters: n })); } catch { /* 무시 */ } };
  return {
    get counters() { return n; },
    get done() { return n >= LEARN_COUNTERS; },
    add(k = 1) { if (n >= LEARN_COUNTERS) return n; n += k; save(); return n; }, // 상한에서 멈춤 (저장 쓰기 줄이기)
    clear() { n = 0; try { storage?.removeItem(LEARN_KEY); } catch { /* 무시 */ } },
  };
}
