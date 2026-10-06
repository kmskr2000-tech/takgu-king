// 조작 방식. 간단(기본): 탭 한 번이 곧 샷 — 코스는 탭 위치, 샷 종류는 미리 고른 버튼. 고급: 탭 + 쓸기(스핀/파워).
export const CONTROL_MODES = Object.freeze({
  simple: { label: '간단', desc: '탭 한 번으로 치기. 샷 종류는 아래 버튼으로 미리 고르고, 코스는 탭 위치로' },
  advanced: { label: '고급', desc: '탭하면서 위/아래로 쓸어 스핀·파워를 직접 조절 (기존 방식)' },
});
export const CONTROL_ORDER = Object.freeze(['simple', 'advanced']);
export const DEFAULT_CONTROL_MODE = 'simple';

/**
 * 간단 조작의 샷 종류. power/spin 은 스탯 3~14 전 구간 실측(GOOD·PERFECT)에서 성공률이 스탯에 따라 내려가지 않는 값만 쓴다
 * (test/controls.test.js 가 이 단조성을 계속 검사한다). 0.65 이상은 PERFECT 보너스와 겹쳐 스탯이 높을수록 네트에 걸려서 제외했다.
 */
export const SHOT_TYPES = Object.freeze({
  normal: { label: '일반', power: 0.5, spin: 0, desc: '안정적인 기본 샷', color: '#f4f4f4' },
  topspin: { label: '탑스핀', power: 0.6, spin: 1, desc: '빠르고 낮게! 상대를 압박해요', color: '#ff5a4a' },
  cut: { label: '커트', power: 0.8, spin: -1, depth: 60, desc: '느리고 높게. 상대의 강타를 막아요', color: '#4aa3ff' },
});
export const SHOT_ORDER = Object.freeze(['normal', 'topspin', 'cut']);
export const DEFAULT_SHOT_TYPE = 'normal';
export const shotTypeOf = (key) => SHOT_TYPES[key] ?? SHOT_TYPES[DEFAULT_SHOT_TYPE];

/** 간단 조작: 코스(targetX) + 샷 종류 → createShot 의 aim */
export function simpleAim(targetX, shotKey) {
  const t = shotTypeOf(shotKey);
  const aim = { targetX, power: t.power, spin: t.spin };
  if (t.depth != null) aim.depth = t.depth;
  return aim;
}
