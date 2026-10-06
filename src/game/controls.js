// 조작 방식. 간단(기본): 탭 한 번이 곧 샷 — 코스는 탭 위치, 샷 종류는 미리 고른 버튼. 고급: 탭 + 쓸기(스핀/파워).
export const CONTROL_MODES = Object.freeze({
  simple: { label: '간단', desc: '샷 버튼을 누르는 순간이 스윙. 코스는 코트를 탭해 정하고, 샷 종류는 상대 공을 보고 골라요' },
  advanced: { label: '고급', desc: '탭하면서 위/아래로 쓸어 스핀·파워를 직접 조절 (기존 방식)' },
});
export const CONTROL_ORDER = Object.freeze(['simple', 'advanced']);
export const DEFAULT_CONTROL_MODE = 'simple';

/**
 * 간단 조작의 샷 종류. power/spin 은 스탯 3~14 전 구간 실측(GOOD·PERFECT)에서 성공률이 스탯에 따라 내려가지 않는 값만 쓴다
 * (test/controls.test.js 가 이 단조성을 계속 검사한다). 0.65 이상은 PERFECT 보너스와 겹쳐 스탯이 높을수록 네트에 걸려서 제외했다.
 */
export const SHOT_TYPES = Object.freeze({
  // 전략적 역할 (수치는 test/strategy.test.js 의 시뮬레이션으로 검증):
  //  - leniency: 내 타이밍 존(받아주는 범위) 배율 / error: 샷 오차 배율 → 공격은 위험(좁고 흔들림), 수비는 안정(넓고 정확)
  //  - 탑스핀(공격·위험): 빠른 공으로 상대를 압박하지만, 존이 좁고 막히면 상대가 역습한다(AI_TEMPO.counter*)
  //  - 커트(수비·안정): 존이 넓고 안전, 상대는 약하게·스핀 없이 돌려준다(리셋). 단 커트만으로는 점수를 못 낸다
  normal: { label: '일반', tag: '기본', power: 0.5, spin: 0, leniency: 1.0, error: 1.0, desc: '탑스핀 공에 강함 · 무난하게', color: '#f4f4f4' },
  topspin: { label: '탑스핀', tag: '공격·위험', power: 0.6, spin: 1, leniency: 0.6, error: 2.0, desc: '커트 공에 강함 · 빠른 압박 · 역습 주의', color: '#ff5a4a' },
  // 커트 파워 0.5: 파워 0.8 은 제어 상한(0.65)을 넘어 깊이 날아가 늦은 타이밍에 아웃이 났다 (어느 타격 위치에서도 목표에 100% 착지)
  cut: { label: '커트', tag: '수비·안정', power: 0.5, spin: -1, depth: 60, leniency: 1.4, error: 0.5, desc: '일반 공에 강함 · 상대 강타 봉쇄', color: '#4aa3ff' },
});

/** 상대 공의 빠르기(바운드 후 속도): 상황 판단 안내용. fast → 커트로 리셋, slow → 탑스핀 공격 기회 */
export const BALL_SPEED_CLASS = Object.freeze({ fast: 260, slow: 150 });
export function ballSpeedClass(speed) { return speed >= BALL_SPEED_CLASS.fast ? 'fast' : speed <= BALL_SPEED_CLASS.slow ? 'slow' : 'normal'; }

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

/**
 * 상성(가위바위보): 탑스핀 > 커트 > 일반 > 탑스핀.
 *  - 탑스핀은 느린 커트볼을 공격한다 / 커트는 일반 공을 낮게 깔아 죽인다 / 일반(블록)은 빠른 탑스핀의 힘을 되돌린다
 * 상대가 친 공의 종류(스핀)를 보고 내 샷을 고른다. 유리하면 내 존이 넓고 오차가 작으며 상대가 흔들리고, 불리하면 반대.
 * (간단 조작 전용 — 고급 조작은 샷 종류가 없다)
 */
export const BEATS = Object.freeze({ topspin: 'cut', cut: 'normal', normal: 'topspin' });
export const MATCHUP_FX = Object.freeze({
  // 유효타 밴드(타이밍 존) 배율: 유리하면 확 넓고(×1.6) 불리하면 확 좁다(×0.65) — 체감이 되도록 (PERFECT 구간 0.3 보다는 항상 넓게 유지)
  win: { leniency: 1.6, error: 0.7, aiSigma: 1.3 },
  lose: { leniency: 0.65, error: 1.4, aiSigma: 0.8 },
  even: { leniency: 1, error: 1, aiSigma: 1 },
});
const SPIN_CLASS_AT = 0.5;
/** 날아오는 공의 스핀 → 샷 종류 키 */
export const shotKeyOfSpin = (spin = 0) => (spin > SPIN_CLASS_AT ? 'topspin' : spin < -SPIN_CLASS_AT ? 'cut' : 'normal');
/** 상대 공 종류(incoming) 에 내가 mine 으로 받을 때: 'win' | 'lose' | 'even' */
export function matchupOf(mine, incoming) {
  if (!incoming || mine === incoming) return 'even';
  return BEATS[mine] === incoming ? 'win' : 'lose';
}
/** incoming 을 이기는 샷 종류 */
export const counterOf = (incoming) => Object.keys(BEATS).find((k) => BEATS[k] === incoming) ?? null;
export const MATCHUP_LABEL = Object.freeze({
  topspin: '탑스핀 공 → 일반으로 받아치면 유리!',
  cut: '커트 공 → 탑스핀으로 공격하면 유리!',
  normal: '일반 공 → 커트로 깔아 치면 유리!',
});
