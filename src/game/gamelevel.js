// 게임 난이도(보통/어려움/매우 어려움): 리그·등급 난이도(LEAGUE_BASE × TIER_MULT) 위에 곱으로 얹는다.
// 곱하는 것: AI 정확도·리턴율(반응), 패턴 읽기 속도·확률, 리듬 변칙성(공 속도 변동폭).
// 공정성 하한(MIN_REACTION_S: 바운드→밴드 중심 최소 반응창)은 어떤 난이도에서도 buildAiShot 이 강제한다 — 배율로 우회할 수 없다.
export const GAME_LEVELS = Object.freeze({
  normal: { label: '보통', desc: '기본 난이도', accuracy: 1, returnRate: 1, react: 1, readNeed: 1, readProb: 1, rhythm: 1 },
  hard: { label: '어려움', desc: '상대가 더 정확하고, 편중을 빨리 읽고, 리듬이 더 변칙적', accuracy: 1.12, returnRate: 1.1, react: 0.85, readNeed: 0.7, readProb: 1.1, rhythm: 1.4 },
  expert: { label: '매우 어려움', desc: '정확·빠른 반응·즉시 읽기·크게 흔들리는 리듬 (최소 반응창은 그대로)', accuracy: 1.25, returnRate: 1.2, react: 0.7, readNeed: 0.5, readProb: 1.2, rhythm: 1.8 },
});
export const GAME_LEVEL_ORDER = Object.freeze(['normal', 'hard', 'expert']);
export const DEFAULT_GAME_LEVEL = 'normal';
export const gameLevelOf = (key) => GAME_LEVELS[key] ?? GAME_LEVELS[DEFAULT_GAME_LEVEL];

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
/** AI 파라미터에 게임 난이도 배율을 곱한 복사본. normal 은 원본과 동일(배율 1). */
export function applyGameLevel(params, key) {
  const L = gameLevelOf(key);
  if (L === GAME_LEVELS.normal) return params;
  return {
    ...params,
    // 배율은 난이도를 높이기만 한다: 이미 상한(1.0) 근처인 상위 리그는 그대로 두고, 반응(react: 탭 시각 오차 배율)으로 추가 난이도를 준다
    accuracy: Math.max(params.accuracy, clamp(params.accuracy * L.accuracy, 0, 0.98)),
    returnRate: Math.max(params.returnRate, clamp(params.returnRate * L.returnRate, 0, 0.98)),
    reactMult: L.react,
    readNeedMult: L.readNeed, readProbMult: L.readProb, rhythmMult: L.rhythm,
    gameLevel: key,
  };
}
